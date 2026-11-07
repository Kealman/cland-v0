---
id: T-1740
kind: task
title: Weighted slots and placement decisions
state: closed
status: done
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by: []
topic: topic-1427
branch: t/T-1740-weighted-slots-and-placement-decisions
created: 2026-11-07T16:01:57.178Z
updated: 2026-11-07T17:17:42.108Z
closed: 2026-11-07T17:17:42.108Z
---

## Summary

A pure scheduler decides, for one launch and one pool snapshot, to place on a host, to create a host, or to wait with a reason. Each session takes the weight of its harness: Claude Code 1.0, Codex 0.5, OpenCode 0.75, or the `[hosts] weights` override. A host takes a launch while its free weight allows. Placement is dense by default, taking the fullest host with room. `spread = true` takes the emptiest host instead. A host whose harness verdict is not "serves" is skipped. The verdict hook answers `serves`, `can-bind`, `signed-out` or `no-login`, defaults to "serves" for every harness, and E-1535 fills it in.

## What to build

A side-effect-free module with its own input types: hosts with state, used weight and slots; the pool's `min_hosts`, `max_hosts` and `spread`; the weights; and the verdict hook. Booting hosts count toward `max_hosts`, and their room is promised to waiting launches, so a decision can be "waiting for host <id> to boot" rather than create another. E-1534 never decides "waiting for a login".

## Acceptance criteria

- [x] C1. With the default weights and `slots = 8`, eight Claude Code sessions fill a host, seven Claude Code and two Codex sessions fill it, and seven Claude Code and one Codex session leave no room for an OpenCode session (test).
  - done: impl-1740 · 2026-11-07T16:17:59.728Z
  - verified: rev-35 [reviewer] · run rev-35-1740-final-1 · 2026-11-07T16:40:49.732Z · commit 4c6b42617c9936ee397793926c0e7430f7d30558
- [x] C2. Dense packing chooses the fullest host with enough free weight, and `spread = true` chooses the emptiest (test).
  - done: impl-1740 · 2026-11-07T16:07:53.374Z
  - verified: rev-35 [reviewer] · run rev-35-1740-final-1 · 2026-11-07T16:40:49.732Z · commit 4c6b42617c9936ee397793926c0e7430f7d30558
- [x] C3. A `[hosts] weights` override changes the weight the decision uses (test).
  - done: impl-1740 · 2026-11-07T16:15:24.326Z
  - verified: rev-35 [reviewer] · run rev-35-1740-final-1 · 2026-11-07T16:40:49.732Z · commit 4c6b42617c9936ee397793926c0e7430f7d30558
- [x] C4. A host whose verdict for the harness is not "serves" is skipped, and the default hook answers "serves" for every harness (test).
  - done: impl-1740 · 2026-11-07T16:07:54.860Z
  - verified: rev-35 [reviewer] · run rev-35-1740-final-1 · 2026-11-07T16:40:49.732Z · commit 4c6b42617c9936ee397793926c0e7430f7d30558
- [x] C5. With no room, the decision is "create" while ready plus booting hosts are below `max_hosts`, "waiting for host <id> to boot" when a booting host has room, and "waiting for a host" otherwise (test).
  - done: impl-1740 · 2026-11-07T16:15:27.145Z
  - verified: rev-35 [reviewer] · run rev-35-1740-final-1 · 2026-11-07T16:40:49.732Z · commit 4c6b42617c9936ee397793926c0e7430f7d30558

## Blocked by

None (can start immediately)

## Notes

- Hot files: `hub/src/host/scheduler.ts` (new), `hub/test/host-scheduler.test.ts` (new).
- Tests: `host-scheduler.test.ts` (T1).
- Serves epic C2, C3 and C4 (the decision core).

## Comments

### impl-1740 · 2026-11-07T16:04:35.176Z

