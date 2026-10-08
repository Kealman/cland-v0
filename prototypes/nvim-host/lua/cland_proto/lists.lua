-- PROTOTYPE (ticket #15, workbench): the sessions panel (<Space>s) and the
-- topics panel (<Space>t, or docked above the right panel with <Space>T).
-- Sessions: name, role, harness · model · state, current item; Enter
-- attaches. Topics: needs you / open / closed with unread badges (#7).
local api = vim.api
local state = require('cland_proto.state')
local sessions = require('cland_proto.sessions')
local chat = require('cland_proto.chat')
local D = require('cland_proto.draw')

local M = { ns = api.nvim_create_namespace('cland_proto_lists'), bufs = {}, rows = {} }

local function cursor_key(b, win)
  if api.nvim_win_get_buf(win) ~= b then
    return nil
  end
  local ok, cur = pcall(api.nvim_win_get_cursor, win)
  local inf = ok and (M.rows[b] or {})[cur[1]]
  return inf and (inf.session or inf.topic)
end

local function restore(b, win, keep, default)
  local target
  for r, inf in pairs(M.rows[b] or {}) do
    local k = inf and (inf.session or inf.topic)
    if k and ((keep and k == keep) or (not keep and k == default)) and (not target or r < target) then
      target = r
    end
  end
  if target then
    pcall(api.nvim_win_set_cursor, win, { target, 0 })
  end
end

function M.row(b)
  return (M.rows[b] or {})[api.nvim_win_get_cursor(0)[1]]
end

-- Sessions -----------------------------------------------------------------

local function last_delivery()
  local best
  for _, t in ipairs(state.S.topics) do
    for _, m in ipairs(t.messages) do
      if m.stage == 'injected' and m.to and (not best or m.at >= best.at) then
        best = m
      end
    end
  end
  return best
end

function M.sessions_buf()
  local b = M.bufs.sessions
  if b and api.nvim_buf_is_valid(b) then
    return b
  end
  b = D.scratch('sessions', 'sessions')
  M.bufs.sessions = b
  local function map(lhs, fn, desc)
    vim.keymap.set('n', lhs, fn, { buffer = b, nowait = true, silent = true, desc = 'cland-proto: ' .. desc })
  end
  local function attach()
    local inf = M.row(b)
    if inf and inf.session then
      require('cland_proto.layout').show({ kind = 'session', id = inf.session }, { insert = true })
    end
  end
  map('<CR>', attach, 'attach the session in the centre')
  map('<2-LeftMouse>', attach, 'attach the session')
  map('x', function()
    local inf = M.row(b)
    local s = inf and inf.session and state.session(inf.session)
    if not s then
      return
    end
    if state.live(s) then
      sessions.kill(s.name, 'stopped')
      state.changed(s.name .. ' stopped (x)')
    else
      sessions.revive(s.name)
      state.changed(s.name .. ' started again (x)')
    end
  end, 'stop the session (x again starts it)')
  for k, what in pairs({ n = 'launch a new session: role, harness and model from the roles.toml defaults',
    r = 'change the role of the session (the human assigns roles, #10)',
    h = 'hand over the role with a handover note (#10)' }) do
    map(k, function()
      vim.notify('cland-proto: ' .. k .. ' would ' .. what .. ' (not in the prototype)', vim.log.levels.INFO)
    end, what)
  end
  return b
end

function M.render_sessions(win)
  local b = M.sessions_buf()
  if not (win and api.nvim_win_is_valid(win)) then
    return
  end
  local keep = cursor_key(b, win)
  local c = D.canvas(api.nvim_win_get_width(win))
  for _, s in ipairs(state.S.sessions) do
    local st = sessions.st(s)
    local down = not state.live(s)
    c:add({ { ' ' }, { st[1], st[2] }, { ' ' }, { s.name, down and 'ClandDim' or 'ClandBold' }, { '  ' .. s.role, down and 'ClandDim' or 'ClandTeal' } },
      { s.item and { s.item .. ' ', down and 'ClandDim' or 'ClandTeal' } or { 'free ', 'ClandDim' } }, { info = { session = s.name } })
    c:add({ { '   ' .. sessions.meta(s), down and 'ClandRed' or 'ClandDim' } }, nil, { info = { session = s.name } })
  end
  c:blank()
  local m = last_delivery()
  if m then
    c:add({ { ' last delivery', 'ClandDim' } }, { { m.to .. ' · injected ' .. state.fmt(m.at) .. ' ', 'ClandDim' } })
  end
  c:blank()
  c:add({ { ' ↵ attach · n new · r role · x stop · h handover', 'ClandDim' } })
  c:push_down(vim.fn.winheight(win), 1)
  M.rows[b] = c:apply(b, M.ns)
  restore(b, win, keep, 'rev-1')
  D.top_if_fits(win)
end

-- Topics ---------------------------------------------------------------------

function M.topics_buf()
  local b = M.bufs.topics
  if b and api.nvim_buf_is_valid(b) then
    return b
  end
  b = D.scratch('topics', 'topics')
  M.bufs.topics = b
  local function map(lhs, fn, desc)
    vim.keymap.set('n', lhs, fn, { buffer = b, nowait = true, silent = true, desc = 'cland-proto: ' .. desc })
  end
  local function open()
    local inf = M.row(b)
    if inf and inf.topic then
      require('cland_proto.layout').show({ kind = 'thread', id = inf.topic })
    end
  end
  map('<CR>', open, 'open the topic in the centre')
  map('<2-LeftMouse>', open, 'open the topic')
  map('n', function()
    M.new_topic()
  end, 'new topic')
  return b
end

function M.new_topic()
  vim.ui.input({ prompt = 'New topic title: ' }, function(title)
    if not title or vim.trim(title) == '' then
      return
    end
    local n = 1
    while state.topic('new' .. n) do
      n = n + 1
    end
    local t = { id = 'new' .. n, title = vim.trim(title), status = 'open', unread = 0, created_by = 'you', messages = {} }
    table.insert(state.S.topics, t)
    state.changed('new topic "' .. t.title .. '" (unbound, created by you)')
    vim.schedule(function()
      require('cland_proto.layout').focus_composer(t.id, nil, true)
    end)
  end)
end

function M.topic_badge(t, section)
  if #state.open_asks({ topic = t.id }) > 0 then
    return { { ' ? ', 'ClandBadge' } }
  end
  if t.readonly then
    return { { 'log ', 'ClandDim' } }
  end
  if (t.unread or 0) > 0 then
    return { { ' ' .. t.unread .. ' ', section == 'needs you' and 'ClandBadge' or 'ClandBadgeN' } }
  end
  return nil
end

function M.render_topics(win)
  local b = M.topics_buf()
  if not (win and api.nvim_win_is_valid(win)) then
    return
  end
  local keep = cursor_key(b, win)
  local c = D.canvas(api.nvim_win_get_width(win))
  local v = state.S.ui.view
  local groups = { { 'needs you', {} }, { 'open', {} }, { 'closed', {} } }
  for _, t in ipairs(state.sorted_topics()) do
    local g = t.status == 'waiting for human' and 1 or (t.status == 'closed' and 3 or 2)
    table.insert(groups[g][2], t)
  end
  for _, g in ipairs(groups) do
    c:add({ { ' ' .. g[1]:upper() .. (#g[2] > 0 and (' · ' .. #g[2]) or ''), 'ClandSection' } }, nil, { info = { section = true } })
    for _, t in ipairs(g[2]) do
      local st = chat.status(t)
      local cur = v.kind == 'thread' and v.id == t.id
      local title_hl = t.status == 'closed' and 'ClandDim' or (cur and 'ClandBold' or nil)
      c:add({ { cur and '▎' or ' ', 'ClandBlue' }, { st[1], st[2] }, { ' ' .. chat.label(t), title_hl } }, M.topic_badge(t, g[1]),
        { info = { topic = t.id } })
    end
  end
  c:blank()
  c:add({ { ' ↵ open · gi item · gs session · n new topic', 'ClandDim' } })
  c:push_down(vim.fn.winheight(win), 1)
  M.rows[b] = c:apply(b, M.ns)
  restore(b, win, keep, v.kind == 'thread' and v.id or nil)
  D.top_if_fits(win)
end

return M
