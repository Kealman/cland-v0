---
id: T-748
kind: task
title: "Runtime resource tripwire in the T1 and T2 phases: a test that really spawns, binds or opens a socket fails by name"
state: open
status: in progress
size: M
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-676
blocked_by: []
topic: topic-456
branch: t/T-748-runtime-resource-tripwire-in-the-t1-and
created: 2026-10-17T17:29:45.529Z
updated: 2026-10-17T17:58:33.706Z
---

## Summary

Static analysis can't decide a test's real tier when fixtures choose native or fake paths by option. T-744's reachable census (2026-10-17) would put 283 of 314 files at T3, while T-719's runtime census shows projectHub with fake probes starts zero children. The exact check is at runtime: in the T1 and T2 phases, the runner traps the resource entry points and fails a test that uses one its tier forbids.

## What to build

The T1 and T2 phase workers install a tripwire before loading test files:
- **T1:** child_process spawn, exec and fork, plus net and http(s) listen and connect, fail.
- **T2:** child_process fails, except cland's own CLI subprocess through the documented helper.
Tripped calls fail the test with file, test name, resource and stack, and the run reports a tier-mismatch line. T3 and T4 are untouched. During the report-only week, a trip is reported, not failed. It goes hard together with the D53 budgets. It runs alongside T-684's static refusals for new files.

## Acceptance criteria

- [ ] C1. A planted T1 test that spawns `node -e` and a planted T2 test that does the same are each named in the run's tier-mismatch report, while a T2 test using projectHub with fake probes and the cland CLI helper passes clean, proved by runner tests.
  - failed: rev-30 [reviewer] · 2026-10-17T17:50:35.632Z · note The shipped enforce branch can return success for quarantined runtime-resource trips; preserve hard failure across phase/repetition quarantine normalization and refresh runner proofs before source clearance.
- [ ] C2. An integrated cover at the merge head lists every current T1/T2 file that trips. The review request lists them, each routed to a fix or a retag.

## Comments

### impl-748 · 2026-10-17T17:31:28.723Z

Implementation plan: per-file worker preload reads the validated tier assignments; install child-process traps for T1/T2 and socket traps only for T1, before module imports. Keep a single report-only/enforce setting and emit argument-free file/test/resource/stack receipts. Runner tests plant T1/T2 process use and cover allowed fake probes + documented CLI, synchronous/promisified APIs, hooks and T3/T4 noninterference. origin/dev already merged.

### impl-748 · 2026-10-17T17:41:25.720Z

Implementation complete; validation in progress. The runner emits a deduplicated phase trip list (including load-gate repetitions), with one report-only/enforce setting. C1 contract tests currently pass, and the required serial runner repetitions remain underway. C2 follows the Coordinator's decision: source review first, then exact-head full droplet verification, then a complete trip-list routing table; the next integrated dev cover repeats it after merge. Current QA policy is none/per-stage, so no per-item QA request is required.

