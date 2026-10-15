---
id: T-507
kind: task
title: "subscriptions test: T-486 now keeps a completed first turn's idle, but the test expects only 'impl launched'"
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-486
topic: topic-305
branch: t/T-507-subscriptions-test-t-486-now-keeps-a
created: 2026-10-15T15:16:16.512Z
updated: 2026-10-15T16:18:06.429Z
closed: 2026-10-15T16:18:06.429Z
---

## Problem

`hub/test/subscriptions.test.ts:453/:472` expects only 'impl launched' in a terminal role-update case. On a head that carries T-486 (4db6ed9c), T-495's droplet verify d6e75622 (A-3101) also got 'impl idle'. T-486's fix keeps a completed first turn's idle instead of overwriting it with busy, so the idle event is now legitimate when the fake's first turn finishes quickly. The test's expectation predates that. It's rework of T-486; the watch item on E-482 at 13:09Z said to file it if it recurred after T-486.

## Acceptance criteria

- [x] C1. The case expects the event set that T-486's launch ordering produces. It either accepts 'impl idle' after 'impl launched' when the first turn has completed, or it holds the fake's first turn so that idle can't arrive inside the window. Record which, and why, in the commit.
  - done: impl-507 · 2026-10-15T15:21:51.990Z
  - verified: rev-31 [reviewer] · run rev-20261015-507-source · 2026-10-15T15:24:40.279Z · commit a81a396db4d2fb9661037e6e0bb3940e5bebab8b
- [x] C2. subscriptions.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
  - done: impl-507 · 2026-10-15T16:02:43.150Z
  - verified: rev-31 [reviewer] · run rev-20261015-507-final · 2026-10-15T16:03:04.370Z · commit a81a396db4d2fb9661037e6e0bb3940e5bebab8b

## Comments

### impl-507 · 2026-10-15T15:18:51.946Z

Diagnosis is already evidenced by T-495 droplet d6e75622 (A-3101) on T-486. Using the existing terminal-role-update integration case as the regression seam; skipping a new broad hypothesis hunt because the ticket identifies the stale event expectation and permits either accepting completed-turn idle or gating the fake. Plan: explicitly wait for resumed first-turn idle, then require exactly launched followed by idle, retaining the no-prior-terminal-replay assertion.

### impl-507 · 2026-10-15T15:23:59.607Z

Implemented C1 at 88358be5; review head a81a396db4d2fb9661037e6e0bb3940e5bebab8b pushed to origin. Waits for resumed idle, then requires exactly launched followed by idle; no terminal replay permitted. A-3110 captures deterministic old-assertion failure. Five serial quiet Mac whole-file passes (15/15 each) and typecheck exit 0 are in A-3113, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3113-t-507-five-serial-quiet-mac-whole-file-passes.log. C2 awaits the post-source-review droplet verify. Shared fixes e9578029 and 18e5c465 picked as 2a44b257 and a27f36d8; dev merged before the new no-default-dev-merge instruction. No QA required by item policy.

### rev-31 · 2026-10-15T15:24:40.279Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261015-507-source
commit: a81a396db4d2fb9661037e6e0bb3940e5bebab8b
scope: full

Source review clear at a81a396db4d2fb9661037e6e0bb3940e5bebab8b. No high, medium or low findings.

## Standards
No documented-standard or baseline-smell findings. The only task diff is the terminal-session role-update case. The wait observes a concrete event and uses the existing wait deadline; no sleeps, assertion removal or production change. Diff check passes.

## Spec
C1 verified at hub/test/subscriptions.test.ts:469-475: after relaunch, explicitly wait for launched and first-turn idle, then require the exact ordered pair. The subscription is created only after stop, so those event notices cannot be satisfied by initial pre-subscription messages. The original metadata-update subscription-equality assertion remains, and any replayed terminal notice still adds an unexpected event and fails exact history equality. Commit 88358be5 explicitly chooses completed-turn idle acceptance over holding the fake and explains why.
A-3110 checked: adding the idle wait while retaining the old expected list deterministically fails on the single legitimate extra idle notice. A-3113 checked: five quiet serial whole-file passes, 15/15 each, 75/75 total, no failures/skips/cancellations; changed case 1.987-3.001 s. Artifact records typecheck exit 0 and unchanged test content across the final dev merge/shared manifest fixes.

C2 Mac portion is evidenced; C2 remains unverified pending accepted exact-head post-source droplet verification.
Standards: 0 findings. Spec: 0 findings. No Reviewer tests or edits.

Criteria: C1 verified.

### impl-507 · 2026-10-15T16:02:45.600Z

C2 complete: A-3113 records five serial quiet Mac whole-file passes, 15/15 each. Exact reviewed head a81a396db4d2fb9661037e6e0bb3940e5bebab8b passed droplet verify 39ece7b6-0ae3-4f5e-99c5-7e56f574fdf6 (A-3141), Linux x64 c-8, 1784 tests / 1781 pass / 0 fail / 3 skip. subscriptions.test.ts includes all 15 cases; changed terminal-role-update case green in 6.092 s under 4-worker Linux load. Droplet lifetime 1403 s, cost $0.0974. No head changes or local tests during cover-quiet. Awaiting Reviewer's final verdict; Coordinator merge waits through restart hold.

### rev-31 · 2026-10-15T16:03:04.370Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261015-507-final
commit: a81a396db4d2fb9661037e6e0bb3940e5bebab8b
scope: evidence

Final review clear at unchanged a81a396db4d2fb9661037e6e0bb3940e5bebab8b. No unresolved source findings.

## Standards
Source review rev-20261015-507-source stands. No new findings; branch head matches the reviewed and verified commit.

## Spec
C1 source verification retained: wait for resumed first-turn idle, then require exactly launched followed by idle; metadata-update subscription identity and prior-terminal-replay detection remain intact. Commit records the chosen completed-idle acceptance.
C2 verified: A-3113 supplies five labelled quiet serial Mac whole-file passes (15/15 each, 75/75 total), and A-3141 supplies all fifteen subscription cases green on Linux under four-worker load. Changed case passes in 6.092 s (A-3141:2769); no subscription case skipped.

Accepted exact-head gate: 39ece7b6-0ae3-4f5e-99c5-7e56f574fdf6 / A-3141, droplet Linux x64 c-8, exit 0, 1781 pass / 0 fail / 3 macOS-only skips / 0 cancelled. Host/remote typecheck and hub plus Neovim smoke complete; smoke 12/12. Skips are two sandbox-exec cases and macOS sleep inhibitor. Existing duration notices do not fail the receipt. No exception needed.
Standards: 0 findings. Spec: 0 findings; C1 retained, C2 verified. No Reviewer tests or edits.

Criteria: C2 verified.

### coord · 2026-10-15T16:18:06.429Z

Merged e376da65d9a2e4a9ba844d0034684ea30b02b178 onto dev.
