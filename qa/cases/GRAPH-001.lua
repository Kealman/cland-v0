-- id: GRAPH-001
-- title: Experimental graph at T-19 density on native hub fields
-- preconditions: frozen T-19 topology plus an explicit-status sampler on the stub hub
-- expected: legible labels at 120/160/200; continuations, cursor, badges and o work
-- since: T-163 (successor of prototype/graph GRAPH-001)
-- regression: yes
local dir = debug.getinfo(1, 'S').source:sub(2):match('^(.*)/')
local snapshot = vim.json.decode(table.concat(vim.fn.readfile(dir .. '/GRAPH-001.items.json'), '\n'))
local items = {
  {id='T-130',kind='release',title='v0.1',version='0.1.0',state='open'},
  {id='T-19',kind='epic',title='First working slice',parent='T-130',state='closed'},
  {id='T-200',kind='epic',title='Native status sampler',parent='T-130',state='open'},
}
vim.list_extend(items, snapshot.items)
local sampler = {}
for i, status in ipairs({'planned','in progress','review','qa','ready','done','backlog'}) do
  items[#items+1] = {id='T-'..(200+i),kind='task',title='Hub '..status,parent='T-200',status=status,
    state=status=='done' and 'closed' or 'open',blocked_by=i==1 and {} or {'T-'..(199+i)}}
  sampler[items[#items].id] = items[#items]
end
items[#items+1] = {id='T-208',kind='task',title='Folded tray done',parent='T-200',state='closed',status='done',blocked_by={}}
-- Claims and verdicts deliberately disagree with workflow: status is the hub's word.
sampler['T-202'].claim = {session='impl-202',role='implementer'}
sampler['T-202'].topic = 'topic-202'
sampler['T-202'].criteria = {
  {id='C1',checked=true,marks={{kind='done'}}},
  {id='C2',checked=true,marks={{kind='verified'}}},
  {id='C3',checked=true,marks={{kind='failed'}}},
}
sampler['T-202'].verdicts = {{verdict='review',result='clear'},{verdict='qa',result='not clear'}}
sampler['T-205'].verdicts = {{verdict='review',result='not clear'}}
return {
  title='Experimental graph at T-19 density on native hub fields',hub='stub',fixture={project='qa-graph'},
  scenario={items=items,topics={{id='topic-202',title='Work topic',item='T-202'}},
    processes={{name='impl-202',role='implementer',state='idle',status='running'}},
    attach={['impl-202']="printf 'Graph worker'; sleep 600"},
    inbox={asks={{id='ask-202',topic={id='topic-202'},question='Choose?'}}}},
  run=function(qa)
    local graph, api = require('cland.graph'), vim.api
    local function buffer() return table.concat(api.nvim_buf_get_lines(graph.b,0,-1,false),'\n') end
    local function selected(id, keys)
      if keys then qa.keys(keys) end
      qa.wait_for(function() return graph.node_at()==id end,5000,'cursor on '..id)
    end
    local function rendered(predicate, what)
      qa.wait_for(function() return graph.model and graph.drawn==graph.parent() and predicate(graph.model) end,5000,what)
    end
    local function dump(name)
      qa.dump(name)
      local out=vim.env.CLAND_QA_OUT
      if out and out~='' then vim.fn.writefile(api.nvim_buf_get_lines(graph.b,0,-1,false),out..'/'..name..'.canvas.txt') end
    end
    qa.wait_for(function() return #qa.state().items==#items end,10000,'hub snapshot')
    qa.keys('<Esc>:Cland graph T-19<CR>')
    rendered(function(m) return graph.parent()=='T-19' and #m.layout.nodes==22 end,'T-19 drawn')
    qa.expect(graph.orient=='vertical','vertical is the default')
    qa.expect(graph.model.layout.edges==36 and #graph.model.layout.chains==32,'36 edges, four implied edges hidden')
    for _, width in ipairs({120,160,200}) do
      qa.keys(':set columns='..width..' lines=45<CR>')
      rendered(function() return graph.window_width==api.nvim_win_get_width(vim.fn.bufwinid(graph.b)) and vim.o.columns==width end,'resize '..width)
      local m=graph.model
      for _, id in ipairs(m.layout.nodes) do
        local n=m.nodes[id]
        qa.expect(n and n.col+n.width<=graph.window_width,'whole label of '..id..' fits at '..width)
      end
      qa.expect(not buffer():find('┼',1,true),'crossings are never ambiguous joins')
      if width==120 then qa.expect(m.wrapped>0 and buffer():find('↳',1,true),'wide layer continues under ↳') end
      dump('t19-'..width)
      qa.keys('<Space>s')
      rendered(function() return graph.window_width==width end,'full centre '..width)
      for _, id in ipairs(graph.model.layout.nodes) do
        local n=graph.model.nodes[id]
        qa.expect(n.col+n.width<=width,'full centre label fits: '..id)
      end
      dump('t19-'..width..'-full')
      qa.keys('<Space>s<C-h>')
      rendered(function() return graph.window_width<width end,'sessions panel restored')
    end
    selected('T-21','gg'); selected('T-22','j'); selected('T-42','G')
    qa.expect(api.nvim_win_call(vim.fn.bufwinid(graph.b),vim.fn.winsaveview).topline>1,'last layer scrolls into view')
    qa.keys('o')
    rendered(function(m) return m.orient=='horizontal' end,'o turns sideways')
    selected('T-21','^'); selected('T-42','$')
    local win=vim.fn.bufwinid(graph.b)
    local view=api.nvim_win_call(win,vim.fn.winsaveview)
    qa.expect(view.leftcol>0,'sideways canvas scrolls to last layer')
    qa.expect(graph.model.nodes['T-42'].col>=view.leftcol,'selected node stays visible')
    qa.keys('+')
    rendered(function(m) return m.width==34 end,'+ widens sideways labels on canvas')
    qa.expect(graph.node_at()=='T-42','width change keeps the selected node')
    qa.keys('-')
    rendered(function(m) return m.width==30 end,'- narrows sideways labels on canvas')
    dump('t19-sideways-200')
    qa.keys('o')
    rendered(function(m) return m.orient=='vertical' end,'o returns vertical')
    selected('T-22','gg j')
    qa.keys('<CR>')
    qa.wait_for(function() return qa.state().view.kind=='item' and qa.state().view.id=='T-22' end,5000,'Enter opens node')
    qa.keys('<Space><Space>'); selected('T-22')
    qa.keys('r')
    rendered(function(m) return #m.layout.chains==36 and #m.layout.hidden==0 end,'r reveals implied edges')
    qa.keys('r:Cland graph T-200<CR>')
    rendered(function() return graph.parent()=='T-200' and buffer():find('1/3',1,true) end,'native criteria fetched')
    selected('T-202')
    qa.keys('p')
    rendered(function() return graph.parent()=='T-130' end,'p cycles to release')
    qa.keys('P')
    rendered(function() return graph.parent()=='T-200' end,'P cycles back to epic')
    selected('T-202')
    local text=buffer()
    for _, s in ipairs({'○ T-201 Hub planned','◐ T-202','?1 impl-202','✗ qa','1/3','◉ T-205 ◌ Hub ready','1 done folded'}) do
      qa.expect(text:find(s,1,true),'native badge/status: '..s)
    end
    qa.expect(not text:find('✓ review',1,true),'only latest verdict is drawn')
    qa.keys('d')
    rendered(function() return buffer():find('Folded tray done',1,true) end,'d reveals done tray')
    qa.keys('d'); rendered(function() return not graph.model.nodes['T-208'] end,'d folds done tray')
    qa.keys('gI')
    qa.wait_for(function() return qa.state().view.kind=='item' and qa.state().view.id=='T-202' end,5000,'gI opens selected item')
    qa.keys('<Space><Space>'); selected('T-202')
    qa.keys('gt')
    qa.wait_for(function() return qa.state().view.kind=='thread' and qa.state().view.id=='topic-202' end,5000,'gt opens topic')
    qa.keys('<Esc><Space><Space>'); selected('T-202')
    qa.keys('gs')
    qa.wait_for(function() return qa.state().view.kind=='session' and qa.state().view.id=='impl-202' end,5000,'gs opens claiming session')
    qa.keys('<Esc><Space><Space>'); selected('T-202')
    local changed=vim.deepcopy(require('cland.state').item('T-203'))
    changed.status,changed.assignee='in progress','impl-203'
    require('cland.items').apply_event({type='task',id=changed.id,item=changed})
    rendered(function() return buffer():find('for impl-203',1,true) end,'live node update')
    qa.expect(graph.node_at()=='T-202','live update keeps cursor on node')
    qa.keys('+')
    rendered(function() return graph.vmin==22 and graph.model.width>=22 end,'+ widens minimum label')
    qa.keys('-')
    rendered(function() return graph.vmin==20 end,'- restores minimum')
    dump('native-statuses')
    qa.keys('<Space>b')
    qa.wait_for(function() return qa.state().view.kind=='board' end,5000,'board remains on Space b')
    qa.keys('<Space><Space>'); selected('T-202')
    qa.expect(#require('cland.actions').audit()==0,'all graph keys are declared')
  end,
}
