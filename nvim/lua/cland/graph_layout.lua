-- Pure task-graph layout and display-column canvas (T-159).
-- Rebuilt from prototype/graph at 0490b89 and the T-86 rendering probes.
-- No buffers, hub, keys or Neovim globals. Unicode label measurement is supplied
-- by the caller (for Neovim: vim.fn.strdisplaywidth, with ambiwidth=single).
-- A layout is orientation independent; render() defaults to top to bottom.
local bit = require('bit')

local M = {}

local U, D, LT, RT = 1, 2, 4, 8
M.U, M.D, M.L, M.R = U, D, LT, RT

--- A cell's glyph from the directions its lines leave it in.
M.BOX = {
  [U + D] = '│', [LT + RT] = '─', [D + RT] = '┌', [D + LT] = '┐', [U + RT] = '└', [U + LT] = '┘',
  [U + D + RT] = '├', [U + D + LT] = '┤', [LT + RT + D] = '┬', [LT + RT + U] = '┴', [U + D + LT + RT] = '│',
  [RT] = '─', [LT] = '─', [U] = '│', [D] = '│',
}

local function is_dummy(v)
  return v:sub(1, 1) == '~'
end
M.is_dummy = is_dummy

local function copy_layers(layers)
  local out = {}
  for l, ids in ipairs(layers) do
    out[l] = { unpack(ids) }
  end
  return out
end

-- The layered graph ---------------------------------------------------------------------------------------

