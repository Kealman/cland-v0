-- id: EXPLORER-001
-- title: Release outline with its epics and folded roots
-- preconditions: copy of the current release shape on the stub hub
-- expected: 200x50 with the card shows the outline; a tree of at least 118 content columns also shows the lead
-- since: T-350
-- regression: yes
local items = {
  {id='R-228',kind='release',title='Working with items',version='0.1.2',state='open'},
  {id='E-276',kind='epic',title='The explorer and the card',parent='R-228',state='open',rank=20,
    plan={stages={{name='the tree',qa={scope='none',when='after-stage'},lanes={{'T-350'}}}}},
    stages={{name='the tree',state='open',qa={scope='none',when='after-stage'},items={'T-350'}}}},
  {id='E-271',kind='epic',title='Remote executors',parent='R-228',state='open',rank=10},
  {id='E-270',kind='epic',title='Status and fields',parent='R-228',state='closed',rank=0,closed='2025-12-01T10:00:00Z'},
  {id='T-350',kind='task',title='The explorer tree',parent='E-276',state='open',status='in progress',
    claim={session='impl-350',role='implementer'},criteria={verified=2,total=8}},
  {id='T-345',kind='task',title='Remote lifecycle',parent='E-271',state='open',status='review'},
  {id='T-330',kind='task',title='Summary fields',parent='E-270',state='closed',status='done',closed='2025-12-01T09:00:00Z'},
  {id='T-349',kind='task',title='Direct release task',parent='R-228',state='open',status='planned'},
  {id='C-216',kind='category',title='Tech debt',state='open'},
  {id='T-360',kind='task',title='Unscheduled work',state='open',status='backlog'},
  {id='R-400',kind='release',title='Future release',version='0.2.0',state='open'},
}
return {
  title='Release outline with its epics and folded roots',hub='stub',centre='explorer',fixture={project='qa-explorer'},
  scenario={items=items,processes={{name='coord',role='coordinator',state='idle',status='running'}}},
  run=function(qa)
    local api, explorer = vim.api, require('cland.explorer')
    qa.wait_for(function() return #qa.state().items==#items end,10000,'item snapshot')
    qa.keys('<Esc>:set columns=200 lines=50<CR><Space>e')
    qa.wait_for(function()
      return explorer.b and explorer.lines and table.concat(explorer.lines,'\n'):find('S1',1,true)
        and explorer.window_width==api.nvim_win_get_width(explorer.tree_win())
    end,5000,'release rows and cached stage')
    qa.expect(vim.o.columns==200 and vim.o.lines==50,'200x50 grid')
    qa.expect(explorer.card.win and api.nvim_win_is_valid(explorer.card.win),'card stays open at 200x50')
    qa.expect(api.nvim_win_get_width(explorer.tree_win())-1<118,'narrow tree hides the lead column')
    local text=table.concat(api.nvim_buf_get_lines(explorer.b,0,-1,false),'\n')
    for _, value in ipairs({'◐ R-228 0.1.2 Working with items','tasks 1/4','Remote executors','The explorer and the card',
      '● E-270 Status and fields','Direct tasks (1)','Categories (1)','Unscheduled (1)','Other releases (1)'}) do
      qa.expect(text:find(value,1,true),'visible '..value)
    end
    qa.expect(not text:find('coord',1,true),'lead hidden in the narrow tree')
    qa.expect(text:find('Remote executors',1,true)<text:find('The explorer and the card',1,true),'live epics ordered by rank')
    qa.expect(text:find('The explorer and the card',1,true)<text:find('Status and fields',1,true),'closed epic follows live epics')
    qa.expect(not text:find('Direct release task',1,true),'direct tasks start folded')
    local done=false
    for _, mark in ipairs(api.nvim_buf_get_extmarks(explorer.b,api.nvim_create_namespace('cland.explorer'),0,-1,{details=true})) do
      if mark[4].hl_group=='ClandDone' then done=true end
    end
    qa.expect(done,'done title uses ClandDone')
    qa.expect(not vim.wo[explorer.tree_win()].wrap,'outline never wraps')
    qa.expect(not vim.wo[explorer.tree_win()].foldenable,'Vim folds stay off')
    qa.dump('release-outline-200')
    -- Keep the card open and measure the tree's content width, not the whole grid.
    qa.keys(':set columns=280<CR>')
    qa.wait_for(function()
      local width=api.nvim_win_get_width(explorer.tree_win())
      return width-1>=118 and explorer.window_width==width
        and table.concat(explorer.lines,'\n'):find('S1',1,true)
    end,5000,'wide release rows rendered')
    qa.expect(explorer.card.win and api.nvim_win_is_valid(explorer.card.win),'card stays open in the wide layout')
    text=table.concat(api.nvim_buf_get_lines(explorer.b,0,-1,false),'\n')
    qa.expect(text:find('coord',1,true),'lead visible with at least 118 tree content columns')
    qa.dump('release-outline-280')
    qa.expect(#require('cland.actions').audit()==0,'explorer keys use the registry')
  end,
}
