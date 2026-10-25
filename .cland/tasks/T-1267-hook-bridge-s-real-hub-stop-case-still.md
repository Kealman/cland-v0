---
id: T-1267
kind: task
title: hook-bridge's real-hub stop case still leaks a Timeout on Linux after T-1261
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1261
found_by: droplet
topic: topic-1012
branch: t/T-1267-hook-bridge-s-real-hub-stop-case-still
created: 2026-10-25T00:40:42.289Z
updated: 2026-10-25T01:26:22.963Z
closed: 2026-10-25T01:26:22.963Z
---

## Summary

Periodic dev T3 fd9b6fdd at ed77f253 (Linux droplet c-8 lon1, A-11554), which contains T-1261's fix (90da1923), failed `hub/test/scenarios/hook-bridge.test.ts:16` "a bridge exits after its real hub stops even while its parent and stdout remain alive" again: `projectHub leaked resources; active before=CloseReq,PipeWrap×5,ProcessWrap after=PipeWrap×5,ProcessWrap` with `resources: ['Timeout']`. T-1261 found and drained one source (the Claude CLI execFile delayedKill timer); a second Timeout survives stop on Linux. It passed in the first stage cover's Linux shards at the same SHA (e70d2393, A-11549).

## Acceptance criteria

- [x] C1. The surviving Timeout's creation site is named from a creation stack (the async_hooks method T-1261 used), cleared or awaited on stop, with a deterministic red control (test).
  - done: impl-1267 · 2026-10-25T00:59:26.209Z
  - verified: oc-rev-1 [reviewer] · run rev-oc-20261025-1 · 2026-10-25T01:05:33.849Z · commit 70663b546dd1f13c0d5969eb0c33234e102bb774
  - verified: oc-rev-1 [reviewer] · run rev-oc-20261025-2 · 2026-10-25T01:20:01.180Z · commit 70663b546dd1f13c0d5969eb0c33234e102bb774
- [x] C2. The item's mode-free droplet verify at 2 workers passes the hook-bridge case, and its new red-control identity passes its load-gate repetitions (test).
  - done: impl-1267 · 2026-10-25T01:19:37.219Z
  - verified: oc-rev-1 [reviewer] · run rev-oc-20261025-2 · 2026-10-25T01:20:01.180Z · commit 70663b546dd1f13c0d5969eb0c33234e102bb774

## Comments

### coord · 2026-10-25T00:43:12.217Z

The periodic dev T3 failing-file rerun f17f426b at the same SHA ed77f253 (Linux droplet, A-11555) passed hook-bridge.test.ts 1/1. The leak is intermittent; the red control needs to force the timing window.

### impl-1267 · 2026-10-25T00:43:18.513Z

Static phase under cover-quiet: read T-1261, landing 90da1923, A-11502 and failing A-11554; inspected all hub/src timer creation sites and hub/adapters stop ownership. Diagnostic async_hooks creation-stack capture is prepared in the existing restarted-hub resource census, with no production fix or weakened assertion. No local test/probe/typecheck has run. Candidate timer owners remain unconfirmed until the Coordinator's slot-free notice permits the first targeted capture. Static inventory and next slice are in the item topic artifact.

### impl-1267 · 2026-10-25T00:57:11.651Z

Creation-stack red control now obtained locally at base eedc8101 with only diagnostic/scenario edits: put agents-hold before restarted projectHub startup, then stop during its startup resume query. A-11563 captures the exact ['Timeout'] failure and creation stack: shared/clock.ts setInterval -> ClaudeCodeAdapter.watch (claude-code.ts:613) -> Sessions.#resume alive fallback (sessions.ts:1394). Sessions.close closes adapters before draining lifecycle work; the resumed alive fallback subsequently calls watch again, rearming a closed adapter's interval. Cheapest regression is T1 Sessions.resume/close with held fake native resume or identity-probe completion. Three new generated cases (found/alive/identity) currently fail the expected shutdown-rejection assertion. Planned fix adds the existing 'hub is closing' fence after native resume completion and after its optional process-identity await, preventing late watch/publication. This changes no reply shape, schema, refusal class or admission/credential policy: the same closing error already exists at resume entry and lifecycle admission. Production consumers are daemon startup resumeAll and Dispatcher session.resume; test callers across all tiers, docs, QA/skills retain the same contract. The existing native T3 bridge assertion remains and now forces the timing window.

### oc-rev-1 · 2026-10-25T01:05:33.849Z

