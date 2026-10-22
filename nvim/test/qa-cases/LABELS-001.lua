-- Fixture values YAML would read as structure: the items are the same under either hub.
return {
  fixture = {
    project = 'qa-labels',
    items = {
      {
        id = 'T-1',
        title = 'Labels: "quoted", with a comma [and brackets] # and a hash',
        labels = { 'priority, high', 'ui: shell' },
        assignee = 'impl-1',
        branch = 't/1-labels',
        body = 'A body.\n\n---\n\nWith a rule in it.',
        comments = { { author = 'rev-1', text = 'A comment: with a colon.' } },
      },
      { id = 'Q-2', title = 'Blocked', blocked_by = { 'T-1' }, parent = 'T-1', state = 'closed', kind = 'question' },
    },
  },
  run = function(qa)
    -- Startup loads open summaries. Q-2 belongs to T-1's closed-child page,
    -- rather than the root archive, even though T-1 is a leaf task.
    qa.keys('<Esc><Space>e')
    qa.wait_for(function()
      for _, item in ipairs(qa.state().items) do
        if item.id == 'T-1' then return true end
      end
    end, 10000, 'the open fixture task')
    require('cland.explorer').set_open('T-1', true)
    qa.wait_for(function()
      for _, item in ipairs(qa.state().items) do
        if item.id == 'Q-2' then return true end
      end
    end, 10000, 'the closed fixture question from its parent page')
    qa.keys('<Esc>:Cland view item T-1<CR>')
    qa.wait_for(function()
      return qa.screen():find('A comment: with a colon.', 1, true)
    end, 5000, 'the item view of T-1 with its comment')
  end,
}
