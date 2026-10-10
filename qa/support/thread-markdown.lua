-- Shared stub-hub screen checks for the two shipped widths. All rendering is production rendering.
return function(columns)
  local function message(id, text, extra)
    return vim.tbl_extend('force', {id=id,from='coordinator',fromKind='agent',fromRole='coordinator',to={'human'},
      ts='2026-10-09T10:00:00Z',topic='general',text=text},extra or {})
  end
  local destination='https://example.com/'..('long-destination/'):rep(12)
  local table_text='| **Item** | [State](https://example.com/state) | Description |\n|------|-------|-------------|\n| T-58 | open | '..('detail '):rep(10)..'END |'
  local messages={
    message('markdown','## Plan\nUse `history` and [the brief]('..destination..').\n- '..('word '):rep(25)..'T-58 LIST-END\n```lua\nprint(1)\n```'),
    message('quote','> '..('quoted '):rep(23)..'QUOTE-END'),
    message('table',table_text),
    message('small-table','| [Brief]('..destination..') | State |\n|---|---|\n| visible | open |'),
    message('header-only','| '..('wide '):rep(25)..'HEADER-ONLY-END | State |\n|---|---|'),
    message('header','HEADER-END',{from='human',fromKind='human',fromRole=vim.NIL,
      to={'very-long-coordinator-name','another-long-addressee','third-long-addressee'},stage='injected'}),
  }
  return {
    title='Per-message Markdown at '..columns..' columns', hub='stub', fixture={project='qa-thread-markdown'},
    scenario={messages={general=messages},inbox={}},
    run=function(qa)
      qa.wait_for(function() return qa.screen():find('HEADER-END',1,true) end,10000,'history')
      vim.o.columns,vim.o.lines=columns,55
      qa.keys('<Esc>:Cland preset charting<CR><Space>i')
      local api=vim.api
      local w=require('cland.layout').centre()
      api.nvim_set_current_win(w)
      qa.keys('gg0')
      vim.fn.winrestview({topline=1})
      qa.wait_for(function() return qa.screen():find('Use history and the brief.',1,true) end,5000,'Markdown conceal')
      local b=api.nvim_win_get_buf(w)
      local function find(needle)
        for r,line in ipairs(api.nvim_buf_get_lines(b,0,-1,false)) do
          if line:find(needle,1,true) then return r,line end
        end
        error('Missing body text: '..needle)
      end
      local screen=qa.screen()
      qa.expect(not screen:find('## Plan',1,true),'heading marker concealed')
      qa.expect(not screen:find('```',1,true) and screen:find('  print(1)',1,true)~=nil,'fences concealed, code inset')
      qa.expect(screen:find('lua',1,true)~=nil,'faint language on first code row')
      local row=find('Use ')
      qa.expect(api.nvim_win_text_height(w,{start_row=row-1,end_row=row-1}).all==1,
        'T-86 concealed text keeps raw line breaks: long hidden destination takes no extra row')
      local links=require('cland.views').topic('general').thread.info[row].links
      qa.expect(#links==1 and links[1].destination==destination,'compact link retains destination in row metadata')
      local list,line=find('LIST-END')
      local left=vim.fn.getwininfo(w)[1].wincol
      local first,last=vim.fn.screenpos(w,list,1),vim.fn.screenpos(w,list,#line)
      qa.expect(last.row>first.row,'list wraps')
      for r=first.row+1,last.row do
        qa.expect(vim.fn.screenstring(r,left+2)==' ' and vim.fn.screenstring(r,left+3)==' ','list continuation aligns under bullet text')
      end
      local id=line:find('T-58',1,true)
      qa.expect(vim.fn.screenpos(w,list,id).row==vim.fn.screenpos(w,list,id+3).row,'item id stays whole')
      local quote,quoted=find('QUOTE-END')
      local qfirst,qlast=vim.fn.screenpos(w,quote,1),vim.fn.screenpos(w,quote,#quoted)
      qa.expect(qlast.row>qfirst.row,'quote wraps')
      for r=qfirst.row+1,qlast.row do
        qa.expect(vim.fn.screenstring(r,left+2)=='q' or vim.fn.screenstring(r,left+2)=='Q',
          'T-86 repeated overlay hides first character: quote continuation text is intact')
      end
      for _,mark in ipairs(api.nvim_buf_get_extmarks(b,api.nvim_get_namespaces()['cland.thread'],0,-1,{details=true})) do
        qa.expect(not mark[4].virt_text_repeat_linebreak,'gutter/quote never repeat an overlay over text')
      end
      screen=qa.screen()
      qa.expect(screen:find('| Brief',1,true)~=nil and screen:find('| visible',1,true)~=nil,
        'concealed header destination does not force a visually small table to stack')
      local brief=find('| Brief')
      qa.expect(require('cland.views').topic('general').thread.info[brief].links[1].destination==destination,
        'full table header retains link metadata')
      qa.expect(table.concat(api.nvim_buf_get_lines(b,0,-1,false),'\n'):find('HEADER-ONLY-END',1,true)~=nil,
        'a wide header-only table keeps its header cells')
      qa.expect(screen:find('very-long-coordinator-name',1,true)~=nil and screen:find('third-long-addressee',1,true)~=nil,
        'T-86 right_align covers wrapped header: all addressees survive')
      qa.expect(screen:find('✓✓ injected',1,true)~=nil,'stage follows wrapped header')
      if columns==80 then
        qa.expect(screen:find('Description:',1,true)~=nil and screen:find('Item: T-58',1,true)~=nil,
          'T-86 pipe table wraps mid-row: narrow table is stacked by labelled cells')
        qa.expect(screen:find('State: open',1,true)~=nil and not screen:find('**Item**',1,true),
          'stacked labels retain heading Markdown and compact link styling')
        local state_row=find('State: open')
        qa.expect(require('cland.views').topic('general').thread.info[state_row].links[1].destination=='https://example.com/state',
          'stacked table header retains link destination')
        qa.expect(not table.concat(api.nvim_buf_get_lines(b,0,-1,false),'\n'):find('| T-58',1,true),'raw wide row is absent at 80')
      else
        local tablerow=find('| T-58')
        qa.expect(api.nvim_win_text_height(w,{start_row=tablerow-1,end_row=tablerow-1}).all==1,'full table fits at 120')
      end
      qa.dump('markdown-'..columns)
      -- Projection changes on resize from cached spans; destinations and ids remain attached.
      vim.o.columns=columns==80 and 120 or 80
      qa.wait_for(function()
        local text=table.concat(api.nvim_buf_get_lines(b,0,-1,false),'\n')
        return columns==80 and text:find('| T-58',1,true)~=nil or columns==120 and text:find('Item: T-58',1,true)~=nil
      end,5000,'table reflows after resize')
    end,
  }
end
