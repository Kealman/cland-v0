-- The shared message rule from §3.5/§3.14 (T-134, T-136). T-115 owns archive and overrides.
local M = {}

local function addressees(m)
  return type(m.to) == 'table' and m.to or {}
end

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

--- The message part of §3.5, kept here for T-115 to replace. Archive/overrides
--- belong to that epic; cold history loads project the latest 200 messages only.
function M.layer(m)
  local state = require('cland.state')
  if m.fromKind == 'human' or m.fromRole == 'aide' or m.answerTo or type(m.ask) == 'table' then return 'now' end
  local verdict = M.verdict(m)
  if verdict then return verdict == 'clear' and 'watch' or 'now' end
  for _, name in ipairs(addressees(m)) do
    local session = state.session(name)
    if name == 'human' or name == 'aide' or (session and session.role == 'aide') then return 'now' end
  end
  if m.kind == 'event' or m.kind == 'progress' or m.fromKind == 'hub' then return 'background' end
  if #addressees(m) > 0 then return 'background' end
  local bare_artifact = type(m.artifact) == 'table' and type(m.artifacts) ~= 'table'
  if bare_artifact then return 'background' end
  -- Coordinator reports stay now until T-143 teaches intentional report kinds.
  -- Unaddressed agent messages are deliveries to the human, as the header shows.
  return 'now'
end

return M
