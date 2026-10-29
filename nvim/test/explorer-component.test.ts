// T2: screen permutations consume committed protocol frames through stub-client.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { Client } from './stub-client.ts';
import type { Scenario } from './stub-hub.ts';
import { tempProject, eventually } from './fixture.ts';
import { fixture, stages, skip, stub, text, select, releaseRowsAndCursorIdentity } from './explorer-outline-fixture.ts';

test('explorer fetches open summaries first, closed summaries on expansion, and card text through task.view', {skip}, async t => {
  const scenario: Scenario = { ...fixture, summaryLists: true, items: [
    {id:'R-1',kind:'release',title:'Current release',state:'open',version:'0.2.0'},
    {id:'T-2',kind:'task',title:'Open summary row',state:'open',parent:'R-1',blocked_by:['T-3'],open_blockers:[],branch:'t/detail',file:'T-2-summary.md',
      verify:{id:'detail-job',state:'finished',result:'passed',head:'abcdef012345',finished:'2026-01-01T00:00:00Z'},
      body:'## Summary\nText fetched by task.view.'},
    {id:'T-3',kind:'task',title:'Closed lazy row',state:'closed',status:'done',body:'## Summary\nArchived card body.'},
  ] };
  const root = await tempProject(t);
  await mkdir(root+'/.cland/tasks',{recursive:true});
  await writeFile(root+'/.cland/tasks/T-2-summary.md','## Summary\nEditable item body.\n');
  const {c,control} = await stub(t,scenario,root);
  await c.waitScreen(s => s.includes('Current release') && s.includes('Closed items'), 'open-only explorer');
  let frames = (await control({requests:true})).requests.filter(r => r.type === 'task.list');
  assert.deepEqual(frames.map(r => [r.projection,r.state]), [['summary','open']]);
  assert.equal(await c.lua("return require('cland.state').item('T-3') ~= nil"), false);
  await select(c,':direct:R-1'); await c.input('l');
  await c.waitScreen(s => s.includes('Open summary row'), 'open item row');
  assert.deepEqual(await c.lua("return require('cland.items').open_blockers(require('cland.state').item('T-2'))"), [], 'unloaded closed blocker does not mark the open row blocked');
  await select(c,'T-2'); await c.input('<CR>');
  await c.waitScreen(s => s.includes('Text fetched by task.view.'), 'card task.view body');
  const card = await c.lua<string>("return table.concat(require('cland.explorer').card.lines,'\\n')");
  assert.ok(card.includes('t/detail') && card.includes('detail-job'), 'card uses task.view metadata omitted from summaries');
  assert.ok((await control({requests:true})).requests.some(r => r.type === 'task.view' && r.item === 'T-2'));
  await c.input('h'); await select(c,':closed'); await c.input('l');
  await c.waitScreen(s => s.includes('Closed lazy row'), 'closed row after group expansion');
  await c.input('h');
  await eventually('closed group collapsed', async () => await c.lua<boolean>("return require('cland.explorer').ui().folds[':closed'] == false") || undefined);
  await select(c,':closed'); await c.input('l');
  await c.waitScreen(s => s.includes('Closed lazy row'), 'cached closed group reopened');
  frames = (await control({requests:true})).requests.filter(r => r.type === 'task.list');
  assert.deepEqual(frames.map(r => [r.projection,r.state]), [['summary','open'],['summary','closed'],['summary','closed']]);
  await c.lua("require('cland.item_view').edit('T-2')");
  await c.waitScreen(s => s.includes('Editable item body.'), 'edit resolves file from task.view');
});

// T2: counts are protocol facts; the first render has no closed task rows.
test('container progress includes unloaded closed children and follows parent task events', {skip}, async t => {
  const mixed = {id:'E-2',kind:'epic',title:'Mixed progress',parent:'R-1',state:'open',
    child_counts:{total:13,done:9,statuses:{done:9,review:1,planned:3},work:{'in progress':0,review:1,qa:0}}};
  const complete = {id:'E-3',kind:'epic',title:'Completed children',parent:'R-1',state:'open',
    child_counts:{total:5,done:5,statuses:{done:5},work:{'in progress':0,review:0,qa:0}}};
  const {c,control} = await stub(t,{...fixture,summaryLists:true,items:[
    {id:'R-1',kind:'release',title:'Progress release',state:'open'},mixed,complete,
    ...Array.from({length:18},(_,n)=>({id:`T-${n+10}`,kind:'task',title:`Child ${n}`,parent:n<13?'E-2':'E-3',
      state:n<9||n>=13?'closed':'open',status:n<9||n>=13?'done':n===9?'review':'planned'})),
  ]});
  const row = (id:string) => c.lua<string>("local id=...;local e=require('cland.explorer');for n,r in ipairs(e.rows) do if r.key==id then return vim.api.nvim_buf_get_lines(e.b,n-1,n,false)[1] end end;error('missing row '..id)",id);
  await c.waitScreen(s=>s.includes('Mixed progress')&&s.includes('Completed children'),'container rows rendered');
  assert.match(await row('E-2'), /9\/13/);
  assert.match(await row('E-3'), /5\/5/);
  assert.equal(await c.lua("return require('cland.state').item('T-10') ~= nil"),false);
  assert.equal(await c.lua("return require('cland.state').S.closed_items_loaded"),false);
  const changed = {...mixed,child_counts:{total:13,done:10,statuses:{done:10,planned:3},work:{'in progress':0,review:0,qa:0}}};
  const updated = c.waitScreen(s=>/Mixed progress[^\n]*10\/13/.test(s),'updated parent progress');
  await control({emits:[
    {type:'task',id:'T-19',item:{id:'T-19',kind:'task',title:'Child 9',parent:'E-2',state:'closed',status:'done'}},
    {type:'task',id:'E-2',item:changed},
  ]});
  await updated;
  assert.match(await row('E-2'), /10\/13/);
  assert.deepEqual((await control({requests:true})).requests.filter(r=>r.type==='task.list').map(r=>[r.projection,r.state]),[['summary','open']]);
  await c.input('<Esc><Space>i6zR');
  await eventually('items panel renders the same complete progress', async () => await c.lua<boolean>(`
    local p=require('cland.panels');local b=p.buf('items')
    if not b or not vim.api.nvim_buf_is_valid(b) then return false end
    local text=table.concat(vim.api.nvim_buf_get_lines(b,0,-1,false),'\\n')
    return text:match('Mixed progress[^\\n]*10/13')~=nil and text:match('Completed children[^\\n]*5/5')~=nil
  `) || undefined);
});

