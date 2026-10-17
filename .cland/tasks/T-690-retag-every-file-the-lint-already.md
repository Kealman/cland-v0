---
id: T-690
kind: task
title: Retag every file the lint already qualifies as T1 or T2, and record the tier share baseline
state: open
status: in progress
size: S
criterion_seq: 3
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-676
blocked_by:
  - T-682
topic: topic-450
branch: t/T-690-retag-every-file-the-lint-already
created: 2026-10-16T19:59:28.837Z
updated: 2026-10-17T16:09:47.954Z
---

## Summary

T-679 tags everything T3 except the seven free files, for safety. T-682's lint reports, per file, the lowest tier a file already qualifies for: a grep estimate puts about 15 hub files (~10 s) in T1 and 42 (~436 s) in T2 at today's `dev`, plus the Neovim files that use only the stub hub. Tagging them is the first measurable move of the tier share, and the share recorded here is the baseline E-677's exit and E-578 read (T-662 C3).

## What to build

Retag every hub file T-682 reports as T1- or T2-qualifying, and every Neovim stub-hub-only file as T2, in one manifest change. T1 files join the hermetic phase; T2 files stay in the machine phase, so no run loses coverage. Record the tier share of a full run at the head on this item and on the epic.

## Acceptance criteria

- [ ] C1. Every file the lint reports as qualifying for T1 or T2 is tagged so, and the lint reports zero findings for T1 and T2 files, proved by the lint run at the head.
  - failed: rev-30 [reviewer] · 2026-10-17T16:09:47.954Z · note Sixteen proposed lower-tier entries still use forbidden real fixture resources, process lifecycles or timers through helpers; retain prior tiers and refresh eligibility/baseline before re-review.
- [ ] C2. A full droplet run at the head is green with the retagged T1 files in the hermetic phase.
- [x] C3. The per-tier file counts, manifest seconds and T1+T2 share are recorded on this item and on the epic as the baseline.
  - done: impl-690 · 2026-10-17T16:02:08.360Z

## Comments

### impl-690 · 2026-10-17T16:00:30.903Z

Baseline dev b5cd8b4f merged. Scope clarified by Coordinator in topic-450: preserve all T4 purpose entries, explicit T3 headers and spoke-readiness (known WebSocketServer lint blind spot), plus leave eight T-741 files alone. C1 measures zero tier-resource findings in retagged files; existing wall-clock findings are debt for T-684. 46 files retagged (24 to T1, 22 to T2); local checks in progress. Test code remains unchanged.

### impl-690 · 2026-10-17T16:01:31.478Z

T-690 tier-share baseline (A-4606, durable /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4606-t-690-before-after-tier-baseline-retags-and-retained-exceptions.md). Origin/dev b5cd8b4f; duration source 42ebe8a0 / A-4565. Before: T1 31 files / 19.180411 s; T2 46 / 204.968503 s; T3 222 / 4358.592670 s; T4 6 / 83.888367 s. After 46 retags: T1 55 / 108.858931 s; T2 55 / 346.158215 s; T3 189 / 4127.724438 s; T4 6 / 83.888367 s. T1+T2 manifest share rises from 4.803229% (224.148914 s) to 9.750444% (455.017146 s), total 4666.629951 s. 305 files; suite-remote-log lacks a duration baseline, so its file is counted and seconds excluded consistently with suite reporting. Full-run evidence will follow after source review and verification hold release. All retained exceptions and 30 existing wall-clock debt lines are listed in A-4606.

### impl-690 · 2026-10-17T16:09:30.562Z

