-- PROTOTYPE (ticket #15): a floating fuzzy list (topics, sessions). Two
-- floats: a one-line input and the matches under it (matchfuzzypos).
-- <CR> picks, <Esc> closes, <C-n>/<C-p>, <Down>/<Up> or <Tab>/<S-Tab> move.
local api = vim.api
local M = { ns = api.nvim_create_namespace('cland_proto_picker') }

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

local function render(p)
  local query = api.nvim_buf_get_lines(p.ibuf, 0, 1, false)[1] or ''
  local texts = vim.tbl_map(function(it)
    return it.text
  end, p.items)
  local shown, pos = {}, {}
  if vim.trim(query) == '' then
    for i, it in ipairs(p.items) do
      shown[i], pos[i] = it, {}
    end
  else
    local res = vim.fn.matchfuzzypos(texts, query)
    for i, text in ipairs(res[1]) do
      for _, it in ipairs(p.items) do
        if it.text == text then
          shown[i], pos[i] = it, res[2][i]
          break
        end
      end
    end
  end
  p.shown = shown
  p.sel = math.max(1, math.min(p.sel, #shown))
  local lines = {}
  for i, it in ipairs(shown) do
    lines[i] = ' ' .. it.text
  end
  if #lines == 0 then
    lines = { ' (no match)' }
  end
  vim.bo[p.lbuf].modifiable = true
  api.nvim_buf_set_lines(p.lbuf, 0, -1, false, lines)
  vim.bo[p.lbuf].modifiable = false
  api.nvim_buf_clear_namespace(p.lbuf, M.ns, 0, -1)
  for i, it in ipairs(shown) do
    for _, hlr in ipairs(it.hl or {}) do
      pcall(api.nvim_buf_set_extmark, p.lbuf, M.ns, i - 1, hlr[1] + 1, { end_col = hlr[2] + 1, hl_group = hlr[3] })
    end
    for _, c in ipairs(pos[i] or {}) do
      -- matchfuzzypos gives character indexes; convert to bytes
      local b = vim.str_byteindex(it.text, 'utf-32', c)
      local e = vim.str_byteindex(it.text, 'utf-32', c + 1)
      pcall(api.nvim_buf_set_extmark, p.lbuf, M.ns, i - 1, b + 1, { end_col = e + 1, hl_group = 'ClandPickMatch', priority = 300 })
    end
  end
  if #shown > 0 then
    api.nvim_buf_set_extmark(p.lbuf, M.ns, p.sel - 1, 0, { line_hl_group = 'ClandPickSel', priority = 10 })
    pcall(api.nvim_win_set_cursor, p.lwin, { p.sel, 0 })
  end
  local h = math.max(1, math.min(#lines, p.max_height))
  pcall(api.nvim_win_set_config, p.lwin, { height = h })
end

-- items: { { text = 'shown and matched', hl = { {s, e, group} }, value = any } }
function M.open(opts)
  M.close()
  local items = opts.items
  local width = math.min(opts.width or 76, vim.o.columns - 4)
  local max_height = math.min(14, vim.o.lines - 10)
  local row = math.floor((vim.o.lines - max_height) / 3)
  local col = math.floor((vim.o.columns - width) / 2)
  local p = { items = items, sel = 1, max_height = max_height, on_choose = opts.on_choose, prev = api.nvim_get_current_win() }
  p.lbuf = api.nvim_create_buf(false, true)
  p.lwin = api.nvim_open_win(p.lbuf, false, {
    relative = 'editor', row = row + 3, col = col, width = width, height = math.min(#items, max_height),
    border = 'rounded', style = 'minimal', focusable = false, zindex = 80,
    footer = { { ' ⏎ pick · Esc close · C-n/C-p move ', 'ClandDim' } }, footer_pos = 'right',
  })
  p.ibuf = api.nvim_create_buf(false, true)
  p.iwin = api.nvim_open_win(p.ibuf, true, {
    relative = 'editor', row = row, col = col, width = width, height = 1,
    border = 'rounded', style = 'minimal', zindex = 81,
    title = { { ' ' .. opts.title .. ' ', 'ClandAskTitle' } }, title_pos = 'left',
  })
  vim.wo[p.lwin].winbar = ''
  vim.wo[p.iwin].winbar = ''
  vim.wo[p.lwin].cursorline = false
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
  local function choose()
    local it = p.shown[p.sel]
    M.close()
    if it then
      vim.schedule(function()
        p.on_choose(it.value)
      end)
    end
  end
  local function map(lhs, fn)
    vim.keymap.set({ 'i', 'n' }, lhs, fn, { buffer = p.ibuf, nowait = true })
  end
  map('<CR>', choose)
  map('<Esc>', M.close)
  map('<C-c>', M.close)
  for _, k in ipairs({ '<C-n>', '<Down>', '<Tab>' }) do
    map(k, move(1))
  end
  for _, k in ipairs({ '<C-p>', '<Up>', '<S-Tab>' }) do
    map(k, move(-1))
  end
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
  render(p)
  vim.cmd.startinsert()
end

return M
