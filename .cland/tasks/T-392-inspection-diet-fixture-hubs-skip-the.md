---
id: T-392
kind: task
title: "Inspection diet: fixture hubs skip the start-up orphan sweep unless the test opts in, teardown signals recorded identities without machine-wide scans, and processStarted calls coalesce"
state: open
status: review
size: M
criterion_seq: 8
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-386
blocked_by:
  - T-389
topic: topic-266
branch: t/T-392-inspection-diet-fixture-hubs-skip-the
created: 2026-10-14T12:28:11.104Z
updated: 2026-10-15T00:45:10.670Z
---

## Summary

Each spawned fixture hub drags about 31 process-inspection spawns with it: the daemon's start-up orphan sweep, the teardown probes and the pid-identity probes. That makes 17,631 `ps`, 9,560 `lsof` and 2,012 `pgrep` spawns per run (A-2021), about 38% of file time in the research's regression. This ticket stops fixture hubs sweeping unless asked, makes test teardown signal only recorded identities verified by a targeted `ps -p`, and coalesces `processStarted` calls. The target is under 12,000 inspection spawns per run, saving about 500 s of test-time, about 2 minutes of a full run.

## Parent

"Test speed: quick wins" (R-228), tracer bullet 4; research #5 (`docs/research/test-speed.md` §3.5; §2 point 2; §1 "Fixed setup cost per spawned hub").

## What to build

**No sweep in fixture hubs by default.**

- In `hub/src/hub/daemon.ts` (the `sweep = … sweepOrphans(root, log, 'harness', …)` block after `serving`, about line 300), the daemon skips the start-up sweep when `CLAND_TEST_SKIP_ORPHAN_SWEEP=1` is in its environment. It logs `orphan-sweep-skipped` instead of `orphan-sweep-started`, so tests that read the journal see the difference.
- This is an env knob in the existing `CLAND_TEST_*` pattern (`CLAND_TEST_SKIP_LOCK`, `CLAND_TEST_ORPHAN_ROOT`), not a new seam.
- The periodic and on-demand sweeps (`doctor --fix`, `cland hub sweep` if present) are unaffected.
- `startDaemon` in `hub/test/harness.ts` (line 318) sets the variable unless the caller passes `{ sweep: true }`, or passes its own `CLAND_TEST_SKIP_ORPHAN_SWEEP`.
- Opt in: `orphan-servers.test.ts`, `orphan-sweep-lock.test.ts`, `daemon.test.ts`, the `doctor*.test.ts` files, `system-processes.test.ts`, `termination-ownership.test.ts`, and every test that asserts an `orphan-sweep-*` event or a swept process (grep `orphan-sweep`, `sweepOrphans`, `orphan` in `hub/test` and `nvim/test`). Post the list.

**Teardown from the ownership table** (`hub/test/process-cleanup.ts`).

- When a test's context has recorded seed identities (`ownProcess`, `rememberProcess`, `recordedProcess`: pid with start time and group), `cleanupProcesses` verifies them and their recorded descendants with one targeted `ps -p` and a `pgrep -g` per owned group. It signals only verified identities. It does not run the machine-wide `ps eww -ax` or `lsof -d cwd` scans.
- The machine-wide path stays for root-directory cleanup with no seeds, for the runner's phase sweep and for any seed whose identity no longer verifies, which falls back to today's full proof.
- The ownership rules of `termination-owner.ts` and T-279 hold unchanged: nothing is signalled without a start-time match.

**Coalesced `processStarted`** (`hub/src/hub/lock.ts` `processStartedAsync`, used by `adapters/processes.ts`, `adapters/sessions.ts`, `adapters/claude-code.ts`, `system-processes.ts`, `suite-lock.ts`, `executor/local.ts`).

- Concurrent calls for the same pid within one tick share one in-flight `ps`, and concurrent calls for several pids share one `ps -p a,b,c`.
- No result outlives its in-flight call, so a later call always reads the process table again and pid reuse stays detected. `pid-identity.test.ts` stays as it is.

**The census.** Run `node hub/test/spawn-census.mjs run` before and after at nearby heads, only when the verify queue has no holder or waiter (the load rule), and post `compare` output on the item. The census misses the `executor-*` files, which replace `NODE_OPTIONS`. Say so in the posted comparison.

## Acceptance criteria

