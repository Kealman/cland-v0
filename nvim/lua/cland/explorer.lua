-- The centre outline, composed from the workbench's summary index.
local api = vim.api
local state = require('cland.state')
local items = require('cland.items')
local present = items.present
local M = { rows = {}, sel = {}, card = {body_open={}}, reveal_open = {} }

function M.setup(client)
  -- Hub redraws restore the human picture; detail replies and key actions do not fold it.
  local function fold_text()
    local open = next(M.card.body_open) ~= nil
    M.card.body_open = {}
    if open then state.changed() end
  end
  for _, event in ipairs({'connected','visibility','task','topic','message','event','crew','verification.queue',
    'session.state','session.role','role.vacant','role.filled','inbox','presence','session.process','sessions.pruned','session.cleanup','session.usage'}) do
    client:on(event,fold_text)
  end
end

function M.toggle_body()
  local key = vim.b.cland_role == 'card' and M.card.key or nil
  if vim.b.cland_role == 'explorer' then
    local win = M.tree_win()
    key = win ~= -1 and M.key_at(api.nvim_win_get_cursor(win)[1]) or nil
    if key and key ~= M.card.key then M.focus_card(); api.nvim_set_current_win(win) end
  end
  if not key or key:sub(1,1)==':' then return end
  M.card.body_open[key] = not M.card.body_open[key]
  M.render_card()
end
function M.ui()
  local ui = state.S.ui
  ui.explorer = ui.explorer or require('cland.ui').explorer_defaults()
  return ui.explorer
end
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
  return vim.tbl_filter(function(it) return items.is_category(it) and (it.state == 'open' or M.reveal_open[it.id]) end, M.kids(ix, ''))
end
function M.unscheduled(ix)
  return vim.tbl_filter(function(it)
    return not M.is_release(it) and not items.is_category(it) and (it.state == 'open' or M.ui().archive or M.reveal_open[it.id])
  end, M.kids(ix, ''))
