-- PROTOTYPE (ticket #15, workbench): the board, a centre view (<Space>b).
-- Six columns backlog / planned / in progress / review / qa / done with a
-- card per task: id, title, claim, and the flags the human acts on (ask
-- open, waiting for approval, unclaimed, verdicts). f cycles the epic scope.
local api = vim.api
local state = require('cland_proto.state')
local D = require('cland_proto.draw')

local M = { ns = api.nvim_create_namespace('cland_proto_board'), rows = {} }

M.COLS = { { 'backlog', 'backlog' }, { 'planned', 'planned' }, { 'progress', 'in progress' }, { 'review', 'review' },
  { 'qa', 'qa' }, { 'done', 'done' } }

function M.scopes()
  local out = { 'all' }
  for _, id in ipairs(state.S.item_order) do
    if state.S.items[id].kind == 'epic' then
      out[#out + 1] = id
    end
  end
  return out
end

function M.tasks(status)
  local scope = state.S.ui.board_scope
  local out = {}
  for _, id in ipairs(state.S.item_order) do
    local it = state.S.items[id]
    if it.kind == 'task' and it.status == status and (scope == 'all' or it.parent == scope) then
      out[#out + 1] = it
    end
  end
  return out
end

local function harness_short(s)
  if s.harness == 'Codex' then
    return 'Codex ' .. (s.model:match('gpt%-[%d.]+%-(%a+)') or s.model)
  end
  return s.harness
end

-- The lines of one card: { chunks, info } each, without the box.
local function card_body(it, inner)
  local L = {}
  local function add(chunks)
    L[#L + 1] = chunks
  end
  local blockers = state.open_blockers(it)
  local status = state.item_status(it)
  add({ { it.id, 'ClandDim' }, status == 'blocked' and { '  ◌ by ' .. table.concat(blockers, ', '), 'ClandDim' } or nil })
  local title = D.wrap(it.title, inner)
  for i = 1, math.min(3, #title) do
    add({ { (i == 3 and #title > 3) and D.trunc(title[i] .. ' …', inner) or title[i], 'ClandText' } })
  end
  local s = it.claim and state.session(it.claim)
  if s then
    add({ { s.name .. ' · ' .. harness_short(s), 'ClandTeal' } })
    if s.state == 'waiting for approval' then
      add({ { '▲ waiting for approval', 'ClandAmber' } })
    end
  elseif it.status == 'progress' then
    add({ { 'unclaimed' .. (it.lost_claim and (' (' .. it.lost_claim .. ' ✗)') or ''), 'ClandRed' } })
  elseif it.status == 'review' or it.status == 'qa' then
    add({ { 'waits for a ' .. (it.status == 'qa' and 'QA' or 'Reviewer') .. ' session', 'ClandDim' } })
  end
  if state.item_ask(it.id) then
    add({ { '▲ ask open', 'ClandAmber' } })
  end
  local marks = state.verdict_marks(it)
  if #marks > 0 then
    local chunks = {}
    for i, v in ipairs(marks) do
      if i > 1 then
        chunks[#chunks + 1] = { ' · ', 'ClandDim' }
      end
      chunks[#chunks + 1] = { (v.result == 'clear' and '✓ ' or '✗ ') .. v.kind, v.result == 'clear' and 'ClandGreen' or 'ClandRed' }
    end
    add(chunks)
  end
  return L
end

local function border_hl(it)
  local st = state.item_status(it)
  if st == 'progress' then
    return 'ClandBoxTeal'
  elseif st == 'review' or st == 'qa' then
    return 'ClandBoxAmber'
  end
  return 'ClandBox'
end

-- One column as a list of lines {chunks=, info=} of width `w`.
local function column(status, label, w)
  local items = M.tasks(status)
  local lines = {}
  local head = { { label:upper(), 'ClandSection' } }
  local count = tostring(#items)
  local thin = status == 'backlog' and #items <= 3 and w >= 18
  local cw = D.w(label) + 1
  head[#head + 1] = { (' '):rep(math.max(1, w - cw - D.w(count .. (thin and ' · thin' or '')))) }
  head[#head + 1] = { count .. (thin and ' · thin' or ''), thin and 'ClandAmber' or 'ClandSection' }
  lines[#lines + 1] = { chunks = head }
  lines[#lines + 1] = { chunks = { { ('─'):rep(w), 'ClandSectionRule' } } }
  local boxed = w >= 16
  local inner = boxed and (w - 4) or (w - 2)
  for _, it in ipairs(items) do
    local b = border_hl(it)
    local body = card_body(it, inner)
    if boxed then
      lines[#lines + 1] = { chunks = { { '╭' .. ('─'):rep(w - 2) .. '╮', b } }, info = it.id }
      for _, chunks in ipairs(body) do
        local fit, fw = D.fit(chunks, inner)
        local row = { { '│ ', b } }
        vim.list_extend(row, fit)
        row[#row + 1] = { (' '):rep(inner - fw) }
        row[#row + 1] = { ' │', b }
        lines[#lines + 1] = { chunks = row, info = it.id }
      end
      lines[#lines + 1] = { chunks = { { '╰' .. ('─'):rep(w - 2) .. '╯', b } }, info = it.id }
    else
      for _, chunks in ipairs(body) do
        local row = { { '▌ ', b } }
        vim.list_extend(row, chunks)
        lines[#lines + 1] = { chunks = row, info = it.id }
      end
      lines[#lines + 1] = { chunks = {} }
    end
  end
  if #items == 0 then
    lines[#lines + 1] = { chunks = { { 'nothing here', 'ClandFaint' } } }
  end
  return lines
end

function M.buf()
  if M.b and api.nvim_buf_is_valid(M.b) then
    return M.b
  end
  local b = D.scratch('board', 'board')
  M.b = b
  local function map(lhs, fn, desc)
    vim.keymap.set('n', lhs, fn, { buffer = b, nowait = true, silent = true, desc = 'cland-proto: ' .. desc })
  end
  local function open()
    local id = M.item_at()
    if id then
      require('cland_proto.layout').show({ kind = 'item', id = id })
    end
  end
  map('<CR>', open, 'open the card')
  map('<2-LeftMouse>', open, 'open the card')
  map('f', function()
    local scopes = M.scopes()
    local cur = 1
    for i, s in ipairs(scopes) do
      if s == state.S.ui.board_scope then
        cur = i
      end
    end
    state.S.ui.board_scope = scopes[cur % #scopes + 1]
    state.changed('board scope: ' .. state.S.ui.board_scope)
  end, 'next epic scope')
  return b
end

function M.item_at()
  local cur = api.nvim_win_get_cursor(0)
  local inf = M.rows[cur[1]]
  if not (inf and inf.cols) then
    return nil
  end
  for _, seg in ipairs(inf.cols) do
    if cur[2] >= seg.start and cur[2] < seg.stop + 1 then
      return seg.info
    end
  end
end

function M.render(win)
  local b = M.buf()
  if not (win and api.nvim_win_is_valid(win)) then
    return
  end
  local W = api.nvim_win_get_width(win)
  local c = D.canvas(W)
  local tabs = { { ' ' } }
  for _, s in ipairs(M.scopes()) do
    local label = s == 'all' and 'all epics' or (s .. ' ' .. state.item(s).title)
    tabs[#tabs + 1] = { ' ' .. label .. ' ', s == state.S.ui.board_scope and 'ClandTabOn' or 'ClandTab' }
    tabs[#tabs + 1] = { ' ' }
  end
  c:add(tabs, { { 'f scope · ↵ open · gi gt gs ', 'ClandDim' } })
  c:blank()
  local gap = 2
  local w = math.floor((W - 2 - gap * 5) / 6)
  local cols = {}
  local height = 0
  for _, col in ipairs(M.COLS) do
    local lines = column(col[1], col[2], w)
    cols[#cols + 1] = lines
    height = math.max(height, #lines)
  end
  for r = 1, height do
    local segs = {}
    for i, lines in ipairs(cols) do
      local l = lines[r]
      segs[i] = { chunks = l and l.chunks or {}, width = w, info = l and l.info }
    end
    table.insert(segs, 1, { chunks = {}, width = 0 })
    c:cols(segs, { gap = (' '):rep(gap) })
  end
  M.rows = c:apply(b, M.ns)
end

function M.summary()
  local n = #M.tasks('backlog')
  return n <= 3 and ('backlog thinning: ' .. n .. ' left') or (n .. ' in the backlog')
end

return M
