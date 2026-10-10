-- id: PANELS-011
-- title: Board columns read hub status and the parent filter scopes the current release
-- preconditions: seven statuses, two open epics, a closed epic and another release on the stub hub
-- expected: only the current release's open parents contribute cards; p and P select parents
-- since: T-123
-- regression: no
local items = {
  {id='T-1',kind='release',title='Current release',version='0.1.0',state='open'},
  {id='T-2',kind='epic',title='Panels',parent='T-1',state='open'},
  {id='T-3',kind='epic',title='Tracker',parent='T-1',state='open'},
  {id='T-4',kind='epic',title='Closed epic',parent='T-1',state='closed'},
  {id='T-5',kind='release',title='Future release',version='0.2.0',state='open'},
  {id='T-30',kind='task',title='Tracker card',parent='T-3',state='open',status='planned'},
  {id='T-31',kind='task',title='Archived card',parent='T-4',state='closed',status='done'},
  {id='T-32',kind='task',title='Future card',parent='T-5',state='open',status='planned'},
}
for i, status in ipairs({'backlog','planned','in progress','review','qa','ready','done'}) do
  items[#items+1] = {id='T-'..(9+i),kind='task',title='Card '..status,parent='T-2',
    state=status=='done' and 'closed' or 'open',status=status,rank=i*10}
end
return {
  title='Board columns read hub status and the parent filter scopes the current release',
  hub='stub',fixture={project='qa-status-board'},scenario={items=items},
  run=function(qa)
    qa.wait_for(function() return #qa.state().items==#items end,10000,'items loaded')
    qa.keys('<Esc><Space>s<Space>b')
    qa.wait_for(function() return qa.screen():find('Card ready',1,true) end,5000,'board')
    local screen=qa.screen()
    for _, status in ipairs({'BACKLOG','PLANNED','IN PROGRESS','REVIEW','QA','READY','DONE'}) do
      qa.expect(screen:find(status,1,true)~=nil,'column '..status)
    end
    for _, id in ipairs({'T-10','T-11','T-12','T-13','T-14','T-15','T-16','T-30'}) do
      qa.expect(screen:find(id,1,true)~=nil,'current open-parent card '..id)
    end
    qa.expect(not screen:find('T-31',1,true) and not screen:find('T-32',1,true),'closed and other-release cards leave the board')
    qa.keys('p')
    qa.wait_for(function() return not qa.screen():find('T-30',1,true) end,5000,'Panels filter')
    qa.expect(qa.screen():find('T-13',1,true)~=nil,'Panels cards remain')
    qa.keys('p')
    qa.wait_for(function() return qa.screen():find('T-30',1,true) and not qa.screen():find('T-13',1,true) end,5000,'Tracker filter')
    qa.keys('P')
    qa.wait_for(function() return qa.screen():find('T-13',1,true) and not qa.screen():find('T-30',1,true) end,5000,'previous parent')
    qa.expect(#require('cland.actions').audit()==0,'parent keys are registered')
    qa.dump('status-board')
  end,
}
