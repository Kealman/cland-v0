-- One registry for commands and keys. Local mappings are checked against these declarations;
-- their callbacks stay with their buffers, so palette execution preserves the selected row/context.
local api = vim.api
local M = {}
local entries, by_id, by_key, bindings = {}, {}, {}, {}

--- Register {id, title, scope?, keys? = {{lhs, modes}}, command?, run?}.
--- Stable ids are unique; a scope names vim.b.cland_role (or "global").
function M.register(a)
  assert(type(a.id) == 'string' and type(a.title) == 'string', 'action needs id and title')
  assert(not by_id[a.id], 'duplicate action: ' .. a.id)
  a.scope = a.scope or 'global'
  a.keys = a.keys or {}
  assert(#a.keys > 0 or type(a.run) == 'function', 'unkeyed action needs run: ' .. a.id)
  for _, key in ipairs(a.keys) do
    local slot = a.scope .. ':' .. key.lhs
    assert(not by_key[slot], 'duplicate key: ' .. slot)
    by_key[slot] = {action=a, key=key}
  end
  by_id[a.id] = a
  entries[#entries + 1] = a
  return a
end

local function add(scope, lhs, title, modes, id)
  return M.register({ id = id or (scope .. ':' .. lhs), title = title, scope = scope,
    keys = { { lhs = lhs, modes = modes or 'n' } } })
end
local function group(scope, rows, modes)
  for _, row in ipairs(rows) do add(scope, row[1], row[2], modes) end
end

group('global', {
  {'<leader>i', 'Toggle items panel'}, {'<leader>n', 'Toggle inbox panel'},
  {'<leader>s', 'Toggle sessions panel'}, {'<leader>t', 'Toggle topics panel'},
  {'<leader>T', 'Toggle topics dock'}, {'<leader>N', 'Toggle inbox full width'},
  {'<leader>b', 'Toggle board view'}, {'<leader>a', 'Palette: artifacts'},
  {'<leader>L', 'Toggle Agents log'}, {'<leader>g', 'Open General'},
  {'<leader>c', 'Focus composer'}, {'<leader>P', 'Draft a prompt'},
  {'<leader>p', 'Open palette'}, {'<leader>l', 'Launch a session'},
  {'<leader><leader>', 'Previous centre view'}, {'<leader>r', 'Resolve this topic'},
  {'<leader>?', 'Keys'}, {'gi', 'Go to its item'}, {'gt', 'Go to its topic'}, {'gs', 'Go to its session'},
})
for _, direction in ipairs({'h', 'j', 'k', 'l'}) do
  add('global', '<C-' .. direction .. '>', 'Focus ' .. ({h='left',j='down',k='up',l='right'})[direction], {'n','i','s','t','x','o','c'})
end
add('global', '<C-\\>', 'Leave Terminal mode', 't')
add('global', '<S-CR>', 'Send Shift+Enter to harness', 't')
for _, scope in ipairs({'items', 'sessions', 'topics', 'inbox'}) do
  group(scope, {{'<CR>', scope == 'sessions' and 'Attach selected session (or toggle stopped fold)' or 'Open row in centre'}, {'<2-LeftMouse>', 'Open row in centre with mouse'}})
end
group('sessions', {{'l','Launch a session'}, {'<C-v>','Attach session in split'},
  {'x','Stop selected session (confirm)'}, {'L','Agents log for selected session'},
  {'c','Session adapter capabilities'}, {'y','Confirm stopping session'},
  {'za','Toggle stopped sessions fold'}, {'zo','Open stopped sessions fold'}, {'zc','Close stopped sessions fold'},
  {'zR','Open all stopped sessions'}, {'zM','Fold all stopped sessions'}, {'<Tab>','Toggle stopped sessions fold'},
  {'n','Keep session running'}, {'<Esc>','Cancel stopping session'}})
group('topics', {{'n','New topic'}, {'c','Close selected topic'}, {'r','Resolve selected topic'}})
for i, title in ipairs({'All items','Items in work','Items needing you','Done items','Map items'}) do
  add('items', tostring(i), title)
end
group('items', {{'f','Next items filter'}, {'F','Previous items filter'}})
group('inbox', {{'d','Dismiss selected notification'}, {'D','Dismiss all notifications'}})
for _, scope in ipairs({'inbox','inbox_full','thread'}) do
  for n=1,9 do add(scope, tostring(n), 'Answer selected ask with option ' .. n) end
  add(scope, 'i', 'Free answer to selected ask' .. (scope == 'thread' and ' or focus composer' or ''))
end
group('inbox_full', {{'<CR>','Open inbox row'}, {'d','Dismiss selected notification'}, {'D','Dismiss all notifications'}})
group('thread', {{'<CR>','Open artifact chip'}, {'ga','Artifacts in this topic'}})
group('log', {{'r','Reply to message sender'}, {'<CR>','Open artifact chip'}, {'ga','Artifacts in Agents'},
  {'f','Filter Agents by item or session'}, {'F','Clear Agents filter'}})
group('composer', {{'<M-CR>','Newline in message'}}, 'i')
add('composer', 'q', 'Cancel reply')
group('item', {{'e','Edit item file'}, {'L','Agents log for this item'}})
group('board', {{'<CR>','Open item card'}, {'<2-LeftMouse>','Open item card with mouse'}})
group('artifact', {{'<leader>ps','Send prompt draft'}, {'<leader>pa','Attach prompt draft'},
  {'q','Previous centre view'}, {'R','Render Mermaid in browser'}})
group('artifacts', {{'<CR>','Open selected artifact'}, {'q','Previous centre view'}, {'p','Promote selected artifact to repository'}})
group('help', {{'q','Close keys'}, {'<Esc>','Close keys'}})
group('capabilities', {{'q','Close capabilities'}, {'<Esc>','Close capabilities'}, {'c','Close capabilities'}})
group('palette', {{'<CR>','Run or open palette selection'}, {'<C-v>','Open palette selection in split'},
  {'<Esc>','Close palette'}, {'<C-c>','Close palette'}, {'<C-n>','Next palette match'},
  {'<Down>','Next palette match'}, {'<C-p>','Previous palette match'}, {'<Up>','Previous palette match'},
  {'<Tab>','Next palette kind'}, {'<S-Tab>','Previous palette kind'}}, {'i','n'})
group('launcher', {{'<CR>','Launch configured session'}, {'<Tab>','Next launch field'}, {'<Down>','Next launch field'},
  {'<S-Tab>','Previous launch field'}, {'<Up>','Previous launch field'}, {'<C-n>','Next launch choice'},
  {'<C-p>','Previous launch choice'}, {'<Esc>','Close launcher'}, {'<C-c>','Close launcher'}}, {'i','n'})
group('launcher', {{'<BS>','Delete before launch cursor'}, {'<C-w>','Delete launch word'},
  {'<C-u>','Delete launch field'}, {'<Del>','Delete after launch cursor'}}, 'i')

local function modes_of(modes) return type(modes) == 'table' and modes or {modes} end
local function scope_of(opts)
  local b = opts and opts.buffer
  if b == true or b == 0 then b = api.nvim_get_current_buf() end
  return b and (vim.b[b].cland_role or '') or 'global', b
end

--- Checked mapping adapter with vim.keymap.set's signature. The declaration supplies its title.
--- An undeclared key/scope/mode fails immediately instead of silently drifting from the palette.
function M.map(modes, lhs, rhs, opts)
  opts = vim.tbl_extend('force', {}, opts or {})
  local scope, buf = scope_of(opts)
  local entry = assert(by_key[scope .. ':' .. lhs], 'unregistered cland key: ' .. scope .. ' ' .. lhs)
  local a, declared = entry.action, entry.key
  for _, mode in ipairs(modes_of(modes)) do
    assert(vim.tbl_contains(modes_of(declared.modes), mode), 'unregistered mode for ' .. a.id .. ': ' .. mode)
  end
  opts.desc = 'cland: ' .. a.title
  vim.keymap.set(modes, declared.lhs, rhs, opts)
  bindings[a.id] = bindings[a.id] or {}
  local local_bindings = bindings[a.id][buf or 0] or {}
  bindings[a.id][buf or 0] = local_bindings
  for _, mode in ipairs(modes_of(modes)) do local_bindings[mode] = {rhs=rhs, expr=opts.expr} end
end

local function feed(keys)
  if keys and keys ~= '' then api.nvim_feedkeys(api.nvim_replace_termcodes(keys, true, false, true), 'n', false) end
end

-- Open a panel when a local action is invoked elsewhere. Object-specific actions preserve the
-- visible object's identity; they never guess an arbitrary item, artifact or message.
local function focus(scope)
  local current = api.nvim_get_current_win()
  if vim.b.cland_role == scope then return current end
  for _, win in ipairs(api.nvim_tabpage_list_wins(0)) do
    if vim.b[api.nvim_win_get_buf(win)].cland_role == scope then
      api.nvim_set_current_win(win)
      return win
    end
  end
  local layout = require('cland.layout')
  if scope == 'items' then layout.toggle_left()
  elseif scope == 'sessions' or scope == 'topics' or scope == 'inbox' then layout.right_panel(scope)
  elseif scope == 'board' or scope == 'log' or scope == 'inbox_full' then layout.show({kind=scope == 'inbox_full' and 'inbox' or scope}, {insert=false})
  elseif scope == 'thread' or scope == 'composer' then layout.show({kind='thread', id=require('cland.views').current_topic() or 'general'}, {insert=false})
  elseif scope == 'artifacts' then layout.show({kind='artifacts', id=require('cland.views').current_topic() or 'general'}, {insert=false})
  else return nil end
  for _, win in ipairs(api.nvim_tabpage_list_wins(0)) do
    if vim.b[api.nvim_win_get_buf(win)].cland_role == scope then api.nvim_set_current_win(win); return win end
  end
end

function M.run(id, args)
  local a = assert(by_id[id], 'unknown action: ' .. tostring(id))
  if a.run then return a.run(args or {}) end
  local buf = 0
  if a.scope ~= 'global' then
    if not focus(a.scope) then return require('cland.state').say('Open ' .. a.scope .. ' to use ' .. a.title) end
    buf = api.nvim_get_current_buf()
  end
  local local_bindings = (bindings[id] or {})[buf] or {}
  local mode = api.nvim_get_mode().mode:sub(1,1)
  if not local_bindings[mode] then mode = local_bindings.n and 'n' or modes_of(a.keys[1].modes)[1] end
  local binding = local_bindings[mode]
  if not binding then return require('cland.state').say(a.title .. ': no active ' .. a.scope .. ' key') end
  local function invoke()
    if type(binding.rhs) == 'function' then
      local result = binding.rhs()
      if binding.expr then feed(result) end
    else feed(binding.rhs) end
  end
  if mode == 'i' or mode == 't' then
    if mode == 't' and vim.bo.buftype ~= 'terminal' and not focus('session') then
      return require('cland.state').say('Open a session terminal to use ' .. a.title)
    end
    vim.cmd('startinsert!')
    vim.schedule(invoke)
  else invoke() end
end

function M.key(a)
  local keys = {}
  for _, k in ipairs(a.keys) do
    local key = k.lhs:gsub('<leader>', '␣'):gsub('<CR>', '↵')
    keys[#keys+1] = key
  end
  return #keys > 0 and (table.concat(keys, ' / ') .. (a.scope ~= 'global' and (' in ' .. a.scope) or '')) or 'no key'
end

--- Audit actual mappings, including mappings installed outside this adapter. Used by headless QA.
function M.audit()
  local errors = {}
  local function encoded(lhs)
    return api.nvim_replace_termcodes(lhs:gsub('<leader>', vim.g.mapleader or '\\'), true, true, true)
  end
  local function check(mode, map, scope)
    if not (map.desc or ''):match('^cland:') then return end
    local found
    for _, a in ipairs(entries) do
      if a.scope == scope then
        for _, key in ipairs(a.keys) do
          if encoded(key.lhs) == encoded(map.lhs) and vim.tbl_contains(modes_of(key.modes), mode) then found=a; break end
        end
      end
      if found then break end
    end
    if not found then errors[#errors+1] = 'unregistered ' .. scope .. ' ' .. mode .. ' ' .. map.lhs
    elseif map.desc ~= 'cland: ' .. found.title then errors[#errors+1] = 'mapping disagrees with ' .. found.title end
  end
  for _, mode in ipairs({'n','i','s','t','x','o','c'}) do
    for _, map in ipairs(api.nvim_get_keymap(mode)) do check(mode, map, 'global') end
    for _, buf in ipairs(api.nvim_list_bufs()) do
      if api.nvim_buf_is_valid(buf) then
        for _, map in ipairs(api.nvim_buf_get_keymap(buf, mode)) do check(mode, map, vim.b[buf].cland_role or '') end
      end
    end
  end
  return errors
end

--- Static actions plus the live inbox's ask options. Answers use the card/inbox's one hub path.
function M.all()
  local out = {}
  for _, a in ipairs(entries) do
    out[#out+1] = {id=a.id, title=a.title, key=M.key(a), command=a.command, run=function() M.run(a.id) end}
  end
  for _, row in ipairs(require('cland.state').S.inbox.asks) do
    local ask = {id=row.id, topic=row.topic and row.topic.id, question=row.question, options=row.options, free=row.free}
    for n, option in ipairs(row.options or {}) do
      out[#out+1] = {id='ask:' .. row.id .. ':' .. n, title='Answer ask ' .. (row.topic and (row.topic.item and row.topic.item ~= vim.NIL and row.topic.item or row.topic.title) or row.id) .. ' · ' .. n .. ' ' .. option,
        key=n .. ' on the ask (inbox or thread)', run=function() require('cland.ask_card').answer(ask,n) end}
    end
    if row.free ~= false then
      out[#out+1] = {id='ask:' .. row.id .. ':free', title='Free answer to ask ' .. row.question, key='i on the ask (inbox or thread)', run=function() require('cland.ask_card').free(ask) end}
    end
  end
  return out
end

-- Commands share entries with their mapped actions where behavior is the same.
local commands = {}
local function command(path, title, run, mapped)
  local a = mapped and by_id[mapped] or M.register({id='command:' .. path, title=title, run=run})
  a.command = ':Cland ' .. path
  if not mapped or a.scope == 'global' then a.run = run end
  commands[#commands+1] = {path=vim.split(path, ' ', {plain=true}), action=a, run=run}
end
local function layout() return require('cland.layout') end
local function views() return require('cland.views') end
command('help', 'Keys', function() require('cland').help() end, 'global:<leader>?')
command('refresh', 'Refresh from hub', function() require('cland').refresh() end)
command('launch', 'Launch a session', function(args) require('cland.launcher').open({name=args[1]}) end, 'global:<leader>l')
for _, preset in ipairs({'charting','watch','steady'}) do
  command('preset ' .. preset, 'Preset: ' .. preset, function() layout().preset(preset) end)
end
for _, panel in ipairs({'items','inbox','sessions','topics','dock'}) do
  local mapped = ({items='i', inbox='n', sessions='s', topics='t', dock='T'})[panel]
  command('panel ' .. panel, 'Toggle ' .. panel .. ' panel', function()
    if panel == 'items' then layout().toggle_left()
    elseif panel == 'dock' then layout().toggle_dock()
    else layout().right_panel(panel) end
  end, 'global:<leader>' .. mapped)
end
for _, kind in ipairs({'thread','session','item','board','log','inbox','artifacts','artifact'}) do
  command('view ' .. kind, 'Open ' .. kind .. ' view', function(args)
    local id = args[1]
    if not id and (kind == 'item' or kind == 'session' or kind == 'artifact') then
      local palette = require('cland.palette')
      return palette.open({query=palette.prefix(({item='items',session='sessions',artifact='artifacts'})[kind])})
    end
    layout().show({kind=kind, id=id or ((kind == 'thread' or kind == 'artifacts') and 'general' or nil)}, {insert=kind == 'session'})
  end)
end
command('topic new', 'New topic', function(args)
  if #args == 0 then views().prompt_topic() else views().create_topic(table.concat(args,' ')) end
end, 'topics:n')
command('topic close', 'Close this topic', function(args) views().close_topic(args[1]) end, 'topics:c')
command('topic resolve', 'Resolve this topic', function(args) views().resolve_topic(args[1]) end, 'global:<leader>r')
command('prompt', 'Draft a prompt', function(args) require('cland.artifacts').prompt(table.concat(args,' ')) end, 'global:<leader>P')
command('prompt send', 'Send prompt draft', function() require('cland.artifacts').send_prompt(false) end, 'artifact:<leader>ps')
command('prompt attach', 'Attach prompt draft', function() require('cland.artifacts').send_prompt(true) end, 'artifact:<leader>pa')
command('qa dump', 'Dump screen and state (QA)', function(args)
  if not args[1] then return vim.ui.input({prompt='QA dump path: '}, function(path) if path and path ~= '' then M.dispatch({'qa','dump',path}) end end) end
  local ok, files = pcall(require('cland.qa').dump, args[1])
  require('cland.state').say(ok and ('qa dump: ' .. table.concat(files,' · ')) or ('qa dump failed: ' .. tostring(files)), ok and 'ClandDimBar' or 'ClandRedBar')
end)

M.command = command

function M.dispatch(args)
  if #args == 0 then return M.run('global:<leader>?') end
  local best
  for _, c in ipairs(commands) do
    local match = #args >= #c.path
    for i, word in ipairs(c.path) do if args[i] ~= word then match=false; break end end
    if match and (not best or #c.path > #best.path) then best=c end
  end
  if best then return best.run(vim.list_slice(args, #best.path+1)) end
  require('cland.state').say(':Cland preset | view | panel | launch | topic new|close|resolve | prompt | qa dump | refresh | help', 'ClandRedBar')
end

function M.complete(_, line)
  local words = vim.split(line, '%s+', {trimempty=true})
  table.remove(words,1)
  if not line:match('%s$') then table.remove(words) end
  local out, seen = {}, {}
  for _, c in ipairs(commands) do
    local match=true
    for i, word in ipairs(words) do if c.path[i] ~= word then match=false; break end end
    local next_word=c.path[#words+1]
    if match and next_word and not seen[next_word] then out[#out+1]=next_word; seen[next_word]=true end
  end
  return out
end

return M
