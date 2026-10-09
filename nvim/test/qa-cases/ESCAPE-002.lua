-- A fixture item whose id is a path: refused before any write.
return {
  fixture = { project = 'qa-escape', items = { { id = '../../T-1', title = 'Escaped' } } },
  run = function() end,
}
