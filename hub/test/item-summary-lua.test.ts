// T3: the independent oracle is the plugin's real Lua in headless Neovim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseItem, serializeItem } from '../src/tracker/item.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { connectSocket, connectUi, projectHub, tempProject } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { ensureNvim, findNvim } from '../../nvim/bin/nvim-path.ts';

const repo = resolve(import.meta.dirname, '../..');
const driver = `
local repo, input, output = _G.arg[1], _G.arg[2], _G.arg[3]
package.path = repo .. '/nvim/lua/?.lua;' .. package.path
local f = assert(io.open(input)); local data = vim.json.decode(f:read('*a')); f:close()
local state = require('cland.state')
state.S.items = data.items
state.S.tracker = data.tracker
state.S.sibling_orders = {}
package.loaded['cland.plan']={get=function(id) return data.plans[id] end}
local E = require('cland.explorer')
local S = require('cland.explorer_summary')
local ix, out = E.index(), {}
for _, it in ipairs(data.items) do
  local text, from = S.summary(data.bodies[it.id])
  local value = {summary={text=text,from=from or vim.NIL,provenance=(text~='' and from~='written') and ('fallback from ' .. (from and ('## ' .. from) or 'the body') .. ' · no ## Summary yet') or vim.NIL},derived_status=E.status_of(ix,it),glyph=E.glyph(ix,it),blocked=not E.done(it) and #require('cland.items').open_blockers(it)>0}
  local names,words=S.outline(data.bodies[it.id]); value.agents_text={sections=names,words=words}
  if E.is_container(ix,it) then
    local members = {}
    for _, child in ipairs(E.kids(ix,it.id)) do
      if (E.is_release(it) and E.is_container(ix,child)) or (not E.is_release(it) and child.kind=='task') then members[#members+1]=child end
    end
    local counts = {total=#members,done=0,statuses={},work={['in progress']=0,review=0,qa=0}}
    for _, child in ipairs(members) do
      local st=E.status_of(ix,child); if st=='in work' then st='in progress' end
      counts.statuses[st]=(counts.statuses[st] or 0)+1
      if st=='done' then counts.done=counts.done+1 end
    end
    local leaves = E.is_release(it) and E.leaves(ix,it.id) or E.kids(ix,it.id)
    for _, child in ipairs(leaves) do local st=E.leaf_status(child); if counts.work[st] then counts.work[st]=counts.work[st]+1 end end
    value.child_counts=counts
    local items = require('cland.items')
    local old_scope = items.scope
    items.scope = function() return it end
    value.next = require('cland.vboard').compose().next or vim.NIL
    items.scope = old_scope
    local rank = {archive=1,background=2,watch=3,now=4}
    local layer, claims, holds = nil, {}, {}
    for _, leaf in ipairs(E.leaves(ix,it.id)) do
      if items.present(leaf.layer) and (not layer or rank[leaf.layer]>rank[layer]) then layer=leaf.layer end
      if items.present(leaf.claim) then claims[#claims+1]={item=leaf.id,claim=leaf.claim} end
      for _, hold in ipairs(leaf.holds or {}) do holds[#holds+1]={item=leaf.id,hold=hold} end
    end
    local descendants={}
    local function descend(parent)
      for _, child in ipairs(E.kids(ix,parent.id)) do descendants[#descendants+1]=child;descend(child) end
    end
    descend(it)
    local latest=nil
    local activity={at=it.updated,item=it.id,title=items.display_title(it),source='item updated'}
    for _, child in ipairs(descendants) do
      for _, v in ipairs(child.verdicts or {}) do
        if not latest or v.at>=latest.at then latest={item=child.id,run=v.run,verdict=v.verdict,result=v.result,at=v.at,round=it.state~='closed' and child.state~='closed' and v.round or nil} end
      end
      if child.updated>activity.at then activity={at=child.updated,item=child.id,title=items.display_title(child),source='item updated'} end
    end
    local number,total,stage=E.stage_in_work(it)
    local current=number and {number=number,total=total,name=stage.name} or vim.NIL
    value.rollup={stage=current,layer=layer or vim.NIL,claims=vim.empty_dict(),holds=vim.empty_dict(),latest_verdict=latest or vim.NIL,last_activity=activity}
    value.rollup.claims=claims;value.rollup.holds=holds

  end
  out[it.id]=value
end
local o=assert(io.open(output,'w')); o:write(vim.json.encode(out)); o:close()
`;

