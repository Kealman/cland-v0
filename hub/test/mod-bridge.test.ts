// T1: the mod consumes bridge expiry without entering its retry schedule.
// Manifest T2: the legacy T1 regex matches harness/Neovim text (T-682).
import assert from 'node:assert/strict';
import test from 'node:test';
// The mod is compiled against the harness SDK in its own package. Load its runtime
// entry as the harness does, with this narrow fake of the public engine boundary.
type Engine = { env: { get(key: string): Promise<string | undefined> }; clock: { sleep(ms: number): Promise<void> }; process: { spawn(): AsyncIterable<{ stream: string; text: string }> } };
type Hook = (engine: Engine, event: object, next: (event: object) => Promise<object>) => Promise<unknown>;
const { register } = await import(new URL('../mod/cland/hooks/register.ts', import.meta.url).href) as { register(on: (event: string, hook: Hook) => void): void };

test('an expired bridge ends the mod restart loop', async () => {
  let start: Hook | undefined;
  register((event, hook) => { if (event === 'session.start') start = hook; });
  const env: Record<string, string> = { CLAND_SESSION_NAME: 'impl', CLAND_HUB_FILE: '/fixture/hub.json', CLAND_NODE: 'node', CLAND_CLI: 'cland', CLAND_SESSION_ID: 'launch' };
  let spawns = 0;
  let retries = 0;
  let consumed = false;
  const engine = {
    env: { get: async (key: string) => env[key] },
    clock: { sleep: async () => { retries++; await new Promise<void>(() => {}); } },
    process: { spawn: () => {
      spawns++;
      return (async function* () {
        try { yield { stream: 'stdout', text: '{"type":"bridge-expired"}\n' }; }
        finally { consumed = true; }
      })();
    } },
  } satisfies Engine;
  assert.ok(start);
  await start(engine, {}, async event => event);
  // Drain the async iterator's completed return, without advancing real time.
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(consumed, true);
  assert.equal(spawns, 1);
  assert.equal(retries, 0);
});
