---
id: T-168
kind: task
title: "Sessions panel shows a verifier's held item, tagged with its role, instead of free: holds in the hub's session data"
state: open
status: in progress
labels:
  - v0.1
  - ready-for-agent
  - bug
assignee: null
parent: T-107
blocked_by: []
topic: topic-75
branch: t/T-168-sessions-panel-shows-a-verifier-s-held
created: 2026-10-10T09:29:11.949Z
updated: 2026-10-10T09:41:56.958Z
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

## Comments

### impl-168 · 2026-10-10T09:33:36.007Z

Opened topic-75. Building frame and headless panel regressions before the fix; hub scope limited to session-data projection and refreshes. Full suite awaits Coordinator signal.

### impl-168 · 2026-10-10T09:38:19.156Z

Committed and pushed session-hold projection/refresh plus role-tagged claim-first panel display. Frame coverage passes for launched Reviewer/QA session.list, presence and session.process take/release; headless panel covers review/QA free→hold→free and claim-first ordering/claim survival. Typecheck and diff check pass. Evidence A-535: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-535-t-168-implementation-and-validation.md. Full npm test awaits Coordinator signal; live post-restart reviewers check remains pending.

### rev-9 · 2026-10-10T09:41:56.958Z

verdict: review
result: not clear
by: rev-9 [reviewer]
run: rev-2026-10-10-168-1
commit: 86c1c3c29dc8d08e75636b25eb7b32435de9574c

Medium — hub/src/hub/core.ts:837: presence passes raw sessionId='unknown' to hold projection, while supported unknown-id Reviewer/QA tracker operations store work under name:<session>; normalized identities do not match, so holds=[] and the panel still shows free. Use the same name-based identity as sessionActor while keeping different unknown sessions isolated. Target in-memory probe confirms accepted Reviewer hello, holdIdentity=name:rev, projectionIdentity=unknown, matches=false; projection/display consequence traced in source.

Low — possible Feature Envy / repeated full projection, hub/src/hub/server.ts:71: each session lookup calls tracker.list(), including all verdict/hold queries; every tracker change repeats it for connected and process sessions. Prefer a narrow Tracker claims/holds query, read once per refresh. Heuristic only; no measured regression claimed.

Stable-ID take/release/stop/reconnect paths, additive payload shape and claim-first tagged column otherwise look correct. Full suite and live post-restart check remain pending as instructed. Read-only review; no edits or suite run. Two-axis evidence: A-536, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-536-t-168-review-provisional-session-identities-still-show-free.md.
