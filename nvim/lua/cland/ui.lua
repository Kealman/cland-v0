-- Per-machine workbench preferences. Hub data and live session attachments never enter this file.
local state = require('cland.state')
local uv = vim.uv
local M = { DEBOUNCE_MS = 200 }
local path, timer, pending, saved, warned

function M.panel_defaults()
  return { items = 'left', inbox = 'right', sessions = 'right', topics = 'right' }
end

-- Optional v2 fields are validated together, independently of other preferences.
-- Occupants may differ from their homes after a reset with a side collision.
function M.panel_assignment(homes, left_kind, left, right, dock)
  if homes == nil then homes = M.panel_defaults() end
  if left_kind == nil then left_kind = 'items' end
  assert(type(homes) == 'table' and not vim.islist(homes), 'invalid panel homes')
  local defaults = M.panel_defaults()
  for kind, side in pairs(homes) do
    assert(defaults[kind] and (side == 'left' or side == 'right'), 'invalid panel home')
  end
  for kind in pairs(defaults) do assert(homes[kind], 'missing panel home') end
  assert(defaults[left_kind] and (right == nil or defaults[right]), 'invalid panel kind')
  assert(not (left and left_kind == right), 'duplicate side panel')
  assert(not (dock and (right == 'topics' or left and left_kind == 'topics')), 'duplicate topics panels')
  local collision = left and right and homes[left_kind] == homes[right]
  assert(collision or (not left or homes[left_kind] == 'left') and (not right or homes[right] == 'right'), 'contradictory panel homes')
  return { homes = homes, left_kind = left_kind, right = right }
end

function M.explorer_defaults()
  return {folds=vim.empty_dict(),hide_done=false,archive=false}
end

local function explorer_snapshot(ui)
  local e = ui.explorer or M.explorer_defaults()
  local folds, ids = vim.empty_dict(), {}
  for _, it in ipairs(state.S.items) do ids[it.id] = true end
  for key, open in pairs(e.folds) do
    if key:match('^:') or not state.S.items_loaded or ids[key] then folds[key] = open end
  end
  return {folds=folds,scope=e.scope or vim.NIL,hide_done=e.hide_done,archive=e.archive,card_width=e.card_width or vim.NIL}
end

local function snapshot()
  local ui = state.S.ui
  return {
    version = 2,
    plan_seen = vim.deepcopy(ui.plan_seen or vim.empty_dict()),
    events = vim.deepcopy(ui.events or { filter = vim.empty_dict(), muted = {} }),
    preset = ui.preset or vim.NIL,
    panel_homes = vim.deepcopy(ui.panel_homes),
    panels = { left = ui.left, left_kind = ui.left_kind, right = ui.right or vim.NIL, dock = ui.dock },
    sizes = vim.deepcopy(ui.sizes),
    items_filter = ui.items_filter,
    accounts_folded = ui.accounts_folded,
    current_release = ui.current_release or vim.NIL,
    explorer = explorer_snapshot(ui),
  }
end

local function validate_explorer(e)
  assert(type(e) == 'table' and not vim.islist(e), 'invalid explorer')
  if e.folds == nil then e.folds = vim.empty_dict() end
  assert(type(e.folds) == 'table' and not vim.islist(e.folds), 'invalid explorer folds')
  local function key(k) return type(k) == 'string' and (k:match('^%a%-[1-9]%d*$') or k:match('^:')) end
  for k, open in pairs(e.folds) do assert(key(k) and type(open) == 'boolean', 'invalid explorer fold') end
  assert(e.scope == nil or key(e.scope), 'invalid explorer scope')
  for _, field in ipairs({'hide_done','archive'}) do
    assert(e[field] == nil or type(e[field]) == 'boolean', 'invalid explorer ' .. field)
    if e[field] == nil then e[field] = false end
  end
  assert(e.card_width == nil or (type(e.card_width) == 'number' and e.card_width >= 1 and e.card_width < 100000
    and e.card_width == math.floor(e.card_width)), 'invalid explorer card width')
  return e
end

