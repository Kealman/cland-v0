-- PROTOTYPE (ticket #11): headless check, found during check f. Which
-- 'scrollback' does a terminal get by default, depending on how and when its
-- buffer was made? (documented default: 10000, maximum 1000000)
--   NVIM_APPNAME=cland-proto nvim --clean --headless -u checks/scrollback-default.lua
local out = {}
local function mk(label, how)
  local b
  if how == ':terminal' then
    vim.cmd('terminal sleep 3')
    b = vim.api.nvim_get_current_buf()
  else
    b = vim.api.nvim_create_buf(true, false)
    vim.api.nvim_set_current_buf(b)
    vim.fn.jobstart({ 'sleep', '3' }, { term = true })
  end
  out[#out + 1] = ('%-52s buffer-local scrollback=%d (global %d)'):format(label, vim.bo[b].scrollback, vim.go.scrollback)
end

mk(':terminal, while sourcing the -u file', ':terminal')
mk('nvim_create_buf + jobstart(term), while sourcing -u', 'api')
vim.api.nvim_create_autocmd('VimEnter', {
  callback = function()
    mk('nvim_create_buf + jobstart(term), in VimEnter', 'api')
    mk(':terminal, in VimEnter', ':terminal')
    vim.defer_fn(function()
      mk('nvim_create_buf + jobstart(term), after startup', 'api')
      mk(':terminal, after startup', ':terminal')
      io.stdout:write(table.concat(out, '\n') .. '\n')
      vim.cmd('qall!')
    end, 300)
  end,
})
