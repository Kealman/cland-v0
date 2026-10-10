-- Verdict presentation plus compatibility access to the hub's shared placement.
local M = {}

--- Hub verdict reports carry a structured result; agent reports retain their first-line convention.
function M.verdict(m)
  if m.fromKind == 'hub' and m.kind == 'report' and type(m.detail) == 'table' then
    local d = m.detail
    if (d.verdict == 'review' or d.verdict == 'qa') and (d.result == 'clear' or d.result == 'not clear') then
      return d.result
    end
  end
  if m.fromKind ~= 'agent' then return nil end
  local first = (tostring(m.text or ''):match('^[^\r\n]*') or ''):lower()
  local kind, rest = first:match('^(%a+) (.*)$')
  if kind ~= 'review' and kind ~= 'qa' then return nil end
  if rest:match('^not clear%f[^%a]') then return 'not clear' end
  if rest:match('^clear%f[^%a]') then return 'clear' end
end

-- Compatibility alias for thread callers; classification belongs to the hub.
function M.layer(m)
  return require('cland.visibility').layer(m)
end

return M
