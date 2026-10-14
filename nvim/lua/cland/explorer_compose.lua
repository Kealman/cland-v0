-- The explorer's human messages: context and prompt floats, destination, drafts and bounded sends.
local api = vim.api
local state = require('cland.state')
local items = require('cland.items')
local E = require('cland.explorer')
local present = items.present
local M = { drafts = {}, draft_versions = {} }
local function valid_win(win) return win and api.nvim_win_is_valid(win) end
local function sw(text) return api.nvim_strwidth(text) end
function M.text(m)
  local lines = api.nvim_buf_get_lines(m.input, 0, -1, false)
  if lines[1] then lines[1] = lines[1]:gsub('^› ', '') end
  return table.concat(lines, '\n')
end

function M.context_lines(ids, card_line, selection)
  local ix = E.ix or E.index()
  local out = { 'from the explorer · scope ' .. table.concat(E.crumbs(E.scope_key()), ' › ') .. (selection and (' · ' .. #ids .. (#ids == 1 and ' item selected' or ' items selected')) or '') }
  for _, id in ipairs(ids) do
    local it = ix.by[id] or state.item(id)
    if it then
      local parent = present(it.parent) and (ix.by[it.parent] or state.item(it.parent))
      local status = E.is_container(ix, it) and E.derived(ix, it) or (it.kind == 'task' and (it.status or it.state) or it.state)
      out[#out + 1] = table.concat({ it.id, it.kind or 'task', status, parent and (parent.id .. ' ' .. parent.title) or 'no container',
        'rank ' .. tostring(it.rank or '—'), it.title }, ' · ')
    end
  end
  if card_line then out[#out + 1] = 'card line: ' .. vim.trim(card_line) end
  return out
end

-- m always goes to General; M binds a topic when an open item has none.
function M.destination(ids, item_topic, selection)
  if not item_topic or selection then return 'general', 'General' end
  local it = state.item(ids[1])
  local topic = items.topic(it)
  if topic then return topic.id, it.id .. "'s topic" end
  return nil, it.id .. "'s topic, created on send"
end

function M.close_composer()
  local m = M.compose_state
  if not m then return end
  M.compose_state = nil
  if m.input and api.nvim_buf_is_valid(m.input) then
    local lines = api.nvim_buf_get_lines(m.input, 0, -1, false)
    if lines[1] then lines[1] = lines[1]:gsub('^› ', '') end
    local text = vim.trim(table.concat(lines, '\n'))
    M.drafts[m.draft] = text ~= '' and text or nil
    M.draft_versions[m.draft] = {}
  end
  for _, w in ipairs({ m.ctx_win, m.input_win }) do if valid_win(w) then pcall(api.nvim_win_close, w, true) end end
  for _, b in ipairs({ m.ctx, m.input }) do if b and api.nvim_buf_is_valid(b) then pcall(api.nvim_buf_delete, b, { force = true }) end end
  if valid_win(m.from) then pcall(api.nvim_set_current_win, m.from) end
  vim.cmd('stopinsert')
end

--- m: the composer in place (two floats over the card): the context that rides along, read-only, and a line
--- for the human's text. Enter sends `topic.send` to the Coordinator through the plugin's hub client.
function M.message(ids, card_line, item_topic, selection)
  ids = vim.tbl_filter(function(id) return state.item(id) ~= nil end, ids or {})
  if #ids == 0 then return state.say((item_topic and 'M' or 'm') .. ': this row has no item') end
  local it = state.item(ids[1])
  if item_topic and not selection and it.state == 'closed' and not items.topic(it) then
    return state.say(it.id .. ' is closed: a closed item gets no topic; m sends to General', 'ClandAmberBar')
  end
  M.close_composer()
  local topic, where = M.destination(ids, item_topic, selection)
  local context = M.context_lines(ids, card_line, selection)
  local anchor = valid_win(E.card.win) and E.card.win or api.nvim_get_current_win()
  local pos = api.nvim_win_get_position(anchor)
  local aw, H = api.nvim_win_get_width(anchor), api.nvim_win_get_height(anchor)
  -- choice: in place over the card (P20), widened to 64 columns over the tree when the card is narrower
  local W = math.min(vim.o.columns - 4, math.max(aw - 2, 64))
  local left = math.max(0, pos[2] + aw - W - 2)
  local coord = state.coordinator()
  local ctx_lines = { 'to  ' .. (coord and coord.name or 'the Coordinator') .. ' [Coordinator] · in ' .. where,
    'rides with it, as the Coordinator receives it:' }
  vim.list_extend(ctx_lines, context)
  local rows_needed = 0
  for _, l in ipairs(ctx_lines) do rows_needed = rows_needed + math.max(1, math.ceil(sw(l) / W)) end
  local ctx_h = math.min(rows_needed + 2, math.max(3, H - 8))
  local m = { from = api.nvim_get_current_win(), draft = (selection and ('selection:' .. table.concat(E.crumbs(E.scope_key()), '/')) or 'item') .. ':' .. table.concat(ids, ','), ids = ids, selection = selection, card_line = card_line, topic = topic, where = where, context = context }
  m.ctx = api.nvim_create_buf(false, true)
  api.nvim_buf_set_lines(m.ctx, 0, -1, false, ctx_lines)
  vim.bo[m.ctx].modifiable = false
  vim.b[m.ctx].cland_role = 'explorer_compose'
  local cns = api.nvim_create_namespace('cland.explorer.compose')
  api.nvim_buf_set_extmark(m.ctx, cns, 0, 0, { end_col = #ctx_lines[1], hl_group = 'ClandTeal' })
  api.nvim_buf_set_extmark(m.ctx, cns, 1, 0, { end_col = #ctx_lines[2], hl_group = 'ClandDim' })
  for r = 3, #ctx_lines do api.nvim_buf_set_extmark(m.ctx, cns, r - 1, 0, { end_col = #ctx_lines[r], hl_group = 'ClandBlue' }) end
  local row = pos[1] + math.max(0, H - ctx_h - 6)
  m.ctx_win = api.nvim_open_win(m.ctx, false, { relative = 'editor', row = row, col = left, width = W, height = ctx_h - 2,
    style = 'minimal', border = 'rounded', zindex = 60, focusable = false,
    title = ' message to the Coordinator · ' .. (#ids > 1 and (#ids .. ' rows') or ids[1]) .. ' ', title_pos = 'left' })
  vim.wo[m.ctx_win].wrap = true
  vim.wo[m.ctx_win].winbar = ''
  m.input = api.nvim_create_buf(false, true)
  vim.bo[m.input].buftype = 'prompt'
  vim.bo[m.input].bufhidden = 'wipe'
  vim.b[m.input].cland_role = 'explorer_compose'
  vim.fn.prompt_setprompt(m.input, '› ')
  m.input_win = api.nvim_open_win(m.input, true, { relative = 'editor', row = row + ctx_h, col = left, width = W, height = 2,
    style = 'minimal', border = 'rounded', zindex = 61, title = ' your message ', title_pos = 'left',
    footer = ' ↵ send · S-↵ newline · Esc closes, keeps the draft ', footer_pos = 'right' })
  vim.wo[m.input_win].wrap = true
  vim.wo[m.input_win].winbar = ''
  M.compose_state = m
  local draft = M.drafts[m.draft]
  if draft then
    local lines = vim.split(draft, '\n', { plain = true })
    lines[1] = '› ' .. lines[1]
    api.nvim_buf_set_lines(m.input, 0, -1, false, lines)
  end
  vim.fn.prompt_setcallback(m.input, function(text)
    vim.schedule(function() M.send(m, text) end)
  end)
  local function map(modes, lhs, fn) require('cland.actions').map(modes, lhs, fn, { buffer = m.input, nowait = true, silent = true }) end
  map({ 'i', 'n' }, '<Esc>', function() M.close_composer() end)
  map('i', '<CR>', '<CR>')
  map('i', '<S-CR>', '<S-CR>')
  map('n', '<CR>', function() M.send(m, M.text(m)) end)
  map('n', 'q', function() M.close_composer() end)
  vim.cmd('startinsert!')
end

-- Lua string lengths are bytes. Cut only at UTF-8 boundaries.
local function cut(text, bytes)
  if #text <= bytes then return text end
  local stop = math.max(0, bytes)
  while stop > 0 and text:byte(stop+1) and text:byte(stop+1) >= 128 and text:byte(stop+1) < 192 do stop = stop - 1 end
  return text:sub(1, stop)
end
local LIMIT = 8192
local function payload(m, text, topic)
  text = vim.trim(text)
  local full = text .. '\n\n' .. table.concat(m.context, '\n')
  if #full <= LIMIT then return {type='topic.send',topic=topic,text=full,to={'coordinator'}} end
  local scope = cut(m.context[1],1024)
  local card = m.card_line and ('\ncard line: ' .. cut(vim.trim(m.card_line),1024)) or ''
  local prefix = cut(text,4096) .. '\n\n' .. scope
  local kept = 0
  for n=1,#m.ids do
    local line = m.context[n+1]
    local reserve = n < #m.ids and #('\n… and ' .. (#m.ids-n) .. ' more: ') or 0
    if #prefix + 1 + #line + #card + reserve > LIMIT then break end
    prefix = prefix .. '\n' .. line
    kept = n
  end
  if kept < #m.ids then
    local omitted = {}
    for n=kept+1,#m.ids do omitted[#omitted+1] = m.ids[n] end
    local label = '\n… and ' .. (#m.ids-kept) .. ' more: '
    prefix = prefix .. label .. cut(table.concat(omitted,', '),LIMIT-#prefix-#label-#card)
  end
  return {type='topic.send',topic=topic,text=prefix .. card,to={'coordinator'}}
end

-- Match the hub's 200 UTF-16-unit title cap without splitting a character.
local function topic_title(it)
  local title, chars, units = it.id .. ' ' .. it.title, 0, 0
  while chars < vim.fn.strchars(title) do
    local cost = vim.fn.strgetchar(title,chars) > 0xffff and 2 or 1
    if units + cost > 200 then break end
    chars, units = chars + 1, units + cost
  end
  return vim.fn.strcharpart(title,0,chars)
end

function M.send(m, text)
  text = vim.trim(text or '')
  if text == '' or m.sending then return end
  m.sending = true
  if M.compose_state == m then
    api.nvim_buf_set_lines(m.input,0,-1,false,{'› '})
    M.close_composer()
  end
  M.drafts[m.draft] = text
  M.draft_versions[m.draft] = m
  local client = require('cland').client
  if not (client and client:connected()) then
    return state.say('m: the hub is not connected; the draft is kept', 'ClandAmberBar')
  end
  state.say('sending to the Coordinator in ' .. m.where)
  local function failed(err)
    state.say('m: not sent (' .. tostring(err) .. '); the draft is kept', 'ClandRedBar')
  end
  local function send_to(topic)
    client:request(payload(m,text,topic),function(err)
      if err then return failed(err) end
      if M.draft_versions[m.draft] == m then M.drafts[m.draft], M.draft_versions[m.draft] = nil, nil end
      state.say('sent to the Coordinator in ' .. (topic == 'general' and 'General' or (m.ids[1] .. "'s topic")))
    end)
  end
  if m.topic then return send_to(m.topic) end
  -- Recheck live state: a topic may have arrived while the human was typing.
  local it = state.item(m.ids[1])
  local topic = it and items.topic(it)
  if topic then return send_to(topic.id) end
  if not it then return failed('the item no longer exists') end
  client:request({type='topic.create',title=topic_title(it),item=it.id},function(err,value)
    if err then return failed(err) end
    state.upsert_topic(value.topic)
    send_to(value.topic.id)
  end)
end

function M.here(item_topic, selection)
  local ids, card_line = {}
  if vim.b.cland_role == 'card' then
    ids = {E.card.key}
    card_line = api.nvim_get_current_line()
  elseif selection then
    local first, last = vim.fn.line('v'), api.nvim_win_get_cursor(0)[1]
    if first > last then first, last = last, first end
    for row=first,last do
      local info = E.rows[row]
      if info and info.item then ids[#ids+1] = info.item end
    end
    vim.cmd('normal! \27')
  else
    local info = E.rows[api.nvim_win_get_cursor(0)[1]]
    if info and info.item then ids = {info.item} end
  end
  M.message(ids,card_line,item_topic,selection)
end

function M.line(it)
  return 'm  message the Coordinator in General · M ' .. (items.topic(it) and ('in ' .. it.id .. "'s topic") or ('creates ' .. it.id .. "'s topic"))
end
return M
