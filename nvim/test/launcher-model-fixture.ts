// Shared T2/T4 launcher seam: recorded stub, owned headless Neovim, native input receipt.
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { startShell, requestsOf, type Shell } from './shell-fixture.ts';

// Observe actual Insert input, not a launch reply or a poll of the editor's mode.
async function enterFreeTextModel(c: Shell, beforeTyping: () => Promise<void>) {
  const [channel] = await c.rpc.request<[number, unknown]>('nvim_get_api_info');
  let receive!: (value: unknown) => void;
  const receipt = new Promise(resolve => { receive = resolve; });
  const event = 'launcher-model-input';
  c.rpc.onNotification((method, args) => { if (method === event) receive(args[0]); });
  let timer: NodeJS.Timeout | undefined;
  try {
    await c.lua(`
      local channel, event = ...
      local group = vim.api.nvim_create_augroup('launcher-input-receipt', { clear = true })
      vim.api.nvim_create_autocmd('TextChangedI', {
        group = group,
        callback = function()
          if vim.b.cland_role ~= 'launcher' then return end
          local lines = vim.api.nvim_buf_get_lines(0, 0, 4, false)
          if lines[4] ~= 'custom-model' then return end
          vim.rpcnotify(channel, event, { name = lines[1], role = lines[2], model = lines[4],
            row = vim.api.nvim_win_get_cursor(0)[1], mode = vim.api.nvim_get_mode().mode })
          vim.api.nvim_del_augroup_by_id(group)
        end,
      })
      vim.api.nvim_create_autocmd('InsertEnter', {
        group = group,
        callback = function()
          if vim.b.cland_role ~= 'launcher' then return end
          vim.api.nvim_input('models<Tab>reviewer<Tab><Tab>')
          return true
        end,
      })
    `, channel, event);
    await c.input('<Esc><Space>l');
    await beforeTyping();
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`incomplete launcher model input receipt; exit=${c.process.exitCode}; signal=${c.process.signalCode}; stderr=${c.stderr().slice(-4096)}`)), 5000);
    });
    const input = async () => { await c.input('<C-u>custom-model'); return receipt; };
    assert.deepEqual(await Promise.race([input(), deadline]), {
      name: 'models', role: 'reviewer', model: 'custom-model', row: 4, mode: 'i',
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function failedOrEmptyModelAnswers(t: TestContext): Promise<number> {
  const c = await startShell(t, s => { s.holdSnapshots = ['models.list']; });
  let receipts = 0;
  for (const [error, hint] of [['catalog unavailable\ntry again', 'catalog unavailable try again'], ['', 'the hub returned no models']]) {
    await c.control({ set: { models: [], holdSnapshots: error ? ['models.list'] : [] } });
    await enterFreeTextModel(c, async () => {
      if (error) {
        await c.control({ waitSnapshot: 'models.list' });
        await c.control({ releaseSnapshots: ['models.list'], snapshotError: error });
      }
      await c.waitScreen(x => x.includes(hint!), 'model failure reason');
      assert.equal(await c.lua('return vim.fn.pumvisible()'), 0);
    });
    receipts++;
    await c.waitScreen(x => /model +custom-model/.test(x) && x.includes(hint!), 'free text retains its reason');
    await c.input('<CR>');
    await c.waitScreen(x => !x.includes('launch a session'), 'launch after model lookup failure');
    assert.equal((await requestsOf(c, 'session.launch')).at(-1)?.model, 'custom-model');
  }
  return receipts;
}
