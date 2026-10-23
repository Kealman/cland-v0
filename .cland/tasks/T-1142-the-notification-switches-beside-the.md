---
id: T-1142
kind: task
title: The notification switches beside the profile
state: closed
status: done
size: XS
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1135
  - T-1128
topic: topic-902
branch: t/T-1142-the-notification-switches-beside-the
created: 2026-10-22T15:16:16.594Z
updated: 2026-10-23T10:18:28.512Z
closed: 2026-10-23T10:18:28.512Z
---

## Summary

The "needs you" and "finished" switches move from the palette, where E-417 offers them, to the profile block in the Accounts area.

## Parent

E-418 (§3.6 beside the profile; tracer step 5). Ordered after E-417's notifications, which own the switches and the permission.

## What to build

The profile block gains E-417's two switches, "needs you" and "finished", per browser as E-417 stores them, with the notification permission asked when the first one is turned on. The palette actions E-417 offered until now go away. Turning a switch off stops that kind of notification in this browser only.

## Acceptance criteria

- [x] C1. "finished" turned off in the profile block stays off after a reload (Web test).
  - done: impl-1142 · 2026-10-23T10:01:25.487Z
  - verified: rev-23 [reviewer] · run rev-20261023-1142-final · 2026-10-23T10:13:38.966Z · commit 009ab1b218181ccf4941c3ab9ebb018ae0d94168
- [x] C2. The profile block shows both switches, the palette no longer offers them, and the first switch turned on asks for the notification permission (Web test).
  - done: impl-1142 · 2026-10-23T10:01:25.591Z
  - verified: rev-23 [reviewer] · run rev-20261023-1142-final · 2026-10-23T10:13:38.966Z · commit 009ab1b218181ccf4941c3ab9ebb018ae0d94168
- [x] C3. `web/README.md` describes the switches beside the profile (docs).
  - done: impl-1142 · 2026-10-23T10:01:25.665Z
  - verified: rev-23 [reviewer] · run rev-20261023-1142-source · 2026-10-23T10:02:32.534Z · commit 009ab1b218181ccf4941c3ab9ebb018ae0d94168
  - verified: rev-23 [reviewer] · run rev-20261023-1142-final · 2026-10-23T10:13:38.966Z · commit 009ab1b218181ccf4941c3ab9ebb018ae0d94168

## Comments

### impl-1142 · 2026-10-23T09:52:56.452Z

Claimed. Reading the profile and notification seams; waiting for T-1128 to appear on origin/dev before merging and editing. Will use the pre-agreed sealed Headless Shell Web seam in accounts/palette with a Notification stub, plus the requested area/key targeted regressions.

### impl-1142 · 2026-10-23T10:01:36.913Z

Implemented and pushed 009ab1b218181ccf4941c3ab9ebb018ae0d94168 (tree f0549b1d848af9b45b0e3a8d1d1c0e2c8fe1a1e2); source review delivered to reviewer. C1–C3 done; A-9959 retains implementation, TDD failures/traces and local evidence. Darwin arm64 Node v24.21.0: npm run check passed (test lint report-only); required neighbors plus notifications/inbox 48/48 targeted Web pass after merging shared T-1178. Shared notification store unchanged. Awaiting exact-head source verdict before mode-free verify; QA after-stage.

### rev-23 · 2026-10-23T10:02:32.534Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1142-source
commit: 009ab1b218181ccf4941c3ab9ebb018ae0d94168
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1142 source review
Head009ab1b218181ccf4941c3ab9ebb018ae0d94168 / treef0549b1d848af9b45b0e3a8d1d1c0e2c8fe1a1e2
Fixed base558262e4ffb41f285a046720a3cc19b2392fd2a7 (first-review parent, includes landed T-1128 and shared T-1178); git diff558262e4...009ab1b2,11files86+/57-.
Run rev-20261023-1142-source. Source clear, findings[]; C3 verified by docs. C1/C2 runtime pending.

Standards: pass. Accounts Profile adds two native button role=switch controls, aria-checked, explicit labels and on/off text, pending disabling, denial/unavailable tooltips and visible focus styling using existing tokens. Direct onClick invokes existing toggleNotification, preserving enabling gesture for the permission request. Shared notification-state, notification-rules and browser delivery remain byte-identical to base. No new dependencies, frames, role authority, policy/default, CLI command/help change or browser permission behavior. Existing folded Profile/sign-in scope and Accounts key context retained. No independent smell finding.

Spec: pass by source. Profile now owns Needs you and Finished. Palette dynamic notification actions/hook, Shell special routes and Shortcut variants are removed; exact-head grep finds no retained source action identifiers. Existing preferences remain per-browser/origin and storage listeners follow other tabs. Turning off a switch continues to suppress its kind through unchanged policy. No duplicate state/store or coupling to hub connectivity was introduced.

C1 test: renamed existing switch case explicitly enables Finished, observes on, turns it off, observes off, reloads and asserts Finished remains off while Needs you stays on.
C2 test: Profile region has exactly2 switches, both initiallyoff; physical Enter enables first and permissionRequests becomes1; palette filtered notification-action result count0; enabling Finished and later toggles/reload retain permissionRequests1. Other migrated existing consumers preserve disabled/visible/Watch suppression receipts, denial/revocation tooltips, cross-tab change observer before trigger, exact hidden ask focus with paused animation, Finished card and prior-layer tests. Only UI routes/locators change, aside from strengthened explicit C1/C2 assertions. Required area/key/palette/accounts/inbox neighbors reported passing.
C3 verified: Web README sections Browser notifications and Profile describe Accounts placement, palette absence, persisted per-browser controls, first-enabling prompt and denial; hub README/test guidance/implement skill match, with CHANGES provenance appended. Legacy interim palette wording removed; historical CHANGES entries correctly retained.

