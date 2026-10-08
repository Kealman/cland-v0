-- PROTOTYPE (ticket #15, workbench): the three motions (Inbox artboard).
-- gi item · gt topic · gs session, from every panel and view, on the thing
-- under the cursor or the current context: a reference under the cursor
-- (T-12, A-7, rev-1) wins, then the row (item, topic, session, inbox row,
-- card, message), then the centre view itself (thread -> its item, item ->
-- its topic or session, session -> its item or topic).
local api = vim.api
local state = require('cland_proto.state')
local M = {}

-- A reference under the cursor: { item = }, { artifact = } or { session = }.
function M.token()
  -- only a word the cursor is on (<cWORD> would take the next one on a blank)
  local col = api.nvim_win_get_cursor(0)[2]
  local ch = api.nvim_get_current_line():sub(col + 1, col + 1)
  if ch == '' or ch:match('%s') then
    return nil
  end
  local word = vim.fn.expand('<cWORD>')
  if word == '' then
    return nil
  end
  local id = word:match('([TEMQ]%-%d+)')
  if id and state.item(id) then
    return { item = id }
  end
  local art = word:match('(A%-%d+)')
  if art and state.artifact(art) then
    return { artifact = art }
  end
  for _, s in ipairs(state.S.sessions) do
    local a, b = word:find(s.name, 1, true)
    if a then
      local before, after = word:sub(a - 1, a - 1), word:sub(b + 1, b + 1)
      if not before:match('[%w]') and not after:match('[%w%-]') then
        return { session = s.name }
      end
    end
  end
end

-- The row under the cursor in the current buffer, as a subject.
function M.row()
  local buf = api.nvim_get_current_buf()
  local role = vim.b[buf].cland_role
  local row = api.nvim_win_get_cursor(0)[1]
  if role == 'items' then
    local inf = require('cland_proto.items').rows[row]
    return inf and inf.item and { item = inf.item }
  elseif role == 'topics' or role == 'sessions' then
    local inf = (require('cland_proto.lists').rows[buf] or {})[row]
    return inf and (inf.topic and { topic = inf.topic } or inf.session and { session = inf.session })
  elseif role == 'inbox' or role == 'inbox_full' then
    local inf = (require('cland_proto.inbox').rows[buf] or {})[row]
    if not (inf and inf.kind) then
      return nil
    end
    if inf.kind == 'ask' then
      return { ask = inf.ask }
    elseif inf.kind == 'approval' then
      return { session = inf.session }
    elseif inf.kind == 'waiting' then
      return { topic = inf.topic }
    elseif inf.kind == 'note' then
      for _, nt in ipairs(state.S.notes) do
        if nt.id == inf.note and nt.target then
          return { [nt.target[1]] = nt.target[2] }
        end
      end
    end
  elseif role == 'board' then
    local id = require('cland_proto.board').item_at()
    return id and { item = id }
  elseif role == 'item' then
    local inf = (require('cland_proto.itemview').rows[buf] or {})[row]
    if inf and inf.item then
      return { item = inf.item }
    elseif inf and inf.session then
      return { session = inf.session, item = vim.b[buf].cland_item }
    end
    return { item = vim.b[buf].cland_item, here = 'item' }
  elseif role == 'thread' then
    local tid = vim.b[buf].cland_topic
    local inf = require('cland_proto.chat').row_info(buf, row)
    local subj = { topic = tid, here = 'thread' }
    if inf and inf.ask then
      subj.ask = inf.ask
    end
    if inf and inf.artifact then
      subj.artifact = inf.artifact
    end
    local m = inf and inf.msg
    if m and m.from and m.from ~= 'you' and state.session(m.from) then
      subj.sender = m.from
    end
    return subj
  elseif role == 'composer' then
    return { topic = vim.b[buf].cland_topic, here = 'thread' }
  elseif role == 'session' then
    return { session = vim.b[buf].cland_session, here = 'session' }
  end
end

function M.subject()
  return M.token() or M.row() or {}
end

function M.item_of(s)
  if s.item then
    return s.item
  end
  if s.ask then
    local a = state.ask(s.ask)
    if a and a.item then
      return a.item
    end
  end
  if s.topic then
    local t = state.topic(s.topic)
    if t and t.item then
      return t.item
    end
  end
  if s.session then
    local ss = state.session(s.session)
    return ss and ss.item
  end
  if s.artifact then
    local a = state.artifact(s.artifact)
    local t = a and a.topic and state.topic(a.topic)
    return t and t.item
  end
end

function M.topic_of(s)
  if s.topic then
    return s.topic
  end
  if s.ask then
    local a = state.ask(s.ask)
    return a and a.topic
  end
  if s.artifact then
    local a = state.artifact(s.artifact)
    return a and a.topic
  end
  local item = s.item or (s.session and M.item_of({ session = s.session }))
  local t = item and state.topic_of_item(item)
  return t and t.id
end

function M.session_of(s)
  if s.session then
    return s.session
  end
  if s.sender then
    return s.sender
  end
  local item = M.item_of(s)
  local it = item and state.item(item)
  if it and it.claim and state.session(it.claim) then
    return it.claim
  end
  if s.ask then
    local a = state.ask(s.ask)
    return a and (a.raised_by or a.from)
  end
  if s.topic and not item then
    local h = state.holder('Coordinator')
    return h and h.name
  end
end

local function what(s)
  return s.item or (s.topic and ('topic ' .. ((state.topic(s.topic) or {}).title or s.topic))) or s.session
    or (s.ask and ('ask #' .. s.ask)) or s.artifact or 'this'
end

function M.go(kind, subj)
  subj = subj or M.subject()
  local layout = require('cland_proto.layout')
  local v = state.S.ui.view
  if kind == 'item' then
    local id = M.item_of(subj)
    if not id then
      vim.notify('cland-proto: gi: ' .. what(subj) .. ' is bound to no item', vim.log.levels.INFO)
    elseif v.kind == 'item' and v.id == id and subj.here then
      vim.notify('cland-proto: gi: already on ' .. id .. ' (gt its topic, gs its session)', vim.log.levels.INFO)
    else
      layout.show({ kind = 'item', id = id })
    end
  elseif kind == 'topic' then
    local id = M.topic_of(subj)
    if not id then
      local item = M.item_of(subj)
      vim.notify(('cland-proto: gt: %s has no topic yet; a task\'s topic appears with its first message (#7)'):format(
        item or what(subj)), vim.log.levels.INFO)
    elseif v.kind == 'thread' and v.id == id and subj.here == 'thread' then
      vim.notify('cland-proto: gt: already in this topic (gi its item, gs its session)', vim.log.levels.INFO)
    else
      layout.show({ kind = 'thread', id = id })
    end
  elseif kind == 'session' then
    local name = M.session_of(subj)
    if not name then
      vim.notify('cland-proto: gs: no session works on ' .. what(subj), vim.log.levels.INFO)
    elseif v.kind == 'session' and v.id == name and subj.here then
      vim.notify('cland-proto: gs: already attached to ' .. name .. ' (gi its item, gt its topic)', vim.log.levels.INFO)
    else
      layout.show({ kind = 'session', id = name })
    end
  end
end

-- Enter on a reference in a thread or the item view.
function M.open_token()
  local t = M.token()
  if not t then
    return false
  end
  local layout = require('cland_proto.layout')
  if t.artifact then
    require('cland_proto.artifacts').open(t.artifact)
  elseif t.item then
    layout.show({ kind = 'item', id = t.item })
  elseif t.session then
    layout.show({ kind = 'session', id = t.session })
  end
  return true
end

return M
