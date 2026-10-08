-- Session terminals (spec 4.1, ADR 0005). A terminal buffer only attaches: it runs the adapter's attach
-- command (`session.attach`, e.g. `claude attach <id>`), never the harness itself, so closing the terminal,
-- quitting Neovim or `:restart` ends the attach client and leaves the session to the hub. After a restart
-- the shell runs the attach command again for every session that was attached. Also the sessions panel's
-- stop (`session.stop` after a confirmation line in the panel) and the capability table float.
local api = vim.api
local state = require('cland.state')

local M = { terms = {}, notes = {} }

function M.setup(client)
  M.client = client
  M.waiting = {}
  -- an attach asked for before the hub answered (at start, after a restart) goes out once it connects
  client:on('connected', function()
    local waiting = M.waiting
    M.waiting = {}
    for _, fn in ipairs(waiting) do
      fn()
    end
  end)
end

local function note_buf(name, text)
  local b = M.notes[name]
  if not (b and api.nvim_buf_is_valid(b)) then
    b = api.nvim_create_buf(false, true)
    vim.bo[b].bufhidden = 'hide'
    pcall(api.nvim_buf_set_name, b, 'cland://session/' .. name)
    vim.b[b].cland_role = 'session'
    vim.b[b].cland_session = name
    M.notes[name] = b
  end
  vim.bo[b].modifiable = true
  api.nvim_buf_set_lines(b, 0, -1, false, { '', ' ' .. text })
  vim.bo[b].modifiable = false
  return b
end

--- Whether the terminal's attach client still runs (its job id answers jobwait with -1, "timed out").
local function running(t)
  if t.exited or not t.job or t.job <= 0 then
    return false
  end
  local ok, res = pcall(vim.fn.jobwait, { t.job }, 0)
  return ok and res[1] == -1
end

--- The live terminal of a session, if one is attached and its attach client still runs. A terminal whose
--- client ended (TermClose) is no attachment: showing the session again runs the attach command again.
function M.term(name)
  local t = M.terms[name]
  if t and api.nvim_buf_is_valid(t.buf) and running(t) then
    return t
  end
  M.terms[name] = nil
end

--- Start the attach command in a new terminal buffer, in `win` when given (it sizes the terminal), else
--- hidden. Returns the buffer.
local function start(name, command, win)
  local buf = api.nvim_create_buf(true, false)
  vim.b[buf].cland_role = 'session'
  vim.b[buf].cland_session = name
  local job
  local function run()
    job = vim.fn.jobstart(command, { term = true, cwd = state.S.root ~= '' and state.S.root or nil })
  end
  if win and api.nvim_win_is_valid(win) then
    api.nvim_win_set_buf(win, buf)
    api.nvim_win_call(win, run)
  else
    api.nvim_buf_call(buf, run)
  end
  local t = { buf = buf, job = job, command = command }
  M.terms[name] = t
  state.S.attached[name] = true
  -- the attach client ended (the human quit it, the session went away): the finished terminal stays to be
  -- read until it is hidden, then goes; the session is no longer attached here
  api.nvim_create_autocmd('TermClose', {
    buffer = buf,
    once = true,
    callback = function()
      t.exited = true
      vim.bo[buf].bufhidden = 'wipe'
      if M.terms[name] == t then
        M.terms[name] = nil
        state.S.attached[name] = nil
      end
      vim.schedule(function()
        if api.nvim_buf_is_valid(buf) and vim.fn.bufwinid(buf) == -1 then
          pcall(api.nvim_buf_delete, buf, { force = true })
        end
      end)
      state.changed()
    end,
  })
  api.nvim_create_autocmd('BufWipeout', {
    buffer = buf,
    once = true,
    callback = function()
      if M.terms[name] and M.terms[name].buf == buf then
        M.terms[name] = nil
        state.S.attached[name] = nil
        state.changed()
      end
    end,
  })
  state.changed()
  return buf
end

