-- PROTOTYPE (ticket #15, workbench): the bars. The top bar is the tabline
-- (one full-width row, no extra window to guard): project, the centre view,
-- the Coordinator chip with its state, "needs you" and the sessions count.
-- The bottom bar is the global statusline: mode, the centre view's
-- context, hub state, sessions, key hints. Every window's winbar is its
-- panel header (the ".ph" rows of the design).
local api = vim.api
local state = require('cland_proto.state')
local hl = require('cland_proto.hl')
local M = {}

-- {text, hl, click} chunks -> a statusline-format string
function M.stl(chunks)
  local out = {}
  for _, c in ipairs(chunks) do
    local text = tostring(c[1]):gsub('%%', '%%%%')
    local piece = '%#' .. (c[2] or 'StatusLine') .. '#' .. text
    if c[3] then
      piece = '%' .. c[3] .. '@v:lua.ClandTopClick@' .. piece .. '%X'
    end
    out[#out + 1] = piece
  end
  return table.concat(out)
end

local function width(chunks)
  local w = 0
  for _, c in ipairs(chunks) do
    w = w + api.nvim_strwidth(tostring(c[1]))
  end
  return w
end

function M.view_title()
  local v = state.S.ui.view
  if v.kind == 'thread' then
    local t = state.topic(v.id)
    return t and require('cland_proto.chat').label(t) or v.id
  elseif v.kind == 'board' then
    local s = state.S.ui.board_scope
    return 'Board · ' .. (s == 'all' and 'all epics' or (s .. ' ' .. state.item(s).title))
  elseif v.kind == 'item' then
    local it = state.item(v.id)
    return it and (it.id .. ' ' .. it.title) or v.id
  elseif v.kind == 'session' then
    local s = state.session(v.id)
    return s and (s.name .. ' [' .. s.role .. '] · ' .. (state.live(s) and 'attached' or s.state)) or v.id
  elseif v.kind == 'inbox' then
    return 'Inbox · full width'
  end
  return ''
end

-- Top bar ------------------------------------------------------------------

function M.topbar()
  local S = state.S
  local cols = vim.o.columns
  local left = {
    { ' cland ', 'ClandTitleBar' }, { S.project .. ' ', 'ClandDimBar' }, { '│ ', 'ClandFaintBar' },
    { M.view_title(), 'ClandTextBar' },
  }
  local right = {}
  local coord = state.holder('Coordinator')
  if coord then
    local st = hl.SESSION[coord.state] or hl.SESSION.unknown
    right[#right + 1] = { ' ', 'ClandChip', 1 }
    right[#right + 1] = { st[1], st[2] .. 'Chip', 1 }
    right[#right + 1] = { ' ' .. coord.name .. ' ', 'ClandTextChip', 1 }
    local meta = cols >= 170 and ('Coordinator · ' .. coord.harness .. ' · ' .. coord.model .. ' · ' .. st[3]) or ('Coordinator · ' .. st[3])
    right[#right + 1] = { meta .. ' ', 'ClandDimChip', 1 }
  else
    right[#right + 1] = { ' ⚠ no coordinator · messages queue in the hub ', 'ClandChipWarn', 1 }
  end
  right[#right + 1] = { '  ', 'TabLineFill' }
  local n = state.needs_you().count
  if n > 0 then
    right[#right + 1] = { ' ', 'ClandChip', 2 }
    right[#right + 1] = { '▲', 'ClandAmberChip', 2 }
    right[#right + 1] = { ' needs you ', 'ClandTextChip', 2 }
    right[#right + 1] = { ' ' .. n .. ' ', 'ClandChipBadge', 2 }
    right[#right + 1] = { ' ', 'ClandChip', 2 }
  else
    right[#right + 1] = { ' ✓ nothing needs you ', 'ClandGreenChip', 2 }
  end
  right[#right + 1] = { '  ', 'TabLineFill' }
  local c = state.session_counts()
  right[#right + 1] = { ' sessions ', 'ClandTextChip', 3 }
  right[#right + 1] = { ' ' .. c.live .. ' ', 'ClandChipBadgeN', 3 }
  if c.approval > 0 then
    right[#right + 1] = { ' ' .. c.approval .. '▲', 'ClandAmberChip', 3 }
  end
  if c.down > 0 then
    right[#right + 1] = { ' ' .. c.down .. '✗', 'ClandRedChip', 3 }
  end
  right[#right + 1] = { ' ', 'ClandChip', 3 }
  right[#right + 1] = { ' ', 'TabLineFill' }
  return M.stl(left) .. '%<%#TabLineFill#%=' .. M.stl(right)
end

-- The top bar's chips are clickable: Coordinator, needs you, sessions.
function _G.ClandTopClick(minwid)
  vim.schedule(function()
    local layout = require('cland_proto.layout')
    if minwid == 1 then
      local coord = state.holder('Coordinator')
      if coord then
        layout.show({ kind = 'session', id = coord.name })
      else
        layout.right_panel('sessions')
      end
    elseif minwid == 2 then
      if state.S.ui.right ~= 'inbox' then
        layout.right_panel('inbox')
      end
    elseif minwid == 3 then
      if state.S.ui.right ~= 'sessions' then
        layout.right_panel('sessions')
      end
    end
  end)
end

-- Status line ----------------------------------------------------------------

function M.context()
  local v = state.S.ui.view
  local chat = require('cland_proto.chat')
  if v.kind == 'thread' then
    local t = state.topic(v.id)
    if not t then
      return v.id
    end
    if t.readonly then
      return 'Agents · read-only log · r on a message replies to its sender'
    end
    local st = chat.status(t)
    local it = t.item and state.item(t.item)
    local tail = it and (it.claim and ('claim ' .. it.claim) or 'unclaimed') or ('to @' .. ((state.holder('Coordinator') or {}).role or 'coordinator'):lower())
    return (t.item or t.title) .. ' · topic ' .. st[3]:gsub('^topic ', '') .. ' · ' .. tail
  elseif v.kind == 'board' then
    local n, work = 0, 0
    for _, id in ipairs(state.S.item_order) do
      local it = state.S.items[id]
      if it.kind == 'task' then
        n = n + 1
        work = work + ((it.status == 'progress') and 1 or 0)
      end
    end
    return ('board · %d tasks · %d in progress'):format(n, work)
  elseif v.kind == 'item' then
    local it = state.item(v.id)
    if not it then
      return v.id
    end
    return it.id .. ' · ' .. require('cland_proto.itemview').status_words(it) .. (it.claim and (' · claim ' .. it.claim) or '')
  elseif v.kind == 'session' then
    local s = state.session(v.id)
    return s and (s.name .. ' · ' .. (state.live(s) and ('attached · ' .. s.state) or (s.state .. ' · nothing to attach')) .. (s.item and (' · ' .. s.item) or '')) or v.id
  elseif v.kind == 'inbox' then
    return ('inbox · %d need you · %d notifications'):format(state.needs_you().count, #state.S.notes)
  end
  return ''
end

local MODES = { n = { ' NORMAL ', 'ClandModeN' }, i = { ' INSERT ', 'ClandModeI' }, t = { ' TERMINAL ', 'ClandModeT' },
  c = { ' COMMAND ', 'ClandModeN' }, v = { ' VISUAL ', 'ClandModeN' }, V = { ' V-LINE ', 'ClandModeN' }, nt = { ' NORMAL ', 'ClandModeN' } }

function M.status()
  local mode = api.nvim_get_mode().mode
  local m = MODES[mode] or MODES[mode:sub(1, 1)] or { ' ' .. mode .. ' ', 'ClandModeN' }
  local q = state.queued_count()
  local c = state.session_counts()
  local sess = ('sessions: %d busy · %d waiting · %d idle'):format(c.busy, c.waiting, c.idle) .. (c.down > 0 and (' · ' .. c.down .. ' down') or '')
  local left = {
    m, { ' ' .. M.context() .. ' ', 'ClandTextBar' }, { '│ ', 'ClandFaintBar' },
    { 'hub: ok' .. (q > 0 and (' · ' .. q .. ' queued') or ''), q > 0 and 'ClandAmberBar' or 'ClandDimBar' },
    { ' │ ', 'ClandFaintBar' }, { sess, 'ClandDimBar' },
  }
  if state.S.ui.preset then
    left[#left + 1] = { ' │ ', 'ClandFaintBar' }
    left[#left + 1] = { 'preset ' .. state.S.ui.preset .. ' (an example, not a mode)', 'ClandBlueBar' }
  end
  local hint
  local role = vim.b.cland_role
  if mode == 't' then
    hint = 'keys go to the session · C-\\ C-n leaves · then ␣␣ back · gi item · gt topic'
  elseif role == 'session' then
    hint = 'i types into the session · ␣␣ back · gi item · gt topic · ␣? keys'
  elseif role == 'composer' and mode == 'i' then
    hint = 'Enter sends · S-Enter newline · Esc leaves the composer'
  else
    hint = '␣i ␣t ␣s ␣n panels · ␣b board · ␣p pick · ␣g General · gi gt gs · ␣? keys'
  end
  local right = { { hint .. ' ', 'ClandDimBar' } }
  local room = vim.o.columns - width(left) - 2
  if width(right) > room then
    right = { { require('cland_proto.draw').trunc(hint, math.max(0, room - 1)) .. ' ', 'ClandDimBar' } }
  end
  return M.stl(left) .. '%<%#StatusLine#%=' .. M.stl(right)
end

-- Winbars: each window's panel header ----------------------------------------------

local function head(win, label, right_chunks)
  local focused = win == api.nvim_get_current_win()
  local chunks = { { ' ' .. label .. ' ', focused and 'ClandHeadFocus' or 'ClandHead' } }
  return M.stl(chunks) .. '%<%#WinBar#%=' .. M.stl(right_chunks or {}) .. '%#WinBar# '
end

function M.winbar(win)
  local buf = api.nvim_win_get_buf(win)
  local role = vim.b[buf].cland_role
  local chat = require('cland_proto.chat')
  if role == 'items' then
    return head(win, 'ITEMS', { { require('cland_proto.items').summary(), 'ClandDimBar' } })
  elseif role == 'inbox' or role == 'inbox_full' then
    local n = state.needs_you().count
    return head(win, role == 'inbox' and 'INBOX' or 'INBOX · FULL WIDTH',
      { { n > 0 and (n .. (n == 1 and ' needs you' or ' need you')) or 'nothing needs you', n > 0 and 'ClandAmberBar' or 'ClandGreenBar' } })
  elseif role == 'sessions' then
    local c = state.session_counts()
    return head(win, 'SESSIONS', { { c.live .. ' · ' .. c.waiting .. ' waiting' .. (c.down > 0 and (' · ' .. c.down .. ' down') or ''), 'ClandDimBar' } })
  elseif role == 'topics' then
    local unread, topics = state.unread_total()
    return head(win, 'TOPICS', { { #state.S.topics .. ' · ' .. topics .. ' unread', 'ClandDimBar' } })
  elseif role == 'thread' then
    local t = state.topic(vim.b[buf].cland_topic)
    if not t then
      return ''
    end
    local st = chat.status(t)
    local to = t.readonly and 'read-only' or 'to @coordinator'
    local right = { { st[3], st[2] .. 'Bar' } }
    if (t.unread or 0) > 0 then
      right[#right + 1] = { ' · ' .. t.unread .. ' unread', 'ClandDimBar' }
    end
    return head(win, chat.label(t) .. ' · ' .. to, right)
  elseif role == 'composer' then
    local id = vim.b[buf].cland_topic
    local t = state.topic(id)
    if chat.answering[id] then
      return head(win, '→ free answer to ask #' .. chat.answering[id], { { 'Enter sends · C-c cancels', 'ClandDimBar' } })
    end
    local to = chat.addressee(t, '')
    local s = to and state.session(to)
    local label = 'to: ' .. (s and (s.role .. ' (' .. s.name .. ')') or 'Coordinator (vacant: the hub queues it)')
    if t.readonly then
      label = 'reply to: ' .. (s and (s.name .. ' [' .. s.role .. ']') or 'the sender')
    end
    local last = state.last_sent(t)
    local right = {}
    if last then
      local stg = hl.STAGE[last.stage]
      right[#right + 1] = { 'last: ', 'ClandDimBar' }
      right[#right + 1] = { stg[1] .. ' ' .. stg[3] .. ' ' .. state.fmt(last.at), stg[2] .. 'Bar' }
      right[#right + 1] = { '  ', 'ClandDimBar' }
    end
    local wide = api.nvim_win_get_width(win) >= 100
    right[#right + 1] = { wide and '␣a attach artifact · ␣o open as prompt artifact' or '␣a attach · ␣o prompt artifact', 'ClandDimBar' }
    return head(win, label, right)
  elseif role == 'board' then
    local s = state.S.ui.board_scope
    return head(win, 'BOARD · ' .. (s == 'all' and 'ALL EPICS' or s), { { require('cland_proto.board').summary(), 'ClandDimBar' } })
  elseif role == 'item' then
    local it = state.item(vim.b[buf].cland_item)
    if not it then
      return ''
    end
    local words = require('cland_proto.itemview').status_words(it)
    return head(win, (it.id .. ' · ' .. it.kind .. ' · ' .. words):upper(),
      { { 'gt topic · gs session · gb branch · e file · x close · ␣␣ back', 'ClandDimBar' } })
  elseif role == 'session' then
    local s = state.session(vim.b[buf].cland_session)
    if not s then
      return ''
    end
    local st = hl.SESSION[s.state] or hl.SESSION.unknown
    return head(win, s.name .. ' · ' .. s.role .. ' · ' .. s.harness .. ' · ' .. s.model .. ' · ' .. (s.effort or ''),
      { { st[1] .. ' ' .. st[3], st[2] .. 'Bar' }, { s.item and (' · ' .. s.item) or '', 'ClandDimBar' } })
  end
  return ''
end

function _G.ClandTopBar()
  local ok, res = pcall(M.topbar)
  return ok and res or (' top bar error: ' .. tostring(res):gsub('%%', '%%%%'))
end

function _G.ClandStatus()
  local ok, res = pcall(M.status)
  return ok and res or (' statusline error: ' .. tostring(res):gsub('%%', '%%%%'))
end

function _G.ClandWinbar()
  local ok, res = pcall(M.winbar, vim.g.statusline_winid)
  return ok and res or (' winbar error: ' .. tostring(res):gsub('%%', '%%%%'))
end

return M
