-- id: ITEMS-002
-- title: Criteria marks and verified fractions refresh at 80 and 120 columns
-- preconditions: a real fixture hub and Git head, four done criteria with three verified
-- expected: item glyphs and marks, panel and board 3/4 to green 4/4 after a watched file save; stale after a new head
-- since: T-158
-- regression: no
local at = '2026-10-10T10:00Z'
local function body(complete)
  local rows = { '## Acceptance criteria' }
  for i = 1, 4 do
    rows[#rows + 1] = '- [x] C' .. i .. '. Criterion ' .. i
    rows[#rows + 1] = '  - done: impl-2 · ' .. at
    if i < 4 or complete then
      rows[#rows + 1] = '  - verified: qa-2 [qa] · run q-2 · ' .. at
    end
  end
  return table.concat(rows, '\n')
end
return {
  title = 'Criteria marks and verified fractions refresh at 80 and 120 columns',
  hub = 'stdio',
  fixture = { project = 'qa-criteria', config = '[tracker]\nlevels = ["epic"]\n', items = {
    { id = 'T-1', kind = 'epic', title = 'Criteria epic' },
    { id = 'T-2', title = 'Criteria display', status = 'in progress', parent = 'T-1', body = body(false) },
  } },
  run = function(qa)
    local api, layout = vim.api, require('cland.layout')
    qa.wait_for(function() return qa.state().hub.state == 'connected' and #qa.state().items == 2 end, 10000, 'fixture loaded')
    -- The explorer carries summary rows without file paths (T-1007), so find the item file on disk.
    local file = vim.fn.glob(qa.root .. '/.cland/tasks/T-2-*.md')
    qa.expect(file ~= '' and not file:find('\n'), 'T-2 has exactly one item file')
    local function git(args)
      local command = { 'git', '-C', qa.root }
      vim.list_extend(command, args)
      local output = vim.fn.system(command)
      qa.expect(vim.v.shell_error == 0, 'fixture Git command succeeds: ' .. table.concat(args, ' '))
      return vim.trim(output)
    end
    git({ 'init', '-q', '-b', 'dev' })
    git({ 'config', 'user.name', 'Test' })
    git({ 'config', 'user.email', 'test@example.com' })
    git({ 'config', 'commit.gpgsign', 'false' })
    git({ 'commit', '--allow-empty', '-qm', 'Criteria display build' })
    local head = git({ 'rev-parse', 'HEAD' })
    local initial = vim.fn.readfile(file)
    -- The fixture writer can omit status/branch; put both inside frontmatter explicitly.
    local header_end
    for i = 2, #initial do if initial[i] == '---' then header_end = i; break end end
    qa.expect(header_end ~= nil, 'item has frontmatter')
    for i = header_end - 1, 2, -1 do
      if initial[i]:match('^status:') or initial[i]:match('^branch:') then table.remove(initial, i) end
    end
    table.insert(initial, 2, 'status: in progress')
    table.insert(initial, 2, 'branch: dev')
    for i, line in ipairs(initial) do
      if line:match('^  %- verified:') then initial[i] = line .. ' · commit ' .. head end
    end
    local complete = vim.deepcopy(initial)
    for i, line in ipairs(complete) do
      if line == '- [x] C4. Criterion 4' then
        table.insert(complete, i + 2, '  - verified: qa-2 [qa] · run q-2 · ' .. at .. ' · commit ' .. head)
        break
      end
    end
    local function budget(buf)
      local win = vim.fn.bufwinid(buf)
      local lines = api.nvim_buf_get_lines(buf, 0, -1, false)
      for _, line in ipairs(lines) do qa.expect(api.nvim_strwidth(line) <= api.nvim_win_get_width(win), 'rendered row fits the window') end
      for _, mark in ipairs(api.nvim_buf_get_extmarks(buf, -1, 0, -1, {details=true})) do
        if mark[4].end_col then qa.expect(mark[4].end_col <= #lines[mark[2]+1], 'highlight fits its row') end
      end
    end
    local function green(buf)
      local lines = api.nvim_buf_get_lines(buf, 0, -1, false)
      for _, mark in ipairs(api.nvim_buf_get_extmarks(buf, -1, 0, -1, {details=true})) do
        if mark[4].end_col and lines[mark[2]+1]:sub(mark[3]+1,mark[4].end_col) == '4/4' then
          qa.expect(mark[4].hl_group == 'ClandGreen', 'complete fraction is green')
          return
        end
      end
      qa.expect(false, '4/4 has a highlight')
    end
    for _, width in ipairs({80,120}) do
      vim.o.columns, vim.o.lines = width, 45
      vim.fn.writefile(initial, file)
      layout.preset('charting')
      api.nvim_win_set_width(layout.win.left, math.min(60,width-20))
      qa.wait_for(function() return qa.screen():match('T%-2[^\n]*3/4') end, 5000, 'panel reads 3/4 at ' .. width)
      budget(require('cland.panels').buf('items'))
      layout.toggle_left()
      layout.show({kind='item',id='T-2'},{insert=false})
      qa.wait_for(function() return qa.screen():find('◐ C4. Criterion 4',1,true) end, 5000, 'done criterion in the item view')
      local screen = qa.screen()
      qa.expect(screen:find('● C1. Criterion 1',1,true) ~= nil, 'verified criterion glyph')
      qa.expect(screen:find('done: impl-2',1,true) ~= nil and screen:find('verified: qa-2 [QA]',1,true) ~= nil, 'authors and verification marks')
      budget(require('cland.item_view').bufs['T-2'])
      qa.dump('criteria-' .. width .. '-before')
      -- A real watched hand save exercises invalidation even when updated is unchanged.
      vim.fn.writefile(complete, file)
      qa.wait_for(function() return qa.screen():find('● C4. Criterion 4',1,true) end, 5000, 'fourth criterion becomes verified')
      layout.preset('charting')
      api.nvim_win_set_width(layout.win.left, math.min(60,width-20))
      qa.wait_for(function() return qa.screen():match('T%-2[^\n]*4/4') end, 5000, 'panel reads 4/4')
      green(require('cland.panels').buf('items'))
      qa.dump('criteria-' .. width .. '-after')
      layout.preset('steady')
      layout.right_panel('inbox')
      qa.wait_for(function() return qa.screen():find('4/4',1,true) end, 5000, 'board card reads 4/4')
      green(require('cland.board').b)
      budget(require('cland.board').b)
    end
    -- A build move refreshes the board without changing criteria source or timestamps.
    git({ 'commit', '--allow-empty', '-qm', 'New criteria display build' })
    qa.wait_for(function() return qa.screen():find('0/4',1,true) and qa.screen():find('4 stale',1,true) end, 5000, 'new head makes board verification stale')
    budget(require('cland.board').b)
    layout.show({kind='item',id='T-2'},{insert=false})
    qa.wait_for(function() return qa.screen():find('stale verified:',1,true) end, 5000, 'item labels stale verification')
    qa.expect(qa.screen():find('◌ C4. Criterion 4',1,true) ~= nil, 'stale criterion glyph')
    budget(require('cland.item_view').bufs['T-2'])
    qa.dump('criteria-stale')
  end,
}
