-- Persistent artifacts: shared chips, read-only source buffers, and browser previews (decision D12).
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
    client:request({ type = 'artifact.list' }, function(err, value)
      if err then return state.say('artifacts: ' .. err, 'ClandRedBar') end
      M.entries = value.artifacts or {}
      state.changed()
    end)
  end
  client:on('connected', load)
  client:on('message', function(e)
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
  local a = type(value) == 'table' and value or M.get(value)
  if not a then return state.say('no such artifact', 'ClandRedBar') end
  upsert(a)
  local ext = a.path:match('%.([^%.]+)$') or ''
  if browser_ext[ext:lower()] then return browser(a.path) end
  require('cland.layout').show({ kind = 'artifact', id = a.id }, { insert = false })
end

function M.buffer(id)
  local a = M.get(id)
  local b = M.bufs[id]
  if b and api.nvim_buf_is_valid(b) then return b end
  b = api.nvim_create_buf(false, true)
  M.bufs[id] = b
  vim.bo[b].bufhidden = 'hide'
  local ok, lines = pcall(vim.fn.readfile, a and a.path or '')
  api.nvim_buf_set_lines(b, 0, -1, false, ok and lines or { 'Cannot read artifact: ' .. tostring(lines) })
  local ext = a and (a.path:match('%.([^%.]+)$') or ''):lower() or ''
  vim.bo[b].filetype = ({ mmd = 'mermaid', mermaid = 'mermaid', md = 'markdown', markdown = 'markdown' })[ext] or 'text'
  vim.bo[b].readonly = true
  vim.bo[b].modifiable = false
  vim.b[b].cland_role = 'artifact'
  vim.b[b].cland_artifact = id
  if a then pcall(api.nvim_buf_set_name, b, a.path) end
  vim.keymap.set('n', 'q', require('cland.layout').back, { buffer = b })
  if vim.bo[b].filetype == 'mermaid' then
    vim.keymap.set('n', 'R', function() M.preview(a) end, { buffer = b, desc = 'render Mermaid in browser' })
  end
  return b
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
  end
  local lines = {}
  for _, a in ipairs(M.all(topic)) do
    lines[#lines + 1] = ' ▣ ' .. a.id .. ' ' .. a.kind .. ' · ' .. a.title .. '  ' .. a.creator .. ' · ' .. a.status .. ' · ' .. a.time
  end
  vim.bo[b].modifiable = true
  api.nvim_buf_set_lines(b, 0, -1, false, #lines > 0 and lines or { ' No artifacts shared in this topic yet.' })
  vim.bo[b].modifiable = false
  return b
end

return M
