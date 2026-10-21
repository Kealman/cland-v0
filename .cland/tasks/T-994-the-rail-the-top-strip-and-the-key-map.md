---
id: T-994
kind: task
title: The rail, the top strip and the key map
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by:
  - T-992
topic: null
branch: null
created: 2026-10-20T16:51:40.769Z
updated: 2026-10-21T09:33:07.769Z
---

## Summary

The rail lists the seven areas as words with counts only where something asks for attention, and collapses to icons with badges by its button and below 1280 px. The top strip holds the project, the release switcher, the palette, the Coordinator, the needs-you pill and the hub's dot. One key map matched by `KeyboardEvent.code` drives `1` to `7`, so the Russian layout works.

## What to build

The shell reads the counts it needs through the hub's ordinary frames on the web edge until E-412's snapshot is on `dev`:
- **The rail.** The seven areas in the spec's order. It collapses to a 60 px column of stroke icons with badges and tooltips, by its button or by itself below 1280 px, and the browser keeps the choice.
- **The top strip.** The project, the release switcher (its pick remembered), the palette button with ⌘K, the Coordinator's chip, the needs-you pill (a green check at zero), the live dot and `?`. The tab title carries the needs-you count.
- **The key map.** One table keyed by code and modifiers. It never binds the browser's reserved chords.
- **Interface state.** It lives in `localStorage` under one versioned key per area, with every access guarded, and the shell works without it.
- **Focus and type (P4).** The keyboard cursor is a 2 px blue ring on the selection background, and hover only lightens. Ids are set in JetBrains Mono and never break at the hyphen.

## Acceptance criteria

- [ ] C1. The rail lists Inbox, Items, Sessions, Topics, Events, Artifacts and Accounts as words, with a count only where something asks for attention (browser test with a fixture hub holding an ask and a busy session).
- [ ] C2. The rail collapses to a 60 px column of icons with badges by its button and by itself below 1280 px, and the button's choice survives a reload (browser test).
- [ ] C3. The top strip shows the project, the release switcher, the palette button, the Coordinator's chip, the needs-you pill and the hub's dot with `?`, and the tab title carries the needs-you count (browser test).
- [ ] C4. `1` to `7` switch the areas through one key map keyed by `KeyboardEvent.code`, also when the keys arrive with Cyrillic key values (browser test).
- [ ] C5. The key map binds none of ⌘T, ⌘W, ⌘N and ⌘⇧T (unit test).
- [ ] C6. The interface state lives under one versioned `localStorage` key per area, and the shell renders and switches areas with storage throwing on every access (browser test).
- [ ] C7. The keyboard cursor shows a 2 px ring on the selection background, hover only lightens a row, and an id never breaks at its hyphen at a narrow width (browser test on computed styles and layout).
