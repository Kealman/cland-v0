-- Read-only presentation of the hub's accepted epic plan. Approval is a hub operation;
-- absent approval metadata stays unknown, and a refused request never changes the card.
local api = vim.api
local state = require('cland.state')
local items = require('cland.items')
local M = { bufs = {}, detail = {}, pending = {}, stale = {} }
local ns = api.nvim_create_namespace('cland.plan')
local function width(s) return api.nvim_strwidth(s or '') end
local function fit(s, w) return require('cland.bars').prefix(s, math.max(0, w)) end
local function wrap(s, w)
  w = math.max(1, w)
  local out = {}
  for _, para in ipairs(vim.split(s or '', '\n', { plain = true })) do
    local line = ''
    for word in para:gmatch('%S+') do
      if line ~= '' and width(line .. ' ' .. word) > w then out[#out + 1], line = line, '' end
      while width(word) > w do
        if line ~= '' then out[#out + 1], line = line, '' end
        local part = fit(word, w)
        -- A wide character cannot fit in a one-column remainder.
        if part == '' then part = vim.fn.strcharpart(word, 0, 1) end
        out[#out + 1], word = fit(part, w), word:sub(#part + 1)
      end
      line = line == '' and word or (line .. ' ' .. word)
    end
    out[#out + 1] = line
  end
  return out
end

function M.setup(client)
  M.client = client
  client:on('connected', function()
    for id in pairs(M.detail) do M.stale[id] = true end
    state.changed()
  end)
end

function M.owner(id)
  local seen, it = {}, state.item(id or '')
  while it and not seen[it.id] do
    if it.kind == state.S.tracker.levels[2] then return it.id end
    seen[it.id] = true
    it = items.present(it.parent) and state.item(it.parent) or nil
  end
end

function M.invalidate(id)
  local owner = M.owner(id)
  if owner then M.stale[owner] = true end
end

function M.fetch(id)
  if M.pending[id] or not (M.client and M.client:connected()) then return end
  M.pending[id], M.stale[id] = true, nil
  local asked = (state.item(id) or {}).updated
  M.client:request({ type = 'task.plan', item = id, op = 'show' }, function(err, value)
    M.pending[id] = nil
    if err then
      M.detail[id] = vim.tbl_extend('force', M.detail[id] or {}, { error = tostring(err), seen = asked })
    else
      M.detail[id] = type(value) == 'table' and value or { error = 'task.plan answered no plan' }
      M.detail[id].seen = asked
    end
    state.changed()
  end)
end

function M.get(id)
  local d, it = M.detail[id], state.item(id)
  if it and (not d or M.stale[id] or d.seen ~= it.updated) then M.fetch(id) end
  return d
end

function M.open(id)
  id = M.owner(id or require('cland.motions').item_of(require('cland.motions').subject()))
  if not id then return state.say('gp: select an epic or an item in an epic') end
  M.stale[id] = true
  if not state.S.ui.left then require('cland.layout').toggle_left() end
  require('cland.layout').show({ kind = 'plan', id = id }, { insert = false })
end

function M.approve(id)
  if not (M.client and M.client:connected()) then return state.say('plan approval needs a connected hub', 'ClandAmberBar') end
  -- Older hubs refuse this operation. Keep that refusal visible; never record a local approval.
  M.client:request({ type = 'task.plan', item = id, op = 'approve' }, function(err)
    if err then return state.say('plan approval: ' .. tostring(err), 'ClandRedBar') end
    M.stale[id] = true
    M.fetch(id)
    state.say('plan approval accepted by the hub')
  end)
end

function M.discuss(id)
  local function compose(topic)
    local tv = require('cland.views').topic(topic)
    tv.composer:answer_to(nil)
    local draft = tv.composer:text()
    local address = '@lead ' .. id .. ' '
    if draft:sub(1, #address) ~= address then tv.composer:set_text(address .. draft) end
    require('cland.layout').show({ kind = 'thread', id = topic }, { insert = true })
  end
  local topic = require('cland.motions').topic_of({ item = id })
  if topic then return compose(topic) end
  if not (M.client and M.client:connected()) then return state.say('discussion needs a connected hub', 'ClandAmberBar') end
  M.client:request({ type = 'topic.create', item = id, title = id .. ' · plan' }, function(err, value)
    if err then return state.say('plan discussion: ' .. tostring(err), 'ClandRedBar') end
    if value and value.topic then state.upsert_topic(value.topic); compose(value.topic.id) end
  end)
end

function M.edit(id)
  require('cland.item_view').edit(id)
  local it = state.item(id)
  if it and it.file then vim.fn.search('^## Plan', 'cw') end
end

local function policy(qa)
  if qa.scope == 'none' then return 'none · review only' end
  return qa.scope .. ' · ' .. (qa.when == 'after-stage' and 'after stage' or 'per item')
end
local function stage_policies(stage, plan)
  local per_item, after = {}, nil
  for _, lane in ipairs(stage.lanes) do for _, id in ipairs(lane) do
    local qa = plan.items and plan.items[id] and plan.items[id].qa or stage.qa
    if qa.scope ~= 'none' then
      if qa.when == 'per-item' then per_item[#per_item + 1] = id
      elseif qa.scope == 'full' or not after then after = qa.scope end
    end
  end end
  return per_item, after
end
local function gate(stage, plan)
  local per_item, after = stage_policies(stage, plan)
  local parts = {}
  if #per_item > 0 then parts[#parts + 1] = 'per-item QA before merge: ' .. table.concat(per_item, ', ') end
  if after then parts[#parts + 1] = 'one ' .. after .. ' QA run on dev after all items merge closes the stage' end
  if #parts == 0 then return 'closes when all items merge on review' end
  if not after then parts[#parts + 1] = 'closes when all items merge' end
  return table.concat(parts, '; ')
end

function M.stage_tag(epic, id)
  local d = M.get(epic)
  for n, stage in ipairs(d and type(d.plan) == 'table' and d.plan.stages or {}) do
    for _, lane in ipairs(stage.lanes) do
      if vim.tbl_contains(lane, id) then return 'S' .. n end
    end
  end
end

local function session_label(name, role)
  local session = state.session(name)
  return session and session.label or state.label(name, role)
end
local function who(it)
  local chunks = vim.deepcopy(require('cland.vboard').who(it))
  local claim = items.claim(it)
  for _, chunk in ipairs(chunks) do
    local session = state.session(chunk[1])
    if session then chunk[1] = session.label
    elseif claim and chunk[1] == claim.session then chunk[1] = state.label(claim.session, claim.role) end
  end
  return chunks
end

local function lane_rows(lane, plan)
  local rows = {}
  for _, id in ipairs(lane) do
    local it = state.item(id) or { id = id, title = '(not in the index)' }
    local glyph = items.GLYPH[items.status(it)] or items.GLYPH.open
    local n, total = require('cland.vboard').fraction(it)
    local blockers = items.open_blockers(it)
    local marks, group = {}, glyph[2]
    for _, chunk in ipairs(who(it)) do marks[#marks + 1] = chunk[1]; if chunk[2] == 'ClandRed' then group = chunk[2] end end
    local mark = #marks > 0 and (' · ' .. table.concat(marks, ' · ')) or ''
    rows[#rows + 1] = { (#blockers > 0 and '◌' or glyph[1]) .. ' ' .. id .. ' ' .. (it.title or '') .. mark .. ' ' .. n .. '/' .. total, group }
    if #blockers > 0 then rows[#rows + 1] = { '  blocked by ' .. table.concat(blockers, ', '), 'ClandDim' } end
    local override = plan.items and plan.items[id]
    if override and override.qa then rows[#rows + 1] = { '  override: QA ' .. policy(override.qa), 'ClandDim' } end
    if override and override.qa_criteria then rows[#rows + 1] = { '  QA criteria: ' .. table.concat(override.qa_criteria, ', '), 'ClandDim' } end
  end
  return rows
end

local function stats(plan)
  local n, lanes, runs = 0, 0, 0
  for _, stage in ipairs(plan.stages) do
    lanes = math.max(lanes, #stage.lanes)
    for _, lane in ipairs(stage.lanes) do n = n + #lane end
    local per_item, after = stage_policies(stage, plan)
    runs = runs + #per_item + (after and 1 or 0)
  end
  return n, lanes, runs
end

-- The source excerpt keeps the file's text; it does not parse or reconstruct the accepted YAML.
local function source_yaml(body)
  local in_plan, fence, out = false, nil, {}
  for _, line in ipairs(vim.split(body or '', '\n', { plain = true })) do
    if fence then
      local close = line:match('^%s*([`~]+)%s*$')
      if close and close:sub(1, 1) == fence:sub(1, 1) and #close >= #fence then break end
      out[#out + 1] = line
    elseif in_plan then
      fence = line:match('^%s*([`~]+)ya?ml%s*$')
      if line:match('^##?%s') then break end
    elseif line:match('^## Plan%s*$') then in_plan = true end
  end
  return out
end

function M.compose(id, w)
  local it, d = state.item(id), M.detail[id]
  local left, right = {}, {}
  local fw = w >= 100 and math.min(36, math.floor(w * 0.3)) or 0
  local bw = fw > 0 and w - fw - 3 or w
  local function add(text, hl) left[#left + 1] = { { text or '', hl } } end
  local boxed = false
  local function prose(text, hl)
    for _, line in ipairs(wrap(text, bw - (boxed and 6 or 2))) do
      if boxed then
        left[#left + 1] = { { ' │ ', 'ClandFaint' }, { line, hl },
          { (' '):rep(math.max(0, bw - 6 - width(line))) .. ' │', 'ClandFaint' } }
      else add(' ' .. line, hl) end
    end
  end
  add()
  prose('Plan of ' .. id .. ' ' .. (it and it.title or ''), 'ClandBold')
  local detail = require('cland.item_view').get(id)
  local ancestry = {}
  for _, a in ipairs(detail and detail.ancestry or {}) do ancestry[#ancestry + 1] = a.id .. ' ' .. a.title end
  if #ancestry > 0 then prose(table.concat(ancestry, ' › ') .. ' › plan', 'ClandDim') end
  local claim = it and items.claim(it)
  local lead = claim and state.session(claim.session)
  prose('lead: ' .. (claim and session_label(claim.session, claim.role) or 'no Lead claimed'), 'ClandTeal')
  if claim then
    prose((lead and items.present(lead.harness) and lead.harness or 'unknown harness') .. ' · '
      .. (lead and items.present(lead.model) and lead.model or 'unknown model') .. ' · '
      .. (lead and lead.state or 'unknown state'), 'ClandDim')
  end
  if it and it.updated then prose('plan file updated: ' .. it.updated, 'ClandDim') end
  if not d then prose('loading the plan…', 'ClandDim')
  elseif type(d.plan) ~= 'table' then prose(d.error or d.planError or 'No plan yet. e opens the epic file at ## Plan.', 'ClandDim')
  else
    if d.error then prose('not current: ' .. d.error, 'ClandRed') end
    if d.planError then prose('Previous accepted plan kept: ' .. d.planError, 'ClandAmber') end
    local plan = d.plan
    local approval = d.approval or {}
    local approval_text = approval.state == 'approved' and ('✓ approved by ' .. (approval.by or 'human') .. ' · ' .. (approval.at or ''))
      or approval.state == 'pending' and '▲ awaiting your approval · no session launched'
      or approval.state == 'not required' and 'Approval not required' or '▲ approval state unavailable from this hub'
    add(' ┌' .. ('─'):rep(math.max(0, bw - 4)) .. '┐', 'ClandAmber')
    boxed = true
    prose(approval_text, 'ClandAmber')
    prose('a approve · d discuss with the Lead · e edit plan', 'ClandAmber')
    boxed = false
    add(' └' .. ('─'):rep(math.max(0, bw - 4)) .. '┘', 'ClandAmber')
    for n, stage in ipairs(plan.stages) do
      add()
      add(' ┌' .. ('─'):rep(math.max(0, bw - 4)) .. '┐', 'ClandFaint')
      boxed = true
      prose('S' .. n .. ' · ' .. stage.name .. ' · ' .. #stage.lanes .. ' lanes', 'ClandBold')
      prose('QA: ' .. policy(stage.qa), 'ClandText')
      local per_band = math.max(1, math.floor((bw - 6) / 24))
      for first = 1, #stage.lanes, per_band do
        local count = math.min(per_band, #stage.lanes - first + 1)
        local lw = math.max(1, math.floor((bw - 6 - (count - 1) * 3) / count))
        local columns, height = {}, 0
        for i = 1, count do
          local lane = first + i - 1
          local col = {}
          for _, line in ipairs(wrap('lane ' .. lane .. ' · ordered items', lw)) do col[#col + 1] = { line, 'ClandDim' } end
          for _, row in ipairs(lane_rows(stage.lanes[lane], plan)) do
            for _, line in ipairs(wrap(row[1], lw)) do col[#col + 1] = { line, row[2] } end
          end
          columns[i], height = col, math.max(height, #col)
        end
        for r = 1, height do
          local chunks = { { ' │ ', 'ClandFaint' } }
          for i, col in ipairs(columns) do
            if i > 1 then chunks[#chunks + 1] = { ' │ ', 'ClandFaint' } end
            local row = col[r] or { '' }
            chunks[#chunks + 1] = { row[1] .. (' '):rep(math.max(0, lw - width(row[1]))), row[2] }
          end
          chunks[#chunks + 1] = { (' '):rep(math.max(0, bw - 6 - (count * lw + (count - 1) * 3))) .. ' │', 'ClandFaint' }
          left[#left + 1] = chunks
        end
      end
      prose('Gate: ' .. gate(stage, plan), 'ClandDim')
      boxed = false
      add(' └' .. ('─'):rep(math.max(0, bw - 4)) .. '┘', 'ClandFaint')
      if n < #plan.stages then prose('↓ S' .. (n + 1) .. ' starts when S' .. n .. ' closes', 'ClandDim') end
    end
    local total, lanes, runs = stats(plan)
    local crew = state.S.crew and state.S.crew.config and state.S.crew.config.crew or {}
    local staffing = crew.implementer and crew.implementer.policy
    local on_approve = staffing == 'per-group'
      and ('On approval: the Lead launches ' .. #plan.stages[1].lanes .. ' sessions, one per S1 lane.')
      or ('On approval: the Lead starts S1 under the ' .. (staffing or 'unknown') .. ' crew policy.')
    local fields = {
      'PLAN · ' .. (approval.state or 'approval state unavailable'),
      on_approve,
      'First stage: ' .. #plan.stages[1].lanes .. ' lanes',
      'Items · stages: ' .. total .. ' items in ' .. #plan.stages .. ' stages',
      'Implementers: ' .. lanes .. ' lanes per stage at most',
      'Crew: implementer ' .. (staffing or 'unknown'),
      'Review: every item', 'QA runs: ' .. runs .. ' planned', 'Estimated QA cost: [cost]',
      'OUTSIDE THE EPIC',
    }
    for n, stage in ipairs(plan.stages) do
      table.insert(fields, #fields, 'S' .. n .. ' QA: ' .. policy(stage.qa))
    end
    local outside, seen = {}, {}
    for _, s in ipairs(plan.stages) do for _, lane in ipairs(s.lanes) do for _, item_id in ipairs(lane) do
      for _, blocker in ipairs(items.open_blockers(state.item(item_id) or {})) do
        if not require('cland.vboard').under(state.item(blocker), id) and not seen[blocker] then
          seen[blocker] = true
          outside[#outside + 1] = blocker .. ' ' .. ((state.item(blocker) or {}).title or '(unknown)')
        end
      end
    end end end
    vim.list_extend(fields, #outside > 0 and outside or { 'No open external blockers' })
    fields[#fields + 1] = 'SOURCE · ## Plan · e opens the file'
    -- Show the indexed file's YAML excerpt, never synthesise a second plan parser.
    for _, field in ipairs(fields) do
      for _, line in ipairs(wrap(field, (fw > 0 and fw or bw) - 2)) do right[#right + 1] = { { ' ' .. line, 'ClandDim' } } end
      right[#right + 1] = {}
    end
    for _, line in ipairs(source_yaml(detail and detail.body)) do
      right[#right + 1] = { { ' ' .. fit(line, (fw > 0 and fw or bw) - 2), 'ClandDim' } }
    end
  end
  if fw == 0 then add(); vim.list_extend(left, right); right = {} end
  local rows = {}
  for r = 1, math.max(#left, #right) do
    local chunks = vim.deepcopy(left[r] or {})
    if right[r] then
      local used = 0
      for _, c in ipairs(chunks) do used = used + width(c[1]) end
      chunks[#chunks + 1] = { (' '):rep(math.max(0, bw - used)) .. ' │', 'ClandFaint' }
      vim.list_extend(chunks, right[r])
    end
    rows[#rows + 1] = chunks
  end
  rows[#rows + 1] = { { fit(' a approve · d discuss · e edit · gi item · gt topic · gs Lead · ␣␣ back', w), 'ClandFaint' } }
  local lines, marks = {}, {}
  for r, chunks in ipairs(rows) do
    local text = ''
    for _, c in ipairs(chunks) do
      local part = fit(c[1], w - width(text))
      if c[2] and #part > 0 then marks[#marks + 1] = { r - 1, #text, { end_col = #text + #part, hl_group = c[2] } } end
      text = text .. part
    end
    lines[r] = text
  end
  return lines, marks
end

function M.render(id)
  local b = M.bufs[id]
  if not (b and api.nvim_buf_is_valid(b)) then
    b = api.nvim_create_buf(false, true)
    M.bufs[id] = b
    vim.bo[b].bufhidden, vim.bo[b].modifiable = 'hide', false
    vim.b[b].cland_role, vim.b[b].cland_item = 'plan', id
    api.nvim_buf_set_name(b, 'cland://plan/' .. id)
    for key, action in pairs({ a = M.approve, d = M.discuss, e = M.edit }) do
      require('cland.actions').map('n', key, function() action(id) end, { buffer = b, silent = true, nowait = true })
    end
  end
  M.get(id)
  local win = vim.fn.bufwinid(b)
  local w = api.nvim_win_get_width(win ~= -1 and win or require('cland.layout').centre()) - 1
  local lines, marks = M.compose(id, w)
  vim.bo[b].modifiable = true
  api.nvim_buf_set_lines(b, 0, -1, false, lines)
  vim.bo[b].modifiable = false
  api.nvim_buf_clear_namespace(b, ns, 0, -1)
  for _, mark in ipairs(marks) do api.nvim_buf_set_extmark(b, ns, mark[1], mark[2], mark[3]) end
  return b
end

function M.panel_id()
  local v = state.S.ui.view
  return v.kind == 'plan' and v.id or nil
end

function M.render_panel(c, id)
  local it = state.item(id)
  local list = {}
  for _, child in ipairs(items.ordered()) do
    if child.id ~= id and child.kind == 'task' and require('cland.vboard').under(child, id) then list[#list + 1] = child end
  end
  local positions, sequence = {}, 0
  local detail = M.get(id)
  for _, stage in ipairs(detail and type(detail.plan) == 'table' and detail.plan.stages or {}) do
    for _, lane in ipairs(stage.lanes) do for _, item in ipairs(lane) do
      sequence = sequence + 1; positions[item] = sequence
    end end
  end
  table.sort(list, function(a, b)
    if positions[a.id] or positions[b.id] then return (positions[a.id] or math.huge) < (positions[b.id] or math.huge) end
    return items.compare_rank(a, b)
  end)
  local done = 0
  for _, child in ipairs(list) do if child.status == 'done' then done = done + 1 end end
  c:add({ { ' ' .. id .. ' ' .. (it and it.title or ''), 'ClandBold' } },
    { { (it and items.claim(it) and session_label(items.claim(it).session, items.claim(it).role) .. ' · ' or '') .. done .. '/' .. #list, 'ClandTeal' } }, { item = id })
  for _, status in ipairs({ 'in progress', 'review', 'qa', 'ready', 'planned', 'backlog' }) do
    local bucket = vim.tbl_filter(function(child) return child.status == status end, list)
    c:add({ { ' ' .. status:upper() .. ' · ' .. #bucket, 'ClandSection' } }, nil, { section = status })
    for _, child in ipairs(bucket) do
      local glyph = items.GLYPH[items.status(child)] or items.GLYPH.open
      local n, total = require('cland.vboard').fraction(child)
      local left = { { ' ' }, { #items.open_blockers(child) > 0 and '◌' or glyph[1], glyph[2] },
        { ' ' .. child.id .. ' ', 'ClandDim' }, { (M.stage_tag(id, child.id) or 'unplanned') .. ' › ', 'ClandDim' }, { child.title or '' } }
      local right = who(child)
      right[#right + 1] = { ' ' .. n .. '/' .. total, 'ClandDim' }
      c:add(left, right, { item = child.id, list = status })
    end
  end
  return { ' ↵ open · gp plan · gi gt gs', ' K J rank · T top · ␣␣ back' }
end
return M