test('item search loads closed summaries without a startup closed request', {skip}, async t => {
  const {c,control} = await stub(t,{...fixture,summaryLists:true,items:[
    {id:'R-1',kind:'release',title:'Current release',state:'open',version:'0.2.0'},
    {id:'T-3',kind:'task',title:'Find archived item',state:'closed'},
  ]});
  assert.deepEqual((await control({requests:true})).requests.filter(r => r.type === 'task.list').map(r => r.state), ['open']);
  await c.lua("require('cland.picker').open({kind='items'})");
  await c.waitScreen(s => s.includes('Find archived item'), 'closed item search hit');
  const frames = await eventually('closed summary search frame', async () => {
    const frames = (await control({requests:true})).requests.filter(r => r.type === 'task.list');
    return frames.some(r => r.state === 'closed') ? frames : undefined;
  });
  assert.deepEqual(frames.map(r => [r.projection,r.state]), [['summary','open'],['summary','closed'],['summary','closed']]);
});

test('a held closed snapshot replays a reopen as exactly one open item', {skip}, async t => {
  const archived = {id:'T-3',kind:'task',title:'Reopened while loading',state:'closed',status:'done'};
  const {c,control} = await stub(t,{...fixture,summaryLists:true,items:[
    {id:'R-1',kind:'release',title:'Current release',state:'open',version:'0.2.0'}, archived,
  ]});
  await control({set:{holdSnapshots:['task.list']}});
  await select(c,':closed'); await c.input('l');
  await control({waitSnapshot:'task.list'});
  const reopened = {...archived,state:'open',status:'backlog'};
  await control({set:{items:[{id:'R-1',kind:'release',title:'Current release',state:'open',version:'0.2.0'},reopened]},emit:{type:'task',id:'T-3',item:reopened}});
  await eventually('reopen event applied before closed snapshot', async () => await c.lua<boolean>("return (require('cland.state').item('T-3') or {}).state == 'open'") || undefined);
  await control({releaseSnapshots:['task.list']});
  await eventually('closed snapshot installed', async () => await c.lua<boolean>("return require('cland.state').S.closed_items_loaded == true") || undefined);
  assert.deepEqual(await c.lua("local rows={}; for _,it in ipairs(require('cland.state').S.items) do if it.id=='T-3' then rows[#rows+1]=it.state end end; return rows"), ['open']);
  assert.equal(await c.lua("return require('cland.explorer').index().by['T-3'].state"), 'open');
});

async function cursor(c:Client) {
  return c.lua<string>("local e=require('cland.explorer'); return e.key_at(vim.api.nvim_win_get_cursor(e.tree_win())[1])");
}

async function at(c:Client, key:string) {
  await c.lua("local key=...; assert(vim.wait(5000,function() local e=require('cland.explorer'); return e.key_at(vim.api.nvim_win_get_cursor(e.tree_win())[1])==key end),'cursor '..key)",key);
}

test('outline keys skip detail and stage labels, respect counts and fold the leaf parent', {skip}, async t => {
  const {c}=await stub(t);
  await c.input('<Esc><Space>e');
  await c.waitScreen(s=>s.includes('First epic'),'release tree');
  await select(c,'R-1'); await c.input('j'); await at(c,'E-3');
  await c.input('3j'); await at(c,':direct:R-1');
  await c.input('3k'); await at(c,'E-3');
  await c.input('l'); await c.waitScreen(s=>s.includes('S1 the tree'),'epic unfolded');
  assert.equal(await cursor(c),'E-3');
  await c.input('l'); await at(c,'T-10');
  await c.input('6j'); await at(c,'T-17');
  await c.input('k'); await at(c,'T-15');
  await c.input('h'); await at(c,'E-3');
  await c.waitScreen(s=>!s.includes('Task in progress'),'parent folded');
  await c.input('l');
  await c.waitScreen(s=>s.includes('Task in progress'),'parent unfolded again');
  await c.input('lzo'); await at(c,'T-10');
  await c.input('zc'); await at(c,'E-3');
  await c.waitScreen(s=>!s.includes('Task in progress'),'zc on leaf folds parent');
  await c.input('l'); await c.waitScreen(s=>s.includes('Task in progress'),'za parent reopened');
  await c.input('l'); await at(c,'T-10');
  await c.input('za'); await at(c,'E-3');
  await c.waitScreen(s=>!s.includes('Task in progress'),'za on leaf folds parent');
  await c.input('zR'); await c.waitScreen(s=>s.includes('Task in progress')&&s.includes('○ T-6 Unscheduled task')&&s.includes('Direct task'),'all unfolded');
  await select(c,'T-10'); await c.input('zM'); await at(c,'E-3');
  await c.waitScreen(s=>!s.includes('Task in progress')&&!s.includes('○ T-6 Unscheduled task')&&s.includes('Unscheduled task'),'all folded with root preview');
  await select(c,'R-1'); await c.input('hzcza');
  await c.waitScreen(s=>s.includes('First epic'),'root stays unfolded');
  assert.ok((await text(c)).includes('First epic'),'root stays open');
});

