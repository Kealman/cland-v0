-- A case that never hands control back: the run's own timeout ends it, BLOCKED.
return {
  hub = 'stub',
  run = function()
    while true do
    end
  end,
}
