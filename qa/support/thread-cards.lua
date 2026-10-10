return function(columns)
  local function message(id, text, extra)
    return vim.tbl_extend('force', {id=id,from='coord',fromKind='agent',fromRole='coordinator',to={},
      kind='report',ts='2026-10-09T10:00:00Z',topic='general',text=text},extra or {})
  end
  local messages={
    message('question','Which review scope?',{kind='question',ask={state='open',options={'Whole diff','Fix only'},free=true}}),
    message('chip','',{artifact={id='A-1',kind='note',title='Review evidence',path='/nonexistent'}}),
    message('report','Coordinator report stays now until T-143.'),
    message('clear','qa clear T-58\nSupporting detail',{from='qa',fromRole='qa'}),
    message('failed','review not clear T-58\nC3 failed: the order is wrong.',{from='rev',fromRole='reviewer'}),
    message('wide-clear','qa clear T-58',{from=('qa-界'):rep(24),fromRole='qa'}),
  }
  return {
    title='Ask cards, shared chips, kinds and watch verdicts at '..columns..' columns',hub='stub',
    fixture={project='qa-thread-cards'},scenario={messages={general=messages},inbox={asks={
      {id='question',from='coord',topic={id='general',title='General'},question='Which review scope?',
        options={'Whole diff','Fix only'},free=true,ts='2026-10-09T10:00:00Z'},
    }}},
    run=function(qa)
      local api=vim.api
      qa.wait_for(function() return #require('cland.views').topic('general').thread.messages==#messages end,10000,'history')
      vim.o.columns,vim.o.lines=columns,45
      qa.keys('<Esc>:Cland preset charting<CR><Space>i')
      local win=require('cland.layout').centre()
      api.nvim_set_current_win(win)
      local t=require('cland.views').topic('general').thread
      t:render()
      qa.keys('gg')
      qa.wait_for(function() return qa.screen():find('free answer: i',1,true) end,5000,'ask card')
      local screen=qa.screen()
      qa.expect(screen:find('1  Whole diff',1,true)~=nil and screen:find('2  Fix only',1,true)~=nil,'numbered options visible')
      qa.expect(screen:find('▣ A-1 note · Review evidence',1,true)~=nil,'chip visible beneath card')
      qa.expect(t.block_of.question==t.block_of.chip and vim.tbl_count(t.block_of.question.heads)==1,'ask and chip share one header')
      local band=0
      for _,m in ipairs(api.nvim_buf_get_extmarks(t.buf,api.nvim_get_namespaces()['cland.thread'],0,-1,{details=true})) do
        if m[4].line_hl_group=='ClandAsk' then band=band+1 end
      end
      qa.expect(band==4,'question, two options and hint have the ask band')
      local clear=t.block_of.clear
      qa.expect(clear.n==2 and clear.lines[2]:find('✓ qa clear T-58',1,true)~=nil,'clear verdict has one message row')
      qa.expect(api.nvim_win_text_height(win,{start_row=clear.start+1,end_row=clear.start+1}).all==1,'clear verdict fits one screen row')
      qa.expect(clear.info[2].group=='ClandRoleQaWatch','watch verdict gutter is dimmed')
      local wide=t.block_of['wide-clear']
      qa.expect(api.nvim_win_text_height(win,{start_row=wide.start+1,end_row=wide.start+1}).all==1,'wide Unicode verdict header fits one screen row')
      qa.expect(wide.lines[2]:find('· report',1,true)~=nil and wide.lines[2]:find('✓ qa clear T-58',1,true)~=nil,'fitting reserves kind and result before names')
      qa.expect(screen:find('C3 failed: the order is wrong.',1,true)~=nil,'failed note stays visible')
      qa.expect(screen:find('· question',1,true)~=nil and screen:find('· report',1,true)~=nil,'message kinds visible')
      local first=t.block_of.question.start+3
      api.nvim_win_set_cursor(win,{first,0})
      qa.keys('2')
      qa.wait_for(function() return t.by_id.question.ask.state=='answered' end,5000,'digit answer through stub hub')
      qa.expect(t.by_id.question.ask.option==2,'digit chooses option two')
      qa.expect(t:ask_at(first)==nil,'answered card has no live key target')
      qa.expect(t.block_of.question==t.block_of.chip,'answer preserves grouped chip')
      qa.dump('cards-'..columns)
    end,
  }
end