test('scopes carry breadcrumbs and back restores the originating row and preceding centre view', {skip}, async t => {
  const {c}=await stub(t);
  await c.input('<Esc><Space>g<Esc><Space>e');
  await c.waitScreen(s=>s.includes('First epic'),'release tree');
  await select(c,'E-3'); await c.input('s');
  await c.waitScreen(s=>s.includes('R-1 0.1.2 Working with items › E-3 First epic')&&s.includes('Task in progress'),'epic scope breadcrumbs');
  await at(c,'E-3');
  await c.input('hzcza'); await c.waitScreen(s=>s.includes('Task in progress'),'scope root stays unfolded'); assert.ok((await text(c)).includes('Task in progress'),'scope root stays open');
  await c.input('<Space><Space>'); await at(c,'E-3');
  await c.waitScreen(s=>s.includes('Categories (1)'),'back to release tree');
  await c.input('l'); await c.waitScreen(s=>s.includes('Task in progress'),'expand epic');
  await select(c,'T-17'); await c.input('s'); await at(c,'T-17');
  await c.waitScreen(s=>s.includes('› E-3 First epic')&&!s.includes('Categories (1)'),'leaf scopes to its epic');
  await c.input('<Space><Space>'); await at(c,'T-17');
  await select(c,':direct:R-1'); await c.input('s');
  await c.waitScreen(s=>s.includes('R-1 0.1.2 Working with items › Direct tasks')&&s.includes('T-7 Direct task'),'virtual scope breadcrumbs');
  await c.input('<Space><Space>'); await at(c,':direct:R-1');
  await select(c,':unscheduled'); await c.input('s');
  await c.waitScreen(s=>s.includes('EXPLORER Unscheduled')&&s.includes('Unscheduled task'),'virtual root scope');
  await c.input('<Space><Space>'); await at(c,':unscheduled');
  await c.input('<Space><Space>');
  await c.waitScreen(s=>s.includes('General ·')&&!s.includes('EXPLORER'),'root back to previous centre');
});

test('D hides done items across the tree and A exposes archived roots with scope-only counts', {skip}, async t => {
  const {c}=await stub(t,{...fixture,items:[...fixture.items!,
    {id:'R-30',kind:'release',title:'Archived release',state:'closed',version:'0.0.1',rank:0},
    {id:'T-31',kind:'task',title:'Archived unscheduled task',state:'closed',status:'done'},
    {id:'T-32',kind:'task',title:'Category done task',parent:'C-5',state:'closed',status:'done'},
  ]});
  await c.input('<Esc><Space>e');
  await c.waitScreen(s=>s.includes('done shown · 5 · D'),'folded descendants counted in release');
  await c.input('zR'); await c.waitScreen(s=>s.includes('Category done task'),'all roots unfolded');
  await select(c,'T-16'); await c.input('D'); await at(c,'E-3');
  await c.waitScreen(s=>s.includes('done hidden · 5 · D')&&!s.includes('Closed epic')&&!s.includes('Category done task')&&!s.includes('Task done'),'done hidden globally');
  await c.input('s'); await c.waitScreen(s=>s.includes('done hidden · 4 · D'),'epic count ignores other roots');
  await c.input('<Space><Space>'); await at(c,'E-3');
  await c.input('D'); await c.waitScreen(s=>s.includes('done shown · 5 · D')&&s.includes('Task done'),'done restored');
  await c.input('A'); await c.waitScreen(s=>s.includes('Archived release')&&s.includes('Archived unscheduled task'),'archive roots shown');
  const archived=await text(c);
  assert.ok(archived.indexOf('Future release')<archived.indexOf('Archived release'),'live releases precede archived ones');
  await select(c,'R-30'); await c.input('A'); await at(c,':releases');
  await c.waitScreen(s=>!s.includes('Archived release')&&!s.includes('Archived unscheduled task'),'archive roots hidden');
  await c.input('s'); await c.waitScreen(s=>s.includes('EXPLORER Other releases')&&s.includes('done shown · 0 · D'),'virtual scope done count');
  await c.input('A'); await c.waitScreen(s=>s.includes('Archived release')&&s.includes('done shown · 1 · D'),'archived scope count');
  await c.input('D'); await c.waitScreen(s=>!s.includes('Archived release')&&s.includes('done hidden · 1 · D'),'count independent of done filter');
});

test('invalid explorer preferences reset alone and are reported while other ui.json keys survive', {skip}, async t => {
  const root=await tempProject(t);
  await mkdir(`${root}/.cland`,{recursive:true});
  let c: Client | undefined;
  for(const invalid of [false,[],{folds:{'E-0':true}},{folds:{'E-3':'open'}},{scope:42},{hide_done:'yes'},{archive:1},{card_width:'wide'}]) {
    await writeFile(`${root}/.cland/ui.json`,JSON.stringify({version:2,panels:{left:false,right:'inbox',dock:false},sizes:{right:46},items_filter:'all',explorer:invalid,future_preference:{kept:true}}));
    // One cold load, then the same public disk loader for every invalid input.
    if (!c) ({c}=await stub(t,fixture,root,'explorer',5));
    else await c.lua("local root=...; require('cland.ui').load(root); require('cland.state').changed()",root);
    assert.equal(await c.lua("return require('cland.state').S.ui.right"),'inbox');
    assert.match(String(await c.lua("return require('cland.state').S.flash.text")),/invalid explorer.*defaults/);
    await c.input('<Esc><Space>e'); await c.waitScreen(s=>s.includes('done shown · 5 · D'),'invalid explorer default');
    await c.input('D'); await c.waitScreen(s=>s.includes('done hidden · 5 · D'),'default can change');
    await c.lua("require('cland.ui').changed(); require('cland.ui').flush()");
    const saved=JSON.parse(await readFile(`${root}/.cland/ui.json`,'utf8'));
    assert.deepEqual(saved.explorer,{folds:{},scope:null,hide_done:true,archive:false,card_width:null});
    assert.equal(saved.items_filter,'all'); assert.deepEqual(saved.sizes,{right:46});
    assert.deepEqual(saved.future_preference,{kept:true});
  }
  // Reloading invalid preferences can redraw either card while resetting folds.
  // Observe both detail receipts so their recording is independent of that race.
  assert.ok(c);
  const client = c;
  await client.input('zR');
  for (const id of ['R-1','T-10']) {
    const detail = eventually(`card detail after preference reset: ${id}`, async () =>
      await client.lua<boolean>("local id=...; return (require('cland.item_view').detail[id] or {}).id==id",id) || undefined);
    await select(client,id); await client.input('<CR>h');
    await detail;
    assert.equal(await client.lua("return require('cland.explorer').card.key"),id);
  }
});

