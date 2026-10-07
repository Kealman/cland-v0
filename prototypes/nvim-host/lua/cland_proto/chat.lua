-- PROTOTYPE (ticket #11): fake chat. Topic list, thread view and composer,
-- drawn with scratch buffers, extmarks and a prompt buffer.
local api = vim.api
local M = {
  topics = require('cland_proto.data').topics,
  current = 1,
  ns = api.nvim_create_namespace('cland_proto_chat'),
}

M.STATUS = {
  ['waiting-for-you'] = { icon = '●', hl = 'ClandWaitYou' },
  ['waiting-for-approval'] = { icon = '◆', hl = 'ClandWaitApproval' },
  busy = { icon = '◐', hl = 'ClandBusy' },
  open = { icon = '○', hl = 'ClandOpen' },
  closed = { icon = '✓', hl = 'ClandClosed' },
}

local ROLE_HL = {
  Coordinator = 'ClandRoleCoord',
  Reviewer = 'ClandRoleReview',
  QA = 'ClandRoleQA',
  Implementer = 'ClandRoleImpl',
  Human = 'ClandRoleHuman',
  System = 'Comment',
}

function M.highlights()
  local set = function(name, val) api.nvim_set_hl(0, name, val) end
  set('ClandWaitYou', { fg = '#ff6b6b', bold = true })
  set('ClandWaitApproval', { fg = '#f2c94c', bold = true })
  set('ClandBusy', { fg = '#56ccf2' })
  set('ClandOpen', { fg = '#6fcf97' })
  set('ClandClosed', { fg = '#828282' })
  set('ClandSel', { bg = '#2d3340' })
  set('ClandRoleCoord', { fg = '#bb86fc', bold = true })
  set('ClandRoleReview', { fg = '#f2994a', bold = true })
  set('ClandRoleQA', { fg = '#56ccf2', bold = true })
  set('ClandRoleImpl', { fg = '#6fcf97', bold = true })
  set('ClandRoleHuman', { fg = '#ffffff', bold = true })
  set('ClandBrand', { fg = '#111111', bg = '#bb86fc', bold = true })
  set('ClandBar', { fg = '#dddddd', bg = '#3a3f4b' })
  set('ClandBarFocus', { fg = '#111111', bg = '#f2c94c', bold = true })
  set('ClandAskTitle', { fg = '#f2c94c', bold = true })
  set('ClandAskKey', { fg = '#111111', bg = '#f2c94c', bold = true })
end

local function scratch(name)
  local buf = api.nvim_create_buf(false, true)
  vim.b[buf].cland_role = name
  return buf
end

function M.create()
  M.topics_buf = scratch('topics')
  M.thread_buf = scratch('thread')
  M.composer_buf = scratch('composer')
  vim.bo[M.composer_buf].buftype = 'prompt'
  vim.fn.prompt_setprompt(M.composer_buf, 'you> ')
  vim.fn.prompt_setcallback(M.composer_buf, M.on_submit)
  vim.keymap.set('n', '<CR>', M.select_under_cursor, { buffer = M.topics_buf, desc = 'open topic' })
  M.render_topics()
  M.render_thread()
end

function M.render_topics()
  local buf = M.topics_buf
  local lines = {}
  for i, t in ipairs(M.topics) do
    lines[i] = '    ' .. t.title
  end
  vim.bo[buf].modifiable = true
  api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].modifiable = false
  api.nvim_buf_clear_namespace(buf, M.ns, 0, -1)
  for i, t in ipairs(M.topics) do
    local st = M.STATUS[t.status]
    api.nvim_buf_set_extmark(buf, M.ns, i - 1, 0, {
      virt_text = { { ' ' .. st.icon .. ' ', st.hl } },
      virt_text_pos = 'overlay',
      line_hl_group = i == M.current and 'ClandSel' or nil,
    })
    api.nvim_buf_set_extmark(buf, M.ns, i - 1, 0, {
      virt_lines = { { { '    ' .. t.status, st.hl }, { ('  %d msgs'):format(#t.messages), 'Comment' } } },
    })
  end
end

function M.render_thread()
  local buf = M.thread_buf
  local t = M.topics[M.current]
  local lines, headers = {}, {}
  for _, m in ipairs(t.messages) do
    lines[#lines + 1] = m.from
    headers[#headers + 1] = { row = #lines - 1, msg = m }
    for _, l in ipairs(m.text) do
      lines[#lines + 1] = '  ' .. l
    end
    lines[#lines + 1] = ''
  end
  vim.bo[buf].modifiable = true
  api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].modifiable = false
  api.nvim_buf_clear_namespace(buf, M.ns, 0, -1)
  for _, h in ipairs(headers) do
    local m, hl = h.msg, ROLE_HL[h.msg.role] or 'Normal'
    api.nvim_buf_set_extmark(buf, M.ns, h.row, 0, { end_col = #m.from, hl_group = hl })
    api.nvim_buf_set_extmark(buf, M.ns, h.row, 0, {
      virt_text = { { '  ' .. m.role, hl }, { ' · ' .. m.harness, 'Comment' } },
      virt_text_pos = 'eol',
    })
    api.nvim_buf_set_extmark(buf, M.ns, h.row, 0, {
      virt_text = { { m.time .. ' ', 'Comment' } },
      virt_text_pos = 'right_align',
    })
  end
  for _, win in ipairs(vim.fn.win_findbuf(buf)) do
    api.nvim_win_set_cursor(win, { math.max(1, #lines - 1), 0 })
  end
end

function M.select(i)
  if not M.topics[i] then
    return
  end
  M.current = i
  M.render_topics()
  M.render_thread()
  vim.cmd.redrawstatus({ bang = true })
end

function M.select_under_cursor()
  M.select(api.nvim_win_get_cursor(0)[1])
end

function M.add(msg, topic_index)
  local t = M.topics[topic_index or M.current]
  msg.time = msg.time or os.date('%H:%M')
  t.messages[#t.messages + 1] = msg
  if (topic_index or M.current) == M.current then
    M.render_thread()
  end
  M.render_topics()
end

-- Enter in the composer: append the text and a fake reply after a short delay.
function M.on_submit(text)
  if not text or vim.trim(text) == '' then
    return
  end
  local idx = M.current
  local t = M.topics[idx]
  M.add({ from = 'you', role = 'Human', harness = 'cland', text = vim.split(text, '\n') }, idx)
  vim.schedule(function()
    -- keep only the fresh prompt line in the composer
    local n = api.nvim_buf_line_count(M.composer_buf)
    if n > 1 then
      api.nvim_buf_set_lines(M.composer_buf, 0, n - 1, false, {})
    end
  end)
  local first = vim.split(text, '\n')[1]
  vim.defer_fn(function()
    M.add({
      from = t.agent.from,
      role = t.agent.role,
      harness = t.agent.harness,
      text = { ('(fake reply) Noted: "%s"'):format(first), ('(%d line(s) received)'):format(#vim.split(text, '\n')) },
    }, idx)
  end, 700)
end

return M