--- Ask the hub for the attach command; cb(err, command) in the main loop.
local attach_command
function attach_command(name, cb)
  if not M.client then
    return cb('no hub client')
  end
  if not M.client:connected() then
    table.insert(M.waiting, function()
      attach_command(name, cb)
    end)
    return
  end
  -- one request in flight per session: a view shown twice before the answer waits for the same one
  M.inflight = M.inflight or {}
  if M.inflight[name] then
    table.insert(M.inflight[name], cb)
    return
  end
  M.inflight[name] = { cb }
  M.client:request({ type = 'session.attach', session = name }, function(err, value)
    local cbs = M.inflight[name] or {}
    M.inflight[name] = nil
    if not err and not (value and type(value.command) == 'string' and value.command ~= '') then
      err = 'the adapter gave no attach command'
    end
    for _, fn in ipairs(cbs) do
      fn(err, not err and value.command or nil)
    end
  end)
end

--- Show session `name` in `win`: its terminal, or attach one now. opts.on_attached(win) runs once a new
--- terminal shows in `win`.
function M.show_in(win, name, opts)
  opts = opts or {}
  local t = M.term(name)
  if t then
    api.nvim_win_set_buf(win, t.buf)
    return t.buf
  end
  local note = note_buf(name, 'attaching to ' .. name .. '…')
  api.nvim_win_set_buf(win, note)
  attach_command(name, function(err, command)
    if M.term(name) then
      return
    end
    if err then
      note_buf(name, 'cannot attach ' .. name .. ': ' .. tostring(err):gsub('\n', ' '))
      return
    end
    -- only into the window if it still shows this session
    local here = api.nvim_win_is_valid(win) and api.nvim_win_get_buf(win) == note
    start(name, command, here and win or nil)
    if here and opts.on_attached then
      opts.on_attached(win)
    end
  end)
  return note
end

