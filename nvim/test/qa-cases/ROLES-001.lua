-- The fixture's roles.toml and config.toml are the stdio hub's: the launcher's defaults come from them.
return {
  fixture = {
    project = 'qa-roles',
    roles = table.concat({
      '[coordinator]',
      'exclusive = true',
      'clause = "You coordinate the fixture."',
      '',
      '[coordinator.launch]',
      'harness = "codex"',
      'model = "qa-model"',
      'effort = "low"',
      '',
    }, '\n'),
    config = '[project]\nname = "qa-roles"\n',
  },
  run = function(qa)
    local roles = qa.wait_for(function()
      local known = qa.state().roles
      return #known > 0 and known
    end, 10000, 'the roles from the hub')
    local coordinator
    for _, role in ipairs(roles) do
      if role.role == 'coordinator' then
        coordinator = role
      end
    end
    qa.expect(coordinator and coordinator.launch.model == 'qa-model', "the Coordinator's launch model is the fixture's")
    -- the launcher fills its fields from the role's defaults
    qa.keys('<Esc><Space>l')
    qa.keys('coord<Tab>coordinator<Tab>')
    qa.wait_for(function()
      return qa.screen():find('qa-model', 1, true)
    end, 5000, "the launcher showing the fixture's model")
  end,
}
