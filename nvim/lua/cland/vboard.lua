-- One hub-backed composition for the vertical items panel and the centre status columns.
local api = vim.api
local state = require('cland.state')
local items = require('cland.items')
local M = {}
M.SECTIONS = { 'in progress', 'review', 'qa', 'ready', 'planned' }

function M.under(it, id)
  local seen = {}
  while it and not seen[it.id] do
    if it.id == id then return true end
    seen[it.id] = true
    it = items.present(it.parent) and state.item(it.parent) or nil
  end
  return false
end

local function open_parents(it)
  local seen = {}
  it = items.present(it.parent) and state.item(it.parent) or nil
  while it and not seen[it.id] do
    seen[it.id] = true
    if it.state ~= 'open' then return false end
    it = items.present(it.parent) and state.item(it.parent) or nil
  end
  return true
end

function M.parents()
  local scope, out = items.scope(), {}
  for _, it in ipairs(items.ordered()) do
    if scope and it.id ~= scope.id and items.is_level(it) and it.state == 'open'
      and M.under(it, scope.id) and open_parents(it) then out[#out + 1] = it end
  end
  return out
end

function M.parent_filter()
  for _, it in ipairs(M.parents()) do
    if it.id == state.S.ui.board_parent then return it.id end
  end
  state.S.ui.board_parent = nil
end

function M.cycle_parent(step)
  local parents, current, at = M.parents(), M.parent_filter(), 0
  for i, it in ipairs(parents) do if it.id == current then at = i end end
  at = (at + step) % (#parents + 1)
  state.S.ui.board_parent = at > 0 and parents[at].id or nil
  state.changed()
end

function M.compose()
  local scope, parent = items.scope(), M.parent_filter()
  local out = { scope = scope, columns = {}, unscheduled = {}, done = 0, work = 0, leaves = {} }
  for _, s in ipairs(items.COLUMNS) do out.columns[s[1]] = {} end
  for _, it in ipairs(items.ordered()) do
    if scope and it.id == scope.id then
      -- The scope has its own header, never a duplicate background fold.
    elseif scope and M.under(it, scope.id) then
      if not parent or M.under(it, parent) then
        if it.kind == 'task' and it.status == 'done' then out.done = out.done + 1 end
        if open_parents(it) then
          if it.kind == 'task' and out.columns[it.status] then
            table.insert(out.columns[it.status], it)
            if items.in_work(it) then out.work = out.work + 1 end
          elseif not items.is_container(it) then out.leaves[#out.leaves + 1] = it end
        end
      end
    elseif items.unscheduled(it) then
      out.unscheduled[#out.unscheduled + 1] = it
    end
  end
  -- Mark the next task before presentation filters, so narrowing never invents another priority.
  for _, it in ipairs(out.columns.planned) do
    if #items.open_blockers(it) == 0 then out.next = it.id; break end
  end
  return out
end

--- One source for panel rows, board cards and graph nodes: hub verification marks.
function M.fraction(it)
  local d = require('cland.item_view').get(it.id)
  return require('cland.criteria').fraction(d and d.criteria)
end

local function verdict_mark(v)
  return { (v.result == 'clear' and '✓ ' or '✗ ') .. v.verdict,
    v.result ~= 'clear' and 'ClandRed' or (v.current == false and 'ClandDim' or 'ClandGreen') }
end

function M.who(it)
  local list = type(it.verdicts) == 'table' and it.verdicts or {}
  local last, c = list[#list], items.claim(it)
  if last and last.result == 'not clear' then return { verdict_mark(last) } end
  -- The verifier hold owns review/QA, even while the Implementer's claim remains live.
  for _, hold in ipairs(type(it.holds) == 'table' and it.holds or {}) do
    if (it.status == 'review' and hold.role == 'reviewer') or (it.status == 'qa' and hold.role == 'qa') then
      return { { hold.session, 'ClandTeal' } }
    end
  end
  if it.status == 'review' then return { { 'for Reviewer', 'ClandDim' } } end
  if it.status == 'ready' then return items.marks(it) end
  if c then return { { items.lead_label(it) or c.session, 'ClandTeal' } } end
  if last then return { verdict_mark(last) } end
  if items.present(it.assignee) then return { { it.assignee, 'ClandDim' } } end
  return {}
end

local function row(c, it, bucket, next_id)
  local g = items.GLYPH[items.status(it)] or items.GLYPH.open
  if it.kind ~= 'task' then local glyph, group = items.glyph(it); g = { glyph, group } end
  if (it.status == 'planned' or it.kind ~= 'task') and it.state ~= 'closed' and #items.open_blockers(it) > 0 then g = { '◌', 'ClandDim' } end
  local parent = items.present(it.parent) and state.item(it.parent)
  local left = { { ' ' }, { g[1], g[2] }, { ' ' .. it.id .. ' ', 'ClandDim' } }
  if parent then left[#left + 1] = { parent.id .. ' › ', 'ClandDim' } end
  left[#left + 1] = { it.title or '', items.is_container(it) and 'ClandBold' or 'ClandText' }
  local right = {}
  local function put(chunk)
    if #right > 0 then right[#right + 1] = { ' ' } end
    right[#right + 1] = chunk
  end
  if it.id == next_id then put({ 'next', 'ClandTeal' }) end
  for _, chunk in ipairs(M.who(it)) do put(chunk) end
  if items.asks(it) > 0 then put({ '?' .. (items.asks(it) > 1 and items.asks(it) or ''), 'ClandBadge' }) end
  if it.kind == 'task' and items.in_work(it) then
    local checked, total = M.fraction(it)
    if total > 0 then put({ checked .. '/' .. total, checked == total and 'ClandGreen' or 'ClandDim' }) end
  end
  if items.is_container(it) then
    local kids, done = items.children(it.id), 0
    for _, child in ipairs(kids) do if child.state == 'closed' then done = done + 1 end end
    put({ done .. '/' .. #kids, 'ClandDim' })
  end
  c:add(left, right, { item = it.id, list = bucket })
  if M.follow == it.id then c.cursor_to = #c.lines; M.follow = nil end
end

local function selected(it, filter)
  if filter == 'work' then return items.in_work(it) end
  if filter == 'you' then return items.needs_you(it) end
  if filter == 'done' then return it.kind == 'task' and it.status == 'done' end
  return true
end

local function fold(c, key, label, list, filter, next_id)
  local shown = vim.tbl_filter(function(it) return selected(it, filter) end, list)
  local closed = state.S.ui.items_folds[key] ~= false
  c:add({ { ' ' .. (closed and '▸ ' or '▾ ') .. label .. ' (' .. #shown .. ')', 'ClandSection' } }, nil, { fold = key })
  if M.follow_fold == key then c.cursor_to = #c.lines; M.follow_fold = nil end
  if not closed then for _, it in ipairs(shown) do row(c, it, key, next_id) end end
end

function M.summary()
  local b, f = M.compose(), items.filter()
  if f == 'board' then return 'board · ' .. b.work .. ' in work · ' .. b.done .. ' done' end
  if f == 'map' then return nil end
  local n = 0
  if f == 'you' then
    for _, it in ipairs(items.ordered()) do if items.needs_you(it) then n = n + 1 end end
  elseif f == 'done' then n = b.done else
    for _, list in pairs(b.columns) do for _, it in ipairs(list) do if selected(it, f) then n = n + 1 end end end
    for _, it in ipairs(b.unscheduled) do if selected(it, f) then n = n + 1 end end
  end
  return items.LABEL[f] .. ' · ' .. n
end

function M.render(c)
  local b, f = M.compose(), items.filter()
  local tabs = { { ' epic ', 'ClandDim' }, { 'all', not M.parent_filter() and 'ClandTabOn' or 'ClandTab' } }
  for _, it in ipairs(M.parents()) do tabs[#tabs + 1] = { ' · ' .. it.id .. ' ' .. it.title, state.S.ui.board_parent == it.id and 'ClandTabOn' or 'ClandTab' } end
  c:add(tabs, nil, { epic_tabs = true })
  if b.scope then
    local kids, done = items.children(b.scope.id), 0
    for _, it in ipairs(kids) do if it.state == 'closed' then done = done + 1 end end
    local right, lead = {}, items.lead_label(b.scope)
    if lead then right[#right + 1] = { lead .. ' ', 'ClandTeal' } end
    right[#right + 1] = { done .. '/' .. #kids, 'ClandDim' }
    c:add({ { ' ' .. b.scope.id .. ' ' .. b.scope.title, 'ClandBold' } }, right, { item = b.scope.id })
  else c:add({ { ' no open container: unscheduled', 'ClandDim' } }) end
  if f == 'you' then
    local any = false
    for _, it in ipairs(items.ordered()) do if items.needs_you(it) then row(c, it, 'you'); any = true end end
    if not any then c:add({ { ' ✓ nothing needs you', 'ClandGreen' } }) end
  elseif f == 'done' then
    c:add({ { ' DONE · ' .. b.done, 'ClandSection' } }, nil, { section = 'done' })
    -- Done counts all tasks in scope, including tasks under a closed epic.
    for _, it in ipairs(items.ordered()) do
      if b.scope and it.kind == 'task' and it.status == 'done' and M.under(it, b.scope.id)
        and (not M.parent_filter() or M.under(it, M.parent_filter())) then row(c, it, 'done') end
    end
  else
    for _, status in ipairs(M.SECTIONS) do
      local list = vim.tbl_filter(function(it) return selected(it, f) end, b.columns[status])
      c:add({ { ' ' .. status:upper() .. ' · ' .. #list, #list > 0 and 'ClandSection' or 'ClandFaint' } }, nil, { section = status })
      for _, it in ipairs(list) do row(c, it, status, b.next) end
    end
    if f == 'board' then
      fold(c, 'backlog', 'backlog', b.columns.backlog, f)
      if #b.leaves > 0 then fold(c, 'leaves', 'questions and specs', b.leaves, f) end
    end
    fold(c, 'unscheduled', 'unscheduled', b.unscheduled, f)
  end
  return { ' K J rank · T top · ↵ open · za fold', ' e E scope · p P epic · 1-6 or f · gi gt gs' }
end

local function info_at()
  return require('cland.panels').row_at(api.nvim_get_current_buf(), api.nvim_win_get_cursor(0)[1])
end

function M.fold(how)
  if how == 'all open' or how == 'all closed' then
    for _, key in ipairs({ 'backlog', 'unscheduled', 'leaves' }) do state.S.ui.items_folds[key] = how == 'all closed' end
    for _, it in ipairs(items.ordered()) do
      if items.is_container(it) or #items.children(it.id) > 0 then state.S.ui.items_folds[it.id] = how == 'all closed' end
    end
  else
    local info = info_at()
    local key = info and (info.fold or (info.list and not vim.tbl_contains(M.SECTIONS, info.list) and info.list))
    if not key then return state.say('za folds backlog, unscheduled and tree containers') end
    state.S.ui.items_folds[key] = how == 'toggle' and state.S.ui.items_folds[key] == false or how == 'close'
    M.follow_fold = key
  end
  state.changed()
end

function M.rank(step)
  local info = info_at()
  local it = info and info.item and state.item(info.item)
  if it and it.kind == state.S.tracker.levels[1] then return state.say('top-level containers do not carry rank') end
  if not it or (it.kind ~= 'task' and not items.is_level(it)) then return end
  local request = { type = 'task.rank', item = it.id }
  if step == 0 then request.top = true else
    local siblings, at = items.children(items.present(it.parent) and it.parent or nil)
    for i, sibling in ipairs(siblings) do if sibling.id == it.id then at = i end end
    local other = at and siblings[at + step]
    if not other then return state.say(it.id .. ' is already ' .. (step < 0 and 'first' or 'last')) end
    request[step < 0 and 'before' or 'after'] = other.id
  end
  local client = require('cland').client
  if not (client and client:connected()) then return state.say('rank needs a connected hub', 'ClandAmberBar') end
  M.follow = it.id
  client:request(request, function(err)
    if err then M.follow = nil; state.say('rank: ' .. tostring(err), 'ClandRedBar') end
    -- Only task events update ranks and final sibling order. A result alone never moves a row.
  end)
end

function M.keys(buf)
  local function map(lhs, fn)
    require('cland.actions').map('n', lhs, fn, { buffer = buf, nowait = true, silent = true })
  end
  map('K', function() M.rank(-1) end)
  map('J', function() M.rank(1) end)
  map('T', function() M.rank(0) end)
  map('e', function() items.cycle_scope(1) end)
  map('E', function() items.cycle_scope(-1) end)
  map('p', function() M.cycle_parent(1) end)
  map('P', function() M.cycle_parent(-1) end)
  for lhs, how in pairs({ za = 'toggle', zo = 'open', zc = 'close', zR = 'all open', zM = 'all closed' }) do map(lhs, function() M.fold(how) end) end
  map('<Tab>', function() M.cycle_parent(1) end)
  map('<S-Tab>', function() M.cycle_parent(-1) end)
end
return M
