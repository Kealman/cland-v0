-- Independent oracle: run the production Lua unchanged, recording its geometry.
local graph = dofile(arg[1])
local cases = vim.json.decode(table.concat(vim.fn.readfile(arg[2]), '\n'))
local function entries(t)
  local out = {}
  for k, v in pairs(t) do out[#out + 1] = { k, v } end
  table.sort(out, function(a, b) return a[1] < b[1] end)
  return out
end
local results = {}
for _, case in ipairs(cases) do
  local L = graph.from_items(case.items, case.opts)
  local result = {}
  if case.room then
    local width, origin
    L, width, origin = graph.fit_window(L, case.room, 6, 24)
    result.fit = {width = width, origin = origin}
  end
  for _, k in ipairs({'layers', 'chains', 'hidden', 'cycles', 'inside', 'against', 'crossings', 'edges', 'dummies', 'nodes', 'tray', 'outside'}) do result[k] = L[k] end
  for _, k in ipairs({'layer', 'succ', 'pred', 'via'}) do result[k] = entries(L[k]) end
  result.routes = {}
  for _, vertical in ipairs({false, true}) do
    local pos = graph.rows(L, function() return vertical and 26 or 2 end)
    local segments = {}
    local cv = {
      hline = function(_, ...) segments[#segments + 1] = {'h', ...} end,
      vline = function(_, ...) segments[#segments + 1] = {'v', ...} end,
      set = function(_, ...) segments[#segments + 1] = {'p', ...} end,
    }
    local opts = {width = 24, top = 3, left = 5, height = function() return 2 end, label_width = function(id) return #id end}
    local bounds = (vertical and graph.draw_v or graph.draw)(cv, L, pos, opts)
    result.routes[#result.routes + 1] = {pos = entries(pos), segments = segments, bounds = bounds}
  end
  results[#results + 1] = result
end
vim.fn.writefile({vim.json.encode(results)}, arg[3])
