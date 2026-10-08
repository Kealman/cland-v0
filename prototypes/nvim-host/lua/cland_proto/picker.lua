-- PROTOTYPE (ticket #15, workbench): the one floating picker (Pickers
-- artboard), grown from the chat-screen picker. <Space>p opens it on items,
-- <Space>a on artifacts; Tab switches the kind (items · topics · sessions ·
-- artifacts); typing filters fuzzily (matchfuzzypos). Two floats: a one-line
-- input titled with the kinds, and the list with the kind's keys as footer.
local api = vim.api
local state = require('cland_proto.state')
local hl = require('cland_proto.hl')
local D = require('cland_proto.draw')
local M = { ns = api.nvim_create_namespace('cland_proto_picker'), last = 'items' }

M.KINDS = { 'items', 'topics', 'sessions', 'artifacts' }
M.HINT = {
  items = 'fuzzy over id, title, claim',
  topics = 'sorted: needs you, then activity',
  sessions = 'waiting first',
  artifacts = 'this topic first, then project',
}

local function key(k, text)
  return { { ' ' .. k .. ' ', 'ClandKey' }, { ' ' .. text .. '  ', 'ClandDim' } }
end

M.FOOTER = {
  items = { key('↵', 'open in centre'), key('C-v', 'open in split'), key('C-t', 'its topic'), key('C-s', 'its session'), key('Esc', 'close') },
  topics = { key('↵', 'open thread'), key('C-i', 'its item'), key('C-s', 'its session'), { { '␣T docks topics as a panel  ', 'ClandDim' } } },
  sessions = { key('↵', 'attach in centre'), key('C-v', 'attach in split'), key('C-i', 'its item'), key('C-t', 'its topic') },
  artifacts = { key('↵', 'open (md in nvim, html in browser)'), key('C-a', 'attach to composer'), key('Esc', 'close') },
}

-- Entries ------------------------------------------------------------------
-- { prefix = {text, hl}, key = 'matched and shown', key_hl = {{s, e, hl}},
--   suffix = {text, hl}, hidden = 'matched, not shown', right = chunks, value }

