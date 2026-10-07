-- PROTOTYPE (ticket #11): layout, keymaps, statusline/winbar, commands.
--
--   +-----------+------------------------+-------------------+
--   | topics    | thread                 | session column    |
--   |           |                        | (terminal buffers)|
--   |           +------------------------+                   |
--   |           | composer (prompt buf)  |                   |
--   +-----------+------------------------+-------------------+
--   global statusline: focus, topic, sessions, loop lag
local api = vim.api
local chat = require('cland_proto.chat')
local sessions = require('cland_proto.sessions')
local ask = require('cland_proto.ask')
local probe = require('cland_proto.probe')

local M = { win = {}, term_wins = {} }

local HELP = {
  'cland-proto keys (PROTOTYPE, ticket #11)   <leader> = Space',
  '',
  ' Normal mode                     Terminal mode / composer insert mode',
  '  <leader>1  claude              <C-\\>c   go to the composer',
  '  <leader>2  codex               <C-\\>j   go to the focused session',
  '  <leader>3  opencode            <C-\\>n   next session   <C-\\>p previous',
  '  <leader>s  new $SHELL          <C-\\>a   toggle the ask dialog',
  '  <leader>t1/t2/t3  harness in   <C-\\>T   tile / untile sessions',
  '             a tmux-owned session <C-\\>s   new $SHELL session',
  '  <leader>ts $SHELL in tmux      <C-\\>l   go to topics',
  '  <leader>n / <leader>p  next / previous session',
  '  <leader>j  focused session     <C-\\><C-n>  leave terminal mode',
  '  <leader>c  composer            topics: <CR> opens a topic',
  '  <leader>l  topics              composer: Enter sends, Shift+Enter newline',
  '  <leader>a  ask dialog',
  '  <leader>T  tile sessions       :ClandShiftEnter off|csi-u|esc-cr|lf',
  '  <leader>?  this help           :ClandAttach <tmux-session> [socket]',
  '                                 :ClandRun <cmd>   :ClandTerms <n>',
  '                                 :ClandTmux <name> <cmd>  (tmux-owned)',
  '',
  ' q closes this window',
}

local function placeholder()
  if not (M.placeholder_buf and api.nvim_buf_is_valid(M.placeholder_buf)) then
    M.placeholder_buf = api.nvim_create_buf(false, true)
    api.nvim_buf_set_lines(M.placeholder_buf, 0, -1, false, { '', '  no sessions yet: <leader>s for a shell' })
    vim.b[M.placeholder_buf].cland_role = 'placeholder'
  end
  return M.placeholder_buf
end

local function set_wo(win, opts)
  for k, v in pairs(opts) do
    vim.wo[win][k] = v
  end
end

function M.term_win()
  local w = M.term_wins[1]
  if w and api.nvim_win_is_valid(w) then
    return w
  end
  M.build_layout()
  return M.term_wins[1]
end

function M.build_layout()
  if ask.is_open() then
    pcall(api.nvim_win_close, ask.win, true)
    ask.win = nil
  end
  local w = api.nvim_get_current_win()
  if api.nvim_win_get_config(w).relative ~= '' then
    w = vim.fn.win_getid(1)
    api.nvim_set_current_win(w)
  end
  pcall(vim.cmd, 'silent only!')
  api.nvim_win_set_buf(w, chat.thread_buf)
  M.win.thread = w
  M.win.topics = api.nvim_open_win(chat.topics_buf, false, { split = 'left', win = w, width = 34 })
  local first = sessions.current()
  M.term_wins = {
    api.nvim_open_win(first and first.buf or placeholder(), false, {
      split = 'right',
      win = w,
      width = math.floor(vim.o.columns * 0.45),
    }),
  }
  M.win.composer = api.nvim_open_win(chat.composer_buf, false, { split = 'below', win = w, height = 6 })
  set_wo(M.win.topics, { winfixwidth = true, wrap = false, number = false, signcolumn = 'no', cursorline = false })
  set_wo(M.win.thread, { wrap = true, linebreak = true, number = false, signcolumn = 'no' })
  set_wo(M.win.composer, { winfixheight = true, wrap = true, number = false, signcolumn = 'no' })
  set_wo(M.term_wins[1], { number = false, signcolumn = 'no' })
  chat.render_thread()
  if sessions.tiled then
    M.tile(true)
  end
  M.refresh()
end

-- Equal heights for the stacked session windows. Never below 3 rows: a
-- terminal one row high keeps no scrollback at all (checks/one-row-scrollback.lua).
function M.equalize_sessions()
  local wins = vim.tbl_filter(api.nvim_win_is_valid, M.term_wins)
  if #wins < 2 then
    return
  end
  local total = 0
  for _, w in ipairs(wins) do
    total = total + api.nvim_win_get_height(w)
  end
  local each = math.max(3, math.floor(total / #wins))
  for i = 1, #wins - 1 do
    pcall(api.nvim_win_set_height, wins[i], each)
  end
end

-- Show every session stacked in the session column (or only the focused one).
function M.tile(on)
  sessions.tiled = on
  local anchor = M.term_win()
  for i = #M.term_wins, 2, -1 do
    if api.nvim_win_is_valid(M.term_wins[i]) then
      api.nvim_win_close(M.term_wins[i], true)
    end
    M.term_wins[i] = nil
  end
  local list = sessions.list
  if on and #list > 1 then
    api.nvim_win_set_buf(anchor, list[1].buf)
    -- carve the column top to bottom: each split takes the rows still free
    local remaining = api.nvim_win_get_height(anchor)
    local each = math.max(3, math.floor((remaining - (#list - 1)) / #list))
    local prev = anchor
    for i = 2, #list do
      local h = remaining - each - 1
      if h < 3 then
        break -- no room: the remaining sessions stay hidden
      end
      local ok, win = pcall(api.nvim_open_win, list[i].buf, false, { split = 'below', win = prev, height = h })
      if not ok then
        break
      end
      set_wo(win, { number = false, signcolumn = 'no' })
      M.term_wins[#M.term_wins + 1] = win
      remaining, prev = h, win
    end
    M.equalize_sessions()
  else
    local s = sessions.current()
    if s then
      api.nvim_win_set_buf(anchor, s.buf)
    end
  end
  M.refresh()
end

function M.focus_composer()
  if not (M.win.composer and api.nvim_win_is_valid(M.win.composer)) then
    M.build_layout()
  end
  api.nvim_set_current_win(M.win.composer)
  -- scheduled: leaving a prompt or terminal window resets the mode after us
  vim.schedule(function()
    if api.nvim_get_current_win() == M.win.composer then
      vim.cmd('startinsert!')
    end
  end)
  M.refresh()
end

function M.focus_topics()
  if not (M.win.topics and api.nvim_win_is_valid(M.win.topics)) then
    M.build_layout()
  end
  vim.cmd.stopinsert()
  api.nvim_set_current_win(M.win.topics)
  api.nvim_win_set_cursor(M.win.topics, { chat.current, 0 })
  M.refresh()
end

function M.focus_session()
  local s = sessions.current()
  if s then
    sessions.show(s.id, true)
  else
    sessions.shell()
    sessions.show(sessions.focused, true)
  end
end

local function enter_new(s)
  if s then
    sessions.show(s.id, true)
  end
end

function M.help()
  local buf = api.nvim_create_buf(false, true)
  api.nvim_buf_set_lines(buf, 0, -1, false, HELP)
  vim.bo[buf].modifiable = false
  local width, height = 80, #HELP
  local win = api.nvim_open_win(buf, true, {
    relative = 'editor',
    row = math.floor((vim.o.lines - height) / 2),
    col = math.floor((vim.o.columns - width) / 2),
    width = width,
    height = height,
    border = 'rounded',
    title = ' keys ',
    style = 'minimal',
    zindex = 70,
  })
  vim.wo[win].winbar = ''
  for _, k in ipairs({ 'q', '<Esc>' }) do
    vim.keymap.set('n', k, function()
      api.nvim_win_close(win, true)
    end, { buffer = buf, nowait = true })
  end
end

function M.mode_label()
  local m = api.nvim_get_mode().mode
  return ({ t = 'TERMINAL', nt = 'NORMAL(term)', i = 'INSERT', n = 'NORMAL', c = 'CMDLINE' })[m] or m
end

function M.focus_label()
  local win = api.nvim_get_current_win()
  if ask.is_open() and win == ask.win then
    return 'ask dialog'
  end
  local buf = api.nvim_win_get_buf(win)
  if vim.b[buf].cland_role then
    return vim.b[buf].cland_role
  end
  local s = sessions.by_buf(buf)
  if s then
    return ('session %d %s (%s-owned, %s)'):format(s.id, s.name, s.owner, sessions.state(s))
  end
  return vim.bo[buf].buftype ~= '' and vim.bo[buf].buftype or 'other'
end

local function status_line()
  local t = chat.topics[chat.current]
  return table.concat({
    '%#ClandBrand# cland-proto %* ',
    '%#ClandBarFocus# ' .. M.focus_label():gsub('%%', '%%%%') .. ' %* ',
    M.mode_label(),
    ' │ topic: ' .. t.title:sub(1, 28),
    ' │ ' .. sessions.summary():gsub('%%', '%%%%'),
    '%=',
    ('S-Enter:%s │ loop lag %dms (max %dms) │ nvim %s '):format(
      sessions.shift_enter, probe.lag.recent, probe.lag.max, tostring(vim.version())),
  })
end

local function winbar()
  local win = vim.g.statusline_winid
  local buf = api.nvim_win_get_buf(win)
  local role = vim.b[buf].cland_role
  local t = chat.topics[chat.current]
  if role == 'topics' then
    return '%#ClandBar# TOPICS (' .. #chat.topics .. ') %*'
  elseif role == 'thread' then
    local st = chat.STATUS[t.status]
    return '%#ClandBar# THREAD %* ' .. t.title .. '  %#' .. st.hl .. '#' .. st.icon .. ' ' .. t.status .. '%*'
  elseif role == 'composer' then
    return '%#ClandBar# COMPOSER %* Enter sends · Shift+Enter newline · to: ' .. t.title:sub(1, 30)
  end
  local s = sessions.by_buf(buf)
  if not s then
    return '%#ClandBar# SESSIONS %*'
  end
  local focused = s.id == sessions.focused
  return ('%%#%s# SESSION %d/%d %%* %s · %s-owned · %s · pid %s · %dx%d'):format(
    focused and 'ClandBarFocus' or 'ClandBar', s.id, #sessions.list, s.name, s.owner,
    sessions.state(s), tostring(s.pid), api.nvim_win_get_width(win), api.nvim_win_get_height(win))
end

-- Errors inside these expressions make Nvim clear the option, so never throw.
function _G.ClandProtoStatus()
  local ok, res = pcall(status_line)
  return ok and res or ' cland-proto (statusline error: ' .. tostring(res):gsub('%%', '%%%%') .. ')'
end

function _G.ClandProtoWinbar()
  local ok, res = pcall(winbar)
  return ok and res or (' winbar error: ' .. tostring(res):gsub('%%', '%%%%'))
end

function M.refresh()
  pcall(vim.cmd.redrawstatus, { bang = true })
end

-- After :restart the session file re-creates windows and re-runs term://
-- commands. Adopt those terminals and rebuild the cland layout around them.
function M.rebuild_after_session()
  local log = { restarted_by_session_file = {}, started_by_cland_glue = {}, unlisted_left_alone = {} }
  for _, buf in ipairs(api.nvim_list_bufs()) do
    local name = api.nvim_buf_get_name(buf)
    if name:match('^term://') then
      local bucket = api.nvim_buf_is_loaded(buf) and 'restarted_by_session_file'
        or (vim.bo[buf].buflisted and 'started_by_cland_glue' or 'unlisted_left_alone')
      table.insert(log[bucket], name)
    end
  end
  probe.restore_log = log
  for _, buf in ipairs(api.nvim_list_bufs()) do
    local name = api.nvim_buf_get_name(buf)
    -- hidden terminals are only badd'ed (listed, unloaded) by the session file;
    -- loading one starts its command again. Unlisted ones are alternate names
    -- left by the session's `:file` renames: loading those would start duplicates.
    if name:match('^term://') and vim.bo[buf].buflisted and not api.nvim_buf_is_loaded(buf) then
      pcall(api.nvim_win_set_buf, api.nvim_get_current_win(), buf)
    end
  end
  sessions.adopt_terminals()
  M.build_layout()
  for _, buf in ipairs(api.nvim_list_bufs()) do
    local unused = api.nvim_buf_is_loaded(buf) and vim.bo[buf].buftype == '' and api.nvim_buf_get_name(buf) == ''
      and #vim.fn.win_findbuf(buf) == 0 and not vim.bo[buf].modified
    if unused then
      pcall(api.nvim_buf_delete, buf, {})
    end
  end
  M.refresh()
end

function M.keymaps()
  local function map(modes, lhs, rhs, desc)
    vim.keymap.set(modes, lhs, rhs, { desc = 'cland-proto: ' .. desc, silent = true })
  end
  map('n', '<leader>1', function() enter_new(sessions.harness('claude')) end, 'launch claude')
  map('n', '<leader>2', function() enter_new(sessions.harness('codex')) end, 'launch codex')
  map('n', '<leader>3', function() enter_new(sessions.harness('opencode')) end, 'launch opencode')
  map('n', '<leader>s', function() enter_new(sessions.shell()) end, 'new $SHELL session')
  map('n', '<leader>t1', function() enter_new(sessions.tmux_harness('claude')) end, 'claude, tmux-owned')
  map('n', '<leader>t2', function() enter_new(sessions.tmux_harness('codex')) end, 'codex, tmux-owned')
  map('n', '<leader>t3', function() enter_new(sessions.tmux_harness('opencode')) end, 'opencode, tmux-owned')
  map('n', '<leader>ts', function() enter_new(sessions.tmux_owned('cland-shell', { vim.o.shell })) end, '$SHELL, tmux-owned')
  map('n', '<leader>n', function() sessions.cycle(1, true) end, 'next session')
  map('n', '<leader>p', function() sessions.cycle(-1, true) end, 'previous session')
  map('n', '<leader>j', M.focus_session, 'focused session')
  map('n', '<leader>c', M.focus_composer, 'composer')
  map('n', '<leader>l', M.focus_topics, 'topics')
  map('n', '<leader>a', ask.toggle, 'ask dialog')
  map('n', '<leader>T', function() M.tile(not sessions.tiled) end, 'tile sessions')
  map('n', '<leader>?', M.help, 'help')
  for _, mode in ipairs({ 'n', 't', 'i' }) do
    map(mode, '<C-\\>c', M.focus_composer, 'composer')
    map(mode, '<C-\\>j', M.focus_session, 'focused session')
    map(mode, '<C-\\>n', function() sessions.cycle(1, true) end, 'next session')
    map(mode, '<C-\\>p', function() sessions.cycle(-1, true) end, 'previous session')
    map(mode, '<C-\\>a', ask.toggle, 'ask dialog')
    map(mode, '<C-\\>T', function() M.tile(not sessions.tiled) end, 'tile sessions')
    map(mode, '<C-\\>s', function() enter_new(sessions.shell()) end, 'new $SHELL session')
    map(mode, '<C-\\>l', M.focus_topics, 'topics')
  end
end

function M.commands()
  local cmd = api.nvim_create_user_command
  cmd('ClandTerms', function(o)
    for _ = 1, tonumber(o.args) or 1 do
      sessions.shell()
    end
  end, { nargs = '?' })
  cmd('ClandRun', function(o) enter_new(sessions.new({ name = o.args:sub(1, 20), cmd = o.args })) end, { nargs = '+' })
  cmd('ClandAttach', function(o)
    enter_new(sessions.attach(o.fargs[1], o.fargs[2]))
  end, { nargs = '+' })
  cmd('ClandTmux', function(o)
    -- :ClandTmux <name> <shell command...>  (tmux runs the command through its shell)
    enter_new(sessions.tmux_owned(o.fargs[1], { table.concat(vim.list_slice(o.fargs, 2), ' ') }))
  end, { nargs = '+' })
  cmd('ClandTile', function() M.tile(not sessions.tiled) end, {})
  cmd('ClandFocus', function(o) sessions.show(tonumber(o.args), true) end, { nargs = 1 })
  cmd('ClandShiftEnter', function(o) sessions.set_shift_enter(o.args) end, { nargs = 1 })
  cmd('ClandRebuild', function() M.build_layout() end, {})
end

function M.autocmds()
  local group = api.nvim_create_augroup('cland_proto', { clear = true })
  local au = function(ev, cb, opts)
    api.nvim_create_autocmd(ev, vim.tbl_extend('force', { group = group, callback = cb }, opts or {}))
  end
  au('TermOpen', function()
    vim.wo.number = false
    vim.wo.signcolumn = 'no'
  end)
  au('TermClose', function(a)
    local s = sessions.by_buf(a.buf)
    if s then
      s.exit_code = vim.v.event.status
    end
    M.refresh()
  end)
  au('BufWipeout', function(a)
    if sessions.by_buf(a.buf) then
      sessions.forget(a.buf)
      vim.schedule(function()
        local s = sessions.current()
        local w = M.term_wins[1]
        if w and api.nvim_win_is_valid(w) then
          api.nvim_win_set_buf(w, s and s.buf or placeholder())
        end
        M.refresh()
      end)
    end
  end)
  au('VimResized', function()
    if sessions.tiled then
      M.equalize_sessions()
    end
  end)
  au('SessionLoadPost', function()
    vim.schedule(M.rebuild_after_session)
  end)
  au({ 'ModeChanged', 'WinEnter', 'BufWinEnter', 'TermEnter', 'TermLeave' }, M.refresh)
end

function M.setup(here)
  M.here = here
  vim.o.statusline = '%!v:lua.ClandProtoStatus()'
  vim.o.winbar = '%!v:lua.ClandProtoWinbar()'
  M.keymaps()
  M.commands()
  M.autocmds()
  local function start()
    chat.highlights()
    chat.create()
    M.build_layout()
    if vim.v.startreason ~= 'restart' then
      sessions.shell()
    end
    M.focus_composer()
    api.nvim_echo({ { 'cland-proto (PROTOTYPE): <Space>? lists the keys. startreason=' .. vim.v.startreason, 'Comment' } }, false, {})
  end
  if vim.v.vim_did_enter == 1 then
    start()
  else
    api.nvim_create_autocmd('VimEnter', { once = true, callback = start })
  end
end

return M
