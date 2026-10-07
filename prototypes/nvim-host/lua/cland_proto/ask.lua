-- PROTOTYPE (ticket #15): asks (#7), grown from the engine prototype's ask
-- float (#11). An ask is a message kind with options and a free answer; the
-- answer is a message carrying answer_to. Variants A-C draw asks inline in
-- the thread (chat.lua); variant D shows them as this float.
local api = vim.api
local state = require('cland_proto.state')
local M = { ns = api.nvim_create_namespace('cland_proto_ask') }

local function finish(a, answer_text, choice)
  a.state, a.answer, a.choice, a.answered_at = 'answered', answer_text, choice, state.now_min()
  local chat = require('cland_proto.chat')
  local reply = choice and {
    ('Going with %d: %s.'):format(choice, a.options[choice].label:gsub('^%u', string.lower)),
    'I will update ' .. (state.topic(a.topic).item or 'the plan') .. ' and report back here.',
  } or { 'Thanks, I will take your answer from here and report back in this topic.' }
  chat.send(a.topic, answer_text, { to = a.from, answer_to = a.id, reply = reply })
  M.close_float()
end

function M.answer(id, i)
  local a = state.ask(id)
  if not a or a.state ~= 'open' then
    return
  end
  finish(a, ('%d. %s'):format(i, a.options[i].label), i)
end

function M.answer_free(id, text)
  local a = state.ask(id)
  if not a or a.state ~= 'open' then
    return
  end
  finish(a, text, nil)
end

-- Free answer: the composer of the ask's topic sends the next message as the answer.
function M.start_free(id)
  local a = state.ask(id)
  if not a then
    return
  end
  M.close_float()
  require('cland_proto.chat').answering[a.topic] = a.id
  state.changed('free answer to ask #' .. a.id .. ' started')
  require('cland_proto.app').focus_composer(a.topic, nil, true)
end

function M.withdraw(id)
  local a = state.ask(id)
  if a and a.state == 'open' then
    a.state = 'withdrawn'
    local t = state.topic(a.topic)
    t.messages[#t.messages + 1] = { kind = 'system', at = state.now_min(), text = a.from .. ' withdrew the ask (resolve)' }
    require('cland_proto.chat').recompute(t, 'replied')
    state.changed('ask #' .. id .. ' withdrawn')
  end
end

function M.is_open()
  return M.win ~= nil and api.nvim_win_is_valid(M.win)
end

function M.close_float()
  if M.is_open() then
    pcall(api.nvim_win_close, M.win, true)
  end
  M.win = nil
end

-- The ask as a float with numbered options over window `anchor` (variant D).
function M.float(id, anchor)
  local a = state.ask(id)
  if not a or a.state ~= 'open' then
    return
  end
  M.close_float()
  anchor = (anchor and api.nvim_win_is_valid(anchor)) and anchor or api.nvim_get_current_win()
  local t = state.topic(a.topic)
  local lines = { ' ' .. a.question, '' }
  for i, o in ipairs(a.options) do
    lines[#lines + 1] = ('  %d  %s'):format(i, o.label)
  end
  if a.free then
    lines[#lines + 1] = '  4  ✎ your own answer (goes to the composer)'
  end
  lines[#lines + 1] = ''
  lines[#lines + 1] = ('  q  later: the topic stays "waiting for you"')
  M.buf = M.buf and api.nvim_buf_is_valid(M.buf) and M.buf or api.nvim_create_buf(false, true)
  vim.bo[M.buf].modifiable = true
  api.nvim_buf_set_lines(M.buf, 0, -1, false, lines)
  vim.bo[M.buf].modifiable = false
  api.nvim_buf_clear_namespace(M.buf, M.ns, 0, -1)
  api.nvim_buf_set_extmark(M.buf, M.ns, 0, 0, { end_col = #lines[1], hl_group = 'ClandAskQuestion' })
  for i = 3, 3 + #a.options - (a.free and 0 or 1) do
    api.nvim_buf_set_extmark(M.buf, M.ns, i - 1, 1, { end_col = 4, hl_group = 'ClandAskKey' })
  end
  api.nvim_buf_set_extmark(M.buf, M.ns, #lines - 1, 0, { end_col = #lines[#lines], hl_group = 'ClandDim' })
  local aw, ah = api.nvim_win_get_width(anchor), api.nvim_win_get_height(anchor)
  local width = 4
  for _, l in ipairs(lines) do
    width = math.max(width, vim.fn.strdisplaywidth(l) + 2)
  end
  width = math.min(width, aw - 4)
  M.win = api.nvim_open_win(M.buf, true, {
    relative = 'win',
    win = anchor,
    row = math.max(0, math.floor((ah - #lines) / 2) - 1),
    col = math.max(0, math.floor((aw - width) / 2)),
    width = width,
    height = #lines,
    border = 'rounded',
    title = { { ' Ask · ' .. a.from .. ' [' .. a.role .. '] · ' .. (t.item or 'needs you') .. ' ', 'ClandAskTitle' } },
    title_pos = 'center',
    footer = { { ' 1-3 answer · 4 own answer · q later ', 'ClandDim' } },
    footer_pos = 'center',
    style = 'minimal',
    zindex = 60,
  })
  vim.wo[M.win].winbar = ''
  vim.wo[M.win].cursorline = false
  for i = 1, #a.options do
    vim.keymap.set('n', tostring(i), function()
      M.answer(a.id, i)
    end, { buffer = M.buf, nowait = true })
  end
  vim.keymap.set('n', '4', function()
    M.start_free(a.id)
  end, { buffer = M.buf, nowait = true })
  for _, k in ipairs({ 'q', '<Esc>' }) do
    vim.keymap.set('n', k, function()
      M.close_float()
      require('cland_proto.app').focus_composer(a.topic, nil, false)
    end, { buffer = M.buf, nowait = true })
  end
end

return M
