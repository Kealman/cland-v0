-- More keys in one call than Neovim's input buffer holds: every one is typed, the last ones too.
return {
  hub = 'stub',
  run = function(qa)
    qa.wait_for(function()
      return qa.state().hub.state == 'connected'
    end, 10000, 'the hub connected')
    qa.keys('<Esc><Space>c')
    qa.wait_for(function()
      return qa.state().mode == 'i'
    end, 5000, 'the composer, in Insert mode')
    -- each `y<BS>` cancels itself: a key split between two chunks would leave a `y` or a `<BS>` as text;
    -- an `<Esc>a` every 500 gives `keys` the places to cut the 36,000 bytes at
    local n = 6000
    qa.keys(('xy<BS>'):rep(500) .. ('<Esc>a' .. ('xy<BS>'):rep(500)):rep(n / 500 - 1) .. '<Esc>')
    local line = vim.api.nvim_buf_get_lines(vim.fn.bufnr('cland://composer/general'), 0, 1, false)[1]
    local typed = select(2, line:gsub('x', ''))
    qa.expect(typed == n, ('%d of %d keys reached the composer'):format(typed, n))
    qa.expect(not line:find('[y<>]'), 'every key arrived whole: no y, < or > in the composer')
    qa.expect(qa.state().mode == 'n', 'the <Esc> that ended the keys was taken: the mode is ' .. qa.state().mode)
  end,
}
