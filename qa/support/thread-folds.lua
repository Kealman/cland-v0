-- Shared production-rendering checks: successor of prototype THREAD-KEYS.
return function(columns)
  local function message(id, extra)
    return vim.tbl_extend('force', {id=id,from='impl-58',fromKind='agent',fromRole='implementer',to={'rev-6'},
      ts='2026-10-09T10:00:00Z',topic='general',text='Background '..id}, extra or {})
  end
  local messages={
    message('a'), message('b',{from='rev-6',fromRole='reviewer',to={'impl-58'}}),
    message('c'), message('d',{from='rev-6',fromRole='reviewer',to={'impl-58'}}),
    message('human',{from='human',fromKind='human',fromRole=vim.NIL,to={'coordinator'},text='Human boundary'}),
    message('addressed',{to={'human'},text='Addressed boundary'}),
    message('ask',{text='Ask boundary',ask={state='open',options={'one'},free=true}}),
    message('answer',{answerTo='unretained',text='Answer boundary'}),
    message('verdict',{from='rev-6',fromRole='reviewer',text='review clear T-58'}),
    message('aide',{from='aide-1',fromRole='aide',text='Aide boundary'}),
    message('to-aide',{to={'aide-1'},text='To Aide boundary'}),
    message('long-a',{from='implementer-with-a-very-long-name-界界界界界界',to={'reviewer-with-a-very-long-name-界界界界'},text='Long run'}),
    message('chip',{to={},artifact={id='A-1',kind='note',title='Background chip',path='/nonexistent'}}),
    message('long-b',{from='reviewer-with-a-very-long-name-界界界界',fromRole='reviewer',to={'implementer-with-a-very-long-name-界界界界界界'},text='Long run reply'}),
  }
  return {
    title='Manual agent-run keys and fitted summaries at '..columns..' columns',hub='stub',
    fixture={project='qa-thread-folds'},
    -- Recipient roles belong to the hub classifier, before history is projected.
    scenario={messages={general=messages},inbox={},presence={{name='aide-1',role='aide'}}},
    run=function(qa)
      local api=vim.api
      qa.wait_for(function() return #require('cland.views').topic('general').thread.messages==#messages end,10000,'history')
      vim.o.columns,vim.o.lines=columns,55
      qa.keys('<Esc>:Cland preset charting<CR><Space>i')
      local win=require('cland.layout').centre()
      api.nvim_set_current_win(win)
      local t=require('cland.views').topic('general').thread
      t:render()
      local first=t.block_of.a.start+2
      api.nvim_win_set_cursor(win,{first,0})
      local function closed() return vim.fn.foldclosed(first)~=-1 end
      qa.expect(closed(),'four-message exchange initially closed')
      qa.expect(t:folded_count(win)==7,'header counts closed messages, including artifact post')
      qa.wait_for(function() return qa.screen():find('4 messages',1,true) and qa.screen():find('7 folded',1,true) end,5000,'faint run and count')
      for _,id in ipairs({'human','addressed','ask','answer','verdict','aide','to-aide'}) do
        local b=t.block_of[id]
        qa.expect(vim.fn.foldlevel(b.start+2)==0,id..' never folds')
      end
      for _,operation in ipairs({{'zo',false},{'zc',true},{'za',false},{'za',true},{'<CR>',false},{'<CR>',true},{'zR',false},{'zM',true}}) do
        qa.keys(operation[1])
        qa.expect(closed()==operation[2],operation[1]..' operates on run')
      end
      qa.expect(closed(),'toggle pairs close first run')
      qa.expect(t:folded_count(win)==7,'zM folds all runs')
      qa.keys('zR')
      qa.expect(t:folded_count(win)==0,'zR opens all runs')
      qa.keys('zM')
      local long=t.block_of['long-a'].start+2
      api.nvim_win_set_cursor(win,{long,0})
      local cells=api.nvim_win_get_width(win)-vim.fn.getwininfo(win)[1].textoff
      local text=vim.fn.foldtextresult(long)
      qa.expect(api.nvim_strwidth(text)<=cells,'T-86 foldtext clipping: summary fits actual text cells')
      qa.expect(text:find('3 messages',1,true)~=nil,'fitting retains the count')
      if columns==80 then qa.expect(text:find('…',1,true)~=nil,'long Unicode names are truncated by cell budget') end
      qa.dump('folds-'..columns)
      api.nvim_win_set_cursor(win,{first,0})
      qa.keys('zR')
      -- Composer Insert remains active while the thread grows; manual folds update.
      local composer=require('cland.layout').win.composer
      api.nvim_set_current_win(composer)
      qa.keys('iunsent draft')
      -- Direct renderer input carries the layer a hub background-message frame supplies.
      t:add(message('append',{text='Appended run',layer='background'}))
      qa.expect(api.nvim_get_mode().mode=='i','background append preserves composer Insert')
      qa.expect(api.nvim_get_current_win()==composer,'background append keeps composer focus')
      qa.expect(api.nvim_win_call(win,function() return vim.fn.foldclosed(long)==-1 end),'open run stays open as it grows in Insert mode')
      qa.keys('<Esc>')
    end,
  }
end
