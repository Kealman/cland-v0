-- id: PANELS-014
-- title: Open configured containers cycle with e and E and persist through ui.json
-- preconditions: custom levels, two releases and a stale stored pick on a writable fixture
-- expected: e/E update scope and chip; reload retains the pick; missing/closed/leaf picks fall back
-- since: T-128 (successor to prototype/panels PANELS-001 to PANELS-004)
-- regression: no
return {
  title='Open configured containers cycle and persist through ui.json',hub='stub',
  fixture={project='qa-board-scope'},
  scenario={tracker={levels={'initiative','feature'}},items={
    {id='T-1',kind='initiative',title='Current initiative',version='0.1.0',state='open'},
    {id='T-2',kind='feature',title='Panels feature',parent='T-1',state='open'},
    {id='T-3',kind='initiative',title='Future initiative',version='0.2.0',state='open'},
    {id='T-4',kind='initiative',title='Closed initiative',version='0.0.1',state='closed'},
    {id='T-10',kind='task',title='Current row',parent='T-2',status='planned',state='open'},
    {id='T-11',kind='task',title='Future row',parent='T-3',status='review',state='open'},
  }},
  run=function(qa)
    local items,state=require('cland.items'),require('cland.state')
    qa.wait_for(function() return #qa.state().items==6 end,10000,'items loaded')
    qa.keys('<Esc><Space>i')
    vim.api.nvim_win_set_width(require('cland.layout').win.left,65)
    qa.keys('<Esc>')
    qa.wait_for(function() return qa.screen():find('Current row',1,true) end,5000,'current scope')
    qa.keys('e')
    qa.wait_for(function() return items.scope().id=='T-2' end,5000,'feature scope')
    qa.keys('e')
    qa.wait_for(function() return qa.screen():find('Future row',1,true) and not qa.screen():find('Current row',1,true) end,5000,'future scope')
    require('cland.ui').flush()
    state.S.ui.current_release=nil
    require('cland.ui').load(qa.root)
    qa.expect(state.S.ui.current_release=='T-3' and items.scope().id=='T-3','ui.json restores the selected container')
    qa.keys('E')
    qa.wait_for(function() return items.scope().id=='T-2' and qa.screen():find('Current row',1,true) end,5000,'previous container')
    for _,pick in ipairs({'T-999','T-4','T-10'}) do
      state.S.ui.current_release=pick
      qa.expect(items.scope().id=='T-1','invalid pick '..pick..' falls back to semver current release')
    end
    state.changed()
    qa.dump('container-scope')
  end,
}
