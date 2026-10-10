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
    crew = nil, -- effective staffing snapshot and summary
    roles = {}, -- role.list's roles: {role, label, exclusive, launch = {harness, model, effort}, holders}
    sessions_note = nil, -- { text, group }: the last launch or stop outcome, shown atop the sessions panel
    items = {}, -- task.list summaries
    tracker = { levels = {} }, -- hub.status's loaded container ladder; unknown until the hub answers
    sibling_orders = {}, -- final task rank events, keyed by parent (empty string for roots)
    items_note = nil, -- why the items panel is empty
    inbox = { asks = {}, approvals = {}, waiting = {}, notifications = {} }, -- inbox.list and `inbox` events (#33)
    needs_you = nil, -- the hub's "needs you" count (hub.status, `inbox` events); nil until it said
    ui = {
      view = { kind = 'thread', id = 'general' },
      hist = {},
      left = false,
      right = nil, -- 'inbox' | 'sessions' | 'topics'
      dock = false,
      preset = nil,
      sizes = vim.empty_dict(), -- manual left/right widths and dock height; absent means use the formula
      items_filter = 'board',
      items_folds = {}, -- per-item tree folds; absent uses the level/state default
      board_parent = nil, -- optional open container within the current release
      current_release = nil, -- the human's selected open container; nil uses the semver current release
      sessions_sel = nil, -- the cursor-selected session, expanded in the panel
      sessions_stopped_folded = true,
      confirm = nil, -- { session = name }: the sessions panel asks before stopping it
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
      cwd = p.cwd,
      state = live and (p.state or 'unknown') or 'unknown',
      status = p.status,
      launched = true,
      live = live,
      attach = p.attach,
      usage = p.usage,
      approvalCommand = p.approvalCommand,
      holds = p.holds,
    }
    seen[p.name] = true
  end
  local holds = {}
  for _, p in ipairs(M.S.presence) do
    if type(p.holds) == 'table' then holds[p.name] = p.holds end
    if not seen[p.name] then
      out[#out + 1] = { name = p.name, role = p.role, label = M.label(p.name, p.role, p.label), harness = nil, model = nil, state = p.state or 'unknown', status = 'connected', launched = false, live = true, approvalCommand = p.approvalCommand }
      seen[p.name] = true
    end
  end
  local launched_for = {}
  for _, p in ipairs(M.S.processes) do
    if type(p.item) == 'string' and p.item ~= '' then
      launched_for[p.name] = p.item
    end
  end
  for _, s in ipairs(out) do
    s.holds = holds[s.name] or s.holds
    s.item = M.item_of_session(s.name) or launched_for[s.name]
  end
  return out
end

M.ROLE_LABELS = { aide = 'Aide', coordinator = 'Coordinator', implementer = 'Implementer', reviewer = 'Reviewer', qa = 'QA' }

--- A session as it is shown everywhere (spec 4.4): the hub's `label` (`rev-1 [Reviewer]`), else built the same way.
function M.label(name, role, label)
  if type(label) == 'string' and label ~= '' then
    return label
  end
  if not role or role == vim.NIL or role == '' then
    return name
  end
  local r
  for _, def in ipairs(M.S and M.S.roles or {}) do
    if def.role == role then
      r = def.label
    end
  end
  return name .. ' [' .. (r or M.ROLE_LABELS[role] or role) .. ']'
end

--- A role's definition from role.list (its launch defaults), by name or label, whatever the case.
function M.role_def(role)
  role = (role or ''):lower()
  for _, def in ipairs(M.S.roles) do
    if def.role == role or (def.label or ''):lower() == role then
      return def
    end
  end
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

function M.folded(key)
  return key == 'stopped' and M.S.ui.sessions_stopped_folded
end

function M.set_fold(key, folded)
  if key == 'stopped' then M.S.ui.sessions_stopped_folded = folded end
end

-- Visibility layers will replace this rule in T-115. Until then, now means not stopped.
function M.session_now(s)
  return s.live
end

M.SESSION_GROUPS = { { 'yours', 'yours' }, { 'waiting', 'waiting' }, { 'busy', 'busy' }, { 'idle', 'idle' } }

local function state_group(s)
  if not s.live then return 'stopped' end
  if s.state:match('^waiting') then return 'waiting' end
  if s.state == 'busy' then return 'busy' end
  return 'idle' -- the hub cannot classify unknown more precisely
end

function M.session_group(s)
  if s.live and s.role == 'aide' then return 'yours' end
  return state_group(s)
end

function M.counts()
  local c = { total = 0, live = 0, busy = 0, idle = 0, waiting = 0, down = 0, now = 0 }
  for _, s in ipairs(M.sessions()) do
    c.total = c.total + 1
    if M.session_now(s) then c.now = c.now + 1 end
    if s.live then
      c.live = c.live + 1
      local group = state_group(s)
      c[group] = c[group] + 1
    else
      c.down = c.down + 1
    end
  end
  return c
end

--- The inbox as the hub sent it (`inbox.list`, an `inbox` event).
function M.set_inbox(inbox)
  if type(inbox) ~= 'table' then
    return
  end
  local function list(x)
    return type(x) == 'table' and x or {}
  end
  M.S.inbox = { asks = list(inbox.asks), approvals = list(inbox.approvals), waiting = list(inbox.waiting), notifications = list(inbox.notifications) }
  if type(inbox.needsYou) == 'number' then
    M.S.needs_you = inbox.needsYou
  end
  M.changed()
end

--- The human answered ask `id`: its row goes at once (the hub's `inbox` event confirms it).
function M.answered(id)
  local asks = M.S.inbox.asks
  for i, a in ipairs(asks) do
    if a.id == id then
      table.remove(asks, i)
      break
    end
  end
  M.changed()
end

--- The hub owns the count (hub.status, inbox.list and `inbox` events). Unknown until
--- it supplies a number; rows, messages and local actions never change it.
function M.needs_you()
  return M.S.needs_you
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

--- A complete process view: renames and reused names replace the previous row.
function M.upsert_process(process)
  if type(process) ~= 'table' or not process.name or not process.sessionId then
    return
  end
  local rows = {}
  for _, p in ipairs(M.S.processes) do
    if p.name ~= process.name and p.sessionId ~= process.sessionId then
      rows[#rows + 1] = p
    end
  end
  rows[#rows + 1] = process
  table.sort(rows, function(a, b)
    local at, bt = a.startedAt or '', b.startedAt or ''
    return at == bt and a.name < b.name or at < bt
  end)
  M.S.processes = rows
  M.changed()
end

--- A rejected launch leaves accepted rows by identity; another launch may already own its old name.
function M.remove_process(sessionId)
  if not sessionId then return end
  local rows = {}
  for _, p in ipairs(M.S.processes) do
    if p.sessionId ~= sessionId then rows[#rows + 1] = p end
  end
  M.S.processes = rows
  M.changed()
end

function M.set_session_usage(sessionId, usage)
  if not sessionId or type(usage) ~= 'table' then return end
  for _, p in ipairs(M.S.processes) do
    if p.sessionId == sessionId then p.usage = usage end
  end
  M.changed()
end

function M.set_session_role(name, role)
  if not name then return end
  for _, p in ipairs(M.S.presence) do
    if p.name == name then p.role, p.label = role, nil end
  end
  for _, p in ipairs(M.S.processes) do
    -- A stopped process keeps its launch role for resuming; presence carries the live role.
    if p.name == name and p.status == 'running' then p.role, p.label = role, nil end
  end
  M.changed()
end

--- A session's state changed (a `session.state` event): true when the session was known.
function M.set_session_state(name, state, approvalCommand)
  local known = false
  for _, p in ipairs(M.S.processes) do
    if p.name == name then
      p.state = state
      p.approvalCommand = state == 'waiting for approval' and approvalCommand or nil
      known = true
    end
  end
  for _, p in ipairs(M.S.presence) do
    if p.name == name then
      p.state = state
      p.approvalCommand = state == 'waiting for approval' and approvalCommand or nil
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
