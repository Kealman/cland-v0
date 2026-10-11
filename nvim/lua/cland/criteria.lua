-- Presentation of the hub's criteria. A checkbox alone never implies a mark.
local M = {}
M.GLYPH = {
  open = { '○', 'ClandDim' }, done = { '◐', 'ClandTeal' },
  verified = { '●', 'ClandGreen' }, stale = { '◌', 'ClandAmber' }, failed = { '✗', 'ClandRed' },
}

function M.status(criterion)
  local found = {}
  for _, mark in ipairs(criterion.marks or {}) do
    found[mark.kind == 'verified' and mark.current == false and 'stale' or mark.kind] = true
  end
  if found.failed then return 'failed' end
  if found.verified then return 'verified' end
  if found.stale then return 'stale' end
  return found.done and 'done' or 'open'
end

function M.fraction(criteria)
  local verified, stale = 0, 0
  for _, criterion in ipairs(criteria or {}) do
    local status = M.status(criterion)
    if status == 'verified' then verified = verified + 1 end
    if status == 'stale' then stale = stale + 1 end
  end
  return verified, #(criteria or {}), stale
end

-- First touch assigns legacy ids after the largest allocated id, including removals.
function M.refs(detail)
  local refs, sequence = {}, tonumber(detail.criterion_seq) or 0
  for _, c in ipairs(detail.criteria or {}) do
    sequence = math.max(sequence, tonumber(tostring(c.id):match('^C(%d+)$')) or 0)
  end
  for i, c in ipairs(detail.criteria or {}) do
    if type(c.id) == 'string' then refs[i] = c.id
    else sequence = sequence + 1; refs[i] = 'C' .. sequence end
  end
  return refs
end

return M
