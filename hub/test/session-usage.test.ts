// T2: usage journal policy with fake adapters, fake publication time and real socket edges.
// Native token/price parsing is in the adapter contracts; restart recovery remains in session-native-lifecycle.
import { completeJournalLines } from './journal-lines.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, inProcessSpoke, tempProject, type FrameClient } from './harness.ts';
import { ruleHub } from './rule-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import { FAKE_FLAVOURS } from './fakes/harness.ts';
import type { HarnessProcessView, SessionUsage } from '../src/protocol.ts';

async function records(root: string, ui: FrameClient): Promise<Array<Record<string, unknown>>> {
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  return completeJournalLines(await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).filter(Boolean).map(line => JSON.parse(line)).filter(r => r.event === 'session-usage');
}
const total = (n: number) => ({ totalTokens: n * 12, inputTokens: n * 4, outputTokens: n * 2, reasoningTokens: n, cacheReadTokens: n * 6, cacheWriteTokens: 0 });
const limits = (usedPercent: number) => ({ primary: { usedPercent, windowDurationMins: 10080, resetsAt: 1791955620 }, secondary: null });
const report = (n: number, percent = 6): SessionUsage => ({ total: total(n), rateLimits: limits(percent), tokens: { fixture: n } });

// Freeze the documented program while evaluating its aggregation contract without a jq child.
const usageAggregationProgram = `
  map(select(.final)) | group_by(.sessionId) | map(last)
  | group_by([.role, .item])
  | map({role: .[0].role, item: .[0].item,
      totalTokens: ([.[].total.totalTokens] | if any(. == null) then null else add end),
      cost: ([.[].total.cost] | if any(. == null) then null else add end)})`;

function aggregateFinalUsage(records: Array<Record<string, unknown>>) {
  const latest = new Map<unknown, Record<string, unknown>>();
  for (const row of records) if (row.final) latest.set(row.sessionId, row);
  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const row of latest.values()) {
    const key = JSON.stringify([row.role, row.item]);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  // jq orders null before strings and compares strings by code point.
  const compare = (a: unknown, b: unknown) => a === b ? 0 : a == null ? -1 : b == null ? 1 : String(a) < String(b) ? -1 : 1;
  return [...groups.values()].sort((a, b) => compare(a[0]!.role, b[0]!.role) || compare(a[0]!.item, b[0]!.item)).map(rows => {
    const sum = (field: 'totalTokens' | 'cost') => {
      const values = rows.map(row => (row.total as Record<string, number> | undefined)?.[field]);
      return values.some(value => value == null) ? null : values.reduce<number>((total, value) => total + value!, 0);
    };
    return { role: rows[0]!.role, item: rows[0]!.item, totalTokens: sum('totalTokens'), cost: sum('cost') };
  });
}

// Drive the actual coalescer, then observe its publication receipt rather than wait real time.
async function publish(clock: FakeClock, ui: FrameClient, sessionId: string, mark: number) {
  for (let i = 0; i < 20; i++) {
    await clock.advance(100);
    if (ui.frames.slice(mark).some(f => f.type === 'session.usage' && f.sessionId === sessionId)) return;
  }
  assert.fail('usage publication missing after driving 2000ms of fake time');
}

