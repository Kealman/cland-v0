-- cland's Neovim entry point (spec 4.1, ADR 0005). Started by `nvim/bin/cland-nvim` as
--   NVIM_APPNAME=cland nvim --clean -u nvim/init.lua
-- in that order, so nothing from the user's own configuration loads: only the bundled runtime and the
-- files under nvim/. CLAND_ROOT names the project (default: the current directory); CLAND_HUB_TRANSPORT
-- is `socket` (the project's hub over `.cland/hub.json`, the default) or `stdio` (a hub spawned as a child).
-- CLAND_COMMAND (a JSON array) replaces the `cland` command the client runs; CLAND_RESTORE=1 reads a
-- restart snapshot without a `:restart` (the tests use both).
local here = vim.fn.fnamemodify(debug.getinfo(1, 'S').source:sub(2), ':p:h')
vim.opt.runtimepath:prepend(here)

-- The ADR 0005 mitigations ------------------------------------------------------------------------

-- Shift+Enter reaches a harness as plain Enter unless the harness enables the kitty keyboard mode:
-- terminal mode sends the kitty CSI-u sequence for it instead.
vim.keymap.set('t', '<S-CR>', function()
  local job = vim.b.terminal_job_id
  if job then
    vim.api.nvim_chan_send(job, '\27[13;2u')
  end
end, { desc = 'cland: Shift+Enter to the terminal job as CSI-u (ESC[13;2u)' })
-- Pastes into terminals keep their TABs.
vim.o.termpastefilter = 'BS,ESC,DEL'
-- Terminals created at startup would get a 1,000,000-line cap, 33 times slower under heavy output.
vim.o.scrollback = 10000
-- No hit-enter prompt: one command line, short messages, and cland's own notices live in its buffers
-- (one line each), never in the message area. UI updates from the hub go through vim.schedule.
vim.o.cmdheight = 1
vim.opt.shortmess:append('aIcCFsWS')
vim.o.showmode = false

-- :restart saves a Vim session and sources it in the new instance; cland rebuilds its shell over it
-- (SessionLoadPost) and re-attaches the session terminals itself, so the session file carries nothing
-- but the directory: no terminal is re-run from it.
vim.o.sessionoptions = 'curdir'

-- The shell (lua/cland/): the top bar is the tabline, the status line is global, each window's winbar
-- is its panel header. Space is the leader.
vim.g.mapleader = ' '
vim.o.termguicolors = true
vim.o.number = false
vim.o.signcolumn = 'no'
vim.o.splitbelow = true
vim.o.splitright = true
vim.o.laststatus = 3
vim.o.showtabline = 2
vim.o.mouse = 'a'
vim.o.timeoutlen = 600
vim.o.fillchars = 'eob: ,vert:│,horiz:─'

vim.api.nvim_create_autocmd('VimEnter', {
  once = true,
  callback = function()
    require('cland').start({ root = vim.env.CLAND_ROOT, transport = vim.env.CLAND_HUB_TRANSPORT, restore = vim.env.CLAND_RESTORE == '1' })
  end,
})
