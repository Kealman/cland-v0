-- The inbox (spec section 5, Inbox.dc.html, #33): in the right panel (␣n) and full width in the centre (␣N). Four
-- sections in a fixed order, what only the human can unblock first:
--   ASKS            the Coordinator's open asks: `1`–`9` answer with that option, `i` a free answer in the topic's
--                   composer, ↵ opens the topic
--   APPROVALS       sessions waiting for approval: ↵ attaches the session in the centre, where its harness asks
--   WAITING FOR YOU topics waiting for the human without an open ask: ↵ opens the topic
--   NOTIFICATIONS   verdicts, role changes, deaths, long idles: `d` dismisses one, `D` all; ↵ opens the item or
--                   the session it names
-- Asks and approvals are never dismissed. Everything comes from the hub (`inbox.list`, the `inbox` event) and
-- renders through `state.changed()`, so no update ever raises a prompt.
local api = vim.api
local state = require('cland.state')
local ask_card = require('cland.ask_card')

local M = {}

--- Each notification kind's glyph and colour.
M.GLYPH = {
  verdict = { '✓', 'ClandGreen' },
  ['verdict not clear'] = { '✗', 'ClandRed' },
  role = { '↔', 'ClandBlue' },
  death = { '!', 'ClandRed' },
  idle = { '○', 'ClandDim' },
}

local function clock(ts)
  return require('cland.thread').clock(ts)
end

local function section(c, name, count, extra, amber)
  c:add({ { ' ' .. name:upper() .. (extra or ''), amber and 'ClandAmber' or 'ClandSection' } }, { { tostring(count) .. ' ', amber and 'ClandAmber' or 'ClandDim' } })
end

local function notification_glyph(n)
  if n.kind == 'verdict' and n.result == 'not clear' then
    return M.GLYPH['verdict not clear']
  end
  return M.GLYPH[n.kind] or { '·', 'ClandDim' }
end

--- Draw the inbox into canvas `c` (a panels canvas); `full` is the centre view. Returns the footer lines.
function M.render(c, full)
  local ib = state.S.inbox
  local n = state.needs_you()
  if n == 0 then
    c:add({ { ' ✓ nothing needs you', 'ClandGreen' } })
  end
  if #ib.asks > 0 then
    c:add({})
    section(c, 'asks · answer here', #ib.asks, nil, true)
    for _, a in ipairs(ib.asks) do
      local ask = { id = a.id, topic = a.topic and a.topic.id, question = a.question, options = a.options or {}, free = a.free }
      local where = a.topic and ((a.topic.item and a.topic.item ~= vim.NIL) and a.topic.item or a.topic.title) or ''
      c:add({ { ' ? ', 'ClandAmber' }, { where, 'ClandBlue' } }, { { tostring(a.label or state.label(a.from or '', a.fromRole)) .. ' · ' .. clock(a.ts) .. ' ', 'ClandDim' } }, { ask = ask, topic = ask.topic, session = a.from })
      for _, l in ipairs(ask_card.split(a.question)) do
        c:add({ { '   ' .. l, 'ClandBold' } }, nil, { ask = ask, topic = ask.topic, session = a.from })
      end
      for i, o in ipairs(a.options or {}) do
        for k, l in ipairs(ask_card.split(o)) do
          local badge = k == 1 and { ' ' .. i .. ' ', 'ClandBadgeN' } or { (' '):rep(#tostring(i) + 2) }
          c:add({ { '   ' }, badge, { ' ' .. l } }, nil, { ask = ask, topic = ask.topic, option = i })
        end
      end
      c:add({ { '   ' .. (a.free ~= false and 'i free answer · ' or '') .. '↵ open the topic', 'ClandFaint' } }, nil, { ask = ask, topic = ask.topic })
    end
  end
  if #ib.approvals > 0 then
    c:add({})
    section(c, 'approvals · answer in the session', #ib.approvals, nil, true)
    for _, p in ipairs(ib.approvals) do
      c:add({ { ' ▲ ', 'ClandAmber' }, { tostring(p.label or p.session), 'ClandBold' } }, { { '↵ attach ', 'ClandDim' } }, { session = p.session, approval = true })
    end
  end
  if #ib.waiting > 0 then
    c:add({})
    section(c, 'waiting for you · topics', #ib.waiting, nil, true)
    for _, t in ipairs(ib.waiting) do
      local right = {}
      local unread = tonumber(t.unread) or 0
      if unread > 0 then
        right[#right + 1] = { ' ' .. unread .. ' ', 'ClandBadge' }
        right[#right + 1] = { ' ' }
      end
      right[#right + 1] = { clock(t.lastMessageAt ~= vim.NIL and t.lastMessageAt or t.updatedAt) .. ' ', 'ClandDim' }
      c:add({ { ' ● ', 'ClandAmber' }, { tostring(t.title) } }, right, { topic = t.id })
    end
  end
  if #ib.notifications > 0 then
    c:add({})
    section(c, 'notifications', #ib.notifications, ' · d dismiss · D all')
    for _, note in ipairs(ib.notifications) do
      local g = notification_glyph(note)
      c:add({ { ' ' .. g[1] .. ' ', g[2] }, { tostring(note.text) } }, { { clock(note.ts) .. ' ', 'ClandDim' } }, { notification = note.id, item = note.item, session = note.session })
    end
  end
  if full then
    return { ' 1-9 answer · i free answer · ↵ open or attach · d dismiss · D all · ␣N or ␣␣ back' }
  end
  return { ' 1-9 answer · i free · ↵ act · d/D dismiss · ␣N full width' }
end

-- Acting from a row ------------------------------------------------------------------------------------------

local function row(buf)
  return require('cland.panels').row_at(buf, api.nvim_win_get_cursor(0)[1])
end

local function request(frame)
  local client = require('cland.views').client
  if not (client and client:connected()) then
    return state.say(frame.type .. ': the hub is not connected', 'ClandRedBar')
  end
  client:request(frame, function(err, value)
    if err then
      return state.say(frame.type .. ': ' .. tostring(err), 'ClandRedBar')
    end
    state.set_inbox(value)
  end)
end

--- ↵: the topic of an ask or a waiting topic, the attached session of an approval, the item (else the session) of a
--- notification.
function M.open(buf)
  local info = row(buf)
  if not info then
    return
  end
  local layout = require('cland.layout')
  if info.approval and info.session then
    layout.show({ kind = 'session', id = info.session }, { insert = true })
  elseif info.topic then
    layout.show({ kind = 'thread', id = info.topic }, { insert = false })
  elseif info.item then
    layout.show({ kind = 'item', id = info.item }, { insert = false })
  elseif info.session then
    layout.show({ kind = 'session', id = info.session }, { insert = false })
  end
end

--- d: dismiss the notification under the cursor; asks and approvals stay until they are answered.
function M.dismiss(buf)
  local info = row(buf)
  if info and info.notification then
    -- gone at once; the hub's answer (and its `inbox` event) is the inbox as it now is
    local list = state.S.inbox.notifications
    for i, note in ipairs(list) do
      if note.id == info.notification then
        table.remove(list, i)
        break
      end
    end
    state.changed()
    return request({ type = 'inbox.dismiss', notification = info.notification })
  end
  if info and (info.ask or info.approval) then
    return state.say('asks and approvals are not dismissed: answer them (1-9, i, or ↵ to attach)', 'ClandAmberBar')
  end
  state.say('d dismisses a notification')
end

function M.dismiss_all()
  if #state.S.inbox.notifications == 0 then
    return state.say('no notifications to dismiss')
  end
  state.S.inbox.notifications = {}
  state.changed()
  request({ type = 'inbox.dismiss_all' })
end

--- The inbox's keys on `buf` (the panel's buffer or the full-width one).
function M.keys(buf)
  local function map(lhs, fn, desc)
    vim.keymap.set('n', lhs, fn, { buffer = buf, nowait = true, silent = true, desc = 'cland: ' .. desc })
  end
  map('<CR>', function()
    M.open(buf)
  end, 'open or attach')
  map('d', function()
    M.dismiss(buf)
  end, 'dismiss the notification')
  map('D', M.dismiss_all, 'dismiss every notification')
  require('cland.ask_card').keys(buf, function(r)
    local info = require('cland.panels').row_at(buf, r)
    return info and info.ask or nil
  end)
end

-- The full-width view ----------------------------------------------------------------------------------------

function M.full_buf()
  local b = M.full
  if b and api.nvim_buf_is_valid(b) then
    return b
  end
  b = api.nvim_create_buf(false, true)
  vim.bo[b].bufhidden = 'hide'
  vim.bo[b].modifiable = false
  pcall(api.nvim_buf_set_name, b, 'cland://inbox')
  vim.b[b].cland_role = 'inbox_full'
  M.full = b
  M.keys(b)
  M.render_full()
  return b
end

--- Draw the full-width inbox into every window showing it.
function M.render_full()
  local b = M.full
  if not (b and api.nvim_buf_is_valid(b)) then
    return
  end
  local wins = vim.fn.win_findbuf(b)
  local panels = require('cland.panels')
  local width = #wins > 0 and api.nvim_win_get_width(wins[1]) or 80
  local c = panels.canvas(math.min(width, 120))
  local footer = M.render(c, true)
  c:add({})
  for _, f in ipairs(footer) do
    c:add({ { f, 'ClandFaint' } })
  end
  panels.rows[b] = c:apply(b)
  for _, w in ipairs(wins) do
    local cur = api.nvim_win_get_cursor(w)
    pcall(api.nvim_win_set_cursor, w, { math.min(cur[1], #c.lines), 0 })
  end
end

return M