test('changed totals journal once while equal raw publications remain silent across flavours', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await ruleHub(t, root, clock, { CLAND_TEST_USAGE_EVENT_MS: '100' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  for (const harness of FAKE_FLAVOURS) {
    const launched = await ui.request({ type: 'session.launch', name: harness, role: 'implementer', harness, model: 'selected' });
    assert.equal(launched.ok, true, launched.error);
    const p = (launched.value as { process: HarnessProcessView }).process;
    for (const reading of [report(1), report(2), { ...report(2), tokens: { modelContextWindow: 100000 } }]) {
      const mark = ui.frames.length;
      fakes[harness]!.feedUsage(p.name, reading);
      await publish(clock, ui, p.sessionId, mark);
      const latest = ui.frames.slice(mark).find(f => f.type === 'session.usage' && f.sessionId === p.sessionId)!.usage as SessionUsage;
      assert.deepEqual(latest.total, reading.total);
      assert.deepEqual(latest.rateLimits, reading.rateLimits);
      assert.deepEqual(latest.tokens, reading.tokens);
    }
    let journal = (await records(root, ui)).filter(r => r.sessionId === p.sessionId);
    assert.deepEqual(journal.map(r => [r.total, r.final]), [[total(1), false], [total(2), false]]);
    assert.equal((await ui.request({ type: 'session.stop', session: p.name })).ok, true);
    journal = (await records(root, ui)).filter(r => r.sessionId === p.sessionId);
    assert.equal(journal.length, 3);
    const final = journal[2]!;
    assert.deepEqual([final.session, final.sessionId, final.role, final.item, final.harness, final.model, final.final],
      [harness, p.sessionId, 'implementer', null, harness, 'selected', true]);
    assert.deepEqual(final.total, total(2));
    assert.deepEqual(final.rateLimits, limits(6));
    assert.equal((await ui.request({ type: 'session.stop', session: p.name })).ok, true);
    assert.equal((await records(root, ui)).filter(r => r.sessionId === p.sessionId).length, 3);
  }
});

test('usage bursts coalesce while a changed limit journals independently across flavours', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await ruleHub(t, root, clock, { CLAND_TEST_USAGE_EVENT_MS: '100' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  for (const harness of FAKE_FLAVOURS) {
    const launched = await ui.request({ type: 'session.launch', name: harness, harness });
    assert.equal(launched.ok, true, launched.error);
    const p = (launched.value as { process: HarnessProcessView }).process;
    const feed = async (readings: SessionUsage[]) => {
      const mark = ui.frames.length;
      for (const usage of readings) fakes[harness]!.feedUsage(p.name, usage);
      await publish(clock, ui, p.sessionId, mark);
      return ui.frames.slice(mark).find(f => f.type === 'session.usage' && f.sessionId === p.sessionId)!.usage as SessionUsage;
    };
    await feed([report(1)]);
    await feed([report(1.5), report(2)]);
    const byId = { codex: limits(9) };
    const changed = { ...report(2, 9), rateLimitsByLimitId: byId, rateLimitsAt: clock.now().toISOString() };
    const pushed = await feed([changed]);
    const read = await feed([{ ...changed, rateLimitsAt: '2026-10-17T00:00:00Z' }]);
    assert.deepEqual(pushed.rateLimitsByLimitId, byId);
    assert.deepEqual(read.rateLimitsByLimitId, pushed.rateLimitsByLimitId);
    assert.notEqual(read.rateLimitsAt, pushed.rateLimitsAt);
    const journal = (await records(root, ui)).filter(r => r.sessionId === p.sessionId);
    assert.deepEqual(journal.map(r => [(r.total as { totalTokens: number }).totalTokens, (r.rateLimits as { primary: { usedPercent: number } }).primary.usedPercent]), [[12, 6], [24, 6], [24, 9]]);
    assert.deepEqual(journal.at(-1)!.rateLimitsByLimitId, byId);
    assert.equal((await ui.request({ type: 'session.stop', session: p.name })).ok, true);
    const final = (await records(root, ui)).filter(r => r.sessionId === p.sessionId).at(-1)!;
    assert.equal(final.final, true);
    assert.deepEqual(final.rateLimits, limits(9));
  }
});

test('stop captures pending usage before publication and leaves quiet sessions silent across flavours', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await ruleHub(t, root, clock, { CLAND_TEST_USAGE_EVENT_MS: '1000' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  for (const harness of FAKE_FLAVOURS) {
    const launched = await ui.request({ type: 'session.launch', name: harness, harness });
    const p = (launched.value as { process: HarnessProcessView }).process;
    assert.equal((await ui.request({ type: 'session.stop', session: p.name })).ok, true);
    assert.deepEqual((await records(root, ui)).filter(r => r.sessionId === p.sessionId), []);
    const next = await ui.request({ type: 'session.launch', name: `${harness}-pending`, harness });
    assert.equal(next.ok, true, next.error);
    const pending = (next.value as { process: HarnessProcessView }).process;
    const usage = { total: { totalTokens: 12, inputTokens: 7, outputTokens: 5, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0.1 } };
    fakes[harness]!.feedUsage(pending.name, usage);
    assert.deepEqual((await records(root, ui)).filter(r => r.sessionId === pending.sessionId), []);
    // CLI argument/exit proof is retained with the native restart case.
    assert.equal((await ui.request({ type: 'session.stop', session: pending.name })).ok, true);
    const journal = (await records(root, ui)).filter(r => r.sessionId === pending.sessionId);
    assert.equal(journal.length, 1);
    assert.equal(journal[0]!.final, true);
    assert.deepEqual(journal[0]!.total, usage.total);
    const later = await ui.request({ type: 'session.launch', name: `${harness}-updated`, harness });
    assert.equal(later.ok, true, later.error);
    const updated = (later.value as { process: HarnessProcessView }).process;
    const mark = ui.frames.length;
    fakes[harness]!.feedUsage(updated.name, report(1));
    await publish(clock, ui, updated.sessionId, mark);
    fakes[harness]!.feedUsage(updated.name, report(2));
    assert.equal((await ui.request({ type: 'session.stop', session: updated.name })).ok, true);
    assert.deepEqual((await records(root, ui)).filter(r => r.sessionId === updated.sessionId).map(r => [r.total, r.final]), [[total(1), false], [total(2), true]], 'pending report replaces the last published total at stop');
  }
});

test('relaunch and harness exit each retain exactly one final snapshot across flavours', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await ruleHub(t, root, clock);
  const ui = await connectUi(t, discovery);
  for (const harness of FAKE_FLAVOURS) {
    const launch = await ui.request({ type: 'session.launch', name: harness, role: 'implementer', harness });
    const p = (launch.value as { process: HarnessProcessView }).process;
    fakes[harness]!.feedUsage(p.name, report(1));
    const resumed = await ui.request({ type: 'session.resume', session: p.name, relaunch: true });
    assert.equal(resumed.ok, true, resumed.error);
    assert.equal(fakes[harness]!.stops.length, 1);
    let journal = (await records(root, ui)).filter(r => r.sessionId === p.sessionId);
    assert.deepEqual(journal.filter(r => r.final).map(r => [r.total, r.role]), [[total(1), 'implementer']]);
    fakes[harness]!.feedUsage(p.name, report(3));
    fakes[harness]!.exit(p.name);
    journal = (await records(root, ui)).filter(r => r.sessionId === p.sessionId);
    assert.equal(journal.filter(r => r.final).length, 2);
    assert.deepEqual(journal.at(-1)!.total, total(3));
    assert.equal(journal.at(-1)!.final, true);
    assert.equal((await ui.request({ type: 'session.stop', session: p.name })).ok, true);
    assert.equal((await records(root, ui)).filter(r => r.sessionId === p.sessionId && r.final).length, 2);
  }
});

test('final totals and cost aggregate by launch item despite a changed verifier hold across flavours', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await ruleHub(t, root, clock, { CLAND_TEST_USAGE_EVENT_MS: '100' });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const documented = /jq -s '([^']+)'/.exec(readme)?.[1];
  const compact = (program: string) => program.trim().replace(/\s+/g, ' ');
  assert.equal(documented && compact(documented), compact(usageAggregationProgram), 'README keeps the checked final-usage aggregation program');
  assert.deepEqual(aggregateFinalUsage([
    { sessionId: 'older', role: 'implementer', item: 'T-1', final: true, total: { totalTokens: 10, cost: 0.1 } },
    { sessionId: 'older', role: 'implementer', item: 'T-1', final: true, total: { totalTokens: 30, cost: 0.3 } },
    { sessionId: 'running', role: 'implementer', item: 'T-1', final: false, total: { totalTokens: 1000, cost: 99 } },
    { sessionId: 'other', role: 'implementer', item: 'T-1', final: true, total: { totalTokens: 8 } },
    { sessionId: 'unknown-tokens', role: 'reviewer', item: 'T-2', final: true, total: { cost: 0.5 } },
  ]), [
    { role: 'implementer', item: 'T-1', totalTokens: 38, cost: null },
    { role: 'reviewer', item: 'T-2', totalTokens: null, cost: 0.5 },
  ], 'latest finals group by role/item, omit running sessions and preserve unknown totals');
  for (const harness of FAKE_FLAVOURS) {
    const items: string[] = [];
    for (const title of ['Implementation usage', 'Review usage']) {
      const made = await ui.request({ size: 'M', type: 'task.create', title });
      assert.equal(made.ok, true, made.error);
      items.push((made.value as { item: { id: string } }).item.id);
    }
    for (const [index, role] of ['implementer', 'reviewer'].entries()) {
      const launch = await ui.request({ type: 'session.launch', name: `${harness}-${index}`, role, harness, item: items[index] });
      assert.equal(launch.ok, true, launch.error);
      const p = (launch.value as { process: HarnessProcessView }).process;
      const totals = { totalTokens: 38, inputTokens: 20, outputTokens: 4, reasoningTokens: 2, cacheReadTokens: 8, cacheWriteTokens: 6, ...(harness === 'opencode' ? { cost: 0.5 } : {}) };
      for (const total of [{ ...totals, totalTokens: 19 }, totals]) {
        const mark = ui.frames.length;
        fakes[harness]!.feedUsage(p.name, { model: 'reported', total });
        await publish(clock, ui, p.sessionId, mark);
      }
      if (role === 'reviewer') {
        const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name: p.name, role, sessionId: p.sessionId, assignRole: false });
        const held = await spoke.call<{ ok: boolean; error?: string }>('task.hold', { id: items[0] });
        assert.equal(held.ok, true, held.error);
        await spoke.close();
      }
      assert.equal((await ui.request({ type: 'session.stop', session: p.name })).ok, true);
      const journal = (await records(root, ui)).filter(r => r.sessionId === p.sessionId);
      assert.deepEqual(journal.map(r => [r.session, r.sessionId, r.role, r.item, r.harness, r.model, r.final]), [false, false, true].map(final => [p.name, p.sessionId, role, items[index], harness, 'reported', final]));
      assert.deepEqual(journal[2]!.total, totals);
      assert.equal(journal[2]!.rateLimits, undefined);
    }
    const journal = (await records(root, ui)).filter(r => r.harness === harness);
    const sums = aggregateFinalUsage(journal);
    assert.deepEqual(sums, [
      { role: 'implementer', item: items[0], totalTokens: 38, cost: harness === 'opencode' ? 0.5 : null },
      { role: 'reviewer', item: items[1], totalTokens: 38, cost: harness === 'opencode' ? 0.5 : null },
    ]);
  }
});
