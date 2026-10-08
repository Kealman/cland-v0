-- PROTOTYPE (ticket #15, workbench): text layout helpers shared by the
-- panels and views. A canvas collects lines from {text, hl} chunks, with
-- right-aligned parts and side-by-side columns, then writes them into a
-- scratch buffer with extmark highlights. Widths are display widths.
local api = vim.api
local D = {}

local CHAR = '[%z\1-\127\194-\244][\128-\191]*'

function D.w(s)
  return api.nvim_strwidth(s or '')
end

-- The longest prefix of `s` that fits in `n` columns.
function D.take(s, n)
  local out, w = {}, 0
  for ch in s:gmatch(CHAR) do
    local cw = api.nvim_strwidth(ch)
    if w + cw > n then
      break
    end
    out[#out + 1] = ch
    w = w + cw
  end
  return table.concat(out)
end

function D.trunc(s, n)
  s = s or ''
  if n <= 0 then
    return ''
  end
  if D.w(s) <= n then
    return s
  end
  return D.take(s, n - 1) .. '…'
end

function D.pad(s, n)
  local w = D.w(s)
  return w >= n and s or (s .. (' '):rep(n - w))
end

function D.lpad(s, n)
  local w = D.w(s)
  return w >= n and s or ((' '):rep(n - w) .. s)
end

-- Word wrap to `width` columns (long words are cut).
function D.wrap(text, width)
  width = math.max(4, width)
  local lines, cur, curw = {}, '', 0
  local function push_word(word)
    while D.w(word) > width do
      local head = D.take(word, width)
      lines[#lines + 1] = head
      word = word:sub(#head + 1)
    end
    return word
  end
  for word in (text or ''):gmatch('%S+') do
    local ww = D.w(word)
    if curw == 0 then
      word = push_word(word)
      cur, curw = word, D.w(word)
    elseif curw + 1 + ww <= width then
      cur, curw = cur .. ' ' .. word, curw + 1 + ww
    else
      lines[#lines + 1] = cur
      word = push_word(word)
      cur, curw = word, D.w(word)
    end
  end
  if curw > 0 or #lines == 0 then
    lines[#lines + 1] = cur
  end
  return lines
end

function D.width_of(chunks)
  local w = 0
  for _, c in ipairs(chunks or {}) do
    w = w + D.w(c[1])
  end
  return w
end

-- Fit chunks into `n` columns, cutting the last one with an ellipsis.
function D.fit(chunks, n)
  local out, w = {}, 0
  for _, c in ipairs(chunks or {}) do
    local cw = D.w(c[1])
    if w + cw <= n then
      out[#out + 1] = c
      w = w + cw
    else
      local room = n - w
      if room > 0 then
        local t = D.trunc(c[1], room)
        out[#out + 1] = { t, c[2] }
        w = w + D.w(t)
      end
      break
    end
  end
  return out, w
end

local C = {}
C.__index = C

function D.canvas(width)
  return setmetatable({ width = math.max(10, width or 80), lines = {}, marks = {}, info = {} }, C)
end

function C:mark(row, col, opts)
  self.marks[#self.marks + 1] = { row, col, opts }
end

local function emit(self, chunks, row)
  local parts, col = {}, 0
  for _, c in ipairs(chunks) do
    local text = c[1]
    parts[#parts + 1] = text
    if c[2] and #text > 0 then
      self:mark(row, col, { end_col = col + #text, hl_group = c[2], priority = c[3] or 200 })
    end
    col = col + #text
  end
  return table.concat(parts)
end

-- One line: `left` chunks, `right` chunks flush right. opts: info (row
-- metadata), line_hl (whole screen line), fill (hl of the gap and padding),
-- nofit (keep the whole text: the window soft-wraps it).
function C:add(left, right, opts)
  opts = opts or {}
  right = right or {}
  local row = #self.lines
  if opts.nofit then
    self.lines[row + 1] = emit(self, left, row)
    self.info[row + 1] = opts.info
    if opts.line_hl then
      self:mark(row, 0, { line_hl_group = opts.line_hl, priority = 10 })
    end
    return row + 1
  end
  local rw = D.width_of(right)
  local avail = self.width - rw - (rw > 0 and 1 or 0)
  local lfit, lw = D.fit(left, math.max(0, avail))
  local chunks = vim.list_extend({}, lfit)
  if rw > 0 then
    chunks[#chunks + 1] = { (' '):rep(math.max(1, self.width - lw - rw)), opts.fill }
    vim.list_extend(chunks, right)
  elseif opts.fill then
    chunks[#chunks + 1] = { (' '):rep(math.max(0, self.width - lw)), opts.fill }
  end
  self.lines[row + 1] = emit(self, chunks, row)
  self.info[row + 1] = opts.info
  if opts.line_hl then
    self:mark(row, 0, { line_hl_group = opts.line_hl, priority = 10 })
  end
  return row + 1
end

function C:blank(info)
  return self:add({}, nil, { info = info })
end

-- Side-by-side columns: cols = { {chunks=, width=, bg=, info=}, ... }.
function C:cols(cols, opts)
  opts = opts or {}
  local gap = opts.gap or ' '
  local row = #self.lines
  local parts, col, segs = {}, 0, {}
  for i, c in ipairs(cols) do
    if i > 1 then
      parts[#parts + 1] = gap
      col = col + #gap
    end
    local fit, w = D.fit(c.chunks or {}, c.width)
    local start = col
    for _, ch in ipairs(fit) do
      parts[#parts + 1] = ch[1]
      if ch[2] and #ch[1] > 0 then
        self:mark(row, col, { end_col = col + #ch[1], hl_group = ch[2], priority = 200 })
      end
      col = col + #ch[1]
    end
    if w < c.width then
      parts[#parts + 1] = (' '):rep(c.width - w)
      col = col + c.width - w
    end
    if c.bg then
      self:mark(row, start, { end_col = col, hl_group = c.bg, priority = 100 })
    end
    segs[#segs + 1] = { start = start, stop = col, info = c.info }
  end
  self.lines[row + 1] = table.concat(parts)
  self.info[row + 1] = { cols = segs, info = opts.info }
  return row + 1
end

-- Write into `buf` (a nomodifiable scratch buffer) and return the row info.
function C:apply(buf, ns)
  if not (buf and api.nvim_buf_is_valid(buf)) then
    return self.info
  end
  vim.bo[buf].modifiable = true
  api.nvim_buf_set_lines(buf, 0, -1, false, self.lines)
  vim.bo[buf].modifiable = false
  vim.bo[buf].modified = false
  api.nvim_buf_clear_namespace(buf, ns, 0, -1)
  for _, m in ipairs(self.marks) do
    pcall(api.nvim_buf_set_extmark, buf, ns, m[1], m[2], m[3])
  end
  return self.info
end

-- Pad the canvas with blank lines so that its last `keep` lines sit on the
-- bottom rows of a window `height` rows tall (panel footers).
function C:push_down(height, keep)
  local n = #self.lines
  local missing = height - n
  if missing <= 0 then
    return
  end
  local at = n - keep
  local lines, info = {}, {}
  for i = 1, at do
    lines[i], info[i] = self.lines[i], self.info[i]
  end
  for i = 1, missing do
    lines[at + i] = ''
  end
  for i = at + 1, n do
    lines[i + missing], info[i + missing] = self.lines[i], self.info[i]
  end
  self.lines, self.info = lines, info
  for _, m in ipairs(self.marks) do
    if m[1] >= at then
      m[1] = m[1] + missing
    end
  end
end

-- A panel whose content fits shows it from the first line (a window that
-- shrank keeps its old top line otherwise, hiding the panel's first rows).
function D.top_if_fits(win)
  if win and api.nvim_win_is_valid(win) then
    local n = api.nvim_buf_line_count(api.nvim_win_get_buf(win))
    if n <= vim.fn.winheight(win) then
      api.nvim_win_call(win, function()
        vim.fn.winrestview({ topline = 1 })
      end)
    end
  end
end

-- A scratch buffer for a panel or view (role is read by the bars).
function D.scratch(role, name)
  local b = api.nvim_create_buf(false, true)
  vim.b[b].cland_role = role
  vim.bo[b].modifiable = false
  vim.bo[b].bufhidden = 'hide'
  if name then
    pcall(api.nvim_buf_set_name, b, 'cland://' .. name)
  end
  return b
end

return D
