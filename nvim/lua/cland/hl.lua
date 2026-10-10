-- cland's colours and glyphs (docs/design/main-screen/README.md, spec section 5): a dark ground; amber for
-- what needs the human, teal for in progress and agent activity, green for done, red for died and not
-- clear, blue for links and selection. Monospace glyphs, no emoji.
--
-- A `%#Group#` in the tabline, a status line or a winbar does not take the bar's background, so every
-- fg-only group used in a bar has a `<name>Bar` twin (the bar's background) and a `<name>Chip` twin (a
-- top-bar chip's background).
local api = vim.api

local M = {}

M.P = {
  bg = '#0b0e14', panel = '#10141b', bar = '#10141b', composer = '#0d1117', mine = '#141a23',
  border = '#222a35', chip = '#1a212c', chipb = '#2a3340', sel = '#182131', keyon = '#1b2a3f', term = '#07090d',
  text = '#d6dbe4', dim = '#8a94a3', faint = '#5a6370', ink = '#1a1400',
  violet = '#bc8cff', pink = '#f778ba', sky = '#56d4dd',
  amber = '#f0b429', teal = '#35c4a0', green = '#7ddc8a', red = '#ff7b72', blue = '#6aa5ff', bluel = '#9cc3ff',
}

local TWINS = { 'ClandText', 'ClandBold', 'ClandDim', 'ClandFaint', 'ClandAmber', 'ClandTeal', 'ClandGreen', 'ClandRed', 'ClandBlue' }

function M.setup()
  local P = M.P
  local function set(name, val)
    api.nvim_set_hl(0, name, val)
  end
  set('Normal', { fg = P.text, bg = P.bg })
  set('NormalNC', { fg = P.text, bg = P.bg })
  set('NormalFloat', { fg = P.text, bg = P.panel })
  set('FloatBorder', { fg = P.chipb, bg = P.panel })
  set('FloatTitle', { fg = P.text, bg = P.panel, bold = true })
  set('FloatFooter', { fg = P.dim, bg = P.panel })
  set('EndOfBuffer', { fg = P.bg, bg = P.bg })
  set('WinSeparator', { fg = P.border, bg = P.bg })
  set('CursorLine', { bg = P.sel })
  set('Visual', { bg = '#264f78' })
  set('StatusLine', { fg = P.dim, bg = P.bar })
  set('StatusLineNC', { fg = P.dim, bg = P.bar })
  set('TabLine', { fg = P.dim, bg = P.bar })
  set('TabLineFill', { fg = P.dim, bg = P.bar })
  set('TabLineSel', { fg = P.text, bg = P.bar })
  set('WinBar', { fg = P.dim, bg = P.bar })
  set('WinBarNC', { fg = P.dim, bg = P.bar })
  set('MsgArea', { fg = P.dim, bg = P.bg })

  set('ClandText', { fg = P.text })
  set('ClandBold', { fg = P.text, bold = true })
  set('ClandDim', { fg = P.dim })
  set('ClandFaint', { fg = P.faint })
  set('ClandAmber', { fg = P.amber })
  set('ClandTeal', { fg = P.teal })
  set('ClandGreen', { fg = P.green })
  set('ClandRed', { fg = P.red })
  set('ClandBlue', { fg = P.blue })
  set('ClandHeading', { fg = P.text, bold = true })
  set('ClandCode', { fg = P.text, bg = P.chip })
  set('ClandCodeBlock', { bg = P.composer })
  set('ClandLink', { fg = P.blue, underline = true })
  set('ClandItalic', { italic = true })
  set('ClandStrike', { strikethrough = true })
  set('ClandQuote', { fg = P.dim })
  for role, colour in pairs({ Human = P.blue, Aide = P.blue, Coordinator = P.teal, Implementer = P.violet, Reviewer = P.pink, Qa = P.sky, Hub = P.faint, Other = P.dim }) do
    set('ClandRole' .. role, { fg = colour })
  end
  set('ClandMine', { bg = P.mine })
  set('ClandAsk', { bg = '#211c12' })
  set('ClandWatch', { fg = P.dim })
  for name, colour in pairs({ Coordinator = P.teal, Implementer = P.violet, Reviewer = P.pink, Qa = P.sky, Other = P.dim }) do
    local function soften(hex)
      local out = '#'
      for i = 2, 6, 2 do
        local fg, bg = tonumber(hex:sub(i, i + 1), 16), tonumber(P.bg:sub(i, i + 1), 16)
        out = out .. ('%02x'):format(math.floor((fg + bg) / 2))
      end
      return out
    end
    set('ClandRole' .. name .. 'Watch', { fg = soften(colour) })
  end
  set('ClandPanel', { fg = P.text, bg = P.panel })
  set('ClandPanelEob', { fg = P.panel, bg = P.panel })
  set('ClandComposer', { fg = P.text, bg = P.composer })
  set('ClandComposerEob', { fg = P.composer, bg = P.composer })
  set('ClandTerm', { fg = '#c9d1dc', bg = P.term })
  set('ClandSel', { bg = P.sel })
  set('ClandSection', { fg = P.dim, bold = true })
  set('ClandBadge', { fg = P.ink, bg = P.amber, bold = true })
  set('ClandBadgeN', { fg = P.text, bg = P.chipb })
  set('ClandTab', { fg = P.dim, bg = P.panel })
  set('ClandTabOn', { fg = P.bluel, bg = P.keyon, bold = true })
  set('ClandPickSel', { bg = P.sel, bold = true })
  set('ClandPickMatch', { fg = P.blue, bold = true })

  set('ClandHead', { fg = P.dim, bg = P.bar, bold = true })
  set('ClandHeadFocus', { fg = P.bluel, bg = P.bar, bold = true })
  set('ClandBrand', { fg = P.text, bg = P.bar, bold = true })
  set('ClandChip', { fg = P.text, bg = P.chip })
  set('ClandChipBadge', { fg = P.ink, bg = P.amber, bold = true })
  set('ClandChipBadgeN', { fg = P.text, bg = P.chipb })
  set('ClandChipWarn', { fg = P.ink, bg = P.red, bold = true })
  set('ClandModeN', { fg = P.dim, bg = P.chipb, bold = true })
  set('ClandModeI', { fg = P.ink, bg = P.teal, bold = true })
  set('ClandModeT', { fg = P.ink, bg = P.amber, bold = true })
  for _, name in ipairs(TWINS) do
    local h = api.nvim_get_hl(0, { name = name })
    local bar, chip = vim.deepcopy(h), vim.deepcopy(h)
    bar.bg, chip.bg = P.bar, P.chip
    set(name .. 'Bar', bar)
    set(name .. 'Chip', chip)
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

--- A session's state (spec 4.2) as a glyph, a colour and words; `exited` and `stopped` are process states.
M.SESSION = {
  busy = { '●', 'ClandTeal', 'busy' },
  idle = { '○', 'ClandDim', 'idle' },
  ['waiting for approval'] = { '▲', 'ClandAmber', 'waiting for approval' },
  ['waiting for human'] = { '●', 'ClandAmber', 'waiting for human' },
  unknown = { '?', 'ClandDim', 'unknown' },
  exited = { '✗', 'ClandRed', 'died' },
  stopped = { '×', 'ClandRed', 'stopped' },
}

M.ROLE = { aide = 'ClandRoleAide', coordinator = 'ClandRoleCoordinator', implementer = 'ClandRoleImplementer', reviewer = 'ClandRoleReviewer', qa = 'ClandRoleQa' }

function M.role_group(from_kind, role)
  if from_kind == 'human' then return 'ClandRoleHuman' end
  if from_kind == 'hub' then return 'ClandRoleHub' end
  return M.ROLE[role] or 'ClandRoleOther'
end

--- An item's state as a glyph and a colour (the tracker knows open and closed so far).
M.ITEM = {
  open = { '○', 'ClandDim' },
  closed = { '●', 'ClandGreen' },
  claimed = { '◐', 'ClandTeal' },
}

return M
