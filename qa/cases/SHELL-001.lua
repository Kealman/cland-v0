-- id: SHELL-001
-- title: General shows and a message goes queued
-- preconditions: a fixture project with no items and no messages; the stdio hub
-- expected: the empty General thread shows with the hub connected; a message typed in the composer shows in the thread as queued
-- since: T-57
-- regression: no
return {
  title = 'General shows and a message goes queued',
  fixture = { project = 'qa-shell' },
  run = function(qa)
    qa.wait_for(function()
      return qa.state().hub.state == 'connected' and qa.screen():find('No messages in General yet.', 1, true)
    end, 10000, 'the empty General thread, connected')
    local view = qa.state().view
    qa.expect(view.kind == 'thread' and view.id == 'general', 'the centre view is General')
    qa.expect(qa.screen():find('General', 1, true), 'the top bar names General')

    qa.keys('hello from qa<CR>')
    qa.wait_for(function()
      return qa.screen():find('⌁ queued', 1, true)
    end, 5000, 'the message, queued')
    qa.expect(qa.screen():find('hello from qa', 1, true), 'the message text is in the thread')
  end,
}
