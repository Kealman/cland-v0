-- The session launcher (spec 4.3, 4.4; #28): a floating form, `␣l` anywhere or `l` in the sessions panel.
-- One line per field (name, role, harness, model, working directory, effort, item, brief), the labels drawn as inline
-- virtual text so the lines hold only the values. Choosing a role fills the harness, the model and the
-- effort from its launch defaults (`role.list`, i.e. roles.toml); changing the harness away from the role's
-- clears the model and effort that were meant for the other one. Enter submits `session.launch`; what the
-- hub refuses (a name in use, the Coordinator held, an unknown harness) shows under the fields and atop the
-- sessions panel, never in the message area. An item (T-12, an Implementer's) replaces the directory: the hub
-- starts the session in the item's task worktree, made first when missing, and gives it the item's claim.
--
-- Insert mode throughout: Tab and Shift+Tab move between fields, C-n and C-p cycle the choices of the role
-- and harness fields, Enter launches, Esc or C-c cancels.
local api = vim.api
local state = require('cland.state')

local M = {}
local ns = api.nvim_create_namespace('cland.launcher')

M.FIELDS = {
  { key = 'name', label = 'name', hint = 'a-z 0-9 -' },
  { key = 'role', label = 'role', hint = 'aide · coordinator · implementer · reviewer · qa · C-n' },
  { key = 'harness', label = 'harness', hint = 'claude-code · codex · opencode · C-n' },
  { key = 'model', label = 'model', hint = "empty: the harness's default" },
  { key = 'cwd', label = 'directory', hint = '' },
  { key = 'effort', label = 'effort', hint = "empty: the harness's default" },
  { key = 'item', label = 'item', hint = "T-<n>: an Implementer in the item's worktree" },
  { key = 'brief', label = 'brief', hint = 'optional first message · text or A-<n>' },
}
M.HARNESSES = { 'claude-code', 'codex', 'opencode' }
local LABEL_W = 11

local function index_of(key)
  for i, f in ipairs(M.FIELDS) do
    if f.key == key then
      return i
    end
  end
end

local function role_choices()
  local out = {}
  for _, def in ipairs(state.S.roles) do
    out[#out + 1] = def.role
  end
  if #out == 0 then
    out = { 'aide', 'coordinator', 'implementer', 'reviewer', 'qa' }
  end
  out[#out + 1] = ''
  return out
end

--- The form's values, by field key, trimmed.
local function values(f)
  local lines = api.nvim_buf_get_lines(f.buf, 0, #M.FIELDS, false)
  local v = {}
  for i, field in ipairs(M.FIELDS) do
    v[field.key] = vim.trim(lines[i] or '')
  end
  return v
end

local function set_value(f, key, text)
  local i = index_of(key)
  api.nvim_buf_set_lines(f.buf, i - 1, i, false, { text or '' })
end

local function str(x)
  return type(x) == 'string' and x or ''
end

--- Keep the role's launch defaults in step with the fields: a new role fills harness, model and effort;
--- a harness that is not the role's clears the model and effort meant for the role's.
local function sync(f)
  local v = values(f)
  local def = state.role_def(v.role)
  local role_key = def and def.role or v.role
  if role_key ~= f.seen.role then
    f.seen.role = role_key
    if def and def.launch then
      local l = def.launch
      if str(l.harness) ~= '' then
        set_value(f, 'harness', l.harness)
      end
      set_value(f, 'model', str(l.model))
      set_value(f, 'effort', str(l.effort))
      v = values(f)
    end
  end
  if v.harness ~= f.seen.harness then
    f.seen.harness = v.harness
    local l = def and def.launch
    if l and str(l.harness) ~= '' then
      if v.harness ~= l.harness then
        if v.model == str(l.model) then
          set_value(f, 'model', '')
        end
        if v.effort == str(l.effort) then
          set_value(f, 'effort', '')
        end
      else
        if v.model == '' then
          set_value(f, 'model', str(l.model))
        end
        if v.effort == '' then
          set_value(f, 'effort', str(l.effort))
        end
      end
    end
  end
end

--- Labels, hints and the message under the fields.
local function draw(f)
  if not api.nvim_buf_is_valid(f.buf) then
    return
  end
  api.nvim_buf_clear_namespace(f.buf, ns, 0, -1)
  local row = api.nvim_win_is_valid(f.win) and api.nvim_win_get_cursor(f.win)[1] or 1
  for i, field in ipairs(M.FIELDS) do
    local label = field.label .. (' '):rep(LABEL_W - #field.label)
    api.nvim_buf_set_extmark(f.buf, ns, i - 1, 0, {
      virt_text = { { label, i == row and 'ClandBlue' or 'ClandDim' } },
      virt_text_pos = 'inline',
      right_gravity = false,
    })
    if field.hint ~= '' then
      api.nvim_buf_set_extmark(f.buf, ns, i - 1, 0, { virt_text = { { field.hint .. ' ', 'ClandFaint' } }, virt_text_pos = 'right_align' })
    end
  end
  local v = values(f)
  local lines = { { { '', 'ClandDim' } } }
  local msg = f.message
  if not msg and v.role == '' then
    msg = { text = 'no role: the hub refuses its spoke until one is assigned (cland role set)', group = 'ClandAmber' }
  elseif not msg then
    local def = state.role_def(v.role)
    if not def then
      msg = { text = 'unknown role "' .. v.role .. '"', group = 'ClandRed' }
    elseif def.exclusive then
      msg = { text = def.label .. ' is exclusive: one session holds it at a time', group = 'ClandDim' }
    end
  end
  if msg then
    for _, l in ipairs(require('cland.panels').wrap(msg.text, f.width - 2)) do
      lines[#lines + 1] = { { ' ' .. l, msg.group } }
    end
  end
  api.nvim_buf_set_extmark(f.buf, ns, #M.FIELDS - 1, 0, { virt_lines = lines })
  local height = #M.FIELDS + #lines
  if api.nvim_win_is_valid(f.win) then
    pcall(api.nvim_win_set_config, f.win, { height = height, footer = { { f.busy and ' launching… ' or ' ↵ launch · Tab next · C-n choices · Esc cancel ', 'ClandDim' } }, footer_pos = 'left' })
  end
end

function M.close()
  local f = M.cur
  M.cur = nil
  if not f then
    return
  end
  pcall(api.nvim_del_augroup_by_id, f.group)
  if api.nvim_win_is_valid(f.win) then
    pcall(api.nvim_win_close, f.win, true)
  end
  vim.cmd('stopinsert')
  if f.prev and api.nvim_win_is_valid(f.prev) then
    pcall(api.nvim_set_current_win, f.prev)
  end
end

local function note(text, group)
  state.S.sessions_note = { text = text, group = group }
  state.changed()
end

--- The frame the form submits: what is empty is left to the hub (the role's defaults, the harness's own).
function M.frame(v)
  local frame = { type = 'session.launch', name = v.name }
  for _, k in ipairs({ 'harness', 'model', 'cwd', 'effort', 'item' }) do
    if v[k] ~= '' then
      frame[k] = v[k]
    end
  end
  -- the item's worktree is the directory
  if frame.item then
    frame.cwd = nil
  end
  if v.role ~= '' then
    local def = state.role_def(v.role)
    frame.role = def and def.role or v.role
  end
  if v.brief and v.brief ~= '' then
    frame.brief = v.brief
  end
  return frame
end

--- The form's text, to tell an edit from a TextChangedI that only reports typing already handled.
local function snapshot(f)
  return table.concat(api.nvim_buf_get_lines(f.buf, 0, -1, false), '\n')
end

local function submit(f)
  if f.busy then
    return
  end
  sync(f)
  f.snap = snapshot(f)
  local v = values(f)
  if v.name == '' then
    f.message = { text = 'a session needs a name', group = 'ClandRed' }
    return draw(f)
  end
  if v.role == '' and not f.roleless_ok then
    f.roleless_ok = true
    f.message = { text = 'no role: the hub refuses its spoke until one is assigned. Enter again launches it anyway.', group = 'ClandAmber' }
    return draw(f)
  end
  local client = require('cland').client
  if not (client and client:connected()) then
    f.message = { text = 'not connected to the hub', group = 'ClandRed' }
    return draw(f)
  end
  local frame = M.frame(v)
  f.busy = true
  f.message = { text = 'launching ' .. v.name .. '…', group = 'ClandDim' }
  note('launching ' .. v.name .. '…', 'ClandDim')
  draw(f)
  client:request(frame, function(err, value)
    f.busy = false
    if err then
      local text = 'launch ' .. v.name .. ' refused: ' .. tostring(err):gsub('\n', ' ')
      note(text, 'ClandRed')
      if M.cur == f then
        f.message = { text = tostring(err):gsub('\n', ' '), group = 'ClandRed' }
        draw(f)
      end
      return
    end
    local p = value and value.process or {}
    local panels = require('cland.panels')
    note('launched ' .. (p.label or v.name) .. ' · ' .. (panels.HARNESS[p.harness] or p.harness or '?') .. (p.model and (' · ' .. p.model) or ''), 'ClandGreen')
    -- the row now, before the next refresh
    local known = false
    for i, row in ipairs(state.S.processes) do
      if row.name == p.name then
        state.S.processes[i] = p
        known = true
      end
    end
    if not known and p.name then
      table.insert(state.S.processes, p)
    end
    state.changed()
    pcall(require('cland').refresh_sessions)
    if M.cur == f then
      M.close()
      if frame.role == 'aide' and p.name then
        require('cland.layout').show({ kind = 'session', id = p.name }, { insert = true })
      end
    end
  end)
end

local function move(f, d)
  sync(f)
  local row = api.nvim_win_get_cursor(f.win)[1]
  row = (row - 1 + d) % #M.FIELDS + 1
  local line = api.nvim_buf_get_lines(f.buf, row - 1, row, false)[1] or ''
  api.nvim_win_set_cursor(f.win, { row, #line })
  draw(f)
end

local function cycle(f, d)
  local row = api.nvim_win_get_cursor(f.win)[1]
  local key = M.FIELDS[row].key
  local choices = key == 'role' and role_choices() or (key == 'harness' and M.HARNESSES or nil)
  if not choices then
    return
  end
  local cur = values(f)[key]
  local at = 0
  for i, c in ipairs(choices) do
    if c == cur then
      at = i
    end
  end
  local nxt = choices[(at - 1 + d) % #choices + 1]
  if at == 0 and d < 0 then
    nxt = choices[#choices]
  end
  set_value(f, key, nxt)
  api.nvim_win_set_cursor(f.win, { row, #nxt })
  sync(f)
  draw(f)
end

--- Open the Aide form on its brief; reserve names already known to the hub, including stopped ones.
function M.aide()
  local used = {}
  for _, s in ipairs(state.sessions()) do used[s.name] = true end
  local n = 1
  while used['aide-' .. n] do n = n + 1 end
  return M.open({ name = 'aide-' .. n, role = 'aide', field = 'brief' })
end

--- opts: name, role (its defaults follow), item, brief (prefilled), field (initial focus).
function M.open(opts)
  opts = opts or {}
  M.close()
  pcall(require('cland.picker').close)
  local width = math.min(76, vim.o.columns - 8)
  local f = { width = width, seen = {}, prev = api.nvim_get_current_win() }
  f.buf = api.nvim_create_buf(false, true)
  vim.bo[f.buf].bufhidden = 'wipe'
  vim.b[f.buf].cland_role = 'launcher'
  api.nvim_buf_set_lines(f.buf, 0, -1, false, { opts.name or '', opts.role or '', '', '', state.S.root ~= '' and state.S.root or vim.fn.getcwd(), '', opts.item or '', opts.brief or '' })
  f.win = api.nvim_open_win(f.buf, true, {
    relative = 'editor', row = math.max(1, math.floor(vim.o.lines / 5)), col = math.floor((vim.o.columns - width) / 2),
    width = width, height = #M.FIELDS + 1, border = 'rounded', style = 'minimal', zindex = 85,
    title = { { ' launch a session ', 'FloatTitle' } }, title_pos = 'left', footer = ' ', footer_pos = 'left',
  })
  vim.wo[f.win].winbar = ''
  vim.wo[f.win].wrap = false
  vim.wo[f.win].cursorline = false
  M.cur = f
  sync(f)
  local function map(lhs, fn)
    require('cland.actions').map({ 'i', 'n' }, lhs, fn, { buffer = f.buf, nowait = true })
  end
  map('<CR>', function()
    submit(f)
  end)
  map('<Tab>', function()
    move(f, 1)
  end)
  map('<S-Tab>', function()
    move(f, -1)
  end)
  map('<Down>', function()
    move(f, 1)
  end)
  map('<Up>', function()
    move(f, -1)
  end)
  map('<C-n>', function()
    cycle(f, 1)
  end)
  map('<C-p>', function()
    cycle(f, -1)
  end)
  map('<Esc>', M.close)
  map('<C-c>', M.close)
  -- the fields are fixed: no line is added or joined
  for _, lhs in ipairs({ '<BS>', '<C-w>', '<C-u>' }) do
    require('cland.actions').map('i', lhs, function()
      return api.nvim_win_get_cursor(0)[2] > 0 and lhs or ''
    end, { buffer = f.buf, expr = true, replace_keycodes = true })
  end
  require('cland.actions').map('i', '<Del>', function()
    local line = api.nvim_get_current_line()
    return api.nvim_win_get_cursor(0)[2] < #line and '<Del>' or ''
  end, { buffer = f.buf, expr = true, replace_keycodes = true })
  f.group = api.nvim_create_augroup('cland.launcher', { clear = true })
  api.nvim_create_autocmd({ 'TextChangedI', 'TextChanged' }, {
    group = f.group,
    buffer = f.buf,
    callback = function()
      if M.cur == f then
        local now = snapshot(f)
        if now == f.snap then
          return
        end
        f.snap = now
        -- an edit: what was said about the last submit no longer holds
        if not f.busy then
          f.message = nil
        end
        f.roleless_ok = false
        sync(f)
        f.snap = snapshot(f)
        draw(f)
      end
    end,
  })
  api.nvim_create_autocmd('CursorMovedI', {
    group = f.group,
    buffer = f.buf,
    callback = function()
      if M.cur == f then
        draw(f)
      end
    end,
  })
  api.nvim_create_autocmd('WinLeave', {
    group = f.group,
    buffer = f.buf,
    callback = function()
      vim.schedule(function()
        if M.cur == f and api.nvim_get_current_win() ~= f.win then
          M.close()
        end
      end)
    end,
  })
  draw(f)
  local first = index_of(opts.field) or (opts.name and (opts.role and 3 or 2) or 1)
  local line = api.nvim_buf_get_lines(f.buf, first - 1, first, false)[1] or ''
  api.nvim_win_set_cursor(f.win, { first, #line })
  vim.cmd('startinsert!')
  return f
end

return M
