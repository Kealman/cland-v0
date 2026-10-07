-- PROTOTYPE (ticket #15): the chat, grown from the engine prototype's fake
-- chat (#11). One thread buffer and one composer (a prompt buffer) per topic,
-- shared by every variant; a variant only decides where they are shown.
-- Sending is fake: the stage goes queued -> delivered -> injected and a
-- canned reply arrives after one second.
local api = vim.api
local state = require('cland_proto.state')
local sessions = require('cland_proto.sessions')

local M = {
  bufs = {}, -- topic id -> thread buffer
  composers = {}, -- topic id -> prompt buffer
  info = {}, -- thread buffer -> { [row] = { msg, ask, option, artifact, header } }
  answering = {}, -- topic id -> ask id (the composer sends a free answer)
  reply_to = nil, -- Agents topic: session the next reply goes to
  style = 'full', -- 'full' or 'compact' (variant C's narrow strip)
  ask_style = 'inline', -- 'inline' (options in the thread) or 'float' (variant D)
  ns = api.nvim_create_namespace('cland_proto_chat'),
}

M.STATUS = {
  open = { icon = '○', hl = 'ClandOpen', label = 'open' },
  ['waiting for human'] = { icon = '●', hl = 'ClandWaitYou', label = 'waiting for you' },
  ['waiting for agent'] = { icon = '◐', hl = 'ClandWaitAgent', label = 'waiting for agent' },
  closed = { icon = '✓', hl = 'ClandClosed', label = 'closed' },
}
M.READONLY = { icon = '≡', hl = 'ClandReadOnly', label = 'read-only' }

M.STAGE = {
  queued = { icon = '…', hl = 'ClandStageQueued', label = 'queued' },
  delivered = { icon = '✓', hl = 'ClandStageDelivered', label = 'delivered' },
  injected = { icon = '✓✓', hl = 'ClandStageInjected', label = 'injected' },
}

function M.status(t)
  return t.readonly and M.READONLY or M.STATUS[t.status]
end

-- "T-12 UI socket replay…" style label.
function M.label(t, max)
  local s = (t.item and (t.item .. ' ') or '') .. t.title
  if max and vim.fn.strdisplaywidth(s) > max then
    s = vim.fn.strcharpart(s, 0, max - 1) .. '…'
  end
  return s
end

local REF_PATTERNS = {
  { '()T%-%d+()', 'ClandItem' },
  { '()A%-%d+()', 'ClandArtifact' },
  { '()@[%w%-]+()', 'ClandMention' },
}

local function ref_marks(line, row, marks)
  for _, p in ipairs(REF_PATTERNS) do
    for s, e in line:gmatch(p[1]) do
      marks[#marks + 1] = { row, s - 1, { end_col = e - 1, hl_group = p[2] } }
    end
  end
end

local function artifact_in(line)
  return line:match('A%-%d+')
end

-- Render topic `id` into its thread buffer.
function M.render(id)
  local buf = M.bufs[id]
  if not (buf and api.nvim_buf_is_valid(buf)) then
    return
  end
  local t = state.topic(id)
  local compact = M.style == 'compact'
  local ind = compact and '  ' or '     '
  local L, marks, info = {}, {}, {}
  local function add(text, inf)
    L[#L + 1] = text
    info[#L] = inf
    return #L - 1
  end
  local function mark(row, col, opts)
    marks[#marks + 1] = { row, col, opts }
  end
  local function body(lines, m)
    for _, l in ipairs(lines) do
      local r = add(ind .. l, { msg = m, artifact = artifact_in(l) })
      ref_marks(L[r + 1], r, marks)
    end
  end
  local function header(m, extra, extra_hl)
    local role = sessions.ROLE[m.role] or sessions.ROLE.System
    local badge = ' ' .. role.badge .. ' '
    local text = badge
    local name_col
    if m.from ~= 'you' then
      text = text .. ' '
      name_col = #text
      text = text .. m.from
      if m.to and t.readonly then
        text = text .. ' → ' .. m.to
      end
      if not compact then
        text = text .. '  ' .. m.role .. (m.to_role and t.readonly and (' → ' .. m.to_role) or '')
        if m.via then
          text = text .. ' · via ' .. m.via
        end
      end
    end
    local extra_col
    if extra then
      text = text .. '  '
      extra_col = #text
      text = text .. extra
    end
    local stage = m.stage and M.STAGE[m.stage]
    local time = state.fmt(m.at)
    if compact then
      text = text .. '  ' .. time
      if stage then
        text = text .. ' ' .. stage.icon
      end
    end
    local r = add(text, { msg = m, header = true, ask = m.ask })
    mark(r, 0, { end_col = #badge, hl_group = role.hl })
    if name_col then
      mark(r, name_col, { end_col = name_col + #m.from, hl_group = role.fg })
      if not compact then
        local rc = text:find(m.role, name_col + #m.from, true)
        if rc then
          mark(r, rc - 1, { end_col = #text - (extra and (#extra + 2) or 0), hl_group = 'ClandDim' })
        end
      end
    end
    if extra_col then
      mark(r, extra_col, { end_col = extra_col + #extra, hl_group = extra_hl or 'ClandAskTitle' })
    end
    if compact then
      local tc = text:find(time, 1, true)
      mark(r, tc - 1, { end_col = #text, hl_group = stage and stage.hl or 'ClandDim' })
    else
      local vt = { { time, 'ClandDim' } }
      if stage then
        vt[#vt + 1] = { '  ' .. stage.icon .. ' ' .. stage.label, stage.hl }
      end
      mark(r, 0, { virt_text = vt, virt_text_pos = 'right_align' })
    end
    return r
  end

  for mi, m in ipairs(t.messages) do
    if m.kind == 'event' then
      local time = state.fmt(m.at)
      local text = (compact and '' or ' ') .. time .. '  ▸ ' .. m.event .. '  ' .. m.text
      local r = add(text, { msg = m })
      local c = (compact and 0 or 1)
      mark(r, c, { end_col = c + #time, hl_group = 'ClandDim' })
      local ec = c + #time + 2
      mark(r, ec, { end_col = ec + #'▸ ' + #m.event, hl_group = 'ClandEvent' })
      ref_marks(text, r, marks)
    elseif m.kind == 'system' then
      local text = ' ·  ' .. m.text
      local r = add(text, { msg = m, artifact = m.artifact })
      mark(r, 0, { end_col = #text, hl_group = 'ClandDim' })
      ref_marks(text, r, marks)
      if m.artifact then
        local a = state.S.artifacts[m.artifact]
        local r2 = add(ind .. '⏎ open ' .. m.artifact .. ' (' .. a.kind .. ', ' .. a.status .. ')', { msg = m, artifact = m.artifact })
        mark(r2, 0, { end_col = #L[r2 + 1], hl_group = 'ClandDim' })
        ref_marks(L[r2 + 1], r2, marks)
      end
      if not compact then
        mark(r, 0, { virt_text = { { state.fmt(m.at), 'ClandDim' } }, virt_text_pos = 'right_align' })
      end
    elseif m.kind == 'ask' and M.ask_style == 'float' and state.ask(m.ask).state == 'open' then
      -- variant D: the options live in the float; the thread keeps a stub
      local a = state.ask(m.ask)
      header(m, 'ASK · open', 'ClandAskTitle')
      local q = add(ind .. a.question, { msg = m, ask = a.id })
      mark(q, #ind, { end_col = #L[q + 1], hl_group = 'ClandAskQuestion' })
      local hint = ind .. '▸ ' .. #a.options .. ' options' .. (a.free and ' + your own answer' or '') .. ' in the float · <Space>a reopens it'
      local r = add(hint, { msg = m, ask = a.id })
      mark(r, 0, { end_col = #hint, hl_group = 'ClandAskTitle' })
    elseif m.kind == 'ask' then
      local a = state.ask(m.ask)
      local open = a.state == 'open'
      header(m, open and 'ASK · open' or ('ASK · ' .. a.state), open and 'ClandAskTitle' or 'ClandDim')
      local q = add(ind .. a.question, { msg = m, ask = a.id })
      mark(q, #ind, { end_col = #L[q + 1], hl_group = open and 'ClandAskQuestion' or 'Normal' })
      for i, o in ipairs(a.options) do
        local chosen = a.choice == i
        local key = chosen and '▶' or tostring(i)
        local text = ind .. ' ' .. key .. '  ' .. (compact and o.short or o.label)
        local r = add(text, { msg = m, ask = a.id, option = i })
        mark(r, #ind, { end_col = #ind + 1 + #key + 1, hl_group = open and 'ClandAskKey' or (chosen and 'ClandStageInjected' or 'ClandDim') })
        ref_marks(text, r, marks)
        if not open and not chosen then
          mark(r, #ind + 2 + #key, { end_col = #text, hl_group = 'ClandDim' })
        end
      end
      if a.free then
        local text = ind .. ' 4  ✎ ' .. (compact and 'own answer' or 'your own answer (in the composer)')
        local r = add(text, { msg = m, ask = a.id, option = 4 })
        mark(r, #ind, { end_col = #ind + 3, hl_group = open and 'ClandAskKey' or 'ClandDim' })
        mark(r, #ind + 3, { end_col = #text, hl_group = 'ClandDim' })
      end
      if open then
        local hint = ind .. (compact and '1-4 answer' or '1-4 answer here · <Space>a jumps here from anywhere')
        local r = add(hint, { msg = m, ask = a.id })
        mark(r, 0, { end_col = #hint, hl_group = 'ClandDim' })
      elseif a.answer then
        local r = add(ind .. 'answered ' .. state.fmt(a.answered_at) .. ': ' .. a.answer, { msg = m, ask = a.id })
        mark(r, 0, { end_col = #L[r + 1], hl_group = 'ClandDim' })
      end
    else
      local extra
      if m.answer_to then
        extra = '↳ answer to the ask'
      elseif m.to and m.from == 'you' and not compact then
        extra = '→ ' .. m.to
      end
      header(m, extra, 'ClandDim')
      body(m.text, m)
      for _, aid in ipairs(m.attach or {}) do
        local a = state.S.artifacts[aid]
        local text = ind .. '⎘ ' .. aid .. ' ' .. a.kind .. ' "' .. a.title .. '" (' .. a.status .. ') ⏎ open'
        local r = add(text, { msg = m, artifact = aid })
        mark(r, #ind, { end_col = #text, hl_group = 'ClandDim' })
        ref_marks(text, r, marks)
      end
    end
    -- consecutive lifecycle events stay dense; messages get a blank line
    local nxt = t.messages[mi + 1]
    if not (m.kind == 'event' and nxt and nxt.kind == 'event') then
      add('', nil)
    end
  end

  -- footer: what the topic waits on, so a missing answer is visible (#7)
  local st = M.status(t)
  local foot
  if t.readonly then
    foot = st.icon .. ' read-only: lifecycle events and agent-to-agent messages · r on a message: reply to its sender'
  elseif t.status == 'waiting for human' then
    local n = #state.open_asks(t.id)
    foot = st.icon .. ' waiting for you · ' .. n .. ' open ask' .. (n == 1 and '' or 's')
  elseif t.status == 'waiting for agent' then
    local m = state.last_human_message(t)
    if m then
      local s = m.to and state.session(m.to)
      foot = ('%s waiting for %s · your message %s %s'):format(st.icon, m.to and (s and sessions.label(s) or m.to) or 'the Coordinator',
        m.stage, state.fmt(m.at))
      if m.stage == 'delivered' and s and s.state == 'busy' then
        foot = foot .. ' (session busy: enters its next turn)'
      elseif m.stage == 'queued' and not s then
        foot = foot .. ' (no coordinator: the hub holds it)'
      elseif m.stage == 'queued' and s.state == 'stopped' then
        foot = foot .. ' (addressee offline: the hub holds it)'
      end
    else
      foot = st.icon .. ' waiting for agent'
    end
  elseif t.status == 'closed' then
    foot = st.icon .. ' closed · a new message reopens the topic (never the item)'
  else
    foot = st.icon .. ' open'
  end
  if not state.holder('Coordinator') and not t.readonly then
    foot = foot .. '   ⚠ no coordinator'
  end
  local fr = add(foot, nil)
  mark(fr, 0, { end_col = #foot, hl_group = st.hl })

  -- write, keeping the reader's place (or following the tail)
  local wins = vim.fn.win_findbuf(buf)
  local follow = {}
  for _, win in ipairs(wins) do
    local cur = api.nvim_win_get_cursor(win)[1]
    follow[win] = cur >= api.nvim_buf_line_count(buf) - 1 and 'tail' or cur
  end
  vim.bo[buf].modifiable = true
  api.nvim_buf_set_lines(buf, 0, -1, false, L)
  vim.bo[buf].modifiable = false
  api.nvim_buf_clear_namespace(buf, M.ns, 0, -1)
  for _, mk in ipairs(marks) do
    pcall(api.nvim_buf_set_extmark, buf, M.ns, mk[1], mk[2], mk[3])
  end
  -- a short thread sits at the bottom, next to the composer (chat style):
  -- blank lines on top fill the window (extmarks move with the text)
  local pad = 0
  if wins[1] then
    local ok, th = pcall(api.nvim_win_text_height, wins[1], {})
    pad = math.max(0, vim.fn.winheight(wins[1]) - (ok and th.all or #L))
  end
  if pad > 0 then
    local blanks = {}
    for i = 1, pad do
      blanks[i] = ''
    end
    vim.bo[buf].modifiable = true
    api.nvim_buf_set_lines(buf, 0, 0, false, blanks)
    vim.bo[buf].modifiable = false
    local shifted = {}
    for row, inf in pairs(info) do
      shifted[row + pad] = inf
    end
    info = shifted
  end
  M.info[buf] = info
  local total = #L + pad
  for win, f in pairs(follow) do
    if api.nvim_win_is_valid(win) then
      if f == 'tail' then
        M.to_tail(win)
      else
        pcall(api.nvim_win_set_cursor, win, { math.min(f, total), 0 })
      end
    end
  end
end

function M.render_all()
  for id in pairs(M.bufs) do
    M.render(id)
  end
end

function M.set_style(style, ask_style)
  if M.style ~= style or M.ask_style ~= ask_style then
    M.style, M.ask_style = style, ask_style or 'inline'
    M.render_all()
  end
end

-- Thread buffer of topic `id` (created on first use).
function M.thread_buf(id)
  local buf = M.bufs[id]
  if buf and api.nvim_buf_is_valid(buf) then
    return buf
  end
  buf = api.nvim_create_buf(false, true)
  vim.b[buf].cland_role = 'thread'
  vim.b[buf].cland_topic = id
  M.bufs[id] = buf
  local function map(lhs, fn, desc)
    vim.keymap.set('n', lhs, fn, { buffer = buf, nowait = true, silent = true, desc = 'cland-proto: ' .. desc })
  end
  for i = 1, 4 do
    map(tostring(i), function()
      M.answer_key(id, i)
    end, i < 4 and ('answer option ' .. i) or 'own answer')
  end
  map('<CR>', function()
    M.activate(buf)
  end, 'open the artifact / pick the option under the cursor')
  map('gf', function()
    M.activate(buf)
  end, 'open the artifact under the cursor')
  map('r', function()
    M.reply_under_cursor(buf)
  end, 'reply to the sender of the message under the cursor')
  M.render(id)
  return buf
end

-- Put the cursor of `win` on the last line (newest message), scrolled to
-- the bottom of the window (a re-render can leave a stale top line).
function M.to_tail(win)
  local buf = api.nvim_win_get_buf(win)
  -- via the first line: set_cursor scrolls minimally, so the last line
  -- lands at the bottom (no :normal from callbacks: Insert mode elsewhere)
  pcall(api.nvim_win_set_cursor, win, { 1, 0 })
  pcall(api.nvim_win_set_cursor, win, { api.nvim_buf_line_count(buf), 0 })
end

function M.find_row(buf, pred)
  for row, inf in pairs(M.info[buf] or {}) do
    if inf and pred(inf) then
      return row
    end
  end
end

function M.answer_key(id, i)
  local a = state.open_asks(id)[1]
  if not a then
    vim.notify('cland-proto: no open ask in this topic', vim.log.levels.INFO)
    return
  end
  local ask = require('cland_proto.ask')
  if i <= #a.options then
    ask.answer(a.id, i)
  else
    ask.start_free(a.id)
  end
end

function M.activate(buf)
  local row = api.nvim_win_get_cursor(0)[1]
  local inf = (M.info[buf] or {})[row]
  if not inf then
    return
  end
  if inf.artifact then
    require('cland_proto.artifacts').open(inf.artifact)
  elseif inf.option and inf.ask then
    local a = state.ask(inf.ask)
    if a.state == 'open' then
      if inf.option <= #a.options then
        require('cland_proto.ask').answer(a.id, inf.option)
      else
        require('cland_proto.ask').start_free(a.id)
      end
    end
  elseif inf.msg and vim.b[buf].cland_topic == 'agents' then
    M.reply_under_cursor(buf)
  end
end

function M.reply_under_cursor(buf)
  local row = api.nvim_win_get_cursor(0)[1]
  local inf = (M.info[buf] or {})[row]
  local m = inf and inf.msg
  if not (m and m.from and m.from ~= 'you' and state.session(m.from)) then
    vim.notify('cland-proto: no agent message under the cursor', vim.log.levels.INFO)
    return
  end
  if vim.b[buf].cland_topic == 'agents' then
    M.reply_to = m.from
  end
  require('cland_proto.app').focus_composer(vim.b[buf].cland_topic, vim.b[buf].cland_topic ~= 'agents' and ('@' .. m.from .. ' ') or nil)
end

-- Composer -------------------------------------------------------------------

function M.composer(id)
  local buf = M.composers[id]
  if buf and api.nvim_buf_is_valid(buf) then
    return buf
  end
  buf = api.nvim_create_buf(false, true)
  vim.bo[buf].buftype = 'prompt'
  vim.b[buf].cland_role = 'composer'
  vim.b[buf].cland_topic = id
  local t = state.topic(id)
  vim.fn.prompt_setprompt(buf, t.readonly and 'reply › ' or '› ')
  vim.fn.prompt_setcallback(buf, function(text)
    M.on_submit(id, buf, text)
  end)
  -- Shift+Enter adds a line natively in 0.12 prompt buffers; Alt+Enter is the
  -- same for terminals that cannot send a distinct Shift+Enter.
  vim.keymap.set('i', '<M-CR>', function()
    api.nvim_feedkeys(api.nvim_replace_termcodes('<S-CR>', true, false, true), 'n', false)
  end, { buffer = buf, desc = 'cland-proto: newline' })
  vim.keymap.set({ 'n', 'i' }, '<C-c>', function()
    if M.answering[id] then
      M.answering[id] = nil
      state.changed('free answer cancelled')
    end
    vim.cmd.stopinsert()
  end, { buffer = buf, desc = 'cland-proto: cancel the free answer' })
  M.composers[id] = buf
  return buf
end

-- Who a message in topic `t` goes to (#7): @session, @role, else the Coordinator.
local ROLE_MENTION = { coordinator = 'Coordinator', implementer = 'Implementer', reviewer = 'Reviewer', qa = 'QA' }
function M.addressee(t, text)
  if t.readonly then
    if M.reply_to then
      return M.reply_to
    end
    for i = #t.messages, 1, -1 do
      local m = t.messages[i]
      if m.kind == 'text' and m.from ~= 'you' then
        return m.from
      end
    end
  end
  for word in text:gmatch('@([%w%-]+)') do
    local s = state.session(word)
    if s then
      return s.name
    end
    local role = ROLE_MENTION[word:lower()]
    local h = role and state.holder(role)
    if h then
      return h.name
    end
  end
  local h = state.holder('Coordinator')
  return h and h.name or nil
end

function M.on_submit(id, buf, text)
  vim.schedule(function()
    -- keep only the fresh prompt line in the composer
    if api.nvim_buf_is_valid(buf) then
      local n = api.nvim_buf_line_count(buf)
      if n > 1 then
        api.nvim_buf_set_lines(buf, 0, n - 1, false, {})
      end
    end
  end)
  if not text or vim.trim(text) == '' then
    return
  end
  local a = M.answering[id]
  if a then
    M.answering[id] = nil
    require('cland_proto.ask').answer_free(a, text)
    return
  end
  M.send(id, text)
end

function M.recompute(t, why)
  if t.readonly then
    return
  end
  if #state.open_asks(t.id) > 0 then
    t.status = 'waiting for human'
  elseif why == 'sent' then
    t.status = 'waiting for agent'
  elseif why == 'replied' then
    t.status = 'open'
  end
end

function M.canned(s, t, m)
  local first = vim.trim(m.text[1] or '')
  if vim.fn.strchars(first) > 36 then
    first = vim.fn.strcharpart(first, 0, 35) .. '…'
  end
  local item = t.item and (' for ' .. t.item) or ''
  local by_role = {
    Coordinator = { ('Got it ("%s"). I will fold that into the plan%s and answer here.'):format(first, item) },
    Implementer = { ('On it ("%s"). I will push to the task branch and post here when the tests pass.'):format(first) },
    Reviewer = { ('Noted ("%s"); it goes into my next review round.'):format(first) },
    QA = { ('Queued for the next QA run ("%s").'):format(first) },
  }
  return by_role[s.role] or { 'Noted.' }
end

-- Send `text` from the human into topic `id`. opts: to, kind, answer_to, reply.
function M.send(id, text, opts)
  opts = opts or {}
  local t = state.topic(id)
  local m = {
    kind = 'text', from = 'you', role = 'Human', at = state.now_min(),
    to = opts.to or M.addressee(t, text), text = vim.split(text, '\n', { plain = true }),
    stage = 'queued', answer_to = opts.answer_to,
  }
  if t.status == 'closed' then
    t.messages[#t.messages + 1] = { kind = 'system', at = m.at,
      text = 'topic reopened by a new message' .. (t.item and (' (' .. t.item .. ' stays closed)') or '') }
  end
  t.messages[#t.messages + 1] = m
  t.unread = 0
  state.S.last_sent, state.S.last_sent_topic = m, id
  M.recompute(t, 'sent')
  state.changed(('you → %s in "%s" (queued)'):format(m.to or 'Coordinator (vacant)', t.title))
  M.deliver(t, m, opts.reply)
  return m
end

-- Advance the stages of message `m` and post the canned reply.
function M.deliver(t, m, reply)
  local s = m.to and state.session(m.to)
  if not s or s.state == 'stopped' then
    return -- stays queued until the addressee is back (store-and-forward)
  end
  vim.defer_fn(function()
    m.stage = 'delivered'
    state.changed('stage delivered → ' .. s.name)
  end, 300)
  vim.defer_fn(function()
    m.stage = 'injected'
    if not s.prev_state then
      s.prev_state = s.state
    end
    s.state, s.since = 'busy', state.now_min()
    state.changed('stage injected → ' .. s.name)
  end, 650)
  vim.defer_fn(function()
    t.messages[#t.messages + 1] = {
      kind = 'text', from = s.name, role = s.role, at = state.now_min(), text = reply or M.canned(s, t, m),
    }
    s.state, s.prev_state = s.prev_state or 'idle', nil
    M.recompute(t, 'replied')
    if state.S.current_topic ~= t.id then
      t.unread = (t.unread or 0) + 1
    end
    state.changed(s.name .. ' replied in "' .. t.title .. '"')
  end, 1000)
end

-- The human looks at topic `id`: it becomes current and its unread count clears.
function M.view(id)
  local t = state.topic(id)
  if not t then
    return
  end
  state.S.current_topic = id
  if (t.unread or 0) > 0 then
    t.unread = 0
  end
  state.changed()
end

return M
