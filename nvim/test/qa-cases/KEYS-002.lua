-- A mapping is never split between two of the chunks `keys` sends: wherever a long sequence falls, a
-- leader mapping before the boundary, after it, or across it still runs.
return {
  hub = 'stub',
  run = function(qa)
    qa.wait_for(function()
      return qa.state().hub.state == 'connected'
    end, 10000, 'the hub connected')
    local function left()
      return qa.state().panels.left
    end
    -- rev-6's input: 4084 characters, then <Esc><Space>i, across the first 4 KiB
    qa.keys('<Esc><Space>c')
    qa.keys(('x'):rep(4084) .. '<Esc><Space>i')
    qa.expect(left() == true, 'x×4084 then <Esc><Space>i opened the items panel')
    local composer = vim.fn.bufnr('cland://composer/general')
    -- text of every length around the first two chunk boundaries, with a mapping after it and one before
    -- the next text
    for _, size in ipairs({ 4096, 8192 }) do
      for n = size - 10, size + 2 do
        -- an empty composer each time: a line that only grows makes each key slower
        vim.api.nvim_buf_set_lines(composer, 0, -1, false, {})
        local before = left()
        qa.keys('<Space>c' .. ('x'):rep(n) .. '<Esc><Space>i<Space>c' .. ('y'):rep(n) .. '<Esc>')
        qa.expect(left() ~= before, ('x×%d then <Esc><Space>i toggled the items panel'):format(n))
        qa.expect(qa.state().mode == 'n', ('x×%d: the last <Esc> was taken, the mode is %s'):format(n, qa.state().mode))
        local text = table.concat(vim.api.nvim_buf_get_lines(composer, 0, -1, false), '\n')
        qa.expect(not text:find('[<>]'), ('x×%d: no key notation was typed as text'):format(n))
      end
    end
  end,
}
