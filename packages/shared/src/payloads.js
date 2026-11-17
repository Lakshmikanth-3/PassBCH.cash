// PassRate.cash on-chain payload codec (protocol v1). Spec: docs/PROTOCOL.md
import { bytesToHex, concat, hexToBytes, readUintLE, uintLE, bytes32, utf8 } from './bytes.js';

export const MAGIC = utf8('PR2');
export const VERSION = 1;
export const TYPES = { MANIFEST: 'M', TICKET: 'T', START: 'S', RESULT: 'R' };
export const MAX_OP_RETURN = 223; // standardness limit for the whole OP_RETURN script
export const LANES = { PUBLIC: 0, FRESH: 1 };
export const MODES = { TICKET: 0, SCHEDULED: 1 };

// Field layout per type: [name, kind, size]. kinds: u (uint LE), h (32-byte hash), b (raw bytes)
export const LAYOUTS = {
  M: [['day', 'u', 4], ['lane', 'u', 1], ['taskCount', 'u', 2], ['taskRoot', 'h', 32],
      ['harnessDigest', 'h', 32], ['rosterHash', 'h', 32], ['ruleVersion', 'u', 1]],
  T: [['tipHeight', 'u', 4], ['tipHash', 'h', 32], ['agentIdx', 'u', 1], ['payerPk', 'b', 33]],
  S: [['mode', 'u', 1], ['ref', 'h', 32], ['refHeight', 'u', 4], ['taskRoot', 'h', 32],
      ['taskIdx', 'u', 2], ['agentIdx', 'u', 1], ['modelIdx', 'u', 1], ['lane', 'u', 1],
      ['harnessDigest', 'h', 32], ['deadlineUnix', 'u', 4], ['attemptPolicy', 'u', 1]],
  R: [['startTxid', 'h', 32], ['exit', 'u', 1], ['passed', 'u', 2], ['total', 'u', 2],
      ['testOutHash', 'h', 32], ['transcriptHash', 'h', 32], ['solutionHash', 'h', 32],
      ['durationS', 'u', 2], ['costMilliUSD', 'u', 4]],
};

const HEADER = MAGIC.length + 2; // magic + version + type

export function payloadSize(type) {
  return HEADER + LAYOUTS[type].reduce((n, f) => n + f[2], 0);
}

export function encodePayload(type, fields) {
  const layout = LAYOUTS[type];
  if (!layout) throw new Error(`unknown type ${type}`);
  const parts = [MAGIC, new Uint8Array([VERSION, type.charCodeAt(0)])];
  for (const [name, kind, size] of layout) {
    const v = fields[name];
    if (v === undefined) throw new Error(`${type}.${name} missing`);
    if (kind === 'u') parts.push(uintLE(v, size));
    else if (kind === 'h') parts.push(bytes32(v, name));
    else {
      const b = typeof v === 'string' ? hexToBytes(v) : v;
      if (b.length !== size) throw new Error(`${type}.${name} must be ${size} bytes`);
      parts.push(b);
    }
  }
  validate(type, fields);
  return concat(...parts);
}

export function decodePayload(bytes) {
  if (bytes.length < HEADER) throw new Error('payload too short');
  for (let i = 0; i < MAGIC.length; i++) if (bytes[i] !== MAGIC[i]) throw new Error('bad magic');
  if (bytes[3] !== VERSION) throw new Error(`unsupported version ${bytes[3]}`);
  const type = String.fromCharCode(bytes[4]);
  const layout = LAYOUTS[type];
  if (!layout) throw new Error(`unknown type ${type}`);
  if (bytes.length !== payloadSize(type)) throw new Error(`bad length for ${type}: ${bytes.length}`);
  const out = { type };
  let o = HEADER;
  for (const [name, kind, size] of layout) {
    out[name] = kind === 'u' ? readUintLE(bytes, o, size) : bytesToHex(bytes.slice(o, o + size));
    o += size;
  }
  validate(type, out);
  return out;
}

function validate(type, f) {
  if (type === 'T') {
    const pk = typeof f.payerPk === 'string' ? hexToBytes(f.payerPk) : f.payerPk;
    if (pk[0] !== 2 && pk[0] !== 3) throw new Error('payerPk must be a compressed pubkey');
  }
  if ((type === 'M' || type === 'S') && !Object.values(LANES).includes(Number(f.lane))) throw new Error('bad lane');
  if (type === 'S' && !Object.values(MODES).includes(Number(f.mode))) throw new Error('bad mode');
  if (type === 'R' && Number(f.passed) > Number(f.total)) throw new Error('passed > total');
  if (type === 'M' && Number(f.taskCount) === 0) throw new Error('taskCount must be > 0');
}

/** OP_RETURN locking bytecode: OP_RETURN <single push of payload>. */
export function toOpReturn(payload) {
  const push = payload.length <= 75
    ? concat(new Uint8Array([payload.length]), payload)
    : concat(new Uint8Array([0x4c, payload.length]), payload); // OP_PUSHDATA1
  const script = concat(new Uint8Array([0x6a]), push);
  if (script.length > MAX_OP_RETURN) throw new Error(`OP_RETURN ${script.length} B > ${MAX_OP_RETURN}`);
  return script;
}

export function fromOpReturn(script) {
  const s = typeof script === 'string' ? hexToBytes(script) : script;
  if (s[0] !== 0x6a) throw new Error('not OP_RETURN');
  let len, o;
  if (s[1] === 0x4c) { len = s[2]; o = 3; } else if (s[1] >= 1 && s[1] <= 75) { len = s[1]; o = 2; } else throw new Error('unsupported push');
  if (o + len !== s.length) throw new Error('trailing or missing bytes');
  return decodePayload(s.slice(o));
}
