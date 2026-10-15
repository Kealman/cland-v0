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
  local sizes = state.S.ui.sizes
  return sizes.left or math.max(30, math.min(44, math.floor(cols * 0.22))), sizes.right or math.max(34, math.min(50, math.floor(cols * 0.25)))
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
  if valid(M.win.centre) and not vim.w[M.win.centre].cland_card then
    return M.win.centre
  end
  for _, w in ipairs(api.nvim_tabpage_list_wins(0)) do
    if api.nvim_win_get_config(w).relative == '' and not M.is_panel(w) and w ~= M.win.composer and not vim.w[w].cland_card then
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

-- The actual sizes after the last layout operation (including any constraint imposed by Neovim).
local measured = {}
local changing = false
local closing = {}
local screen_columns, screen_lines = vim.o.columns, vim.o.lines
local function dimensions()
  local out = {}
  if valid(M.win.left) then out.left = api.nvim_win_get_width(M.win.left) end
  local right = valid(M.win.right) and M.win.right or M.win.dock
  if valid(right) then out.right = api.nvim_win_get_width(right) end
  if valid(M.win.dock) and valid(M.win.right) then out.dock = api.nvim_win_get_height(M.win.dock) end
  local card = require('cland.explorer').card.win
  if valid(card) then out.card = api.nvim_win_get_width(card) end
  return out
end

local function record_resize()
  if changing or next(closing) then return end
  local now = dimensions()
  local same_screen = screen_columns == vim.o.columns and screen_lines == vim.o.lines
  for key, size in pairs(now) do
    if same_screen and measured[key] and size ~= measured[key] then
      if key == 'card' then require('cland.explorer').ui().card_width = size
      else state.S.ui.sizes[key] = size end
    end
  end
  measured = now
  screen_columns, screen_lines = vim.o.columns, vim.o.lines
end

function M.flush_resize()
  record_resize()
end

function M.resized()
  record_resize()
  state.changed()
end

-- WinClosed runs before its deferred state repair. Redistribution in that interval is automatic.
function M.closing(win)
  if not changing then
    record_resize()
    closing[win] = true
  end
end

function M.screen_resized()
  -- Screen constraints are temporary, not manual overrides.
  M.fix()
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
  local opening_sessions = kind == 'sessions' and (not valid(M.win.right) or api.nvim_win_get_buf(M.win.right) ~= panels.buf('sessions'))
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
  if opening_sessions then require('cland.sessions').poll_accounts() end
end

