-- One hub decision, shared by the thread, palette and top bar. An old hub's
-- missing field is unknown; consumers show it without inventing placement policy.
local M = {}
function M.layer(object)
  return type(object) == 'table' and object.layer or nil
end
function M.dim(object)
  local layer = M.layer(object)
  return layer == 'background' or layer == 'archive'
end
-- The human's keys are shared by topic, session and artifact views. The hub
-- applies the choice once and broadcasts invalidation to all connected UIs.
function M.keys(buf, target)
  for key, mode in pairs({ gP = 'pin', gM = 'mute' }) do
    require('cland.actions').map('n', key, function()
      local surface, id = target()
      if not surface or not id then return end
      local client = require('cland').client
      if not (client and client:connected()) then return require('cland.state').say('visibility needs a connected hub', 'ClandAmberBar') end
      client:request({ type = 'visibility.set', surface = surface, target = id, mode = mode }, function(err)
        if err then require('cland.state').say('visibility: ' .. tostring(err), 'ClandRedBar') end
      end)
    end, { buffer = buf, desc = mode .. ' or restore visibility' })
  end
end
-- Severity comes from the same hub classifier as placement.
M.WARN = { '⚠', 'ClandAmber' }
function M.warning(object)
  return type(object) == 'table' and object.severity == 'warn'
end
return M
