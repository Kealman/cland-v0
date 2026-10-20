-- id: ARTIFACT-002
-- title: Folder child and palette split render Markdown
-- preconditions: owned folder and note files in the disposable stub project
-- expected: folder child renders; palette split renders beside the centre and toggles independently
-- since: T-1005
-- regression: no
return {
  title = 'Folder child and palette split render Markdown',
  hub = 'stub', fixture = {project = 'qa-artifact-openers'}, scenario = {inbox = {}},
  run = function(qa)
    qa.wait_for(function() return qa.screen():find('hub: connected',1,true) end,10000,'connected')
    qa.wait_for(function()
      local c=require('cland').client
      if #require('cland.state').S.roles==0 or c.inbox_waiters then return false end
      for journal in pairs(c.snapshots) do if journal.request.type=='artifact.list' then return false end end
      return true
    end,5000,'initial artifact snapshot installed')
    qa.keys('<Esc>')
    local api, artifacts = vim.api, require('cland.artifacts')
    local folder=vim.fn.getcwd()..'/folder'
    vim.fn.mkdir(folder,'p')
    vim.fn.writefile({'# Folder entry','Use **entry** text.'},folder..'/index.md','b')
    vim.fn.writefile({'# Child ideas','Use **child** text.'},folder..'/ideas.md','b')
    local note=vim.fn.getcwd()..'/split.md'
    vim.fn.writefile({'# Split heading','Use **split** text.'},note,'b')
    -- These are scripted client inputs; no hub or persistence rules are simulated.
    artifacts.entries={
      {id='A-1005',kind='file',creator='human',creatorKind='human',status='shared',title='Folder notes',topic='general',path=folder,folder=true,entry='index.md'},
      {id='A-1006',kind='note',creator='human',creatorKind='human',status='shared',title='Split note',topic='general',path=note},
    }
    local browser=require('cland.artifact_browser')
    browser.open['A-1005']=true
    browser.files['A-1005']={'index.md','ideas.md'}
    require('cland.layout').show({kind='artifacts',id='general'},{insert=false})
    local function select(text)
      for r,l in ipairs(api.nvim_buf_get_lines(0,0,-1,false)) do
        if vim.trim(l)==text then api.nvim_win_set_cursor(0,{r,0}); return end
      end
      error('browser row missing: '..text)
    end
    qa.wait_for(function() return qa.screen():find('ideas.md',1,true) end,5000,'folder browser')
    select('ideas.md'); qa.keys('<CR>')
    qa.wait_for(function() local s=qa.screen(); return s:find('Use child text.',1,true) and not s:find('# Child ideas',1,true) end,5000,'folder child rendered')
    qa.dump('folder-child-rendered')
    local centre=require('cland.layout').centre()
    qa.keys('<Space>a')
    qa.wait_for(function() return qa.screen():find('palette ›',1,true) end,5000,'artifact palette')
    qa.keys('Split note<C-v>')
    qa.wait_for(function()
      local s=qa.screen()
      return not s:find('palette ›',1,true) and s:find('Use split text.',1,true) and s:find('Use child text.',1,true)
    end,5000,'both rendered views on the grid')
    local split=api.nvim_get_current_win()
    qa.expect(split~=centre,'palette opened a separate window')
    qa.expect(vim.b.cland_rendered and vim.bo.readonly and not vim.bo.modifiable,'split is rendered read-only')
    qa.expect(vim.b[api.nvim_win_get_buf(centre)].cland_rendered,'centre retains rendered child')
    qa.dump('folder-and-split-rendered')
    qa.keys('<Space>v')
    qa.wait_for(function() local s=qa.screen(); return s:find('# Split heading',1,true) and s:find('Use child text.',1,true) end,5000,'split raw and centre rendered')
    qa.expect(vim.bo.modifiable and not vim.bo.readonly,'split raw is editable')
    qa.expect(vim.b[api.nvim_win_get_buf(centre)].cland_rendered,'split toggle leaves centre rendered')
    qa.keys('<Space>v')
    qa.wait_for(function() local s=qa.screen(); return s:find('Use split text.',1,true) and not s:find('# Split heading',1,true) end,5000,'split rendered again')
    qa.expect(#require('cland.actions').audit()==0,'mappings remain registered')
  end,
}
