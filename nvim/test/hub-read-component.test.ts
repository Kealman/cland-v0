// T2: exercise the ticket's read-loop seam inside the recorded headless client.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { nvimOrSkip, startClient, tempProject } from './stub-client.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';

async function client(t: TestContext) {
  const root = await tempProject(t);
  return startClient(t, bin, root, {
    CLAND_HUB_TRANSPORT: 'stdio',
    CLAND_COMMAND: JSON.stringify([process.execPath, fileURLToPath(new URL('./stub-hub.ts', import.meta.url))]),
  });
}

test('a 20 MiB frame in 64 KiB chunks decodes once within 2 s and bounded allocation', { skip }, async t => {
  const c = await client(t);
  const result = await c.lua<{ count: number; bytes: number; matches: boolean; ms: number; growth: number; rssGrowth: number }>(`
    local reader = require('cland.hub').new({ root = vim.env.CLAND_ROOT })
    local payload = string.rep('x', 20 * 1024 * 1024)
    local wire = vim.json.encode({ type = 'message', text = payload }) .. '\\n'
    local count, value = 0, nil
    reader:on('message', function(frame) count = count + 1; value = frame.text end)
    collectgarbage('collect')
    local baseline = collectgarbage('count') * 1024
    local resident = vim.uv.resident_set_memory()
    local peak = resident
    -- Retain allocations during this bounded measurement so GC cannot hide
    -- repeated prefix copies. Abort early to keep the regression safe on red.
    collectgarbage('stop')
    local ok, measured = pcall(function()
      local started = vim.uv.hrtime()
      for offset = 1, #wire, 64 * 1024 do
        reader:_data(wire:sub(offset, offset + 64 * 1024 - 1))
        peak = math.max(peak, vim.uv.resident_set_memory())
        assert(collectgarbage('count') * 1024 - baseline < 8 * #wire,
          'fragmented frame allocation exceeded 8 times frame size')
      end
      return { count = count, bytes = value and #value or 0, matches = value == payload,
        ms = (vim.uv.hrtime() - started) / 1e6,
        growth = collectgarbage('count') * 1024 - baseline, rssGrowth = peak - resident }
    end)
    collectgarbage('restart')
    assert(ok, measured)
    return measured
  `);
  assert.equal(result.count, 1);
  assert.equal(result.bytes, 20 * 1024 * 1024);
  assert.equal(result.matches, true);
  assert.ok(result.ms < 2000, `decode took ${result.ms} ms`);
  assert.ok(result.growth < 8 * 20 * 1024 * 1024, `allocated ${result.growth} bytes`);
  assert.ok(result.rssGrowth < 8 * 20 * 1024 * 1024, `RSS grew ${result.rssGrowth} bytes`);
  t.diagnostic(`read loop: ${result.ms.toFixed(1)} ms, ${result.growth} allocated bytes, ${result.rssGrowth} RSS growth bytes`);
});

test('split, coalesced and partial lines preserve frame order and drop malformed lines', { skip }, async t => {
  const c = await client(t);
  const result = await c.lua<{ splits: number; bytewise: string[]; before: string[]; after: string[] }>(String.raw`
    local Hub = require('cland.hub')
    local function reader()
      local r, frames = Hub.new({ root = vim.env.CLAND_ROOT }), {}
      r:on('message', function(frame) frames[#frames + 1] = frame.text end)
      return r, frames
    end
    local wire = '{"type":"message","text":"héllo\\nworld"}' .. '\n'
    -- Split at every byte, including inside a UTF-8 character and JSON escape.
    for split = 0, #wire do
      local r, frames = reader()
      r:_data(wire:sub(1, split))
      assert(#frames == (split == #wire and 1 or 0), 'premature frame at ' .. split)
      r:_data(wire:sub(split + 1))
      assert(#frames == 1 and frames[1] == 'héllo\nworld', 'split ' .. split)
    end
    local r, bytewise = reader()
    for i = 1, #wire do r:_data(wire:sub(i, i)) end
    local mixed, frames = reader()
    mixed:_data('\n \t\r\nnot json\nnull\n42\n' .. wire ..
      '{"type":"message","text":"second"}\n{"type":"message","text":"thi')
    local before = vim.deepcopy(frames)
    mixed:_data('rd"}')
    assert(#frames == 2, 'partial line must wait for its newline')
    mixed:_data('')
    mixed:_data('\n\n')
    return { splits = #wire + 1, bytewise = bytewise, before = before, after = frames }
  `);
  assert.ok(result.splits > 40, 'every byte split was exercised');
  assert.deepEqual(result.bytewise, ['héllo\nworld']);
  assert.deepEqual(result.before, ['héllo\nworld', 'second']);
  assert.deepEqual(result.after, ['héllo\nworld', 'second', 'third']);
});