test('snapshot summaries and roll-ups equal Lua on every copied live tracker body', async t => {
  const root = await tempProject(t);
  await cp(join(repo, '.cland/tasks'), join(root, '.cland/tasks'), { recursive: true });
  // Guaranteed legacy boundary: an open epic with planned work below a closed release.
  for (const [id,kind,parent,state,status] of [
    ['R-900001','release',null,'closed',undefined],
    ['E-900002','epic','R-900001','open',undefined],
    ['T-900003','task','E-900002','open','planned'],
  ] as const) await writeFile(join(root,`.cland/tasks/${id}-regression.md`),serializeItem({
    fm:{id,kind,title:id,parent,state,...(status?{status,size:'S' as const}:{}),labels:[],assignee:null,blocked_by:[],topic:null,branch:null,created:'2026-10-16T12:00:00Z',updated:'2026-10-16T12:00:00Z'},
    body:'## Summary\n\nAncestor regression.',comments:[],
  }));
  const bodies: Record<string, string> = {};
  for (const name of await readdir(join(root, '.cland/tasks'))) if (name.endsWith('.md')) {
    const item = parseItem(await readFile(join(root, '.cland/tasks', name), 'utf8'), name);
    bodies[item.fm.id] = item.body;
  }
  const hub = await projectHub(t, root);
  const socket = await connectSocket(hub.discovery.socket);
  onCleanup(t, () => socket.close());
  socket.send({ type: 'hello', protocol: 2, secret: hub.discovery.secret, client: 'lua-differential', features: ['snapshot'] });
  let items: Array<Record<string, unknown>> = [];
  let tracker: unknown;
  let snapshotBytes=0;
  for (;;) {
    const frame = await socket.next();
    assert.notEqual(frame.type, 'snapshot.refused', JSON.stringify(frame));
    if (frame.type === 'snapshot' && frame.domain === 'tracker') tracker=frame.value;
    if (frame.type === 'snapshot' && frame.domain === 'items') {
      items = (frame.value as {items:typeof items}).items;
      snapshotBytes=Buffer.byteLength(JSON.stringify(frame));
    }
    if (frame.type === 'snapshot.end') break;
  }
  assert.ok(items.every(item => item.kind !== 'task' || item.state !== 'closed'));
  assert.ok(items.every(item => typeof item.layer === 'string'), 'every snapshot item has its hub layer');
  t.diagnostic(`copied live items snapshot: ${snapshotBytes} bytes; cap 1048576 bytes`);
  assert.ok(snapshotBytes <= 512*1024, `${snapshotBytes} bytes exceeds T-1081's 50% copied-state ceiling`);
  assert.ok(snapshotBytes <= 1024*1024, `${snapshotBytes} bytes exceeds the 1 MiB items cap`);
  const ui = await connectUi(t, hub.discovery);
  for (const parent of ['', ...items.map(item => String(item.id))]) {
    let cursor:string|undefined;
    do {
      const reply=await ui.request({type:'task.list',projection:'summary',state:'closed',parent,...(cursor?{cursor}:{})});
      assert.equal(reply.ok,true,reply.error);
      assert.ok(Buffer.byteLength(JSON.stringify(reply)+'\n')<=256*1024);
      const page=reply.value as {items:typeof items;next:string|null};
      items.push(...page.items); cursor=page.next??undefined;
    } while(cursor);
  }
  assert.equal(items.length,Object.keys(bodies).length);
  const closed = items.filter(item => item.state === 'closed');
  assert.ok(closed.every(item => !Object.hasOwn(item.summary as object,'text')&&!Object.hasOwn(item,'agents_text')&&!Object.hasOwn(item,'decision')));
  for (let n=0; n<closed.length; n+=100) {
    let ids = closed.slice(n,n+100).map(item => String(item.id));
    while (ids.length) {
      const reply = await ui.request({type:'task.list',projection:'summary',ids});
      assert.equal(reply.ok,true,reply.error);
      assert.ok(Buffer.byteLength(JSON.stringify(reply)+'\n') <= 256*1024);
      const value = reply.value as {items:Array<{id:string;summary:unknown;agents_text:unknown}>;remaining:string[]};
      assert.ok(value.items.length > 0);
      for (const row of value.items) {
        assert.ok(row.agents_text,'closed card facts share the bounded by-id page');
        Object.assign(items.find(item => item.id===row.id)!,row);
      }
      ids = value.remaining;
    }
  }
  const plans: Record<string,unknown> = {};
  for (const item of items.filter(item => item.kind==='epic')) {
    const reply=await ui.request({type:'task.plan',op:'show',item:item.id});
    assert.equal(reply.ok,true,reply.error);plans[String(item.id)]=reply.value;
  }
  await writeFile(join(root, 'oracle.lua'), driver);
  await writeFile(join(root, 'input.json'), JSON.stringify({items,bodies,plans,tracker}));
  const oracleEnv=fixtureEnvironment(root,process.env);
  const binary=findNvim() ?? await ensureNvim({...oracleEnv,CLAND_NVIM_CACHE_DIR:join(root,'nvim-cache')});
  execFileSync(binary, ['--clean','--headless','-l',join(root,'oracle.lua'),repo,join(root,'input.json'),join(root,'output.json')],
    {cwd:root,env:oracleEnv,timeout:30000,maxBuffer:4*1024*1024});
  const expected = JSON.parse(await readFile(join(root, 'output.json'), 'utf8')) as Record<string, Record<string, unknown>>;
  const differences: string[] = [];
  for (const item of items) {
    const want = expected[String(item.id)]!;
    // Lua's empty dictionary encodes as []; normalize only this representational detail.
    if (want.child_counts) {
      const counts = want.child_counts as {statuses:unknown};
      if (Array.isArray(counts.statuses)) counts.statuses = {};
    }
    if (want.rollup) {
      const rollup = want.rollup as Record<string,unknown>;
      const actual = item.rollup as Record<string,unknown>;
      const latest = rollup.latest_verdict as Record<string,unknown>|null;
      if (latest) {
        const hubLatest=actual.latest_verdict as Record<string,unknown>;
        for (const key of Object.keys(latest)) {
          try { assert.deepEqual(hubLatest?.[key],latest[key]); }
          catch { differences.push(`${item.id} latest verdict ${key}: hub=${JSON.stringify(hubLatest?.[key])}; Lua=${JSON.stringify(latest[key])}`); }
        }
      } else if (actual.latest_verdict !== null) differences.push(`${item.id} latest verdict: expected null`);
      delete rollup.latest_verdict;
      for (const [key,value] of Object.entries(rollup)) {
        try { assert.deepEqual(actual[key],value); }
        catch { differences.push(`${item.id} rollup ${key}: hub=${JSON.stringify(actual[key])}; Lua=${JSON.stringify(value)}`); }
      }
      delete want.rollup;
    }
    for (const [key,value] of Object.entries(want)) {
      try { assert.deepEqual(item[key],value); }
      catch { differences.push(`${item.id} ${key}: hub=${JSON.stringify(item[key])}; Lua=${JSON.stringify(value)}`); }
    }
  }
  t.diagnostic(`${items.length-3} copied bodies plus 3 ancestor regression rows; ${differences.length} differences`);
  assert.equal(differences.length, 0, differences.slice(0, 8).join('\n'));
});
