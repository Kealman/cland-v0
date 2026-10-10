-- id: PANELS-015
-- title: Aide launch keys use role defaults and attach in the centre
-- preconditions: an Aide role with launch defaults on the stub hub
-- expected: Space A, panel a and the palette launch distinct Aides with an optional brief
-- since: T-150
-- regression: no
return {
  title='Aide launch keys use role defaults and attach in the centre', hub='stub',
  fixture={project='qa-aide-launch'},
  scenario={roles={{role='aide',label='Aide',exclusive=false,
    launch={harness='codex',model='aide-model',effort='high'}}}},
  run=function(qa)
    qa.wait_for(function() return #qa.state().roles>0 end,10000,'role defaults received')
    qa.keys('<Esc><Space>A')
    qa.wait_for(function()
      local s=qa.screen()
      return s:find('aide-1',1,true) and s:find('aide-model',1,true) and s:find('brief',1,true)
    end,5000,'Aide launcher filled from role defaults')
    qa.keys('Help me plan the release<CR>')
    qa.wait_for(function()
      return qa.screen():find('attached aide-1',1,true) and qa.state().view.id=='aide-1'
    end,5000,'first Aide attached in centre')
    qa.keys('<C-l>')
    qa.wait_for(function() return vim.b.cland_role=='sessions' end,5000,'sessions panel focused')
    qa.keys('a')
    qa.wait_for(function() return qa.screen():find('aide-2',1,true) and qa.screen():find('brief',1,true) end,5000,'panel Aide launcher')
    qa.keys('<CR>')
    qa.wait_for(function() return qa.screen():find('attached aide-2',1,true) end,5000,'Aide without a brief attached')
    qa.keys('<C-l>')
    qa.wait_for(function() return vim.b.cland_role=='sessions' and qa.state().mode=='n' end,5000,'Normal mode for palette')
    qa.keys('<Space>p>Launch an Aide')
    qa.wait_for(function() return qa.screen():find('Launch an Aide',1,true) and qa.screen():find('␣A',1,true) end,5000,'palette action with key')
    qa.keys('<CR>')
    qa.wait_for(function() return qa.screen():find('aide-3',1,true) and qa.screen():find('brief',1,true) end,5000,'palette Aide launcher')
    qa.keys('Draft the notes<CR>')
    qa.wait_for(function() return qa.screen():find('attached aide-3',1,true) end,5000,'third Aide attached')
    qa.expect(#require('cland.actions').audit()==0,'Aide keys are registered')
    qa.dump('aide-launch')
  end,
}
