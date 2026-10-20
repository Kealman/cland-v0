-- Persistent artifacts, editable prompt drafts, and browser previews (decision D12).
local api = vim.api
local state = require('cland.state')
local M = { entries = {}, bufs = {}, lists = {} }

function M.all(topic)
  local out = {}
  for _, a in ipairs(M.entries) do
    if not a.movedTo and (not topic or a.topic == topic) then out[#out + 1] = a end
  end
  return out
end

function M.mark(a)
  if a.fileDeleted then return 'file deleted' end
  if a.promoted then return 'promoted: ' .. a.promoted .. ' · ' .. a.status end
  return a.status
end

function M.get(id)
  for _, a in ipairs(M.entries) do
    if a.id == id then
      if not a.movedTo or a.fileDeleted then return a end
      local folder = M.get(a.movedTo.folder)
      if not folder then return a end
      return vim.tbl_extend('force', a, { path = folder.path .. '/' .. a.movedTo.path,
        status = folder.status, topic = folder.topic, fileDeleted = folder.fileDeleted or false })
    end
  end
end

local function entry_path(a)
  return a.folder and (a.path .. '/' .. a.entry) or a.path
end

local function sync_source(b, path)
  if not b or not api.nvim_buf_is_loaded(b) or vim.bo[b].modified then return end
  local stat = vim.uv.fs_stat(path)
  if not stat then return end
  local version = table.concat({path, stat.mtime.sec, stat.mtime.nsec, stat.size}, '\0')
  if vim.b[b].cland_disk_version ~= version then
    api.nvim_buf_call(b, function() vim.cmd('silent keepalt edit!') end)
  end
  vim.b[b].cland_disk_version = version
end

local function rebind(id)
  local b, a = M.bufs[id], M.get(id)
  if b and a and not a.fileDeleted and api.nvim_buf_is_valid(b) and api.nvim_buf_get_name(b) ~= entry_path(a) then
    local modified = vim.bo[b].modified
    local lines = modified and api.nvim_buf_get_lines(b, 0, -1, false) or nil
    local ok, err = pcall(function()
      api.nvim_buf_set_name(b, entry_path(a))
      -- Refresh the normal buffer's file identity so :write does not treat the destination as
      -- an unrelated existing file. Preserve edits made before the hub delivered the move.
      if vim.bo[b].buftype == '' then
        api.nvim_buf_call(b, function() vim.cmd('silent keepalt edit!') end)
        if lines then api.nvim_buf_set_lines(b, 0, -1, false, lines); vim.bo[b].modified = true end
      end
    end)
    if not ok then state.say('artifact moved: ' .. tostring(err), 'ClandRedBar') end
  end
end

local function upsert(a)
  for i, old in ipairs(M.entries) do
    if old.id == a.id then
      if old.movedTo and not a.movedTo then return end
      if old.fileDeleted then a.fileDeleted = true end
      M.entries[i] = a; rebind(a.id); M.refresh(); return
    end
  end
  M.entries[#M.entries + 1] = a
  rebind(a.id)
  M.refresh()
end

local function replay(events)
  for _, e in ipairs(events) do
    if e.type == 'artifact' then upsert(e.artifact)
    elseif e.type == 'message' and e.message then
      for _, a in ipairs(e.message.artifacts or {}) do upsert(a) end
      if type(e.message.artifact) == 'table' then upsert(e.message.artifact) end
    end
  end
end

function M.setup(client)
  M.client = client
  local function load()
    client:snapshot({ type = 'artifact.list' }, function(err, value, events)
      if err then return state.say('artifacts: ' .. err, 'ClandRedBar') end
      M.entries = value.artifacts or {}
      require('cland.artifact_browser').invalidate()
      replay(events)
      -- Absorbed ids are absent from the ordinary list. Open buffers still own those ids:
      -- resolve them after reconnect before their next save can recreate the obsolete path.
      for id, b in pairs(M.bufs) do
        if api.nvim_buf_is_valid(b) then
          if M.get(id) then rebind(id)
          else
            client:snapshot({ type = 'artifact.list', artifact = id }, function(resolve_err, resolved, changes)
              if resolve_err then return state.say('artifact: ' .. resolve_err, 'ClandRedBar') end
              upsert(resolved.artifact)
              replay(changes)
              state.changed()
            end)
          end
        end
      end
      M.refresh()
      state.changed()
    end)
  end
  client:on('connected', load)
  client:on('visibility', load)
  client:on('artifact', function(e)
    upsert(e.artifact)
    require('cland.artifact_browser').refresh(e.artifact.id)
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
  local ok, lines = pcall(vim.fn.readfile, entry_path(a))
  if not ok then return state.say('artifact: ' .. tostring(lines), 'ClandRedBar') end
  local path = entry_path(a) .. '.preview.html'
  local page = '<!doctype html><meta charset="utf-8"><title>' .. html(a.title) .. '</title><pre class="mermaid">' .. html(table.concat(lines, '\n')) .. '</pre>'
    .. [[<script type="module">import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs';mermaid.initialize({startOnLoad: true, securityLevel: 'strict'});</script>]]
  local written, err = pcall(vim.fn.writefile, vim.split(page, '\n', { plain = true }), path)
  if not written or err ~= 0 then return state.say('artifact preview: ' .. tostring(err), 'ClandRedBar') end
  browser(path)
end

local browser_ext = { html = true, htm = true, svg = true, png = true, pdf = true, jpg = true, jpeg = true, gif = true, webp = true }
function M.external(a)
  local ext = entry_path(a):match('%.([^%.]+)$') or ''
  return browser_ext[ext:lower()] and not (a.kind == 'prompt' and a.status == 'draft')
end
function M.open(value, file)
  local a = type(value) == 'table' and (M.get(value.id) or value) or M.get(value)
  if not a then return state.say('no such artifact', 'ClandRedBar') end
  a = M.get(a.id) or a
  if a.fileDeleted then return state.say('artifact: file deleted', 'ClandRedBar') end
  upsert(a)
  local target = file and vim.tbl_extend('force', a, { folder = false, path = a.path .. '/' .. file }) or a
  if M.external(target) then return browser(entry_path(target)) end
  require('cland.layout').show({ kind = 'artifact', id = a.id, file = file }, { insert = false })
end

local function raw_buffer(id, file)
  local a = M.get(id)
  M.file_bufs = M.file_bufs or {}
  local cache = file and M.file_bufs or M.bufs
  local key = file and (id .. '/' .. file) or id
  local b = cache[key]
  local path = file and (a.path .. '/' .. file) or entry_path(a)
  if b and api.nvim_buf_is_valid(b) then
    if not file then rebind(id) end
    sync_source(b, path)
    return b
  end
  b = vim.fn.bufadd(path)
  vim.fn.bufload(b)
  cache[key] = b
  vim.bo[b].bufhidden = 'hide'
  local ext = (path:match('%.([^%.]+)$') or ''):lower()
  vim.bo[b].filetype = ({ mmd = 'mermaid', mermaid = 'mermaid', md = 'markdown', markdown = 'markdown' })[ext] or 'text'
  vim.bo[b].readonly = false
  vim.bo[b].modifiable = true
  if vim.fn.getfsize(path) == 0 then vim.bo[b].endofline = false end
  vim.bo[b].fixendofline = false
  vim.bo[b].swapfile = false
  sync_source(b, path)
  vim.b[b].cland_role = 'artifact'
  vim.b[b].cland_artifact = id
  vim.b[b].cland_file = file
  if a.kind == 'prompt' and a.status == 'draft' and not file then
    require('cland.actions').map('n', '<leader>ps', function() M.send_prompt(false) end, { buffer = b, desc = 'send prompt' })
    require('cland.actions').map('n', '<leader>pa', function() M.send_prompt(true) end, { buffer = b, desc = 'attach prompt' })
  end
  require('cland.visibility').keys(b, function() return 'artifacts', id end)
  require('cland.actions').map('n', 'q', function()
    require('cland.artifact_browser').refresh(id)
    require('cland.layout').back()
  end, { buffer = b })
  if vim.bo[b].filetype == 'mermaid' then
    require('cland.actions').map('n', 'R', function()
      M.preview(file and vim.tbl_extend('force', a, {folder=false, path=path}) or a)
    end, { buffer = b, desc = 'render Mermaid in browser' })
  end
  return b
end

-- Both modes retain the artifact identity and the same navigation/actions.
local function markdown(a, path)
  if a.kind == 'prompt' and a.status == 'draft' then return false end
  local ext = (path:match('%.([^%.]+)$') or ''):lower()
  return ext == 'md' or ext == 'markdown'
    or ((a.kind == 'note' or a.kind == 'page') and ext ~= 'mmd' and ext ~= 'mermaid' and not browser_ext[ext])
end

local function toggle_key(b)
  require('cland.actions').map('n', '<leader>v', function() M.toggle() end, { buffer = b })
end

function M.buffer(id, file)
  local a = M.get(id)
  local path = file and (a.path .. '/' .. file) or entry_path(a)
  if not markdown(a, path) then return raw_buffer(id, file) end
  -- Loading a file buffer runs Markdown's editor setup. Defer that work until
  -- the human switches to raw; the read-only view needs only the saved text.
  local cache = file and (M.file_bufs or {}) or M.bufs
  local raw = cache[file and (id .. '/' .. file) or id]
  if raw and not api.nvim_buf_is_loaded(raw) then raw = nil end
  if raw and not file then rebind(id) end
  if not raw then
    local existing = vim.fn.bufnr(path)
    if existing ~= -1 and api.nvim_buf_is_loaded(existing) then raw = existing end
  end
  sync_source(raw, path)
  local win = require('cland.layout').centre()
  local b = require('cland.artifact_md').buffer(path, api.nvim_win_get_width(win), raw, api.nvim_win_get_height(win))
  vim.b[b].cland_role = 'artifact'
  vim.b[b].cland_artifact = id
  vim.b[b].cland_file = file
  toggle_key(b)
  require('cland.visibility').keys(b, function() return 'artifacts', id end)
  require('cland.actions').map('n', 'q', function()
    require('cland.artifact_browser').refresh(id)
    require('cland.layout').back()
  end, { buffer = b })
  return b
end

function M.toggle()
  local b, win = api.nvim_get_current_buf(), api.nvim_get_current_win()
  local id, file = vim.b[b].cland_artifact, vim.b[b].cland_file
  if not id then return end
  local target
  local md = require('cland.artifact_md')
  local source = md.source_line(b, api.nvim_win_get_cursor(win)[1])
  if vim.b[b].cland_rendered then
    target = raw_buffer(id, file)
    vim.b[target].cland_markdown = true
    toggle_key(target)
  else target = M.buffer(id, file) end
  api.nvim_win_set_buf(win, target)
  api.nvim_win_set_cursor(win, {md.rendered_line(target, source), 0})
  md.window(win)
  state.changed()
end

-- Events and resize handlers can arrive together. Refresh at the final width,
-- keeping the mode and source position of each visible artifact window.
local refresh_pending = false
function M.refresh()
  if refresh_pending then return end
  refresh_pending = true
  vim.schedule(function()
    refresh_pending = false
    local md = require('cland.artifact_md')
    for _, win in ipairs(api.nvim_list_wins()) do
      local b = api.nvim_win_get_buf(win)
      local id, file = vim.b[b].cland_artifact, vim.b[b].cland_file
      local a = id and M.get(id)
      if a and not a.fileDeleted then
        if not file then rebind(id) end
        if vim.b[b].cland_rendered then
          local source = md.source_line(b, api.nvim_win_get_cursor(win)[1])
          local tick = api.nvim_buf_get_changedtick(b)
          -- M.buffer uses the centre width; visible artifact views live there.
          local target = M.buffer(id, file)
          if target ~= b or api.nvim_buf_get_changedtick(target) ~= tick then
            api.nvim_win_set_buf(win, target)
            api.nvim_win_set_cursor(win, {md.rendered_line(target, source), 0})
            md.window(win)
          end
        else
          sync_source(b, file and (a.path .. '/' .. file) or entry_path(a))
        end
      end
    end
  end)
end

api.nvim_create_autocmd({'WinResized', 'VimResized', 'BufWritePost'}, {
  group = api.nvim_create_augroup('cland.artifacts', {clear = true}),
  callback = M.refresh,
})

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
  return require('cland.artifact_browser').buffer(topic)
end

return M
