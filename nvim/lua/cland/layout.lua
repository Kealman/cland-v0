-- The windows of the one shell (spec section 5). Nothing is a mode: panels open and close, the centre
-- shows one view at a time, and the presets only do both.
--
--   tabline    top bar: project · centre view · Coordinator chip · needs you · sessions
--   +-----------+------------------------------+------------------+
--   | ITEMS     | centre view                  | [TOPICS dock] ␣T |
--   | ␣i        | thread · session · item ·    +------------------+
--   |           | board · log · inbox (␣N)     | INBOX ␣n         |
--   |           +------------------------------+ SESSIONS ␣s      |
--   |           | composer (threads only)      | TOPICS ␣t        |
--   +-----------+------------------------------+------------------+
--   statusline the centre view's context · hub · sessions · key hints
--
-- Panels are top-level splits (`win = -1`), so they span the full height whatever the centre shows.
local api = vim.api
local state = require('cland.state')

local M = { win = {} }

local function valid(w)
  return w and api.nvim_win_is_valid(w)
end

local function mods()
  return require('cland.panels'), require('cland.views'), require('cland.sessions')
end

--- The widths of the left and right panels for this screen.
function M.widths()
  local cols = vim.o.columns
  return math.max(30, math.min(44, math.floor(cols * 0.22))), math.max(34, math.min(50, math.floor(cols * 0.25)))
end

local function panel_opts(win)
  local wo = vim.wo[win]
  wo.winfixwidth = true
  wo.wrap = false
  wo.cursorline = true
  wo.number = false
  wo.relativenumber = false
  wo.signcolumn = 'no'
  wo.foldcolumn = '0'
  wo.list = false
  wo.winhighlight = 'Normal:ClandPanel,NormalNC:ClandPanel,EndOfBuffer:ClandPanelEob,CursorLine:ClandSel'
end

function M.is_panel(w)
  return w and (w == M.win.left or w == M.win.right or w == M.win.dock)
end

--- The centre window, found again (or made) when it was closed.
function M.centre()
  if valid(M.win.centre) then
    return M.win.centre
  end
  for _, w in ipairs(api.nvim_tabpage_list_wins(0)) do
    if api.nvim_win_get_config(w).relative == '' and not M.is_panel(w) and w ~= M.win.composer then
      M.win.centre = w
      return w
    end
  end
  local anchor = M.win.left or M.win.right or M.win.dock
  M.win.centre = api.nvim_open_win(api.nvim_create_buf(false, true), false, { split = 'right', win = anchor or 0 })
  return M.win.centre
end

local function focus(w)
  if valid(w) then
    api.nvim_set_current_win(w)
  end
end

local function close(key)
  local w = M.win[key]
  M.win[key] = nil
  if valid(w) then
    pcall(api.nvim_win_close, w, true)
  end
  return w
end

--- Close the panel window `key`; the centre takes the focus when the panel had it.
local function close_panel(key)
  local had = api.nvim_get_current_win() == M.win[key]
  local w = M.win[key]
  M.win[key] = nil
  if valid(w) then
    pcall(api.nvim_win_close, w, true)
  end
  M.fix()
  if had then
    focus(M.centre())
  end
end

-- Panels -------------------------------------------------------------------------------------------

function M.open_left()
  if valid(M.win.left) then
    return
  end
  local panels = mods()
  M.win.left = api.nvim_open_win(panels.buf('items'), false, { split = 'left', win = -1, width = (M.widths()) })
  panel_opts(M.win.left)
  panels.render('items', M.win.left)
end

function M.open_right(kind)
  local panels = mods()
  local b = panels.buf(kind)
  if valid(M.win.right) then
    api.nvim_win_set_buf(M.win.right, b)
  else
    local _, rw = M.widths()
    if valid(M.win.dock) then
      M.win.right = api.nvim_open_win(b, false, { split = 'below', win = M.win.dock })
    else
      M.win.right = api.nvim_open_win(b, false, { split = 'right', win = -1, width = rw })
    end
  end
  panel_opts(M.win.right)
  panels.render(kind, M.win.right)
end

