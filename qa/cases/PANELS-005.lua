-- id: PANELS-005
-- title: Manual panel sizes survive views and presets, and the preferences read back
-- preconditions: the stub hub and a writable fixture project
-- expected: manual sizes, preset, panel set, filters and the reserved release pick survive UI-state reload
-- since: T-125 (successor to prototype/panels PANELS-001 to PANELS-004)
-- regression: no
return {
  title = 'Manual panel sizes survive views and presets, and the preferences read back',
  hub = 'stub',
  fixture = { project = 'qa-persistent-panels' },
  run = function(qa)
    qa.wait_for(function() return qa.state().hub.state == 'connected' end, 10000, 'the stub hub connected')
    qa.keys('<Esc>:Cland preset watch<CR>')
    local layout, state = require('cland.layout'), require('cland.state')
    vim.api.nvim_win_set_width(layout.win.left, 48)
    vim.api.nvim_win_set_width(layout.win.right, 46)
    vim.api.nvim_win_set_height(layout.win.dock, 11)
    qa.keys('<Esc>')
    qa.wait_for(function() return state.S.ui.sizes.left == 48 and state.S.ui.sizes.right == 46 and state.S.ui.sizes.dock == 11 end, 5000, 'the user resize events recorded')
    qa.keys(':Cland view board<CR>')
    qa.expect(vim.api.nvim_win_get_width(layout.win.left) == 48, 'the view switch keeps the manual width')
    qa.keys(':Cland preset charting<CR>')
    qa.expect(vim.api.nvim_win_get_width(layout.win.left) == 48, 'the preset keeps the manual width')
    qa.keys(':Cland preset steady<CR>:Cland preset watch<CR>')
    require('cland.items').set_filter('work')
    state.S.ui.current_release = 'T-109' -- the storage slot only; the pick keys belong to T-128
    qa.wait_for(function()
      local ok, lines = pcall(vim.fn.readfile, qa.root .. '/.cland/ui.json')
      if not ok then return false end
      local data = vim.json.decode(table.concat(lines, '\n'))
      return data.items_filter == 'work' and data.current_release == 'T-109'
    end, 5000, 'the debounced preferences file')
    state.S.ui.sizes, state.S.ui.items_filter, state.S.ui.current_release = {}, 'all', nil
    require('cland.ui').load(qa.root)
    layout.build({ insert = false })
    qa.expect(state.S.ui.preset == 'watch' and state.S.ui.left and state.S.ui.right == 'inbox' and state.S.ui.dock, 'the preset and panels read back')
    qa.expect(state.S.ui.items_filter == 'work' and state.S.ui.current_release == 'T-109', 'the filter and release slot read back')
    qa.expect(vim.api.nvim_win_get_width(layout.win.left) == 48 and vim.api.nvim_win_get_width(layout.win.right) == 46 and vim.api.nvim_win_get_height(layout.win.dock) == 11, 'all manual sizes read back')
    qa.dump('persistent-panels')
  end,
}
