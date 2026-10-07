-- PROTOTYPE (ticket #11): sessions = terminal buffers in the right column.
-- Neovim-owned sessions are jobstart(term=true) children of this Nvim server
-- and die with it. tmux-owned sessions run in a tmux server on the socket
-- "cland-proto"; the terminal buffer only holds a `tmux attach` client.
local api = vim.api
local M = { list = {}, focused = nil, tiled = false, shift_enter = 'off' }

M.TMUX_SOCKET = 'cland-proto'

local home = vim.env.HOME
M.HARNESS = {
  claude = { home .. '/.local/bin/claude' },
  codex = { home .. '/.local/bin/codex' },
  opencode = { home .. '/.opencode/bin/opencode' },
}

local function app()
  return require('cland_proto.app')
end

function M.by_buf(buf)
  for _, s in ipairs(M.list) do
    if s.buf == buf then
      return s
    end
  end
end

function M.current()
  return M.list[M.focused or 0]
end

-- Start `cmd` in a new terminal buffer shown in the session column. A list
-- is turned into one shell-escaped string: Neovim names a terminal buffer
-- term://cwd//pid:<cmd> and for a list keeps only argv[0] there, so :restart
-- (which re-runs that name) would start the wrong command (check e).
function M.new(opts)
  if type(opts.cmd) == 'table' then
    opts.cmd = table.concat(vim.tbl_map(vim.fn.shellescape, opts.cmd), ' ')
  end
  local win = app().term_win()
  local buf = api.nvim_create_buf(true, false)
  local s = {
    id = #M.list + 1,
    name = opts.name,
    owner = opts.owner or 'nvim',
    cmd = opts.cmd,
    buf = buf,
    started = os.date('%H:%M:%S'),
  }
  M.list[#M.list + 1] = s
  api.nvim_win_set_buf(win, buf)
  api.nvim_win_call(win, function()
    s.job = vim.fn.jobstart(opts.cmd, { term = true })
  end)
  s.pid = s.job > 0 and vim.fn.jobpid(s.job) or nil
  M.focused = s.id
  if M.tiled then
    app().tile(true)
  end
  app().refresh()
  return s
end

function M.shell()
  return M.new({ name = vim.fn.fnamemodify(vim.o.shell, ':t'), cmd = { vim.o.shell } })
end

function M.harness(name)
  if vim.env.CLAND_PROTO_FAKE_HARNESS == '1' then
    -- automated checks: same wiring, a byte logger instead of the paid harness
    return M.new({ name = name .. '(fake)', cmd = { app().here .. '/bin/keylog', '-p', name .. '-fake' } })
  end
  local cmd = M.HARNESS[name]
  if vim.fn.executable(cmd[1]) ~= 1 then
    vim.notify('cland-proto: not executable: ' .. cmd[1], vim.log.levels.ERROR)
    return
  end
  return M.new({ name = name, cmd = cmd })
end

local function tmux_base()
  return { 'env', '-u', 'TMUX', 'tmux', '-L', M.TMUX_SOCKET, '-f', app().here .. '/tmux-sessions.conf' }
end

-- A session owned outside Neovim: create (or join) tmux session `name`
-- running `inner` on the cland-proto socket, and attach to it from a terminal.
function M.tmux_owned(name, inner)
  local cmd = tmux_base()
  -- a tmux session gets the tmux server's environment, not ours: pass what it needs
  vim.list_extend(cmd, { 'new-session', '-A', '-s', name, '-e', 'CLAND_PROTO_DIR=' .. app().here })
  vim.list_extend(cmd, inner)
  return M.new({ name = name, owner = 'tmux', cmd = cmd })
end

function M.tmux_harness(name)
  local inner = M.HARNESS[name]
  if vim.env.CLAND_PROTO_FAKE_HARNESS == '1' then
    inner = { app().here .. '/bin/keylog', '-p', name .. '-fake' }
  end
  return M.tmux_owned('cland-' .. name, inner)
end

-- Attach to an existing tmux session (any socket).
function M.attach(session, socket)
  local cmd = { 'env', '-u', 'TMUX', 'tmux', '-L', socket or M.TMUX_SOCKET, 'attach', '-t', session }
  return M.new({ name = 'tmux:' .. session, owner = 'tmux', cmd = cmd })
end

function M.show(id, enter)
  local s = M.list[id]
  if not s then
    return
  end
  M.focused = id
  local win
  if M.tiled then
    win = vim.fn.win_findbuf(s.buf)[1]
  end
  if not win then
    win = app().term_win()
    api.nvim_win_set_buf(win, s.buf)
  end
  api.nvim_set_current_win(win)
  if enter then
    vim.schedule(function()
      if api.nvim_get_current_buf() == s.buf and vim.bo[s.buf].buftype == 'terminal' then
        vim.cmd.startinsert()
      end
    end)
  end
  app().refresh()
end

function M.cycle(step, enter)
  if #M.list == 0 then
    return
  end
  local i = ((M.focused or 1) - 1 + step) % #M.list + 1
  M.show(i, enter)
end

function M.state(s)
  if s.exit_code then
    return 'exited ' .. s.exit_code
  end
  return 'running'
end

function M.summary()
  local parts = {}
  for _, s in ipairs(M.list) do
    local label = ('%d:%s'):format(s.id, s.name)
    if s.exit_code then
      label = label .. '(x' .. s.exit_code .. ')'
    end
    if s.owner == 'tmux' then
      label = label .. '[t]'
    end
    if s.id == M.focused then
      label = '*' .. label
    end
    parts[#parts + 1] = label
  end
  return #parts > 0 and table.concat(parts, ' ') or 'no sessions'
end

-- Register terminal buffers this module did not start (after :restart the
-- session file re-runs term:// commands).
function M.adopt_terminals()
  local known = {}
  for _, s in ipairs(M.list) do
    known[s.buf] = true
  end
  for _, buf in ipairs(api.nvim_list_bufs()) do
    if not known[buf] and api.nvim_buf_is_loaded(buf) and vim.bo[buf].buftype == 'terminal' then
      local name = api.nvim_buf_get_name(buf):match('^term://.-//%d+:(.*)$') or api.nvim_buf_get_name(buf)
      name = name:gsub("'", '')
      local short = name:match('new%-session %-A %-s (%S+)') or name:match('attach %-t (%S+)')
      local job = vim.bo[buf].channel
      M.list[#M.list + 1] = {
        id = #M.list + 1,
        name = (short and ('tmux:' .. short) or name):sub(1, 24),
        owner = name:find('tmux') and 'tmux' or 'nvim',
        cmd = name,
        buf = buf,
        job = job,
        pid = job > 0 and vim.fn.jobpid(job) or nil,
        started = os.date('%H:%M:%S') .. ' (restored)',
      }
    end
  end
  M.focused = M.focused or (#M.list > 0 and 1 or nil)
end

function M.forget(buf)
  local keep = {}
  for _, s in ipairs(M.list) do
    if s.buf ~= buf then
      keep[#keep + 1] = s
      s.id = #keep
    end
  end
  M.list = keep
  if M.focused and M.focused > #M.list then
    M.focused = #M.list > 0 and #M.list or nil
  end
end

-- Shift+Enter in terminal mode. "off" leaves it to libvterm (it sends CR
-- unless the program enabled kitty disambiguate); the other modes map <S-CR>
-- and write the bytes straight to the focused job.
M.SHIFT_ENTER = {
  off = nil,
  ['csi-u'] = '\27[13;2u',
  ['esc-cr'] = '\27\r',
  lf = '\n',
}

function M.set_shift_enter(mode)
  if mode ~= 'off' and not M.SHIFT_ENTER[mode] then
    vim.notify('cland-proto: modes are off, csi-u, esc-cr, lf', vim.log.levels.ERROR)
    return
  end
  M.shift_enter = mode
  pcall(vim.keymap.del, 't', '<S-CR>')
  if mode ~= 'off' then
    local bytes = M.SHIFT_ENTER[mode]
    vim.keymap.set('t', '<S-CR>', function()
      api.nvim_chan_send(vim.bo.channel, bytes)
    end, { desc = 'cland-proto Shift+Enter: ' .. mode })
  end
  app().refresh()
end

return M
