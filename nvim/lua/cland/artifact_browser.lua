-- The human's artifact workspace. Folder contents come from the hub on demand;
-- normal file buffers own edits, while this tree owns only navigation and metadata actions.
local api = vim.api
local state = require('cland.state')
local artifacts = require('cland.artifacts')
local M = { lists = {}, files = {}, open = {}, pending = {}, dirty = {} }
local roles = { {'coordinator','Coordinator'}, {'implementer','Implementers'}, {'reviewer','Reviewers'}, {'qa','QA'}, {'other','Other'} }
local role_ids = {}
for _, role in ipairs(roles) do role_ids[role[1]] = true end

local function request(frame, done)
  if not artifacts.client or not artifacts.client:connected() then return state.say('artifacts: the hub is not connected', 'ClandRedBar') end
  artifacts.client:request(frame, function(err, value)
    if err then return state.say('artifacts: ' .. err, 'ClandRedBar') end
    if done then done(value) end
    state.changed()
  end)
end

function M.invalidate()
  M.files, M.pending, M.dirty = {}, {}, {}
  for id, opened in pairs(M.open) do if opened and id:match('^A%-') then M.refresh(id) end end
end

function M.refresh(id)
  local a = artifacts.get(id)
  if not a or not a.folder or a.fileDeleted then return end
  M.files[id] = nil
  if not M.open[id] then return end
  if M.pending[id] then M.dirty[id] = true; return end
  local token = {}
  M.pending[id] = token
  -- Local file edits do not advance the hub's read generation. Coalesce refreshes
  -- beyond its 250 ms repeat guard so a save cannot replay an earlier folder listing.
  vim.defer_fn(function()
    if M.pending[id] ~= token then return end
    artifacts.client:request({ type = 'artifact.list', artifact = id }, function(err, value)
      if M.pending[id] ~= token then return end
      M.pending[id] = nil
      if err then
        M.dirty[id] = nil
        M.files[id] = {} -- retry on the next explicit unfold or reconnect
        state.say('artifacts: ' .. err, 'ClandRedBar')
      else
        M.files[id] = value.files or {}
        if M.dirty[id] then M.dirty[id] = nil; M.refresh(id) end
      end
      state.changed()
    end)
  end, 260)
end

local function human(a)
  return a.creatorKind == 'human' or a.creatorRole == 'aide' or (a.creatorKind == nil and a.creator == 'human')
end

local function selected(b)
  local tree = M.lists[b]
  return tree and tree.rows[api.nvim_win_get_cursor(0)[1]]
end

local function fold(b, mode)
  local row = selected(b)
  if not row or not row.fold then return end
  M.open[row.fold] = mode == 'zo' or (mode ~= 'zc' and not row.open)
  if row.artifact then M.refresh(row.artifact.id) end
  state.changed()
end

local function active(row)
  local a = row and row.artifact
  if not a then return end
  if a.fileDeleted then state.say('artifact: file deleted', 'ClandRedBar'); return end
  return artifacts.get(a.id) or a
end

local function input(prompt, done)
  vim.ui.input({ prompt = prompt }, function(value)
    if value and vim.trim(value) ~= '' then done(vim.trim(value)) end
  end)
end

-- A new child is not an indexed artifact. Reserve it exclusively and reject links
-- and traversal before opening its normal buffer. The initial browser supports one filename.
local function new_child(a)
  input('File name in folder: ', function(name)
    if name == '.' or name == '..' or name:find('[/\\%c]') then return state.say('use a single file name inside the folder', 'ClandRedBar') end
    local current = artifacts.get(a.id)
    if not current or current.fileDeleted then return state.say('artifact: file deleted', 'ClandRedBar') end
    local info = vim.uv.fs_lstat(current.path)
    if not info or info.type ~= 'directory' then return state.say('artifact folder must be a real directory', 'ClandRedBar') end
    local path = current.path .. '/' .. name
    local fd, err = vim.uv.fs_open(path, 'wx', 384)
    if not fd then return state.say('new file: ' .. tostring(err), 'ClandRedBar') end
    vim.uv.fs_close(fd)
    M.open[a.id] = true
    M.refresh(a.id)
    artifacts.open(current, name)
  end)
end

