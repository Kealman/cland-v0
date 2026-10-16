-- id: EXPLORER-003
-- title: The v0.1.3 release outline with every other epic closed
-- preconditions: a copy of R-294's shape on the stub hub: R-294 v0.1.3 open; E-426 open with no tasks; E-387, E-423, E-425 and E-468 closed; Q-384 and the other direct children closed; R-577 0.1.4 and R-377 0.2.0 open
-- expected: Space e shows ○ R-294 v0.1.3 with tasks 3/3; E-426 is the only live epic, first; the four closed epics follow in closing order with ● and the done colour; Direct tasks (10) stays folded; E-424 and E-482 are absent; Other releases (2) names 0.1.4 and 0.2.0
-- since: E-426
-- regression: no
local items = {
  {id='R-294',kind='release',title='v0.1.3',version='0.1.3',state='open'},
  {id='E-387',kind='epic',title='Test speed: structural',parent='R-294',state='closed',rank=10,closed='2026-10-16T12:00:00.000Z'},
  {id='E-423',kind='epic',title='Rules and rhythm',parent='R-294',state='closed',rank=20,closed='2026-10-16T10:27:49.908Z'},
  {id='E-425',kind='epic',title='Hub hygiene',parent='R-294',state='closed',rank=40,closed='2026-10-16T14:00:00.000Z'},
  {id='E-426',kind='epic',title='Release v0.1.3 from the item',parent='R-294',state='open',rank=50},
  {id='E-468',kind='epic',title='Run records: findings, escapes, answers, covers and sub-agent models as data',parent='R-294',state='closed',rank=60,closed='2026-10-16T08:14:42.429Z'},
  {id='Q-295',kind='question',title="OpenCode's new major version: what changed, what it adds for cland",parent='R-294',state='closed',closed='2026-10-14T16:43:56.175Z'},
  {id='Q-297',kind='question',title='OpenCode version hygiene: pin or follow',parent='R-294',state='closed',closed='2026-10-14T16:43:47.766Z'},
  {id='Q-298',kind='question',title='OpenCode launch policy',parent='R-294',state='closed',closed='2026-10-14T16:43:49.209Z'},
  {id='Q-299',kind='question',title='OpenCode-only capabilities',parent='R-294',state='closed',closed='2026-10-14T16:43:51.860Z'},
  {id='Q-378',kind='question',title='A project rulebook',parent='R-294',state='closed',closed='2026-10-14T16:43:52.839Z'},
  {id='Q-380',kind='question',title='A hub heartbeat for the Coordinator',parent='R-294',state='closed',closed='2026-10-14T16:43:54.280Z'},
  {id='Q-384',kind='question',title="Test speed: where the suite's time goes",parent='R-294',state='closed',closed='2026-10-16T10:53:48.773Z'},
  {id='T-447',kind='task',title='Clause-turn and inject-confirmation waits time out under load',parent='R-294',state='closed',status='done',closed='2026-10-15T12:01:14.761Z'},
  {id='T-461',kind='task',title='Signed-out Claude latch test makes one extra CLI call',parent='R-294',state='closed',status='done',closed='2026-10-15T10:13:05.584Z'},
  {id='T-483',kind='task',title="Hotfix: T-253's fail-fast exits on the 5 s stall warning threshold",parent='R-294',state='closed',status='done',closed='2026-10-15T11:34:39.410Z'},
  {id='R-577',kind='release',title='v0.1.4',version='0.1.4',state='open'},
  {id='E-424',kind='epic',title='OpenCode v2 hygiene',parent='R-577',state='open'},
  {id='E-482',kind='epic',title='Flake sweep: the load-sensitive tests found in v0.1.2',parent='R-577',state='open'},
  {id='R-377',kind='release',title='Release: v0.2',version='0.2.0',state='open'},
}
return {
  title='The v0.1.3 release outline with every other epic closed',hub='stub',centre='explorer',fixture={project='qa-explorer-v013'},
  scenario={items=items,tracker={levels={'release','category','epic'},ladder={{'release','category'},{'epic'}}},
    processes={{name='coord',role='coordinator',state='idle',status='running'}}},
  run=function(qa)
    local api, explorer = vim.api, require('cland.explorer')
    qa.wait_for(function() return #qa.state().items==#items end,10000,'item snapshot')
    qa.keys('<Esc>:set columns=200 lines=50<CR><Space>e')
    qa.wait_for(function()
      return explorer.b and explorer.lines and table.concat(explorer.lines,'\n'):find('Other releases (2)',1,true)
    end,5000,'release rows')
    local lines=api.nvim_buf_get_lines(explorer.b,0,-1,false)
    local text=table.concat(lines,'\n')
    local function line_of(id)
      for n, line in ipairs(lines) do if line:find(' ' .. id .. ' ',1,true) then return n, line end end
    end
    for _, value in ipairs({'○ R-294 v0.1.3','tasks 3/3','3 done','○ E-426 Release v0.1.3 from the item',
      '● E-468 Run records','● E-423 Rules and rhythm','● E-387 Test speed: structural','● E-425 Hub hygiene',
      'Direct tasks (10)','Other releases (2)','0.1.4, 0.2.0 open'}) do
      qa.expect(text:find(value,1,true),'visible '..value)
    end
    local order={}
    for _, id in ipairs({'E-426','E-468','E-423','E-387','E-425'}) do order[#order+1]=line_of(id) or math.huge end
    for n=2,#order do qa.expect(order[n-1]<order[n],'the live epic first, then the closed ones in closing order') end
    local live=0
    for _, line in ipairs(lines) do if line:find('○ E%-%d+') then live=live+1 end end
    qa.expect(live==1,'E-426 is the only live epic row')
    for _, id in ipairs({'E-424','E-482','Q-384','T-447'}) do qa.expect(not line_of(id),id..' is not shown') end
    local done={}
    for _, mark in ipairs(api.nvim_buf_get_extmarks(explorer.b,api.nvim_create_namespace('cland.explorer'),0,-1,{details=true})) do
      if mark[4].hl_group=='ClandDone' then done[mark[2]+1]=true end
    end
    for _, id in ipairs({'E-468','E-423','E-387','E-425'}) do qa.expect(done[line_of(id)],id..' title uses ClandDone') end
    qa.expect(not done[line_of('E-426')],'E-426 title is not done')
    qa.dump('release-v013-outline-200')
    qa.expect(#require('cland.actions').audit()==0,'explorer keys use the registry')
  end,
}
