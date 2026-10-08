-- The shell's state: what the hub said (topics, sessions with their states and capability tables, items)
-- and what the shell shows (the centre view and its history, which panels are open). Every change goes
-- through `changed()`, which renders once in the next main-loop tick (vim.schedule), so a burst of hub
-- events costs one redraw and never runs inside a libuv callback.
local M = {}

M.listeners = {}

function M.reset(opts)
  opts = opts or {}
  M.S = {
    root = opts.root or '',
    project = opts.root and vim.fn.fnamemodify(opts.root, ':t') or 'cland',
    hub = { state = 'idle', detail = nil },
    topics = {}, -- Topic, as topic.list returns them
    processes = {}, -- HarnessProcess rows from session.list
    presence = {}, -- connected sessions from hub.status (spokes started by hand included)
    adapters = {}, -- harness → capability table
    items = {}, -- task.list summaries
    items_note = nil, -- why the items panel is empty
    ui = {
      view = { kind = 'thread', id = 'general' },
      hist = {},
      left = false,
      right = nil, -- 'inbox' | 'sessions' | 'topics'
      dock = false,
      preset = nil,
    },
    attached = {}, -- session name → true while a terminal is attached in this Neovim
    flash = nil, -- one line for the status line, instead of the message area
  }
end

M.reset()

function M.on_change(fn)
  table.insert(M.listeners, fn)
end

local scheduled = false
--- Render once in the next tick, whatever number of changes came before it.
function M.changed()
  if scheduled then
    return
  end
  scheduled = true
  vim.schedule(function()
    scheduled = false
    for _, fn in ipairs(M.listeners) do
      pcall(fn)
    end
  end)
end

--- A one-line notice in the status line (never the message area: no hit-enter prompt).
function M.say(text, group)
  text = tostring(text or ''):gsub('\n', ' ')
  M.S.flash = { text = text, group = group or 'ClandDimBar', at = vim.uv.now() }
  M.changed()
end

function M.topic(id)
  for _, t in ipairs(M.S.topics) do
    if t.id == id then
      return t
    end
  end
end

--- Every session the shell knows: the launched ones (session.list), then connected spokes nobody launched.
function M.sessions()
  local out, seen = {}, {}
  for _, p in ipairs(M.S.processes) do
    local live = p.status == 'running'
    out[#out + 1] = {
      name = p.name,
      role = p.role,
      harness = p.harness,
      model = p.model,
      state = live and (p.state or 'unknown') or 'unknown',
      status = p.status,
      launched = true,
      live = live,
      attach = p.attach,
    }
    seen[p.name] = true
  end
  for _, p in ipairs(M.S.presence) do
    if not seen[p.name] then
      out[#out + 1] = { name = p.name, role = p.role, harness = nil, model = nil, state = p.state or 'unknown', status = 'connected', launched = false, live = true }
      seen[p.name] = true
    end
  end
  for _, s in ipairs(out) do
    s.item = M.item_of_session(s.name)
  end
  return out
end

function M.session(name)
  for _, s in ipairs(M.sessions()) do
    if s.name == name then
      return s
    end
  end
end

--- The live session holding the Coordinator role, else nil.
function M.coordinator()
  for _, s in ipairs(M.sessions()) do
    if s.live and s.role and s.role:lower() == 'coordinator' then
      return s
    end
  end
end

--- How far a session's state can be trusted, from its adapter's capability table.
function M.reliability(s)
  local caps = s and s.harness and M.S.adapters[s.harness]
  return caps and caps.states and caps.states[s.state] or nil
end

function M.counts()
  local c = { total = 0, live = 0, busy = 0, idle = 0, waiting = 0, down = 0 }
  for _, s in ipairs(M.sessions()) do
    c.total = c.total + 1
    if s.live then
      c.live = c.live + 1
      if s.state == 'busy' then
        c.busy = c.busy + 1
      elseif s.state == 'idle' then
        c.idle = c.idle + 1
      elseif s.state:match('^waiting') then
        c.waiting = c.waiting + 1
      end
    else
      c.down = c.down + 1
    end
  end
  return c
end

--- The "needs you" count: the inbox is #33, so nothing counts yet.
function M.needs_you()
  return 0
end

function M.item(id)
  for _, it in ipairs(M.S.items) do
    if it.id == id then
      return it
    end
  end
end

function M.item_of_session(name)
  for _, it in ipairs(M.S.items) do
    if it.claim and it.claim.session == name and it.state ~= 'closed' then
      return it.id
    end
  end
end

--- A session's state changed (a `session.state` event): true when the session was known.
function M.set_session_state(name, state)
  local known = false
  for _, p in ipairs(M.S.processes) do
    if p.name == name then
      p.state = state
      known = true
    end
  end
  for _, p in ipairs(M.S.presence) do
    if p.name == name then
      p.state = state
      known = true
    end
  end
  M.changed()
  return known
end

--- What survives `:restart`: the layout and the sessions attached in terminals.
function M.snapshot()
  local ui = M.S.ui
  local attached = {}
  for name in pairs(M.S.attached) do
    attached[#attached + 1] = name
  end
  table.sort(attached)
  return {
    root = M.S.root,
    view = ui.view,
    hist = ui.hist,
    left = ui.left,
    right = ui.right,
    dock = ui.dock,
    attached = attached,
  }
end

return M
