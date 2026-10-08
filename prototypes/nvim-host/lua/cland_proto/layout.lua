-- PROTOTYPE (ticket #15, workbench): the windows of the one shell.
--
--   tabline   top bar: project | centre view | Coordinator | needs you | sessions
--   +-----------+-------------------------------+-------------------+
--   | ITEMS     | centre view                   | [TOPICS dock]     |
--   | <Space>i  | thread | board | item |       | <Space>T          |
--   |           | session | inbox (<Space>N)    +-------------------+
--   |           +-------------------------------+ INBOX / SESSIONS  |
--   |           | composer (threads only)       | / TOPICS          |
--   +-----------+-------------------------------+-------------------+
--   statusline  centre context | hub | sessions | key hints
--
-- Panels are top-level splits (nvim_open_win split with win = -1), so they
-- span the full height whatever the centre shows. Nothing is a mode: the
-- presets (:ClandLayout) only open and close panels and set the items filter.
local api = vim.api
local state = require('cland_proto.state')

local M = { win = {} }

local function valid(w)
  return w and api.nvim_win_is_valid(w)
end

local function mods()
  return require('cland_proto.items'), require('cland_proto.inbox'), require('cland_proto.lists'),
    require('cland_proto.chat'), require('cland_proto.board'), require('cland_proto.itemview'), require('cland_proto.sessions')
end

function M.widths()
  local cols = vim.o.columns
  return math.max(34, math.min(46, math.floor(cols * 0.22))), math.max(38, math.min(52, math.floor(cols * 0.25)))
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
  return w == M.win.items or w == M.win.right or w == M.win.dock
end

-- The centre window (re-found if it was closed).
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
  local anchor = M.win.items or M.win.right or M.win.dock
  M.win.centre = api.nvim_open_win(api.nvim_create_buf(false, true), false, { split = 'right', win = anchor })
  return M.win.centre
end

-- Panels ---------------------------------------------------------------------

function M.open_items()
  if valid(M.win.items) then
    return
  end
  local items = mods()
  local iw = M.widths()
  M.win.items = api.nvim_open_win(items.buf(), false, { split = 'left', win = -1, width = iw })
  panel_opts(M.win.items)
end

function M.close_items()
  if valid(M.win.items) then
    pcall(api.nvim_win_close, M.win.items, true)
  end
  M.win.items = nil
end

local function right_buf(kind)
  local _, inbox, lists = mods()
  if kind == 'inbox' then
    return inbox.buf('panel')
  elseif kind == 'sessions' then
    return lists.sessions_buf()
  end
  return lists.topics_buf()
end

function M.open_right(kind)
  local b = right_buf(kind)
  if valid(M.win.right) then
    api.nvim_win_set_buf(M.win.right, b)
    return
  end
  local _, rw = M.widths()
  if valid(M.win.dock) then
    M.win.right = api.nvim_open_win(b, false, { split = 'below', win = M.win.dock })
  else
    M.win.right = api.nvim_open_win(b, false, { split = 'right', win = -1, width = rw })
  end
  panel_opts(M.win.right)
end

function M.close_right()
  if valid(M.win.right) then
    pcall(api.nvim_win_close, M.win.right, true)
  end
  M.win.right = nil
end

-- The dock fits the topic list (sections, rows, footer), at most half the height.
local function dock_height()
  return math.max(8, math.min(math.floor((vim.o.lines - 3) * 0.5), #state.S.topics + 7))
end

function M.open_dock()
  if valid(M.win.dock) then
    return
  end
  local _, _, lists = mods()
  local _, rw = M.widths()
  if valid(M.win.right) then
    M.win.dock = api.nvim_open_win(lists.topics_buf(), false, { split = 'above', win = M.win.right, height = dock_height() })
  else
    M.win.dock = api.nvim_open_win(lists.topics_buf(), false, { split = 'right', win = -1, width = rw })
  end
  panel_opts(M.win.dock)
  vim.wo[M.win.dock].winfixheight = true
end

function M.close_dock()
  if valid(M.win.dock) then
    pcall(api.nvim_win_close, M.win.dock, true)
  end
  M.win.dock = nil
end

-- Keep the sizes the design asks for after any layout change.
function M.fix()
  local iw, rw = M.widths()
  if valid(M.win.items) then
    pcall(api.nvim_win_set_width, M.win.items, iw)
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
    pcall(api.nvim_win_set_height, M.win.composer, 4) -- 1 winbar row + 3 text rows
  end
end

local function focus(w)
  if valid(w) then
    api.nvim_set_current_win(w)
  end
end

local function centre_if_gone(w)
  if api.nvim_get_current_win() == w or not valid(api.nvim_get_current_win()) then
    focus(M.centre())
  end
end

function M.toggle_items()
  local ui = state.S.ui
  ui.items_open = not ui.items_open
  ui.preset = nil
  if ui.items_open then
    M.open_items()
    M.fix()
    focus(M.win.items)
  else
    local w = M.win.items
    M.close_items()
    M.fix()
    centre_if_gone(w)
  end
  state.changed('items panel ' .. (ui.items_open and 'shown' or 'hidden'))
end

-- <Space>n / <Space>s / <Space>t: one right panel; the active key hides it.
function M.right_panel(kind)
  local ui = state.S.ui
  ui.preset = nil
  if ui.right == kind then
    ui.right = nil
    M.close_right()
    M.fix()
    focus(M.centre())
    state.changed('right panel hidden')
    return
  end
  ui.right = kind
  if kind == 'topics' and ui.dock then
    ui.dock = false
    M.close_dock()
  end
  M.open_right(kind)
  M.fix()
  focus(M.win.right)
  state.changed('right panel: ' .. kind)
end

-- <Space>T: topics docked above the right panel (the Watch artboard).
function M.toggle_dock()
  local ui = state.S.ui
  ui.preset = nil
  ui.dock = not ui.dock
  if ui.dock then
    if ui.right == 'topics' then
      ui.right = 'inbox'
      M.open_right('inbox')
    end
    M.open_dock()
    M.fix()
    focus(M.win.dock)
  else
    local w = M.win.dock
    M.close_dock()
    M.fix()
    centre_if_gone(w)
  end
  state.changed('topics dock ' .. (ui.dock and 'shown' or 'hidden'))
end

-- Centre views ---------------------------------------------------------------

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
  if kind == 'thread' then
    wo.wrap, wo.linebreak, wo.breakindent, wo.cursorline = true, true, true, false
    wo.winhighlight = ''
  elseif kind == 'session' then
    wo.wrap, wo.cursorline = false, false
    wo.winhighlight = 'Normal:ClandTerm'
  else
    wo.wrap, wo.cursorline = false, kind == 'inbox'
    wo.winhighlight = kind == 'inbox' and 'CursorLine:ClandSel' or ''
  end
end

local function open_composer(w, id)
  local _, _, _, chat = mods()
  local b = chat.composer(id)
  if valid(M.win.composer) then
    api.nvim_win_set_buf(M.win.composer, b)
    return
  end
  M.win.composer = api.nvim_open_win(b, false, { split = 'below', win = w, height = 4 })
  local wo = vim.wo[M.win.composer]
  wo.winfixheight = true
  wo.wrap = true
  wo.number = false
  wo.signcolumn = 'no'
  wo.winhighlight = 'Normal:ClandComposer,NormalNC:ClandComposer,EndOfBuffer:ClandComposerEob'
end

local function close_composer()
  if valid(M.win.composer) then
    pcall(api.nvim_win_close, M.win.composer, true)
  end
  M.win.composer = nil
end

-- Start Insert / Terminal mode in `win` once the current key has finished
-- (the chat-screen quirk: a float that was in Insert mode is still closing).
function M.enter_insert(win)
  vim.schedule(function()
    vim.schedule(function()
      if api.nvim_get_current_win() == win and vim.bo[api.nvim_win_get_buf(win)].buftype == 'terminal' then
        vim.cmd('startinsert')
      end
    end)
  end)
end

function M.apply_view(opts)
  opts = opts or {}
  local _, inbox, _, chat, board, itemview, sessions = mods()
  local v = state.S.ui.view
  local w = M.centre()
  if v.kind == 'thread' then
    if not opts.initial then
      chat.read(v.id)
    end
    api.nvim_win_set_buf(w, chat.thread_buf(v.id))
    centre_opts(w, 'thread')
    open_composer(w, v.id)
    chat.render(v.id)
    if opts.ask then
      local b = chat.thread_buf(v.id)
      local row = chat.find_row(b, function(inf)
        return inf.ask == opts.ask
      end)
      if row then
        pcall(api.nvim_win_set_cursor, w, { row, 0 })
      end
    else
      chat.to_tail(w)
    end
  else
    close_composer()
    if v.kind == 'board' then
      api.nvim_win_set_buf(w, board.buf())
      centre_opts(w, 'board')
      board.render(w)
    elseif v.kind == 'item' then
      api.nvim_win_set_buf(w, itemview.buf(v.id))
      centre_opts(w, 'item')
      itemview.render(v.id, w)
      pcall(api.nvim_win_set_cursor, w, { 1, 0 })
    elseif v.kind == 'session' then
      sessions.show_in(w, v.id)
      centre_opts(w, 'session')
    elseif v.kind == 'inbox' then
      api.nvim_win_set_buf(w, inbox.buf('centre'))
      centre_opts(w, 'inbox')
      inbox.render('centre', w)
    end
  end
  M.fix()
  if opts.focus ~= false then
    focus(w)
    if opts.insert and v.kind == 'session' then
      M.enter_insert(w)
    end
  end
end

-- Show `view` in the centre: {kind = thread|board|item|session|inbox, id}.
function M.show(view, opts)
  opts = opts or {}
  local ui = state.S.ui
  if not same(ui.view, view) then
    table.insert(ui.hist, ui.view)
    if #ui.hist > 40 then
      table.remove(ui.hist, 1)
    end
  end
  ui.view = view
  M.apply_view(opts)
  state.changed('centre: ' .. view.kind .. (view.id and (' ' .. view.id) or ''))
end

-- <Space><Space>: the previous centre view (twice returns, like CTRL-^).
function M.back()
  local ui = state.S.ui
  local prev = table.remove(ui.hist)
  while prev and same(prev, ui.view) do
    prev = table.remove(ui.hist)
  end
  if not prev then
    vim.notify('cland-proto: no previous centre view', vim.log.levels.INFO)
    return
  end
  table.insert(ui.hist, ui.view)
  ui.view = prev
  M.apply_view({ focus = true })
  state.changed('back to ' .. prev.kind .. (prev.id and (' ' .. prev.id) or ''))
end

function M.focus_composer(id, prefill, insert)
  local ui = state.S.ui
  id = id or (ui.view.kind == 'thread' and ui.view.id) or 'general'
  if not (ui.view.kind == 'thread' and ui.view.id == id) then
    M.show({ kind = 'thread', id = id }, { focus = false })
  elseif not valid(M.win.composer) then
    M.apply_view({ focus = false })
  end
  local cw = M.win.composer
  if not valid(cw) then
    return
  end
  api.nvim_set_current_win(cw)
  vim.schedule(function()
    if api.nvim_get_current_win() ~= cw then
      return
    end
    if insert ~= false then
      vim.cmd('startinsert!')
    end
    if prefill then
      api.nvim_feedkeys(prefill, 'n', false)
    end
  end)
end

-- C-v in the picker: the view in a split next to the centre. The split is
-- not managed (close it with :q); the centre stays where it was.
function M.split(view)
  local _, _, _, chat, _, itemview, sessions = mods()
  local centre = M.centre()
  local w
  if view.kind == 'thread' then
    w = api.nvim_open_win(chat.thread_buf(view.id), true, { split = 'right', win = centre })
    centre_opts(w, 'thread')
    chat.read(view.id)
    chat.render(view.id)
    chat.to_tail(w)
  elseif view.kind == 'item' then
    w = api.nvim_open_win(itemview.buf(view.id), true, { split = 'right', win = centre })
    centre_opts(w, 'item')
    itemview.render(view.id, w)
  elseif view.kind == 'session' then
    local tmp = api.nvim_create_buf(false, true)
    vim.bo[tmp].bufhidden = 'wipe'
    w = api.nvim_open_win(tmp, true, { split = 'right', win = centre })
    sessions.show_in(w, view.id)
    centre_opts(w, 'session')
  end
  M.fix()
  state.changed('opened ' .. view.kind .. ' ' .. view.id .. ' in a split (:q closes it)')
end

-- Presets: examples of the three stage artboards, never modes.
M.PRESETS = {
  charting = { items = true, filter = 'map', right = nil, dock = false, view = { kind = 'thread', id = 'general' },
    note = 'stage 1: one chat, the map beside it (items: map · right panel hidden)' },
  watch = { items = true, filter = 'work', right = 'inbox', dock = true, view = { kind = 'thread', id = 't12' },
    note = 'stage 2: topics and inbox open, items filtered to in work' },
  steady = { items = false, right = 'inbox', dock = false, view = { kind = 'board' },
    note = 'stage 3: board centre, inbox right, items and topics hidden' },
}

function M.preset(name)
  local p = M.PRESETS[name]
  if not p then
    vim.notify('cland-proto: :ClandLayout charting|watch|steady', vim.log.levels.ERROR)
    return
  end
  local ui = state.S.ui
  vim.cmd.stopinsert()
  M.close_dock()
  M.close_right()
  M.close_items()
  ui.items_open, ui.right, ui.dock = p.items, p.right, p.dock
  if p.filter then
    ui.filter = p.filter
  end
  if p.items then
    M.open_items()
  end
  if p.right then
    M.open_right(p.right)
  end
  if p.dock then
    M.open_dock()
  end
  M.show(p.view, { focus = true })
  ui.preset = name
  state.changed('layout ' .. name)
  state.say('layout ' .. name .. ': ' .. p.note .. ' · every panel still toggles')
end

function M.build()
  M.win.centre = api.nvim_get_current_win()
  local ui = state.S.ui
  if ui.items_open then
    M.open_items()
  end
  if ui.right then
    M.open_right(ui.right)
  end
  if ui.dock then
    M.open_dock()
  end
  M.apply_view({ initial = true, focus = true })
end

-- A panel closed with :q or CTRL-W c: the state follows the windows.
function M.on_win_closed(win)
  local ui = state.S.ui
  if win == M.win.items then
    M.win.items, ui.items_open = nil, false
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
  state.changed('window closed')
end

function M.render()
  local items, inbox, lists, chat, board, itemview = mods()
  local ui = state.S.ui
  -- the windows follow the state (a closed or missing panel is re-made)
  if ui.items_open and not valid(M.win.items) then
    M.open_items()
  end
  if ui.right and not valid(M.win.right) then
    M.open_right(ui.right)
  end
  if ui.dock and not valid(M.win.dock) then
    M.open_dock()
  end
  items.render(M.win.items)
  if valid(M.win.right) then
    if ui.right == 'inbox' then
      inbox.render('panel', M.win.right)
    elseif ui.right == 'sessions' then
      lists.render_sessions(M.win.right)
    else
      lists.render_topics(M.win.right)
    end
  end
  if valid(M.win.dock) then
    lists.render_topics(M.win.dock)
  end
  chat.render_all()
  for _, w in ipairs(vim.fn.win_findbuf(board.buf())) do
    board.render(w)
  end
  itemview.render_all()
  for _, w in ipairs(vim.fn.win_findbuf(inbox.buf('centre'))) do
    inbox.render('centre', w)
  end
end

return M
