-- cland's hub client: the hub's frames as JSON lines (hub/README.md, "The UI's frames"), over the
-- project's Unix socket (found through `.cland/hub.json`) or over the stdio of a hub spawned as a child
-- (`cland hub serve --stdio`). Requests are correlated by id; pushed events (`message`, `delivery`)
-- and connection changes go to handlers. Every handler runs in the main loop (vim.schedule), never in a
-- libuv callback. The client subscribes to events on every (re)connect, then emits `connected`.
local uv = vim.uv

local M = {}

M.PROTOCOL = 2
local MAX_RETRY_MS = 5000
--- Failed socket connects in a row after which `cland hub start` runs: a `hub.json` left by a hub that was
--- killed or a machine that rebooted names a socket nobody serves, and `hub start` replaces it.
M.STALE_AFTER = 3

local Client = {}
Client.__index = Client

local function read_json(path)
  local ok, lines = pcall(vim.fn.readfile, path)
  if not ok then
    return nil
  end
  local decoded, value = pcall(vim.json.decode, table.concat(lines, '\n'))
  return decoded and type(value) == 'table' and value or nil
end

local function first_line(s)
  s = vim.trim(s or '')
  return (s:gsub('\n.*', ''))
end

--- opts: root (the project), transport ('socket' | 'stdio'), cli (the `cland` command as a list),
--- autostart (run `cland hub start` when no hub runs; default true, socket transport only).
function M.new(opts)
  return setmetatable({
    root = opts.root,
    transport = opts.transport or 'socket',
    cli = opts.cli,
    autostart = opts.autostart ~= false,
    handlers = {},
    pending = {},
    next_id = 1,
    state = 'idle',
    detail = nil,
    buffer = '',
    retry_ms = 250,
    failures = 0,
    stderr = '',
  }, Client)
end

--- Events: `state` (state, detail), `connected` (), and the pushed frames `message`, `delivery`, `topic`,
--- `session.state`, `session.role`, `role.vacant` and `role.filled` (the event frame).
function Client:on(event, fn)
  self.handlers[event] = self.handlers[event] or {}
  table.insert(self.handlers[event], fn)
end

function Client:_emit(event, ...)
  for _, fn in ipairs(self.handlers[event] or {}) do
    local ok, err = pcall(fn, ...)
    if not ok then
      self.last_error = ('%s handler: %s'):format(event, err)
    end
  end
end

function Client:_set_state(state, detail)
  self.state = state
  self.detail = detail
  self:_emit('state', state, detail)
end

function Client:connected()
  return self.state == 'connected'
end

function Client:start()
  self.stopping = false
  self:_connect()
end

function Client:stop()
  self.stopping = true
  if self.pipe then
    pcall(self.pipe.close, self.pipe)
    self.pipe = nil
  end
  if self.proc then
    -- closing the child's stdin is how its parent tells a stdio hub to stop
    pcall(self.proc.write, self.proc, nil)
    self.proc = nil
  end
end

function Client:_write(frame)
  local line = vim.json.encode(frame) .. '\n'
  if self.pipe then
    self.pipe:write(line)
  elseif self.proc then
    self.proc:write(line)
  end
end

--- Send a request; `cb(err, value)` runs in the main loop. Fails at once while not connected.
function Client:request(frame, cb)
  cb = cb or function() end
  if not self:connected() then
    local why = self.detail or 'not connected to the hub'
    vim.schedule(function()
      cb(why)
    end)
    return
  end
  local id = 'nvim-' .. self.next_id
  self.next_id = self.next_id + 1
  self.pending[id] = cb
  self:_write(vim.tbl_extend('force', frame, { id = id }))
end

function Client:_connect()
  if self.stopping then
    return
  end
  self.buffer = ''
  if self.transport == 'stdio' then
    return self:_spawn()
  end
  local discovery = read_json(self.root .. '/.cland/hub.json')
  local usable = discovery and type(discovery.socket) == 'string' and type(discovery.secret) == 'string'
  if not usable or self.failures >= M.STALE_AFTER then
    if self.autostart and not self.autostarted and self.cli then
      return self:_hub_start(usable and 'the hub in hub.json does not answer: starting one' or 'no hub runs for this project: starting one')
    end
    if not usable then
      self:_set_state('waiting', 'no hub runs for this project (cland hub start)')
      return self:_retry()
    end
  end
  local pipe = uv.new_pipe(false)
  self.pipe = pipe
  self:_set_state('connecting', 'connecting to the hub')
  pipe:connect(discovery.socket, function(err)
    vim.schedule(function()
      if self.pipe ~= pipe then
        pcall(pipe.close, pipe)
        return
      end
      if err then
        self.failures = self.failures + 1
        return self:_lost('cannot reach the hub: ' .. err)
      end
      pipe:read_start(function(read_err, chunk)
        vim.schedule(function()
          if self.pipe ~= pipe then
            return
          end
          if read_err then
            return self:_lost('the hub connection failed: ' .. read_err)
          end
          if not chunk then
            return self:_lost('the hub closed the connection')
          end
          self:_data(chunk)
        end)
      end)
      self:_write({ type = 'hello', protocol = M.PROTOCOL, secret = discovery.secret, client = 'nvim' })
    end)
  end)
