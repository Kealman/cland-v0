-- PROTOTYPE, throwaway: wayfinder ticket #11 "Neovim as host versus Neovim as
-- embedded component". Never merge. Started by run.sh as
--   NVIM_APPNAME=cland-proto nvim --clean -u <this file>
-- A fake chat (topics, thread, composer) next to real terminal sessions.
-- <Space>? inside lists the keys.
local here = vim.fn.fnamemodify(debug.getinfo(1, 'S').source:sub(2), ':p:h')
vim.opt.runtimepath:prepend(here)
vim.env.CLAND_PROTO_DIR = here
vim.env.PATH = here .. '/bin:' .. vim.env.PATH -- keylog, winch, tui-sim stand-ins

vim.g.mapleader = ' '
vim.o.laststatus = 3
vim.o.showtabline = 0
vim.o.mouse = 'a'
vim.o.splitbelow = true
vim.o.splitright = true
vim.o.number = false
vim.o.signcolumn = 'no'
vim.o.timeoutlen = 800
vim.o.shortmess = vim.o.shortmess .. 'I'

require('cland_proto.probe').setup(here)
require('cland_proto.app').setup(here)
