-- PROTOTYPE (ticket #15, workbench): the colours of the design canvas.
-- Dark ground, amber for "needs you", teal for in progress / agents, green
-- for done, red for died / not clear, blue for links and artifacts.
--
-- Quirk kept from the chat-screen prototype: a %#Group# in a statusline,
-- tabline or winbar does not take the bar's background, so every fg-only
-- group used in a bar gets a "<name>Bar" twin (bar background) and a
-- "<name>Chip" twin (the top bar's chip background).
local api = vim.api
local M = {}

M.P = {
  bg = '#0b0e14', panel = '#10141b', bar = '#10141b', composer = '#0d1117', mine = '#0e131b',
  border = '#222a35', chip = '#1a212c', chipb = '#2a3340', sel = '#182131', keyon = '#1b2a3f',
  text = '#d6dbe4', dim = '#8a94a3', faint = '#5b6472',
  amber = '#f0b429', amberbg = '#17150f', amberline = '#7a6526', ink = '#1a1400',
  teal = '#35c4a0', green = '#7ddc8a', red = '#ff7b72', blue = '#6aa5ff', bluel = '#9cc3ff',
  purple = '#b392f0',
}

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
  set('Search', { fg = P.ink, bg = P.amber })
  set('StatusLine', { fg = P.dim, bg = P.bar })
  set('StatusLineNC', { fg = P.dim, bg = P.bar })
  set('TabLine', { fg = P.dim, bg = P.bar })
  set('TabLineFill', { fg = P.dim, bg = P.bar })
  set('TabLineSel', { fg = P.text, bg = P.bar })
  set('WinBar', { fg = P.dim, bg = P.bar })
  set('WinBarNC', { fg = P.dim, bg = P.bar })
  set('MsgArea', { fg = P.dim, bg = P.bg })
  set('ModeMsg', { fg = P.dim })
  set('Pmenu', { fg = P.text, bg = P.panel })
  set('PmenuSel', { fg = P.text, bg = P.sel, bold = true })

  -- panel windows (winhighlight Normal:ClandPanel)
  set('ClandPanel', { fg = P.text, bg = P.panel })
  set('ClandPanelEob', { fg = P.panel, bg = P.panel })
  set('ClandComposer', { fg = P.text, bg = P.composer })
  set('ClandComposerEob', { fg = P.composer, bg = P.composer })
  set('ClandSel', { bg = P.sel })
  set('ClandMine', { bg = P.mine })
  set('ClandTerm', { fg = '#c9d1dc', bg = '#07090d' })

  -- text
  set('ClandText', { fg = P.text })
  set('ClandBold', { fg = P.text, bold = true })
  set('ClandDim', { fg = P.dim })
  set('ClandFaint', { fg = P.faint })
  set('ClandAmber', { fg = P.amber })
  set('ClandAmberBold', { fg = P.amber, bold = true })
  set('ClandTeal', { fg = P.teal })
  set('ClandGreen', { fg = P.green })
  set('ClandRed', { fg = P.red })
  set('ClandRedBold', { fg = P.red, bold = true })
  set('ClandBlue', { fg = P.blue })
  set('ClandBlueBold', { fg = P.blue, bold = true })
  set('ClandPurple', { fg = P.purple })
  set('ClandTitle', { fg = P.text, bold = true })
  set('ClandSection', { fg = P.dim, bold = true })
  set('ClandSectionAmber', { fg = P.amber, bold = true })
  set('ClandSectionRule', { fg = P.border })

  -- badges, keycaps, tabs, chips
  set('ClandBadge', { fg = P.ink, bg = P.amber, bold = true })
  set('ClandBadgeN', { fg = P.text, bg = P.chipb })
  set('ClandBadgeRed', { fg = P.ink, bg = P.red, bold = true })
  set('ClandKey', { fg = P.text, bg = P.chipb, bold = true })
  set('ClandTab', { fg = P.dim })
  set('ClandTabOn', { fg = P.bluel, bg = P.keyon, bold = true })
  set('ClandChip', { fg = P.text, bg = P.chip })
  set('ClandChipId', { fg = P.blue, bg = P.chip, bold = true })
  set('ClandChipDim', { fg = P.dim, bg = P.chip })

  -- ask cards (amber), boxes (board cards, verdicts)
  set('ClandCard', { fg = P.text, bg = P.amberbg })
  set('ClandCardLine', { fg = P.amberline, bg = P.amberbg })
  set('ClandCardLineSel', { fg = P.blue, bg = P.amberbg })
  set('ClandCardAmber', { fg = P.amber, bg = P.amberbg, bold = true })
  set('ClandCardDim', { fg = P.dim, bg = P.amberbg })
  set('ClandCardKey', { fg = P.text, bg = P.chipb, bold = true })
  set('ClandCardGreen', { fg = P.green, bg = P.amberbg, bold = true })
  set('ClandBox', { fg = P.chipb })
  set('ClandBoxTeal', { fg = P.teal })
  set('ClandBoxAmber', { fg = P.amber })
  set('ClandBoxRed', { fg = P.red })
  set('ClandBoxSel', { fg = P.bluel, bold = true })
  set('ClandFields', { fg = P.text, bg = P.composer })
  set('ClandFieldsDim', { fg = P.dim, bg = P.composer })

  -- picker
  set('ClandPickSel', { bg = P.sel, bold = true })
  set('ClandPickMatch', { fg = P.amber, bold = true })

  -- bars: the panel headers (winbar), the top bar (tabline), the status line
  set('ClandHead', { fg = P.dim, bg = P.bar, bold = true })
  set('ClandHeadFocus', { fg = P.bluel, bg = P.bar, bold = true })
  set('ClandBrand', { fg = P.text, bg = P.bar, bold = true })
  set('ClandModeN', { fg = P.dim, bg = P.chipb, bold = true })
  set('ClandModeI', { fg = P.ink, bg = P.teal, bold = true })
  set('ClandModeT', { fg = P.ink, bg = P.amber, bold = true })
  set('ClandChipBadge', { fg = P.ink, bg = P.amber, bold = true })
  set('ClandChipBadgeN', { fg = P.text, bg = P.chipb })
  set('ClandChipWarn', { fg = P.ink, bg = P.red, bold = true })
  for _, name in ipairs({ 'ClandText', 'ClandBold', 'ClandDim', 'ClandFaint', 'ClandAmber', 'ClandAmberBold', 'ClandTeal',
    'ClandGreen', 'ClandRed', 'ClandRedBold', 'ClandBlue', 'ClandTitle', 'ClandPurple' }) do
    local h = api.nvim_get_hl(0, { name = name })
    local bar, chip = vim.deepcopy(h), vim.deepcopy(h)
    bar.bg, chip.bg = P.bar, P.chip
    set(name .. 'Bar', bar)
    set(name .. 'Chip', chip)
  end
end

-- Status glyphs (Main artboard): item workflow states.
M.ITEM = {
  backlog = { '○', 'ClandDim', 'backlog' },
  planned = { '◔', 'ClandDim', 'planned' },
  progress = { '◐', 'ClandTeal', 'in progress' },
  review = { '◉', 'ClandAmber', 'in review' },
  qa = { '◉', 'ClandAmber', 'in qa' },
  done = { '●', 'ClandGreen', 'done' },
  blocked = { '◌', 'ClandDim', 'blocked' },
}

-- Session states (#13 normalised) as glyph, hl, words.
M.SESSION = {
  busy = { '●', 'ClandTeal', 'busy' },
  idle = { '○', 'ClandDim', 'idle' },
  ['waiting for approval'] = { '▲', 'ClandAmber', 'waiting for approval' },
  ['waiting for human'] = { '●', 'ClandAmber', 'waiting for you' },
  unknown = { '?', 'ClandDim', 'unknown' },
  stopped = { '×', 'ClandRed', 'stopped' },
  died = { '✗', 'ClandRed', 'died' },
}

-- Delivery stages (#13) on the human's messages.
M.STAGE = {
  queued = { '⌁', 'ClandAmber', 'queued' },
  delivered = { '✓', 'ClandDim', 'delivered' },
  injected = { '✓✓', 'ClandTeal', 'injected' },
}

return M