verdict: review
result: clear
by: oc-rev-1 [reviewer]
run: rev-oc-20261025-1
commit: 70663b546dd1f13c0d5969eb0c33234e102bb774
scope: full
findings: [{"severity":"low","text":"The 1s node:test bound is the tightest in hub/test (every other explicit bound is 2000/5000/10000/30000) and it also covers fixture setup, so a loaded T1 shard can time out before the behaviour assertion runs; 2000 matches the T1 peers and the documented wait budget.","file":"hub/test/lifecycle-serialization.test.ts","line":43},{"severity":"low","text":"Both guards throw before the relaunch-path releaseLaunchRole/launchSettled calls, so a reservation taken for a relaunch survives the close and is rolled back by releaseInterruptedLaunches at the next hub start; that is the documented startup rollback, but the new comment does not say so, so a later reader may mistake it for a leak.","file":"hub/src/adapters/sessions.ts","line":1392}]
finding_counts: {"high":0,"medium":0,"low":2}

Source review (full) at 70663b546dd1f13c0d5969eb0c33234e102bb774, tree e1050213203db99e75b936cdd19fd810ea9fd644, base origin/dev 4decf43e (pushed branch tip matches origin/t/T-1267-hook-bridge-s-real-hub-stop-case-still; worktree clean; git diff --check clean).

Spec: C1 is source-satisfied. A-11563 names the creation site from the async_hooks stack — shared/clock.ts setInterval <- ClaudeCodeAdapter.watch (claude-code.ts:613) <- Sessions.#resume alive fallback (sessions.ts:1394) — and the fix fences both late continuations: the settled callback (sessions.ts:1392) and publish (sessions.ts:1370). A resume result or optional process-identity completion that lands after close() therefore neither re-arms adapter.watch nor writes/logs/publishes a row. Both fences are needed and both are exercised: found (cached identity) and alive hit the settled fence; identity hits the publish fence after the probe await. Deterministic red controls: the three T1 cases in lifecycle-serialization.test.ts fail 3/3 before the fence and pass 3/3 after (A-11564), and the T3 scenario now writes agents-hold before the restart so startup resume is held across adapter close; the forced red run reproduces resources:['Timeout'] with that same creation stack and goes green post-fix. No scope creep: the hold move in hook-bridge.test.ts and the opt-in captureStacks in hub-resources.ts are diagnostic/forcing changes only, and successful runs print no stacks.

Standards: the three new cases are T1 (fake adapter, injected processStarted, in-memory table, no sockets or child processes, no real time). They wait on the adapter-close deferred and the resume rejection, not elapsed time, and the negative assertions (no watch, unchanged row, no publication) have a positive completion boundary (adapter closure plus the awaited lifecycle drain). fixtureEnvironment is used after the fixture is built (rule 15). Docs were updated in the same item: hub/README close() row, both docs/agents/tests/ files (including the corrected 'Before starting the second hub' line) and the implement skill plus CHANGES (rule 16); no stale 'until X lands' wording introduced. No wire, schema, role/permission, admission or dependency change; the consumer list for the closing refusal is in the item comment and matches the pre-existing 'the hub is closing' refusal at resume entry, with resumeAll still logging resume-failed.

C2 stays unverified: it needs the mode-free droplet verify at this exact head (2 workers) and the new T1 identities' load-gate repetitions. This verdict is source evidence only; local Darwin receipts in A-11564 are not Linux evidence.

Findings (low only; nothing blocks a clear).

Criteria: C1 verified.

### impl-1267 · 2026-10-25T01:06:17.326Z

Expanded adapter audit per Coordinator: ClaudeCodeAdapter.watch (613) and CodexAdapter.watch (1050–1068) both lack their own entry closed fence and can create polling intervals when called after close; Codex also stages reconnection/publication in watch. OpenCodeAdapter.watch (408) already returns when closed, so the late Sessions call cannot rearm its watcher, but the common Sessions publication still needed fencing. FakeHarness.watch only updates its in-memory row; inline request-guard/tracker-native-boundary and lifecycle fakes likewise retain synchronous close compatibility. The Sessions settled/publish fences cover every registered adapter, including replacement factories, without changing their public interface. Native T3 establishes Claude's concrete timer, while T1 generic Sessions cases cover all adapter outcomes at the common owner. The control belongs at T1 (not T2), as it needs no sockets or native process.
Source review rev-oc-20261025-1 is clear at 70663b54. Keeping that head unchanged for verification. Two nonblocking lows are retained as review observations: 1s fixture-inclusive test bound (local generated cases 5–18ms); interrupted relaunch reservation recovery remains in releaseInterruptedLaunches at next startup. No diagnosis/proof run is counted as C2.

### impl-1267 · 2026-10-25T01:19:37.386Z

