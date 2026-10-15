// Usage journal contracts through a daemon, real spoke, fake harnesses and CLI.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withDiscoveredPid, cland, connectUi, eventually, fakeClaude, fakeCodex, spawnSpoke, startDaemon, tempProject, type FrameClient } from './harness.ts';
import { copyPreparedProject } from './prepared-project.ts';
import type { HarnessProcessView, SessionUsage } from '../src/protocol.ts';

// Match the app-server startup deadline (CodexAdapter constructor in src/adapters/codex.ts).
const CODEX_LAUNCH_MS = 30_000;

// Shorten the existing publication window without changing usage/journal behavior.
function startUsageDaemon(t: TestContext, root: string, env: Record<string, string>, usageEventMs = 100) {
  return startDaemon(t, root, { ...env, CLAND_TEST_USAGE_EVENT_MS: String(usageEventMs) });
}

async function records(root: string, ui: FrameClient): Promise<Array<Record<string, unknown>>> {
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const read = await cland(root, 'hub', 'journal', '--kind', 'session-usage', '--json');
  assert.equal(read.code, 0, read.stderr);
  return read.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

// Initial account limits can publish independently, before the first token report.
async function recordsWithTotals(root: string, ui: FrameClient): Promise<Array<Record<string, unknown>>> {
  return (await records(root, ui)).filter(r => r.total !== undefined);
}

// A frame arriving after send can still describe the previous turn. Match the fixture response too.
async function turn(ui: FrameClient, p: HarnessProcessView, text: string, matches: (usage: SessionUsage) => boolean): Promise<SessionUsage> {
  const after = ui.frames.length;
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: [p.name], text: `@${p.name} ${text}` });
  assert.equal(sent.ok, true, sent.error);
  const frame = await ui.waitFor(f => ui.frames.indexOf(f) >= after && f.type === 'session.usage' && f.sessionId === p.sessionId && matches(f.usage as SessionUsage));
  return frame.usage as SessionUsage;
}

test('Codex journals changed totals once, skips equal publications, and stops with final usage', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startUsageDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'codex' }, CODEX_LAUNCH_MS);
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: HarnessProcessView }).process;
  await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === p.sessionId && (f.usage as SessionUsage).total?.totalTokens === 12);
  const latest = await turn(ui, p, 'Another turn', usage => usage.total?.totalTokens === 24);
  assert.equal(latest.total?.totalTokens, 24);
  const equal = await turn(ui, p, 'repeat usage', usage => usage.tokens?.modelContextWindow === 100000);
  assert.deepEqual(equal.total, latest.total);
  assert.deepEqual(equal.rateLimits, latest.rateLimits);
  assert.notDeepEqual(equal.tokens, latest.tokens, 'raw report changes do not create journal rows');
  let journal = await recordsWithTotals(root, ui);
  assert.deepEqual(journal.map(r => [r.total, r.final]), [
    [{ totalTokens: 12, inputTokens: 4, outputTokens: 2, reasoningTokens: 1, cacheReadTokens: 6, cacheWriteTokens: 0 }, false],
    [{ totalTokens: 24, inputTokens: 8, outputTokens: 4, reasoningTokens: 2, cacheReadTokens: 12, cacheWriteTokens: 0 }, false],
  ]);
  const stopped = await ui.request({ type: 'session.stop', session: p.name }, 30_000);
  assert.equal(stopped.ok, true, stopped.error);
  journal = await recordsWithTotals(root, ui);
  assert.equal(journal.length, 3);
  const final = journal[2]!;
  assert.deepEqual([final.session, final.sessionId, final.role, final.item, final.harness, final.model, final.final],
    ['impl', p.sessionId, 'implementer', null, 'codex', p.model, true]);
  assert.deepEqual(final.total, latest.total);
  assert.deepEqual(final.rateLimits, latest.rateLimits);
  assert.equal((await ui.request({ type: 'session.stop', session: p.name }, 30_000)).ok, true);
  assert.equal((await recordsWithTotals(root, ui)).length, 3, 'an already stopped session has no second final');
});

