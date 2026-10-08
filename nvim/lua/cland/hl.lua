-- cland's highlight groups, with the design's colours (docs/design/main-screen/README.md). Defined as
-- defaults, so the shell (#25) or a colourscheme can take them over.
local M = {}

local GROUPS = {
  ClandText = { fg = '#d6dbe4' },
  ClandDim = { fg = '#8a94a3' },
  ClandFaint = { fg = '#5a6370' },
  ClandBold = { bold = true },
  ClandAmber = { fg = '#f0b429' },
  ClandTeal = { fg = '#35c4a0' },
  ClandGreen = { fg = '#7ddc8a' },
  ClandRed = { fg = '#ff7b72' },
  ClandMine = { bg = '#141a23' },
}

function M.setup()
  for name, spec in pairs(GROUPS) do
    vim.api.nvim_set_hl(0, name, vim.tbl_extend('force', spec, { default = true }))
  end
end

--- The delivery stage of a human message (spec 4.2) as a glyph, a word and a colour.
M.STAGE = {
  queued = { '⌁', 'queued', 'ClandAmber' },
  delivered = { '✓', 'delivered', 'ClandDim' },
  injected = { '✓✓', 'injected', 'ClandTeal' },
  dropped = { '✗', 'dropped', 'ClandRed' },
}

--- How far a stage is along, so an older snapshot never moves a message back.
M.STAGE_RANK = { queued = 1, delivered = 2, dropped = 2, injected = 3 }

return M
