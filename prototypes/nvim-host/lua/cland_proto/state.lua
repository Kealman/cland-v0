-- PROTOTYPE (ticket #15, workbench): the in-memory fake state every panel
-- and view renders. One table (M.S, built by data.lua), queries over it, and
-- a change signal: any mutation calls M.changed(), which re-renders the
-- whole workbench once per tick. No persistence: quitting forgets it all.
local M = { listeners = {}, log = {} }

function M.now_min()
  local t = os.date('*t')
  return t.hour * 60 + t.min
end

-- "HH:MM"; earlier days show as "-1d HH:MM".
function M.fmt(at)
  if not at then
    return '--:--'
  end
  local prefix = ''
  local day = 0
  while at < 0 do
    at, day = at + 1440, day + 1
  end
  if day > 0 then
    prefix = '-' .. day .. 'd '
  end
  return ('%s%02d:%02d'):format(prefix, math.floor(at / 60) % 24, at % 60)
end

function M.ago(at)
  local d = M.now_min() - (at or M.now_min())
  if d < 1 then
    return 'now'
  elseif d < 60 then
    return d .. 'm'
  end
  return ('%dh %02dm'):format(math.floor(d / 60), d % 60)
end

-- One line in the message area, cut to fit: a longer one would raise a
-- hit-enter prompt, which blocks every callback (the #11 finding).
function M.say(msg, group, keep)
  msg = tostring(msg or ''):gsub('\n', ' ')
  local max = vim.o.columns - 14
  if vim.fn.strdisplaywidth(msg) > max then
    msg = vim.fn.strcharpart(msg, 0, max - 1) .. '…'
  end
  vim.api.nvim_echo({ { msg, group or 'ClandDim' } }, keep or false, {})
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

-- Lookups ------------------------------------------------------------------

function M.topic(id)
  for _, t in ipairs(M.S.topics) do
    if t.id == id then
      return t
    end
  end
end

function M.session(name)
  for _, s in ipairs(M.S.sessions) do
    if s.name == name then
      return s
    end
  end
end

function M.item(id)
  return id and M.S.items[id]
end

function M.ask(id)
  for _, a in ipairs(M.S.asks) do
    if a.id == id then
      return a
    end
  end
end

function M.artifact(id)
  return id and M.S.artifacts[id]
end

function M.live(s)
  return s and s.state ~= 'stopped' and s.state ~= 'died'
end

-- The topic bound to item `id` (#7: at most one per unit of work).
function M.topic_of_item(id)
  if not id then
    return nil
  end
  for _, t in ipairs(M.S.topics) do
    if t.item == id then
      return t
    end
  end
end

-- The session that holds `role` (the Coordinator is exclusive).
function M.holder(role)
  for _, s in ipairs(M.S.sessions) do
    if s.role == role and M.live(s) then
      return s
    end
  end
end

function M.open_asks(filter)
  filter = filter or {}
  local out = {}
  for _, a in ipairs(M.S.asks) do
    if a.state == 'open' and (not filter.topic or a.topic == filter.topic) and (not filter.item or a.item == filter.item) then
      out[#out + 1] = a
    end
  end
  table.sort(out, function(x, y)
    return x.at < y.at
  end)
  return out
end

function M.activity(t)
  local last = t.messages[#t.messages]
  return last and last.at or -99999
end

-- #7: one flat list, topics waiting for the human pinned on top, then activity.
function M.sorted_topics()
  local list = vim.list_slice(M.S.topics)
  local rank = { ['waiting for human'] = 0, ['waiting for agent'] = 1, open = 1, closed = 2 }
  table.sort(list, function(a, b)
    local ra, rb = rank[a.status] or 1, rank[b.status] or 1
    if ra ~= rb then
      return ra < rb
    end
    return M.activity(a) > M.activity(b)
  end)
  return list
end

-- Topics waiting for the human that carry no open ask (Inbox artboard).
function M.waiting_topics()
  local out = {}
  for _, t in ipairs(M.S.topics) do
    if t.status == 'waiting for human' and #M.open_asks({ topic = t.id }) == 0 then
      out[#out + 1] = t
    end
  end
  table.sort(out, function(a, b)
    return M.activity(a) < M.activity(b)
  end)
  return out
end

function M.approvals()
  local out = {}
  for _, s in ipairs(M.S.sessions) do
    if s.state == 'waiting for approval' then
      out[#out + 1] = s
    end
  end
  table.sort(out, function(a, b)
    return (a.since or 0) < (b.since or 0)
  end)
  return out
end

-- The "needs you" count: asks + approvals + waiting topics (notifications are
-- not counted; Inbox artboard, "Order and sound").
function M.needs_you()
  local n = { asks = M.open_asks(), approvals = M.approvals(), waiting = M.waiting_topics() }
  n.count = #n.asks + #n.approvals + #n.waiting
  return n
end

function M.unread_total()
  local n, topics = 0, 0
  for _, t in ipairs(M.S.topics) do
    if (t.unread or 0) > 0 then
      n, topics = n + t.unread, topics + 1
    end
  end
  return n, topics
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

-- The human's latest message in the topic, replied to or not.
function M.last_sent(t)
  for i = #t.messages, 1, -1 do
    if t.messages[i].from == 'you' then
      return t.messages[i]
    end
  end
end

-- Messages the hub holds for an addressee that is offline (store-and-forward).
function M.queued_count()
  local n = 0
  for _, t in ipairs(M.S.topics) do
    for _, m in ipairs(t.messages) do
      if m.stage == 'queued' then
        n = n + 1
      end
    end
  end
  return n
end

function M.session_counts()
  local c = { busy = 0, waiting = 0, idle = 0, down = 0, live = 0, approval = 0, total = #M.S.sessions }
  for _, s in ipairs(M.S.sessions) do
    if not M.live(s) then
      c.down = c.down + 1
    else
      c.live = c.live + 1
      if s.state == 'busy' then
        c.busy = c.busy + 1
      elseif s.state:match('^waiting') then
        c.waiting = c.waiting + 1
        if s.state == 'waiting for approval' then
          c.approval = c.approval + 1
        end
      else
        c.idle = c.idle + 1
      end
    end
  end
  return c
end

-- Items ------------------------------------------------------------------

function M.children(id)
  local out = {}
  for _, cid in ipairs(M.S.item_order) do
    if M.S.items[cid].parent == id then
      out[#out + 1] = cid
    end
  end
  return out
end

function M.open_blockers(it)
  local out = {}
  for _, b in ipairs(it.blocked_by or {}) do
    local bi = M.S.items[b]
    if bi and bi.status ~= 'done' then
      out[#out + 1] = b
    end
  end
  return out
end

-- Items that list `id` in their blocked_by.
function M.blocks(id)
  local out = {}
  for _, cid in ipairs(M.S.item_order) do
    for _, b in ipairs(M.S.items[cid].blocked_by or {}) do
      if b == id then
        out[#out + 1] = cid
      end
    end
  end
  return out
end

-- Workflow status shown in the UI: blocked wins for work not started.
function M.item_status(it)
  if it.kind == 'question' and it.map then
    return it.map == 'blocked' and 'blocked' or it.status
  end
  if (it.status == 'backlog' or it.status == 'planned') and #M.open_blockers(it) > 0 then
    return 'blocked'
  end
  return it.status
end

function M.item_ask(id)
  return M.open_asks({ item = id })[1]
end

-- epics and maps: "n of m" done
function M.progress(id)
  local kids = M.children(id)
  local done = 0
  for _, cid in ipairs(kids) do
    if M.S.items[cid].status == 'done' then
      done = done + 1
    end
  end
  return done, #kids
end

function M.verdict_marks(it)
  local seen, out = {}, {}
  for i = #it.verdicts, 1, -1 do
    local v = it.verdicts[i]
    if not seen[v.kind] and v.result ~= 'in progress' then
      seen[v.kind] = true
      table.insert(out, 1, v)
    end
  end
  return out
end

-- Text dumps (:ClandState) ------------------------------------------------

local function pad(s, n)
  s = tostring(s or '')
  local w = vim.fn.strdisplaywidth(s)
  return w >= n and s or (s .. (' '):rep(n - w))
end

function M.summary_line()
  local S, ui = M.S, M.S.ui
  local n = M.needs_you()
  local c = M.session_counts()
  local v = ui.view
  return ('layout %s · items %s%s · right %s%s · centre %s %s · needs you %d · sessions %d busy, %d waiting, %d idle, %d down'):format(
    ui.preset or 'custom', ui.items_open and 'open' or 'hidden', ui.items_open and (' (' .. ui.filter .. ')') or '',
    ui.right or 'hidden', ui.dock and ' + topics dock' or '', v.kind, v.id or '', n.count, c.busy, c.waiting, c.idle, c.down)
end

function M.dump_lines()
  local S, ui = M.S, M.S.ui
  local L = {}
  local function add(s)
    L[#L + 1] = s
  end
  add('cland workbench prototype (ticket #15): the fake state, in memory only · now ' .. M.fmt(M.now_min()))
  add('')
  add('LAYOUT (examples, not modes: every panel toggles on its own)')
  add('  preset ' .. (ui.preset or 'none (custom)') .. ' · items panel ' .. (ui.items_open and ('open, filter ' .. ui.filter) or 'hidden')
    .. ' · right panel ' .. (ui.right or 'hidden') .. (ui.dock and ' · topics docked above it' or ''))
  local hist = {}
  for _, h in ipairs(ui.hist) do
    hist[#hist + 1] = h.kind .. (h.id and (':' .. h.id) or '')
  end
  add('  centre ' .. ui.view.kind .. (ui.view.id and (' ' .. ui.view.id) or '') .. ' · back stack ' .. (#hist > 0 and table.concat(hist, ' < ') or 'empty')
    .. ' · board scope ' .. ui.board_scope)
  add('')
  local n = M.needs_you()
  add(('NEEDS YOU %d (asks %d + approvals %d + waiting topics %d; notifications are not counted)'):format(
    n.count, #n.asks, #n.approvals, #n.waiting))
  for _, a in ipairs(n.asks) do
    add(('  ask #%d in topic %s about %s, from %s (raised by %s) at %s: %s'):format(a.id, a.topic, a.item or '-', a.from,
      a.raised_by or a.from, M.fmt(a.at), a.question))
  end
  for _, s in ipairs(n.approvals) do
    add(('  approval: %s [%s] waits to run `%s` (answer in its TUI)'):format(s.name, s.role, s.approval or '?'))
  end
  for _, t in ipairs(n.waiting) do
    add('  waiting topic: ' .. t.title .. ' (' .. (t.unread or 0) .. ' unread)')
  end
  add('')
  add('SESSIONS')
  add('  ' .. pad('name', 9) .. pad('role', 13) .. pad('harness', 13) .. pad('model', 13) .. pad('state', 22) .. pad('item', 6) .. 'since · terminal')
  for _, s in ipairs(S.sessions) do
    add('  ' .. pad(s.name, 9) .. pad(s.role, 13) .. pad(s.harness, 13) .. pad(s.model, 13) .. pad(s.state, 22)
      .. pad(s.item or '-', 6) .. M.fmt(s.since) .. (s.approval and ('  approval: ' .. s.approval) or '')
      .. (s.buf and ('  · terminal buf ' .. s.buf) or '  · not attached yet'))
  end
  local coord = M.holder('Coordinator')
  add('  Coordinator: ' .. (coord and coord.name or 'VACANT (messages to the role stay queued)') .. ' · hub queue: ' .. M.queued_count())
  add('')
  add('ITEMS (status · claim · topic · verdicts)')
  for _, id in ipairs(S.item_order) do
    local it = S.items[id]
    if not it.map then
      local marks = {}
      for _, v in ipairs(it.verdicts) do
        marks[#marks + 1] = v.kind .. ' ' .. v.result
      end
      add(('  %s %s %s "%s"%s%s%s%s'):format(pad(it.id, 5), pad(it.kind, 8), pad(M.item_status(it), 9), it.title,
        it.claim and (' · claim ' .. it.claim) or '', it.topic and (' · topic ' .. it.topic) or '',
        #marks > 0 and (' · ' .. table.concat(marks, ', ')) or '',
        M.item_ask(id) and ' · ASK OPEN' or ''))
    end
  end
  local groups = {}
  for _, id in ipairs(S.item_order) do
    local it = S.items[id]
    if it.map then
      groups[it.map] = (groups[it.map] or '') .. ' ' .. id
    end
  end
  add('  map M-1 (charting snapshot): decided' .. (groups.decided or '') .. ' · frontier' .. (groups.frontier or '')
    .. ' · sub-agents' .. (groups.subagent or '') .. ' · blocked' .. (groups.blocked or ''))
  add('')
  add('TOPICS (sorted: waiting for you first, closed last, then activity)')
  for _, t in ipairs(M.sorted_topics()) do
    local m = M.last_human_message(t)
    add('  ' .. pad(t.readonly and 'read-only' or t.status, 19) .. pad((t.unread or 0) .. ' unread', 10) .. pad(t.item or '-', 6)
      .. t.title .. (m and ('  · your last message → ' .. (m.to or 'Coordinator') .. ': ' .. m.stage) or ''))
  end
  add('')
  add('ARTIFACTS')
  for _, id in ipairs(S.artifact_order) do
    local a = S.artifacts[id]
    add(('  %s %s %s by %s · topic %s · "%s" (%s)'):format(a.id, a.kind, a.status, a.by, a.topic or '-', a.title, a.path))
  end
  add('')
  add('NOTIFICATIONS (dismissable)')
  if #S.notes == 0 then
    add('  none')
  end
  for _, nt in ipairs(S.notes) do
    add('  ' .. nt.glyph .. ' ' .. nt.text .. ' · ' .. M.fmt(nt.at))
  end
  add('')
  add('CHANGE LOG (this run)')
  if #M.log == 0 then
    add('  nothing yet')
  end
  for i = math.max(1, #M.log - 16), #M.log do
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
  return copy
end

return M