-- Stop and the capability table (the sessions panel's x and c) ----------------------------------------

local function note(text, group)
  state.S.sessions_note = { text = text, group = group }
  state.changed()
end

local CONFIRM_KEYS = { 'y', 'n', '<Esc>' }

--- Answer the pending confirmation: `yes` stops the session through the hub (`session.stop`).
function M.resolve_stop(yes)
  local confirm = state.S.ui.confirm
  state.S.ui.confirm = nil
  local b = require('cland.panels').bufs.sessions
  if b and api.nvim_buf_is_valid(b) then
    for _, k in ipairs(CONFIRM_KEYS) do
      pcall(vim.keymap.del, 'n', k, { buffer = b })
    end
  end
  state.changed()
  if not (confirm and yes) then
    return
  end
  local name = confirm.session
  if not (M.client and M.client:connected()) then
    return note('cannot stop ' .. name .. ': not connected to the hub', 'ClandRed')
  end
  note('stopping ' .. name .. '…', 'ClandDim')
  M.client:request({ type = 'session.stop', session = name }, function(err, value)
    if err then
      return note('stop ' .. name .. ' refused: ' .. tostring(err):gsub('\n', ' '), 'ClandRed')
    end
    local p = value and value.process
    if p then
      for i, row in ipairs(state.S.processes) do
        if row.name == p.name then
          state.S.processes[i] = p
        end
      end
    end
    note(name .. ' stopped', 'ClandDim')
    pcall(require('cland').refresh_sessions)
  end)
end

--- x in the sessions panel: a confirmation line in the panel (y stops, n or Esc keeps), never a dialog.
function M.ask_stop(name)
  local s = state.session(name)
  if not s then
    return
  end
  if not s.launched then
    return note(name .. ' was not launched by cland: there is nothing to stop from here', 'ClandAmber')
  end
  if not s.live then
    return note(name .. ' is not running (' .. tostring(s.status) .. ')', 'ClandDim')
  end
  state.S.ui.confirm = { session = name }
  local b = require('cland.panels').bufs.sessions
  if b and api.nvim_buf_is_valid(b) then
    local function map(lhs, yes)
      vim.keymap.set('n', lhs, function()
        M.resolve_stop(yes)
      end, { buffer = b, nowait = true, silent = true, desc = yes and 'cland: stop it' or 'cland: keep it' })
    end
    map('y', true)
    map('n', false)
    map('<Esc>', false)
  end
  state.changed()
end

M.CAP_ORDER = { 'busy', 'idle', 'waiting for approval', 'waiting for human' }
M.OPT_ORDER = { 'history', 'usage', 'setModel', 'approvalRelay' }

--- The lines of a harness's capability table.
function M.capability_lines(s)
  local caps = s and s.harness and state.S.adapters[s.harness]
  local harness = s and s.harness and (require('cland.panels').HARNESS[s.harness] or s.harness)
  if not caps then
    return {
      (s and s.label or '?') .. (harness and (' · ' .. harness) or ''),
      '',
      harness and ('no capability table from the ' .. harness .. ' adapter') or 'not launched by cland: no adapter,',
      harness and '' or 'so no capability table; its state is what its spoke says',
    }
  end
  local lines = { s.label .. ' · ' .. harness .. ' · capability table', '', 'state signals' }
  local function row(k, v)
    lines[#lines + 1] = '  ' .. k .. (' '):rep(math.max(1, 23 - #k)) .. v
  end
  for _, k in ipairs(M.CAP_ORDER) do
    row(k, caps.states and caps.states[k] or 'none')
  end
  row('unknown', 'always')
  lines[#lines + 1] = ''
  lines[#lines + 1] = 'capabilities'
  for _, k in ipairs(M.OPT_ORDER) do
    row(k, caps[k] or 'none')
  end
  lines[#lines + 1] = ''
  lines[#lines + 1] = 'heuristic: derived, may be wrong · none: never emulated'
  return lines
end

local CAP_HL = { reliable = 'ClandGreen', heuristic = 'ClandAmber', none = 'ClandDim', always = 'ClandDim' }

--- c in the sessions panel: the session's adapter capability table in a float; q or Esc closes it.
function M.show_capabilities(name)
  local s = state.session(name)
  local lines = vim.tbl_map(function(l)
    return ' ' .. l
  end, M.capability_lines(s))
  local buf = api.nvim_create_buf(false, true)
  vim.bo[buf].bufhidden = 'wipe'
  api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].modifiable = false
  vim.b[buf].cland_role = 'capabilities'
  local ns = api.nvim_create_namespace('cland.capabilities')
  for i, l in ipairs(lines) do
    local word = l:match('(%a+)$')
    if word and CAP_HL[word] and l:match('^   ') then
      pcall(api.nvim_buf_set_extmark, buf, ns, i - 1, #l - #word, { end_col = #l, hl_group = CAP_HL[word] })
    elseif i == 1 then
      pcall(api.nvim_buf_set_extmark, buf, ns, 0, 0, { end_col = #l, hl_group = 'ClandBold' })
    elseif l == ' state signals' or l == ' capabilities' then
      pcall(api.nvim_buf_set_extmark, buf, ns, i - 1, 0, { end_col = #l, hl_group = 'ClandSection' })
    end
  end
  local width = 0
  for _, l in ipairs(lines) do
    width = math.max(width, api.nvim_strwidth(l) + 2)
  end
  width = math.min(width, vim.o.columns - 4)
  local win = api.nvim_open_win(buf, true, {
    relative = 'editor', row = 3, col = math.floor((vim.o.columns - width) / 2), width = width, height = #lines,
    border = 'rounded', style = 'minimal', zindex = 90, title = ' capabilities ', title_pos = 'left', footer = ' q close ', footer_pos = 'left',
  })
  vim.wo[win].winbar = ''
  for _, k in ipairs({ 'q', '<Esc>', 'c' }) do
    vim.keymap.set('n', k, function()
      pcall(api.nvim_win_close, win, true)
    end, { buffer = buf, nowait = true })
  end
  return win
end

--- Attach `name` in a hidden terminal (after a restart, for a session not in the centre).
function M.reattach(name)
  if M.term(name) then
    return
  end
  attach_command(name, function(err, command)
    if not err and not M.term(name) then
      start(name, command, nil)
    end
  end)
end

return M
