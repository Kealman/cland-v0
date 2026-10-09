-- A long sequence is cut only right after <Esc> or <CR>: wherever that falls, the mapping after it, in
-- Normal mode, runs whole.
return {
  hub = 'stub',
  run = function(qa)
    qa.wait_for(function()
      return qa.state().hub.state == 'connected'
    end, 10000, 'the hub connected')
    local function left()
      return qa.state().panels.left
    end
    local composer = vim.fn.bufnr('cland://composer/general')
    -- rev-6's input: 4084 characters, then <Esc><Space>i, over 4 KiB in all
    qa.keys('<Esc><Space>c')
    qa.keys(('x'):rep(4084) .. '<Esc><Space>i')
    qa.expect(left() == true, 'x×4084 then <Esc><Space>i opened the items panel')
    -- the cut after the first <Esc> falls at every distance from the 4 KiB limit; the mapping after it and
    -- the one after the next text run whole
    for n = 4060, 4091 do
      vim.api.nvim_buf_set_lines(composer, 0, -1, false, {})
      local before = left()
      qa.keys('<Space>c')
      qa.keys(('x'):rep(n) .. '<Esc><Space>i<Space>c' .. ('y'):rep(50) .. '<Esc>')
      qa.expect(left() ~= before, ('x×%d then <Esc><Space>i toggled the items panel'):format(n))
      qa.expect(qa.state().mode == 'n', ('x×%d: the last <Esc> was taken, the mode is %s'):format(n, qa.state().mode))
      local text = table.concat(vim.api.nvim_buf_get_lines(composer, 0, -1, false), '\n')
      qa.expect(not text:find('[<>]') and select(2, text:gsub('y', '')) == 50, ('x×%d: the keys after the cut arrived as keys'):format(n))
    end
  end,
}