local function item_entries()
  local out = {}
  local rank = { progress = 1, review = 1, qa = 1, planned = 2, blocked = 2, backlog = 2, done = 4 }
  for _, id in ipairs(state.S.item_order) do
    local it = state.S.items[id]
    local st = state.item_status(it)
    local g, ghl = require('cland_proto.items').glyph(it)
    local ask = state.item_ask(id)
    local s = it.claim and state.session(it.claim)
    local right, hidden = {}, it.claim or ''
    local r = rank[st] or 3
    if it.kind == 'epic' or it.kind == 'map' then
      r = 3
      local done, total = state.progress(id)
      right = { { it.kind .. ' · ' .. done .. ' of ' .. total, 'ClandDim' } }
    elseif it.map then
      r = 5
      right = { { 'map ticket · ' .. it.map, 'ClandDim' } }
    elseif it.claim then
      right = { { it.claim, 'ClandTeal' } }
      if ask then
        right[#right + 1] = { ' · ask open', 'ClandAmber' }
        r = 0
      elseif s and s.state == 'waiting for approval' then
        right[#right + 1] = { ' · waiting for approval', 'ClandAmber' }
        r = 0
      end
    elseif st == 'done' then
      right = { { 'done', 'ClandGreen' } }
    elseif st == 'blocked' then
      right = { { 'by ' .. table.concat(state.open_blockers(it), ', '), 'ClandDim' } }
    elseif it.kind == 'question' then
      right = { { 'question · ' .. (it.assignee == 'you' and 'for you' or 'open'), it.assignee == 'you' and 'ClandAmber' or 'ClandDim' } }
      r = it.assignee == 'you' and 0 or 2
    elseif st == 'progress' or st == 'review' or st == 'qa' then
      right = { { 'unclaimed', 'ClandRed' } }
    else
      right = { { hl.ITEM[st][3], 'ClandDim' } }
    end
    local k = D.pad(id, 5) .. ' ' .. it.title
    out[#out + 1] = { prefix = { g .. ' ', ghl }, key = k, key_hl = { { 0, #id, 'ClandDim' } }, hidden = hidden,
      right = right, value = id, rank = r, n = #out }
  end
  table.sort(out, function(a, b)
    if a.rank ~= b.rank then
      return a.rank < b.rank
    end
    return a.n < b.n
  end)
  return out
end

local function topic_entries()
  local chat = require('cland_proto.chat')
  local out = {}
  for _, t in ipairs(state.sorted_topics()) do
    local st = chat.status(t)
    local a = state.open_asks({ topic = t.id })[1]
    local suffix
    if a then
      suffix = '· ' .. a.from .. ' asked ' .. state.fmt(a.at)
    elseif t.readonly then
      suffix = '· lifecycle events and agent messages'
    elseif t.status == 'closed' then
      suffix = '· closed'
    elseif not t.item and not t.standing then
      suffix = '· unbound · ' .. t.created_by
    end
    local right = require('cland_proto.lists').topic_badge(t, t.status == 'waiting for human' and 'needs you' or 'open')
      or { { state.fmt(state.activity(t)), 'ClandDim' } }
    out[#out + 1] = { prefix = { st[1] .. ' ', st[2] }, key = chat.label(t), suffix = suffix and { suffix, 'ClandDim' },
      right = right, value = t.id }
  end
  return out
end

local function session_entries()
  local sessions = require('cland_proto.sessions')
  local out = {}
  local rank = { ['waiting for approval'] = 0, ['waiting for human'] = 0, busy = 1, idle = 2 }
  for i, s in ipairs(state.S.sessions) do
    local st = sessions.st(s)
    local k = s.name .. ' ' .. s.role
    out[#out + 1] = { prefix = { st[1] .. ' ', st[2] }, key = k, key_hl = { { 0, #s.name, 'ClandBold' }, { #s.name + 1, #k, 'ClandTeal' } },
      suffix = { sessions.meta(s), 'ClandDim' }, right = { s.item and { s.item, 'ClandTeal' } or { 'free', 'ClandDim' } },
      value = s.name, rank = rank[s.state] or 3, n = i }
  end
  table.sort(out, function(a, b)
    if a.rank ~= b.rank then
      return a.rank < b.rank
    end
    return a.n < b.n
  end)
  out[#out + 1] = { prefix = { '+ ', 'ClandDim' }, key = 'new session…', key_hl = { { 0, #'new session…', 'ClandDim' } },
    suffix = { 'role · harness · model from roles.toml defaults', 'ClandDim' }, right = {}, value = '__new' }
  return out
end

local function artifact_entries()
  local out = {}
  local v = state.S.ui.view
  local here = v.kind == 'thread' and v.id or nil
  local order = {}
  for _, id in ipairs(state.S.artifact_order) do
    if here and state.artifact(id).topic == here then
      order[#order + 1] = id
    end
  end
  for _, id in ipairs(state.S.artifact_order) do
    if not (here and state.artifact(id).topic == here) then
      order[#order + 1] = id
    end
  end
  for _, id in ipairs(order) do
    local a = state.artifact(id)
    local t = a.topic and state.topic(a.topic)
    out[#out + 1] = { prefix = { '', nil }, key = id .. ' ' .. a.title, key_hl = { { 0, #id, 'ClandBlueBold' } },
      suffix = { '· ' .. a.kind .. ' · ' .. a.by .. ' · ' .. a.status .. (a.note and (' · ' .. a.note) or ''), 'ClandDim' },
      right = { { t and (t.item or t.title) or '—', 'ClandDim' } }, value = id }
  end
  return out
end

local BUILD = { items = item_entries, topics = topic_entries, sessions = session_entries, artifacts = artifact_entries }

-- Floats ---------------------------------------------------------------------

function M.close()
  local p = M.cur
  M.cur = nil
  if not p then
    return
  end
  for _, w in ipairs({ p.iwin, p.lwin }) do
    if w and api.nvim_win_is_valid(w) then
      pcall(api.nvim_win_close, w, true)
    end
  end
  pcall(api.nvim_del_augroup_by_id, p.group)
  vim.cmd.stopinsert()
  if p.prev and api.nvim_win_is_valid(p.prev) then
    pcall(api.nvim_set_current_win, p.prev)
  end
end

local function title(p)
  if p.title then
    return { { ' ' .. p.title .. ' ', 'ClandAmberBold' } }
  end
  local t = { { ' pick › ', 'ClandDim' } }
  for _, k in ipairs(p.kinds) do
    t[#t + 1] = { ' ' .. k .. ' ', k == p.kind and 'ClandTabOn' or 'ClandTab' }
  end
  t[#t + 1] = { ' ', 'ClandDim' }
  return t
end

local function footer(p)
  local f = {}
  if p.title then
    vim.list_extend(f, key('↵', 'choose'))
    vim.list_extend(f, key('Esc', 'close'))
    return f
  end
  for _, group in ipairs(M.FOOTER[p.kind]) do
    vim.list_extend(f, group)
  end
  return f
end

local function render(p)
  local query = api.nvim_buf_get_lines(p.ibuf, 0, 1, false)[1] or ''
  local shown, pos = {}, {}
  if vim.trim(query) == '' then
    for i, e in ipairs(p.entries) do
      shown[i], pos[i] = e, {}
    end
  else
    local keys = {}
    for i, e in ipairs(p.entries) do
      keys[i] = { text = e.key .. ((e.hidden and e.hidden ~= '') and (' ' .. e.hidden) or ''), idx = i }
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
    local pre = e.prefix and e.prefix[1] or ''
    local text = ' ' .. pre .. e.key .. (e.suffix and ('  ' .. e.suffix[1]) or '')
    lines[i] = text
    local r = i - 1
    if e.prefix and e.prefix[2] and #pre > 0 then
      marks[#marks + 1] = { r, 1, { end_col = 1 + #pre, hl_group = e.prefix[2] } }
    end
    local base = 1 + #pre
    for _, h in ipairs(e.key_hl or {}) do
      marks[#marks + 1] = { r, base + h[1], { end_col = base + h[2], hl_group = h[3] } }
    end
    if e.suffix and e.suffix[2] then
      marks[#marks + 1] = { r, base + #e.key + 2, { end_col = #text, hl_group = e.suffix[2] } }
    end
    local klen = vim.fn.strchars(e.key)
    for _, c in ipairs(pos[i] or {}) do
      if c < klen then
        local b = vim.str_byteindex(e.key, 'utf-32', c)
        local be = vim.str_byteindex(e.key, 'utf-32', c + 1)
        marks[#marks + 1] = { r, base + b, { end_col = base + be, hl_group = 'ClandPickMatch', priority = 300 } }
      end
    end
    if e.right and #e.right > 0 then
      local vt = vim.deepcopy(e.right)
      vt[#vt + 1] = { ' ' }
      marks[#marks + 1] = { r, 0, { virt_text = vt, virt_text_pos = 'right_align' } }
    end
  end
  if #lines == 0 then
    lines = { ' (no match)' }
  end
  vim.bo[p.lbuf].modifiable = true
  api.nvim_buf_set_lines(p.lbuf, 0, -1, false, lines)
  vim.bo[p.lbuf].modifiable = false
  api.nvim_buf_clear_namespace(p.lbuf, M.ns, 0, -1)
  for _, m in ipairs(marks) do
    pcall(api.nvim_buf_set_extmark, p.lbuf, M.ns, m[1], m[2], m[3])
  end
  if #shown > 0 then
    api.nvim_buf_set_extmark(p.lbuf, M.ns, p.sel - 1, 0, { line_hl_group = 'ClandPickSel', priority = 10 })
    pcall(api.nvim_win_set_cursor, p.lwin, { p.sel, 0 })
  end
  pcall(api.nvim_win_set_config, p.lwin, { height = math.max(1, math.min(#lines, p.max_height)), footer = footer(p),
    footer_pos = 'left' })
  pcall(api.nvim_win_set_config, p.iwin, { title = title(p), title_pos = 'left' })
  api.nvim_buf_clear_namespace(p.ibuf, M.ns, 0, -1)
  local hint = p.title and '' or (M.HINT[p.kind] .. (#p.kinds > 1 and ' · Tab switches kind' or ''))
  pcall(api.nvim_buf_set_extmark, p.ibuf, M.ns, 0, 0, { virt_text = { { hint .. ' ', 'ClandDim' } }, virt_text_pos = 'right_align' })
end

local function set_kind(p, kind)
  p.kind = kind
  M.last = kind
  p.entries = BUILD[kind]()
  p.sel = 1
  render(p)
end

-- What Enter and the chords do with the chosen entry.
function M.act(kind, value, action)
  local layout = require('cland_proto.layout')
  local motions = require('cland_proto.motions')
  if value == '__new' then
    vim.notify('cland-proto: a new session would launch with the role defaults of roles.toml (not in the prototype)', vim.log.levels.INFO)
    return
  end
  local subj = kind == 'items' and { item = value } or kind == 'topics' and { topic = value }
    or kind == 'sessions' and { session = value } or { artifact = value }
  local view = kind == 'items' and { kind = 'item', id = value } or kind == 'topics' and { kind = 'thread', id = value }
    or kind == 'sessions' and { kind = 'session', id = value } or nil
  if action == 'split' and view then
    layout.split(view)
  elseif action == 'topic' then
    motions.go('topic', subj)
  elseif action == 'session' then
    motions.go('session', subj)
  elseif action == 'item' then
    motions.go('item', subj)
  elseif action == 'attach' and kind == 'artifacts' then
    local v = state.S.ui.view
    layout.focus_composer(v.kind == 'thread' and v.id or 'general', value .. ' ', true)
  elseif kind == 'artifacts' then
    require('cland_proto.artifacts').open(value)
  elseif view then
    layout.show(view, { insert = kind == 'sessions' })
  end
end

-- opts: kinds, kind, title (single-purpose pickers), on_choose(kind, value, action)
function M.open(opts)
  opts = opts or {}
  M.close()
  local width = math.min(96, vim.o.columns - 8)
  local max_height = math.min(14, vim.o.lines - 12)
  local row = math.max(1, math.floor((vim.o.lines - max_height) / 4))
  local col = math.floor((vim.o.columns - width) / 2)
  local p = { kinds = opts.kinds or M.KINDS, sel = 1, max_height = max_height, title = opts.title,
    on_choose = opts.on_choose, prev = api.nvim_get_current_win() }
  p.kind = opts.kind or p.kinds[1]
  p.lbuf = api.nvim_create_buf(false, true)
  p.lwin = api.nvim_open_win(p.lbuf, false, {
    relative = 'editor', row = row + 3, col = col, width = width, height = 1,
    border = 'rounded', style = 'minimal', focusable = false, zindex = 80,
    footer = { { ' ' } }, footer_pos = 'left',
  })
  p.ibuf = api.nvim_create_buf(false, true)
  p.iwin = api.nvim_open_win(p.ibuf, true, {
    relative = 'editor', row = row, col = col, width = width, height = 1,
    border = 'rounded', style = 'minimal', zindex = 81, title = { { ' ' } }, title_pos = 'left',
  })
  vim.wo[p.lwin].winbar = ''
  vim.wo[p.iwin].winbar = ''
  vim.wo[p.lwin].cursorline = false
  vim.wo[p.lwin].wrap = false
  vim.b[p.ibuf].cland_role = 'picker'
  M.cur = p
  local function move(d)
    return function()
      if #p.shown > 0 then
        p.sel = (p.sel - 1 + d) % #p.shown + 1
        render(p)
      end
    end
  end
  local function choose(action)
    return function()
      local e = p.shown[p.sel]
      local kind = p.kind
      M.close()
      if e then
        vim.schedule(function()
          if p.on_choose then
            p.on_choose(kind, e.value, action)
          else
            M.act(kind, e.value, action)
          end
        end)
      end
    end
  end
  local function map(lhs, fn)
    vim.keymap.set({ 'i', 'n' }, lhs, fn, { buffer = p.ibuf, nowait = true })
  end
  map('<CR>', choose('open'))
  map('<C-v>', choose('split'))
  map('<C-t>', choose('topic'))
  map('<C-s>', choose('session'))
  map('<C-i>', choose('item'))
  map('<C-a>', choose('attach'))
  map('<Esc>', M.close)
  map('<C-c>', M.close)
  for _, k in ipairs({ '<C-n>', '<Down>' }) do
    map(k, move(1))
  end
  for _, k in ipairs({ '<C-p>', '<Up>' }) do
    map(k, move(-1))
  end
  local function cycle(d)
    return function()
      if #p.kinds < 2 then
        move(d)()
        return
      end
      local cur = 1
      for i, k in ipairs(p.kinds) do
        if k == p.kind then
          cur = i
        end
      end
      set_kind(p, p.kinds[(cur - 1 + d) % #p.kinds + 1])
    end
  end
  map('<Tab>', cycle(1))
  map('<S-Tab>', cycle(-1))
  p.group = api.nvim_create_augroup('cland_proto_picker', { clear = true })
  api.nvim_create_autocmd({ 'TextChangedI', 'TextChanged' }, {
    group = p.group, buffer = p.ibuf, callback = function()
      p.sel = 1
      render(p)
    end,
  })
  api.nvim_create_autocmd('WinLeave', {
    group = p.group, buffer = p.ibuf, callback = function()
      vim.schedule(function()
        if M.cur == p then
          M.close()
        end
      end)
    end,
  })
  set_kind(p, p.kind)
  vim.cmd.startinsert()
end

return M
