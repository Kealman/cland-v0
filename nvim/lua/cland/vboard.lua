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

local function narrowing(options)
  if options then return options.parent, options.direct end
  return M.parent_filter(), false
end

local function within(it, scope, parent, direct)
  return scope and it.id ~= scope.id and M.under(it, scope.id)
    and (not parent or M.under(it, parent)) and (not direct or it.parent == scope.id)
end

function M.compose(options)
  local scope = items.scope()
  local parent, direct = narrowing(options)
  local out = { scope = scope, columns = {}, unscheduled = {}, done = 0, work = 0, leaves = {} }
  for _, s in ipairs(items.COLUMNS) do out.columns[s[1]] = {} end
  for _, it in ipairs(items.ordered()) do
    if scope and it.id == scope.id then
      -- The scope has its own header, never a duplicate background fold.
    elseif scope and M.under(it, scope.id) then
      if within(it, scope, parent, direct) then
        if it.kind == 'task' and it.status == 'done' then out.done = out.done + 1 end
        if open_parents(it) then
          if it.kind == 'task' and out.columns[it.status] then
            table.insert(out.columns[it.status], it)
            if items.in_work(it) then out.work = out.work + 1 end
          elseif not items.is_container(it) then out.leaves[#out.leaves + 1] = it end
        end
      end
    elseif not scope and items.unscheduled(it) and not items.is_level(it) then
      out.unscheduled[#out.unscheduled + 1] = it
    end
  end
  -- Mark the next task before presentation filters, so narrowing never invents another priority.
  for _, it in ipairs(out.columns.planned) do
    if #items.open_blockers(it) == 0 then out.next = it.id; break end
  end
  return out
end

-- The vertical panel may promote foreground rows inside its selected scope. The centre
-- board uses compose() directly and always retains its open-parent boundary.
local function panel_composition(options)
  local out = M.compose(options)
  local parent, direct = narrowing(options)
  if not out.scope then return out end
  local present, columns = {}, {}
  for status, list in pairs(out.columns) do
    columns[status] = {}
    for _, it in ipairs(list) do present[it.id] = true end
  end
  for _, it in ipairs(items.ordered()) do
    local promoted = within(it, out.scope, parent, direct) and not open_parents(it)
      and (it.layer == 'now' or it.layer == 'watch' or (options and it.status == 'done'))
    if it.kind == 'task' and columns[it.status] and (present[it.id] or promoted) then
      columns[it.status][#columns[it.status] + 1] = it
      if promoted and items.in_work(it) then out.work = out.work + 1 end
    elseif promoted and not items.is_container(it) then
      out.leaves[#out.leaves + 1] = it
    end
  end
  out.columns, out.next = columns, nil
  -- The release owns next, even when a tab or unfolded group narrows the rows.
  for _, it in ipairs(items.ordered()) do
    if within(it, out.scope) and it.status == 'planned'
      and (open_parents(it) or it.layer == 'now' or it.layer == 'watch')
      and #items.open_blockers(it) == 0 then out.next = it.id; break end
  end
  return out
end

--- Panel rows, board cards and graph nodes read the hub's summary counts.
function M.fraction(it)
  local counts = type(it.criteria) == 'table' and it.criteria or {}
  return counts.verified or 0, counts.total or 0, counts.stale or 0
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
  local plan = require('cland.plan')
  local epic = plan.owner(it.id)
  local tag = epic and plan.stage_tag(epic, it.id)
  if parent then left[#left + 1] = { (tag or parent.id) .. ' › ', 'ClandDim' } end
  if epic and plan.changes(epic).items[it.id] then left[#left + 1] = { '△ ', 'ClandPlanChange' } end
  left[#left + 1] = { it.title or '', (it.state == 'closed' or it.status == 'done') and 'ClandDone' or (items.is_container(it) and 'ClandBold' or 'ClandText') }
  local right = {}
  local function put(chunk)
    if #right > 0 then right[#right + 1] = { ' ' } end
    right[#right + 1] = chunk
  end
  if it.id == next_id then put({ 'next', 'ClandTeal' }) end
  for _, chunk in ipairs(M.who(it)) do put(chunk) end
  if items.asks(it) > 0 then put({ '?' .. (items.asks(it) > 1 and items.asks(it) or ''), 'ClandBadge' }) end
  if it.kind == 'task' and items.in_work(it) then
    local checked, total, stale = M.fraction(it)
    if total > 0 then put({ checked .. '/' .. total, checked == total and 'ClandGreen' or 'ClandDim' }) end
    if stale > 0 then put({ stale .. ' stale', 'ClandAmber' }) end
  end
  if items.is_container(it) then
    local kids, done = items.children(it.id), 0
    for _, child in ipairs(kids) do if child.state == 'closed' then done = done + 1 end end
    local total = #kids
    if type(it.child_counts) == 'table' then done, total = it.child_counts.done, it.child_counts.total end
    put({ done .. '/' .. total, 'ClandDim' })
  end
  c:add(left, right, { item = it.id, list = bucket })
  if M.follow == it.id then c.cursor_to = #c.lines; M.follow = nil end
end

local function selected(it, filter)
  if it.layer == 'archive' then return false end
  if filter == 'board' then return it.layer == nil or it.layer == 'now' or it.layer == 'watch' end
  if filter == 'work' then return items.in_work(it) end
  if filter == 'you' then return items.needs_you(it) end
  if filter == 'done' then return it.kind == 'task' and it.status == 'done' end
  return true
end

local function fold(c, key, label, list, filter, next_id)
  local shown = vim.tbl_filter(function(it) return it.layer ~= 'archive' and (filter == 'board' or selected(it, filter)) end, list)
  local closed = state.S.ui.items_folds[key] ~= false
  c:add({ { ' ' .. (closed and '▸ ' or '▾ ') .. label .. ' (' .. #shown .. ')', 'ClandSection' } }, nil, { fold = key })
  if M.follow_fold == key then c.cursor_to = #c.lines; M.follow_fold = nil end
  if not closed then for _, it in ipairs(shown) do row(c, it, key, next_id) end end
end

function M.summary()
  local b, f = panel_composition(), items.filter()
  if f == 'board' then
    local owner = M.parent_filter() and state.item(M.parent_filter()) or b.scope
    local label = owner and type(owner.child_counts) == 'table' and items.child_label(owner) or 'tasks'
    if owner and type(owner.child_counts) == 'table' then
      b.done, b.work = owner.child_counts.done, 0
      for _, status in ipairs({ 'planned', 'in progress', 'review', 'qa', 'ready' }) do
        b.work = b.work + (owner.child_counts.statuses[status] or 0)
      end
    end
    return 'board · ' .. (label ~= 'tasks' and (label .. ': ') or '') .. b.work .. ' in work · ' .. b.done .. ' done'
  end
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

-- Tabs and unfolded release groups share the section renderer.
local function render_sections(c, b, f, options, prefix, nested)
  prefix = prefix or ''
  local parent, direct = narrowing(options)
  local function section(status)
    local list = vim.tbl_filter(function(it) return selected(it, f) end, b.columns[status])
    if nested and #list == 0 then return end
    c:add({ { ' ' .. status:upper() .. ' · ' .. #list, #list > 0 and 'ClandSection' or 'ClandFaint' } }, nil, { section = status })
    for _, it in ipairs(list) do row(c, it, status, b.next) end
  end
  for _, status in ipairs(M.SECTIONS) do section(status) end
  if f == 'board' then
    if not nested then
      section('backlog')
      if #vim.tbl_filter(function(it) return selected(it, f) end, b.columns.done) > 0 then section('done') end
    elseif #vim.tbl_filter(function(it) return selected(it, f) end, b.columns.backlog) > 0 then section('backlog') end
    local backlog = vim.tbl_filter(function(it) return it.layer == nil or it.layer == 'background' end, b.columns.backlog)
    if not nested or #backlog > 0 then fold(c, prefix .. 'backlog', 'backlog', backlog, f) end
    if nested then section('done') end
    local leaves = {}
    for _, it in ipairs(b.leaves) do
      if selected(it, f) then row(c, it, 'leaves') elseif it.layer ~= 'archive' then leaves[#leaves + 1] = it end
    end
    if #leaves > 0 then fold(c, prefix .. 'leaves', 'questions and specs', leaves, f) end
  end
  if not b.scope then
    local unscheduled = {}
    for _, it in ipairs(b.unscheduled) do
      if f == 'board' and selected(it, f) then row(c, it, 'unscheduled') else unscheduled[#unscheduled + 1] = it end
    end
    fold(c, prefix .. 'unscheduled', 'unscheduled', unscheduled, f)
  end
  if f == 'board' then
    local more = {}
    for _, it in ipairs(items.ordered()) do
      if within(it, b.scope, parent, direct) and it.layer == 'background'
        and (it.kind == 'task' or items.is_container(it)) and it.status ~= 'backlog'
        and (not nested or it.id ~= parent) then more[#more + 1] = it end
    end
    if #more > 0 then fold(c, prefix .. 'background', 'more', more, f) end
  end
end

local function release_epics(scope)
  local live, done = {}, {}
  for _, it in ipairs(items.children(scope.id)) do
    if items.level_of(it) == items.level_of(scope) + 1 then
      local list = it.state == 'closed' and done or live
      list[#list + 1] = it
    end
  end
  table.sort(done, function(a, b)
    local ac = items.present(a.closed) and a.closed or a.updated or ''
    local bc = items.present(b.closed) and b.closed or b.updated or ''
    if ac == bc then return items.compare_rank(a, b) end
    return ac < bc
  end)
  return vim.list_extend(live, done)
end

local function group_tasks(scope, options)
  local out = {}
  for _, it in ipairs(items.ordered()) do
    if it.kind == 'task' and within(it, scope, options.parent, options.direct) then out[#out + 1] = it end
  end
  return out
end

local function group_row(c, scope, epic, key, options)
  local tasks, counts, done, active, planned = group_tasks(scope, options), {}, 0, false, false
  for _, it in ipairs(tasks) do
    counts[it.status] = (counts[it.status] or 0) + 1
    if it.status == 'done' then done = done + 1 end
    if vim.tbl_contains({ 'in progress', 'review', 'qa', 'ready' }, it.status) then active = true end
    if it.status == 'planned' then planned = true end
  end
  local total = #tasks
  if epic and type(epic.child_counts) == 'table' then
    counts, done, total = epic.child_counts.statuses, epic.child_counts.done, epic.child_counts.total
    active = (counts['in progress'] or 0) + (counts.review or 0) + (counts.qa or 0) + (counts.ready or 0) > 0
    planned = (counts.planned or 0) > 0
  end
  local loaded = not epic and type(scope.child_counts) == 'table'
  local closed = state.S.ui.items_folds[key] ~= false
  local left = { { ' ' .. (closed and '▸ ' or '▾ '), 'ClandSection' } }
  if epic then
    local glyph = epic.state == 'closed' and items.GLYPH.closed
      or (active and items.GLYPH['in progress'] or (planned and items.GLYPH.planned or items.GLYPH.backlog))
    left[#left + 1] = { glyph[1], glyph[2] }
    left[#left + 1] = { ' ' .. epic.id .. ' ', 'ClandDim' }
    left[#left + 1] = { epic.title or '', epic.state == 'closed' and 'ClandDone' or 'ClandBold' }
  else left[#left + 1] = { 'Direct tasks (' .. #tasks .. (loaded and ' loaded' or '') .. ')', 'ClandSection' } end
  local right, lead = {}, epic and items.lead_label(epic)
  if lead then right[#right + 1] = { lead .. ' ', 'ClandTeal' } end
  right[#right + 1] = { done .. '/' .. total .. (loaded and ' loaded' or ''), 'ClandDim' }
  local parts = {}
  for _, pair in ipairs({ { 'in progress', '◐' }, { 'review', 'rev' }, { 'qa', 'qa' }, { 'ready', 'ready' }, { 'planned', 'planned' }, { 'backlog', 'backlog' } }) do
    if (counts[pair[1]] or 0) > 0 then parts[#parts + 1] = counts[pair[1]] .. ' ' .. pair[2] end
  end
  if #parts > 0 then right[#right + 1] = { ' · ' .. table.concat(parts, ' · '), 'ClandDim' } end
  local left_width = 0
  for _, chunk in ipairs(left) do left_width = left_width + api.nvim_strwidth(chunk[1]) end
  -- Reserve identity and a readable title before dropping the breakdown from its right.
  local reserve = epic and api.nvim_strwidth(' ▸ ○ ' .. epic.id .. ' ') + 12 or left_width
  right = require('cland.bars').fit(right, math.max(0, c.width - math.min(left_width, reserve) - 1))
  c:add(left, right, { item = epic and epic.id, fold = key })
  if (epic and M.follow == epic.id) or M.follow_fold == key then
    c.cursor_to = #c.lines; M.follow, M.follow_fold = nil, nil
  end
  if not closed then
    local indented = { width = c.width - 2, lines = c.lines }
    function indented:add(l, r, info)
      local chunks = { { '  ' } }
      vim.list_extend(chunks, l)
      c:add(chunks, r, info)
    end
    render_sections(indented, panel_composition(options), 'board', options, key .. ':', true)
    if indented.cursor_to then c.cursor_to = indented.cursor_to end
  end
end

function M.render(c)
  local b, f = panel_composition(), items.filter()
  local tabs = { { ' epic ', 'ClandDim' }, { 'all', not M.parent_filter() and 'ClandTabOn' or 'ClandTab' } }
  for _, it in ipairs(M.parents()) do tabs[#tabs + 1] = { ' · ' .. it.id .. ' ' .. it.title, state.S.ui.board_parent == it.id and 'ClandTabOn' or 'ClandTab' } end
  c:add(tabs, nil, { epic_tabs = true })
  if b.scope then
    local kids, done = items.children(b.scope.id), 0
    for _, it in ipairs(kids) do if it.state == 'closed' then done = done + 1 end end
    local total = #kids
    if type(b.scope.child_counts) == 'table' then done, total = b.scope.child_counts.done, b.scope.child_counts.total end
    local right, lead = {}, items.lead_label(b.scope)
    if lead then right[#right + 1] = { lead .. ' ', 'ClandTeal' } end
    right[#right + 1] = { done .. '/' .. total, 'ClandDim' }
    c:add({ { ' ' .. b.scope.id .. ' ' .. items.display_title(b.scope), 'ClandBold' } }, right, { item = b.scope.id })
  else c:add({ { ' no open container: unscheduled', 'ClandDim' } }) end
  if f == 'board' and b.scope and b.scope.kind == state.S.tracker.levels[1]
    and #items.ladder() > 1 and not M.parent_filter() then
    for _, epic in ipairs(release_epics(b.scope)) do
      group_row(c, b.scope, epic, 'board:' .. epic.id, { parent = epic.id })
    end
    local direct = { direct = true }
    if #group_tasks(b.scope, direct) > 0 then group_row(c, b.scope, nil, 'board:direct:' .. b.scope.id, direct) end
  elseif f == 'you' then
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
    render_sections(c, b, f)
  end
  if f ~= 'you' and f ~= 'done' then items.categories_line(c) end
  return { ' K J rank · T top · ↵ open · za fold', ' gn now · gw watch · gb more · gA archive' }
end

local function info_at()
  return require('cland.panels').row_at(api.nvim_get_current_buf(), api.nvim_win_get_cursor(0)[1])
end

function M.fold(how)
  if how == 'all open' or how == 'all closed' then
    local closed, scope, filter = how == 'all closed', items.scope(), items.filter()
    if require('cland.plan').panel_id() then
      state.S.ui.items_folds.background = closed
    elseif filter == 'board' and scope and scope.kind == state.S.tracker.levels[1]
      and #items.ladder() > 1 and not M.parent_filter() then
      local keys = { 'board:direct:' .. scope.id }
      for _, epic in ipairs(release_epics(scope)) do keys[#keys + 1] = 'board:' .. epic.id end
      for _, key in ipairs(keys) do
        state.S.ui.items_folds[key] = closed
        for _, name in ipairs({ 'backlog', 'leaves', 'background' }) do state.S.ui.items_folds[key .. ':' .. name] = closed end
      end
    elseif filter == 'all' then
      state.S.ui.items_folds.unscheduled = closed
      for _, it in ipairs(items.ordered()) do
        if items.is_container(it) or #items.children(it.id) > 0 then state.S.ui.items_folds[it.id] = closed end
      end
    else
      for _, key in ipairs({ 'backlog', 'unscheduled', 'leaves', 'background' }) do state.S.ui.items_folds[key] = closed end
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
  if it and items.level_of(it) == 1 then return state.say('top-level containers do not carry rank') end
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
