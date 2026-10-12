-- Journal-backed events, newest first. Day folds and row identity survive live prepends.
local api = vim.api
local state = require('cland.state')
local thread = require('cland.thread')
local M = { rows = {}, folded = {}, before = nil, more = false, generation = 0 }

function M.reset()
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
  local frame = { type = 'events.list', limit = 200 }
  if older then frame.before = M.before end
  client:request(frame, function(err, page)
    if generation ~= M.generation then return end
    M.loading = false
    if err then return state.say('events.list: ' .. tostring(err), 'ClandRedBar') end
    M.rows = merge(M.rows, page.rows or {}, false)
    M.before = page.before ~= vim.NIL and page.before or nil
    M.more = page.more == true
    state.changed()
  end)
end

function M.enter()
  M.reset()
  M.render()
  M.load(false)
end

function M.push(row)
  if not (M.buf and api.nvim_buf_is_valid(M.buf)) then return end
  M.rows = merge(M.rows, { row }, true)
  -- Hidden buffers keep their old row map until Back restores them, so the saved cursor
  -- can follow its event id through every prepend without discarding older pages.
  if state.S.ui.view.kind == 'events' then state.changed() end
end

function M.row()
  if not M.buf then return nil end
  return require('cland.panels').row_at(M.buf, api.nvim_win_get_cursor(0)[1])
end

function M.open()
  local info = M.row()
  if not (info and info.event) then return end
  local subject = info.event.subject
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
  local previous
  local today = os.date('%Y-%m-%d')
  local targets, days = {}, {}
  for _, r in ipairs(M.rows) do
    local day, label = thread.day(r.ts)
    if day ~= previous then
      if day == today then label = label .. ' · today' end
      c:add({ { '── ' .. label .. (M.folded[day] and ' · folded' or '') .. ' ', 'ClandDim' }, { ('─'):rep(math.max(1, width - vim.fn.strdisplaywidth(label) - 8)), 'ClandFaint' } }, nil, { day = day })
      days[day] = #c.lines
      previous = day
    end
    if not M.folded[day] then
      c:add({ { ' ' .. thread.clock(r.ts) .. ' ', 'ClandDim' }, { r.glyph .. ' ', (r.glyph == '⚠' or r.glyph == '✗') and 'ClandAmber' or 'ClandBlue' }, { r.kind .. ' ', 'ClandDim' }, { r.subject.id .. ' ', 'ClandBlue' }, { r.text } }, nil, { day = day, event = r, item = r.item, topic = r.topic, session = r.session, artifact = r.artifact })
      targets[r.id] = #c.lines
    end
  end
  if #M.rows == 0 then c:add({ { M.loading and ' loading events…' or ' no events in the journal', 'ClandDim' } }) end
  c:add({ { ' the newest ' .. #M.rows .. ' rows · A pages 200 older ones in from the journal', 'ClandFaint' } })
  panels.rows[M.buf] = c:apply(M.buf)
  for w, cur in pairs(cursors) do
    local target = (cur.id and targets[cur.id]) or (cur.day and days[cur.day]) or math.min(cur.row, #c.lines)
    pcall(api.nvim_win_set_cursor, w, { target, 0 })
  end
end

return M
