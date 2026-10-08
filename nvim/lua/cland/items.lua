-- The items (spec section 5, #36): what the panel, the item view, the board and the picker derive from the
-- tracker's summaries (`task.list`, the `task` event). Nothing here is stored: every status, filter, map group
-- and board column is computed from an item's state, claim, assignee, labels, blocking edges and verdicts,
-- and from the open asks in the bound topic (the inbox, #33).
--
-- The panel (␣i): a tree of epics and items by `parent`, orphans at the root, ordered by id; filters all,
-- in work, needs you, done and map, set with 1–5 or cycled with f / F.
local api = vim.api
local state = require('cland.state')

local M = {}

M.FILTERS = { 'all', 'work', 'you', 'done', 'map' }
M.LABEL = { all = 'all', work = 'in work', you = 'needs you', done = 'done', map = 'map' }

--- An item's status as a glyph and its colour.
M.GLYPH = {
  closed = { '●', 'ClandGreen' },
  you = { '◆', 'ClandAmber' },
  claimed = { '◐', 'ClandTeal' },
  assigned = { '◑', 'ClandTeal' },
  blocked = { '◌', 'ClandDim' },
  open = { '○', 'ClandDim' },
}
M.WORDS = { closed = 'closed', you = 'needs you', claimed = 'in work', assigned = 'assigned', blocked = 'blocked', open = 'open' }

local function present(v)
  return v ~= nil and v ~= vim.NIL and v ~= ''
end
M.present = present

function M.num(id)
  return tonumber(tostring(id or ''):match('(%d+)')) or 0
end

local function by_id(a, b)
  return M.num(a.id) < M.num(b.id)
end

--- Every item, ordered by id.
function M.all()
  local out = {}
  for _, it in ipairs(state.S.items) do
    out[#out + 1] = it
  end
  table.sort(out, by_id)
  return out
end

function M.claim(it)
  local c = it and it.claim
  return (type(c) == 'table' and present(c.session)) and c or nil
end

--- The latest verdict of `kind` (review | qa), or nil: `verdicts` is in file order, the latest last.
function M.latest(it, kind)
  local list = type(it.verdicts) == 'table' and it.verdicts or {}
  for i = #list, 1, -1 do
    if list[i].verdict == kind then
      return list[i]
    end
  end
end

local function has_label(it, label)
  for _, l in ipairs(type(it.labels) == 'table' and it.labels or {}) do
    if l == label then
      return true
    end
  end
  return false
end

--- The blockers still open: an id the tracker does not know counts as open (it is not known to be done).
function M.open_blockers(it)
  local out = {}
  for _, b in ipairs(type(it.blocked_by) == 'table' and it.blocked_by or {}) do
    local other = state.item(b)
    if not other or other.state ~= 'closed' then
      out[#out + 1] = b
    end
  end
  return out
end

--- The items whose `blocked_by` names `id`.
function M.blocks(id)
  local out = {}
  for _, it in ipairs(M.all()) do
    for _, b in ipairs(type(it.blocked_by) == 'table' and it.blocked_by or {}) do
      if b == id then
        out[#out + 1] = it.id
      end
    end
  end
  return out
end

--- The children of `id` (by `parent`), ordered by id.
function M.children(id)
  local out = {}
  for _, it in ipairs(M.all()) do
    if it.parent == id then
      out[#out + 1] = it
    end
  end
  return out
end

--- The topic bound to the item: the item's `topic` field, else a topic whose binding names it.
function M.topic(it)
  if present(it.topic) then
    return state.topic(it.topic) or { id = it.topic, title = it.topic }
  end
  return state.topic_of_item(it.id)
end

--- Open asks on the item's topic: the inbox's asks (#33) in the topic bound to it.
function M.asks(it)
  local t = M.topic(it)
  if not t then
    return 0
  end
  local n = 0
  for _, a in ipairs((state.S.inbox or {}).asks or {}) do
    if type(a.topic) == 'table' and a.topic.id == t.id then
      n = n + 1
    end
  end
  return n
end

--- Open, and an ask waits on it or its latest review or QA verdict is not clear.
function M.needs_you(it)
  if it.state == 'closed' then
    return false
  end
  if M.asks(it) > 0 then
    return true
  end
  for _, k in ipairs({ 'review', 'qa' }) do
    local v = M.latest(it, k)
    if v and v.result == 'not clear' then
      return true
    end
  end
  return false
end

--- Open and claimed by a session or assigned.
function M.in_work(it)
  return it.state ~= 'closed' and (M.claim(it) ~= nil or present(it.assignee))
end

--- closed | you | claimed | assigned | blocked | open.
function M.status(it)
  if it.state == 'closed' then
    return 'closed'
  elseif M.needs_you(it) then
    return 'you'
  elseif M.claim(it) then
    return 'claimed'
  elseif #M.open_blockers(it) > 0 then
    return 'blocked'
  elseif present(it.assignee) then
    return 'assigned'
  end
  return 'open'
end

function M.glyph(it)
  local g = M.GLYPH[M.status(it)]
  return g[1], g[2]
end

--- The wayfinder grouping of a map's child: decided (closed), in work by sub-agents (claimed or assigned),
--- blocked (an open blocker), frontier (open, no assignee, no claim, no open blocker).
M.MAP_GROUPS = { { 'decided', 'decided' }, { 'frontier', 'frontier' }, { 'work', 'in work by sub-agents' }, { 'blocked', 'blocked' } }

function M.map_group(it)
  if it.state == 'closed' then
    return 'decided'
  elseif M.claim(it) or present(it.assignee) then
    return 'work'
  elseif #M.open_blockers(it) > 0 then
    return 'blocked'
  end
  return 'frontier'
end

--- The board's column (nvim/README.md, "The board"), first match wins: closed → done; the latest review
--- verdict clear, or the label `qa` → qa; the latest review verdict not clear, or the label `review` → review;
--- claimed → in progress; assigned → planned; else backlog. No workflow status is stored anywhere.
M.COLUMNS = { { 'backlog', 'backlog' }, { 'planned', 'planned' }, { 'progress', 'in progress' }, { 'review', 'review' }, { 'qa', 'qa' }, { 'done', 'done' } }

function M.column(it)
  if it.state == 'closed' then
    return 'done'
  end
  local review = M.latest(it, 'review')
  if (review and review.result == 'clear') or has_label(it, 'qa') then
    return 'qa'
  elseif (review and review.result == 'not clear') or has_label(it, 'review') then
    return 'review'
  elseif M.claim(it) then
    return 'progress'
  elseif present(it.assignee) then
    return 'planned'
  end
  return 'backlog'
end

--- The verdict marks of a card or a row: `✓ review`, `✗ qa`, the latest of each kind.
function M.marks(it)
  local out = {}
  for _, k in ipairs({ 'review', 'qa' }) do
    local v = M.latest(it, k)
    if v then
      out[#out + 1] = { (v.result == 'clear' and '✓ ' or '✗ ') .. k, v.result == 'clear' and 'ClandGreen' or 'ClandRed' }
    end
  end
  return out
end

--- A `task` event: the item as `task.list` shows it, or null when its file is gone.
function M.apply_event(ev)
  local id = ev and ev.id
  if not id then
    return
  end
  local item = ev.item ~= vim.NIL and ev.item or nil
  for i, it in ipairs(state.S.items) do
    if it.id == id then
      if item then
        state.S.items[i] = item
      else
        table.remove(state.S.items, i)
      end
      state.changed()
      return
    end
  end
  if item then
    table.insert(state.S.items, item)
    table.sort(state.S.items, by_id)
    state.changed()
  end
end

-- The panel ---------------------------------------------------------------------------------------------

function M.filter()
  return state.S.ui.items_filter or 'all'
end

function M.set_filter(f)
  state.S.ui.items_filter = f
  state.say('items: ' .. M.LABEL[f])
  state.changed()
end

function M.cycle(step)
  local cur = 1
  for i, f in ipairs(M.FILTERS) do
    if f == M.filter() then
      cur = i
    end
  end
  M.set_filter(M.FILTERS[(cur - 1 + step) % #M.FILTERS + 1])
end

--- The panel header's summary for the current filter.
function M.summary()
  local f, n = M.filter(), 0
  for _, it in ipairs(state.S.items) do
    if f == 'all' or (f == 'work' and M.in_work(it)) or (f == 'you' and M.needs_you(it)) or (f == 'done' and it.state == 'closed') then
      n = n + 1
    end
  end
  if f == 'map' then
    local maps = 0
    for _, it in ipairs(state.S.items) do
      maps = maps + (it.kind == 'map' and 1 or 0)
    end
    return 'map · ' .. maps .. (maps == 1 and ' map' or ' maps')
  end
  return M.LABEL[f] .. ' · ' .. n
end

--- The right side of a row: the claiming session (or the assignee), the verdict marks on closed items, the ask badge.
local function right_of(it, container)
  local out = {}
  if container then
    local kids = M.children(it.id)
    local done = 0
    for _, k in ipairs(kids) do
      done = done + (k.state == 'closed' and 1 or 0)
    end
    out[#out + 1] = { done .. '/' .. #kids, 'ClandDim' }
  else
    local c = M.claim(it)
    if c then
      out[#out + 1] = { c.session, 'ClandTeal' }
    elseif it.state ~= 'closed' and present(it.assignee) then
      out[#out + 1] = { it.assignee, 'ClandDim' }
    end
  end
  local asks = M.asks(it)
  if asks > 0 then
    out[#out + 1] = { ' ' }
    out[#out + 1] = { ' ' .. asks .. ' ', 'ClandBadge' }
  end
  if #out > 0 then
    out[#out + 1] = { ' ' }
  end
  return out
end

local function row(c, it, depth)
  local g, ghl = M.glyph(it)
  local kids = #M.children(it.id) > 0
  local container = kids or it.kind == 'epic' or it.kind == 'map'
  local title_hl = it.state == 'closed' and 'ClandDim' or (container and 'ClandBold' or nil)
  c:add(
    { { ' ' .. ('  '):rep(depth) }, { g, ghl }, { ' ' }, { it.id, 'ClandDim' }, { ' ' .. (it.title or ''), title_hl } },
    right_of(it, container),
    { item = it.id }
  )
end

local function tree(c, it, depth, seen)
  if seen[it.id] then
    return
  end
  seen[it.id] = true
  row(c, it, depth)
  for _, k in ipairs(M.children(it.id)) do
    tree(c, k, depth + 1, seen)
  end
end

local function section(c, text, n, group)
  c:add({ { ' ' .. text:upper() .. (n and (' · ' .. n) or ''), group or 'ClandSection' } })
end

--- Draw the panel's rows into canvas `c` (panels.lua); returns the footer lines.
function M.render(c)
  local f = M.filter()
  local tabs = { { ' ' } }
  local short = c.width < 44
  for i, k in ipairs(M.FILTERS) do
    local label = short and ({ all = 'all', work = 'work', you = 'you', done = 'done', map = 'map' })[k] or M.LABEL[k]
    tabs[#tabs + 1] = { i .. ' ' .. label, k == f and 'ClandTabOn' or 'ClandTab' }
    tabs[#tabs + 1] = { ' ' }
  end
  c:add(tabs)
  local list = M.all()
  if #list == 0 then
    c:add({ { ' ' .. (state.S.items_note or 'No items in .cland/tasks yet.'), 'ClandDim' } })
  elseif f == 'all' then
    local known, seen = {}, {}
    for _, it in ipairs(list) do
      known[it.id] = true
    end
    for _, it in ipairs(list) do
      if not (present(it.parent) and known[it.parent]) then
        tree(c, it, 0, seen)
      end
    end
    -- a parent cycle leaves items no root reaches: show them at the root
    for _, it in ipairs(list) do
      if not seen[it.id] then
        tree(c, it, 0, seen)
      end
    end
  elseif f == 'map' then
    local any = false
    for _, m in ipairs(list) do
      if m.kind == 'map' then
        any = true
        local groups = { decided = {}, frontier = {}, work = {}, blocked = {} }
        for _, k in ipairs(M.children(m.id)) do
          table.insert(groups[M.map_group(k)], k)
        end
        row(c, m, 0)
        for _, g in ipairs(M.MAP_GROUPS) do
          section(c, g[2], #groups[g[1]], g[1] == 'frontier' and 'ClandAmber' or nil)
          for _, k in ipairs(groups[g[1]]) do
            row(c, k, 1)
          end
        end
      end
    end
    if not any then
      c:add({ { ' No map item (kind: map) yet.', 'ClandDim' } })
    end
  else
    local test = f == 'work' and M.in_work or (f == 'you' and M.needs_you or function(it)
      return it.state == 'closed'
    end)
    local n = 0
    for _, it in ipairs(list) do
      if test(it) then
        n = n + 1
        row(c, it, 0)
      end
    end
    if n == 0 then
      c:add({ { f == 'you' and ' ✓ nothing needs you' or (' nothing ' .. M.LABEL[f]), f == 'you' and 'ClandGreen' or 'ClandDim' } })
    end
  end
  return { ' ↵ open · gt topic · gs session', ' 1-5 or f filter · ␣b board' }
end

--- The panel's keys (its buffer): the filters.
function M.keys(buf)
  local function map(lhs, fn, desc)
    vim.keymap.set('n', lhs, fn, { buffer = buf, nowait = true, silent = true, desc = 'cland: ' .. desc })
  end
  for i, f in ipairs(M.FILTERS) do
    map(tostring(i), function()
      M.set_filter(f)
    end, 'items filter: ' .. M.LABEL[f])
  end
  map('f', function()
    M.cycle(1)
  end, 'next items filter')
  map('F', function()
    M.cycle(-1)
  end, 'previous items filter')
end

--- Whether the items are on screen (the panel, the board, an item view): they refresh at least each second.
function M.visible()
  local layout = require('cland.layout')
  local v = state.S.ui.view
  return (layout.win and layout.win.left and api.nvim_win_is_valid(layout.win.left)) or v.kind == 'board' or v.kind == 'item'
end

return M
