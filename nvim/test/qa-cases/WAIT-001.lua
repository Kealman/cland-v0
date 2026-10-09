-- A case that waits for what never comes: the run is INCONCLUSIVE.
return {
  hub = 'stub',
  run = function(qa)
    qa.keys('<Esc><Space>i')
    qa.wait_for(function()
      return qa.screen():find('a row that never shows', 1, true)
    end, 300, 'a row that never shows')
  end,
}
