-- PROTOTYPE (ticket #11): headless repro, found during check a. A terminal
-- whose window is one row high keeps no scrollback: every line that scrolls
-- off is lost. Two rows or more work.
--   NVIM_APPNAME=cland-proto nvim --clean --headless -u checks/one-row-scrollback.lua
local out = {}

local function run(label, start_h, later_h, script)
  vim.cmd('silent only')
  vim.cmd('enew')
  local other = vim.api.nvim_get_current_win()
  vim.cmd('split')
  local twin = vim.api.nvim_get_current_win()
  vim.api.nvim_win_set_height(twin, start_h)
  local buf = vim.api.nvim_create_buf(true, false)
  vim.api.nvim_win_set_buf(twin, buf)
  vim.fn.jobstart({ 'sh', '-c', script }, { term = true })
  vim.wait(400)
  if later_h then
    vim.api.nvim_win_set_height(twin, later_h)
  end
  vim.wait(2500)
  out[#out + 1] = ('%-22s window height %d -> %-3s buffer lines: %s'):format(label, start_h, tostring(later_h or '-'),
    vim.inspect(vim.api.nvim_buf_get_lines(buf, 0, -1, false)))
  pcall(vim.cmd, 'bwipe! ' .. buf)
  vim.api.nvim_set_current_win(other)
end

local s = 'echo start; sleep 1; echo after1; echo after2; echo after3; sleep 3'
run('A 5 rows', 5, nil, s)
run('B 1 row', 1, nil, s)
run('C 5 rows, then 1', 5, 1, s)
run('D 5 rows, then 2', 5, 2, s)
run('E 5 rows, then 3', 5, 3, s)
run('F 1 row, seq 1 8', 1, nil, 'seq 1 8; sleep 3')
run('G 2 rows, seq 1 8', 2, nil, 'seq 1 8; sleep 3')
io.stdout:write(table.concat(out, '\n') .. '\n')
vim.cmd('qall!')
