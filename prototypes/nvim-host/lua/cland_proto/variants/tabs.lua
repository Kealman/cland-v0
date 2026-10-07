-- PROTOTYPE (ticket #15), variant D "tabs": one Neovim tab page per topic.
-- The tabline carries title, status glyph and unread count; inside a tab a
-- thread and a composer; a persistent status bar (the statusline) with the
-- sessions and the Coordinator; an open ask pops up as a float.
--
--   [● T-12 UI socket… 1][○ General 2][≡ Agents 5][◐ T-15 OpenCode…]…
--   +-----------------------------------------------------------------+
--   | THREAD                        +--- Ask · coord ---+             |
--   |                               | 1 … 2 … 3 … 4 ✎  |             |
--   |                               +-------------------+             |
--   +-----------------------------------------------------------------+
--   | COMPOSER                                                        |
--   +-----------------------------------------------------------------+
--   C coord ◐ busy · I impl-1 ○ idle · …        Coordinator coord: busy
local api = vim.api
local state = require('cland_proto.state')
local chat = require('cland_proto.chat')
local sessions = require('cland_proto.sessions')

local V = {
  thread_style = 'full',
  ask_style = 'float',
  tagline = 'one tab per topic (glyph + unread in the tabline), thread and composer inside, sessions in the status bar',
  help = {
    'gt / gT         next / previous tab (or click a tab)',
    '<Space>t        topics picker → its tab · <Space>s sessions picker → a session tab',
    'Ask float       opens when you enter a tab with an open ask: 1-3 answer · 4 own answer · q later',
    '<Space>a        the open ask (goes to its tab and opens the float)',
  },
}

local function app()
  return require('cland_proto.app')
end

local function tab_of(key, value)
  for _, tab in ipairs(api.nvim_list_tabpages()) do
    if vim.t[tab][key] == value then
      return tab
    end
  end
end

local function wins_of(tab)
  local thread, composer
  for _, w in ipairs(api.nvim_tabpage_list_wins(tab)) do
    if api.nvim_win_get_config(w).relative == '' then
      local role = vim.b[api.nvim_win_get_buf(w)].cland_role
      if role == 'thread' then
        thread = w
      elseif role == 'composer' then
        composer = w
      end
    end
  end
  return thread, composer
end

-- Stable tab order: as created, closed topics last.
local function order()
  local list = {}
  for _, t in ipairs(state.S.topics) do
    if t.status ~= 'closed' then
      list[#list + 1] = t
    end
  end
  for _, t in ipairs(state.S.topics) do
    if t.status == 'closed' then
      list[#list + 1] = t
    end
  end
  return list
end

local function fill_tab(t)
  local w = api.nvim_get_current_win()
  api.nvim_win_set_buf(w, chat.thread_buf(t.id))
  local c = api.nvim_open_win(chat.composer(t.id), false, { split = 'below', win = w, height = 5 })
  vim.t.cland_topic = t.id
  vim.wo[w].wrap, vim.wo[w].linebreak, vim.wo[w].breakindent = true, true, true
  vim.wo[c].winfixheight = true
  vim.wo[c].wrap = true
  chat.to_tail(w)
end

local function new_tab_for(t)
  vim.cmd('silent $tab sbuffer ' .. chat.thread_buf(t.id)) -- always the last tab
  fill_tab(t)
end

local building = false

local function on_tab_enter()
  if building then
    return
  end
  require('cland_proto.switcher').pill()
  local tid = vim.t.cland_topic
  if tid then
    chat.view(tid)
    local a = state.open_asks(tid)[1]
    if a then
      vim.schedule(function()
        if vim.t.cland_topic == tid then
          local thread = wins_of(api.nvim_get_current_tabpage())
          require('cland_proto.ask').float(a.id, thread)
        end
      end)
    end
  elseif vim.t.cland_session then
    state.S.active_session = vim.t.cland_session
    state.changed()
  end
end

function V.build()
  building = true
  local list = order()
  for i, t in ipairs(list) do
    if i == 1 then
      fill_tab(t)
    else
      new_tab_for(t)
    end
  end
  vim.o.showtabline = 2
  building = false
  local group = require('cland_proto.switcher').augroup()
  api.nvim_create_autocmd('TabEnter', { group = group, callback = on_tab_enter })
  local tab = tab_of('cland_topic', state.S.current_topic) or api.nvim_list_tabpages()[1]
  if tab == api.nvim_get_current_tabpage() then
    on_tab_enter()
  else
    api.nvim_set_current_tabpage(tab)
  end
  local _, composer = wins_of(api.nvim_get_current_tabpage())
  if composer and not require('cland_proto.ask').is_open() then
    api.nvim_set_current_win(composer)
  end
end

-- Topics created while D is shown (:ClandSim ask) get a tab at the end.
function V.render()
  if building then
    return
  end
  for _, t in ipairs(state.S.topics) do
    if not tab_of('cland_topic', t.id) then
      local cur = api.nvim_get_current_tabpage()
      local curwin = api.nvim_get_current_win()
      building = true
      new_tab_for(t)
      building = false
      api.nvim_set_current_tabpage(cur)
      if api.nvim_win_is_valid(curwin) then
        api.nvim_set_current_win(curwin)
      end
    end
  end
end

function V.open_topic(id)
  local tab = tab_of('cland_topic', id)
  if not tab then
    V.render()
    tab = tab_of('cland_topic', id)
  end
  if tab then
    if tab == api.nvim_get_current_tabpage() then
      on_tab_enter()
    else
      api.nvim_set_current_tabpage(tab)
    end
  end
end

function V.open_session(name)
  local tab = tab_of('cland_session', name)
  if tab then
    api.nvim_set_current_tabpage(tab)
    return
  end
  building = true
  local s = state.session(name)
  if s.buf and api.nvim_buf_is_valid(s.buf) then
    vim.cmd('silent $tab sbuffer ' .. s.buf)
  else
    vim.cmd('silent $tabnew')
    local empty = api.nvim_get_current_buf()
    sessions.show_in(api.nvim_get_current_win(), name)
    if api.nvim_buf_is_valid(empty) and empty ~= api.nvim_get_current_buf() then
      pcall(api.nvim_buf_delete, empty, { force = true })
    end
  end
  vim.t.cland_session = name
  building = false
  on_tab_enter()
end

function V.jump_ask(a)
  V.open_topic(a.topic)
end

function V.composer_win(id)
  if id and vim.t.cland_topic ~= id then
    V.open_topic(id)
  end
  local _, composer = wins_of(api.nvim_get_current_tabpage())
  return composer
end

function V.tabline()
  local tabs = api.nvim_list_tabpages()
  local cur = api.nvim_get_current_tabpage()
  local per = math.max(14, math.floor(vim.o.columns / #tabs) - 1)
  local parts = {}
  for i, tab in ipairs(tabs) do
    local sel = tab == cur
    local base = sel and 'TabLineSel' or 'TabLine'
    local s = '%' .. i .. 'T%#' .. base .. '# '
    local tid, sname = vim.t[tab].cland_topic, vim.t[tab].cland_session
    if tid then
      local t = state.topic(tid)
      local st = chat.status(t)
      local unread = (t.unread or 0) > 0 and (' ' .. t.unread .. ' ') or ''
      local title = chat.label(t, per - 4 - #unread)
      s = s .. '%#' .. st.hl .. (sel and 'Sel' or 'Bar') .. '#' .. st.icon .. '%#' .. base .. '# ' .. title:gsub('%%', '%%%%') .. ' '
      if unread ~= '' then
        s = s .. '%#ClandUnread#' .. unread .. '%#' .. base .. '# '
      end
    elseif sname then
      local ss = state.session(sname)
      local st = sessions.st(ss)
      s = s .. '▣ ' .. sname .. ' %#' .. st.hl .. (sel and 'Sel' or 'Bar') .. '#' .. st.icon .. '%#' .. base .. '# '
    end
    parts[#parts + 1] = s
  end
  return table.concat(parts) .. '%#TabLineFill#%T'
end

function V.statusline()
  local narrow = vim.o.columns < 190
  local left = { { ' cland ', 'ClandBrand' }, { ' ', 'StatusLine' } }
  vim.list_extend(left, sessions.summary_chunks({ sep = ' ', short = narrow }))
  local coord = state.holder('Coordinator')
  local needs = #state.needs_you()
  local right = {}
  if coord then
    local st = sessions.st(coord)
    local doing = coord.status_line or ''
    if vim.fn.strchars(doing) > 26 then
      doing = vim.fn.strcharpart(doing, 0, 25) .. '…'
    end
    right[#right + 1] = { narrow and ' ' or ' Coordinator ', 'ClandDimBar' }
    right[#right + 1] = { coord.name .. ' ', 'ClandRoleCoordBar' }
    right[#right + 1] = { st.icon .. ' ' .. coord.state .. ' ' .. state.ago(coord.since), st.hl .. 'Bar' }
    right[#right + 1] = { (coord.item and (' · ' .. coord.item) or '') .. (narrow and ' ' or (' · "' .. doing .. '" ')), 'ClandDimBar' }
  else
    right[#right + 1] = { ' ⚠ no coordinator: messages wait in the hub ', 'ClandWarn' }
  end
  right[#right + 1] = { needs > 0 and (' ● ' .. needs .. ' ') or ' ✓ ', needs > 0 and 'ClandWarn' or 'ClandOpenBar' }
  return left, right
end

return V
