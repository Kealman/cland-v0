-- id: PANELS-016
-- title: Aides stay in yours above crew state groups
-- preconditions: busy, waiting, idle, manual and stopped Aides beside crew sessions
-- expected: live Aides group by role, stopped Aides fold, state counts include Aides
-- since: T-150
-- regression: no
local function session(name,role,state,status)
  return {name=name,sessionId=name..'-id',harness='codex',role=role,
    model='qa-model',state=state,status=status or 'running'}
end
return {
  title='Aides stay in yours above crew state groups', hub='stub',
  fixture={project='qa-aide-groups'},
  scenario={processes={session('planner','aide','busy'),session('aide-2','aide','waiting for approval'),
    session('aide-3','aide','idle'),session('former','aide','unknown','stopped'),
    session('aide-review','reviewer','idle'),session('worker','implementer','busy')},
    presence={{name='manual',role='aide',state='idle'}},
    attach={planner="printf 'attached planner\\n'; sleep 600"}},
  run=function(qa)
    qa.wait_for(function() return #qa.state().sessions==7 end,10000,'all sessions received')
    qa.keys('<Esc><C-l>')
    local screen=qa.wait_for(function()
      local s=qa.screen()
      return s:find('YOURS · 4',1,true) and s:find('BUSY · 1',1,true) and s:find('IDLE · 1',1,true) and s
    end,5000,'Aides above crew groups')
    local yours=screen:find('YOURS · 4',1,true)
    local waiting=screen:find('WAITING · 0',1,true)
    qa.expect(yours and waiting and yours<waiting,'yours is first; waiting Aide stays in yours')
    qa.expect(screen:find('planner [Aide]',1,true) and screen:find('manual [Aide]',1,true),'role identifies Aides with any name')
    qa.expect(screen:find('aide-review [Reviewer]',1,true),'a name prefix does not confer the Aide role')
    qa.expect(screen:match('sessions +6 +1▲')~=nil,'live and waiting counts include Aides')
    qa.expect(not screen:find('former [Aide]',1,true),'stopped Aide is folded')
    qa.keys('/stopped (<CR>za')
    qa.wait_for(function() return qa.screen():find('former [Aide]',1,true) end,5000,'stopped Aide unfolds')
    qa.keys('/planner<CR><CR>')
    qa.wait_for(function() return qa.state().view.id=='planner' and qa.screen():find('attached planner',1,true) end,5000,'existing Aide attaches with Enter')
    qa.dump('aide-groups')
  end,
}
