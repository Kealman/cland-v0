// Test-only subscription login. Explicit opt-in keeps legacy setup profiles intact.
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { hostname } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixtureEnvironment } from '../fixture-environment.ts';
import { holderRequest, holderSocket } from './login-holder-client.ts';
import { testWaitMs } from '../until.ts';
import { recordCall, type SetupHarness } from './setup-profile.ts';

export type LoginStamp = { at: string; host: string };
export type LoginFile = { name: string; token: string; generation: number; signIn: LoginStamp; lastRotation: LoginStamp | null;
  dead: boolean; turns: Array<{ host: string; session: string; generation: number }> };
export function loginEnabled(): boolean { return process.env.FAKE_LOGIN_ENABLED === '1' || !!process.env.FAKE_LOGIN_HOME; }
export function loginPath(harness: SetupHarness): string {
  const home = process.env.HOME ?? '';
  return join(process.env.FAKE_LOGIN_HOME || (harness === 'claude-code' ? process.env.CLAUDE_CONFIG_DIR || join(home, '.claude')
    : harness === 'codex' ? process.env.CODEX_HOME || join(home, '.codex')
    : dirname(process.env.OPENCODE_DB || join(process.env.XDG_DATA_HOME || join(home, '.local/share'), 'opencode/opencode.db'))), 'login.json');
}
export function readLogin(harness: SetupHarness): LoginFile | null {
  const path = loginPath(harness);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as LoginFile : null;
}
function save(harness: SetupHarness, value: LoginFile): void {
  const path = loginPath(harness);
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(value), { mode: 0o600 });
  renameSync(temporary, path);
}
const stamp = (): LoginStamp => ({ at: new Date().toISOString(), host: process.env.FAKE_LOGIN_HOST || hostname() });
export function loginTurn(harness: SetupHarness, text: string, session: string, rotate = true): boolean {
  if (!loginEnabled()) return true;
  if (text.trim() === '/logout') logout(harness, true);
  const value = readLogin(harness);
  if (!value) return false;
  if (text.includes('DEAD-LOGIN')) { value.dead = true; save(harness, value); }
  if (value.dead) return false;
  if (!rotate) return true;
  value.generation++;
  value.token = randomUUID();
  value.lastRotation = stamp();
  value.turns = [...value.turns, { host: value.lastRotation.host, session, generation: value.generation }].slice(-20);
  save(harness, value);
  return true;
}
export function logout(harness: SetupHarness, slash = false): void {
  if (slash) recordCall(harness, ['/logout']);
  const value = readLogin(harness);
  if (value) { value.dead = true; save(harness, value); }
}
export function deadLoginSignal(harness: SetupHarness): Record<string, unknown> {
  if (harness === 'claude-code') return { hook_event_name: 'StopFailure', error: 'authentication_failed', error_details: 'OAuth token revoked' };
  if (harness === 'codex') return { message: 'refresh_token_reused', codexErrorInfo: 'unauthorized' };
  return { type: 'provider.auth', message: 'Login expired' };
}
/** Headless CLI turns share exactly the same rotation boundary as native session turns. */
export function printTurn(harness: SetupHarness, text: string, session: string): number {
  const ok = loginTurn(harness, text, session);
  process.stdout.write(JSON.stringify(ok ? { text: `pong: ${text}` } : deadLoginSignal(harness)) + '\n');
  return ok ? 0 : 1;
}
export async function signIn(harness: SetupHarness): Promise<number> {
  if (harness === 'codex' && readLogin(harness)?.dead === false) {
    process.stderr.write('Already signed in; start with an empty home.\n');
    return 1;
  }
  if (harness === 'claude-code') {
    process.stdout.write('https://login.example.test/claude — paste code:\n');
    let pasted = false;
    for await (const chunk of process.stdin) { if (String(chunk).trim()) { pasted = true; break; } }
    if (!pasted) { process.stderr.write('No pasted code supplied.\n'); return 1; }
  }
  if (harness === 'codex') process.stdout.write('https://login.example.test/codex Device code: FAKE-1234\n');
  save(harness, { name: process.env.FAKE_LOGIN_NAME || 'fake-login', token: randomUUID(), generation: 0,
    signIn: stamp(), lastRotation: null, dead: false, turns: [] });
  if (process.env.FAKE_LOGIN_HOLDER === '1') {
    const home = dirname(loginPath(harness));
    if (!await holderRequest(home, 'status')) {
      try { unlinkSync(holderSocket(home)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      const child = spawn(process.execPath, [fileURLToPath(new URL('./fake-login-holder.ts', import.meta.url))], {
        cwd: home, env: fixtureEnvironment(home, process.env), detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('login holder readiness incomplete')), testWaitMs());
          child.once('error', error => { clearTimeout(timer); reject(error); });
          child.once('exit', (code, signal) => { clearTimeout(timer); reject(new Error(`login holder exited ${code}/${signal}`)); });
          child.on('message', message => {
            if (message === 'committed') { clearTimeout(timer); resolve(); }
            else if (process.env.FAKE_LOGIN_HOLDER_FAIL_AFTER_READY === '1') { clearTimeout(timer); reject(new Error('planted holder admission failure')); }
            else child.send('commit');
          });
        });
      } catch (error) {
        if (child.connected) child.disconnect();
        if (child.exitCode === null && child.signalCode === null) await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('uncommitted holder exit incomplete')), testWaitMs());
          child.once('exit', () => { clearTimeout(timer); resolve(); });
        });
        throw error;
      }
      child.unref();
    }
  }
  return 0;
}
