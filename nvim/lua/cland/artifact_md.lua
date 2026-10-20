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
  local function apply(lines, spans)
    if versions[path] ~= entry or not api.nvim_buf_is_valid(b) then return end
    vim.bo[b].readonly = false
    vim.bo[b].modifiable = true
    api.nvim_buf_set_lines(b, 0, -1, false, lines)
    api.nvim_buf_clear_namespace(b, ns, 0, -1)
    for _, s in ipairs(spans) do api.nvim_buf_set_extmark(b, ns, s.row, s.col, s.opts) end
    vim.bo[b].modified = false
    vim.bo[b].readonly = true
    vim.bo[b].modifiable = false
  end
  local md = require('cland.thread_md')
  -- Present the first screen before parsing the rest of a long artifact. The
  -- follow-up long-document renderer can subdivide that deferred whole parse.
  local first = math.min(#source, (rows or api.nvim_win_get_height(0)) + 4)
  local lines, spans = md.render(table.concat(source, '\n', 1, first), cells)
  local initial = vim.list_extend(vim.list_extend({}, lines), vim.list_slice(source, first + 1))
  apply(initial, spans)
  if first < #source then
    vim.schedule(function()
      if versions[path] ~= entry or not api.nvim_buf_is_valid(b) then return end
      apply(md.render(table.concat(source, '\n'), cells))
    end)
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