Corrected baseline after source review, superseding A-4606's original 46-retag result: A-4608 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4608-t-690-corrected-baseline-30-safe-retags-and-fixture-exceptions.md). 30 safe retags: 10 to T1, 20 to T2; 22 explicit lower-qualified exceptions, naming fixtures/resources. Before unchanged: T1 31 files/19.180411s, T2 46/204.968503s, T3 222/4358.592670s, T4 6/83.888367s. Corrected after: T1 41/44.279993s, T2 61/350.370445s, T3 197/4188.091146s, T4 6/83.888367s. T1+T2 224.148914s (4.803229%) → 394.650438s (8.456862%) of 4666.629951 manifest seconds. 305 files; suite-remote-log's missing duration excluded from seconds. Existing wall-clock debt remains 29 retagged lines + permissions' one. Coordinator decision 5681ace2 authorizes retaining actual transitive resource/timer cases despite syntax qualification. New exact-manifest local runs and source re-review will follow.

### rev-30 · 2026-10-17T16:09:47.954Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-690-source
commit: cd137387cb194422b63f3c2986f46fbd0410a84c
scope: full
findings: [{"severity":"medium","text":"M1: nine proposed T1 retags execute real sockets, child processes or native ownership probes through imported helpers: codex-native, opencode-native, demo-release-component, executor-prepare-retry, remote-scripted, duration-legacy, shared-defects-report, suite-candidate and suite-accounting. The syntax qualifier does not inspect these helper paths. Retain their prior tiers under the Coordinator's resource exception policy; do not move them into the hermetic phase.","file":"hub/test/tiers.json","line":56},{"severity":"medium","text":"M2: hook-bridge-doctor and verification-workers are real process/lifecycle integrations, not eligible T2 component tests. The former spawns three hook bridges and proves targeted PID death; the latter uses remote-fixture process mode with real spoke, shell and candidate workers. Retain both prior T3 tags.","file":"hub/test/tiers.json","line":96},{"severity":"medium","text":"M3: account-coalescing, journal-flush, lifecycle-serialization, roles-session-refresh and shared-defects retain unmocked real timer paths through frameClient deadlines, eventually polling or default HubCore/createHubBase scheduling. These are hidden from syntax qualification but violate the proposed T1 boundary; retain their previous tiers. roles-session-refresh mocks intervals, but eventually polling is still real.","file":"hub/test/tiers.json","line":11}]
finding_counts: {"high":0,"medium":3,"low":0}

# T-690 source review — not clear

Head: cd137387cb194422b63f3c2986f46fbd0410a84c.
Fixed point: incoming dev61d7d5711e6fb98142cec4a2ec078436bf6c93c5.
Scope full. Read-only review; no Reviewer tests, compiler execution, edits or delegation.

## Standards
Three medium findings; all affect the new manifest assignments, not new test code.

M1 — hub/test/tiers.json:56 and related entries. Nine proposed T1 files cross real resource boundaries through imported helpers:
- codex-native / opencode-native: scripted-codex.ts:89/108 and scripted-opencode.ts:101/125 start projectHub and real socket peers.
- demo-release-component / executor-prepare-retry / remote-scripted: remote-fixture.ts:41–55 runs actual Git children; :86/90 serves projectHub and connects in-process spoke sockets even in machine:'scripted' mode.
- duration-legacy: its :12–18 gitIn function calls verdict-git.ts:14 execFile('git').
- shared-defects-report / suite-candidate: suite-fixture.ts:17/22 serves a real socket hub and spawns a spoke, with actual tiny candidate workers; suite-support.ts:19–26 also executes Git.
- suite-accounting: its calls pass accounting=true, preserving the real executor spend/lease lock backend (suite-unit-fixture.ts:58–72). spend.ts:29 takes acquireLockWithRetry, whose native acquisition probes process identity (lock.ts:324–327).
These are not hermetic T1 tests. Retain prior tiers rather than treating the import/call syntax qualifier as transitive purity proof.

M2 — hub/test/tiers.json:96 and273. hook-bridge-doctor:16–31 starts three real hook bridge processes, verifies doctor listing preserves them and --fix kills only the intended PID. verification-workers:58/105/163 invokes remote-fixture with default process machines; it exercises real candidate/shell workers and a held shell timestamp, not just in-process fake adapter component behavior. Keep both T3. T2's CLI-under-test allowance does not turn the additional owned process lifecycle into an in-memory fixture.

