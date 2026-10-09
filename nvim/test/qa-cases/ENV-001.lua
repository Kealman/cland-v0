-- What every run is given: the fixed grid, the pinned environment, paths of its own, and no server socket.
return {
  hub = 'stub',
  run = function(qa)
    qa.expect(vim.o.columns == 160 and vim.o.lines == 45, ('the grid is 160×45, not %d×%d'):format(vim.o.columns, vim.o.lines))
    qa.expect(vim.env.TERM == 'xterm-256color', 'TERM is pinned: ' .. tostring(vim.env.TERM))
    qa.expect(vim.env.LANG == 'en_US.UTF-8', 'LANG is pinned: ' .. tostring(vim.env.LANG))
    qa.expect(vim.env.TZ == 'UTC' and os.date('%z') == '+0000', 'TZ is pinned: ' .. tostring(vim.env.TZ) .. ' ' .. os.date('%z'))
    qa.expect(vim.env.NVIM_APPNAME == 'cland-qa', 'the app name is its own: ' .. tostring(vim.env.NVIM_APPNAME))
    qa.expect(vim.v.servername == '' and #vim.fn.serverlist() == 0, 'no server socket: ' .. vim.v.servername)
    local tmp = vim.fs.dirname(qa.root)
    for _, what in ipairs({ 'config', 'data', 'state', 'cache', 'run' }) do
      local path = vim.fn.stdpath(what)
      qa.expect(vim.startswith(path, tmp .. '/'), ('stdpath(%s) is inside the run\'s directory: %s'):format(what, path))
    end
    qa.expect(vim.startswith(vim.env.HOME, tmp .. '/'), 'HOME is inside the run\'s directory: ' .. vim.env.HOME)
    for name in pairs(vim.fn.environ()) do
      qa.expect(not name:match('^CLAND_') or name:match('^CLAND_QA_') or name == 'CLAND_NODE' or name == 'CLAND_STUB_SCENARIO_JSON', 'no CLAND_ variable of the caller: ' .. name)
    end
  end,
}
