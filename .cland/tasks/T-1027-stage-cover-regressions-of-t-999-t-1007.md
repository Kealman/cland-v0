---
id: T-1027
kind: task
title: "Stage-cover regressions of T-999/T-1007/T-1010: qa.state kinds, LABELS-001 closed items, startup-budget durations"
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1007
found_by: cover
topic: topic-770
branch: t/T-1027-stage-cover-regressions-of-t-999-t-1007
created: 2026-10-20T19:38:26.370Z
updated: 2026-10-20T19:55:06.122Z
closed: 2026-10-20T19:55:06.122Z
---

## Summary

The Linux stage cover 888e98da at 7c1aeae9 (A-8003) is red on three test-level regressions of today's merges, which T1-only batches and task verifies did not run: nvim/test/qa.test.ts expects the old `qa.state().panels` shape without T-999's `kinds` field (two cases); the LABELS-001 shipped case waits for both fixture items while T-1007 loads only open items at startup (wait_for timed out: "the two fixture items"); and the three new startup-budget tests of T-1010 run 5.5-9.3 s on a droplet stage run, past the 5 s new-test budget, and need durations.json entries with a reason.

## What to build

Update qa.test.ts for the `kinds` field (keep asserting the legacy fields). Make LABELS-001 count the items it needs without assuming closed items are loaded (open fixture items, or expand the closed group, as the case intends). Add durations.json entries with measured values and a reason for the startup-budget tests (or move them to the tier their measured cost fits, per docs/agents/tests.md). Run all three as targeted local runs.

## Acceptance criteria

- [x] C1. nvim/test/qa.test.ts passes with `kinds` asserted beside the legacy panel fields (targeted local run named in the item).
  - done: impl-1027 · 2026-10-20T19:42:28.560Z
  - verified: rev-23 [reviewer] · run rev-20261020-1027-final · 2026-10-20T19:50:45.739Z · commit 17384499007dda251e32c7d13bf7388950e57c54
- [x] C2. The LABELS-001 case passes under both the stdio and the stub hub with T-1007's open-first loading (targeted local run).
  - done: impl-1027 · 2026-10-20T19:42:28.571Z
  - verified: rev-23 [reviewer] · run rev-20261020-1027-final · 2026-10-20T19:50:45.739Z · commit 17384499007dda251e32c7d13bf7388950e57c54
- [x] C3. The startup-budget tests carry durations.json entries or a tier that fits their measured cost, with the reason, and the duration lint accepts them (test).
  - done: impl-1027 · 2026-10-20T19:42:28.580Z
  - verified: rev-23 [reviewer] · run rev-20261020-1027-final · 2026-10-20T19:50:45.739Z · commit 17384499007dda251e32c7d13bf7388950e57c54

## Comments

### impl-1027 · 2026-10-20T19:40:06.040Z

A-8003 at Linux droplet stage 888e98da / 7c1aeae9: panel failures show actual kinds.left='items'/kinds.right='inbox' and kinds.right='sessions' absent from expected; LABELS-001 reports "wait_for timed out after 10000 ms: the two fixture items". Startup duration diagnostics: 5.55 s, 9.286 s and 5.792 s > 5 s. Fix retains panel legacy fields, explicitly unfolds the closed explorer group, asserts summary fields plus assignee/branch from the rendered detail, and adds dated E-880-owned allowances using exact measured seconds. Existing T3 seams and test identities retained. No runtime checks until the Coordinator ends the Mac stage cover.

### rev-23 · 2026-10-20T19:43:25.292Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1027-source
commit: 17384499007dda251e32c7d13bf7388950e57c54
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1027 source review

Head 17384499007dda251e32c7d13bf7388950e57c54; tree 8f1c0cf72ec3cd454f2187a5e0f05a14f45d6f6b. Fixed base 7c1aeae9f13dd6938184a8c3e3432a2f65185802. Reviewed all three changed files, the qa.state producer, fixture consumer and original stage failure evidence.

