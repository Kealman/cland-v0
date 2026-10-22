-- The project's human marks belong to the hub, shared by every workbench.
local state = require('cland.state')
local M = { ready = false, waiting = {}, value = { events = vim.NIL, plans = {}, imported = false } }

local function install(value)
  if value then M.value = value; state.changed() end
end

local function send(fields, done)
  if not (M.client and M.client:connected()) then return end
  fields.type = 'marks.set'
  M.client:request(fields, function(err, value)
    if err then return state.say('marks.set: ' .. tostring(err), 'ClandRedBar') end
    install(value and value.marks)
    if done then done() end
  end)
end

function M.when_ready(fn)
  if M.ready then fn() else M.waiting[#M.waiting + 1] = fn end
end

function M.set(fields, done)
  M.when_ready(function() send(fields, done) end)
end

local function ready()
  M.ready = true
  local waiting = M.waiting
  M.waiting = {}
  for _, fn in ipairs(waiting) do fn() end
end

function M.refresh(done)
  M.client:snapshot({ type = 'marks.get' }, function(err, value, events)
    if err then return state.say('marks.get: ' .. tostring(err), 'ClandRedBar') end
    install(value and value.marks)
    for _, event in ipairs(events) do if event.type == 'marks' then install(event.marks) end end
    if done then done() end
  end)
end

function M.setup(client)
  M.client, M.ready, M.waiting = client, false, {}
  M.value = { events = vim.NIL, plans = {}, imported = false }
  client:on('state', function(status) if status ~= 'connected' then M.ready = false end end)
  client:on('marks', function(event) install(event.marks) end)
  client:on('connected', function()
    M.refresh(function()
      local ui = require('cland.ui')
      local legacy = ui.legacy_marks()
      if not M.value.imported and legacy then
        legacy.import = true
        send(legacy, function() ui.marks_imported(); ready() end)
      else ui.marks_imported(); ready() end
    end)
  end)
end

function M.events()
  return M.value.events ~= vim.NIL and M.value.events or nil
end

function M.plan(id)
  local n = state.item_number(id)
  return n and M.value.plans['T-' .. n] or nil
end

return M
