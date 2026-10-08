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
    hub_coordinator = nil, -- { name = <live holder> | nil } once the hub said (hub.status, role.vacant, role.filled)
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

--- A topic as a `topic` event or a `topic.*` result carries it: replaces the known one, or joins the list.
function M.upsert_topic(topic)
  if type(topic) ~= 'table' or not topic.id then
    return
  end
  for i, t in ipairs(M.S.topics) do
    if t.id == topic.id then
      M.S.topics[i] = topic
      M.changed()
      return
    end
  end
  table.insert(M.S.topics, topic)
  M.changed()
end

--- The topic bound to an item, if any.
function M.topic_of_item(id)
  for _, t in ipairs(M.S.topics) do
    if t.item == id then
      return t
    end
  end
end

--- A topic's warning (`no coordinator`), or nil.
function M.warning(t)
  local w = t and t.warning
  return type(w) == 'string' and w ~= '' and w or nil
end

--- The topics as the panel and the picker group them (spec 4.5, Watch.dc.html): those waiting for the human
--- pinned on top (needs you), then the open ones (waiting for an agent included), then the closed ones; the
--- hub's order (activity) within each group.
function M.topic_groups()
  local groups = { { name = 'needs you', topics = {} }, { name = 'open', topics = {} }, { name = 'closed', topics = {} } }
  for _, t in ipairs(M.S.topics) do
    local g = t.status == 'waiting for human' and 1 or (t.status == 'closed' and 3 or 2)
    table.insert(groups[g].topics, t)
  end
  return groups
end

--- The human's unread messages over every topic.
function M.unread_total()
  local n = 0
  for _, t in ipairs(M.S.topics) do
    n = n + (tonumber(t.unread) or 0)
  end
  return n
end

local ROLE_LABELS = { coordinator = 'Coordinator', implementer = 'Implementer', reviewer = 'Reviewer', qa = 'QA' }

--- A session as it is shown everywhere (spec 4.4): the hub's `label` (`rev-1 [Reviewer]`), else built the same way.
function M.label(name, role, label)
  if type(label) == 'string' and label ~= '' then
    return label
  end
  return role and (name .. ' [' .. (ROLE_LABELS[role] or role) .. ']') or name
end

--- Every session the shell knows: the launched ones (session.list), then connected spokes nobody launched.
function M.sessions()
  local out, seen = {}, {}
  for _, p in ipairs(M.S.processes) do
    local live = p.status == 'running'
    out[#out + 1] = {
      name = p.name,
      role = p.role,
      label = M.label(p.name, p.role, p.label),
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
      out[#out + 1] = { name = p.name, role = p.role, label = M.label(p.name, p.role, p.label), harness = nil, model = nil, state = p.state or 'unknown', status = 'connected', launched = false, live = true }
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

--- The live session holding the Coordinator role, else nil. The hub's word (`coordinator` in hub.status, the
--- role.vacant and role.filled events) wins over the session rows, which may be a refresh behind.
function M.coordinator()
  local said = M.S.hub_coordinator
  if said then
    if not said.name then
      return nil
    end
    local s = M.session(said.name)
    if s then
      return s
    end
    return { name = said.name, role = 'coordinator', state = 'unknown', status = 'connected', launched = false, live = true }
  end
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

--- The "needs you" count: the topics waiting for the human (asks and approvals join with the inbox, #33).
function M.needs_you()
  local n = 0
  for _, t in ipairs(M.S.topics) do
    if t.status == 'waiting for human' then
      n = n + 1
    end
  end
  return n
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
