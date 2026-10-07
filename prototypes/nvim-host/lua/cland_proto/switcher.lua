-- PROTOTYPE (ticket #15): the variant switcher. Same fake state, four main
-- screens. <Space>v / <C-\>v cycle, <Space>V goes back, :ClandVariant <name>
-- jumps. A pink pill floats at the bottom centre: it is prototype chrome,
-- not part of any design being judged.
local api = vim.api
local M = { order = { 'slack', 'inbox', 'session', 'tabs' }, current = nil }

M.VARIANTS = {
  slack = { key = 'A', name = 'slack', mod = 'cland_proto.variants.slack' },
  inbox = { key = 'B', name = 'inbox-first', mod = 'cland_proto.variants.inbox' },
  session = { key = 'C', name = 'session-centric', mod = 'cland_proto.variants.session' },
  tabs = { key = 'D', name = 'tabs', mod = 'cland_proto.variants.tabs' },
}

function M.resolve(name)
  name = vim.trim((name or ''):lower())
  for _, id in ipairs(M.order) do
    local v = M.VARIANTS[id]
    if name == id or name == v.key:lower() or name == v.name then
      return id
    end
  end
end

function M.mod(id)
  return require(M.VARIANTS[id or M.current or M.order[1]].mod)
end

function M.info()
  local id = M.current or M.order[1]
  local v = M.VARIANTS[id]
  return { id = id, key = v.key, name = v.name }
end

-- Close everything a variant built: other tab pages, other windows, floats.
local function teardown()
  if M.current then
    local ok, v = pcall(M.mod, M.current)
    if ok and v.teardown then
      pcall(v.teardown)
    end
  end
  require('cland_proto.picker').close()
  require('cland_proto.ask').close_float()
  pcall(api.nvim_del_augroup_by_name, 'cland_proto_variant')
  for _, win in ipairs(api.nvim_list_wins()) do
    if api.nvim_win_get_config(win).relative ~= '' then
      pcall(api.nvim_win_close, win, true)
    end
  end
  vim.cmd('silent! tabonly!')
  vim.cmd('silent! only!')
  vim.o.showtabline = 0
  -- a neutral buffer, so no variant inherits another's window
  if not (M.blank and api.nvim_buf_is_valid(M.blank)) then
    M.blank = api.nvim_create_buf(false, true)
    vim.b[M.blank].cland_role = 'blank'
  end
  api.nvim_win_set_buf(0, M.blank)
  for _, opt in ipairs({ 'winfixwidth', 'winfixheight', 'cursorline' }) do
    vim.wo[opt] = false
  end
end

function M.augroup()
  return api.nvim_create_augroup('cland_proto_variant', { clear = false })
end

function M.switch(name, quiet)
  local id = M.resolve(name)
  if not id then
    vim.notify('cland-proto: variants are ' .. table.concat(M.order, ', ') .. ' (or A-D)', vim.log.levels.ERROR)
    return
  end
  vim.cmd.stopinsert()
  teardown()
  M.current = id
  local v = M.mod(id)
  require('cland_proto.chat').set_style(v.thread_style or 'full', v.ask_style or 'inline')
  v.build()
  M.pill()
  require('cland_proto.app').render()
  if not quiet then
    -- surface the state on every switch (one line, no hit-enter prompt)
    local line = require('cland_proto.state').summary_line()
    local max = vim.o.columns - 12
    if vim.fn.strdisplaywidth(line) > max then
      line = vim.fn.strcharpart(line, 0, max - 1) .. '…'
    end
    api.nvim_echo({ { line, 'ClandDim' } }, false, {})
  end
end

function M.cycle(step)
  local idx = 1
  for i, id in ipairs(M.order) do
    if id == M.current then
      idx = i
    end
  end
  M.switch(M.order[(idx - 1 + step) % #M.order + 1])
end

local function chunks_width(chunks)
  local w = 0
  for _, c in ipairs(chunks or {}) do
    w = w + vim.fn.strdisplaywidth(tostring(c[1]))
  end
  return w
end

-- Centre the pill in the statusline, but inside the gap between the
-- variant's left and right segments when the centre would cover them.
function M.place_pill()
  if not (M.pill_win and api.nvim_win_is_valid(M.pill_win)) then
    return
  end
  local width = api.nvim_win_get_width(M.pill_win)
  local cols = vim.o.columns
  local col = math.floor((cols - width) / 2)
  local ok, left, right = pcall(M.mod().statusline)
  if ok then
    local lw, rw = chunks_width(left), chunks_width(right)
    if col < lw + 1 then
      col = lw + 1
    end
    if col + width > cols - rw - 1 then
      col = math.max(lw + 1, cols - rw - width - 1)
    end
  end
  col = math.max(0, math.min(col, cols - width))
  pcall(api.nvim_win_set_config, M.pill_win, {
    relative = 'editor', row = vim.o.lines - vim.o.cmdheight - 1, col = col,
  })
end

-- The pill: a non-focusable float over the global statusline.
function M.pill()
  if M.pill_win and api.nvim_win_is_valid(M.pill_win) then
    pcall(api.nvim_win_close, M.pill_win, true)
  end
  local v = M.info()
  local label = (' proto ◀ %s %s ▶ <Space>v '):format(v.key, v.name)
  if not (M.pill_buf and api.nvim_buf_is_valid(M.pill_buf)) then
    M.pill_buf = api.nvim_create_buf(false, true)
  end
  api.nvim_buf_set_lines(M.pill_buf, 0, -1, false, { label })
  local width = vim.fn.strdisplaywidth(label)
  local ok, win = pcall(api.nvim_open_win, M.pill_buf, false, {
    relative = 'editor',
    row = vim.o.lines - vim.o.cmdheight - 1,
    col = math.max(0, math.floor((vim.o.columns - width) / 2)),
    width = width,
    height = 1,
    style = 'minimal',
    focusable = false,
    mouse = false,
    zindex = 150,
    noautocmd = true,
  })
  if ok then
    M.pill_win = win
    vim.wo[win].winhighlight = 'Normal:ClandPill'
    vim.wo[win].winbar = ''
    M.place_pill()
  end
end

return M
