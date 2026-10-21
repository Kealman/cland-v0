---
id: T-1053
kind: task
title: Unread counts with every message delta and one merged sessions projection
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
topic: topic-806
branch: t/T-1053-unread-counts-with-every-message-delta
created: 2026-10-21T14:04:14.662Z
updated: 2026-10-21T14:53:54.746Z
closed: 2026-10-21T14:53:54.746Z
---

## Summary

Send a topic's unread count and last message time with every message delta, and give clients one merged sessions projection.

## Parent

E-413 (§3.3 "Unread counts" and "Merged session rows"; tracer step 2).

## What to build

A topic's `unread` (per human) and `lastMessageAt` travel with every message delta, so no client counts `message` frames. Sessions arrive as one projection per row: the process row with presence, the role, the item (a verifier's hold with +N, or a requested item marked as requested, per v0.1.2 §3.4), the state with its age and the command it waits on, the account and the usage. The two reads clients merge today (processes and presence) stay available for compatibility.

## Acceptance criteria

- [x] C1. A frame client's unread count and last message time for a topic follow three new messages from the deltas alone, and a `topic.read` resets the count (test).
  - done: impl-1053 · 2026-10-21T14:28:55.783Z
  - verified: rev-32 [reviewer] · run rev-20261021-1053-final · 2026-10-21T14:49:46.148Z · commit 7163fff8a844c424c64187a52c1b9cb21c429898
- [x] C2. A verifier's merged session row carries its hold with +N, a waiting row carries its state age and the command it waits on, and a row carries account and usage (test).
  - done: impl-1053 · 2026-10-21T14:28:55.815Z
  - verified: rev-32 [reviewer] · run rev-20261021-1053-final · 2026-10-21T14:49:46.148Z · commit 7163fff8a844c424c64187a52c1b9cb21c429898
- [x] C3. A presence or process change produces one merged row delta, not two partial ones (test).
  - done: impl-1053 · 2026-10-21T14:14:58.135Z
  - verified: rev-32 [reviewer] · run rev-20261021-1053-final · 2026-10-21T14:49:46.148Z · commit 7163fff8a844c424c64187a52c1b9cb21c429898
- [x] C4. `hub/README.md` describes `unread`, `lastMessageAt` and the sessions projection.
  - done: impl-1053 · 2026-10-21T14:14:58.169Z
  - verified: rev-23 [reviewer] · run rev-20261021-1053-source · 2026-10-21T14:18:27.267Z · commit b3ce2e336adb07c23ed33143e65a2314f1128f70
  - verified: rev-23 [reviewer] · run rev-20261021-1053-source-2 · 2026-10-21T14:29:31.602Z · commit 3e2fc1659637c1593df179480ae85670585b210a
  - verified: rev-32 [reviewer] · run rev-20261021-1053-delta · 2026-10-21T14:41:10.129Z · commit 7163fff8a844c424c64187a52c1b9cb21c429898
  - verified: rev-32 [reviewer] · run rev-20261021-1053-final · 2026-10-21T14:49:46.148Z · commit 7163fff8a844c424c64187a52c1b9cb21c429898

## Comments

### impl-1053 · 2026-10-21T14:14:49.358Z

Implemented the additive topic fields and merged session projection. TDD at the agreed T2 frame seam: unread started red (undefined !== 1), merged rows started red (snapshot supplies complete session rows), and snapshot-only subscribers started red (no session.row received), then each passed after implementation. New tests cover authoritative counts/times/read resets; verifier holds/+N and pending work; waiting command/state age; a named account and usage; one complete row per presence/process/hold change; fresh-snapshot equivalence; rename, disconnect and unknown-identity removals. Legacy process and presence reads/events retained. origin/dev merged before first review; reviewed candidate head will be b3ce2e336adb07c23ed33143e65a2314f1128f70. Per-item QA is not required (affected after-stage policy; no QA brief supplied).