test('Codex coalesces a usage burst and journals a rate-limit-only change', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startUsageDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', name: 'burst', role: 'implementer', harness: 'codex' }, CODEX_LAUNCH_MS);
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: HarnessProcessView }).process;
  await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === p.sessionId && (f.usage as SessionUsage).total?.totalTokens === 12);
  assert.equal((await turn(ui, p, 'usage burst', usage => usage.total?.totalTokens === 24)).total?.totalTokens, 24);
  const limits = await turn(ui, p, 'rate limits only', usage => (usage.rateLimits?.primary as { usedPercent?: number } | undefined)?.usedPercent === 9);
  const journal = await recordsWithTotals(root, ui);
  assert.deepEqual(journal.map(r => [(r.total as { totalTokens: number }).totalTokens, (r.rateLimits as { primary: { usedPercent: number } }).primary.usedPercent]),
    [[12, 6], [24, 6], [24, 9]]);
  assert.equal((await ui.request({ type: 'session.stop', session: p.name }, 30_000)).ok, true);
  const final = (await records(root, ui)).at(-1)!;
  assert.equal(final.final, true);
  assert.deepEqual(final.rateLimits, limits.rateLimits);
});

test('no-usage stop stays silent and CLI stop captures usage before the publication timer', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  // The CLI stop must capture pending usage before the publication window closes.
  const { discovery } = await startUsageDaemon(t, root, fake.env, 1000);
  const ui = await connectUi(t, discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'quiet', harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: HarnessProcessView }).process;
  await eventually('initial hook settled', async () => (await fake.log(p.harnessId!)).includes('hooks SessionStart done') || undefined);
  assert.equal((await ui.request({ type: 'session.stop', session: p.name }, 30_000)).ok, true);
  assert.deepEqual(await records(root, ui), []);
  const second = await ui.request({ type: 'session.launch', name: 'pending', harness: 'claude-code' });
  assert.equal(second.ok, true, second.error);
  const pending = (second.value as { process: HarnessProcessView }).process;
  await eventually('pending session hook settled', async () => (await fake.log(pending.harnessId!)).includes('hooks SessionStart done') || undefined);
  const signal = await ui.request({ type: 'session.signal', session: pending.name, launch: pending.sessionId, event: 'mod-turn-complete',
    payload: { usage: { input_tokens: 7, output_tokens: 5, total_cost_usd: 0.1 } } });
  assert.equal(signal.ok, true, signal.error);
  const stopped = await cland(root, 'session', 'stop', pending.name);
  assert.equal(stopped.code, 0, stopped.stderr);
  const journal = await records(root, ui);
  assert.equal(journal.filter(r => r.final).length, 1);
  assert.deepEqual(journal.at(-1)!.total, { totalTokens: 12, inputTokens: 7, outputTokens: 5, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0.1 });
  assert.equal(journal.at(-1)!.final, true);
  assert.equal(journal.at(-1)!.sessionId, pending.sessionId);
});

test('Codex stop captures a token report that has not yet been published', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  // Keep the token report pending across adapter observation and the stop request.
  const { discovery } = await startUsageDaemon(t, root, fake.env, 1000);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', name: 'pending', role: 'implementer', harness: 'codex' }, CODEX_LAUNCH_MS);
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: HarnessProcessView }).process;
  await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === p.sessionId && (f.usage as SessionUsage).total?.totalTokens === 12);
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', to: [p.name], text: '@pending Another turn' })).ok, true);
  await eventually('token update received by the adapter', async () => {
    const result = await ui.request({ type: 'session.list' });
    return (result.value as { processes: HarnessProcessView[] }).processes.find(p => p.usage?.total?.totalTokens === 24);
  });
  assert.equal((await ui.request({ type: 'session.stop', session: p.name }, 30_000)).ok, true);
  const final = (await records(root, ui)).at(-1)!;
  assert.equal(final.final, true);
  assert.equal((final.total as { totalTokens: number }).totalTokens, 24);
});

