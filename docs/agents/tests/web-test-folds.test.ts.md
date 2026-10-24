# web/test/folds.test.ts

`web/test/folds.test.ts` proves chevron and physical left/right folding through
the rendered shell, reload persistence under the area's versioned local key,
zero outgoing fold frames, independent browser contexts/areas, synchronized
panes, retained preference fields, malformed state and denied storage. Its
mechanical `web/test/prose.ts` detector rejects visible text nodes ending in a
full stop or exceeding six words; planted header fixtures must fail while the
shell passes. Hidden text, title attributes, role tooltips and the marked `?`
help panel are excluded. These are Web checks, not hub persistence tests: folds
never enter the hub or Neovim's `ui.json`.
