-- The top bar's single needs-you count: the inbox's now events plus unread now messages.
-- Message placement is defined only by message_layer; reads and pushed frames keep this projection.
local state = require('cland.state')
local layer = require('cland.message_layer').layer
local M = {}

local topics, asks = {}, {}

local function topic(id)
  if not topics[id] then topics[id] = { unread = {}, order = {}, seen = {}, reads = 0, last_read = 0 } end
  return topics[id]
end

local function in_view(id)
  local v = state.S.ui.view
  return v.kind == 'thread' and v.id == id
end

local function suffix(messages, ids, remaining)
  if #ids <= remaining then return messages, ids end
  local unread, order = {}, {}
  for i = #ids - remaining + 1, #ids do
    local mid = ids[i]
    unread[mid], order[#order + 1] = messages[mid], mid
  end
  return unread, order
end

function M.read(id, remaining)
  local t = topic(id)
  remaining = remaining or 0
  t.reads, t.last_read = t.reads + 1, remaining
  local unread, order = suffix(t.unread, t.order, remaining)
  if unread ~= t.unread then
    t.unread, t.order = unread, order
    state.changed()
  end
end

function M.answered(id)
  asks[id] = nil
  state.changed()
end

local function message(id, m)
  if not m or not m.id or m.fromKind == 'human' then return end
  local t = topic(id)
  if t.seen[m.id] then return end
  t.seen[m.id] = true
  if type(m.ask) == 'table' then
    if m.ask.state == 'open' then asks[m.id] = m end
  end
  if not in_view(id) then
    t.unread[m.id] = m
    t.order[#t.order + 1] = m.id
  end
  state.changed()
end

function M.count()
  local n, open = state.needs_you(), {}
  for _, a in ipairs(state.S.inbox.asks) do open[a.id] = true end
  for id, m in pairs(asks) do
    if not open[id] and layer(m) == 'now' then n = n + 1 end
  end
  for _, t in pairs(topics) do
    for _, m in pairs(t.unread) do
      if type(m.ask) ~= 'table' and not open[m.id] and layer(m) == 'now' then n = n + 1 end
    end
  end
  return n
end

--- Seed unread messages on connecting, from the same latest-200 history as the thread.
--- Live frames need no history request; recovery refreshes preserve known live messages.
function M.refresh(client, rows)
  for _, row in ipairs(rows) do
    local id = row.id
    if (tonumber(row.unread) or 0) == 0 or in_view(id) then
      M.read(id)
    else
      local reads = topic(id).reads
      local initial_order = vim.list_extend({}, topic(id).order)
      client:snapshot({ type = 'topic.history', topic = id, limit = 200 }, function(err, value)
        if err or not value then return end
        local t, remaining = topic(id), tonumber(value.topic and value.topic.unread) or 0
        local history = value.messages or {}
        for _, m in ipairs(history) do if m.id then t.seen[m.id] = true end end
        if t.reads ~= reads then
          -- A full read discards the old reply. A partial read still needs the unloaded suffix:
          -- recover once from its authoritative watermark, instead of replaying a stale count.
          local current = state.topic(id)
          if t.last_read > 0 and current and (tonumber(current.unread) or 0) > 0 and not in_view(id) then
            M.refresh(client, { current })
          end
          return
        end
        local unread, order, in_history, retained = {}, {}, {}, {}
        local function add(m)
          if not unread[m.id] then
            unread[m.id], order[#order + 1] = m, m.id
          end
        end
        -- Topic.unread counts messages from others; the history's suffix uses that same watermark.
        for _, m in ipairs(history) do
          if m.id then in_history[m.id] = true end
        end
        for i = #history, 1, -1 do
          local m = history[i]
          if m.fromKind ~= 'human' then
            if remaining <= 0 then break end
            remaining = remaining - 1
            retained[m.id] = true
          end
        end
        -- Merge the current live set, not the one captured before the request: a retry can
        -- discard its journal, but never unread ids already accepted by message handlers.
        -- Shared history ids anchor chronological order so later partial reads keep the suffix.
        local positions, last_shared, cursor = {}, nil, 1
        for i, m in ipairs(history) do
          if retained[m.id] then
            positions[m.id] = i
            if t.unread[m.id] then last_shared = i end
          end
        end
        local function history_through(last)
          for i = cursor, last do
            local m = history[i]
            if retained[m.id] then add(m) end
          end
          cursor = last + 1
        end
        if not last_shared then
          for _, mid in ipairs(initial_order) do
            if t.unread[mid] and not in_history[mid] then add(t.unread[mid]) end
          end
          history_through(#history)
        end
        for _, mid in ipairs(t.order) do
          local pos = positions[mid]
          if pos then
            history_through(pos)
            if pos == last_shared then history_through(#history) end
          elseif not in_history[mid] then
            add(t.unread[mid])
          end
        end
        t.unread, t.order = unread, order
        for mid in pairs(unread) do t.seen[mid] = true end
        state.changed()
      end)
    end
  end
end

function M.setup(client)
  topics, asks = {}, {}
  client:on('connected', function() topics, asks = {}, {} end)
  client:on('message', function(e)
    if e.topic and e.topic.id then message(e.topic.id, e.message) end
  end)
  client:on('topic', function(e)
    local row = e.topic
    if not row or not row.id or type(row.unread) ~= 'number' then return end
    local previous = state.topic(row.id)
    if row.unread == 0 or previous and row.unread < (tonumber(previous.unread) or 0) then
      M.read(row.id, row.unread)
    end
  end)
  client:on('ask', function(e)
    if type(e.card) == 'table' and e.card.state ~= 'open' then M.answered(e.ask) end
  end)
  client:on('inbox', function(e)
    local open = {}
    for _, a in ipairs(e.inbox and e.inbox.asks or {}) do open[a.id] = true end
    for id in pairs(asks) do if not open[id] then asks[id] = nil end end
  end)
end

return M