test('the explorer registry, key help and status hint advertise every outline action', {skip}, async t => {
  const {c}=await stub(t);
  await c.input('<Esc><Space>e');
  await c.waitScreen(s=>s.includes('l h fold · s scope · ␣␣ back · D done · A archive')&&s.includes('m General · M topic'),'explorer status hint');
  const actions=await c.lua<Array<{id:string;title:string;key:string}>>("local out={}; for _,a in ipairs(require('cland.actions').all()) do if a.id:match('^explorer:') then out[#out+1]={id=a.id,title=a.title,key=a.key} end end; return out");
  assert.deepEqual(actions.map(a=>a.id).sort(),['<CR>','j','k','l','h','za','zo','zc','zR','zM','s','D','A','zb','m','M'].map(k=>`explorer:${k}`).sort());
  for(const action of actions) { assert.ok(action.title.length>0); assert.ok(action.key.endsWith('in explorer')); }
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"),[]);
  await c.input('<Space>?');
  const screen=await c.waitScreen(s=>s.includes('zR zM all')&&s.includes('za/zo/zc')&&s.includes('D done · A archive'),'explorer keys in help');
  assert.ok(screen.includes('Open explorer'));
  assert.ok(screen.includes('m General · M item topic (creates if absent)'));
  assert.ok(screen.includes('V selection: m/M General with item context'));
  assert.ok(screen.includes('S-↵ newline · Esc/q close, keep draft'));
});

test('release rows, derived glyphs, rank then close order, folded roots and za cursor identity', {skip}, releaseRowsAndCursorIdentity);

test('a release with no epics derives from direct tasks and the virtual roots unfold to plain rows', {skip}, async t => {
  const {c}=await stub(t,{items:[
    {id:'R-1',kind:'release',title:'Direct release',state:'open'},
    {id:'T-2',kind:'task',title:'Reviewing direct task',parent:'R-1',state:'open',status:'review'},
    {id:'C-3',kind:'category',title:'Ideas',state:'open'},
    {id:'T-4',kind:'task',title:'Unscheduled task',state:'open',status:'backlog'},
    {id:'Q-5',kind:'question',title:'Unscheduled question',state:'open'},
  ]});
  await c.input('<Esc><Space>e');
  await c.waitScreen(s=>s.includes('◐ R-1 Direct release')&&s.includes('Direct tasks (1)'), 'direct-only release');
  assert.ok(!(await text(c)).includes('Reviewing direct task'));
  await select(c,':direct:R-1'); await c.input('za');
  await c.waitScreen(s=>s.includes('Reviewing direct task'),'direct tasks unfolded');
  await select(c,':categories'); await c.input('za');
  await c.waitScreen(s=>s.includes('C-3 Ideas'),'open category rows');
  await select(c,':unscheduled'); await c.input('za');
  await c.waitScreen(s=>s.includes('T-4 Unscheduled task')&&s.includes('○ Q-5 Unscheduled question'),'unscheduled rows');
  await c.input('jk');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"),[]);
});

test('an epic-only ladder shows no open release and lists its root epic as unscheduled', {skip}, async t => {
  const {c}=await stub(t,{items:[{id:'E-1',kind:'epic',title:'Root epic',state:'open'}],tracker:{levels:['epic']}});
  await c.input('<Esc><Space>e');
  await c.waitScreen(s=>s.includes('no open release')&&s.includes('Unscheduled (1)'), 'empty answered snapshot');
  assert.ok(!(await text(c)).includes('loading the items'));
});

test('loading is distinct from an answered empty list', {skip}, async t => {
  const {c,control}=await stub(t,{items:[],holdSnapshots:['task.list']});
  await control({waitSnapshot:'task.list'});
  await c.input('<Esc><Space>e');
  await c.waitScreen(s=>s.includes('loading the items…'),'unanswered item snapshot');
  await control({releaseSnapshots:['task.list']});
  await c.waitScreen(s=>s.includes('no open release')&&!s.includes('loading the items…'),'answered empty snapshot');
});

test('configured root kinds keep release rows, epics and direct tasks in the outline', {skip}, async t => {
  const {c}=await stub(t,{tracker:{levels:['initiative','epic']},items:[
    {id:'I-1',kind:'initiative',title:'Configured release',version:'0.3.0',state:'open'},
    {id:'E-2',kind:'epic',title:'Configured epic',parent:'I-1',state:'open'},
    {id:'T-3',kind:'task',title:'Epic task',parent:'E-2',state:'open',status:'planned'},
    {id:'T-4',kind:'task',title:'Direct task',parent:'I-1',state:'open',status:'review'},
    {id:'I-5',kind:'initiative',title:'Future configured release',version:'0.4.0',state:'open'},
  ]});
  await c.input('<Esc><Space>e');
  await c.waitScreen(s=>s.includes('○ I-1 0.3.0 Configured release')&&s.includes('E-2 Configured epic')&&s.includes('Direct tasks (1)')&&s.includes('Other releases (1)'),'configured root outline');
  assert.ok((await text(c)).includes('tasks 0/2'));
  assert.ok(!(await text(c)).includes('no open release'));
  await select(c,':direct:I-1'); await c.input('za');
  await c.waitScreen(s=>s.includes('T-4 Direct task'),'configured direct task');
});

test('the root winbar counts done nodes only under its named release', {skip}, async t => {
  const {c}=await stub(t,{items:[
    {id:'R-1',kind:'release',title:'Current release',version:'0.1.0',state:'open'},
    {id:'T-2',kind:'task',title:'Release done',parent:'R-1',status:'done',state:'closed',closed:'2025-12-01T00:00:00Z'},
    {id:'C-3',kind:'category',title:'Ideas',state:'open'},
    {id:'T-4',kind:'task',title:'Category done',parent:'C-3',status:'done',state:'closed',closed:'2025-12-01T00:00:00Z'},
    {id:'R-5',kind:'release',title:'Future release',version:'0.2.0',state:'open'},
    {id:'T-6',kind:'task',title:'Future done',parent:'R-5',status:'done',state:'closed',closed:'2025-12-01T00:00:00Z'},
  ]});
  await c.input('<Esc><Space>e');
  await c.waitScreen(s=>s.includes('EXPLORER R-1')&&s.includes('done shown · 1 · D'),'release-only done count');
  await c.input(':Cland explorer C-3<CR>');
  await c.waitScreen(s=>s.includes('EXPLORER C-3')&&s.includes('done shown · 1 · D'),'scoped category count');
});

