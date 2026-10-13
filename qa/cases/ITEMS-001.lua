-- id: ITEMS-001
-- title: A fixture item shows in the items panel and in its view
-- preconditions: a fixture project with the epic E-1 and its child T-2; the stdio hub
-- expected: T-2 is listed in the items panel under E-1; Enter on its row opens its view
-- since: T-57
-- regression: no
return {
  title = 'A fixture item shows in the items panel and in its view',
  fixture = {
    project = 'qa-items',
    config = '[tracker]\nlevels = ["epic"]\n',
    items = {
      { id = 'E-1', kind = 'epic', title = 'Workbench shell' },
      {
        id = 'T-2',
        status = 'backlog',
        title = 'Items panel',
        parent = 'E-1',
        labels = { 'ui' },
        body = 'The tree of items, each under its parent.',
        comments = { { author = 'impl-1', text = 'Ready for review.' } },
      },
    },
  },
  scenario = { tracker = {levels={'epic'}} },
  run = function(qa)
    qa.wait_for(function()
      return qa.state().hub.state == 'connected' and #qa.state().items == 2
    end, 10000, 'the hub connected and the two fixture items known')

    qa.keys('<Esc><Space>i/backlog (<CR>za')
    vim.api.nvim_win_set_width(require('cland.layout').win.left,60)
    qa.keys('<Esc>')
    qa.wait_for(function()
      return qa.screen():find('T-2 E-1 › Items panel', 1, true)
    end, 5000, 'T-2 in the items panel')
    local screen = qa.screen()
    qa.expect(screen:find('E-1 Workbench shell', 1, true), 'the parent E-1 is in the panel')
    qa.expect(screen:find('0/1', 1, true), 'the epic shows its children done: 0/1')
    qa.expect(qa.state().panels.left == true, 'the state says the items panel is open')

    -- to the row of T-2 with a search, as a human would, then Enter on it
    qa.keys('/T-2<CR>')
    qa.keys('<CR>')
    qa.wait_for(function()
      local view = qa.state().view
      return view.kind == 'item' and view.id == 'T-2' and qa.screen():find('The tree of items, each under its parent.', 1, true)
    end, 5000, 'the item view of T-2 with its body')
    screen = qa.screen()
    qa.expect(screen:find('Ready for review.', 1, true), 'the comment is in the item view')
    qa.expect(screen:find('E-1', 1, true) and screen:find('ui', 1, true), 'the fields column names the parent and the label')
  end,
}
