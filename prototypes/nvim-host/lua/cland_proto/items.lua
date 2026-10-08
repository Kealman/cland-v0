-- PROTOTYPE (ticket #15, workbench): the items panel (left, <Space>i).
-- A tree of epics and items with status glyphs, the claim right-aligned and
-- an ask badge; filters all / in work / needs you / done (1-4, f cycles) and
-- the map filter (5): the wayfinder grouping decided / frontier / in work by
-- sub-agents / blocked of the Charting artboard. Enter opens the item.
local api = vim.api
local state = require('cland_proto.state')
local hl = require('cland_proto.hl')
local D = require('cland_proto.draw')

local M = { ns = api.nvim_create_namespace('cland_proto_items'), rows = {} }

M.FILTERS = { 'all', 'work', 'you', 'done', 'map' }
M.LABEL = { all = 'all', work = 'in work', you = 'needs you', done = 'done', map = 'map' }

-- Glyph and highlight of an item (map tickets use the Charting colours).
function M.glyph(it)
  if it.kind == 'epic' then
    return state.S.ui.folds[it.id] and '▸' or '▾', 'ClandDim'
  end
  if it.map then
    if it.map == 'decided' then
      return '●', 'ClandGreen'
    elseif it.map == 'blocked' then
      return '◌', 'ClandDim'
    elseif it.map == 'frontier' and not it.claim then
      return '◔', 'ClandAmber'
    end
    return '◐', 'ClandTeal'
  end
  local g = hl.ITEM[state.item_status(it)] or hl.ITEM.backlog
  return g[1], g[2]
end

local function by_text(ids)
  if #ids > 2 then
    return 'by ' .. #ids
  end
  return 'by ' .. table.concat(ids, ', ')
end

-- The right-hand column: claim, approval mark, blockers, progress, ask badge.
function M.right(it, filter)
  local out = {}
  local status = state.item_status(it)
  if it.kind == 'epic' or it.kind == 'map' then
    local done, total = state.progress(it.id)
    out[#out + 1] = { done .. ' of ' .. total, 'ClandDim' }
  elseif it.map then
    if it.map == 'frontier' then
      out[#out + 1] = it.claim and { it.claim .. ' · ' .. (it.doing or 'working'), 'ClandTeal' } or { 'unclaimed', 'ClandDim' }
    elseif it.map == 'subagent' then
      out[#out + 1] = { it.sub .. ' · ' .. it.mins .. ' min', 'ClandTeal' }
    elseif it.map == 'blocked' then
      out[#out + 1] = { by_text(it.blocked_by), 'ClandDim' }
    end
  elseif it.claim then
    local s = state.session(it.claim)
    out[#out + 1] = { it.claim, 'ClandTeal' }
    if s and s.state == 'waiting for approval' then
      out[#out + 1] = { ' ▲', 'ClandAmber' }
    elseif s and s.state == 'waiting for human' then
      out[#out + 1] = { ' ●', 'ClandAmber' }
    end
  elseif status == 'progress' then
    out[#out + 1] = { 'unclaimed', 'ClandRed' }
  elseif status == 'review' or status == 'qa' then
    out[#out + 1] = { 'waits for ' .. status, 'ClandDim' }
  elseif status == 'blocked' then
    out[#out + 1] = { by_text(state.open_blockers(it)), 'ClandDim' }
  elseif it.assignee == 'you' and it.status ~= 'done' then
    out[#out + 1] = { 'you', 'ClandAmber' }
  end
  if status == 'done' and (filter == 'done') then
    local marks = {}
    for _, v in ipairs(state.verdict_marks(it)) do
      marks[#marks + 1] = (v.result == 'clear' and '✓ ' or '✗ ') .. v.kind
    end
    if #marks > 0 then
      out[#out + 1] = { table.concat(marks, ' · '), 'ClandGreen' }
    end
  end
  if state.item_ask(it.id) then
    out[#out + 1] = { ' ' }
    out[#out + 1] = { ' ? ', 'ClandBadge' }
  end
  return out
end

local function row(c, it, depth, filter)
  local g, ghl = M.glyph(it)
  local ind = depth == 0 and ' ' or '   '
  local title_hl = (it.map == 'decided' or state.item_status(it) == 'blocked') and 'ClandDim' or nil
  local left = { { ind }, { g, ghl }, { ' ' }, { D.pad(it.id, 5), 'ClandDim' }, { it.title, title_hl } }
  local right = M.right(it, filter)
  if #right > 0 then
    right[#right + 1] = { ' ' }
  end
  return c:add(left, right, { info = { item = it.id } })
end

local function section(c, text, n)
  c:add({ { ' ' .. text:upper() .. (n and (' · ' .. n) or ''), 'ClandSection' } }, nil, { info = { section = true } })
end

local function counts()
  local open, work = 0, 0
  for _, id in ipairs(state.S.item_order) do
    local it = state.S.items[id]
    if (it.kind == 'task' or (it.kind == 'question' and not it.map)) and it.status ~= 'done' then
      open = open + 1
      if it.status == 'progress' or it.status == 'review' or it.status == 'qa' then
        work = work + 1
      end
    end
  end
  return open, work
end

local function is_task(it)
  return it.kind == 'task' or (it.kind == 'question' and not it.map)
end

local function needs_you_groups()
  local asks, approvals, mine = {}, {}, {}
  for _, id in ipairs(state.S.item_order) do
    local it = state.S.items[id]
    if is_task(it) and it.status ~= 'done' then
      local s = it.claim and state.session(it.claim)
      if state.item_ask(id) then
        asks[#asks + 1] = it
      elseif s and s.state == 'waiting for approval' then
        approvals[#approvals + 1] = it
      elseif it.assignee == 'you' then
        mine[#mine + 1] = it
      end
    end
  end
  return asks, approvals, mine
end

function M.summary()
  local f = state.S.ui.filter
  if f == 'map' then
    local _, total = state.progress('M-1')
    return 'M-1 · ' .. total .. ' tickets'
  elseif f == 'work' then
    local _, work = counts()
    return work .. ' in work'
  elseif f == 'you' then
    local a, b, c = needs_you_groups()
    return (#a + #b + #c) .. ' need you'
  elseif f == 'done' then
    local n = 0
    for _, id in ipairs(state.S.item_order) do
      local it = state.S.items[id]
      n = n + ((is_task(it) and it.status == 'done') and 1 or 0)
    end
    return n .. ' done'
  end
  local open, work = counts()
  return open .. ' open · ' .. work .. ' in work'
end

local function body(c, filter)
  local S = state.S
  if filter == 'all' then
    for _, id in ipairs(S.item_order) do
      local it = S.items[id]
      if not it.parent then
        if it.kind == 'epic' or it.kind == 'map' then
          local folded = S.ui.folds[id]
          local left = { { ' ' }, { folded and '▸' or '▾', 'ClandDim' }, { ' ' }, { D.pad(it.id, 5), 'ClandDim' },
            { it.title, 'ClandBold' } }
          if it.kind == 'map' then
            local g, ghl = M.glyph(it)
            left = { { ' ' }, { folded and '▸' or '▾', 'ClandDim' }, { ' ' }, { D.pad(it.id, 5), 'ClandDim' },
              { it.title, 'ClandBold' }, { ' ' .. g, ghl } }
          end
          local right = M.right(it, filter)
          right[#right + 1] = { ' ' }
          c:add(left, right, { info = { item = id, fold = id } })
          if not folded then
            for _, cid in ipairs(state.children(id)) do
              row(c, S.items[cid], 1, filter)
            end
          end
        else
          row(c, it, 0, filter)
        end
      end
    end
  elseif filter == 'work' then
    local planned, blocked = {}, {}
    for _, id in ipairs(S.item_order) do
      local it = S.items[id]
      if is_task(it) then
        local st = state.item_status(it)
        if st == 'progress' or st == 'review' or st == 'qa' then
          row(c, it, 0, filter)
        elseif st == 'planned' then
          planned[#planned + 1] = it
        elseif st == 'blocked' then
          blocked[#blocked + 1] = it
        end
      end
    end
    if #planned > 0 then
      section(c, 'planned')
      for _, it in ipairs(planned) do
        row(c, it, 0, filter)
      end
    end
    if #blocked > 0 then
      section(c, 'blocked')
      for _, it in ipairs(blocked) do
        row(c, it, 0, filter)
      end
    end
  elseif filter == 'you' then
    local asks, approvals, mine = needs_you_groups()
    local any = false
    for _, g in ipairs({ { 'ask open', asks }, { 'approval in a session', approvals }, { 'for you', mine } }) do
      if #g[2] > 0 then
        any = true
        section(c, g[1])
        for _, it in ipairs(g[2]) do
          row(c, it, 0, filter)
        end
      end
    end
    if not any then
      c:add({ { ' ✓ nothing needs you', 'ClandGreen' } })
    end
  elseif filter == 'done' then
    for _, id in ipairs(S.item_order) do
      local it = S.items[id]
      if is_task(it) and it.status == 'done' then
        row(c, it, 0, filter)
      end
    end
  elseif filter == 'map' then
    local m = S.items['M-1']
    c:add({ { ' ' }, { '▾', 'ClandDim' }, { ' ' }, { D.pad(m.id, 5), 'ClandDim' }, { m.long or m.title, 'ClandBold' } }, nil,
      { info = { item = m.id } })
    local groups = { decided = {}, frontier = {}, subagent = {}, blocked = {} }
    for _, cid in ipairs(state.children('M-1')) do
      local it = S.items[cid]
      table.insert(groups[it.map], it)
    end
    for _, g in ipairs({ { 'decided', 'decided' }, { 'frontier', 'frontier' }, { 'subagent', 'in work by sub-agents' },
      { 'blocked', 'blocked' } }) do
      section(c, g[2], #groups[g[1]])
      for _, it in ipairs(groups[g[1]]) do
        row(c, it, 0, filter)
      end
    end
  end
end

function M.buf()
  if M.b and api.nvim_buf_is_valid(M.b) then
    return M.b
  end
  local b = D.scratch('items', 'items')
  M.b = b
  local function map(lhs, fn, desc)
    vim.keymap.set('n', lhs, fn, { buffer = b, nowait = true, silent = true, desc = 'cland-proto: ' .. desc })
  end
  map('<CR>', function()
    local id = M.item_at()
    if id then
      require('cland_proto.layout').show({ kind = 'item', id = id })
    end
  end, 'open the item in the centre')
  map('<2-LeftMouse>', function()
    local id = M.item_at()
    if id then
      require('cland_proto.layout').show({ kind = 'item', id = id })
    end
  end, 'open the item')
  for i, f in ipairs(M.FILTERS) do
    map(tostring(i), function()
      M.set_filter(f)
    end, 'filter: ' .. M.LABEL[f])
  end
  map('f', function()
    M.cycle(1)
  end, 'next filter')
  map('F', function()
    M.cycle(-1)
  end, 'previous filter')
  for _, k in ipairs({ '<Tab>', 'za' }) do
    map(k, function()
      M.toggle_fold()
    end, 'fold or unfold the epic')
  end
  map('c', function()
    M.claim()
  end, 'claim the item for a session')
  return b
end

function M.item_at()
  local inf = M.rows[api.nvim_win_get_cursor(0)[1]]
  return inf and inf.item
end

function M.set_filter(f)
  state.S.ui.filter = f
  state.S.ui.preset = nil
  state.changed('items filter: ' .. M.LABEL[f])
end

function M.cycle(step)
  local cur = 1
  for i, f in ipairs(M.FILTERS) do
    if f == state.S.ui.filter then
      cur = i
    end
  end
  M.set_filter(M.FILTERS[(cur - 1 + step) % #M.FILTERS + 1])
end

function M.toggle_fold()
  local id = M.item_at()
  local it = id and state.item(id)
  if not it then
    return
  end
  local target = (it.kind == 'epic' or it.kind == 'map') and id or it.parent
  if not target or state.S.ui.filter ~= 'all' then
    return
  end
  state.S.ui.folds[target] = not state.S.ui.folds[target] or nil
  M.keep = target
  state.changed((state.S.ui.folds[target] and 'folded ' or 'unfolded ') .. target)
end

-- c: claim the item for a session (the hub's task.claim, done for you).
function M.claim()
  local id = M.item_at()
  local it = id and state.item(id)
  if not it or it.kind ~= 'task' then
    vim.notify('cland-proto: put the cursor on a task to claim it', vim.log.levels.INFO)
    return
  end
  require('cland_proto.picker').open({
    kinds = { 'sessions' }, title = 'claim ' .. id .. ' for', on_choose = function(_, value)
      local s = state.session(value)
      if not s or not state.live(s) then
        vim.notify('cland-proto: ' .. tostring(value) .. ' is not running', vim.log.levels.WARN)
        return
      end
      it.claim, it.lost_claim = s.name, nil
      if it.status == 'backlog' or it.status == 'planned' then
        it.status = 'progress'
      end
      s.item = id
      local t = state.topic('agents')
      t.messages[#t.messages + 1] = { kind = 'event', at = state.now_min(), event = 'claim', text = s.name .. ' claimed ' .. id .. ' (by you)' }
      state.changed(s.name .. ' claimed ' .. id)
    end,
  })
end

function M.render(win)
  local b = M.buf()
  if not (win and api.nvim_win_is_valid(win)) then
    return
  end
  local keep = M.keep or M.item_at_win(win)
  M.keep = nil
  local W = api.nvim_win_get_width(win)
  local c = D.canvas(W)
  local f = state.S.ui.filter
  local tabs = { { ' ' } }
  local short = W < 42
  local SHORT = { all = 'all', work = 'work', you = 'you', done = 'done', map = 'map' }
  for _, k in ipairs(M.FILTERS) do
    tabs[#tabs + 1] = { ' ' .. (short and SHORT[k] or M.LABEL[k]) .. ' ', k == f and 'ClandTabOn' or 'ClandTab' }
  end
  c:add(tabs, nil, { info = { tabs = true } })
  c:add({ { ('─'):rep(W), 'ClandSectionRule' } })
  body(c, f)
  c:add({ { ('─'):rep(W), 'ClandSectionRule' } })
  c:add({ { ' ↵ open · gt topic · gs session · c claim', 'ClandDim' } })
  c:add({ { ' 1-5 or f filter · Tab fold · ␣i hides', 'ClandDim' } })
  c:push_down(vim.fn.winheight(win), 3)
  M.rows = c:apply(b, M.ns)
  -- keep the cursor on the same item across re-renders
  local target
  for r, inf in pairs(M.rows) do
    if keep and inf and inf.item == keep and (not target or r < target) then
      target = r
    end
  end
  if not target and not M.started then
    for r, inf in pairs(M.rows) do
      if inf and inf.item == 'T-12' then
        target = r
      end
    end
  end
  if not target and M.last_filter ~= f then
    -- another filter, and the item under the cursor is not in it: first item
    for r, inf in pairs(M.rows) do
      if inf and inf.item and (not target or r < target) then
        target = r
      end
    end
  end
  M.last_filter = f
  M.started = true
  if target then
    pcall(api.nvim_win_set_cursor, win, { target, 0 })
  end
  D.top_if_fits(win)
end

function M.item_at_win(win)
  local ok, cur = pcall(api.nvim_win_get_cursor, win)
  local inf = ok and M.rows[cur[1]]
  return inf and inf.item
end

return M
