-- id: PANELS-010
-- title: Only the selected session expands, including its pending approval command
-- preconditions: a pending approval command and usage supplied by the stub hub
-- expected: selecting a session expands its metadata; changing selection collapses the old details
-- since: T-127
-- regression: no
return {
  title = 'Only the selected session expands, including its pending approval command',
  hub = 'stub',
  fixture = { project='qa-session-details' },
  scenario = { processes={
    {name='review-session',sessionId='review-id',harness='codex',role='reviewer',model='review-model',
      status='running',state='waiting for approval',approvalCommand='npm test',usage={total={cost=2.4}}},
    {name='idle-session',sessionId='idle-id',harness='claude-code',role='implementer',model='idle-model',
      status='running',state='idle',usage={total={totalTokens=12300}}},
  } },
  run = function(qa)
    qa.wait_for(function() return qa.screen():find('WAITING · 1',1,true) end, 10000, 'hub sessions')
    qa.keys('<Esc><Space>s<Space>s/review-session<CR>')
    qa.wait_for(function()
      local s=qa.screen()
      return s:find('review-model',1,true) and s:find('waiting for approval',1,true)
        and s:find('run: npm test',1,true) and s:find('$2.40',1,true)
    end, 5000, 'approval details')
    qa.expect(not qa.screen():find('idle-model',1,true), 'unselected details stay collapsed')
    qa.dump('approval-details')
    qa.keys('/idle-session<CR>')
    qa.wait_for(function() return qa.screen():find('idle-model',1,true) and qa.screen():find('12.3k tok',1,true) end, 5000, 'idle details')
    qa.expect(not qa.screen():find('run: npm test',1,true), 'previous details collapse')
    qa.dump('idle-details')
  end,
}
