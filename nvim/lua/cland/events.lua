-- Journal-backed events, newest first. Day folds and row identity survive live prepends.
local api = vim.api
local state = require('cland.state')
local thread = require('cland.thread')
local M = { aliases = {}, latest = {}, rows = {}, folded = {}, before = nil, more = false, generation = 0 }

local KINDS = require('cland.event_kinds')
local function prefs()
  state.S.ui.events = state.S.ui.events or { filter = vim.empty_dict(), muted = {} }
  return state.S.ui.events
end
local function epoch(ts)
  return (thread.epoch(ts) or 0) + (tonumber(tostring(ts):match('%.(%d+)')) or 0) / (10 ^ #(tostring(ts):match('%.(%d+)') or ''))
end
local function same(a, b) return a.kind == b.kind and a.id == b.id end
local function matches(r)
  local p, f = prefs(), prefs().filter
  if f.kinds and #f.kinds > 0 and not vim.tbl_contains(f.kinds, r.kind) then return false end
  if f.warnings and not r.warning then return false end
  for _, s in ipairs(p.muted) do if same(s, r.subject) then return false end end
  if f.subject then
    local s = f.subject
    if s.kind == 'item' then
      local id, seen = r.item or (r.subject.kind == 'item' and r.subject.id), {}
      while id and not seen[id] do
        if id == s.id then return true end
        seen[id] = true
        local item = state.item(id); id = item and item.parent
      end
      return false
    end
    return same(s, r.subject) or r[s.kind] == s.id
  end
  return true
end

function M.summary(look)
  local n, warnings = 0, 0
  for _, r in ipairs(M.latest) do
    if epoch(r.ts) > epoch(look or require('cland.marks').events()) then n = n + 1; if r.warning then warnings = warnings + 1 end end
  end
  return n == 200 and M.latest_more and '200+' or tostring(n), warnings
end

function M.inbox_line()
  local n, warnings = M.summary()
  return ' △ ' .. n .. ' new events since your last look · ⚠ ' .. warnings
end

function M.refresh_summary()
  local client = require('cland.views').client
  if not (client and client:connected()) or M.summary_loading then return end
  M.summary_loading = true
  client:snapshot({ type = 'events.list', limit = 200 }, function(err, page, events)
    M.summary_loading = false
    if not err then
      M.latest, M.latest_more = page.rows or {}, page.more == true
      for _, event in ipairs(events) do M.push(event.row) end
      state.changed()
    end
  end)
end

function M.filter(change)
  for k, v in pairs(change) do prefs().filter[k] = v ~= vim.NIL and v or nil end
  M.reset(); M.load(false); state.changed()
end

function M.subject()
  require('cland.palette').open({ subject_only = true, select = function(e)
    M.filter({ subject = { kind = ({ items = 'item', sessions = 'session', topics = 'topic', artifacts = 'artifact' })[e.group], id = e.value } })
  end })
end

function M.mute()
  local info = M.row()
  local subject = info and (info.muted or info.event and info.event.subject)
  if not subject then return end
  local muted, found = prefs().muted, false
  for i, s in ipairs(muted) do if same(s, subject) then table.remove(muted, i); found = true; break end end
  if not found then muted[#muted + 1] = vim.deepcopy(subject) end
  M.reset(); M.load(false); state.changed()
end

function M.reset(fresh)
  if fresh then M.latest, M.latest_more, M.visit_look = {}, false, nil end
  M.aliases = {}
  M.rows, M.folded, M.before, M.more, M.loading = {}, {}, nil, false, false
  M.generation = M.generation + 1
end

local function merge(rows, incoming, prepend)
  local seen, out = {}, {}
  local function add(list)
    for _, r in ipairs(list) do
      if not seen[r.id] then seen[r.id] = true; out[#out + 1] = r end
    end
  end
  if prepend then add(incoming); add(rows) else add(rows); add(incoming) end
  return out
end

function M.load(older)
  if M.loading then return end
  if older and not M.more then return state.say('no older events in the journal') end
  local client = require('cland.views').client
  if not (client and client:connected()) then return state.say('events.list: the hub is not connected', 'ClandRedBar') end
  M.loading = true
  local generation = M.generation
  local frame = { type = 'events.list', limit = 200, filter = vim.deepcopy(prefs().filter) }
  frame.filter.muted = vim.deepcopy(prefs().muted)
  if older then frame.before = M.before end
  client:snapshot(frame, function(err, page, events)
    if generation ~= M.generation then return end
    M.loading = false
    if err then return state.say('events.list: ' .. tostring(err), 'ClandRedBar') end
    local incoming = vim.tbl_filter(matches, page.rows or {})
    M.rows = merge(M.rows, incoming, false)
    M.before = page.before ~= vim.NIL and page.before or nil
    M.more = page.more == true
    for _, event in ipairs(events) do M.push(event.row) end
    state.changed()
  end)
end

function M.visit()
  local sec, usec = vim.uv.gettimeofday()
  local at = os.date('!%Y-%m-%dT%H:%M:%S', sec) .. ('.%03dZ'):format(math.floor(usec / 1000))
  local marks = require('cland.marks')
  marks.when_ready(function()
    M.visit_look = marks.events()
    marks.set({ events = at })
    state.changed()
  end)
end

function M.enter()
  M.visit()
  M.reset()
  M.refresh_summary()
  M.render()
  M.load(false)
end

function M.push(row)
  if row.replaces then M.aliases[row.replaces] = row.id end
  local function update(rows)
    local kept = {}
    for _, r in ipairs(rows) do if r.id ~= row.id and r.id ~= row.replaces then kept[#kept + 1] = r end end
    table.insert(kept, 1, row)
    return kept
  end
  M.latest = update(M.latest)
  if #M.latest > 200 then table.remove(M.latest); M.latest_more = true end
  if matches(row) then M.rows = update(M.rows) end
  state.changed()
end

function M.row()
  if not M.buf then return nil end
  return require('cland.panels').row_at(M.buf, api.nvim_win_get_cursor(0)[1])
end

function M.open()
  local info = M.row()
  if not (info and info.event) then return end
  local subject = info.event.subject
  if subject.kind == 'rule' then return require('cland.rulebook').open(subject.id) end
  if subject.kind == 'artifact' then
    local artifacts = require('cland.artifacts')
    if artifacts.get(subject.id) then return artifacts.open(subject.id) end
    local client = require('cland.views').client
    if not (client and client:connected()) then return state.say('artifact: the hub is not connected', 'ClandRedBar') end
    return client:request({ type = 'artifact.list', artifact = subject.id }, function(err, value)
      if err or not value.artifact then return state.say('artifact: ' .. tostring(err or 'unavailable'), 'ClandRedBar') end
      artifacts.open(value.artifact)
    end)
  end
  local kind = subject.kind == 'topic' and 'thread' or subject.kind
  require('cland.layout').show({ kind = kind, id = subject.id }, { insert = false })
end

function M.fold()
  local info = M.row()
  if not (info and info.day) then return end
  M.folded[info.day] = not M.folded[info.day]
  state.changed()
end

function M.buffer()
  if M.buf and api.nvim_buf_is_valid(M.buf) then return M.buf end
  M.buf = api.nvim_create_buf(false, true)
  vim.bo[M.buf].bufhidden = 'hide'
  vim.bo[M.buf].modifiable = false
  api.nvim_buf_set_name(M.buf, 'cland://events')
  vim.b[M.buf].cland_role = 'events'
  local function map(key, fn)
    require('cland.actions').map('n', key, fn, { buffer = M.buf, silent = true, nowait = true })
  end
  map('<CR>', M.open)
  map('A', function() M.load(true) end)
  map('za', M.fold)
  for i, kind in ipairs(KINDS) do if i > 9 then break end; map(tostring(i), function() M.filter({ kinds = { kind } }) end) end
  map('0', function() M.filter({ kinds = vim.NIL }) end)
  map('w', function() M.filter({ warnings = not prefs().filter.warnings }) end)
  map('s', M.subject)
  map('F', function() prefs().filter = vim.empty_dict(); M.reset(); M.load(false); state.changed() end)
  map('gM', M.mute)
  M.render()
  return M.buf
end

function M.render()
  if not (M.buf and api.nvim_buf_is_valid(M.buf)) then return end
  local panels = require('cland.panels')
  local wins, cursors = vim.fn.win_findbuf(M.buf), {}
  for _, w in ipairs(wins) do
    local row = api.nvim_win_get_cursor(w)[1]
    local info = panels.row_at(M.buf, row)
    cursors[w] = { row = row, id = info and info.event and info.event.id, day = info and info.day }
  end
  local width = #wins > 0 and api.nvim_win_get_width(wins[1]) or 100
  local c = panels.canvas(width)
  c:add({ { ' events · newest first', 'ClandSection' } })
  local f = prefs().filter
  local subject = f.subject and (f.subject.kind .. ' ' .. f.subject.id) or 'any'
  c:add({ { ' kind: ' .. (f.kinds and table.concat(f.kinds, ', ') or 'all') .. ' · ' .. (f.warnings and '⚠ warnings only' or 'all levels') .. ' · subject: ' .. subject, 'ClandDim' } })
  if #prefs().muted > 0 then
    c:add({ { ' ' .. #prefs().muted .. ' subjects hidden · gM restores the selected subject', 'ClandDim' } })
    for _, s in ipairs(prefs().muted) do c:add({ { ' muted ' .. s.kind .. ' ' .. s.id, 'ClandFaint' } }, nil, { muted = s }) end
  end
  local previous
  local marked, new = false, 0
  local function last_look()
    local n = tostring(new)
    c:add({ { '── △ your last look · ' .. thread.clock(M.visit_look) .. ' · ' .. n .. ' new above ', 'ClandPlanChange' } })
    marked = true
  end
  local today = os.date('%Y-%m-%d')
  local targets, days = {}, {}
  for _, r in ipairs(M.rows) do
    if M.visit_look and not marked and epoch(r.ts) <= epoch(M.visit_look) then last_look() end
    if epoch(r.ts) > epoch(M.visit_look) then new = new + 1 end
    local day, label = thread.day(r.ts)
    if day ~= previous then
      if day == today then label = label .. ' · today' end
      c:add({ { '── ' .. label .. (M.folded[day] and ' · folded' or '') .. ' ', 'ClandDim' }, { ('─'):rep(math.max(1, width - vim.fn.strdisplaywidth(label) - 8)), 'ClandFaint' } }, nil, { day = day })
      days[day] = #c.lines
      previous = day
    end
    if not M.folded[day] then
      c:add({ { epoch(r.ts) > epoch(M.visit_look) and M.visit_look and '▎' or ' ', 'ClandPlanChange' }, { thread.clock(r.ts) .. ' ', r.bookkeeping and 'ClandFaint' or 'ClandDim' }, { (r.warning and '⚠' or r.glyph) .. ' ', r.warning and 'ClandAmber' or r.bookkeeping and 'ClandFaint' or 'ClandBlue' }, { r.kind .. ' ', r.bookkeeping and 'ClandFaint' or 'ClandDim' }, { r.subject.id .. ' ', r.bookkeeping and 'ClandFaint' or 'ClandBlue' }, { r.text .. ((r.count or 1) > 1 and (' · ×' .. r.count) or ''), r.bookkeeping and 'ClandFaint' or 'Normal' } }, nil, { day = day, event = r, item = r.item, topic = r.topic, session = r.session, artifact = r.artifact })
      targets[r.id] = #c.lines
      if r.replaces then targets[r.replaces] = #c.lines end
    end
  end
  if M.visit_look and not marked then last_look() end
  if #M.rows == 0 then c:add({ { M.loading and ' loading events…' or ' no events in the journal', 'ClandDim' } }) end
  c:add({ { ' the newest ' .. #M.rows .. ' rows · A pages 200 older ones in from the journal', 'ClandFaint' } })
  panels.rows[M.buf] = c:apply(M.buf)
  for w, cur in pairs(cursors) do
    local id = cur.id
    while id and M.aliases[id] do id = M.aliases[id] end
    local target = (id and targets[id]) or (cur.day and days[cur.day]) or math.min(cur.row, #c.lines)
    pcall(api.nvim_win_set_cursor, w, { target, 0 })
  end
  -- Every visible cursor now uses the current row map. Hidden buffers retain their
  -- aliases until Back renders them, and a batch retains its whole chain until redraw.
  if #wins > 0 then M.aliases = {} end
end

return M
