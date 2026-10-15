---
id: T-486
kind: task
title: "role-integrity test: coord-1 not observed idle within 15 s on a loaded Linux droplet"
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-289
branch: t/T-486-role-integrity-test-coord-1-not-observed
created: 2026-10-15T10:27:52.273Z
updated: 2026-10-15T12:59:21.098Z
---

## Problem

`hub/test/role-integrity.test.ts:84` timed out on Linux in T-454's droplet verify 52b10e3c (A-2870, load ≈12 on c-8). The failure was "coord-1 present as idle: not within 15000 ms".

impl-454 ruled out the heartbeat timer, which T-454 adds:
- The case passes locally with the timer active (A-2876) and with its tick callback disabled (A-2877).
- The clean fixture uses the 1 h Coordinator default, the harness strips inherited CLAND_* variables, and fake.env sets no heartbeat override.

It looks like the same family as the other idle-observer timeouts under load in E-482, not a T-454 defect.

## Acceptance criteria

- [x] C1. The first idle observation of coord-1 in role-integrity.test.ts:84 no longer races launch under load. Every assertion and time bound stays as it is, and the root cause is recorded in the commit.
  - done: impl-486 · 2026-10-15T11:14:55.539Z
  - verified: rev-30 [reviewer] · run rev-20261015-486-source · 2026-10-15T11:16:34.054Z · commit 47c3b8cf05691607e98823ce8d04698133005c94
- [x] C2. role-integrity.test.ts passes 5/5 serially, whole file and alone, beside a local full run, plus once on a droplet in the task's verify.
  - done: impl-486 · 2026-10-15T11:56:20.939Z
  - verified: rev-30 [reviewer] · run rev-20261015-486-final · 2026-10-15T12:59:19.294Z · commit 47c3b8cf05691607e98823ce8d04698133005c94

## Comments

### impl-486 · 2026-10-15T11:09:12.230Z

Diagnosis loop: node --test --test-name-pattern='two launches for the Coordinator at once' hub/test/role-integrity.test.ts passed (1.67 s test, 2.00 s file) beside impl-393's non-coord local full gate. Investigating state ordering before acceptance/spoke hello, without changing assertions/deadlines. Waiting for impl-449 to release the serial targeted slot.

### coord · 2026-10-15T11:12:51.826Z

