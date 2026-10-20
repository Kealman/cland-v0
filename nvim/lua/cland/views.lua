-- The centre views other than the session terminal: one topic view per topic (thread and composer), the
-- item view and the board (item_view.lua, board.lua, #36), the Agents log (`agents_log.lua`, #34), and the
-- inbox full width (`inbox.lua`, #33). A placeholder already names its view, so the view switch, the top
-- bar, the status line and `␣␣` work on it today.
local api = vim.api
local state = require('cland.state')

local M = { topics = {}, bufs = {} }

local ns = api.nvim_create_namespace('cland.views')

function M.setup(client)
  M.client = client
  require('cland.agents_log').setup(client)
  require('cland.artifacts').setup(client)
  require('cland.rulebook').setup(client)
end

--- The topic view of `id`, made on first use.
function M.topic(id)
  local tv = M.topics[id]
  if tv then
    return tv
  end
  local t = state.topic(id) or { id = id, title = id == 'general' and 'General' or id == 'agents' and 'Agents' or id }
  tv = require('cland.topic_view').new(M.client, { id = t.id, title = t.title })
  M.topics[id] = tv
  return tv
end

-- Topic actions (spec 4.5): the human creates, closes and resolves topics and reads them -------------------

--- The topic the human means: the row under the cursor in a topics panel, else the thread in the centre.
function M.current_topic()
  local buf = api.nvim_get_current_buf()
  if vim.b[buf].cland_role == 'topics' then
    local info = require('cland.panels').row_at(buf, api.nvim_win_get_cursor(0)[1])
    if info and info.topic then
      return info.topic
    end
  end
  -- A palette object may be focused in a split while the centre shows another topic.
  -- Resolve thread/composer/list/artifact actions from that buffer before the centre fallback.
  if vim.b[buf].cland_topic then return vim.b[buf].cland_topic end
  if vim.b[buf].cland_artifact then
    local a = require('cland.artifacts').get(vim.b[buf].cland_artifact)
    if a then return a.topic end
  end
  local v = state.S.ui.view
  if v.kind == 'log' then return 'agents' end
  if v.kind == 'artifact' then
    local a = require('cland.artifacts').get(v.id)
    return a and a.topic or nil
  end
  return (v.kind == 'thread' or v.kind == 'artifacts') and v.id or nil
end

local function request(frame, done)
  if not (M.client and M.client:connected()) then
    state.say(frame.type .. ': the hub is not connected', 'ClandRedBar')
    return
  end
  M.client:request(frame, function(err, value)
    if err then
      return state.say(frame.type .. ': ' .. tostring(err), 'ClandRedBar')
    end
    if value and value.topic then
      state.upsert_topic(value.topic)
    end
    if done then
      done(value and value.topic)
    end
  end)
end

--- The human read topic `id` (its thread is in view): the hub clears its unread count.
function M.mark_read(id, up_to)
  -- A row reply leaves on sending its answer. Opening its composer keeps that wait intact.
  local tv = M.topics[id]
  if tv and tv.composer.replying then return end
  local t = state.topic(id)
  if not t or (tonumber(t.unread) or 0) == 0 and not up_to then
    return
  end
  t.unread = 0
  state.changed()
  if M.client and M.client:connected() then
    M.client:request({ type = 'topic.read', topic = id, upTo = up_to }, function(err, value)
      if not err and value and value.topic then
        state.upsert_topic(value.topic)
      end
    end)
  end
end

--- A new topic with `title`, opened in the centre once the hub made it.
function M.create_topic(title)
  title = vim.trim(title or '')
  if title == '' then
    return state.say('a topic needs a title: :Cland topic new <title>', 'ClandRedBar')
  end
  request({ type = 'topic.create', title = title }, function(topic)
    if topic then
      state.say('topic opened: ' .. topic.title)
      require('cland.layout').show({ kind = 'thread', id = topic.id })
    end
  end)
end

--- Ask for a title, then create the topic.
function M.prompt_topic()
  vim.ui.input({ prompt = 'New topic: ' }, function(title)
    if title and vim.trim(title) ~= '' then
      M.create_topic(title)
    end
  end)
end

--- Close topic `id` (default: the one the human means); a new message reopens it.
function M.close_topic(id)
  id = id or M.current_topic()
  if not id then
    return state.say('no topic here to close', 'ClandRedBar')
  end
  request({ type = 'topic.close', topic = id }, function(topic)
    if topic then
      state.say('closed: ' .. topic.title)
    end
  end)
end

--- Clear topic `id`'s wait back to open.
function M.resolve_topic(id)
  id = id or M.current_topic()
  if not id then
    return state.say('no topic here to resolve', 'ClandRedBar')
  end
  request({ type = 'topic.resolve', topic = id }, function(topic)
    if topic then
      state.say('resolved: ' .. topic.title .. ' is open')
    end
  end)
end

M.TITLES = {
  board = 'Board',
  events = 'Events',
  rulebook = 'Rulebook',
  rule_compose = 'Rule draft · :w saves · q back',
  verification = 'Verification queue',
  log = 'Agents log',
  inbox = 'Inbox · full width',
}

--- The title of a view, as the top bar shows it.
function M.title(v)
  if v.kind == 'artifact' then
    local a = require('cland.artifacts').get(v.id)
    return a and (a.id .. ' · ' .. a.title) or v.id
  elseif v.kind == 'artifacts' then
    return 'Artifacts · ' .. (v.id or '')
  elseif v.kind == 'thread' then
    local t = state.topic(v.id)
    return t and t.title or (v.id == 'general' and 'General' or v.id)
  elseif v.kind == 'session' then
    local s = state.session(v.id)
    return s and s.label or v.id
  elseif v.kind == 'explorer' then
    return 'Explorer · ' .. require('cland.explorer').title(v.id)
  elseif v.kind == 'plan' then
    local it = state.item(v.id)
    return v.id .. (it and (' ' .. it.title) or '') .. ' · plan'
  elseif v.kind == 'item' then
    local it = state.item(v.id)
    return v.id .. (it and (' ' .. it.title) or '')
  end
  return M.TITLES[v.kind] or v.kind
end

local function key(v)
  return v.kind .. (v.id and (':' .. v.id) or '')
end

--- The buffer of a centre view other than a thread or a session: the item view and the board (#36), the Agents
--- log (#34), the inbox full width (#33), else a placeholder.
function M.placeholder(v, win)
  if v.kind == 'rulebook' then return require('cland.rulebook').buffer() end
  if v.kind == 'rule_compose' then return require('cland.rulebook').compose_buffer(v.id) end
  if v.kind == 'explorer' then return require('cland.explorer').render(v) end
  if v.kind == 'events' then return require('cland.events').buffer() end
  if v.kind == 'plan' and v.id then return require('cland.plan').render(v.id) end
  if v.kind == 'artifact' then
    return require('cland.artifacts').buffer(v.id, v.file, win)
  elseif v.kind == 'artifacts' then
    return require('cland.artifacts').list_buffer(v.id)
  elseif v.kind == 'item' and v.id then
    return require('cland.item_view').render(v.id)
  elseif v.kind == 'board' then
    return require('cland.board').render()
  elseif v.kind == 'graph' then
    return require('cland.graph').render()
  elseif v.kind == 'log' then
    return require('cland.agents_log').buffer()
  elseif v.kind == 'inbox' then
    -- the inbox full width is the inbox's own buffer (#33)
    return require('cland.inbox').full_buf()
  end
  local k = key(v)
  local b = M.bufs[k]
  if not (b and api.nvim_buf_is_valid(b)) then
    b = api.nvim_create_buf(false, true)
    vim.bo[b].bufhidden = 'hide'
    vim.bo[b].modifiable = false
    pcall(api.nvim_buf_set_name, b, 'cland://' .. k:gsub(':', '/'))
    vim.b[b].cland_role = v.kind == 'inbox' and 'inbox_full' or v.kind
    if v.id then
      vim.b[b].cland_item = v.kind == 'item' and v.id or nil
    end
    if v.kind == 'verification' then
      require('cland.actions').map('n', 'q', require('cland.layout').back, { buffer = b, nowait = true, silent = true })
    end
    M.bufs[k] = b
  end
  M.render_placeholder(v)
  return b
end

local function lines_for(v)
  if v.kind == 'verification' then return require('cland.verification').lines() end
  return { '', ' ' .. v.kind }
end

function M.render_placeholder(v)
  if v.kind == 'rulebook' then return require('cland.rulebook').render() end
  if v.kind == 'rule_compose' then return end
  if v.kind == 'explorer' then return require('cland.explorer').render(v) end
  if v.kind == 'events' then return require('cland.events').render() end
  if v.kind == 'plan' and v.id then return require('cland.plan').render(v.id) end
  if v.kind == 'artifact' then
    return require('cland.artifacts').buffer(v.id, v.file)
  elseif v.kind == 'artifacts' then
    return require('cland.artifacts').list_buffer(v.id)
  elseif v.kind == 'item' and v.id then
    return require('cland.item_view').render(v.id)
  elseif v.kind == 'board' then
    return require('cland.board').render()
  elseif v.kind == 'graph' then
    return require('cland.graph').render()
  elseif v.kind == 'log' then
    return require('cland.agents_log').render()
  elseif v.kind == 'inbox' then
    return require('cland.inbox').render_full()
  end
  local b = M.bufs[key(v)]
  if not (b and api.nvim_buf_is_valid(b)) then
    return
  end
  local lines = lines_for(v)
  vim.bo[b].modifiable = true
  api.nvim_buf_set_lines(b, 0, -1, false, lines)
  vim.bo[b].modifiable = false
  api.nvim_buf_clear_namespace(b, ns, 0, -1)
  for i, l in ipairs(lines) do
    if l:match('comes with #') or l:match('␣') then
      pcall(api.nvim_buf_set_extmark, b, ns, i - 1, 0, { line_hl_group = 'ClandDim' })
    end
  end
  if lines[2] then
    pcall(api.nvim_buf_set_extmark, b, ns, 1, 0, { end_col = #lines[2], hl_group = 'ClandBold' })
  end
end

return M
