---
id: T-525
kind: task
title: "pid-identity test: staged reused-PID start stamp can equal the real one within the same second (Linux)"
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-333
branch: t/T-525-pid-identity-test-staged-reused-pid
created: 2026-10-15T19:39:57.986Z
updated: 2026-10-15T23:26:19.283Z
---

## Problem

`hub/test/pid-identity.test.ts:128`, 'Claude Code: a stop whose claude stop fails never SIGTERMs a pid that another process reuses', failed on Linux in T-510's droplet verify 0ea19bdd (A-3306:4024–4034). The test stages a different start identity for a reused PID, but the staged and the real `ps` start stamps matched to the second ('Thu Oct 15 19:28:27 2026'). Process start identity has one-second resolution, so a reuse within the same second is indistinguishable.

## Acceptance criteria

- [x] C1. The test stages a start identity that provably differs (for example, a stamp outside the real process's second) rather than one that can collide. The commit also states whether the product's PID-reuse guard has the same one-second blind spot. If it does, file that separately with its risk.
  - done: impl-525 · 2026-10-15T22:31:25.413Z
  - verified: rev-30 [reviewer] · run rev-20261015-525-source · 2026-10-15T22:32:37.046Z · commit b1dfa5e1c6bcbaee4f4a87ce961556a16dca4d39
  - verified: rev-30 [reviewer] · run rev-20261015-525-final · 2026-10-15T23:26:08.463Z · commit b1dfa5e1c6bcbaee4f4a87ce961556a16dca4d39
- [x] C2. pid-identity.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
  - done: impl-525 · 2026-10-15T22:56:17.180Z
  - verified: rev-30 [reviewer] · run rev-20261015-525-final · 2026-10-15T23:26:08.463Z · commit b1dfa5e1c6bcbaee4f4a87ce961556a16dca4d39

## Comments

### impl-525 · 2026-10-15T22:29:40.250Z

Read E-482 decisions and v0.1.3 spec. Test-only correction stages an explicit historical pid_started instead of relying on Date.now()/ps clock boundaries. Preserves the real original identity check, live original and bystander, mismatched recorded/live identity, stop refusal and bystander survival. Existing Linux failure A-3306 supplies the repro evidence; no new test is needed for this fixture-only correction. Product sameProcess uses the same whole-second lstart equality, reported separately to lead T-525 as Bugs/M with unrelated-process signal risk.

### impl-525 · 2026-10-15T22:31:53.694Z

Committed and pushed b1dfa5e1c6bcbaee4f4a87ce961556a16dca4d39 on t/T-525-pid-identity-test-staged-reused-pid. origin/dev fetched and merged before first review (already up to date). Five quiet Mac whole-file passes, 3/3 each, 9.96–10.78 s per file, preflight loads 3.90–4.48, local none and free before each run. Durable evidence A-3406: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3406-t-525-five-quiet-mac-whole-file-passes-and-pid-guard-finding.md. Hub typecheck and diff check pass. C1 product finding filed as T-543. C2 droplet portion pending clear source review.

### rev-30 · 2026-10-15T22:32:37.046Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-525-source
commit: b1dfa5e1c6bcbaee4f4a87ce961556a16dca4d39
scope: full

Source review T-525 clear at b1dfa5e1c6bcbaee4f4a87ce961556a16dca4d39. No high, medium or low findings. Standards and Spec reviewed directly under the no-delegation role.

C1 verified: one-file8+/3- correction stages an explicit historical pid_started on the Claude stop row after pointing its PID at the live bystander. It no longer assumes Date.now()/ps second boundaries prove different identities. Preconditions still prove a running staged row, original fake alive, its actual recorded start identity observable/equal to the real original, staged PID equals the live bystander, staged timestamp equals the intended historical value, and bystander OS start is nonnull and differs. Stop refusal/error and bystander survival assertions and15s request bound are retained. The earlier original-identity assertion is checked against the original row snapshot rather than the intentionally restaged row, preserving its meaning.

Commit explicitly identifies the production same-second blind spot and unrelated-process signal risk. Independently confirmed separately filed Bugs/M T-543: whole-second lstart equality may accept a replacement under same-second PID churn, with stronger identity and refusal tests required there. This test-only correction does not claim to fix that product issue.

Standards: no product source, test name, fixture helper, timeout, manifest or baseline changes. Explicit mismatch is observable rather than a null-probe shortcut. Whitespace check clear; hub typecheck reported green. A-3406 includes five complete quiet serial Mac whole-file passes,15/15 cases, zero failures/cancellations/skips,9.960–10.776s, preflight local:none/free and loads3.90–4.48. Both other adapter cases remain green.

C2 remains UNVERIFIED until the required actual droplet file pass in the task's same-head verification. Mac portion is accepted; source clearance permits one exact-head --executor droplet --fresh verification under current Coordinator admission/budget rules. No per-item QA criteria. No Reviewer tests, edits, merges or provider actions.
Evidence /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3406-t-525-five-quiet-mac-whole-file-passes-and-pid-guard-finding.md.

Criteria: C1 verified.

### impl-525 · 2026-10-15T22:56:36.381Z

First droplet verify 360bd15d / A-3426 at b1dfa5e1 completed: PID-identity 3/3 green, changed Claude case 4.489s. Overall 1852 tests, 1848 pass, 1 fail, 3 skip; sole red session-model.test.ts:108 reversed subagent usage order is known E-482 T-544. c-8 lon1 Linux, workers 4, lifetime 1355s, cost $0.0941. C2 evidence complete. Required second fresh same-head run submitted: 74cc892a-ecb5-4388-9116-778474ecd79d. No code/head changes; final review evidence verdict pending retry.

### rev-30 · 2026-10-15T22:56:57.095Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-525-linux-first
commit: b1dfa5e1c6bcbaee4f4a87ce961556a16dca4d39
scope: evidence

T-525 first Linux evidence review not clear at unchanged b1dfa5e1c6bcbaee4f4a87ce961556a16dca4d39. A-3426 / 360bd15d-75ab-4a30-adf0-dc6be9bec8ee is actual Linux c-8 lon1, workers 4, exit 1: 1848 pass, 1 fail, 3 platform skips, no cancellations. Hub completed; Neovim smoke was not reached. Duration 1257.17s, peak load 13.11, lifetime 1355s/$0.0941.

Medium gate blocker — hub/test/session-model.test.ts:108: exact two usage rows arrive unknown-child before known-child, failing the order-dependent deepEqual. Independently matched open T-544's current item and source-reviewed normalization A-3422. This is outside T-525's unchanged diff. No unknown failure or hard duration-budget failure is printed.

Own pid-identity file is green 3/3, with complete timings at A-3426:5028–5030: Codex 6.474s, changed Claude 4.489s, OpenCode 4.906s. Together with A-3406's five quiet serial Mac whole-file passes, the run-dependent file evidence for C2 is established, but final criterion verification waits for an acceptable overall gate. Source C1 A-3408 remains clear; T-543 remains the separately filed product identity risk. No criterion is failed on an outside test.

A-3426 may serve as the first known-only Linux receipt under E-482, not final clearance by itself. task.view already records unchanged-head retry 74cc892a-ecb5-4388-9116-778474ecd79d launching. Await that result; no additional submission or task-source change is indicated. Do not count any earlier own-failure run as gate evidence.

Log /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3426-suite-360bd15d-75ab-4a30-adf0-dc6be9bec8ee-auto-at-b1dfa5e.log. No Reviewer tests, edits, merges or provider actions.

Review artifact A-3431 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3431-t-525-first-linux-receipt-pid-file-green-known-t-544-blocks-final-gate.md.

### impl-525 · 2026-10-15T23:25:38.716Z

Second fresh exact-head droplet verify 74cc892a / A-3443 is green at b1dfa5e1c6bcbaee4f4a87ce961556a16dca4d39: 1864 tests, 1861 passed, 0 failed, 3 skipped; hub plus Neovim smoke. Linux c-8 lon1, workers 4, lifetime 1712s, cost $0.1189. C2 is covered by 5/5 quiet Mac whole-file passes A-3406 and green Linux receipt A-3443. Source unchanged since clear A-3408. Final Reviewer evidence verdict pending.

### rev-30 · 2026-10-15T23:26:08.463Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-525-final
commit: b1dfa5e1c6bcbaee4f4a87ce961556a16dca4d39
scope: evidence

Final evidence review T-525 clear at b1dfa5e1c6bcbaee4f4a87ce961556a16dca4d39. No high, medium or low findings. Source clearance A-3408 stands; branch and verification head match.

C2 verified. A-3406 contains five complete serial whole-file Mac runs, 3/3 each (15 passes), zero failures/cancellations/skips. Wall times 10.612/9.960/9.990/10.437/10.776s, local:none and no other test file at admission, loads 3.90–4.48, explicitly quiet with remote integrated runs allowed. This evidence remains at the unchanged reviewed source.

A-3443 / 74cc892a-ecb5-4388-9116-778474ecd79d is actual Linux c-8 lon1, workers 4, hub-only, exit 0: 1861 passes, zero failures/cancellations, three platform skips. Host/remote typecheck, hub and Neovim smoke complete. All three pid-identity cases pass; timing records :4988–4990 give Codex 7.580s, changed Claude 4.880s, OpenCode 7.928s. Suite 1622.45s, peak load 12.76, lifetime 1712s/$0.1189. No hard duration-budget failure. The first receipt A-3426's unrelated T-544 row-order failure did not recur, so no known-flake exception is required for final clearance.

C1 reverified against standing source review: explicit historical staged identity plus nonnull observed bystander identity and inequality prevent the fixture's same-second collision. Original identity/liveness, stop refusal and bystander survival checks remain. Commit records the product's separate coarse-time blind spot and unrelated-process signaling risk; Bugs/M T-543 remains that product follow-up, not solved by this test-only correction.

All criteria checked across source and completed same-head evidence. No per-item QA criteria. Changed integration heads require delta review. No Reviewer tests, compiler/binary execution, edits, signals, merges or provider actions.

Evidence A-3443 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3443-suite-74cc892a-ecb5-4388-9116-778474ecd79d-auto-at-b1dfa5e.log; A-3406 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3406-t-525-five-quiet-mac-whole-file-passes-and-pid-guard-finding.md.

Review artifact A-3444 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3444-t-525-final-clear-at-b1dfa5e1-five-mac-files-and-green-linux-pid-proofs.md.

Criteria: C1 verified, C2 verified.
