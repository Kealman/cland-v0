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
