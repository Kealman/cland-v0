-- The centre views other than the session terminal: one topic view per topic (thread and composer), and
-- the placeholders of the views later tickets fill (the item view and the board #36, the Agents log
-- #34, the inbox full width #33). A placeholder already names its view, so the view switch, the top
-- bar, the status line and `␣␣` work on it today.
local api = vim.api
local state = require('cland.state')

local M = { topics = {}, bufs = {} }

local ns = api.nvim_create_namespace('cland.views')

function M.setup(client)
  M.client = client
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
  local v = state.S.ui.view
  return v.kind == 'thread' and v.id or nil
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
  log = 'Agents log',
  inbox = 'Inbox · full width',
}

--- The title of a view, as the top bar shows it.
function M.title(v)
  if v.kind == 'thread' then
    local t = state.topic(v.id)
    return t and t.title or (v.id == 'general' and 'General' or v.id)
  elseif v.kind == 'session' then
    local s = state.session(v.id)
    return s and s.label or v.id
  elseif v.kind == 'item' then
    local it = state.item(v.id)
    return v.id .. (it and (' ' .. it.title) or '')
  end
  return M.TITLES[v.kind] or v.kind
end

local function key(v)
  return v.kind .. (v.id and (':' .. v.id) or '')
end

--- The buffer of a placeholder view (item, board, log, inbox).
function M.placeholder(v)
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
    M.bufs[k] = b
  end
  M.render_placeholder(v)
  return b
end

local function lines_for(v)
  if v.kind == 'item' then
    local it = state.item(v.id)
    local out = { '' }
    if it then
      out[#out + 1] = ' ' .. it.id .. ' · ' .. it.kind .. ' · ' .. it.state
      out[#out + 1] = ' ' .. it.title
      out[#out + 1] = ''
      if it.claim then
        out[#out + 1] = ' claim     ' .. it.claim.session
      end
      if it.parent then
        out[#out + 1] = ' parent    ' .. it.parent
      end
      if it.labels and #it.labels > 0 then
        out[#out + 1] = ' labels    ' .. table.concat(it.labels, ', ')
      end
      if it.blocked_by and #it.blocked_by > 0 then
        out[#out + 1] = ' blocked   ' .. table.concat(it.blocked_by, ', ')
      end
      out[#out + 1] = ' file      ' .. (it.file or '')
    else
      out[#out + 1] = ' ' .. v.id .. ': no such item in the tracker'
    end
    out[#out + 1] = ''
    out[#out + 1] = ' The item view (fields, verdicts, comments) comes with #36.'
    out[#out + 1] = ' gt its topic · gs its session · ␣␣ back'
    return out
  elseif v.kind == 'board' then
    return { '', ' Board', '', ' The board (backlog, planned, in progress, review, qa, done) comes with #36.', ' ␣b or ␣␣ back' }
  elseif v.kind == 'log' then
    return { '', ' Agents log', '', ' The Agents log (lifecycle events, agent-to-agent messages) comes with #34.', ' The Agents topic opens as a thread from the topics panel (␣t).', ' ␣␣ back' }
  elseif v.kind == 'inbox' then
    return { '', ' Inbox · full width', '', ' Nothing needs you.', '', ' Asks, approvals and notifications come with #33.', ' ␣N or ␣␣ back' }
  end
  return { '', ' ' .. v.kind }
end

function M.render_placeholder(v)
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
