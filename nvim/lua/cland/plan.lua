-- Read-only presentation of the hub's accepted epic plan. Approval is a hub operation;
-- absent approval metadata stays unknown, and a refused request never changes the card.
local api = vim.api
local state = require('cland.state')
local items = require('cland.items')
local M = { bufs = {}, detail = {}, pending = {}, stale = {}, history = {}, visits = {} }
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

function M.enter(id)
  M.stale[id] = true
  M.visits[id] = { seen = (state.S.ui.plan_seen or {})[id], acknowledge = true }
end

-- Preserve the hub's publication order, including changes with identical timestamps.
local function history_from_detail(id, value)
  local history = {}
  for _, record in ipairs(value.history or {}) do
    history[#history + 1] = { id = record.id, ts = record.ts, kind = 'plan',
      text = 'plan ' .. record.event .. ' by ' .. record.by .. (record.reason and (': ' .. record.reason) or ''),
      detail = { item = id, by = record.by, previous = record.previous, plan = record.plan, reason = record.reason } }
  end
  M.history[id] = history
  local visit = M.visits[id]
  if visit and visit.acknowledge and state.S.ui.view.kind == 'plan' and state.S.ui.view.id == id then
    state.S.ui.plan_seen = state.S.ui.plan_seen or {}
    state.S.ui.plan_seen[id] = history[#history] and history[#history].id or nil
    visit.acknowledge = false
    require('cland.ui').changed()
  end
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
      history_from_detail(id, M.detail[id])
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
local function needs_item_qa(id)
  local detail = require('cland.item_view').get(id)
  -- Only the hub can qualify durable provenance, independent writers and freshness.
  -- Missing/older responses and failed refreshes leave the run outstanding.
  return not (detail and not detail.failed and (detail.merged == true or detail.qaSatisfied == true))
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

local function locations(plan)
  local out = {}
  for n, stage in ipairs(type(plan) == 'table' and plan.stages or {}) do
    for lane, ids in ipairs(stage.lanes) do for position, id in ipairs(ids) do out[id] = { stage = n, lane = lane, position = position } end end
  end
  return out
end

function M.changes(id)
  local visit = M.visits[id]
  local receipt = (state.S.ui.plan_seen or {})[id]
  if visit and state.S.ui.view.kind == 'plan' and state.S.ui.view.id == id then receipt = visit.seen end
  local history = M.history[id] or {}
  local since = 0
  for n, message in ipairs(history) do if message.id == receipt then since = n end end
  local out = { stages = {}, items = {}, notes = {} }
  for n, message in ipairs(history) do
    local d = message.detail or {}
    if n > since and type(d.previous) == 'table' and type(d.plan) == 'table' then
      local before, after = locations(d.previous), locations(d.plan)
      local changed = {}
      for item, was in pairs(before) do
        local now = after[item]
        if not now or now.stage ~= was.stage or now.lane ~= was.lane or now.position ~= was.position then
          changed[#changed + 1] = item .. (now and (' moved from S' .. was.stage .. ' to S' .. now.stage) or (' removed from S' .. was.stage))
          out.items[item], out.stages[was.stage] = true, true
          if now then out.stages[now.stage] = true end
        end
      end
      for item, now in pairs(after) do if not before[item] then
        changed[#changed + 1] = item .. ' added to S' .. now.stage
        out.items[item], out.stages[now.stage] = true, true
      end end
      for stage, current in ipairs(d.plan.stages) do
        if not vim.deep_equal(current, d.previous.stages[stage]) then
          out.stages[stage] = true
          local previous = d.previous.stages[stage]
          if not previous or previous.name ~= current.name or not vim.deep_equal(previous.qa, current.qa) then
            for _, lane in ipairs(current.lanes) do for _, item in ipairs(lane) do out.items[item] = true end end
          end
        end
      end
      for item in pairs(after) do
        if not vim.deep_equal((d.plan.items or {})[item], (d.previous.items or {})[item]) then
          out.items[item], out.stages[after[item].stage] = true, true
          changed[#changed + 1] = item .. ' QA override changed'
        end
      end
      table.sort(changed)
      out.notes[#out.notes + 1] = { message = message, summary = #changed > 0 and table.concat(changed, '; ') or 'stage or QA policy changed' }
    end
  end
  return out
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

local function lane_rows(lane, plan, changes)
  local rows = {}
  for _, id in ipairs(lane) do
    local it = state.item(id) or { id = id, title = '(not in the index)' }
    local glyph = items.GLYPH[items.status(it)] or items.GLYPH.open
    local n, total = require('cland.vboard').fraction(it)
    local blockers = items.open_blockers(it)
    local marks, group = {}, glyph[2]
    for _, chunk in ipairs(who(it)) do marks[#marks + 1] = chunk[1]; if chunk[2] == 'ClandRed' then group = chunk[2] end end
    local verdicts = type(it.verdicts) == 'table' and it.verdicts or {}
    local last = verdicts[#verdicts]
    if last and last.result == 'not clear' then
      local round = 0
      for _, v in ipairs(verdicts) do if v.verdict == last.verdict then round = round + 1 end end
      marks[#marks + 1] = 'round ' .. round .. (last.run and (' · ' .. last.run) or '')
    end
    local mark = #marks > 0 and (' · ' .. table.concat(marks, ' · ')) or ''
    rows[#rows + 1] = { (changes and changes.items[id] and '△ ' or '') .. (#blockers > 0 and '◌' or glyph[1]) .. ' ' .. id .. ' ' .. (it.title or '') .. mark .. ' ' .. n .. '/' .. total, changes and changes.items[id] and 'ClandPlanChange' or group }
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

-- Closure is a hub fact: all merged items alone cannot close an after-stage gate.
local function progress(plan, detail)
  local out = { stages = {}, counts = { done = 0, review = 0, work = 0, planned = 0 }, runs = {}, sessions = {}, cost = 0, cost_known = false }
  local named = {}
  for n, stage in ipairs(plan.stages) do
    local metadata = (detail.stages or {})[n] or {}
    local done, total = 0, 0
    for _, lane in ipairs(stage.lanes) do for _, id in ipairs(lane) do
      total = total + 1
      local it = state.item(id) or {}
      local status = items.status(it)
      local key = status == 'done' and 'done' or status == 'review' and 'review'
        or (status == 'in progress' or status == 'qa' or status == 'ready') and 'work' or 'planned'
      out.counts[key] = out.counts[key] + 1
      local item_detail = require('cland.item_view').get(id)
      if metadata.state == 'closed' or (item_detail and not item_detail.failed and item_detail.merged == true) then done = done + 1 end
      local claim = items.claim(it)
      if claim then named[claim.session] = true end
      for _, v in ipairs(type(it.verdicts) == 'table' and it.verdicts or {}) do
        if v.verdict == 'qa' then out.runs[#out.runs + 1] = v end
      end
    end end
    local closed = metadata.state == 'closed'
    out.stages[n] = { state = closed and 'closed' or 'planned', done = done, total = total, verdict = metadata.verdict }
    if not closed and not out.current then out.current = n end
  end
  if out.current and out.counts.done + out.counts.work + out.counts.review > 0 then
    out.stages[out.current].state = 'in work'
  end
  -- Stage run history comes from the epic's hub verdicts, including failed rounds.
  local epic = require('cland.item_view').detail[detail.id or '']
  for _, v in ipairs(epic and epic.verdicts or {}) do
    if v.verdict == 'qa' and v.stage then out.runs[#out.runs + 1] = v end
  end
  for _, st in ipairs(out.stages) do
    if st.verdict and not vim.tbl_contains(vim.tbl_map(function(v) return v.run end, out.runs), st.verdict.run) then out.runs[#out.runs + 1] = st.verdict end
  end
  for _, session in ipairs(state.sessions()) do
    for _, hold in ipairs(session.holds or {}) do
      if require('cland.vboard').under(state.item(hold.item), detail.id) then named[session.name] = true end
    end
    if session.item and require('cland.vboard').under(state.item(session.item), detail.id) then named[session.name] = true end
    if named[session.name] then
      out.sessions[#out.sessions + 1] = session
      local cost = session.usage and session.usage.total and session.usage.total.cost
      if type(cost) == 'number' then out.cost = out.cost + cost; out.cost_known = true end
    end
  end
  return out
end

local function lane_sessions(lane)
  local out, seen = {}, {}
  for _, id in ipairs(lane) do
    local it = state.item(id)
    local claim = it and items.claim(it)
    local names = {}
    if claim then names[#names + 1] = claim.session end
    for _, hold in ipairs(it and it.holds or {}) do names[#names + 1] = hold.session end
    for _, name in ipairs(names) do if not seen[name] then
      seen[name] = true
      local session = state.session(name)
      out[#out + 1] = session_label(name, claim and claim.role) .. ' · ' .. (session and session.state or 'unknown')
    end end
  end
  return table.concat(out, '; ')
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
  local boxed, box_group = false, 'ClandFaint'
  local function prose(text, hl)
    for _, line in ipairs(wrap(text, bw - (boxed and 6 or 2))) do
      if boxed then
        left[#left + 1] = { { ' │ ', box_group }, { line, hl },
          { (' '):rep(math.max(0, bw - 6 - width(line))) .. ' │', box_group } }
      else add(' ' .. line, hl) end
    end
  end
  add()
  prose('Plan of ' .. id .. ' ' .. (it and it.title or ''), 'ClandBold')
  local detail = require('cland.item_view').get(id)
  local history = M.history[id] or {}
  local authored
  for _, message in ipairs(history) do if type((message.detail or {}).plan) == 'table' then authored = message end end
  if authored and authored.detail and authored.detail.plan then
    prose('plan by ' .. tostring(authored.detail.by) .. ' · ' .. authored.ts, 'ClandDim')
  end
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
    d.id = id
    local p = progress(plan, d)
    local changes = M.changes(id)
    for _, note in ipairs(changes.notes) do
      local m, md = note.message, note.message.detail
      local _, _, before = stats(md.previous)
      local _, _, after = stats(md.plan)
      prose("△ changed " .. m.ts .. " by " .. tostring(md.by) .. ": " .. note.summary .. " · QA runs " .. before .. " → " .. after .. " · " .. (md.reason or "reason not supplied"), "ClandPlanChange")
    end
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
      local st = p.stages[n]
      local border = changes.stages[n] and 'ClandPlanChange' or st.state == 'in work' and 'ClandTeal' or 'ClandFaint'
      box_group = border
      local tone = st.state == 'planned' and 'ClandDim' or 'ClandText'
      add(' ┌' .. ('─'):rep(math.max(0, bw - 4)) .. '┐', border)
      boxed = true
      prose((changes.stages[n] and '△ ' or '') .. 'S' .. n .. ' · ' .. stage.name .. ' · ' .. st.state .. ' · ' .. #stage.lanes .. ' lanes', changes.stages[n] and 'ClandPlanChange' or st.state == 'in work' and 'ClandTeal' or st.state == 'planned' and 'ClandDim' or 'ClandBold')
      local filled = st.total > 0 and math.floor(10 * st.done / st.total) or 0
      prose('[' .. ('━'):rep(filled) .. ('─'):rep(10 - filled) .. '] ' .. st.done .. '/' .. st.total .. ' merged', tone)
      prose('QA: ' .. policy(stage.qa), tone)
      if st.verdict then
        local round = 0
        for _, v in ipairs(p.runs) do if v.stage == stage.name or v.run == st.verdict.run then round = round + 1 end end
        prose('QA run ' .. st.verdict.run .. ' · ' .. st.verdict.result .. ' · round ' .. round,
          st.verdict.result == 'clear' and 'ClandGreen' or 'ClandRed')
      end
      local per_band = math.max(1, math.floor((bw - 6) / 24))
      for first = 1, #stage.lanes, per_band do
        local count = math.min(per_band, #stage.lanes - first + 1)
        local lw = math.max(1, math.floor((bw - 6 - (count - 1) * 3) / count))
        local columns, height = {}, 0
        for i = 1, count do
          local lane = first + i - 1
          local col = {}
          for _, line in ipairs(wrap('lane ' .. lane .. ' · ordered items', lw)) do col[#col + 1] = { line, 'ClandDim' } end
          local sessions = lane_sessions(stage.lanes[lane])
          if st.state == 'in work' and sessions ~= '' then
            for _, line in ipairs(wrap(sessions, lw)) do col[#col + 1] = { line, 'ClandTeal' } end
          end
          for _, row in ipairs(lane_rows(stage.lanes[lane], plan, changes)) do
            for _, line in ipairs(wrap(row[1], lw)) do col[#col + 1] = { line, row[2] == 'ClandPlanChange' and row[2] or st.state == 'planned' and 'ClandDim' or row[2] } end
          end
          columns[i], height = col, math.max(height, #col)
        end
        for r = 1, height do
          local chunks = { { ' │ ', border } }
          for i, col in ipairs(columns) do
            if i > 1 then chunks[#chunks + 1] = { ' │ ', border } end
            local row = col[r] or { '' }
            chunks[#chunks + 1] = { row[1] .. (' '):rep(math.max(0, lw - width(row[1]))), row[2] }
          end
          chunks[#chunks + 1] = { (' '):rep(math.max(0, bw - 6 - (count * lw + (count - 1) * 3))) .. ' │', border }
          left[#left + 1] = chunks
        end
      end
      prose('Gate: ' .. gate(stage, plan), tone)
      boxed = false
      add(' └' .. ('─'):rep(math.max(0, bw - 4)) .. '┘', border)
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
    local started = p.counts.done + p.counts.work + p.counts.review > 0
    if started then
      fields[1] = 'PROGRESS · stage ' .. (p.current or #plan.stages) .. ' of ' .. #plan.stages
      fields[2] = p.counts.done .. ' done · ' .. p.counts.review .. ' in review · ' .. p.counts.work .. ' in progress · ' .. p.counts.planned .. ' planned'
      fields[3] = p.current and ('Current gate: ' .. gate(plan.stages[p.current], plan)) or 'All stages closed'
      fields[9] = 'QA runs: ' .. #p.runs .. ' so far'
      local remaining = 0
      for n, stage in ipairs(plan.stages) do if p.stages[n].state ~= 'closed' then
        local per_item, after = stage_policies(stage, plan)
        if after then remaining = remaining + 1 end
        for _, item in ipairs(per_item) do if needs_item_qa(item) then remaining = remaining + 1 end end
      end end
      table.insert(fields, 10, 'QA runs: ' .. remaining .. ' to come')
      table.insert(fields, 11, 'Cost so far: ' .. (p.cost_known and ('$%.2f'):format(p.cost) .. ' reported session totals' or 'unavailable'))
      table.insert(fields, 12, 'Approval: ' .. approval_text)
      for _, session in ipairs(p.sessions) do table.insert(fields, #fields, session.label .. ' · ' .. session.state) end
      for _, run in ipairs(p.runs) do table.insert(fields, #fields, run.run .. ' · ' .. run.result) end
    end
    for n, stage in ipairs(plan.stages) do
      table.insert(fields, #fields, 'S' .. n .. ' QA: ' .. policy(stage.qa))
    end
    fields[#fields] = 'PLAN HISTORY'
    for _, message in ipairs(M.history[id] or {}) do
      fields[#fields + 1] = message.ts .. ' · ' .. message.text
    end
    fields[#fields + 1] = 'OUTSIDE THE EPIC'
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
  -- A restart restores ui.view directly, without layout.show's explicit entry.
  -- Initialize that visit once; ordinary redraws must not acknowledge later changes.
  if not M.visits[id] then M.enter(id) end
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
  local changes = M.changes(id)
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
  local filter = items.filter()
  local layer_filter = vim.tbl_contains(items.LAYERS, filter)
  local background = vim.tbl_filter(function(child) return child.layer == 'background' end, list)
  local sections = layer_filter and { filter } or { 'in progress', 'review', 'qa', 'ready', 'planned', 'backlog', 'done' }
  if not layer_filter and #background > 0 then sections[#sections + 1] = 'background' end
  for _, status in ipairs(sections) do
    local bucket = vim.tbl_filter(function(child)
      if layer_filter then return child.layer == filter end
      if status == 'background' then return child.layer == 'background' end
      return child.status == status and child.layer ~= 'background' and child.layer ~= 'archive'
    end, list)
    local folded = not layer_filter and status == 'background'
    local closed = folded and state.S.ui.items_folds.background ~= false
    c:add({ { ' ' .. (folded and (closed and '▸ more' or '▾ more') or status:upper()) .. ' · ' .. #bucket, 'ClandSection' } }, nil, { section = status, fold = folded and 'background' or nil })
    for _, child in ipairs(closed and {} or bucket) do
      local glyph = items.GLYPH[items.status(child)] or items.GLYPH.open
      local n, total = require('cland.vboard').fraction(child)
      local left = { { changes.items[child.id] and ' △ ' or ' ', changes.items[child.id] and 'ClandPlanChange' or nil }, { #items.open_blockers(child) > 0 and '◌' or glyph[1], glyph[2] },
        { ' ' .. child.id .. ' ', 'ClandDim' }, { (M.stage_tag(id, child.id) or 'unplanned') .. ' › ', 'ClandDim' }, { child.title or '' } }
      local right = who(child)
      right[#right + 1] = { ' ' .. n .. '/' .. total, 'ClandDim' }
      c:add(left, right, { item = child.id, list = status })
    end
  end
  return { ' ↵ open · gp plan · gi gt gs', ' gn now · gw watch · gb more · gA archive' }
end
return M
