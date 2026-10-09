-- The Agents log (spec 4.5, #34): the centre view over the Agents topic, a read-only record of what agents send
-- each other and of the project's lifecycle events (hub notices with a kind). One row per entry: the local time,
-- `sender [Role] → addressee` for a message or a kind glyph for a notice, then the text (further lines of a
-- message indented below it). Built from `topic.history` on every connect and kept current by `message` events
-- for `agents`. `r` on a message replies to its sender: a composer opens under the log, and what is sent there
-- goes into Agents with `replyTo`, which the hub resolves to that sender.
local api = vim.api
local state = require('cland.state')

local M = { messages = {}, by_id = {}, rows = {}, buf = nil, reply = nil }
local ns = api.nvim_create_namespace('cland.agents_log')

M.TOPIC = 'agents'
M.HISTORY_LIMIT = 200

--- A notice's kind → its glyph and highlight.
M.GLYPHS = {
  ['session-start'] = { '▶', 'ClandGreen' },
  ['session-stop'] = { '■', 'ClandDim' },
  ['session-death'] = { '✖', 'ClandRed' },
  ['role-assign'] = { '◆', 'ClandTeal' },
  ['role-revoke'] = { '◇', 'ClandDim' },
  handover = { '⇄', 'ClandTeal' },
  claim = { '⚑', 'ClandBlue' },
  release = { '⚐', 'ClandDim' },
  mute = { '⊘', 'ClandRed' },
  unmute = { '⊙', 'ClandAmber' },
  refusal = { '⛔', 'ClandRed' },
}
M.OTHER_GLYPH = { '·', 'ClandDim' }

--- A session's name with its role, as everywhere: the message's own role for its sender, the session rows for others.
local function who(name, role)
  if name == 'human' then
    return 'you'
  end
  if role then
    return state.label(name, role)
  end
  local s = state.session(name)
  return s and s.label or name
end

local function sort()
  for i, m in ipairs(M.messages) do
    m._seq = i
  end
  table.sort(M.messages, function(a, b)
    if a.ts ~= b.ts then
      return tostring(a.ts) < tostring(b.ts)
    end
    return a._seq < b._seq
  end)
end

local function add(m)
  if M.by_id[m.id] then
    return false
  end
  local copy = vim.deepcopy(m)
  M.by_id[copy.id] = copy
  table.insert(M.messages, copy)
  return true
end

--- The log's buffer, made on first use.
function M.buffer()
  if M.buf and api.nvim_buf_is_valid(M.buf) then
    return M.buf
  end
  local b = api.nvim_create_buf(false, true)
  vim.bo[b].buftype = 'nofile'
  vim.bo[b].bufhidden = 'hide'
  vim.bo[b].swapfile = false
  vim.bo[b].modifiable = false
  vim.bo[b].filetype = 'cland-log'
  pcall(api.nvim_buf_set_name, b, 'cland://log')
  vim.b[b].cland_role = 'log'
  vim.b[b].cland_topic = M.TOPIC
  vim.keymap.set('n', 'r', function()
    M.reply_at(api.nvim_win_get_cursor(0)[1])
  end, { buffer = b, nowait = true, silent = true, desc = 'cland: reply to the sender of this message' })
  vim.keymap.set('n', '<CR>', function()
    local m = M.at(api.nvim_win_get_cursor(0)[1])
    if m and m.artifact then require('cland.artifacts').open(m.artifact) end
  end, { buffer = b, desc = 'cland: open artifact' })
  vim.keymap.set('n', 'ga', function()
    require('cland.layout').show({ kind = 'artifacts', id = M.TOPIC }, { insert = false })
  end, { buffer = b, desc = 'cland: topic artifacts' })
  M.buf = b
  M.render()
  return b
end

--- The entry on buffer row `row` (1-based), or nil.
function M.at(row)
  return M.rows[row]
end

function M.render()
  local b = M.buf
  if not (b and api.nvim_buf_is_valid(b)) then
    return
  end
  local lines, marks, rows = {}, {}, {}
  local function line(text, m, hls)
    lines[#lines + 1] = text
    rows[#lines] = m
    for _, h in ipairs(hls or {}) do
      marks[#marks + 1] = { row = #lines - 1, s = h[1], e = h[2], group = h[3] }
    end
  end
  line(' Agents · read-only log: lifecycle events and agent-to-agent messages · r on a message replies to its sender', nil, { { 0, -1, 'ClandDim' } })
  line('')
  if #M.messages == 0 then
    line(' Nothing recorded yet.', nil, { { 0, -1, 'ClandDim' } })
  end
  local clock = require('cland.thread').clock
  for _, m in ipairs(M.messages) do
    local time = ' ' .. clock(m.ts) .. '  '
    local text_lines = vim.split(tostring(m.text or ''), '\n', { plain = true })
    if m.artifact then
      local a = m.artifact
      text_lines = { '▣ ' .. a.id .. ' ' .. a.kind .. ' · ' .. a.title }
    end
    if m.fromKind == 'hub' then
      local g = M.GLYPHS[m.kind] or M.OTHER_GLYPH
      local head = time .. g[1] .. ' '
      line(head .. text_lines[1], m, { { 1, #time - 2, 'ClandDim' }, { #time, #time + #g[1], g[2] }, { #head, -1, m.kind == 'mute' and 'ClandRed' or 'ClandText' } })
    else
      local from = who(m.from, m.fromRole)
      local to = {}
      for _, n in ipairs(m.to or {}) do
        to[#to + 1] = who(n)
      end
      local dest = #to > 0 and table.concat(to, ', ') or (m.artifact and 'you' or 'nobody')
      local head = time .. from .. ' → ' .. dest .. '  '
      local s_from = #time
      local s_to = s_from + #from + #' → '
      line(head .. text_lines[1], m, {
        { 1, #time - 2, 'ClandDim' },
        { s_from, s_from + #from, m.fromKind == 'human' and 'ClandAmber' or 'ClandBold' },
        { s_from + #from, s_to, 'ClandDim' },
        { s_to, s_to + #dest, 'ClandTeal' },
        { #head, -1, m.artifact and 'ClandBlue' or 'ClandText' },
      })
      local pad = string.rep(' ', #time)
      for i = 2, #text_lines do
        line(pad .. text_lines[i], m)
      end
    end
  end
  M.rows = rows
  local stay = {}
  local old = api.nvim_buf_line_count(b)
  for _, win in ipairs(vim.fn.win_findbuf(b)) do
    local row = api.nvim_win_get_cursor(win)[1]
    if row < old then
      stay[win] = api.nvim_win_get_cursor(win)
    end
  end
  vim.bo[b].modifiable = true
  api.nvim_buf_set_lines(b, 0, -1, false, lines)
  vim.bo[b].modifiable = false
  api.nvim_buf_clear_namespace(b, ns, 0, -1)
  for _, mk in ipairs(marks) do
    local len = #lines[mk.row + 1]
    local e = mk.e < 0 and len or math.min(mk.e, len)
    if e > mk.s then
      pcall(api.nvim_buf_set_extmark, b, ns, mk.row, mk.s, { end_col = e, hl_group = mk.group })
    end
  end
  -- a reader away from the tail keeps the place; otherwise the log follows its tail
  for _, win in ipairs(vim.fn.win_findbuf(b)) do
    if stay[win] then
      pcall(api.nvim_win_set_cursor, win, { math.min(stay[win][1], #lines), stay[win][2] })
    else
      pcall(api.nvim_win_set_cursor, win, { #lines, 0 })
    end
  end
end

--- Merge a history snapshot (every connect).
function M.merge(messages)
  for _, m in ipairs(messages or {}) do
    add(m)
  end
  sort()
  M.render()
end

function M.load()
  if not (M.client and M.client:connected()) then
    return
  end
  M.client:request({ type = 'topic.history', topic = M.TOPIC, limit = M.HISTORY_LIMIT }, function(err, value)
    if not err and value then
      M.merge(value.messages)
    end
  end)
end

function M.setup(client)
  M.client = client
  client:on('connected', M.load)
  client:on('message', function(event)
    if event.topic and event.topic.id == M.TOPIC and event.message and add(event.message) then
      sort()
      M.render()
    end
  end)
  if client:connected() then
    M.load()
  end
end

--- Close the reply composer, if one is open.
function M.close_reply()
  local layout = require('cland.layout')
  local r = M.reply
  M.reply = nil
  if r and r.win and api.nvim_win_is_valid(r.win) then
    if layout.win.composer == r.win then
      layout.win.composer = nil
    end
    pcall(api.nvim_win_close, r.win, true)
  end
  if r and r.composer and api.nvim_buf_is_valid(r.composer.buf) then
    pcall(api.nvim_buf_delete, r.composer.buf, { force = true })
  end
end

--- `r` on row `row`: a reply to the sender of the message there, in a composer under the log.
function M.reply_at(row)
  local m = M.at(row)
  if not m then
    return state.say('no message on this line to reply to', 'ClandAmberBar')
  end
  if m.fromKind ~= 'agent' then
    return state.say(m.fromKind == 'hub' and 'a hub notice has no sender to answer' or 'reply to an agent\'s message', 'ClandAmberBar')
  end
  M.close_reply()
  local target = who(m.from, m.fromRole)
  local Composer = require('cland.composer')
  local reply = { to = m.from, id = m.id, label = target }
  reply.composer = Composer.new({
    topic = { id = M.TOPIC .. '-reply', title = 'reply to ' .. target },
    send = function(text, done)
      if not (M.client and M.client:connected()) then
        state.say('not sent: the hub is not connected', 'ClandRedBar')
        return done('not connected')
      end
      M.client:request({ type = 'topic.send', topic = M.TOPIC, text = text, replyTo = m.id }, function(err)
        if err then
          state.say('not sent: ' .. tostring(err), 'ClandRedBar')
        else
          state.say('replied to ' .. target)
          if M.reply == reply then
            vim.schedule(M.close_reply)
          end
        end
        done(err)
      end)
    end,
  })
  vim.b[reply.composer.buf].cland_reply_to = m.id
  vim.b[reply.composer.buf].cland_reply_sender = m.from
  -- in the shell's composer slot under the centre: the layout sizes it, and any change of view closes it
  local layout = require('cland.layout')
  local centre = layout.centre()
  if layout.win.composer and api.nvim_win_is_valid(layout.win.composer) then
    pcall(api.nvim_win_close, layout.win.composer, true)
  end
  local win = api.nvim_open_win(reply.composer.buf, true, { split = 'below', win = centre, height = require('cland.topic_view').COMPOSER_HEIGHT + 1 })
  local wo = vim.wo[win]
  wo.winfixheight = true
  wo.wrap = true
  wo.number = false
  wo.signcolumn = 'no'
  wo.winhighlight = 'Normal:ClandComposer,NormalNC:ClandComposer,EndOfBuffer:ClandComposerEob'
  wo.winbar = ' ↩ reply to ' .. target .. ' · Enter sends · Esc then q cancels'
  vim.keymap.set('n', 'q', M.close_reply, { buffer = reply.composer.buf, nowait = true, silent = true, desc = 'cland: cancel the reply' })
  layout.win.composer = win
  reply.win = win
  M.reply = reply
  vim.cmd('startinsert!')
  return reply
end

return M
