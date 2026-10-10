-- The board (spec section 5, Main.dc.html and Steady.dc.html, #36): a centre view (␣b) of six columns,
-- backlog · planned · in progress · review · qa · done, with a card per unit of work (epics and maps are
-- containers, not cards): the id with the verdict marks, the title, the claiming session or the assignee, and
-- the ask badge. The column is derived (items.column), never stored. ↵ or gi on a card opens its item view.
local api = vim.api
local state = require('cland.state')
local items = require('cland.items')

local M = { cells = {} }
local ns = api.nvim_create_namespace('cland.board')

local function sw(s)
  return api.nvim_strwidth(s or '')
end

local function fit(s, n)
  if n <= 0 then
    return ''
  end
  if sw(s) <= n then
    return s .. (' '):rep(n - sw(s))
  end
  local out = vim.fn.strcharpart(s, 0, math.max(0, n - 1))
  while sw(out) > n - 1 do
    out = vim.fn.strcharpart(out, 0, vim.fn.strchars(out) - 1)
  end
  return out .. '…' .. (' '):rep(math.max(0, n - 1 - sw(out)))
end

--- The cards of each column, ordered by id.
function M.columns()
  local cols = {}
  for _, c in ipairs(items.COLUMNS) do
    cols[c[1]] = {}
  end
  for _, it in ipairs(items.all()) do
    if it.kind ~= 'release' and it.kind ~= 'epic' and it.kind ~= 'map' then
      table.insert(cols[items.column(it)], it)
    end
  end
  return cols
end

--- A card's lines as {text, hl} chunk lists, `w` columns wide.
local function card(it, w)
  local L = {}
  local head = { { it.id, 'ClandDim' } }
  if items.asks(it) > 0 then
    head[#head + 1] = { ' ? ask', 'ClandAmber' }
  end
  L[#L + 1] = head
  local title = vim.split(vim.fn.trim(it.title or ''), '\n')[1] or ''
  local words, line, lines = vim.split(title, ' ', { trimempty = true }), '', {}
  for _, word in ipairs(words) do
    local next = line == '' and word or (line .. ' ' .. word)
    if sw(next) > w and line ~= '' then
      lines[#lines + 1] = line
      line = word
    else
      line = next
    end
  end
  lines[#lines + 1] = line
  for i = 1, math.min(2, #lines) do
    local text = lines[i]
    if i == 2 and #lines > 2 then
      text = text .. ' …'
    end
    L[#L + 1] = { { text, it.state == 'closed' and 'ClandDim' or 'ClandText' } }
  end
  local c = items.claim(it)
  if c then
    L[#L + 1] = { { c.session, 'ClandTeal' } }
  elseif items.present(it.assignee) and it.state ~= 'closed' then
    L[#L + 1] = { { 'for ' .. it.assignee, 'ClandDim' } }
  end
  local blockers = items.open_blockers(it)
  if #blockers > 0 and it.state ~= 'closed' then
    L[#L + 1] = { { '◌ by ' .. table.concat(blockers, ', '), 'ClandDim' } }
  end
  -- the verdict marks, one a line: a narrow column keeps them whole
  for _, m in ipairs(items.marks(it)) do
    L[#L + 1] = { m }
  end
  return L
end

--- The board's lines for a window `width` wide: {lines, marks, cells}.
function M.compose(width)
  local n = #items.COLUMNS
  local cw = math.max(8, math.floor((width - (n - 1) * 3 - 1) / n))
  local cols = M.columns()
  -- each column as a list of {chunks, item}
  local grid = {}
  for i, c in ipairs(items.COLUMNS) do
    local rows = {}
    local list = cols[c[1]]
    -- the name, then the count on the rule under it: a narrow column keeps both
    rows[#rows + 1] = { { { c[2]:upper(), 'ClandSection' } } }
    rows[#rows + 1] = { { { tostring(#list), 'ClandSection' }, { ' ' .. ('─'):rep(math.max(0, cw - #tostring(#list) - 1)), 'ClandFaint' } } }
    if #list == 0 then
      rows[#rows + 1] = { { { 'nothing here', 'ClandFaint' } } }
    end
    for _, it in ipairs(list) do
      for _, l in ipairs(card(it, cw)) do
        rows[#rows + 1] = { l, it.id }
      end
      rows[#rows + 1] = { {} }
    end
    grid[i] = rows
  end
  local height = 0
  for _, rows in ipairs(grid) do
    height = math.max(height, #rows)
  end
  local lines, marks, cells = { '' }, {}, { {} }
  for r = 1, height do
    local parts, col, row_cells = { ' ' }, 1, {}
    for i, rows in ipairs(grid) do
      local cell = rows[r] or { {} }
      local start = col
      local used = 0
      for _, ch in ipairs(cell[1]) do
        local text = ch[1]
        if used + sw(text) > cw then
          text = fit(text, cw - used):gsub('%s+$', '')
        end
        if #text > 0 then
          parts[#parts + 1] = text
          if ch[2] then
            marks[#marks + 1] = { r, col, { end_col = col + #text, hl_group = ch[2] } }
          end
          col = col + #text
          used = used + sw(text)
        end
      end
      local pad = (' '):rep(math.max(0, cw - used))
      parts[#parts + 1] = pad
      col = col + #pad
      if cell[2] then
        row_cells[#row_cells + 1] = { from = start, to = col, item = cell[2] }
      end
      if i < #grid then
        parts[#parts + 1] = ' │ '
        marks[#marks + 1] = { r, col + 1, { end_col = col + 1 + #'│', hl_group = 'ClandFaint' } }
        col = col + #' │ '
      end
    end
    lines[#lines + 1] = (table.concat(parts):gsub('%s+$', ''))
    cells[#cells + 1] = row_cells
  end
  lines[#lines + 1] = ''
  lines[#lines + 1] = ' ↵ or gi open the card · gt topic · gs session · ␣b back'
  marks[#marks + 1] = { #lines - 1, 0, { end_col = #lines[#lines], hl_group = 'ClandFaint' } }
  return lines, marks, cells
end

--- The item of the card under the cursor (or at `row`, `col`: 1-based row, 0-based byte column).
function M.item_at(row, col)
  if not row then
    local cur = api.nvim_win_get_cursor(0)
    row, col = cur[1], cur[2]
  end
  for _, c in ipairs(M.cells[row] or {}) do
    if col >= c.from and col < c.to + 3 then
      return c.item
    end
  end
end

local function open()
  local id = M.item_at()
  if id then
    require('cland.layout').show({ kind = 'item', id = id }, { insert = false })
  end
end

function M.buf()
  if M.b and api.nvim_buf_is_valid(M.b) then
    return M.b
  end
  local b = api.nvim_create_buf(false, true)
  vim.bo[b].bufhidden = 'hide'
  vim.bo[b].modifiable = false
  pcall(api.nvim_buf_set_name, b, 'cland://board')
  vim.b[b].cland_role = 'board'
  M.b = b
  require('cland.actions').map('n', '<CR>', open, { buffer = b, nowait = true, silent = true, desc = 'cland: open the card' })
  require('cland.actions').map('n', '<2-LeftMouse>', open, { buffer = b, silent = true })
  return b
end

function M.render()
  local b = M.buf()
  local win = vim.fn.bufwinid(b)
  local width = api.nvim_win_get_width(win ~= -1 and win or require('cland.layout').centre())
  local lines, marks, cells = M.compose(width - 1)
  M.cells = cells
  if win ~= -1 then
    vim.wo[win].wrap = false
  end
  vim.bo[b].modifiable = true
  api.nvim_buf_set_lines(b, 0, -1, false, lines)
  vim.bo[b].modifiable = false
  api.nvim_buf_clear_namespace(b, ns, 0, -1)
  for _, m in ipairs(marks) do
    pcall(api.nvim_buf_set_extmark, b, ns, m[1], m[2], m[3])
  end
  return b
end

return M
