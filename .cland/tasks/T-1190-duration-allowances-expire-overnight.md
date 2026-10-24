---
id: T-1190
kind: task
title: Duration allowances expire overnight with no warning and fail every shard plan
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1195
blocked_by: []
topic: topic-925
branch: t/T-1190-duration-allowances-expire-overnight
created: 2026-10-24T00:03:56.390Z
updated: 2026-10-24T07:18:10.677Z
---

## Summary

At 00:00Z on 2026-10-24 the duration allowance for `hub/test/cli-identity.test.ts::a launched session cannot borrow another identity…` expired. From then on every T3 shard plan failed with `ShardManifestError: expired duration allowance`: periodic dev T3 run 3bb25b4e at 7bdf8367, A-10287. Twenty-four more E-880 allowances were due to expire by 2026-10-26. The Coordinator renewed all 25 to 2026-11-23 under D72 (6673d75e). Expiry is a calendar event, but nothing warns before it: a whole release cover can turn red overnight with no code change.

## What to build

Warn ahead of expiry instead of failing at shard planning. For example:
- the periodic dev T3 report and the hub's heartbeat list allowances expiring within 48 hours, with their owner;
- `cland durations renew --owner <id> --until <date>` applies a reviewed renewal within the owner's span limit.

Planning still refuses an expired entry, but the refusal names every expired key and the renewal command.

## Acceptance criteria

- [x] C1. An allowance expiring within 48 hours appears in the periodic dev run report and the Coordinator's heartbeat, naming the test and owner (test).
  - done: impl-1190 · 2026-10-24T07:16:56.939Z
- [x] C2. A shard-planning refusal for expired allowances lists every expired key, not only the first (test).
  - done: impl-1190 · 2026-10-24T06:52:05.168Z

## Comments

### impl-1190 · 2026-10-24T06:50:56.795Z

Implementation uses one reusable midnight-UTC expiry listing in suite-durations.ts. Shard planning aggregates expired keys. The hub reads the current project manifest at Coordinator heartbeat and periodic dev-T3 report time, warning for every allowance at <=48h and already expired entries. Added failing-then-green tests at packageShards, native heartbeat injection with FakeClock, and published periodic result. Optional renew CLI omitted; seconds/reasons and durations.json unchanged. hub/README.md documents flow; docs/agents/tests.md left untouched for T-1199.

