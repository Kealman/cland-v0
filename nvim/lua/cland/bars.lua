-- The bars (spec section 5). The top bar is the tabline: one full-width row, no window to guard against
-- focus, `:only` or CTRL-W. It shows the project, the centre view's title, the Coordinator chip with its
-- state (or "no coordinator"), the "needs you" count and the sessions count. The status line (global,
-- `laststatus=3`) shows the mode, the centre view's context, the hub's state, the sessions and key
-- hints. Every window's winbar is its panel header.
local api = vim.api
local state = require('cland.state')
local hl = require('cland.hl')

local M = {}

--- {text, hl, click} chunks as a statusline-format string.
function M.stl(chunks)
  local out = {}
  for _, c in ipairs(chunks) do
    local piece = '%#' .. (c[2] or 'StatusLine') .. '#' .. tostring(c[1]):gsub('%%', '%%%%')
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

-- The longest character prefix within a display-cell budget; wrapping uses the same fitter.
local function prefix(text, cells)
  if cells <= 0 then return '' end
  local low, high = 0, vim.fn.strchars(text)
  while low < high do
    local mid = math.ceil((low + high) / 2)
    if api.nvim_strwidth(vim.fn.strcharpart(text, 0, mid)) <= cells then low = mid else high = mid - 1 end
  end
  return vim.fn.strcharpart(text, 0, low)
end
M.prefix = prefix