end

--- `cland hub start`, once per streak of failures; it replaces a stale hub.json and reports a live hub.
function Client:_hub_start(why)
  self.autostarted = true
  self.failures = 0
  self:_set_state('starting', why)
  local cmd = vim.list_extend(vim.deepcopy(self.cli), { 'hub', 'start' })
  local ok = pcall(vim.system, cmd, { cwd = self.root, text = true }, function(out)
    vim.schedule(function()
      if out.code ~= 0 then
        self:_set_state('failed', 'cland hub start failed: ' .. first_line(out.stderr ~= '' and out.stderr or out.stdout))
      end
      self:_retry()
    end)
  end)
  if not ok then
    self:_set_state('failed', 'cannot run cland hub start')
    self:_retry()
  end
end

function Client:_spawn()
  local cmd = vim.list_extend(vim.deepcopy(self.cli), { 'hub', 'serve', '--stdio' })
  local proc
  self:_set_state('connecting', 'starting a hub on stdio')
  local ok, result = pcall(vim.system, cmd, {
    cwd = self.root,
    stdin = true,
    stdout = function(_, data)
      vim.schedule(function()
        if self.proc == proc and data then
          self:_data(data)
        end
      end)
    end,
    stderr = function(_, data)
      if data then
        self.stderr = (self.stderr .. data):sub(-4096)
      end
    end,
  }, function(out)
    vim.schedule(function()
      if self.proc == proc then
        self:_lost(('the stdio hub exited (%s): %s'):format(out.code, first_line(self.stderr:match('[^\n]*\n?$'))))
      end
    end)
  end)
  if not ok then
    return self:_lost('cannot start the hub: ' .. tostring(result))
  end
  proc = result
  self.proc = proc
  -- the parent spawned the hub: no secret on this edge
  self:_write({ type = 'hello', protocol = M.PROTOCOL, client = 'nvim' })
end

function Client:_data(chunk)
  self.buffer = self.buffer .. chunk
  while true do
    local nl = self.buffer:find('\n', 1, true)
    if not nl then
      break
    end
    local line = self.buffer:sub(1, nl - 1)
    self.buffer = self.buffer:sub(nl + 1)
    if line:match('%S') then
      local ok, frame = pcall(vim.json.decode, line, { luanil = { object = true, array = true } })
      if ok and type(frame) == 'table' then
        self:_frame(frame)
      end
    end
  end
end

function Client:_frame(frame)
  local t = frame.type
  if t == 'welcome' then
    self.retry_ms = 250
    self.autostarted = false
    self.failures = 0
    self:_set_state('connected', nil)
    self:request({ type = 'subscribe' }, function(err)
      if err then
        self:_set_state('connected', 'no events from the hub: ' .. err)
      end
    end)
    self:_emit('connected')
  elseif t == 'error' then
    self:_set_state('refused', 'the hub refused: ' .. tostring(frame.message))
  elseif t == 'result' then
    local cb = self.pending[frame.id]
    if cb then
      self.pending[frame.id] = nil
      if frame.ok then
        cb(nil, frame.value)
      else
        cb(frame.error or 'failed')
      end
    end
  elseif t == 'message' or t == 'delivery' or t == 'topic' or t == 'session.state' or t == 'session.role' or t == 'role.vacant' or t == 'role.filled' or t == 'task' then
    self:_emit(t, frame)
  end
end

function Client:_lost(reason)
  if self.pipe then
    pcall(self.pipe.close, self.pipe)
    self.pipe = nil
  end
  if self.proc then
    pcall(self.proc.kill, self.proc, 15)
    self.proc = nil
  end
  local pending = self.pending
  self.pending = {}
  for _, cb in pairs(pending) do
    pcall(cb, reason)
  end
  if self.stopping then
    return
  end
  self:_set_state('disconnected', reason)
  self:_retry()
end

function Client:_retry()
  if self.stopping or self.retry_timer then
    return
  end
  local delay = self.retry_ms
  self.retry_ms = math.min(self.retry_ms * 2, MAX_RETRY_MS)
  self.retry_timer = vim.defer_fn(function()
    self.retry_timer = nil
    self:_connect()
  end, delay)
end

return M
