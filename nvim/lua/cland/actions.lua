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
  {'<leader>e', 'Open explorer'}, {'<leader>b', 'Toggle board view'}, {'<leader>G', 'Open experimental graph'}, {'<leader>a', 'Palette: artifacts'},
  {'<leader>R', 'Rulebook'}, {'<leader>E', 'Events view'}, {'<leader>L', 'Toggle Agents log'}, {'<leader>g', 'Open General'},
  {'<leader>c', 'Focus composer'}, {'<leader>P', 'Draft a prompt'},
  {'<leader>p', 'Open palette'}, {'<leader>l', 'Launch a session'}, {'<leader>A', 'Launch an Aide'},
  {'<leader><leader>', 'Previous centre view'}, {'<leader>r', 'Resolve this topic'},
  {'<leader>?', 'Keys'}, {'gp', 'Open its epic plan'}, {'gi', 'Open explorer on its item'}, {'gI', 'Open the v0.1 item view'}, {'gt', 'Go to its topic'}, {'gs', 'Go to its session'},
})
for _, direction in ipairs({'h', 'j', 'k', 'l'}) do
  add('global', '<C-' .. direction .. '>', 'Focus ' .. ({h='left',j='down',k='up',l='right'})[direction], {'n','i','s','t','x','o','c'})
end
add('global', '<C-\\>', 'Leave Terminal mode', 't')
add('global', '<S-CR>', 'Send Shift+Enter to harness', 't')
for _, scope in ipairs({'items', 'sessions', 'topics', 'inbox'}) do
  local enter = scope == 'sessions' and 'Attach selected session, open verification queue or toggle background fold'
    or (scope == 'items' and 'Open row or show categories in all' or 'Open row in centre')
  group(scope, {{'<CR>', enter}, {'<2-LeftMouse>', 'Open row in centre with mouse'}})
  add(scope, 'gm', 'Move ' .. scope .. ' to the other side')
end
M.register({ id = 'verification.open', title = 'Open verification queue', run = function()
  require('cland.layout').show({ kind = 'verification' }, { insert = false })
end })
group('rulebook', {{'<CR>', 'Fold or unfold rule'}, {'gt', 'Open rule origin in thread'}, {'a', 'Add rule'}, {'e', 'Edit rule'}, {'X', 'Retire rule'}, {'q', 'Previous centre view'}})
group('rule_compose', {{'q', 'Previous centre view'}})
group('verification', {{'q', 'Previous centre view'}})
group('sessions', {{'l','Launch a session'}, {'a','Launch an Aide'}, {'<C-v>','Attach session in split'},
  {'d','Archive stopped session'}, {'x','Stop selected session (confirm)'}, {'r','Resume session'}, {'f','Launch session fresh with its brief'}, {'L','Agents log for selected session'},
  {'c','Session adapter capabilities'}, {'y','Confirm stopping session'},
  {'za','Toggle accounts or background sessions fold'}, {'zo','Open accounts or background sessions fold'}, {'zc','Close accounts or background sessions fold'},
  {'zR','Open all background sessions'}, {'zM','Fold all background sessions'}, {'<Tab>','Toggle accounts or background sessions fold'},
  {'A','Show or hide session archive'}, {'n','Keep session unchanged'}, {'<Esc>','Cancel session confirmation'}})
group('topics', {{'n','New topic'}, {'c','Close selected topic'}, {'r','Resolve selected topic'}})
for i, title in ipairs({'Release board','Items in work','Items needing you','Done items','Map items','All items'}) do
  add('items', tostring(i), title)
end
group('items', {{'f','Next items filter'}, {'F','Previous items filter'},
  {'za','Toggle board fold'}, {'zo','Open board fold'}, {'zc','Close board fold'},
  {'zR','Open all board folds'}, {'zM','Close all board folds'},
  {'K','Rank item before its previous sibling'}, {'J','Rank item after its next sibling'}, {'T','Rank item to the top'},
  {'e','Next open container scope'}, {'E','Previous open container scope'},
  {'p','Next epic tab'}, {'P','Previous epic tab'}, {'<Tab>','Next epic tab'}, {'<S-Tab>','Previous epic tab'}})
group('items', {{'gn','Now-layer items'}, {'gw','Watch-layer items'}, {'gb','Background-layer items'}, {'gA','Archived items'}})
group('topics', {{'za','Toggle background topics'}, {'A','Show or hide archived topics'}})
group('events', {{'<CR>', 'Open event subject'}, {'A', 'Page 200 older events'}, {'za', 'Fold or unfold event day'}, {'0', 'Show all event kinds'}, {'w', 'Toggle warning events'}, {'s', 'Filter events by subject'}, {'F', 'Clear events filter'}, {'gM', 'Mute or restore event subject'}})
for i, kind in ipairs(require('cland.event_kinds')) do
  if i > 9 then break end
  add('events', tostring(i), 'Filter ' .. kind .. ' events')
