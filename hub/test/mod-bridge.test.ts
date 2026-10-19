// T2: the shipped mod recovers after bridge grace expiry, through its public engine
// boundary and a real hub socket. Only the harness process and CLI child are simulated.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createConnection } from 'node:net';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import { BRIDGE_GRACE_MS } from '../src/cli/hook-timing.ts';
import type { HarnessProcess, SpawnRequest } from '../src/adapters/contract.ts';
import type { Message } from '../src/protocol.ts';
import { FakeClock } from './fake-clock.ts';
import { fakeHarness } from './fakes/harness.ts';
import { connectUi, eventually, inProcessSpoke, projectHub, tempProject, type FrameClient } from './harness.ts';

type Engine = {
  env: { get(key: string): Promise<string | undefined> };
  settings: { read(): Promise<object> };
  clock: { sleep(ms: number): Promise<void> };
  process: { spawn(options: { argv: string[] }): AsyncIterable<{ stream: string; text: string }>; run(argv: string[], options: { stdin: string }): Promise<unknown> };
  prompt: { submit(input: { text: string }): Promise<object> };
};
type Hook = (engine: Engine, event: object, next: (event: object) => Promise<object>) => Promise<unknown>;
const { register } = await import(new URL('../mod/cland/hooks/register.ts', import.meta.url).href) as { register(on: (event: string, hook: Hook) => void): void };

test('the mod respawns an expired bridge and injects once the hub serves again', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const env: Record<string, string> = { CLAND_SESSION_NAME: 'impl', CLAND_HUB_FILE: `${root}/.cland/hub.json`, CLAND_NODE: 'node', CLAND_CLI: 'cland' };
  let start: Hook | undefined;
  register((event, hook) => { if (event === 'session.start') start = hook; });
  let discovery: { socket: string; secret: string } | undefined;
  let ui: FrameClient;
  let spawns = 0;
  let expiries = 0;
  let retryMs: number | undefined;
  const prompts: string[] = [];
  const sleep = (ms: number) => new Promise<void>(resolve => clock.setTimeout(resolve, ms));
  const engine: Engine = {
    env: { get: async key => env[key] }, settings: { read: async () => ({}) },
    clock: { sleep: ms => { retryMs = ms; return sleep(ms); } },
    process: {
      spawn: () => {
        spawns++;
        return (async function* () {
          if (!discovery) {
            // The CLI's bounded child exits with this frame after a hub outage.
            await sleep(BRIDGE_GRACE_MS);
            expiries++;
            yield { stream: 'stdout', text: '{"type":"bridge-expired"}\n' };
            return;
          }
          const socket = createConnection(discovery.socket);
          t.after(() => socket.destroy());
          socket.setEncoding('utf8');
          socket.on('connect', () => socket.write(`${JSON.stringify({ type: 'hello', protocol: 2, secret: discovery!.secret, client: 'mod-bridge' })}\n`));
          let buffer = '';
          for await (const chunk of socket) {
            buffer += String(chunk);
            let nl: number;
            while ((nl = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, nl);
              buffer = buffer.slice(nl + 1);
              if (JSON.parse(line).type === 'welcome') socket.write(`${JSON.stringify({ type: 'session.bridge', id: 'bridge', session: 'impl' })}\n`);
              yield { stream: 'stdout', text: `${line}\n` };
            }
          }
        })();
      },
      run: async (argv, options) => {
        assert.equal(argv[3], 'injected');
        return ui.request({ type: 'session.signal', session: 'impl', event: 'injected', payload: JSON.parse(options.stdin) });
      },
    },
    prompt: { submit: async ({ text }) => { prompts.push(text); return {}; } },
  };
  assert.ok(start);
  await start(engine, {}, async event => event);
  await eventually('first bridge spawned', () => spawns === 1 || undefined);
  await clock.advance(BRIDGE_GRACE_MS + 1);
  assert.equal(expiries, 1);
  assert.equal(retryMs, 1000, 'expiry must enter the bounded retry schedule');
  // The hub remains down for a second complete grace: recovery must survive repeated expiry.
  await clock.advance(1000 + BRIDGE_GRACE_MS);
  assert.equal(expiries, 2);
  assert.equal(spawns, 2);
  const hub = await projectHub(t, root, {}, { clock, adapters: [(host, hubClock) => {
    const harness = fakeHarness('claude-code', { host, clock: hubClock });
    // Production bridge/inject/confirm; the external harness spawn/watch boundary stays in-process.
    class ComponentClaude extends ClaudeCodeAdapter {
      override spawn(request: SpawnRequest): Promise<HarnessProcess> { return harness.spawn(request); }
      override watch(): void {}
    }
    return new ComponentClaude(host, { clock: hubClock });
  }] });
  discovery = hub.discovery;
  ui = await connectUi(t, hub.discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', harness: 'claude-code', name: 'impl', role: 'implementer' });
  assert.equal(launched.ok, true, launched.error);
  const process = (launched.value as { process: HarnessProcess }).process;
  const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl', sessionId: process.sessionId });
  await spoke.waitForPresence(['impl']);
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['impl'], text: 'delivery after the long outage' });
  assert.equal(sent.ok, true, sent.error);
  const id = (sent.value as { message: Message }).message.id;
  await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'delivered');
  await clock.advance(1000);
  await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected');
  assert.equal(spawns, 3, 'one session.start recovers after both expired children');
  assert.equal(prompts.filter(text => text.includes(id)).length, 1);
  assert.ok(prompts.some(text => text.includes('delivery after the long outage')));
});