### rev-23 · 2026-10-21T14:18:27.267Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1053-source
commit: b3ce2e336adb07c23ed33143e65a2314f1128f70
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-8450 records complete11-file Standards/Spec audit against fixed devb4264fdd merged before review. No findings. Authoritative unread/lastMessageAt attach to message publication/reprojection; existing read/reset rules retained. Shared session composer combines process/presence/current holds/pending/stateSince/approval/account/usage; complete changed rows coalesce and replace/remove by stable key, with unknown names distinct. Snapshots share composition, numbered ring and feature delivery paths checked; compatibility process/presence retained. T2 frame tests preserve exact-boundary observers, fake time, fresh-snapshot equivalence, single-row fencing and removal assertions; wire equality/manifests/docs updated. C4 verified from README; C1–C3 await same-head queued execution/load receipts. A-8448 local targeted4/4/check claims are development evidence, no suite pass claimed. Proceed mode-free configured verification at unchanged reviewed head, then evidence review. No Reviewer runtime; affected after-stage QA remains separate.

Criteria: C4 verified.

### impl-1053 · 2026-10-21T14:26:55.899Z

Failed run 117424cc (A-8457) repaired at pushed head 3e2fc1659637c1593df179480ae85670585b210a. Existing topics-component exact-shape assertion now includes the required message-topic unread/lastMessageAt fields; the new named-account test injects accountReader to keep it in-process. No production source changes and no dev merge. Both affected T2 files pass 4/4 locally on macOS arm64; typecheck passes. Fresh source review requested before re-verification.

### rev-23 · 2026-10-21T14:27:34.955Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1053-evidence-red
commit: b3ce2e336adb07c23ed33143e65a2314f1128f70
scope: evidence
findings: [{"severity":"medium","text":"A-8457 enforced deepEqual expects bare id/title while actual message topic adds required unread0 and lastMessageAt. Update exact full expected contract against message.ts without weakening id/title/message/stage/ack assertions.","file":"hub/test/topics-component.test.ts","line":82},{"severity":"medium","text":"New named accounts.toml activates a real account probe: A-8457 log11098 T2 forbids child_process.spawn, stack accounts/poller.ts:208. Inject existing projectHub.accountReader to retain account/usage/waiting assertions within T2; report-only tripwire is not resource-policy clearance.","file":"hub/test/computed-sessions.test.ts","line":81}]
finding_counts: {"high":0,"medium":2,"low":0}

Historical failed evidence, not clear atb3ce2e33; A-8463 details A-8457/117424cc. Actual expected bare{id,title},actual includesunread0/lastMessageAt at11076–11094; new named-account fixture also emits report-only T2 native-spawn violation. Linux T1pass/interruptedT2fail,ordinary1969pass1fail plus20loadpasses,Webabsent. C1/C2failed; no final C3verification; C4docssource remains historical. Hostcheck809d055e reused; lint132/59,duration/ratchet/tripwire report-only,M1assertionenforced. Lead already submitted corrected3e2fc165; reviewing it next. No source/runtime pass atnewhead claimed; no Reviewer execution.

Criteria: C1 failed (A-8457 fails existing topics-component exact TopicRef contract at82 after required unread/lastMessageAt additions.), C2 failed (The new named-account T2 fixture launches native account polling (tier tripwire accounts/poller.ts:208); use existing accountReader seam.).

### rev-23 · 2026-10-21T14:29:31.602Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1053-source-2
commit: 3e2fc1659637c1593df179480ae85670585b210a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-8468 extends full A-8450 audit, Standards0/Spec0. Only2testfiles/3insertions3deletions, no production/doc change or devmerge. M1 exact topic assertion retains id/title plusunread0/lastMessageAt message.ts and message/stage/ack assertions. M2 named-account fixture injects existing accountReader, preserving registry/account/fake usage/state/hold scheduling at T2 without native probe; no policy suppression. Requested cross-client audit now complete per4fdda143, independently checked exact topic comparisons: deliver/send reply TopicRef intentionally unchanged. C1/C2 done refreshed; unchanged README C4 reverified. C1–C3 require replacement exact-head queued result/owned load receipts. OldA-8457 is failed/interrupted, not green despite20loadpasses. Proceed mode-free configured verification unchanged3e2fc165. No Reviewer runtime; affected after-stage QA separate.