Rule 20 sweep before adding scheduler contract: searched scheduler, usedWeight, serves/can-bind/signed-out/no-login, transport-config and provision-state consumers across hub/src, tests, docs, QA and shipped skills. No existing host placement scheduler or consumer exists. New scheduler owns its snapshot types and defaults; no wire/persisted record changes. ProvisionRecords/Host registry are unaffected; later launch/wait integration must map lifecycle states and include reservations in usedWeight. T-1738 confirms config exports partial weight overrides and leaves merging to scheduler. Approved seam: pure snapshot → place/create/wait (ticket).

### impl-1740 · 2026-11-07T16:08:04.595Z

Implemented/pushed 195b91ff8852fac62c91995aa3d460838dcd2ee3. Targeted T1 host-scheduler.test.ts: 6/6 pass (macOS arm64, local, Node 24.21.0, no browser); existing importing test files: none, new module. Root npm run typecheck passed. npm run test:lint exit 0, 0 refusals; 122 preexisting/report-only findings across 59 files. Evidence A-17480 records red/green. All C1–C5 marked done. Source review requested from reviewer; full verify pending source verdict. QA after-stage affected per epic, documented exact per-case guidance. No dev merge per Coordinator brief.

### rev-35 · 2026-11-07T16:10:44.915Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1740-source-1
commit: 195b91ff8852fac62c91995aa3d460838dcd2ee3
scope: full
findings: [{"severity":"medium","text":"Subtracting usedWeight from slots rejects valid exact-fit fractional overrides due to floating-point rounding: slots=8, usedWeight=7.9, weight=0.1 yields free≈0.09999999999999964. Ready capacity is skipped and booting promised capacity can incorrectly lead to create/wait. No binary-unit restriction exists; define consistent fractional-capacity comparison and test exact fit plus real excess in both states.","file":"hub/src/host/scheduler.ts","line":38}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17485 records full two-axis source review. Sole medium Spec finding is floating-point capacity comparison at scheduler.ts:38, confirmed by Implementer c1c81301; no binary-unit invariant exists. Correct fractional exact-fit handling for ready and booting hosts and retain genuine-overcapacity refusal controls. No independent Standards finding; default weights, dense/spread, verdict seam and no-login-wait scope match the ticket. C3/C5 failed; C1/C2/C4 runtime-unverified. A-17483 qualifies A-17480 original-tool/candidate/static evidence and corrects the artifact id; no configured receipt yet. Fresh source pin before mode-free verify; no heavy/provenance-only run or dev merge requested. After-stage affected QA separate.

Criteria: C3 failed (A permitted 0.1 override can reject the exact remaining capacity at slots8/used7.9 because subtraction rounds downward.), C5 failed (The same fractional boundary skips eligible booting capacity and can create instead of waiting for that host.).

### impl-1740 · 2026-11-07T16:13:22.390Z

Rule20 consumer sweep update per Coordinator decision6e81c6b7: new scheduler snapshot fields will be usedMilli and promisedMilli (integers) instead of usedWeight. Slots convert to slots*1000; harness weightMilli converts once via Math.round(weight*1000), overrides rounded to0.001. No existing production consumers; scheduler test/doc are only current importers; T-1743 will build first caller and must aggregate converted integer weights and reserved promises separately. No wire/persisted contract changes in this item. T-1738 partial numeric parser unchanged; conversion belongs to scheduler.

### rev-35 · 2026-11-07T16:13:56.748Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1740-source-2
commit: 2480dc8946701388fe157e6cdd918e9b6665b876
scope: full
findings: [{"severity":"medium","text":"Raw sum comparison still rejects exact capacity when usedWeight contains accumulated fractional error: 39 successive0.2 weights yield7.800000000000004, so the fortieth sums to8.000000000000004 and is refused at slots8. No caller normalization is approved. Establish the numeric capacity contract and test accumulated exact-fit ready/booting cases alongside genuine-excess/full-host refusals.","file":"hub/src/host/scheduler.ts","line":39}]
finding_counts: {"high":0,"medium":1,"low":0}

Source2 not clear, A-17490. Raw addition fixes literal7.9+0.1 but not accumulated39×0.2 followed by the fortieth; used7.800000000000004+0.2>8. Implementer confirms no caller normalization. One continuing medium Spec finding, no independent Standards finding; C3/C5 failed. Update to A-17490's in-progress policy context: Coordinator decision6e81c6b7 now explicitly requires integer milli-slots (usedMilli/promisedMilli, one Math.round(weight*1000) boundary), no epsilon/tolerance; first consumer T-1743 gets the field contract. This decision supersedes the tolerance proposal, and the new implementation needs fresh source review. Current2480 pin is not clear and no configured verification authorized. No native/provenance-only rerun or dev merge requested.

Criteria: C3 failed (Accumulated0.2 overrides still reject the fortieth exact-fit launch at eight slots.), C5 failed (Accumulated fractional totals still skip exactly sufficient booting capacity and choose the wrong wait/create outcome.).

### rev-35 · 2026-11-07T16:17:25.609Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1740-source-3
commit: d7a50771950ded896546678da7b027973b2877df
scope: full
findings: [{"severity":"medium","text":"The milli-slot migration changed the seven-Claude/two-Codex exact total to8000000 instead of8000 usedMilli. This replaces C1's mixed exact-capacity boundary with a grossly overfull input and weakens the promised regression. Restore8000, derive the mixed total from the default conversion helper, and assert defaults1000/500/750.","file":"hub/test/host-scheduler.test.ts","line":14}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17501 records source3 review against Coordinator6e81c6b7. Production numeric findings resolved: safe integer milli snapshots, one rounded conversion, used+promised accounting and accumulated exact-fit/genuine-excess controls. Sole remaining medium is accidental double conversion in C1 test line14; restore exact8000 and derive/assert defaults1000/500/750. Implementer confirms cce76cc3. C1 failed; C2–C5 runtime-unverified. A-17496 candidate red/green and prior static provenance remain qualified, no configured receipt. Fresh test-only pin before verify after affected check; no heavy/provenance-only rerun or dev merge requested. After-stage affected QA separate.

Criteria: C1 failed (The migrated seven-Claude/two-Codex case uses8000000 instead of8000 milli-slots, no longer proving the required exact mixed boundary.).

### rev-35 · 2026-11-07T16:18:49.724Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1740-source-4
commit: 4c6b42617c9936ee397793926c0e7430f7d30558
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, A-17503. Final mixed-boundary migration corrected: default conversions1000/500/750 asserted and seven-Claude/two-Codex derived at exact8000. Independent diff confirms production unchanged from reviewed integer repair d7a507719, implementing Coordinator6e81c6b7 usedMilli/promisedMilli/rounded conversion contract without epsilon. No remaining Standards/Spec findings; C1–C5 runtime-unverified. Candidate9/9 and predecessor root T0/static evidence retain their source limits; exact-head configured evidence still required. Proceed mode-free verify at4c6b42617 and return same-head receipt. No heavy/provenance-only rerun or dev merge requested. After-stage affected QA separate.

### rev-35 · 2026-11-07T16:40:49.732Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1740-final-1
commit: 4c6b42617c9936ee397793926c0e7430f7d30558
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear, A-17517. Independently inspected run03991e3e/A-17516: exact reviewed head and reconstructed execution treef82a08d6a3819eb233e3a1cba5b622169bdcdfab match. All9 scheduler cases pass base+5 distinct load repetitions each (45/45), max0.003661555s. C1 exact default/mixed boundary, C2 dense/spread, C3 rounded integer overrides, C4 per-host/harness verdicts and C5 boot/reservation/max/accumulated-capacity decisions all verified. Hub5414/5414; parsed base5277 pass/four empty failure arrays. T0/T1/all fallbackT2/Web completed Linuxx64 Node24.21 isolated Shell1248/CfT156; T3/T4 unexecuted here. Prior candidate/predecessor tool evidence retains source limits. No remaining findings. This proves the pure core, not later runtime/reservation/min-floor/login wiring; after-stage affected QA remains separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-07T17:17:42.108Z

Merged d875019127a99729ef1ead76f4bdebc602b36dc4 onto dev.