C2 evidence inspected independently of exit status: mode-free run 402f09c9-af55-48b8-a570-7dd04fbfce30/A-11569 is green at exact source-reviewed head 70663b546dd1f13c0d5969eb0c33234e102bb774; no source changes. Linux x64 6.8.0-142-generic, Node24.21.0, c-8 lon1 droplet cland-v0-056119b1, explicit2workers (Web internally4). Fresh host T0 npm run check exit0/25.547s on macOS is separate; droplet log173 explicitly reuses host-gate tree c176faa9, not repeated Linux T0. All T1, fallback all hub/Neovim T2, changed T3 bridge once, mapped T4 inbox-verifier-load once and Web completed. Isolated Chrome Headless Shell156.0.8078.4/playwright1248. No remaining T3/T4 cover; T4 load repetition skipped by policy; Web0new files/0repetitions required, report-only admission.
Parsed suite progress terminal facts: 3108 ordinary test passes/439 file passes and separately15 load-gate test passes/15 file passes, no failed/cancelled/skipped terminal outcomes. New exact generated T1 identities: 'shutdown drains a held found resume without restarting supervision or publishing its result'; 'shutdown drains a held alive resume without restarting supervision or publishing its result'; 'shutdown drains a held identity resume without restarting supervision or publishing its result'. Each has one base pass and five separate scope=load-gate pass records; 5/5 summaries at lines1861/1856/2575. Native 'a bridge exits after its real hub stops even while its parent and stdout remain alive' passes once,3.990429317s, line15697, with held startup query, immediate resource census and retained PID assertions. Timing/budgets/ratchet remain report mode; unavailable base manifest is not a ratchet clearance. Droplet lifetime715s/$0.0496 is machine lifetime/cost, not suite wall time.

### oc-rev-1 · 2026-10-25T01:20:01.180Z

verdict: review
result: clear
by: oc-rev-1 [reviewer]
run: rev-oc-20261025-2
commit: 70663b546dd1f13c0d5969eb0c33234e102bb774
scope: evidence
findings: [{"severity":"low","text":"The 1s node:test bound is the tightest in hub/test (every other explicit bound is 2000/5000/10000/30000) and it also covers fixture setup, so a loaded T1 shard can time out before the behaviour assertion runs; 2000 matches the T1 peers. Not reproduced: the three cases ran 5/5 in the load gate at 2 workers (0.02-0.05 s each).","file":"hub/test/lifecycle-serialization.test.ts","line":43},{"severity":"low","text":"Both guards throw before the relaunch-path releaseLaunchRole/launchSettled calls, so a reservation taken for a relaunch survives the close and is rolled back by releaseInterruptedLaunches at the next hub start; that is the documented startup rollback, but the new comment does not say so.","file":"hub/src/adapters/sessions.ts","line":1392}]
finding_counts: {"high":0,"medium":0,"low":2}

Final evidence review (scope evidence) at 70663b546dd1f13c0d5969eb0c33234e102bb774 — same head and tree (e1050213203db99e75b936cdd19fd810ea9fd644) as the source-clear verdict rev-oc-20261025-1; origin tip and worktree HEAD both 70663b54, worktree clean.

Run 402f09c9-af55-48b8-a570-7dd04fbfce30 (A-11569): auto, mode full, Linux droplet c-8 lon1, linux x64 6.8.0-142-generic, Node v24.21.0, 2 workers (explicit --workers), head 70663b54 as the log records it (line 8). Totals 3108 tests, 3108 pass, 0 fail, 0 cancelled, 0 skipped; every tier exit 0 (T0, T1, T2, T3, T4, Web).

C2 clause 1: 'a bridge exits after its real hub stops even while its parent and stdout remain alive' (hub/test/scenarios/hook-bridge.test.ts:16) ran on Linux at 2 workers and passed in 3.990429317 s (log line 15699; tier T3: files 1, tests 1). This is the task-head T3 selection — the changed T3 file once — not a full T3 pass: the log names 'remaining T3: periodic dev and integrated occasions', which is the documented policy for a task head and is not claimed here as T3 coverage.

C2 clause 2: the three new T1 identities each ran five sequential load-gate repetitions alongside the phase in the same Linux run — 'shutdown drains a held found/alive/identity resume without restarting supervision or publishing its result', 30 load-gate test records = 15 starts + 15 finishes = 5/5 pass each. T1 counts 922 tests against 919 on dev; the +3 are these cases.

C1 stays source-established from rev-oc-20261025-1 and is unchanged at this head; the same-head run adds no new source finding. The effective tree did not change, so no fresh source review was needed and the tree-hash evidence stands for 70663b54.

Findings: the two lows from the source pass remain open, non-blocking observations, unfixed at this head (listed below). Nothing high or medium. Both criteria verified across the source pass and this run.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T01:26:22.963Z

Merged fa47be73bd14f445ed3a0b3ddcb41cf5605379a9 onto dev.
