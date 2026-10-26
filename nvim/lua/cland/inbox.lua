-- The four now sections (§3.7), shared by the panel and full-width inbox.
local api = vim.api
local state = require('cland.state')
local visibility = require('cland.visibility')
local provenance = require('cland.provenance')
local ask_card = require('cland.ask_card')

local M = {}
-- Time and scheduling travel together, so aging can use a deterministic local clock.
local local_clock = { now = function() return os.time() * 1000 end, new_timer = function() return (vim.uv or vim.loop).new_timer() end }

local function clock(ts)
  return require('cland.thread').clock(ts)
end

local function section(c, name, count, extra, amber)
  c:add({ { ' ' .. name:upper() .. (extra or ''), amber and 'ClandAmber' or 'ClandSection' } }, { { tostring(count) .. ' ', amber and 'ClandAmber' or 'ClandDim' } })
end

M.selected, M.expanded = {}, {}
-- Completed rows stay folded for this inbox visit; the hub still owns the count.
local completed, sending, noting = {}, {}, {}
local choices = { once = '1 approve once', always = '2 always for this command', deny = 'd deny with optional note' }
local function outcome_label(outcome)
  local choice = ({ once = 'approved once', always = 'approved always', deny = 'denied', withdrawn = 'withdrawn' })[outcome.choice] or outcome.choice
  return choice .. ' by ' .. (outcome.by == 'human' and 'the human' or outcome.by)
end
local function outcome_text(outcome)
  return outcome_label(outcome) .. ' ' .. (provenance.remote(outcome.via) or ('via ' .. outcome.via)) .. ' at ' .. outcome.at
end

function M.approval_changed(record)
  if type(record) ~= 'table' then return end
  if record.state == 'closed' then
    local role = vim.b.cland_role
    if role == 'inbox' or role == 'inbox_full' then completed[record.id] = record
    else
      for i, r in ipairs(state.S.inbox.approvals) do if r.id == record.id then table.remove(state.S.inbox.approvals, i); break end end
      state.changed()
      return
    end
  end
  for i, r in ipairs(state.S.inbox.approvals) do
    if r.id == record.id then state.S.inbox.approvals[i] = record; state.changed(); return end
  end
  if record.state ~= 'closed' then table.insert(state.S.inbox.approvals, record) end
  state.changed()
end

