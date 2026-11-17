// Task-list Merkle tree. Domain-separated (0x00 leaf, 0x01 node); an odd last node is
// promoted unchanged (no duplication, avoiding the CVE-2012-2459 ambiguity).
import { bytes32, bytesToHex, concat, equal, sha256, uintLE, utf8 } from './bytes.js';

/** leaf = H(0x00 || len(slug) || slug || H(instructions) || H(stub) || H(tests) || containerDigest) */
export function taskLeaf({ slug, instructionsHash, stubHash, testsHash, containerDigest }) {
  const s = utf8(slug);
  if (s.length === 0 || s.length > 255) throw new Error('slug length 1..255');
  return sha256(concat(new Uint8Array([0x00]), uintLE(s.length, 1), s,
    bytes32(instructionsHash, 'instructionsHash'), bytes32(stubHash, 'stubHash'),
    bytes32(testsHash, 'testsHash'), bytes32(containerDigest, 'containerDigest')));
}

const node = (l, r) => sha256(concat(new Uint8Array([0x01]), l, r));

function levels(leaves) {
  if (leaves.length === 0) throw new Error('empty tree');
  const lv = [leaves.map((l) => bytes32(l))];
  while (lv.at(-1).length > 1) {
    const cur = lv.at(-1), next = [];
    for (let i = 0; i < cur.length; i += 2) next.push(i + 1 < cur.length ? node(cur[i], cur[i + 1]) : cur[i]);
    lv.push(next);
  }
  return lv;
}

export const merkleRoot = (leaves) => bytesToHex(levels(leaves).at(-1)[0]);

/** Proof: list of { hash, left } where left=true means the sibling is on the left. */
export function merkleProof(leaves, index) {
  if (index < 0 || index >= leaves.length) throw new Error('index out of range');
  const proof = [];
  let i = index;
  for (const lv of levels(leaves).slice(0, -1)) {
    const sib = i ^ 1;
    if (sib < lv.length) proof.push({ hash: bytesToHex(lv[sib]), left: sib < i });
    i >>= 1;
  }
  return proof;
}

export function verifyMerkleProof(leaf, index, proof, rootHex, count) {
  // Recompute, checking positions match index/count so a proof can't be replayed at another index.
  let h = bytes32(leaf), i = index, width = count, p = 0;
  while (width > 1) {
    const sib = i ^ 1;
    if (sib < width) {
      const step = proof[p++];
      if (!step || step.left !== (sib < i)) return false;
      const s = bytes32(step.hash);
      h = step.left ? node(s, h) : node(h, s);
    }
    i >>= 1; width = Math.ceil(width / 2);
  }
  return p === proof.length && equal(h, bytes32(rootHex));
}