local function dock_height()
  return math.max(6, math.min(math.floor((vim.o.lines - 3) * 0.4), #state.S.topics + 6))
end

function M.open_dock()
  if valid(M.win.dock) then
    return
  end
  local panels = mods()
  local _, rw = M.widths()
  if valid(M.win.right) then
    M.win.dock = api.nvim_open_win(panels.buf('topics', 'dock'), false, { split = 'above', win = M.win.right, height = dock_height() })
  else
    M.win.dock = api.nvim_open_win(panels.buf('topics', 'dock'), false, { split = 'right', win = -1, width = rw })
  end
  panel_opts(M.win.dock)
  vim.wo[M.win.dock].winfixheight = true
  panels.render('topics', M.win.dock)
end

--- Keep the sizes the design asks for after any layout change; a session terminal never gets below
--- three rows (ADR 0005: a one-row terminal keeps no scrollback).
function M.fix()
  local lw, rw = M.widths()
  if valid(M.win.left) then
    pcall(api.nvim_win_set_width, M.win.left, lw)
  end
  if valid(M.win.right) then
    pcall(api.nvim_win_set_width, M.win.right, rw)
  elseif valid(M.win.dock) then
    pcall(api.nvim_win_set_width, M.win.dock, rw)
  end
  if valid(M.win.dock) and valid(M.win.right) then
    pcall(api.nvim_win_set_height, M.win.dock, dock_height())
  end
  if valid(M.win.composer) then
    -- the winbar plus the composer's lines
    pcall(api.nvim_win_set_height, M.win.composer, require('cland.topic_view').COMPOSER_HEIGHT + 1)
  end
  local c = M.win.centre
  if valid(c) and vim.bo[api.nvim_win_get_buf(c)].buftype == 'terminal' and vim.fn.winheight(c) < 3 then
    pcall(api.nvim_win_set_height, c, 3)
  end
end

function M.toggle_left()
  local ui = state.S.ui
  ui.preset = nil
  ui.left = not ui.left
  if ui.left then
    M.open_left()
    M.fix()
    focus(M.win.left)
  else
    close_panel('left')
  end
  state.changed()
end

--- ␣n / ␣s / ␣t: one right panel; pressing the active key hides it.
function M.right_panel(kind)
  local ui = state.S.ui
  ui.preset = nil
  if ui.right == kind then
    ui.right = nil
    close_panel('right')
    state.changed()
    return
  end
  ui.right = kind
  if kind == 'topics' and ui.dock then
    ui.dock = false
    close('dock')
  end
  M.open_right(kind)
  M.fix()
  focus(M.win.right)
  state.changed()
end

--- ␣T: topics docked above the right panel (the Watch layout); the panel below shows the inbox.
function M.toggle_dock()
  local ui = state.S.ui
  ui.preset = nil
  ui.dock = not ui.dock
  if ui.dock then
    if ui.right == nil or ui.right == 'topics' then
      ui.right = 'inbox'
      M.open_right('inbox')
    end
    M.open_dock()
    M.fix()
    focus(M.win.dock)
  else
    close_panel('dock')
  end
  state.changed()
end

-- Centre views -------------------------------------------------------------------------------------

local function same(a, b)
  return a and b and a.kind == b.kind and a.id == b.id
end

local function centre_opts(w, kind)
  local wo = vim.wo[w]
  wo.number = false
  wo.relativenumber = false
  wo.signcolumn = 'no'
  wo.winfixwidth = false
  wo.list = false
  wo.cursorline = false
  if kind == 'thread' then
    wo.wrap, wo.linebreak, wo.breakindent = true, true, true
    wo.winhighlight = ''
  elseif kind == 'session' then
    wo.wrap = false
    wo.winhighlight = 'Normal:ClandTerm,NormalNC:ClandTerm'
  else
    wo.wrap = true
    wo.winhighlight = ''
  end
end

local function open_composer(w, view)
  local b = view.composer.buf
  if valid(M.win.composer) then
    api.nvim_win_set_buf(M.win.composer, b)
    return
  end
  M.win.composer = api.nvim_open_win(b, false, { split = 'below', win = w, height = require('cland.topic_view').COMPOSER_HEIGHT + 1 })
  local wo = vim.wo[M.win.composer]
  wo.winfixheight = true
  wo.wrap = true
  wo.number = false
  wo.signcolumn = 'no'
  wo.winhighlight = 'Normal:ClandComposer,NormalNC:ClandComposer,EndOfBuffer:ClandComposerEob'
end

--- Terminal mode in `win` once the current key is done (a closing float would leave Insert mode
--- otherwise), and only if it still holds a terminal.
function M.enter_terminal(win)
  vim.schedule(function()
    vim.schedule(function()
      if api.nvim_get_current_win() == win and vim.bo[api.nvim_win_get_buf(win)].buftype == 'terminal' then
        vim.cmd('startinsert')
      end
    end)
  end)
end

--- Show the current view in the centre. opts: focus (default true), insert (a thread focuses its
--- composer in Insert mode, a session enters Terminal mode).
function M.apply_view(opts)
  opts = opts or {}
  local _, views, sessions = mods()
  local v = state.S.ui.view
  local w = M.centre()
  local target = w
  if v.kind == 'thread' then
    local tv = views.topic(v.id)
    api.nvim_win_set_buf(w, tv.thread.buf)
    centre_opts(w, 'thread')
    open_composer(w, tv)
    tv.thread:render()
    -- the thread is in view: the human has read it
    views.mark_read(v.id)
    target = opts.insert ~= false and M.win.composer or w
  else
    close('composer')
    if v.kind == 'session' then
      sessions.show_in(w, v.id, {
        on_attached = function(win)
          centre_opts(win, 'session')
          M.fix()
          if opts.insert and api.nvim_get_current_win() == win then
            M.enter_terminal(win)
          end
        end,
      })
      centre_opts(w, 'session')
    else
      api.nvim_win_set_buf(w, views.placeholder(v))
      centre_opts(w, v.kind)
    end
  end
  M.fix()
  if opts.focus ~= false then
    focus(target)
    if v.kind == 'thread' and target == M.win.composer then
      vim.cmd('startinsert!')
    elseif v.kind == 'session' and opts.insert then
      M.enter_terminal(w)
    else
      vim.cmd('stopinsert')
    end
  end
end

--- Show `view` ({kind = thread|session|item|board|log|inbox, id}) in the centre.
function M.show(view, opts)
  local ui = state.S.ui
  if not same(ui.view, view) then
    table.insert(ui.hist, ui.view)
    while #ui.hist > 40 do
      table.remove(ui.hist, 1)
    end
  end
  ui.view = view
  M.apply_view(opts)
  state.changed()
end

--- C-v on a session: attach it in a vertical split beside the centre, in Terminal mode. The centre view
--- stays what it was; closing the split ends only that attach client.
function M.show_split(view)
  local c = M.centre()
  local scratch = api.nvim_create_buf(false, true)
  vim.bo[scratch].bufhidden = 'wipe'
  local w = api.nvim_open_win(scratch, true, { split = 'right', win = c })
  centre_opts(w, 'session')
  local buf = require('cland.sessions').show_in(w, view.id, {
    on_attached = function(win)
      centre_opts(win, 'session')
      M.fix()
      if api.nvim_get_current_win() == win then
        M.enter_terminal(win)
      end
    end,
  })
  if vim.bo[buf].buftype == 'terminal' then
    M.enter_terminal(w)
  end
  state.changed()
  return w
end

--- ␣␣: the previous centre view; twice returns, like CTRL-^.
function M.back()
  local ui = state.S.ui
  local prev = table.remove(ui.hist)
  while prev and same(prev, ui.view) do
    prev = table.remove(ui.hist)
  end
  if not prev then
    state.say('no previous centre view')
    return
  end
  table.insert(ui.hist, ui.view)
  ui.view = prev
  M.apply_view({ insert = false })
  state.changed()
end

--- ␣b, ␣N: a centre view that toggles back to where the human was.
function M.toggle_view(view)
  if same(state.S.ui.view, view) then
    M.back()
  else
    M.show(view, { insert = false })
  end
end

-- Presets: examples of the three stages (spec section 5), never modes. A preset opens and closes panels
-- and picks the centre view; everything still toggles afterwards.
M.PRESETS = {
  charting = { left = true, right = nil, dock = false, view = { kind = 'thread', id = 'general' }, note = 'items beside General, right panel hidden' },
  watch = { left = true, right = 'inbox', dock = true, view = { kind = 'thread', id = 'general' }, note = 'items, the thread, topics docked above the inbox' },
  steady = { left = false, right = 'inbox', dock = false, view = { kind = 'board' }, note = 'the board and the inbox' },
}

function M.preset(name)
  local p = M.PRESETS[name]
  if not p then
    state.say(':Cland preset charting | watch | steady', 'ClandRedBar')
    return
  end
  local ui = state.S.ui
  vim.cmd('stopinsert')
  close('dock')
  close('right')
  close('left')
  ui.left, ui.right, ui.dock = p.left, p.right, p.dock
  if p.left then
    M.open_left()
  end
  if p.right then
    M.open_right(p.right)
  end
  if p.dock then
    M.open_dock()
  end
  M.show(p.view, { insert = false })
  ui.preset = name
  state.say('preset ' .. name .. ': ' .. p.note .. ' · every panel still toggles')
end

--- Build the windows from the state (at start, and again after a restart restored the state).
function M.build(opts)
  opts = opts or {}
  -- one plain window to start from: whatever a restored session or a stray split left goes
  for _, w in ipairs(api.nvim_tabpage_list_wins(0)) do
    if api.nvim_win_get_config(w).relative ~= '' then
      pcall(api.nvim_win_close, w, true)
    end
  end
  pcall(vim.cmd, 'silent! only!')
  M.win = { centre = api.nvim_get_current_win() }
  local ui = state.S.ui
  if ui.left then
    M.open_left()
  end
  if ui.right then
    M.open_right(ui.right)
  end
  if ui.dock then
    M.open_dock()
  end
  M.apply_view({ insert = opts.insert })
end

--- A panel closed with :q or CTRL-W c: the state follows the windows.
function M.on_win_closed(win)
  local ui = state.S.ui
  if win == M.win.left then
    M.win.left, ui.left = nil, false
  elseif win == M.win.right then
    M.win.right, ui.right = nil, nil
  elseif win == M.win.dock then
    M.win.dock, ui.dock = nil, false
  elseif win == M.win.composer then
    M.win.composer = nil
  elseif win == M.win.centre then
    M.win.centre = nil
  else
    return
  end
  state.changed()
end

--- Re-render what the panels show (from state.changed()).
function M.render()
  local panels = mods()
  local ui = state.S.ui
  if valid(M.win.left) then
    panels.render('items', M.win.left)
  end
  if valid(M.win.right) and ui.right then
    panels.render(ui.right, M.win.right)
  end
  if valid(M.win.dock) then
    panels.render('topics', M.win.dock)
  end
  local c = M.win.centre
  if valid(c) and ui.view.kind ~= 'thread' and ui.view.kind ~= 'session' then
    require('cland.views').render_placeholder(ui.view)
  end
end

return M
