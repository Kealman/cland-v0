-- Per-machine workbench preferences. Hub data and live session attachments never enter this file.
local state = require('cland.state')
local uv = vim.uv
local M = { DEBOUNCE_MS = 200 }
local path, timer, pending, saved, warned

local function snapshot()
  local ui = state.S.ui
  return {
    version = 1,
    preset = ui.preset or vim.NIL,
    panels = { left = ui.left, right = ui.right or vim.NIL, dock = ui.dock },
    sizes = vim.deepcopy(ui.sizes),
    items_filter = ui.items_filter,
    current_release = ui.current_release or vim.NIL,
  }
end

local function validate(data)
  assert(type(data) == 'table' and data.version == 1, 'unsupported UI state')
  assert(data.preset == nil or (type(data.preset) == 'string' and require('cland.layout').PRESETS[data.preset]), 'invalid preset')
  local p = data.panels
  assert(type(p) == 'table' and type(p.left) == 'boolean' and type(p.dock) == 'boolean', 'invalid panels')
  assert(p.right == nil or vim.tbl_contains({ 'sessions', 'inbox', 'topics' }, p.right), 'invalid right panel')
  assert(not (p.dock and p.right == 'topics'), 'duplicate topics panels')
  assert(type(data.sizes) == 'table' and not vim.islist(data.sizes), 'invalid sizes')
  for key, size in pairs(data.sizes) do
    assert(vim.tbl_contains({ 'left', 'right', 'dock' }, key), 'unknown size')
    assert(type(size) == 'number' and size >= 1 and size < 100000 and size == math.floor(size), 'invalid size')
  end
  assert(vim.tbl_contains(require('cland.items').FILTERS, data.items_filter), 'invalid items filter')
  assert(data.current_release == nil or (type(data.current_release) == 'string' and data.current_release:match('^T%-[1-9]%d*$')), 'invalid release pick')
  return data
end

function M.load(root)
  if timer then timer:stop(); timer:close(); timer = nil end
  path, pending, warned = root .. '/.cland/ui.json', nil, false
  local ui = state.S.ui
  ui.preset, ui.left, ui.right, ui.dock = nil, false, 'sessions', false
  ui.sizes, ui.items_filter, ui.current_release = vim.empty_dict(), 'all', nil
  local _, _, stat_code = uv.fs_stat(path)
  local ok, data = pcall(function()
    return validate(vim.json.decode(table.concat(vim.fn.readfile(path), '\n'), { luanil = { object = true, array = true } }))
  end)
  if ok then
    ui.preset = data.preset
    ui.left, ui.right, ui.dock = data.panels.left, data.panels.right, data.panels.dock
    ui.sizes, ui.items_filter, ui.current_release = data.sizes, data.items_filter, data.current_release
    if ui.preset then ui.view = vim.deepcopy(require('cland.layout').PRESETS[ui.preset].view) end
  elseif stat_code ~= 'ENOENT' then
    state.say('ui.json unreadable or invalid; using default layout', 'ClandAmberBar')
  end
  saved = vim.json.encode(snapshot())
end

-- Write completely to a unique sibling, then rename. An interrupted write leaves the previous file intact.
local function atomic_write(text)
  vim.fn.mkdir(vim.fn.fnamemodify(path, ':h'), 'p')
  local tmp = path .. '.' .. vim.fn.getpid() .. '.' .. uv.hrtime() .. '.tmp'
  local fd
  local ok, err = pcall(function()
    fd = assert(uv.fs_open(tmp, 'wx', 384))
    local offset = 0
    while offset < #text do
      local count = assert(uv.fs_write(fd, text:sub(offset + 1), offset))
      assert(count > 0, 'short UI write')
      offset = offset + count
    end
    assert(uv.fs_fsync(fd))
    assert(uv.fs_close(fd))
    fd = nil
    assert(uv.fs_rename(tmp, path))
  end)
  if fd then pcall(uv.fs_close, fd) end
  if not ok then
    pcall(uv.fs_unlink, tmp)
    error(err)
  end
end

function M.flush()
  if timer then timer:stop() end
  if not pending then return true end
  local text = pending
  pending = nil
  local ok, err = pcall(atomic_write, text .. '\n')
  if ok then
    saved = text
  elseif not warned then
    warned = true
    state.say('could not save ui.json: ' .. tostring(err), 'ClandAmberBar')
  end
  return ok
end

-- Called on redraws too: only changed preferences start/reset the debounce, never hub traffic.
function M.changed()
  if not path then return end
  local text = vim.json.encode(snapshot())
  if text == pending or (not pending and text == saved) then return end
  if text == saved then pending = nil; if timer then timer:stop() end; return end
  pending = text
  if not timer then timer = uv.new_timer() end
  timer:start(M.DEBOUNCE_MS, 0, vim.schedule_wrap(M.flush))
end

return M
