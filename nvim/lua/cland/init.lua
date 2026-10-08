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

M.REFRESH_MS = tonumber(vim.env.CLAND_REFRESH_MS or '') or 5000
M.ITEMS_REFRESH_MS = math.min(1000, M.REFRESH_MS)

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
  M.client:request({ type = 'topic.list' }, function(err, value)
    if not err and value and value.topics then
      state.S.topics = value.topics
      state.changed()
    end
  end)
end

local function refresh_sessions()
  M.client:request({ type = 'session.list' }, function(err, value)
    if not err and value then
      state.S.processes = value.processes or {}
      state.S.adapters = value.adapters or {}
      state.changed()
    end
  end)
  M.client:request({ type = 'hub.status' }, function(err, value)
    if not err and value then
      state.S.presence = value.sessions or {}
      if value.coordinator ~= nil then
        state.S.hub_coordinator = { name = value.coordinator ~= vim.NIL and value.coordinator or nil }
      end
      state.changed()
    end
  end)
  -- the roles and their launch defaults: the launcher's prefill and the labels
  M.client:request({ type = 'role.list' }, function(err, value)
    if not err and value and value.roles then
      state.S.roles = value.roles
      state.changed()
    end
  end)
end

M.refresh_sessions = refresh_sessions

local function refresh_items()
  M.client:request({ type = 'task.list' }, function(err, value)
    if err then
      state.S.items, state.S.items_note = {}, 'no items: ' .. tostring(err)
    else
      state.S.items, state.S.items_note = value and value.items or {}, nil
    end
    state.changed()
  end)
end

function M.refresh()
  if not M.client:connected() then
    return
  end
  refresh_topics()
  refresh_sessions()
  refresh_items()
end

local function wire_client(client)
  client:on('state', function(st, detail)
    state.S.hub = { state = st, detail = detail }
    state.changed()
  end)
  client:on('connected', M.refresh)
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
    require('cland.items').apply_event(event)
    if event.id then
      require('cland.item_view').invalidate(event.id)
    end
  end)
  -- the Coordinator's vacancy (#29): the top bar's chip follows the hub's events at once
  client:on('role.vacant', function()
    state.S.hub_coordinator = { name = nil }
    state.changed()
    refresh_sessions()
  end)
  client:on('role.filled', function(event)
    state.S.hub_coordinator = { name = event.session }
    state.changed()
    refresh_sessions()
  end)
  client:on('session.role', function()
    refresh_sessions()
  end)
  client:on('session.state', function(event)
    if not state.set_session_state(event.session, event.state) then
      refresh_sessions()
    end
  end)
end

-- Keys and commands ---------------------------------------------------------------------------------------

M.HELP = {
  'cland workbench · Space is the leader (␣)',
  '',
  'Panels    ␣i items (left) · ␣n inbox · ␣s sessions · ␣t topics (right; the active key hides it)',
  'Items     1 all · 2 in work · 3 needs you · 4 done · 5 map (f / F cycle) · ↵ the item view · e edits its file',
  '          ␣T topics docked above the inbox · ↵ in a panel opens the row in the centre',
  'Centre    ␣g General · ␣b board · ␣N inbox full width · ␣␣ the previous centre view',
  'Motions   gi its item · gt its topic · gs its session (a reference under the cursor wins)',
  'Pick      ␣p items · topics · sessions (Tab switches the kind, type to filter, ↵ opens, Esc closes)',
  'Composer  Enter sends · Shift+Enter or Alt+Enter newline · ␣c focuses it · @role or @name pulls others in',
  'Topics    ␣t panel: n new · c close · r resolve · ↵ open · ␣r resolve this thread · gi its item',
  '          :Cland topic new <title> | close | resolve',
  'Session   ↵ attaches in Terminal mode: keys go to the session, C-\\ C-n leaves',
  'Sessions  ␣l launch · in the panel: ↵ attach · C-v attach in a split · l launch · x stop · c capabilities',
  'Presets   :Cland preset charting | watch | steady (examples, never modes)',
  'Views     :Cland view thread <topic> | session <name> | item <id> | board | log | inbox',
  '',
  'q or Esc closes this',
}

function M.help()
  local buf = api.nvim_create_buf(false, true)
  local lines = vim.tbl_map(function(l)
    return ' ' .. l
  end, M.HELP)
  api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].modifiable = false
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
    vim.keymap.set('n', k, function()
      pcall(api.nvim_win_close, win, true)
    end, { buffer = buf, nowait = true })
  end
end

