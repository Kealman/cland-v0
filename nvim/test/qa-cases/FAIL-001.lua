-- A case whose expectation does not hold: the run is FAIL with the expectation's message.
return {
  hub = 'stub',
  run = function(qa)
    qa.wait_for(function()
      return qa.state().hub.state == 'connected' and qa.screen():find('No messages in General yet.', 1, true)
    end, 10000, 'General')
    qa.expect(qa.screen():find('a board nobody opened', 1, true), 'the board is on screen')
  end,
}