test('live removal restores the next key, then the previous key, and keeps the card on the cursor', {skip}, async t => {
  const {c,control}=await stub(t);
  await c.input('<Esc>:Cland explorer E-3<CR>');
  await c.waitScreen(s=>s.includes('Task planned'),'scoped tasks');
  await select(c,'T-14'); await c.input('<CR>h');
  await c.waitScreen(s=>s.includes('CARD') && s.includes('T-14 · task'),'card on selected item');
  await control({emit:{type:'task',id:'T-14'}});
  await at(c,'T-15');
  await c.lua("assert(vim.wait(5000,function() return require('cland.explorer').card.key=='T-15' end))");
  await select(c,'T-20');
  await control({emit:{type:'task',id:'T-20'}});
  await at(c,'T-16');
});

test('status and stage changes move a row while its cursor and cached card keep the item', {skip}, async t => {
  const {c,control}=await stub(t);
  await c.input(':Cland explorer E-3<CR>');
  await c.waitScreen(s=>s.includes('Task planned'),'scoped stage rows');
  await select(c,'T-14'); await c.input('<CR>h');
  await c.lua("assert(vim.wait(5000,function() return require('cland.item_view').detail['T-14'] ~= nil end))");
  const movedStages=stages.map((s,i)=>({...s,items:i===0?s.items.filter(id=>id!=='T-14'):[...s.items,'T-14']}));
  const changed=fixture.items!.map(it=>it.id==='T-14'?{...it,status:'in progress',updated:'2026-10-14T09:30:00Z'}:it.id==='E-3'?{...it,stages:movedStages,updated:'2026-10-14T09:30:00Z'}:it);
  await control({set:{items:changed}});
  await control({emits:changed.filter(it=>it.id==='T-14'||it.id==='E-3').map(item=>({type:'task',id:item.id,item}))});
  await c.lua("assert(vim.wait(5000,function() local e=require('cland.explorer'); local t=table.concat(e.lines,'\\n'); return t:find('S2 the card',1,true)<t:find('Task planned',1,true) end))");
  assert.equal(await cursor(c),'T-14');
  assert.equal(await c.lua("return require('cland.explorer').card.key"),'T-14');
  await c.lua("assert(vim.wait(5000,function() return require('cland.item_view').detail['T-14'].seen=='2026-10-14T09:30:00Z' end))");
  const requests=(await control({requests:true})).requests.filter(r=>r.type==='task.view'&&r.item==='T-14').length;
  const renders=await c.lua<number>("return require('cland.explorer').renders");
  await control({emit:{type:'task',id:'T-14',item:changed.find(it=>it.id==='T-14')}});
  await c.lua("local n=...; assert(vim.wait(5000,function() return require('cland.explorer').renders>n end))",renders);
  assert.equal((await control({requests:true})).requests.filter(r=>r.type==='task.view'&&r.item==='T-14').length,requests,'same updated does not refetch task.view');
  await c.input('<Space><Space>');
  await c.waitScreen(s=>s.includes('EXPLORER R-1'),'scope history returns to root');
  const reparented={...changed.find(it=>it.id==='T-14')!,parent:'E-2',updated:'2026-10-14T09:31:00Z'};
  // Reveal the original task under E-3, while its future parent E-2 stays folded.
  await c.input(':Cland explorer R-1<CR>');
  await select(c,'E-3'); await c.input('l');
  await c.waitScreen(s=>s.includes('Task planned'),'task visible before reparenting');
  await select(c,'T-14');
  await control({emit:{type:'task',id:'T-14',item:reparented}});
  await at(c,'E-2');
  await c.lua("assert(vim.wait(5000,function() return require('cland.explorer').card.key=='E-2' end))");
});

test('a folded burst rebuilds once without writes; visible counts write once; hidden trees do no work', {skip}, async t => {
  const closed=Array.from({length:20},(_,i)=>({id:`T-${100+i}`,kind:'task',title:'Folded closed task',parent:'E-4',state:'closed',status:'done'}));
  const {c,control}=await stub(t,{...fixture,items:[...fixture.items!,...closed]});
  await c.lua("require('cland').load_closed_items('E-4');assert(vim.wait(5000,function() return require('cland.state').S.closed_pages['E-4'] end))");
  await select(c,'E-2'); await c.input('<CR>h');
  await c.lua("assert(vim.wait(5000,function() return require('cland.explorer').card.drawn_key=='E-2' and not next(require('cland.item_view').pending) and not next(require('cland.plan').pending) end))");
  const counts=()=>c.lua<number[]>("local e=require('cland.explorer');return {e.renders,e.writes,e.card.writes}");
  const before=await counts();
  await control({emits:closed.map(it=>({type:'task',id:it.id,item:{...it,title:'Changed hidden title',updated:'batch'}}))});
  await c.lua("local n=...;assert(vim.wait(5000,function() local e=require('cland.explorer');return require('cland.state').item('T-119').updated=='batch' and e.renders>n end))",before[0]);
  const after=await counts();
  assert.equal(after[0],before[0]!+1,'one coalesced render per burst');
  assert.deepEqual(after.slice(1),before.slice(1),'no tree or card write after the state barrier');
  await control({emit:{type:'task',id:'T-119',item:{...closed[19],status:'review',state:'open',updated:'count'}}});
  await c.lua("local n=...;assert(vim.wait(5000,function() return require('cland.explorer').renders>n end))",after[0]);
  assert.equal((await counts())[1],after[1]!+1,'a changed visible count writes exactly once');
  await c.input('<Space>g');
  await c.waitScreen(s=>s.includes('General')&&!s.includes('EXPLORER'),'hidden explorer');
  const hidden=await counts();
  await control({emit:{type:'crew',config:{idle_from:[]},summary:'changed while hidden'}});
  await c.lua("assert(vim.wait(5000,function() return require('cland.state').S.crew.summary=='changed while hidden' end)); local done=false;require('cland.state').on_change(function() done=true end);require('cland.state').changed();assert(vim.wait(5000,function() return done end))");
  assert.deepEqual(await counts(),hidden,'a hidden explorer does not rebuild');
  await c.lua("require('cland.layout').show_split_view({kind='explorer',id='E-2'})");
  await c.waitScreen(s=>s.includes('Planned epic task'),'explorer visible in a split');
  const split=await counts();
  await control({emit:{type:'task',id:'T-22',item:{...fixture.items!.find(it=>it.id==='T-22'),title:'Changed split task'}}});
  await c.waitScreen(s=>s.includes('Changed split task'),'live split task');
  assert.ok((await counts())[0]!>split[0]!);
});

