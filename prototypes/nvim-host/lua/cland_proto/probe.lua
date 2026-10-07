-- PROTOTYPE (ticket #11): instrumentation that surfaces state.
--  * writes the server address and start facts to .run/ (for scripted checks)
--  * event-loop lag probe: a 50 ms timer measures how late it fires
--  * optional key log: CLAND_PROTO_KEYLOG=<file> logs every key Nvim decodes
--  * _G.CP: small read-only helpers the check driver calls over RPC
local api, uv = vim.api, vim.uv
local M = { lag = { last = 0, max = 0, recent = 0 } }

local function now_ms()
  return uv.hrtime() / 1e6
end

function M.write_start_facts(run_dir)
  vim.fn.mkdir(run_dir, 'p')
  vim.fn.writefile({ vim.v.servername }, run_dir .. '/servername')
  vim.fn.writefile({
    vim.json.encode({
      argv = vim.v.argv,
      NVIM_APPNAME = vim.env.NVIM_APPNAME,
      startreason = vim.v.startreason,
      pid = vim.fn.getpid(),
      servername = vim.v.servername,
      version = tostring(vim.version()),
    }),
  }, run_dir .. '/start.json')
end

function M.start_lag_probe()
  local period = 50
  local prev = now_ms()
  local window_max, window_start = 0, prev
  M.timer = uv.new_timer()
  M.timer:start(period, period, function()
    local t = now_ms()
    local lag = math.max(0, t - prev - period)
    prev = t
    M.lag.last = lag
    if lag > M.lag.max then
      M.lag.max = lag
    end
    window_max = math.max(window_max, lag)
    if t - window_start >= 2000 then
      M.lag.recent, window_max, window_start = window_max, 0, t
      vim.schedule(function()
        pcall(vim.cmd.redrawstatus)
      end)
    end
  end)
end

-- How long does work queued with vim.schedule() (the way a host would render
-- hub events) wait? A 100 ms libuv timer queues a callback; we record the
-- largest gap between two runs of that callback.
M.sched = { max_gap = 0, last_run = 0 }
function M.start_sched_probe()
  M.sched.last_run = now_ms()
  M.sched_timer = uv.new_timer()
  M.sched_timer:start(100, 100, function()
    vim.schedule(function()
      local t = now_ms()
      M.sched.max_gap = math.max(M.sched.max_gap, t - M.sched.last_run)
      M.sched.last_run = t
    end)
  end)
end

function M.start_key_log(path)
  local f = assert(io.open(path, 'a'))
  f:write(('--- key log start %s pid %d\n'):format(os.date('%H:%M:%S'), vim.fn.getpid()))
  f:flush()
  vim.on_key(function(key, typed)
    local sec, usec = uv.gettimeofday()
    f:write(('%d.%06d mode=%s key=%s typed=%s\n'):format(
      sec, usec, api.nvim_get_mode().mode, vim.fn.keytrans(key), vim.fn.keytrans(typed or '')))
    f:flush()
  end)
end

-- Helpers for the check driver (checks/driver.sh), all return JSON strings.
local CP = {}

function CP.state()
  local sessions = require('cland_proto.sessions')
  local out = { mode = api.nvim_get_mode().mode, focused = sessions.focused, tiled = sessions.tiled,
    lag = M.lag, sessions = {}, current_win_buf_role = vim.b.cland_role or vim.bo.buftype }
  for _, s in ipairs(sessions.list) do
    local win = vim.fn.win_findbuf(s.buf)[1]
    out.sessions[#out.sessions + 1] = {
      id = s.id, name = s.name, owner = s.owner, buf = s.buf, job = s.job, pid = s.pid,
      exit_code = s.exit_code, win = win,
      win_size = win and { api.nvim_win_get_height(win), api.nvim_win_get_width(win) } or vim.NIL,
      lines = api.nvim_buf_line_count(s.buf),
    }
  end
  return vim.json.encode(out)
end

-- Non-empty lines of session `id` (last `n` of them).
function CP.text(id, n)
  local s = require('cland_proto.sessions').list[id]
  local lines = api.nvim_buf_get_lines(s.buf, 0, -1, false)
  local keep = {}
  for _, l in ipairs(lines) do
    if l:match('%S') then
      keep[#keep + 1] = l
    end
  end
  return vim.json.encode(vim.list_slice(keep, math.max(1, #keep - (n or 20) + 1), #keep))
end

-- The rows of session `id` that its window currently shows.
function CP.visible(id)
  local s = require('cland_proto.sessions').list[id]
  local win = vim.fn.win_findbuf(s.buf)[1]
  if not win then
    return vim.json.encode({ error = 'not visible' })
  end
  local top = vim.fn.line('w0', win)
  local bot = vim.fn.line('w$', win)
  local pos = api.nvim_win_get_position(win)
  return vim.json.encode({
    top = top, bottom = bot, row = pos[1], col = pos[2],
    height = api.nvim_win_get_height(win), width = api.nvim_win_get_width(win),
    lines = api.nvim_buf_get_lines(s.buf, top - 1, bot, false),
  })
end

function CP.lag_reset()
  M.lag.max = 0
  M.sched.max_gap = 0
  return vim.json.encode({ lag = M.lag, sched = M.sched })
end

function CP.lag()
  return vim.json.encode({ lag = M.lag, sched = M.sched })
end

function CP.restore_log()
  return vim.json.encode(M.restore_log or vim.NIL)
end

function CP.composer()
  return vim.json.encode(api.nvim_buf_get_lines(require('cland_proto.chat').composer_buf, 0, -1, false))
end

function CP.thread_tail(n)
  local lines = api.nvim_buf_get_lines(require('cland_proto.chat').thread_buf, 0, -1, false)
  return vim.json.encode(vim.list_slice(lines, math.max(1, #lines - (n or 8) + 1), #lines))
end

M.CP = CP

function M.setup(here)
  M.write_start_facts(here .. '/.run')
  M.start_lag_probe()
  M.start_sched_probe()
  if vim.env.CLAND_PROTO_KEYLOG and vim.env.CLAND_PROTO_KEYLOG ~= '' then
    M.start_key_log(vim.env.CLAND_PROTO_KEYLOG)
  end
  _G.CP = CP
end

return M