end
function M.other_releases(ix, root)
  return vim.tbl_filter(function(it)
    return M.is_release(it) and (it.state == 'open' or M.ui().archive or M.reveal_open[it.id]) and (not root or it.id ~= root.id)
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
    for _, it in ipairs(list) do
      if not (M.ui().hide_done and M.done(it) and not M.reveal_open[it.id]) then out[#out + 1] = item_node(ix, it, extra) end
    end
  end
  if node.virtual then
    if node.key == ':categories' then
      add(M.categories(ix))
    elseif node.key == ':unscheduled' then
      local live, dn = M.live_done(M.unscheduled(ix))
      add(live); add(dn)
    elseif node.key == ':releases' then
      local live, dn = M.live_done(M.other_releases(ix, M.root_release()))
      add(live); add(dn)
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
    if #dn > 0 and (not M.ui().hide_done or M.reveal_item) then
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
  if node.scope_root or node.release_root then return true end
  if M.reveal_open[node.key] then return true end
  local folded = M.ui().folds[node.key]
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
      expandable = node.expandable, open = open, virtual = node.virtual, owner = node.owner,
      fixed_root = node.scope_root or node.release_root }
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
  rows[#rows + 1] = { info = {}, left = { { ' l h fold · s scope · ␣␣ back · D done · A archive · m General · M topic', 'ClandFaint' } } }
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
local function info_here()
  local win = M.tree_win()
  if win == -1 then return end
  return M.rows[api.nvim_win_get_cursor(win)[1]], win
end
local function goto_key(key)
  local win = M.tree_win()
  if win == -1 then return end
  for r, row in ipairs(M.rows) do
    if row.key == key then api.nvim_win_set_cursor(win, {r,0}); return end
  end
end
function M.set_open(key, open)
  M.reveal_open[key] = nil
  M.ui().folds[key] = open
  state.changed()
end
function M.move(step)
  local _, win = info_here()
  if not win then return end
  local r = api.nvim_win_get_cursor(win)[1]
  for _ = 1, vim.v.count1 do
    local next_row = r + step
    while M.rows[next_row] and not M.rows[next_row].target do next_row = next_row + step end
    if not M.rows[next_row] then break end
    r = next_row
  end
  api.nvim_win_set_cursor(win, {r,0})
end
function M.right()
  local row, win = info_here()
  if row and row.target and not row.expandable then return M.focus_card() end
  if not (row and row.expandable) then return end
  if not row.open then return M.set_open(row.key, true) end
  local r = api.nvim_win_get_cursor(win)[1] + 1
  while M.rows[r] and not M.rows[r].target do r = r + 1 end
  if M.rows[r] and M.rows[r].parent == row.key then goto_key(M.rows[r].key) end
end
function M.left()
  local row = info_here()
  if not (row and row.target) then return end
  if row.expandable and row.open and not row.fixed_root then return M.set_open(row.key, false) end
  if row.parent then
    goto_key(row.parent)
    local parent = info_here()
    if parent and not parent.fixed_root then M.set_open(parent.key, false) end
  end
end
function M.fold(how)
  local row = info_here()
  if not (row and row.target) then return end
  if not row.expandable then
    if not row.parent then return end
    -- Opening a leaf's parent preserves the leaf; closing it selects the parent on redraw.
    for _, parent in ipairs(M.rows) do if parent.key == row.parent then row = parent; break end end
  end
  if row.fixed_root then return end
  M.set_open(row.key, how == 'open' or (how == 'toggle' and not row.open))
end
function M.fold_all(open)
  M.reveal_open = {}
  M.walk(M.index(), M.scope_key(), true, function(node)
    if node.expandable and not node.scope_root and not node.release_root then M.ui().folds[node.key] = open end
  end)
  state.changed()
end
function M.toggle() M.fold('toggle') end
function M.remember()
  local row = info_here()
  if row and row.key then M.sel[M.drawn_scope or ''] = row.key end
end
function M.scope_here()
  local row = info_here()
  if not (row and row.target) then return end
  local key = row.expandable and row.key or row.parent
  if not key or key == M.scope_key() then return end
  M.sel[key] = row.key
  require('cland.layout').show({kind='explorer',id=key}, {insert=false})
end
function M.toggle_done()
  M.ui().hide_done = not M.ui().hide_done
  state.changed()
end
function M.toggle_archive()
  M.ui().archive = not M.ui().archive
  state.changed()
end
local card_ns = api.nvim_create_namespace('cland.explorer.card')
local function valid(win) return win and api.nvim_win_is_valid(win) end
function M.card_buf()
  local c = M.card
  if c.buf and api.nvim_buf_is_valid(c.buf) then return c.buf end
  c.buf = api.nvim_create_buf(false,true)
  vim.bo[c.buf].bufhidden, vim.bo[c.buf].modifiable = 'hide', false
  vim.bo[c.buf].undolevels = -1
  vim.b[c.buf].cland_role = 'card'
  api.nvim_buf_set_name(c.buf,'cland://explorer/card')
  local function back()
    local win = M.tree_win()
    if win ~= -1 then api.nvim_set_current_win(win) end
  end
  for _, key in ipairs({'m','M'}) do
    require('cland.actions').map('n',key,function() require('cland.explorer_compose').here(key == 'M') end,{buffer=c.buf,silent=true,nowait=true})
  end
  for _, key in ipairs({'h','<leader><leader>'}) do
    require('cland.actions').map('n',key,back,{buffer=c.buf,silent=true,nowait=true})
  end
  require('cland.actions').map('n','zb',M.toggle_body,{buffer=c.buf,silent=true,nowait=true})
  require('cland.actions').map('n','<CR>',function()
    local ref = (c.info and c.info[api.nvim_win_get_cursor(0)[1]] or {}).ref
    if ref then M.reveal(ref) end
  end,{buffer=c.buf,silent=true,nowait=true})
  c.lines, c.marks = nil, nil
  return c.buf
end
function M.close_card()
  local c = M.card
  if c.timer then c.timer:stop(); c.timer_key = nil end
  local win = c.win
  c.win, c.key = nil, nil
  if valid(win) then pcall(api.nvim_win_close,win,true) end
end
function M.fit_card(tree)
  local c = M.card
  if not (valid(c.win) and valid(tree)) then return end
  local total = api.nvim_win_get_width(tree) + api.nvim_win_get_width(c.win) + 1
  local target = tonumber(M.ui().card_width) or math.max(36,math.min(72,math.floor(total*0.42)))
  target = math.max(1,math.min(target,math.max(1,total-31)))
  if api.nvim_win_get_width(c.win) ~= target then api.nvim_win_set_width(c.win,target) end
end
-- Layout owns the resize baseline, so automatic redistribution never becomes a preference.
function M.sync(win)
  local layout, c = require('cland.layout'), M.card
  local ui = state.S.ui
  if ui.view.kind ~= 'explorer' then
    local compose = package.loaded['cland.explorer_compose']
    if compose then compose.close_composer() end
    M.close_card()
    if c.over_right then
      c.over_right = nil
      if ui.right then layout.open_right(ui.right) end
      if ui.dock then layout.open_dock() end
    end
    return
  end
  local _, rw = layout.widths()
  local total = api.nvim_win_get_width(win) + (valid(c.win) and (api.nvim_win_get_width(c.win)+1) or 0)
  local suspended = c.over_right and not valid(layout.win.right) and not valid(layout.win.dock)
  local beside = total - (suspended and (rw+1) or 0)
  local target = tonumber(M.ui().card_width) or math.max(36,math.min(72,math.floor(beside*0.42)))
  local over = ui.right ~= nil and beside-target-1<80
  if over then
    -- Remove physical windows before closing, so WinClosed cannot change saved panel preferences.
    c.over_right = true
    for _, side in ipairs({'right','dock'}) do
      local panel = layout.win[side]
      layout.win[side] = nil
      if valid(panel) then api.nvim_win_close(panel,true) end
    end
  elseif c.over_right then
    c.over_right = nil
    if ui.right then layout.open_right(ui.right) end
    if ui.dock then layout.open_dock() end
  end
  vim.wo[win].cursorline, vim.wo[win].wrap, vim.wo[win].foldenable = true, false, false
  if not valid(M.card.win) then
    local width = tonumber(M.ui().card_width) or math.max(36,math.min(72,math.floor(api.nvim_win_get_width(win)*0.42)))
    M.card.win = api.nvim_open_win(M.card_buf(),false,{split='right',win=win,width=width})
    vim.w[M.card.win].cland_card = true
    local wo = vim.wo[M.card.win]
    wo.winfixwidth, wo.wrap, wo.cursorline, wo.number, wo.relativenumber = true, false, false, false, false
    wo.signcolumn, wo.foldcolumn, wo.list = 'no', '0', false
  end
  if over then api.nvim_win_set_width(c.win,math.min(rw,math.max(1,total-31))) else M.fit_card(win) end
  M.render()
end
function M.render_card()
  local c = M.card
  if not valid(c.win) then return end
  local b = M.card_buf()
  local lines, marks, info = require('cland.explorer_card').compose(c.key,api.nvim_win_get_width(c.win)-1)
  c.info = info
  if not vim.deep_equal(lines,c.lines) or not vim.deep_equal(marks,c.marks) then
    vim.bo[b].modifiable = true
    api.nvim_buf_set_lines(b,0,-1,false,lines)
    vim.bo[b].modifiable = false
    api.nvim_buf_clear_namespace(b,card_ns,0,-1)
    for _, m in ipairs(marks) do api.nvim_buf_set_extmark(b,card_ns,m[1],m[2],{end_col=m[3],hl_group=m[4]}) end
    if c.drawn_key ~= c.key then api.nvim_win_set_cursor(c.win,{1,0}) end
    c.lines, c.marks, c.drawn_key = lines, marks, c.key
    c.writes = (c.writes or 0) + 1
  end
end
M.FOLLOW_MS = 100
function M.follow(key)
  local c = M.card
  if not valid(c.win) then return end
  if not key or key == c.key then
    if c.timer then c.timer:stop(); c.timer_key = nil end
    return
  end
  if key == c.timer_key then return end
  c.timer = c.timer or vim.uv.new_timer()
  c.timer_key = key
  c.timer:start(M.FOLLOW_MS,0,vim.schedule_wrap(function()
    c.timer_key = nil
    local win = M.tree_win()
    if not valid(c.win) or win == -1 or key ~= M.key_at(api.nvim_win_get_cursor(win)[1]) then return end
    c.key = key
    M.render_card()
    require('cland.bars').redraw()
  end))
end
function M.focus_card()
  local row, win = info_here()
  if not (row and row.key and win) then return end
  if not valid(M.card.win) then M.sync(win) end
  if M.card.timer then M.card.timer:stop(); M.card.timer_key = nil end
  M.card.key = row.key
  M.render_card()
  if valid(M.card.win) then api.nvim_set_current_win(M.card.win) end
end
function M.card_winbar(win)
  local bars = require('cland.bars')
  local width = api.nvim_win_get_width(win)
  local it = M.card.key and state.item(M.card.key)
  local identities = {''}
  if it then
    local ix = M.ix or M.index()
    local glyph, status = M.glyph(ix,it), M.status_of(ix,it)
    identities = {it.id .. ' · ' .. it.kind .. ' · ' .. glyph .. ' ' .. status,
      it.id .. ' · ' .. glyph .. ' ' .. status, it.id .. ' ' .. glyph, it.id}
  end
  local options = {'↵ reveal · h back · zb text · gt topic · gs session · gp plan',
    '↵ reveal · h back · zb · gt · gs · gp', '↵ h zb gt gs gp'}
  for _, identity in ipairs(identities) do
    for _, keys in ipairs(options) do
      if 6+sw(identity)+1+sw(keys) <= width then
        return bars.stl({{' CARD ',win == api.nvim_get_current_win() and 'ClandHeadFocus' or 'ClandHead'},
          {identity,'ClandDimBar'}}) .. '%<%#WinBar#%=' .. bars.stl({{' ' .. keys,'ClandDimBar'}})
      end
    end
  end
  return bars.stl(bars.fit({{' CARD ','ClandHead'},{identities[#identities] .. ' ' .. options[#options],'ClandDimBar'}},width))
end
-- Reveal folds are transient; ui.json records only the human's own folds and filters.
function M.reveal(id)
  local it = state.item(id)
  if not it then return state.say('gi: unknown item ' .. id,'ClandRedBar') end
  local ix, ancestors, seen, p = M.index(), {}, {}, it
  while p and not seen[p.id] do
    seen[p.id] = true; table.insert(ancestors,1,p)
    p = present(p.parent) and ix.by[p.parent] or nil
  end
  local root = ancestors[1]
  local scope = state.S.ui.view.kind == 'explorer' and M.scope_key() or M.ui().scope
  local holds = false
  if scope then
    local node = M.node_for(ix,scope)
    if node and node.it then holds = seen[node.it.id] == true
    elseif node and root then
      -- Membership is structural: D/A may hide the target, but do not remove it from its scope.
      if scope == ':categories' then holds = items.is_category(root)
      elseif scope == ':unscheduled' then holds = not items.is_category(root) and not M.is_release(root)
      elseif scope == ':releases' then
        local release = M.root_release()
        holds = M.is_release(root) and (not release or root.id ~= release.id)
      else
        for _, child in ipairs(node.list or {}) do if seen[child.id] then holds = true end end
      end
    end
  end
  if not holds then scope = nil end
  M.reveal_open = {}
  for _, ancestor in ipairs(ancestors) do M.reveal_open[ancestor.id] = true end
  if root then
    if items.is_category(root) then M.reveal_open[':categories'] = true
    elseif M.is_release(root) then
      local release = M.root_release()
      if not release or root.id ~= release.id then M.reveal_open[':releases'] = true end
      if it.parent == root.id and not M.is_container(ix,it) then M.reveal_open[':direct:' .. root.id] = true end
    else M.reveal_open[':unscheduled'] = true end
  end
  M.reveal_item = it.id
  M.sel[scope or ''] = it.id
  M.position_scope = nil
  require('cland.layout').show({kind='explorer',id=scope},{insert=false})
  goto_key(it.id)
  M.remember()
  if M.card.timer then M.card.timer:stop(); M.card.timer_key = nil end
  M.card.key = it.id
  M.render_card()
  require('cland.bars').redraw()
end

function M.buf()
  if M.b and api.nvim_buf_is_valid(M.b) then return M.b end
  M.b = api.nvim_create_buf(false, true)
  vim.bo[M.b].bufhidden, vim.bo[M.b].modifiable = 'hide', false
  vim.b[M.b].cland_role = 'explorer'
  api.nvim_buf_set_name(M.b, 'cland://explorer')
  local keys = {
    j = function() M.move(1) end, k = function() M.move(-1) end,
    l = M.right, h = M.left, za = M.toggle, ['<CR>'] = M.focus_card,
    zo = function() M.fold('open') end, zc = function() M.fold('close') end,
    zR = function() M.fold_all(true) end, zM = function() M.fold_all(false) end,
    s = M.scope_here,
    m = function() require('cland.explorer_compose').here(false) end,
    M = function() require('cland.explorer_compose').here(true) end,
    D = M.toggle_done, A = M.toggle_archive, zb = M.toggle_body,
  }
  for key, run in pairs(keys) do
    require('cland.actions').map('n', key, run, {buffer=M.b,silent=true,nowait=true})
  end
  for _, key in ipairs({'m','M'}) do
    require('cland.actions').map('x',key,function() require('cland.explorer_compose').here(key == 'M',true) end,{buffer=M.b,silent=true,nowait=true})
  end
  api.nvim_create_autocmd('CursorMoved', {buffer=M.b, callback=function()
    M.remember()
    local win = M.tree_win()
    if win ~= -1 then M.follow(M.key_at(api.nvim_win_get_cursor(win)[1])) end
  end})
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
    elseif node then
      -- Count the underlying scope, even when D filters its rows or its nodes are folded.
      local list = node.key == ':categories' and M.categories(ix)
        or node.key == ':unscheduled' and M.unscheduled(ix)
        or node.key == ':releases' and M.other_releases(ix, M.root_release()) or node.list or {}
      for _, it in ipairs(list) do visit(it) end
    end
  else
    local root = M.root_release()
    if root then visit(root) end
  end
  return count
end
function M.render()
  local b, scope = M.buf(), M.scope_key()
  M.ui().scope = scope
  local win = M.tree_win()
  local width = api.nvim_win_get_width(win ~= -1 and win or require('cland.layout').centre()) - 1
  local key = win ~= -1 and M.drawn_scope == scope and M.key_at(api.nvim_win_get_cursor(win)[1]) or M.sel[scope or '']
  local parents = {}
  for _, row in ipairs(M.rows) do if row.key then parents[row.key] = row.parent end end
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
    local at, row = {}, nil
    for r, info in ipairs(rows) do if info.target then at[info.key] = r; row = row or r end end
    local seen = {}
    while key and not at[key] and not seen[key] do seen[key] = true; key = parents[key] end
    row = at[key] or row or 1
    api.nvim_win_set_cursor(win, {row,0})
    M.sel[scope or ''] = rows[row].key
    M.position_scope = scope or ''
  end
  if win ~= -1 then
    M.follow(M.key_at(api.nvim_win_get_cursor(win)[1]))
    M.render_card()
  end
  return b
end
function M.open(id)
  if id then
    local it = state.item(id)
    if not it then return state.say('explorer: unknown item ' .. id, 'ClandRedBar') end
    id = it.id
  else
    id = M.ui().scope
    if id and not M.node_for(M.index(), id) then id = nil end
  end
  require('cland.layout').show({kind='explorer',id=id}, {insert=false})
end
function M.title(scope)
  local it = scope and state.item(scope) or M.root_release()
  return it and (it.id .. ' ' .. items.display_title(it)) or scope or 'no open release'
end
function M.crumbs(scope)
  if not scope then return {M.title(nil)} end
  local ix, out, seen = M.ix or M.index(), {}, {}
  local node = M.node_for(ix, scope)
  if not node then return {scope} end
  local it = node.it or (node.owner and ix.by[node.owner])
  while it and not seen[it.id] do
    seen[it.id] = true
    table.insert(out, 1, M.title(it.id))
    it = present(it.parent) and ix.by[it.parent] or nil
  end
  if node.virtual then out[#out + 1] = node.label end
  return out
end
function M.context() return 'Explorer · ' .. table.concat(M.crumbs(M.scope_key()), ' › ') end
function M.winbar(win)
  local bars = require('cland.bars')
  return bars.stl({{' EXPLORER ', win == api.nvim_get_current_win() and 'ClandHeadFocus' or 'ClandHead'},
    {table.concat(M.crumbs(M.scope_key()), ' › '), 'ClandDimBar'}}) .. '%<%#WinBar#%=' .. bars.stl({{
      (M.ui().hide_done and 'done hidden · ' or 'done shown · ') .. (M.done_in_view or 0) .. ' · D ', 'ClandDimBar'}})
end
return M
