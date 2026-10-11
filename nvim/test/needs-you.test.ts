// The real hub's count, the top-bar chip and both inbox views must agree after classification.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Inbox } from '../../hub/src/protocol.ts';
import { Store } from '../../hub/src/hub/store.ts';
import { connectUi, eventually, fakeClaude, spawnSpoke, startDaemon, tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient } from './harness.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';

const cases = [
  { name: 'defaults with notifications', config: '', count: 3, layers: ['now', 'now', 'now'] },
  {
    name: 'notifications raised to Now',
    config: 'inbox.other = "now"\ninbox.clear = "now"\ninbox.not_clear = "now"\ninbox.death = "now"\n',
    count: 3, layers: ['now', 'now', 'now'],
  },
  {
    name: 'responses in Watch, Background and Archive with Now notifications',
    config: 'inbox.ask = "watch"\ninbox.approval = "background"\ninbox.waiting = "archive"\ninbox.other = "now"\ninbox.clear = "now"\n',
    count: 0, layers: ['watch', 'background', 'archive'],
  },
];

for (const scenario of cases) {
  test(`needs-you chip and both inbox views agree: ${scenario.name}`, { skip }, async t => {
    const root = await tempProject(t);
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), `[visibility]\n${scenario.config}`);
    // Reproduce a topic left waiting by an earlier hub, without an open ask (as in asks.test.ts).
    const store = new Store(join(root, '.cland/hub.db'));
    store.createTopic('waiting', 'Left waiting', null, new Date().toISOString());
    store.setTopicStatus('waiting', 'waiting for human');
    store.close();
    const fake = await fakeClaude(t, { pollMs: 60_000, pushTrustMs: 120_000 });
    const { discovery } = await startDaemon(t, root, fake.env);
    const ui = await connectUi(t, discovery);
    const request = async <T>(frame: { type: string } & Record<string, unknown>): Promise<T> => {
      const result = await ui.request(frame);
      assert.equal(result.ok, true, `${frame.type}: ${result.error}`);
      return result.value as T;
    };
    await request({ type: 'subscribe' });
    const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
    t.after(() => coord.close());
    await coord.waitForPresence(['coord']);
    const asking = await coord.call<{ ok: boolean; error?: string }>('ask', { topic: 'general', question: 'Choose direction?', options: ['Continue'], free: true });
    assert.equal(asking.ok, true, asking.error);
    await request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'claude-code' });
    await ui.waitFor(f => f.type === 'session.usage' && f.session === 'worker');
    await eventually('worker idle after its role clause', async () => {
      const status = await request<{ sessions: Array<{ name: string; state: string }> }>({ type: 'hub.status' });
      return status.sessions.some(s => s.name === 'worker' && s.state === 'idle') ? true : undefined;
    });
    await request({ type: 'session.signal', session: 'worker', event: 'permission', at: Date.now(), payload: { tool_name: 'Bash' } });
    const { item } = await request<{ item: { id: string } }>({ type: 'task.create', title: 'Count evidence' });
    for (const result of ['clear', 'not clear']) {
      await request({ type: 'task.comment', item: item.id, text: `Review ${result}.`, verdict: { verdict: 'review', result, run: `count-${result.replace(' ', '-')}` }, as: { name: 'rev', role: 'reviewer' } });
    }
    const c = await startClient(t, bin, root);
    await c.waitScreen(s => s.includes('hub: connected'), 'real hub connected');

    const check = async (expected: number, layers: string[]) => {
      const inbox = await request<Inbox>({ type: 'inbox.list' });
      assert.equal(inbox.needsYou, expected);
      assert.equal((await request<{ needsYou: number }>({ type: 'hub.status' })).needsYou, expected);
      assert.deepEqual([inbox.asks.length, inbox.approvals.length, inbox.waiting.length], [1, 1, 1], 'the ask topic is not counted twice as waiting');
      assert.deepEqual([inbox.asks[0]?.layer, inbox.approvals[0]?.layer, inbox.waiting[0]?.layer], layers);
      assert.ok(inbox.notifications.some(n => n.kind === 'role'));
      assert.ok(inbox.notifications.some(n => n.result === 'clear'));
      assert.ok(inbox.notifications.some(n => n.result === 'not clear'));
      // Compare literal expectations with rendered text, rather than deriving a count from local rows.
      for (const keys of ['<Esc><Space>n', '<Esc><Space>N']) {
        if (keys.includes('<Space>n')) {
          await c.input('<Esc><Space>t');
          await c.waitScreen(s => s.includes('TOPICS'), 'topics panel before switching to inbox');
        }
        await c.input(keys);
        const header = keys.includes('<Space>N') ? new RegExp(`Inbox · full width · ${expected} need you`)
          : expected === 0 ? /INBOX.*nothing needs you/ : new RegExp(`INBOX.*${expected} need you`);
        const screen = await c.waitScreen(s => new RegExp(`needs you\\s+${expected}\\b`).test(s.split('\n')[0] ?? '') && header.test(s), `chip and inbox header both show ${expected}`);
        assert.equal(Number(screen.split('\n')[0]?.match(/needs you\s+(\d+)/)?.[1]), expected, screen);
        assert.match(screen, header);
        if (expected === 0) assert.match(screen, /✓ nothing needs you/);
        const required = ['ask', 'approval', 'waiting'];
        const expectedNow = required.filter((_, i) => layers[i] === 'now');
        const expectedWatch = required.filter((_, i) => layers[i] === 'watch');
        // A mute can change rows without changing a zero count; wait for the actual redraw too.
        const rows = await eventually('inbox response rows reach their new layers', async () => {
          const rendered = await c.lua<{ now: string[]; watch: string[] }>(`
          local buf = vim.api.nvim_get_current_buf()
          local out, seen, layer = { now = {}, watch = {} }, {}, nil
          for i, line in ipairs(vim.api.nvim_buf_get_lines(buf, 0, -1, false)) do
            if line:match('^ NOW') then layer = 'now' elseif line:match('^ WATCH') then layer = 'watch' end
            local row = require('cland.panels').row_at(buf, i)
            local id = row and (row.ask and 'ask' or row.approval and 'approval' or row.topic == 'waiting' and 'waiting')
            if id and layer and not seen[id] then table.insert(out[layer], id); seen[id] = true end
          end
          return out
          `);
          return JSON.stringify(rendered.now) === JSON.stringify(expectedNow) && JSON.stringify(rendered.watch) === JSON.stringify(expectedWatch) ? rendered : undefined;
        });
        assert.deepEqual(rows.now, expectedNow, 'Now renders exactly the required responses counted by the chip');
        assert.deepEqual(rows.watch, expectedWatch, 'muted responses remain visible in Watch');
      }
      await c.input('<Esc><Space>N');
      await c.waitScreen(s => !s.includes('INBOX · FULL WIDTH'), 'return from full-width inbox');
    };

    await check(scenario.count, scenario.layers);
    if (scenario.config.includes('inbox.clear = "now"')) {
      const inbox = await request<Inbox>({ type: 'inbox.list' });
      assert.equal(inbox.notifications.find(n => n.result === 'clear')?.layer, 'now', 'an ordinary notification really was raised to Now');
      assert.equal(inbox.notifications.find(n => n.result === 'not clear')?.layer, 'watch', 'warnings retain D17 placement');
    }
    const set = (surface: string, target: string, mode: string) => request({ type: 'visibility.set', surface, target, mode });
    const muted = scenario.layers.map(layer => ({ now: 'watch', watch: 'background', background: 'archive', archive: 'archive' })[layer]!);
    // Muting required topics/session removes their contributions, even while their inbox rows remain.
    await set('topics', 'general', 'mute');
    await check(scenario.count === 3 ? 2 : 0, [muted[0]!, scenario.layers[1]!, scenario.layers[2]!]);
    await set('topics', 'waiting', 'mute');
    await check(scenario.count === 3 ? 1 : 0, [muted[0]!, scenario.layers[1]!, muted[2]!]);
    await set('sessions', 'worker', 'mute');
    await check(0, muted);
    // Pins replace mutes and restore all three responses to Now, including an archived waiting topic.
    await set('topics', 'general', 'pin');
    await check(1, ['now', muted[1]!, muted[2]!]);
    await set('topics', 'waiting', 'pin');
    await check(2, ['now', muted[1]!, 'now']);
    await set('sessions', 'worker', 'pin');
    await check(3, ['now', 'now', 'now']);
    // Repeating the choice resets it; both live inbox and cold snapshots return to project defaults.
    await set('topics', 'general', 'pin');
    await set('topics', 'waiting', 'pin');
    await set('sessions', 'worker', 'pin');
    await check(scenario.count, scenario.layers);
    const fresh = await startClient(t, bin, root);
    await fresh.waitScreen(s => s.includes('hub: connected'), 'cold client connected');
    await fresh.input('<Esc><Space>t');
    await fresh.waitScreen(s => s.includes('TOPICS'), 'cold topics panel');
    await fresh.input('<Esc><Space>n');
    await fresh.waitScreen(s => new RegExp(`needs you\\s+${scenario.count}\\b`).test(s.split('\n')[0] ?? '') && (scenario.count === 0 ? /INBOX.*nothing needs you/.test(s) : new RegExp(`INBOX.*${scenario.count} need you`).test(s)), 'cold chip and inbox agree after resetting preferences');
  });
}
