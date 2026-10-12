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
M.SNAPSHOT_TIMEOUT_MS = 30000
M.SNAPSHOT_MAX_EVENTS = 2048
M.SNAPSHOT_MAX_BYTES = 2 * 1024 * 1024

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
--- autostart (run `cland hub start` when no hub runs; default true, socket transport only),
--- serve_args (more arguments for the stdio child's `hub serve --stdio`, such as `--no-listen`).
function M.new(opts)
  return setmetatable({
    root = opts.root,
    transport = opts.transport or 'socket',
    cli = opts.cli,
    serve_args = opts.serve_args or {},
    autostart = opts.autostart ~= false,
    handlers = {},
    pending = {},
    snapshots = {},
    next_id = 1,
    state = 'idle',
    detail = nil,
    buffer = '',
    retry_ms = 250,
    failures = 0,
    stderr = '',
  }, Client)
end

--- Events: `state` (state, detail), `connected` (), `error` (a handler or callback failed: the message), and the pushed frames `message`, `artifact`, `delivery`, `topic`,
--- `session.state`, `session.role`, `presence`, `session.process`, `session.usage`, `inbox`, `task`,
--- `role.vacant` and `role.filled` (the event frame).
function Client:on(event, fn)
  self.handlers[event] = self.handlers[event] or {}
  table.insert(self.handlers[event], fn)
end

function Client:_emit(event, ...)
  for _, fn in ipairs(self.handlers[event] or {}) do
    self:_call(event .. ' handler', fn, ...)
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
--- opts.nulls: an explicit JSON null among the value's top-level fields arrives as vim.NIL (frames decode
--- null as nil otherwise, which cannot be told from a field left out: `coordinator: null` is "no coordinator").
function Client:request(frame, cb, opts)
  cb = cb or function() end
  if not self:connected() then
    local why = self.detail or 'not connected to the hub'
    vim.schedule(function()
      self:_call('request', cb, why)
    end)
    return
  end
  local id = 'nvim-' .. self.next_id
  self.next_id = self.next_id + 1
  self.pending[id] = cb
  if opts and opts.nulls then
    self.nulls = self.nulls or {}
    self.nulls[id] = true
  end
  self:_write(vim.tbl_extend('force', frame, { id = id }))
  return id
end

local snapshot_events = {
  ['events.list'] = { event = true },
  ['task.list'] = { task = true },
  ['topic.list'] = { topic = true, message = true },
  ['session.list'] = { ['session.cleanup'] = true, ['session.process'] = true, ['session.state'] = true, ['session.role'] = true, ['session.usage'] = true },
  ['hub.status'] = { ['verification.queue'] = true, crew = true, presence = true, ['session.state'] = true, ['session.role'] = true, ['role.vacant'] = true, ['role.filled'] = true, inbox = true },
  ['artifact.list'] = { artifact = true, message = true },
  ['topic.history'] = { ask = true, delivery = true, message = true, topic = true },
}

local function relevant(request, event)
  if not (snapshot_events[request.type] or {})[event.type] then return false end
  if request.type == 'topic.history' then
    local id = type(event.topic) == 'table' and event.topic.id or event.topic
    return id == request.topic
  end
  if event.type == 'message' then
    local m = event.message or {}
    if request.type == 'topic.list' then return m.fromKind ~= 'human' end
    return type(m.artifact) == 'table' or type(m.artifacts) == 'table' and #m.artifacts > 0
  end
  return true
end

--- A snapshot plus the events received while it was in flight. The caller installs the snapshot, then
--- replays relevant idempotent updates. Each attempt owns a bounded journal. An unanswered or overfull
--- attempt is discarded and retried; errors/disconnects release it and complete the caller normally.
function Client:snapshot(frame, cb, opts)
  local attempt
  attempt = function()
    local journal = { request = frame, events = {}, bytes = 0 }
    self.snapshots[journal] = true
    local timer, id
    local function release()
      self.snapshots[journal] = nil
      if timer and not timer:is_closing() then timer:stop(); timer:close() end
    end
    journal.restart = function()
      if not self.snapshots[journal] then return end
      release()
      if id then
        self.pending[id] = nil
        if self.nulls then self.nulls[id] = nil end
      end
      -- Start after the triggering event's handlers; no old reply can complete this new attempt.
      vim.schedule(attempt)
    end
    timer = vim.defer_fn(journal.restart, M.SNAPSHOT_TIMEOUT_MS)
    id = self:request(frame, function(err, value)
      release()
      cb(err, value, journal.events)
    end, opts)
  end
  attempt()