local function validate(data)
  assert(type(data) == 'table' and (data.version == 1 or data.version == 2), 'unsupported UI state')
  -- Version 1's default 'all' was the board. Version 2 gives all its own tree view.
  if data.version == 1 and data.items_filter == 'all' then data.items_filter = 'board' end
  assert(data.preset == nil or (type(data.preset) == 'string' and require('cland.layout').PRESETS[data.preset]), 'invalid preset')
  local p = data.panels
  assert(type(p) == 'table' and type(p.left) == 'boolean' and type(p.dock) == 'boolean', 'invalid panels')
  local sides_ok, sides = pcall(M.panel_assignment, data.panel_homes, p.left_kind, p.left, p.right, p.dock)
  data.sides_invalid = not sides_ok
  if not sides_ok then
    sides = { homes = M.panel_defaults(), left_kind = 'items', right = p.right and 'sessions' or nil }
  end
  data.sides = sides
  assert(type(data.sizes) == 'table' and not vim.islist(data.sizes), 'invalid sizes')
  for key, size in pairs(data.sizes) do
    assert(vim.tbl_contains({ 'left', 'right', 'dock' }, key), 'unknown size')
    assert(type(size) == 'number' and size >= 1 and size < 100000 and size == math.floor(size), 'invalid size')
  end
  assert(vim.tbl_contains(require('cland.items').FILTERS, data.items_filter) or vim.tbl_contains(require('cland.items').LAYERS, data.items_filter), 'invalid items filter')
  assert(data.current_release == nil or (type(data.current_release) == 'string' and data.current_release:match('^%a%-[1-9]%d*$')), 'invalid release pick')
  assert(data.accounts_folded == nil or type(data.accounts_folded) == 'boolean', 'invalid accounts fold')
  data.plan_seen = data.plan_seen or vim.empty_dict()
  assert(type(data.plan_seen) == 'table', 'invalid plan receipts')
  for id, receipt in pairs(data.plan_seen) do
    assert(type(id) == 'string' and id:match('^%a%-[1-9]%d*$') and type(receipt) == 'string', 'invalid plan receipt')
  end
  data.events = data.events or { filter = vim.empty_dict(), muted = {} }
  local e = data.events
  assert(type(e) == 'table' and type(e.filter) == 'table' and type(e.muted) == 'table', 'invalid events preferences')
  local kinds = require('cland.event_kinds')
  local function subject(s)
    return type(s) == 'table' and vim.tbl_contains({ 'item', 'session', 'topic', 'artifact', 'rule' }, s.kind) and type(s.id) == 'string' and s.id ~= ''
  end
  assert(e.filter.warnings == nil or type(e.filter.warnings) == 'boolean', 'invalid events warnings')
  assert(e.filter.kinds == nil or type(e.filter.kinds) == 'table', 'invalid events kinds')
  for _, k in ipairs(e.filter.kinds or {}) do assert(vim.tbl_contains(kinds, k), 'invalid events kind') end
  assert(e.filter.subject == nil or subject(e.filter.subject), 'invalid events subject')
  for _, s in ipairs(e.muted) do assert(subject(s), 'invalid events mute') end
  assert(e.last_look == nil or type(e.last_look) == 'string' and e.last_look:match('^%d%d%d%d%-%d%d%-%d%dT'), 'invalid events last look')
  if data.explorer == nil then data.explorer = M.explorer_defaults() else
    local ok, explorer = pcall(validate_explorer, data.explorer)
    data.explorer = ok and explorer or M.explorer_defaults()
    data.explorer_invalid = not ok
  end
  return data
end

function M.load(root)
  if timer then timer:stop(); timer:close(); timer = nil end
  path, pending, warned = root .. '/.cland/ui.json', nil, false
  local ui = state.S.ui
  ui.plan_seen = vim.empty_dict()
  ui.events = { filter = vim.empty_dict(), muted = {} }
  ui.accounts_folded = false
  ui.explorer = M.explorer_defaults()
  ui.preset, ui.left, ui.right, ui.dock = nil, false, 'sessions', false
  ui.left_kind = 'items'
  ui.panel_homes = M.panel_defaults()
  ui.sizes, ui.items_filter, ui.current_release = vim.empty_dict(), 'board', nil
  local _, _, stat_code = uv.fs_stat(path)
  local ok, data = pcall(function()
    return validate(vim.json.decode(table.concat(vim.fn.readfile(path), '\n'), { luanil = { object = true, array = true } }))
  end)
  if ok then
    ui.accounts_folded = data.accounts_folded or false
    ui.plan_seen = data.plan_seen
    ui.events = data.events
    ui.preset = data.preset
    ui.left, ui.right, ui.dock = data.panels.left, data.panels.right, data.panels.dock
    ui.panel_homes, ui.left_kind, ui.right = data.sides.homes, data.sides.left_kind, data.sides.right
    ui.sizes, ui.items_filter, ui.current_release = data.sizes, data.items_filter, data.current_release
    ui.explorer = data.explorer
    if data.explorer_invalid then state.say('ui.json: invalid explorer preferences; using explorer defaults', 'ClandAmberBar') end
    if data.sides_invalid then state.say('ui.json: invalid panel assignments; using default sides', 'ClandAmberBar') end
    if ui.preset then ui.view = vim.deepcopy(require('cland.layout').PRESETS[ui.preset].view) end
  elseif stat_code ~= 'ENOENT' then
    state.say('ui.json unreadable or invalid; using default layout', 'ClandAmberBar')
  end
  saved = vim.json.encode(snapshot())
end

-- Write completely to a unique sibling, then rename. An interrupted write leaves the previous file intact.
local function atomic_write(text)
  vim.fn.mkdir(vim.fn.fnamemodify(path, ':h'), 'p')
  local release = require('cland.ui_lock').acquire(path .. '.lock')
  if not release then return false end
  local tmp = path .. '.' .. vim.fn.getpid() .. '.' .. uv.hrtime() .. '.tmp'
  local fd
  local ok, err = pcall(function()
    -- The shared lock covers the read as well as replacement.
    local read_ok, current = pcall(function()
      return vim.json.decode(table.concat(vim.fn.readfile(path), '\n'))
    end)
    if read_ok and type(current) == 'table' then
      local data = vim.json.decode(text)
      for key, value in pairs(current) do if data[key] == nil then data[key] = value end end
      text = vim.json.encode(data) .. '\n'
    end
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
  local released, release_err = pcall(release)
  if not ok then
    pcall(uv.fs_unlink, tmp)
    error(err)
  end
  if not released then error(release_err) end
  return true
end

function M.flush()
  if timer then timer:stop() end
  if not pending then return true end
  local text = pending
  pending = nil
  local ok, err = pcall(atomic_write, text .. '\n')
  if ok and err == false then
    pending = text
    if not timer then timer = uv.new_timer() end
    timer:start(M.DEBOUNCE_MS, 0, vim.schedule_wrap(M.flush))
    return false
  end
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
