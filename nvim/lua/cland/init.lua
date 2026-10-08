-- cland in Neovim: connects to the project's hub and shows the General topic (#23). The shell around it,
-- panels and the other topics come with #25 and later.
local M = {}

local hub = require('cland.hub')
local topic_view = require('cland.topic_view')

M.GENERAL = { id = 'general', title = 'General' }

--- nvim/ (this file is nvim/lua/cland/init.lua) and the repository around it.
local function dirs()
  local this = debug.getinfo(1, 'S').source:sub(2)
  local nvim_dir = vim.fn.fnamemodify(this, ':p:h:h:h')
  return nvim_dir, vim.fn.fnamemodify(nvim_dir, ':h')
end

--- opts: root (a directory inside the project; default the cwd), transport ('socket' | 'stdio').
function M.start(opts)
  opts = opts or {}
  require('cland.hl').setup()
  local start = opts.root and opts.root ~= '' and opts.root or vim.fn.getcwd()
  -- the project root as the hub finds it: the nearest ancestor holding .git or .cland
  local root = vim.fs.root(start, { '.git', '.cland' }) or vim.fn.fnamemodify(start, ':p'):gsub('/$', '')
  local _, repo = dirs()
  local cli = opts.cli or { vim.env.CLAND_NODE or 'node', repo .. '/hub/bin/cland.ts' }
  local transport = opts.transport and opts.transport ~= '' and opts.transport or 'socket'

  M.root = root
  M.client = hub.new({ root = root, transport = transport, cli = cli })
  M.general = topic_view.new(M.client, M.GENERAL)
  topic_view.show(M.general)
  vim.api.nvim_create_autocmd('VimLeavePre', {
    callback = function()
      M.client:stop()
    end,
  })
  M.client:start()
  return M
end

return M
