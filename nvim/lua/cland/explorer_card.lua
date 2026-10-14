-- The human's picture of a row: its path, summary and facts. Bodies stay in item_view's shared cache.
local api = vim.api
local state = require('cland.state')
local items = require('cland.items')
local summary = require('cland.explorer_summary')
local C = {}
local function ordinal(n)
  if n % 100 >= 11 and n % 100 <= 13 then return n .. 'th' end
  return n .. (({'st','nd','rd'})[n % 10] or 'th')
end
local LAYER_RANK = {now=4,watch=3,background=2,archive=1}

-- Wrap styled chunks ourselves; long words are split by display cells, keeping UTF-8 and highlights.
local function wrapped(rows, chunks, width)
  local line, used = {}, 0
  local function flush() rows[#rows+1] = line; line, used = {}, 0 end
  for _, chunk in ipairs(chunks) do
    for word in tostring(chunk[1]):gmatch('%S+') do
      local size = api.nvim_strwidth(word)
      if used > 0 and used + 1 + size > width then flush() end
      if used > 0 then line[#line+1] = {' '}; used = used + 1 end
      while size > width - used do
        local part = require('cland.bars').prefix(word, width - used)
        line[#line+1] = {part,chunk[2]}; flush()
        word = word:sub(#part+1); size = api.nvim_strwidth(word)
      end
      line[#line+1] = {word,chunk[2]}; used = used + size
    end
  end
  if #line > 0 then flush() end
end

function C.compose(key, width)
  local E = require('cland.explorer')
  local ix = E.ix or E.index()
  width = math.max(8, width or 60)
  local rows = {}
  local function text(value, hl) wrapped(rows, {{value,hl or 'ClandText'}}, width) end
  local function section(name) rows[#rows+1] = {}; text(name:upper(),'ClandSection') end
  local function kv(label, value, hl)
    wrapped(rows, {{label,'ClandDim'},{value,hl or 'ClandText'}},width)
  end
  if not key then text('no row under the cursor','ClandDim'); return C.paint(rows) end
  if key:sub(1,1) == ':' then
    local node = E.node_for(ix,key)
    text(node and node.label or key,'ClandBold')
    local about = {
      [':categories'] = 'Categories hold items outside every release and epic.',
      [':unscheduled'] = 'Items with no container. A shows the closed ones too.',
      [':releases'] = 'Other open releases. A also shows archived releases.',
    }
    text(about[key] or ('Tasks directly under ' .. (node and node.owner or 'this container') .. ', outside any epic.'))
    local list = {}
    for _, child in ipairs(node and E.children(ix,node) or {}) do if child.it then list[#list+1] = child.it end end
    section('holds · ' .. #list .. ' items')
    for n=1,math.min(12,#list) do
      rows[#rows+1] = require('cland.bars').fit({{list[n].id .. ' ','ClandDim'},{items.display_title(list[n]),'ClandText'}},width)
    end
    if #list > 12 then text((#list-12) .. ' more · l unfolds them in the tree','ClandFaint') end
    return C.paint(rows)
  end
  local it = ix.by[key]
  if not it then text(key .. ' is no longer in the tracker','ClandDim'); return C.paint(rows) end
  local d = require('cland.item_view').get(it.id)
  local container = E.is_container(ix,it)
  local chain, p, seen = {}, items.present(it.parent) and ix.by[it.parent] or nil, {}
  while p and not seen[p.id] do
    seen[p.id] = true; table.insert(chain,1,p)
    p = items.present(p.parent) and ix.by[p.parent] or nil
  end
  local path = {}
  if items.is_category(it) or (chain[1] and items.is_category(chain[1])) then path[#path+1] = 'Categories' end
  for _, ancestor in ipairs(chain) do
    path[#path+1] = ancestor.id .. ' ' .. items.display_title(ancestor)
  end
  local parent = chain[#chain]
  local parent_path = table.concat(path,' › ')
  local tag = parent and require('cland.plan').stage_tag(parent.id,it.id)
  if tag then path[#path+1] = tag end
  if #path > 0 then text(table.concat(path,' › '),'ClandDim') end
  text(items.display_title(it),'ClandBold')
  section('summary')
  if not d then text("loading the agents' text…",'ClandFaint')
  elseif d.error then text('task.view failed: ' .. d.error,'ClandRed')
  else
    local value, from = summary.summary(d.body or '')
    text(value ~= '' and value or 'no summary',value ~= '' and 'ClandText' or 'ClandFaint')
    if value ~= '' and from ~= 'written' then
      text('fallback from ' .. (from and ('## ' .. from) or 'the body') .. ' · no ## Summary yet','ClandFaint')
    end
    if d.note then text('not current: ' .. d.note,'ClandAmber') end
  end
  section('facts')
  local glyph, ghl = E.glyph(ix,it)
  kv('status',glyph .. ' ' .. E.status_of(ix,it) .. (container and ', derived' or ''),ghl)
  local layer = it.layer
  if container then
    layer = nil
    for _, leaf in ipairs(E.leaves(ix,it.id)) do
      if items.present(leaf.layer) and (not layer or (LAYER_RANK[leaf.layer] or 0) > (LAYER_RANK[layer] or 0)) then layer = leaf.layer end
    end
  end
  kv('layer',items.present(layer) and layer or '—')
  kv('labels',type(it.labels)=='table' and #it.labels>0 and table.concat(it.labels,' · ') or '—')
  kv('size',items.present(it.size) and it.size or '—')
  kv('parent',parent_path ~= '' and parent_path or '—')
  local claim = items.claim(it)
  local lead = container and E.lead(it) or (claim and claim.session or '—')
  kv('lead',lead)
  kv('claim',claim and state.label(claim.session,claim.role) or 'none',claim and 'ClandTeal' or 'ClandFaint')
  local function holds(owner, prefix)
    local list = type(owner.holds)=='table' and owner.holds or {}
    for _, h in ipairs(list) do
      kv(prefix or 'holds',state.label(h.session,h.role) .. ' · since ' .. E.when(h.heldAt),'ClandTeal')
    end
    return #list
  end
  if holds(it) == 0 then kv('holds','none','ClandFaint') end
  if container then
    for _, leaf in ipairs(E.leaves(ix,it.id)) do
      local c = items.claim(leaf)
      if c then kv(leaf.id .. ' claim',state.label(c.session,c.role),'ClandTeal') end
      holds(leaf,leaf.id .. ' holds')
    end
  end
  local siblings = E.kids(ix,parent and parent.id or '')
  for n, sibling in ipairs(siblings) do
    if sibling.id == it.id then
      kv('ordinal',ordinal(n) .. ' of ' .. #siblings .. (parent and (' in ' .. parent.id) or ' at the root')); break
    end
  end
  return C.paint(rows)
end

function C.paint(rows)
  local lines, marks = {}, {}
  for r, chunks in ipairs(rows) do
    local parts, col = {}, 0
    for _, c in ipairs(chunks) do
      local t = tostring(c[1] or '')
      parts[#parts+1] = t
      if c[2] and t ~= '' then marks[#marks+1] = {r-1,col,col+#t,c[2]} end
      col = col + #t
    end
    lines[r] = table.concat(parts)
  end
  return lines, marks
end
return C
