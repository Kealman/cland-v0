-- Tracker-backed items: status and rank come from task summaries/events, levels from hub.status.
-- Asks, blockers and verdict marks remain badges; they never determine a task's workflow.
local state = require('cland.state')

local M = {}

M.FILTERS = { 'all', 'work', 'you', 'done', 'map' }
M.LABEL = { all = 'all', work = 'in work', you = 'needs you', done = 'done', map = 'map' }

--- An item's status as a glyph and its colour.
M.GLYPH = {
  backlog = { '○', 'ClandDim' }, planned = { '○', 'ClandText' },
  ['in progress'] = { '◐', 'ClandTeal' }, review = { '◉', 'ClandAmber' },
  qa = { '◉', 'ClandAmber' }, ready = { '◉', 'ClandGreen' }, done = { '●', 'ClandGreen' },
  open = { '○', 'ClandDim' }, closed = { '●', 'ClandGreen' },
}
M.WORDS = {}
for key in pairs(M.GLYPH) do M.WORDS[key] = key end

local function present(v)
  return v ~= nil and v ~= vim.NIL and v ~= ''
end
M.present = present

function M.num(id)
  return tonumber(tostring(id or ''):match('(%d+)')) or 0
end

-- Same comparator as hub/src/tracker/rank.ts; checked against the shared rank fixture.
function M.compare_rank(a, b)
  local ar = type(a.rank) == 'number' and a.rank or M.num(a.id) * 10
  local br = type(b.rank) == 'number' and b.rank or M.num(b.id) * 10
  if ar == br then return M.num(a.id) < M.num(b.id) end
  return ar < br
end

local function parent_key(it)
  return present(it.parent) and it.parent or ''
end

local function sort_siblings(out, parent)
  local order = state.S.sibling_orders[parent or '']
  local positions = {}
  for i, id in ipairs(order or {}) do positions[id] = i end
  table.sort(out, function(a, b)
    if positions[a.id] or positions[b.id] then return (positions[a.id] or math.huge) < (positions[b.id] or math.huge) end
    return M.compare_rank(a, b)
  end)
  return out
end

