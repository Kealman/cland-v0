// T2 plan view observations shared with the native workbench scenario.
import assert from 'node:assert/strict';
import { nvimOrSkip, type Client } from './stub-client.ts';
const nvim = await nvimOrSkip();
export const skip = 'skip' in nvim ? nvim.skip : false;
export const bin = 'bin' in nvim ? nvim.bin : '';
export async function planText(client: Client, id: string) {
  return client.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(require('cland.plan').bufs[...],0,-1,false),'\\n')", id);
}
export async function waitFor(predicate: () => Promise<boolean>, what: string) {
  // Yield to Neovim between lookups so queued navigation and receipt frames can run.
  const until = Date.now() + 5000;
  let ready = false;
  while (Date.now() < until) {
    ready = await predicate();
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.ok(ready, `${what} not ready within 5000 ms`);
}
export async function openPlan(client: Client, id: string) {
  // Connected precedes the task/ladder snapshots. An early command is refused,
  // so waiting for plan text after issuing it cannot recover that navigation.
  await waitFor(() => client.lua<boolean>("local id=...; return require('cland.plan').owner(id) == id", id), `epic ${id} from task and tracker snapshots`);
  await client.input(`<Esc>:Cland view plan ${id}<CR>`);
}
export async function waitPlan(client: Client, id: string, text: string) {
  await waitFor(() => client.lua<boolean>("local id,text=...; local view=require('cland.state').S.ui.view; local p=require('cland.plan'); local b,v=p.bufs[id],p.visits[id]; return view.kind == 'plan' and view.id == id and v ~= nil and not v.acknowledge and b ~= nil and vim.api.nvim_buf_is_valid(b) and table.concat(vim.api.nvim_buf_get_lines(b,0,-1,false),'\\n'):find(text,1,true) ~= nil", id, text), `plan showing ${text}`);
  assert.ok((await planText(client, id)).includes(text), text);
}
