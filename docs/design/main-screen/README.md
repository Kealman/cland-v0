# Main screen design

The approved design of cland's main screen (wayfinder ticket #15, 2026-10-08). Authoritative order when sources disagree:

1. `docs/spec/v0.md`, section 5: the decided layout in words.
2. The behaviour of the Neovim prototype on branch `prototype/workbench` (`prototypes/nvim-host/WORKBENCH.md` for the key map and presets, `lua/cland_proto/` for the Neovim workarounds). The prototype is throwaway code: a reference, never something to merge.
3. The mockups in this folder, for visual intent: colours, glyphs, density, what each panel shows.

For the v0.1.2 boards (the explorer, the card, the categories, the inbox and the events view) the order is `docs/spec/v0.1.2.md`, then the Neovim prototype on branch `prototype/explorer` once it exists (map ticket T-262), then these boards.

## Files

- `Main.dc.html`: the interactive workbench. Open it in a browser; the buttons in its key bar toggle panels and centre views. Its `renderVals()` holds the fake items and sessions. The markup of each panel is the specification of that panel's content and keys.
- `Charting.dc.html`, `Watch.dc.html`, `Steady.dc.html`: the same shell with different panels open, the three stage presets.
- `Session.dc.html`, `Item.dc.html`: the attached-session view and the item view.
- `Pickers.dc.html`: the one floating picker and its four kinds.
- `Inbox.dc.html`: the v0 inbox anatomy (the inbox sections, what feeds them, the row actions, and the three motions `gi` / `gt` / `gs`), superseded by `InboxNow.dc.html` for v0.1.2.
- `ItemsBoard.dc.html`, `SessionsPanel.dc.html`, `Palette.dc.html`: v0.1, the items panel as a vertical board, the sessions panel grouped by state, and the command palette (map ticket T-99; behaviour on branch `prototype/panels`).
- `Thread.dc.html`: v0.1, the thread rendering with role gutters, layers and folded agent runs (map ticket T-97; behaviour on branch `prototype/thread`).
- `PlanBefore.dc.html`, `PlanMidway.dc.html`: v0.1, the epic plan view before the epic starts and mid-way (map ticket T-100; the plan itself is spec v0.1 §3.10).
- `Explorer.dc.html`: v0.1.2, the item explorer at the release root, an outline tree in the centre with the card of the row under the cursor beside it and the items panel on the left (map ticket T-259; spec v0.1.2 §3.8, and §3.11 for the items panel; behaviour on branch `prototype/explorer` once it exists).
- `ExplorerEpic.dc.html`: v0.1.2, the explorer scoped to an epic with `s`, with the breadcrumbs in the winbar, the live tasks grouped under one label per stage and the done tasks after them in the order they closed (map ticket T-259; spec v0.1.2 §3.8).
- `Categories.dc.html`: v0.1.2, the explorer with the categories root unfolded beside the release, three rows selected and the quick message to the Coordinator open at the bottom (map ticket T-259; spec v0.1.2 §3.10 and §3.8).
- `CardEpic.dc.html`: v0.1.2, the item card of an epic at reading size, block by block with the notes in the margin: summary, facts, progress, plan stage, latest verdict, relations and dates, the agents' text folded behind `zb`, and the quick message to the Coordinator (map ticket T-260; spec v0.1.2 §3.9).
- `CardTask.dc.html`: v0.1.2, the item card of a task, with the criteria and their marks in place of the progress, no plan stage, and a branch and suite block with the latest `cland verify` result after the verdict (map ticket T-260; spec v0.1.2 §3.9).
- `InboxNow.dc.html`: v0.1.2, the inbox on the now layer in four sections (asks and approvals, plan approvals, requests to the human, messages to the human), with the events line and the archive line below (map ticket T-261; spec v0.1.2 §3.7). It supersedes `Inbox.dc.html`.
- `Events.dc.html`: v0.1.2, the events view, notifications and events newest first and grouped by day, with the kind and warning filters and the bookkeeping rows dimmed (map ticket T-261; spec v0.1.2 §3.7).
- The inbox panels drawn inside `Main.dc.html`, `Thread.dc.html`, `Steady.dc.html` and `Watch.dc.html` predate spec v0.1.2 §3.7; `InboxNow.dc.html` supersedes them for the inbox.
- `canvas.json`: the artboard layout of the design canvas (https://claude.ai/artifact/TuzGTeNLthjo2RLwMyhZfp, private to the owner).
- `screens/`: PNG renders of the Neovim prototype at 200x50 for the v0 workbench and the three presets, `v01-*.png` renders of the v0.1 mockups, and `v012-*.png` renders of the v0.1.2 mockups at 1440x900.

## Visual vocabulary

Dark ground `#0b0e14`, panels `#10141b`, borders `#222a35`, text `#d6dbe4`, muted `#8a94a3`. Amber `#f0b429` for what needs the human, muted amber `#c2a15e` for the watch layer and for changes since the human's last look, teal `#35c4a0` for in progress and agent activity, green `#7ddc8a` for done, clear and ready, red `#ff7b72` for died and not clear, blue `#6aa5ff` for links, selection and the human's own messages; role gutters in the thread: violet for Implementers, pink for Reviewers, sky for QA. Monospace throughout (JetBrains Mono in the mockups); glyphs: ○ backlog and planned, ◐ in progress, ◉ review and qa in amber or ready in green, ● done, ◌ blocked, ▲ waiting for approval or attention, ? open ask, ✗ a failed verdict or criterion, ✓ ✓✓ ⌁ delivery stages. No emoji.

The v0.1.2 boards add the done colour `#98bfa2`: green-tinted and dimmer than live text, it carries the title of a done row or node beside its green glyph, with no strikethrough (spec v0.1.2 §3.3). They also carry white `proposal Pn` stickers, each with its note on hover. The stickers mark the proposals the human accepted on 2026-10-12, recorded in spec v0.1.2 §3.7 to §3.10; the numbers run P1 to P22 on the explorer and card boards and P1 to P18 on the inbox and events boards.