function benchFixture(): Scenario {
  const statuses=['backlog','planned','in progress','review','qa','ready','done'];
  const tasks=Array.from({length:260},(_,i)=>({id:`T-${100+i}`,kind:'task',title:`Benchmark task ${i}`,parent:`E-${2+Math.floor(i/26)}`,rank:i,status:statuses[i%7],state:i%7===6?'closed':'open',updated:'2026-10-14T00:00:00Z'}));
  return {items:[
    {id:'R-1',kind:'release',title:'Benchmark release',version:'0.1.2',state:'open'},
    ...Array.from({length:10},(_,i)=>{
      const ids=tasks.filter(t=>t.parent===`E-${2+i}`).map(t=>t.id);
      const stages=[{name:'build',state:'open',items:ids.slice(0,13)},{name:'finish',state:'open',items:ids.slice(13)}];
      return {id:`E-${2+i}`,kind:'epic',title:`Benchmark epic ${i}`,parent:'R-1',state:'open',rank:i,stages,plan:{stages:stages.map(s=>({name:s.name,qa:{scope:'none',when:'after-stage'},lanes:[s.items]}))}};
    }),
    ...tasks,
    ...Array.from({length:4},(_,i)=>({id:`C-${400+i}`,kind:'category',title:['Bugs','Tech debt','Follow-ups','Ideas'][i],state:'open'})),
    ...Array.from({length:7},(_,i)=>({id:`T-${410+i}`,kind:'task',title:`Category task ${i}`,parent:`C-${400+i%4}`,state:'open',status:'backlog'})),
    {id:'M-420',kind:'map',title:'Future work',state:'open'},
    ...Array.from({length:15},(_,i)=>({id:`T-${430+i}`,kind:'task',title:`Unscheduled ${i}`,status:'backlog',state:'open'})),
    ...Array.from({length:2},(_,i)=>({id:`R-${450+i}`,kind:'release',title:`Closed release ${i}`,version:`0.0.${i}`,state:'closed',closed:'2025-12-01T00:00:00Z'})),
  ]};
}

test('bench reports build and buffer medians for 300 items fully unfolded and restores the human view', {skip}, async t => {
  const scenario=benchFixture(); assert.equal(scenario.items!.length,300);
  const {c}=await stub(t,scenario,undefined,'explorer',5);
  await c.input('zR');
  await c.waitScreen(s=>s.includes('Benchmark task 0'),'all epic plans unfolded');
  await c.lua("assert(vim.wait(5000,function() return vim.tbl_count(require('cland.plan').detail)==10 and not next(require('cland.plan').pending) end))");
  await select(c,'T-100'); await c.input('<CR>h');
  await c.lua("assert(vim.wait(5000,function() return require('cland.item_view').detail['T-100'] ~= nil end))");
  const before=await c.lua("return vim.deepcopy(require('cland.explorer').ui())");
  const results=await c.lua<Array<{label:string;rows:number;model_ms:number;draw_ms:number}>>("return require('cland.explorer').bench(3,'T-100')");
  t.diagnostic(`300-item bench (ms): ${JSON.stringify(results)}`);
  assert.equal(results.length,3);
  assert.ok(results[1]!.rows>300,'fully unfolded includes every item and the stage labels');
  assert.ok(results[1]!.model_ms<75,`loose CI build bound: ${results[1]!.model_ms} ms; QA checks 15 ms on dev`);
  for(const result of results) assert.ok(result.model_ms>0 && result.draw_ms>0);
  assert.deepEqual(await c.lua("return require('cland.explorer').ui()"),before);
  assert.equal(await cursor(c),'T-100');
  assert.equal(await c.lua("return require('cland.explorer').card.key"),'T-100');
});

test('cold startup shows loading then selects the release without entering the composer', {skip}, async t => {
  const {c,control}=await stub(t,{...fixture,holdSnapshots:['task.list']});
  await control({waitSnapshot:'task.list'});
  await c.waitScreen(s=>s.includes('EXPLORER')&&s.includes('loading the items…'),'startup explorer loading');
  assert.equal(await c.mode(),'n');
  await control({releaseSnapshots:['task.list']});
  await c.waitScreen(s=>s.includes('EXPLORER R-1')&&s.includes('Explorer · R-1'),'startup bars name explorer');
  await at(c,'R-1');
  assert.equal(await c.lua("return vim.b.cland_role"),'explorer');
});

