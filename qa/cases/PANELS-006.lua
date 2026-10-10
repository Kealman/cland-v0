-- id: PANELS-006
-- title: Corrupt preferences and failed atomic writes leave a usable workbench
-- preconditions: the stub hub and a writable fixture project
-- expected: invalid input gives defaults and one notice; a failed rename preserves the complete old file
-- since: T-125
-- regression: no
return {
  title = 'Corrupt preferences and failed atomic writes leave a usable workbench',
  hub = 'stub',
  fixture = { project = 'qa-panel-failures' },
  run = function(qa)
    qa.wait_for(function() return qa.state().hub.state == 'connected' end, 10000, 'the stub hub connected')
    local state, store = require('cland.state'), require('cland.ui')
    vim.fn.writefile({ '{corrupt' }, qa.root .. '/.cland/ui.json')
    local notices, say = 0, state.say
    state.say = function(text, group) notices = notices + 1; say(text, group) end
    local ok, err = pcall(function()
      store.load(qa.root)
      qa.expect(notices == 1, 'one notice for the corrupt file')
      qa.expect(not state.S.ui.left and state.S.ui.right == 'sessions' and state.S.ui.items_filter == 'board', 'defaults remain usable')
      qa.keys('<Esc>:Cland preset charting<CR>')
      store.changed()
      qa.expect(store.flush(), 'a complete initial file is written')
      local path = qa.root .. '/.cland/ui.json'
      local complete = table.concat(vim.fn.readfile(path), '\n')
      local rename = vim.uv.fs_rename
      vim.uv.fs_rename = function() return nil, 'interrupted before rename' end
      require('cland.items').set_filter('done')
      store.changed()
      local wrote = store.flush()
      vim.uv.fs_rename = rename
      qa.expect(not wrote, 'the interrupted write reports failure')
      qa.expect(table.concat(vim.fn.readfile(path), '\n') == complete, 'the old complete file is unchanged')
    end)
    state.say = say
    if not ok then error(err) end
    qa.dump('panel-failures')
  end,
}
