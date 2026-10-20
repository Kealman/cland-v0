// T3: native Codex rate-limit notification/read contract and Claude mod filtering contract.
// Pure ordering and persistence live in account-limits-unit.test.ts; component coalescing uses fake time.
import { accountClaude, accountCodex } from './account-fixture-env.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, eventually, nativeProjectHub as projectHub, tempProject, type FrameClient } from './harness.ts';
import type { AccountList, AccountView } from '../src/accounts/limits.ts';
import type { HarnessProcessView, SessionUsage } from '../src/protocol.ts';

async function setup(t: import('node:test').TestContext) {
  const root = await tempProject(t);
  const config = join(root, 'config');
  await mkdir(join(config, 'cland'), { recursive: true });
  await writeFile(join(config, 'cland', 'accounts.toml'), '[accounts.unread]\nharness = "codex"\n[accounts.oc]\nharness = "opencode"\n');
  return { root, config };
}
async function launch(ui: FrameClient, name: string, extra: Record<string, unknown> = {}) {
  const r = await ui.request({ type: 'session.launch', name, harness: 'claude-code', ...extra }, 30000);
  assert.equal(r.ok, true, r.error);
  return (r.value as { process: HarnessProcessView }).process;
}
async function accounts(ui: FrameClient) {
  const r = await ui.request({ type: 'account.list' });
  assert.equal(r.ok, true, r.error);
  return (r.value as AccountList).accounts;
}
async function journal(root: string, ui: FrameClient) {
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  return (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line)).filter(r => r.event === 'account-limits');
}
const five = (percentUsed: number) => ({ kind: 'five_hour', percentUsed, resetsAt: '2026-10-15T04:03:00.000Z' });
test('fake Codex pushes account windows and sparse per-model updates while reads are held', async t => {
  const { root, config } = await setup(t);
  const home = join(root, 'codex-b');
  await mkdir(home);
  await writeFile(join(config, 'cland', 'accounts.toml'), `[accounts.codex-b]\nharness = "codex"\nhome = ${JSON.stringify(home)}\n`);
  const fake = await accountCodex(t);
  const path = join(fake.home, 'rate-limits.json');
  // The running fake reads this file during turns; never expose a truncated JSON fixture.
  const writeRateLimits = async (contents: string) => {
    const pending = `${path}.tmp`;
    await writeFile(pending, contents);
    await rename(pending, path);
  };
  const reading = { rateLimits: { limitId: 'codex', primary: { usedPercent: 4, windowDurationMins: 300, resetsAt: 1792036980 }, secondary: null },
    rateLimitsByLimitId: { codex: { limitId: 'codex', primary: { usedPercent: 4, windowDurationMins: 300, resetsAt: 1792036980 }, secondary: null },
      review: { limitId: 'review', limitName: 'Code review', primary: { usedPercent: 19, windowDurationMins: 10080, resetsAt: 1792123380 }, secondary: null } } };
  await writeRateLimits(JSON.stringify({ [home]: reading }));
  const { discovery } = await projectHub(t, root, { ...fake.env, XDG_CONFIG_HOME: config, });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const p = await launch(ui, 'rev-x', { harness: 'codex', role: 'reviewer', account: 'codex-b' });
  await ui.waitFor(f => f.type === 'account' && (f.account as AccountView).name === 'codex-b');
  let listed = (await accounts(ui)).find(a => a.name === 'codex-b')!;
  assert.deepEqual(listed.windows, [
    { id: 'codex:primary', label: '5h', usedPercent: 4, resetsAt: new Date(1792036980 * 1000).toISOString(), windowMins: 300 },
    { id: 'review:primary', label: 'Code review', scope: 'Code review', usedPercent: 19, resetsAt: new Date(1792123380 * 1000).toISOString(), windowMins: 10080 },
  ]);
  await writeFile(join(fake.home, 'hold-rate-limits-read'), '1');
  await writeRateLimits(JSON.stringify({ [home]: { ...reading, update: { rateLimits: { limitId: 'review', primary: { usedPercent: 27 } } } } }));
  const mark = ui.frames.length;
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', to: [p.name], text: '@rev-x rate limits only' })).ok, true);
  await ui.waitFor(f => ui.frames.indexOf(f) >= mark && f.type === 'account' && (f.account as AccountView).windows.some(w => w.usedPercent === 27));
  const json = await cland(root, 'account', 'list', '--json');
  assert.equal(json.code, 0, json.stderr);
  listed = (JSON.parse(json.stdout) as AccountList).accounts[0]!;
  assert.equal(listed.windows[0]?.usedPercent, 4);
  assert.deepEqual(listed.windows[1], { id: 'review:primary', label: 'Code review', scope: 'Code review', usedPercent: 27, resetsAt: new Date(1792123380 * 1000).toISOString(), windowMins: 10080 });
  assert.ok(listed.at && Number.isFinite(Date.parse(listed.at)));
  assert.deepEqual(listed.source, { kind: 'session', session: p.name });
  reading.rateLimitsByLimitId.review.primary.usedPercent = 27;
  // A raw native field identifies this full read without changing its normalized windows.
  const readReceipt = 'released-full-read';
  await writeRateLimits(JSON.stringify({ [home]: { ...reading, rateLimits: { ...reading.rateLimits, readReceipt } } }));
  const receipt = ui.frames.length;
  const completed = ui.waitFor(f => ui.frames.indexOf(f) >= receipt && f.type === 'session.usage' && f.sessionId === p.sessionId && (f.usage as SessionUsage).rateLimits?.readReceipt === readReceipt);
  await writeFile(join(fake.home, 'release-rate-limits-read'), '1');
  await completed; // Arm observation before release; only the held native read carries this receipt.
  assert.equal((await journal(root, ui)).length, 2, 'read after sparse push is equal and silent');
  // A new full read removes omitted buckets, and durations are not fixed to two labels.
  await writeRateLimits(JSON.stringify({ [home]: { rateLimits: { limitId: 'codex', primary: { usedPercent: 22, windowDurationMins: 10080, resetsAt: 1792123380 }, secondary: { usedPercent: 31, windowDurationMins: 2880, resetsAt: 1792036980, severity: 'warning' } } } }));
  const last = ui.frames.length;
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', to: [p.name], text: '@rev-x another reading' })).ok, true);
  await ui.waitFor(f => ui.frames.indexOf(f) >= last && f.type === 'account' && (f.account as AccountView).windows.some(w => w.label === '2d'));
  const full = (await accounts(ui))[0]!;
  assert.deepEqual(full.windows.map(w => [w.label, w.usedPercent, w.windowMins, w.severity]), [['wk', 22, 10080, undefined], ['2d', 31, 2880, 'warning']]);
  assert.equal(full.windows.length, 2, 'the omitted per-model bucket is absent');
  // The compatibility snapshot prefers codex; it can instead name a different bucket.
  const reviewOnly = reading.rateLimitsByLimitId.review;
  for (const includeMap of [true, false]) {
    await writeRateLimits(JSON.stringify({ [home]: { rateLimits: reviewOnly, ...(includeMap ? { rateLimitsByLimitId: { review: reviewOnly } } : {}) } }));
    const mark = ui.frames.length;
    assert.equal((await ui.request({ type: 'topic.send', topic: 'general', to: [p.name], text: '@rev-x compatibility bucket' })).ok, true);
    await ui.waitFor(f => ui.frames.indexOf(f) >= mark && f.type === 'session.usage' && f.sessionId === p.sessionId);
    assert.deepEqual((await accounts(ui))[0]!.windows, [{ id: 'review:primary', label: 'Code review', scope: 'Code review', usedPercent: 27, resetsAt: new Date(1792123380 * 1000).toISOString(), windowMins: 10080 }]);
  }
  await unlink(join(fake.home, 'release-rate-limits-read'));
  await writeRateLimits(JSON.stringify({ [home]: { rateLimits: reviewOnly, update: { rateLimits: { primary: { usedPercent: 33 } } } } }));
  const sparse = ui.frames.length;
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', to: [p.name], text: '@rev-x sparse compatibility update' })).ok, true);
  await ui.waitFor(f => ui.frames.indexOf(f) >= sparse && f.type === 'account' && (f.account as AccountView).windows.some(w => w.usedPercent === 33));
  assert.deepEqual((await accounts(ui))[0]!.windows, [{ id: 'review:primary', label: 'Code review', scope: 'Code review', usedPercent: 33, resetsAt: new Date(1792123380 * 1000).toISOString(), windowMins: 10080 }]);
  await writeRateLimits(JSON.stringify({ [home]: { rateLimits: { ...reviewOnly, primary: { ...reviewOnly.primary, usedPercent: 33 } } } }));
  await writeFile(join(fake.home, 'release-rate-limits-read'), '1');
});

