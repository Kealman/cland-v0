-- PROTOTYPE (ticket #15): the chat-screen prototype on top of the engine
-- prototype (#11). Global keys, commands, highlights, the statusline and
-- winbar dispatch, :ClandState, :ClandSim and the render loop. Each variant
-- (lua/cland_proto/variants/*.lua) owns its own layout.
local api = vim.api
local state = require('cland_proto.state')
local chat = require('cland_proto.chat')
local sessions = require('cland_proto.sessions')
local switcher = require('cland_proto.switcher')

local M = {}

local BAR_BG = '#262a33'

function M.highlights()
  local function set(name, val)
    api.nvim_set_hl(0, name, val)
  end
  set('ClandWaitYou', { fg = '#ff6b6b', bold = true })
  set('ClandWaitAgent', { fg = '#56ccf2' })
  set('ClandWaitApproval', { fg = '#f2c94c', bold = true })
  set('ClandBusy', { fg = '#56ccf2' })
  set('ClandIdle', { fg = '#6fcf97' })
  set('ClandOpen', { fg = '#6fcf97' })
  set('ClandClosed', { fg = '#828282' })
  set('ClandReadOnly', { fg = '#9b9bd1' })
  set('ClandDim', { fg = '#7c8391' })
  set('ClandSel', { bg = '#2d3340' })
  set('ClandGroup', { fg = '#9aa0aa', bold = true })
  set('ClandGroupYou', { fg = '#ff6b6b', bold = true })
  set('ClandUnread', { fg = '#111111', bg = '#56ccf2', bold = true })
  set('ClandBadgeC', { fg = '#111111', bg = '#bb86fc', bold = true })
  set('ClandBadgeI', { fg = '#111111', bg = '#6fcf97', bold = true })
  set('ClandBadgeR', { fg = '#111111', bg = '#f2994a', bold = true })
  set('ClandBadgeQ', { fg = '#111111', bg = '#56ccf2', bold = true })
  set('ClandBadgeH', { fg = '#111111', bg = '#e0e0e0', bold = true })
  set('ClandBadgeS', { fg = '#dddddd', bg = '#4a4f5b' })
  set('ClandRoleCoord', { fg = '#bb86fc', bold = true })
  set('ClandRoleReview', { fg = '#f2994a', bold = true })
  set('ClandRoleQA', { fg = '#56ccf2', bold = true })
  set('ClandRoleImpl', { fg = '#6fcf97', bold = true })
  set('ClandRoleHuman', { fg = '#ffffff', bold = true })
  set('ClandStageQueued', { fg = '#f2c94c' })
  set('ClandStageDelivered', { fg = '#56ccf2' })
  set('ClandStageInjected', { fg = '#6fcf97' })
  set('ClandStagePending', { fg = '#555b66' })
  set('ClandArtifact', { fg = '#f2c94c', underline = true })
  set('ClandItem', { fg = '#c3a6ff' })
  set('ClandMention', { fg = '#56ccf2', bold = true })
  set('ClandEvent', { fg = '#9b9bd1', bold = true })
  set('ClandAskTitle', { fg = '#f2c94c', bold = true })
  set('ClandAskQuestion', { fg = '#ffffff', bold = true })
  set('ClandAskKey', { fg = '#111111', bg = '#f2c94c', bold = true })
  set('ClandBrand', { fg = '#111111', bg = '#bb86fc', bold = true })
  set('ClandBar', { fg = '#dddddd', bg = '#3a3f4b' })
  set('ClandBarFocus', { fg = '#111111', bg = '#f2c94c', bold = true })
  set('ClandPill', { fg = '#ffffff', bg = '#d6336c', bold = true })
  set('ClandWarn', { fg = '#111111', bg = '#ff6b6b', bold = true })
  set('ClandPickSel', { bg = '#3a3f4b', bold = true })
  set('ClandPickMatch', { fg = '#f2c94c', bold = true })
  set('ClandQueueSel', { bg = '#2d3340' })
  set('StatusLine', { fg = '#dddddd', bg = BAR_BG })
  set('StatusLineNC', { fg = '#9aa0aa', bg = BAR_BG })
  set('WinBar', { fg = '#dddddd', bg = '#1e2129', bold = true })
  set('WinBarNC', { fg = '#9aa0aa', bg = '#1e2129' })
  set('TabLine', { fg = '#9aa0aa', bg = BAR_BG })
  set('TabLineSel', { fg = '#ffffff', bg = '#3a3f4b', bold = true })
  set('TabLineFill', { fg = '#9aa0aa', bg = '#1b1e24' })
  set('WinSeparator', { fg = '#3a3f4b' })
  -- fg-only groups get a "<name>Bar" twin with the bar background
  for _, name in ipairs({ 'ClandWaitYou', 'ClandWaitAgent', 'ClandWaitApproval', 'ClandBusy', 'ClandIdle', 'ClandOpen',
    'ClandClosed', 'ClandReadOnly', 'ClandDim', 'ClandStageQueued', 'ClandStageDelivered', 'ClandStageInjected',
    'ClandStagePending', 'ClandItem', 'ClandAskTitle', 'ClandRoleCoord', 'ClandRoleImpl', 'ClandRoleReview', 'ClandRoleQA' }) do
    local h = api.nvim_get_hl(0, { name = name })
    h.bg = BAR_BG
    set(name .. 'Bar', h)
    -- and a "<name>Sel" twin for the selected tab of variant D
    local s = api.nvim_get_hl(0, { name = name })
    s.bg = '#3a3f4b'
    set(name .. 'Sel', s)
  end
end

-- {text, hl} chunks -> statusline string
function M.stl(chunks)
  local out = {}
  for _, c in ipairs(chunks) do
    out[#out + 1] = '%#' .. (c[2] or 'StatusLine') .. '#' .. tostring(c[1]):gsub('%%', '%%%%')
  end
  return table.concat(out) .. '%#StatusLine#'
end

function M.mode_label()
  local m = api.nvim_get_mode().mode
  return ({ t = 'TERMINAL', nt = 'NORMAL', i = 'INSERT', n = 'NORMAL', c = 'CMD', v = 'VISUAL', V = 'V-LINE' })[m] or m
end

function M.focus_label()
  local buf = api.nvim_get_current_buf()
  local role = vim.b[buf].cland_role
  if role == 'session' then
    return 'session ' .. (vim.b[buf].cland_session or '?')
  end
  return role or vim.bo[buf].buftype
end

-- Common left part of a statusline: brand, focus, mode.
function M.stl_left()
  return {
    { ' cland ', 'ClandBrand' },
    { ' ' .. M.focus_label() .. ' ', 'ClandBar' },
    { ' ' .. M.mode_label() .. ' ', 'ClandDimBar' },
  }
end

function _G.ClandStatus()
  local ok, res = pcall(function()
    local v = switcher.mod()
    local left, right = v.statusline()
    return M.stl(left) .. '%=' .. M.stl(right or {})
  end)
  return ok and res or (' cland statusline error: ' .. tostring(res):gsub('%%', '%%%%'))
end

-- Winbars: the variant may answer first, otherwise by buffer role.
function M.winbar_default(win, buf, role)
  local focused = win == api.nvim_get_current_win()
  local lab = function(s)
    return '%#' .. (focused and 'ClandBarFocus' or 'ClandBar') .. '# ' .. s .. ' %* '
  end
  if role == 'thread' then
    local t = state.topic(vim.b[buf].cland_topic)
    local st = chat.status(t)
    local s = lab('THREAD') .. '%<%#' .. st.hl .. '#' .. st.icon .. ' ' .. st.label .. '%*  ' .. t.title:gsub('%%', '%%%%')
    if t.item then
      s = s .. '  %#ClandItem#' .. t.item .. '%*'
    elseif t.standing then
      s = s .. '  %#ClandDim#standing topic%*'
    end
    return s
  elseif role == 'composer' then
    local id = vim.b[buf].cland_topic
    local t = state.topic(id)
    if chat.answering[id] then
      return lab('ANSWER') .. '%#ClandAskTitle#↳ free answer to the ask%*  Enter sends · C-c cancels'
    end
    local to = chat.addressee(t, '')
    local s = to and sessions.label(state.session(to)) or 'Coordinator (vacant: the hub queues it)'
    return lab(t.readonly and 'REPLY' or 'COMPOSE') .. '%<→ ' .. s:gsub('%%', '%%%%')
      .. '  %#ClandDim#Enter send · Shift+Enter newline · @impl-1 / @reviewer address others%*'
  elseif role == 'session' then
    local s = state.session(vim.b[buf].cland_session)
    if not s then
      return lab('SESSION')
    end
    local st = sessions.st(s)
    return lab('SESSION ' .. s.name) .. '%<' .. s.role .. ' · ' .. s.harness .. ' · ' .. s.model .. '  %#' .. st.hl .. '#'
      .. st.icon .. ' ' .. s.state .. '%*  ' .. (s.item and ('%#ClandItem#' .. s.item .. '%*') or '')
      .. '  %#ClandDim#stand-in · i types · C-\\ C-n leaves%*'
  end
  return ''
end

function _G.ClandWinbar()
  local ok, res = pcall(function()
    local win = vim.g.statusline_winid
    local buf = api.nvim_win_get_buf(win)
    local role = vim.b[buf].cland_role
    local v = switcher.mod()
    local s = v.winbar and v.winbar(win, buf, role)
    return s or M.winbar_default(win, buf, role)
  end)
  return ok and res or (' winbar error: ' .. tostring(res):gsub('%%', '%%%%'))
end

function _G.ClandTabline()
  local ok, res = pcall(function()
    local v = switcher.mod()
    return v.tabline and v.tabline() or ''
  end)
  return ok and res or (' tabline error: ' .. tostring(res):gsub('%%', '%%%%'))
end

-- Re-render everything after a state change.
function M.render()
  chat.render_all()
  local v = switcher.current and switcher.mod()
  if v and v.render then
    v.render()
  end
  switcher.place_pill()
  pcall(vim.cmd, 'redrawstatus!')
  pcall(vim.cmd, 'redrawtabline')
end

-- Generic dispatch to the current variant ------------------------------------

function M.open_topic(id)
  local v = switcher.mod()
  v.open_topic(id)
end

function M.open_session(name)
  local v = switcher.mod()
  v.open_session(name)
end

-- Focus the composer of topic `id` (the variant decides where it lives).
function M.focus_composer(id, prefill, insert)
  id = id or state.S.current_topic
  local v = switcher.mod()
  local win = v.composer_win and v.composer_win(id)
  if not (win and api.nvim_win_is_valid(win)) then
    return
  end
  api.nvim_win_set_buf(win, chat.composer(id))
  api.nvim_set_current_win(win)
  vim.schedule(function()
    if api.nvim_get_current_win() ~= win then
      return
    end
    if prefill or insert ~= false then
      vim.cmd('startinsert!')
    end
    if prefill then
      api.nvim_feedkeys(prefill, 'n', false)
    end
  end)
end

function M.jump_ask()
  local a = state.open_asks()[1]
  if not a then
    vim.notify('cland-proto: no open ask', vim.log.levels.INFO)
    return
  end
  local v = switcher.mod()
  if v.jump_ask then
    v.jump_ask(a)
    return
  end
  v.open_topic(a.topic)
  local buf = chat.thread_buf(a.topic)
  local win = vim.fn.win_findbuf(buf)[1]
  if not win then
    return
  end
  api.nvim_set_current_win(win)
  -- after the re-render that open_topic scheduled (it recomputes the padding)
  vim.schedule(function()
    local row = chat.find_row(buf, function(inf)
      return inf.header and inf.ask == a.id
    end)
    if row and api.nvim_win_is_valid(win) and api.nvim_win_get_buf(win) == buf then
      api.nvim_win_set_cursor(win, { row, 0 })
    end
  end)
end

-- Pickers --------------------------------------------------------------------

function M.topic_picker()
  local items = {}
  for _, t in ipairs(state.sorted_topics()) do
    local st = chat.status(t)
    local unread = (t.unread or 0) > 0 and ('  ' .. t.unread .. ' new') or ''
    local text = ('%s %-22s %s%s'):format(st.icon, st.label, chat.label(t), unread)
    items[#items + 1] = {
      text = text, value = t.id,
      hl = { { 0, #st.icon, st.hl }, { #st.icon + 1, #st.icon + 23, 'ClandDim' }, unread ~= '' and { #text - #unread, #text, 'ClandUnread' } or nil },
    }
  end
  require('cland_proto.picker').open({ title = 'Topics', items = items, on_choose = M.open_topic })
end

function M.session_picker()
  local items = {}
  for _, s in ipairs(state.S.sessions) do
    local role, st = sessions.ROLE[s.role], sessions.st(s)
    local text = ('%s  %-9s %-12s %-12s %-12s %s %-21s %s'):format(role.badge, s.name, s.role, s.harness, s.model, st.icon,
      s.state, s.item or '-')
    items[#items + 1] = { text = text, value = s.name, hl = { { 0, #role.badge, role.fg } } }
  end
  require('cland_proto.picker').open({ title = 'Sessions', items = items, on_choose = M.open_session, width = 96 })
end

-- Floats for help and state ----------------------------------------------------

function M.text_float(title, lines, ft)
  local buf = api.nvim_create_buf(false, true)
  lines = vim.tbl_map(function(l)
    return ' ' .. l
  end, lines)
  api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].modifiable = false
  if ft then
    vim.bo[buf].filetype = ft
  end
  local width = 20
  for _, l in ipairs(lines) do
    width = math.max(width, vim.fn.strdisplaywidth(l) + 2)
  end
  width = math.min(width, vim.o.columns - 4)
  local height = math.min(#lines, vim.o.lines - 6)
  local win = api.nvim_open_win(buf, true, {
    relative = 'editor', row = math.floor((vim.o.lines - height) / 2) - 1, col = math.floor((vim.o.columns - width) / 2),
    width = width, height = height, border = 'rounded', style = 'minimal', zindex = 90,
    title = { { ' ' .. title .. ' ', 'ClandAskTitle' } }, title_pos = 'center',
    footer = { { ' q closes ', 'ClandDim' } }, footer_pos = 'center',
  })
  vim.wo[win].winbar = ''
  for _, k in ipairs({ 'q', '<Esc>' }) do
    vim.keymap.set('n', k, function()
      pcall(api.nvim_win_close, win, true)
    end, { buffer = buf, nowait = true })
  end
  return win, buf
end

local HELP = {
  'Global (Space is <leader>)',
  '  <Space>v / <C-\\>v  next variant          <Space>V  previous variant',
  '  :ClandVariant slack|inbox|session|tabs   (or A, B, C, D)',
  '  <Space>t  topics picker                  <Space>s  sessions picker',
  '  <Space>c / <C-\\>c  composer              <Space>a  the open ask',
  '  <Space>x  simulate the next event        :ClandSim reply|ask|approval|vacant',
  '  :ClandState  the fake state (q closes)   <Space>?  this help',
  '',
  'In a thread         1-3 answer the open ask · 4 own answer · <CR> or gf opens A-7 / A-9',
  '                    r replies to the sender of the message under the cursor',
  'In a composer       Enter sends · Shift+Enter (or Alt+Enter) newline · @impl-1, @reviewer…',
  '                    Esc leaves Insert mode · i / A start typing again',
  'In a terminal       C-\\ C-n leaves Terminal mode; the session is a stand-in ($SHELL)',
}

function M.help()
  local v = switcher.mod()
  local info = switcher.info()
  local lines = { ('Variant %s · %s: %s'):format(info.key, info.name, v.tagline or ''), '' }
  vim.list_extend(lines, v.help or {})
  lines[#lines + 1] = ''
  vim.list_extend(lines, HELP)
  M.text_float('cland chat-screen prototype (#15) keys', lines)
end

function M.show_state(arg)
  if arg == 'json' then
    M.text_float('ClandState json', vim.split(vim.json.encode(state.plain()), '\n'), 'json')
  else
    M.text_float('ClandState', state.dump_lines())
  end
end

-- Simulated events (to watch where each layout puts a new signal) ---------------

M.SIM_ORDER = { 'reply', 'ask', 'approval', 'vacant' }
M.SIM = {
  -- the Coordinator answers the message in T-15 that waited for it
  reply = function()
    local t = state.topic('t15')
    local m = state.last_human_message(t)
    if m and m.stage ~= 'injected' then
      m.stage = 'injected'
    end
    t.messages[#t.messages + 1] = { kind = 'text', from = 'coord', role = 'Coordinator', at = state.now_min(), text = {
      'A timer is fine for v0 if the adapter reports it as "heuristic". impl-1: key it on',
      'permission.updated first and keep the 20 s timer as the fallback.',
    } }
    chat.recompute(t, 'replied')
    if state.S.current_topic ~= 't15' then
      t.unread = (t.unread or 0) + 1
    end
    return 'coord replied in T-15'
  end,
  -- the Coordinator opens a new (unbound) topic with an ask
  ask = function()
    local n = #state.S.asks + 1
    local asks = {
      { title = 'Implementer model', question = "impl-1's free model keeps hitting its quota. What should impl-1 run on?",
        options = {
          { label = 'Keep the free model and accept the retries', short = 'keep free' },
          { label = 'Switch impl-1 to a paid model for T-15 only', short = 'paid for T-15' },
          { label = 'Pause impl-1 until the quota resets', short = 'pause' },
        } },
      { title = 'QA lane for the UI', question = 'Which lane should qa-1 use for the chat screen?',
        options = {
          { label = 'Headless Neovim driven by nvim_input', short = 'headless nvim' },
          { label = 'tmux with capture-pane', short = 'tmux' },
          { label = 'ttyd in Chrome', short = 'ttyd' },
        } },
    }
    local spec = asks[(n % #asks) + 1]
    local id = 'sim' .. n
    local t = { id = id, title = spec.title .. (n > 3 and (' #' .. n) or ''), status = 'waiting for human', unread = 1,
      created_by = 'coord', messages = {} }
    local a = { id = n, topic = id, from = 'coord', role = 'Coordinator', at = state.now_min(), state = 'open',
      question = spec.question, options = spec.options, free = true }
    t.messages[1] = { kind = 'ask', ask = a.id, at = a.at, from = 'coord', role = 'Coordinator' }
    table.insert(state.S.topics, t)
    table.insert(state.S.asks, a)
    return 'coord opened "' .. t.title .. '" with an ask'
  end,
  -- QA waits for an approval in its harness TUI
  approval = function()
    local s = state.session('qa-1')
    s.state, s.since, s.approval, s.item = 'waiting for approval', state.now_min(), 'npx playwright test --project=ttyd', 'T-12'
    return 'qa-1 waits for approval'
  end,
  -- the Coordinator session stops (role vacant), or comes back
  vacant = function()
    local s = state.session('coord')
    local agents = state.topic('agents')
    if s.state ~= 'stopped' then
      s.prev_state, s.state, s.since = nil, 'stopped', state.now_min()
      agents.messages[#agents.messages + 1] = { kind = 'event', at = state.now_min(), event = 'session stop', text = 'coord · Claude Code (role Coordinator vacant)' }
      agents.unread = (agents.unread or 0) + 1
      return 'coord stopped: no coordinator'
    end
    s.state, s.since = 'idle', state.now_min()
    agents.messages[#agents.messages + 1] = { kind = 'event', at = state.now_min(), event = 'session start', text = 'coord · Claude Code · fable (role Coordinator restored)' }
    agents.unread = (agents.unread or 0) + 1
    -- store-and-forward: queued messages to the Coordinator go out now
    for _, t in ipairs(state.S.topics) do
      for _, m in ipairs(t.messages) do
        if m.from == 'you' and m.stage == 'queued' then
          m.to = 'coord'
          chat.deliver(t, m)
        end
      end
    end
    return 'coord is back: queued messages delivered'
  end,
}

function M.sim(name)
  if not name or name == '' then
    M.sim_i = (M.sim_i or 0) % #M.SIM_ORDER + 1
    name = M.SIM_ORDER[M.sim_i]
  end
  local fn = M.SIM[name]
  if not fn then
    vim.notify('cland-proto: :ClandSim ' .. table.concat(M.SIM_ORDER, '|'), vim.log.levels.ERROR)
    return
  end
  local what = fn()
  state.changed('sim: ' .. what)
  api.nvim_echo({ { 'simulated: ' .. what, 'ClandAskTitle' } }, false, {})
end

-- Keys and commands --------------------------------------------------------------

function M.keymaps()
  local function map(modes, lhs, rhs, desc)
    vim.keymap.set(modes, lhs, rhs, { desc = 'cland-proto: ' .. desc, silent = true })
  end
  map('n', '<leader>v', function() switcher.cycle(1) end, 'next variant')
  map('n', '<leader>V', function() switcher.cycle(-1) end, 'previous variant')
  map('n', '<leader>t', M.topic_picker, 'topics picker')
  map('n', '<leader>s', M.session_picker, 'sessions picker')
  map('n', '<leader>c', function() M.focus_composer() end, 'composer')
  map('n', '<leader>a', M.jump_ask, 'the open ask')
  map('n', '<leader>x', function() M.sim() end, 'simulate the next event')
  map('n', '<leader>b', function()
    local v = switcher.mod()
    if v.back then
      v.back()
    end
  end, 'back to the thread')
  map('n', '<leader>?', M.help, 'help')
  for _, mode in ipairs({ 'n', 'i', 't' }) do
    map(mode, '<C-\\>v', function() switcher.cycle(1) end, 'next variant')
    map(mode, '<C-\\>c', function() M.focus_composer() end, 'composer')
  end
end

function M.commands()
  local cmd = api.nvim_create_user_command
  cmd('ClandVariant', function(o)
    switcher.switch(o.args)
  end, { nargs = 1, complete = function()
    return switcher.order
  end })
  cmd('ClandState', function(o)
    M.show_state(o.args)
  end, { nargs = '?', complete = function()
    return { 'json' }
  end })
  cmd('ClandSim', function(o)
    M.sim(o.args)
  end, { nargs = '?', complete = function()
    return M.SIM_ORDER
  end })
end

function M.autocmds()
  local group = api.nvim_create_augroup('cland_proto', { clear = true })
  api.nvim_create_autocmd({ 'ModeChanged', 'WinEnter', 'BufWinEnter', 'TermEnter', 'TermLeave' }, {
    group = group, callback = function()
      if switcher.current then
        switcher.place_pill()
      end
      pcall(vim.cmd, 'redrawstatus!')
    end,
  })
  api.nvim_create_autocmd('VimResized', {
    group = group, callback = function()
      if not switcher.current then
        return
      end
      switcher.pill()
      M.render()
      local v = switcher.mod()
      if v.resized then
        pcall(v.resized)
      end
    end,
  })
  api.nvim_create_autocmd('TermOpen', {
    group = group, callback = function()
      vim.wo.number = false
      vim.wo.signcolumn = 'no'
    end,
  })
  api.nvim_create_autocmd('TermClose', {
    group = group, callback = function()
      pcall(vim.cmd, 'redrawstatus!')
    end,
  })
end

function M.setup(here)
  M.here = here
  state.reset()
  state.on_change(M.render)
  vim.o.statusline = '%!v:lua.ClandStatus()'
  vim.o.winbar = '%!v:lua.ClandWinbar()'
  vim.o.tabline = '%!v:lua.ClandTabline()'
  M.keymaps()
  M.commands()
  M.autocmds()
  local function start()
    M.highlights()
    switcher.switch(switcher.resolve(vim.env.CLAND_VARIANT or '') or 'slack', true)
    api.nvim_echo({ { 'cland chat-screen prototype (#15, PROTOTYPE): <Space>v cycles the 4 layouts · <Space>? keys · :ClandState', 'ClandDim' } }, false, {})
  end
  if vim.v.vim_did_enter == 1 then
    start()
  else
    api.nvim_create_autocmd('VimEnter', { once = true, callback = start })
  end
end

return M