// T2: the card's real split geometry, recorded hub frames, and saved side preferences.
test('explorer card replaces any right occupant on a narrow screen and restores it on widening', {skip}, async t => {
  const {c}=await stub(t,fixture,undefined,'general');
  const rightRole=()=>c.lua<string>(`local l=require('cland.layout'); local w=l.win.right
    return w and vim.api.nvim_win_is_valid(w) and vim.b[vim.api.nvim_win_get_buf(w)].cland_role or ''`);
  for (const kind of ['items','inbox','sessions','topics']) {
    await c.input(`<Esc>:Cland view board<CR>:Cland panel ${kind === 'sessions' ? 'inbox' : 'sessions'} left<CR>:Cland panel ${kind} right<CR>`);
    const homes=await c.lua("return require('cland.state').S.ui.panel_homes");
    await c.input(':Cland explorer<CR>');
    await c.waitScreen(s=>s.includes('Explorer') && s.includes('CARD'),'explorer card drawn');
    await eventually('right occupant covered by card',async()=>await c.lua(`local e=require('cland.explorer');local l=require('cland.layout')
      return e.card.over_right and e.card.win and vim.api.nvim_win_is_valid(e.card.win) and not l.win.right`) || undefined);
    assert.equal(await rightRole(),'');
    assert.deepEqual(await c.lua("return require('cland.state').S.ui.panel_homes"),homes);
    assert.equal(await c.lua("return require('cland.state').S.ui.right"),kind);
    await c.rpc.request('nvim_ui_try_resize',320,50);
    await eventually('right occupant restored beside card',async()=>await rightRole()===kind || undefined);
    await c.waitScreen(s=>s.includes('CARD') && s.includes(kind.toUpperCase()),'restored panel and card painted');
    assert.equal(await rightRole(),kind);
    assert.deepEqual(await c.lua("return require('cland.state').S.ui.panel_homes"),homes);
    assert.equal(await c.lua("return require('cland.state').S.ui.right"),kind);
    await c.rpc.request('nvim_ui_try_resize',200,50);
    await eventually('card covers right again',async()=>await c.lua("return require('cland.explorer').card.over_right and not require('cland.layout').win.right") || undefined);
    assert.equal(await rightRole(),'');
    await c.input(':Cland view board<CR>');
    await eventually('leaving explorer restores right occupant',async()=>await rightRole()===kind || undefined);
    await c.waitScreen(s=>s.includes('BOARD') && s.includes(kind.toUpperCase()),'restored panel beside board painted');
    assert.equal(await rightRole(),kind);
    assert.deepEqual(await c.lua("return require('cland.state').S.ui.panel_homes"),homes);
  }
});


test('startup accumulates open summary pages before installing the explorer', {skip}, async t => {
  const items = [
    {id:'R-1',kind:'release',title:'Paged release',state:'open',version:'0.3.0'},
    ...Array.from({length:205},(_,n)=>({id:`T-${n+2}`,kind:'task',title:`Paged child ${n}`,state:'open',parent:'R-1'})),
  ];
  const {c,control} = await stub(t,{...fixture,summaryLists:true,pagedLists:true,items,holdSnapshots:['task.list']});
  await control({waitSnapshot:'task.list'});
  await control({releaseSnapshots:['task.list'],snapshotOrder:'oldest',snapshotLimit:1});
  await control({waitSnapshot:'task.list'});
  assert.equal(await c.lua("return require('cland.state').S.items_loaded"),false);
  await control({emits:[{type:'task',id:'T-2',item:{...items[1],state:'closed'}}]});
  await control({set:{holdSnapshots:[]},releaseSnapshots:['task.list']});
  await eventually('all paged summaries installed',async()=>await c.lua<number>("return #require('cland.state').S.items")===205 || undefined);
  const frames = (await control({requests:true})).requests.filter(r=>r.type==='task.list');
  assert.deepEqual(frames.map(r=>Reflect.get(r,'cursor')??null),[null,'T-100','T-200']);
  assert.ok(frames.every(r=>Reflect.get(r,'paged')===true));
  const ids = await c.lua<string[]>("local ids={};for _,it in ipairs(require('cland.state').S.items) do ids[#ids+1]=it.id end;return ids");
  assert.deepEqual(ids.toSorted(),items.filter(row=>row.id!=='T-2').map(row=>row.id).toSorted());
  await c.waitScreen(s=>s.includes('Paged release'),'paged explorer first paint');
});


for (const boundary of ['page events','page bytes','aggregate events','aggregate bytes']) {
  test(`startup restarts the complete traversal after ${boundary} overflow`, {skip}, async t => {
    const items = [
      {id:'R-1',kind:'release',title:'Bounded traversal',state:'open',version:'0.3.0'},
      ...Array.from({length:6},(_,n)=>({id:`T-${n+2}`,kind:'task',title:`Bounded child ${n}`,state:'open',parent:'R-1'})),
    ];
    const {c,control} = await stub(t,{...fixture,summaryLists:true,pagedLists:true,itemPageSize:2,items,holdSnapshots:['task.list']});
    await control({waitSnapshot:'task.list'});
    const aggregate = boundary.startsWith('aggregate');
    await c.lua(`
      local hub, cland = require('cland.hub'), require('cland')
      hub.SNAPSHOT_TIMEOUT_MS = 30000
      hub.SNAPSHOT_MAX_EVENTS = ${boundary==='page events'?1:10}
      hub.SNAPSHOT_MAX_BYTES = ${boundary==='page bytes'?512:2097152}
      cland.ITEMS_MAX_EVENTS = ${boundary==='aggregate events'?1:2048}
      cland.ITEMS_MAX_BYTES = ${boundary==='aggregate bytes'?2000:2097152}
    `);
    const changed = {...items[1],title:'Fresh earlier-page row',body:'x'.repeat(boundary.endsWith('bytes')?1100:0)};
    if (aggregate) await control({emits:[{type:'task',id:'T-2',item:changed}]});
    await control({releaseSnapshots:['task.list'],snapshotOrder:'oldest',snapshotLimit:1});
    await control({waitSnapshot:'task.list'});
    const latest = {...changed,title:'Final earlier-page row'};
    const replacement = items.map(row=>row.id==='T-2'?latest:row);
    const events: Array<Record<string,unknown>> = [{type:'task',id:'T-2',item:latest}];
    if (boundary==='page events') events.push({type:'task',id:'T-3',item:items[2]});
    const nextRead = eventually('replacement item snapshot received',async()=>{
      const frames = (await control({requests:true})).requests.filter(row=>row.type==='task.list');
      return frames.length>=3?frames:undefined;
    });
    await control({set:{items:replacement},emits:events});
    if (aggregate) await control({releaseSnapshots:['task.list'],snapshotOrder:'oldest',snapshotLimit:1});
    const frames = await nextRead;
    assert.equal(Reflect.get(frames[2]!,'cursor'),undefined,'invalid traversal restarts from its first page');
    assert.equal(await c.lua("return require('cland.state').S.items_loaded"),false);
    await control({set:{holdSnapshots:[]},releaseSnapshots:['task.list']});
    await eventually('fresh traversal installed',async()=>await c.lua<boolean>("local s=require('cland.state'); return s.S.items_loaded and s.item('T-2').title=='Final earlier-page row'") || undefined);
    const ids = await c.lua<string[]>("local ids={};for _,it in ipairs(require('cland.state').S.items) do ids[#ids+1]=it.id end;return ids");
    assert.deepEqual(ids.toSorted(),items.map(row=>row.id).toSorted());
    assert.equal(await c.lua("return vim.tbl_count(require('cland').client.snapshots)"),0);
    await c.waitScreen(s=>s.includes('Bounded traversal'),'complete bounded explorer');
  });
}