test('a harness exit and a relaunch stop each leave exactly one final record', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startUsageDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', name: 'lifecycle', role: 'implementer', harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const p = await withDiscoveredPid(ui, (launched.value as { process: HarnessProcessView }).process);
  await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === p.sessionId && (f.usage as SessionUsage).total?.totalTokens === 19);
  const resumed = await ui.request({ type: 'session.resume', session: p.name, relaunch: true }, 30_000);
  assert.equal(resumed.ok, true, resumed.error);
  const replacement = await withDiscoveredPid(ui, (resumed.value as { process: HarnessProcessView }).process);
  assert.notEqual(replacement.pid, p.pid);
  let journal = await records(root, ui);
  assert.deepEqual(journal.filter(r => r.final).map(r => [(r.total as { totalTokens: number }).totalTokens, r.role]), [[19, 'implementer']]);
  // The resumed role-clause turn must publish before turn() waits for the requested turn (T-389 usage staging race).
  await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === p.sessionId && (f.usage as SessionUsage).total?.totalTokens === 38);
  const latest = await turn(ui, replacement, 'Another turn after relaunch', usage => usage.total?.totalTokens === 57);
  process.kill(replacement.pid!, 'SIGTERM');
  await ui.waitFor(f => f.type === 'session.process' && (f.process as HarnessProcessView).sessionId === p.sessionId && (f.process as HarnessProcessView).status === 'exited', 15_000);
  journal = await records(root, ui);
  assert.equal(journal.filter(r => r.final).length, 2);
  assert.deepEqual(journal.at(-1)!.total, latest.total);
  assert.equal(journal.at(-1)!.final, true);
  assert.equal((await ui.request({ type: 'session.stop', session: p.name }, 30_000)).ok, true);
  assert.equal((await records(root, ui)).filter(r => r.final).length, 2);
});

test('the first publication after hub restart is recorded again without replaying history', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  // Publish tokens first, then release limits across an observed coalescing boundary.
  await writeFile(join(fake.home, 'hold-rate-limits-read'), '');
  const { discovery } = await startUsageDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', name: 'restart', harness: 'codex' }, CODEX_LAUNCH_MS);
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: HarnessProcessView }).process;
  const initial = await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === p.sessionId && (f.usage as SessionUsage).total?.totalTokens === 12);
  const initialUsage = initial.usage as SessionUsage;
  assert.equal(initialUsage.rateLimits, undefined);
  const first = await records(root, ui);
  assert.equal(first.length, 1);
  assert.deepEqual(first[0]!.total, initialUsage.total);
  await writeFile(join(fake.home, 'release-rate-limits-read'), '');
  const published = await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === p.sessionId && !!(f.usage as SessionUsage).rateLimits);
  const publishedUsage = published.usage as SessionUsage;
  assert.deepEqual(publishedUsage.total, initialUsage.total);
  const before = await records(root, ui);
  assert.deepEqual(before.map(r => [r.total, r.rateLimits, r.final]), [
    [initialUsage.total, undefined, false], [initialUsage.total, publishedUsage.rateLimits, false],
  ]);
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  const next = await startUsageDaemon(t, root, fake.env);
  const nextUi = await connectUi(t, next.discovery);
  await nextUi.request({ type: 'subscribe' });
  await eventually('first restarted publication journalled', async () => (await records(root, nextUi)).length > before.length || undefined);
  const after = await records(root, nextUi);
  assert.equal(after.length, before.length + 1);
  assert.deepEqual(after.slice(0, before.length), before, 'restart preserves the previous journal without replay');
  assert.deepEqual(after.slice(before.length).map(r => [r.sessionId, r.total, r.rateLimits, r.final]), [
    [p.sessionId, undefined, publishedUsage.rateLimits, false],
  ]);
  assert.equal((await nextUi.request({ type: 'session.stop', session: p.name }, 30_000)).ok, true);
  assert.equal((await records(root, nextUi)).filter(r => r.final).length, 1);
});

