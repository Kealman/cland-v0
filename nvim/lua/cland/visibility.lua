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
return M
