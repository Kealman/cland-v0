-- The centre outline, composed from the workbench's summary index.
local api = vim.api
local state = require('cland.state')
local items = require('cland.items')
local present = items.present
local M = { rows = {}, folds = {} }
local ns = api.nvim_create_namespace('cland.explorer')
local function sw(s) return api.nvim_strwidth(s or '') end
local function fit(text, cells)
  if sw(text) <= cells then return text end
  if cells <= 1 then return cells == 1 and '…' or '' end
  return require('cland.bars').prefix(text, cells - 1) .. '…'
end
function M.local_time(iso)
  if type(iso) ~= 'string' then return nil end
  local y, mo, d, h, mi, s = iso:match('^(%d+)-(%d+)-(%d+)T(%d+):(%d+):?(%d*)')
  if not y then return nil end
  local t = os.time({ year = tonumber(y), month = tonumber(mo), day = tonumber(d), hour = tonumber(h), min = tonumber(mi), sec = tonumber(s) or 0 })
  return t + os.difftime(os.time(), os.time(os.date('!*t')))
end

--- 18:31 today, Oct 11 this year, 2025-12-01 before.
function M.when(iso)
  local t = M.local_time(iso)
  if not t then return '—' end
  if os.date('%Y-%m-%d', t) == os.date('%Y-%m-%d') then return os.date('%H:%M', t) end
  if os.date('%Y', t) == os.date('%Y') then return os.date('%b %d', t) end
  return os.date('%Y-%m-%d', t)
end

