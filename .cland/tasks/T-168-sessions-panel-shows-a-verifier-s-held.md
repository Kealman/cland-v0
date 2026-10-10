---
id: T-168
kind: task
title: "Sessions panel shows a verifier's held item, tagged with its role, instead of free: holds in the hub's session data"
state: open
status: planned
labels:
  - v0.1
  - ready-for-agent
  - bug
assignee: null
parent: T-107
blocked_by: []
topic: null
branch: null
created: 2026-10-10T09:29:11.949Z
updated: 2026-10-10T09:29:12.193Z
---

## Parent

T-107 (v0.1 release and status). A bug the human reported on the live build, relayed by the stand-in on 2026-10-10.

## What to build

In the sessions panel, a busy Reviewer (rev-67, rev-8) shows "free" in the item column while it is reviewing an item, and QA likely does the same. Spec v0.1 §3.2 and §3.11 say the panel shows the item a verifier holds: the verifier hold that sits beside the Implementer's claim, tagged with the role.

The cause is in the data. The panel renders `s.item` (nvim/lua/cland/panels.lua:234), which carries only a claim. The session data the hub sends does not include verifier holds (T-121), so a Reviewer or QA session with a hold has no item to show.

Add the session's held items to the session data the hub sends, and show them in the panel's item column, tagged with the role (for example `T-142 review`). A session with both a claim and a hold shows the claim first. A session with neither shows "free".

## Acceptance criteria

- [ ] The hub's session data carries each session's verifier holds (item, and review or qa), kept current as holds are taken and released.
- [ ] The sessions panel shows a verifier's held item, tagged with its role, instead of "free"; it shows "free" again when the hold is released.
- [ ] A frame-protocol test covers the hold appearing in, and leaving, the session data; a headless test covers the panel's column.
- [ ] After the next hub restart, the relaunched reviewers' holds show in the panel (checked on the live build and recorded in the handover).
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. Spans the hub (session data) and Neovim (the panel).
