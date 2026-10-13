---
id: T-171
kind: task
title: The hub owns not-clear verdicts and deaths in needsYou, each with a
  resolution rule
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: impl-171
parent: E-115
blocked_by: []
topic: topic-129
branch: t/T-171-the-hub-owns-not-clear-verdicts-and
created: 2026-10-10T10:13:42.333Z
updated: 2026-10-11T12:34:55.055Z
---

## Parent

T-115 (Visibility and artifacts). Rescoped 2026-10-11 by the human's decision D17 (T-130).

## What to build

A not-clear verdict and a session death are information, not "needs you". needsYou means "the human must react", so these never count in the top-panel counter or in needsYou.

- The hub tags a not-clear verdict and a session death as **warn-level events** in the shared classifier (T-190): watch layer, with a warn severity in the event data.
- The inbox and the event log show them with a warn marker (an icon or an equivalent glyph), sorted with the other events, with no dismiss or resolution rule.
- needsYou, `cland inbox --json` counts and `hub status` stay asks, approvals and waiting topics only (T-169).

## Acceptance criteria

- [x] C1. Not-clear verdicts and session deaths reach the inbox and the event log as warn-level events with a marker, and they never change needsYou.
  - done: impl-171 · 2026-10-11T11:09:59.540Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-171-2 · 2026-10-11T11:16:04.539Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-171-4 · 2026-10-11T11:42:55.380Z
- [x] C2. Frame-protocol tests cover both event kinds and their severity, and a headless test covers the inbox marker and the unchanged chip count.
  - done: impl-171 · 2026-10-11T11:01:10.776Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-171-2 · 2026-10-11T11:16:04.539Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-171-4 · 2026-10-11T11:42:55.380Z
- [x] C3. Docs (docs/visibility.md, nvim/README.md) describe the warn level.
  - done: impl-171 · 2026-10-11T11:01:10.941Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-171-2 · 2026-10-11T11:16:04.539Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-171-4 · 2026-10-11T11:42:55.380Z
- [x] C4. `npm run typecheck && npm test` pass.
  - done: impl-171 · 2026-10-11T12:33:51.495Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-171-5 · 2026-10-11T12:34:24.700Z

## Notes

Size S. The earlier design (now-layer entries with resolution rules) is withdrawn by D17. The T-134 verdict-message exception folds into this warn level.

## Comments

### coord · 2026-10-10T16:45:30.416Z

From T-190 self-review: T-134 keeps agent-to-agent verdict messages at watch (clear) and now (not clear), which diverges from spec §3.5 (agent-to-agent is background; agents raise only by addressing the human or asking). T-190 preserves the T-134 behaviour unchanged; T-171 decides the verdict-message level with the rest of the noise policy (under D16 the human acts on no individual verdict).

### coord · 2026-10-10T16:59:13.531Z

Candidate kind from T-198 (stand-in decision 2026-10-10): unread human-addressed messages in needsYou, resolved when read or answered. Settle with the human's open T-130 question on verdicts and deaths; nothing in v0.1 depends on it.

### impl-171 · 2026-10-11T10:55:41.734Z

Claimed the D17-rescoped work. Implementing watch-layer warnings for not-clear verdicts and session deaths, with no needsYou entries or resolution rules; T-222 lifecycle classification remains outside this change.

### impl-171 · 2026-10-11T11:01:33.642Z

Implemented and pushed 36b5f3c6eef21757dd4c360d7cac1b42634146ed (implementation 73a7eb2; merged origin/dev fbd37e8). Shared warn severity, Watch placement, inbox/log/thread/CLI markers, no warning dismissal/resolution, and needsYou restricted to asks/approvals/waiting topics. Targeted hub visibility 10/10 and Neovim layers 4/4 plus affected ask/shell/thread regressions pass. C1–C3 done; C4 waits for the final detached all suite.

### rev-13 · 2026-10-11T11:06:52.628Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261011-171-1
commit: 36b5f3c6eef21757dd4c360d7cac1b42634146ed

Medium — hub/src/hub/visibility.ts:53: normal not-clear task verdict Agents notices have kind:event (core.ts:413,562) and are not recognized as warnings; the event log lacks the required warn marker. Bound-topic report severity does not fix its Agents event. The headless fixture injects a direct Agents report and misses this normal path. Coordinator ae6bb36f confirmed C1/D17 requires it and directed real-path protocol/headless coverage.

Low — nvim/README.md:39: old message-layer text still says not-clear verdicts are Now; it must agree with the new Watch policy.

C1 failed; C2/C3 await corrected-head review, C4 awaits a complete new suite. A-1200 is intentionally interrupted, not passing evidence. Independent typecheck and diff checks passed; no edits. A-1202: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1202-t-171-review-at-36b5f3c-normal-agents-verdict-event-lacks-warning.md records separate axes.

Criteria: C1 failed (Normal not-clear task verdict produces an Agents kind:event task notice not recognized by warningSeverity, so the event log lacks warn severity/marker.).

### impl-171 · 2026-10-11T11:09:59.829Z

Fixed A-1202/C1 at 39997a9f8ac332ccab2f3eb28f21482e4d16fa32. Tracker changes carry structured posted-verdict facts into real Agents task subscription events; death subscriptions carry lifecycle facts. The shared classifier warns these event messages and bound-topic agent verdict references. Replaced injected warning headless scenario with a real daemon task.comment/death path; inbox and Agents markers and zero chip pass. Real protocol regression passes bound-topic report, task event, death event, agent-message reference, history and unchanged counts; targeted subscription regressions 2/2 and Neovim layers 4/4 pass. README shared-rule inconsistency corrected. Superseded suite canceled via SIGTERM (A-1200). Fetched origin/dev immediately before replacement suite: already merged fbd37e8.

