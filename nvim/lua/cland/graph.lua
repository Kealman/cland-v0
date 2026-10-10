-- Experimental centre view of one container's children. The hub owns every item
-- field; graph_layout owns sibling edges and the display-column canvas.
local api = vim.api
local state = require('cland.state')
local items = require('cland.items')
local G = require('cland.graph_layout')
local M = { tray_done = false, orient = 'vertical', reduce = true }
local ns = api.nvim_create_namespace('cland.graph')

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
    id = id:match('^%d+$') and ('T-' .. id) or id:upper()
    local it = state.item(id)
    if not it or not items.is_container(it) then
      return state.say('graph: ' .. id .. ' is not a known container', 'ClandRedBar')
    end
  else id = nil end
  require('cland.layout').show({ kind = 'graph', id = id }, { insert = false })
end

--- One replaceable source of verified/total: task.view criteria marks when the
--- hub supplies them, otherwise the acceptance-section checkbox count.
function M.fraction(it)
  local detail = require('cland.item_view').get(it.id)
  if detail and type(detail.criteria) == 'table' then
    local verified = 0
    for _, criterion in ipairs(detail.criteria) do
      for _, mark in ipairs(criterion.marks or {}) do
        if mark.kind == 'verified' then verified = verified + 1; break end
      end
    end
    return verified, #detail.criteria
  end
  return require('cland.vboard').verified(detail and detail.body)
end

