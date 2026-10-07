-- PROTOTYPE (ticket #15), variant C "session-centric": the harness terminal
-- is the main surface; the chat is a narrow strip; the bottom bar (the
-- statusline) tracks the last message's delivery stage and the session state.
--
--   +--------------------------------------------------+----------------+
--   | SESSION coord (terminal: canned screen + $SHELL) | THREAD strip   |
--   |                                                  | (compact)      |
--   |                                                  +----------------+
--   |                                                  | COMPOSER       |
--   +--------------------------------------------------+----------------+
--   | last message → coord: queued ─ delivered ─ injected | coord ◐ busy |
local api = vim.api
local state = require('cland_proto.state')
local chat = require('cland_proto.chat')
local sessions = require('cland_proto.sessions')

local V = {
  thread_style = 'compact',
  win = {},
  tagline = 'the session terminal fills the screen; a thread strip on the right; stage and state in the bottom bar',
  help = {
    '<Space>s        sessions picker: the terminal switches, the strip follows that session\'s item',
    '<Space>t        topics picker: only the strip switches',
    'In the terminal i types into the stand-in ($SHELL) · C-\\ C-n back to Normal mode',
    '<C-\\>c          composer of the strip from any mode',
  },
}

local function app()
  return require('cland_proto.app')
end

local function valid(w)
  return w and api.nvim_win_is_valid(w)
end

local function topic_of_item(item)
  for _, t in ipairs(state.S.topics) do
    if item and t.item == item then
      return t.id
    end
  end
end

function V.build()
  local cur = state.S.current_topic
  local w = api.nvim_get_current_win()
  V.win.term = w
  sessions.show_in(w, sessions.active().name)
  local strip = math.max(40, math.min(56, math.floor(vim.o.columns * 0.28)))
  V.win.thread = api.nvim_open_win(chat.thread_buf(cur), false, { split = 'right', win = w, width = strip })
  V.win.composer = api.nvim_open_win(chat.composer(cur), false, { split = 'below', win = V.win.thread, height = 5 })
  vim.wo[V.win.thread].winfixwidth = true
  vim.wo[V.win.thread].wrap, vim.wo[V.win.thread].linebreak, vim.wo[V.win.thread].breakindent = true, true, true
  vim.wo[V.win.composer].winfixheight = true
  vim.wo[V.win.composer].wrap = true
  chat.view(cur)
  chat.to_tail(V.win.thread)
  api.nvim_set_current_win(w)
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
  if not valid(V.win.term) then
    return
  end
  sessions.show_in(V.win.term, name)
  local tid = topic_of_item(state.session(name).item)
  if tid then
    V.open_topic(tid)
  end
  api.nvim_set_current_win(V.win.term)
  state.changed()
end

function V.composer_win()
  return V.win.composer
end

function V.winbar(win, buf, role)
  if role == 'thread' and win == V.win.thread then
    local t = state.topic(vim.b[buf].cland_topic)
    local st = chat.status(t)
    local focused = win == api.nvim_get_current_win()
    return '%#' .. (focused and 'ClandBarFocus' or 'ClandBar') .. '# ' .. st.icon .. ' %* '
      .. chat.label(t, api.nvim_win_get_width(win) - 8):gsub('%%', '%%%%')
  elseif role == 'composer' and win == V.win.composer then
    local id = vim.b[buf].cland_topic
    local t = state.topic(id)
    local to = chat.addressee(t, '')
    local focused = win == api.nvim_get_current_win()
    if chat.answering[id] then
      return '%#ClandBarFocus# ANSWER %* %#ClandAskTitle#↳ free answer%*'
    end
    return '%#' .. (focused and 'ClandBarFocus' or 'ClandBar') .. '# → ' .. (to or 'queued') .. ' %* %#ClandDim#⏎ send · S-⏎ newline%*'
  end
end

local STAGES = { 'queued', 'delivered', 'injected' }

function V.statusline()
  local left = { { ' cland ', 'ClandBrand' } }
  local m = state.S.last_sent
  if m then
    local t = state.topic(state.S.last_sent_topic)
    local where = t and (t.item or chat.label(t, 12)) or '?'
    left[#left + 1] = { (' you → %s · %s '):format(m.to or 'Coordinator (vacant)', where), 'StatusLine' }
    local reached = 0
    for i, s in ipairs(STAGES) do
      if s == m.stage then
        reached = i
      end
    end
    for i, s in ipairs(STAGES) do
      if i > 1 then
        left[#left + 1] = { ' ─ ', i <= reached and 'ClandStageInjectedBar' or 'ClandStagePendingBar' }
      end
      local stg = chat.STAGE[s]
      left[#left + 1] = { (i <= reached and '● ' or '○ ') .. s, i <= reached and (stg.hl .. 'Bar') or 'ClandStagePendingBar' }
    end
    if vim.o.columns >= 190 then
      left[#left + 1] = { '  ' .. state.fmt(m.at) .. ' ', 'ClandDimBar' }
    end
  else
    left[#left + 1] = { ' no message sent yet ', 'ClandDimBar' }
  end
  local s = sessions.active()
  local st = sessions.st(s)
  local role = sessions.ROLE[s.role]
  local needs = #state.needs_you()
  local right = {
    { ' ' .. role.badge .. ' ', role.hl },
    { ' ' .. s.name .. ' ', 'StatusLine' },
    { st.icon .. ' ' .. s.state .. ' ' .. state.ago(s.since) .. ' ', st.hl .. 'Bar' },
    { s.harness .. ' · ' .. s.model .. (s.item and (' · ' .. s.item) or '') .. ' ', 'ClandDimBar' },
    { needs > 0 and (' ● needs you ' .. needs .. ' ') or ' ✓ ', needs > 0 and 'ClandWarn' or 'ClandOpenBar' },
  }
  if not state.holder('Coordinator') then
    table.insert(right, 1, { ' ⚠ no coordinator ', 'ClandWarn' })
  end
  return left, right
end

return V