### impl-171 · 2026-10-11T11:11:30.739Z

Fixed A-1206 TS2345 at c81ba51aad29d75fda6a51d4ee638ce9f08de68a by narrowing postedVerdicts.shift() and omitting the verdict context key when absent. Local npm run typecheck exit 0, diff check passes. Real-path warning logic/tests remain as A-1205. Fetched/merged origin/dev immediately before replacement suite: already up to date; pushed current head. C4 still pending full suite.

### rev-13 · 2026-10-11T11:16:04.539Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-171-2
commit: c81ba51aad29d75fda6a51d4ee638ce9f08de68a

No high, medium or low findings remain. Real task verdict and session-death events now carry warning facts into the shared classifier and actual inbox/Agents marker flow; needsYou stays unchanged. Real-path protocol/headless coverage and both warning docs support C1–C3. The optional-context fix also passes independent typecheck; diff check passes and local/pushed heads match clean c81ba51.

C4 remains pending the fresh full suite. A-1206 failed on superseded 39997a9 and does not establish C4. A-1210: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1210-t-171-corrected-real-path-warnings-at-c81ba51-c1-c3-clear.md records the separate Standards and Spec reviews. No reviewer edits or suite runs.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-13 · 2026-10-11T11:39:24.860Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261011-171-3
commit: c81ba51aad29d75fda6a51d4ee638ce9f08de68a

Medium — nvim/test/artifacts.test.ts:252: A-1222 fails waiting for the initial editable draft and shows "no such artifact", so C4's required passing full suite is unmet. This occurs before the move/reconnect portion; cause and relation to T-171 are unproven.

Typecheck completed; hub 1170/1170 and Neovim 271/272, total 1441/1442, one failure, zero cancellations/skips/todo, exit 1. The real D17 warning protocol test passed. C1–C3 same-head verification in rev-13-20261011-171-2 stands. No exception applies; no edits or reviewer tests. A-1223: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1223-t-171-c4-at-c81ba51-full-suite-fails-artifact-draft-opening.md records separate axes and evidence.

Criteria: C4 failed (A-1222 full suite exits 1: artifacts.test.ts:252 times out opening the initial editable draft with no such artifact; hub 1170/1170 and Neovim 271/272.).

### impl-171 · 2026-10-11T11:41:11.320Z

A-1222's only failure was the moved-draft test opening by id before artifact.list populated the client cache. Per Coordinator e41beef0, fixed both moved-draft tests in separate test-only commit 7eb519c: existing eventually waits for artifacts.get(source.id) before open, with no timeout/assertion changes. Both targeted tests pass 2/2; local typecheck passes. Fetched/merged origin/dev 1697ced before the next full suite; pushed new head 174f68707a76f92f2ba345509172fa99e15a964e. Evidence A-1224.

### rev-13 · 2026-10-11T11:42:55.380Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-171-4
commit: 174f68707a76f92f2ba345509172fa99e15a964e

No high, medium or low source findings remain. The separate test-only readiness commit adds bounded source-artifact lookup waits in both moved-draft cases, preserving timeouts and all movement/reconnect/save assertions. Both axes are clear. The conflict-free dev merge retains the real warning implementation, coverage and docs, so C1–C3 are freshly verified at 174f687. Imported runner selection preserves explicit all as full Hub and Neovim coverage.

Independent typecheck and diff checks pass; clean local/pushed heads match. C4 remains pending the fresh full suite at this new head; A-1222 is historical failed evidence at c81ba51. No exception applied. A-1226: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1226-t-171-readiness-only-fix-at-174f687-c1-c3-clear-c4-pending.md records separate axes. No reviewer edits or suite runs.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-171 · 2026-10-11T12:33:52.077Z

Final same-head all suite 6fd207e6-be80-43f7-8b1d-975015af532c passed at 174f68707a76f92f2ba345509172fa99e15a964e: typecheck and both package phases completed, 1483/1483 passed, 0 failures/cancellations/skips/todo, exit 0. Log A-1256: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1256-suite-6fd207e6-be80-43f7-8b1d-975015af532c-all-at-174f687.log. C4 marked done; asking rev-13 to refresh final review verification. Head remains unchanged and clean.

### rev-13 · 2026-10-11T12:34:24.700Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-171-5
commit: 174f68707a76f92f2ba345509172fa99e15a964e

No high, medium or low findings. C4 verified from complete same-head A-1256: typecheck passes, hub 1211/1211 plus Neovim 272/272, total 1483/1483, zero failures/cancellations/skips/todo, exit 0. The real verdict/death warning protocol test and both moved-draft tests pass. C1–C3 same-head verification in rev-13-20261011-171-4 stands; all criteria now supported.

Clean local/pushed heads match 174f687. No exception applied; the old-head A-1222 failure is superseded by this complete successful result. A-1257: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1257-t-171-final-c4-at-174f687-full-1483-1483-clear.md records separate axes and final validation. No edits or reviewer suite runs.

Criteria: C4 verified.

### coord · 2026-10-11T12:34:42.086Z

Merged b1add761e44d0249127298dcf5240a4dd809a617 onto dev.

### coord · 2026-10-11T12:34:55.055Z

Merged at b1add76. The merge commit's subject repeats the original title ('in needsYou, each with a resolution rule'). What landed is the D17 rescope: not-clear verdicts and session deaths are warn-level events in the inbox and event log, they never count in needsYou, and there is no resolution rule. It also carries the shared moved-draft test fix 7eb519c, so dev's artifacts.test.ts defect is fixed.
