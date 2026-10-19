// T2: recorded protocol frames drive both inbox views; injected rules live in hub/test/nvim-needs-you-rules.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nvimOrSkip, startClient } from './stub-client.ts';
import { tempProject, eventually } from './fixture.ts';
import { cases } from './needs-you-fixture.ts';
import { stubControl } from './stub-control.ts';
import { STUB_NOW } from './fixtures/clock.ts';
const nvim = await nvimOrSkip(), skip = 'skip' in nvim ? nvim.skip : false, bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
for (const scenario of cases) {
  test(`recorded frames: needs-you chip and both inbox views agree: ${scenario.name}`, { skip }, async t => {
    const root = await tempProject(t);
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), `[visibility]\n${scenario.config}`);
    const topic = (id: string) => ({ id, title: id, status: 'open', standing: true, createdAt: STUB_NOW, updatedAt: STUB_NOW });
    const controlPath = join(root, 'stub.sock');
    const snapshot = { topics: [topic('general'), topic('agents'), topic('waiting')],
      processes: [{ name: 'worker', sessionId: 'worker-id', role: 'implementer', harness: 'claude-code', status: 'running', state: 'waiting for approval' }],
      inbox: { asks: [{ id: 'ask-1', question: 'Choose direction?', options: ['Continue'], free: true, from: 'coord', topic: topic('general'), ts: STUB_NOW }],
        approvals: [{ id: 'approval-1', session: 'worker', command: 'Bash', since: STUB_NOW }],
        waiting: [{ ...topic('waiting'), status: 'waiting for human' }],
        messages: [{ id: 'waiting-report', topic: topic('waiting'), text: 'Waiting for your response', since: STUB_NOW, layer: scenario.layers[2] }]  } };
    const start = () => startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_SCENARIO_JSON: JSON.stringify(snapshot), CLAND_STUB_CONTROL: controlPath });
    const c = await start();
    await c.waitScreen(s => s.includes('hub: connected'), 'recorded hub connected');
    const check = async (expected: number, layers: string[]) => {
      // Inbox messages carry the hub's authoritative classification; the paired rule test proves it.
      snapshot.inbox.messages[0]!.layer = layers[2];
      await stubControl(controlPath, { set: { inbox: snapshot.inbox }, emit: { type: 'inbox', inbox: { ...snapshot.inbox, needsYou: expected } } });
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
        const expectedNow = required.filter((_, i) => layers[i] === 'now').sort();
        const expectedWatch: string[] = []; // Now-only inbox: muted responses leave this surface.
        // A mute can change rows without changing a zero count; wait for the actual redraw too.
        const rows = await eventually('inbox response rows reach their new layers', async () => {
          const rendered = await c.lua<{ now: string[]; watch: string[] }>(`
          local buf = vim.api.nvim_get_current_buf()
          local out, seen = { now = {}, watch = {} }, {}
          for i, line in ipairs(vim.api.nvim_buf_get_lines(buf, 0, -1, false)) do
            local row = require('cland.panels').row_at(buf, i)
            local id = row and (row.ask and 'ask' or row.approval and 'approval' or row.topic == 'waiting' and 'waiting')
            if id and not seen[id] then table.insert(out.now, id); seen[id] = true end
          end
          table.sort(out.now)
          return out
          `);
          return JSON.stringify(rendered.now) === JSON.stringify(expectedNow) && JSON.stringify(rendered.watch) === JSON.stringify(expectedWatch) ? rendered : undefined;
        });
        assert.deepEqual(rows.now, expectedNow, 'Now renders exactly the required responses counted by the chip');
        assert.deepEqual(rows.watch, expectedWatch, 'non-now responses are absent from the inbox');
      }
      await c.input('<Esc><Space>N');
      await c.waitScreen(s => !s.includes('INBOX · FULL WIDTH'), 'return from full-width inbox');
    };

    await check(scenario.count, scenario.layers);
    const set = async (surface: string, target: string, mode: string) => {
      await c.lua(`local done = false; require('cland').client:request({ type = 'visibility.set', surface = ..., target = select(2, ...), mode = select(3, ...) }, function(err) assert(not err, err); done = true end); assert(vim.wait(5000, function() return done end))`, surface, target, mode);
    };
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
    const fresh = await start();
    await fresh.waitScreen(s => s.includes('hub: connected'), 'cold client connected');
    await fresh.input('<Esc><Space>t');
    await fresh.waitScreen(s => s.includes('TOPICS'), 'cold topics panel');
    await fresh.input('<Esc><Space>n');
    await fresh.waitScreen(s => new RegExp(`needs you\\s+${scenario.count}\\b`).test(s.split('\n')[0] ?? '') && (scenario.count === 0 ? /INBOX.*nothing needs you/.test(s) : new RegExp(`INBOX.*${scenario.count} need you`).test(s)), 'cold chip and inbox agree after resetting preferences');
  });
}
