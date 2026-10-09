-- A Normal-mode command after a long stretch: with an <Esc> to cut at, `gi` arrives whole and runs
-- (General has no item: the status line says so); qa.keys returns.
return {
  hub = 'stub',
  run = function(qa)
    qa.wait_for(function()
      return qa.state().hub.state == 'connected'
    end, 10000, 'the hub connected')
    qa.keys('<Esc>')
    vim.g.cland_qa_gi = 0
    vim.keymap.set('n', 'gi', function()
      vim.g.cland_qa_gi = vim.g.cland_qa_gi + 1
    end, { buffer = true })
    qa.keys(('h'):rep(4000) .. '<Esc>' .. ('h'):rep(200) .. 'gi')
    qa.expect(vim.g.cland_qa_gi == 1, 'gi ran once after h×4000<Esc>h×200: ' .. vim.g.cland_qa_gi)
    qa.expect(qa.state().mode == 'n', 'Normal mode, nothing pending: ' .. qa.state().mode)
  end,
}
