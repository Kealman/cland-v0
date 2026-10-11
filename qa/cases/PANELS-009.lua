-- id: PANELS-009
-- title: Sessions group by hub state and stopped sessions unfold with za
-- preconditions: waiting, busy, idle, unknown and stopped sessions on the stub hub
-- expected: counts match the hub; stopped sessions are hidden until unfolded
-- since: T-127
-- regression: no
local function session(name, state, status)
  return { name=name, sessionId=name..'-id', harness='codex', role='reviewer',
    model='qa-model', state=state, status=status or 'running' }
end
return {
  title = 'Sessions group by hub state and stopped sessions unfold with za',
  hub = 'stub',
  fixture = { project='qa-session-groups' },
  scenario = { processes={session('waiter','waiting for human'), session('worker','busy'),
    session('resting','idle'), session('uncertain','unknown'), session('old-session','unknown','stopped')} },
  run = function(qa)
    qa.wait_for(function()
      local s=qa.screen()
      return s:find('WAITING · 1',1,true) and s:find('BUSY · 1',1,true) and s:find('IDLE · 2',1,true)
    end, 10000, 'state groups')
    qa.expect(qa.screen():match('sessions +2 +1▲') ~= nil, 'busy and waiting count as now; idle and unknown stay watch')
    qa.expect(not qa.screen():find('old-session [Reviewer]',1,true), 'stopped session is folded')
    qa.keys('<Esc><Space>s<Space>s/more (<CR>za')
    qa.wait_for(function() return qa.screen():find('old-session [Reviewer]',1,true) end, 5000, 'stopped unfolds')
    qa.keys('za')
    qa.wait_for(function() return not qa.screen():find('old-session [Reviewer]',1,true) end, 5000, 'stopped folds')
    qa.expect(#require('cland.actions').audit()==0, 'fold and panel keys are registered')
    qa.dump('session-groups')
  end,
}
