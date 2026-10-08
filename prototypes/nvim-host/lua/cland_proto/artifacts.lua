-- PROTOTYPE (ticket #15, workbench): opening an artifact (#9). Markdown and
-- Mermaid render inside Neovim in v0 (here: a float with the index entry
-- and the fake file); HTML, SVG and PNG would go to the browser (gb / o).
local api = vim.api
local state = require('cland_proto.state')
local M = {}

function M.browser(id)
  local a = id and state.artifact(id)
  if not a then
    vim.notify('cland-proto: put the cursor on an artifact chip', vim.log.levels.INFO)
    return
  end
  if a.kind == 'page' then
    vim.notify(('cland-proto: %s would open %s in the default browser (not in the prototype)'):format(a.id, a.path), vim.log.levels.INFO)
  else
    vim.notify(('cland-proto: %s is a %s; v0 renders it inside Neovim (only HTML, SVG and PNG go to the browser)'):format(a.id, a.kind),
      vim.log.levels.INFO)
  end
end

function M.open(id)
  local a = state.artifact(id)
  if not a then
    vim.notify('cland-proto: no artifact ' .. tostring(id), vim.log.levels.WARN)
    return
  end
  local t = a.topic and state.topic(a.topic)
  local lines = {
    ('%s · %s · %s%s · by %s · topic %s'):format(a.id, a.kind, a.status, a.note and (' (' .. a.note .. ')') or '', a.by,
      t and ('"' .. t.title .. '"') or 'none (project-wide)'),
    a.path .. ' · not committed',
    ('─'):rep(76),
  }
  vim.list_extend(lines, a.content)
  local buf = api.nvim_create_buf(false, true)
  api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].modifiable = false
  vim.bo[buf].filetype = a.ft == 'markdown' and 'markdown' or ''
  local width = math.min(84, vim.o.columns - 6)
  local height = math.min(#lines, vim.o.lines - 8)
  local win = api.nvim_open_win(buf, true, {
    relative = 'editor', row = math.floor((vim.o.lines - height) / 2) - 1, col = math.floor((vim.o.columns - width) / 2),
    width = width, height = height, border = 'rounded', style = 'minimal', zindex = 70,
    title = { { ' ' .. a.id .. ' · ' .. a.title .. ' ', 'ClandBlueBold' } }, title_pos = 'center',
    footer = { { ' q close · o open in the browser (HTML only) · p promote ', 'ClandDim' } }, footer_pos = 'center',
  })
  vim.wo[win].winbar = ''
  vim.wo[win].wrap = true
  local ns = api.nvim_create_namespace('cland_proto_artifact')
  api.nvim_buf_set_extmark(buf, ns, 0, 0, { end_col = #lines[1], hl_group = 'ClandBlue' })
  api.nvim_buf_set_extmark(buf, ns, 1, 0, { end_col = #lines[2], hl_group = 'ClandDim' })
  for _, k in ipairs({ 'q', '<Esc>' }) do
    vim.keymap.set('n', k, function()
      pcall(api.nvim_win_close, win, true)
    end, { buffer = buf, nowait = true })
  end
  vim.keymap.set('n', 'o', function()
    M.browser(id)
  end, { buffer = buf, nowait = true })
  vim.keymap.set('n', 'p', function()
    vim.notify(('cland-proto: p would promote %s into the repo (docs/ or a chosen path); not in the prototype'):format(id),
      vim.log.levels.INFO)
  end, { buffer = buf, nowait = true })
end

return M
