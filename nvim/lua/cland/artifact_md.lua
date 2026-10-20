-- Read-only Markdown projections. The raw file buffer remains the only writer.
local api = vim.api
local M = {}
local ns = api.nvim_create_namespace('cland.artifact_md')
local versions = {}
local buffers = {}

function M.source_line(buf, row)
  local entry = buffers[buf]
  if not entry then return row end
  local meta = entry.metadata[row]
  return meta and meta.source_line or row - entry.prefix_rows + entry.prefix_source
end

function M.rendered_line(buf, source)
  local count = api.nvim_buf_line_count(buf)
  local entry = buffers[buf]
  if not entry then return math.min(source, count) end
  -- Source lines are ordered; choose the first projected row for the source,
  -- or the nearest one when a table header/delimiter has no separate row.
  local function nearest(low, high)
    local first = low
    while low < high do
      local mid = math.floor((low + high) / 2)
      if M.source_line(buf, mid) < source then low = mid + 1 else high = mid end
    end
    if low > first and math.abs(M.source_line(buf, low - 1) - source) < math.abs(M.source_line(buf, low) - source) then return low - 1 end
    return low
  end
  local applied = entry.applied_rows or 0
  if applied == 0 or applied >= count then return nearest(1, count) end
  -- While chunks replace the initial view, each half is ordered independently.
  local a, b = nearest(1, applied), nearest(applied + 1, count)
  return math.abs(M.source_line(buf, a) - source) <= math.abs(M.source_line(buf, b) - source) and a or b
end

function M.buffer(path, cells, raw, rows)
  local stat = vim.uv.fs_stat(path)
  local mtime = stat and stat.mtime or {}
  local version = table.concat({path, mtime.sec or '', mtime.nsec or '', stat and stat.size or ''}, '\0')
  -- Unsaved edits are a buffer version, never an entry under the disk version key.
  if raw and vim.bo[raw].modified then
    version = version .. '\0modified:' .. api.nvim_buf_get_changedtick(raw)
  end
  local hit = versions[path]
  if hit and hit.version == version and hit.cells == cells and api.nvim_buf_is_valid(hit.buf) then return hit.buf end
  local source = raw and api.nvim_buf_get_lines(raw, 0, -1, false) or vim.fn.readfile(path)
  if #source == 0 then source = {''} end
  local b = hit and api.nvim_buf_is_valid(hit.buf) and hit.buf or api.nvim_create_buf(false, true)
  vim.bo[b].bufhidden = 'hide'
  vim.bo[b].swapfile = false
  vim.bo[b].formatlistpat = [[^\s*\%(\d\+[.)]\|[-*+]\)\s\+]]
  vim.b[b].cland_rendered = true
  local entry = {version = version, cells = cells, buf = b}
  versions[path] = entry
  buffers[b] = entry
  local function valid()
    return versions[path] == entry and api.nvim_buf_is_valid(b)
  end
  local function writable(fn)
    vim.bo[b].readonly = false
    vim.bo[b].modifiable = true
    fn()
    vim.bo[b].modified = false
    vim.bo[b].readonly = true
    vim.bo[b].modifiable = false
  end
  local md = require('cland.thread_md')
  local first = math.min(#source, (rows or api.nvim_win_get_height(0)) + 4)
  local lines, spans, metadata = md.render(table.concat(source, '\n', 1, first), cells)
  entry.metadata, entry.prefix_rows, entry.prefix_source = vim.list_slice(metadata), #lines, first
  writable(function()
    api.nvim_buf_set_lines(b, 0, -1, false, source)
    api.nvim_buf_set_lines(b, 0, first, false, lines)
    api.nvim_buf_clear_namespace(b, ns, 0, -1)
    for _, s in ipairs(spans) do api.nvim_buf_set_extmark(b, ns, s.row, s.col, s.opts) end
  end)
  vim.b[b].cland_render_pending = first < #source
  if first < #source then
    -- The first redraw and input get the loop before the complete parse starts.
    vim.defer_fn(function()
      if not valid() then return end
      md.render_async(table.concat(source, '\n'), cells, function(projected, marks, full_metadata)
        local row, mark = 0, 1
        local anchors = {}
        local function apply()
          if not valid() then return end
          for _, win in ipairs(vim.fn.win_findbuf(b)) do
            local cursor = api.nvim_win_get_cursor(win)[1]
            if not anchors[win] or anchors[win].row ~= cursor then
              anchors[win] = {row = cursor, source = M.source_line(b, cursor)}
            end
          end
          local started = vim.uv.hrtime()
          writable(function()
            if (not marks[mark] or marks[mark].row >= row) and row < #projected then
              local last = math.min(row + 128, #projected)
              local count = api.nvim_buf_line_count(b)
              if row == 0 then api.nvim_buf_clear_namespace(b, ns, 0, -1) end
              api.nvim_buf_set_lines(b, row, math.min(last, count), false, vim.list_slice(projected, row + 1, last))
              for r = row + 1, last do entry.metadata[r] = full_metadata[r] end
              row = last
              entry.applied_rows = row
              if row == #projected then
                if api.nvim_buf_line_count(b) > row then api.nvim_buf_set_lines(b, row, -1, false, {}) end
              end
            end
            local last = math.min(mark + 255, #marks)
            while mark <= last and marks[mark].row < row do
              local s = marks[mark]
              api.nvim_buf_set_extmark(b, ns, s.row, s.col, s.opts)
              mark = mark + 1
              if vim.uv.hrtime() - started >= 2000000 then break end
            end
          end)
          for _, win in ipairs(vim.fn.win_findbuf(b)) do anchors[win].row = api.nvim_win_get_cursor(win)[1] end
          if row < #projected or mark <= #marks then vim.defer_fn(apply, 0)
          else
            entry.metadata = full_metadata
            for _, win in ipairs(vim.fn.win_findbuf(b)) do
              api.nvim_win_set_cursor(win, {M.rendered_line(b, anchors[win].source), 0})
            end
            vim.b[b].cland_render_pending = false
          end
        end
        vim.defer_fn(apply, 0)
      end, valid)
    end, 0)
  end
  return b
end

function M.window(win)
  local rendered = vim.b[api.nvim_win_get_buf(win)].cland_rendered
  for name, value in pairs({wrap = true, linebreak = true, breakindent = true,
    breakindentopt = 'list:-1', conceallevel = rendered and 2 or 0, concealcursor = rendered and 'nc' or ''}) do
    api.nvim_set_option_value(name, value, {scope = 'local', win = win})
  end
end

return M