local kinds = { prompt = true, note = true, page = true, diagram = true, file = true }
local function create(b, topic)
  local row = selected(b)
  local a = active(row)
  if a and a.folder then return new_child(a) end
  input('File or folder: ', function(shape)
    if shape ~= 'file' and shape ~= 'folder' then return state.say('choose file or folder', 'ClandRedBar') end
    input('Kind: ', function(kind)
      if not kinds[kind] then return state.say('kind: prompt, note, page, diagram or file', 'ClandRedBar') end
      input('Title: ', function(title)
        request({ type = 'artifact.create', kind = kind, title = title, topic = topic, folder = shape == 'folder', content = '', status = kind == 'prompt' and 'draft' or 'shared' })
      end)
    end)
  end)
end

local function attach(row, topic)
  local a = active(row)
  if not a then return end
  if topic == 'agents' then return state.say('open a writable topic to attach artifacts', 'ClandRedBar') end
  if a.topic ~= topic then return state.say('artifact belongs to ' .. a.topic .. '; open that topic to attach', 'ClandRedBar') end
  if a.status == 'archived' then return state.say('artifact is archived; keep it to attach', 'ClandRedBar') end
  local composer = require('cland.views').topic(topic).composer
  if composer.answering then return state.say('send artifacts in a message after answering the ask', 'ClandRedBar') end
  composer:attach(a.id)
  require('cland.layout').show({ kind = 'thread', id = topic }, { insert = true })
end

