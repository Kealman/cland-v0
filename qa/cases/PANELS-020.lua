-- id: PANELS-020
-- title: Manual side sizes survive swapped panels, views, presets and preference reload
-- preconditions: the stub hub and a writable fixture project
-- expected: widths stay with sides with Items right and Sessions left; presets keep homes and all sizes read back
-- since: T-1002
-- regression: no
return {
  title = 'Manual side sizes survive swapped panels, views, presets and preference reload',
  hub = 'stub',
  fixture = { project = 'qa-swapped-panel-sizes' },
  run = function(qa)
    qa.wait_for(function() return qa.state().hub.state == 'connected' end, 10000, 'the stub hub connected')
    qa.keys('<Esc>:Cland panel inbox left<CR>:Cland panel sessions left<CR>:Cland panel items right<CR><Space>T')
    local layout, state = require('cland.layout'), require('cland.state')
    local homes = vim.deepcopy(state.S.ui.panel_homes)
    vim.api.nvim_win_set_width(layout.win.left, 48)
    vim.api.nvim_win_set_width(layout.win.right, 46)
    vim.api.nvim_win_set_height(layout.win.dock, 11)
    qa.keys('<Esc>')
    qa.wait_for(function() return state.S.ui.sizes.left == 48 and state.S.ui.sizes.right == 46 and state.S.ui.sizes.dock == 11 end, 5000, 'the user resize events recorded')
    qa.expect(layout.panel_kind('left') == 'sessions' and layout.panel_kind('right') == 'items', 'Sessions left and Items right')
    qa.keys(':Cland view board<CR>')
    qa.expect(vim.api.nvim_win_get_width(layout.win.left) == 48 and vim.api.nvim_win_get_width(layout.win.right) == 46, 'the view switch keeps both manual widths')
    qa.keys(':Cland preset charting<CR>')
    qa.expect(layout.panel_kind('right') == 'items' and vim.api.nvim_win_get_width(layout.win.right) == 46, 'charting keeps Items right at the side width')
    qa.keys(':Cland preset steady<CR>:Cland preset watch<CR>')
    qa.expect(vim.deep_equal(state.S.ui.panel_homes, homes), 'presets keep every home')
    require('cland.items').set_filter('work')
    state.S.ui.current_release = 'T-109'
    qa.wait_for(function()
      local ok, lines = pcall(vim.fn.readfile, qa.root .. '/.cland/ui.json')
      if not ok then return false end
      local data = vim.json.decode(table.concat(lines, '\n'))
      return data.items_filter == 'work' and data.current_release == 'T-109'
        and vim.deep_equal(data.sizes, { left = 48, right = 46, dock = 11 })
        and vim.deep_equal(data.panel_homes, homes)
    end, 5000, 'the debounced preferences file contains homes and sizes')
    state.S.ui.sizes, state.S.ui.items_filter, state.S.ui.current_release = {}, 'all', nil
    require('cland.ui').load(qa.root)
    layout.build({ insert = false })
    qa.expect(state.S.ui.preset == 'watch' and layout.panel_kind('left') == 'inbox' and layout.panel_kind('right') == 'items' and state.S.ui.dock, 'the preset and swapped panels read back')
    qa.expect(vim.deep_equal(state.S.ui.panel_homes, homes), 'all homes read back')
    qa.expect(state.S.ui.items_filter == 'work' and state.S.ui.current_release == 'T-109', 'the filter and release slot read back')
    qa.expect(vim.api.nvim_win_get_width(layout.win.left) == 48 and vim.api.nvim_win_get_width(layout.win.right) == 46 and vim.api.nvim_win_get_height(layout.win.dock) == 11, 'all manual sizes read back')
    qa.keys(':Cland panel sessions left<CR>')
    qa.expect(vim.api.nvim_win_get_width(layout.win.left) == 48, 'Sessions returns at the left side width')
    qa.dump('swapped-panel-sizes')
  end,
}
