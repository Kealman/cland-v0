-- Experimental centre view of one container's children. The hub owns every item
-- field; graph_layout owns sibling edges and the display-column canvas.
local api = vim.api
local bit = require('bit')
local state = require('cland.state')
local items = require('cland.items')
local G = require('cland.graph_layout')
local M = { tray_done = false, orient = 'vertical', reduce = true, stages = false, sel = {}, vmin = 20, width = 30 }
local ns = api.nvim_create_namespace('cland.graph')
local focus_ns = api.nvim_create_namespace('cland.graph.focus')

-- The selected scope may be an epic; find its release before collecting parents.
local function release()
  local it, seen = items.current_release(), {}
  while it and not seen[it.id] do
    seen[it.id] = true
    if it.kind == state.S.tracker.levels[1] and it.state == 'open' then return it end
    it = items.present(it.parent) and state.item(it.parent) or nil
  end
  return items.default_release()
end

--- Open descendants in rank/tree order, followed by the release itself.
function M.parents()
  local root, out, seen = release(), {}, {}
  local function visit(id)
    if seen[id] then return end
    seen[id] = true
    for _, it in ipairs(items.children(id)) do
      if items.is_level(it) and it.state == 'open' then
        out[#out + 1] = it.id
        visit(it.id)
      end
    end
  end
  if root then visit(root.id); out[#out + 1] = root.id end
  return out
end

function M.parent()
  local id = state.S.ui.view.id
  if id and state.item(id) and items.is_container(state.item(id)) then return id end
  return M.parents()[1]
end

function M.cycle(step)
  local parents, current, at = M.parents(), M.parent(), nil
  if #parents == 0 then return state.say('graph: no open container in the current release') end
  for i, id in ipairs(parents) do if id == current then at = i end end
  local next = at and ((at - 1 + step) % #parents + 1) or (step > 0 and 1 or #parents)
  state.S.ui.view.id = parents[next]
  state.changed()
end

function M.open(id)
  if id and id ~= '' then
    local it = state.item(id)
    if not it or not items.is_container(it) then
      return state.say('graph: ' .. id .. ' is not a known container', 'ClandRedBar')
    end
    id = it.id
  else id = nil end
  require('cland.layout').show({ kind = 'graph', id = id }, { insert = false })
end

--- Share the board's hub criteria adapter.
function M.fraction(it)
  return require('cland.vboard').fraction(it)
end

local function latest_verdict(it)
  local verdicts = type(it.verdicts) == 'table' and it.verdicts or {}
  local v = verdicts[#verdicts]
  if v then
    return v, v.result ~= 'clear' and 'ClandRed' or (v.current == false and 'ClandDim' or 'ClandGreen')
  end
end

--- Badge rows stay separate so the claim cannot clip the verdict or fraction.
function M.label(it, width, stage)
  local done = it.status == 'done' or it.state == 'closed'
  local function chunk(text, group) return { text, done and 'ClandDim' or group } end
  local glyph = items.GLYPH[items.status(it)] or items.GLYPH.open
  local head = { chunk(glyph[1], glyph[2]), chunk(' ' .. it.id .. ' ', 'ClandDim') }
  if stage then head[#head + 1] = chunk(stage .. ' ', 'ClandDim') end
  if not done and #items.open_blockers(it) > 0 then head[#head + 1] = chunk('◌ ', 'ClandDim') end
  local title = vim.split(vim.trim(it.title or ''), '\n', { plain = true })[1] or ''
  head[#head + 1] = chunk(title, 'ClandText')
  local lines, who, evidence = { head }, {}, {}
  local asks, claim = items.asks(it), items.claim(it)
  if asks > 0 then who[#who + 1] = chunk('?' .. asks .. ' ', 'ClandAmber') end
  if claim then who[#who + 1] = chunk(claim.session, 'ClandTeal')
  elseif items.present(it.assignee) then who[#who + 1] = chunk('for ' .. it.assignee, 'ClandDim') end
  if #who > 0 then lines[#lines + 1] = who end
  local v, verdict_group = latest_verdict(it)
  if v then
    evidence[#evidence + 1] = chunk((v.result == 'clear' and '✓ ' or '✗ ') .. v.verdict, verdict_group)
  end
  local verified, total = M.fraction(it)
  if total > 0 then
    if #evidence > 0 then evidence[#evidence + 1] = chunk(' · ', 'ClandFaint') end
    evidence[#evidence + 1] = chunk(verified .. '/' .. total, verified == total and 'ClandGreen' or 'ClandDim')
  end
  if #evidence > 0 then lines[#lines + 1] = evidence end
  if width then
    for row, chunks in ipairs(lines) do
      local room = width - (row > 1 and 1 or 0)
      for _, c in ipairs(chunks) do
        c[1] = G.fit(c[1], room, api.nvim_strwidth)
        room = room - G.width(c[1], api.nvim_strwidth)
      end
    end
  end
  return lines
end

function M.compose(id, width)
  local kids = id and items.children(id) or {}
  local parent = id and state.item(id)
  local plan = require('cland.plan')
  local owner = plan.owner(id)
  local detail = owner and plan.get(owner)
  local stages = detail and type(detail.plan) == 'table' and detail.plan.stages or {}
  local tags, ranks, order, sequence = {}, {}, {}, 0
  local grouped = M.stages and #stages > 0
  for n, stage in ipairs(stages) do
    for _, lane in ipairs(stage.lanes) do for _, node in ipairs(lane) do
      sequence = sequence + 1
      tags[node], ranks[node], order[node] = 'S' .. n, n, sequence
    end end
  end
  if grouped then
    table.sort(kids, function(a, b)
      if order[a.id] or order[b.id] then return (order[a.id] or math.huge) < (order[b.id] or math.huge) end
      return items.compare_rank(a, b)
    end)
    for _, it in ipairs(kids) do ranks[it.id] = ranks[it.id] or (#stages + 1) end
  end
  local byid = {}
  for _, it in ipairs(kids) do byid[it.id] = it end
  local L = G.from_items(kids, { reduce = M.reduce, rank = grouped and ranks or nil,
    include = grouped and tags or nil, keep_order = grouped })
  local tray, folded = {}, 0
  for _, node in ipairs(L.tray) do
    if (byid[node].status == 'done' or byid[node].state == 'closed') and not M.tray_done then
      folded = folded + 1
    else tray[#tray + 1] = node end
  end
  L.tray = tray
  local W, origin = math.min(M.width, math.max(1, width - 4)), {}
  if M.orient == 'vertical' then
    L, W, origin = G.fit_window(L, math.max(3, width - 6), M.vmin, 40)
  end
  local left = M.orient == 'vertical' and 4 or 1
  local cv, geometry = G.render(L, { width = W, top = grouped and 3 or 2, left = left, orient = M.orient,
    pack = grouped or M.orient == 'vertical',
    measure = api.nvim_strwidth, tray_columns = math.max(1, math.floor((width - 2) / (W + 3))),
    tray_hl = 'ClandSection', label = function(node, w) return M.label(byid[node], w, tags[node]) end })
  cv:put(0, 1, { { 'Graph · ' .. (parent and (id .. ' ' .. parent.title) or 'No current release'), 'ClandBold' } }, width - 2)
  local headings = {}
  if grouped then
    for band, nodes in ipairs(L.layers) do
      local n = M.orient == 'vertical' and origin[band] or band
      local stage = stages[n]
      local row = M.orient == 'vertical' and geometry.bounds.y[band] - 1 or 2
      local col = M.orient == 'vertical' and left or geometry.bounds.col[band]
      if M.orient == 'vertical' then
        -- The incoming stub row contains vertical edge ports. Start beside the
        -- first real node's port, or past the dummies in an otherwise empty band.
        for _, node in ipairs(nodes) do
          col = left + geometry.pos[node]
          if not G.is_dummy(node) then break end
        end
        col = col + 2
      end
      local text = stage and ('S' .. n .. ' · ' .. stage.name) or 'Unplanned'
      local room = M.orient == 'vertical' and math.min(W - 2, width - col) or W
      local used = cv:put(row, col, { { text, 'ClandSection' } }, room)
      if stage then headings[#headings + 1] = { row = row, col = col, width = used, stage = n, epic = owner } end
    end
  end
  local wrapped = 0
  for band, layer in ipairs(origin) do
    local continuation = origin[band - 1] == layer
    wrapped = wrapped + (continuation and 1 or 0)
    cv:put(geometry.bounds.y[band], 0, { { continuation and ' ↳' or tostring(layer), 'ClandDim' } }, 3)
  end
  if #kids == 0 then cv:put(2, 1, { { 'No children to draw.', 'ClandDim' } }) end
  if #tray + folded > 0 then
    local row = cv.maxr + 2
    for _, node in pairs(geometry.nodes) do if node.tray then row = math.min(row, node.row - 2) end end
    cv:put(row, 1, { { 'Tray · ' .. (#tray + folded) .. ' unlinked', 'ClandSection' },
      { folded > 0 and (' · ' .. folded .. ' done folded, d shows them') or ' · d folds done', 'ClandFaint' } })
  end
  local function note(text, group, gap)
    local row, line = cv.maxr + (gap or 1), ''
    for word in text:gmatch('%S+') do
      local next = line == '' and word or (line .. ' ' .. word)
      if line ~= '' and G.width(next, api.nvim_strwidth) > width - 2 then
        cv:put(row, 1, { { line, group } }); row, line = row + 1, word
      else line = next end
    end
    cv:put(row, 1, { { line, group } })
  end
  local crossings = cv:count()
  note(('%d linked · %d layers · %d edges drawn · %d hidden · %d crossings · nodes %d wide%s'):format(
    #L.nodes, #L.layers, #L.chains, #L.hidden, crossings, W,
    wrapped > 0 and (' · ' .. wrapped .. ' continuations ↳') or ''), 'ClandFaint', 2)
  local function edges_line(label, edges, group)
    if #edges == 0 then return end
    local names = {}
    for _, e in ipairs(edges) do names[#names + 1] = e[1] .. ' → ' .. e[2] end
    note(label .. table.concat(names, ', '), group)
  end
  edges_line('Left out to break a cycle: ', L.cycles, 'ClandRed')
  edges_line('Against the plan: ', L.against, 'ClandRed')
  edges_line('Within a stage: ', L.inside, 'ClandAmber')
  edges_line('Implied by longer paths: ', L.hidden, 'ClandFaint')
  edges_line('Blockers outside ' .. (id or 'the graph') .. ': ', L.outside, 'ClandAmber')
  note('h/j/k/l nodes · ^/$ ends · ↵ open · gi/gt/gs · gp plan · s stages · p/P parent · d done · o turn · r edges · +/- width · ␣␣ back', 'ClandFaint', 2)
  local lines, marks, bytecol, crossings = cv:render('ClandFaint')
  geometry.bytecol, geometry.layout, geometry.orient = bytecol, L, M.orient
  geometry.width, geometry.wrapped, geometry.origin = W, wrapped, origin
  geometry.stages = headings
  geometry.edge_cells, geometry.crossings = cv:cells_of_edges(), crossings
  geometry.bands, geometry.tray, geometry.by_row, geometry.incident = {}, {}, {}, {}
  for layer, ids in ipairs(L.layers) do
    local band = {}
    for _, node in ipairs(ids) do
      if geometry.nodes[node] then
        band[#band + 1] = node
        geometry.nodes[node].band = layer
      end
    end
    geometry.bands[layer] = band
  end
  for _, node in ipairs(L.tray) do
    local n = geometry.nodes[node]
    local column = math.floor((n.col - left) / (W + 3)) + 1
    geometry.tray[column] = geometry.tray[column] or {}
    table.insert(geometry.tray[column], node)
  end
  for node, n in pairs(geometry.nodes) do
    n.bfrom = bytecol[n.row][n.col]
    for row = n.row, n.row + n.height - 1 do
      local bc = bytecol[row]
      geometry.by_row[row] = geometry.by_row[row] or {}
      table.insert(geometry.by_row[row], { bc[n.col], bc[n.col + n.width] or #lines[row + 1], node })
    end
  end
  for edge, chain in ipairs(L.chains) do
    for _, node in ipairs({ chain.path[1], chain.path[#chain.path] }) do
      geometry.incident[node] = geometry.incident[node] or {}
      table.insert(geometry.incident[node], edge)
    end
  end
  return lines, marks, geometry
end

--- Stage headings are selectable even when they have no node under the cursor.
function M.stage_at()
  if not M.model then return end
  local win = vim.fn.bufwinid(M.b or -1)
  if win == -1 then return end
  local cur = api.nvim_win_get_cursor(win)
  for _, heading in ipairs(M.model.stages) do
    local bc = M.model.bytecol[heading.row]
    if cur[1] == heading.row + 1 and cur[2] >= bc[heading.col]
      and cur[2] < bc[heading.col + heading.width] then return heading end
  end
end

--- The node under a buffer cursor, using byte spans for every label row.
function M.node_at(row, col)
  if not M.model then return end
  if not row then
    local win = vim.fn.bufwinid(M.b or -1)
    if win == -1 then return end
    local cur = api.nvim_win_get_cursor(win)
    row, col = cur[1], cur[2]
  end
  for _, span in ipairs(M.model.by_row[row - 1] or {}) do
    if col >= span[1] and col < span[2] then return span[3] end
  end
end

function M.item_at()
  local parent = M.parent()
  return M.node_at() or (parent and M.sel[parent])
end

local function first_node()
  local order, open = {}, nil
  for _, band in ipairs(M.model.bands) do vim.list_extend(order, band) end
  local tray = {}
  for _, column in ipairs(M.model.tray) do vim.list_extend(tray, column) end
  table.sort(tray, function(a, b)
    local n, m = M.model.nodes[a], M.model.nodes[b]
    return n.row == m.row and n.col < m.col or n.row < m.row
  end)
  vim.list_extend(order, tray)
  for _, id in ipairs(order) do
    local it = state.item(id)
    if it then
      local st = items.status(it)
      if vim.tbl_contains({ 'in progress', 'review', 'qa', 'ready' }, st) then return id end
      if st ~= 'done' and st ~= 'closed' then open = open or id end
    end
  end
  return open or order[1]
end

--- Cursor motion touches only the focus namespace, never the canvas buffer.
function M.focus()
  local b, m, parent = M.b, M.model, M.parent()
  if not (b and m and api.nvim_buf_is_valid(b)) then return end
  api.nvim_buf_clear_namespace(b, focus_ns, 0, -1)
  local id = parent and M.sel[parent]
  local n = id and m.nodes[id]
  if not n then return end
  local function mark(row, from, to, group, priority)
    if from and to and to > from then
      api.nvim_buf_set_extmark(b, focus_ns, row, from, { end_col = to, hl_group = group, priority = priority })
    end
  end
  for row = n.row, n.row + n.height - 1 do
    local bc = m.bytecol[row]
    mark(row, bc[n.col], bc[n.col + n.width] or #api.nvim_buf_get_lines(b, row, row + 1, false)[1], 'ClandSel', 300)
  end
  local runs = {}
  for _, edge in ipairs(m.incident[id] or {}) do
    for _, cell in ipairs(m.edge_cells[edge] or {}) do
      local row, col, bits = cell[1], cell[2], cell[3]
      local bc = m.bytecol[row]
      if m.crossings[row] and m.crossings[row][col] and bit.band(bits, G.L + G.R) ~= 0 then
        api.nvim_buf_set_extmark(b, focus_ns, row, bc[col], {
          virt_text = { { '─', 'ClandBlue' } }, virt_text_pos = 'overlay', priority = 260 })
      else
        runs[row] = runs[row] or {}
        runs[row][col] = true
      end
    end
  end
  for row, cells in pairs(runs) do
    local cols = vim.tbl_keys(cells)
    table.sort(cols)
    local i, bc = 1, m.bytecol[row]
    while i <= #cols do
      local j = i
      while cols[j + 1] == cols[j] + 1 do j = j + 1 end
      mark(row, bc[cols[i]], bc[cols[j] + 1], 'ClandBlue', 250)
      i = j + 1
    end
  end
end

--- Keep the whole label visible when it fits, otherwise keep its glyph visible.
local function place(win, n)
  api.nvim_win_set_cursor(win, { n.row + 1, n.bfrom })
  api.nvim_win_call(win, function()
    local view = vim.fn.winsaveview()
    local width = api.nvim_win_get_width(win)
    local right = n.col + math.min(n.width, width)
    if n.col < view.leftcol then view.leftcol = n.col
    elseif right > view.leftcol + width then view.leftcol = right - width end
    vim.fn.winrestview(view)
  end)
end

local function go(id)
  local n = id and M.model and M.model.nodes[id]
  if not n then return end
  M.sel[M.parent()] = id
  local win = vim.fn.bufwinid(M.b)
  if win ~= -1 then place(win, n) end
  M.focus()
  require('cland.bars').redraw()
end

local function index_in(list, id)
  for i, node in ipairs(list) do if node == id then return i end end
end

local function nearest(list, key, value)
  local best, distance
  for _, id in ipairs(list or {}) do
    local d = math.abs(M.model.nodes[id][key] - value)
    if not distance or d < distance then best, distance = id, d end
  end
  return best
end

local function nearest_list(lists, col)
  local best, distance
  for _, list in ipairs(lists) do
    if #list > 0 then
      local d = math.abs(M.model.nodes[list[1]].col - col)
      if not distance or d < distance then best, distance = list, d end
    end
  end
  return best
end

local function next_band(bands, i, step)
  i = i + step
  while bands[i] and #bands[i] == 0 do i = i + step end
  return bands[i]
end

--- Motions follow the visible orientation; dummy-only bands are skipped.
function M.move(dir)
  local m = M.model
  if not m then return end
  local id = M.item_at()
  local n = id and m.nodes[id]
  if not n then return go(first_node()) end
  local vertical = m.orient == 'vertical'
  if dir == 'top' or dir == 'bottom' then
    local other = next_band(m.bands, dir == 'top' and 0 or #m.bands + 1, dir == 'top' and 1 or -1)
    local key = vertical and 'col' or 'row'
    return go(nearest(other, key, n[key]) or id)
  end
  if n.tray then
    local ci, at
    for i, column in ipairs(m.tray) do
      at = index_in(column, id)
      if at then ci = i; break end
    end
    local column = m.tray[ci]
    if dir == 'up' then
      if column[at - 1] then return go(column[at - 1]) end
      local last = next_band(m.bands, #m.bands + 1, -1)
      if last then
        if vertical then return go(nearest(last, 'col', n.col)) end
        local band = nearest_list(m.bands, n.col)
        return go(band[#band])
      end
    elseif dir == 'down' then return go(column[at + 1] or id)
    elseif dir == 'left' or dir == 'right' then
      return go(nearest(m.tray[ci + (dir == 'right' and 1 or -1)], 'row', n.row) or id)
    elseif dir == 'first' or dir == 'last' then
      return go(nearest(m.tray[dir == 'first' and 1 or #m.tray], 'row', n.row))
    end
    return go(id)
  end
  local band = m.bands[n.band]
  local at = index_in(band, id)
  local along_prev, along_next = vertical and 'left' or 'up', vertical and 'right' or 'down'
  local across_prev, across_next = vertical and 'up' or 'left', vertical and 'down' or 'right'
  if dir == along_prev then return go(band[at - 1] or id)
  elseif dir == along_next then
    if band[at + 1] then return go(band[at + 1]) end
    if not vertical and #m.tray > 0 then return go(nearest_list(m.tray, n.col)[1]) end
  elseif dir == across_prev or dir == across_next then
    local other = next_band(m.bands, n.band, dir == across_next and 1 or -1)
    if other then
      local key = vertical and 'col' or 'row'
      return go(nearest(other, key, n[key]))
    elseif vertical and dir == 'down' and #m.tray > 0 then
      return go(nearest_list(m.tray, n.col)[1])
    end
  elseif dir == 'first' then return go(band[1])
  elseif dir == 'last' then return go(band[#band])
  end
  go(id)
end

function M.buf()
  if M.b and api.nvim_buf_is_valid(M.b) then return M.b end
  M.b = api.nvim_create_buf(false, true)
  M.lines, M.marks, M.drawn = nil, nil, nil
  vim.bo[M.b].bufhidden = 'hide'
  vim.bo[M.b].modifiable = false
  api.nvim_buf_set_name(M.b, 'cland://graph')
  vim.b[M.b].cland_role = 'graph'
  local function map(key, fn)
    require('cland.actions').map('n', key, fn, { buffer = M.b, nowait = true, silent = true })
  end
  for key, dir in pairs({ h = 'left', l = 'right', j = 'down', k = 'up' }) do
    map(key, function() M.move(dir) end)
  end
  map('^', function() M.move(M.orient == 'vertical' and 'first' or 'top') end)
  map('$', function() M.move(M.orient == 'vertical' and 'last' or 'bottom') end)
  for _, key in ipairs({ 'gg', 'G' }) do
    map(key, function()
      if M.orient == 'vertical' then return M.move(key == 'gg' and 'top' or 'bottom') end
      vim.cmd('normal! ' .. (vim.v.count > 0 and tostring(vim.v.count) or '') .. key)
    end)
  end
  map('<CR>', function()
    local id = M.item_at()
    if id then require('cland.layout').show({ kind = 'item', id = id }, { insert = false }) end
  end)
  for key, step in pairs({ p = 1, P = -1 }) do map(key, function() M.cycle(step) end) end
  map('d', function() M.tray_done = not M.tray_done; state.changed() end)
  map('o', function() M.orient = M.orient == 'vertical' and 'horizontal' or 'vertical'; state.changed() end)
  for key, step in pairs({ ['+'] = 1, ['-'] = -1 }) do
    map(key, function()
      if M.orient == 'vertical' then M.vmin = math.max(14, math.min(36, M.vmin + step * 2))
      else M.width = math.max(18, math.min(60, M.width + step * 4)) end
      state.changed()
    end)
  end
  map('r', function() M.reduce = not M.reduce; state.changed() end)
  map('s', function() M.stages = not M.stages; state.changed() end)
  map('gp', function()
    local heading = M.stage_at()
    require('cland.plan').open(heading and heading.epic or M.item_at() or M.parent())
  end)
  api.nvim_create_autocmd('CursorMoved', { buffer = M.b, callback = function()
    local id, parent = M.node_at(), M.parent()
    if id and parent and id ~= M.sel[parent] then
      M.sel[parent] = id
      M.focus()
      require('cland.bars').redraw()
    end
  end })
  api.nvim_create_autocmd('BufWinEnter', { buffer = M.b, callback = function() M.place = true end })
  return M.b
end

--- Compare what is actually drawn, including highlights. Metadata, unrelated
--- events and a refreshed body with identical criteria never rewrite the buffer.
function M.render()
  local b = M.buf()
  local win = vim.fn.bufwinid(b)
  local parent = M.parent()
  local width = api.nvim_win_get_width(win ~= -1 and win or require('cland.layout').centre())
  local resized = width ~= M.window_width
  local lines, marks, model = M.compose(parent, width)
  local fresh = not vim.deep_equal(lines, M.lines) or not vim.deep_equal(marks, M.marks)
  -- Two routings may emit the same text while owning different focused edges.
  local geometry_changed = not M.model or not vim.deep_equal(model.nodes, M.model.nodes)
    or not vim.deep_equal(model.incident, M.model.incident) or not vim.deep_equal(model.edge_cells, M.model.edge_cells)
  local follow = win ~= -1 and (M.drawn ~= parent or M.node_at() == (parent and M.sel[parent]))
  local view = win ~= -1 and api.nvim_win_call(win, vim.fn.winsaveview)
  if fresh then
    vim.bo[b].modifiable = true
    api.nvim_buf_set_lines(b, 0, -1, false, lines)
    vim.bo[b].modifiable = false
    api.nvim_buf_clear_namespace(b, ns, 0, -1)
    for _, mark in ipairs(marks) do
      api.nvim_buf_set_extmark(b, ns, mark[1], mark[2], { end_col = mark[3], hl_group = mark[4] })
    end
    M.lines, M.marks = lines, marks
    if win ~= -1 then
      api.nvim_win_call(win, function() vim.fn.winrestview(view) end)
      M.place = M.place or follow
    end
  end
  local changed_parent = M.drawn ~= parent
  M.model, M.drawn, M.window_width = model, parent, width
  M.place = M.place or (resized and follow)
  if parent and not model.nodes[M.sel[parent]] then M.sel[parent] = first_node(); M.place = true end
  if (M.place or changed_parent) and win ~= -1 then
    M.place = false
    local n = parent and model.nodes[M.sel[parent]]
    if n then place(win, n) end
  end
  if fresh or changed_parent or geometry_changed then M.focus() end
  return b
end

--- The selected node in full, even when the canvas clips its label.
function M.winbar(win)
  local bars = require('cland.bars')
  local parent = M.parent()
  local id = parent and M.sel[parent]
  local it = id and state.item(id)
  local left = { { ' GRAPH ', win == api.nvim_get_current_win() and 'ClandHeadFocus' or 'ClandHead' } }
  if it then
    local st = items.status(it)
    local glyph = items.GLYPH[st] or items.GLYPH.open
    left[#left + 1] = { id .. ' ', 'ClandBoldBar' }
    left[#left + 1] = { glyph[1] .. ' ' .. st, glyph[2] .. 'Bar' }
    local blockers = items.open_blockers(it)
    if #blockers > 0 and it.state ~= 'closed' then
      left[#left + 1] = { ' · ◌ blocked by ' .. table.concat(blockers, ', '), 'ClandDimBar' }
    end
    local claim = items.claim(it)
    if claim then left[#left + 1] = { ' · ' .. state.label(claim.session, claim.role), 'ClandTealBar' }
    elseif items.present(it.assignee) then left[#left + 1] = { ' · for ' .. it.assignee, 'ClandDimBar' } end
    local asks = items.asks(it)
    if asks > 0 then left[#left + 1] = { ' · ?' .. asks, 'ClandAmberBar' } end
    local v, verdict_group = latest_verdict(it)
    if v then
      left[#left + 1] = { ' · ' .. (v.result == 'clear' and '✓ ' or '✗ ') .. v.verdict .. ' ' .. v.result,
        verdict_group .. 'Bar' }
    end
    local verified, total = M.fraction(it)
    if total > 0 then left[#left + 1] = { ' · ' .. verified .. '/' .. total .. ' criteria', 'ClandDimBar' } end
    left[#left + 1] = { ' · ' .. (vim.split(it.title or '', '\n', { plain = true })[1] or ''), 'ClandTextBar' }
  end
  return bars.stl(left) .. '%<%#WinBar#%=' .. bars.stl({ { parent or 'no current release', 'ClandDimBar' } }) .. '%#WinBar# '
end

return M
