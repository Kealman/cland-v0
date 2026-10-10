-- Unit cases use only the module's public results. Neovim supplies a Unicode
-- measurement callback and JSON decoding, then its global is removed entirely.
package.path = 'nvim/lua/?.lua;' .. package.path
local call, decode = vim.api.nvim_call_function, vim.json.decode
local measure = function(s) return call('strdisplaywidth', {s}) end
require('bit')
local inspect, same = vim.inspect, vim.deep_equal
vim = nil
local G = dofile('nvim/lua/cland/graph_layout.lua')
local function eq(actual, expected)
  assert(same(actual, expected), 'expected ' .. inspect(expected) .. ', got ' .. inspect(actual))
end
local function text(cv)
  return table.concat(cv:render(), '\n')
end
local function fixture()
  local f = assert(io.open('nvim/test/fixtures/graph-t19.json'))
  local data = decode(f:read('*a')); f:close()
  return data.items
end
local function readable(cv)
  assert(not text(cv):find('┼', 1, true), 'ambiguous crossing')
  local _, joins = cv:count()
  eq(joins, 0)
end
local cases = {}

function cases.cycles()
  local L = G.layout({'A', 'B', 'C', 'D'}, {{'A','B'}, {'B','C'}, {'C','A'}, {'D','D'}, {'X','A'}, {'A','B'}})
  eq(L.cycles, {{'C','A'}, {'D','D'}})
  eq(L.edges, 4)
  eq(#L.chains, 2)
  eq(L.layer, {A=1,B=2,C=3,D=1})
  -- Isolated self-loops remain visible and are named, rather than silently dropped.
  local S = G.from_items({{id='S',blocked_by={'S'}}})
  eq(S.nodes, {'S'}); eq(S.tray, {}); eq(S.cycles, {{'S','S'}})
end

function cases.reduction()
  local nodes, edges = {'A','B','C','D'}, {{'A','B'},{'B','C'},{'C','D'},{'A','C'},{'A','D'},{'B','D'}}
  local reduced, full = G.layout(nodes, edges), G.layout(nodes, edges, {reduce=false})
  eq(reduced.hidden, {{'A','C'},{'A','D'},{'B','D'}})
  eq(#reduced.chains, 3); eq(#full.chains, 6); eq(full.hidden, {})
  for _, id in ipairs(nodes) do eq(reduced.layer[id], full.layer[id]) end
  eq(G.layout(nodes, {{'A','B'},{'A','C'}}).hidden, {})
end

function cases.layers()
  local L = G.layout({'A','B','C','D','E'}, {{'A','C'},{'B','C'},{'C','D'},{'D','E'},{'B','E'}}, {reduce=false})
  eq(L.layer.A,1); eq(L.layer.B,1); eq(L.layer.C,2); eq(L.layer.D,3); eq(L.layer.E,4)
  eq(L.dummies,2)
  local long
  for i, c in ipairs(L.chains) do
    if c.from=='B' and c.to=='E' then
      long = c
      eq(#c.path,4)
      for j=2,3 do assert(G.is_dummy(c.path[j])); eq(L.via[c.path[j]],i) end
    end
    for j=1,#c.path-1 do eq(L.layer[c.path[j+1]], L.layer[c.path[j]]+1) end
  end
  assert(long)
  local empty = G.layout({}, {})
  eq(empty.layers,{}); eq(empty.crossings,0)
end

function cases.ordering()
  local nodes = {'A','B','C','D','E','F'}
  local edges = {{'A','F'},{'B','E'},{'C','D'}}
  local fixed = G.layout(nodes, edges, {keep_order=true})
  local ordered = G.layout(nodes, edges)
  eq(fixed.crossings,3); eq(ordered.crossings,0)
  eq(ordered.layers, G.layout(nodes,edges).layers)
  eq(ordered.layers, G.layout(nodes,{{'C','D'},{'B','E'},{'A','F'}}).layers)
  -- Swaps run even with no barycentre sweeps; they improve a fork/join graph.
  local E = {{'A','D'},{'A','F'},{'B','D'},{'B','E'},{'C','E'}}
  assert(G.layout(nodes,E,{sweeps=0}).crossings < G.layout(nodes,E,{keep_order=true}).crossings)
end

function cases.positions()
  local L = G.layout({'A','B','C','D'}, {{'A','C'},{'B','D'}})
  local row = G.rows(L,function() return 2 end)
  eq(row.A,row.C); eq(row.B,row.D)
  for _, ids in ipairs(L.layers) do
    for i=2,#ids do assert(row[ids[i]] >= row[ids[i-1]] + 3) end
  end
  local packed = G.rows(L,function() return 2 end,function() return 4 end,true)
  eq(packed.A,0); eq(packed.B,7)
end

function cases.tracks()
  local L = G.layout({'A','B','C','D','E'}, {{'A','C'},{'A','D'},{'A','E'},{'B','C'},{'B','D'}}, {keep_order=true})
  local cv = G.render(L, {orient='horizontal', width=4})
  readable(cv)
  -- Each non-straight segment has its own vertical track in its channel.
  local tracks = {}
  for edge, cells in pairs(cv:cells_of_edges()) do
    for _, cell in ipairs(cells) do
      if require('bit').band(cell[3], G.U + G.D) ~= 0 then
        local c = cell[2]
        assert(not tracks[c] or tracks[c]==edge, 'shared track')
        tracks[c] = edge
      end
    end
  end
  local n=0; for _ in pairs(tracks) do n=n+1 end
  assert(n>=3)
  -- Independent crossing lines stay independent in the ownership map.
  local cross = G.canvas()
  cross:hline(1,0,4,1); cross:vline(2,0,2,2)
  eq(cross:count(),1)
  local lines, _, _, crossings = cross:render()
  eq(lines[2],'──│──'); assert(crossings[1][2])
  eq(cross.own[1][2], {[1]=G.L+G.R,[2]=G.U+G.D})
end

function cases.tray()
  local kids = {{id='A'},{id='B',blocked_by={'A','X','A'}},{id='C',blocked_by={'X'}},{id='D'}}
  local L = G.from_items(kids)
  eq(L.nodes, {'A','B'}); eq(L.tray, {'C','D'}); eq(L.edges,1)
  eq(L.outside, {{'X','B'},{'X','C'}})
  local cv, geo = G.render(L,{width=8,tray_columns=1})
  assert(geo.nodes.C.tray and geo.nodes.D.tray)
  assert(geo.nodes.C.row > geo.nodes.B.row)
  assert(geo.nodes.D.row > geo.nodes.C.row)
  assert(text(cv):find('Tray',1,true)); readable(cv)
  local tray = G.from_items({{id='only'}})
  eq(tray.layers,{})
  assert(text(G.render(tray)):find('only',1,true))
  local _, tray_geo = G.render(tray,{top=5,left=7})
  eq(tray_geo.nodes.only.row,7); eq(tray_geo.nodes.only.col,7)
  eq(text(G.render(G.from_items({}))), '')
end

function cases.canvas()
  local cv = G.canvas(measure)
  eq(cv:put(0,0,{{'○ 界é','label'}}),5)
  local lines, marks, bc = cv:render()
  eq(lines,{'○ 界é'})
  eq(marks,{{0,0,#lines[1],'label'}})
  eq(bc[0][0],0); eq(bc[0][1],3); eq(bc[0][2],4)
  eq(bc[0][3],4) -- either cell of a wide character maps to its first byte
  eq(bc[0][4],7); eq(bc[0][5],#lines[1])
  eq(G.width('○ 界é',measure),5) -- combining acute has zero width
  eq(G.fit('界界界',4,measure),'界…')
  eq(G.fit('abcdef',1),'…'); eq(G.fit('text',0),'')
  local clip = G.canvas(measure)
  eq(clip:put(0,0,{{'ab界','a'},{'Z','b'}},3),2)
  eq(text(clip),'ab') -- clipping cannot resume in a later chunk
  local trailing = G.canvas()
  trailing:put(0,0,{{'x  ','label'}})
  local tlines, tmarks, tbc = trailing:render()
  eq(tlines,{'x'}); eq(tmarks,{{0,0,1,'label'}}); eq(tbc[0][3],1)
  local four = G.canvas()
  four:set(0,0,G.U+G.D+G.L+G.R,1)
  eq(text(four),'│') -- even an invalid junction never emits the ambiguous glyph
end

function cases.controls()
  local raw, normalized = 'ab\t界éZ', 'ab 界éZ'
  local cv = G.canvas(measure)
  eq(cv:put(0,3,{{raw,'label'}}),7)
  local lines, marks, bc = cv:render()
  eq(lines,{'   '..normalized}); eq(measure(lines[1]),10)
  eq(marks,{{0,3,13,'label'}})
  eq(bc[0],{[0]=0,1,2,3,4,5,6,6,9,12,13})
  eq(G.width(raw,measure),7)
  eq(G.fit(raw,7,measure),normalized)
  eq(G.fit(raw,6,measure),'ab 界…')
  -- All C0/C1 controls (including NUL, line breaks and DEL) become one space.
  local controls = {}
  for b=0,31 do controls[#controls+1]=string.char(b) end
  controls[#controls+1]=string.char(127)
  for b=128,159 do controls[#controls+1]=string.char(194,b) end
  local input = table.concat(controls)..'Z'
  local expected = string.rep(' ',65)..'Z'
  local plain = G.canvas()
  eq(plain:put(0,0,{{input}}),66)
  eq(text(plain),expected); eq(G.width(input),66); eq(G.fit(input,66),expected)
  -- The sideways router must measure the same normalized label it emits.
  local L = G.layout({'A','B'},{{'A','B'}})
  local graph, geo = G.render(L,{orient='horizontal',left=3,width=20,
    measure=measure,label=function() return {{{raw,'label'}}} end})
  local glines, _, gb = graph:render()
  local c = geo.nodes.B.col
  eq(gb[geo.nodes.B.row][c],#glines[1]-#normalized)
  eq(measure(glines[1]),c+7)
  assert(not glines[1]:find('\t',1,true)); readable(graph)
end

function cases.orientations()
  local L = G.from_items({{id='A'},{id='B',blocked_by={'A'}},{id='C',blocked_by={'A'}}})
  local before = inspect(L)
  local label = function(id) return {{{'○ '..id,'node'}},{{'details','detail'}}} end
  local v, vg = G.render(L, {width=12,measure=measure,label=label,top=2,left=3})
  local h, hg = G.render(L, {width=12,measure=measure,label=label,orient='horizontal',top=2,left=3})
  eq(inspect(L),before)
  assert(vg.nodes.B.row>vg.nodes.A.row and vg.nodes.C.row>vg.nodes.A.row)
  eq(vg.nodes.B.row,vg.nodes.C.row)
  assert(hg.nodes.B.col>hg.nodes.A.col and hg.nodes.C.col>hg.nodes.A.col)
  eq(hg.nodes.B.col,hg.nodes.C.col)
  assert(vg.nodes.A.col>=3 and vg.nodes.A.row==2)
  for _, cv in ipairs({v,h}) do readable(cv); assert(text(cv):find('details',1,true)) end
end

function cases.dense()
  -- Deterministic DAGs include forks, joins and long paths.
  local seed = 159
  local function rand() seed=(seed*16807)%2147483647; return seed/2147483647 end
  for n=2,28 do
    local nodes, edges = {}, {}
    for i=1,n do nodes[i]='N'..i end
    for i=1,n do for j=i+1,n do if rand()<0.22 then edges[#edges+1]={nodes[i],nodes[j]} end end end
    local L = G.layout(nodes,edges,{reduce=false})
    for _, orient in ipairs({'vertical','horizontal'}) do
      local cv = G.render(L,{width=4,orient=orient})
      readable(cv)
    end
  end
  -- A broad bipartite graph exercises the >12-source track-order fallback.
  local nodes, edges = {}, {}
  for i=1,26 do nodes[i]='N'..i end
  for i=1,13 do for j=14,26 do edges[#edges+1]={nodes[i],nodes[j]} end end
  local broad = G.layout(nodes,edges,{keep_order=true})
  for _, orient in ipairs({'vertical','horizontal'}) do
    readable(G.render(broad,{width=4,orient=orient}))
  end
end

function cases.t19()
  local L = G.from_items(fixture())
  eq(#L.nodes,22); eq(L.edges,36); eq(#L.hidden,4); eq(#L.layers,10)
  assert(L.crossings < G.from_items(fixture(),{sweeps=0}).crossings,
    'barycentre sweeps improve the T-19 ordering beyond local swaps alone')
  for _, orient in ipairs({'vertical','horizontal'}) do
    local cv = G.render(L,{width=22,orient=orient})
    readable(cv)
    for _, id in ipairs(L.nodes) do assert(text(cv):find(id,1,true)) end
  end
end

local name = assert(arg[1], 'name a unit case')
assert(cases[name], 'unknown case '..name)()
io.write('passed: '..name..'\n')
