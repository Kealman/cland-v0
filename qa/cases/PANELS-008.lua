-- id: PANELS-008
-- title: A palette ask option reaches the hub and answered options disappear
-- preconditions: an open ask in the stub hub
-- expected: one option is answered, the inbox clears, the answer is visible in its topic
-- since: T-126
-- regression: no
return {
  title = 'A palette ask option reaches the hub and answered options disappear',
  hub = 'stub',
  fixture = { project='qa-palette-answer' },
  scenario = { inbox={asks={{id='palette-ask', question='Choose a path', options={'Approve nebula', 'Defer nebula'},
    from='coord', ts='2026-10-09T12:00:00Z', topic={id='general',title='General'}}}} },
  run = function(qa)
    qa.wait_for(function() return #qa.state().asks == 1 end, 10000, 'open ask received')
    qa.keys('<Esc><Space>p>Approve nebula')
    qa.wait_for(function() return qa.screen():find('Answer ask General') end, 5000, 'ask action')
    qa.keys('<CR>')
    qa.wait_for(function() return #qa.state().asks == 0 end, 5000, 'hub accepted the option')
    qa.keys(':Cland view thread general<CR>')
    qa.wait_for(function() return qa.screen():find('Approve nebula') end, 5000, 'hub answer in topic history')
    qa.keys('<Esc><Space>p>nebula')
    qa.wait_for(function() return qa.screen():find('(no match)',1,true) end, 5000, 'answered options gone')
    qa.keys('<Esc>')
    qa.dump('palette-answer')
  end,
}