function M.all()
  local out = vim.list_extend({}, state.S.items)
  table.sort(out, M.compare_rank)
  -- Keep other parents' slots while applying each parent's final hub order to every surface.
  for parent in pairs(state.S.sibling_orders) do
    local slots, siblings = {}, {}
    for i, it in ipairs(out) do
      if parent_key(it) == parent then
        slots[#slots + 1], siblings[#siblings + 1] = i, it
      end
    end
    sort_siblings(siblings, parent)
    for i, slot in ipairs(slots) do out[slot] = siblings[i] end
  end
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

--- Children ordered by hub rank, or the final ordered siblings of a rank event.
function M.children(id)
  local out = {}
  for _, it in ipairs(state.S.items) do
    if parent_key(it) == (id or '') then
      out[#out + 1] = it
    end
  end
  return sort_siblings(out, id)
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

--- Planned through ready, including unclaimed work waiting between verifier holds (T-80).
function M.in_work(it)
  return it.kind == 'task' and vim.tbl_contains({ 'planned', 'in progress', 'review', 'qa', 'ready' }, it.status)
end

--- Tasks read their status verbatim. Other kinds have state, never workflow status.
function M.status(it)
  return present(it.status) and it.status or it.state
end

function M.glyph(it)
  if M.needs_you(it) then return '◆', 'ClandAmber' end
  if #M.open_blockers(it) > 0 and it.state ~= 'closed' then return '◌', 'ClandDim' end
  -- Questions/specs have no status; their claim is only a presentation badge.
  if it.kind ~= 'task' and it.state ~= 'closed' then
    if M.claim(it) then return '◐', 'ClandTeal' end
    if present(it.assignee) then return '◑', 'ClandTeal' end
  end
  local g = M.GLYPH[M.status(it)] or M.GLYPH.open
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

M.COLUMNS = {}
for _, status in ipairs({ 'backlog', 'planned', 'in progress', 'review', 'qa', 'ready', 'done' }) do
  M.COLUMNS[#M.COLUMNS + 1] = { status, status }
end

function M.column(it)
  return it.status
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
  if not id then return end
  local item = type(ev.item) == 'table' and ev.item or nil
  for i, it in ipairs(state.S.items) do
    if it.id == id then
      state.S.sibling_orders[parent_key(it)] = nil
      if item then state.S.items[i] = item else table.remove(state.S.items, i) end
      break
    end
  end
  if item and not state.item(id) then table.insert(state.S.items, item) end
  if item then
    state.S.sibling_orders[parent_key(item)] = nil
    if type(ev.siblings) == 'table' then state.S.sibling_orders[parent_key(item)] = ev.siblings end
  end
  state.changed()
end

-- SemVer precedence: build metadata does not affect scope; numeric identifiers precede text.
local function numeric_less(a, b)
  if #a ~= #b then return #a < #b end
  return a < b
end
local function version_less(a, b)
  if not present(a.version) then return false end
  if not present(b.version) then return true end
  local av, bv = a.version:match('^[^+]+'), b.version:match('^[^+]+')
  local ac, ap = av:match('^(%d+%.%d+%.%d+)%-?(.*)$')
  local bc, bp = bv:match('^(%d+%.%d+%.%d+)%-?(.*)$')
  local aa, bb = vim.split(ac, '.', { plain = true }), vim.split(bc, '.', { plain = true })
  for i = 1, 3 do if aa[i] ~= bb[i] then return numeric_less(aa[i], bb[i]) end end
  if ap == bp then return false end
  if ap == '' then return false end
  if bp == '' then return true end
  aa, bb = vim.split(ap, '.', { plain = true }), vim.split(bp, '.', { plain = true })
  for i = 1, math.min(#aa, #bb) do
    if aa[i] ~= bb[i] then
      local an, bn = aa[i]:match('^%d+$'), bb[i]:match('^%d+$')
      if an and bn then return numeric_less(aa[i], bb[i]) end
      if an or bn then return an ~= nil end
      return aa[i] < bb[i]
    end
  end
  return #aa < #bb
end

function M.open_releases()
  local out = {}
  for _, it in ipairs(state.S.items) do
    if it.kind == state.S.tracker.levels[1] and it.state == 'open' then out[#out + 1] = it end
  end
  table.sort(out, function(a, b)
    if version_less(a, b) then return true end
    if version_less(b, a) then return false end
    return M.num(a.id) < M.num(b.id)
  end)
  return out
end

function M.current_release()
  return M.open_releases()[1]
end

--- Walk the hub's parent tree; cycles and missing parents cannot establish release membership.
function M.release_of(it)
  local seen = {}
  while it and not seen[it.id] do
    seen[it.id] = true
    if it.kind == state.S.tracker.levels[1] then return it.state == 'open' and it or nil end
    it = present(it.parent) and state.item(it.parent) or nil
  end
end

function M.in_release(it)
  local release, current = M.release_of(it), M.current_release()
  return release ~= nil and current ~= nil and release.id == current.id
end

function M.done(it)
  return it.kind == 'task' and it.status == 'done' and M.in_release(it)
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
    if f == 'all' or (f == 'work' and M.in_work(it) and (M.in_release(it) or not M.release_of(it))) or (f == 'you' and M.needs_you(it)) or (f == 'done' and M.done(it)) then
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

--- Container kinds come from the hub; maps sit outside the configured ladder.
function M.is_container(it)
  return it.kind == 'map' or vim.tbl_contains(state.S.tracker.levels, it.kind)
end

function M.folded(it)
  local override = state.S.ui.items_folds[it.id]
  if override ~= nil then return override end
  if it.state == 'closed' then return true end
  local current = M.current_release()
  return it.kind == state.S.tracker.levels[1] and (not current or current.id ~= it.id)
end

local function set_fold(folded)
  local info = require('cland.panels').row_at(vim.api.nvim_get_current_buf(), vim.api.nvim_win_get_cursor(0)[1])
  local it = info and state.item(info.item)
  if it and M.is_container(it) then
    if folded == nil then folded = not M.folded(it) end
    state.S.ui.items_folds[it.id] = folded
    state.changed()
  end
end

local function row(c, it, depth)
  local g, ghl = M.glyph(it)
  local kids = #M.children(it.id) > 0
  local container = kids or M.is_container(it)
  local title_hl = it.state == 'closed' and 'ClandDim' or (container and 'ClandBold' or nil)
  local fold = container and (M.folded(it) and '▸ ' or '▾ ') or ''
  c:add(
    { { ' ' .. ('  '):rep(depth) .. fold }, { g, ghl }, { ' ' }, { it.id, 'ClandDim' }, { ' ' .. (it.title or ''), title_hl } },
    right_of(it, container),
    { item = it.id }
  )
end

local function tree(c, it, depth, seen, hidden)
  if seen[it.id] then
    return
  end
  seen[it.id] = true
  if not hidden then row(c, it, depth) end
  hidden = hidden or (M.is_container(it) and M.folded(it))
  for _, k in ipairs(M.children(it.id)) do
    tree(c, k, depth + 1, seen, hidden)
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
    local known, seen, roots, unscheduled = {}, {}, {}, {}
    for _, it in ipairs(list) do known[it.id] = true end
    for _, it in ipairs(list) do
      if not (present(it.parent) and known[it.parent]) then
        if M.release_of(it) then roots[#roots + 1] = it else unscheduled[#unscheduled + 1] = it end
      end
    end
    for _, it in ipairs(sort_siblings(roots)) do tree(c, it, 0, seen) end
    section(c, 'unscheduled', #unscheduled)
    for _, it in ipairs(sort_siblings(unscheduled)) do tree(c, it, 0, seen) end
    -- Cyclic legacy parents have no root: put their nodes in unscheduled, once each.
    for _, it in ipairs(list) do
      if not seen[it.id] then tree(c, it, 0, seen) end
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
    local test = f == 'work' and M.in_work or (f == 'you' and M.needs_you or M.done)
    local n, unscheduled = 0, {}
    for _, it in ipairs(list) do
      if test(it) then
        if f == 'work' and not M.in_release(it) then
          if not M.release_of(it) then unscheduled[#unscheduled + 1] = it end
        else
          n = n + 1
          row(c, it, 0)
        end
      end
    end
    if #unscheduled > 0 then
      section(c, 'unscheduled', #unscheduled)
      for _, it in ipairs(unscheduled) do row(c, it, 0) end
      n = n + #unscheduled
    end
    if n == 0 then
      c:add({ { f == 'you' and ' ✓ nothing needs you' or (' nothing ' .. M.LABEL[f]), f == 'you' and 'ClandGreen' or 'ClandDim' } })
    end
  end
  return { ' ↵ open · gt topic · gs session', ' 1-5 or f filter · za fold · ␣b board' }
end

--- The panel's keys (its buffer): the filters.
function M.keys(buf)
  local function map(lhs, fn, desc)
    require('cland.actions').map('n', lhs, fn, { buffer = buf, nowait = true, silent = true, desc = 'cland: ' .. desc })
  end
  for i, f in ipairs(M.FILTERS) do
    map(tostring(i), function()
      M.set_filter(f)
    end, 'items filter: ' .. M.LABEL[f])
  end
  map('za', function() set_fold(nil) end, 'toggle item tree fold')
  map('zo', function() set_fold(false) end, 'open item tree fold')
  map('zc', function() set_fold(true) end, 'close item tree fold')
  map('f', function()
    M.cycle(1)
  end, 'next items filter')
  map('F', function()
    M.cycle(-1)
  end, 'previous items filter')
end

return M
