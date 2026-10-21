-- The project's rules, kept live by the hub. Drafts survive navigation and refused writes.
local api = vim.api
local state = require('cland.state')
local M = { rules = {}, unfolded = {}, rows = {}, drafts = {}, origins = {} }
local ns = api.nvim_create_namespace('cland.rulebook')
local function scope(rule) return type(rule.scope) == 'table' and table.concat(rule.scope, ', ') or rule.scope end
local function connected()
  if M.client and M.client:connected() then return true end
  state.say('rulebook: the hub is not connected', 'ClandRedBar')
end

function M.setup(client)
  M.client = client
  M.rules, M.origins = {}, {}
  local function install(rules) M.rules = rules or {}; state.changed() end
  local function load()
    client:snapshot({ type = 'rule.list', all = true }, function(err, value, events)
      if err then return state.say('rulebook: ' .. tostring(err), 'ClandRedBar') end
      install(value.rules)
      for _, event in ipairs(events) do install(event.rules) end
    end)
  end
  client:on('connected', load)
  client:on('rules.changed', function(event) install(event.rules) end)
  if client:connected() then load() end
end

function M.row() return M.rows[api.nvim_win_get_cursor(0)[1]] end

-- Resolve the origin through paged topic history, including messages outside the initial 200.
local function origin(rule, done)
  local topic, message = rule.origin:match('^message:([^/]+)/([^/]+)$')
  if not topic then return done(nil, 'origin is not a thread') end
  local cached = M.origins[rule.origin]
  if cached then return done(cached) end
  if not connected() then return end
  local function page(before)
    M.client:request({ type = 'topic.history', topic = topic, limit = 200, before = before }, function(err, value)
      if err then return done(nil, tostring(err)) end
      for _, m in ipairs(value.messages or {}) do
        if m.id == message then
          local found = { topic = topic, title = value.topic.title, message = m }
          M.origins[rule.origin] = found
          return done(found)
        end
      end
      local messages = value.messages or {}
      local next_page = value.before or (#messages > 0 and messages[1].id)
      if (value.more == true or #messages == 200) and next_page and next_page ~= before then return page(next_page) end
      done(nil, 'origin message is no longer available')
    end)
  end
  page(nil)
end

function M.toggle()
  local row = M.row()
  if not row then return end
  local rule = row.rule
  M.unfolded[rule.number] = not M.unfolded[rule.number]
  if M.unfolded[rule.number] and rule.origin:match('^message:') then
    origin(rule, function(_, err)
      if err then state.say('rulebook: ' .. err, 'ClandRedBar') end
      state.changed()
    end)
  end
  state.changed()
end

function M.follow()
  local row = M.row()
  if not row then return end
  local from = api.nvim_get_current_buf()
  origin(row.rule, function(found, err)
    if err then return state.say('rulebook: ' .. err) end
    if api.nvim_get_current_buf() ~= from then return end
    local views = require('cland.views')
    local tv = views.topic(found.topic)
    -- Retain the referenced message even when ordinary history has already trimmed it.
    tv.thread.archive = true
    tv.thread:merge({ found.message }, true)
    require('cland.layout').show({ kind = 'thread', id = found.topic }, { insert = false })
    local function focus()
      for i, info in ipairs(tv.thread.info) do
        if info.head and info.head.id == found.message.id then
          local win = require('cland.layout').win.centre
          if win and api.nvim_win_is_valid(win) and api.nvim_win_get_buf(win) == tv.thread.buf then
            api.nvim_set_current_win(win)
            api.nvim_win_set_cursor(win, { i, 0 })
            api.nvim_win_call(win, function() vim.cmd('normal! zt') end)
          end
          return
        end
      end
    end
    focus()
    vim.schedule(focus)
  end)
end

function M.open(number)
  M.selected = tonumber(number)
  require('cland.layout').show({ kind = 'rulebook' }, { insert = false })
end

function M.buffer()
  if M.buf and api.nvim_buf_is_valid(M.buf) then return M.buf end
  M.buf = api.nvim_create_buf(false, true)
  api.nvim_buf_set_name(M.buf, 'cland://rulebook')
  vim.bo[M.buf].bufhidden = 'hide'
  vim.bo[M.buf].modifiable = false
  vim.b[M.buf].cland_role = 'rulebook'
  local function map(key, fn) require('cland.actions').map('n', key, fn, { buffer = M.buf, silent = true, nowait = true }) end
  map('<CR>', M.toggle)
  map('gt', M.follow)
  map('a', function() M.compose() end)
  map('e', function() local row = M.row(); if row then M.compose(row.rule) end end)
  map('X', M.retire)
  map('q', function() require('cland.layout').back() end)
  M.render()
  return M.buf
end

function M.render()
  if not (M.buf and api.nvim_buf_is_valid(M.buf)) then return end
  local cursors = {}
  for _, win in ipairs(vim.fn.win_findbuf(M.buf)) do
    local row = api.nvim_win_get_cursor(win)[1]
    local info = M.rows[row]
    cursors[win] = info and { number = info.rule.number, part = info.part } or {}
  end
  local rules = vim.deepcopy(M.rules)
  table.sort(rules, function(a, b)
    if a.status ~= b.status then return a.status == 'active' end
    return a.number < b.number
  end)
  local lines, rows, groups = { ' Rulebook · <CR> unfold · gt origin · a add · e edit · X retire · q back' }, {}, {}
  local function add(text, rule, part, group)
    lines[#lines + 1] = text
    rows[#lines] = { rule = rule, part = part }
    groups[#lines] = rule.status == 'retired' and 'ClandRuleRetired' or group
  end
  for _, rule in ipairs(rules) do
    add((' %s rule %d · %s · %s · %s · %s'):format(M.unfolded[rule.number] and '▾' or '▸', rule.number, rule.title, scope(rule), rule.status, rule.date), rule, 'header', 'ClandText')
    if M.unfolded[rule.number] then
      for i, line in ipairs(vim.split(rule.text, '\n', { plain = true })) do add('   ' .. line, rule, 'text' .. i, 'ClandText') end
      add('   Reason: ' .. rule.reason, rule, 'reason', 'ClandDim')
      local source = rule.origin:gsub('^session:', ''):gsub('^memory:', '')
      local found = M.origins[rule.origin]
      if found then source = found.title .. ' · ' .. found.message.ts end
      add('   Origin: ' .. source, rule, 'origin', 'ClandBlue')
    end
  end
  if #rules == 0 then lines[#lines + 1] = ' No rules yet. a adds a rule.' end
  M.rows = rows
  vim.bo[M.buf].modifiable = true
  api.nvim_buf_set_lines(M.buf, 0, -1, false, lines)
  vim.bo[M.buf].modifiable = false
  api.nvim_buf_clear_namespace(M.buf, ns, 0, -1)
  for i, group in pairs(groups) do api.nvim_buf_set_extmark(M.buf, ns, i - 1, 0, { end_col = #lines[i], hl_group = group }) end
  for win, cursor in pairs(cursors) do
    local number = M.selected or cursor.number
    local fallback
    for i, row in pairs(rows) do
      if row.rule.number == number then
        if row.part == 'header' then fallback = i end
        if row.part == (M.selected and 'header' or cursor.part) then fallback = i; break end
      end
    end
    if fallback then api.nvim_win_set_cursor(win, { fallback, 0 }) end
  end
  if next(cursors) then M.selected = nil end
end

local function notice(draft, message)
  if not api.nvim_buf_is_valid(draft.buf) then return end
  api.nvim_buf_clear_namespace(draft.buf, ns, 0, -1)
  api.nvim_buf_set_extmark(draft.buf, ns, api.nvim_buf_line_count(draft.buf) - 1, 0,
    { virt_lines = { { { ' ' .. message, 'ClandRed' } } } })
  state.say('rulebook: ' .. message, 'ClandRedBar')
end

local function fields(lines)
  local out, field = {}, nil
  for _, line in ipairs(lines) do
    local key, value = line:match('^(Text):%s?(.*)$')
    if not key then key, value = line:match('^(Scope):%s?(.*)$') end
    if not key then key, value = line:match('^(Reason):%s?(.*)$') end
    if key then
      key = key:lower()
      if out[key] then return nil, 'duplicate ' .. key .. ' field' end
      field, out[key] = key, value
    elseif field == 'text' then out.text = out.text .. '\n' .. line
    elseif vim.trim(line) ~= '' then return nil, 'expected Text:, Scope: or Reason:' end
  end
  for _, key in ipairs({ 'text', 'scope', 'reason' }) do
    if not out[key] or vim.trim(out[key]) == '' then return nil, 'missing ' .. key .. ' field' end
    out[key] = vim.trim(out[key])
  end
  return out
end

function M.save(draft)
  if draft.saving then return end
  local input, err = fields(api.nvim_buf_get_lines(draft.buf, 0, -1, false))
  if err then return notice(draft, err) end
  if not connected() then return notice(draft, 'the hub is not connected') end
  input.type = draft.number and 'rule.edit' or 'rule.add'
  input.number = draft.number
  local tick = api.nvim_buf_get_changedtick(draft.buf)
  draft.saving = true
  M.client:request(input, function(failure, value)
    draft.saving = false
    if failure then return notice(draft, tostring(failure)) end
    if not api.nvim_buf_is_valid(draft.buf) then return end
    draft.number = value.rule.number
    if api.nvim_buf_get_changedtick(draft.buf) ~= tick then return notice(draft, 'saved; newer draft changes are still unsaved') end
    vim.bo[draft.buf].modified = false
    api.nvim_buf_clear_namespace(draft.buf, ns, 0, -1)
    M.drafts[draft.key] = nil
    vim.bo[draft.buf].bufhidden = 'wipe'
    vim.bo[draft.buf].buflisted = false
    state.say('saved rule ' .. value.rule.number)
    if api.nvim_get_current_buf() == draft.buf then
      M.open(value.rule.number)
      -- A successfully saved draft is no longer a destination in centre-view history.
      local hist = state.S.ui.hist
      for i = #hist, 1, -1 do
        if hist[i].kind == 'rule_compose' and hist[i].id == draft.key then table.remove(hist, i) end
      end
    end
  end)
end

function M.compose(rule)
  local key = rule and tostring(rule.number) or 'new'
  require('cland.layout').show({ kind = 'rule_compose', id = key }, { insert = false })
end

function M.compose_buffer(key)
  local draft = M.drafts[key]
  if draft and api.nvim_buf_is_valid(draft.buf) then return draft.buf end
  local rule
  for _, r in ipairs(M.rules) do if tostring(r.number) == key then rule = r end end
  draft = { key = key, number = rule and rule.number, buf = api.nvim_create_buf(true, false) }
  M.drafts[key] = draft
  local b = draft.buf
  api.nvim_buf_set_name(b, 'cland://rule-draft/' .. key .. '/' .. b)
  vim.bo[b].buftype = 'acwrite'
  vim.bo[b].bufhidden = 'hide'
  vim.bo[b].swapfile = false
  vim.b[b].cland_role = 'rule_compose'
  local lines = vim.split('Text: ' .. (rule and rule.text or '') .. '\nScope: ' .. (rule and scope(rule) or 'all') .. '\nReason: ' .. (rule and rule.reason or ''), '\n', { plain = true })
  api.nvim_buf_set_lines(b, 0, -1, false, lines)
  vim.bo[b].modified = false
  api.nvim_create_autocmd('BufWriteCmd', { buffer = b, callback = function() M.save(draft) end })
  require('cland.actions').map('n', 'q', function() require('cland.layout').back() end, { buffer = b, nowait = true })
  return b
end

function M.retire()
  local row = M.row()
  if not row then return end
  local number = row.rule.number
  vim.ui.input({ prompt = 'Retire rule ' .. number .. ' — reason: ' }, function(reason)
    if not reason or vim.trim(reason) == '' or not connected() then return end
    M.client:request({ type = 'rule.retire', number = number, reason = reason }, function(err)
      if err then state.say('rulebook: ' .. tostring(err), 'ClandRedBar')
      else state.say('retired rule ' .. number) end
    end)
  end)
end

return M
