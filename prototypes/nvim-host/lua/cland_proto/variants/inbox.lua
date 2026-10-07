-- PROTOTYPE (ticket #15), variant B "inbox-first": the human's main loop is
-- the "needs you" queue across topics; the topic list hides behind a picker.
--
--   +-----------------------------------------------------------------+
--   | NEEDS YOU: one line per open ask / approval / wait, then unread |
--   +-----------------------------------------------------------------+
--   | THREAD of the selected item's topic                             |
--   +-----------------------------------------------------------------+
--   | COMPOSER                                                        |
--   +-----------------------------------------------------------------+
local api = vim.api
local state = require('cland_proto.state')
local chat = require('cland_proto.chat')
local sessions = require('cland_proto.sessions')

local V = {
  thread_style = 'full',
  win = {},
  tagline = 'a "needs you" queue across topics on top, the thread below, topics behind <Space>t',
  help = {
    'Queue           j/k move · ⏎ jump in (ask → its thread, approval → the session terminal,',
    '                unread → the topic) · 1-3 answer the ask on the line · 4 own answer',
    '                y "approved in the TUI" (fake) on an approval line',
    '<Space>t        topics picker (the only topic list in this variant)',
    '<Space>b        back to the thread when the lower pane shows a terminal',
  },
}
local ns = api.nvim_create_namespace('cland_proto_inbox')

local function app()
  return require('cland_proto.app')
end

local function valid(w)
  return w and api.nvim_win_is_valid(w)
end

local function row_info()
  return (V.rows or {})[api.nvim_win_get_cursor(0)[1]]
end

local function jump(inf)
  if not inf then
    return
  end
  if inf.kind == 'ask' then
    V.open_topic(inf.topic)
    api.nvim_set_current_win(V.win.thread)
    -- after the re-render that open_topic scheduled (it recomputes the padding)
    vim.schedule(function()
      local buf = chat.thread_buf(inf.topic)
      local row = chat.find_row(buf, function(i)
        return i.header and i.ask == inf.ask
      end)
      if row and valid(V.win.thread) and api.nvim_win_get_buf(V.win.thread) == buf then
        api.nvim_win_set_cursor(V.win.thread, { row, 0 })
      end
    end)
  elseif inf.kind == 'approval' or inf.kind == 'session' then
    V.open_session(inf.session)
  elseif inf.kind == 'unread' or inf.kind == 'waiting' then
    V.open_topic(inf.topic)
    api.nvim_set_current_win(V.win.thread)
  elseif inf.kind == 'vacant' then
    app().session_picker()
  end
end

local function ensure_buf()
  if V.buf and api.nvim_buf_is_valid(V.buf) then
    return
  end
  V.buf = api.nvim_create_buf(false, true)
  vim.b[V.buf].cland_role = 'queue'
  vim.bo[V.buf].modifiable = false
  local o = { buffer = V.buf, nowait = true, silent = true }
  vim.keymap.set('n', '<CR>', function()
    jump(row_info())
  end, o)
  vim.keymap.set('n', '<2-LeftMouse>', function()
    jump(row_info())
  end, o)
  for i = 1, 4 do
    vim.keymap.set('n', tostring(i), function()
      local inf = row_info()
      if not (inf and inf.kind == 'ask') then
        vim.notify('cland-proto: put the cursor on an ASK line', vim.log.levels.INFO)
        return
      end
      local a = state.ask(inf.ask)
      if i <= #a.options then
        require('cland_proto.ask').answer(a.id, i)
      else
        V.open_topic(a.topic)
        require('cland_proto.ask').start_free(a.id)
      end
    end, o)
  end
  vim.keymap.set('n', 'y', function()
    local inf = row_info()
    if inf and inf.kind == 'approval' then
      sessions.approve(inf.session)
    end
  end, o)
end

local function trunc(s, n)
  if vim.fn.strdisplaywidth(s) <= n then
    return s
  end
  return vim.fn.strcharpart(s, 0, n - 1) .. '…'
end

local function last_text(t)
  for i = #t.messages, 1, -1 do
    local m = t.messages[i]
    if m.kind == 'text' then
      return (m.from == 'you' and 'you' or m.from) .. ' ' .. state.fmt(m.at) .. ': ' .. table.concat(m.text, ' ')
    elseif m.kind == 'event' then
      return state.fmt(m.at) .. ' ' .. m.event .. ': ' .. m.text
    elseif m.kind == 'ask' then
      return m.from .. ' asked: ' .. state.ask(m.ask).question
    end
  end
  return ''
end

function V.render()
  ensure_buf()
  local L, marks, rows = {}, {}, {}
  local function add(text, inf)
    L[#L + 1] = text
    rows[#L] = inf
    return #L - 1
  end
  local function hl(r, s, e, group)
    marks[#marks + 1] = { r, s, { end_col = e, hl_group = group } }
  end
  local needs = state.needs_you()
  local kinds = {
    ask = { '●', 'ASK     ', 'ClandWaitYou' },
    approval = { '◆', 'APPROVAL', 'ClandWaitApproval' },
    session = { '●', 'SESSION ', 'ClandWaitYou' },
    waiting = { '●', 'WAITING ', 'ClandWaitYou' },
    vacant = { '⚠', 'VACANT  ', 'ClandWaitYou' },
  }
  for _, n in ipairs(needs) do
    local k = kinds[n.kind]
    local head = ' ' .. k[1] .. ' ' .. k[2] .. '  '
    local text, inf
    if n.kind == 'ask' then
      local a = n.ask
      local opts = {}
      for i, o in ipairs(a.options) do
        opts[#opts + 1] = i .. ' ' .. o.short
      end
      if a.free then
        opts[#opts + 1] = '4 ✎ own'
      end
      local where = chat.label(n.topic, 34)
      text = head .. where .. '  ' .. a.from .. ': ' .. a.question .. '   ' .. table.concat(opts, ' · ')
      inf = { kind = 'ask', ask = a.id, topic = a.topic }
      local r = add(text, inf)
      hl(r, 0, #head, k[3])
      local ws = #head
      if n.topic.item then
        hl(r, ws, ws + #n.topic.item, 'ClandItem')
      end
      local qs = #head + #where + 2
      hl(r, qs, qs + #a.from + 2 + #a.question, 'ClandAskQuestion')
      local os = #text - #table.concat(opts, ' · ')
      for i, o in ipairs(opts) do
        hl(r, os, os + #tostring(i <= #a.options and i or 4), 'ClandAskKey')
        os = os + #o + #' · '
      end
    elseif n.kind == 'approval' then
      local s = n.session
      text = head .. sessions.label(s) .. ' · ' .. s.harness .. ' waits to run: ' .. (s.approval or '?')
        .. '   ⏎ open its terminal · y approved'
      inf = { kind = 'approval', session = s.name }
      local r = add(text, inf)
      hl(r, 0, #head, k[3])
      local cs = text:find(s.approval or '?', 1, true)
      if cs then
        hl(r, cs - 1, cs - 1 + #(s.approval or '?'), 'ClandWaitApproval')
      end
      hl(r, #text - #'   ⏎ open its terminal · y approved', #text, 'ClandDim')
    elseif n.kind == 'session' then
      text = head .. sessions.label(n.session) .. ' waits for you in its terminal'
      inf = { kind = 'session', session = n.session.name }
      hl(add(text, inf), 0, #head, k[3])
    elseif n.kind == 'waiting' then
      text = head .. chat.label(n.topic, 40) .. ' waits for your reply'
      inf = { kind = 'waiting', topic = n.topic.id }
      hl(add(text, inf), 0, #head, k[3])
    elseif n.kind == 'vacant' then
      text = head .. 'no coordinator: messages to the Coordinator stay queued · ⏎ sessions'
      inf = { kind = 'vacant' }
      hl(add(text, inf), 0, #head, k[3])
    end
    marks[#marks + 1] = { #L - 1, 0, { virt_text = { { state.fmt(n.at) .. ' ', 'ClandDim' } }, virt_text_pos = 'right_align' } }
  end
  if #needs == 0 then
    hl(add(' ✓ nothing needs you', nil), 0, #L[#L], 'ClandOpen')
  end
  -- topics already listed above (open asks) are not repeated as unread
  local unread = vim.tbl_filter(function(t)
    return #state.open_asks(t.id) == 0 and t.status ~= 'waiting for human'
  end, state.unread_topics())
  if #unread > 0 then
    hl(add('   ─ also unread (weak signal) ─', nil), 0, #L[#L], 'ClandDim')
    local width = valid(V.win.queue) and api.nvim_win_get_width(V.win.queue) or 160
    for _, t in ipairs(unread) do
      local st = chat.status(t)
      local head = ' ' .. st.icon .. ' UNREAD ' .. t.unread .. '  '
      local name = chat.label(t, 36)
      local text = trunc(head .. name .. ' · ' .. last_text(t), width - 8)
      local r = add(text, { kind = 'unread', topic = t.id })
      hl(r, 1, 1 + #st.icon, st.hl)
      hl(r, 1 + #st.icon + 1, #head, 'ClandDim')
      hl(r, #head, math.min(#text, #head + #name), 'Normal')
      hl(r, math.min(#text, #head + #name), #text, 'ClandDim')
    end
  end
  vim.bo[V.buf].modifiable = true
  api.nvim_buf_set_lines(V.buf, 0, -1, false, L)
  vim.bo[V.buf].modifiable = false
  api.nvim_buf_clear_namespace(V.buf, ns, 0, -1)
  for _, m in ipairs(marks) do
    pcall(api.nvim_buf_set_extmark, V.buf, ns, m[1], m[2], m[3])
  end
  V.rows = rows
  if valid(V.win.queue) then
    -- +1: the window height includes its winbar row
    pcall(api.nvim_win_set_height, V.win.queue, math.max(3, math.min(#L, 12)) + 1)
  end
end

function V.build()
  ensure_buf()
  local cur = state.S.current_topic
  local w = api.nvim_get_current_win()
  api.nvim_win_set_buf(w, V.buf)
  V.win.queue = w
  V.win.thread = api.nvim_open_win(chat.thread_buf(cur), false, { split = 'below', win = w })
  V.win.composer = api.nvim_open_win(chat.composer(cur), false, { split = 'below', win = V.win.thread, height = 4 })
  vim.wo[w].winfixheight = true
  vim.wo[w].wrap = false
  vim.wo[w].cursorline = true
  vim.wo[w].winhighlight = 'CursorLine:ClandQueueSel'
  vim.wo[V.win.thread].wrap, vim.wo[V.win.thread].linebreak, vim.wo[V.win.thread].breakindent = true, true, true
  vim.wo[V.win.composer].winfixheight = true
  chat.view(cur)
  V.render()
  chat.to_tail(V.win.thread)
  api.nvim_set_current_win(w)
  api.nvim_win_set_cursor(w, { 1, 0 })
end

function V.open_topic(id)
  chat.view(id)
  if valid(V.win.thread) then
    api.nvim_win_set_buf(V.win.thread, chat.thread_buf(id))
    chat.to_tail(V.win.thread)
  end
  if valid(V.win.composer) then
    api.nvim_win_set_buf(V.win.composer, chat.composer(id))
  end
end

function V.open_session(name)
  if valid(V.win.thread) then
    sessions.show_in(V.win.thread, name)
    api.nvim_set_current_win(V.win.thread)
    state.changed()
  end
end

function V.back()
  V.open_topic(state.S.current_topic)
  if valid(V.win.thread) then
    api.nvim_set_current_win(V.win.thread)
  end
end

function V.composer_win()
  return V.win.composer
end

function V.winbar(win, buf, role)
  if role == 'queue' then
    local n = #state.needs_you()
    local focused = win == api.nvim_get_current_win()
    return '%#' .. (focused and 'ClandBarFocus' or 'ClandBar') .. '# NEEDS YOU %* %#' .. (n > 0 and 'ClandWaitYou' or 'ClandOpen')
      .. '#' .. n .. '%*  %#ClandDim#⏎ jump in · 1-3 answer · 4 own answer · y approved · <Space>t topics · <Space>s sessions%*'
  end
end

function V.statusline()
  local left = app().stl_left()
  left[#left + 1] = { ' ' .. chat.label(state.current(), 40) .. ' ', 'StatusLine' }
  local right = sessions.summary_chunks({ short = true, names = true })
  table.insert(right, 1, { ' sessions ', 'ClandDimBar' })
  right[#right + 1] = { ' ', 'StatusLine' }
  return left, right
end

return V
