// Tiny file store shared by the feed, the hooks and the status line. Never throws on read.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const home = () => process.env.PASSRATE_HOME || path.join(os.homedir(), '.passrate');
const file = (name) => path.join(home(), name);

export function readJson(name) {
  try { return JSON.parse(fs.readFileSync(file(name), 'utf8')); } catch { return null; }
}
export function writeJson(name, value) {
  fs.mkdirSync(home(), { recursive: true });
  const tmp = file(`${name}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(value));
  fs.renameSync(tmp, file(name)); // atomic: the status line never sees half a file
}
export function remove(name) { try { fs.unlinkSync(file(name)); } catch { /* already gone */ } }