local function keymaps()
  local layout = require('cland.layout')
  local motions = require('cland.motions')
  local picker = require('cland.picker')
  local function map(lhs, rhs, desc)
    vim.keymap.set('n', lhs, rhs, { desc = 'cland: ' .. desc, silent = true })
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
  map('<leader>N', function()
    layout.toggle_view({ kind = 'inbox' })
  end, 'inbox full width')
  map('<leader>b', function()
    layout.toggle_view({ kind = 'board' })
  end, 'board')
  map('<leader>g', function()
    layout.show({ kind = 'thread', id = 'general' })
  end, 'General')
  map('<leader>c', function()
    local v = state.S.ui.view
    layout.show({ kind = 'thread', id = v.kind == 'thread' and v.id or 'general' })
  end, 'composer')
  map('<leader>p', function()
    picker.open()
  end, 'picker')
  map('<leader>l', function()
    require('cland.launcher').open()
  end, 'launch a session')
  map('<leader><leader>', layout.back, 'previous centre view')
  map('<leader>r', function()
    require('cland.views').resolve_topic()
  end, 'resolve the topic')
  map('<leader>?', M.help, 'keys')
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
  local layout = require('cland.layout')
  api.nvim_create_user_command('Cland', function(o)
    local sub, a = o.fargs[1], o.fargs[2]
    if sub == 'preset' then
      layout.preset(a)
    elseif sub == 'view' and a then
      local id = o.fargs[3]
      if a == 'thread' and not id then
        id = 'general'
      end
      layout.show({ kind = a, id = id }, { insert = a == 'session' })
    elseif sub == 'panel' and a then
      if a == 'items' then
        layout.toggle_left()
      elseif a == 'dock' then
        layout.toggle_dock()
      else
        layout.right_panel(a)
      end
    elseif sub == 'topic' then
      local views = require('cland.views')
      if a == 'new' then
        views.create_topic(table.concat(vim.list_slice(o.fargs, 3), ' '))
      elseif a == 'close' then
        views.close_topic(o.fargs[3])
      elseif a == 'resolve' then
        views.resolve_topic(o.fargs[3])
      else
        state.say(':Cland topic new <title> | close [id] | resolve [id]', 'ClandRedBar')
      end
    elseif sub == 'refresh' then
      M.refresh()
    elseif sub == 'launch' then
      require('cland.launcher').open({ name = a })
    elseif sub == 'help' or not sub then
      M.help()
    else
      state.say(':Cland preset <name> | view <kind> [id] | panel <kind> | launch [name] | topic new|close|resolve | refresh | help', 'ClandRedBar')
    end
  end, {
    nargs = '*',
    complete = function(_, line)
      local words = vim.split(line, '%s+', { trimempty = true })
      if #words <= 1 or (#words == 2 and not line:match('%s$')) then
        return { 'preset', 'view', 'panel', 'launch', 'topic', 'refresh', 'help' }
      end
      local sub = words[2]
      if sub == 'preset' then
        return { 'charting', 'watch', 'steady' }
      elseif sub == 'view' then
        return { 'thread', 'session', 'item', 'board', 'log', 'inbox' }
      elseif sub == 'panel' then
        return { 'items', 'inbox', 'sessions', 'topics', 'dock' }
      elseif sub == 'topic' then
        return { 'new', 'close', 'resolve' }
      end
      return {}
    end,
  })
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
      layout.fix()
      state.changed()
    end,
  })
  api.nvim_create_autocmd('WinResized', { group = group, callback = state.changed })
  api.nvim_create_autocmd('WinClosed', {
    group = group,
    callback = function(ev)
      -- a Vim session being sourced (after :restart) closes windows the shell then builds again
      if vim.g.SessionLoad == 1 then
        return
      end
      local win = tonumber(ev.match)
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
        require('cland.restart').save(state.snapshot())
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
  for _, name in ipairs(snap.attached or {}) do
    if not (state.S.ui.view.kind == 'session' and state.S.ui.view.id == name) then
      sessions.reattach(name)
    end
  end
end

--- opts: root (a directory inside the project; default the cwd), transport ('socket' | 'stdio'),
--- restore (read a restart snapshot even without v:startreason "restart").
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
  state.S.ui.right = 'sessions'
  M.root = root
  -- notices go to the status line, one line, never the message area (no hit-enter prompt)
  vim.notify = function(msg, level)
    state.say(msg, level and level >= vim.log.levels.WARN and 'ClandAmberBar' or 'ClandDimBar')
  end

  M.client = hub.new({ root = root, transport = transport, cli = cli_command(repo) })
  wire_client(M.client)
  require('cland.views').setup(M.client)
  require('cland.sessions').setup(M.client)
  require('cland.item_view').setup(M.client)
  -- General's history and events are wired before the client starts
  require('cland.views').topic('general')

  local layout = require('cland.layout')
  state.on_change(function()
    layout.render()
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

  M.timer = vim.uv.new_timer()
  M.timer:start(M.REFRESH_MS, M.REFRESH_MS, vim.schedule_wrap(function()
    if M.client:connected() then
      refresh_sessions()
      refresh_items()
    end
  end))
  -- while the items are on screen (the panel, the board, an item view) they refresh at least each second,
  -- besides the `task` events
  M.items_timer = vim.uv.new_timer()
  M.items_timer:start(M.ITEMS_REFRESH_MS, M.ITEMS_REFRESH_MS, vim.schedule_wrap(function()
    if M.client:connected() and require('cland.items').visible() then
      refresh_items()
    end
  end))
  M.client:start()
  state.changed()
  return M
end

return M