- [x] C1. A fixture hub started by `startDaemon` without `{ sweep: true }` logs `orphan-sweep-skipped` and spawns no sweep `ps`/`lsof`, and a production `cland hub start` without the variable still sweeps, both proven by tests.
  - done: impl-392 · 2026-10-15T00:04:59.819Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-392-1 · 2026-10-15T00:09:13.677Z · commit 2d04d64915051ca3d82d5655d1dd4f370190bc92
  - verified: rev-23 [reviewer] · run rev-2026-10-15-392-2 · 2026-10-15T00:18:12.072Z · commit d6c913c280f26ec437a8da8fd8d77fc5cdf12d3d
  - verified: rev-23 [reviewer] · run rev-2026-10-15-392-5 · 2026-10-15T00:43:53.047Z · commit cc44e9cb76e8e1a60dc76b8029dc62626aa5af1f
- [x] C2. Every test that asserts sweep behaviour opts in, the list is posted on the item, and those tests pass with their assertions unchanged.
  - done: impl-392 · 2026-10-15T00:05:01.597Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-392-1 · 2026-10-15T00:09:13.677Z · commit 2d04d64915051ca3d82d5655d1dd4f370190bc92
  - verified: rev-23 [reviewer] · run rev-2026-10-15-392-2 · 2026-10-15T00:18:12.072Z · commit d6c913c280f26ec437a8da8fd8d77fc5cdf12d3d
  - verified: rev-23 [reviewer] · run rev-2026-10-15-392-5 · 2026-10-15T00:43:53.047Z · commit cc44e9cb76e8e1a60dc76b8029dc62626aa5af1f
- [x] C3. Teardown with recorded seeds runs no machine-wide `ps eww -ax` or `lsof -d cwd`, signals only start-time-verified identities, and falls back to the full proof when a seed does not verify, proven by tests in `termination-ownership.test.ts` or a new file.
  - done: impl-392 · 2026-10-15T00:42:49.017Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-392-5 · 2026-10-15T00:43:53.047Z · commit cc44e9cb76e8e1a60dc76b8029dc62626aa5af1f
- [x] C4. Concurrent `processStartedAsync` calls coalesce into one `ps` per tick, no result is reused after its call resolves, and `pid-identity.test.ts` passes unchanged.
  - done: impl-392 · 2026-10-15T00:05:04.107Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-392-1 · 2026-10-15T00:09:13.677Z · commit 2d04d64915051ca3d82d5655d1dd4f370190bc92
  - verified: rev-23 [reviewer] · run rev-2026-10-15-392-2 · 2026-10-15T00:18:12.073Z · commit d6c913c280f26ec437a8da8fd8d77fc5cdf12d3d
  - verified: rev-23 [reviewer] · run rev-2026-10-15-392-5 · 2026-10-15T00:43:53.047Z · commit cc44e9cb76e8e1a60dc76b8029dc62626aa5af1f
- [ ] C5. Measured: a census compare at nearby heads shows `ps` + `lsof` + `pgrep` under 12,000 per run (29,203 in A-2021) and at most 13 per daemon start, posted on the item with the census caveat for `executor-*` files.
- [x] C6. Measured (Coordinator amendment 2026-10-15 00:22Z: the verify queue never idled during the build): inspection spawns per default-subscriptions.test.ts run fall by at least 50% at nearby heads, and the paired-median (A/B x3, serial, load and holder recorded) whole-file times of default-subscriptions.test.ts and session-resume.test.ts show no regression beyond noise; the idle 15% target is re-measured in T-443.
  - done: impl-392 · 2026-10-15T00:28:39.622Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-392-3 · 2026-10-15T00:29:36.504Z · commit d6c913c280f26ec437a8da8fd8d77fc5cdf12d3d
  - verified: rev-23 [reviewer] · run rev-2026-10-15-392-5 · 2026-10-15T00:43:53.047Z · commit cc44e9cb76e8e1a60dc76b8029dc62626aa5af1f
- [x] C7. The runner's phase sweep and the dedicated orphan tests still detect a process leaked by a test, proven by an existing or new test that leaks one on purpose.
  - done: impl-392 · 2026-10-15T00:05:05.044Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-392-1 · 2026-10-15T00:09:13.677Z · commit 2d04d64915051ca3d82d5655d1dd4f370190bc92
  - verified: rev-23 [reviewer] · run rev-2026-10-15-392-2 · 2026-10-15T00:18:12.073Z · commit d6c913c280f26ec437a8da8fd8d77fc5cdf12d3d
  - verified: rev-23 [reviewer] · run rev-2026-10-15-392-5 · 2026-10-15T00:43:53.048Z · commit cc44e9cb76e8e1a60dc76b8029dc62626aa5af1f
