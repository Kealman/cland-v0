-- PROTOTYPE (ticket #15), variant A "slack": everything visible at once.
--
--   +----------------+--------------------------------+------------------+
--   | TOPICS         | THREAD (current topic)         | SESSIONS board   |
--   |  NEEDS YOU     |                                |  name · role     |
--   |  OPEN          |                                |  state · item    |
--   |  CLOSED        +--------------------------------+  harness · model |
--   |                | COMPOSER (prompt buffer)       |                  |
--   +----------------+--------------------------------+------------------+
local api = vim.api
local state = require('cland_proto.state')
local chat = require('cland_proto.chat')
local sessions = require('cland_proto.sessions')

local V = {
  thread_style = 'full',
  win = {},
  tagline = 'topics grouped by status on the left, thread and composer in the centre, sessions board on the right',
  help = {
    'Topics column   j/k move · ⏎ open the topic and type · o open it and stay in the list',
    'Sessions board  ⏎ show that session terminal in the centre · y "approved in the TUI" (fake)',
    '<Space>b        back to the thread when the centre shows a terminal',
  },
}
local ns = api.nvim_create_namespace('cland_proto_slack')

local function app()
  return require('cland_proto.app')
end

local function valid(w)
  return w and api.nvim_win_is_valid(w)
end

local function scratch(role)
  local b = api.nvim_create_buf(false, true)
  vim.b[b].cland_role = role
  vim.bo[b].modifiable = false
  return b
end

local function topic_at_cursor()
  return (V.topic_rows or {})[api.nvim_win_get_cursor(0)[1]]
end

local function session_at_cursor()
  local inf = (V.board_info or {})[api.nvim_win_get_cursor(0)[1]]
  return inf and inf.session
end

local function ensure_bufs()
  if not (V.topics_buf and api.nvim_buf_is_valid(V.topics_buf)) then
    V.topics_buf = scratch('topics')
    local o = { buffer = V.topics_buf, nowait = true, silent = true }
    vim.keymap.set('n', '<CR>', function()
      local id = topic_at_cursor()
      if id then
        V.open_topic(id)
        app().focus_composer(id)
      end
    end, o)
    vim.keymap.set('n', '<2-LeftMouse>', function()
      local id = topic_at_cursor()
      if id then
        V.open_topic(id)
      end
    end, o)
    vim.keymap.set('n', 'o', function()
      local id = topic_at_cursor()
      if id then
        V.open_topic(id)
        api.nvim_set_current_win(V.win.topics)
      end
    end, o)
  end
  if not (V.board_buf and api.nvim_buf_is_valid(V.board_buf)) then
    V.board_buf = scratch('board')
    local o = { buffer = V.board_buf, nowait = true, silent = true }
    vim.keymap.set('n', '<CR>', function()
      local name = session_at_cursor()
      if name then
        V.open_session(name)
      end
    end, o)
    vim.keymap.set('n', 'y', function()
      local name = session_at_cursor()
      if name then
        sessions.approve(name)
      end
    end, o)
  end
end

function V.render_topics()
  local buf = V.topics_buf
  if not (buf and api.nvim_buf_is_valid(buf)) then
    return
  end
  local width = valid(V.win.topics) and api.nvim_win_get_width(V.win.topics) or 34
  local L, marks, rows = {}, {}, {}
  local groups = {
    { 'NEEDS YOU', 'ClandGroupYou', function(t) return t.status == 'waiting for human' end },
    { 'OPEN', 'ClandGroup', function(t) return t.status ~= 'waiting for human' and t.status ~= 'closed' end },
    { 'CLOSED', 'ClandGroup', function(t) return t.status == 'closed' end },
  }
  local sorted = state.sorted_topics()
  local cur_row
  for gi, g in ipairs(groups) do
    local members = vim.tbl_filter(g[3], sorted)
    if gi > 1 then
      L[#L + 1] = ''
    end
    L[#L + 1] = ' ' .. g[1] .. ' ' .. #members
    marks[#marks + 1] = { #L - 1, 0, { end_col = #L[#L], hl_group = g[2] } }
    for _, t in ipairs(members) do
      local st = chat.status(t)
      local unread = (t.unread or 0) > 0 and (' ' .. t.unread .. ' ') or ''
      local line = ' ' .. st.icon .. ' ' .. chat.label(t, width - 5 - #unread)
      L[#L + 1] = line
      rows[#L] = t.id
      local r = #L - 1
      marks[#marks + 1] = { r, 1, { end_col = 1 + #st.icon, hl_group = st.hl } }
      if t.item then
        local c = 1 + #st.icon + 1
        marks[#marks + 1] = { r, c, { end_col = c + #t.item, hl_group = 'ClandItem' } }
      end
      if t.status == 'closed' then
        marks[#marks + 1] = { r, 1 + #st.icon, { end_col = #line, hl_group = 'ClandClosed' } }
      end
      if unread ~= '' then
        marks[#marks + 1] = { r, 0, { virt_text = { { unread, 'ClandUnread' } }, virt_text_pos = 'right_align' } }
      end
      if t.id == state.S.current_topic then
        marks[#marks + 1] = { r, 0, { line_hl_group = 'ClandSel' } }
        cur_row = #L
      end
    end
  end
  L[#L + 1] = ''
  L[#L + 1] = ' ⏎ open · o stay · <Space>t find'
  marks[#marks + 1] = { #L - 1, 0, { end_col = #L[#L], hl_group = 'ClandDim' } }
  vim.bo[buf].modifiable = true
  api.nvim_buf_set_lines(buf, 0, -1, false, L)
  vim.bo[buf].modifiable = false
  api.nvim_buf_clear_namespace(buf, ns, 0, -1)
  for _, m in ipairs(marks) do
    pcall(api.nvim_buf_set_extmark, buf, ns, m[1], m[2], m[3])
  end
  V.topic_rows = rows
  if valid(V.win.topics) and cur_row and api.nvim_get_current_win() ~= V.win.topics then
    pcall(api.nvim_win_set_cursor, V.win.topics, { cur_row, 0 })
  end
end

function V.render()
  V.render_topics()
  if V.board_buf and api.nvim_buf_is_valid(V.board_buf) then
    V.board_info = sessions.render_board(V.board_buf)
  end
end

function V.build()
  ensure_bufs()
  local cur = state.S.current_topic
  local w = api.nvim_get_current_win()
  api.nvim_win_set_buf(w, chat.thread_buf(cur))
  V.win.thread = w
  V.win.topics = api.nvim_open_win(V.topics_buf, false, { split = 'left', win = w, width = 34 })
  V.win.board = api.nvim_open_win(V.board_buf, false, { split = 'right', win = w, width = 44 })
  V.win.composer = api.nvim_open_win(chat.composer(cur), false, { split = 'below', win = w, height = 6 })
  for _, win in ipairs({ V.win.topics, V.win.board }) do
    vim.wo[win].winfixwidth = true
    vim.wo[win].wrap = false
    vim.wo[win].cursorline = true
    vim.wo[win].number = false
    vim.wo[win].signcolumn = 'no'
  end
  vim.wo[V.win.board].wrap, vim.wo[V.win.board].breakindent = true, true
  vim.wo[w].wrap, vim.wo[w].linebreak, vim.wo[w].breakindent = true, true, true
  vim.wo[V.win.composer].winfixheight = true
  vim.wo[V.win.composer].wrap = true
  chat.view(cur)
  V.render()
  chat.to_tail(w)
  api.nvim_set_current_win(V.win.composer)
end

function V.open_topic(id)
  chat.view(id)
  if not valid(V.win.thread) then
    return
  end
  api.nvim_win_set_buf(V.win.thread, chat.thread_buf(id))
  chat.to_tail(V.win.thread)
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
  if role == 'topics' then
    return '%#ClandBar# TOPICS %* %#ClandDim#' .. #state.S.topics .. ' · needs you on top%*'
  elseif role == 'board' then
    return '%#ClandBar# SESSIONS %* %#ClandDim#' .. #state.S.sessions .. ' · state from the adapters%*'
  end
end

function V.statusline()
  local left = app().stl_left()
  local t = state.current()
  left[#left + 1] = { ' ' .. chat.label(t, 40) .. ' ', 'StatusLine' }
  local needs = #state.needs_you()
  local coord = state.holder('Coordinator')
  local right = {
    { needs > 0 and (' ● needs you ' .. needs .. ' ') or ' nothing needs you ', needs > 0 and 'ClandWaitYouBar' or 'ClandDimBar' },
    { ' unread ' .. state.unread_total() .. ' ', 'ClandDimBar' },
  }
  if coord then
    local st = sessions.st(coord)
    right[#right + 1] = { ' Coordinator ' .. coord.name .. ' ' .. st.icon .. ' ' .. coord.state .. ' ', st.hl .. 'Bar' }
  else
    right[#right + 1] = { ' ⚠ no coordinator ', 'ClandWarn' }
  end
  return left, right
end

return V
