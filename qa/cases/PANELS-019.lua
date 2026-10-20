-- id: PANELS-019
-- title: Chosen panel sides survive saving and rebuilding the layout
-- preconditions: a running worker and a loose task on the stub hub
-- expected: Sessions left and Items right retain their headers and rows after a UI-state reload
-- since: T-1001
-- regression: no
return {
  title = 'Chosen panel sides survive saving and rebuilding the layout', hub = 'stub',
  fixture = { project = 'qa-panel-persistence', items = {
    { id = 'T-1', kind = 'task', title = 'Remembered placement', status = 'planned' },
  } },
  scenario = { processes = {
    { name = 'worker', sessionId = 'worker-id', harness = 'codex', role = 'implementer',
      model = 'qa-model', state = 'busy', status = 'running' },
  } },
  run = function(qa)
    qa.wait_for(function() return #qa.state().sessions == 1 and #qa.state().items == 1 end, 10000, 'fixture rows received')
    local function grid(side)
      vim.cmd('redraw')
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
    local function swapped()
      return grid('left'):find('SESSIONS', 1, true) and grid('left'):find('worker [Implementer]', 1, true)
        and grid('right'):find('ITEMS', 1, true) and grid('right'):find('T-1 Remembered placement', 1, true)
    end
    qa.keys('<Esc>:Cland panel sessions left<CR>:Cland panel items right<CR>6/unscheduled (<CR>za')
    qa.wait_for(swapped, 5000, 'swapped headers and rows before save')
    local ui, layout = require('cland.ui'), require('cland.layout')
    ui.changed()
    qa.expect(ui.flush(), 'preferences written')
    -- Change the runtime first so the rendered post-reload assertion needs the saved state.
    layout.place_panel('items', 'left')
    layout.place_panel('sessions', 'right')
    qa.expect(layout.panel_kind('left') == 'items' and layout.panel_kind('right') == 'sessions', 'different runtime layout before reload')
    ui.load(require('cland.state').S.root)
    layout.build({insert=false})
    qa.wait_for(swapped, 5000, 'saved headers and rows rebuilt on chosen sides')
    qa.expect(qa.state().panels.kinds.left == 'sessions' and qa.state().panels.kinds.right == 'items', 'saved occupants restored')
    qa.expect(swapped(), 'both rows remain in their physical grid columns')
    qa.dump('remembered-panel-sides')
  end,
}
