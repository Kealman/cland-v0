-- A fixture whose project name would put its files outside the run's directory: refused before any write.
return {
  fixture = { project = '../live', items = { { id = 'T-1', title = 'Escaped' } } },
  run = function() end,
}