M3 — hub/test/tiers.json:11,111,122,170,190. Retain account-coalescing, journal-flush, lifecycle-serialization, roles-session-refresh and shared-defects at their prior tiers due to real timer scheduling hidden by helpers:
- account-coalescing injects FakeClock into its hub, but its frameClient requests still schedule unmocked setTimeout deadlines (harness.ts:553–558).
- journal-flush mocks only setTimeout; its default-clock createHubBase still creates heartbeat/prune intervals (core.ts:372, server.ts:127).
- lifecycle-serialization uses default-clock createHubBase plus eventually's Date.now/sleep(50) polling (harness.ts:740–750).
- roles-session-refresh does mock setInterval, so no unmocked interval claim is made for it; its eventually call still polls with real setTimeout.
- shared-defects constructs default-clock HubCore (:24/26/55), which schedules the real heartbeat interval.
No timer exemption is inferred from a clean direct-file lint report.

docs/agents/tests.md Test levels distinguishes T1 fake-clock/in-memory behavior from real sockets, children and time, and T2 component behavior from real process integrations. Coordinator's already-recorded spoke-readiness exception addresses the same limitation of the qualifier. The Implementer reports primary5681ace2 expands retention to actual forbidden resources in imported helpers; the concrete source paths above independently justify retention.

## Spec and evidence
The one-file diff is exactly46 existing tier values (24→T1,22→T2). Test bodies, imports, duration data, file coverage and manifest population are unchanged; no entry is removed or added. Existing retained six exceptions and eight T-741 files are preserved. The literal syntax-qualification sweep is implemented, but C1's eligible lower-tier set must exclude the sixteen resource/timer/lifecycle cases above. No verification is authorized on this head.

A-4607 raw logs were independently audited: all51 logs are positive,295 pass in total,zero fail/cancelled/skipped. They cover all46 changed files once, five whole suite-tiers runs and one extra unchanged spoke-readiness run. These are targeted local results, not the required full droplet/hermetic-phase proof. Typecheck/tiers/report-lint passes are supplied. lint-after.json has305 rows; changed entries have zero tier-resource findings but29 existing wall-clock findings (19 assertion,10 wait). Primary c71eed1a explicitly excludes that pre-existing wall-clock debt from C1; no new finding is raised for it. The newly found transitive resources above are distinct from those disclosed direct-file debt lines.

C3 arithmetic independently reproduces A-4606 using unchanged durations.json: before T1/T2/T3/T4 file counts31/46/222/6 and seconds19.180411/204.968503/4358.592670/83.888367; current proposed after55/55/189/6 and108.858931/346.158215/4127.724438/83.888367. Total4666.629951s; lower share4.803228804%→9.750444127%. suite-remote-log is the only missing duration, counted as a file and excluded from seconds. The E-676 Coordinator comment at16:01:55.816Z records the same baseline. These numbers are correct for this rejected manifest, but must be refreshed on both item and epic after the sixteen exceptions are restored; they are not an observed full-run timing or a final eligible-tier baseline.

C1 failed pending manifest eligibility correction. C2 remains unrun/unverified. C3's current arithmetic/recording is supported, but final baseline verification waits for the revised manifest. Preserve test code and assertions, restore prior tags for these sixteen entries, refresh exception/baseline evidence, and request new-head source review. Existing verification hold remains in force.

Standards:3 medium findings. Spec: lower-tier eligibility and final baseline need correction; no missing behavioral test claim or coverage reduction. Source not clear.

Durable source review A-4609.

Criteria: C1 failed (Sixteen proposed lower-tier entries still use forbidden real fixture resources, process lifecycles or timers through helpers; retain prior tiers and refresh eligibility/baseline before re-review.).
