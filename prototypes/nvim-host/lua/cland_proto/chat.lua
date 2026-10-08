-- PROTOTYPE (ticket #15, workbench): topic threads and composers, grown from
-- the chat-screen prototype. One thread buffer and one composer (a prompt
-- buffer) per topic. A message shows sender, role and time; the human's
-- messages carry the delivery stage (#13): ⌁ queued, ✓ delivered, ✓✓
-- injected. Asks are cards with numbered options and a free answer; shared
-- artifacts are chips. Sending is fake: queued -> delivered -> injected,
-- then a canned reply after one second.
local api = vim.api
local state = require('cland_proto.state')
local sessions = require('cland_proto.sessions')
local hl = require('cland_proto.hl')
local D = require('cland_proto.draw')

local M = {
  bufs = {}, -- topic id -> thread buffer
  composers = {}, -- topic id -> prompt buffer
  info = {}, -- thread buffer -> { [row] = info }
  answering = {}, -- topic id -> ask id (the composer sends a free answer)
  reply_to = nil, -- Agents topic: session the next reply goes to
  ns = api.nvim_create_namespace('cland_proto_chat'),
  ns_ph = api.nvim_create_namespace('cland_proto_placeholder'),
}

M.STATUS = {
  open = { '●', 'ClandTeal', 'topic open' },
  ['waiting for human'] = { '●', 'ClandAmber', 'waiting for you' },
  ['waiting for agent'] = { '◐', 'ClandTeal', 'waiting for agent' },
  closed = { '○', 'ClandDim', 'closed' },
}
M.READONLY = { '≡', 'ClandDim', 'read-only log' }

function M.status(t)
  return t.readonly and M.READONLY or M.STATUS[t.status] or M.STATUS.open
end

function M.label(t)
  return (t.item and (t.item .. ' ') or '') .. t.title
end

local REFS = {
  { '()[TEMQ]%-%d+()', 'ClandBlue' },
  { '()A%-%d+()', 'ClandBlue' },
  { '()@[%w%-]+()', 'ClandTeal' },
}

local function ref_marks(c, row, line)
  for _, p in ipairs(REFS) do
    for s, e in line:gmatch(p[1]) do
      c:mark(row, s - 1, { end_col = e - 1, hl_group = p[2], priority = 210 })
    end
  end
end

-- An ask as a card (thread and inbox share it). opts: indent, width, head
-- (chunks), foot (chunks), sel (blue border), short (inbox wording).
function M.card(c, a, opts)
  local ind = (' '):rep(opts.indent or 1)
  local width = opts.width
  local inner = width - 4
  local open = a.state == 'open'
  local border = opts.sel and 'ClandCardLineSel' or 'ClandCardLine'
  local function line(chunks, info)
    local fit, w = D.fit(chunks, inner)
    local row_chunks = { { ind }, { '│ ', border } }
    vim.list_extend(row_chunks, fit)
    row_chunks[#row_chunks + 1] = { (' '):rep(inner - w), 'ClandCard' }
    row_chunks[#row_chunks + 1] = { ' │', border }
    local r = c:add(row_chunks, nil, { info = info })
    c:mark(r - 1, #ind, { end_col = #c.lines[r], hl_group = 'ClandCard', priority = 100 })
    return r
  end
  local base = { ask = a.id }
  c:add({ { ind }, { '╭' .. ('─'):rep(width - 2) .. '╮', border } }, nil, { info = base })
  line(opts.head, base)
  local q = opts.short and a.question:gsub(' when the recorded name and the harness session id disagree', '') or a.question
  for _, l in ipairs(D.wrap(q, inner)) do
    line({ { l, open and 'ClandBold' or 'ClandDim' } }, base)
  end
  for i, o in ipairs(a.options) do
    local chosen = a.choice == i
    local key = { ' ' .. i .. ' ', open and 'ClandCardKey' or (chosen and 'ClandCardGreen' or 'ClandCardDim') }
    local text = { ' ' .. o, open and 'ClandText' or (chosen and 'ClandGreen' or 'ClandDim') }
    line({ key, text, chosen and { '  ✓ your answer', 'ClandGreen' } or nil }, { ask = a.id, option = i })
  end
  if not open and a.answer and not a.choice then
    for _, l in ipairs(D.wrap('your answer: ' .. a.answer, inner)) do
      line({ { l, 'ClandGreen' } }, base)
    end
  end
  if opts.foot then
    line(opts.foot, { ask = a.id, free = true })
  end
  c:add({ { ind }, { '╰' .. ('─'):rep(width - 2) .. '╯', border } }, nil, { info = base })
end

local function chip(id)
  local a = state.artifact(id)
  if not a then
    return { { ' ' .. id .. ' ', 'ClandChipId' } }
  end
  return { { ' ' .. id .. ' ', 'ClandChipId' }, { a.kind .. ' · ' .. a.title .. ' ', 'ClandChip' } }
end

local function window_of(buf)
  local cur = api.nvim_get_current_win()
  if api.nvim_win_get_buf(cur) == buf then
    return cur
  end
  return vim.fn.win_findbuf(buf)[1]
end

-- Render topic `id` into its thread buffer.
function M.render(id)
  local buf = M.bufs[id]
  if not (buf and api.nvim_buf_is_valid(buf)) then
    return
  end
  local t = state.topic(id)
  local win = window_of(buf)
  local W = win and api.nvim_win_get_width(win) or 100
  local c = D.canvas(W)
  local last_agent
  for i = #t.messages, 1, -1 do
    local m = t.messages[i]
    if m.from and m.from ~= 'you' and (m.kind == 'text' or m.kind == 'ask') then
      last_agent = m
      break
    end
  end

  local function header(m, mine)
    local left = { { ' ' } }
    if mine then
      left[#left + 1] = { 'you', 'ClandBold' }
    else
      left[#left + 1] = { m.from, 'ClandBold' }
      if m.role then
        left[#left + 1] = { '  ' .. m.role, 'ClandTeal' }
      end
    end
    left[#left + 1] = { '  ' .. state.fmt(m.at), 'ClandDim' }
    if t.readonly and m.to then
      left[#left + 1] = { '  → ' .. m.to .. (m.to_role and (' ' .. m.to_role) or '') .. (m.via and (' · via ' .. m.via) or ''), 'ClandDim' }
    elseif mine and m.to then
      local s = state.session(m.to)
      if not (s and s.role == 'Coordinator') then
        left[#left + 1] = { '  → ' .. m.to, 'ClandDim' }
      end
    end
    if m.answer_to then
      left[#left + 1] = { '  answer to the ask', 'ClandDim' }
    end
    local r = c:add(left, nil, { nofit = true, info = { msg = m, header = true, ask = m.ask }, line_hl = mine and 'ClandMine' or nil })
    local vt
    if mine and m.stage then
      local st = hl.STAGE[m.stage]
      vt = { { st[1] .. ' ' .. st[3] .. ' ', st[2] } }
    elseif m.kind == 'ask' and state.ask(m.ask).state == 'open' then
      vt = { { '▲ waiting for you ', 'ClandAmber' } }
    elseif m == last_agent then
      local s = state.session(m.from)
      if s and s.state == 'busy' then
        vt = { { '● busy' .. (s.status_line and (' · ' .. s.status_line) or '') .. ' ', 'ClandTeal' } }
      end
    end
    if vt then
      c:mark(r - 1, 0, { virt_text = vt, virt_text_pos = 'right_align' })
    end
    return r
  end

  local function body(lines, m, mine)
    for _, l in ipairs(lines) do
      local r = c:add({ { ' ' .. l } }, nil, { nofit = true, info = { msg = m }, line_hl = mine and 'ClandMine' or nil })
      ref_marks(c, r - 1, c.lines[r])
    end
  end

  for mi, m in ipairs(t.messages) do
    local mine = m.from == 'you'
    if m.kind == 'event' then
      local left = { { ' ' .. state.fmt(m.at), 'ClandDim' }, { '  ▸ ' .. m.event, 'ClandPurple' }, { '  ' .. m.text } }
      local r = c:add(left, nil, { nofit = true, info = { msg = m } })
      ref_marks(c, r - 1, c.lines[r])
    elseif m.kind == 'system' and m.artifact then
      header(m, false)
      local left = { { ' ' .. (m.text or 'shared') .. ' ' } }
      vim.list_extend(left, chip(m.artifact))
      left[#left + 1] = { '  · ↵ opens, gb opens in browser', 'ClandDim' }
      c:add(left, nil, { nofit = true, info = { msg = m, artifact = m.artifact } })
    elseif m.kind == 'system' then
      local r = c:add({ { ' · ' .. m.text, 'ClandDim' } }, nil, { nofit = true, info = { msg = m } })
      c:mark(r - 1, 0, { virt_text = { { state.fmt(m.at) .. ' ', 'ClandDim' } }, virt_text_pos = 'right_align' })
      ref_marks(c, r - 1, c.lines[r])
    elseif m.kind == 'ask' then
      local a = state.ask(m.ask)
      header(m, false)
      local open = a.state == 'open'
      local head = { { 'ask', 'ClandCardAmber' }, { ' · from ' .. a.from .. (a.raised_by and (', raised by ' .. a.raised_by) or ''), 'ClandCardDim' } }
      if not open then
        head = { { '✓ answered ' .. state.fmt(a.answered_at), 'ClandCardGreen' }, { ' · ask from ' .. a.from, 'ClandCardDim' } }
      end
      local foot = open and { { 'or type a free answer below · ', 'ClandCardDim' }, { ' i ', 'ClandCardKey' } } or nil
      M.card(c, a, { indent = 1, width = math.min(W - 3, 80), head = head, foot = foot })
    else
      header(m, mine)
      body(m.text, m, mine)
      for _, aid in ipairs(m.attach or {}) do
        local left = { { ' attached ', 'ClandDim' } }
        vim.list_extend(left, chip(aid))
        c:add(left, nil, { nofit = true, info = { msg = m, artifact = aid }, line_hl = mine and 'ClandMine' or nil })
      end
    end
    local nxt = t.messages[mi + 1]
    if not (m.kind == 'event' and nxt and nxt.kind == 'event') then
      c:blank(nil)
    end
  end

  -- footer: what the topic waits on, so a missing answer is visible (#7)
  local st = M.status(t)
  local foot, fhl = nil, st[2]
  if t.readonly then
    foot = '≡ read-only log: lifecycle events and agent-to-agent messages · r on a message replies to its sender'
    fhl = 'ClandDim'
  elseif t.status == 'waiting for human' then
    local n = #state.open_asks({ topic = t.id })
    foot = n > 0 and ('▲ waiting for you · ' .. n .. ' open ask' .. (n == 1 and '' or 's') .. ' · 1-' .. #state.open_asks({ topic = t.id })[1].options .. ' answer · i free answer')
      or '▲ waiting for you · the Coordinator asked in prose'
    fhl = 'ClandAmber'
  elseif t.status == 'waiting for agent' then
    local m = state.last_human_message(t)
    local s = m and m.to and state.session(m.to)
    if m then
      local stg = hl.STAGE[m.stage]
      foot = ('◐ waiting for %s · your message %s %s %s'):format(s and s.name or 'the Coordinator', stg[1], m.stage, state.fmt(m.at))
      if m.stage == 'delivered' and s and s.state == 'busy' then
        foot = foot .. ' (session busy: enters its next turn)'
      elseif m.stage == 'queued' then
        foot = foot .. ' (addressee offline: the hub holds it)'
      end
    else
      foot = '◐ waiting for agent'
    end
  elseif t.status == 'closed' then
    foot = '○ closed · a new message reopens the topic (never the item)'
    fhl = 'ClandDim'
  else
    foot = '○ open · messages go to the Coordinator unless you @mention a role or a session'
    fhl = 'ClandDim'
  end
  if not state.holder('Coordinator') and not t.readonly then
    foot = foot .. '   ⚠ no coordinator: messages to the role stay queued'
  end
  c:add({ { ' ' .. foot, fhl } }, nil, { nofit = true })

  -- write, keeping the reader's place (or following the tail)
  local wins = vim.fn.win_findbuf(buf)
  local follow = {}
  for _, w in ipairs(wins) do
    local cur = api.nvim_win_get_cursor(w)[1]
    follow[w] = cur >= api.nvim_buf_line_count(buf) - 1 and 'tail' or cur
  end
  local info = c:apply(buf, M.ns)
  -- a short thread sits at the bottom, next to the composer (chat style)
  local pad = 0
  if wins[1] then
    local ok, th = pcall(api.nvim_win_text_height, wins[1], {})
    pad = math.max(0, vim.fn.winheight(wins[1]) - (ok and th.all or #c.lines))
  end
  if pad > 0 then
    local blanks = {}
    for i = 1, pad do
      blanks[i] = ''
    end
    vim.bo[buf].modifiable = true
    api.nvim_buf_set_lines(buf, 0, 0, false, blanks)
    vim.bo[buf].modifiable = false
    vim.bo[buf].modified = false
    local shifted = {}
    for row, inf in pairs(info) do
      shifted[row + pad] = inf
    end
    info = shifted
  end
  M.info[buf] = info
  local total = #c.lines + pad
  for w, f in pairs(follow) do
    if api.nvim_win_is_valid(w) then
      if f == 'tail' then
        M.to_tail(w)
      else
        pcall(api.nvim_win_set_cursor, w, { math.min(f, total), 0 })
      end
    end
  end
end

function M.render_all()
  for id in pairs(M.bufs) do
    M.render(id)
  end
  for id, buf in pairs(M.composers) do
    M.placeholder(id, buf)
  end
end

-- Put the cursor of `win` on the last line, scrolled to the bottom. The
-- chat-screen workaround for a stale top line after a re-render: go via the
-- first line (set_cursor scrolls minimally), and never :normal from a
-- callback (it would act in Insert mode elsewhere).
function M.to_tail(win)
  local buf = api.nvim_win_get_buf(win)
  pcall(api.nvim_win_set_cursor, win, { 1, 0 })
  pcall(api.nvim_win_set_cursor, win, { api.nvim_buf_line_count(buf), 0 })
end

function M.find_row(buf, pred)
  local best
  for row, inf in pairs(M.info[buf] or {}) do
    if inf and pred(inf) and (not best or row < best) then
      best = row
    end
  end
  return best
end

function M.row_info(buf, row)
  return (M.info[buf] or {})[row or api.nvim_win_get_cursor(0)[1]]
end

-- The ask a key acts on: the one under the cursor, else the topic's oldest.
local function target_ask(id)
  local inf = M.row_info(api.nvim_get_current_buf())
  if inf and inf.ask then
    local a = state.ask(inf.ask)
    if a and a.state == 'open' then
      return a
    end
  end
  return state.open_asks({ topic = id })[1]
end

function M.thread_buf(id)
  local buf = M.bufs[id]
  if buf and api.nvim_buf_is_valid(buf) then
    return buf
  end
  buf = D.scratch('thread', 'topic/' .. id)
  vim.b[buf].cland_topic = id
  M.bufs[id] = buf
  local function map(lhs, fn, desc)
    vim.keymap.set('n', lhs, fn, { buffer = buf, nowait = true, silent = true, desc = 'cland-proto: ' .. desc })
  end
  for i = 1, 9 do
    map(tostring(i), function()
      local a = target_ask(id)
      if not a then
        vim.notify('cland-proto: no open ask in this topic', vim.log.levels.INFO)
      elseif i <= #a.options then
        require('cland_proto.ask').answer(a.id, i)
      end
    end, 'answer option ' .. i)
  end
  for _, k in ipairs({ 'i', 'a', 'o', 'I', 'A', 'O' }) do
    map(k, function()
      local inf = M.row_info(buf)
      local a = inf and inf.ask and state.ask(inf.ask)
      if a and a.state == 'open' then
        require('cland_proto.ask').start_free(a.id)
      else
        require('cland_proto.layout').focus_composer(id, nil, true)
      end
    end, 'type in the composer (free answer on an ask card)')
  end
  map('<CR>', function()
    M.activate(buf)
  end, 'open what is under the cursor')
  map('gb', function()
    local inf = M.row_info(buf)
    require('cland_proto.artifacts').browser(inf and inf.artifact)
  end, 'open the artifact in the browser')
  map('r', function()
    M.reply_under_cursor(buf)
  end, 'reply to the sender of the message under the cursor')
  M.render(id)
  return buf
end

function M.activate(buf)
  local inf = M.row_info(buf)
  if inf and inf.artifact then
    require('cland_proto.artifacts').open(inf.artifact)
  elseif inf and inf.option and inf.ask then
    local a = state.ask(inf.ask)
    if a.state == 'open' then
      require('cland_proto.ask').answer(a.id, inf.option)
    end
  elseif inf and inf.free and inf.ask then
    require('cland_proto.ask').start_free(inf.ask)
  elseif not require('cland_proto.motions').open_token() then
    if inf and inf.msg and vim.b[buf].cland_topic == 'agents' then
      M.reply_under_cursor(buf)
    end
  end
end

function M.reply_under_cursor(buf)
  local inf = M.row_info(buf)
  local m = inf and inf.msg
  if not (m and m.from and m.from ~= 'you' and state.session(m.from)) then
    vim.notify('cland-proto: no agent message under the cursor', vim.log.levels.INFO)
    return
  end
  local id = vim.b[buf].cland_topic
  if id == 'agents' then
    M.reply_to = m.from
    state.changed('reply in Agents goes to ' .. m.from)
  end
  require('cland_proto.layout').focus_composer(id, id ~= 'agents' and ('@' .. m.from .. ' ') or nil, true)
end

-- Composer ---------------------------------------------------------------

function M.placeholder(id, buf)
  if not api.nvim_buf_is_valid(buf) then
    return
  end
  api.nvim_buf_clear_namespace(buf, M.ns_ph, 0, -1)
  local lines = api.nvim_buf_get_lines(buf, 0, -1, false)
  local prompt = vim.fn.prompt_getprompt(buf)
  if #lines ~= 1 or lines[1] ~= prompt then
    return
  end
  local t = state.topic(id)
  local text
  if M.answering[id] then
    text = 'your own answer to the ask…  (Enter sends · C-c cancels)'
  elseif t.readonly then
    text = 'reply to ' .. (M.addressee(t, '') or 'the sender') .. '…  (r on a message picks another sender)'
  elseif #state.open_asks({ topic = id }) > 0 then
    text = '@coordinator  Answer or message ' .. (t.item or t.title) .. '…  (1-3 on the card picks an option)'
  else
    text = '@coordinator  Message ' .. (t.item or t.title) .. '…  (Enter sends, S-Enter newline, @ mentions, ␣a attach artifact)'
  end
  pcall(api.nvim_buf_set_extmark, buf, M.ns_ph, 0, #prompt, { virt_text = { { text, 'ClandFaint' } }, virt_text_pos = 'inline' })
end

function M.composer(id)
  local buf = M.composers[id]
  if buf and api.nvim_buf_is_valid(buf) then
    return buf
  end
  buf = api.nvim_create_buf(false, true)
  vim.bo[buf].buftype = 'prompt'
  vim.bo[buf].bufhidden = 'hide'
  vim.b[buf].cland_role = 'composer'
  vim.b[buf].cland_topic = id
  local t = state.topic(id)
  vim.fn.prompt_setprompt(buf, t.readonly and 'reply › ' or '› ')
  vim.fn.prompt_setcallback(buf, function(text)
    M.on_submit(id, buf, text)
  end)
  -- Shift+Enter adds a line natively in 0.12 prompt buffers; Alt+Enter does
  -- the same for terminals that cannot send a distinct Shift+Enter.
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
  api.nvim_create_autocmd({ 'TextChanged', 'TextChangedI', 'InsertEnter', 'InsertLeave' }, {
    buffer = buf,
    callback = function()
      M.placeholder(id, buf)
    end,
  })
  M.composers[id] = buf
  M.placeholder(id, buf)
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
  for word in (text or ''):gmatch('@([%w%-]+)') do
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
    if api.nvim_buf_is_valid(buf) then
      local n = api.nvim_buf_line_count(buf)
      if n > 1 then
        api.nvim_buf_set_lines(buf, 0, n - 1, false, {})
      end
      M.placeholder(id, buf)
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
  if #state.open_asks({ topic = t.id }) > 0 then
    t.status = 'waiting for human'
  elseif why == 'sent' then
    t.status = 'waiting for agent'
  elseif why == 'replied' then
    t.status = 'open'
  end
end

function M.canned(s, t, m)
  local first = vim.trim(m.text[1] or '')
  if vim.fn.strchars(first) > 40 then
    first = vim.fn.strcharpart(first, 0, 39) .. '…'
  end
  local where = t.item and (' for ' .. t.item) or ''
  local by_role = {
    Coordinator = { ('Got it ("%s"). I will fold that into the plan%s and report here.'):format(first, where) },
    Implementer = { ('On it ("%s"). I will push to the task branch and post here when the tests pass.'):format(first) },
    Reviewer = { ('Noted ("%s"); it goes into my next review round.'):format(first) },
    QA = { ('Queued for the next QA run ("%s").'):format(first) },
  }
  return by_role[s.role] or { 'Noted.' }
end

-- Send `text` from the human into topic `id`. opts: to, answer_to, reply.
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
  M.recompute(t, 'sent')
  state.changed(('you → %s in "%s" (queued)'):format(m.to or 'Coordinator (vacant)', t.title))
  M.deliver(t, m, opts.reply)
  return m
end

-- Advance the stages of message `m` and post the canned reply.
function M.deliver(t, m, reply)
  local s = m.to and state.session(m.to)
  if not s or not state.live(s) then
    return -- stays queued until the addressee is back (store-and-forward)
  end
  vim.defer_fn(function()
    m.stage = 'delivered'
    state.changed('stage delivered → ' .. s.name)
  end, 300)
  vim.defer_fn(function()
    m.stage = 'injected'
    if not s.prev_state and s.state ~= 'busy' then
      s.prev_state = s.state
    end
    if s.state ~= 'waiting for approval' then
      s.state, s.since = 'busy', state.now_min()
    end
    state.changed('stage injected → ' .. s.name)
  end, 650)
  vim.defer_fn(function()
    t.messages[#t.messages + 1] = {
      kind = 'text', from = s.name, role = s.role, at = state.now_min(), text = reply or M.canned(s, t, m),
    }
    if s.prev_state then
      s.state, s.prev_state, s.since = s.prev_state, nil, state.now_min()
    end
    M.recompute(t, 'replied')
    local v = state.S.ui.view
    if not (v.kind == 'thread' and v.id == t.id) then
      t.unread = (t.unread or 0) + 1
    end
    state.changed(s.name .. ' replied in "' .. t.title .. '"')
  end, 1000)
end

-- The human opened topic `id`: its unread count clears.
function M.read(id)
  local t = state.topic(id)
  if t and (t.unread or 0) > 0 then
    t.unread = 0
    state.changed()
  end
end

return M
