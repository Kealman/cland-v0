-- id: PANELS-018
-- title: Move Items right and Inbox left with gm
-- preconditions: a task and an open ask on the stub hub
-- expected: gm moves each panel and both headers and rows appear in their physical grid columns
-- since: T-1000
-- regression: no
return {
  title = 'Move Items right and Inbox left with gm', hub = 'stub',
  fixture = { project = 'qa-panel-move', items = {
    { id = 'T-1', kind = 'task', title = 'Moved item', status = 'planned' },
  } },
  scenario = { inbox = { asks = {
    { id = 'move-ask', topic = { id = 'general', title = 'General' }, question = 'Choose a side',
      options = { 'left', 'right' }, free = true, from = 'coord', ts = '2026-10-20T10:00:00Z' },
  } } },
  run = function(qa)
    qa.wait_for(function() return #qa.state().items == 1 end, 10000, 'fixture item received')
    local function grid(side)
      local w = require('cland.layout').win[side]
      if not (w and vim.api.nvim_win_is_valid(w)) then return '' end
      local pos, width = vim.api.nvim_win_get_position(w), vim.api.nvim_win_get_width(w)
      local lines = {}
      for r = 2, vim.o.lines - 2 do
        local cells = {}
        for c = pos[2] + 1, pos[2] + width do cells[#cells + 1] = vim.fn.screenstring(r, c) end
        lines[#lines + 1] = table.concat(cells)
      end
      return table.concat(lines, '\n')
    end
    qa.keys('<Esc><Space>i')
    qa.wait_for(function() return grid('left'):find('ITEMS', 1, true) end, 5000, 'Items opens on the left')
    qa.keys('6/unscheduled (<CR>za')
    qa.wait_for(function() return grid('left'):find('T-1 Moved item', 1, true) end, 5000, 'item row before move')
    qa.keys('gm')
    qa.wait_for(function() return grid('right'):find('ITEMS', 1, true) and grid('right'):find('T-1 Moved item', 1, true) end, 5000, 'Items moved to right grid')
    qa.keys('<Space>n')
    qa.wait_for(function() return grid('right'):find('INBOX', 1, true) end, 5000, 'Inbox opens on its default side')
    qa.keys('gm')
    qa.wait_for(function() return grid('left'):find('INBOX', 1, true) and grid('left'):find('General', 1, true) end, 5000, 'Inbox moved to left grid')
    qa.keys('<Space>i')
    qa.wait_for(function()
      return grid('left'):find('INBOX', 1, true) and grid('left'):find('General', 1, true)
        and grid('right'):find('ITEMS', 1, true) and grid('right'):find('T-1 Moved item', 1, true)
    end, 5000, 'both moved panels and rows visible')
    qa.expect(qa.state().panels.kinds.left == 'inbox' and qa.state().panels.kinds.right == 'items', 'both moved occupants identified')
    qa.expect(grid('left'):find('General', 1, true) and grid('right'):find('T-1 Moved item', 1, true), 'both rows remain in the grid')
    qa.dump('moved-panels')
  end,
}