local function dock_height()
  return state.S.ui.sizes.dock or math.max(6, math.min(math.floor((vim.o.lines - 3) * 0.4), #state.S.topics + 6))
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

--- Use manual sizes when present, otherwise the design formulas; a session terminal never gets below
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
  if valid(c) then require('cland.explorer').sync(c) end
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
  return a and b and a.kind == b.kind and a.id == b.id and a.file == b.file
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
    wo.winhighlight = ''
  elseif kind == 'session' then
    wo.wrap = false
    wo.winhighlight = 'Normal:ClandTerm,NormalNC:ClandTerm'
  else
    wo.wrap = kind ~= 'graph' and kind ~= 'explorer'
    if kind == 'explorer' or kind == 'rulebook' or kind == 'rule_compose' then wo.foldenable = false end
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

--- Show `view` ({kind = thread|session|item|board|graph|log|inbox|rulebook|rule_compose, id}) in the centre.
function M.show(view, opts)
  if view.kind == 'item' or view.kind == 'plan' then
    local item = state.item(view.id)
    if item then view = vim.tbl_extend('force', view, { id = item.id }) end
  end
  -- Agents is read as its log, not as a thread with a composer (#34)
  if view.kind == 'thread' and view.id == 'agents' then
    view = { kind = 'log' }
  end
  local ui = state.S.ui
  if ui.view.kind == 'explorer' then require('cland.explorer').remember() end
  if not same(ui.view, view) then
    table.insert(ui.hist, ui.view)
    while #ui.hist > 40 do
      table.remove(ui.hist, 1)
    end
  end
  if ui.view.kind == 'events' and view.kind ~= 'events' then require('cland.events').visit_look = nil end
  if view.kind == 'events' and ui.view.kind ~= 'events' then require('cland.events').enter() end
  if view.kind == 'plan' then require('cland.plan').enter(view.id) end
  ui.view = view
  M.apply_view(opts)
  state.changed()
end

--- C-v on a session: attach it in a vertical split beside the centre, in Terminal mode. The centre view
--- stays what it was; closing the split ends only that attach client. The split is remembered (M.win.splits)
--- so that `:restart` brings it back as a split. opts.focus = false (a restore) leaves the focus where it is.
function M.show_split(view, opts)
  opts = opts or {}
  local enter = opts.focus ~= false
  local c = M.centre()
  local scratch = api.nvim_create_buf(false, true)
  vim.bo[scratch].bufhidden = 'wipe'
  local w = api.nvim_open_win(scratch, enter, { split = 'right', win = c })
  centre_opts(w, 'session')
  M.win.splits = M.win.splits or {}
  M.win.splits[w] = view.id
  local buf = require('cland.sessions').show_in(w, view.id, {
    on_attached = function(win)
      centre_opts(win, 'session')
      M.fix()
      if enter and api.nvim_get_current_win() == win then
        M.enter_terminal(win)
      end
    end,
  })
  if enter and vim.bo[buf].buftype == 'terminal' then
    M.enter_terminal(w)
  end
  state.changed()
  return w
end

--- A palette object in a split beside the centre. Threads share their existing card buffer;
--- free answers still use the centre composer. These splits are not session attach clients.
function M.show_split_view(view)
  local views = require('cland.views')
  local buf = view.kind == 'thread' and (view.id == 'agents' and require('cland.agents_log').buffer() or views.topic(view.id).thread.buf) or views.placeholder(view)
  local win = api.nvim_open_win(buf, true, {split='right', win=M.centre()})
  M.win.object_splits = M.win.object_splits or {}
  M.win.object_splits[win] = view
  centre_opts(win, view.kind)
  M.fix()
  if view.kind == 'thread' and view.id ~= 'agents' then views.topic(view.id).thread:render(); views.mark_read(view.id) end
  state.changed()
  return win
end

--- The sessions shown in C-v splits now, in window order: what `:restart` restores as splits.
function M.split_sessions()
  local out = {}
  for _, w in ipairs(api.nvim_tabpage_list_wins(0)) do
    local name = (M.win.splits or {})[w]
    if name and api.nvim_win_is_valid(w) and vim.b[api.nvim_win_get_buf(w)].cland_session == name then
      out[#out + 1] = name
    end
  end
  return out
end

--- ␣␣: the previous centre view; twice returns, like CTRL-^.
function M.back()
  local ui = state.S.ui
  if ui.view.kind == 'explorer' then require('cland.explorer').remember() end
  local prev = table.remove(ui.hist)
  while prev and same(prev, ui.view) do
    prev = table.remove(ui.hist)
  end
  if not prev then
    state.say('no previous centre view')
    return
  end
  -- Explorer scopes form a back stack; other centre views retain the CTRL-^ toggle.
  if ui.view.kind ~= 'explorer' then table.insert(ui.hist, ui.view) end
  if ui.view.kind == 'events' then require('cland.events').visit_look = nil end
  if prev.kind == 'events' then require('cland.events').visit() end
  if prev.kind == 'plan' then require('cland.plan').enter(prev.id) end
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
  local redistributed = closing[win]
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
  elseif M.win.splits and M.win.splits[win] then
    M.win.splits[win] = nil
  elseif M.win.object_splits and M.win.object_splits[win] then
    M.win.object_splits[win] = nil
  else
    if redistributed then M.fix() end
    closing[win] = nil
    return
  end
  record_resize()
  closing[win] = true
  -- A sole centre column can disappear and give its width to a panel. Recreate it, then restore
  -- preferences without ever storing that automatic redistribution.
  if not valid(M.win.centre) then
    close('composer')
    M.apply_view({ focus = false, insert = false })
  else
    M.fix()
  end
  closing[win] = nil
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
  for win, view in pairs(M.win.object_splits or {}) do
    if valid(win) then
      -- Topic buffers already apply message/card/delivery events incrementally in every window.
      if view.kind ~= 'thread' or view.id == 'agents' then
        require('cland.views').render_placeholder(view.id == 'agents' and {kind='log'} or view)
      end
    end
  end
end

-- Flush a pending human resize before a layout operation; pending closes exclude redistribution.
-- Programmatic changes then establish the new automatic baseline.
for _, name in ipairs({ 'centre', 'open_left', 'open_right', 'open_dock', 'fix', 'toggle_left', 'right_panel', 'toggle_dock', 'apply_view', 'show', 'back', 'toggle_view', 'show_split', 'show_split_view', 'preset', 'build' }) do
  local operation = M[name]
  M[name] = function(...)
    if changing then return operation(...) end
    record_resize()
    changing = true
    local ok, result = pcall(operation, ...)
    changing = false
    measured = dimensions()
    screen_columns, screen_lines = vim.o.columns, vim.o.lines
    if not ok then error(result) end
    return result
  end
end

return M
