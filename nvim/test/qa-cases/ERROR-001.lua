-- A case with a Lua error in it: the run is BLOCKED.
return {
  hub = 'stub',
  run = function(qa)
    qa.wait_for(function()
      return qa.screen():find('General', 1, true)
    end, 10000, 'General')
    local missing = nil
    return missing.field
  end,
}