end
-- All kinds remain in the palette after the numeric keys run out.
for i, kind in ipairs(require('cland.event_kinds')) do
  if i > 9 then
    local selected = kind
    M.register({id='events:kind:' .. kind, title='Filter ' .. kind .. ' events', run=function()
      require('cland.layout').show({kind='events'}, {insert=false})
      require('cland.events').filter({kinds={selected}})
    end})
  end
end
group('inbox', {{'za', 'Fold or unfold inbox section'}, {'e', 'Events view'}, {'r','Reply to selected inbox row'}, {'d','Decline request or mark message read'}, {'A','Show or hide seven-day inbox archive'}})
for _, scope in ipairs({'inbox','inbox_full','thread'}) do
  for n=1,9 do add(scope, tostring(n), 'Answer selected ask with option ' .. n) end
  add(scope, 'i', 'Free answer to selected ask' .. (scope == 'thread' and ' or focus composer' or ''))
end
group('inbox_full', {{'za', 'Fold or unfold inbox section'}, {'e', 'Events view'}, {'<CR>','Open inbox row'}, {'r','Reply to selected inbox row'}, {'d','Decline request or mark message read'}, {'A','Show or hide seven-day inbox archive'}})
group('thread', {{'<CR>','Toggle agent run or open artifact chip'}, {'ga','Artifacts in this topic'},
  {'zo','Open agent run'}, {'za','Toggle agent run'}, {'zc','Close agent run'},
  {'zR','Open all agent runs'}, {'zM','Fold all agent runs'}})
group('log', {{'r','Reply to message sender'}, {'<CR>','Open artifact chip'}, {'ga','Artifacts in Agents'},
  {'f','Filter Agents by item or session'}, {'F','Clear Agents filter'}})
group('composer', {{'<M-CR>','Newline in message'}}, 'i')
add('composer', 'q', 'Cancel reply')
group('explorer', {{'j','Next explorer item row'}, {'k','Previous explorer item row'},
  {'<CR>','Focus explorer card'}, {'l','Unfold explorer node, step to its first child or focus leaf card'}, {'h','Fold explorer node or its parent'},
  {'za','Toggle explorer fold'}, {'zo','Open explorer fold'}, {'zc','Close explorer fold'},
  {'zR','Unfold every explorer node'}, {'zM','Fold every explorer node'}, {'s','Scope explorer to this node'},
  {'D','Hide or show done explorer items'}, {'A','Show or hide archived explorer roots'}, {'zb','Unfold or fold agents text'}})
group('card', {{'<CR>','Reveal referenced item in explorer'}, {'zb','Unfold or fold agents text'}, {'h','Return to explorer tree'}, {'<leader><leader>','Return to explorer tree'}})
for _, scope in ipairs({'explorer','card'}) do
  group(scope, {{'m','Message the Coordinator in General'}, {'M',"Message the Coordinator in the item's topic"}}, scope == 'explorer' and {'n','x'} or 'n')
end
group('explorer_compose', {{'<CR>','Send explorer message'}, {'<Esc>','Close explorer composer and keep draft'}}, {'i','n'})
group('explorer_compose', {{'<S-CR>','Newline in explorer message'}}, 'i')
group('explorer_compose', {{'q','Close explorer composer and keep draft'}})
group('plan', {{'a','Approve epic plan'}, {'d','Discuss plan with the Lead'}, {'e','Edit epic plan file'}})
group('item', {{'e','Edit item file'}, {'L','Agents log for this item'},
  {'ca','Add criterion'}, {'ce','Edit selected criterion'}, {'cd','Remove selected criterion (confirm)'}})
group('board', {{'p','Next board parent'}, {'P','Previous board parent'}, {'<CR>','Open item card'}, {'<2-LeftMouse>','Open item card with mouse'}})
group('graph', {{'p','Next graph parent'}, {'P','Previous graph parent'}, {'d','Toggle done tray nodes'},
  {'s','Group graph by plan stage'},
  {'gp','Open graph stage epic plan'},
  {'o','Turn graph sideways or vertical'}, {'r','Toggle implied blocking edges'},
  {'+','Widen graph labels'}, {'-','Narrow graph labels'},
  {'h','Previous node to the left'}, {'l','Next node to the right'}, {'j','Next node below'}, {'k','Previous node above'},
  {'^','First node in band or first layer'}, {'$','Last node in band or last layer'},
  {'gg','First graph layer or buffer start'}, {'G','Last graph layer or buffer end'}, {'<CR>','Open graph node item'}})
group('artifact', {{'<leader>ps','Send prompt draft'}, {'<leader>pa','Attach prompt draft'},
  {'q','Previous centre view'}, {'R','Render Mermaid in browser'}})
