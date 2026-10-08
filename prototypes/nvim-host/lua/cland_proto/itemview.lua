-- PROTOTYPE (ticket #15, workbench): the item view, a centre view (gi, or
-- Enter in the items panel or on a card). The item file as the Item
-- artboard draws it: title, path, body, verdicts and comments on the left,
-- the fields column (state, claim, topic, branch, blocking edges, cost,
-- merge gate) on the right. e shows the raw Markdown file (ADR 0002).
local api = vim.api
local state = require('cland_proto.state')
local sessions = require('cland_proto.sessions')
local items = require('cland_proto.items')
local chat = require('cland_proto.chat')
local hl = require('cland_proto.hl')
local D = require('cland_proto.draw')

local M = { ns = api.nvim_create_namespace('cland_proto_item'), bufs = {}, rows = {} }

local function slug(it)
  local s = it.title:lower():gsub('[^%w]+', '-'):gsub('^-', ''):gsub('-$', '')
  return s
end

-- The body as paragraphs: consecutive lines join, blank lines separate.
local function paragraphs(lines)
  local out, cur = {}, {}
  for _, l in ipairs(lines or {}) do
    if vim.trim(l) == '' then
      if #cur > 0 then
        out[#out + 1] = table.concat(cur, ' ')
        cur = {}
      end
    else
      cur[#cur + 1] = vim.trim(l)
    end
  end
  if #cur > 0 then
    out[#out + 1] = table.concat(cur, ' ')
  end
  return out
end

function M.path(it)
  return ('.cland/tasks/%s-%s.md'):format(it.id, slug(it))
end

function M.status_words(it)
  local st = state.item_status(it)
  if it.map then
    return ({ decided = 'decided', frontier = 'frontier', subagent = 'in work by a sub-agent', blocked = 'blocked' })[it.map]
  end
  if it.kind == 'epic' or it.kind == 'map' then
    local done, total = state.progress(it.id)
    return (done == total and 'done' or 'in progress') .. ' · ' .. done .. ' of ' .. total
  end
  return hl.ITEM[st][3]
end

local function verdict_box(c, width, v)
  local border = v.result == 'clear' and 'ClandBoxTeal' or (v.result == 'not clear' and 'ClandBoxRed')
    or (v.result == 'in progress' and 'ClandBoxAmber') or 'ClandBox'
  local head_hl = v.result == 'clear' and 'ClandGreen' or (v.result == 'not clear' and 'ClandRed')
    or (v.result == 'in progress' and 'ClandAmber') or 'ClandDim'
  local inner = width - 4
  local lines = {}
  local head = { { v.kind .. ' · ' .. v.result, head_hl } }
  if v.by then
    head[#head + 1] = { ' · ' .. v.by .. ' [' .. v.role .. '] · run ' .. v.run .. (v.round and (' · round ' .. v.round) or ''), 'ClandDim' }
  end
  lines[#lines + 1] = head
  if v.note then
    for _, l in ipairs(D.wrap(v.note .. (v.result == 'in progress' and (' · started ' .. state.fmt(v.at)) or (' · ' .. state.fmt(v.at))), inner)) do
      lines[#lines + 1] = { { l, 'ClandDim' } }
    end
  elseif v.at then
    lines[#lines + 1] = { { 'recorded ' .. state.fmt(v.at), 'ClandDim' } }
  end
  local out = {}
  out[#out + 1] = { { ' ╭' .. ('─'):rep(width - 2) .. '╮', border } }
  for _, l in ipairs(lines) do
    local fit, w = D.fit(l, inner)
    local row = { { ' │ ', border } }
    vim.list_extend(row, fit)
    row[#row + 1] = { (' '):rep(inner - w) }
    row[#row + 1] = { ' │', border }
    out[#out + 1] = row
  end
  out[#out + 1] = { { ' ╰' .. ('─'):rep(width - 2) .. '╯', border } }
  return out
end

-- Left column lines: { chunks, info }.
local function left_lines(it, Lw)
  local L = {}
  local function add(chunks, info)
    L[#L + 1] = { chunks = chunks, info = info }
  end
  local function wrap(text, group, info)
    for _, l in ipairs(D.wrap(text, Lw - 2)) do
      add({ { ' ' .. l, group } }, info)
    end
  end
  wrap(it.long or it.title, 'ClandTitle')
  add({ { ' ' .. M.path(it) .. ' · created ' .. it.created .. ' · updated ' .. state.fmt(it.updated or state.now_min() - 600), 'ClandDim' } })
  add({ { ' ' .. ('─'):rep(Lw - 2), 'ClandSectionRule' } })
  for i, p in ipairs(paragraphs(it.body)) do
    if i > 1 then
      add({})
    end
    wrap(p, 'ClandText')
  end
  if it.acceptance then
    add({})
    wrap(it.acceptance, 'ClandDim')
  end
  if it.kind == 'epic' or it.kind == 'map' then
    add({})
    local done, total = state.progress(it.id)
    add({ { ' ITEMS · ' .. done .. ' of ' .. total .. ' done', 'ClandSection' } })
    for _, cid in ipairs(state.children(it.id)) do
      local ch = state.item(cid)
      local g, ghl = items.glyph(ch)
      local right = items.right(ch, 'all')
      local chunks = { { ' ' }, { g, ghl }, { ' ' .. D.pad(ch.id, 5), 'ClandDim' }, { ch.title } }
      if #right > 0 then
        chunks[#chunks + 1] = { '  ' }
        vim.list_extend(chunks, right)
      end
      add(chunks, { item = cid })
    end
  end
  if it.kind == 'task' then
    add({})
    add({ { ' VERDICTS', 'ClandSection' } })
    local present = {}
    for _, v in ipairs(it.verdicts) do
      present[v.kind] = true
      for _, row in ipairs(verdict_box(nil, math.min(Lw - 2, 78), v)) do
        add(row)
      end
    end
    for _, k in ipairs(it.required or {}) do
      if not present[k] then
        for _, row in ipairs(verdict_box(nil, math.min(Lw - 2, 78), { kind = k, result = 'required · not started' })) do
          add(row)
        end
      end
    end
    if #it.verdicts == 0 and #(it.required or {}) == 0 then
      add({ { ' none yet', 'ClandDim' } })
    end
  end
  add({})
  add({ { ' COMMENTS · ' .. #it.comments, 'ClandSection' } })
  if #it.comments == 0 then
    add({ { ' none', 'ClandDim' } })
  end
  for _, cm in ipairs(it.comments) do
    local hub = cm.by == 'hub'
    local head = { { ' ' .. cm.by, hub and 'ClandDim' or 'ClandBold' } }
    if cm.role then
      head[#head + 1] = { '  ' .. cm.role, 'ClandTeal' }
    end
    head[#head + 1] = { '  ' .. state.fmt(cm.at), 'ClandDim' }
    add(head, { session = not hub and cm.by or nil })
    wrap(cm.text, hub and 'ClandDim' or 'ClandText')
    add({})
  end
  return L
end

local function field(F, label, value, group)
  local out = { { { ' ' .. label, 'ClandFieldsDim' } } }
  for _, l in ipairs(D.wrap(value, F - 2)) do
    out[#out + 1] = { { ' ' .. l, group or 'ClandFields' } }
  end
  return out
end

local function right_lines(it, F)
  local L = {}
  local function add(rows)
    vim.list_extend(L, rows)
  end
  local g, ghl = items.glyph(it)
  add(field(F, 'state', (it.kind == 'epic' and '' or (g .. ' ')) .. M.status_words(it), ghl))
  add(field(F, 'kind · labels', it.kind .. ' · ' .. (#it.labels > 0 and table.concat(it.labels, ', ') or 'none')))
  local parent = it.parent and state.item(it.parent)
  add(field(F, 'parent', parent and (parent.id .. ' ' .. parent.title) or 'none'))
  add(field(F, 'assignee', it.assignee or 'none'))
  local s = it.claim and state.session(it.claim)
  if s then
    add(field(F, 'claim', s.name .. ' · ' .. s.role .. ' · ' .. sessions.st(s)[3], 'ClandTeal'))
  elseif it.lost_claim then
    add(field(F, 'claim', 'none · ' .. it.lost_claim .. ' ' .. (state.session(it.lost_claim) and state.session(it.lost_claim).state or 'died'), 'ClandRed'))
  elseif it.map == 'subagent' then
    add(field(F, 'claim', 'a ' .. it.sub .. ' sub-agent of coord-1 · ' .. it.mins .. ' min', 'ClandTeal'))
  else
    add(field(F, 'claim', 'none', 'ClandFieldsDim'))
  end
  local t = state.topic_of_item(it.id)
  if t then
    local st = chat.status(t)
    add(field(F, 'topic', chat.label(t) .. ' · ' .. (st[3]:gsub('^topic ', '')) .. ((t.unread or 0) > 0 and (' · ' .. t.unread .. ' unread') or ''),
      t.status == 'waiting for human' and 'ClandAmber' or 'ClandBlue'))
  elseif it.kind == 'task' or it.kind == 'epic' then
    add(field(F, 'topic', 'none yet: it appears with the first message', 'ClandFieldsDim'))
  end
  if it.branch then
    add(field(F, 'branch', it.branch .. (it.commits and (' · ' .. it.commits .. ' commits') or '') .. (it.rebased and ' · rebased' or '')))
  end
  local blockers = it.blocked_by or {}
  local bl = {}
  for _, b in ipairs(blockers) do
    local bi = state.item(b)
    bl[#bl + 1] = b .. (bi and (' ' .. bi.title) or '') .. ((bi and bi.status == 'done') and ' (done)' or '')
  end
  add(field(F, 'blocked by', #bl > 0 and table.concat(bl, ', ') or 'none', #bl > 0 and 'ClandFields' or 'ClandFieldsDim'))
  local blocks = {}
  for _, b in ipairs(state.blocks(it.id)) do
    blocks[#blocks + 1] = b .. ' ' .. state.item(b).title
  end
  add(field(F, 'blocks', #blocks > 0 and table.concat(blocks, ', ') or 'none', #blocks > 0 and 'ClandFields' or 'ClandFieldsDim'))
  if it.cost then
    add(field(F, 'cost so far', it.cost))
  end
  if it.kind == 'task' then
    L[#L + 1] = { { '' } }
    local need = {}
    for _, k in ipairs(it.required or { 'review' }) do
      need[#need + 1] = k .. ' clear'
    end
    add(field(F, 'merge gate', table.concat(need, ' · ') .. ' · rebased → cland merge ' .. it.id, 'ClandFieldsDim'))
  end
  return L
end

function M.buf(id)
  local b = M.bufs[id]
  if b and api.nvim_buf_is_valid(b) then
    return b
  end
  b = D.scratch('item', 'item/' .. id)
  vim.b[b].cland_item = id
  M.bufs[id] = b
  local function map(lhs, fn, desc)
    vim.keymap.set('n', lhs, fn, { buffer = b, nowait = true, silent = true, desc = 'cland-proto: ' .. desc })
  end
  map('<CR>', function()
    local inf = (M.rows[b] or {})[api.nvim_win_get_cursor(0)[1]]
    if require('cland_proto.motions').open_token() then
      return
    end
    if inf and inf.item and inf.item ~= id then
      require('cland_proto.layout').show({ kind = 'item', id = inf.item })
    end
  end, 'open the reference under the cursor')
  map('e', function()
    M.show_file(id)
  end, 'show the item file')
  map('gb', function()
    local it = state.item(id)
    vim.notify(('cland-proto: gb would show %s on the territory (git log dev..%s); not in the prototype'):format(
      it.branch or 'the branch', it.branch or 'branch'), vim.log.levels.INFO)
  end, 'the task branch')
  map('x', function()
    vim.notify(('cland-proto: x would close %s; the merge gate needs its verdicts first (not in the prototype)'):format(id),
      vim.log.levels.INFO)
  end, 'close the item')
  return b
end

function M.file_lines(it)
  local t = state.topic_of_item(it.id)
  local L = {
    '---', 'id: ' .. it.id, 'kind: ' .. it.kind, 'title: ' .. (it.long or it.title),
    'state: ' .. (it.status == 'done' and 'closed' or 'open'), 'labels: [' .. table.concat(it.labels, ', ') .. ']',
    'assignee: ' .. (it.assignee or ''), 'parent: ' .. (it.parent or ''),
    'blocked_by: [' .. table.concat(it.blocked_by or {}, ', ') .. ']', 'topic: ' .. (t and t.id or ''),
    'branch: ' .. (it.branch or ''), 'created: ' .. it.created, 'updated: ' .. os.date('%Y-%m-%d'), '---', '',
  }
  vim.list_extend(L, it.body or {})
  if it.acceptance then
    L[#L + 1] = ''
    L[#L + 1] = it.acceptance
  end
  L[#L + 1] = ''
  L[#L + 1] = '## Comments'
  for _, cm in ipairs(it.comments) do
    if cm.by ~= 'hub' then
      L[#L + 1] = ''
      L[#L + 1] = ('### %s [%s] · %s %s'):format(cm.by, cm.role or '', os.date('%Y-%m-%d'), state.fmt(cm.at))
      L[#L + 1] = cm.text
    end
  end
  for _, v in ipairs(it.verdicts) do
    if v.result ~= 'in progress' then
      L[#L + 1] = ''
      L[#L + 1] = ('### %s [%s] · %s %s'):format(v.by, v.role, os.date('%Y-%m-%d'), state.fmt(v.at))
      L[#L + 1] = 'verdict: ' .. v.kind
      L[#L + 1] = 'result: ' .. v.result
      L[#L + 1] = 'by: ' .. v.by .. ' [' .. v.role .. ']'
      L[#L + 1] = 'run: ' .. v.run
      if v.note then
        L[#L + 1] = ''
        L[#L + 1] = v.note
      end
    end
  end
  return L
end

function M.show_file(id)
  local it = state.item(id)
  require('cland_proto.app').text_float(M.path(it) .. ' (the file is the source of truth; edits go through the hub)',
    M.file_lines(it), 'markdown')
end

function M.render(id, win)
  local it = state.item(id)
  local b = M.buf(id)
  if not (it and win and api.nvim_win_is_valid(win)) then
    return
  end
  local W = api.nvim_win_get_width(win)
  local c = D.canvas(W)
  local side = W >= 90
  local F = side and math.min(40, math.max(30, math.floor(W * 0.3))) or 0
  local Lw = side and (W - F - 2) or W
  local left = left_lines(it, Lw)
  local right = right_lines(it, side and F or W)
  if side then
    local n = math.max(#left, #right, vim.fn.winheight(win))
    for r = 1, n do
      local l, rr = left[r], right[r]
      c:cols({
        { chunks = l and l.chunks or {}, width = Lw, info = l and l.info },
        { chunks = { { '│', 'ClandSectionRule' } }, width = 1 },
        { chunks = rr or {}, width = F, bg = 'ClandFields' },
      }, { gap = '' , info = l and l.info })
    end
  else
    for _, l in ipairs(left) do
      c:add(l.chunks, nil, { info = l.info })
    end
    c:blank()
    for _, r in ipairs(right) do
      c:add(r, nil, { fill = 'ClandFields' })
    end
  end
  M.rows[b] = {}
  local info = c:apply(b, M.ns)
  for r, inf in pairs(info) do
    M.rows[b][r] = inf and (inf.info or inf) or nil
  end
end

function M.render_all()
  for id, b in pairs(M.bufs) do
    local win = vim.fn.win_findbuf(b)[1]
    if win then
      M.render(id, win)
    end
  end
end

return M
