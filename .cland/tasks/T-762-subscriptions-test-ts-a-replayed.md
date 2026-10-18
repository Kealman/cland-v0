---
id: T-762
kind: task
title: "subscriptions.test.ts: a replayed terminal session fact reaches a subscription created for the next launch on a slow droplet"
state: open
status: ready
size: S
criterion_seq: 1
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-471
branch: t/T-762-subscriptions-test-ts-a-replayed
created: 2026-10-17T22:57:33.480Z
updated: 2026-10-18T03:39:00.166Z
---

## Summary

In droplet run 4458319f (T-752 at 9096e2b4, A-4824, 2026-10-17 at 22:53Z), the droplet was very slow: the run took 2890 s, with name-reservation going from 23 s to 84 s. There, hub/test/subscriptions.test.ts:453, "a terminal session role update preserves a subscription created for its next launch", failed at line 475: "the prior terminal fact must not replay into a new subscription". It expected only `impl launched` and `impl idle`, and saw a replayed earlier fact. The same file passes 5/5 serially on the Mac at the same head (A-4833). T-752's diff doesn't touch subscriptions.

## What to build

The test waits on the hub's receipt that the terminal fact was recorded before it creates the next subscription, or the hub's replay cut-off becomes explicit. A slow store can then no longer reorder the replay window.

## Acceptance criteria

- [x] C1. The A-4824 failure is explained with evidence, and the case passes 20/20 serially at the current dev head (after T-702's T2 migration to an explicit FakeHarness), with the assertion unchanged.
  - done: impl-762 · 2026-10-18T03:37:45.985Z
  - verified: rev-30 [reviewer] · run rev-20261018-762-final · 2026-10-18T03:38:59.708Z · commit 37c4921cbc1b15274525c5ca9030db3353162f19

## Comments

### impl-762 · 2026-10-18T03:09:34.097Z

Diagnosis: A-4824 lines 30038–30057 show launched, busy, idle (no stopped/died replay). Historical native fake runs a real resumed prompt turn: setStatus('busy'), UserPromptSubmit, turn.start, then completion; the adapter maps UserPromptSubmit to busy. T-702 (88882dde) already replaces this case with componentHub + explicit FakeHarness + explicit idle; FakeHarness inject/resume do not synthesize busy. Coordinator revised C1 to evidence + 20/20 serial current-dev repeats with unchanged assertion and directed no strengthening. Awaiting macOS stage-window end before repetitions.

### impl-762 · 2026-10-18T03:37:46.617Z

C1 evidence complete: causal analysis A-4907; unchanged focused case 20/20 serial at current-dev 37c4921cbc1b15274525c5ca9030db3353162f19 (A-4930), load1 6.06–6.16, invocation duration 0.420–0.778 s, median 0.527 s, total 11.286 s. Prior 20/20 also passed at d392167a; only tracker files changed between heads. No source changes or commit needed; branch head pushed to origin. typecheck and test:tiers passed; test:lint passed with its existing report-only diagnostics (A-4931). No touched files; per Coordinator decision this is a no-code evidence review, and Coordinator closes after clear verdict.

### rev-30 · 2026-10-18T03:38:59.708Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-762-final
commit: 37c4921cbc1b15274525c5ca9030db3353162f19
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-4934: no Standards or Spec findings. Primary Coordinator ba5c8576 authorizes this no-code evidence item and Coordinator closure. A-4824 actual list adds busy, not a terminal stopped/died replay; historical native fake resume can emit genuine busy through turn-start, while terminal checkpoint/subscription fan-out are synchronous. Merged T-702 explicitly controls FakeHarness idle and does not call busy/turn. Final deepEqual assertion remains unchanged. Audited A-4930 at current-dev/branch head 37c4921c: exactly 20/20 serial positive case receipts, all exit 0, zero failures/cancellations/skips; invocation wall 0.420–0.778s, median 0.527s, total 11.286s, recorded load 6.06–6.16. No source delta, new implementation or merge is proposed; C1 verified.

Criteria: C1 verified.
