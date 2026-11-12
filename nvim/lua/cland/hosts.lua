-- Hosts facts come only from the pushed public projection; no provider requests.
local state = require('cland.state')
local M = {}
local function money(value)
  return type(value) == 'number' and ('$%.3f'):format(value) or 'unknown'
end
local function uptime(created)
  local at = require('cland.thread').epoch(created)
  if not at then return 'unknown' end
  local minutes = math.floor(math.max(0, os.time() - at) / 60)
  return minutes >= 60 and ('%dh %dm'):format(math.floor(minutes / 60), minutes % 60) or ('%dm'):format(minutes)
end
function M.render(c, wrapped)
  local pools = state.S.hosts
  if type(pools) ~= 'table' or #pools == 0 then return end
  local open = not state.folded('hosts')
  c:add({ { ' ' .. (open and '▾ ' or '▸ ') .. 'Hosts', 'ClandDim' } }, nil, { fold = 'hosts' })
  for _, pool in ipairs(pools) do
    local logins = {}
    for _, harness in ipairs({ 'claude-code', 'codex', 'opencode' }) do
      local login = pool.logins[harness]
      if login then
        local label = harness == 'claude-code' and 'claude' or harness
        logins[#logins + 1] = label .. ' ' .. login.inUse .. '/' .. login.usable
          .. (login.signedOut > 0 and (' (' .. login.signedOut .. ' signed out)') or '')
      end
    end
    local text = pool.name .. ' ' .. pool.hostCount .. '/' .. pool.maxHosts .. ' hosts · '
      .. pool.slotsUsed .. '/' .. pool.slotsTotal .. ' slots · logins ' .. (#logins > 0 and table.concat(logins, ', ') or 'none')
    local alert = pool.alert
    if type(alert) == 'table' then
      text = text .. ' · ' .. (alert.kind == 'outage' and (alert.host .. ' unreachable') or alert.reason)
    end
    wrapped(c, text, type(alert) == 'table' and 'ClandRed' or 'ClandDim')
    if open then
      for _, host in ipairs(pool.hosts) do
        wrapped(c, '  ' .. host.id .. ' · ' .. host.size .. ' · ' .. host.region .. ' · up ' .. uptime(host.created)
          .. ' · sessions ' .. (#host.sessions > 0 and table.concat(host.sessions, ', ') or 'none')
          .. ' · ' .. money(host.priceHourly) .. '/h · ' .. money(host.spendToday) .. ' today', 'ClandDim')
      end
    end
  end
  c:add({})
end
return M