Related signatures from T-447's droplet gate 463ee26b (A-2919), all an initial idle or launch on a Codex session under load:
- role-integrity.test.ts:131 (relaunch role change, initial coord idle at :138);
- codex-adapter.test.ts:813 (initial impl-1 idle at :821; also T-467's family);
- session-usage.test.ts:31 (Codex session.launch times out after 5 s).
impl-486's current hypothesis is that Codex spawn ordering marks the session busy after turn/start and overwrites a completed first turn's idle. If that root cause is confirmed, check these against it, and fix it in the adapter if that's where it lives.

### impl-486 · 2026-10-15T11:14:35.569Z

Root cause confirmed: after turn/start is accepted, CodexAdapter.spawn unconditionally changed any idle state to busy. Under load, status active, admission response, and completed-turn idle can arrive in one receive batch before the await continuation, so the completed idle was overwritten permanently. A fake first-turn completion-before-response probe reproduces the unchanged exact 15 s coord-1 timeout (A-2921); eventSequence guard preserves newer idle and cleared turn id (green A-2926). Existing role-integrity test now forces that ordering, with every assertion/name/deadline unchanged. Five serial whole-file loaded passes (7/7 each) beside impl-393 local full run 6b2bda6d are in A-2925. Root fix also covers A-2919 role-integrity:131 and codex-adapter:813 initial-idle paths. session-usage:31 is a separate launch response deadline and moved to T-463 by Coordinator.

### rev-30 · 2026-10-15T11:16:34.054Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-486-source
commit: 47c3b8cf05691607e98823ce8d04698133005c94
scope: full

Source review clear; no high, medium or low findings.

Standards: no findings against repo guidance or baseline smells; existing eventSequence provides the ordering boundary and comments explain the race.
Spec: C1 verified. hub/src/adapters/codex.ts:688–704 captures the sequence before turn/start. Pre-turn idle with unchanged sequence still gets busy/turn-id fallback; newer idle is preserved with its cleared turn id; non-idle handling remains. State event/approval/failure/usage handling is otherwise unchanged. Commit records root cause.

Fake completion-before-response probe emits real idle/completion before admission; role-integrity fixture forces it with every original assertion/name/deadline unchanged. A-2921 reproduces exact 15 s coord-1 idle failure, A-2926 is green. A-2925 shows 5/5 serial whole-file passes, 7/7 each beside impl-393 full local run. A-2928 reports Codex adapter 35/35 (corrected count), zero skips/failures. Separate session-usage launch-response timeout is not claimed fixed.

C2 remains unverified pending same-head post-source Linux droplet verification. No Reviewer tests or changes.

Criteria: C1 verified.

### rev-30 · 2026-10-15T11:56:55.949Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-486-linux-first
commit: 47c3b8cf05691607e98823ce8d04698133005c94
scope: evidence

Evidence review not clear pending gate disposition.

Medium — hub/test/suite-remote-budget.test.ts:131: sole Linux failure `candidate result: not within 20000 ms` while awaiting completed remote fixture jobs in the three-callers/human-slot case (A-2956:3854–3859). This is outside the diff. Tracker search found no exact known-ticket match; T-435 names a different budget-notice assertion. Treat as unclassified under e6264b46 until lead disposition; no Codex product cause inferred.

Standards: source review rev-20261015-486-source stands; no new source findings, C1 source mark retained.
Spec/evidence: role-integrity 7/7 Linux green, forced coordinator regression 2.706 s; Codex adapter 35/35 green. A-2925 supplies five serial loaded role-integrity passes, 7/7 each. C2 remains unverified pending accepted gate; no failed implementation criterion mark for this unrelated timeout.

f45f0ae5/A-2956 matches reviewed/current 47c3b8cf05691607e98823ce8d04698133005c94: exit 1, 1716 pass/1 fail/3 platform skips, Linux x64 c-8, typecheck green, Neovim smoke not reached. Reported Bugs/S to lead; new verifies held until restart per bef82ca8, and unknown-case classification is required before automatic known-flake retry. No Reviewer tests or edits.

### impl-486 · 2026-10-15T12:34:35.870Z

Per Coordinator a45bcc08: suite-remote-budget.test.ts ran whole/alone 5× serially at unchanged 47c3b8cf, all 10/10 green (A-2981). Runs 1–2 overlapped local work before the new Mac load rule (run 1 began quiet); runs 3–5 labelled quiet and admitted at load 3.30/5.45/4.40 with no other targeted PID. Source remains clean and unchanged. This satisfies the stated condition for counting first Linux A-2956's sole suite-remote-budget candidate-result timeout as known T-490. Restart announced 983f34f6; submitting second same-head droplet receipt under E-482 rule. Local slot handed to impl-335 per priority update, then impl-393.

### coord · 2026-10-15T12:38:09.036Z

More signatures of the same root cause, a Codex session's initial idle under load:
- codex-adapter.test.ts:399 (T-395, A-2976);
- role-integrity.test.ts:116 rev-1 (T-395, A-2976);
- session-stop-races.test.ts:136 Implementer idle (T-455, A-2984).
When T-486 merges, its commit goes to every branch that runs Codex tests.

### impl-486 · 2026-10-15T12:59:00.047Z

Second same-head default Linux verify 9330be77 is fully green at reviewed/current 47c3b8cf05691607e98823ce8d04698133005c94: 1732 tests, 1729 passed, 0 failed, 3 platform skips; hub and Neovim smoke completed, typecheck green. Durable receipt A-2996. First unrelated T-490 failure classification is supported by five whole-file 10/10 passes in A-2981. Source unchanged; requesting final evidence verdict.

### rev-30 · 2026-10-15T12:59:19.294Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-486-final
commit: 47c3b8cf05691607e98823ce8d04698133005c94
scope: evidence

Final review clear at unchanged 47c3b8cf05691607e98823ce8d04698133005c94; no unresolved source findings.

Standards: source verdict rev-20261015-486-source stands, no findings.
Spec: C1 source verification stands: eventSequence guard preserves newer completed-turn idle and cleared turn id while retaining pre-turn fallback; original assertions and deadlines unchanged. C2 verified: A-2925 establishes five serial loaded role-integrity whole-file passes (7/7 each) beside impl-393 local full run 6b2bda6d, and same-head Linux A-2996 passes all seven cases, forced Coordinator regression 2.475 s (timing line 4753). Codex adapter file also passes.

Accepted gate: 9330be77-82fa-4428-b318-3fc8c01269b0 / A-2996 is green at the exact source-reviewed and current branch head. Host and remote typecheck pass; Linux x64 c-8 hub plus Neovim smoke completes, exit 0, 1729 pass / 0 fail / 3 platform skips / 0 cancelled. Three skips: macOS sandbox-exec cases in edges and spawn-census, plus macOS idle-sleep inhibitor in executor-droplet. Neovim smoke 12/12 green. Duration regression notices concern existing test identities and do not fail this receipt.

Earlier red f45f0ae5/A-2956 remains recorded red; its outside T-490 timeout was classified under Coordinator a45bcc08 after five 10/10 remote-budget file passes A-2981. Final gate now rests on the green retry, without needing the two-red-receipt exception.

Criteria: C1 retained, C2 verified. No Reviewer tests or edits.

Criteria: C2 verified.
