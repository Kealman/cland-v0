-- PROTOTYPE (ticket #15, workbench): the inbox, as the Inbox artboard
-- draws it. Fixed sections, oldest first inside each: asks (answer here,
-- 1-9 or i), approvals (answered in the session: Enter attaches it), topics
-- waiting for you, and notifications (d dismisses, D all). The right panel
-- (<Space>n) and the full-width centre view (<Space>N) render the same
-- state; the inbox stores nothing of its own.
local api = vim.api
local state = require('cland_proto.state')
local chat = require('cland_proto.chat')
local D = require('cland_proto.draw')

local M = { ns = api.nvim_create_namespace('cland_proto_inbox'), bufs = {}, rows = {} }

local function key(inf)
  if not inf then
    return nil
  end
  return (inf.kind or '') .. ':' .. tostring(inf.ask or inf.session or inf.topic or inf.note or '') .. ':'
    .. tostring(inf.option or (inf.free and 'free') or '')
end

local function section(c, title, right)
  if #c.lines > 0 then
    c:blank()
  end
  c:add({ { ' ' .. title:upper(), 'ClandSection' } }, right, { info = { section = true } })
end

local function nothing(c)
  c:add({ { ' ○ ', 'ClandDim' }, { 'nothing', 'ClandDim' } }, nil, { info = { section = true } })
end

function M.expanded()
  local id = state.S.ui.inbox_ask
  local a = id and state.ask(id)
  if a and a.state == 'open' then
    return a
  end
  return state.open_asks()[1]
end

function M.draw(c, full)
  local n = state.needs_you()
  local W = c.width
  section(c, 'asks · answer here', { { tostring(#n.asks) .. ' ', 'ClandSection' } })
  local exp = M.expanded()
  if #n.asks == 0 then
    nothing(c)
  end
  for _, a in ipairs(n.asks) do
    if full or a == exp then
      local t = state.topic(a.topic)
      chat.card(c, a, {
        indent = 1, width = math.min(W - 2, full and 90 or W - 2), short = not full, sel = not full,
        head = { { '? ', 'ClandCardAmber' }, { a.item or chat.label(t), 'ClandCardAmber' },
          { ' · ' .. a.from .. ' · ' .. state.fmt(a.at), 'ClandCardDim' } },
        foot = { { ' i ', 'ClandCardKey' }, { ' free answer · ', 'ClandCardDim' }, { ' ↵ ', 'ClandCardKey' },
          { ' open the topic', 'ClandCardDim' } },
      })
      -- the card rows carry {ask=, option=}; mark them as inbox rows
      for r = #c.lines, 1, -1 do
        local inf = c.info[r]
        if not (inf and inf.ask == a.id) then
          break
        end
        inf.kind = 'ask'
      end
    else
      c:add({ { ' ' }, { '?', 'ClandAmber' }, { ' ' .. (a.item and (a.item .. ' · ') or '') .. (a.short or a.question) } },
        { { a.from .. ' · ' .. state.fmt(a.at) .. ' ', 'ClandDim' } }, { info = { kind = 'ask', ask = a.id } })
    end
  end
  section(c, 'approvals · answer in the session', { { tostring(#n.approvals) .. ' ', 'ClandSection' } })
  if #n.approvals == 0 then
    nothing(c)
  end
  for _, s in ipairs(n.approvals) do
    c:add({ { ' ' }, { '▲', 'ClandAmber' }, { ' ' .. s.name .. ' · run: ' .. (s.approval or '?') } },
      { { ' ↵ ', 'ClandKey' }, { ' attach ', 'ClandDim' } }, { info = { kind = 'approval', session = s.name } })
  end
  section(c, 'waiting for you · topics', { { tostring(#n.waiting) .. ' ', 'ClandSection' } })
  if #n.waiting == 0 then
    nothing(c)
  end
  for _, t in ipairs(n.waiting) do
    local last
    for i = #t.messages, 1, -1 do
      if t.messages[i].from and t.messages[i].from ~= 'you' then
        last = t.messages[i]
        break
      end
    end
    local right = {}
    if (t.unread or 0) > 0 then
      right[#right + 1] = { ' ' .. t.unread .. ' ', 'ClandBadge' }
    end
    right[#right + 1] = { '  ' .. (last and (last.from .. ' · ' .. state.fmt(last.at)) or '') .. ' ', 'ClandDim' }
    c:add({ { ' ' }, { '●', 'ClandAmber' }, { ' ' .. chat.label(t) } }, right, { info = { kind = 'waiting', topic = t.id } })
  end
  local notes = state.S.notes
  section(c, 'notifications', { { #notes .. ' · ', 'ClandSection' }, { ' d ', 'ClandKey' }, { ' dismiss · ', 'ClandDim' },
    { ' D ', 'ClandKey' }, { ' all ', 'ClandDim' } })
  if #notes == 0 then
    nothing(c)
  end
  for _, nt in ipairs(notes) do
    c:add({ { ' ' }, { nt.glyph, nt.hl }, { ' ' .. nt.text, 'ClandDim' } }, { { state.fmt(nt.at) .. ' ', 'ClandDim' } },
      { info = { kind = 'note', note = nt.id } })
  end
end

function M.buf(where)
  local b = M.bufs[where]
  if b and api.nvim_buf_is_valid(b) then
    return b
  end
  b = D.scratch(where == 'centre' and 'inbox_full' or 'inbox', 'inbox-' .. where)
  M.bufs[where] = b
  local function map(lhs, fn, desc)
    vim.keymap.set('n', lhs, fn, { buffer = b, nowait = true, silent = true, desc = 'cland-proto: ' .. desc })
  end
  map('<CR>', function()
    M.act(M.row(b))
  end, 'act on the row (open, attach)')
  map('<2-LeftMouse>', function()
    M.act(M.row(b))
  end, 'act on the row')
  for i = 1, 9 do
    map(tostring(i), function()
      M.answer(b, i)
    end, 'answer the ask with option ' .. i)
  end
  map('i', function()
    local a = M.ask_for(b)
    if a then
      require('cland_proto.ask').start_free(a.id)
    else
      vim.notify('cland-proto: no open ask', vim.log.levels.INFO)
    end
  end, 'free answer in the composer')
  map('d', function()
    M.dismiss(M.row(b))
  end, 'dismiss the notification')
  map('D', function()
    local n = #state.S.notes
    state.S.notes = {}
    state.changed('dismissed all ' .. n .. ' notifications')
  end, 'dismiss all notifications')
  for _, k in ipairs({ '<Tab>', 'za' }) do
    map(k, function()
      local inf = M.row(b)
      if inf and inf.ask then
        state.S.ui.inbox_ask = inf.ask
        state.changed('inbox: ask #' .. inf.ask .. ' expanded')
      end
    end, 'expand the ask under the cursor')
  end
  return b
end

function M.row(b)
  return (M.rows[b] or {})[api.nvim_win_get_cursor(0)[1]]
end

function M.ask_for(b)
  local inf = M.row(b)
  if inf and inf.ask then
    local a = state.ask(inf.ask)
    if a and a.state == 'open' then
      return a
    end
  end
  return M.expanded()
end

function M.answer(b, i)
  local a = M.ask_for(b)
  if not a then
    vim.notify('cland-proto: no open ask', vim.log.levels.INFO)
  elseif i > #a.options then
    vim.notify(('cland-proto: ask #%d has %d options; i types a free answer'):format(a.id, #a.options), vim.log.levels.INFO)
  else
    require('cland_proto.ask').answer(a.id, i)
  end
end

function M.dismiss(inf)
  if not inf or inf.kind ~= 'note' then
    if inf and (inf.kind == 'ask' or inf.kind == 'approval') then
      vim.notify('cland-proto: asks and approvals cannot be dismissed, only answered', vim.log.levels.INFO)
    end
    return
  end
  for i, nt in ipairs(state.S.notes) do
    if nt.id == inf.note then
      table.remove(state.S.notes, i)
      state.changed('dismissed: ' .. nt.text)
      return
    end
  end
end

-- Enter: the thing itself (topic for asks and waits, session for approvals,
-- the target of a notification).
function M.act(inf)
  if not inf or not inf.kind then
    return
  end
  local layout = require('cland_proto.layout')
  if inf.kind == 'ask' then
    local a = state.ask(inf.ask)
    layout.show({ kind = 'thread', id = a.topic }, { ask = a.id })
  elseif inf.kind == 'approval' then
    layout.show({ kind = 'session', id = inf.session }, { insert = true })
  elseif inf.kind == 'waiting' then
    layout.show({ kind = 'thread', id = inf.topic })
  elseif inf.kind == 'note' then
    for _, nt in ipairs(state.S.notes) do
      if nt.id == inf.note and nt.target then
        local kind, id = nt.target[1], nt.target[2]
        if kind == 'item' then
          layout.show({ kind = 'item', id = id })
        elseif kind == 'topic' then
          layout.show({ kind = 'thread', id = id })
        elseif kind == 'session' then
          layout.show({ kind = 'session', id = id })
        end
      end
    end
  end
end

function M.render(where, win)
  local b = M.buf(where)
  if not (win and api.nvim_win_is_valid(win)) then
    return
  end
  local keep
  if api.nvim_win_get_buf(win) == b then
    local ok, cur = pcall(api.nvim_win_get_cursor, win)
    keep = ok and key((M.rows[b] or {})[cur[1]])
  end
  local c = D.canvas(api.nvim_win_get_width(win))
  M.draw(c, where == 'centre')
  c:blank()
  if where == 'centre' then
    c:add({ { ' ␣N or ␣␣ back · j/k move · ↵ act · 1-9 answer · i free answer · d dismiss · D all', 'ClandDim' } })
  else
    c:add({ { ' ␣n toggles · ␣N full width · j/k · ↵ act', 'ClandDim' } })
    c:push_down(vim.fn.winheight(win), 1)
  end
  M.rows[b] = c:apply(b, M.ns)
  local target
  for r, inf in pairs(M.rows[b]) do
    if inf and keep and key(inf) == keep and (not target or r < target) then
      target = r
    end
  end
  if not target and not keep then
    for r, inf in pairs(M.rows[b]) do
      if inf and inf.kind and (not target or r < target) then
        target = r
      end
    end
  end
  if target then
    pcall(api.nvim_win_set_cursor, win, { target, 0 })
  end
  D.top_if_fits(win)
end

return M