--- `nodes`: ids in their order, the tie-break everywhere; `edges`: {from, to} pairs, the blocker first. Edges
--- naming an unknown id, a repeat are dropped. Self-loops are reported as cycles. Reduction is on by default;
--- opts.reduce=false keeps edges implied by longer paths;
--- opts.sweeps caps the barycentre sweeps (24). opts.rank (id → layer) gives the layers instead of the ASAP
--- ranking, and an edge that does not go forward across them is set aside (`inside` one layer, or `against` them);
--- opts.keep_order keeps the given order inside each layer (dummies after the vertices). Returns a table:
---   layers     list of lists of vertex ids, top to bottom; a dummy vertex's id starts with `~`
---   layer      vertex → its layer (1-based)
---   succ, pred vertex → the vertices it joins in the next / previous layer
---   chains     every drawn edge: { from, to, path = { from, ~d1, …, to } }
---   via        dummy vertex → the index of its chain
---   hidden     edges the reduction left out; cycles: edges left out to break a cycle
---   inside, against  with opts.rank, the edges inside one layer and the edges going back
---   crossings  crossings between adjacent layers, counted as straight segments, after ordering
---   edges      the number of distinct edges given (before cycles and reduction)
function M.layout(nodes, edges, opts)
  opts = opts or {}
  local idx = {}
  for i, id in ipairs(nodes) do
    idx[id] = i
  end
  local out, seen, total = {}, {}, 0
  for _, id in ipairs(nodes) do
    out[id] = {}
  end
  for _, e in ipairs(edges) do
    local u, v = e[1], e[2]
    local key = tostring(u) .. '\0' .. tostring(v)
    if idx[u] and idx[v] and not seen[key] then
      seen[key] = true
      total = total + 1
      table.insert(out[u], v)
    end
  end
  local function by_idx(a, b)
    return idx[a] < idx[b]
  end
  for _, id in ipairs(nodes) do
    table.sort(out[id], by_idx)
  end

  -- 0. given layers: only edges going forward across them are drawn
  local given, inside, against = opts.rank, {}, {}
  if given then
    for _, u in ipairs(nodes) do
      local keep = {}
      for _, v in ipairs(out[u]) do
        if given[u] < given[v] then
          keep[#keep + 1] = v
        elseif given[u] == given[v] then
          inside[#inside + 1] = { u, v }
        else
          against[#against + 1] = { u, v }
        end
      end
      out[u] = keep
    end
  end

  -- 1. cycles: an edge back into the walk's own stack is left out
  local mark, cycles = {}, {}
  local function walk(u)
    mark[u] = 1
    local keep = {}
    for _, v in ipairs(out[u]) do
      if mark[v] == 1 then
        cycles[#cycles + 1] = { u, v }
      else
        keep[#keep + 1] = v
        if not mark[v] then
          walk(v)
        end
      end
    end
    out[u] = keep
    mark[u] = 2
  end
  for _, id in ipairs(nodes) do
    if not mark[id] then
      walk(id)
    end
  end

  -- 2. reduction: u → v goes when v is reachable from another successor of u (reachability stays the same)
  local hidden = {}
  if opts.reduce ~= false then
    local desc = {}
    local function reach(u)
      if desc[u] then
        return desc[u]
      end
      local s = {}
      desc[u] = s
      for _, v in ipairs(out[u]) do
        s[v] = true
        for w in pairs(reach(v)) do
          s[w] = true
        end
      end
      return s
    end
    for _, u in ipairs(nodes) do
      reach(u)
    end
    for _, u in ipairs(nodes) do
      local keep = {}
      for _, v in ipairs(out[u]) do
        local implied = false
        for _, w in ipairs(out[u]) do
          if w ~= v and desc[w][v] then
            implied = true
            break
          end
        end
        if implied then
          hidden[#hidden + 1] = { u, v }
        else
          keep[#keep + 1] = v
        end
      end
      out[u] = keep
    end
  end

  -- 3. layers, ASAP: one past the furthest blocker (the reduction keeps every longest path)
  local inn = {}
  for _, id in ipairs(nodes) do
    inn[id] = {}
  end
  for _, u in ipairs(nodes) do
    for _, v in ipairs(out[u]) do
      table.insert(inn[v], u)
    end
  end
  local rank = {}
  local function rank_of(v)
    if rank[v] then
      return rank[v]
    end
    if given then
      rank[v] = given[v]
      return rank[v]
    end
    local best = 1
    for _, u in ipairs(inn[v]) do
      best = math.max(best, rank_of(u) + 1)
    end
    rank[v] = best
    return best
  end
  local nl = 0
  for _, id in ipairs(nodes) do
    nl = math.max(nl, rank_of(id))
  end

  -- 4. dummy vertices for the layers a long edge crosses
  local layers, layer, succ, pred, chains, via = {}, {}, {}, {}, {}, {}
  for l = 1, nl do
    layers[l] = {}
  end
  local function vertex(v, l)
    layer[v], succ[v], pred[v] = l, {}, {}
  end
  for _, id in ipairs(nodes) do
    vertex(id, rank[id])
  end
  local n = 0
  for _, u in ipairs(nodes) do
    for _, v in ipairs(out[u]) do
      local path, prev = { u }, u
      for l = rank[u] + 1, rank[v] - 1 do
        n = n + 1
        local d = '~' .. n
        vertex(d, l)
        via[d] = #chains + 1
        table.insert(succ[prev], d)
        table.insert(pred[d], prev)
        path[#path + 1] = d
        prev = d
      end
      table.insert(succ[prev], v)
      table.insert(pred[v], prev)
      path[#path + 1] = v
      chains[#chains + 1] = { from = u, to = v, path = path }
    end
  end

  -- 5. order: a depth-first start (dagre's initOrder), then sweeps, then transpose
  local key = {}
  for id, i in pairs(idx) do
    key[id] = i
  end
  for d, c in pairs(via) do
    key[d] = idx[chains[c].to] + idx[chains[c].from] / 1e4
  end
  local function by_key(a, b)
    return key[a] < key[b]
  end
  local placed = {}
  local function visit(v)
    if placed[v] then
      return
    end
    placed[v] = true
    table.insert(layers[layer[v]], v)
    local next = { unpack(succ[v]) }
    table.sort(next, by_key)
    for _, w in ipairs(next) do
      visit(w)
    end
  end
  if opts.keep_order then
    for _, id in ipairs(nodes) do
      table.insert(layers[layer[id]], id)
    end
    local ds = {}
    for d in pairs(via) do
      ds[#ds + 1] = d
    end
    table.sort(ds, by_key)
    for _, d in ipairs(ds) do
      table.insert(layers[layer[d]], d)
    end
  else
    local starts = { unpack(nodes) }
    table.sort(starts, function(a, b)
      if rank[a] ~= rank[b] then
        return rank[a] < rank[b]
      end
      return idx[a] < idx[b]
    end)
    for _, v in ipairs(starts) do
      visit(v)
    end
  end

  local pos = {}
  local function positions()
    for _, ids in ipairs(layers) do
      for i, v in ipairs(ids) do
        pos[v] = i
      end
    end
  end
  local function crossings()
    local c = 0
    for l = 1, #layers - 1 do
      local es = {}
      for _, a in ipairs(layers[l]) do
        for _, b in ipairs(succ[a]) do
          es[#es + 1] = { pos[a], pos[b] }
        end
      end
      for i = 1, #es do
        local e1 = es[i]
        for j = i + 1, #es do
          local e2 = es[j]
          if (e1[1] - e2[1]) * (e1[2] - e2[2]) < 0 then
            c = c + 1
          end
        end
      end
    end
    return c
  end
  positions()
  local best, best_c, stale = copy_layers(layers), crossings(), 0
  for s = 1, opts.keep_order and 0 or (opts.sweeps or 24) do
    if best_c == 0 then
      break
    end
    local down = s % 2 == 1
    local nb = down and pred or succ
    local from, to, step = 2, #layers, 1
    if not down then
      from, to, step = #layers - 1, 1, -1
    end
    for l = from, to, step do
      local ids, bc, movable, fixed = layers[l], {}, {}, {}
      for i, v in ipairs(ids) do
        local ns = nb[v]
        if #ns > 0 then
          local sum = 0
          for _, w in ipairs(ns) do
            sum = sum + pos[w]
          end
          bc[v] = sum / #ns
          movable[#movable + 1] = v
        else
          -- no neighbour on the swept side: it keeps its place (dagre's "unsortable" entries)
          fixed[i] = v
        end
      end
      table.sort(movable, function(a, b)
        if bc[a] ~= bc[b] then
          return bc[a] < bc[b]
        end
        return pos[a] < pos[b]
      end)
      local ordered, k = {}, 1
      for i = 1, #ids do
        if fixed[i] then
          ordered[i] = fixed[i]
        else
          ordered[i] = movable[k]
          k = k + 1
        end
      end
      layers[l] = ordered
      for i, v in ipairs(ordered) do
        pos[v] = i
      end
    end
    local c = crossings()
    if c < best_c then
      best, best_c, stale = copy_layers(layers), c, 0
    else
      stale = stale + 1
      if stale >= 4 then
        break
      end
    end
  end
  layers = best
  positions()
  -- transpose: swap neighbours in a layer while that removes crossings with both adjacent layers
  local function pair_cost(u, v) -- crossings among u's and v's segments with u directly above v
    local c = 0
    for _, nbrs in ipairs({ pred, succ }) do
      for _, a in ipairs(nbrs[u]) do
        for _, b in ipairs(nbrs[v]) do
          if pos[a] > pos[b] then
            c = c + 1
          end
        end
      end
    end
    return c
  end
  for _ = 1, opts.keep_order and 0 or 20 do
    local improved = false
    for _, ids in ipairs(layers) do
      for i = 1, #ids - 1 do
        local u, v = ids[i], ids[i + 1]
        if pair_cost(v, u) < pair_cost(u, v) then
          ids[i], ids[i + 1] = v, u
          pos[u], pos[v] = i + 1, i
          improved = true
        end
      end
    end
    if not improved then
      break
    end
  end

  return {
    layers = layers,
    layer = layer,
    succ = succ,
    pred = pred,
    chains = chains,
    via = via,
    hidden = hidden,
    cycles = cycles,
    inside = inside,
    against = against,
    crossings = crossings(),
    edges = total,
    dummies = n,
  }
end

-- Places along a layer: rows left to right, columns top to bottom ------------------------------------------

local function median(vs)
  table.sort(vs)
  return vs[math.floor((#vs + 1) / 2)]
end

--- The place of every vertex along its layer (0-based): a row when the layers are columns, a column when they are
--- bands of rows. `height(id)` is a real vertex's size along the layer (its rows, 1 or 2; or its label's columns
--- and gap); a dummy is one. Inside a layer the order stays and one blank separates two vertices, more where
--- `extra(id)` asks for more before a vertex (the gap between two lanes of a plan's stage). With `pack`, each layer
--- is stacked from its start instead of drawn towards its neighbours (a plan's lanes stay together, a row fits).
function M.rows(L, height, extra, pack)
  local layers, succ, pred = L.layers, L.succ, L.pred
  local function h(v)
    return is_dummy(v) and 1 or (height and height(v) or 1)
  end
  local function ex(v, i)
    return (i > 1 and extra and not is_dummy(v)) and extra(v) or 0
  end
  local row = {}

  -- the rows of one layer closest to `want` (weighted least squares) that keep the order and the gaps
  local function place(ids, want, weight)
    local blocks, offs, off = {}, {}, 0
    for i, v in ipairs(ids) do
      off = off + ex(v, i)
      offs[i] = off
      off = off + h(v) + 1
      blocks[#blocks + 1] = { w = weight[i], wx = weight[i] * (want[i] - offs[i]), n = 1 }
      while #blocks > 1 do
        local b, a = blocks[#blocks], blocks[#blocks - 1]
        if a.wx / a.w > b.wx / b.w then
          a.w, a.wx, a.n = a.w + b.w, a.wx + b.wx, a.n + b.n
          blocks[#blocks] = nil
        else
          break
        end
      end
    end
    local i = 1
    for _, b in ipairs(blocks) do
      local s = math.max(0, math.floor(b.wx / b.w + 0.5))
      for _ = 1, b.n do
        row[ids[i]] = s + offs[i]
        i = i + 1
      end
    end
  end

  local function sweep(l, nbrs)
    local ids, want, weight = layers[l], {}, {}
    for i, v in ipairs(ids) do
      local rs = {}
      for _, w in ipairs(nbrs[v]) do
        rs[#rs + 1] = row[w]
      end
      if #rs > 0 then
        -- a dummy pulls harder: long edges should run straight
        want[i], weight[i] = median(rs), is_dummy(v) and 2 or 1
      else
        want[i], weight[i] = row[v], 0.25
      end
    end
    place(ids, want, weight)
  end

  for _, ids in ipairs(layers) do
    local r = 0
    for i, v in ipairs(ids) do
      r = r + ex(v, i)
      row[v] = r
      r = r + h(v) + 1
    end
  end
  if not pack then
    for l = 2, #layers do
      sweep(l, pred)
    end
    for l = #layers - 1, 1, -1 do
      sweep(l, succ)
    end
    for l = 2, #layers do
      sweep(l, pred)
    end
  end

  -- Legal rows, left to right. A vertex may share its row with the vertex of the previous layer on that row
  -- only where no line can seem to join another: when that vertex has no successor, or when it joins this one
  -- and either it has no other successor or this one no other predecessor. Otherwise the vertex moves down one
  -- row, where the previous layer has no vertex (they are two rows apart at least).
  local at = {}
  local function joins(s, v)
    for _, w in ipairs(succ[s]) do
      if w == v then
        return true
      end
    end
    return false
  end
  local function safe(l, v, r)
    local s = at[l - 1] and at[l - 1][r]
    if not s or #succ[s] == 0 then
      return true
    end
    return joins(s, v) and (#succ[s] == 1 or #pred[v] == 1)
  end
  for l, ids in ipairs(layers) do
    at[l] = {}
    local min = 0
    for i, v in ipairs(ids) do
      local r = math.max(row[v], min + ex(v, i))
      if l > 1 and not safe(l, v, r) then
        r = r + 1
      end
      row[v] = r
      at[l][r] = v
      min = r + h(v) + 1
    end
  end
  return row
end

-- Tracks --------------------------------------------------------------------------------------------------

local function inside(r, lo, hi)
  return r > lo and r < hi
end

--- Order-dependent crossings between two sources' blocks of tracks when a's block is left of b's: b's line from
--- its label to its tracks passes every track of a's, and a's lines from its tracks to its targets pass every
--- track of b's. A line into a target that another track also enters crosses nothing: that track ends there.
local function pair_cost(a, b)
  local c = 0
  for _, e in ipairs(a.edges) do
    if not b.straight and inside(b.row, e.lo, e.hi) then
      c = c + 1
    end
    for _, f in ipairs(b.edges) do
      if inside(e.row, f.lo, f.hi) then
        c = c + 1
      end
    end
  end
  return c
end

--- The order of the sources' blocks, left to right, for the sources `S` of one channel (`info[v]`: row, straight,
--- edges): the order with the fewest crossings over every order for up to 12 sources (subsets, O(2^n n^2)), else
--- by the middle of each block's span.
local function order_blocks(S, info)
  local n = #S
  if n <= 1 then
    return S
  end
  if n > 12 then
    local out = { unpack(S) }
    table.sort(out, function(a, b)
      local ma, mb = info[a].lo + info[a].hi, info[b].lo + info[b].hi
      if ma ~= mb then
        return ma < mb
      end
      return info[a].row < info[b].row
    end)
    return out
  end
  local cost = {}
  for i = 1, n do
    cost[i] = {}
    for j = 1, n do
      cost[i][j] = i ~= j and pair_cost(info[S[i]], info[S[j]]) or 0
    end
  end
  local full = bit.lshift(1, n) - 1
  local f, last = { [0] = 0 }, {}
  for mask = 0, full - 1 do
    local base = f[mask]
    if base then
      for j = 1, n do
        local bj = bit.lshift(1, j - 1)
        if bit.band(mask, bj) == 0 then
          local c = base
          for i = 1, n do
            if bit.band(mask, bit.lshift(1, i - 1)) ~= 0 then
              c = c + cost[i][j]
            end
          end
          local m2 = bit.bor(mask, bj)
          if f[m2] == nil or c < f[m2] then
            f[m2], last[m2] = c, j
          end
        end
      end
    end
  end
  local order, m = {}, full
  while m ~= 0 do
    local j = last[m]
    table.insert(order, 1, S[j])
    m = bit.band(m, bit.bnot(bit.lshift(1, j - 1)))
  end
  return order
end

-- The canvas ----------------------------------------------------------------------------------------------

local Canvas = {}
Canvas.__index = Canvas

--- An empty text canvas: label text and line bits per cell, rows and display columns 0-based.
function M.canvas(measure)
  return setmetatable({ measure = measure, text = {}, hl = {}, bits = {}, own = {}, maxr = -1, maxc = {} }, Canvas)
end

local function slot(t, r)
  local x = t[r]
  if not x then
    x = {}
    t[r] = x
  end
  return x
end

--- The row's last used column grows to `c`.
function Canvas:reach(r, c)
  if r > self.maxr then
    self.maxr = r
  end
  if (self.maxc[r] or -1) < c then
    self.maxc[r] = c
  end
end

--- Line bits `b` in cell (r, c), drawn for edge `e`.
function Canvas:set(r, c, b, e)
  local bits, own = slot(self.bits, r), slot(self.own, r)
  bits[c] = bit.bor(bits[c] or 0, b)
  local o = own[c]
  if not o then
    o = {}
    own[c] = o
  end
  o[e] = bit.bor(o[e] or 0, b)
  self:reach(r, c)
end

--- A horizontal line from column c1 to c2 on row r: each cell leaves left, right or both.
function Canvas:hline(r, c1, c2, e)
  if c1 > c2 then
    c1, c2 = c2, c1
  end
  if c1 == c2 then
    return
  end
  local bits, own = slot(self.bits, r), slot(self.own, r)
  for c = c1, c2 do
    local b = (c > c1 and LT or 0) + (c < c2 and RT or 0)
    bits[c] = bit.bor(bits[c] or 0, b)
    local o = own[c]
    if not o then
      o = {}
      own[c] = o
    end
    o[e] = bit.bor(o[e] or 0, b)
  end
  self:reach(r, c2)
end

--- A vertical line from row r1 to r2 in column c: each cell leaves up, down or both.
function Canvas:vline(c, r1, r2, e)
  if r1 > r2 then
    r1, r2 = r2, r1
  end
  for r = r1, r2 - 1 do
    self:set(r, c, D, e)
    self:set(r + 1, c, U, e)
  end
end

local CHAR = '[%z\1-\127\194-\244][\128-\191]*'

-- Labels occupy one physical line. C0/C1 controls, including tabs, newlines,
-- NUL and DEL, become one space before measurement or emission. Unicode format
-- characters such as emoji joiners and combining marks remain intact.
local function normalize(s)
  return (tostring(s or ''):gsub('[%z\1-\31\127]', ' '):gsub('\194[\128-\159]', ' '))
end

--- Display width of one character: printable ASCII is one cell (the labels are
--- mostly ASCII). Non-ASCII measurement belongs to the host.
local function cell_width(u, measure, previous)
  if #u == 1 then
    local b = u:byte()
    if b >= 32 and b < 127 then
      return 1
    end
  end
  measure = assert(measure, 'Unicode text needs a display-width function')
  -- Hosts may give a standalone combining mark a visible placeholder. Measure
  -- it with its base character instead, matching the text that will be emitted.
  if previous then
    return measure(previous .. u) - measure(previous)
  end
  return measure(u)
end

local function text_width(s, measure)
  if not s:find('[^\32-\126]') then
    return #s
  end
  return assert(measure, 'Unicode text needs a display-width function')(s)
end

--- Display width of label text, after controls have been normalized to spaces.
function M.width(s, measure)
  return text_width(normalize(s), measure)
end

--- `s` cut to `n` display columns, with `…` where it was cut.
function M.fit(s, n, measure)
  s = normalize(s)
  if n <= 0 then
    return ''
  end
  if text_width(s, measure) <= n then
    return s
  end
  local out, w, previous = {}, 0, nil
  for ch in s:gmatch(CHAR) do
    local cw = cell_width(ch, measure, previous)
    if w + cw > n - 1 then
      break
    end
    out[#out + 1] = ch
    previous = cw == 0 and ((previous or '') .. ch) or ch
    w = w + cw
  end
  return (table.concat(out):gsub('%s+$', '')) .. '…'
end

--- Put `chunks` ({text, hl} pairs) at row r from column c, at most `w` columns;
--- controls normalize to single spaces on entry. Returns the columns used.
function Canvas:put(r, c, chunks, w)
  local text, hl = slot(self.text, r), slot(self.hl, r)
  local used, base = 0, nil
  for _, ch in ipairs(chunks) do
    for u in normalize(ch[1]):gmatch(CHAR) do
      local cw = cell_width(u, self.measure, base and text[base])
      if cw == 0 then
        -- a combining mark stays with the character before it
        if base then
          text[base] = text[base] .. u
        end
      else
        if w and used + cw > w then
          self:reach(r, c + used - 1)
          return used
        end
        base = c + used
        text[base], hl[base] = u, ch[2]
        for offset = 1, cw - 1 do
          text[base + offset], hl[base + offset] = '', ch[2]
        end
        used = used + cw
      end
    end
  end
  self:reach(r, c + used - 1)
  return used
end

--- A line cell's glyph. All four directions are a crossing when no edge here turns or joins (every edge's own bits
--- are only vertical or only horizontal): the vertical is drawn over the horizontal, which shows broken. With a
--- track per edge nothing else should reach all four directions. Even an ambiguous
--- junction uses │; count() reports it separately so callers/tests can diagnose it.
local function glyph(b, own)
  if b == U + D + LT + RT then
    local pure = true
    for _, eb in pairs(own) do
      if eb ~= U + D and eb ~= LT + RT and eb ~= U and eb ~= D and eb ~= LT and eb ~= RT then
        pure = false
        break
      end
    end
    if pure then
      return '│', true
    end
  end
  return M.BOX[b] or '+', false
end

--- What the eye meets in the lines drawn so far: the cells drawn as a crossing (│ over a broken ─) and the
--- ambiguous junctions where an edge turns in a cell with all four directions.
function Canvas:count()
  local crossings, joins = 0, 0
  for r, bits in pairs(self.bits) do
    for c, b in pairs(bits) do
      if b == U + D + LT + RT then
        local _, cross = glyph(b, self.own[r][c])
        if cross then
          crossings = crossings + 1
        else
          joins = joins + 1
        end
      end
    end
  end
  return crossings, joins
end

--- The canvas as text. Returns lines (trailing blanks cut), marks ({row, byte from, byte to, group}, one per run of
--- a group), bytecol (bytecol[r][c] = the byte column of display column c on row r) and crossings
--- (crossings[r][c] = true where the vertical was drawn over a horizontal).
function Canvas:render(line_hl)
  local lines, marks, bytecol, crossings = {}, {}, {}, {}
  for r = 0, self.maxr do
    local text, hl, bits, own = self.text[r] or {}, self.hl[r] or {}, self.bits[r] or {}, self.own[r] or {}
    local maxc = self.maxc[r] or -1
    local parts, bc, b = {}, {}, 0
    local run_hl, run_from = nil, 0
    local first_mark = #marks + 1
    for c = 0, maxc do
      local s, g = text[c], nil
      if s then
        g = hl[c]
      elseif bits[c] then
        local cross
        s, cross = glyph(bits[c], own[c])
        g = line_hl
        if cross then
          slot(crossings, r)[c] = true
        end
      else
        s = ' '
      end
      bc[c] = text[c] == '' and bc[c - 1] or b
      if g ~= run_hl then
        if run_hl and b > run_from then
          marks[#marks + 1] = { r, run_from, b, run_hl }
        end
        run_hl, run_from = g, b
      end
      parts[#parts + 1] = s
      b = b + #s
    end
    if run_hl and b > run_from then
      marks[#marks + 1] = { r, run_from, b, run_hl }
    end
    bc[maxc + 1] = b
    lines[r + 1] = (table.concat(parts):gsub('%s+$', ''))
    -- The public byte positions refer to the emitted line, after trimming.
    local length = #lines[r + 1]
    for c, col in pairs(bc) do bc[c] = math.min(col, length) end
    for i = #marks, first_mark, -1 do
      marks[i][3] = math.min(marks[i][3], length)
      if marks[i][2] >= marks[i][3] then table.remove(marks, i) end
    end
    bytecol[r] = bc
  end
  return lines, marks, bytecol, crossings
end

--- Every cell of edge `e`'s lines: { {row, col, bits}, … }.
function Canvas:cells_of_edges()
  local out = {}
  for r, own in pairs(self.own) do
    for c, o in pairs(own) do
      for e, b in pairs(o) do
        local list = out[e]
        if not list then
          list = {}
          out[e] = list
        end
        list[#list + 1] = { r, c, b }
      end
    end
  end
  return out
end

-- The drawing ---------------------------------------------------------------------------------------------

-- Source blocks share their span and farthest-target ordering in both routers.
-- A position is a row sideways and a display column vertically.
local function source_blocks(ids, succ, pos)
  local S, info = {}, {}
  for _, a in ipairs(ids) do
    local edges, straight, lo, hi = {}, false, pos[a], pos[a]
    for _, b in ipairs(succ[a]) do
      if pos[b] == pos[a] then
        straight = true
      else
        edges[#edges + 1] = { to = b, row = pos[b], lo = math.min(pos[a], pos[b]), hi = math.max(pos[a], pos[b]) }
        lo, hi = math.min(lo, pos[b]), math.max(hi, pos[b])
      end
    end
    if #edges > 0 then
      -- the farthest target first: a nearer target's track then never stands across a farther one's line
      table.sort(edges, function(e, f)
        local de, df = math.abs(e.row - pos[a]), math.abs(f.row - pos[a])
        if de ~= df then
          return de > df
        end
        return e.row < f.row
      end)
      S[#S + 1] = a
      info[a] = { row = pos[a], lo = lo, hi = hi, edges = edges, straight = straight }
    end
  end
  return order_blocks(S, info), info
end

--- Draw layout `L` with rows `row` into canvas `cv`, from row `top` and column `left`. opts.width is a label's width
--- in columns; opts.label_width(id) the width of the label's first line (its lines start one column after it).
---
--- Between two columns every edge whose target is on another row has a vertical track of its own; a source's
--- tracks stand side by side, its farthest target first, so its lines never cross each other, and the sources'
--- blocks are ordered for the fewest crossings. So a line into a target joins it only where a track ends (┴ ┬),
--- a source's lines part only on its own line (┬ ┴), and four lines meet only where they cross: `┼` is never
--- drawn. Edges carry the index of their chain. Returns the column of each layer and the drawing's right edge.
function M.draw(cv, L, row, opts)
  local W, top, left = opts.width, opts.top or 0, opts.left or 0
  local layers, succ, layer = L.layers, L.succ, L.layer
  local col, track = {}, {}
  local x = left
  for _, ids in ipairs(layers) do
    local S, info = source_blocks(ids, succ, row)
    local k = 0
    col[#col + 1] = x
    for _, a in ipairs(S) do
      track[a] = {}
      for _, e in ipairs(info[a].edges) do
        k = k + 1
        track[a][e.to] = x + W + 1 + k
      end
    end
    x = x + W + k + 4
  end
  local function exit_from(a)
    return is_dummy(a) and col[layer[a]] or (col[layer[a]] + opts.label_width(a) + 1)
  end
  local function entry_to(b)
    return is_dummy(b) and col[layer[b]] or (col[layer[b]] - 1)
  end
  -- a dummy's line enters at its column's first cell and leaves from it, so it runs through the column
  for ci, ch in ipairs(L.chains) do
    local path = ch.path
    for k = 1, #path - 1 do
      local a, b = path[k], path[k + 1]
      local ra, rb = top + row[a], top + row[b]
      if ra == rb then
        cv:hline(ra, exit_from(a), entry_to(b), ci)
      else
        local tx = track[a][b]
        cv:hline(ra, exit_from(a), tx, ci)
        cv:vline(tx, ra, rb, ci)
        cv:hline(rb, tx, entry_to(b), ci)
      end
    end
  end
  return { col = col, right = x }
end

--- Draw layout `L` top to bottom into canvas `cv`: each layer a band of rows from row `top`, each vertex at column
--- `left + pos[v]` along its band. opts.width is a label's width, opts.height(id) a real vertex's rows (1, or 2
--- with a second line). A line leaves a vertex from under its first cell (the status glyph), where its second line
--- leaves a cell free, and enters from above that cell.
---
--- Between two bands every edge whose target stands in another column has a track, a horizontal line: a source's
--- tracks lie one under the other, its farthest target first, and the sources' blocks are ordered for the fewest
--- crossings, as in M.draw. Then each track rises to the highest row it can share without touching another
--- track, passing only tracks it does not overlap: two tracks that do not overlap never cross whichever lies
--- higher, so the crossings stay as ordered and the channel gets lower. A vertical line is drawn over a
--- horizontal one where they cross; `┼` is never drawn. Returns the first row of each band and the row under the
--- drawing.
function M.draw_v(cv, L, pos, opts)
  local top, left = opts.top or 0, opts.left or 0
  local layers, succ, layer = L.layers, L.succ, L.layer
  local y, track = {}, {}
  local row = top
  for l, ids in ipairs(layers) do
    y[l] = row
    local H = 1
    for _, v in ipairs(ids) do
      if not is_dummy(v) then
        H = math.max(H, opts.height(v))
      end
    end
    local S, info = source_blocks(ids, succ, pos)
    -- the channel under the band: a row of stubs, the tracks, a row of stubs; one row when every line is straight
    local shelves = {}
    for _, a in ipairs(S) do
      track[a] = {}
      for _, e in ipairs(info[a].edges) do
        local r = #shelves + 1
        while r > 1 do
          local free = true
          for _, sp in ipairs(shelves[r - 1]) do
            if not (e.hi + 1 < sp[1] or sp[2] + 1 < e.lo) then
              free = false
              break
            end
          end
          if not free then
            break
          end
          r = r - 1
        end
        shelves[r] = shelves[r] or {}
        table.insert(shelves[r], { e.lo, e.hi })
        track[a][e.to] = y[l] + H + r
      end
    end
    local k = #shelves
    row = y[l] + H + (k > 0 and k + 2 or 1)
  end
  local function exit_from(a)
    return is_dummy(a) and y[layer[a]] or (y[layer[a]] + 1)
  end
  local function entry_to(b)
    return is_dummy(b) and y[layer[b]] or (y[layer[b]] - 1)
  end
  for ci, ch in ipairs(L.chains) do
    local path = ch.path
    for k = 1, #path - 1 do
      local a, b = path[k], path[k + 1]
      local xa, xb = left + pos[a], left + pos[b]
      if xa == xb then
        local r1, r2 = exit_from(a), entry_to(b)
        if r1 == r2 then
          -- one row between two nodes: a line that leaves upward and downward at once
          cv:set(r1, xa, U + D, ci)
        else
          cv:vline(xa, r1, r2, ci)
        end
      else
        local ty = track[a][b]
        cv:vline(xa, exit_from(a), ty, ci)
        cv:hline(ty, xa, xb, ci)
        cv:vline(xb, ty, entry_to(b), ci)
      end
    end
  end
  return { y = y, bottom = row }
end

--- Build a container's sibling graph. The caller supplies children in tracker order.
--- Only sibling edges affect the graph; outside edges are named separately. Tray
--- membership is decided before cycle removal, so a cyclic item stays visible.
--- opts.reduce=false reveals the original edges; hidden retains the reduced ones.
function M.from_items(items, opts)
  local known, linked, edges, outside = {}, {}, {}, {}
  for _, item in ipairs(items) do
    known[item.id] = true
  end
  for _, item in ipairs(items) do
    for _, blocker in ipairs(item.blocked_by or {}) do
      if known[blocker] then
        edges[#edges + 1] = { blocker, item.id }
        linked[blocker], linked[item.id] = true, true
      else
        outside[#outside + 1] = { blocker, item.id }
      end
    end
  end
  local nodes, tray = {}, {}
  for _, item in ipairs(items) do
    local list = linked[item.id] and nodes or tray
    list[#list + 1] = item.id
  end
  local L = M.layout(nodes, edges, opts)
  L.nodes, L.tray, L.outside = nodes, tray, outside
  return L
end

--- Fit vertical bands to a window, continuing wide layers below themselves.
--- Rebuild only the drawn edges; retain the original reduction/cycle diagnostics.
--- Returns a drawing layout, label width and original layer per drawing band.
function M.fit_window(L, room, minimum, maximum)
  local reals, nodes, edges, reserve = {}, {}, {}, {}
  for l, ids in ipairs(L.layers) do
    reals[l], reserve[l] = {}, 0
    for _, id in ipairs(ids) do
      if is_dummy(id) then reserve[l] = reserve[l] + 2
      else reals[l][#reals[l] + 1] = id; nodes[#nodes + 1] = id end
    end
  end
  for _, ch in ipairs(L.chains) do edges[#edges + 1] = { ch.from, ch.to } end
  local function fits(lay, W)
    local pos = M.rows(lay, function() return W + 2 end, nil, true)
    for _, ids in ipairs(lay.layers) do
      for _, id in ipairs(ids) do
        if pos[id] + (is_dummy(id) and 1 or W + 2) > room then return false end
      end
    end
    return true
  end
  local origin = {}
  for l in ipairs(L.layers) do origin[l] = l end
  minimum = math.max(1, math.min(minimum, room - 2))
  maximum = math.max(minimum, math.min(maximum, room - 2))
  for W = maximum, minimum, -1 do
    if fits(L, W) then return L, W, origin end
  end
  local function wrap(W)
    local reserved_columns, lay, original_layer = { unpack(reserve) }, nil, nil
    -- Added pass-through dummies consume space too. Recut until their reserved
    -- space settles, bounded by the number of real nodes.
    for _ = 1, #nodes + 1 do
      local ranks, base = {}, 0
      original_layer = {}
      for l, ids in ipairs(reals) do
        local row, used = 1, 0
        for _, id in ipairs(ids) do
          if used > 0 and used + W + 3 > room - reserved_columns[l] then row, used = row + 1, 0 end
          ranks[id], used = base + row, used + W + 3
        end
        for k = 1, row do original_layer[base + k] = l end
        base = base + row
      end
      lay = M.layout(nodes, edges, { rank = ranks, keep_order = true, reduce = false })
      if fits(lay, W) then break end
      local changed = false
      for l, ids in ipairs(lay.layers) do
        local n = 0
        for _, id in ipairs(ids) do if is_dummy(id) then n = n + 1 end end
        if 2 * n > reserved_columns[original_layer[l]] then reserved_columns[original_layer[l]], changed = 2 * n, true end
      end
      if not changed then break end
    end
    lay.nodes, lay.tray, lay.outside = L.nodes, L.tray, L.outside
    lay.hidden, lay.cycles, lay.edges = L.hidden, L.cycles, L.edges
    return lay, original_layer
  end
  local best, from = wrap(minimum)
  for W = maximum, minimum + 1, -1 do
    local lay, at = wrap(W)
    if #lay.layers <= #best.layers and fits(lay, W) then return lay, W, at end
  end
  return best, minimum, from
end

--- Render either orientation from the same layout, including the tray below it.
--- opts.label(id, width) returns lines of {text, highlight} chunks, with the first
--- cell reserved as the node's edge port. Following lines leave that cell empty.
--- The default label is the id. Width defaults to 24 display columns; labels are
--- clipped to it. opts.measure supplies Unicode display widths. top/left are
--- zero-based offsets; tray_columns defaults to 3. opts.pack starts each band
--- at its left edge instead of aligning it towards neighbouring bands. No folding.
--- Returns the canvas and geometry: nodes (row/col/width/height/tray), positions
--- along each layer, and drawing bounds. Canvas:render returns text and byte maps.
function M.render(L, opts)
  opts = opts or {}
  local W = opts.width or 24
  assert(W >= 1 and W == math.floor(W), 'width must be a positive integer')
  local vertical = (opts.orient or 'vertical') == 'vertical'
  assert(vertical or opts.orient == 'horizontal', 'orient must be vertical or horizontal')
  local cv, labels, heights, widths = M.canvas(opts.measure), {}, {}, {}
  local function prepare(id)
    local lines = opts.label and opts.label(id, W) or { { { id } } }
    assert(#lines > 0, 'a node needs at least one label line')
    labels[id], heights[id] = lines, #lines
    local parts = {}
    for _, chunk in ipairs(lines[1]) do
      parts[#parts + 1] = tostring(chunk[1])
    end
    widths[id] = math.min(W, M.width(table.concat(parts), opts.measure))
  end
  for _, ids in ipairs(L.layers) do
    for _, id in ipairs(ids) do
      if not is_dummy(id) then prepare(id) end
    end
  end
  for _, id in ipairs(L.tray or {}) do prepare(id) end
  local pos = M.rows(L, function(id) return vertical and (W + 2) or heights[id] end, nil, opts.pack)
  local draw_opts = {
    top = opts.top or 0, left = opts.left or 0, width = W,
    label_width = function(id) return widths[id] end,
    height = function(id) return heights[id] end,
  }
  local bounds = vertical and M.draw_v(cv, L, pos, draw_opts) or M.draw(cv, L, pos, draw_opts)
  local geometry = { nodes = {}, pos = pos, bounds = bounds }
  local function put(id, r, c, tray)
    for i, chunks in ipairs(labels[id]) do
      -- Keep the first column free under the edge port.
      cv:put(r + i - 1, c + (i > 1 and 1 or 0), chunks, W - (i > 1 and 1 or 0))
    end
    geometry.nodes[id] = { row = r, col = c, width = W, height = heights[id], tray = tray or false }
  end
  for l, ids in ipairs(L.layers) do
    for _, id in ipairs(ids) do
      if not is_dummy(id) then
        put(id, vertical and bounds.y[l] or (draw_opts.top + pos[id]),
          vertical and (draw_opts.left + pos[id]) or bounds.col[l])
      end
    end
  end
  if #(L.tray or {}) > 0 then
    local columns = opts.tray_columns or 3
    assert(columns >= 1 and columns == math.floor(columns), 'tray_columns must be a positive integer')
    local r = #L.layers > 0 and (cv.maxr + 2) or draw_opts.top
    cv:put(r, draw_opts.left, { { 'Tray', opts.tray_hl } })
    r = r + 2
    local h = 0
    for i, id in ipairs(L.tray) do
      local col = (i - 1) % columns
      if col == 0 and i > 1 then r, h = r + h + 1, 0 end
      put(id, r, draw_opts.left + col * (W + 3), true)
      h = math.max(h, heights[id])
    end
  end
  geometry.bottom = cv.maxr + 1
  return cv, geometry
end

return M