function M.approvals(rows)
  local out, seen = {}, {}
  for _, r in ipairs(rows or {}) do
    out[#out + 1] = completed[r.id] or r
    seen[r.id] = true
  end
  for id, r in pairs(completed) do if not seen[id] then out[#out + 1] = r end end
  return out
end
local hl = require('cland.hl')
local function since(r) return r.since or r.ts end
local function first_line(s) return tostring(s or ''):match('[^\r\n]*') end
function M.age(ts)
  local at = require('cland.thread').epoch(ts)
  if not at then return '?' end
  local m = math.max(0, math.floor((local_clock.now() / 1000 - at) / 60))
  if m < 60 then return m .. ' m' end
  if m < 1440 then return math.floor(m / 60) .. ' h ' .. m % 60 .. ' m' end
  return math.floor(m / 1440) .. ' d ' .. math.floor(m % 1440 / 60) .. ' h'
end

local function now_rows(list, kind)
  local out = {}
  for _, r in ipairs(list or {}) do
    if (visibility.layer(r) or 'now') == 'now' then out[#out + 1] = { kind = kind, value = r } end
  end
  return out
end

-- Detail and fold text must remain readable in a narrow panel, including long single-line commands.
local function wrapped(text, width)
  local out = {}
  for _, line in ipairs(ask_card.split(text)) do
    repeat
      local count, used = 0, 0
      for i = 0, vim.fn.strchars(line) - 1 do
        local ch = vim.fn.strcharpart(line, i, 1)
        local w = api.nvim_strwidth(ch)
        if used + w > width then break end
        used, count = used + w, count + 1
      end
      count = math.max(1, count)
      out[#out + 1] = vim.fn.strcharpart(line, 0, count)
      line = vim.fn.strcharpart(line, count)
    until line == ''
  end
  return out
end

local function render_row(c, entry, selected)
  local r, kind = entry.value, entry.kind
  local info = { inbox_key = kind .. ':' .. r.id }
  local left = {}
  if kind == 'ask' then
    info.ask = { id = r.id, topic = r.topic and r.topic.id, question = r.question, options = r.options or {}, free = r.free }
    info.topic, info.session = info.ask.topic, r.from
    local where = r.topic and (r.topic.item ~= vim.NIL and r.topic.item or r.topic.title) or ''
    left = { { ' ? ', 'ClandAmber' }, { where .. ' ', 'ClandBlue' }, { first_line(r.question), 'ClandBold' } }
  elseif kind == 'approval' then
    info.approval, info.session = r, r.session
    if r.state == 'closed' and type(r.outcome) == 'table' then
      info.text = outcome_text(r.outcome)
      local summary = outcome_label(r.outcome)
      local source = provenance.remote(r.outcome.via)
      if source then summary = summary .. ' ' .. source end
      local where_when = c.width >= 90 and ((source and '' or r.outcome.via .. ' · ') .. r.outcome.at) or clock(r.outcome.at)
      c:add({ { ' ✓ ' .. summary, 'ClandDim' } }, { { where_when .. ' ', 'ClandDim' } }, info)
      return
    end
    local subject = type(r.subject) == 'table' and r.subject or {}
    left = { { ' ▲ ', 'ClandAmber' }, { r.session .. ' ', 'ClandBold' }, { first_line(r.command or subject.change or 'waiting for approval') } }
  elseif kind == 'plan' then
    info.plan, info.item = true, r.id
    left = { { ' ▲ ', 'ClandAmber' }, { r.id .. ' ', 'ClandBlue' }, { r.title .. ' · ' .. (r.stages or '?') .. ' stages · ' .. (r.lanes or '?') .. ' lanes · ' .. (r.items or '?') .. ' items' } }
  else
    info.inbox_kind, info.message, info.text = kind, r.id, first_line(r.text)
    info.topic, info.item, info.session = r.topic and r.topic.id, r.subject, r.from
    local glyph = kind == 'message' and '●' or ({ review = '✓', qa = '◇', handover = '⇄' })[r.request] or '·'
    local where = kind == 'request' and r.subject or (r.topic and (r.topic.item ~= vim.NIL and r.topic.item or r.topic.title) or r.title)
    left = { { ' ' .. glyph .. ' ', 'ClandAmber' }, { tostring(where or '') .. ' ', 'ClandBlue' }, { (kind == 'request' and r.request .. ' · ' or '') .. first_line(r.text) } }
  end
  local right = {}
  local sender = r.from or (kind == 'approval' and r.session) or r.label
  if sender then right[#right + 1] = { sender .. ' · ', hl.role_group('agent', r.fromRole or r.role) } end
  right[#right + 1] = { M.age(since(r)) .. ' ', 'ClandDim' }
  c:add(left, right, info)
  if selected ~= info.inbox_key then return end
  local detail_index = 0
  local function detail(chunks, option)
    detail_index = detail_index + 1
    c:add(chunks, nil, vim.tbl_extend('force', info, { detail = true, inbox_detail = detail_index, option = option }))
  end
  if kind == 'ask' then
    for _, line in ipairs(wrapped(r.question, c.width - 4)) do detail({ { '   ' .. line, 'ClandBold' } }) end
    for i, option in ipairs(r.options or {}) do
      for k, line in ipairs(wrapped(option, c.width - 8)) do
        detail({ { '   ' }, { k == 1 and (' ' .. i .. ' ') or '   ', 'ClandBadgeN' }, { ' ' .. line } }, i)
      end
    end
    detail({ { '   ' .. (r.free ~= false and 'i free answer · ' or '') .. '↵ open the topic', 'ClandFaint' } })
  elseif kind == 'approval' then
    local subject = type(r.subject) == 'table' and r.subject or {}
    for _, text in ipairs({ r.command or subject.command or subject.change or 'waiting for approval' }) do
      for _, line in ipairs(wrapped(text, c.width - 4)) do detail({ { '   ' .. line, 'ClandBold' } }) end
    end
    if subject.cwd then
      for _, line in ipairs(wrapped('cwd: ' .. subject.cwd, c.width - 4)) do detail({ { '   ' .. line, 'ClandDim' } }) end
    end
    if subject.reason then
      for _, line in ipairs(wrapped(subject.reason, c.width - 4)) do detail({ { '   ' .. line, 'ClandDim' } }) end
    end
    for _, path in ipairs(subject.files or {}) do
      for _, line in ipairs(wrapped(path, c.width - 4)) do detail({ { '   ' .. line, 'ClandDim' } }) end
    end
    if r.state == 'answering' then
      detail({ { '   answering · waiting for delivery', 'ClandFaint' } })
    elseif r.answerIn == 'hub' then
      for _, choice in ipairs(r.choices or {}) do
        if choices[choice] then
          for _, line in ipairs(wrapped(choices[choice], c.width - 4)) do detail({ { '   ' .. line, 'ClandFaint' } }) end
        end
      end
    else
      detail({ { '   answer in the session TUI: ↵ attaches', 'ClandFaint' } })
    end
  end
end

function M.render_sections(c, buf)
  local ib = state.S.inbox
  local asks = now_rows(ib.asks, 'ask')
  vim.list_extend(asks, now_rows(M.approvals(ib.approvals), 'approval'))
  local sections = {
    { 'asks and approvals', asks }, { 'plan approvals', now_rows(ib.plans, 'plan') },
    { 'requests to you', now_rows(ib.requests, 'request') }, { 'messages to you', now_rows(ib.messages, 'message') },
  }
  for _, group in ipairs(sections) do
    local name, rows = group[1], group[2]
    for i, entry in ipairs(rows) do entry.order = i end
    table.sort(rows, function(a, b)
      local x, y = since(a.value) or '', since(b.value) or ''
      return x > y or (x == y and a.order < b.order)
    end)
    if #rows > 0 then
      c:add({})
      local waiting = 0
      for _, entry in ipairs(rows) do if entry.value.state ~= 'closed' then waiting = waiting + 1 end end
      section(c, name, waiting, nil, true)
      for i, entry in ipairs(rows) do
        if i <= 5 or M.expanded[name] then render_row(c, entry, M.selected[buf]) end
      end
      if #rows > 5 then
        local oldest = rows[#rows].value
        local text = (M.expanded[name] and '▾' or '▸') .. ' ' .. (#rows - 5) .. ' more · the oldest waits ' .. M.age(since(oldest)) .. ', since ' .. clock(since(oldest))
        for _, line in ipairs(wrapped(text, c.width - 2)) do
          c:add({ { ' ' .. line, 'ClandDim' } }, nil, { inbox_fold = name, inbox_key = 'fold:' .. name })
        end
      end
    end
  end
end

--- Keep sections and the events footer independent for the parallel events-view work.
function M.render(c, full, buf)
  if state.needs_you() == 0 then c:add({ { ' ✓ nothing needs you', 'ClandGreen' } }) end
  M.render_sections(c, buf)
  c:add({ { require('cland.events').inbox_line(), 'ClandPlanChange' } }, nil, { events = true })
  c:add({ { ' ' .. (state.S.ui.inbox_archive and '▾' or '▸') .. ' archive · ' .. (state.S.inbox.archiveToday or 0) .. ' rows left today · A', 'ClandDim' } })
  if state.S.ui.inbox_archive then
    local rows = state.S.inbox.archive or {}
    for _, r in ipairs(rows) do
      local text = r.kind .. ' · ' .. r.subject .. ' · ' .. first_line(r.text)
      if type(r.outcome) == 'table' then
        local o = r.outcome
        local detail = o.status and ((o.status == 'declined' and o.reason or o.text) .. ' · ' .. o.by) or outcome_label(o)
        if o.via and o.via ~= vim.NIL then detail = detail .. ' · ' .. provenance.label(o.via) end
        text = text .. ' · ' .. detail
      end
      -- Wrap the archive so when and why are visible in the narrow panel too.
      for _, line in ipairs(wrapped(text, c.width - 2)) do c:add({ { ' ' .. line, 'ClandDim' } }) end
      for _, line in ipairs(wrapped(r.ts .. ' · ' .. r.reason, c.width - 2)) do c:add({ { ' ' .. line, 'ClandDim' } }) end
    end
    if #rows == 0 then c:add({ { ' No rows left in the last seven days', 'ClandDim' } }) end
  end
  if full then
    return { ' 1-9 ask · 1 once · 2 always · i free · r reply · za more · ↵ open · d deny/decline/read · A archive · ␣N or ␣␣ back' }
  end
  return { ' 1-9 ask · 1 once · 2 always · i free · r reply · za more · ↵ act · d deny/decline/read · A archive · ␣N full width' }
end

function M.follow_row(c, info)
  if not info then return nil end
  for r = 1, #c.lines do
    local candidate = c.info[r]
    if candidate and candidate.inbox_key == info.inbox_key and info.inbox_key and candidate.inbox_detail == info.inbox_detail then return r end
  end
  -- A folded outcome replaces the selected detail on its root row.
  for r = 1, #c.lines do
    local candidate = c.info[r]
    if candidate and candidate.inbox_key == info.inbox_key and candidate.approval and candidate.approval.state == 'closed' then return r end
  end
  -- A selected row pushed past the five-row cap lands on its section's inert fold line.
  local kind = info.inbox_key and info.inbox_key:match('^([^:]+):')
  local group = ({ ask = 'asks and approvals', approval = 'asks and approvals', plan = 'plan approvals', request = 'requests to you', message = 'messages to you' })[kind]
  for r = 1, #c.lines do
    if c.info[r] and group and c.info[r].inbox_fold == group then return r end
  end
end

function M.cursor(buf)
  local win = api.nvim_get_current_win()
  if api.nvim_win_get_buf(win) ~= buf then return end
  local panels = require('cland.panels')
  local info = panels.row_at(buf, api.nvim_win_get_cursor(win)[1])
  local key = info and info.inbox_key
  if M.selected[buf] == key then return end
  M.selected[buf] = key
  state.changed()
end

-- Leaving the inbox retires its completed rows; moving among its rows keeps them in place.
local function leave_visit()
  local role = vim.b.cland_role
  if role == 'inbox' or role == 'inbox_full' then return end
  completed, M.selected = {}, {}
  local rows = {}
  for _, r in ipairs(state.S.inbox.approvals) do if r.state ~= 'closed' then rows[#rows + 1] = r end end
  state.S.inbox.approvals = rows
  state.changed()
end

-- Only displayed ages cause a redraw. This local clock never requests a hub frame.
local timer
function M.start_clock(clock)
  if clock then
    if timer then timer:stop(); timer:close(); timer = nil end
    local_clock = clock
  end
  if timer then return end
  timer = local_clock.new_timer()
  local previous
  timer:start(1000, 1000, vim.schedule_wrap(function()
    local visible = false
    for _, win in ipairs(api.nvim_list_wins()) do
      local role = vim.b[api.nvim_win_get_buf(win)].cland_role
      if role == 'inbox' or role == 'inbox_full' then visible = true; break end
    end
    if not visible then return end
    local signature = {}
    for _, kind in ipairs({ 'asks', 'approvals', 'plans', 'requests', 'messages' }) do
      for _, r in ipairs(state.S.inbox[kind]) do signature[#signature + 1] = M.age(since(r)) end
    end
    local current = table.concat(signature, '|')
    if current ~= previous then previous = current; state.changed() end
  end))
  api.nvim_create_autocmd('VimLeavePre', { group = api.nvim_create_augroup('cland.inbox.clock', { clear = true }), once = true, callback = function() timer:stop(); timer:close() end })
end

-- Acting from a row ------------------------------------------------------------------------------------------

local function row(buf)
  return require('cland.panels').row_at(buf, api.nvim_win_get_cursor(0)[1])
end

local function request(frame)
  local client = require('cland.views').client
  if not (client and client:connected()) then
    return state.say(frame.type .. ': the hub is not connected', 'ClandRedBar')
  end
  client:request(frame, function(err, value)
    if err then
      return state.say(frame.type .. ': ' .. tostring(err), 'ClandRedBar')
    end
    state.set_inbox(value)
  end)
end

function M.answer_approval(record, choice, note)
  if record.answerIn ~= 'hub' then return state.say('answer this command approval in its session TUI: ↵ attaches', 'ClandAmberBar') end
  if record.state == 'closed' and type(record.outcome) == 'table' then return state.say(outcome_text(record.outcome)) end
  if sending[record.id] or record.state == 'answering' then return state.say('this approval is being answered', 'ClandAmberBar') end
  if not vim.tbl_contains(record.choices or {}, choice) then return state.say('choice ' .. choice .. ' is not offered by this approval', 'ClandAmberBar') end
  local client = require('cland.views').client
  if not (client and client:connected()) then return state.say('approval.answer: the hub is not connected', 'ClandRedBar') end
  if choice == 'deny' and note == nil then
    if noting[record.id] then return end
    noting[record.id] = true
    return vim.ui.input({ prompt = 'Denial note (optional): ' }, function(text)
      noting[record.id] = nil
      if text ~= nil then M.answer_approval(record, choice, text) end
    end)
  end
  sending[record.id] = true
  client:request({ type = 'approval.answer', approval = record.id, choice = choice, note = note }, function(err, value)
    sending[record.id] = nil
    if err then
      state.say('not answered: ' .. tostring(err), 'ClandRedBar')
      if tostring(err):find('approval already answered by ', 1, true) then
        client:request({ type = 'inbox.list', archive = true }, function(read_error, inbox)
          if read_error then return end
          for _, departure in ipairs(inbox.archive or {}) do
            if departure.kind == 'approval' and departure.id == record.id and type(departure.outcome) == 'table' then
              M.approval_changed(vim.tbl_extend('force', record, { state = 'closed', outcome = departure.outcome }))
              break
            end
          end
          -- This reply may predate newer inbox/approval pushes. Only its exact winner is consumed.
        end)
      end
      return
    end
    if value and value.approval then
      M.approval_changed(value.approval)
      if type(value.approval.outcome) == 'table' then state.say(outcome_text(value.approval.outcome)) end
    end
  end)
end

function M.refresh_archive()
  request({ type = 'inbox.list', archive = true })
end

function M.reply(buf)
  local info = row(buf)
  if not info then return end
  if info.ask then return ask_card.free(info.ask) end
  if info.approval then
    if info.approval.answerIn == 'hub' then return state.say('answer this approval: 1 once · 2 always · d deny with optional note', 'ClandAmberBar') end
    return state.say('answer this command approval in its session: ↵ attaches', 'ClandAmberBar')
  end
  if info.plan then return state.say('answer this plan approval in its plan: ↵ opens it', 'ClandAmberBar') end
  if info.message and info.topic then
    require('cland.views').topic(info.topic).composer:reply_to(info.message, info.text)
    return require('cland.layout').show({ kind = 'thread', id = info.topic }, { insert = true })
  end
  state.say('r replies to a request or message, or gives a free answer to an ask')
end

--- ↵: open the selected row's topic, command approval's session, plan or events view.
function M.open(buf)
  local info = row(buf)
  if not info then
    return
  end
  local layout = require('cland.layout')
  if info.events then
    layout.show({ kind = 'events' }, { insert = false })
  elseif info.plan then
    layout.show({ kind = 'plan', id = info.item }, { insert = false })
  elseif info.approval and info.session then
    layout.show({ kind = 'session', id = info.session }, { insert = true })
  elseif info.topic then
    layout.show({ kind = 'thread', id = info.topic }, { insert = false })
  elseif info.item then
    layout.show({ kind = 'item', id = info.item }, { insert = false })
  elseif info.session then
    layout.show({ kind = 'session', id = info.session }, { insert = false })
  end
end

--- d: decline a request or mark one message read; asks and approvals wait for answers.
function M.dismiss(buf)
  local info = row(buf)
  if info and info.inbox_kind == 'request' then return request({ type = 'inbox.decline', request = info.message }) end
  if info and info.inbox_kind == 'message' then return request({ type = 'inbox.read', message = info.message }) end
  if info and info.plan then return state.say('answer this plan approval in its plan: ↵ opens it', 'ClandAmberBar') end
  if info and info.approval then return M.answer_approval(info.approval, 'deny') end
  if info and info.ask then return state.say('answer this ask: 1-9 chooses an option, i or r gives a free answer', 'ClandAmberBar') end
  state.say('d declines a request or marks a message read')
end

--- The inbox's keys on `buf` (the panel's buffer or the full-width one).
function M.keys(buf)
  M.start_clock()
  api.nvim_create_autocmd('CursorMoved', { buffer = buf, callback = function() M.cursor(buf) end })
  -- A scheduled check sees the destination after a panel/full-width view switch.
  api.nvim_create_autocmd({ 'BufLeave', 'WinLeave', 'BufWinLeave' }, { buffer = buf, callback = function() vim.schedule(leave_visit) end })
  local function map(lhs, fn, desc)
    require('cland.actions').map('n', lhs, fn, { buffer = buf, nowait = true, silent = true, desc = 'cland: ' .. desc })
  end
  map('za', function()
    local info = row(buf)
    if not (info and info.inbox_fold) then return state.say('za folds an inbox section: put the cursor on more') end
    M.expanded[info.inbox_fold] = not M.expanded[info.inbox_fold]
    state.changed()
  end, 'fold or unfold the inbox section')
  map('e', function() require('cland.layout').show({ kind = 'events' }, { insert = false }) end, 'Events view')
  map('<CR>', function()
    M.open(buf)
  end, 'open or attach')
  map('d', function()
    M.dismiss(buf)
  end, 'decline a request or mark a message read')
  map('r', function() M.reply(buf) end, 'reply to the inbox row')
  map('A', function()
    state.S.ui.inbox_archive = not state.S.ui.inbox_archive
    state.changed()
    if state.S.ui.inbox_archive then M.refresh_archive() end
  end, 'show or hide archived inbox entries')
  for n = 1, 9 do
    require('cland.actions').map('n', tostring(n), function()
      local info = row(buf)
      if info and (info.ask or info.approval and n <= 2) then
        vim.schedule(function()
          if info.ask then ask_card.answer(info.ask, n)
          else M.answer_approval(info.approval, n == 1 and 'once' or 'always') end
        end)
        return ''
      end
      return tostring(n)
    end, { buffer = buf, expr = true, nowait = true, silent = true })
  end
  map('i', function()
    local info = row(buf)
    if info and info.ask then return ask_card.free(info.ask) end
    state.say('i types a free answer: put the cursor on an ask')
  end, 'a free answer to the ask')
end

-- The full-width view ----------------------------------------------------------------------------------------

function M.full_buf()
  local b = M.full
  if b and api.nvim_buf_is_valid(b) then
    return b
  end
  b = api.nvim_create_buf(false, true)
  vim.bo[b].bufhidden = 'hide'
  vim.bo[b].modifiable = false
  pcall(api.nvim_buf_set_name, b, 'cland://inbox')
  vim.b[b].cland_role = 'inbox_full'
  M.full = b
  M.keys(b)
  M.render_full()
  return b
end

--- Draw the full-width inbox into every window showing it.
function M.render_full()
  local b = M.full
  if not (b and api.nvim_buf_is_valid(b)) then
    return
  end
  local wins = vim.fn.win_findbuf(b)
  local panels = require('cland.panels')
  local cursors = {}
  for _, w in ipairs(wins) do
    local cur = api.nvim_win_get_cursor(w)
    local info = panels.row_at(b, cur[1])
    cursors[w] = { row = cur[1], info = info }
  end
  local width = #wins > 0 and api.nvim_win_get_width(wins[1]) or 80
  local c = panels.canvas(math.min(width, 120))
  local footer = M.render(c, true, b)
  c:add({})
  for _, f in ipairs(footer) do
    c:add({ { f, 'ClandFaint' } })
  end
  panels.rows[b] = c:apply(b)
  for _, w in ipairs(wins) do
    local cur = cursors[w]
    local target = M.follow_row(c, cur.info) or cur.row
    pcall(api.nvim_win_set_cursor, w, { math.min(target, #c.lines), 0 })
  end
end

return M