Criteria: C4 verified.

### impl-1053 · 2026-10-21T14:37:50.453Z

Replacement run 8c9946b8 (A-8475) at reviewed 3e2fc165 completed 2330/2330 assertions successfully including all four new identities 5/5 under load, with no computed-sessions tier mismatch. Linux x64 droplet: T1 exit 0, all-T2 fallback exit 0, Web exit 1 solely on enforced new-test duration gate for merged T-996 web/test/palette.test.ts::the palette and area keys help (6.441 s > 5 s). Overall verification remains failed. Reported shared duration-gate candidate to lead T-1053; holding head unchanged until the Coordinator posts the shared fix/disposition.

### impl-1053 · 2026-10-21T14:39:16.116Z

Applied only Coordinator-posted shared fix 3d1d3aed under rule 11, cherry-picked as pushed head d160161b4ace8d14120379cbab34787d3c1cde06. This adds the dated 8 s allowance for the merged palette test, owner E-880, expiry 2026-10-28. No other dev changes and no production source edits. Requesting one-commit delta source review before mode-free verification at the new head.

### impl-1053 · 2026-10-21T14:39:36.052Z

Coordinator amended shared fix: added 385f4e79 after 3d1d3aed, as instructed. New pushed head 7163fff8a844c424c64187a52c1b9cb21c429898, net allowance 12 s (measured up to 8.285 s), owner E-880, expiry 2026-10-28. Delta source review request supersedes d160161b. No other dev changes or production edits.

### rev-32 · 2026-10-21T14:41:10.129Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261021-1053-delta
commit: 7163fff8a844c424c64187a52c1b9cb21c429898
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

## Standards

Delta source review clear at 7163fff8a844c424c64187a52c1b9cb21c429898. No findings. Scope is the two shared-fix cherry-picks over rev-23's clear full source verdict at 3e2fc165, not a repeat of the implementation review.

Independently compared both patches: d160161b matches posted 3d1d3aed, and 7163fff8 matches 385f4e79. Net diff from 3e2fc165 touches only hub/test/durations.json (+7 lines), adding one exact Web palette test allowance. No production/test code, existing allowance, baseline, assertion, tier or dev merge changes. Request identifies Coordinator decisions b5dcb1e3 and superseding 2fea5675 authorizing these shared patches.

Allowance is 12 s, owner E-880 (confirmed open), UTC added 2026-10-21 / expires 2026-10-28, with concrete Linux c-8 measurements 5.98–8.285 s and pending T-1051 optimization. The exact test identity exists. Dates/reason/owner follow the documented dated-allowance policy. It changes the new-identity gate's temporary allowance; it does not establish a 4 s Web-tier budget pass.

## Spec

No findings in the delta. Prior reviewed unread/merged-session implementation and its corrected full topic assertion/injected account reader are unchanged. C4 independently rechecked: README describes authoritative topic.unread/lastMessageAt replacement, topic.read reset, merged SessionRow fields and coalesced row deltas. Refresh C4 by source; C1–C3 remain runtime-dependent at this new head.

Actual predecessor A-8475 failure: duration budget: web/test/palette.test.ts::the palette and area keys help 6.441 s > 5 s (add to hub/test/durations.json with a reason). Overall exit 1 at 3e2fc165; T1/T2 assertions passing do not make that run green. Superseded 8 s intermediate d160161b is not the reviewed head. A fresh configured mode-free result at 7163fff8 is required before final settlement, including its actual Web outcome and resource reports. No same-head tests or budget pass claimed; no Reviewer runtime execution.

