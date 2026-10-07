-- PROTOTYPE (ticket #15): opening an artifact reference (#9). Markdown and
-- Mermaid render inside Neovim in v0; here a float shows the index entry and
-- the (fake) file content. HTML, SVG and PNG would go to the browser.
local api = vim.api
local state = require('cland_proto.state')
local M = {}

function M.open(id)
  local a = state.S.artifacts[id]
  if not a then
    vim.notify('cland-proto: no artifact ' .. tostring(id), vim.log.levels.WARN)
    return
  end
  local t = state.topic(a.topic)
  local lines = {
    ('%s · %s · %s · by %s · topic "%s"'):format(a.id, a.kind, a.status, a.by, t and t.title or '-'),
    a.path .. ' · not committed (promote moves it in)',
    ('─'):rep(72),
  }
  vim.list_extend(lines, a.content)
  local buf = api.nvim_create_buf(false, true)
  api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].modifiable = false
  vim.bo[buf].filetype = a.ft == 'markdown' and 'markdown' or ''
  local width = math.min(84, vim.o.columns - 6)
  local height = math.min(#lines, vim.o.lines - 8)
  local win = api.nvim_open_win(buf, true, {
    relative = 'editor',
    row = math.floor((vim.o.lines - height) / 2) - 1,
    col = math.floor((vim.o.columns - width) / 2),
    width = width,
    height = height,
    border = 'rounded',
    title = { { ' ' .. a.id .. ': ' .. a.title .. ' ', 'ClandArtifact' } },
    title_pos = 'center',
    footer = { { ' q close · o "open in the browser" (HTML/SVG/PNG only in v0) ', 'ClandDim' } },
    footer_pos = 'center',
    style = 'minimal',
    zindex = 70,
  })
  vim.wo[win].winbar = ''
  vim.wo[win].wrap = true
  local ns = api.nvim_create_namespace('cland_proto_artifact')
  api.nvim_buf_set_extmark(buf, ns, 0, 0, { end_col = #lines[1], hl_group = 'ClandArtifact' })
  api.nvim_buf_set_extmark(buf, ns, 1, 0, { end_col = #lines[2], hl_group = 'ClandDim' })
  for _, k in ipairs({ 'q', '<Esc>' }) do
    vim.keymap.set('n', k, function()
      pcall(api.nvim_win_close, win, true)
    end, { buffer = buf, nowait = true })
  end
  vim.keymap.set('n', 'o', function()
    vim.notify(('cland-proto: %s is a %s; v0 renders it here (only HTML, SVG and PNG go to the browser)'):format(a.id, a.kind))
  end, { buffer = buf, nowait = true })
end

return M
