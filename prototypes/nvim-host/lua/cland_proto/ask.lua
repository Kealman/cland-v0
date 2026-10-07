-- PROTOTYPE (ticket #11): a fake "ask" dialog with options, opened as an
-- editor-relative float over the session column (the case in neovim#40915).
local api = vim.api
local M = { ns = api.nvim_create_namespace('cland_proto_ask') }

local OPTIONS = {
  { key = '1', label = 'Approve once' },
  { key = '2', label = 'Approve for this session' },
  { key = '3', label = 'Deny and tell the agent why' },
}

function M.is_open()
  return M.win ~= nil and api.nvim_win_is_valid(M.win)
end

function M.toggle()
  if M.is_open() then
    M.close()
  else
    M.open()
  end
end

function M.open()
  local app = require('cland_proto.app')
  local sessions = require('cland_proto.sessions')
  local tw = app.term_win()
  local pos = api.nvim_win_get_position(tw)
  local tw_w, tw_h = api.nvim_win_get_width(tw), api.nvim_win_get_height(tw)
  local s = sessions.current()
  local who = s and ('%s (session %d)'):format(s.name, s.id) or 'an agent'
  M.prev_win = api.nvim_get_current_win()
  M.prev_mode = api.nvim_get_mode().mode
  M.buf = api.nvim_create_buf(false, true)
  local lines = {
    ' ' .. who .. ' asks:',
    '',
    '   Run  git worktree add ../wt-impl-3 impl/topic-3 ?',
    '',
  }
  for _, o in ipairs(OPTIONS) do
    lines[#lines + 1] = ('   %s  %s'):format(o.key, o.label)
  end
  lines[#lines + 1] = ''
  lines[#lines + 1] = '   q  close, answer later'
  api.nvim_buf_set_lines(M.buf, 0, -1, false, lines)
  vim.bo[M.buf].modifiable = false
  api.nvim_buf_set_extmark(M.buf, M.ns, 0, 0, { end_col = #lines[1], hl_group = 'ClandAskTitle' })
  for i = 5, 5 + #OPTIONS - 1 do
    api.nvim_buf_set_extmark(M.buf, M.ns, i - 1, 3, { end_col = 4, hl_group = 'ClandAskKey' })
  end
  local width = math.max(30, math.min(64, tw_w - 6))
  local height = #lines
  M.win = api.nvim_open_win(M.buf, true, {
    relative = 'editor',
    row = pos[1] + math.max(1, math.floor((tw_h - height) / 3)),
    col = pos[2] + math.max(1, math.floor((tw_w - width) / 2)),
    width = width,
    height = height,
    border = 'rounded',
    title = ' Ask · needs you ',
    title_pos = 'center',
    footer = ' 1/2/3 answer · q close ',
    footer_pos = 'center',
    style = 'minimal',
    zindex = 60,
  })
  for _, o in ipairs(OPTIONS) do
    vim.keymap.set('n', o.key, function()
      M.close(o.label)
    end, { buffer = M.buf, nowait = true })
  end
  for _, k in ipairs({ 'q', '<Esc>' }) do
    vim.keymap.set('n', k, function()
      M.close()
    end, { buffer = M.buf, nowait = true })
  end
  app.refresh()
end

function M.close(answer)
  if M.is_open() then
    api.nvim_win_close(M.win, true)
  end
  M.win = nil
  if answer then
    require('cland_proto.chat').add({
      from = 'you',
      role = 'Human',
      harness = 'cland',
      text = { 'answered the ask: ' .. answer },
    })
  end
  if M.prev_win and api.nvim_win_is_valid(M.prev_win) then
    api.nvim_set_current_win(M.prev_win)
    local prev_mode = M.prev_mode
    vim.schedule(function()
      if prev_mode == 't' or (prev_mode == 'i' and vim.bo.buftype == 'prompt') then
        vim.cmd('startinsert!')
      end
    end)
  end
  require('cland_proto.app').refresh()
end

return M