### rev-30 · 2026-10-17T17:50:35.632Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-748-source
commit: 1384bdc582f5db02cd2654e999e8be00a64406c1
scope: full
findings: [{"severity":"medium","text":"M1: assertion quarantine can reset an enforce-mode tier trip's worker exit1 to0; repetition-side quarantine can count the same forbidden trips as excused. The new side receipt only prints diagnostics. Enforce trips must remain hard independently of quarantine, including repetition-only and caught-error cases; report-only must remain non-fatal.","file":"hub/test/run-suite.ts","line":203}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-748 full source review — not clear

Exact head1384bdc582f5db02cd2654e999e8be00a64406c1; fixed incoming dev41fa374226b8ce67644eb1af2fa52d7916679e4c. Eleven-file runner/test/docs change; no Reviewer execution or delegation.

## Standards
No separate Standards finding. New actual worker proofs are T3 with explicit process-lifecycle headers; identity fallback is pure T1. Fixtures own child processes/directories and observe child close before teardown. No new fixed lifecycle sleep. Canonical file paths use holder.worktree(realpath) and realpath(worker filename). Only manifest T1/T2 workers install the instrumentation; T3/T4 do not import node:test through the tripwire. Static tier assignments add only two sorted new tests.

Primary Coordinator1ad321b8 was read directly: public getTestContext if available, file-only warning fallback on older runtimes, no engine-floor increase/async-hooks fallback. Source meets that design; type-only context interface and Reflect lookup avoid a missing named export. Docs disclose global hook/import cleanup attribution limits.

## Spec — medium M1
hub/test/run-suite.ts:203, with repetition-side interaction at load-gate.ts:112–115. Enforce-mode trip throws a normal test-code error and sets worker exitCode1. A quarantined tripped test is a safe testCodeFailure to quarantine-reporter; a complete receipt with failures[]/excused>0 then resets phase code1→0. New phase trip processing at:193–198 only prints rows and never makes an enforce trip independently authoritative. Load repetitions similarly count code1 quarantined failures as excused, so all five can satisfy the gate. An existing assertion quarantine can therefore defeat the newly documented hard runtime resource boundary.

Fix by preserving a hard failure whenever an enforce-mode tier trip is present across the ordinary phase or repetitions, independently of assertion quarantine normalization. Keep report-only trips non-fatal. Add ordinary quarantined-trip, repetition-only quarantined-trip and caught-error proofs; the current enforcement test only exercises an uncaught unquarantined throw. No claim is made that ordinary report-only behavior is presently broken.

C1's report-only planted names/allowed path are positively supported, but the full runtime contract includes the enforce branch shipped and documented by this change. Source clearance is withheld for M1; C1 must be refreshed with the corrected contract evidence. C2 remains pending its complete trip-list routing receipt.

## Remaining source analysis
All seven child_process module entry points plus ChildProcess.prototype.spawn are wrapped before tests capture ESM exports. Custom promisifiers are preserved and invoke the same guard; delegating suppresses duplicate internal entry trips. The narrowly synchronous CLI allowance requires T2, process.execPath and exact own CLI entry, with finally restoration; raw CLI lookalikes remain mismatches. T1 additionally wraps net server listen, socket connect and exported connect/createConnection, covering the shared HTTP(S)/TLS connection boundary exercised by planted tests. Report-only delegates original calls without throwing; receipts omit arguments/environment/command lines and deduplicate file/test/resource while retaining first stack.

Per-phase side receipts are written before imports and survive quiet load reporters; runSuite waits for both phase and repetitions before reading/reporting and owned-root sweep. load-gate receives the same assignments and preload. No additional high/medium issue found outside M1. Invalid rollout setting is rejected rather than silently changing policy.

## Supplied evidence
A-4675 contains early iterations plus explicitly selected final-source receipts. Accepted tripwire runner repetitions4–5 and final snapshots1–3 give five six-case passes; suite-runner repetitions2–5 plus final snapshot give five43-case passes; contract runner repetitions2–5 plus final snapshot give five6-case passes. All275 accepted top-level tests pass,zero failures/cancellations/skips. Durations-runner final14/14 and context2/2 also pass. Boundary loads are supplied below15; no whole-machine quiet claim is made.

Tripwire tests cover planted named T1/T2 children, clean fake-probe projectHub/documented CLI, CP APIs/promisifiers, direct ChildProcess starts, net/HTTP/HTTPS/TLS, import and hook naming, report/enforce distinction, T3/T4 isolation, raw CLI and repetition-only reporting. They do not cover the quarantine interaction above.

A-4677 exact-head Node24.21 alternating five-pair T1 control independently matches supplied medians134.13ms baseline vs131.25ms instrumented. Ranges overlap; this is no visible single-file slowdown, not proof of negative overhead or full-phase performance. A-4678 supplies static typecheck/tiers/diff-check green.

Primary6fa5c798 was read directly: source review first, then exact-head droplet verify; runner change should select full. C2 may settle from that complete run and fix/retag routing table; next integrated dev cover repeats after merge. If mode is not full, escalate to Coordinator for cover rather than asking an Implementer to bypass mode restrictions. No per-item QA. No verification clearance at this source head.

Standards0 / Spec1 medium. Await corrected committed/pushed head and source re-review before the authorized normal-mode droplet run.
Durable review A-4680.

Criteria: C1 failed (The shipped enforce branch can return success for quarantined runtime-resource trips; preserve hard failure across phase/repetition quarantine normalization and refresh runner proofs before source clearance.).

### impl-748 · 2026-10-17T17:58:33.706Z

M1 corrected in 34ecdf01cfe76d020a85ee06e5ab3985c78f8f25, pushed to origin without merging dev after first review. Red reproduction A-4682; correction patch A-4684. Phase receipts now preserve enforce-mode failures after assertion quarantine and caught/reset worker exits. Load repetitions inspect isolated receipts before pass/quarantine accounting, then forward them to the phase report. New tests include quarantined T1/T2 ordinary trips, caught/reset cases with/without quarantine, and caught/uncaught repetition-only trips with report-only controls. Typecheck/test:tiers pass; required final-head serial runner checks are underway before re-review.
