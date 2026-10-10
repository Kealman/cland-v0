-- id: THREAD-001
-- title: Message blocks at 120 columns retain gutters, bands and intact wrapped ids
-- preconditions: five roles and two local days of stub-hub history
-- expected: headers and dates render; wrapped rows keep their gutter and indentation; stages do not hide long headers
-- since: T-132
-- regression: no
local messages = {}
for i, role in ipairs({'coordinator','implementer','reviewer','qa'}) do
  messages[#messages+1] = { id='role-'..i,from=role,fromKind='agent',fromRole=role,to={'human'},
    text='Taking T-58.',ts='2026-10-08T10:00:00Z',topic='general' }
end
messages[#messages+1] = {id='human',from='human',fromKind='human',to={'coordinator'},stage='injected',
  ts='2026-10-09T10:00:00Z',topic='general',text='  '..('word '):rep(27)..'T-58 '..('word '):rep(20)..'END'}
messages[#messages+1] = {id='long',from='a-very-long-coordinator-name-that-will-wrap-in-the-thread',fromKind='agent',
  fromRole='coordinator',to={'human','impl-58','rev-6','qa-1'},ts='2026-10-09T10:01:00Z',topic='general',
  text='Headers preserve sender, role and addressees.'}
return {
  title = 'Message blocks at 120 columns retain gutters, bands and intact wrapped ids',
  hub = 'stub', fixture = {project='qa-thread-blocks'}, scenario = {messages={general=messages},inbox={}},
  run = function(qa)
    qa.wait_for(function() return qa.screen():find('Headers preserve',1,true) end,10000,'history')
    vim.o.columns,vim.o.lines=120,45
    qa.keys('<Esc>:Cland preset charting<CR><Space>i')
    local w=require('cland.layout').centre()
    vim.api.nvim_set_current_win(w)
    qa.keys('gg0')
    vim.fn.winrestview({topline=1})
    qa.wait_for(function() return qa.screen():find('── Thu 8 Oct',1,true) end,5000,'first local day')
    local screen=qa.screen()
    qa.expect(screen:find('── Fri 9 Oct',1,true) ~= nil,'second local day')
    qa.expect(screen:find('coordinator [Coordinator] → you  10:00',1,true) ~= nil,'header with human addressee')
    qa.expect(screen:find('✓✓ injected',1,true) ~= nil,'delivery stage')
    qa.expect(screen:find('[Coordinator] →',1,true) ~= nil and screen:find('you, impl-58, rev-6, +1  10:01',1,true) ~= nil,'wrapped long header keeps role, addressees and time')
    local b=vim.api.nvim_win_get_buf(w)
    local row
    for n,l in ipairs(vim.api.nvim_buf_get_lines(b,0,-1,false)) do if l:find('END',1,true) then row=n end end
    qa.expect(row ~= nil,'human body found')
    qa.keys(tostring(row)..'gg0')
    qa.wait_for(function() return qa.screen():find('▌   word',1,true) end,5000,'cursor emphasis on human body')
    local line=vim.api.nvim_buf_get_lines(b,row-1,row,false)[1]
    local a,z=vim.fn.screenpos(w,row,1),vim.fn.screenpos(w,row,#line)
    local left=vim.fn.getwininfo(w)[1].wincol
    qa.expect(z.row>a.row,'body wraps')
    -- Cell attributes settle one redraw after screen text on the pinned headless grid.
    qa.wait_for(function()
      vim.cmd('redraw!')
      for r=a.row,z.row do
        if vim.api.nvim__inspect_cell(1,r-1,left+5)[2].background~=tonumber('141a23',16) then return false end
      end
      return true
    end,5000,'wrapped band cell attributes')
    for r=a.row,z.row do
      qa.expect(vim.fn.screenstring(r,left)=='▌','heavy gutter on every human screen row')
      qa.expect(vim.fn.screenstring(r,left+2)==' ' and vim.fn.screenstring(r,left+3)==' ','continuation indentation')
      local cell=vim.api.nvim__inspect_cell(1,r-1,left+5)[2]
      qa.expect(cell.background==tonumber('141a23',16),'band survives every wrapped row')
    end
    local id=line:find('T-58',1,true)
    local first,last=vim.fn.screenpos(w,row,id),vim.fn.screenpos(w,row,id+3)
    qa.expect(first.row==last.row,'T-58 stays whole')
    qa.dump('thread-120')
  end,
}
