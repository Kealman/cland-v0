// Shared differential oracle: ordinary T2 and extended T4 use identical fixtures and assertions.
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';
import { startClient } from './stub-client.ts';
import { tempProject } from './fixture.ts';
import { waitInitialSnapshots } from './readiness.ts';
import type { Scenario } from './stub-hub.ts';
import type { threadSeedPlan } from './thread-seed-plan.ts';

const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
const ts = '2026-10-09T10:00:00.000Z';
const msg = (id: string, role = 'coordinator', text = 'Taking T-58.') => ({
  id, from: role === 'human' ? 'human' : role, fromKind: role === 'human' ? 'human' : 'agent',
  fromRole: role === 'human' ? null : role, to: role === 'human' ? ['coordinator'] : ['human'],
  text, ts, topic: 'general', stage: role === 'human' ? 'queued' : null,
});

// The first history is held while the oracle installs its retained-window fixture.
async function start(t: TestContext, bin: string, scenario: Scenario) {
  const root = await tempProject(t, 'cland-thread-');
  await mkdir(join(root, '.git'));
  const controlPath = join(root, 'stub.sock');
  const c = await startClient(t, bin, root, {
    TZ: 'UTC', CLAND_STUB_NOW: ts, CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]),
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: {}, ...scenario }), CLAND_STUB_CONTROL: controlPath,
  });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await waitInitialSnapshots(c);
  return Object.assign(c, { control: (cmd: Record<string, unknown>) => new Promise<Record<string, unknown>>((resolve, reject) => {
    const sock = createConnection(controlPath);
    let text = '';
    sock.setEncoding('utf8');
    sock.on('error', reject);
    sock.on('data', chunk => { text += chunk; if (text.includes('\n')) { sock.end(); resolve(JSON.parse(text.slice(0, text.indexOf('\n')))); } });
    sock.write(`${JSON.stringify(cmd)}\n`);
  }) });
}

