-- id: PANELS-007
-- title: The palette reaches actions and objects through prefixes and split opening
-- preconditions: the stub hub and a fixture item
-- expected: the action toggles sessions, # opens the item, Tab changes kind, C-v splits and Esc closes
-- since: T-126
-- regression: no
return {
  title = 'The palette reaches actions and objects through prefixes and split opening',
  hub = 'stub',
  fixture = { project = 'qa-palette', items = {{id='T-12', title='Palette fixture', kind='task', state='open'}} },
  run = function(qa)
    qa.wait_for(function() return qa.state().hub.state == 'connected' end, 10000, 'hub connected')
    qa.keys('<Esc><Space>p>sessions panel')
    qa.wait_for(function() return qa.screen():find('Toggle sessions panel') and qa.screen():find('␣s') end, 5000, 'action with its key')
    qa.keys('<CR>')
    qa.wait_for(function() return not qa.state().panels.right end, 5000, 'sessions toggled')
    qa.keys('<Space>p#T-12<CR>')
    qa.wait_for(function() return qa.state().view.id == 'T-12' end, 5000, 'item opened')
    qa.keys('<Space>p#T-12<C-v>')
    qa.wait_for(function() return #vim.api.nvim_tabpage_list_wins(0) == 2 end, 5000, 'item split')
    qa.keys('<Space>a')
    qa.expect(vim.api.nvim_get_current_line() == '~', 'artifacts shortcut sets ~')
    qa.keys('<Tab>')
    qa.expect(vim.api.nvim_get_current_line() == '/', 'Tab reaches topics')
    qa.keys('<Esc>')
    qa.expect(qa.state().mode == 'n', 'Esc closes in Normal mode')
    qa.expect(#require('cland.actions').audit() == 0, 'all mappings agree with registry')
    qa.dump('palette-prefixes')
  end,
}
