---
id: T-525
kind: task
title: "pid-identity test: staged reused-PID start stamp can equal the real one within the same second (Linux)"
state: open
status: review
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
updated: 2026-10-15T22:32:37.046Z
---

## Problem

`hub/test/pid-identity.test.ts:128`, 'Claude Code: a stop whose claude stop fails never SIGTERMs a pid that another process reuses', failed on Linux in T-510's droplet verify 0ea19bdd (A-3306:4024–4034). The test stages a different start identity for a reused PID, but the staged and the real `ps` start stamps matched to the second ('Thu Oct 15 19:28:27 2026'). Process start identity has one-second resolution, so a reuse within the same second is indistinguishable.

## Acceptance criteria

- [x] C1. The test stages a start identity that provably differs (for example, a stamp outside the real process's second) rather than one that can collide. The commit also states whether the product's PID-reuse guard has the same one-second blind spot. If it does, file that separately with its risk.
  - done: impl-525 · 2026-10-15T22:31:25.413Z
  - verified: rev-30 [reviewer] · run rev-20261015-525-source · 2026-10-15T22:32:37.046Z · commit b1dfa5e1c6bcbaee4f4a87ce961556a16dca4d39
- [ ] C2. pid-identity.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

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