export async function runThreadOracle(t: TestContext, bin: string, plan: ReturnType<typeof threadSeedPlan>): Promise<void> {
  // A public Neovim snapshot includes the virtual decorations and row gutters, not extmark ids.
  const snapshot = `
    local t=...
    local marks={}
    for _,m in ipairs(vim.api.nvim_buf_get_extmarks(t.buf,vim.api.nvim_get_namespaces()['cland.thread'],0,-1,{details=true})) do
      marks[#marks+1]={row=m[2],col=m[3],details=m[4]}
    end
    local groups={}
    for _,i in ipairs(t.info) do groups[#groups+1]={group=i.group,header=i.head and i.head.id,ask=i.ask and i.ask.id,artifact=i.artifact and i.artifact.id,links=i.links,layer=i.b and i.b.layer} end
    local folds=vim.api.nvim_win_call(require('cland.layout').centre(),function()
      local out={}
      for _,run in ipairs(t:_runs()) do
        local first,last=run.first.start+2,run.last.start+run.last.n
        local ids={}; for _,m in ipairs(run.messages) do ids[#ids+1]=m.id end
        out[#out+1]={first=first,last=last,ids=ids,open=vim.fn.foldclosed(first)==-1}
      end
      return out
    end)
    return {lines=vim.api.nvim_buf_get_lines(t.buf,0,-1,false),marks=marks,groups=groups,folds=folds}
  `;
  // Differential equality depends on crossing the retained-window boundary,
  // not its production size. Nearby tests independently assert the 200 default.
  const limit = 48;
  t.diagnostic(`thread oracle: ${plan.seeds.length} seeds x ${plan.renders} renders`);
  let client: Awaited<ReturnType<typeof start>> | undefined;
  for (const seed of plan.seeds) {
    const messages: Array<Record<string, unknown>> = [];
    let number = 0;
    let corpus: string[] = [];
    for (let day = 8; day <= 10; day++) {
      // Several early asks ensure unanswered and answered cards both cross the eviction boundary.
      for (let i = 0; i < 3; i++) {
        const id = `ask-${seed}-${day}-${i}`;
        const answered = (seed + i) % 2 === 0;
        messages.push({ ...msg(id), ts: `2026-10-${day.toString().padStart(2, '0')}T10:00:00Z`, ask: { state: answered ? 'answered' : 'closed', options: ['choice'], free: true, option: answered ? 1 : null } });
        messages.push({ ...msg(`chip-${id}`), ts: `2026-10-${day.toString().padStart(2, '0')}T10:00:00Z`, to: [], artifact: { id: `A-${seed}-${day}-${i}`, kind: 'note', title: 'Ask evidence' } });
        if (answered) messages.push({ ...msg(`answer-${id}`, 'human', `Answer ${id}\nkept body`), ts: `2026-10-${(day + 1).toString().padStart(2, '0')}T09:00:00Z`, answerTo: id });
      }
      const bodies = ['Body **T-58**\n[brief](https://example.com/long/destination)', 'Body `history`\n- list text', 'Body fenced\n```lua\nprint(1)\n```', 'Body unclosed\n```sh\nnot a later message', 'Body table\n\n| Item | Description |\n|---|---|\n| T-58 | ' + 'detail '.repeat(10) + '|', 'Body multiline [the\nbrief](https://example.com/multiline)', 'Body references [brief][ref] and [ref][]\n\n[ref]: https://example.com/reference', 'Body header-only\n\n| ' + 'wide '.repeat(20) + '| **State** |\n|---|---|', 'Body duplicates [a]\n\n[a]: /first\n[a]: /second', 'Body autolinks <https://example.com> <a@example.com>', 'Body sparse\n\n| First | [Second](https://example.com/second) |\n|---|---|\n| short |\n| ' + 'long '.repeat(16) + '| present |', 'Body surplus\n\n| First | [Second](https://example.com/second) |\n|---|---|\n| short | [extra](https://example.com/extra) | [surplus](https://example.com/surplus) |\n| ' + 'long '.repeat(16) + '| present | tail |', 'Body linked headers\n\n| [Item](https://example.com/' + 'long/'.repeat(15) + ') | **State** |\n|---|---|\n| T-58 | open |'];
      if (day === 9) corpus = [...bodies.slice(1), 'qa clear T-58\nDetails omitted from compact clear verdict.', 'qa not clear T-58\nC3 failed: preserve this note.'];
      // The middle-day rich corpus stays in every retained window. The
      // other messages establish day/fold/eviction boundaries; short bodies
      // avoid repeatedly exercising the same Markdown input at those positions.
      // Include slot 13 as well: it carries the failed QA verdict after the
      // clear verdict in slot zero, while all sender/kind variants remain.
      for (let i = 0; i < bodies.length + 1; i++) messages.push({ ...msg(`generated-${seed}-${number++}`, i % 13 === 0 ? 'qa' : i % 3 === 0 ? 'human' : 'implementer', i % 13 === 0 ? (i % 2 ? 'qa not clear T-58\nC3 failed: preserve this note.' : 'qa clear T-58\nDetails omitted from compact clear verdict.') : day === 9 && i < bodies.length ? bodies[i] : 'Body'), kind: ['report', 'question', 'decision', 'progress'][i % 4], to: [i % 3 === 0 ? 'coordinator' : 'reviewer'], ts: `2026-10-${day.toString().padStart(2, '0')}T11:00:00Z` });
    }
    // Cover a full window and oversized snapshots requiring initial trimming.
    messages.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    const initial = messages.slice(0, seed === 1 ? limit : limit + seed);
    if (!client) {
      client = await start(t, bin, { holdSnapshots: ['topic.history'], messages: { general: initial } });
      await client.control({ waitSnapshot: 'topic.history' });
      await client.lua(`
        assert(require('cland.thread').LIMIT==200,'production retained window defaults to 200')
        require('cland.thread').LIMIT=...
        vim.o.columns=80
      `, limit);
      await client.control({ releaseSnapshots: ['topic.history'] });
      await client.waitScreen(s => s.includes('Body'), 'generated history');
      // Subsequent assertions inspect real buffer/mark/fold data, not pixels.
      await client.rpc.request('nvim_ui_detach');
    } else {
      // Reuse the process, retaining fresh thread state and the production
      // history projection (including message layers) for every seed.
      await client.control({ set: { holdSnapshots: [], messages: { general: initial } } });
      await client.lua(`
        local columns,count=...
        vim.o.columns=columns
        local view=require('cland.views').topic('general')
        local old=view.thread
        vim.api.nvim_buf_set_name(old.buf,'cland://topic/previous')
        view.thread=require('cland.thread').new(old.topic)
        vim.api.nvim_win_set_buf(require('cland.layout').centre(),view.thread.buf)
        vim.api.nvim_buf_delete(old.buf,{force=true})
        local ready,failure=false,nil
        require('cland').client:snapshot({type='topic.history',topic='general',limit=count},function(err,value)
          failure=err
          if not err then view.thread:merge(value.messages) end
          ready=true
        end)
        assert(vim.wait(5000,function() return ready end,1),'seed history has not landed')
        assert(not failure,tostring(failure))
      `, seed % 2 ? 80 : 120, initial.length);
    }
    const c = client;
    // Client/frame seam: this handler follows the thread's synchronous
    // delivery handler, so the last frame acknowledges the entire render burst.
    await c.lua(`
      require('cland').client:on('delivery',function(event)
        if event.topic=='general' and event.message==_G.oracle_boundary and event.stage=='queued' then
          _G.oracle_delivered=true
        end
      end)
    `);
    const compare = async (label: string) => {
      await c.lua(`
        local label,corpus,limit=...
        local retained={}
        for _,message in ipairs(require('cland.views').topic('general').thread.messages) do retained[message.text]=true end
        for _,body in ipairs(corpus) do assert(retained[body],label..': Markdown corpus left retained window') end
        local snapshot=function(...) ${snapshot} end
        local t=require('cland.views').topic('general').thread
        assert(#t.messages==limit,label..': retained window is full')
        local win=require('cland.layout').centre()
        local incremental=snapshot(t)
        local opened,closed=false,false
        for _,fold in ipairs(incremental.folds) do
          opened=opened or fold.open; closed=closed or not fold.open
        end
        assert(opened and closed,label..': both native fold states remain represented')
        local oracle=require('cland.thread').new({id='differential',title=t.topic.title})
        local states=t:_fold_states(win)
        vim.api.nvim_win_set_buf(win,oracle.buf)
        -- Supply captured fold state before rendering; the normal settle
        -- builds native folds once with the intended state.
        oracle.fold_states[win]=states
        oracle.fold_ready[win]=nil
        oracle:merge(t.messages)
        local full=snapshot(oracle)
        vim.api.nvim_win_set_buf(win,t.buf)
        vim.api.nvim_buf_delete(oracle.buf,{force=true})
        local function same(actual,expected,what)
          if not vim.deep_equal(actual,expected) then
            error(label..': '..what..'\\nactual: '..vim.inspect(actual)..'\\nexpected: '..vim.inspect(expected))
          end
        end
        same(#incremental.lines,#full.lines,'line count')
        for i,line in ipairs(incremental.lines) do same(line,full.lines[i],'line '..i) end
        same(incremental.groups,full.groups,'row metadata')
        same(incremental.folds,full.folds,'fold membership, ranges and window state')
        same(#incremental.marks,#full.marks,'extmark count')
        -- Extmark ids/order are incidental. Match the entire public mark at its
        -- row/column, consuming each match so duplicate decorations still count.
        local by_position={}
        for _,mark in ipairs(full.marks) do
          local key=mark.row..':'..mark.col
          by_position[key]=by_position[key] or {}
          table.insert(by_position[key],mark)
        end
        for i,mark in ipairs(incremental.marks) do
          local bucket=by_position[mark.row..':'..mark.col] or {}
          local match
          for j,candidate in ipairs(bucket) do if vim.deep_equal(mark,candidate) then match=j; break end end
          if not match then error(label..': extmark '..i..' differs: '..vim.inspect(mark)) end
          table.remove(bucket,match)
        end
      `, label, corpus, limit);
    };
    await c.lua(`
      local t=require('cland.views').topic('general').thread
      local states={}
      for i,r in ipairs(t:_runs()) do if i%2==0 then for _,m in ipairs(r.messages) do states[m.id]=true end end end
      local win=require('cland.layout').centre()
      t.fold_states[win]=states
      t:_build_folds(win,states)
    `);
    await compare(`seed ${seed}: initial history and trimming equal full render`);
    for (let step = 0; step < plan.renders - 1; step++) {
      const day = 11 + Math.floor(step / 8);
      const phase = step % 8;
      const isAsk = phase === 1 || phase === 4 || phase === 6;
      const answerTo = phase === 2 || phase === 7 ? `live-${seed}-${step - 1}` : undefined;
      const append = {
        ...msg(`live-${seed}-${step}`, isAsk || phase === 5 ? 'coordinator' : 'human', `Live ${seed}/${step}\n**T-58** and [brief](https://example.com/${step})\n${step % 2 ? '```lua\nprint(1)\n```' : '- list `history`'}`),
        ts: `2026-10-${day}T12:00:00Z`, answerTo,
        ...(phase === 5 ? { to: [], artifact: { id: `A-live-${seed}-${step}`, kind: 'note', title: `Live ${seed}/${step}` } } : {}),
        ...(isAsk ? { ask: { state: phase === 4 ? 'closed' : 'open', options: ['choice'], free: true } } : {}),
      };
      const boundary = await c.lua<string>(`
        local t=require('cland.views').topic('general').thread
        _G.oracle_delivered=false
        for _,m in ipairs(t.messages) do
          if m.fromKind=='human' then _G.oracle_boundary=m.id; return m.id end
        end
      `);
      const receipt = await c.control({ emits: [
        { type: 'message', topic: { id: 'general', title: 'General' }, message: append },
        { type: 'delivery', topic: 'general', message: append.id, stage: step % 2 === 0 ? 'injected' : 'delivered' },
        { type: 'delivery', topic: 'general', message: boundary, stage: 'injected' },
        { type: 'delivery', topic: 'general', message: boundary, stage: 'queued' },
      ] });
      assert.equal(receipt.ok, true, `seed ${seed}, append ${step}: ${receipt.error}`);
      // Observe the final delivery, including both updates to the retained
      // boundary message, before comparing both presentations. Screen visibility
      // is unrelated to whether the incremental render has consumed the burst.
      assert.ok(await c.lua<boolean>(`
        assert(vim.wait(5000,function() return _G.oracle_delivered end,1), 'generated append delivery burst has not landed')
        local id,text=...
        local block=require('cland.views').topic('general').thread.block_of[id]
        return block and table.concat(block.lines,'\\n'):find(text,1,true)~=nil or false
      `, append.id, `Live ${seed}/${step}`), 'generated append is rendered');
      await compare(`seed ${seed}, live append ${step}: incremental presentation equals full render`);
    }
  }
}
