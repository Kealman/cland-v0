-- PROTOTYPE (ticket #15): the in-memory fake state every variant renders.
-- One table (M.S, built by data.lua), queries over it, and a change signal:
-- any mutation calls M.changed(), which re-renders every view once per tick.
-- No persistence: quitting Neovim forgets everything.
local M = { listeners = {}, log = {} }

function M.now_min()
  local t = os.date('*t')
  return t.hour * 60 + t.min
end

-- "HH:MM"; negative minutes are yesterday.
function M.fmt(at)
  if not at then
    return '--:--'
  end
  local prefix = ''
  if at < 0 then
    prefix, at = 'yest ', at + 1440
  end
  return ('%s%02d:%02d'):format(prefix, math.floor(at / 60) % 24, at % 60)
end

function M.ago(at)
  local d = M.now_min() - at
  if d < 1 then
    return 'now'
  elseif d < 60 then
    return d .. 'm'
  end
  return ('%dh%02dm'):format(math.floor(d / 60), d % 60)
end

function M.reset()
  M.S = require('cland_proto.data').make(M.now_min())
  M.log = {}
end

function M.on_change(fn)
  M.listeners[#M.listeners + 1] = fn
end

local scheduled = false
function M.changed(why)
  if why then
    M.log[#M.log + 1] = os.date('%H:%M:%S ') .. why
  end
  if scheduled then
    return
  end
  scheduled = true
  vim.schedule(function()
    scheduled = false
    for _, fn in ipairs(M.listeners) do
      local ok, err = pcall(fn)
      if not ok then
        vim.notify('cland-proto render error: ' .. tostring(err), vim.log.levels.ERROR)
      end
    end
  end)
end

-- Queries ---------------------------------------------------------------

function M.topic(id)
  for _, t in ipairs(M.S.topics) do
    if t.id == id then
      return t
    end
  end
end

function M.current()
  return M.topic(M.S.current_topic) or M.S.topics[1]
end

function M.session(name)
  for _, s in ipairs(M.S.sessions) do
    if s.name == name then
      return s
    end
  end
end

-- The session that holds `role` (Coordinator is exclusive; others: the first).
function M.holder(role)
  for _, s in ipairs(M.S.sessions) do
    if s.role == role and s.state ~= 'stopped' then
      return s
    end
  end
end

function M.ask(id)
  for _, a in ipairs(M.S.asks) do
    if a.id == id then
      return a
    end
  end
end

function M.open_asks(topic_id)
  local out = {}
  for _, a in ipairs(M.S.asks) do
    if a.state == 'open' and (topic_id == nil or a.topic == topic_id) then
      out[#out + 1] = a
    end
  end
  return out
end

function M.activity(t)
  local last = t.messages[#t.messages]
  return last and last.at or -99999
end

-- Topics sorted the way #7 says: waiting for the human pinned on top, then by activity.
function M.sorted_topics()
  local list = vim.list_slice(M.S.topics)
  table.sort(list, function(a, b)
    local wa, wb = a.status == 'waiting for human', b.status == 'waiting for human'
    if wa ~= wb then
      return wa
    end
    local ca, cb = a.status == 'closed', b.status == 'closed'
    if ca ~= cb then
      return cb
    end
    return M.activity(a) > M.activity(b)
  end)
  return list
end

-- The "needs you" queue: strong signals only (asks, approvals, waits, no coordinator).
function M.needs_you()
  local out = {}
  for _, a in ipairs(M.open_asks()) do
    out[#out + 1] = { kind = 'ask', ask = a, topic = M.topic(a.topic), at = a.at }
  end
  for _, s in ipairs(M.S.sessions) do
    if s.state == 'waiting for approval' then
      out[#out + 1] = { kind = 'approval', session = s, at = s.since }
    elseif s.state == 'waiting for human' then
      out[#out + 1] = { kind = 'session', session = s, at = s.since }
    end
  end
  for _, t in ipairs(M.S.topics) do
    if t.status == 'waiting for human' and #M.open_asks(t.id) == 0 then
      out[#out + 1] = { kind = 'waiting', topic = t, at = M.activity(t) }
    end
  end
  if not M.holder('Coordinator') then
    out[#out + 1] = { kind = 'vacant', at = M.now_min() }
  end
  return out
end

-- Weak signal: topics with unread messages (not the one on screen).
function M.unread_topics()
  local out = {}
  for _, t in ipairs(M.sorted_topics()) do
    if (t.unread or 0) > 0 then
      out[#out + 1] = t
    end
  end
  return out
end

function M.unread_total()
  local n = 0
  for _, t in ipairs(M.S.topics) do
    n = n + (t.unread or 0)
  end
  return n
end

function M.last_human_message(t)
  for i = #t.messages, 1, -1 do
    local m = t.messages[i]
    if m.from == 'you' then
      return m, i
    end
    if m.kind == 'text' or m.kind == 'ask' then
      return nil
    end
  end
end

-- Text summaries ---------------------------------------------------------

function M.summary_line()
  local S = M.S
  local v = require('cland_proto.switcher').info()
  local needs = {}
  for _, n in ipairs(M.needs_you()) do
    needs[#needs + 1] = n.kind == 'ask' and ('ask in ' .. (n.topic.item or n.topic.title))
      or n.kind == 'approval' and ('approval ' .. n.session.name)
      or n.kind == 'vacant' and 'no coordinator'
      or n.kind
  end
  local sess = {}
  for _, s in ipairs(S.sessions) do
    local short = require('cland_proto.sessions').STATE[s.state]
    sess[#sess + 1] = s.name .. ' ' .. (short and short.short or s.state)
  end
  return ('variant %s %s · topic %s · needs you %d%s · unread %d · %s'):format(
    v.key, v.name, M.current().title, #needs, #needs > 0 and (' (' .. table.concat(needs, ', ') .. ')') or '',
    M.unread_total(), table.concat(sess, ', '))
end

local function pad(s, n)
  s = tostring(s or '')
  local w = vim.fn.strdisplaywidth(s)
  return w >= n and s or (s .. (' '):rep(n - w))
end

function M.dump_lines()
  local S = M.S
  local v = require('cland_proto.switcher').info()
  local L = {}
  local function add(s)
    L[#L + 1] = s
  end
  add('cland chat-screen prototype (ticket #15): the fake state, in memory only')
  add(('variant %s (%s) · current topic: %s · active session: %s · now %s'):format(
    v.key, v.name, M.current().title, S.active_session, M.fmt(M.now_min())))
  add('')
  add('TOPICS (sorted: waiting for you first, closed last, then by activity)')
  add('  ' .. pad('status', 19) .. pad('unread', 8) .. pad('binding', 9) .. pad('last', 11) .. pad('msgs', 6) .. 'title')
  for _, t in ipairs(M.sorted_topics()) do
    add('  ' .. pad(t.readonly and 'read-only' or t.status, 19) .. pad(t.unread, 8) .. pad(t.item or '-', 9)
      .. pad(M.fmt(M.activity(t)), 11) .. pad(#t.messages, 6) .. t.title
      .. (t.standing and '  (standing)' or '') .. (t.created_by ~= 'system' and ('  created by ' .. t.created_by) or ''))
    local m = M.last_human_message(t)
    if m then
      add(('      the last word is yours → %s: stage %s (%s)'):format(m.to or '(no holder)', m.stage, M.fmt(m.at)))
    end
  end
  add('')
  add('ASKS')
  for _, a in ipairs(S.asks) do
    add(('  #%d %s in %s from %s [%s] at %s: %s'):format(a.id, a.state, M.topic(a.topic).title, a.from, a.role,
      M.fmt(a.at), a.question))
    for i, o in ipairs(a.options) do
      add(('      %d. %s'):format(i, o.label))
    end
    if a.free then
      add('      +  free answer')
    end
    if a.answer then
      add('      answered: ' .. a.answer)
    end
  end
  add('')
  add('NEEDS YOU (strong signals)')
  local needs = M.needs_you()
  if #needs == 0 then
    add('  nothing')
  end
  for _, n in ipairs(needs) do
    if n.kind == 'ask' then
      add('  ask #' .. n.ask.id .. ' in ' .. n.topic.title)
    elseif n.kind == 'approval' then
      add(('  approval: %s [%s] waits to run `%s`'):format(n.session.name, n.session.role, n.session.approval or '?'))
    elseif n.kind == 'session' then
      add('  session waits for you: ' .. n.session.name)
    elseif n.kind == 'waiting' then
      add('  topic waiting for you: ' .. n.topic.title)
    elseif n.kind == 'vacant' then
      add('  no coordinator: messages to the Coordinator stay queued')
    end
  end
  add('')
  add('SESSIONS')
  add('  ' .. pad('name', 10) .. pad('role', 13) .. pad('harness', 13) .. pad('model', 13) .. pad('state', 22)
    .. pad('item', 6) .. 'since / self-reported status (never drives the state)')
  for _, s in ipairs(S.sessions) do
    add('  ' .. pad(s.name, 10) .. pad(s.role, 13) .. pad(s.harness, 13) .. pad(s.model, 13) .. pad(s.state, 22)
      .. pad(s.item or '-', 6) .. M.fmt(s.since) .. ' / ' .. (s.status_line or '')
      .. (s.approval and ('  approval: ' .. s.approval) or '')
      .. (s.buf and ('  terminal buf ' .. s.buf .. ' pid ' .. tostring(s.pid)) or '  (terminal not opened yet)'))
  end
  add('')
  add('ITEMS')
  for _, id in ipairs({ 'T-12', 'T-15', 'T-21' }) do
    local it = S.items[id]
    add(('  %s %s %s "%s" branch %s%s%s'):format(it.id, it.kind, it.state, it.title, it.branch,
      it.claim and (' claim ' .. it.claim) or '', #it.verdicts > 0 and (' · ' .. table.concat(it.verdicts, '; ')) or ''))
  end
  add('')
  add('ARTIFACTS')
  for _, id in ipairs({ 'A-7', 'A-9' }) do
    local a = S.artifacts[id]
    add(('  %s %s %s by %s in %s: "%s" (%s)'):format(a.id, a.kind, a.status, a.by, M.topic(a.topic).title, a.title, a.path))
  end
  add('')
  add('CHANGE LOG (this run)')
  if #M.log == 0 then
    add('  nothing yet')
  end
  for i = math.max(1, #M.log - 14), #M.log do
    add('  ' .. M.log[i])
  end
  return L
end

-- A JSON-safe copy (no buffers or job handles) for :ClandState json and RPC.
function M.plain()
  local copy = vim.deepcopy(M.S)
  for _, s in ipairs(copy.sessions) do
    s.buf, s.job = nil, nil
  end
  copy.last_sent = copy.last_sent and { text = copy.last_sent.text, stage = copy.last_sent.stage, to = copy.last_sent.to }
  copy.variant = require('cland_proto.switcher').info()
  return copy
end

return M
