-- id: PANELS-012
-- title: In work includes unclaimed review and QA; done is current-release tasks
-- preconditions: custom container levels and explicit task statuses on the stub hub
-- expected: all five in-work statuses remain visible, done and backlog do not; unscheduled is last
-- since: T-123
-- regression: yes
-- T-80: an unclaimed task under review must appear in work.
local items = {
  {id='T-1',kind='initiative',title='Current initiative',version='0.1.0',state='open'},
  {id='T-2',kind='feature',title='Panels',parent='T-1',state='open'},
  {id='T-3',kind='initiative',title='Future initiative',version='0.2.0',state='open'},
  {id='T-4',kind='initiative',title='Archived initiative',version='0.0.1',state='closed'},
  {id='T-20',kind='task',title='Loose review',state='open',status='review'},
  {id='T-21',kind='task',title='Other done',parent='T-3',state='closed',status='done'},
  {id='T-22',kind='task',title='Archived done',parent='T-4',state='closed',status='done'},
}
for i, status in ipairs({'planned','in progress','review','qa','ready','done','backlog'}) do
  items[#items+1] = {id='T-'..(9+i),kind='task',title='Work '..status,parent='T-2',
    state=status=='done' and 'closed' or 'open',status=status}
end
return {
  title='In work includes unclaimed review and QA; done is current-release tasks',
  hub='stub',fixture={project='qa-status-filters'},
  scenario={items=items,tracker={levels={'initiative','feature'}}},
  run=function(qa)
    qa.wait_for(function() return #qa.state().items==#items end,10000,'items loaded')
    qa.keys('<Esc><Space>i2/unscheduled (<CR>za')
    qa.wait_for(function() return qa.screen():find('in work · 6',1,true) end,5000,'in work filter')
    vim.api.nvim_win_set_width(require('cland.layout').win.left,60)
    qa.wait_for(function() return qa.screen():find('Work review',1,true) end,5000,'parent-prefixed work titles')
    local screen=qa.screen()
    for _, title in ipairs({'Work planned','Work in progress','Work review','Work qa','Work ready'}) do
      qa.expect(screen:find(title,1,true)~=nil,'in work contains '..title)
    end
    qa.expect(not screen:find('Work done',1,true) and not screen:find('Work backlog',1,true),'done and backlog stay out')
    qa.expect(screen:find('Loose review',1,true)>screen:find('unscheduled (',1,true),'unscheduled group is last')
    qa.dump('in-work')
    qa.keys('4')
    qa.wait_for(function() return qa.screen():find('done · 1',1,true) end,5000,'done filter')
    qa.expect(qa.screen():find('Work done',1,true)~=nil,'current done task')
    qa.expect(not qa.screen():find('Other done',1,true) and not qa.screen():find('Archived done',1,true),'done stays in current release')
    qa.keys('3')
    qa.wait_for(function() return qa.screen():find('needs you · 0',1,true) end,5000,'needs you remains unchanged')
    qa.dump('current-done-and-needs-you')
  end,
}
