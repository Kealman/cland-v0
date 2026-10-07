-- PROTOTYPE, throwaway: wayfinder ticket #15 "Prototype: the chat screen with
-- topics", built on the engine prototype of ticket #11. Never merge.
-- Started by run.sh as
--   NVIM_APPNAME=cland-proto nvim --clean -u <this file>
-- Four layouts of the main screen over one fake, in-memory state:
-- <Space>v cycles them, :ClandVariant <name> jumps, <Space>? lists the keys,
-- :ClandState shows the state. CLAND_VARIANT=inbox|session|tabs picks the first.
local here = vim.fn.fnamemodify(debug.getinfo(1, 'S').source:sub(2), ':p:h')
vim.opt.runtimepath:prepend(here)
vim.env.CLAND_PROTO_DIR = here
vim.env.PATH = here .. '/bin:' .. vim.env.PATH -- fake-harness and the #11 stand-ins

vim.g.mapleader = ' '
vim.o.laststatus = 3
vim.o.showtabline = 0
vim.o.mouse = 'a'
vim.o.splitbelow = true
vim.o.splitright = true
vim.o.number = false
vim.o.signcolumn = 'no'
vim.o.timeoutlen = 800
vim.o.shortmess = vim.o.shortmess .. 'IF'
vim.o.showmode = false
vim.o.ruler = false
vim.o.fillchars = 'eob: ,vert:│,horiz:─'
vim.o.termguicolors = true
vim.o.scrollback = 10000 -- the #11 finding: never the 1,000,000 default

require('cland_proto.probe').setup(here)
require('cland_proto.app').setup(here)