--- Badge rows stay separate so the claim cannot clip the verdict or fraction.
function M.label(it)
  local done = it.status == 'done' or it.state == 'closed'
  local function chunk(text, group) return { text, done and 'ClandDim' or group } end
  local glyph = items.GLYPH[items.status(it)] or items.GLYPH.open
  local head = { chunk(glyph[1], glyph[2]), chunk(' ' .. it.id .. ' ', 'ClandDim') }
  if not done and #items.open_blockers(it) > 0 then head[#head + 1] = chunk('◌ ', 'ClandDim') end
  local title = vim.split(vim.trim(it.title or ''), '\n', { plain = true })[1] or ''
  head[#head + 1] = chunk(title, 'ClandText')
  local lines, who, evidence = { head }, {}, {}
  local asks, claim = items.asks(it), items.claim(it)
  if asks > 0 then who[#who + 1] = chunk('?' .. asks .. ' ', 'ClandAmber') end
  if claim then who[#who + 1] = chunk(claim.session, 'ClandTeal')
  elseif items.present(it.assignee) then who[#who + 1] = chunk('for ' .. it.assignee, 'ClandDim') end
  if #who > 0 then lines[#lines + 1] = who end
  local verdicts = type(it.verdicts) == 'table' and it.verdicts or {}
  local v = verdicts[#verdicts]
  if v then
    evidence[#evidence + 1] = chunk((v.result == 'clear' and '✓ ' or '✗ ') .. v.verdict,
      v.result ~= 'clear' and 'ClandRed' or (v.current == false and 'ClandDim' or 'ClandGreen'))
  end
  local verified, total = M.fraction(it)
  if total > 0 then
    if #evidence > 0 then evidence[#evidence + 1] = chunk(' · ', 'ClandFaint') end
    evidence[#evidence + 1] = chunk(verified .. '/' .. total, verified == total and 'ClandGreen' or 'ClandDim')
  end
  if #evidence > 0 then lines[#lines + 1] = evidence end
  return lines
end

function M.compose(id, width)
  local kids = id and items.children(id) or {}
  local byid = {}
  for _, it in ipairs(kids) do byid[it.id] = it end
  local L = G.from_items(kids, { reduce = M.reduce })
  local tray, folded = {}, 0
  for _, node in ipairs(L.tray) do
    if (byid[node].status == 'done' or byid[node].state == 'closed') and not M.tray_done then
      folded = folded + 1
    else tray[#tray + 1] = node end
  end
  L.tray = tray
  local parallel = 1
  if M.orient == 'vertical' then
    for _, layer in ipairs(L.layers) do parallel = math.max(parallel, #layer) end
  end
  local W = math.max(20, math.min(40, math.floor((width - 2) / parallel) - 3))
  local cv, geometry = G.render(L, { width = W, top = 2, left = 1, orient = M.orient,
    measure = api.nvim_strwidth, tray_columns = math.max(1, math.floor((width - 2) / (W + 3))),
    tray_hl = 'ClandSection', label = function(node) return M.label(byid[node]) end })
  local parent = id and state.item(id)
  cv:put(0, 1, { { 'Graph · ' .. (parent and (id .. ' ' .. parent.title) or 'No current release'), 'ClandBold' } })
  if #kids == 0 then cv:put(2, 1, { { 'No children to draw.', 'ClandDim' } }) end
  if #tray + folded > 0 then
    local row = cv.maxr + 2
    for _, node in pairs(geometry.nodes) do if node.tray then row = math.min(row, node.row - 2) end end
    cv:put(row, 1, { { 'Tray · ' .. (#tray + folded) .. ' unlinked', 'ClandSection' },
      { folded > 0 and (' · ' .. folded .. ' done folded, d shows them') or ' · d folds done', 'ClandFaint' } })
  end
  local crossings = cv:count()
  cv:put(cv.maxr + 2, 1, { { ('%d linked · %d layers · %d edges drawn · %d hidden · %d crossings'):format(
    #L.nodes, #L.layers, #L.chains, #L.hidden, crossings), 'ClandFaint' } })
  local function edges_line(label, edges, group)
    if #edges == 0 then return end
    local names = {}
    for _, e in ipairs(edges) do names[#names + 1] = e[1] .. ' → ' .. e[2] end
    cv:put(cv.maxr + 1, 1, { { label .. table.concat(names, ', '), group } })
  end
  edges_line('Left out to break a cycle: ', L.cycles, 'ClandRed')
  edges_line('Implied by longer paths: ', L.hidden, 'ClandFaint')
  edges_line('Blockers outside ' .. (id or 'the graph') .. ': ', L.outside, 'ClandAmber')
  cv:put(cv.maxr + 2, 1, { { 'p/P parent · d done tray · o orientation · r implied edges · ␣b board · ␣␣ back', 'ClandFaint' } })
  local lines, marks, bytecol = cv:render('ClandFaint')
  geometry.bytecol, geometry.layout = bytecol, L
  return lines, marks, geometry
end

function M.buf()
  if M.b and api.nvim_buf_is_valid(M.b) then return M.b end
  M.b = api.nvim_create_buf(false, true)
  vim.bo[M.b].bufhidden = 'hide'
  vim.bo[M.b].modifiable = false
  api.nvim_buf_set_name(M.b, 'cland://graph')
  vim.b[M.b].cland_role = 'graph'
  for key, step in pairs({ p = 1, P = -1 }) do
    require('cland.actions').map('n', key, function() M.cycle(step) end, { buffer = M.b, nowait = true, silent = true })
  end
  require('cland.actions').map('n', 'd', function() M.tray_done = not M.tray_done; state.changed() end,
    { buffer = M.b, nowait = true, silent = true })
  require('cland.actions').map('n', 'o', function()
    M.orient = M.orient == 'vertical' and 'horizontal' or 'vertical'; state.changed()
  end, { buffer = M.b, nowait = true, silent = true })
  require('cland.actions').map('n', 'r', function() M.reduce = not M.reduce; state.changed() end,
    { buffer = M.b, nowait = true, silent = true })
  return M.b
end

function M.render()
  local b = M.buf()
  local win = vim.fn.bufwinid(b)
  if win == -1 then win = require('cland.layout').centre() end
  local lines, marks, model = M.compose(M.parent(), api.nvim_win_get_width(win))
  M.model = model
  vim.bo[b].modifiable = true
  api.nvim_buf_set_lines(b, 0, -1, false, lines)
  vim.bo[b].modifiable = false
  api.nvim_buf_clear_namespace(b, ns, 0, -1)
  for _, m in ipairs(marks) do
    api.nvim_buf_set_extmark(b, ns, m[1], m[2], { end_col = m[3], hl_group = m[4] })
  end
  return b
end

return M