- [x] C8. `hub/README.md` (Tests and the orphan sweep) describes the fixture default, the opt-in and the teardown path.
  - done: impl-392 · 2026-10-15T00:05:06.309Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-392-1 · 2026-10-15T00:09:13.677Z · commit 2d04d64915051ca3d82d5655d1dd4f370190bc92
  - verified: rev-23 [reviewer] · run rev-2026-10-15-392-2 · 2026-10-15T00:18:12.073Z · commit d6c913c280f26ec437a8da8fd8d77fc5cdf12d3d
  - verified: rev-23 [reviewer] · run rev-2026-10-15-392-5 · 2026-10-15T00:43:53.048Z · commit cc44e9cb76e8e1a60dc76b8029dc62626aa5af1f

## Comments

### impl-392 · 2026-10-14T23:57:20.609Z

Sweep audit: startDaemon calls now explicitly opt in in daemon.test.ts, orphan-servers.test.ts, doctor.test.ts, doctor-isolation.test.ts and termination-ownership.test.ts. orphan-sweep-lock.test.ts and system-processes.test.ts call sweepOrphans directly, so their sweep remains explicit. events-quiet.test.ts and session-async-processes.test.ts assert startup sweep completion through serveProject directly (no fixture skip environment), as do two orphan-servers tests. Other 'orphan' matches concern tracker items, executor resources, or runner process cleanup and do not depend on the startup harness sweep. Assertions are unchanged. New daemon regression covers fixture default, production default, opt-in and explicit env precedence.

### rev-23 · 2026-10-15T00:09:13.677Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-392-1
commit: 2d04d64915051ca3d82d5655d1dd4f370190bc92
scope: full

Source clear at 2d04d64915051ca3d82d5655d1dd4f370190bc92. Standards: no high or medium findings. Spec: no high or medium findings. Reviewed fixture skip/opt-in/env precedence and unchanged production sweep; targeted recorded identities and stale-identity fallback; explicit runner discovery and deliberate leak coverage; per-option in-flight PID batching, partial/failure handling, fresh reads and each caller's resumed scope. Sweep opt-in audit and existing assertion preservation checked; unchanged pid-identity and affected targeted checks recorded in A-2602. Detailed source review A-2607. C1,C2,C3,C4,C7,C8 verified. C5/C6 remain pending measurement and final exact-head evidence. Follow Coordinator 9a98164e for exclusive queued baseline/candidate full census, executor-* caveat and loaded paired timings; no idle claim.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C7 verified, C8 verified.

### rev-23 · 2026-10-15T00:18:12.073Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-392-2
commit: d6c913c280f26ec437a8da8fd8d77fc5cdf12d3d
scope: full

Source clear at d6c913c280f26ec437a8da8fd8d77fc5cdf12d3d. Standards and Spec: no high or medium findings. Reviewed the sole correction: default-subscriptions.test.ts waits for the fake Reviewer's completed Stop hooks and mod measurement before injecting manual cancellation states. The fake logs correspond to completed hook/turn work; original assertions, protocol calls, intervals and negative observation window remain unchanged. A-2616 records the causal trace and controlled red/green plus complete file 13/13; A-2611 preserves the earlier candidate failure and baselines. All implementation/docs from A-2607 are unchanged. A-2617 details this re-review. C1,C2,C3,C4,C7,C8 refreshed. C5/C6 remain pending fresh complete paired evidence, exclusive queued census and final exact-head verification; do not use the failed old timing set as qualifying evidence.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C7 verified, C8 verified.

### impl-392 · 2026-10-15T00:28:41.631Z

C6 complete under the Coordinator’s 00:22Z amendment. All 12 fresh serial A/B whole-file runs at d6c913c2 vs merge-base 131b7629 pass. Default-subscriptions: 52.91→45.14, 45.98→45.42, 41.09→45.64 s; paired median gain +1.22% (median paired reduction 0.56 s). Inspection totals 538/553/540→197/202/199 (about 63% lower), 21 daemon starts each. Session-resume: 66.95→62.82, 63.36→55.31, 56.60→53.61 s; paired median gain +6.17% (median paired reduction 4.13 s). Inspection totals 520/517/497→319/324/316, 12 starts each. All pairs, the unfavorable −11.09% pair, one-minute loads, holder/queue snapshots and logs are in the complete timing artifact. The 15% idle target was not measured and is deferred to T-443. C5 candidate full census remains queued; the baseline full waiter was cancelled before admission per the Coordinator.

