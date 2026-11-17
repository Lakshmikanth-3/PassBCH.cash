// Task list -> Merkle root. Leaf = H(0x00 || slug || H(instructions) || H(stub) || H(tests) || containerDigest).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { sha256, bytesToHex, utf8, taskLeaf, merkleRoot, encodePayload } from '@passrate/shared';
import { PATHS, ROSTER } from './config.js';

const fileHash = (p) => bytesToHex(sha256(new Uint8Array(fs.readFileSync(p))));

export function containerDigest(image = 'passrate-runner:py312') {
  const id = execFileSync('docker', ['image', 'inspect', image, '--format', '{{.Id}}'], { encoding: 'utf8' }).trim();
  if (!/^sha256:[0-9a-f]{64}$/.test(id)) throw new Error(`bad image id ${id}`);
  return id.slice(7);
}

/** harnessDigest commits to the exact harness code that runs the agent and tests. */
export function harnessDigest() {
  const files = ['harness.py', 'run_one.py', 'Dockerfile'].map((f) => fileHash(path.join(PATHS.harness, f)));
  return bytesToHex(sha256(utf8(files.join(''))));
}

export const rosterHash = () => bytesToHex(sha256(utf8(JSON.stringify(ROSTER))));

/** Ordered task list (order = index used by the draw). */
export function buildTasks({ exercisesDir = PATHS.exercises, t3 = PATHS.t3, digest } = {}) {
  const sel = JSON.parse(fs.readFileSync(t3, 'utf8'));
  const cd = digest ?? containerDigest();
  return sel.included.map(({ slug }) => {
    const ex = path.join(exercisesDir, slug);
    const cfg = JSON.parse(fs.readFileSync(path.join(ex, '.meta', 'config.json'), 'utf8'));
    const t = {
      slug,
      instructionsHash: fileHash(path.join(ex, '.docs', 'instructions.md')),
      stubHash: fileHash(path.join(ex, cfg.files.solution[0])),
      testsHash: fileHash(path.join(ex, cfg.files.test[0])),
      containerDigest: cd,
    };
    return { ...t, leaf: bytesToHex(taskLeaf(t)) };
  });
}

export function manifestPayload(tasks, { day = Math.floor(Date.now() / 86400000), lane = 0, hDigest, rHash } = {}) {
  return encodePayload('M', {
    day, lane, taskCount: tasks.length, taskRoot: merkleRoot(tasks.map((t) => t.leaf)),
    harnessDigest: hDigest ?? harnessDigest(), rosterHash: rHash ?? rosterHash(), ruleVersion: 1,
  });
}