test('late first and later pages complete after multiple retry rounds with bounded coherent journals', {skip}, async t => {
  const items = [
    {id:'R-1',kind:'release',title:'Late healthy pages',state:'open',version:'0.3.0'},
    ...Array.from({length:4},(_,n)=>({id:`T-${n+2}`,kind:'task',title:`Late child ${n}`,state:'open',parent:'R-1'})),
  ];
  const {c,control} = await stub(t,{...fixture,summaryLists:true,pagedLists:true,itemPageSize:2,items});
  const initial = (await control({requests:true})).requests.filter(row=>row.type==='task.list').length;
  const marker={id:'T-6',kind:'task',title:'Installed final-page receipt',state:'open',parent:'R-1'};
  const refreshed=[...items,marker];
  await control({set:{holdSnapshots:['task.list'],items:refreshed}});
  await c.lua("local h=require('cland.hub');h.SNAPSHOT_TIMEOUT_MS=50;h.SNAPSHOT_MAX_RETRY_MS=100;require('cland').refresh()");
  const changed = {...items[1],title:'First page replay survives retries'};
  await control({waitSnapshot:'task.list'});
  await control({set:{items:refreshed.map(row=>row.id==='T-2'?changed:row)},emits:[{type:'task',id:'T-2',item:changed}]});
  const first = await eventually('multiple first-page retry receipts',async()=>{
    const frames=(await control({requests:true})).requests.filter(row=>row.type==='task.list').slice(initial);
    return frames.length>=3?frames:undefined;
  });
  assert.ok(first.every(row=>Reflect.get(row,'cursor')===undefined),'retry keeps the same page');
  assert.equal(await c.lua<boolean>("local id=...;return require('cland').client.pending[id]~=nil",Reflect.get(first[0]!,'id')),true,'original late answer remains eligible');
  const bounds = (expectedEvents=1) => c.lua<boolean>(`
    local c=require('cland').client;local count=0;local recordings={}
    for j in pairs(c.snapshots) do
      if j.request.type=='task.list' then
        count=count+1;local recorded=j.capture or j;recordings[recorded]=true
        assert(#recorded.events==${expectedEvents})
        assert(recorded.bytes<=require('cland.hub').SNAPSHOT_MAX_BYTES)
        assert(c.pending[j.id]~=nil)
      end
    end
    return count<=2 and vim.tbl_count(recordings)==1
  `);
  assert.equal(await bounds(),true);
  await control({releaseSnapshots:['task.list'],snapshotCursor:null,snapshotOrder:'oldest',snapshotLimit:1});
  await eventually('later page receipt',async()=>{
    const frames=(await control({requests:true})).requests.filter(row=>row.type==='task.list').slice(initial);
    return frames.some(row=>Reflect.get(row,'cursor')==='T-2') || undefined;
  });
  const latest = {...changed,title:'Earlier row survives later page retries'};
  await control({set:{items:refreshed.map(row=>row.id==='T-2'?latest:row)},emits:[{type:'task',id:'T-2',item:latest}]});
  await eventually('multiple later-page retry receipts',async()=>{
    const frames=(await control({requests:true})).requests.filter(row=>row.type==='task.list').slice(initial).filter(row=>Reflect.get(row,'cursor')==='T-2');
    return frames.length>=3?frames:undefined;
  });
  await control({emits:[{type:'task',id:'T-2',item:latest}]});
  assert.equal(await bounds(2),true,'one capture per input even with two active attempts');
  // Release the original, late answer; it must remain valid across every retry.
  await control({releaseSnapshots:['task.list'],snapshotCursor:'T-2',snapshotOrder:'oldest',snapshotLimit:1});
  await eventually('final page held for completion-boundary control',async()=>{
    const frames=(await control({requests:true})).requests.filter(row=>row.type==='task.list').slice(initial);
    return frames.some(row=>Reflect.get(row,'cursor')==='T-4') || undefined;
  });
  assert.equal(await c.lua("return require('cland.state').item('T-6')~=nil"),false,'final-page marker has no live event');
  const installed=eventually('late paged traversal installed',async()=>await c.lua<boolean>("local s=require('cland.state');return s.S.items_loaded and s.item('T-6')~=nil and s.item('T-2').title=='Earlier row survives later page retries'") || undefined);
  await control({releaseSnapshots:['task.list'],snapshotCursor:'T-4',snapshotOrder:'oldest',snapshotLimit:1,set:{holdSnapshots:[]}});
  await installed;
  await control({releaseSnapshots:['task.list']});
  const ids=await c.lua<string[]>("local ids={};for _,it in ipairs(require('cland.state').S.items) do ids[#ids+1]=it.id end;return ids");
  assert.deepEqual(ids.toSorted(),refreshed.map(row=>row.id).toSorted());
  assert.equal(await c.lua("return vim.tbl_count(require('cland').client.snapshots)"),0);
  await c.waitScreen(s=>s.includes('Late healthy pages'),'late healthy explorer installed');
});
