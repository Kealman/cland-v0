-- PROTOTYPE (ticket #11): the keymap from neovim#40915. Opens a float that
-- covers the whole editor with border = "none" and closes it within the same
-- mapping, so Neovim never redraws in between.
vim.keymap.set('n', '<leader>k', function()
  local buf = vim.api.nvim_create_buf(false, true)
  local win = vim.api.nvim_open_win(buf, false, {
    relative = 'editor',
    width = vim.go.columns,
    height = vim.go.lines,
    row = 0,
    col = 0,
    border = 'none',
  })
  vim.api.nvim_win_close(win, true)
end, { desc = 'neovim#40915 repro' })
