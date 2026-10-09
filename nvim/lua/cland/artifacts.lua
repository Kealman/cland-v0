-- Persistent artifacts, editable prompt drafts, and browser previews (decision D12).
local api = vim.api
local state = require('cland.state')
local M = { entries = {}, bufs = {}, lists = {} }

function M.all(topic)
  local out = {}
  for _, a in ipairs(M.entries) do
    if not topic or a.topic == topic then out[#out + 1] = a end
  end
  return out
end

function M.mark(a)
  if a.fileDeleted then return 'file deleted' end
  if a.promoted then return 'promoted: ' .. a.promoted end
  return a.status
end

function M.get(id)
  for _, a in ipairs(M.entries) do if a.id == id then return a end end
end

local function upsert(a)
  for i, old in ipairs(M.entries) do
    if old.id == a.id then M.entries[i] = a; return end
  end
  M.entries[#M.entries + 1] = a
end

function M.setup(client)
  M.client = client
  local function load()
    client:snapshot({ type = 'artifact.list' }, function(err, value, events)
      if err then return state.say('artifacts: ' .. err, 'ClandRedBar') end
      M.entries = value.artifacts or {}
      for _, e in ipairs(events) do
        if e.type == 'artifact' then upsert(e.artifact)
        elseif e.type == 'message' and e.message then
          for _, a in ipairs(e.message.artifacts or {}) do upsert(a) end
          if type(e.message.artifact) == 'table' then upsert(e.message.artifact) end
        end
      end
      state.changed()
    end)
  end
  client:on('connected', load)
  client:on('artifact', function(e)
    upsert(e.artifact)
    state.changed()
  end)
  client:on('message', function(e)
    for _, a in ipairs(e.message.artifacts or {}) do upsert(a) end
    if type(e.message.artifact) == 'table' then
      upsert(e.message.artifact)
      state.changed()
    end
  end)
  if client:connected() then load() end
end

local function browser(path)
  local opener = vim.env.CLAND_OPENER
  if not opener or opener == '' then opener = vim.fn.has('macunix') == 1 and 'open' or 'xdg-open' end
  vim.system({ opener, path }, {}, function(result)
    if result.code ~= 0 then vim.schedule(function() state.say('artifact opener: ' .. (result.stderr or tostring(result.code)), 'ClandRedBar') end) end
  end)
end

local function html(s)
  return s:gsub('&', '&amp;'):gsub('<', '&lt;'):gsub('>', '&gt;'):gsub('"', '&quot;')
end

function M.preview(a)
  local ok, lines = pcall(vim.fn.readfile, a.path)
  if not ok then return state.say('artifact: ' .. tostring(lines), 'ClandRedBar') end
  local path = a.path .. '.preview.html'
  local page = '<!doctype html><meta charset="utf-8"><title>' .. html(a.title) .. '</title><pre class="mermaid">' .. html(table.concat(lines, '\n')) .. '</pre>'
    .. [[<script type="module">import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs';mermaid.initialize({startOnLoad: true, securityLevel: 'strict'});</script>]]
  local written, err = pcall(vim.fn.writefile, vim.split(page, '\n', { plain = true }), path)
  if not written or err ~= 0 then return state.say('artifact preview: ' .. tostring(err), 'ClandRedBar') end
  browser(path)
end

local browser_ext = { html = true, htm = true, svg = true, png = true, pdf = true, jpg = true, jpeg = true, gif = true, webp = true }
function M.open(value)
  local a = type(value) == 'table' and (M.get(value.id) or value) or M.get(value)
  if not a then return state.say('no such artifact', 'ClandRedBar') end
  a = M.get(a.id) or a
  if a.fileDeleted then return state.say('artifact: file deleted', 'ClandRedBar') end
  upsert(a)
  local ext = a.path:match('%.([^%.]+)$') or ''
  if browser_ext[ext:lower()] and not (a.kind == 'prompt' and a.status == 'draft') then return browser(a.path) end
  require('cland.layout').show({ kind = 'artifact', id = a.id }, { insert = false })
end

function M.buffer(id)
  local a = M.get(id)
  local b = M.bufs[id]
  if b and api.nvim_buf_is_valid(b) then return b end
  local draft = a and a.kind == 'prompt' and a.status == 'draft'
  if draft then
    b = vim.fn.bufadd(a.path)
    vim.fn.bufload(b)
  else
    b = api.nvim_create_buf(false, true)
  end
  M.bufs[id] = b
  vim.bo[b].bufhidden = 'hide'
  if not draft then
    local ok, lines = pcall(vim.fn.readfile, a and a.path or '')
    api.nvim_buf_set_lines(b, 0, -1, false, ok and lines or { 'Cannot read artifact: ' .. tostring(lines) })
  end
  local ext = a and (a.path:match('%.([^%.]+)$') or ''):lower() or ''
  vim.bo[b].filetype = ({ mmd = 'mermaid', mermaid = 'mermaid', md = 'markdown', markdown = 'markdown' })[ext] or 'text'
  vim.bo[b].readonly = not draft
  vim.bo[b].modifiable = draft
  if draft then
    if vim.fn.getfsize(a.path) == 0 then vim.bo[b].endofline = false end
    vim.bo[b].fixendofline = false
    vim.bo[b].swapfile = false
    vim.bo[b].modified = false
  end
  vim.b[b].cland_role = 'artifact'
  vim.b[b].cland_artifact = id
  if a and not draft then pcall(api.nvim_buf_set_name, b, a.path) end
  if draft then
    vim.keymap.set('n', '<leader>ps', function() M.send_prompt(false) end, { buffer = b, desc = 'send prompt' })
    vim.keymap.set('n', '<leader>pa', function() M.send_prompt(true) end, { buffer = b, desc = 'attach prompt' })
  end
  vim.keymap.set('n', 'q', require('cland.layout').back, { buffer = b })
  if vim.bo[b].filetype == 'mermaid' then
    vim.keymap.set('n', 'R', function() M.preview(a) end, { buffer = b, desc = 'render Mermaid in browser' })
  end
  return b
end

function M.prompt(title)
  local topic = require('cland.views').current_topic()
  if not topic or topic == 'agents' then return state.say('open a thread to draft a prompt', 'ClandRedBar') end
  if not M.client:connected() then return state.say('prompt: the hub is not connected', 'ClandRedBar') end
  title = title and vim.trim(title) ~= '' and title or 'Prompt'
  local origin = api.nvim_get_current_buf()
  M.client:request({ type = 'artifact.create', kind = 'prompt', title = title, topic = topic, content = '', status = 'draft' }, function(err, value)
    if err then return state.say('prompt: ' .. err, 'ClandRedBar') end
    upsert(value.artifact)
    -- The request reserves its topic, but a late answer never pulls the human from another buffer.
    if api.nvim_get_current_buf() == origin then M.open(value.artifact) end
    state.changed()
  end)
end

function M.send_prompt(attach)
  local b = api.nvim_get_current_buf()
  local a = M.get(vim.b[b].cland_artifact)
  if not a or a.kind ~= 'prompt' or a.status ~= 'draft' then return state.say('open a prompt draft to send it', 'ClandRedBar') end
  if M.sending and M.sending[a.id] then return end
  if not M.client:connected() then return state.say('prompt: the hub is not connected', 'ClandRedBar') end
  local ok, err = pcall(vim.cmd, 'write')
  if not ok then return state.say('prompt save: ' .. tostring(err), 'ClandRedBar') end
  M.sending = M.sending or {}
  M.sending[a.id] = true
  M.client:request({ type = 'prompt.send', artifact = a.id, attach = attach }, function(failure)
    M.sending[a.id] = nil
    if failure then return state.say('prompt not sent: ' .. failure, 'ClandRedBar') end
    -- Events update metadata only: edited text and cursor stay untouched, including edits made during send.
    state.say('prompt sent: ' .. a.title)
  end)
end

function M.list_buffer(topic)
  local b = M.lists[topic]
  if not (b and api.nvim_buf_is_valid(b)) then
    b = api.nvim_create_buf(false, true)
    M.lists[topic] = b
    vim.bo[b].bufhidden = 'hide'
    vim.b[b].cland_role = 'artifacts'
    vim.b[b].cland_topic = topic
    vim.keymap.set('n', '<CR>', function()
      local a = M.all(topic)[api.nvim_win_get_cursor(0)[1]]
      if a then M.open(a) end
    end, { buffer = b })
    vim.keymap.set('n', 'q', require('cland.layout').back, { buffer = b })
    vim.keymap.set('n', 'p', function()
      local a = M.all(topic)[api.nvim_win_get_cursor(0)[1]]
      if not a then return end
      if a.fileDeleted or a.promoted then return state.say(M.mark(a), 'ClandRedBar') end
      vim.ui.input({ prompt = 'Promote to project path: ' }, function(path)
        if not path or path == '' then return end
        M.client:request({ type = 'artifact.promote', artifact = a.id, path = path }, function(err, value)
          if err then return state.say('promote: ' .. err, 'ClandRedBar') end
          upsert(value.artifact)
          state.changed()
          if value.followUp then state.say('Artifact promoted; notification failed: ' .. value.followUp.error, 'ClandRedBar') end
        end)
      end)
    end, { buffer = b, desc = 'promote artifact into project' })
  end
  local lines = {}
  for _, a in ipairs(M.all(topic)) do
    lines[#lines + 1] = ' ▣ ' .. a.id .. ' ' .. a.kind .. ' · ' .. a.title .. '  ' .. a.creator .. ' · ' .. M.mark(a) .. ' · ' .. a.time
  end
  vim.bo[b].modifiable = true
  api.nvim_buf_set_lines(b, 0, -1, false, #lines > 0 and lines or { ' No artifacts shared in this topic yet.' })
  vim.bo[b].modifiable = false
  return b
end

return M