### rev-23 · 2026-10-24T06:57:28.088Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-1190-source
commit: 9bda24e3bae795f58282be705bee1e5d9dc55111
scope: full
findings: [{"severity":"medium","text":"M1: re-resolve current session identity and heartbeat eligibility after the asynchronous warning read; pre-await name/role/process/crew/schedule can be invalidated by rename, handover, disable or stop/prune before publication. Add held-read public regressions.","file":"hub/src/hub/core.ts","line":380}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1190 full source review — not clear

Head 9bda24e3bae795f58282be705bee1e5d9dc55111; tree fc13ed21e209aa0a83e25def26fa5bbd71571c3d. Fixed base b16fa823dca02f77b569084c12cdb318be3f14b4. Comparison: git diff b16fa823dca02f77b569084c12cdb318be3f14b4...9bda24e3bae795f58282be705bee1e5d9dc55111. Scope: nine files, 125 additions / nine removals. Run rev-20261024-1190-source.

## Standards

M1 (medium), hub/src/hub/core.ts:380–387. The new asynchronous duration-warning read separates the heartbeat's eligibility decision from publication. The session name/role snapshot, running-process test, crew heartbeat setting and durable schedule are all captured before the await. Only hub closure is checked afterward. A rename, Coordinator handover/role clear, heartbeat disable or process stop/prune can complete while that read is held. When it resolves, the old name is still passed to replaceHeartbeat and recordNotice, and firedHeartbeat consumes the old interval. Rename can queue a notice to an obsolete name; role or stop changes can publish a Coordinator warning after eligibility has ended. This interleaving did not exist in the previous synchronous tick. Resolve the current session identity, role/process/crew eligibility and schedule at the commit boundary, retaining serialization and closure handling. Add held-read public heartbeat regressions for rename and role/terminal invalidation, observing the held boundary and exact resulting/no stale delivery. The implementer accepted this finding and is correcting it; no corrected head has been reviewed.

No separate smell finding. The shared UTC date/expiry helper is appropriately narrow. Existing tier/lifecycle seams are reused; no new process/browser is added. New shard-planning test uses a restored mock of Date.now and an owned file-only fixture; new heartbeat coverage uses FakeClock plus existing fake harness/native injection receipt; the periodic result test observes the actual published report. Existing assertions are retained. Reviewed against AGENTS.md, docs/agents/tests.md, Coordinator seam decision 0a137d09 and the applicable project rules. Both review axes were performed in-session under the Crew's no-subagent policy.

## Spec

No additional source finding. Valid dated allowances use one midnight-UTC interpretation, include the exact 48-hour boundary, retain already-expired entries, and exclude date-free legacy allowances. Warnings name keys and owners, use the current project manifest, and are added to Coordinator heartbeat text and periodic dev-T3 report/detail. Read/parse errors are caught so the reporting path can remain available. The periodic test reads a manifest written while the detached run was in progress and distinguishes due/later/legacy entries.

Planning still refuses expiry. After entry validation it collects all valid expired keys into one ShardManifestError and gives a manual added/expires renewal hint. The public packageShards regression includes two expired keys (one exactly at UTC midnight) and excludes a future key. No allowance amount, reason, duration manifest, dependency, tests.md or role clause changes are included. The illustrative renewal CLI is deliberately omitted and README explicitly describes reviewed manual edits and existing span limits; there is no undocumented command.

C1 is not clear because M1 permits the heartbeat's warning delivery to use stale ownership/eligibility. C2's source and targeted regression shape are sound, but runtime-dependent verification remains pending. No criterion is verified by this source verdict.

Evidence and limits: A-10328 corrects the targeted count to 109 tests in 14 serial files, local Darwin arm64 Node 24.21.0, plus npm run check reported passing. The prior 129 count is superseded. Scripted Linux facts in report fixtures are not Linux executor coverage. The lead is preserving original stdout/exits from session records with actual source provenance; no rerun for transcription is requested. No configured verification has been admitted for this head, and no Linux/full-suite/T3/T4 coverage is claimed. Reviewer performed read-only source, Git and artifact inspection, without tests/probes, edits, live browser, merge or delegation.

Complete finding set: M1 only. Correct it, preserve original receipt provenance, incorporate only the Coordinator-authorized shared fix, then request fresh source review at the pushed replacement head before verification. QA policy none/after-stage with no per-item QA brief; after-stage QA is separate.

Standards: one medium finding. Spec: zero additional findings; C1 blocked by M1.
Durable review A-10333.

Criteria: C1 failed (Heartbeat publication uses session identity/role/process/crew/schedule captured before the durationWarnings await; rename or eligibility changes can publish a stale heartbeat.).

### rev-23 · 2026-10-24T07:03:23.142Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1190-source2
commit: 90114a41415cd2526711cd6677de2c4a8b006900
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1190 correction/shared-fix delta source review — clear

Head 90114a41415cd2526711cd6677de2c4a8b006900; tree 40490a6e84385b42a2b85ce5ea50b1fbe147b2b5. Fixed review point 9bda24e3bae795f58282be705bee1e5d9dc55111, whose full review is A-10333. Comparison git diff 9bda24e3...90114a41415cd2526711cd6677de2c4a8b006900: four files, 82 additions / 23 removals. Two commits: Coordinator-shared c4bd17b5 cherry-picked as 0ad5888b, followed by the M1 correction. No dev merge. Run rev-20261024-1190-source2; findings []; C1/C2 runtime pending.

## Standards

M1 resolved. #dueHeartbeat resolves by stable session identity, reads the current stored name/authoritative role (falling back to owned process facts for unpublished sessions), rejects terminal processes and disabled role heartbeat settings, and obtains the durable current schedule. The tick repeats that resolution after the asynchronous warning read and before the synchronous publication transaction. Missing/ineligible sessions or changed role/interval are discarded; rename uses the current name. Digest and firedHeartbeat now use actual firing time. The serialized work guard and closed-hub fence remain. No await separates the second eligibility resolution from publication.

Five public heartbeat regressions hold the warning reader across rename, role clear, process stop, prune and crew disable. The held-entry receipt precedes each mutation; the observer for QA's later heartbeat is armed before release and proves the tick continued past Coordinator processing before history is checked. Stale old-name heartbeats are absent; rename retains exactly one current-name warning. Role/stop cases restore eligibility and observe an immediate overdue heartbeat, proving discard did not consume the due schedule. The existing manifest/window/native-injection coverage remains. The injected reader is now honored by createHubBase, while the project manifest reader stays the production default. Tests retain T2 fake-clock/in-process seams without a new child/browser.

No additional Standards finding or smell. The full source review's unchanged UTC warning, periodic-report and planning/refusal analysis carries forward.

## Spec

No additional findings. C1's stale heartbeat publication defect is corrected at source and covered by held-read regressions. C2 is unchanged. The scope remains warning/reporting plus expired-key aggregation; no allowance amounts/reasons, duration manifest, tests.md, dependency or clause changes.

The sole shared Web change exactly matches c4bd17b5: seedTree runs before choosing liveRelease, so expected selection sees the same completed fixture release set as the UI. The final rendered tree and all downstream assertions/wait bounds remain. This is the Coordinator-authorized shared fix identified in the review request, not an independently invented retry repair.

## Evidence and limits

A-10336/A-10337 preserve original check and 109 targeted passes from native session records at source later committed unchanged as 9bda24e3, with local Darwin arm64/Node 24.21.0 attribution and tool chunk references; they are historical, not replacement-head receipts.

A-10339 records the corrected full check with exit 0, including typechecks, build and static/test lint; 132 findings in 59 files remain report-only and zero refusals. A-10340 retains all 14 targeted file outputs and combined command exit 0. Independent parsing confirms 114 tests / 114 passes, zero failures, skips or cancellations; 15 heartbeat tests include the five new held-read cases. A-10341 records the red observation for all five cases, the initial exactOptionalPropertyTypes failure, and the conditional-spread repair. The targeted run began with uncommitted M1 runtime code; that fixture typing repair occurred during an earlier duration file and before heartbeat.test.ts loaded, with production runtime unchanged. These are working-tree-to-commit receipts with an explicitly disclosed mid-run typing edit, not a claim that all commands began at committed HEAD or on Linux. Native per-test timings are retained; held-read cases are roughly 14–19 ms locally.

Current tracked task worktree is clean at reviewed source. No configured verification result exists for 90114a41. Both criteria remain unverified until the same-head configured result is audited. Proceed with mode-free verification at this exact head. T3/T4 or integrated coverage may not be inferred from targeted fixture facts or generic load headers. No per-item QA brief/criteria under none/after-stage policy; after-stage QA remains separate.

Reviewer performed read-only source/Git/artifact inspection only, without tests/probes, edits, live browser, merge or delegation. Both axes performed in-session under Crew policy.

Standards: zero outstanding findings, M1 resolved. Spec: zero findings.
Durable review A-10344.

### rev-23 · 2026-10-24T07:11:56.051Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-1190-evidence1
commit: 90114a41415cd2526711cd6677de2c4a8b006900
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1190 configured evidence review — not clear

Exact reviewed head 90114a41415cd2526711cd6677de2c4a8b006900, source review A-10344. Run 75848eef-916e-46f2-bb65-f197eed49a8f / raw A-10347 exits 1. Run rev-20261024-1190-evidence1.

## Standards

No new source finding is asserted by this evidence-only review. Source clearance stays attributed to the reviewed tree; it is not a runtime guarantee. The raw run preserves actual assertion failures, not merely report-mode diagnostics.

Ordinary suite finish records independently count 2,162 passing tests and four failing tests, zero skips/cancellations. Actual load-gate scope adds 30 passing and five failing test repetitions. This reconciles the receipt's aggregate 2,201 tests / 2,192 passes / nine failures with its ordinary summary of 2,166 / 2,162 / four. All five failed repetitions are the new Coordinator expiry-window identity. The other six new identities have 30 passing repetitions; the generic five-repetition header is not the evidence used.

## Spec

C1 fails configured evidence:
- Coordinator expiry-window case at heartbeat.test.ts:24 times out with “no frame matched within 5000ms”; ordinary duration 5.178087238 s. All five actual load samples fail similarly (about 5.17–5.23 s).
- Existing running/queued-run digest case fails “timeout and running facts occur together” at line 278.
- Existing remote-lease heartbeat case has no matching digest at line 316.
- Existing independent-role schedules/rename/revocation case lacks the Coordinator heartbeat at line 332.

These failures need diagnosis at the observable publication/clock boundary. Preserve original assertions, waits and final state checks. The additional enforced new-identity duration failure (5.178 > 5 s) accompanies a failed timeout; it does not make the run allowance-only and is not a passing-sample basis for sizing an allowance. No shared-defect disposition or retry authorization is inferred.

T1 passed; fallback T2 failed in the hub portion, so Neovim and Web completion must not be claimed from the projected plan. Web has zero completed tests. C2's planning regression is not among the failures, but final C1/C2 settlement remains pending corrected source and configured evidence. No T3/T4/integrated claim.

Platform: Linux x64 6.8.0-142-generic, c-8 lon1 droplet cland-v0-30ef2c91, Node 24.21.0 / Neovim 0.12.5 installed, workers 2. Lifetime 392 s, cost $0.0272. T1 actual suite duration 52.87 s; hub T2 suite duration 240.94 s. Generic lint/duration/ratchet diagnostics retain their report-only labels separately from assertion and enforced new-identity failures.

Reviewer performed raw artifact/source metadata inspection only, no runtime reproduction or edits. Hold readiness; a source fix needs fresh source review at the pushed replacement head before verification. Historical local 114 passes remain local working-tree receipts, not a replacement for this failed Linux result. QA remains separate.

Standards: zero new source findings. Spec: C1 fails runtime evidence.
Durable evidence review A-10348.

Criteria: C1 failed (Configured run 75848eef/A-10347 exits 1: new expiry heartbeat times out in ordinary plus 5/5 load runs; three existing heartbeat assertions also fail. Web unobserved.).

### rev-23 · 2026-10-24T07:18:10.677Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1190-source3
commit: 3f515957d0629a2347b88a2225d4a6910a5d96cc
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1190 firing-clock correction source review — clear

Head 3f515957d0629a2347b88a2225d4a6910a5d96cc; tree 05b62c562e2753eb4718c28c56e6637e657c4309. Parent/fixed review point 90114a41415cd2526711cd6677de2c4a8b006900. Comparison git diff 90114a41...3f515957d0629a2347b88a2225d4a6910a5d96cc: five files, 59 additions / 18 removals. No dev merge or additional shared commit. Run rev-20261024-1190-source3; findings []; C1/C2 runtime pending.

## Standards

No outstanding source finding. M1's stable-id name/role/process/crew/schedule revalidation after the await remains unchanged. The new correction replaces the captured clock number with an accessor, evaluated after manifest I/O. Both Coordinator heartbeat and periodic dev-T3 report pass the hub clock accessor through the shared reader. Default direct calls use Date.now as an accessor; explicit numeric callers remain supported. Source call-site audit finds no production report path still capturing the pre-read timestamp. README describes the actual post-read sampling boundary.

The held-read regression observes entry before the window, advances fake time across midnight while blocked, then observes QA's later heartbeat before reading Coordinator history. It asserts the exact midnight timestamp and warning key/owner. This exercises the real manifest warning function; stale numeric sampling gives a specific missing-warning failure, not a setup timeout.

Existing digest/lease/schedule tests now arm a future message observer before advancing to one due firing and await the matching publication. nextHeartbeat uses the existing FakeClock block/advance semantics: one overdue interval firing, without treating I/O yields as completion. Original final content/count assertions and 5,000 ms observation bounds remain. Where two QA firings are required, two exact receipts are awaited. The role/stop invalidation regressions and original native-injection/window assertions remain intact. No wall-clock delay, cap increase, allowance edit or new process/browser is added.

## Spec

No additional source finding. The correction addresses the own-diff failure in A-10347: a pre-window read could finish at the inclusive boundary and publish text computed from the old time. The new accessor samples after I/O, so the warning's window matches the publication-time hub clock. Shared midnight-UTC parsing/expiry aggregation and C2 are unchanged. Periodic reporting receives the same fix. M1 ownership fencing is preserved.

Original failed Linux 75848eef/A-10347 remains failed evidence: four ordinary heartbeat assertions and five failed window load repetitions, Web unobserved. It is not relabelled green or reduced to a budget problem.

## Evidence and limits

A-10354 preserves deterministic red: the held-read case completed in 29.702709 ms but failed the exact warning assertion with an otherwise valid midnight heartbeat. A-10355 preserves original window plus held case green; A-10356 retains five subsequent local passes of the original isolated window case. These are local targeted observations, not configured/Linux/load evidence.

A-10357 retains complete successful check output/exit; zero refusals, 132 findings remain report-only. A-10358 retains the stable-install targeted rerun; independent parsing confirms 14 files, 115 tests / 115 passes, zero failed/skipped/cancelled, combined exit 0, including 16 heartbeat tests. Logs identify local Darwin arm64 Node 24.21.0, working tree later committed without edits during the run. They do not claim every command began at committed HEAD.

A-10353 separately preserves a transient targeted failure while root dependencies were being replaced. Coordinator 3abac5de confirms the concurrent root npm install, its completion and authorization to rerun after resolution. That disposition is verified in topic history; the failed log is not hidden and is not used as a passing receipt or new source finding. T-542 tracks the shared-install concern.

Task worktree is tracked-clean at reviewed head. A-10359 records diagnosis and attribution. No configured success exists for this replacement head; C1/C2 remain unverified until its configured receipt is audited. Proceed with mode-free verification at this exact head. Reviewer performed read-only source/Git/artifact inspection only, with no runtime reproduction, edits, browser, merge or delegation. Both review axes completed in-session. QA policy none/after-stage; no per-item brief, after-stage QA separate.

Standards: zero findings. Spec: zero findings.
Durable source review A-10361.
