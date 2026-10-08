-- PROTOTYPE, throwaway: wayfinder ticket #15 "Prototype: the chat screen
-- with topics", second round: the workbench of the approved design canvas
-- (one shell, toggleable panels), built on the chat-screen prototype and
-- the engine prototype of ticket #11. Never merge.
-- Started by run.sh as
--   NVIM_APPNAME=cland-proto nvim --clean -u <this file>
-- <Space>? lists the keys, :ClandState shows the fake state, :ClandLayout
-- charting|watch|steady arranges the panels like the three stage artboards
-- (CLAND_LAYOUT=watch run.sh starts with one).
local here = vim.fn.fnamemodify(debug.getinfo(1, 'S').source:sub(2), ':p:h')
vim.opt.runtimepath:prepend(here)
vim.env.CLAND_PROTO_DIR = here
vim.env.PATH = here .. '/bin:' .. vim.env.PATH -- fake-harness and the #11 stand-ins

vim.g.mapleader = ' '
vim.o.laststatus = 3
vim.o.mouse = 'a'
vim.o.splitbelow = true
vim.o.splitright = true
vim.o.equalalways = false -- panels keep the widths the design asks for
vim.o.number = false
vim.o.signcolumn = 'no'
vim.o.timeoutlen = 800
vim.o.shortmess = vim.o.shortmess .. 'IF'
vim.o.showmode = false
vim.o.ruler = false
vim.o.showcmd = false
vim.o.fillchars = 'eob: ,vert:│,horiz:─'
vim.o.termguicolors = true
vim.o.scrollback = 10000 -- the #11 finding: never the 1,000,000 default

require('cland_proto.probe').setup(here)
require('cland_proto.app').setup(here)
