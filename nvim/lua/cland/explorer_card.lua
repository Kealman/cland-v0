-- The human's picture of a row: its path, summary and facts. Bodies stay in item_view's shared cache.
local api = vim.api
local state = require('cland.state')
local items = require('cland.items')
local summary = require('cland.explorer_summary')
local C = {}
local present = items.present

-- File order determines a task's latest verdict and its round within that kind.
local function latest(it)
  local counts, last, round = {}, nil, nil
  for _, v in ipairs(type(it.verdicts) == 'table' and it.verdicts or {}) do
    counts[v.verdict] = (counts[v.verdict] or 0) + 1
    last, round = v, v.round or counts[v.verdict]
  end
  return last, round
end
local function round_of(it, run)
  local counts = {}
  for _, v in ipairs(type(it.verdicts) == 'table' and it.verdicts or {}) do
    counts[v.verdict] = (counts[v.verdict] or 0) + 1
    if v.run == run then return v.round or counts[v.verdict] end
  end
end
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
  local function text(value, hl, ref)
    local start = #rows
    wrapped(rows, {{value,hl or 'ClandText'}}, width)
    for n=start+1,#rows do rows[n].ref = ref end
  end
  local function section(name, hint)
    rows[#rows+1] = {}
    local bars = require('cland.bars')
    hint = hint and bars.prefix(hint,math.max(0,width-api.nvim_strwidth(name)-2)) or ''
    rows[#rows+1] = {{name:upper(),'ClandSection'},
      {hint ~= '' and ((' '):rep(math.max(0,width-api.nvim_strwidth(name)-api.nvim_strwidth(hint))) .. hint) or '', 'ClandFaint'}}
  end
  local function kv(label, value, hl, ref)
    local start = #rows
    wrapped(rows, {{label,'ClandDim'},{value,hl or 'ClandText'}},width)
    for n=start+1,#rows do rows[n].ref = ref end
  end
  if not key then text('no row under the cursor','ClandDim'); return C.paint(rows) end
  if key:sub(1,1) == ':' then
    local node = E.node_for(ix,key)
    text(node and node.label or key,'ClandBold')
    local about = {
      [':categories'] = 'Categories hold items outside every release and epic.',
      [':unscheduled'] = 'Items with no container, with A showing the closed ones too.',
      [':releases'] = 'Other open releases, with A also showing archived releases.',
      [':closed'] = 'Closed items load when this group is expanded or when you search for an item.',
    }
    text(about[key] or (node and node.more
      and ('Remaining live items in ' .. node.owner .. ', after its top three by rank.')
      or ('Tasks directly under ' .. (node and node.owner or 'this container') .. ', outside any epic.')))
    local list = {}
    for _, child in ipairs(node and E.children(ix,node) or {}) do if child.it then list[#list+1] = child.it end end
    section('holds · ' .. #list .. ' items')
    for n=1,math.min(12,#list) do
      local it = list[n]
      local glyph, hl = E.glyph(ix,it)
      rows[#rows+1] = require('cland.bars').fit({{glyph .. ' ',hl},{it.id .. ' ','ClandDim'},
        {items.display_title(it),E.done(it) and 'ClandDone' or 'ClandText'}},width)
      rows[#rows].ref = list[n].id
    end
    if #list > 12 then text((#list-12) .. ' more · l unfolds them in the tree','ClandFaint') end
    return C.paint(rows)
  end
  local it = ix.by[key]
  if not it then text(key .. ' is no longer in the tracker','ClandDim'); return C.paint(rows) end
  local d = require('cland.item_view').get(it.id, {summary_only=true})
  -- Branch, dates and other detail come from the shared task.view cache.
  it = vim.tbl_extend('force', d or {}, it)
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
  if #path > 0 then text(table.concat(path,' › '),'ClandDim',parent and parent.id) end
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
  kv('parent',parent_path ~= '' and parent_path or '—',nil,parent and parent.id)
  local claim = items.claim(it)
  local lead = container and E.lead(it) or (claim and claim.session or '—')
  kv('lead',lead)
  kv('claim',claim and state.label(claim.session,claim.role) or 'none',claim and 'ClandTeal' or 'ClandFaint')
  local function holds(owner, prefix)
    local list = type(owner.holds)=='table' and owner.holds or {}
    for _, h in ipairs(list) do
      kv(prefix or 'holds',state.label(h.session,h.role) .. ' · since ' .. E.when(h.heldAt),'ClandTeal',owner.id)
    end
    return #list
  end
  if holds(it) == 0 then kv('holds','none','ClandFaint') end
  if container then
    for _, leaf in ipairs(E.leaves(ix,it.id)) do
      local c = items.claim(leaf)
      if c then kv(leaf.id .. ' claim',state.label(c.session,c.role),'ClandTeal',leaf.id) end
      holds(leaf,leaf.id .. ' holds')
    end
  end
  local siblings = E.kids(ix,parent and parent.id or '')
  for n, sibling in ipairs(siblings) do
    if sibling.id == it.id then
      kv(it.rank_set == true and 'rank' or 'ordinal',
        (it.rank_set == true and (tostring(it.rank) .. ' · ') or '') .. ordinal(n) .. ' of ' .. #siblings .. (parent and (' in ' .. parent.id) or ' at the root'),nil,parent and parent.id); break
    end
  end
  if not container and it.kind == 'task' then
    local counts = type(it.criteria) == 'table' and it.criteria or {}
    section('progress')
    text((counts.verified or 0) .. ' of ' .. (counts.total or 0) .. ' verified · ' .. (counts.failed or 0) .. ' failed · ' .. (counts.stale or 0) .. ' stale','ClandDim')
    local crit = require('cland.criteria')
    local refs = crit.refs(d or {})
    for n, criterion in ipairs(d and type(d.criteria)=='table' and d.criteria or {}) do
      local st = crit.status(criterion)
      local g = crit.GLYPH[st]
      text(g[1] .. ' ' .. refs[n] .. ' ' .. criterion.text,g[2])
      local marks = criterion.marks or {}
      local mark = marks[#marks]
      if mark then
        text(mark.kind .. ' · ' .. mark.by .. (present(mark.run) and (' · r' .. tostring(round_of(d or it,mark.run) or '—')) or '') .. ' · ' .. E.when(mark.at),'ClandDim')
        if present(mark.note) then text(mark.note,'ClandRed') end
      end
    end
  elseif container then
    local members = E.kids(ix,it.id)
    if E.is_release(it) then
      local subs = vim.tbl_filter(function(child) return E.is_container(ix,child) end,members)
      if #subs>0 or type(it.child_counts)=='table' then members = subs end
    elseif type(it.child_counts)=='table' then
      members = vim.tbl_filter(function(child) return child.kind=='task' end,members)
    end
    local statuses, done, blocked = {}, 0, 0
    for _, child in ipairs(members) do
      local status = E.status_of(ix,child)
      if status == 'in work' then status = 'in progress' end
      statuses[#statuses+1] = status
      if status == 'done' then done = done+1 end
      if not E.done(child) and #items.open_blockers(child)>0 then blocked = blocked+1 end
    end
    local total = #members
    if type(it.child_counts) == 'table' then
      done, total, statuses = it.child_counts.done, it.child_counts.total, items.child_statuses(it)
    end
    section('progress')
    text(done .. ' of ' .. total .. ' done','ClandDim')
    local cells, counts = E.cells(statuses,width)
    rows[#rows+1] = cells
    local words = {}
    for _, status in ipairs(E.BAR_ORDER) do
      if counts[status] then words[#words+1] = counts[status] .. ' ' .. status end
    end
    text(table.concat(words,' · ') .. (blocked>0 and (', ' .. blocked .. ' blocked') or ''),'ClandDim')
    local stages = E.stages(it)
    for n, stage in ipairs(stages or {}) do
      local list = {}
      for _, id in ipairs(stage.items or {}) do
        if ix.by[id] then list[#list+1] = E.leaf_status(ix.by[id]) end
      end
      if type(stage.statuses)=='table' then
        list = {}
        for _, status in ipairs(E.BAR_ORDER) do
          for _=1,stage.statuses[status] or 0 do list[#list+1] = status end
        end
      end
      local row = {{'S' .. n .. ' ','ClandDim'}}
      local stage_cells = E.cells(list,math.max(1,width-12))
      vim.list_extend(row,stage_cells)
      row[#row+1] = {' ' .. stage.state,'ClandDim'}
      rows[#rows+1] = row
    end
  end
  if items.level_of(it) == 2 then
    local plan = require('cland.plan').get(it.id)
    local stages = E.stages(it) or {}
    local current
    for n, stage in ipairs(stages) do if stage.state ~= 'closed' and not current then current = n end end
    section('plan' .. (#stages>0 and (current and (' · stage ' .. current .. ' of ' .. #stages) or (' · all ' .. #stages .. ' stages closed')) or ''),'gp opens the plan view')
    if not plan then text('loading the plan…','ClandFaint')
    elseif type(plan.plan)~='table' then text(plan.error or 'no plan','ClandFaint')
    else
      if plan.error then text('not current: ' .. plan.error,'ClandAmber') end
      local function closed_at(stage)
        if present(stage.closed) then return stage.closed end
        if present(stage.closedAt) then return stage.closedAt end
        local at
        for _, id in ipairs(stage.items or {}) do
          local child = ix.by[id]
          if not child or not present(child.closed) then return nil end
          if not at or child.closed > at then at = child.closed end
        end
        local verdict = type(stage.verdict)=='table' and stage.verdict
        if verdict and present(verdict.at) and (not at or verdict.at > at) then at = verdict.at end
        return at
      end
      for n, stage in ipairs(stages) do
        local definition = plan.plan.stages[n] or {}
        local value = 'S' .. n .. ' ' .. (stage.name or definition.name or '') .. ' · ' .. (n == current and 'in work' or stage.state)
        if n == current then
          local merged = 0
          for _, id in ipairs(stage.items or {}) do if ix.by[id] and E.done(ix.by[id]) then merged = merged+1 end end
          local complete = type(stage.merged)=='number' and type(stage.total)=='number'
          if complete then merged = stage.merged end
          value = value .. ' · ' .. merged .. ' of ' .. (complete and stage.total or #(stage.items or {})) .. ' merged' .. (complete and '' or ' (loaded)') .. ' · ' .. E.policy(stage.qa or definition.qa)
        elseif stage.state == 'closed' then
          value = value .. ' · ' .. E.when(closed_at(stage))
        end
        text(value,n == current and 'ClandTeal' or 'ClandDim')
      end
      local approval = type(plan.approval)=='table' and plan.approval or {}
      kv('approval',approval.state == 'approved' and ('human · approved by ' .. (approval.by or 'human') .. ' ' .. E.when(approval.at)) or approval.state or 'unavailable')
    end
  end

  section('latest verdict')
  local verdict, round = latest(it)
  local owner = it
  local subtree = {}
  local function descendants(parent)
    for _, child in ipairs(E.kids(ix,parent.id)) do
      subtree[#subtree+1] = child
      descendants(child)
    end
  end
  if container then
    descendants(it)
    verdict, round = nil, nil
    for _, child in ipairs(subtree) do
      local counts = {}
      for _, v in ipairs(type(child.verdicts)=='table' and child.verdicts or {}) do
        counts[v.verdict] = (counts[v.verdict] or 0)+1
        if not verdict or (v.at or '') >= (verdict.at or '') then verdict, round, owner = v, v.round or counts[v.verdict], child end
      end
    end
  end
  if verdict then
    local detail = owner.id == it.id and d or require('cland.item_view').get(owner.id, {summary_only=true})
    -- Closed summary rows defer card metadata; full detail retains historical rounds.
    round = verdict.round or round_of(detail or {},verdict.run) or round
    local scope = verdict.scope
    if not present(scope) then
      for _, v in ipairs(detail and type(detail.verdicts)=='table' and detail.verdicts or {}) do
        if v.run == verdict.run then scope = v.scope end
      end
    end
    if container then text('in its tasks · ' .. owner.id .. ' ' .. items.display_title(owner),'ClandDim',owner.id) end
    local ok = verdict.result == 'clear'
    text((ok and '✓ ' or '✗ ') .. verdict.verdict .. ' · ' .. verdict.result,ok and 'ClandGreen' or 'ClandRed',owner.id)
    local by = present(verdict.by) and verdict.by or present(verdict.author) and verdict.author or '—'
    local label = require('cland.item_view').by(by)
    if not by:match('%[.-%]$') then
      local session = state.session(by)
      label = state.label(by,session and session.role or (verdict.verdict == 'review' and 'reviewer' or 'qa'))
    end
    kv('by',label .. ' · r' .. round,nil,owner.id)
    text((present(scope) and (scope .. ' · ') or '') .. E.when(verdict.at) .. (verdict.current == false and ' · stale' or ''),'ClandDim',owner.id)
    local reason
    for _, comment in ipairs(detail and type(detail.comments)=='table' and detail.comments or {}) do
      if type(comment.verdict)=='table' and comment.verdict.run == verdict.run then reason = summary.sentences(comment.text)[1] end
    end
    if reason then rows[#rows+1] = require('cland.bars').fit({{reason,'ClandText'}},width); rows[#rows].ref = owner.id
    else text(detail and 'no reason in the verdict comment' or 'loading the reason…','ClandFaint',owner.id) end
    kv('run',present(verdict.run) and verdict.run or '—','ClandDim',owner.id)
  else text('none yet','ClandFaint') end

  section('relations')
  local function relations(label, ids)
    if #ids == 0 then return kv(label,'none','ClandFaint') end
    for _, id in ipairs(ids) do
      local target = ix.by[id]
      local g, hl = '?', 'ClandDim'
      if target then g, hl = E.glyph(ix,target) end
      kv(label,id .. ' ' .. g .. ' ' .. (target and E.status_of(ix,target) or 'unknown') ..
        (target and (' · ' .. items.display_title(target) .. (E.done(target) and (' · ' .. E.when(target.closed)) or '')) or ''),hl,id)
    end
  end
  relations('blocked by',type(it.blocked_by)=='table' and it.blocked_by or {})
  if type(it.follows)=='table' and #it.follows>0 then relations('follows',it.follows) end
  relations('blocks',items.blocks(it.id))
  if present(it.regression_of) then relations('regression of',{it.regression_of}) end

  if it.kind == 'task' then
    section('branch and suite')
    kv('branch',present(it.branch) and it.branch or '—')
    local verify = type(it.verify)=='table' and it.verify
    if verify then
      local result = verify.result
      local word = result == 'passed' and '✓ passed' or result == 'failed' and '✗ failed' or result == 'cancelled' and 'cancelled' or result == 'unavailable' and 'unavailable' or verify.state
      kv('suite',word .. ' · ' .. verify.id .. ' · ' .. verify.head:sub(1,7) .. ' · ' .. E.when(verify.finished) .. (verify.cached and ' · cached' or ''),
        result == 'passed' and 'ClandGreen' or result == 'failed' and 'ClandRed' or 'ClandDim')
    else text('no cland verify run for this task','ClandFaint') end
  end
  section('dates')
  local function date(at)
    local time = E.local_time(at)
    return time and os.date('%Y-%m-%d %H:%M',time) or '—'
  end
  kv('created',date(it.created)); kv('updated',date(it.updated))
  local last = {at=present(it.updated) and it.updated or '',owner=it,what='item updated'}
  local function activity(item)
    local topic = items.topic(item)
    local message = topic and present(topic.lastMessageAt) and topic.lastMessageAt
    if present(item.updated) and item.updated > last.at then last = {at=item.updated,owner=item,what='item updated'} end
    if message and message > last.at then last = {at=message,owner=item,what='a message in its topic'} end
  end
  activity(it)
  for _, child in ipairs(subtree) do activity(child) end
  kv('last',E.when(last.at) .. ' · ' .. last.what .. (last.owner.id~=it.id and (' · ' .. last.owner.id .. ' ' .. items.display_title(last.owner)) or ''),nil,last.owner.id)

  for n=#(d and type(d.comments)=='table' and d.comments or {}),1,-1 do
    local comment = d.comments[n]
    local raw = vim.trim(comment.text or '')
    local opening = raw:gsub('^[#%*%s]+','')
    if opening:match('^Resolution') or opening:match('^Decided') then
      section('decision')
      text(summary.summary(raw))
      text('by ' .. comment.author .. ' · ' .. E.when(comment.at),'ClandFaint')
      break
    end
  end
  rows[#rows+1] = {}
  local names, words = summary.outline(d and d.body or '')
  local open = E.card.body_open and E.card.body_open[it.id]
  rows[#rows+1] = require('cland.bars').fit({{(open and '▾ ' or '▸ ') .. "agents' text · " .. (#names>0 and table.concat(names,', ') or 'no sections') .. ' · ' .. words .. ' words','ClandDim'},{'  zb','ClandFaint'}},width)
  if open and d then
    for _, line in ipairs(vim.split(d.body or '','\n',{plain=true})) do
      if line == '' then rows[#rows+1] = {} else text(line,line:match('^#') and 'ClandHeading' or 'ClandText') end
    end
  end
  rows[#rows+1] = {}
  rows[#rows+1] = {{require('cland.explorer_compose').line(it),'ClandFaint'}}
  return C.paint(rows)
end

function C.paint(rows)
  local lines, marks, info = {}, {}, {}
  for r, chunks in ipairs(rows) do
    local parts, col = {}, 0
    for _, c in ipairs(chunks) do
      local t = tostring(c[1] or '')
      parts[#parts+1] = t
      if c[2] and t ~= '' then marks[#marks+1] = {r-1,col,col+#t,c[2]} end
      col = col + #t
    end
    lines[r] = table.concat(parts)
    info[r] = {ref=chunks.ref}
  end
  return lines, marks, info
end
return C
