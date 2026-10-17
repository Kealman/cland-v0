// T1 semantics: real Sessions publication through an in-memory dispatcher and FakeClock, with no sockets or children.
// Tagged T2 because the current tier lint classifies the frameClient harness import (T-682).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FakeClock } from './fake-clock.ts';
import { frameClient, type FrameClient } from './harness.ts';
import { tmpdir } from 'node:os';
import { createHubBase } from '../src/hub/server.ts';
import { projectSessions } from '../src/adapters/index.ts';
import { fakeHarness, FAKE_FLAVOURS } from './fakes/harness.ts';
import type { HarnessProcessView } from '../src/protocol.ts';
import { readAccounts } from '../src/accounts/registry.ts';
import type { AccountReading } from '../src/accounts/limits.ts';

test('account publication coalesces across sessions and ignores later-arriving older readings', async t => {
  const root = await mkdtemp(join(tmpdir(), 'account-coalescing-'));
  let ownedHub: ReturnType<typeof createHubBase> | undefined;
  let ownedAdapters: ReturnType<typeof projectSessions> | undefined;
  let ownedUi: FrameClient | undefined;
  t.after(async () => {
    const errors: unknown[] = [];
    const attempt = async (work: () => unknown) => { try { await work(); } catch (error) { errors.push(error); } };
    await attempt(() => ownedUi?.close());
    await attempt(() => ownedAdapters?.close());
    await attempt(() => ownedHub?.close());
    await attempt(() => rm(root, { recursive: true, force: true }));
    if (errors.length) throw new AggregateError(errors, 'account coalescing cleanup failed');
  });
  const config = join(root, 'config');
  await mkdir(join(config, 'cland'), { recursive: true });
  await writeFile(join(config, 'cland/accounts.toml'), '[accounts.oc]\nharness = "opencode"\n');
  const clock = new FakeClock();
  const logs: Array<Record<string, unknown>> = [];
  const log = (row: Record<string, unknown>) => { logs.push(row); };
  const hub = ownedHub = createHubBase({ secret: 'test', clock, env: { XDG_CONFIG_HOME: config }, log });
  const adapters = ownedAdapters = projectSessions({ core: hub.core, root, discoveryFile: join(root, 'hub.json'), env: { XDG_CONFIG_HOME: config }, log, adapters: FAKE_FLAVOURS.map(flavour => (host, clock) => fakeHarness(flavour, { host, clock })) });
  hub.dispatcher.useSessions(adapters.sessions);
  let receive = (_line: string) => {};
  let open = true;
  const conversation = hub.dispatcher.open({ send: frame => receive(`${JSON.stringify(frame)}\n`), close: () => { open = false; }, isOpen: () => open }, { authenticated: true, edge: 'socket' });
  const ui = ownedUi = frameClient(line => conversation.receive(line.trimEnd()), fn => { receive = fn; }, () => { if (open) { open = false; conversation.closed(); } }, root);
  ui.send({ type: 'hello', protocol: 2, client: 'ui' });
  assert.equal((await ui.waitFor(frame => frame.type === 'welcome' || frame.type === 'error')).type, 'welcome');
  await ui.request({ type: 'subscribe' });
  const launch = async (name: string) => {
    const r = await ui.request({ type: 'session.launch', name, harness: 'claude-code' });
    assert.equal(r.ok, true, r.error);
    return (r.value as { process: HarnessProcessView }).process;
  };
  const one = await launch('first'), two = await launch('second');
  const at = clock.now().getTime();
  const signal = async (p: HarnessProcessView, offset: number, percent: number) => {
    assert.equal((await ui.request({ type: 'session.signal', session: p.name, launch: p.sessionId, event: 'mod-measure', at: at + offset, payload: { rateLimits: [{ kind: 'five_hour', percentUsed: percent, resetsAt: '2099-10-15T04:03:00Z' }] } })).ok, true);
  };
  const events = () => ui.frames.filter(f => f.type === 'account');
  await signal(one, 0, 7);
  await clock.advance(1000);
  await ui.waitFor(f => f.type === 'account');
  await signal(two, 2000, 21);
  await signal(one, 1000, 8);
  await clock.advance(999);
  await ui.request({ type: 'session.list' });
  assert.equal(events().length, 1, 'nothing publishes before the next tick');
  await clock.advance(1);
  await ui.waitFor(f => f.type === 'account' && (f.account as { at: string }).at === new Date(at + 2000).toISOString());
  assert.equal(events().length, 2);
  await signal(two, 3000, 21);
  await clock.advance(1000);
  const listed = hub.core.accountLimits.list(await readAccounts({ XDG_CONFIG_HOME: config }));
  assert.equal(listed.accounts.find(a => a.name === 'default:claude-code')?.at, new Date(at + 3000).toISOString());
  assert.equal(events().length, 2);
  assert.deepEqual(logs.filter(r => r.event === 'account-limits').map(r => { const reading = r as AccountReading; return [reading.windows[0]!.usedPercent, reading.source.kind === 'session' ? reading.source.session : null]; }), [[7, 'first'], [21, 'second']]);
});
