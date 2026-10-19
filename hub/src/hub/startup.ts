// Deliberate stops reserve a short restart window for the CLI; crashes create no marker.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Starter = { client: 'cli' | 'nvim' | 'other'; parentPid: number; cwd: string };
// Reserve operator restart time while leaving startup headroom before the
// Claude Code mod bridge expires after roughly 60 s without a hub.
export const STOP_GRACE_MS = 30_000;
const marker = (root: string): string => join(root, '.cland', 'run', 'hub-stop.json');

export function markHubStop(root: string): void {
  mkdirSync(join(root, '.cland', 'run'), { recursive: true });
  writeFileSync(marker(root), JSON.stringify({ expiresAt: Date.now() + STOP_GRACE_MS }), { mode: 0o600 });
}

export function autostartDeferred(root: string): boolean {
  try {
    const value = JSON.parse(readFileSync(marker(root), 'utf8')) as { expiresAt?: unknown };
    return typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt) && value.expiresAt > Date.now();
  } catch { return false; }
}

export function clearHubStop(root: string): void {
  rmSync(marker(root), { force: true });
}

export class AutostartDeferred extends Error {
  constructor() { super('hub autostart deferred during the deliberate-stop grace period'); }
}
