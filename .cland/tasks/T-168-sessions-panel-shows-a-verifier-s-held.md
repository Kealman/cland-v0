---
id: T-168
kind: task
title: "Sessions panel shows a verifier's held item, tagged with its role, instead of free: holds in the hub's session data"
state: open
status: ready
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
updated: 2026-10-10T10:32:29.663Z
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

### impl-168 · 2026-10-10T09:44:22.969Z

Resolved A-536 medium: session-hold projection now uses the same sessionActor identity as tracker requests, including name:<session> isolation for unknown ids. Added real daemon/frame take-release/isolation regression; reproduced missing hold before fix. Also moved the projection into a narrow Tracker ownership query, addressing the low note without full item/verdict reads. Typecheck and 7 targeted frame/headless/session-event tests pass; diff check clean. Pushed 2010c04589c7912ae902590cce8de3d01cb2c8f7. Evidence A-540: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-540-t-168-review-follow-up-unknown-session-identity.md. Full suite still waits for Coordinator signal.

### rev-9 · 2026-10-10T09:47:03.195Z

verdict: review
result: not clear
by: rev-9 [reviewer]
run: rev-2026-10-10-168-2
commit: 2010c04589c7912ae902590cce8de3d01cb2c8f7

Medium — hub/src/tracker/tracker.ts:841: the ownership-only session projection includes removed item IDs because claims/holds persist independently of tracker_items; deleting or re-IDing a held item now leaves T-n review/item in the panel, whereas the prior tracker.list projection excluded it. Intersect the narrow ownership queries with current indexed items, retaining durable ownership for recovery. In-memory target TrackerIndex probe after remove(T-1): indexedItems=[], bulkHoldItems=[T-1], bulkClaimItems=[T-1]; refresh/display consequence traced in source.

A-536's medium and low are resolved: sessionActor normalization preserves two unknown sessions' name isolation, and Tracker owns a narrow bulk projection. Full-item lifecycle/display/payload checks otherwise remain clear. Standards 0 findings; Spec 1 medium. Full suite/live post-restart check remain pending. No reviewer edits or suite run.

Evidence: A-542, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-542-t-168-rereview-orphan-ownership-rows-leak-into-session-work.md.

### impl-168 · 2026-10-10T09:49:41.477Z

Resolved A-542 by joining indexedClaims/indexedHolds against tracker_items. Ownership remains durable but removed/re-IDed items are excluded from current session work. Real frame regression reproduces stale work before the fix, then verifies deletion clears claim+review hold and restoration recovers both. Typecheck, diff check and 5 targeted frame/headless tests pass. Pushed 8128e87093b168484c7e390326b26ca23ddf9eb2; delta 2010c04589c7912ae902590cce8de3d01cb2c8f7..8128e87093b168484c7e390326b26ca23ddf9eb2. Evidence A-543: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-543-t-168-orphan-ownership-projection-fix.md. Full suite remains deferred.

### rev-9 · 2026-10-10T09:51:02.472Z

verdict: review
result: clear
by: rev-9 [reviewer]
run: rev-2026-10-10-168-3
commit: 8128e87093b168484c7e390326b26ca23ddf9eb2

Clear: no high, medium or low findings. Standards and Spec independently clear across the full item.

A-542 is resolved: indexed ownership reads join tracker_items, hiding removed work while retaining durable rows. Reviewer in-memory removal/restoration probe shows both work lists clearing, durable claim+hold remaining, and both returning after restoration. A-536 identity/isolation and narrow-query fixes remain intact. Additive payload shape, claim-first tagged display, normal take/release/stop/reconnect refresh and older-payload fallback carry forward.

A-543 reports five frame/headless cases and typecheck passing. Full npm test and live post-restart panel verification remain separate pending acceptance checks. Reviewer made no edits or suite run.

Evidence: A-545, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-545-t-168-full-item-review-clear-identity-and-indexed-ownership-fixes.md.

### impl-168 · 2026-10-10T10:13:08.100Z

Rebased onto dev 2cba9e9 with clean original range-diff, then fixed the session-query shutdown regression using Tracker's own #stopping state (return empty work, no error catch). The looping-pair missing hub-stopped count was the same database exception: an old-head daemon control fails and adding only the guard passes. Item-lead, name-reservation, agents-journal, session-holds and headless sessions pass 83/83; typecheck and diff check pass. Pushed af1403fcd86966336cf5aa920356914220be812e. Evidence A-555: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-555-t-168-shutdown-regression-diagnosis-and-rebased-validation.md. The cancelled old-base full run does not count; queueing the new full run.

### rev-9 · 2026-10-10T10:16:53.905Z

verdict: review
result: clear
by: rev-9 [reviewer]
run: rev-2026-10-10-168-4
commit: af1403fcd86966336cf5aa920356914220be812e

No high, medium or low findings. Standards and Spec are clear. The shutdown guard at hub/src/tracker/tracker.ts:843 precedes all ownership queries and uses #stopping, which is set before asynchronous drain and index closure. Late presence/process reads now return empty work without touching the closed database; durable ownership remains intact. Range-diff confirms all three previously approved patches rebased unchanged. Review evidence: A-560, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-560-t-168-shutdown-guard-and-rebase-review.md. Read-only review; A-555 reports83/83 affected tests plus typecheck/diff checks passing. Full suite and live panel check remain pending separately.

### impl-168 · 2026-10-10T10:32:29.663Z

rev-9 review clear on af1403fcd86966336cf5aa920356914220be812e (A-560). Full suite was queued but had not acquired the lock; withdrew it at Coordinator request (message 7071ea7e-f23a-4f81-9b28-153aa0d58203, exit 143) to let the short Neovim runs go next. Awaiting Coordinator's requeue signal. Full suite and live post-restart evidence remain pending.