end

--- One inbox snapshot per connection, shared by the shell and topic views, kept by inbox events.
function Client:inbox(cb)
  if self:connected() and self.inbox_value then
    return self:_call('inbox', cb, nil, vim.deepcopy(self.inbox_value))
  end
  if self.inbox_waiters then
    table.insert(self.inbox_waiters, cb)
    return
  end
  self.inbox_waiters = { cb }
  self:request({ type = 'inbox.list' }, function(err, value)
    if not err and not self.inbox_value then self.inbox_value = value end
    local waiters = self.inbox_waiters or {}
    self.inbox_waiters = nil
    for _, fn in ipairs(waiters) do
      self:_call('inbox', fn, err, vim.deepcopy(self.inbox_value or value))
    end
  end)
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
  local cmd = vim.list_extend(vim.list_extend(vim.deepcopy(self.cli), { 'hub', 'serve', '--stdio' }), self.serve_args)
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
        self:_frame(frame, line)
      end
    end
  end
end

--- Call a handler or a request's callback: an error in it is kept (last_error) and emitted as `error`, never
--- raised into the main loop, where it would be a multi-line message and a hit-enter prompt.
function Client:_call(what, fn, ...)
  local ok, err = pcall(fn, ...)
  if not ok then
    self.last_error = ('%s: %s'):format(what, err)
    if what ~= 'error handler' then
      for _, h in ipairs(self.handlers.error or {}) do
        self:_call('error handler', h, self.last_error)
      end
    end
  end
end

function Client:_frame(frame, line)
  local t = frame.type
  if t == 'welcome' then
    self.inbox_value = nil
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
      local nulls = self.nulls and self.nulls[frame.id]
      if nulls then
        self.nulls[frame.id] = nil
      end
      if frame.ok then
        if nulls and line and type(frame.value) == 'table' then
          local ok, raw = pcall(vim.json.decode, line)
          if ok and type(raw) == 'table' and type(raw.value) == 'table' then
            for k, v in pairs(raw.value) do
              if v == vim.NIL then
                frame.value[k] = vim.NIL
              end
            end
          end
        end
        self:_call('request ' .. tostring(frame.id), cb, nil, frame.value)
      else
        self:_call('request ' .. tostring(frame.id), cb, frame.error or 'failed')
      end
    end
  elseif t == 'event' or t == 'verification.queue' or t == 'visibility' or t == 'crew' or t == 'message' or t == 'artifact' or t == 'delivery' or t == 'topic' or t == 'session.state' or t == 'session.role' or t == 'role.vacant' or t == 'role.filled' or t == 'task' or t == 'ask' or t == 'inbox' or t == 'presence' or t == 'session.process' or t == 'session.cleanup' or t == 'session.usage' then
    for journal in pairs(self.snapshots) do
      if relevant(journal.request, frame) then
        local bytes = line and #line or #vim.json.encode(frame)
        if #journal.events >= M.SNAPSHOT_MAX_EVENTS or journal.bytes + bytes > M.SNAPSHOT_MAX_BYTES then
          journal.restart()
        else
          journal.events[#journal.events + 1] = vim.deepcopy(frame)
          journal.bytes = journal.bytes + bytes
        end
      end
    end
    if t == 'inbox' then self.inbox_value = frame.inbox end
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
  self.inbox_value = nil
  local pending = self.pending
  self.pending = {}
  self.nulls = {}
  -- A completion may drain a queued refresh. Mark the transport lost first so it cannot create a new
  -- pending request (and journal) on the dead connection while we are failing the old requests.
  self:_set_state('disconnected', reason)
  for id, cb in pairs(pending) do
    self:_call('request ' .. tostring(id), cb, reason)
  end
  if self.stopping then
    return
  end
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