group('artifacts', {{'<CR>','Open file or fold folder/section'}, {'q','Previous centre view'},
  {'n','Create file or folder'}, {'m','Move file into folder'}, {'s','Attach artifact to composer'},
  {'p','Promote selected artifact to repository'}, {'k','Keep or unkeep artifact'}, {'d','Archive artifact'}, {'x','Delete artifact (confirm)'},
  {'za','Toggle artifact fold'}, {'zo','Open artifact fold'}, {'zc','Close artifact fold'},
  {'zR','Open background sections'}, {'zM','Fold background sections'}, {'A','Show or hide archived artifacts'}})
for _, scope in ipairs({'thread', 'topics', 'sessions', 'artifact', 'artifacts'}) do
  group(scope, {{'gP','Pin or restore visibility'}, {'gM','Mute or restore visibility'}})
end
add('thread', 'A', 'Show or hide archived messages')
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
  -- A completion-aware action finishes the native popup before its continuation runs.
  -- `completion.native` may keep a completion key native (for example C-n/C-p).
  local completion = opts.completion
  opts.completion = nil
  if completion then
    assert(not opts.expr, 'completion actions supply their own expression mapping')
    local plug = '<Plug>(cland-action-' .. a.id:gsub('[<>]', '') .. ')'
    vim.keymap.set(modes, plug, rhs, { buffer = buf, nowait = opts.nowait })
    rhs = function()
      if completion.native and completion.native() then return lhs end
      return (vim.fn.pumvisible() == 1 and '<C-y>' or '') .. plug
    end
    opts.expr = true
    opts.replace_keycodes = true
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
  if layout.panel_home(scope) then layout.place_panel(scope, layout.panel_home(scope))
  elseif scope == 'board' or scope == 'log' or scope == 'inbox_full' then layout.show({kind=scope == 'inbox_full' and 'inbox' or scope}, {insert=false})
  elseif scope == 'thread' or scope == 'composer' then layout.show({kind='thread', id=require('cland.views').current_topic() or 'general'}, {insert=false})
  elseif scope == 'rulebook' then require('cland.rulebook').open()
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
command('view rulebook', 'Rulebook', function() require('cland.rulebook').open() end, 'global:<leader>R')
command('view events', 'Events view', function() layout().show({kind='events'}, {insert=false}) end, 'global:<leader>E')
command('help', 'Keys', function() require('cland').help() end, 'global:<leader>?')
command('refresh', 'Refresh from hub', function() require('cland').refresh() end)
command('explorer', 'Open explorer', function(args) require('cland.explorer').open(args[1]) end, 'global:<leader>e')
command('graph', 'Open experimental graph', function(args) require('cland.graph').open(args[1]) end, 'global:<leader>G')
command('launch', 'Launch a session', function(args) require('cland.launcher').open({name=args[1]}) end, 'global:<leader>l')
command('session resume', 'Resume session', function(args) require('cland.sessions').resume(args[1]) end, 'sessions:r')
command('aide', 'Launch an Aide', function() require('cland.launcher').aide() end, 'global:<leader>A')
for _, preset in ipairs({'charting','watch','steady'}) do
  command('preset ' .. preset, 'Preset: ' .. preset, function() layout().preset(preset) end)
end
for _, panel in ipairs({'items','inbox','sessions','topics','dock'}) do
  local mapped = ({items='i', inbox='n', sessions='s', topics='t', dock='T'})[panel]
  command('panel ' .. panel, 'Toggle ' .. panel .. ' panel', function(args)
    if #args > 0 then return require('cland.state').say(':Cland panel items|inbox|sessions|topics left|right', 'ClandRedBar') end
    if panel == 'items' then layout().toggle_left()
    elseif panel == 'dock' then layout().toggle_dock()
    else layout().right_panel(panel) end
  end, 'global:<leader>' .. mapped)
  if panel ~= 'dock' then
    for _, side in ipairs({'left', 'right'}) do
      command('panel ' .. panel .. ' ' .. side, panel:sub(1, 1):upper() .. panel:sub(2) .. ' on the ' .. side, function()
        layout().place_panel(panel, side)
      end)
    end
  end
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
command('view plan', 'Open epic plan view', function(args) require('cland.plan').open(args[1]) end, 'global:gp')
command('topic new', 'New topic', function(args)
  if #args == 0 then views().prompt_topic() else views().create_topic(table.concat(args,' ')) end
end, 'topics:n')
command('topic close', 'Close this topic', function(args) views().close_topic(args[1]) end, 'topics:c')
command('topic resolve', 'Resolve this topic', function(args) views().resolve_topic(args[1]) end, 'global:<leader>r')
command('attachments clear', 'Clear staged artifacts (retain draft text)', function()
  local topic = views().current_topic()
  if not topic or topic == 'agents' then return require('cland.state').say('open a topic composer to clear attachments', 'ClandRedBar') end
  views().topic(topic).composer:clear_attachments()
end)
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
  require('cland.state').say(':Cland preset | view | graph | panel | launch | topic new|close|resolve | prompt | qa dump | refresh | help', 'ClandRedBar')
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
