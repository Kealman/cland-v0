-- The one floating picker (spec section 5, Pickers.dc.html): `␣p` over topics and sessions (items and
-- artifacts join with #36 and the artifacts ticket). Two floats: a one-line input titled with the kinds,
-- and the list. Tab and Shift+Tab switch the kind, typing filters fuzzily (matchfuzzypos), Up/Down or
-- C-n/C-p move, Enter opens, Esc closes.
local api = vim.api
local state = require('cland.state')

local M = { last = 'topics' }
local ns = api.nvim_create_namespace('cland.picker')

M.KINDS = { 'topics', 'sessions' }

local function topic_entries()
  local out = {}
  for _, t in ipairs(state.S.topics) do
    out[#out + 1] = { glyph = t.id == 'agents' and '≡' or '●', ghl = t.id == 'agents' and 'ClandDim' or 'ClandTeal', key = t.title, right = t.status or 'open', value = t.id }
  end
  return out
end

local function session_entries()
  local panels = require('cland.panels')
  local out = {}
  for _, s in ipairs(state.sessions()) do
    local g, ghl = panels.session_glyph(s)
    out[#out + 1] = { glyph = g, ghl = ghl, key = s.label, right = panels.session_meta(s), value = s.name }
  end
  return out
end

local BUILD = { topics = topic_entries, sessions = session_entries }

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
  local t = { { ' pick › ', 'ClandDim' } }
  for _, k in ipairs(M.KINDS) do
    t[#t + 1] = { ' ' .. k .. ' ', k == p.kind and 'ClandTabOn' or 'ClandTab' }
  end
  t[#t + 1] = { ' ', 'ClandDim' }
  return t
end

local FOOTER = {
  topics = ' ↵ open thread · Tab kind · Esc close ',
  sessions = ' ↵ attach in centre · Tab kind · Esc close ',
}

local function render(p)
  local query = api.nvim_buf_get_lines(p.ibuf, 0, 1, false)[1] or ''
  p.query = query
  local shown, pos = {}, {}
  if vim.trim(query) == '' then
    for i, e in ipairs(p.entries) do
      shown[i], pos[i] = e, {}
    end
  else
    local keys = {}
    for i, e in ipairs(p.entries) do
      keys[i] = { text = e.key, idx = i }
    end
    local res = vim.fn.matchfuzzypos(keys, query, { key = 'text' })
    for i, k in ipairs(res[1]) do
      shown[i], pos[i] = p.entries[k.idx], res[2][i]
    end
  end
  p.shown = shown
  p.sel = math.max(1, math.min(p.sel, #shown))
  local lines, marks = {}, {}
  for i, e in ipairs(shown) do
    local prefix = ' ' .. e.glyph .. ' '
    lines[i] = prefix .. e.key
    marks[#marks + 1] = { i - 1, 1, { end_col = 1 + #e.glyph, hl_group = e.ghl } }
    for _, c in ipairs(pos[i] or {}) do
      local b = vim.str_byteindex(e.key, 'utf-32', c)
      local be = vim.str_byteindex(e.key, 'utf-32', c + 1)
      marks[#marks + 1] = { i - 1, #prefix + b, { end_col = #prefix + be, hl_group = 'ClandPickMatch', priority = 300 } }
    end
    marks[#marks + 1] = { i - 1, 0, { virt_text = { { e.right .. ' ', 'ClandDim' } }, virt_text_pos = 'right_align' } }
  end
  if #lines == 0 then
    lines = { ' (no match)' }
  end
  vim.bo[p.lbuf].modifiable = true
  api.nvim_buf_set_lines(p.lbuf, 0, -1, false, lines)
  vim.bo[p.lbuf].modifiable = false
  api.nvim_buf_clear_namespace(p.lbuf, ns, 0, -1)
  for _, m in ipairs(marks) do
    pcall(api.nvim_buf_set_extmark, p.lbuf, ns, m[1], m[2], m[3])
  end
  if #shown > 0 then
    pcall(api.nvim_buf_set_extmark, p.lbuf, ns, p.sel - 1, 0, { line_hl_group = 'ClandPickSel', priority = 10 })
    pcall(api.nvim_win_set_cursor, p.lwin, { p.sel, 0 })
  end
  pcall(api.nvim_win_set_config, p.lwin, { height = math.max(1, math.min(#lines, p.max_height)), footer = { { FOOTER[p.kind], 'ClandDim' } }, footer_pos = 'left' })
  pcall(api.nvim_win_set_config, p.iwin, { title = title(p), title_pos = 'left' })
end

local function set_kind(p, kind)
  p.kind = kind
  M.last = kind
  p.entries = BUILD[kind]()
  p.sel = 1
  render(p)
end

--- What Enter does with the chosen entry.
function M.act(kind, value)
  local layout = require('cland.layout')
  if kind == 'topics' then
    layout.show({ kind = 'thread', id = value })
  elseif kind == 'sessions' then
    layout.show({ kind = 'session', id = value }, { insert = true })
  end
end

--- opts.kind: the kind to open on (default: the last one used).
function M.open(opts)
  opts = opts or {}
  M.close()
  local width = math.min(90, vim.o.columns - 8)
  local max_height = math.max(3, math.min(14, vim.o.lines - 12))
  local row = math.max(1, math.floor((vim.o.lines - max_height) / 4))
  local col = math.floor((vim.o.columns - width) / 2)
  local p = { sel = 1, max_height = max_height, prev = api.nvim_get_current_win() }
  p.lbuf = api.nvim_create_buf(false, true)
  p.lwin = api.nvim_open_win(p.lbuf, false, {
    relative = 'editor', row = row + 3, col = col, width = width, height = 1,
    border = 'rounded', style = 'minimal', focusable = false, zindex = 80, footer = ' ', footer_pos = 'left',
  })
  p.ibuf = api.nvim_create_buf(false, true)
  vim.b[p.ibuf].cland_role = 'picker'
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
      if #p.shown > 0 then
        p.sel = (p.sel - 1 + d) % #p.shown + 1
        render(p)
      end
    end
  end
  local function choose()
    -- TextChangedI waits for an empty typeahead: filter on what is typed now
    local query = api.nvim_buf_get_lines(p.ibuf, 0, 1, false)[1] or ''
    if query ~= p.query then
      p.sel = 1
      render(p)
    end
    local e = p.shown[p.sel]
    local kind = p.kind
    M.close()
    if e then
      vim.schedule(function()
        M.act(kind, e.value)
      end)
    end
  end
  local function cycle(d)
    return function()
      local cur = 1
      for i, k in ipairs(M.KINDS) do
        if k == p.kind then
          cur = i
        end
      end
      set_kind(p, M.KINDS[(cur - 1 + d) % #M.KINDS + 1])
    end
  end
  local function map(lhs, fn)
    vim.keymap.set({ 'i', 'n' }, lhs, fn, { buffer = p.ibuf, nowait = true })
  end
  map('<CR>', choose)
  map('<Esc>', M.close)
  map('<C-c>', M.close)
  map('<C-n>', move(1))
  map('<Down>', move(1))
  map('<C-p>', move(-1))
  map('<Up>', move(-1))
  map('<Tab>', cycle(1))
  map('<S-Tab>', cycle(-1))
  p.group = api.nvim_create_augroup('cland.picker', { clear = true })
  api.nvim_create_autocmd({ 'TextChangedI', 'TextChanged' }, {
    group = p.group,
    buffer = p.ibuf,
    callback = function()
      p.sel = 1
      render(p)
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
  set_kind(p, opts.kind or M.last)
  vim.cmd('startinsert')
end

return M
