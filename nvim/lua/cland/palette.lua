-- One floating fuzzy search over actions, items, sessions, artifacts and topics, in that fixed
-- order. Prefixes narrow the kind; selection starts on the best match across all five groups.
local api = vim.api
local state = require('cland.state')

local M = {}
local ns = api.nvim_create_namespace('cland.palette')

M.GROUPS = {
  { prefix = '>', key = 'actions', label = 'actions' },
  { prefix = '#', key = 'items', label = 'items' },
  { prefix = '@', key = 'sessions', label = 'sessions' },
  { prefix = '~', key = 'artifacts', label = 'artifacts' },
  { prefix = '/', key = 'topics', label = 'topics' },
}
local BY_PREFIX = {}
local CYCLE = { '' }
for _, g in ipairs(M.GROUPS) do
  BY_PREFIX[g.prefix] = g
  CYCLE[#CYCLE+1] = g.prefix
end

function M.prefix(kind)
  for _, g in ipairs(M.GROUPS) do if g.key == kind then return g.prefix end end
  return ''
end

local function first_line(s)
  return (tostring(s or ''):gsub('\r?\n.*', ''))
end

-- The groups' entries -----------------------------------------------------------------------------

--- Dim background and archive hits using the hub's classification.
function M.dim(kind, object)
  return require('cland.visibility').dim(object)
end

local function build(key)
  local out = {}
  if key == 'actions' then
    for _, a in ipairs(require('cland.actions').all()) do
      out[#out+1] = {glyph='›', ghl='ClandBlue', title=first_line(a.title), text=first_line(a.title) .. (a.command and ('  ' .. a.command) or ''),
        keyhint=a.key, run=a.run, value=a.id}
    end
  else
    out = require('cland.picker').BUILD[key]()
    for _, e in ipairs(out) do
      e.text = first_line(e.key)
      local object = key == 'items' and state.item(e.value) or key == 'sessions' and state.session(e.value) or key == 'topics' and state.topic(e.value) or key == 'artifacts' and require('cland.artifacts').get(e.value) or nil
      e.dim = M.dim(key, object)
    end
  end
  for _, e in ipairs(out) do e.group=key end
  return out
end

function M.run(e, split)
  local layout = require('cland.layout')
  if e.group == 'actions' then return e.run() end
  local kind = ({items='item', sessions='session', topics='thread', artifacts='artifact'})[e.group]
  if e.group == 'artifacts' then
    return require('cland.artifacts').open(e.value, nil, {split=split})
  end
  if split then
    if kind == 'session' then return layout.show_split({kind=kind,id=e.value}) end
    return layout.show_split_view({kind=kind,id=e.value})
  end
  return layout.show({kind=kind,id=e.value}, {insert=kind == 'session' or kind == 'thread'})
end

-- The floats --------------------------------------------------------------------------------------------------

--- The group a query names with its prefix (or nil: every group), and the text left to match.
function M.parse(query)
  local g = BY_PREFIX[query:sub(1, 1)]
  if g then
    return g, vim.trim(query:sub(2))
  end
  return nil, vim.trim(query)
end

local function better(a, b)
  if not b then return true end
  if a.literal and not b.literal then return true end
  if b.literal and not a.literal then return false end
  return (a.score or 0) > (b.score or 0)
end

local function match(entries, text)
  local out = {}
  if text == '' then
    for i, e in ipairs(entries) do
      out[i] = { e = e, pos = {} }
    end
    return out
  end
  local keys = {}
  for i, e in ipairs(entries) do
    keys[i] = { text = e.text, idx = i }
  end
  local res = vim.fn.matchfuzzypos(keys, text, { key = 'text' })
  for i, k in ipairs(res[1]) do
    local e = entries[k.idx]
    -- Existing title queries (e.g. "sessions panel") must keep selecting their
    -- action when a new command path also happens to contain those words.
    local literal = e.title and e.title:lower():find(text:lower(), 1, true) ~= nil
    out[i] = { e = e, pos = res[2][i], score = res[3] and res[3][i] or 0, literal = literal, rank = i }
  end
  table.sort(out, function(a, b)
    if better(a, b) then return true end
    return not better(b, a) and a.rank < b.rank
  end)
  return out
end

function M.close()
  local p = M.cur
  M.cur = nil
  if not p then
    return
  end
  pcall(api.nvim_del_augroup_by_id, p.group)
  for _, w in ipairs({ p.iwin, p.lwin }) do
    if w and api.nvim_win_is_valid(w) then
      pcall(api.nvim_win_close, w, true)
    end
  end
  vim.cmd('stopinsert')
  if p.prev and api.nvim_win_is_valid(p.prev) then
    pcall(api.nvim_set_current_win, p.prev)
  end
end

local function title(p)
  local t = { { ' palette › ', 'ClandDim' } }
  local tabs = { { '', 'all' } }
  for _, g in ipairs(M.GROUPS) do
    tabs[#tabs + 1] = { g.prefix, g.prefix .. ' ' .. g.label }
  end
  for _, tab in ipairs(tabs) do
    local on = (p.prefix or '') == tab[1]
    t[#t + 1] = { ' ' .. tab[2] .. ' ', on and 'ClandTabOn' or 'ClandTab' }
  end
  t[#t + 1] = { ' ', 'ClandDim' }
  return t
end

local FOOTER = ' ↵ run or open · C-v split · Tab group · Esc close '

local function render(p)
  local query = api.nvim_buf_get_lines(p.ibuf, 0, 1, false)[1] or ''
  p.query = query
  local g, text = M.parse(query)
  if not g or g.key == 'items' then require('cland').load_closed_items() end
  p.prefix = g and g.prefix or nil
  local groups = {}
  for _, def in ipairs(M.GROUPS) do
    if (not p.subject_only or def.key ~= 'actions') and (not g or g.key == def.key) then
      -- built on every draw: what the hub sends while the palette is open shows at once
      local matched = match(build(def.key), text)
      if #matched > 0 then
        groups[#groups + 1] = { def = def, matched = matched }
      end
    end
  end
  local lines, marks, shown, at = {}, {}, {}, {}
  local best, best_sel = nil, 1
  for _, grp in ipairs(groups) do
    local n = #grp.matched
    lines[#lines + 1] = ' ' .. grp.def.label:upper() .. ' · ' .. n
    marks[#marks + 1] = { #lines - 1, 0, { end_col = #lines[#lines], hl_group = 'ClandSection' } }
    marks[#marks + 1] = { #lines - 1, 0, { virt_text = { { grp.def.prefix .. ' ', 'ClandFaint' } }, virt_text_pos = 'right_align' } }
    for _, m in ipairs(grp.matched) do
      local e = m.e
      local right = {}
      if e.right and e.right ~= '' then
        right[#right + 1] = { e.right .. ' ', 'ClandDim' }
      end
      if e.keyhint then
        right[#right + 1] = { ' ' .. e.keyhint .. ' ', 'ClandTabOn' }
        right[#right + 1] = { ' ', 'ClandDim' }
      end
      right = require('cland.bars').fit(right, math.max(0, math.floor(p.width / 2)))
      local rw = 0
      for _, ch in ipairs(right) do rw = rw + api.nvim_strwidth(ch[1]) end
      local prefix = ' ' .. e.glyph .. ' '
      -- the text stops short of the right part (a long title would run under it)
      local chunks = require('cland.bars').fit({{e.text, e.dim and 'ClandDim' or 'Normal'}}, p.width - rw - 1 - api.nvim_strwidth(prefix))
      local text = ''
      for _, chunk in ipairs(chunks) do text = text .. chunk[1] end
      lines[#lines + 1] = prefix .. text
      local row = #lines - 1
      shown[#shown + 1] = e
      at[#shown] = #lines
      if better(m, best) then best, best_sel = m, #shown end
      marks[#marks + 1] = { row, 1, { end_col = 1 + #e.glyph, hl_group = e.dim and 'ClandDim' or e.ghl } }
      if e.dim then
        marks[#marks+1] = {row, 0, {end_col=#lines[#lines], hl_group='ClandDim'}}
      end
      for _, c in ipairs(m.pos or {}) do
        local b = vim.str_byteindex(e.text, 'utf-32', c)
        local be = vim.str_byteindex(e.text, 'utf-32', c + 1)
        if be <= #text and text:sub(1, be) == e.text:sub(1, be) then
          marks[#marks + 1] = { row, #prefix + b, { end_col = #prefix + be, hl_group = 'ClandPickMatch', priority = 300 } }
        end
      end
      if #right > 0 then
        marks[#marks + 1] = { row, 0, { virt_text = right, virt_text_pos = 'right_align' } }
      end
    end
  end
  if #lines == 0 then
    lines = { ' (no match)' }
  end
  p.shown, p.at = shown, at
  p.sel = p.select_best and best_sel or math.max(1, math.min(p.sel, #shown))
  p.select_best = false
  vim.bo[p.lbuf].modifiable = true
  api.nvim_buf_set_lines(p.lbuf, 0, -1, false, lines)
  vim.bo[p.lbuf].modifiable = false
  api.nvim_buf_clear_namespace(p.lbuf, ns, 0, -1)
  for _, m in ipairs(marks) do
    pcall(api.nvim_buf_set_extmark, p.lbuf, ns, m[1], m[2], m[3])
  end
  if #shown > 0 then
    local line = at[p.sel]
    pcall(api.nvim_buf_set_extmark, p.lbuf, ns, line - 1, 0, { line_hl_group = 'ClandPickSel', priority = 10 })
    -- the group's header stays in sight above the first entry
    pcall(api.nvim_win_set_cursor, p.lwin, { p.sel == 1 and 1 or line, 0 })
    pcall(api.nvim_win_set_cursor, p.lwin, { line, 0 })
  end
  pcall(api.nvim_win_set_config, p.lwin, { height = math.max(1, math.min(#lines, p.max_height)), footer = { { FOOTER, 'ClandDim' } }, footer_pos = 'left' })
  pcall(api.nvim_win_set_config, p.iwin, { title = title(p), title_pos = 'left' })
end

local function safe_render(p)
  local ok, err = pcall(render, p)
  if not ok then
    M.close()
    state.say('palette: ' .. first_line(err), 'ClandRedBar')
  end
  return ok
end

--- opts.query: the line to open with (a prefix such as `~` opens on that group).
function M.open(opts)
  opts = opts or {}
  M.close()
  require('cland.artifacts').load_more()
  local width = math.min(110, vim.o.columns - 8)
  local max_height = math.max(5, math.min(24, vim.o.lines - 10))
  local row = math.max(1, math.floor((vim.o.lines - max_height) / 5))
  local col = math.floor((vim.o.columns - width) / 2)
  local p = { select = opts.select, subject_only = opts.subject_only, sel = 1, max_height = max_height, prev = api.nvim_get_current_win(), width = width, select_best=true }
  if not M.listening then
    -- the open palette follows the state, as the panels do (one listener for the session)
    M.listening = true
    state.on_change(function()
      if M.cur then
        safe_render(M.cur)
      end
    end)
  end
  p.lbuf = api.nvim_create_buf(false, true)
  vim.bo[p.lbuf].bufhidden = 'wipe'
  p.lwin = api.nvim_open_win(p.lbuf, false, {
    relative = 'editor', row = row + 3, col = col, width = width, height = 1,
    border = 'rounded', style = 'minimal', focusable = false, zindex = 80, footer = ' ', footer_pos = 'left',
  })
  p.ibuf = api.nvim_create_buf(false, true)
  vim.bo[p.ibuf].bufhidden = 'wipe'
  vim.b[p.ibuf].cland_role = 'palette'
  local query = opts.query or ''
  api.nvim_buf_set_lines(p.ibuf, 0, -1, false, { query })
  p.iwin = api.nvim_open_win(p.ibuf, true, {
    relative = 'editor', row = row, col = col, width = width, height = 1,
    border = 'rounded', style = 'minimal', zindex = 81, title = ' ', title_pos = 'left',
  })
  vim.wo[p.lwin].winbar = ''
  vim.wo[p.iwin].winbar = ''
  vim.wo[p.lwin].wrap = false
  M.cur = p
  local function move(d)
    return function()
      if d > 0 and p.sel >= #p.shown - 2 then require('cland.artifacts').load_more() end
      if #p.shown > 0 then
        p.sel = (p.sel - 1 + d) % #p.shown + 1
        safe_render(p)
      end
    end
  end
  local function choose(split)
    return function()
      -- TextChangedI waits for an empty typeahead: match what is typed now
      local now = api.nvim_buf_get_lines(p.ibuf, 0, 1, false)[1] or ''
      if now ~= p.query then
        p.sel = 1
        p.select_best = true
        if not safe_render(p) then return end
      end
      local e = p.shown[p.sel]
      M.close()
      if e then
        vim.schedule(function()
          if p.select then p.select(e) else M.run(e, split) end
        end)
      end
    end
  end
  local function cycle(d)
    return function()
      local now = api.nvim_buf_get_lines(p.ibuf, 0, 1, false)[1] or ''
      local cur = BY_PREFIX[now:sub(1, 1)] and now:sub(1, 1) or ''
      local rest = cur ~= '' and now:sub(2) or now
      local i = 1
      for k, pre in ipairs(CYCLE) do
        if pre == cur then
          i = k
        end
      end
      local line = CYCLE[(i - 1 + d) % #CYCLE + 1] .. rest
      api.nvim_buf_set_lines(p.ibuf, 0, -1, false, { line })
      pcall(api.nvim_win_set_cursor, p.iwin, { 1, #line })
      p.sel = 1
      p.select_best = true
      safe_render(p)
    end
  end
  local function map(lhs, fn)
    require('cland.actions').map({ 'i', 'n' }, lhs, fn, { buffer = p.ibuf, nowait = true })
  end
  map('<CR>', choose(false))
  map('<C-v>', choose(true))
  map('<Esc>', M.close)
  map('<C-c>', M.close)
  map('<C-n>', move(1))
  map('<Down>', move(1))
  map('<C-p>', move(-1))
  map('<Up>', move(-1))
  map('<Tab>', cycle(1))
  map('<S-Tab>', cycle(-1))
  p.group = api.nvim_create_augroup('cland.palette', { clear = true })
  api.nvim_create_autocmd({ 'TextChangedI', 'TextChanged' }, {
    group = p.group,
    buffer = p.ibuf,
    callback = function()
      p.sel = 1
      p.select_best = true
      safe_render(p)
    end,
  })
  api.nvim_create_autocmd('WinLeave', {
    group = p.group,
    buffer = p.ibuf,
    callback = function()
      vim.schedule(function()
        if M.cur == p then
          M.close()
        end
      end)
    end,
  })
  if safe_render(p) then vim.cmd('startinsert!') end
end

return M
