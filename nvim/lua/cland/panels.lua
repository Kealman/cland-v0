-- The panels (spec section 5, Main.dc.html): items on the left (␣i); inbox (␣n), sessions (␣s) or topics
-- (␣t) on the right, topics also docked above it (␣T). Each panel is a scratch buffer drawn from the
-- state; a row knows what it shows (item, session, topic), which Enter and the motions read.
--
-- Today: items from `task.list` (the tree, filters and badges are #36); sessions from `session.list` and
-- the connected spokes, their states with the adapter's `heuristic` qualifier; topics from `topic.list`;
-- the inbox is an empty placeholder until asks exist (#33).
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
    local text = c[1]
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

--- What the row under the cursor of `buf` shows: {item=}, {session=} or {topic=}; nil on other rows.
function M.row_at(buf, row)
  local info = (M.rows[buf] or {})[row]
  return info or nil
end

-- Sessions --------------------------------------------------------------------------------------------

--- "Claude Code · opus · waiting for human (heuristic)": the meta line of a session.
function M.session_meta(s)
  local parts = {}
  if s.harness then
    parts[#parts + 1] = M.HARNESS[s.harness] or s.harness
  else
    parts[#parts + 1] = 'not launched by cland'
  end
  if s.model then
    parts[#parts + 1] = s.model
  end
  local st = hl.SESSION[s.live and s.state or (s.status or 'unknown')] or hl.SESSION.unknown
  local words = st[3]
  if s.live and state.reliability(s) == 'heuristic' then
    words = words .. ' (heuristic)'
  end
  parts[#parts + 1] = words
  return table.concat(parts, ' · ')
end

function M.session_glyph(s)
  local st = hl.SESSION[s.live and s.state or (s.status or 'unknown')] or hl.SESSION.unknown
  return st[1], st[2]
end

local function render_sessions(c)
  local list = state.sessions()
  if #list == 0 then
    c:add({ { ' No sessions yet.', 'ClandDim' } })
    c:add({ { ' cland session launch <name> starts one.', 'ClandFaint' } })
  end
  for _, s in ipairs(list) do
    local g, ghl = M.session_glyph(s)
    local down = not s.live
    c:add(
      { { ' ' }, { g, ghl }, { ' ' }, { s.name, down and 'ClandDim' or 'ClandBold' }, { s.label:sub(#s.name + 1), down and 'ClandDim' or 'ClandTeal' } },
      { s.item and { s.item .. ' ', 'ClandTeal' } or { 'free ', 'ClandFaint' } },
      { session = s.name }
    )
    local meta = '   ' .. M.session_meta(s)
    local mhl = down and 'ClandRed' or 'ClandDim'
    if sw(meta) <= c.width then
      c:add({ { meta, mhl } }, nil, { session = s.name })
    else
      -- too wide for the panel: the state words on a line of their own
      local head, words = meta:match('^(.*) · ([^·]*)$')
      c:add({ { head or meta, mhl } }, nil, { session = s.name })
      if words then
        c:add({ { '   ' .. words, mhl } }, nil, { session = s.name })
      end
    end
  end
  return { ' ↵ attach · gi item · gt topic' }
end

-- Topics ----------------------------------------------------------------------------------------------

local function render_topics(c)
  local v = state.S.ui.view
  local groups = { { 'needs you', {} }, { 'open', {} }, { 'closed', {} } }
  for _, t in ipairs(state.S.topics) do
    local g = t.status == 'waiting for human' and 1 or (t.status == 'closed' and 3 or 2)
    table.insert(groups[g][2], t)
  end
  if #state.S.topics == 0 then
    c:add({ { ' No topics yet (the hub is not connected).', 'ClandDim' } })
  end
  for _, g in ipairs(groups) do
    if #g[2] > 0 then
      c:add({ { ' ' .. g[1]:upper() .. ' · ' .. #g[2], 'ClandSection' } })
      for _, t in ipairs(g[2]) do
        local cur = v.kind == 'thread' and v.id == t.id
        local glyph = t.id == 'agents' and '≡' or (t.status == 'closed' and '○' or '●')
        local ghl = t.status == 'closed' and 'ClandDim' or (t.id == 'agents' and 'ClandDim' or 'ClandTeal')
        c:add({ { cur and '▎' or ' ', 'ClandBlue' }, { glyph, ghl }, { ' ' .. t.title, cur and 'ClandBold' or nil } }, t.id == 'agents' and { { 'log ', 'ClandFaint' } } or nil, { topic = t.id })
      end
    end
  end
  return { ' ↵ open · gi item · gs session' }
end

-- Items -----------------------------------------------------------------------------------------------

local function render_items(c)
  if #state.S.items == 0 then
    c:add({ { ' ' .. (state.S.items_note or 'No items in .cland/tasks yet.'), 'ClandDim' } })
  end
  for _, it in ipairs(state.S.items) do
    local g = it.state == 'closed' and hl.ITEM.closed or (it.claim and hl.ITEM.claimed or hl.ITEM.open)
    c:add(
      { { ' ' }, { g[1], g[2] }, { ' ' }, { it.id, 'ClandDim' }, { ' ' .. it.title, it.state == 'closed' and 'ClandDim' or nil } },
      it.claim and { { it.claim.session .. ' ', 'ClandTeal' } } or nil,
      { item = it.id }
    )
  end
  return { ' ↵ open · gt topic · gs session' }
end

-- Inbox -----------------------------------------------------------------------------------------------

local function render_inbox(c)
  c:add({ { ' ✓ nothing needs you', 'ClandGreen' } })
  c:add({})
  c:add({ { ' Asks, approvals and notifications', 'ClandFaint' } })
  c:add({ { ' come with #33.', 'ClandFaint' } })
  return { ' ␣N full width' }
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
