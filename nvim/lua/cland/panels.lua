-- The panels (spec section 5, Main.dc.html): items on the left (␣i); inbox (␣n), sessions (␣s) or topics
-- (␣t) on the right, topics also docked above it (␣T). Each panel is a scratch buffer drawn from the
-- state; a row knows what it shows (item, session, topic), which Enter and the motions read.
--
-- Items from `task.list` and the `task` event (the tree, filters and badges: items.lua); sessions from
-- `session.list` and the connected spokes (#28): name [Role], harness, model, the state with the adapter's
-- `heuristic` qualifier, usage where the adapter reports it, the claimed item; `unknown` once the process is
-- gone. Its keys: l launches, C-v attaches in a split, x stops after a confirmation line, c shows the
-- capability table. Topics from `topic.list`; the inbox (`inbox.lua`, #33).
local api = vim.api
local state = require('cland.state')
local hl = require('cland.hl')

local M = { bufs = {}, rows = {} }
local ns = api.nvim_create_namespace('cland.panels')

M.HARNESS = { ['claude-code'] = 'Claude Code', codex = 'Codex', opencode = 'OpenCode' }

local function sw(s)
  return api.nvim_strwidth(s or '')
end

--- Fit `s` into `n` display columns, with an ellipsis when cut.
local function trunc(s, n)
  if n <= 0 then
    return ''
  end
  if sw(s) <= n then
    return s
  end
  local out, w = {}, 0
  for ch in s:gmatch('[%z\1-\127\194-\244][\128-\191]*') do
    local cw = sw(ch)
    if w + cw > n - 1 then
      break
    end
    out[#out + 1] = ch
    w = w + cw
  end
  return table.concat(out) .. '…'
end

-- A canvas: lines of {text, hl} chunks with an optional right-aligned part, and per-row info.
local Canvas = {}
Canvas.__index = Canvas

local function canvas(width)
  return setmetatable({ width = math.max(10, width), lines = {}, marks = {}, info = {} }, Canvas)
end

function Canvas:add(left, right, info)
  right = right or {}
  local row = #self.lines
  local rw = 0
  for _, c in ipairs(right) do
    rw = rw + sw(c[1])
  end
  local room = self.width - rw - (rw > 0 and 1 or 0)
  local parts, col, used = {}, 0, 0
  local function put(text, group)
    parts[#parts + 1] = text
    if group and #text > 0 then
      self.marks[#self.marks + 1] = { row, col, { end_col = col + #text, hl_group = group } }
    end
    col = col + #text
  end
  for _, c in ipairs(left) do
    -- a row is one buffer line: a hub text over several lines (a note, a title) shows on one
    local text = tostring(c[1]):gsub('\r?\n', ' ')
    if used + sw(text) > room then
      text = trunc(text, room - used)
    end
    put(text, c[2])
    used = used + sw(text)
    if used >= room then
      break
    end
  end
  if rw > 0 then
    put((' '):rep(math.max(1, self.width - used - rw)))
    for _, c in ipairs(right) do
      put(c[1], c[2])
    end
  end
  self.lines[row + 1] = table.concat(parts)
  self.info[row + 1] = info
end

--- Pad with blank lines so the last `keep` lines sit on the window's bottom rows (the footer).
function Canvas:footer_at(height, keep)
  local missing = height - #self.lines
  if missing <= 0 then
    return
  end
  local at = #self.lines - keep
  for _ = 1, missing do
    table.insert(self.lines, at + 1, '')
    table.insert(self.info, at + 1, false)
  end
  for _, m in ipairs(self.marks) do
    if m[1] >= at then
      m[1] = m[1] + missing
    end
  end
end

function Canvas:apply(buf)
  vim.bo[buf].modifiable = true
  api.nvim_buf_set_lines(buf, 0, -1, false, self.lines)
  vim.bo[buf].modifiable = false
  api.nvim_buf_clear_namespace(buf, ns, 0, -1)
  for _, m in ipairs(self.marks) do
    pcall(api.nvim_buf_set_extmark, buf, ns, m[1], m[2], m[3])
  end
  return self.info
end

M.canvas = canvas

--- What the row under the cursor of `buf` shows: {item=}, {session=} or {topic=}; nil on other rows.
function M.row_at(buf, row)
  local info = (M.rows[buf] or {})[row]
  return info or nil
end

-- Sessions --------------------------------------------------------------------------------------------

--- "$1.80" or "12.3k tok": the session's running total (cost first), or nil.
function M.usage_text(u)
  if type(u) ~= 'table' or type(u.total) ~= 'table' then
    return nil
  end
  local cost = u.total.cost
  if type(cost) == 'number' and cost > 0 then
    return ('$%.2f'):format(cost)
  end
  local tokens = u.total.totalTokens
  if type(tokens) ~= 'number' then
    return nil
  end
  if tokens >= 1000 then
    return ('%.1fk tok'):format(tokens / 1000)
  end
  return ('%d tok'):format(tokens)
end

--- The state in words: "waiting for human (heuristic)" when the adapter's capability table says so, and
--- "unknown · died" or "unknown · stopped" for a launched session whose process is gone.
function M.session_words(s)
  if not s.live then
    return 'unknown · ' .. (s.status == 'stopped' and 'stopped' or 'died')
  end
  local st = hl.SESSION[s.state] or hl.SESSION.unknown
  local words = st[3]
  if state.reliability(s) == 'heuristic' then
    words = words .. ' (heuristic)'
  end
  return words
end

--- The meta line of a session in two parts: "Claude Code · opus" and "waiting for human (heuristic) · $1.80".
function M.session_meta_parts(s)
  local head = {}
  if s.harness then
    head[#head + 1] = M.HARNESS[s.harness] or s.harness
  else
    head[#head + 1] = 'not launched by cland'
  end
  if s.model then
    head[#head + 1] = s.model
  end
  local tail = M.session_words(s)
  local usage = s.live and M.usage_text(s.usage) or nil
  if usage then
    tail = tail .. ' · ' .. usage
  end
  return table.concat(head, ' · '), tail
end

--- "Claude Code · opus · waiting for human (heuristic)": the meta line of a session.
function M.session_meta(s)
  local head, tail = M.session_meta_parts(s)
  return head .. ' · ' .. tail
end

function M.session_glyph(s)
  local st = hl.SESSION[s.live and s.state or (s.status or 'unknown')] or hl.SESSION.unknown
  return st[1], st[2]
end

--- `text` cut into lines of at most `width` columns, at spaces where it can be.
function M.wrap(text, width)
  local out, line = {}, ''
  for word in tostring(text):gmatch('%S+') do
    while sw(word) > width do
      if line ~= '' then
        out[#out + 1] = line
        line = ''
      end
      local head = vim.fn.strcharpart(word, 0, width)
      out[#out + 1] = head
      word = vim.fn.strcharpart(word, vim.fn.strchars(head))
    end
    if line == '' then
      line = word
    elseif sw(line) + 1 + sw(word) <= width then
      line = line .. ' ' .. word
    else
      out[#out + 1] = line
      line = word
    end
  end
  if line ~= '' then
    out[#out + 1] = line
  end
  return out
end

--- A notice on lines of its own, wrapped to the panel.
local function wrapped(c, text, group)
  for _, l in ipairs(M.wrap(text, c.width - 2)) do
    c:add({ { ' ' .. l, group } })
  end
end

local function render_sessions(c)
  local list = state.sessions()
  local confirm = state.S.ui.confirm
  if confirm then
    wrapped(c, 'stop ' .. confirm.session .. '? y stops it · n keeps it', 'ClandAmber')
    c:add({})
  end
  local note = state.S.sessions_note
  if note then
    wrapped(c, note.text, note.group)
    c:add({})
  end
  if #list == 0 then
    c:add({ { ' No sessions yet.', 'ClandDim' } })
    c:add({ { ' l (or ␣l) launches one.', 'ClandFaint' } })
  end
  for _, s in ipairs(list) do
    local g, ghl = M.session_glyph(s)
    local down = not s.live
    local label = s.label or s.name
    local role = label:sub(#s.name + 1)
    c:add(
      { { ' ' }, { g, ghl }, { ' ' }, { s.name, down and 'ClandDim' or 'ClandBold' }, { role, down and 'ClandDim' or 'ClandTeal' } },
      { s.item and { s.item .. ' ', 'ClandTeal' } or { 'free ', 'ClandFaint' } },
      { session = s.name }
    )
    local head, tail = M.session_meta_parts(s)
    local mhl = down and 'ClandRed' or 'ClandDim'
    local meta = '   ' .. head .. ' · ' .. tail
    if sw(meta) <= c.width then
      c:add({ { meta, mhl } }, nil, { session = s.name })
    else
      -- too wide for the panel: the state words on a line of their own
      c:add({ { '   ' .. head, mhl } }, nil, { session = s.name })
      c:add({ { '   ' .. tail, mhl } }, nil, { session = s.name })
    end
  end
  return { ' ↵ attach · C-v split · c capabilities', ' l launch · x stop · gi item · gt topic' }
end

-- Topics ----------------------------------------------------------------------------------------------

--- A topic's glyph and its colour (spec 4.5): amber when it waits for the human, teal while open, the half
--- glyph while it waits for an agent, a hollow one when closed; Agents is a log.
function M.topic_glyph(t)
  if t.id == 'agents' then
    return '≡', 'ClandDim'
  elseif t.status == 'waiting for human' then
    return '●', 'ClandAmber'
  elseif t.status == 'waiting for agent' then
    return '◐', 'ClandTeal'
  elseif t.status == 'closed' then
    return '○', 'ClandDim'
  end
  return '●', 'ClandTeal'
end

--- The right side of a topic's row: the warning glyph, then the unread badge (amber when it needs the human).
function M.topic_marks(t)
  local right = {}
  if state.warning(t) then
    right[#right + 1] = { '▲', 'ClandRed' }
  end
  local n = tonumber(t.unread) or 0
  if n > 0 then
    if #right > 0 then
      right[#right + 1] = { ' ' }
    end
    right[#right + 1] = { ' ' .. n .. ' ', t.status == 'waiting for human' and 'ClandBadge' or 'ClandBadgeN' }
  elseif t.id == 'agents' then
    right[#right + 1] = { 'log', 'ClandFaint' }
  end
  if #right > 0 then
    right[#right + 1] = { ' ' }
  end
  return right
end

local function render_topics(c)
  local v = state.S.ui.view
  if #state.S.topics == 0 then
    c:add({ { ' No topics yet (the hub is not connected).', 'ClandDim' } })
  end
  for _, g in ipairs(state.topic_groups()) do
    if #g.topics > 0 then
      c:add({ { ' ' .. g.name:upper() .. ' · ' .. #g.topics, g.name == 'needs you' and 'ClandAmber' or 'ClandSection' } })
      for _, t in ipairs(g.topics) do
        local cur = v.kind == 'thread' and v.id == t.id
        local glyph, ghl = M.topic_glyph(t)
        local left = { { cur and '▎' or ' ', 'ClandBlue' }, { glyph, ghl }, { ' ' } }
        -- the binding, unless the title already says it
        if t.item and t.item ~= vim.NIL and not tostring(t.title):find(t.item, 1, true) then
          left[#left + 1] = { t.item .. ' ', 'ClandDim' }
        end
        left[#left + 1] = { t.title, cur and 'ClandBold' or (t.status == 'closed' and 'ClandDim' or nil) }
        c:add(left, M.topic_marks(t), { topic = t.id })
      end
    end
  end
  return { ' ↵ open · n new · c close · r resolve' }
end

-- Items -----------------------------------------------------------------------------------------------

-- the tree, the filters and the badges live in items.lua (#36)
local function render_items(c)
  return require('cland.items').render(c)
end

-- Inbox -----------------------------------------------------------------------------------------------

local function render_inbox(c)
  return require('cland.inbox').render(c, false)
end

local RENDER = { sessions = render_sessions, topics = render_topics, items = render_items, inbox = render_inbox }

--- Open the row under the cursor in the centre: a session attaches (Terminal mode), a topic opens its
--- thread, an item its view.
local function open_row(buf)
  local info = M.row_at(buf, api.nvim_win_get_cursor(0)[1])
  if not info then
    return
  end
  local layout = require('cland.layout')
  if info.session then
    layout.show({ kind = 'session', id = info.session }, { insert = true })
  elseif info.topic then
    layout.show({ kind = 'thread', id = info.topic }, { insert = false })
  elseif info.item then
    layout.show({ kind = 'item', id = info.item }, { insert = false })
  end
end

--- The sessions panel's own keys: l launches, C-v attaches in a split, x stops after a confirmation line
--- in the panel, c shows the adapter's capability table.
function M.session_keys(b)
  local function on_row(fn)
    return function()
      local info = M.row_at(b, api.nvim_win_get_cursor(0)[1])
      if info and info.session then
        fn(info.session)
      end
    end
  end
  local function map(lhs, fn, desc)
    vim.keymap.set('n', lhs, fn, { buffer = b, nowait = true, silent = true, desc = 'cland: ' .. desc })
  end
  local sessions = require('cland.sessions')
  map('l', function()
    require('cland.launcher').open()
  end, 'launch a session')
  map('<C-v>', on_row(function(name)
    require('cland.layout').show_split({ kind = 'session', id = name })
  end), 'attach in a vertical split')
  map('x', on_row(sessions.ask_stop), 'stop the session (asks first)')
  map('L', on_row(function(name)
    require('cland.agents_log').open({ session = name })
  end), 'Agents log for this session')
  map('c', on_row(sessions.show_capabilities), "the adapter's capability table")
end

--- The buffer of panel `kind` ('items', 'sessions', 'topics', 'inbox'); `slot` names a second buffer of
--- the same kind (the topics dock).
function M.buf(kind, slot)
  local k = kind .. (slot and (':' .. slot) or '')
  local b = M.bufs[k]
  if b and api.nvim_buf_is_valid(b) then
    return b
  end
  b = api.nvim_create_buf(false, true)
  vim.bo[b].bufhidden = 'hide'
  vim.bo[b].modifiable = false
  pcall(api.nvim_buf_set_name, b, 'cland://' .. kind .. (slot and ('-' .. slot) or ''))
  vim.b[b].cland_role = kind
  M.bufs[k] = b
  vim.keymap.set('n', '<CR>', function()
    open_row(b)
  end, { buffer = b, nowait = true, silent = true, desc = 'cland: open in the centre' })
  vim.keymap.set('n', '<2-LeftMouse>', function()
    open_row(b)
  end, { buffer = b, silent = true })
  if kind == 'items' then
    require('cland.items').keys(b)
  elseif kind == 'sessions' then
    M.session_keys(b)
  elseif kind == 'inbox' then
    require('cland.inbox').keys(b)
  elseif kind == 'topics' then
    local views = require('cland.views')
    local function topic_key(lhs, fn, desc)
      vim.keymap.set('n', lhs, fn, { buffer = b, nowait = true, silent = true, desc = 'cland: ' .. desc })
    end
    topic_key('n', views.prompt_topic, 'new topic')
    topic_key('c', function()
      views.close_topic()
    end, 'close the topic')
    topic_key('r', function()
      views.resolve_topic()
    end, 'resolve the topic')
  end
  return b
end

--- Draw panel `kind` into its buffer, sized for `win`.
function M.render(kind, win)
  local b = api.nvim_win_get_buf(win)
  if vim.b[b].cland_role ~= kind then
    return
  end
  local c = canvas(api.nvim_win_get_width(win))
  local footer = RENDER[kind](c)
  c:add({})
  for _, f in ipairs(footer or {}) do
    c:add({ { f, 'ClandFaint' } })
  end
  c:footer_at(vim.fn.winheight(win), #(footer or {}))
  local cur = api.nvim_win_get_cursor(win)
  M.rows[b] = c:apply(b)
  pcall(api.nvim_win_set_cursor, win, { math.min(cur[1], #c.lines), 0 })
  -- a panel whose content fits shows it from its first line (a shrunk window keeps a stale top line)
  if #c.lines <= vim.fn.winheight(win) then
    api.nvim_win_call(win, function()
      vim.fn.winrestview({ topline = 1 })
    end)
  end
end

return M
