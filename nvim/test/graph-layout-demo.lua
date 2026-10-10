-- Reproduce the headless T-19 demo from the frozen T-86 tracker snapshot.
-- Run from the repository root: <pinned nvim> --clean --headless -l
-- nvim/test/graph-layout-demo.lua <output.md>
package.path = 'nvim/lua/?.lua;' .. package.path
local G = require('cland.graph_layout')
local f = assert(io.open('nvim/test/fixtures/graph-t19.json'))
local data = vim.json.decode(f:read('*a')); f:close()
local measure = vim.fn.strdisplaywidth
local byid = {}
for _, it in ipairs(data.items) do byid[it.id] = it end
local L = G.from_items(data.items)
assert(#L.nodes == 22 and L.edges == 36, 'T-19 snapshot changed')
local out = {
  '# T-159: T-19 headless graph layout', '',
  'Source: T-86’s 2026-10-09 tracker export, frozen in `nvim/test/fixtures/graph-t19.json`.',
  'The 44 children contain 22 linked items and 36 sibling edges; 22 unlinked items sit in the tray.',
  'Both orientations below use the same reduced layout. Labels are 22 display columns wide.',
  'This demonstrates the layout and crossing rules; window fitting and interactive legibility belong to later slices.', '',
}
local label = function(id, width)
  return { { { G.fit('○ ' .. id .. ' ' .. byid[id].title, width, measure) } } }
end
for _, orient in ipairs({'vertical','horizontal'}) do
  local cv = G.render(L, {width=22, orient=orient, measure=measure, label=label})
  local lines = cv:render()
  local crossings, joins = cv:count()
  assert(joins == 0 and not table.concat(lines):find('┼',1,true))
  out[#out+1] = '## ' .. (orient=='vertical' and 'Vertical (default)' or 'Sideways')
  out[#out+1] = ''
  out[#out+1] = '```text'
  for _, line in ipairs(lines) do out[#out+1]=line end
  out[#out+1] = ''
  out[#out+1] = ('22 linked items · 36 edges · %d drawn · %d hidden · %d layers · %d dummy vertices'):format(#L.chains,#L.hidden,#L.layers,L.dummies)
  out[#out+1] = ('Crossings: %d on the canvas (│ over a broken ─) · %d in layer ordering · %d ambiguous joins'):format(crossings,L.crossings,joins)
  out[#out+1] = '```'
  out[#out+1] = ''
end
out[#out+1] = 'Hidden edges (retained in `layout.hidden`, drawn when rebuilt with `reduce=false`):'
for _, e in ipairs(L.hidden) do out[#out+1]='- '..e[1]..' → '..e[2] end
out[#out+1] = ''
local full = G.from_items(data.items, {reduce=false})
local cv = G.render(full, {width=22, measure=measure, label=label})
local crossings, joins = cv:count()
assert(joins == 0)
out[#out+1] = ('With reduction off: %d edges drawn, %d canvas crossings, %d layer-order crossings.'):format(#full.chains,crossings,full.crossings)
out[#out+1] = ''
f = assert(io.open(assert(arg[1], 'provide an output Markdown path'),'w'))
f:write(table.concat(out,'\n')); f:close()
print(('T-19: %d nodes, %d edges, %d hidden, %d layers; demo written'):format(#L.nodes,L.edges,#L.hidden,#L.layers))
