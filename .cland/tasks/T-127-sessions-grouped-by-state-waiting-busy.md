---
id: T-127
kind: task
title: "Sessions grouped by state: waiting, busy and idle groups, a folded stopped line, the expanding selected row with the approval's command, and the sessions chip"
state: open
labels:
  - ready-for-agent
  - v0.1
assignee: null
parent: T-109
blocked_by:
  - T-126
topic: null
branch: null
created: 2026-10-09T21:57:34.743Z
updated: 2026-10-09T21:57:34.743Z
---

## Parent

T-109 (Workbench basics), slice 4 of 5. Spec §3.11 (The sessions panel).

## What to build

The sessions panel groups sessions by state: waiting, busy and idle, each with its count, then one folded line, "stopped (N)", which `za` unfolds. The "yours" group for Aides is T-111's. Each session is one line: glyph, name, role and item. The selected row expands to harness, model, state and usage. For a pending approval the state shows the command it waits on.

Keys, each registered in the action registry:
- Enter attaches;
- `C-v` attaches in a split;
- `l` launches;
- `x` stops;
- `c` shows capabilities.

`a` and `␣A`, which launch an Aide, are T-111's. The sessions chip in the top bar counts the now-layer sessions plus the waiting count. Until the visibility layers land, "now" means every session that is not stopped.

## Acceptance criteria

- [ ] On the stub hub, a session moving to waiting for approval moves to the waiting group and shows the command it waits on; `za` unfolds and folds the stopped sessions.
- [ ] Enter, `C-v`, `l`, `x` and `c` work from the panel and appear in the palette with their keys.
- [ ] The chip counts as specified and updates from session events alone.
- [ ] Headless QA cases cover the groups and the expanding row; `nvim/README.md` documents the panel.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. Implementer: Codex. Reference: `prototype/panels` `panels.lua`; mockup `SessionsPanel.dc.html` and `screens/v01-sessions-panel.png`. The UI reads session state from the hub and never derives it (ADR 0003).