Totals: Standards 0; Spec 0.

Artifact A-8485: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8485-t-1053-shared-allowance-delta-source-review-at-7163fff8.md

Criteria: C4 verified.

### impl-1053 · 2026-10-21T14:49:16.510Z

Green exact-head verification: run 74209b02 (A-8490) at 7163fff8a844c424c64187a52c1b9cb21c429898. Linux x64 c-8 droplet; T1, all-T2 fallback across hub/Neovim and Web all exit 0, 2310/2310 base tests. Host typecheck gate e95c3856 reused (not repeated). All four owned new identities have 5/5 load receipts, no computed-sessions runtime tier mismatch. Generic duration/tier lint census report-only; enforced new-identity gate satisfied with Coordinator-posted dated palette allowance. T3 deferred to periodic/integrated occasions; after-stage QA remains E-413's responsibility. Awaiting Reviewer's final same-head settlement; claim retained and no merge performed.

### rev-32 · 2026-10-21T14:49:46.148Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261021-1053-final
commit: 7163fff8a844c424c64187a52c1b9cb21c429898
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review clear at 7163fff8a844c424c64187a52c1b9cb21c429898. Branch tip, current delta verdict rev-20261021-1053-delta / A-8485 and hub receipt match. Implementation review remains rev-23's clear full source pass at 3e2fc165; only the exact posted shared allowance patches followed it. No findings; verify C1–C4.

A-8490 / mode-free run 74209b02-57cd-4a7e-a66b-69cefe401eb7 is fresh Linux x64 6.8.0-142-generic droplet c-8 lon1 evidence (Node v24.21.0, Neovim v0.12.5): overall exit 0; T1 exit 0 (47s), fallback all T2 across hub/Neovim exit 0 (275s), actual Web exit 0 (11s). Base report 2310/2310 passes, no failed/cancelled/skipped tests; new-case repetitions are separate. Host typecheck e95c3856bc087b4333af3e2816400ab80d97627a was reused, not repeated remotely. Web executed on four workers, hub/Neovim on two; lifetime 409s/$0.0284.

C1: current frame test passes three authoritative unread/lastMessageAt deltas, topic.read reset and human-message semantics, ordinary plus 5/5 load repetitions. C2: current merged-row test passes newest verifier hold/+N, requested work, waiting stateSince/command, presence, account and usage, ordinary plus 5/5. C3: complete row delta matches a fresh snapshot, with ordered-result publication fence asserting exactly one row after each presence/process/rename/disconnect action, ordinary plus 5/5. Snapshot-only unmanaged row/removal proof also passes ordinary plus 5/5. Inspected the current test contracts and final assertions. C4 README guidance was independently refreshed in A-8485.

Owned computed-sessions fixture now injects accountReader; no tripwire event names that file. Existing connection-snapshot account-poller mismatch remains in the log and was already filed by Coordinator 4aad190a as separate XS Tech debt; unchanged suite-admission-cost/web-authority native events likewise remain report-only diagnostics. This receipt does not assert universal T2 resource-policy clearance.

Lint 132 findings/59 files and tier/duration/ratchet diagnostics remain report-only, while new-identity duration enforcement passes with the dated shared palette allowance. Palette measured 5.884068653s under its temporary 12s allowance, not a 4s Web-tier budget pass. Shell/connection report-only overages and two missing-baseline median projections remain explicitly qualified. Prior A-8475 remains red at 3e2fc165.

T3/T4 did not execute and remain periodic/integrated landing evidence. No Reviewer tests or browser execution. Standards: 0 findings. Spec: 0 findings.

Artifact A-8492: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8492-t-1053-final-same-head-evidence-at-7163fff8.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-21T14:53:54.746Z

Merged 49e0a5482b6966525179ce2c5c974a96aecfca3c onto dev.
