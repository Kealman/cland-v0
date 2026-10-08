# Main screen design

The approved design of cland's main screen (wayfinder ticket #15, 2026-10-08). Authoritative order when sources disagree:

1. `docs/spec/v0.md`, section 5: the decided layout in words.
2. The behaviour of the Neovim prototype on branch `prototype/workbench` (`prototypes/nvim-host/WORKBENCH.md` for the key map and presets, `lua/cland_proto/` for the Neovim workarounds). The prototype is throwaway code: a reference, never something to merge.
3. The mockups in this folder, for visual intent: colours, glyphs, density, what each panel shows.

## Files

- `Main.dc.html`: the interactive workbench. Open it in a browser; the buttons in its key bar toggle panels and centre views. Its `renderVals()` holds the fake items and sessions. The markup of each panel is the specification of that panel's content and keys.
- `Charting.dc.html`, `Watch.dc.html`, `Steady.dc.html`: the same shell with different panels open, the three stage presets.
- `Session.dc.html`, `Item.dc.html`: the attached-session view and the item view.
- `Pickers.dc.html`: the one floating picker and its four kinds.
- `Inbox.dc.html`: the inbox sections, what feeds them, the row actions, and the three motions `gi` / `gt` / `gs`.
- `canvas.json`: the artboard layout of the design canvas (https://claude.ai/artifact/PMVXaxAkQJQ6mSNEo3k7eB, private to the owner).
- `screens/`: PNG renders of the Neovim prototype at 200x50 for the workbench and the three presets.

## Visual vocabulary

Dark ground `#0b0e14`, panels `#10141b`, borders `#222a35`, text `#d6dbe4`, muted `#8a94a3`. Amber `#f0b429` for what needs the human, teal `#35c4a0` for in progress and agent activity, green `#7ddc8a` for done and clear, red `#ff7b72` for died and not clear, blue `#6aa5ff` for links and selection. Monospace throughout (JetBrains Mono in the mockups); glyphs: ○ backlog, ◔ planned, ◐ in progress, ◉ review or qa, ● done, ◌ blocked, ▲ waiting for approval or attention, ? open ask, ✓ ✓✓ ⌁ delivery stages. No emoji.
