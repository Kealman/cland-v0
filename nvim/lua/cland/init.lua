-- cland in Neovim: the workbench shell (spec section 5, #25). It connects to the project's hub, keeps the
-- state the panels and bars show (topics, sessions with their states, items), and wires the keys.
--
-- Modules: hub (the client), state (what the hub said, what the shell shows), layout (windows, centre
-- views, presets), bars (top bar, status line, panel headers), panels (items, sessions, topics, inbox),
-- views (topic views, placeholders), sessions (attached terminals), picker, motions, restart, hl.
local api = vim.api

local M = {}

local hub = require('cland.hub')
local state = require('cland.state')

--- nvim/ (this file is nvim/lua/cland/init.lua) and the repository around it.
local function dirs()
  local this = debug.getinfo(1, 'S').source:sub(2)
  local nvim_dir = vim.fn.fnamemodify(this, ':p:h:h:h')
  return nvim_dir, vim.fn.fnamemodify(nvim_dir, ':h')
end

--- The `cland` command as a list: CLAND_COMMAND (a JSON array) when set, else node + hub/bin/cland.ts.
local function cli_command(repo)
  local override = vim.env.CLAND_COMMAND
  if override and override ~= '' then
    local ok, list = pcall(vim.json.decode, override)
    if ok and type(list) == 'table' and #list > 0 then
      return list
    end
  end
  return { vim.env.CLAND_NODE or 'node', repo .. '/hub/bin/cland.ts' }
end

-- Data from the hub ---------------------------------------------------------------------------------------

local function refresh_topics()
  M.client:snapshot({ type = 'topic.list' }, function(err, value, events)
    if not err and value and value.topics then
      state.S.topics = value.topics
      local counted, watermarks, ambiguous = {}, {}, false
      for _, t in ipairs(state.S.topics) do watermarks[t.id] = t.lastMessageAt or false end
      for _, event in ipairs(events) do
        if event.type == 'topic' then
          state.upsert_topic(event.topic)
          if event.topic and event.topic.id then watermarks[event.topic.id] = event.topic.lastMessageAt or false end
        elseif event.type == 'message' and event.topic then
          local t, m = state.topic(event.topic.id), event.message or {}
          if t and m.fromKind ~= 'human' and m.id and not counted[m.id] then
            counted[m.id] = true
            -- The fetched row's latest message time is its watermark. Never copy cached metadata or
            -- cached unread totals across a reconnect, and count a replayed message only once.
            local watermark = watermarks[t.id]
            if type(m.ts) ~= 'string' or m.ts == watermark then
              ambiguous = true
            elseif not watermark or m.ts > watermark then
              local v = state.S.ui.view
              if v.kind ~= 'thread' or v.id ~= t.id then t.unread = (tonumber(t.unread) or 0) + 1 end
              if not t.lastMessageAt or m.ts > t.lastMessageAt then t.lastMessageAt = m.ts end
            end
          end
        end
      end
      state.changed()
      -- Equal timestamps cannot identify inclusion. Read an authoritative count instead of guessing.
      if ambiguous then refresh_topics() end
    end
  end)
end

--- Idempotent session updates replayed over the corresponding fetched rows.
local function replay_sessions(events, processes)
  for _, e in ipairs(events) do
    if e.type == 'session.role' then state.set_session_role(e.session, e.role)
    elseif e.type == 'session.state' then state.set_session_state(e.session, e.state, e.approvalCommand, e.layer)
    elseif processes and e.type == 'session.process' then
      state.upsert_process(e.process)
      if type(e.archived) == 'number' then state.S.archived_count = e.archived end
    elseif processes and e.type == 'sessions.pruned' then
      for _, id in ipairs(e.sessionIds or {}) do state.remove_process(id) end
      state.S.archived_count = e.archived
    elseif processes and e.type == 'session.cleanup' then state.remove_process(e.sessionId)
    elseif processes and e.type == 'session.usage' then state.set_session_usage(e.sessionId, e.usage)
    elseif not processes then
      if e.type == 'presence' and type(e.sessions) == 'table' then state.S.presence = e.sessions
      elseif e.type == 'role.vacant' then state.S.hub_coordinator = { name = nil }
      elseif e.type == 'role.filled' then state.S.hub_coordinator = { name = e.session }
      elseif e.type == 'crew' then state.S.crew = { config = e.config, summary = e.summary }
      elseif e.type == 'verification.queue' then require('cland.verification').set(e.queue)
      elseif e.type == 'inbox' then state.set_inbox(e.inbox) end
    end
  end
end

--- `fn(done)` with at most one run in flight: a call while one is out runs it once more after, never stacks
--- requests behind a slow hub (T-67: a burst of events or a timer kept re-asking while the hub was blocked).
local function single_flight(fn)
  local busy, again = false, false
  local run
  run = function()
    if busy then
      again = true
      return
    end
    busy = true
    fn(function()
      busy = false
      if again then
        again = false
        run()
      end
    end)
  end
  return run
end

--- A `done` to call once per answer: the last of `n` ends the run.
local function after(n, done)
  return function()
    n = n - 1
    if n == 0 then
      done()
    end
  end
end

local refresh_archive = single_flight(function(done)
  M.client:snapshot({ type = 'session.list', archived = true }, function(err, value, events)
    if not err and value then
      state.S.archived_processes = value.processes or {}
      state.S.archived_count = value.archived or 0
      replay_sessions(events, true)
      state.changed()
    end
    done()
  end)
end)
M.refresh_archive = refresh_archive

local refresh_sessions = single_flight(function(done)
  if state.S.ui.sessions_archive then refresh_archive() end
  local answered = after(4, done)
  M.client:snapshot({ type = 'session.list' }, function(err, value, events)
    if not err and value then
      state.S.processes = value.processes or {}
      state.S.archived_count = value.archived or 0
      state.S.adapters = value.adapters or {}
      replay_sessions(events, true)
      state.changed()
    end
    answered()
  end)
  -- `coordinator: null` is the hub saying nobody holds the role (a role.vacant missed while away, #29): it
  -- arrives as vim.NIL; a hub.status without the field leaves the chip to the session rows
  M.client:snapshot({ type = 'hub.status' }, function(err, value, events)
    if not err and value then
      state.S.presence = value.sessions or {}
      state.S.crew = type(value.crew) == 'table' and value.crew or nil
      require('cland.verification').set(value.verification)
      require('cland.keys').layouts(value.keys and value.keys.layouts or {})
      state.S.tracker = type(value.tracker) == 'table' and value.tracker or { levels = {} }
      if value.coordinator == vim.NIL then
        state.S.hub_coordinator = { name = nil }
      elseif type(value.coordinator) == 'string' then
        state.S.hub_coordinator = { name = value.coordinator }
      end
      if type(value.needsYou) == 'number' then
        state.S.needs_you = value.needsYou
      end
      replay_sessions(events, false)
      state.changed()
    end
    answered()
  end, { nulls = true })
  -- the roles and their launch defaults: the launcher's prefill and the labels
  M.client:request({ type = 'role.list' }, function(err, value)
    answered()
    if not err and value and value.roles then
      state.S.roles = value.roles
      state.changed()
    end
  end)
  M.client:inbox(function(err, value)
    answered()
    if not err then
      state.set_inbox(value)
    end
  end)
end)

M.refresh_sessions = refresh_sessions

--- The whole list, on connecting: after that the `task` events keep it (an item as `task.list` shows it), so
--- nothing polls `task.list` (T-67).
local refresh_items = single_flight(function(done)
  M.client:snapshot({ type = 'task.list' }, function(err, value, events)
    if err then
      state.S.items_note = 'items: ' .. tostring(err)
    else
      state.S.items_loaded = true
      state.S.items, state.S.items_note = value and value.items or {}, nil
      state.S.sibling_orders = {}
      for _, event in ipairs(events) do
        if event.type == 'task' then require('cland.items').apply_event(event) end
      end
    end
    state.changed()
    done()
  end)
end)

function M.refresh()
  if not M.client:connected() then
    return
  end
  refresh_topics()
  refresh_sessions()
  refresh_items()
end

local function wire_client(client)
  -- a handler that failed says so on the status line, one line, never as an error in the message area
  client:on('error', function(msg)
    state.say('cland: ' .. tostring(msg), 'ClandRedBar')
  end)
  client:on('state', function(st, detail)
    state.S.hub = { state = st, detail = detail }
    state.changed()
  end)
  client:on('connected', function()
    M.refresh()
    require('cland.events').refresh_summary()
    if state.S.ui.view.kind == 'events' then require('cland.events').enter() end
  end)
  client:on('visibility', M.refresh)
  client:on('message', function(event)
    if not event.topic then
      return
    end
    local t = state.topic(event.topic.id)
    if not t then
      return refresh_topics()
    end
    local m = event.message or {}
    if m.fromKind == 'human' then
      return
    end
    local v = state.S.ui.view
    if v.kind == 'thread' and v.id == t.id then
      -- the thread is in view: read as it arrives
      require('cland.views').mark_read(t.id, m.id)
    else
      t.unread = (tonumber(t.unread) or 0) + 1
      if m.ts then
        t.lastMessageAt = m.ts
      end
      state.changed()
    end
  end)
  -- a topic's status, warning, binding or unread count changed (#32)
  client:on('topic', function(event)
    state.upsert_topic(event.topic)
  end)
  -- the tracker's index changed (#36): the items panel, the board and an item view follow at once
  client:on('task', function(event)
    -- Membership changes must invalidate the former epic before replacing/removing the child.
    if event.id then require('cland.plan').invalidate(event.id) end
    require('cland.items').apply_event(event)
    if event.id then
      require('cland.item_view').invalidate(event.id)
      require('cland.plan').invalidate(event.id)
    end
  end)
  -- the Coordinator's vacancy (#29): the top bar's chip follows the hub's events at once
  client:on('role.vacant', function()
    state.S.hub_coordinator = { name = nil }
    state.changed()
  end)
  client:on('role.filled', function(event)
    state.S.hub_coordinator = { name = event.session }
    state.changed()
  end)
  client:on('crew', function(event)
    state.S.crew = { config = event.config, summary = event.summary }
    state.changed()
  end)
  client:on('verification.queue', function(event)
    require('cland.verification').set(event.queue)
    state.changed()
  end)
  client:on('session.role', function(event)
    state.set_session_role(event.session, event.role)
  end)
  client:on('session.state', function(event)
    state.set_session_state(event.session, event.state, event.approvalCommand, event.layer)
  end)
  client:on('presence', function(event)
    if type(event.sessions) == 'table' then
      state.S.presence = event.sessions
      state.changed()
    end
  end)
  client:on('session.process', function(event)
    state.upsert_process(event.process)
    if type(event.archived) == 'number' then state.S.archived_count = event.archived end
    state.changed()
  end)
  client:on('sessions.pruned', function(event)
    for _, id in ipairs(event.sessionIds or {}) do state.remove_process(id) end
    state.S.archived_count = event.archived
    state.changed()
  end)
  client:on('session.cleanup', function(event)
    state.remove_process(event.sessionId)
  end)
  client:on('session.usage', function(event)
    state.set_session_usage(event.sessionId, event.usage)
  end)
  -- the inbox, whole, whenever any of it changed (#33)
  client:on('event', function(event) require('cland.events').push(event.row) end)
  client:on('inbox', function(event)
    state.set_inbox(event.inbox)
  end)
end

-- Keys and commands ---------------------------------------------------------------------------------------

M.HELP = {
  'cland workbench · Space is the leader (␣)',
  '',
  'Panels    ␣i items (left) · ␣n inbox · ␣s sessions · ␣t topics (right; the active key hides it)',
  'Items     1 board · 2 in work · 3 needs you · 4 done · 5 map · 6 all (f / F cycle) · ↵ the item view · e edits its file',
  '          ␣T topics docked above the inbox · ↵ in a panel opens the row in the centre',
  'Plan      gp epic plan · a approve · d discuss with the Lead · e edit plan',
  'Centre    ␣g General · ␣L Agents log · ␣b board · ␣G graph · ␣N inbox full width · ␣E events · ␣␣ the previous centre view',
  'Explorer  ␣e · :Cland explorer [id] · j k item rows (counts) · l h fold · s scope · ␣␣ back',
  '          za/zo/zc toggle/open/close · zR zM all · D done · A archive',
  'Graph     h/j/k/l nodes · ^/$ ends · ↵ item · gi/gt/gs · p/P parent · d done · o turn · r edges · :Cland graph [T-n]',
  'Agents    ␣L the log: lifecycle events and agent-to-agent messages · r on a message replies to its sender',
  'Motions   gi its item · gt its topic · gs its session (a reference under the cursor wins)',
  'Palette   ␣p actions · items · sessions · artifacts · topics (type to filter; ↵ runs or opens)',
  '          > actions · # items · @ sessions · ~ artifacts · / topics; Tab kind · C-v split · Esc close',
  'Composer  Enter sends · Shift+Enter or Alt+Enter newline · ␣c focuses it · ␣P drafts a prompt · @role or @name pulls others in',
  'Topics    ␣t panel: n new · c close · r resolve · ↵ open · ␣r resolve this thread · gi its item',
  'Inbox     ␣n panel, ␣N full width: 1-9 answer an ask · i free · r reply · ↵ open or attach · d decline/read · A archive',
  '          za more · A seven-day archive · e events (or ↵ on the events line)',
  'Events    1-8 kinds · 0 all · w warnings · s subject · F clear · gM mute · A older · za day fold',
  '          :Cland topic new <title> | close | resolve',
  'Session   ↵ attaches in Terminal mode · C-h/j/k/l focus · C-\\ leaves (C-\\ C-n too)',
  '          ␣l (panel l) launches · ␣A (panel a) launches an Aide, ready for its brief',
  'Artifacts ␣a on ~ · ga browser · ↵ open/fold · n new · m move · s attach · p promote · k keep · d archive · x delete (confirm)',
  '          za/zo/zc folds · zR background · A archive · :w saves files · q back · R render Mermaid',
  'Prompts   :Cland prompt [title] · :w saves · :Cland prompt send|attach · ␣ps sends · ␣pa attaches',
  'Sessions  ␣l launch · ↵ attach · C-v split · l launch · x stop · c capabilities',
  '          d archive · A show/hide archive · r Resume session · f Launch session fresh with its brief (when offered) · n or Esc cancel',
  'Verify    ↵ on verify: opens the verification queue · palette: Open verification queue · q Previous centre view',
  'Presets   :Cland preset charting | watch | steady (examples, never modes)',
  'Views     :Cland view thread <topic> | session <name> | item <id> | plan <epic> | board | log | inbox',
  '',
  'q or Esc closes this',
}

function M.help()
  local buf = api.nvim_create_buf(false, true)
  local lines = vim.tbl_map(function(l)
    return ' ' .. l
  end, M.HELP)
  for _, action in ipairs(require('cland.actions').all()) do
    if action.id == 'items:<CR>' then
      table.insert(lines, 6, ' Items     ' .. action.key .. ' · ' .. action.title)
    elseif action.id == 'global:<leader>e' then
      for r, line in ipairs(lines) do
        if line:match('^ Explorer ') then
          lines[r] = ' Explorer  ' .. action.key .. ' · ' .. action.title .. ' · :Cland explorer [id] · j k item rows (counts) · l h fold · s scope · ␣␣ back'
        end
      end
    end
  end
  api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].modifiable = false
  vim.b[buf].cland_role = 'help'
  local width = 0
  for _, l in ipairs(lines) do
    width = math.max(width, api.nvim_strwidth(l) + 2)
  end
  width = math.min(width, vim.o.columns - 4)
  local win = api.nvim_open_win(buf, true, {
    relative = 'editor', row = 2, col = math.floor((vim.o.columns - width) / 2), width = width, height = #lines,
    border = 'rounded', style = 'minimal', zindex = 90, title = ' keys ', title_pos = 'center',
  })
  vim.wo[win].winbar = ''
  for _, k in ipairs({ 'q', '<Esc>' }) do
    require('cland.actions').map('n', k, function()
      pcall(api.nvim_win_close, win, true)
    end, { buffer = buf, nowait = true })
  end
end

local function keymaps()
  require('cland.keys').setup()
  local layout = require('cland.layout')
  local motions = require('cland.motions')
  local palette = require('cland.palette')
  local function map(lhs, rhs, desc)
    require('cland.actions').map('n', lhs, rhs, { desc = 'cland: ' .. desc, silent = true })
  end
  map('<leader>i', layout.toggle_left, 'items panel')
  map('<leader>n', function()
    layout.right_panel('inbox')
  end, 'inbox panel')
  map('<leader>s', function()
    layout.right_panel('sessions')
  end, 'sessions panel')
  map('<leader>t', function()
    layout.right_panel('topics')
  end, 'topics panel')
  map('<leader>T', layout.toggle_dock, 'topics docked above the inbox')
  map('<leader>E', function() require('cland.layout').show({ kind = 'events' }, { insert = false }) end, 'Events view')
  map('<leader>N', function()
    layout.toggle_view({ kind = 'inbox' })
  end, 'inbox full width')
  map('<leader>b', function()
    layout.toggle_view({ kind = 'board' })
  end, 'board')
  map('<leader>e', function() require('cland.explorer').open() end, 'explorer')
  map('<leader>G', function() require('cland.graph').open() end, 'experimental graph')
  -- ␣a is the artifacts picker; the Agents log is ␣L
  map('<leader>a', function()
    require('cland.palette').open({ query = '~' })
  end, 'artifacts picker')
  map('<leader>L', function()
    layout.toggle_view({ kind = 'log' })
  end, 'the Agents log')
  map('<leader>g', function()
    layout.show({ kind = 'thread', id = 'general' })
  end, 'General')
  map('<leader>c', function()
    local v = state.S.ui.view
    layout.show({ kind = 'thread', id = v.kind == 'thread' and v.id or 'general' })
  end, 'composer')
  map('<leader>P', function() require('cland.artifacts').prompt() end, 'draft prompt')
  map('<leader>p', function()
    palette.open()
  end, 'picker')
  map('<leader>l', function()
    require('cland.launcher').open()
  end, 'launch a session')
  map('<leader>A', function()
    require('cland.launcher').aide()
  end, 'launch an Aide')
  map('<leader><leader>', layout.back, 'previous centre view')
  map('<leader>r', function()
    require('cland.views').resolve_topic()
  end, 'resolve the topic')
  map('<leader>?', M.help, 'keys')
  map('gp', function() require('cland.plan').open() end, 'its epic plan')
  map('gi', function()
    motions.go('item')
  end, 'its item')
  map('gt', function()
    motions.go('topic')
  end, 'its topic')
  map('gs', function()
    motions.go('session')
  end, 'its session')
end

local function commands()
  local actions = require('cland.actions')
  api.nvim_create_user_command('Cland', function(o) actions.dispatch(o.fargs) end,
    {nargs='*', complete=actions.complete})
end

local function autocmds()
  local layout = require('cland.layout')
  local bars = require('cland.bars')
  local group = api.nvim_create_augroup('cland', { clear = true })
  api.nvim_create_autocmd({ 'ModeChanged', 'WinEnter', 'BufWinEnter', 'TermEnter', 'TermLeave' }, {
    group = group,
    callback = bars.redraw,
  })
  api.nvim_create_autocmd('VimResized', {
    group = group,
    callback = function()
      layout.screen_resized()
      state.changed()
    end,
  })
  api.nvim_create_autocmd('WinResized', { group = group, callback = layout.resized })
  api.nvim_create_autocmd('WinClosed', {
    group = group,
    callback = function(ev)
      -- a Vim session being sourced (after :restart) closes windows the shell then builds again
      if vim.g.SessionLoad == 1 then
        return
      end
      local win = tonumber(ev.match)
      layout.closing(win)
      vim.schedule(function()
        layout.on_win_closed(win)
      end)
    end,
  })
  api.nvim_create_autocmd('TermOpen', {
    group = group,
    callback = function()
      vim.wo.number = false
      vim.wo.signcolumn = 'no'
    end,
  })
  -- :restart: the layout and the attached sessions go to a file; the new instance attaches again
  api.nvim_create_autocmd('ExitPre', {
    group = group,
    callback = function()
      if vim.v.exitreason == 'restart' then
        local snap = state.snapshot()
        snap.splits = layout.split_sessions()
        require('cland.restart').save(snap)
      end
    end,
  })
  -- :restart sources a saved Vim session after the shell started: build the shell again over it
  api.nvim_create_autocmd('SessionLoadPost', {
    group = group,
    callback = function()
      vim.schedule(function()
        layout.build({ insert = false })
        state.changed()
      end)
    end,
  })
  api.nvim_create_autocmd('VimLeavePre', {
    group = group,
    callback = function()
      layout.flush_resize()
      require('cland.ui').changed()
      require('cland.ui').flush()
      M.client:stop()
    end,
  })
end

--- Apply a snapshot from before a restart: the layout, then the attach commands again.
local function restore(snap)
  local ui = state.S.ui
  if snap.view and snap.view.kind then
    ui.view = snap.view
  end
  ui.hist = snap.hist or {}
  ui.left, ui.right, ui.dock = snap.left or false, snap.right, snap.dock or false
  M.restored = snap
end

local function reattach(snap)
  local sessions = require('cland.sessions')
  local split = {}
  -- the C-v splits come back as splits beside the centre, the focus left where the restore put it
  for _, name in ipairs(snap.splits or {}) do
    if not split[name] then
      split[name] = true
      require('cland.layout').show_split({ kind = 'session', id = name }, { focus = false })
    end
  end
  for _, name in ipairs(snap.attached or {}) do
    if not split[name] and not (state.S.ui.view.kind == 'session' and state.S.ui.view.id == name) then
      sessions.reattach(name)
    end
  end
end

--- opts: root (a directory inside the project; default the cwd), transport ('socket' | 'stdio'),
--- restore (read a restart snapshot even without v:startreason "restart"). A QA run also gives cli (the
--- `cland` command as a list, instead of CLAND_COMMAND or this repository's) and serve_args (for the stdio hub).
function M.start(opts)
  opts = opts or {}
  local start = opts.root and opts.root ~= '' and opts.root or vim.fn.getcwd()
  -- the project root as the hub finds it: the nearest ancestor holding .git or .cland
  local root = vim.fs.root(start, { '.git', '.cland' }) or vim.fn.fnamemodify(start, ':p'):gsub('/$', '')
  local _, repo = dirs()
  local transport = opts.transport and opts.transport ~= '' and opts.transport or 'socket'

  require('cland.hl').setup()
  require('cland.bars').setup()
  state.reset({ root = root })
  require('cland.events').reset(true)
  state.S.ui.right = 'sessions'
  require('cland.ui').load(root)
  M.root = root
  -- notices go to the status line, one line, never the message area (no hit-enter prompt)
  vim.notify = function(msg, level)
    state.say(msg, level and level >= vim.log.levels.WARN and 'ClandAmberBar' or 'ClandDimBar')
  end

  M.client = hub.new({ root = root, transport = transport, cli = opts.cli or cli_command(repo), serve_args = opts.serve_args })
  wire_client(M.client)
  require('cland.views').setup(M.client)
  require('cland.verification').start_clock()
  require('cland.sessions').setup(M.client)
  require('cland.item_view').setup(M.client)
  require('cland.plan').setup(M.client)
  -- General's history and events are wired before the client starts
  require('cland.views').topic('general')

  local layout = require('cland.layout')
  state.on_change(function()
    layout.render()
    require('cland.ui').changed()
    require('cland.bars').redraw()
  end)
  vim.g.mapleader = ' '
  keymaps()
  commands()
  autocmds()

  local snap
  if (vim.v.startreason or ''):match('^restart') or opts.restore then
    snap = require('cland.restart').take(root)
    if snap then
      restore(snap)
    end
  end
  layout.build({ insert = not (snap and state.S.ui.view.kind ~= 'thread') })
  if snap then
    M.client:on('connected', function()
      if not M.reattached then
        M.reattached = true
        reattach(snap)
      end
    end)
  end

  M.client:start()
  state.changed()
  return M
end

return M