### rev-23 · 2026-10-15T00:29:36.504Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-392-3
commit: d6c913c280f26ec437a8da8fd8d77fc5cdf12d3d
scope: evidence

C6 evidence clear under direct Coordinator ddfd58b6/a19929f4 and the amended tracker text. A-2619's 12 sequential whole-file logs all pass: default-subscriptions 13/13 each, session-resume 12/12 each; load and impl-434 hub-only holder recorded throughout. Recomputed default inspection reductions 63.38%/63.47%/63.15% (538/553/540→197/202/199, 21 starts each), exceeding 50%. Paired median gains are 1.2233% / 0.562522 s for default-subscriptions and 6.1655% / 4.127524 s for session-resume. The unfavorable -11.0895% default pair is retained. The original 15% idle target was not measured; T-443 owns that follow-up. Detailed checked values and evidence A-2620. Source head unchanged. C5 and final exact-head verification remain pending; C5 now follows Coordinator 4b64cc53's candidate-full versus nearby-head per-file/historical baseline disposition, not a newly run full baseline.

Criteria: C6 verified.

### rev-23 · 2026-10-15T00:40:23.269Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-392-4
commit: d6c913c280f26ec437a8da8fd8d77fc5cdf12d3d
scope: full

High — hub/test/process-cleanup.ts:204: protectedPids now contains stale seed replacements before ancestor traversal. If a stale seed names the cleanup worker, the loop stops at self, so ancestors and their groups remain unprotected and can be selected from fixture cwd for SIGKILL. Static review confirms the unsafe path reported in 0872a57a's synthetic parent-group-kill reproduction. C3 clearance is withdrawn; the prior source pass missed this interaction. Use an independent ancestor visited set and preserve protection of the full ancestor chain. A-2624 records the finding. Also require review of the reported cold hub self-identity/worker-ps fixture correction (suite.test.ts 66/67) with assertions retained. Census waiter cancelled before admission; no replacement census/verify until corrected-head source review. C5 remains pending and earlier C6 measurements describe this head only.

Criteria: C3 failed (A stale seed naming the cleanup worker pre-protects self and stops the ancestor walk, leaving a parent/group eligible for root-discovery SIGKILL; traverse ancestors with an independent visited set.).

### rev-23 · 2026-10-15T00:43:53.048Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-392-5
commit: cc44e9cb76e8e1a60dc76b8029dc62626aa5af1f
scope: full

Source clear at cc44e9cb76e8e1a60dc76b8029dc62626aa5af1f. Standards and Spec: no high or medium findings remain. C3 corrected with independent ancestor cycle detection: stale-seed protection cannot stop protection of self, ancestors and groups. A-2625 old-source red records SIGKILL -420061; corrected cleanup file 27/27 and deliberate phase-leak proof green. The native ps hold fixture now targets suite-worker.ts self probes, preserving the cold hub identity read; focused red/green checked and all cancellation/lock/ticket assertions unchanged. Detailed review A-2626. C6 retains A-2619/A-2620's labelled nearby-head evidence at d6c913c2: both measured files and normal startup/batch paths unchanged; the safety correction adds no inspection and the wrapper correction affects suite.test.ts only. This is not a new cc44e9cb measurement or an idle 15% claim; T-443 remains the idle follow-up. C1,C2,C3,C4,C6,C7,C8 refreshed. C5 candidate census and final exact-head verification remain pending; the corrected complete suite.test.ts must run there.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C6 verified, C7 verified, C8 verified.

### impl-392 · 2026-10-15T00:45:10.670Z

Source correction cc44e9cb is pushed after fetch/merge origin/dev (current) and source-cleared in rev-2026-10-15-392-5. A-2625 preserves synthetic stale-worker-seed red (incorrect parent group SIGKILL) and corrected full cleanup file 27/27, plus worker-only native ps fixture red/green without changing cancellation assertions, and final phase-leak proof. Independent visited ancestry fixes C3. A-2626 retains A-2619 as labelled nearby-head C6 evidence. Replacement candidate census at this head is in the authorized exclusive human queue; the obsolete census waiters were cancelled before admission, so neither is used as a full-run sample.
