-- Read-only Markdown projections. The raw file buffer remains the only writer.
local api = vim.api
local M = {}
local ns = api.nvim_create_namespace('cland.artifact_md')
local versions = {}

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
  local lines, spans = md.render(table.concat(source, '\n', 1, first), cells)
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
      md.render_async(table.concat(source, '\n'), cells, function(projected, marks)
        local row, mark = 0, 1
        local function apply()
          if not valid() then return end
          local started = vim.uv.hrtime()
          writable(function()
            if (not marks[mark] or marks[mark].row >= row) and row < #projected then
              local last = math.min(row + 128, #projected)
              local count = api.nvim_buf_line_count(b)
              if row == 0 then api.nvim_buf_clear_namespace(b, ns, 0, -1) end
              api.nvim_buf_set_lines(b, row, math.min(last, count), false, vim.list_slice(projected, row + 1, last))
              row = last
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
          if row < #projected or mark <= #marks then vim.defer_fn(apply, 0)
          else vim.b[b].cland_render_pending = false end
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