Evidence limits: A-9959 reports local Darwin arm64 Node24.21 check pass on feature working tree and48/48 targeted Web passes at final feature source tree over558262e4 (26.523574625s command duration), static/testlint report-only. Renamed criterion case0.564607917s; reported notification cases<4s. Summary is explicitly not raw stdout or configured verification. Red traces A-9956 missing Profile switch/A-9958 retained palette actions and migration locator-error A-9957 have honest attribution. No reviewer test/browser run or trace examination. Preserve original command/exit/head/timing receipts from session records without transcription reruns. New/renamed passing Web samples need actual configured timing audit before final clearance.

Proceed with mode-free verification at this exact head; any head change requires source review. C1/C2 remain unverified pending same-head receipt. After-stage affected QA separate; no per-item brief/outstanding QA criteria.

Criteria: C3 verified.

### impl-1142 · 2026-10-23T10:13:24.939Z

Configured mode-free verify e9f102be-32c0-49a8-a1bc-d99d0c80eb68 / A-9965 passed at unchanged source-reviewed head 009ab1b218181ccf4941c3ab9ebb018ae0d94168, tree f0549b1d848af9b45b0e3a8d1d1c0e2c8fe1a1e2. Raw progress audit: 2706/2706 tests and 402/402 file records pass, zero failure/skip/cancel. Actual phases: T1, fallback all T2 across hub and Neovim, complete Web; no T3/T4 (task policy defers T3 to periodic/integrated). Host typecheck gate 0153ff27 reused, not repeated remotely. Linux x64 6.8.0-142-generic, droplet c-8 lon1 cland-v0-a8d28bc1, Node v24.21.0, Neovim v0.12.5, workers 2/Web4, lifetime 566s, cost $0.0393. Generic lint/duration/ratchet warnings remain report-only. Profile switch criterion sample 1.635355669s; all 8 notification cases pass, max 2.338476677s, so no new passing Web identity reaches 4s. Post-run fetched origin/dev 558262e4; merge-tree conflict check exits 0 and returns exact source tree; clean worktree and no source/head change. Reviewer notified for final evidence verdict; after-stage QA remains separate.

### rev-23 · 2026-10-23T10:13:38.966Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1142-final
commit: 009ab1b218181ccf4941c3ab9ebb018ae0d94168
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1142 final evidence review
Head 009ab1b218181ccf4941c3ab9ebb018ae0d94168 / tree f0549b1d848af9b45b0e3a8d1d1c0e2c8fe1a1e2; branch tip unchanged.
Run rev-20261023-1142-final. Clear; findings []; verified C1,C2,C3.

Standards: source audit A-9960 carries forward. Profile controls use unchanged notification-state and direct enabling gestures; palette actions and routes removed. No authority/protocol changes. C3 source-verified documentation remains accurate in Web/hub README and test/implement guidance.

Spec/criteria:
C1 verified by the Profile case: Finished is turned on, then off, observed off, reload retains off while Needs you remains on.
C2 verified: exactly two labelled Profile switches, first physical Enter enabling requests permission once; later switch/toggles/reload do not re-prompt; notification actions absent from palette.
C3 verified again at final head: README describes controls beside Profile in Accounts, browser scope, palette absence and permission behavior.
Other seven migrated notification cases pass: exact hidden-ask focus, looking/off/Watch suppression/no replay, denial, Finished/card, revocation, cross-tab preferences and prior-layer demotion. Existing neighbors pass as part of complete Web phase.

Configured mode-free e9f102be-32c0-49a8-a1bc-d99d0c80eb68 / A-9965 exits0 at exact source-cleared head. Raw progress:2706/2706 ordinary tests and402/402 file records pass, zero fail/skip/cancel. No load-gate-scope repetitions present; generic five-repetition headers do not establish any repetitions here. Actual T1 + fallback all hub/Neovim T2 + complete Web pass; no T3/T4. T3 deferred by configured task policy. Host gate0153ff27c18771370042a9cadb1ecfce6e39dc13 reused, not repeated remotely.

Executor Linux x64 c-8 lon1 cland-v0-a8d28bc1, Node24.21.0/Neovim0.12.5, workers2/Web4, lifetime566s/$0.0393. Web phase107.37s actual duration; projected95.162s at2workers is not measured wall time. Generic duration/test-lint/tier/ratchet diagnostics report-only; four missing baselines retained; no clean-budget claim.

Renamed Profile criterion identity1.635355669s. All eight notification samples1.155337880–2.338476677s, so no4s passing-sample allowance trigger; no manifest/source edit needed. A-9959 local source-tree summaries remain supplemental, not replacement configured evidence.

Reviewer read only: no tests/browser/edits/merge. After-stage affected QA separate; no per-item brief/outstanding QA criteria. Final clear at this head.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-23T10:18:28.512Z

Merged 4624720e0be586a5026cbeef1fa62718dab21ff8 onto dev.