local IN_WORK = { ['in progress'] = true, review = true, qa = true, ready = true }
M.BAR_ORDER = { 'done', 'ready', 'qa', 'review', 'in progress', 'planned', 'backlog' }
-- one bar cell per child (the mockups' P3): filled or hollow, in the status colour
M.CELL = {
  done = { '■', 'ClandGreen' }, ready = { '□', 'ClandGreen' }, qa = { '■', 'ClandAmber' }, review = { '■', 'ClandAmber' },
  ['in progress'] = { '■', 'ClandTeal' }, planned = { '□', 'ClandDim' }, backlog = { '■', 'ClandCellBacklog' },
}
M.DERIVED = { done = { '●', 'ClandGreen' }, ['in work'] = { '◐', 'ClandTeal' }, planned = { '○', 'ClandText' }, backlog = { '○', 'ClandDim' } }
M.STATUS_HL = { done = 'ClandGreen', ready = 'ClandGreen', qa = 'ClandAmber', review = 'ClandAmber', ['in progress'] = 'ClandTeal', planned = 'ClandText', backlog = 'ClandDim' }

function M.done(it) return it.state == 'closed' or it.status == 'done' end

function M.index()
  local by, kids = {}, {}
  for _, it in ipairs(state.S.items) do by[it.id] = it end
  for _, it in ipairs(state.S.items) do
    local p = present(it.parent) and by[it.parent] and it.parent or ''
    local list = kids[p]
    if not list then list = {}; kids[p] = list end
    list[#list + 1] = it
  end
  for p, list in pairs(kids) do
    local pos = {}
    for i, id in ipairs(state.S.sibling_orders[p] or {}) do pos[id] = i end
    table.sort(list, function(a, b)
      if pos[a.id] or pos[b.id] then return (pos[a.id] or math.huge) < (pos[b.id] or math.huge) end
      return items.compare_rank(a, b)
    end)
  end
  local ix = { by = by, kids = kids, memo = {} }
  M.ix = ix
  return ix
end

function M.kids(ix, id) return ix.kids[id] or {} end

function M.is_container(ix, it)
  return items.is_container(it) or #M.kids(ix, it.id) > 0
end

-- A single-level tracker has no release tier above its epics.
function M.is_release(it)
  return #items.ladder() > 1 and it.kind == state.S.tracker.levels[1]
end

function M.leaf_status(it)
  if it.kind == 'task' and present(it.status) then return it.status end
  return M.done(it) and 'done' or 'backlog'
end

function M.derived(ix, it)
  local hit = ix.memo[it.id]
  if hit then return hit end
  local out
  if M.done(it) then out = 'done' else
    local kids = M.kids(ix, it.id)
    local subs = {}
    for _, k in ipairs(kids) do if M.is_container(ix, k) then subs[#subs + 1] = k end end
    local from = (M.is_release(it) and #subs > 0) and subs or kids
    local work, planned = false, false
    for _, k in ipairs(from) do
      local st = M.is_container(ix, k) and M.derived(ix, k) or M.leaf_status(k)
      if st == 'in work' or IN_WORK[st] then work = true elseif st == 'planned' then planned = true end
    end
    out = work and 'in work' or planned and 'planned' or 'backlog'
  end
  ix.memo[it.id] = out
  return out
end

function M.status_of(ix, it)
  if M.is_container(ix, it) then return M.derived(ix, it) end
  return M.leaf_status(it)
end

function M.leaves(ix, id, out)
  out = out or {}
  for _, k in ipairs(M.kids(ix, id)) do
    if M.is_container(ix, k) then M.leaves(ix, k.id, out) elseif k.kind == 'task' then out[#out + 1] = k end
  end
  return out
end

-- Missing closing times precede resolved ones; updated is the legacy fallback.
function M.live_done(list)
  local live, done = {}, {}
  for _, it in ipairs(list) do
    local bucket = M.done(it) and done or live
    bucket[#bucket + 1] = it
  end
  table.sort(done, function(a, b)
    local ac, bc = present(a.closed), present(b.closed)
    if ac ~= bc then return not ac end
    local at, bt = ac and a.closed or a.updated or '', bc and b.closed or b.updated or ''
    if at ~= bt then return at < bt end
    return items.compare_rank(a, b)
  end)
  return live, done
end

function M.root_release()
  local it, seen = items.scope(), {}
  while it and not seen[it.id] do
    seen[it.id] = true
    if M.is_release(it) and it.state == 'open' then return it end
    it = present(it.parent) and state.item(it.parent) or nil
  end
  local release = items.default_release()
  return release and M.is_release(release) and release or nil
end

function M.categories(ix)
  return vim.tbl_filter(function(it) return items.is_category(it) and it.state == 'open' end, M.kids(ix, ''))
end
function M.unscheduled(ix)
  return vim.tbl_filter(function(it)
    return not M.is_release(it) and not items.is_category(it) and it.state == 'open'
  end, M.kids(ix, ''))
end
function M.other_releases(ix, root)
  return vim.tbl_filter(function(it)
    return M.is_release(it) and it.state == 'open' and (not root or it.id ~= root.id)
  end, M.kids(ix, ''))
end

local function item_node(ix, it, extra)
  local node = { key = it.id, it = it, expandable = M.is_container(ix, it) }
  for k, v in pairs(extra or {}) do node[k] = v end
  return node
end

local function virtual(key, label, extra)
  local node = { key = key, virtual = true, label = label, expandable = true }
  for k, v in pairs(extra or {}) do node[k] = v end
  return node
end

local function label_row(chunks, extra)
  local node = { label_row = true, chunks = chunks }
  for k, v in pairs(extra or {}) do node[k] = v end
  return node
end

local function policy(qa)
  if type(qa) ~= 'table' or qa.scope == 'none' then return 'review only' end
  return 'qa ' .. tostring(qa.scope) .. ', ' .. (qa.when == 'after-stage' and 'after the stage' or 'per item')
end
M.policy = policy

-- Only epic rows fetch plans; plan.get coalesces and caches the frame request.
function M.stages(it)
  if items.level_of(it) ~= 2 then return nil end
  local d = require('cland.plan').get(it.id)
  return d and type(d.plan) == 'table' and type(d.stages) == 'table' and #d.stages > 0 and d.stages or nil
end

function M.children(ix, node)
  local out = {}
  local function add(list, extra)
    for _, it in ipairs(list) do out[#out + 1] = item_node(ix, it, extra) end
  end
  if node.virtual then
    if node.key == ':categories' then
      add(M.categories(ix))
    elseif node.key == ':unscheduled' then
      add(M.unscheduled(ix))
    elseif node.key == ':releases' then
      add(M.other_releases(ix, M.root_release()))
    else
      local live, dn = M.live_done(node.list or {})
      add(live); add(dn)
    end
    return out
  end
  local it = node.it
  local kids = M.kids(ix, it.id)
  if M.is_release(it) then
    -- a release: its epics by rank, the done ones after; its direct tasks under one folded row
    local subs, leaves = {}, {}
    for _, k in ipairs(kids) do
      if M.is_container(ix, k) then subs[#subs + 1] = k else leaves[#leaves + 1] = k end
    end
    local live, dn = M.live_done(subs)
    add(live); add(dn)
    if #leaves > 0 then
      out[#out + 1] = virtual(':direct:' .. it.id, 'Direct tasks', { list = leaves, owner = it.id })
    end
    return out
  end
  local live, dn = M.live_done(kids)
  local stages = M.stages(it)
  if stages then
    -- an epic with a plan: one label per stage over its live tasks, rank order inside a stage; the done
    -- after one "done" label in the order they closed (P8)
    local at = {}
    for n, st in ipairs(stages) do
      for _, id in ipairs(st.items or {}) do at[id] = at[id] or n end
    end
    for n, st in ipairs(stages) do
      local members, merged = {}, 0
      for _, k in ipairs(live) do if at[k.id] == n then members[#members + 1] = k end end
      for _, id in ipairs(st.items or {}) do if ix.by[id] and M.done(ix.by[id]) then merged = merged + 1 end end
      do
        local busy = merged > 0
        for _, k in ipairs(members) do if IN_WORK[M.leaf_status(k)] then busy = true end end
        local planned = false
        for _, k in ipairs(members) do if M.leaf_status(k) == 'planned' then planned = true end end
        local word = st.state == 'closed' and 'closed' or (busy and 'in work' or planned and 'planned' or 'backlog')
        local dim = word == 'backlog'
        out[#out + 1] = label_row({ { 'S' .. n .. ' ', dim and 'ClandDim' or 'ClandBold' }, { st.name or '', dim and 'ClandDim' or 'ClandText' },
          { '  ' .. word .. ' · ' .. merged .. ' of ' .. #(st.items or {}) .. ' merged · ' .. policy(st.qa), 'ClandDim' } }, { stage = n })
        add(members)
      end
    end
    local outside = vim.tbl_filter(function(k) return not at[k.id] end, live)
    if #outside > 0 then
      out[#out + 1] = label_row({ { 'not in the plan', 'ClandDim' } })
      add(outside)
    end
    if #dn > 0 then
      local closed = {}
      for n, st in ipairs(stages) do if st.state == 'closed' then closed[#closed + 1] = 'S' .. n .. ' ' .. (st.name or '') .. ' closed' end end
      out[#out + 1] = label_row({ { '✓ ', 'ClandGreen' }, { 'done', 'ClandDone' },
        { '  in the order they closed' .. (#closed > 0 and (' · ' .. table.concat(closed, ' · ')) or ''), 'ClandDim' } })
      add(dn)
    end
    return out
  end
  add(live); add(dn)
  return out
end

function M.node_for(ix, key)
  if not key then return nil end
  if key == ':categories' then return virtual(key, 'Categories') end
  if key == ':unscheduled' then return virtual(key, 'Unscheduled') end
  if key == ':releases' then return virtual(key, 'Other releases') end
  local owner = key:match('^:direct:(.+)$')
  if owner and ix.by[owner] then
    local leaves = vim.tbl_filter(function(k) return not M.is_container(ix, k) end, M.kids(ix, owner))
    return virtual(key, 'Direct tasks', { list = leaves, owner = owner })
  end
  local it = ix.by[key]
  return it and item_node(ix, it) or nil
end

function M.scope_key() return state.S.ui.view.kind == 'explorer' and state.S.ui.view.id or nil end

function M.is_open(node)
  local folded = M.folds[node.key]
  if folded ~= nil then return folded end
  return node.scope_root == true or node.release_root == true
end

function M.walk(ix, scope, all, visit)
  local function rec(node, depth, parent)
    visit(node, depth, parent)
    if node.label_row or not node.expandable then return end
    if all or M.is_open(node) then
      for _, child in ipairs(M.children(ix, node)) do
        if child.label_row then visit(child, depth + 1, node.key) else rec(child, depth + 1, node.key) end
      end
    end
  end
  if scope == nil then
    local rel = state.S.items_loaded and M.root_release() or nil
    if rel then rec(item_node(ix, rel, { release_root = true }), 0, nil)
    else visit({ note = not state.S.items_loaded and 'loading the items…' or 'no open release' }, 0, nil) end
    rec(virtual(':categories', 'Categories'), 0, nil)
    rec(virtual(':unscheduled', 'Unscheduled'), 0, nil)
    rec(virtual(':releases', 'Other releases'), 0, nil)
  else
    local node = M.node_for(ix, scope)
    if node then
      node.scope_root = true
      if node.it and M.is_release(node.it) then node.release_root = true end
      rec(node, 0, nil)
    else
      visit({ note = scope .. ' is gone from the tracker; ␣␣ goes back' }, 0, nil)
    end
  end
end

-- Rows ------------------------------------------------------------------------------------------------

local function columns(width)
  if width >= 118 then return { bar = 16, counts = true, stage = true, lead = true, who = 22, role = true, verdict = 28, verif = true }
  elseif width >= 96 then return { bar = 12, counts = true, stage = true, lead = false, who = 16, role = false, verdict = 14, verif = true }
  elseif width >= 74 then return { bar = 10, counts = false, stage = true, lead = false, who = 12, role = false, verdict = 0, verif = true }
  end
  return { bar = 8, counts = false, stage = false, lead = false, who = 0, role = false, verdict = 0, verif = true }
end
M.columns = columns

function M.cells(statuses, max)
  local count = {}
  for _, st in ipairs(statuses) do count[st] = (count[st] or 0) + 1 end
  local total = #statuses
  local out = {}
  local scale = total > max and (max / total) or 1
  for _, st in ipairs(M.BAR_ORDER) do
    local n = count[st] or 0
    if n > 0 then
      local before = 0
      for _, previous in ipairs(M.BAR_ORDER) do
        if previous == st then break end
        before = before + (count[previous] or 0)
      end
      local k = scale == 1 and n or math.floor((before + n) * scale + 0.5) - math.floor(before * scale + 0.5)
      local cell = M.CELL[st]
      out[#out + 1] = { cell[1]:rep(k), cell[2] }
    end
  end
  return out, count
end

local function chunks_width(chunks)
  local w = 0
  for _, c in ipairs(chunks) do w = w + sw(c[1]) end
  return w
end

local function col(chunks, w, align)
  local out, used = {}, 0
  for _, c in ipairs(chunks) do
    local room = w - used
    if room <= 0 then break end
    local t = fit(c[1], room)
    out[#out + 1] = { t, c[2] }
    used = used + sw(t)
  end
  local pad = { (' '):rep(math.max(0, w - used)) }
  if align == 'left' then out[#out + 1] = pad else table.insert(out, 1, pad) end
  return out
end

local function append(dst, src)
  for _, c in ipairs(src) do dst[#dst + 1] = c end
  return dst
end

local function role_word(role)
  return state.ROLE_LABELS[role or ''] or role or ''
end

function M.who(it, cols)
  if M.done(it) then
    return { { (it.kind == 'task' and 'merged ' or 'closed ') .. M.when(it.closed), 'ClandDone' } }
  end
  local blockers = items.open_blockers(it)
  if #blockers > 0 and not IN_WORK[M.leaf_status(it)] then
    return { { 'blocked by ' .. table.concat(blockers, ', '), 'ClandDim' } }
  end
  local out = vim.deepcopy(require('cland.vboard').who(it))
  if cols.role and #out > 0 then
    local claim = items.claim(it)
    local role = claim and claim.role
    for _, h in ipairs(type(it.holds) == 'table' and it.holds or {}) do
      if h.session == out[1][1] then role = h.role; break end
    end
    if role then out[#out + 1] = { ' ' .. role_word(role), 'ClandDim' } end
  end
  return #out > 0 and out or { { '—', 'ClandFaint' } }
end

function M.verdicts(it)
  local list = type(it.verdicts) == 'table' and it.verdicts or {}
  local out = {}
  for _, kind in ipairs({ 'review', 'qa' }) do
    local last, round = nil, 0
    for _, v in ipairs(list) do if v.verdict == kind then last, round = v, round + 1 end end
    if last then
      local ok = last.result == 'clear'
      if #out > 0 then out[#out + 1] = { ' ' } end
      out[#out + 1] = { (ok and '✓ ' or '✗ ') .. kind .. ((not ok or round > 1) and (' r' .. round) or ''),
        not ok and 'ClandRed' or (last.current == false and 'ClandDim' or 'ClandGreen') }
    end
  end
  if #out == 0 then out[1] = { '—', 'ClandFaint' } end
  return out
end

function M.fraction(it)
  local c = type(it.criteria) == 'table' and it.criteria or {}
  return c.verified or 0, c.total or 0
end

local function frac_chunk(it)
  local v, total = M.fraction(it)
  if v == nil then return { '…', 'ClandFaint' } end
  if total == 0 then return { '—', 'ClandFaint' } end
  return { v .. '/' .. total, v == total and 'ClandGreen' or 'ClandDim' }
end

function M.lead(it)
  local c = items.claim(it)
  if c and c.role == 'lead' then return c.session, 'ClandTeal' end
  -- P4: the Coordinator leads every epic while `leads` in crew.toml is empty
  local leads = state.S.crew and state.S.crew.config and state.S.crew.config.leads or {}
  if #leads > 0 then return '—', 'ClandFaint' end
  local coord = state.coordinator()
  return coord and coord.name or '—', 'ClandDim'
end

function M.stage_in_work(it)
  local stages = M.stages(it)
  if not stages then return nil end
  for n, st in ipairs(stages) do if st.state ~= 'closed' then return n, #stages, st end end
  return nil, #stages
end

local function container_cols(ix, it, cols)
  local kids = M.kids(ix, it.id)
  local subs = {}
  for _, k in ipairs(kids) do if M.is_container(ix, k) then subs[#subs + 1] = k end end
  local release = M.is_release(it)
  -- a release counts its epics (P5); an epic its tasks; done/total and one cell per child
  local members = release and subs or vim.tbl_filter(function(k) return k.kind == 'task' end, kids)
  local statuses, done_n = {}, 0
  for _, k in ipairs(members) do
    local st = M.status_of(ix, k)
    if st == 'in work' then st = 'in progress' end
    statuses[#statuses + 1] = st
    if st == 'done' then done_n = done_n + 1 end
  end
  local leafs = release and M.leaves(ix, it.id) or kids
  local work = { ['in progress'] = 0, review = 0, qa = 0 }
  for _, k in ipairs(leafs) do
    local st = M.leaf_status(k)
    if work[st] then work[st] = work[st] + 1 end
  end
  local out = {}
  local frac = (#members == 0) and '—' or (done_n .. '/' .. #members)
  append(out, col({ { frac, M.done(it) and 'ClandDone' or 'ClandDim' } }, 5))
  out[#out + 1] = { ' ' }
  append(out, col(M.cells(statuses, cols.bar), cols.bar, 'left'))
  if cols.counts then
    for _, key in ipairs({ 'in progress', 'review', 'qa' }) do
      local n = work[key]
      append(out, col({ n > 0 and { tostring(n), key == 'in progress' and 'ClandTeal' or 'ClandAmber' } or { '·', 'ClandFaint' } }, 4))
    end
  end
  if M.done(it) and (cols.stage or cols.lead) then
    local w = (cols.stage and 6 or 0) + (cols.lead and 11 or 0)
    append(out, col({ { 'closed ' .. M.when(it.closed), 'ClandDone' } }, w))
    return out
  end
  if cols.stage then
    local n = M.stage_in_work(it)
    append(out, col({ n and { 'S' .. n, 'ClandText' } or { '—', 'ClandFaint' } }, 6))
  end
  if cols.lead then
    local name, hl = M.lead(it)
    append(out, col({ { name, hl } }, 11))
  end
  return out
end

local function leaf_cols(it, cols)
  local out = {}
  if cols.who > 0 then
    out[#out + 1] = { ' ' }
    append(out, col(M.who(it, cols), cols.who, 'left'))
  end
  if cols.verdict > 0 then
    out[#out + 1] = { ' ' }
    append(out, col(M.verdicts(it), cols.verdict, 'left'))
  end
  if cols.verif then append(out, col({ frac_chunk(it) }, 7)) end
  return out
end

function M.glyph(ix, it)
  if M.is_container(ix, it) then
    local g = M.DERIVED[M.derived(ix, it)]
    return g[1], g[2]
  end
  if not M.done(it) and not IN_WORK[M.leaf_status(it)] and #items.open_blockers(it) > 0 then return '◌', 'ClandDim' end
  if it.kind ~= 'task' then
    return M.done(it) and '●' or '○', M.done(it) and 'ClandGreen' or 'ClandDim'
  end
  local g = items.GLYPH[it.status] or items.GLYPH.open
  return g[1], g[2]
end

local function virtual_text(ix, node)
  local list = node.key == ':categories' and M.categories(ix)
    or node.key == ':unscheduled' and M.unscheduled(ix)
    or node.key == ':releases' and M.other_releases(ix, M.root_release()) or node.list or {}
  return ('%s (%d)'):format(node.label, #list), ''
end

function M.rows_of(ix, scope, width)
  local cols = columns(width)
  local rows = {}
  local caption
  local scope_node = scope and M.node_for(ix, scope)
  local leaf_scope = scope_node and not (scope_node.it and M.is_release(scope_node.it))
  if scope == nil or (scope_node and scope_node.it and M.is_release(scope_node.it)) then
    caption = 'release, its epics and tasks, by rank'
  elseif scope_node and scope_node.it and M.stages(scope_node.it) then
    caption = 'its tasks by stage, by rank in a stage'
  else
    caption = 'its items: live by rank, then done as they closed'
  end
  -- the column header, dim (the mockups' header row)
  local head_right = {}
  if leaf_scope and cols.who > 0 then
    head_right[#head_right + 1] = { ' ' }
    append(head_right, col({ { 'claim or holder', 'ClandFaint' } }, cols.who, 'left'))
    if cols.verdict > 0 then head_right[#head_right + 1] = { ' ' }; append(head_right, col({ { 'latest verdict', 'ClandFaint' } }, cols.verdict, 'left')) end
    append(head_right, col({ { 'verif.', 'ClandFaint' } }, 7))
  elseif not leaf_scope then
    append(head_right, col({ { 'done', 'ClandFaint' } }, 5))
    head_right[#head_right + 1] = { ' ' }
    append(head_right, col({ { 'progress', 'ClandFaint' } }, cols.bar, 'left'))
    if cols.counts then
      append(head_right, col({ { '◐', 'ClandFaint' } }, 4)); append(head_right, col({ { 'rev', 'ClandFaint' } }, 4)); append(head_right, col({ { 'qa', 'ClandFaint' } }, 4))
    end
    if cols.stage then append(head_right, col({ { 'stage', 'ClandFaint' } }, 6)) end
    if cols.lead then append(head_right, col({ { 'lead', 'ClandFaint' } }, 11)) end
  end
  rows[#rows + 1] = { info = { header = true }, left = { { '     id    ', 'ClandFaint' }, { caption, 'ClandFaint' } }, right = head_right }

  M.walk(ix, scope, false, function(node, depth, parent)
    local indent = ('  '):rep(depth)
    if node.note then
      rows[#rows + 1] = { info = {}, left = { { ' ' .. node.note, 'ClandDim' } } }
      return
    end
    if node.label_row then
      rows[#rows + 1] = { info = { label = true, parent = parent }, left = append({ { indent .. '    ' } }, node.chunks) }
      return
    end
    local open = node.expandable and M.is_open(node)
    local fold = node.expandable and (open and '▾ ' or '▸ ') or '  '
    local info = { key = node.key, item = node.it and node.it.id or nil, target = true, depth = depth, parent = parent,
      expandable = node.expandable, open = open, virtual = node.virtual, owner = node.owner }
    if node.virtual then
      local name, text = virtual_text(ix, node)
      rows[#rows + 1] = { info = info, left = { { ' ' .. indent .. fold, 'ClandFaint' },
        { name, node.more and 'ClandDim' or 'ClandBold' }, { text ~= '' and ('  ' .. text) or '', 'ClandDim' } } }
      return
    end
    local it = node.it
    local g, ghl = M.glyph(ix, it)
    local isdone = M.done(it)
    local container = M.is_container(ix, it)
    local derived = container and M.derived(ix, it) or nil
    local title_hl = isdone and 'ClandDone' or (derived == 'backlog' and 'ClandDim') or 'ClandText'
    local left = { { ' ' .. indent .. fold, 'ClandFaint' }, { g, ghl }, { ' ' .. it.id .. ' ', 'ClandDim' } }
    if M.is_release(it) and present(it.version) then
      local name = items.display_title(it)
      local version = name:sub(1, #it.version + 1) == 'v' .. it.version and ('v' .. it.version) or it.version
      left[#left + 1] = { version, isdone and 'ClandDone' or 'ClandBold' }
      left[#left + 1] = { name:sub(#version + 1), title_hl }
    else
      left[#left + 1] = { items.display_title(it), title_hl }
    end
    local right = container and container_cols(ix, it, cols) or leaf_cols(it, cols)
    rows[#rows + 1] = { info = info, left = left, right = right }
    if node.release_root and depth == 0 then
      -- the release row's second and third lines (P5): its tasks, one cell each, and the count per status
      local leafs = M.leaves(ix, it.id)
      local statuses, done_n = {}, 0
      for _, k in ipairs(leafs) do
        local st = M.leaf_status(k)
        statuses[#statuses + 1] = st
        if st == 'done' then done_n = done_n + 1 end
      end
      local cells, count = M.cells(statuses, math.max(8, math.min(48, width - 24)))
      rows[#rows + 1] = { info = { detail = true }, left = append({ { '        ' }, { 'tasks ' .. done_n .. '/' .. #leafs .. '  ', 'ClandDim' } }, cells) }
      local words = {}
      for _, st in ipairs(M.BAR_ORDER) do
        if count[st] then
          if #words > 0 then words[#words + 1] = { ' · ', 'ClandFaint' } end
          words[#words + 1] = { count[st] .. ' ' .. st, M.STATUS_HL[st] }
        end
      end
      if #words == 0 then words[1] = { 'no tasks yet', 'ClandDim' } end
      rows[#rows + 1] = { info = { detail = true }, left = append({ { '        ' } }, words) }
    end
  end)
  rows[#rows + 1] = { info = {}, left = {} }
  rows[#rows + 1] = { info = {}, left = { { ' za toggle fold · j k move · ␣␣ back', 'ClandFaint' } } }
  return rows
end

function M.paint(rows, width)
  local lines, marks, info = {}, {}, {}
  for r, row in ipairs(rows) do
    local right = row.right or {}
    local rw = chunks_width(right)
    local room = math.max(1, width - rw - (rw > 0 and 1 or 0))
    local left = require('cland.bars').fit(row.left or {}, room)
    local parts, colb = {}, 0
    local function put(text, hl)
      if text == '' then return end
      parts[#parts + 1] = text
      if hl == 'ClandDimBar' then hl = 'ClandDim' end
      if hl then marks[#marks + 1] = { r - 1, colb, colb + #text, hl } end
      colb = colb + #text
    end
    for _, c in ipairs(left) do put(tostring(c[1]), c[2]) end
    if rw > 0 then
      put((' '):rep(math.max(1, width - chunks_width(left) - rw)))
      for _, c in ipairs(right) do put(c[1], c[2]) end
    end
    lines[r] = table.concat(parts)
    info[r] = row.info
  end
  return lines, marks, info
end


function M.tree_win()
  return M.b and api.nvim_buf_is_valid(M.b) and vim.fn.bufwinid(M.b) or -1
end
function M.key_at(row)
  return M.rows[row] and M.rows[row].key
end
function M.toggle()
  local win = M.tree_win()
  if win == -1 then return end
  local row = M.rows[api.nvim_win_get_cursor(win)[1]]
  if row and row.expandable then
    M.folds[row.key] = not row.open
    state.changed()
  end
end
function M.buf()
  if M.b and api.nvim_buf_is_valid(M.b) then return M.b end
  M.b = api.nvim_create_buf(false, true)
  vim.bo[M.b].bufhidden, vim.bo[M.b].modifiable = 'hide', false
  vim.b[M.b].cland_role = 'explorer'
  api.nvim_buf_set_name(M.b, 'cland://explorer')
  require('cland.actions').map('n', 'za', M.toggle, { buffer = M.b, silent = true, nowait = true })
  for _, key in ipairs({'j', 'k'}) do
    require('cland.actions').map('n', key, function() vim.cmd('normal! ' .. vim.v.count1 .. key) end,
      {buffer=M.b,silent=true,nowait=true})
  end
  M.lines, M.marks = nil, nil
  return M.b
end
function M.count_done(ix, scope)
  local seen, count = {}, 0
  local function visit(it)
    if seen[it.id] then return end
    seen[it.id] = true
    if M.done(it) then count = count + 1 end
    for _, child in ipairs(M.kids(ix, it.id)) do visit(child) end
  end
  if scope then
    local node = M.node_for(ix, scope)
    if node and node.it then visit(node.it)
    elseif node then for _, child in ipairs(M.children(ix, node)) do if child.it then visit(child.it) end end end
  else
    local root = M.root_release()
    if root then visit(root) end
  end
  return count
end
function M.render()
  local b, scope = M.buf(), M.scope_key()
  local win = M.tree_win()
  local width = api.nvim_win_get_width(win ~= -1 and win or require('cland.layout').centre()) - 1
  local key = win ~= -1 and M.drawn_scope == scope and M.key_at(api.nvim_win_get_cursor(win)[1]) or nil
  local ix = M.index()
  local lines, marks, rows = M.paint(M.rows_of(ix, scope, width), width)
  local changed = not vim.deep_equal(lines, M.lines) or not vim.deep_equal(marks, M.marks)
  if changed then
    vim.bo[b].modifiable = true
    api.nvim_buf_set_lines(b, 0, -1, false, lines)
    vim.bo[b].modifiable = false
    api.nvim_buf_clear_namespace(b, ns, 0, -1)
    for _, m in ipairs(marks) do api.nvim_buf_set_extmark(b, ns, m[1], m[2], {end_col=m[3],hl_group=m[4]}) end
    M.lines, M.marks = lines, marks
    M.writes = (M.writes or 0) + 1
  end
  M.rows, M.drawn_scope, M.window_width = rows, scope, width + 1
  M.done_in_view = M.count_done(ix, scope)
  if win ~= -1 and (changed or M.position_scope ~= (scope or '')) then
    local row = 1
    for r, info in ipairs(rows) do if info.key == key then row = r; break end end
    api.nvim_win_set_cursor(win, {row,0})
    M.position_scope = scope or ''
  end
  return b
end
function M.open(id)
  if id then
    local it = state.item(id)
    if not it then return state.say('explorer: unknown item ' .. id, 'ClandRedBar') end
    id = it.id
  end
  require('cland.layout').show({kind='explorer',id=id}, {insert=false})
end
function M.title(scope)
  local it = scope and state.item(scope) or M.root_release()
  return it and (it.id .. ' ' .. items.display_title(it)) or scope or 'no open release'
end
function M.context() return 'Explorer · ' .. M.title(M.scope_key()) end
function M.winbar(win)
  local bars = require('cland.bars')
  return bars.stl({{' EXPLORER ', win == api.nvim_get_current_win() and 'ClandHeadFocus' or 'ClandHead'},
    {M.title(M.scope_key()), 'ClandDimBar'}}) .. '%<%#WinBar#%=' .. bars.stl({{'● ' .. (M.done_in_view or 0) .. ' done ', 'ClandDoneBar'}})
end
return M
