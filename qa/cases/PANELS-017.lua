-- id: PANELS-017
-- title: Sessions left and Items right from the palette follow live rows
-- preconditions: a running worker and a loose task on the stub hub
-- expected: both headers and rows paint on their chosen sides; stopping the worker repaints its row
-- since: T-999
-- regression: no
return {
  title = 'Sessions left and Items right from the palette follow live rows', hub = 'stub',
  fixture = { project = 'qa-panel-sides', items = {
    { id = 'T-1', kind = 'task', title = 'Panel placement', status = 'planned' },
  } },
  scenario = { processes = {
    { name = 'worker', sessionId = 'worker-id', harness = 'codex', role = 'implementer',
      model = 'qa-model', state = 'busy', status = 'running' },
  } },
  run = function(qa)
    qa.wait_for(function() return #qa.state().sessions == 1 and #qa.state().items == 1 end, 10000, 'fixture rows received')
    for _, title in ipairs({ 'Sessions on the left', 'Items on the right' }) do
      qa.keys('<Esc><Space>p>' .. title)
      qa.wait_for(function() return qa.screen():find(title, 1, true) end, 5000, title .. ' offered')
      qa.keys('<CR>')
      qa.wait_for(function() return not qa.screen():find(title, 1, true) end, 5000, 'palette closed')
    end
    -- Read the physical grid columns so a centre title cannot satisfy a panel assertion.
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
    qa.keys('6/unscheduled (<CR>za')
    qa.wait_for(function()
      return grid('left'):find('SESSIONS', 1, true) and grid('left'):find('worker [Implementer]', 1, true)
        and grid('right'):find('ITEMS', 1, true) and grid('right'):find('T-1 Panel placement', 1, true)
    end, 5000, 'both chosen panel headers and rows in the grid')
    qa.expect(qa.state().panels.kinds.left == 'sessions' and qa.state().panels.kinds.right == 'items', 'QA identifies both occupants')
    qa.keys('<C-h><C-h>gg/worker<CR>x')
    qa.wait_for(function() return grid('left'):find('stop worker?', 1, true) end, 5000, 'worker selected on the left')
    qa.keys('y')
    qa.wait_for(function() return grid('left'):find('more (1)', 1, true) end, 5000, 'stopped worker moves to background')
    qa.keys('/more (<CR>za')
    qa.wait_for(function() return grid('left'):find('× worker [Implementer]', 1, true) end, 5000, 'live stop event repaints the worker row')
    qa.expect(grid('right'):find('T-1 Panel placement', 1, true), 'Items stays rendered on the right')
    qa.dump('panels-on-chosen-sides')
  end,
}
