return {
  run = function(qa)
    qa.wait_for(function()
      return qa.state().hub.state == 'connected'
    end, 10000, 'the owned fixture hub connected')
    local receipts = qa.wait_for(function()
      local paths = vim.fn.glob(qa.root .. '/.fixture-sockets/owners/*.json', false, true)
      return #paths > 0 and paths or nil
    end, 5000, 'a persisted fixture owner receipt')
    for _, path in ipairs(receipts) do
      local value = vim.json.decode(table.concat(vim.fn.readfile(path), '\n'))
      qa.expect(value.version == 1 and value.pid > 0, 'the receipt identifies its live fixture owner')
      qa.expect(#value.roots == 1 and value.roots[1] == qa.root, 'only the allocated project is disposable')
      qa.expect(value.sourceCheckout ~= qa.root, 'source association stays separate')
    end
  end,
}
