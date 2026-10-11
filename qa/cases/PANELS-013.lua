-- id: PANELS-013
-- title: Vertical status sections, folds and hub rank events share the centre board's order
-- preconditions: every status, ranked epics, a blocked planned task and a failed verdict on the stub hub
-- expected: section counts, marks, fractions and epic-first order; T changes next through task events
-- since: T-128 (successor to prototype/panels PANELS-001 to PANELS-004)
-- regression: no
local body='- [x] Outside\n## Acceptance criteria\n- [x] C1. First\n  - verified: rev-1 [reviewer] · run r-1 · 2026-10-10T10:00Z\n- [ ] Second\n## Notes\n- [x] Outside'
local function task(id,status,parent,rank,extra)
  return vim.tbl_extend('force',{id='T-'..id,kind='task',title='Row '..id,status=status,
    state=status=='done' and 'closed' or 'open',parent=parent,rank=rank,body=body},extra or {})
end
local items={
  {id='T-1',kind='release',title='Current release',state='open',version='0.1.0'},
  {id='T-2',kind='epic',title='Panels',state='open',parent='T-1',rank=20},
  {id='T-3',kind='epic',title='Tracker',state='open',parent='T-1',rank=10},
  task(10,'in progress','T-2',10,{claim={session='impl-10'},verdicts={{verdict='review',result='not clear'}}}),
  task(11,'review','T-2',20),task(12,'qa','T-2',30),
  task(13,'ready','T-2',40,{body='## Acceptance criteria\n- [x] C1. Done\n  - verified: rev-1 [reviewer] · run r-1 · 2026-10-10T10:00Z'}),
  task(14,'planned','T-2',50,{blocked_by={'T-10'}}),task(15,'planned','T-2',60),
  task(16,'planned','T-3',70),task(17,'backlog','T-2',80),task(18,'done','T-2',90),
  task(19,'planned',nil,100),task(20,'planned','T-2',110),
}
return {
  title='Vertical status sections, folds and hub rank events share the centre board order',
  hub='stub',fixture={project='qa-vertical-board'},scenario={items=items},
  run=function(qa)
    qa.wait_for(function() return #qa.state().items==#items end,10000,'items loaded')
    qa.keys('<Esc><Space>i')
    local api=vim.api
    api.nvim_win_set_width(require('cland.layout').win.left,70)
    qa.wait_for(function() return qa.screen():find('board · 8 in work · 1 done',1,true) and qa.screen():find('1/2',1,true) and qa.screen():find('1/1',1,true) end,5000,'board with criteria')
    local screen=qa.screen()
    for _,text in ipairs({'IN PROGRESS · 1','REVIEW · 1','QA · 1','READY · 1','PLANNED · 4','▸ backlog (1)','▸ unscheduled (1)','✗ review','for Reviewer','1/1'}) do
      qa.expect(screen:find(text,1,true)~=nil,text)
    end
    qa.expect(screen:find('○ T-16',1,true)<screen:find('◌ T-14',1,true),'epic rank before task rank')
    qa.expect(not screen:find('Row 17',1,true) and not screen:find('Row 18',1,true) and not screen:find('Row 19',1,true),'backlog, done and unscheduled hidden')
    qa.keys('/backlog (<CR>za')
    qa.wait_for(function() return qa.screen():find('Row 17',1,true) end,5000,'backlog opens')
    -- §3.5 Items: planned without release membership is unscheduled Background.
    qa.keys('za/unscheduled (<CR>za')
    qa.wait_for(function() return qa.screen():find('Row 19',1,true) end,5000,'unscheduled opens')
    qa.keys('zap') -- Tracker
    qa.keys('p') -- Panels
    qa.wait_for(function() return not qa.screen():find('Row 16',1,true) end,5000,'Panels epic tab')
    qa.keys('/T-20<CR>T')
    qa.wait_for(function() return qa.screen():match('T%-20[^\n]*next') end,5000,'T changes next from rank events')
    qa.expect(api.nvim_get_current_line():find('T-20',1,true)~=nil,'cursor follows item')
    qa.expect(#require('cland.actions').audit()==0,'every key registered')
    qa.dump('vertical-board')
    qa.keys('<Space>i<Space>s<Space>b')
    qa.wait_for(function() return qa.screen():find('Row 20',1,true) end,5000,'centre board')
    local planned=require('cland.board').columns().planned
    qa.expect(planned[1].id=='T-20' and planned[2].id=='T-14' and planned[3].id=='T-15','same hub order in centre columns')
    qa.dump('shared-centre-board')
  end,
}
