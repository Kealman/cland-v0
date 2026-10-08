-- PROTOTYPE (ticket #15, workbench): wiring. Global keys, commands,
-- autocmds, the render loop, help, :ClandState, :ClandSim, :ClandLayout and
-- the prompt-artifact draft. Built on the chat-screen prototype; its four
-- variants are gone, replaced by one shell with toggleable panels.
local api = vim.api
local state = require('cland_proto.state')

local M = {}

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
  local width = 24
  for _, l in ipairs(lines) do
    width = math.max(width, vim.fn.strdisplaywidth(l) + 2)
  end
  width = math.min(width, vim.o.columns - 4)
  local height = math.min(#lines, vim.o.lines - 6)
  local win = api.nvim_open_win(buf, true, {
    relative = 'editor', row = math.floor((vim.o.lines - height) / 2) - 1, col = math.floor((vim.o.columns - width) / 2),
    width = width, height = height, border = 'rounded', style = 'minimal', zindex = 90,
    title = { { ' ' .. title .. ' ', 'ClandAmberBold' } }, title_pos = 'center',
    footer = { { ' q closes · j/k scroll ', 'ClandDim' } }, footer_pos = 'center',
  })
  vim.wo[win].winbar = ''
  vim.wo[win].wrap = false
  for _, k in ipairs({ 'q', '<Esc>' }) do
    vim.keymap.set('n', k, function()
      pcall(api.nvim_win_close, win, true)
    end, { buffer = buf, nowait = true })
  end
  return win, buf
end

M.HELP = {
  'cland workbench (PROTOTYPE, ticket #15): one shell, panels that toggle. Space is the leader (␣).',
  '',
  'Panels      ␣i items (left) · ␣n inbox · ␣s sessions · ␣t topics (right; the active key hides it)',
  '            ␣T topics docked above the right panel · ↵ in a panel opens the row in the centre',
  'Centre      ␣g General · ␣b board · ␣N inbox full width · ␣␣ the previous centre view',
  'Motions     gi its item · gt its topic · gs its session (any panel or view; a reference under the cursor wins)',
  'Pick        ␣p one picker: Tab switches items · topics · sessions · artifacts, type to filter · ␣a on artifacts',
  '            ↵ open · C-v split · C-t its topic · C-s its session · C-i its item · C-a attach to the composer',
  '',
  'Items       1 all · 2 in work · 3 needs you · 4 done · 5 map · f next filter · Tab fold · c claim for a session',
  'Inbox       1-9 answer the ask · i free answer · ↵ open / attach · d dismiss · D dismiss all · Tab expand an ask',
  'Sessions    ↵ attach (keys go to the session, C-\\ C-n leaves) · x stop / start again',
  'Topics      ↵ open · n new topic',
  'Thread      1-3 answer the ask · i a o type (on a card: free answer) · ↵ open A-7, T-12, rev-1 · gb browser · r reply',
  'Composer    Enter sends · Shift+Enter or Alt+Enter newline · @impl-1 @reviewer address · Esc leaves · C-c cancels',
  '            ␣c focus the composer · ␣o its text as a prompt artifact (S send · A attach · q keep as draft)',
  'Item view   gt topic · gs session · e the Markdown file · gb branch · x close',
  'Board       f epic scope · ↵ open the card',
  '',
  'Layouts     :ClandLayout charting | watch | steady (examples of the three stages, never modes)',
  'Simulate    ␣x the next event · :ClandSim reply | ask | approval | vacant | verdict | died',
  'State       :ClandState (q closes) · :ClandState json · ␣? this help · nothing is real, nothing is saved',
}

function M.help()
  M.text_float('cland workbench keys', M.HELP)
end

function M.show_state(arg)
  if arg == 'json' then
    M.text_float('ClandState json', vim.split(vim.json.encode(state.plain()), '\n'), 'json')
  else
    M.text_float('ClandState', state.dump_lines())
  end
end

function M.render()
  require('cland_proto.layout').render()
  pcall(vim.cmd, 'redrawstatus!')
  pcall(vim.cmd, 'redrawtabline')
end

-- ␣o: the composer's text as a prompt artifact (#9: long prompts are drafted
-- in a full buffer, then sent or attached).
function M.prompt_artifact()
  local layout = require('cland_proto.layout')
  local chat = require('cland_proto.chat')
  local v = state.S.ui.view
  local tid = v.kind == 'thread' and v.id or 'general'
  local t = state.topic(tid)
  local text = {}
  local cb = chat.composers[tid]
  if cb and api.nvim_buf_is_valid(cb) then
    local prompt = vim.fn.prompt_getprompt(cb)
    for i, l in ipairs(api.nvim_buf_get_lines(cb, 0, -1, false)) do
      text[#text + 1] = i == 1 and l:sub(#prompt + 1) or l
    end
  end
  local n = 10
  while state.artifact('A-' .. n) do
    n = n + 1
  end
  local id = 'A-' .. n
  local a = { id = id, kind = 'prompt', title = 'prompt draft for ' .. (t.item or t.title), by = 'you', status = 'draft', topic = tid,
    path = '.cland/artifacts/' .. id .. '-prompt-draft.md', ft = 'markdown', content = {} }
  state.S.artifacts[id] = a
  table.insert(state.S.artifact_order, 1, id)
  state.changed('prompt artifact ' .. id .. ' (draft) for "' .. t.title .. '"')
  local buf = api.nvim_create_buf(false, true)
  vim.bo[buf].filetype = 'markdown'
  local body = (#text > 0 and vim.trim(table.concat(text, '\n')) ~= '') and text or { '# Prompt for ' .. (t.item or t.title), '', '' }
  api.nvim_buf_set_lines(buf, 0, -1, false, body)
  local width = math.min(90, vim.o.columns - 10)
  local height = math.min(18, vim.o.lines - 10)
  local win = api.nvim_open_win(buf, true, {
    relative = 'editor', row = math.floor((vim.o.lines - height) / 2) - 1, col = math.floor((vim.o.columns - width) / 2),
    width = width, height = height, border = 'rounded', zindex = 75,
    title = { { ' ' .. id .. ' · prompt · draft · ' .. a.path .. ' ', 'ClandBlueBold' } }, title_pos = 'center',
    footer = { { ' normal mode: S send as a message · A attach to a message · q keep as draft ', 'ClandDim' } }, footer_pos = 'center',
  })
  vim.wo[win].winbar = ''
  vim.wo[win].wrap = true
  local function finish(how)
    local lines = api.nvim_buf_get_lines(buf, 0, -1, false)
    a.content = lines
    pcall(api.nvim_win_close, win, true)
    if cb and api.nvim_buf_is_valid(cb) then
      api.nvim_buf_set_lines(cb, 0, -1, false, { vim.fn.prompt_getprompt(cb) })
    end
    if how == 'send' then
      a.status = 'sent'
      chat.send(tid, table.concat(lines, '\n'))
    elseif how == 'attach' then
      a.status = 'sent'
      local m = chat.send(tid, 'prompt attached: ' .. id)
      m.attach = { id }
    else
      state.changed(id .. ' kept as a draft')
    end
    layout.show({ kind = 'thread', id = tid })
  end
  vim.keymap.set('n', 'S', function()
    finish('send')
  end, { buffer = buf, nowait = true })
  vim.keymap.set('n', 'A', function()
    finish('attach')
  end, { buffer = buf, nowait = true })
  vim.keymap.set('n', 'q', function()
    finish('draft')
  end, { buffer = buf, nowait = true })
end

function M.keymaps()
  local layout = require('cland_proto.layout')
  local motions = require('cland_proto.motions')
  local picker = require('cland_proto.picker')
  local function map(modes, lhs, rhs, desc)
    vim.keymap.set(modes, lhs, rhs, { desc = 'cland-proto: ' .. desc, silent = true })
  end
  map('n', '<leader>i', layout.toggle_items, 'items panel')
  map('n', '<leader>n', function()
    layout.right_panel('inbox')
  end, 'inbox panel')
  map('n', '<leader>s', function()
    layout.right_panel('sessions')
  end, 'sessions panel')
  map('n', '<leader>t', function()
    layout.right_panel('topics')
  end, 'topics panel')
  map('n', '<leader>T', layout.toggle_dock, 'topics docked above the right panel')
  map('n', '<leader>N', function()
    if state.S.ui.view.kind == 'inbox' then
      layout.back()
    else
      layout.show({ kind = 'inbox' })
    end
  end, 'inbox full width in the centre')
  map('n', '<leader>g', function()
    layout.show({ kind = 'thread', id = 'general' })
  end, 'General')
  map('n', '<leader>b', function()
    if state.S.ui.view.kind == 'board' then
      layout.back()
    else
      layout.show({ kind = 'board' })
    end
  end, 'board')
  map('n', '<leader>p', function()
    picker.open({ kind = 'items' })
  end, 'picker')
  map('n', '<leader>a', function()
    picker.open({ kind = 'artifacts' })
  end, 'picker on artifacts')
  map('n', '<leader><leader>', layout.back, 'previous centre view')
  map('n', '<leader>c', function()
    layout.focus_composer()
  end, 'composer')
  map('n', '<leader>o', M.prompt_artifact, 'the composer text as a prompt artifact')
  map('n', '<leader>x', function()
    require('cland_proto.sim').fire()
  end, 'simulate the next event')
  map('n', '<leader>?', M.help, 'keys')
  map('n', 'gi', function()
    motions.go('item')
  end, 'its item')
  map('n', 'gt', function()
    motions.go('topic')
  end, 'its topic')
  map('n', 'gs', function()
    motions.go('session')
  end, 'its session')
end

function M.commands()
  local cmd = api.nvim_create_user_command
  cmd('ClandLayout', function(o)
    require('cland_proto.layout').preset(vim.trim(o.args))
  end, { nargs = 1, complete = function()
    return { 'charting', 'watch', 'steady' }
  end })
  cmd('ClandState', function(o)
    M.show_state(o.args)
  end, { nargs = '?', complete = function()
    return { 'json' }
  end })
  cmd('ClandSim', function(o)
    require('cland_proto.sim').fire(vim.trim(o.args))
  end, { nargs = '?', complete = function()
    return require('cland_proto.sim').ORDER
  end })
  -- a driver's shortcut: :ClandView thread t12 | board | item T-15 | session rev-1 | inbox
  cmd('ClandView', function(o)
    local kind, id = o.fargs[1], o.fargs[2]
    require('cland_proto.layout').show({ kind = kind, id = id })
  end, { nargs = '+' })
end

function M.autocmds()
  local group = api.nvim_create_augroup('cland_proto', { clear = true })
  local layout = require('cland_proto.layout')
  api.nvim_create_autocmd({ 'ModeChanged', 'WinEnter', 'BufWinEnter', 'TermEnter', 'TermLeave' }, {
    group = group, callback = function()
      pcall(vim.cmd, 'redrawstatus!')
      pcall(vim.cmd, 'redrawtabline')
    end,
  })
  api.nvim_create_autocmd('VimResized', {
    group = group, callback = function()
      layout.fix()
      state.changed()
    end,
  })
  api.nvim_create_autocmd('WinResized', {
    group = group, callback = function()
      state.changed()
    end,
  })
  api.nvim_create_autocmd('WinClosed', {
    group = group, callback = function(ev)
      local win = tonumber(ev.match)
      vim.schedule(function()
        layout.on_win_closed(win)
      end)
    end,
  })
  api.nvim_create_autocmd('TermOpen', {
    group = group, callback = function()
      vim.wo.number = false
      vim.wo.signcolumn = 'no'
    end,
  })
  api.nvim_create_autocmd('TermRequest', {
    group = group, callback = function(ev)
      require('cland_proto.sessions').on_term_request(ev)
    end,
  })
end

function M.setup(here)
  M.here = here
  state.reset()
  state.on_change(M.render)
  require('cland_proto.bars')
  vim.o.statusline = '%!v:lua.ClandStatus()'
  vim.o.winbar = '%!v:lua.ClandWinbar()'
  vim.o.tabline = '%!v:lua.ClandTopBar()'
  vim.o.showtabline = 2
  -- every notification is one line in the message area (no hit-enter prompt)
  vim.notify = function(msg, level)
    local group = (level == vim.log.levels.ERROR and 'ErrorMsg') or (level == vim.log.levels.WARN and 'WarningMsg') or 'ClandDim'
    state.say(msg, group, level and level >= vim.log.levels.WARN)
  end
  M.keymaps()
  M.commands()
  M.autocmds()
  local function start()
    require('cland_proto.hl').setup()
    require('cland_proto.layout').build()
    M.render()
    local preset = vim.env.CLAND_LAYOUT
    if preset and preset ~= '' then
      require('cland_proto.layout').preset(preset)
    else
      state.say('cland workbench (#15, PROTOTYPE): ␣i ␣n ␣s ␣t panels · ␣p pick · gi gt gs · :ClandLayout charting|watch|steady · ␣? keys')
    end
  end
  if vim.v.vim_did_enter == 1 then
    start()
  else
    api.nvim_create_autocmd('VimEnter', { once = true, callback = start })
  end
end

return M
