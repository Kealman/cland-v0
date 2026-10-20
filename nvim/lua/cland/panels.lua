-- The four panels (spec section 5, Main.dc.html) can occupy either side; topics can also dock above
-- the right side (␣T). Each panel is a scratch buffer drawn from the
-- state; a row knows what it shows (item, session, topic), which Enter and the motions read.
--
-- Items from `task.list` and the `task` event (the tree, filters and badges: items.lua); sessions from
-- `session.list` and session events: waiting/busy/idle groups, a stopped fold, and selected details.
-- State and pending approval commands come from the hub; unknown stays unknown. Its keys: l launches,
-- C-v attaches in a split, x stops after a confirmation line, c shows the
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

-- A canvas: lines of {text, hl} chunks with an optional right-aligned part, and per-row info.
local Canvas = {}
Canvas.__index = Canvas

local function canvas(width)
  return setmetatable({ width = math.max(1, width), lines = {}, marks = {}, info = {} }, Canvas)
end

function Canvas:add(left, right, info)
  local fit = require('cland.bars').fit
  local function single_line(chunks)
    local out = {}
    for _, c in ipairs(chunks or {}) do
      out[#out + 1] = { tostring(c[1]):gsub('[\r\n]', ' '), c[2] }
    end
    return out
  end
  right = fit(single_line(right), self.width)
  local row = #self.lines
  local rw = 0
  for _, c in ipairs(right) do rw = rw + sw(c[1]) end
  local parts, col, used = {}, 0, 0
  local function put(text, group)
    parts[#parts + 1] = text
    if group == 'ClandDimBar' then group = 'ClandDim' end
    if group and #text > 0 then
      self.marks[#self.marks + 1] = { row, col, { end_col = col + #text, hl_group = group } }
    end
    col = col + #text
    used = used + sw(text)
  end
  for _, c in ipairs(fit(single_line(left), self.width - rw - (rw > 0 and 1 or 0))) do
    put(c[1], c[2])
  end
  if rw > 0 then
    put((' '):rep(math.max(0, self.width - used - rw)))
    for _, c in ipairs(right) do put(c[1], c[2]) end
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

--- What a row is, to find it again after a redraw: an item, a session (its second line counts as its row),
--- a fold's line, a section's or a group's header; nil for the rest.
function M.row_key(info)
  if not info then
    return nil
  elseif info.verification then
    return 'verification'
  elseif info.item then
    return 'item:' .. info.item
  elseif info.categories then
    return 'categories'
  elseif info.session then
    return 'session:' .. info.session
  elseif info.fold then
    return 'fold:' .. info.fold
  elseif info.section then
    return 'section:' .. info.section
  elseif info.group then
    return 'group:' .. info.group
  end
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
  if type(s.account) == 'string' and s.account ~= '' and not s.account:match('^default:') then
    head[#head + 1] = s.account
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
  if width <= 0 then return {} end
  if width == 1 then return tostring(text):find('%S') and { '…' } or {} end
  local out, line = {}, ''
  for word in tostring(text):gmatch('%S+') do
    while sw(word) > width do
      if line ~= '' then
        out[#out + 1] = line
        line = ''
      end
      local head = require('cland.bars').prefix(word, width)
      -- Even a character wider than the entire budget must consume input.
      local consumed = math.max(1, vim.fn.strchars(head))
      out[#out + 1] = head ~= '' and head or '…'
      word = vim.fn.strcharpart(word, consumed)
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

--- One line per session: the glyph, the name, the role, the item. The selected one (the cursor's, in the
--- panel) expands its harness, model, state, usage and optional approval command.
local function session_row(c, s, group)
  local sel = state.S.ui.sessions_sel == s.name
  local g, ghl = M.session_glyph(s)
  local down = not s.live
  local label = s.label or s.name
  local role = label:sub(#s.name + 1)
  local items, holds = {}, {}
  if type(s.holds) == 'table' then
    -- A claim keeps the existing rendering; verifier work follows its time order.
    for _, hold in ipairs(s.holds) do
      if hold.role == 'item' then holds[#holds + 1] = hold end
    end
    local verifiers = {}
    for _, hold in ipairs(s.holds) do
      if hold.role == 'review' or hold.role == 'qa' then verifiers[#verifiers + 1] = hold end
    end
    table.sort(verifiers, function(a, b) return (a.heldAt or '') > (b.heldAt or '') end)
    for _, hold in ipairs(verifiers) do holds[#holds + 1] = hold end
    for _, hold in ipairs(holds) do items[#items + 1] = hold.item .. ' ' .. hold.role end
  elseif s.item then
    items[1] = s.item
  end
  local item_text, item_hl = 'free', 'ClandFaint'
  if #items > 0 then
    item_hl = 'ClandTeal'
    if holds[1] and holds[1].role ~= 'item' then
      local suffix = #holds > 1 and (' +' .. (#holds - 1)) or ''
      item_text = items[1] .. suffix
      if sw(item_text) + 1 > c.width then item_text = holds[1].item .. suffix end
    else
      item_text = table.concat(items, ', ')
    end
  elseif type(s.pending) == 'table' and type(s.pending.item) == 'string' then
    item_text = s.pending.item .. ' ' .. s.pending.kind
  end
  c:add(
    { { sel and '▎' or ' ', 'ClandBlue' }, { g, ghl }, { ' ' }, { s.name, down and 'ClandDim' or 'ClandBold' }, { role, down and 'ClandDim' or 'ClandTeal' } },
    { { item_text .. ' ', item_hl } },
    { session = s.name, group = group }
  )
  if not sel then
    return
  end
  for _, hold in ipairs(holds) do
    if hold.role ~= 'item' then
      c:add({ { '   ' .. hold.item .. ' ' .. hold.role, 'ClandDim' } }, nil, { session = s.name, group = group, detail = true })
    end
  end
  local head, tail = M.session_meta_parts(s)
  tail = M.session_words(s)
  local mhl = down and 'ClandRed' or 'ClandDim'
  local meta = '   ' .. head .. ' · ' .. tail
  if sw(meta) <= c.width then
    c:add({ { meta, mhl } }, nil, { session = s.name, group = group, detail = true })
  else
    -- too wide for the panel: the state words on a line of their own
    c:add({ { '   ' .. head, mhl } }, nil, { session = s.name, group = group, detail = true })
    c:add({ { '   ' .. tail, s.state == 'waiting for approval' and 'ClandAmber' or mhl } }, nil, { session = s.name, group = group, detail = true })
  end
  local usage = s.live and M.usage_text(s.usage) or nil
  if usage then
    c:add({ { '   usage ' .. usage, 'ClandDim' } }, nil, { session = s.name, group = group, detail = true })
  end
  if s.state == 'waiting for approval' and type(s.approvalCommand) == 'string' then
    c:add({ { '   run: ' .. s.approvalCommand, 'ClandDim' } }, nil, { session = s.name, group = group, detail = true })
  end
end

local SESSIONS_FOOTER = { ' ↵ attach · C-v split · c capabilities', ' l launch · a Aide · x stop · r resume', ' d archive · za folds · A archive' }

local function render_sessions(c)
  require('cland.accounts').render(c)
  local list = state.sessions(state.S.ui.sessions_archive)
  local queue = state.S.verification
  if type(queue) == 'table' then
    c:add({ { require('cland.verification').summary(), 'ClandDim' } }, nil, { verification = true })
    c:add({})
  end
  local confirm = state.S.ui.confirm
  if confirm then
    if confirm.kind == 'resume' then
      wrapped(c, 'cannot resume ' .. confirm.session .. ': ' .. confirm.reason .. ' · f launches it fresh with its brief · n keeps it stopped', 'ClandAmber')
      if confirm.brief == nil or confirm.brief == vim.NIL then wrapped(c, 'no brief recorded', 'ClandDim') end
    else
      wrapped(c, 'stop ' .. confirm.session .. '? y stops it · n keeps it', 'ClandAmber')
    end
    c:add({})
  end
  local note = state.S.sessions_note
  if note then
    wrapped(c, note.text, note.group)
    c:add({})
  end
  if #list == 0 then
    c:add({ { ' No sessions yet.', 'ClandDim' } })
    c:add({ { ' l launches · a (or ␣A) for an Aide.', 'ClandFaint' } })
    return SESSIONS_FOOTER
  end
  local layers = { now = {}, watch = {}, background = {}, archive = {} }
  for _, s in ipairs(list) do
    -- Older hubs omit the layer: keep their sessions visible without classifying state here.
    local layer = s.archived and 'archive' or require('cland.visibility').layer(s) or 'now'
    table.insert(layers[layer], s)
  end
  for _, layer in ipairs({ 'now', 'watch' }) do
    local groups = { stopped = {} }
    for _, g in ipairs(state.SESSION_GROUPS) do groups[g[1]] = {} end
    for _, s in ipairs(layers[layer]) do table.insert(groups[state.session_group(s)], s) end
    c:add({ { ' ' .. layer:upper() .. ' · ' .. #layers[layer], 'ClandSection' } }, nil, { section = layer })
    local order = vim.list_extend(vim.deepcopy(state.SESSION_GROUPS), { { 'stopped', 'stopped' } })
    for _, g in ipairs(order) do
      local rows = groups[g[1]]
      local default = layer == 'now' and (g[1] == 'waiting' or g[1] == 'busy') or layer == 'watch' and g[1] == 'idle'
      if #rows > 0 or default then
        local group = #rows == 0 and 'ClandFaint' or (g[1] == 'waiting' and 'ClandAmber' or 'ClandSection')
        c:add({ { ' ' .. g[2]:upper() .. ' · ' .. #rows, group } }, nil, { group = layer .. ':' .. g[1] })
        for _, s in ipairs(rows) do session_row(c, s, layer) end
      end
    end
    c:add({})
  end
  local open = not state.folded('stopped')
  c:add({ { ' ' .. (open and '▾ ' or '▸ ') .. 'more (' .. #layers.background .. ') · ' .. state.S.archived_count .. ' archived', 'ClandDim' } }, nil, { fold = 'stopped' })
  if open then
    table.sort(layers.background, function(a, b)
      local at, bt = a.stoppedAt or a.startedAt or '', b.stoppedAt or b.startedAt or ''
      return at == bt and a.name < b.name or at > bt
    end)
    local stopped = 0
    for _, s in ipairs(layers.background) do
      if not s.live then stopped = stopped + 1 end
      if s.live or stopped <= 20 then session_row(c, s, 'background') end
    end
    if stopped > 20 then c:add({ { ' ' .. (stopped - 20) .. ' older', 'ClandDim' } }) end
  end
  if state.S.ui.sessions_archive then
    c:add({})
    c:add({ { ' ARCHIVE · ' .. #layers.archive, 'ClandDim' } }, nil, { section = 'archive' })
    table.sort(layers.archive, function(a, b)
      local at, bt = a.archivedAt or a.startedAt or '', b.archivedAt or b.startedAt or ''
      return at == bt and a.name < b.name or at > bt
    end)
    for _, s in ipairs(layers.archive) do session_row(c, s, 'archive') end
  end
  return SESSIONS_FOOTER
end

--- The cursor selects a session in the panel: on a session's row it selects that session, whose second line
--- shows; moving down onto a second line goes on to the row after it, moving up onto it goes to its
--- session's row, so j and k step from session to session.
function M.sessions_cursor(b)
  local win = api.nvim_get_current_win()
  if api.nvim_win_get_buf(win) ~= b then
    return
  end
  local rows = M.rows[b] or {}
  local row = api.nvim_win_get_cursor(win)[1]
  local prev = M.sessions_row or row
  local info = rows[row]
  if info and info.detail then
    local r, step = row, row > prev and 1 or -1
    while rows[r] and rows[r].detail do
      r = r + step
    end
    r = math.max(1, math.min(r, api.nvim_buf_line_count(b)))
    pcall(api.nvim_win_set_cursor, win, { r, 0 })
    row, info = r, rows[r]
  end
  M.sessions_row = row
  if not (info and info.session and not info.detail) or info.session == state.S.ui.sessions_sel then
    return
  end
  state.S.ui.sessions_sel = info.session
  M.render('sessions', win)
  -- the row moved up when the second line of a session above it went away (rows with nothing on them are
  -- holes in the list: walk the lines)
  local now = M.rows[b] or {}
  for r = 1, api.nvim_buf_line_count(b) do
    local i = now[r]
    if i and i.session == info.session and not i.detail then
      pcall(api.nvim_win_set_cursor, win, { r, 0 })
      M.sessions_row = r
      break
    end
  end
end

--- Accounts fold on their header; all-fold keys affect Background only.
function M.session_fold(b, how)
  local info = M.row_at(b, api.nvim_win_get_cursor(0)[1])
  if info and info.fold == 'accounts' and how ~= 'all open' and how ~= 'all closed' then
    state.set_fold('accounts', how == 'toggle' and not state.folded('accounts') or how == 'close')
    state.changed()
    return
  end
  if how == 'all open' or how == 'all closed' then
    state.set_fold('stopped', how == 'all closed')
  elseif not (info and (info.fold == 'stopped' or info.group == 'background')) then
    return state.say('za folds Accounts or background sessions: put the cursor on a header')
  else
    state.set_fold('stopped', how == 'toggle' and not state.folded('stopped') or how == 'close')
  end
  if state.folded('stopped') and info and info.group == 'background' then
    for r, entry in pairs(M.rows[b] or {}) do
      if entry.fold == 'stopped' then
        api.nvim_win_set_cursor(0, { r, 0 })
        break
      end
    end
  end
  state.changed()
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
  local function topic_row(t)
    local cur = v.kind == 'thread' and v.id == t.id
    local glyph, ghl = M.topic_glyph(t)
    local left = { { cur and '▎' or ' ', 'ClandBlue' }, { glyph, ghl }, { ' ' } }
    if t.item and t.item ~= vim.NIL and not tostring(t.title):find(t.item, 1, true) then
      left[#left + 1] = { t.item .. ' ', 'ClandDim' }
    end
    left[#left + 1] = { t.title, cur and 'ClandBold' or (require('cland.visibility').dim(t) and 'ClandDim' or nil) }
    c:add(left, M.topic_marks(t), { topic = t.id })
  end
  if #state.S.topics == 0 then c:add({ { ' No topics yet (the hub is not connected).', 'ClandDim' } }) end
  local background, archive = {}, {}
  for _, g in ipairs(state.topic_groups()) do
    local shown = {}
    for _, t in ipairs(g.topics) do
      if t.layer == 'background' then background[#background + 1] = t
      elseif t.layer == 'archive' then archive[#archive + 1] = t
      else shown[#shown + 1] = t end
    end
    if #shown > 0 then
      c:add({ { ' ' .. g.name:upper() .. ' · ' .. #shown, g.name == 'needs you' and 'ClandAmber' or 'ClandSection' } })
      for _, t in ipairs(shown) do topic_row(t) end
    end
  end
  if #background > 0 then
    c:add({ { ' ' .. (state.S.ui.topics_more and '▾ ' or '▸ ') .. 'more (' .. #background .. ')', 'ClandDim' } }, nil, { topic_more = true })
    if state.S.ui.topics_more then for _, t in ipairs(background) do topic_row(t) end end
  end
  if state.S.ui.topics_archive then
    c:add({ { ' ARCHIVE · ' .. #archive, 'ClandDim' } })
    for _, t in ipairs(archive) do topic_row(t) end
  end
  return { ' ↵ open · n new · c close · r resolve', ' gP pin · gM mute · za more · A archive' }
end

-- Items -----------------------------------------------------------------------------------------------

-- the tree, the filters and the badges live in items.lua (#36)
local function render_items(c)
  return require('cland.items').render(c)
end

-- Inbox -----------------------------------------------------------------------------------------------

local function render_inbox(c, buf)
  return require('cland.inbox').render(c, false, buf)
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
  if info.categories then
    require('cland.items').show_categories()
  elseif info.item and info.fold and info.fold:match('^board:') then
    layout.show({ kind = 'item', id = info.item }, { insert = false })
  elseif info.fold then
    if vim.b[buf].cland_role == 'items' then
      require('cland.vboard').fold('toggle')
      return
    end
    state.set_fold(info.fold, not state.folded(info.fold))
    state.changed()
  elseif info.verification then
    require('cland.actions').run('verification.open')
  elseif info.session then
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
    require('cland.actions').map('n', lhs, fn, { buffer = b, nowait = true, silent = true, desc = 'cland: ' .. desc })
  end
  local sessions = require('cland.sessions')
  map('l', function()
    require('cland.launcher').open()
  end, 'launch a session')
  map('a', function()
    require('cland.launcher').aide()
  end, 'launch an Aide')
  map('<C-v>', on_row(function(name)
    require('cland.layout').show_split({ kind = 'session', id = name })
  end), 'attach in a vertical split')
  map('d', on_row(sessions.archive), 'archive the stopped session')
  map('r', on_row(sessions.resume), 'resume the session')
  map('x', on_row(sessions.ask_stop), 'stop the session (asks first)')
  map('L', on_row(function(name)
    require('cland.agents_log').open({ session = name })
  end), 'Agents log for this session')
  map('c', on_row(sessions.show_capabilities), "the adapter's capability table")
  for lhs, how in pairs({ za = 'toggle', zo = 'open', zc = 'close', zR = 'all open', zM = 'all closed', ['<Tab>'] = 'toggle' }) do
    map(lhs, function()
      M.session_fold(b, how)
    end, 'accounts or background sessions: ' .. how)
  end
  map('A', function()
    state.S.ui.sessions_archive = not state.S.ui.sessions_archive
    if state.S.ui.sessions_archive then require('cland').refresh_archive() end
    state.changed()
  end, 'show or hide archived sessions')
  -- the cursor's row is the selected session, the one whose second line shows
  api.nvim_create_autocmd('CursorMoved', {
    buffer = b,
    callback = function()
      M.sessions_cursor(b)
    end,
  })
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
  require('cland.actions').map('n', 'gm', function()
    local layout = require('cland.layout')
    local side = api.nvim_get_current_win() == layout.win.left and 'left' or 'right'
    layout.place_panel(kind, side == 'left' and 'right' or 'left')
  end, { buffer = b, nowait = true, silent = true })
  require('cland.actions').map('n', '<CR>', function()
    open_row(b)
  end, { buffer = b, nowait = true, silent = true, desc = 'cland: open in the centre' })
  require('cland.actions').map('n', '<2-LeftMouse>', function()
    open_row(b)
  end, { buffer = b, silent = true })
  if kind == 'items' then
    require('cland.items').keys(b)
  elseif kind == 'sessions' then
    M.session_keys(b)
    require('cland.visibility').keys(b, function()
      local row = M.row_at(b, api.nvim_win_get_cursor(0)[1])
      return row and row.session and 'sessions', row and row.session
    end)
  elseif kind == 'inbox' then
    require('cland.inbox').keys(b)
  elseif kind == 'topics' then
    require('cland.visibility').keys(b, function()
      local row = M.row_at(b, api.nvim_win_get_cursor(0)[1])
      return row and row.topic and 'topics', row and row.topic
    end)
    local views = require('cland.views')
    local function topic_key(lhs, fn, desc)
      require('cland.actions').map('n', lhs, fn, { buffer = b, nowait = true, silent = true, desc = 'cland: ' .. desc })
    end
    topic_key('za', function() state.S.ui.topics_more = not state.S.ui.topics_more; state.changed() end, 'toggle background topics')
    topic_key('A', function() state.S.ui.topics_archive = not state.S.ui.topics_archive; state.changed() end, 'show or hide archived topics')
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
  local footer = RENDER[kind](c, b)
  c:add({})
  for _, f in ipairs(footer or {}) do
    c:add({ { f, 'ClandFaint' } })
  end
  c:footer_at(vim.fn.winheight(win), #(footer or {}))
  local cur = api.nvim_win_get_cursor(win)
  local info = M.row_at(b, cur[1])
  local inbox_info = kind == 'inbox' and info
  local follow = (kind == 'sessions' or kind == 'items') and M.row_key((M.rows[b] or {})[cur[1]]) or nil
  M.rows[b] = c:apply(b)
  local target = c.cursor_to
  if inbox_info then
    target = require('cland.inbox').follow_row(c, inbox_info)
  end
  if not target and follow then
    for r = 1, #c.lines do
      if M.row_key(c.info[r]) == follow then
        target = r
        break
      end
    end
  end
  -- the board names the row its moved or folded item now has; else the cursor keeps its row
  target = math.min(target or cur[1], #c.lines)
  pcall(api.nvim_win_set_cursor, win, { target, 0 })
  if kind == 'sessions' then
    M.sessions_row = target
  end
  -- a panel whose content fits shows it from its first line (a shrunk window keeps a stale top line)
  if #c.lines <= vim.fn.winheight(win) then
    api.nvim_win_call(win, function()
      vim.fn.winrestview({ topline = 1 })
    end)
  end
end

return M
