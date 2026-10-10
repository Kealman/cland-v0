-- The three motions (spec section 5): `gi` its item, `gt` its topic, `gs` its session, from every panel
-- and view. What they act on, first match wins:
--   1. a reference under the cursor: an item id (`T-12`), a topic's title or id, a session's name;
--   2. the row under the cursor in a panel (an item, a session, a topic), the card under it on the board;
--   3. the centre view itself (a thread is its topic, a session view its session, an item view its item).
-- Then the dispatch: from a session to its claimed item, from an item to the session claiming it, from a topic
-- to the item it is bound to (#32) and back; a topic's session is its Coordinator.
local api = vim.api
local state = require('cland.state')

local M = {}

--- The word under the cursor, only when the cursor is on it (`<cWORD>` takes the next word on a blank).
local function word_under_cursor()
  local col = api.nvim_win_get_cursor(0)[2]
  local line = api.nvim_get_current_line()
  local ch = line:sub(col + 1, col + 1)
  if ch == '' or ch:match('%s') then
    return nil, line, col
  end
  return vim.fn.expand('<cWORD>'), line, col
end

--- A reference under the cursor: {item=}, {topic=} or {session=}.
function M.token()
  local word, line, col = word_under_cursor()
  if not word then
    return nil
  end
  local id = word:match('%f[%w](%u%-%d+)%f[^%w]')
  if id then
    return { item = id }
  end
  for _, s in ipairs(state.sessions()) do
    local a, b = word:find(s.name, 1, true)
    if a then
      local before, after = word:sub(a - 1, a - 1), word:sub(b + 1, b + 1)
      if not before:match('[%w%-]') and not after:match('[%w%-]') then
        return { session = s.name }
      end
    end
  end
  -- a topic's title may be several words: any title on this line that covers the cursor
  for _, t in ipairs(state.S.topics) do
    for _, needle in ipairs({ t.title, t.id }) do
      local from = 1
      while true do
        local a, b = line:lower():find(needle:lower(), from, true)
        if not a then
          break
        end
        local before, after = line:sub(a - 1, a - 1), line:sub(b + 1, b + 1)
        if a - 1 <= col and col <= b - 1 and not before:match('[%w%-]') and not after:match('[%w%-]') then
          return { topic = t.id }
        end
        from = b + 1
      end
    end
  end
end

--- What the current window's row or view is about.
function M.context()
  local buf = api.nvim_get_current_buf()
  local role = vim.b[buf].cland_role
  local row = api.nvim_win_get_cursor(0)[1]
  if role == 'items' or role == 'sessions' or role == 'topics' or role == 'inbox' or role == 'inbox_full' then
    local info = require('cland.panels').row_at(buf, row)
    if info then
      return info
    end
  elseif role == 'thread' or role == 'composer' then
    return { topic = vim.b[buf].cland_topic, here = 'thread' }
  elseif role == 'session' then
    return { session = vim.b[buf].cland_session, here = 'session' }
  elseif role == 'item' or role == 'plan' then
    return { item = vim.b[buf].cland_item, here = 'item' }
  elseif role == 'board' or role == 'graph' then
    local id = require('cland.' .. role).item_at()
    if id then
      return { item = id }
    end
  end
  -- elsewhere (an empty panel row, a placeholder): the centre view
  local v = state.S.ui.view
  if v.kind == 'thread' then
    return { topic = v.id }
  elseif v.kind == 'session' then
    return { session = v.id }
  elseif v.kind == 'item' or v.kind == 'plan' then
    return { item = v.id }
  end
  return {}
end

function M.subject()
  return M.token() or M.context()
end

function M.item_of(s)
  if s.item then
    return s.item
  end
  if s.session then
    return state.item_of_session(s.session)
  end
  if s.topic then
    local t = state.topic(s.topic)
    if t and t.item and t.item ~= vim.NIL then
      return t.item
    end
  end
end

function M.topic_of(s)
  if s.topic then
    return s.topic
  end
  local it = s.item and state.item(s.item) or (s.session and state.item(state.item_of_session(s.session) or ''))
  if it and it.topic and it.topic ~= vim.NIL then
    return it.topic
  end
  local id = s.item or (s.session and state.item_of_session(s.session))
  local bound = id and state.topic_of_item(id)
  return bound and bound.id or nil
end

function M.session_of(s)
  if s.session then
    return s.session
  end
  if s.item then
    local it = state.item(s.item)
    return it and it.claim and it.claim.session or nil
  end
  if s.topic then
    local c = state.coordinator()
    return c and c.name
  end
end

local function what(s)
  return s.item or (s.topic and ('topic ' .. ((state.topic(s.topic) or {}).title or s.topic))) or s.session or 'this'
end

--- `gi`, `gt`, `gs`: kind is 'item', 'topic' or 'session'.
function M.go(kind, subj)
  subj = subj or M.subject()
  local layout = require('cland.layout')
  local v = state.S.ui.view
  if kind == 'item' then
    local id = M.item_of(subj)
    if not id then
      return state.say('gi: ' .. what(subj) .. ' is bound to no item')
    end
    if v.kind == 'item' and v.id == id and subj.here then
      return state.say('gi: already on ' .. id)
    end
    layout.show({ kind = 'item', id = id }, { insert = false })
  elseif kind == 'topic' then
    local id = M.topic_of(subj)
    if not id then
      return state.say('gt: ' .. what(subj) .. ' has no topic yet')
    end
    if v.kind == 'thread' and v.id == id and subj.here then
      return state.say('gt: already in this topic')
    end
    layout.show({ kind = 'thread', id = id }, { insert = false })
  elseif kind == 'session' then
    local name = M.session_of(subj)
    if not name then
      return state.say('gs: no session works on ' .. what(subj))
    end
    if v.kind == 'session' and v.id == name and subj.here then
      return state.say('gs: already on ' .. name)
    end
    -- gs shows the session in Normal mode; Enter in the sessions panel attaches in Terminal mode
    layout.show({ kind = 'session', id = name }, { insert = false })
  end
end

return M