## Standards
No findings. Legacy panel fields remain exact deep-equality assertions alongside additive kinds, including the nested dump. The existing process-level tests retain their original seams and identities; no new process test, tier downgrade, catalogue edit or frame rewrite is introduced. LABELS-001 triggers closed-group expansion, bounds observing both fixture items separately, then observes the item comment before the final detail assertions. No new sleeps are added.
The three duration allowance identities match unchanged startup tests and A-8003's exact Linux measurements: 5.550433302, 9.286204391 and 5.791998113 seconds. Each has the observed cost, a lifecycle/fixture reason, open owner E-880, added date 2026-10-20 and expiry 2026-10-27. No startup latency/payload assertions or negative controls change. Diff check is clear.

## Spec
No findings. C1 preserves left/right/dock assertions while asserting the shipped kinds projection. C2 retains the closed question fixture and fetches it through explorer expansion; summary fields remain fully compared for both items, while nonempty assignee/branch assertions move to their rendered-detail seam under both stdio and stub hubs. Body/comment/label checks remain. C3 adds the requested measured, reasoned duration entries without production or startup-budget test changes.
A-8003's actual failures include extra kinds absent from expected panel objects, “wait_for timed out after 10000 ms: the two fixture items”, and “duration budget: ... 5.55 s > 5 s”, “9.286 s > 5 s”, “5.792 s > 5 s”. The changes address those specific test assumptions/cost declarations.

## Evidence and verdict
A-8007 attributes serial direct local Darwin/arm64 execution to this head/tree: qa.test.ts 23/23 (including LABELS-001 stdio and stub), startup-budget.test.ts 3/3, and qa-shipped.test.ts 30/30, all with zero failures/skips. These are 56 targeted passes, not a suite or load-gate receipt; duration enforcement did not run. Local check and duration/tier lint were reported before the final extra literal panel assertion, as the request explicitly qualifies.
Source clear; leave C1–C3 final marks pending the normal exact-head mode-free gate and final evidence settlement. T3/T4 targeted receipts remain distinct from task gate coverage. Reviewer ran no tests or product processes.
Standards 0 findings; Spec 0 findings.

### rev-23 · 2026-10-20T19:50:45.739Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1027-final
commit: 17384499007dda251e32c7d13bf7388950e57c54
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1027 final evidence review

Commit 17384499007dda251e32c7d13bf7388950e57c54; tree 8f1c0cf72ec3cd454f2187a5e0f05a14f45d6f6b. Source review A-8010 remains current.

## Standards
No findings. A-8020 / run 273f4b2a-95e6-4a4b-8119-bc94ca4444f1 is a same-head gate with exit 0. Parsed ordinary finish records show 2,135 passing tests and 334 passing files, no failures; there are no load-gate finish receipts. Actual execution was Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5, c-8 lon1 droplet, two machine workers. T1 and fallback all T2 completed, including Neovim 71.06 seconds. qa.test.ts, startup-budget.test.ts and qa-shipped.test.ts were not executed in this task gate; their local receipts below remain separate.
Host check reference 3e9172d9b8f6ca2bafff82976da344b586e9d5d1 was not repeated remotely. Test lint 131 findings/59 files, duration diagnostics, seven missing baselines and the incomplete-base T3 ratchet remain report-only. Repository tier-plan lint reports the current files match the declared phases. Duration-manifest validation in package planning accepted the allowance entries. Lifetime 367 seconds; estimated cost $0.0255.

## Spec
No findings. C1/C2 are established by source plus A-8007's exact-head/tree serial targeted Darwin/arm64 local receipts: qa.test.ts 23/23, including LABELS-001 through both stdio and stub; panel legacy fields and additive kinds, item summary values and rendered assignee/branch remain asserted. C3 is established by the unchanged startup test identities, the three dated open-E-880 allowances matching exact A-8003 Linux stage timings, and accepted manifest planning/lint. A-8007 also retains startup-budget 3/3 and shipped QA 30/30 local passes, including both intentional negative-control budget failures asserted as expected. Those direct-file runs did not enforce suite duration/load budgets; no Linux T3/T4 pass is inferred.
The original A-8003 stage failures and the initially missed nested panel expectation remain history; no production changes, test-tier demotion or frame/catalogue rewrites were introduced.

## Verdict
Final clear; verify C1–C3. This is source plus the requested local targeted evidence and same-head task gate, not a rerun of the failed Linux stage cover. No separate QA policy or QA criteria apply. Reviewer ran no tests or product processes.
Standards 0 findings; Spec 0 findings.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T19:55:06.122Z

Merged 7554c1299b686dfea13e644b95eab582b7f50c84 onto dev.
