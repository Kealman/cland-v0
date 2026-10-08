-- Session terminals (spec 4.1, ADR 0005). A terminal buffer only attaches: it runs the adapter's attach
-- command (`session.attach`, e.g. `claude attach <id>`), never the harness itself, so closing the terminal,
-- quitting Neovim or `:restart` ends the attach client and leaves the session to the hub. After a restart
-- the shell runs the attach command again for every session that was attached.
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

--- The live terminal of a session, if one is attached.
function M.term(name)
  local t = M.terms[name]
  if t and api.nvim_buf_is_valid(t.buf) then
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
  M.terms[name] = { buf = buf, job = job, command = command }
  state.S.attached[name] = true
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
  M.client:request({ type = 'session.attach', session = name }, function(err, value)
    if err then
      return cb(err)
    end
    if not (value and type(value.command) == 'string' and value.command ~= '') then
      return cb('the adapter gave no attach command')
    end
    cb(nil, value.command)
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
