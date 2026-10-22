-- id: FOLLOWS-001
-- title: The explorer card shows an epic's follows beside its blockers, and the follow does not block it
-- preconditions: a fixture project on the stdio hub: release R-1, epic E-2 whose only task T-3 is closed, epic E-4 following E-2 with no blockers and one open task T-5
-- expected: the hub reports E-4 with follows E-2 and no blocked_by; Space e shows both epics; the card of E-4 has a relations section with blocked by none and follows E-2 with its status and title; the item view (gI) lists follows E-2
-- since: E-423
-- regression: no
local api = vim.api
local function card()
  local b = require('cland.explorer').card.buf
  return b and api.nvim_buf_is_valid(b) and table.concat(api.nvim_buf_get_lines(b, 0, -1, false), '\n') or ''
end
local function select_row(key)
  local e = require('cland.explorer')
  for r, row in ipairs(e.rows or {}) do
    if row.key == key then
      api.nvim_set_current_win(e.tree_win())
      api.nvim_win_set_cursor(e.tree_win(), { r, 0 })
      return true
    end
  end
end
return {
  title = "The explorer card shows an epic's follows beside its blockers",
  centre = 'explorer',
  fixture = {
    project = 'qa-follows',
    items = {
      { id = 'R-1', kind = 'release', title = 'Rules and rhythm release', version = '0.1.0' },
      { id = 'E-2', kind = 'epic', title = 'Predecessor epic', parent = 'R-1' },
      { id = 'T-3', title = 'Predecessor ticket', parent = 'E-2', state = 'closed' },
      { id = 'E-4', kind = 'epic', title = 'Follower epic', parent = 'R-1', follows = { 'E-2' } },
      { id = 'T-5', title = 'Follower ticket', parent = 'E-4' },
    },
  },
  run = function(qa)
    qa.wait_for(function()
      for _, it in ipairs(qa.state().items) do
        if it.id == 'E-2' then return true end
      end
    end, 10000, 'the open predecessor epic')
    -- Closed T-3 arrives through E-2's parent page, not the first payload.
    require('cland.explorer').set_open('E-2', true)
    qa.wait_for(function() return qa.state().hub.state == 'connected' and #qa.state().items == 5 end, 10000, 'the five fixture items')
    qa.keys('<Esc><Space>e')
    qa.wait_for(function()
      local e = require('cland.explorer')
      return e.b and e.lines and table.concat(e.lines, '\n'):find('Follower epic', 1, true) and table.concat(e.lines, '\n'):find('Predecessor epic', 1, true)
    end, 5000, 'both epics in the tree')
    qa.wait_for(function() return select_row('E-4') end, 5000, 'the E-4 row')
    qa.keys('<CR>')
    local follower
    qa.wait_for(function()
      local e = require('cland.explorer')
      local c = card()
      -- The summary can render the relation before the whole-item reply arrives.
      follower = require('cland.item_view').get('E-4', {summary_only=true})
      return e.card.key == 'E-4' and c:find('follows E-2', 1, true)
        and follower and type(follower.follows) == 'table' and follower.follows[1] == 'E-2'
    end, 5000, 'the card of E-4 with its follows')
    qa.expect(follower and type(follower.follows) == 'table' and follower.follows[1] == 'E-2', 'the hub reports E-4 follows E-2')
    qa.expect(#(follower.blocked_by or {}) == 0, 'the follow is not a blocker')
    local c = card()
    local blocked = c:find('blocked by', 1, true)
    local follows = c:find('follows', 1, true)
    qa.expect(blocked and follows and blocked < follows, 'follows sits beside (after) blocked by in relations\n' .. c)
    -- the card wraps long rows: match the row's start and the title's first word
    qa.expect(c:find('follows E-2', 1, true) and c:find('Predecessor', follows, true), 'the follows row names the predecessor\n' .. c)
    qa.expect(c:find('blocked by none', 1, true), 'no blockers\n' .. c)
    qa.dump('follows-card')
    qa.keys('hgI')
    qa.wait_for(function()
      local v = qa.state().view
      return v.kind == 'item' and v.id == 'E-4' and qa.screen():match('follows +E%-2')
    end, 5000, 'the item view of E-4 lists follows E-2')
    qa.dump('follows-item-view')
  end,
}
