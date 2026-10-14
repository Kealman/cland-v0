-- id: EXPLORER-002
-- title: Categories with top three, more, idle work and hidden done count
-- preconditions: four categories, category tasks and epic, a map and archived roots on the stub hub
-- expected: Categories names counts; Tech debt shows idle work and top three; l unfolds more; D hides done
-- since: T-356
-- regression: yes
local items = {
  {id='R-228',kind='release',title='Working with items',version='0.1.2',state='open'},
  {id='C-216',kind='category',title='Tech debt',state='open'},
  {id='C-217',kind='category',title='Bugs',state='open'},
  {id='C-218',kind='category',title='Follow-ups',state='open'},
  {id='C-219',kind='category',title='Ideas',state='open'},
  {id='E-300',kind='epic',title='Collected bugs',parent='C-217',state='open'},
  {id='T-301',kind='task',title='Nested bug fix',parent='E-300',state='open',status='review'},
  {id='M-302',kind='map',title='Explore the fog',state='open',rank=100},
  {id='T-303',kind='task',title='Unscheduled task',state='open',status='backlog',rank=1},
  {id='T-304',kind='task',title='Closed root task',state='closed',status='done',closed='2026-10-12T00:00:00Z'},
  {id='R-400',kind='release',title='Future release',version='0.2.0',state='open'},
  {id='R-200',kind='release',title='Previous release',version='0.1.1',state='closed',closed='2026-10-11T00:00:00Z'},
}
for n, rank in ipairs({30,10,50,20,40}) do
  items[#items+1] = {id='T-' .. (310+n),kind='task',title='Debt ' .. n,parent='C-216',state='open',status='backlog',rank=rank}
end
items[#items+1] = {id='T-320',kind='task',title='Resolved debt',parent='C-216',state='closed',status='done',closed='2026-10-12T00:00:00Z'}
return {
  title='Categories with top three, more, idle work and hidden done count',hub='stub',centre='explorer',fixture={project='qa-explorer-roots'},
  scenario={items=items,tracker={levels={'release','category','epic'},ladder={{'release','category'},{'epic'}}},
    crew={config={idle_from={'C-216'}},summary='idle from C-216'},
    processes={{name='coord',role='coordinator',state='idle',status='running'}}},
  run=function(qa)
    local api, explorer = vim.api, require('cland.explorer')
    local function select(key)
      for r,row in ipairs(explorer.rows) do
        if row.key==key then api.nvim_set_current_win(explorer.tree_win());api.nvim_win_set_cursor(explorer.tree_win(),{r,0});return end
      end
      error('missing row ' .. key)
    end
    local function visible(value) return qa.screen():find(value,1,true) end
    qa.wait_for(function() return #qa.state().items==#items end,10000,'item snapshot')
    qa.keys('<Esc>:set columns=200 lines=50<CR><Space>e')
    qa.wait_for(function() return visible('Categories (4) · 6 open') and visible('Tech debt 5 open') end,5000,'category counts')
    select(':categories');qa.keys('l')
    qa.wait_for(function() return visible('idle work') and visible('2 more') and visible('5 open · 1 done') end,5000,'category top three')
    local screen=qa.screen()
    for _,value in ipairs({'T-312 Debt 2','T-314 Debt 4','T-311 Debt 1','Resolved debt'}) do qa.expect(screen:find(value,1,true),'visible '..value) end
    qa.expect(screen:find('T-312',1,true)<screen:find('T-314',1,true) and screen:find('T-314',1,true)<screen:find('T-311',1,true),'top three ordered by rank')
    qa.expect(not visible('Debt 5') and not visible('Debt 3'),'remaining live items start folded')
    qa.dump('category-top-three-200')
    select(':more:C-216');qa.keys('l')
    qa.wait_for(function() return visible('Debt 5') and visible('Debt 3') end,5000,'remaining live items unfolded')
    qa.keys('D')
    qa.wait_for(function() return visible('D hides 1 done') and not visible('Resolved debt') end,5000,'hidden done count')
    qa.dump('category-more-done-hidden-200')
    qa.expect(#require('cland.actions').audit()==0,'all keys use the action registry')
  end,
}
