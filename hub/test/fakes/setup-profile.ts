// Setup's fake-binary account seam. Opt-in preserves existing adapter fixtures' signed-in defaults.
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type SetupHarness = 'claude-code' | 'codex' | 'opencode';
export type FakeIdentity = { email: string; orgName: string; connection: 'credential' | 'env' };
export const fakeIdentity: FakeIdentity = { email: 'fake@example.test', orgName: 'Fake Org', connection: 'credential' };

export function loginMarker(harness: SetupHarness, env: NodeJS.ProcessEnv = process.env): string {
  const home = env.HOME ?? '';
  if (harness === 'claude-code') return join(env.CLAUDE_CONFIG_DIR || join(home, '.claude'), 'fake-login.json');
  if (harness === 'codex') return join(env.CODEX_HOME || join(home, '.codex'), 'fake-login.json');
  const database = env.OPENCODE_DB || join(env.XDG_DATA_HOME || join(home, '.local/share'), 'opencode/opencode.db');
  return `${database}.fake-login.json`;
}

export function setFakeLogin(harness: SetupHarness, signedIn: boolean, env: NodeJS.ProcessEnv, identity: Partial<FakeIdentity> = {}): void {
  const marker = loginMarker(harness, env);
  if (!signedIn) { rmSync(marker, { force: true }); return; }
  mkdirSync(dirname(marker), { recursive: true });
  writeFileSync(marker, JSON.stringify({ ...fakeIdentity, ...identity }));
}

export function fakeLogin(harness: SetupHarness): FakeIdentity | null {
  const marker = loginMarker(harness);
  if (existsSync(marker)) return JSON.parse(readFileSync(marker, 'utf8')) as FakeIdentity;
  if (process.env.FAKE_HARNESS_PROFILES === '1') return null;
  return fakeIdentity;
}

export function login(harness: SetupHarness): void {
  if (!existsSync(`${loginMarker(harness)}.login-fails`)) setFakeLogin(harness, true, process.env);
}

export function recordCall(harness: SetupHarness | 'curl', args: string[], rpc?: { method: string; params: unknown }): void {
  if (!process.env.FAKE_HARNESS_CALL_LOG) return;
  appendFileSync(process.env.FAKE_HARNESS_CALL_LOG, JSON.stringify({ harness, args, pid: process.pid,
    ...(harness === 'curl' ? {} : { profile: loginMarker(harness) }), ...rpc }) + '\n');
}