test('fake Claude mod sends only changed rate limits; context and cost do not escape a measure', async t => {
  const { root, config } = await setup(t);
  const fake = await accountClaude(t);
  const path = join(config, 'rate-limits.json');
  await writeFile(path, JSON.stringify([five(12), { kind: 'seven_day', percentUsed: 19, resetsAt: '2026-10-18T04:03:00.000Z' }, { kind: 'spend_limit', percentUsed: 80, resetsAt: '2026-11-01T00:00:00.000Z' }]));
  const { discovery } = await projectHub(t, root, { ...fake.env, XDG_CONFIG_HOME: config, CLAUDE_CONFIG_DIR: config, CODEX_HOME: join(root, 'missing-codex'), });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const p = await launch(ui, 'claude', { role: 'implementer' });
  await ui.waitFor(f => f.type === 'account');
  const listed = (await accounts(ui)).find(a => a.name === 'default:claude-code')!;
  assert.deepEqual(listed.windows.map(w => [w.label, w.usedPercent, w.resetsAt]), [['5h', 12, five(12).resetsAt], ['wk', 19, '2026-10-18T04:03:00.000Z'], ['spend_limit', 80, '2026-11-01T00:00:00.000Z']]);
  const count = async () => (await fake.log(p.harnessId!)).split('\n').filter(line => line.includes('mod-measure posted:'));
  await eventually('measure post completed', async () => (await count()).length === 1 || undefined);
  const posted = JSON.parse((await count())[0]!.split('mod-measure posted: ')[1]!);
  assert.deepEqual(Object.keys(posted).sort(), ['at', 'rateLimits']);
  assert.ok(posted.rateLimits.every((w: object) => Object.keys(w).sort().join(',') === 'kind,percentUsed,resetsAt'));
  const mark = ui.frames.length;
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', to: [p.name], text: '@claude another turn' })).ok, true);
  await ui.waitFor(f => ui.frames.indexOf(f) >= mark && f.type === 'session.usage' && f.sessionId === p.sessionId);
  await eventually('second measure completed', async () => (await fake.log(p.harnessId!)).split('session.measure done').length >= 3 || undefined);
  assert.equal((await count()).length, 1);
  assert.equal(ui.frames.filter(f => f.type === 'account').length, 1);
  assert.equal((await journal(root, ui)).length, 1);
});