-- Fit styled chunks to display cells, including the ellipsis in the same budget.
local function fit(chunks, cells)
  if cells <= 0 then return {} end
  if width(chunks) <= cells then return chunks end
  local ellipsis = { '…', 'ClandDimBar' }
  if cells < width({ ellipsis }) then return {} end
  local out, remaining = {}, cells - width({ ellipsis })
  for _, chunk in ipairs(chunks) do
    local text = tostring(chunk[1])
    local size = api.nvim_strwidth(text)
    if size <= remaining then
      out[#out + 1] = chunk
      remaining = remaining - size
    else
      out[#out + 1] = { prefix(text, remaining), chunk[2], chunk[3] }
      break
    end
  end
  out[#out + 1] = ellipsis
  return out
end

M.fit = fit

local function views()
  return require('cland.views')
end

-- Top bar ---------------------------------------------------------------------------------------------

function M.topbar()
  local S = state.S
  local left = {
    { ' cland ', 'ClandBrand' },
    { S.project .. ' ', 'ClandDimBar' },
    { '│ ', 'ClandFaintBar' },
    { views().title(S.ui.view), 'ClandTextBar' },
  }
  local release = require('cland.items').current_release()
  if release then
    table.insert(left, 3, { ' ' .. release.title .. ' ', 'ClandTextChip' })
  end
  local right = {}
  local coord = state.coordinator()
  if coord then
    local st = hl.SESSION[coord.state] or hl.SESSION.unknown
    local words = st[3]
    if state.reliability(coord) == 'heuristic' then
      words = words .. ' (heuristic)'
    end
    right[#right + 1] = { ' ', 'ClandChip', 1 }
    right[#right + 1] = { st[1], st[2] .. 'Chip', 1 }
    right[#right + 1] = { ' ' .. coord.name .. ' ', 'ClandTextChip', 1 }
    local meta = 'Coordinator · '
    if vim.o.columns >= 150 and coord.harness then
      meta = meta .. (require('cland.panels').HARNESS[coord.harness] or coord.harness) .. (coord.model and (' · ' .. coord.model) or '') .. ' · '
    end
    right[#right + 1] = { meta .. words .. ' ', 'ClandDimChip', 1 }
  else
    right[#right + 1] = { ' ▲ no coordinator · messages queue in the hub ', 'ClandChipWarn', 1 }
  end
  local coordinator = right
  right = {}
  local n = state.needs_you()
  if n == nil then
    right[#right + 1] = { ' needs you ', 'ClandDimChip', 2 }
  elseif n > 0 then
    right[#right + 1] = { ' ▲', 'ClandAmberChip', 2 }
    right[#right + 1] = { ' needs you ', 'ClandTextChip', 2 }
    right[#right + 1] = { ' ' .. n .. ' ', 'ClandChipBadge', 2 }
  else
    right[#right + 1] = { ' ✓ needs you 0 ', 'ClandGreenChip', 2 }
  end
  local needs = right
  right = {}
  local c = state.counts()
  right[#right + 1] = { ' sessions ', 'ClandTextChip', 3 }
  right[#right + 1] = { ' ' .. c.now .. ' ', 'ClandChipBadgeN', 3 }
  if c.waiting > 0 then
    right[#right + 1] = { ' ' .. c.waiting .. '▲', 'ClandAmberChip', 3 }
  end
  right[#right + 1] = { ' ', 'ClandChip', 3 }
  right[#right + 1] = { ' ', 'TabLineFill' }
  -- Preserve the counts first; a long Coordinator label consumes only the cells left over.
  local remaining = math.max(0, vim.o.columns - 1)
  local sessions = fit(right, remaining)
  remaining = remaining - width(sessions)
  needs = fit(needs, remaining - 2)
  if #needs > 0 then remaining = remaining - width(needs) - 2 end
  coordinator = fit(coordinator, remaining - 2)
  right = {}
  for _, segment in ipairs({ coordinator, needs, sessions }) do
    if #segment > 0 then
      if #right > 0 then right[#right + 1] = { '  ', 'TabLineFill' } end
      vim.list_extend(right, segment)
    end
  end
  left = fit(left, math.max(0, vim.o.columns - 1 - width(right)))
  return M.stl(left) .. '%#TabLineFill#%=' .. M.stl(right)
end

--- The top bar's chips are clickable: the Coordinator attaches it, "needs you" opens the inbox,
--- "sessions" the sessions panel.
function _G.ClandTopClick(minwid)
  vim.schedule(function()
    local layout = require('cland.layout')
    local ui = state.S.ui
    if minwid == 1 then
      local coord = state.coordinator()
      if coord then
        layout.show({ kind = 'session', id = coord.name }, { insert = true })
      elseif ui.right ~= 'sessions' then
        layout.right_panel('sessions')
      end
    elseif minwid == 2 and ui.right ~= 'inbox' then
      layout.right_panel('inbox')
    elseif minwid == 3 and ui.right ~= 'sessions' then
      layout.right_panel('sessions')
    end
  end)
end

-- Status line -----------------------------------------------------------------------------------------

--- The centre view's context: the left part of the status line, always naming the view.
function M.context()
  local v = state.S.ui.view
  local title = views().title(v)
  if v.kind == 'thread' then
    if v.id == 'agents' then
      return 'Agents · topic · agent-to-agent messages'
    end
    local coord = state.coordinator()
    local t = state.topic(v.id)
    local status = t and t.status or 'open'
    local item = t and t.item and t.item ~= vim.NIL and (' · ' .. t.item) or ''
    return title .. item .. ' · topic ' .. status .. ' · to @coordinator' .. (coord and (' (' .. coord.name .. ')') or ' (vacant: the hub queues)')
  elseif v.kind == 'session' then
    local s = state.session(v.id)
    local t = require('cland.sessions').term(v.id)
    local how = t and 'attached' or 'not attached'
    if not s then
      return v.id .. ' · session · ' .. how
    end
    return v.id .. ' · session · ' .. how .. ' · ' .. (s.live and s.state or 'down') .. (s.item and (' · ' .. s.item) or '')
  elseif v.kind == 'plan' then
    return v.id .. ' · epic plan'
  elseif v.kind == 'item' then
    local it = state.item(v.id)
    return v.id .. ' · item' .. (it and (' · ' .. it.state .. (it.claim and (' · claim ' .. it.claim.session) or '')) or '')
  elseif v.kind == 'board' then
    return 'Board · ' .. #state.S.items .. ' items'
  elseif v.kind == 'graph' then
    local id = require('cland.graph').parent()
    return 'Graph' .. (id and (' · ' .. id) or '') .. ' · experimental'
  elseif v.kind == 'log' then
    return 'Agents log'
  elseif v.kind == 'inbox' then
    local n = state.needs_you()
    return 'Inbox · full width' .. (n ~= nil and (' · ' .. n .. ' need you') or '')
  end
  return title
end

local MODES = {
  n = { ' NORMAL ', 'ClandModeN' },
  i = { ' INSERT ', 'ClandModeI' },
  t = { ' TERMINAL ', 'ClandModeT' },
  c = { ' COMMAND ', 'ClandModeN' },
  v = { ' VISUAL ', 'ClandModeN' },
  V = { ' V-LINE ', 'ClandModeN' },
  nt = { ' NORMAL ', 'ClandModeN' },
}

local HUB_WORDS = {
  connected = { 'hub: connected', 'ClandDimBar' },
  connecting = { 'hub: connecting', 'ClandAmberBar' },
  starting = { 'hub: starting', 'ClandAmberBar' },
  disconnected = { 'hub: reconnecting', 'ClandAmberBar' },
  waiting = { 'hub: none running', 'ClandAmberBar' },
  failed = { 'hub: failed', 'ClandRedBar' },
  refused = { 'hub: refused', 'ClandRedBar' },
}

function M.status()
  local mode = api.nvim_get_mode().mode
  local m = MODES[mode] or MODES[mode:sub(1, 1)] or { ' ' .. mode .. ' ', 'ClandModeN' }
  local hub = HUB_WORDS[state.S.hub.state] or { 'hub: ' .. state.S.hub.state, 'ClandDimBar' }
  local c = state.counts()
  local context_suffix = {
    { '│ ', 'ClandFaintBar' },
    hub,
  }
  if state.S.ui.preset then
    context_suffix[#context_suffix + 1] = { ' │ ', 'ClandFaintBar' }
    context_suffix[#context_suffix + 1] = { 'preset ' .. state.S.ui.preset, 'ClandBlueBar' }
  end
  local hint
  local role = vim.b.cland_role
  if mode == 't' then
    hint = 'C-h/j/k/l focus · C-\\ leaves · then ␣␣ back'
  elseif role == 'composer' and mode == 'i' then
    hint = 'Enter sends · S-Enter newline · Esc leaves'
  elseif role == 'inbox' or role == 'inbox_full' then
    hint = '1-9 answer · i free answer · za more · ↵ open · d dismiss · D all'
  else
    hint = '␣i ␣s ␣t ␣n panels · ␣p palette · ␣␣ back · gi gt gs'
  end
  -- Allocate once in priority order, independently of the segments' visual order.
  local remaining = math.max(0, vim.o.columns - 1)
  local separator = { ' │ ', 'ClandFaintBar' }
  local gap = width({ separator })
  local answer = fit({ { hint, 'ClandDimBar' } }, remaining)
  remaining = remaining - width(answer)
  local function take(chunks)
    local fitted = fit(chunks, remaining - gap)
    if #fitted > 0 then remaining = remaining - width(fitted) - gap end
    return fitted
  end
  local flash = state.S.flash
  local notice = flash and vim.uv.now() - flash.at < 8000 and take({ { flash.text, flash.group } }) or {}
  -- Within the context budget, shorten the view title before mode/hub/preset metadata.
  local context = { m }
  vim.list_extend(context, fit({ { ' ' .. M.context() .. ' ', 'ClandTextBar' } },
    remaining - gap - width(context) - width(context_suffix)))
  vim.list_extend(context, context_suffix)
  context = take(context)
  local counts = { { ('sessions: %d busy · %d waiting · %d idle'):format(c.busy, c.waiting, c.idle), 'ClandDimBar' } }
  counts = width(counts) <= remaining - gap and take(counts) or {}
  local left = {}
  for _, segment in ipairs({ context, counts, notice }) do
    if #segment > 0 then
      if #left > 0 then left[#left + 1] = separator end
      vim.list_extend(left, segment)
    end
  end
  if #left > 0 then left[#left + 1] = separator end
  return M.stl(left) .. '%#StatusLine#%=' .. M.stl(answer) .. ' '
end

-- Winbars: the panel headers ----------------------------------------------------------------------------

local function head(win, label, right)
  local focused = win == api.nvim_get_current_win()
  return M.stl({ { ' ' .. label .. ' ', focused and 'ClandHeadFocus' or 'ClandHead' } }) .. '%<%#WinBar#%=' .. M.stl(right or {}) .. '%#WinBar# '
end

--- The thread header's right side (spec 4.5): the binding, the warning, the status.
function M.thread_marks(t)
  if not t then
    return { { 'topic', 'ClandDimBar' } }
  end
  local out = { { #require('cland.artifacts').all(t.id) .. ' artifacts · ga  ', 'ClandBlueBar' } }
  if t.item and t.item ~= vim.NIL then
    out[#out + 1] = { t.item .. '  ', 'ClandBlueBar' }
  end
  local warning = state.warning(t)
  if warning then
    out[#out + 1] = { '▲ ' .. warning .. '  ', 'ClandRedBar' }
  end
  local status = t.status or 'open'
  local group = status == 'waiting for human' and 'ClandAmberBar' or (status == 'closed' and 'ClandDimBar' or 'ClandTealBar')
  out[#out + 1] = { status == 'waiting for human' and 'waiting for you' or ('topic ' .. status), group }
  return out
end

function M.winbar(win)
  local buf = api.nvim_win_get_buf(win)
  local role = vim.b[buf].cland_role
  if role == 'graph' then return require('cland.graph').winbar(win) end
  if role == 'items' then
    return head(win, 'ITEMS', { { require('cland.items').summary(), 'ClandDimBar' } })
  elseif role == 'sessions' then
    local c = state.counts()
    if state.S.crew and state.S.crew.summary then
      return head(win, 'SESSIONS', { { state.S.crew.summary, 'ClandDimBar' } })
    end
    return head(win, 'SESSIONS', { { c.live .. ' live · ' .. c.waiting .. ' waiting' .. (c.down > 0 and (' · ' .. c.down .. ' down') or ''), 'ClandDimBar' } })
  elseif role == 'topics' then
    local unread = state.unread_total()
    return head(win, 'TOPICS', { { #state.S.topics .. ' topics' .. (unread > 0 and (' · ' .. unread .. ' unread') or ''), 'ClandDimBar' } })
  elseif role == 'inbox' then
    local n = state.needs_you()
    return head(win, 'INBOX', n == nil and {} or { n > 0 and { n .. ' need you', 'ClandAmberBar' } or { 'nothing needs you', 'ClandGreenBar' } })
  elseif role == 'artifacts' then
    return head(win, 'ARTIFACTS · ' .. tostring(vim.b[buf].cland_topic), { { '↵ open/fold · n new · s attach · x delete · q back', 'ClandDimBar' } })
  elseif role == 'artifact' then
    local a = require('cland.artifacts').get(vim.b[buf].cland_artifact)
    if a and a.kind == 'prompt' and a.status == 'draft' then
      return head(win, a.id .. ' · draft', { { ':w saves · ␣ps send · ␣pa attach · q back', 'ClandDimBar' } })
    end
    return head(win, tostring(vim.b[buf].cland_artifact), { { ':w saves · R render Mermaid · q back', 'ClandDimBar' } })
  elseif role == 'thread' then
    local t = state.topic(vim.b[buf].cland_topic)
    local marks = M.thread_marks(t)
    local thread = require('cland.thread').by_buf[buf]
    local count = thread and thread:folded_count(win) or 0
    if count > 0 then table.insert(marks, 1, { count .. ' folded · zR  ', 'ClandDimBar' }) end
    return head(win, (t and t.title or vim.b[buf].cland_topic or '') .. ' · to @coordinator', marks)
  elseif role == 'composer' then
    local tv = views().topics[vim.b[buf].cland_topic]
    local answering = tv and tv.composer.answering
    if answering then
      return head(win, 'answer to: ' .. answering.question, { { 'Enter sends the answer', 'ClandAmberBar' } })
    end
    local attached = tv and tv.composer.attachments or {}
    local attachments = #attached > 0 and ('attached: ' .. table.concat(attached, ', ') .. ' · :Cland attachments clear · ') or ''
    local coord = state.coordinator()
    return head(win, 'to: Coordinator' .. (coord and (' (' .. coord.name .. ')') or ' (vacant: the hub queues it)'), { { attachments .. 'Enter sends · S-Enter newline', 'ClandDimBar' } })
  elseif role == 'session' then
    local name = vim.b[buf].cland_session
    local s = state.session(name)
    if not s then
      return head(win, name or 'session')
    end
    local g, ghl = require('cland.panels').session_glyph(s)
    return head(win, s.label, { { g .. ' ' .. require('cland.panels').session_meta(s), ghl .. 'Bar' }, { s.item and (' · ' .. s.item) or '', 'ClandDimBar' } })
  elseif role == 'log' then
    return head(win, 'AGENTS' .. require('cland.agents_log').filter_label(), { { #require('cland.artifacts').all('agents') .. ' artifacts · ga  ', 'ClandBlueBar' }, { 'f filter · F clear · r reply', 'ClandDimBar' } })
  elseif role == 'plan' then
    return head(win, views().title({kind='plan', id=vim.b[buf].cland_item}):upper(), { { 'a approve · d discuss · e edit', 'ClandDimBar' } })
  elseif role == 'item' then
    return head(win, views().title({kind='item', id=vim.b[buf].cland_item}):upper(), { { '␣␣ back', 'ClandDimBar' } })
  elseif role == 'board' or role == 'inbox_full' then
    return head(win, views().title(state.S.ui.view):upper(), { { '␣␣ back', 'ClandDimBar' } })
  end
  return ''
end

function _G.ClandTopBar()
  local ok, res = pcall(M.topbar)
  return ok and res or (' top bar error: ' .. tostring(res):gsub('%%', '%%%%'))
end

function _G.ClandStatus()
  local ok, res = pcall(M.status)
  return ok and res or (' status line error: ' .. tostring(res):gsub('%%', '%%%%'))
end

function _G.ClandWinbar()
  local ok, res = pcall(M.winbar, vim.g.statusline_winid)
  return ok and res or (' winbar error: ' .. tostring(res):gsub('%%', '%%%%'))
end

function M.setup()
  vim.o.tabline = '%!v:lua.ClandTopBar()'
  vim.o.showtabline = 2
  vim.o.laststatus = 3
  vim.o.statusline = '%!v:lua.ClandStatus()'
  vim.o.winbar = '%!v:lua.ClandWinbar()'
end

function M.redraw()
  pcall(vim.cmd, 'redrawstatus!')
  pcall(vim.cmd, 'redrawtabline')
end

return M