local function move(row)
  local a = active(row)
  if not a then return end
  if row.file then return state.say('folder files already belong to their folder', 'ClandRedBar') end
  if a.folder then return state.say('moving a folder into a folder is not supported', 'ClandRedBar') end
  local folders = {}
  for _, f in ipairs(artifacts.all()) do
    if f.folder and not f.fileDeleted and f.status ~= 'archived' then folders[#folders + 1] = f end
  end
  if #folders == 0 then return state.say('create a destination folder first', 'ClandRedBar') end
  vim.ui.select(folders, { prompt = 'Move into folder:', format_item = function(f) return f.id .. ' · ' .. f.title end }, function(folder)
    if folder then request({ type = 'artifact.move', artifact = a.id, folder = folder.id }) end
  end)
end

local function promote(row)
  local a = active(row)
  if not a then return end
  if row.file then return state.say('select the folder artifact to promote it', 'ClandRedBar') end
  if a.promoted then return state.say(artifacts.mark(a), 'ClandRedBar') end
  input('Promote to project path: ', function(path)
    request({ type = 'artifact.promote', artifact = a.id, path = path }, function(value)
      if value.followUp then state.say('Artifact promoted; notification failed: ' .. value.followUp.error, 'ClandRedBar') end
    end)
  end)
end

local function bind(tree)
  local b, topic = tree.buf, tree.topic
  local function map(key, fn) require('cland.actions').map('n', key, fn, { buffer = b }) end
  map('<CR>', function()
    local row = selected(b)
    if row and row.fold then fold(b, 'za')
    elseif row and row.artifact then artifacts.open(row.artifact, row.file) end
  end)
  for _, key in ipairs({ 'za', 'zo', 'zc' }) do map(key, function() fold(b, key) end) end
  map('zR', function()
    for _, role in ipairs(roles) do
      M.open['role:' .. role[1]] = true
      M.open['role:' .. role[1] .. ':background'] = true
    end
    for _, key in ipairs({ 'mine', 'topic', 'kept' }) do M.open[key] = true; M.open[key .. ':background'] = true end
    state.changed()
  end)
  map('zM', function()
    for key in pairs(M.open) do M.open[key] = false end
    state.changed()
  end)
  map('A', function() M.open.archived = not M.open.archived; state.changed() end)
  map('n', function() create(b, topic) end)
  map('s', function() attach(selected(b), topic) end)
  map('m', function() move(selected(b)) end)
  map('p', function() promote(selected(b)) end)
  map('k', function()
    local a = active(selected(b))
    if a then request({ type = 'artifact.keep', artifact = a.id, kept = not a.kept }) end
  end)
  map('d', function()
    local a = active(selected(b))
    if a then request({ type = 'artifact.archive', artifact = a.id }) end
  end)
  map('x', function()
    local row = selected(b)
    local a = active(row)
    if not a then return end
    if row.file then return state.say('select the folder artifact to delete it', 'ClandRedBar') end
    vim.ui.select({ 'Cancel', 'Delete' }, { prompt = 'Delete ' .. a.id .. ' · ' .. a.title .. '? This removes its files.' }, function(choice)
      if choice == 'Delete' then
        request({ type = 'artifact.delete', artifact = a.id }, function(value)
          if value.followUp then state.say('Artifact deleted; cleanup failed: ' .. value.followUp.error, 'ClandRedBar') end
        end)
      end
    end)
  end)
  map('q', require('cland.layout').back)
end

function M.buffer(topic)
  topic = topic or 'general'
  local tree = M.lists[topic]
  if not tree or not api.nvim_buf_is_valid(tree.buf) then
    tree = { buf = api.nvim_create_buf(false, true), topic = topic, rows = {} }
    M.lists[topic], M.lists[tree.buf] = tree, tree
    vim.bo[tree.buf].bufhidden = 'hide'
    vim.b[tree.buf].cland_role, vim.b[tree.buf].cland_topic = 'artifacts', topic
    api.nvim_buf_set_name(tree.buf, 'cland://artifacts/' .. topic)
    bind(tree)
  end
  local b, old = tree.buf, tree.rows
  local cursors = {}
  for _, w in ipairs(vim.fn.win_findbuf(b)) do
    local pos = api.nvim_win_get_cursor(w)
    cursors[w] = { row = pos[1], key = old[pos[1]] and old[pos[1]].key }
  end
  local lines, rows = {}, {}
  local function line(text, row)
    lines[#lines + 1], rows[#lines + 1] = text, row
  end
  local all = artifacts.all()
  table.sort(all, function(a, c)
    if not not a.folder ~= not not c.folder then return not not a.folder end
    if a.title ~= c.title then return a.title < c.title end
    return a.id < c.id
  end)
  local function section(key, title, matches, folded)
    local group = {}
    for _, a in ipairs(all) do if matches(a) then group[#group + 1] = a end end
    local foreground = false
    if key:match('^role:') then
      for _, a in ipairs(group) do if a.layer == 'now' or a.layer == 'watch' then foreground = true end end
    end
    local opened = M.open[key]
    if opened == nil then opened = not folded or foreground end
    line(' ' .. (opened and '▾ ' or '▸ ') .. title .. ' (' .. #group .. ')', { key = key, fold = key, open = opened })
    if not opened then return end
    local function artifact_row(a)
      local opened_folder = a.folder and M.open[a.id]
      line('   ' .. (a.folder and (opened_folder and '▾ ' or '▸ ') or '▣ ') .. a.id .. ' ' .. a.kind .. ' · ' .. a.title .. '  ' .. a.creator .. ' · ' .. artifacts.mark(a) .. (a.kept and ' · kept' or ''),
        { key = key .. ':' .. a.id, artifact = a, fold = a.folder and a.id or nil, open = opened_folder })
      if opened_folder and not a.fileDeleted then
        if not M.files[a.id] and not M.pending[a.id] then M.refresh(a.id) end
        for _, file in ipairs(M.files[a.id] or {}) do
          line('       ' .. file, { key = key .. ':' .. a.id .. '/' .. file, artifact = a, file = file })
        end
      end
    end
    local background = {}
    for _, a in ipairs(group) do
      if (not folded or foreground) and a.layer == 'background' then background[#background + 1] = a
      else artifact_row(a) end
    end
    if #background > 0 then
      local fold_key = key .. ':background'
      local more_open = M.open[fold_key]
      line('   ' .. (more_open and '▾ ' or '▸ ') .. 'more (' .. #background .. ')',
        { key = fold_key, fold = fold_key, open = more_open })
      if more_open then for _, a in ipairs(background) do artifact_row(a) end end
    end
  end
  local function archived(a) return a.layer == 'archive' or a.status == 'archived' or a.fileDeleted end
  section('mine', 'Mine', function(a) return human(a) and not archived(a) end)
  section('topic', 'This topic', function(a) return a.topic == topic and not archived(a) end)
  section('kept', 'Kept', function(a) return a.kept and not archived(a) end)
  line(' By role', { key = 'roles' })
  for _, role in ipairs(roles) do
    section('role:' .. role[1], role[2], function(a)
      local r = a.creatorRole or 'other'
      if not role_ids[r] then r = 'other' end
      return not human(a) and not archived(a) and r == role[1]
    end, true)
  end
  section('archived', 'Archived', archived, true)
  tree.rows = rows
  vim.bo[b].modifiable = true
  api.nvim_buf_set_lines(b, 0, -1, false, lines)
  vim.bo[b].modifiable = false
  for w, pos in pairs(cursors) do
    local target = math.min(pos.row, #lines)
    for i, row in ipairs(rows) do if row.key == pos.key then target = i; break end end
    pcall(api.nvim_win_set_cursor, w, { target, 0 })
  end
  return b
end

return M