for (const harness of ['claude-code', 'opencode']) test(`${harness} journals totals and cost, and final records sum per launch item and current role`, async t => {
  const root = await tempProject(t);
  await copyPreparedProject(root);
  const env = harness === 'claude-code' ? (await fakeClaude(t)).env : {
    CLAND_OPENCODE_BIN: fileURLToPath(new URL('./fakes/opencode/opencode', import.meta.url)),
    FAKE_OPENCODE_HOME: await tempProject(t, 'fake-usage-opencode-'),
    CLAND_ADAPTER_POLL_MS: '50',
    FAKE_OPENCODE_TURN_MS: '30',
  };
  const { discovery } = await startUsageDaemon(t, root, env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const items: string[] = [];
  for (const title of ['Implementation usage', 'Review usage']) {
    const created = await ui.request({ size: 'M', type: 'task.create', title });
    assert.equal(created.ok, true, created.error);
    items.push((created.value as { item: { id: string } }).item.id);
  }
  for (const [index, role] of ['implementer', 'reviewer'].entries()) {
    const launched = await ui.request({ type: 'session.launch', name: `worker-${index}`, role, harness, item: items[index] }, 30_000);
    assert.equal(launched.ok, true, launched.error);
    const p = (launched.value as { process: HarnessProcessView }).process;
    await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === p.sessionId && (f.usage as SessionUsage).total?.totalTokens === 19);
    const latest = await turn(ui, p, 'Another turn', usage => usage.total?.totalTokens === 38);
    assert.deepEqual(latest.total, { totalTokens: 38, inputTokens: 20, outputTokens: 4, reasoningTokens: harness === 'opencode' ? 2 : 0,
      cacheReadTokens: 8, cacheWriteTokens: 6, ...(harness === 'opencode' ? { cost: 0.5 } : {}) });
    // Changing a verifier's hold does not transfer usage from its launch item.
    if (role === 'reviewer') {
      const spoke = await spawnSpoke({ discover: true, cwd: root, name: p.name, role, sessionId: p.sessionId, assignRole: false });
      t.after(() => spoke.close());
      const held = await spoke.call<{ ok: boolean; error?: string }>('task.hold', { id: items[0] });
      assert.equal(held.ok, true, held.error);
    }
    const stopped = await ui.request({ type: 'session.stop', session: p.name }, 30_000);
    assert.equal(stopped.ok, true, stopped.error);
    const journal = (await records(root, ui)).filter(r => r.sessionId === p.sessionId);
    assert.deepEqual(journal.map(r => [r.session, r.sessionId, r.role, r.item, r.harness, r.model, r.final]), [
      [p.name, p.sessionId, role, items[index], harness, latest.model, false],
      [p.name, p.sessionId, role, items[index], harness, latest.model, false],
      [p.name, p.sessionId, role, items[index], harness, latest.model, true],
    ]);
    assert.deepEqual(journal[2]!.total, latest.total);
    assert.equal(journal[2]!.rateLimits, undefined);
  }
  // Execute the exact jq program documented for the CLI's JSON-lines output.
  const readme = await readFile(fileURLToPath(new URL('../README.md', import.meta.url)), 'utf8');
  const jq = /jq -s '([^']+)'/.exec(readme)?.[1];
  assert.ok(jq, 'README includes the usage aggregation jq program');
  await ui.request({ type: 'hub.status', flushLogs: true });
  const read = await cland(root, 'hub', 'journal', '--kind', 'session-usage', '--json');
  assert.equal(read.code, 0, read.stderr);
  const sums = JSON.parse(execFileSync('jq', ['-s', jq], { input: read.stdout, encoding: 'utf8' }));
  const expected = [
    { role: 'implementer', item: items[0], totalTokens: 38, cost: harness === 'opencode' ? 0.5 : null },
    { role: 'reviewer', item: items[1], totalTokens: 38, cost: harness === 'opencode' ? 0.5 : null },
  ];
  assert.deepEqual(sums, expected);
});
