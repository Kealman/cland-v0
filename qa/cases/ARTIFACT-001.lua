-- id: ARTIFACT-001
-- title: Rendered Markdown artifact and raw editable toggle
-- preconditions: an owned Markdown file in the disposable stub project
-- expected: thread projection, wrapped rows, read-only view, exact raw source and rendered default
-- since: T-796
-- regression: no
local source = '# Artifact heading\nUse **strong**, *soft* and `code`.\n\n```lua\nprint(1)\n```\n- List item\n> Quoted words\n[Brief](https://example.com/very/long/link/tail)\n\n| Name | State |\n|---|---|\n| **Alpha** | ready |'
source = source .. '\n\n  - ' .. ('wrapped '):rep(24) .. 'WRAP-END'
return {
  title = 'Rendered Markdown artifact and raw editable toggle',
  hub = 'stub', fixture = {project = 'qa-artifact-render'}, scenario = {inbox = {}},
  run = function(qa)
    qa.wait_for(function() return qa.screen():find('hub: connected',1,true) end,10000,'connected')
    qa.wait_for(function()
      local c=require('cland').client
      if #require('cland.state').S.roles==0 or c.inbox_waiters then return false end
      for journal in pairs(c.snapshots) do
        if journal.request.type=='artifact.list' then return false end
      end
      return true
    end,5000,'initial artifact snapshot installed')
    qa.keys('<Esc>')
    local api, artifacts = vim.api, require('cland.artifacts')
    local path = vim.fn.getcwd() .. '/artifact.markdown'
    vim.fn.writefile(vim.split(source,'\n',{plain=true}),path,'b')
    qa.expect(#require('cland.actions').audit()==0,'action audit is clear')
    artifacts.open({id='A-796',kind='note',creator='human',status='shared',title='Rendering',topic='general',path=path})
    qa.wait_for(function() return qa.screen():find('Use strong, soft and code.',1,true) end,5000,'rendered grid')
    local screen=qa.screen()
    qa.expect(not screen:find('# Artifact heading',1,true),'heading marker hidden')
    qa.expect(not screen:find('```',1,true) and screen:find('  print(1)',1,true)~=nil,'fenced code band and inset')
    qa.expect(screen:find('• List item',1,true)~=nil,'list bullet')
    qa.expect(screen:find('│ Quoted words',1,true)~=nil,'block quote bar')
    qa.expect(screen:find('Brief',1,true)~=nil and not screen:find('https://example.com',1,true),'compacted link tail')
    qa.expect(screen:find('| Alpha | ready |',1,true)~=nil,'table cell projection')
    qa.expect(vim.bo.readonly and not vim.bo.modifiable,'rendered is read-only')
    qa.expect(vim.wo.wrap and vim.wo.linebreak and vim.wo.breakindent,'thread wrapping options')
    local row,line
    for r,l in ipairs(api.nvim_buf_get_lines(0,0,-1,false)) do if l:find('WRAP-END',1,true) then row,line=r,l end end
    local w=api.nvim_get_current_win()
    local first,last=vim.fn.screenpos(w,row,1),vim.fn.screenpos(w,row,#line)
    local left=vim.fn.getwininfo(w)[1].wincol
    qa.expect(last.row>first.row,'list wraps on the grid')
    for r=first.row+1,last.row do
      qa.expect(vim.fn.screenstring(r,left+3)==' ' and vim.fn.screenstring(r,left+4)=='w','continuation indents under list text')
    end
    local groups={}
    for _,mark in ipairs(api.nvim_buf_get_extmarks(0,api.nvim_get_namespaces()['cland.artifact_md'],0,-1,{details=true})) do
      if mark[4].hl_group then groups[mark[4].hl_group]=true end
      if mark[4].line_hl_group then groups[mark[4].line_hl_group]=true end
    end
    for _,group in ipairs({'ClandHeading','ClandBold','ClandItalic','ClandCode','ClandCodeBlock','ClandQuote','ClandLink'}) do
      qa.expect(groups[group],'thread highlight: '..group)
    end
    qa.dump('artifact-rendered')
    qa.keys('<Space>v')
    qa.expect(not vim.bo.readonly and vim.bo.modifiable and vim.bo.buftype=='','raw editable file buffer')
    qa.expect(table.concat(api.nvim_buf_get_lines(0,0,-1,false),'\n')==source,'exact source')
    qa.dump('artifact-raw')
    qa.keys('<Space>v')
    qa.wait_for(function() return qa.screen():find('Use strong, soft and code.',1,true) end,5000,'toggle back')
    qa.keys('<Space>v')
    artifacts.open('A-796')
    qa.wait_for(function() return qa.screen():find('Use strong, soft and code.',1,true) end,5000,'reopen rendered')
    qa.expect(vim.bo.readonly and not vim.bo.modifiable,'rendered is always the default')
    qa.keys('<Space>?')
    qa.wait_for(function() return qa.screen():find('␣v in artifact',1,true) end,5000,'toggle in help')
    qa.keys('q')
    qa.keys('<Space>p')
    qa.wait_for(function() return qa.screen():find('palette ›',1,true) end,5000,'palette open')
    qa.keys('>Toggle rendered Markdown')
    qa.wait_for(function() local s=qa.screen(); return s:find('Toggle rendered Markdown and raw source',1,true) and s:find('␣v',1,true) end,5000,'toggle in palette')
    qa.keys('<CR>')
    qa.wait_for(function() return qa.screen():find('# Artifact heading',1,true) and vim.bo.modifiable and not vim.bo.readonly end,5000,'palette executes raw toggle')
    qa.expect(vim.bo.modifiable and not vim.bo.readonly,'palette runs registered toggle')
    qa.expect(#require('cland.actions').audit()==0,'installed mappings audit clear')
  end,
}
