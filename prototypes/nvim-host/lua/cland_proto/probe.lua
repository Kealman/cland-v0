-- PROTOTYPE (ticket #11, reused by #15): instrumentation that surfaces state.
--  * writes the server address and start facts to .run/ (for scripted checks)
--  * event-loop lag probe: a 50 ms timer measures how late it fires
--  * optional key log: CLAND_PROTO_KEYLOG=<file> logs every key Nvim decodes
--  * _G.CP: small read-only helpers a driver calls over RPC
--    (#15: CP.state() is the fake chat state, CP.layout() the windows)
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
    end
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

-- Helpers for a driver over RPC, all return JSON strings.
local CP = {}

function CP.state()
  return vim.json.encode(require('cland_proto.state').plain())
end

-- Windows of the current tab page: role, size, position, buffer name.
function CP.layout()
  local out = { mode = api.nvim_get_mode().mode, tabs = #api.nvim_list_tabpages(), current = api.nvim_get_current_win(), wins = {} }
  for _, w in ipairs(api.nvim_tabpage_list_wins(0)) do
    local b = api.nvim_win_get_buf(w)
    local pos = api.nvim_win_get_position(w)
    out.wins[#out.wins + 1] = {
      win = w, role = vim.b[b].cland_role or vim.bo[b].buftype, topic = vim.b[b].cland_topic,
      session = vim.b[b].cland_session, float = api.nvim_win_get_config(w).relative ~= '',
      row = pos[1], col = pos[2], height = api.nvim_win_get_height(w), width = api.nvim_win_get_width(w),
    }
  end
  return vim.json.encode(out)
end

function CP.messages()
  return vim.json.encode(vim.split(api.nvim_exec2('messages', { output = true }).output, '\n'))
end

function CP.lag()
  return vim.json.encode({ lag = M.lag })
end

M.CP = CP

function M.setup(here)
  M.write_start_facts(here .. '/.run')
  M.start_lag_probe()
  if vim.env.CLAND_PROTO_KEYLOG and vim.env.CLAND_PROTO_KEYLOG ~= '' then
    M.start_key_log(vim.env.CLAND_PROTO_KEYLOG)
  end
  _G.CP = CP
end

return M
