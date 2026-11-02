---
id: T-1554
kind: task
title: Liveness, stop and signals routed by the row's host
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1545
  - T-1547
  - T-1548
  - T-1552
topic: topic-1317
branch: t/T-1554-liveness-stop-and-signals-routed-by-the
created: 2026-10-31T23:47:43.310Z
updated: 2026-11-02T03:19:22.868Z
closed: 2026-11-02T03:19:22.868Z
---

## Summary

The Host lookup returns the row's own host. Liveness, stop, signals and pending-stop recovery of a row on another host go only to that host, checked by a Linux birth identity (boot id plus start ticks). No pid of such a row is probed or signalled on the hub's machine.

Hot files: `hub/src/adapters/sessions.ts` (the registry lookup), `hub/src/adapters/index.ts`, `hub/src/adapters/processes.ts`, `hub/src/adapters/launch-files.ts`, `hub/src/host/test-host.ts`

## Acceptance criteria

- [x] C1. Every liveness check, stop, signal and pending-stop recovery of a row goes to the Host its `host` column names (test with recording hosts).
  - done: impl-1554 · 2026-11-02T02:10:32.203Z
  - verified: rev-35 [reviewer] · run rev-35-1554-final-1 · 2026-11-02T02:32:53.343Z · commit 197b6e09d4932a30121794cd3c87072c772a8d98
- [x] C2. A row on another host is alive only when that host reports the recorded `linux:<boot id>:<start ticks>` identity for its pid, and a row there without a Linux identity is never stopped by a signal (test).
  - done: impl-1554 · 2026-11-02T02:02:16.200Z
  - verified: rev-35 [reviewer] · run rev-35-1554-final-1 · 2026-11-02T02:32:53.343Z · commit 197b6e09d4932a30121794cd3c87072c772a8d98
- [x] C3. A row naming an unregistered host is neither probed nor signalled on the hub's machine and shows the state `unknown` (test).
  - done: impl-1554 · 2026-11-02T02:02:16.329Z
  - verified: rev-35 [reviewer] · run rev-35-1554-final-1 · 2026-11-02T02:32:53.343Z · commit 197b6e09d4932a30121794cd3c87072c772a8d98
- [x] C4. With an in-process hub whose `local` host is a spy, a row on a test host whose pid is a live local process gets no `local` operation for that pid through startup, the poll, `session stop`, `session resume` and the orphan sweep (test).
  - done: impl-1554 · 2026-11-02T02:02:16.657Z
  - verified: rev-35 [reviewer] · run rev-35-1554-final-1 · 2026-11-02T02:32:53.343Z · commit 197b6e09d4932a30121794cd3c87072c772a8d98
- [x] C5. Through the frame protocol on a real hub with `CLAND_TEST_HOSTS`, the same row's `session stop` leaves the local process running, and `hub.log` shows the test host answering for it (test).
  - done: impl-1554 · 2026-11-02T02:02:16.779Z
  - verified: rev-35 [reviewer] · run rev-35-1554-final-1 · 2026-11-02T02:32:53.343Z · commit 197b6e09d4932a30121794cd3c87072c772a8d98
- [x] C6. Rows on `local` keep today's checks, the legacy `pid_started` fallback included, and the session-stop-races and session-async-processes test files pass with no test edited.
  - done: impl-1554 · 2026-11-02T02:02:16.901Z
  - verified: rev-35 [reviewer] · run rev-35-1554-final-1 · 2026-11-02T02:32:53.344Z · commit 197b6e09d4932a30121794cd3c87072c772a8d98

## Comments

### impl-1554 · 2026-11-02T01:56:10.060Z

Consumer inventory before changes: searched hub/src and hub/test (including colocated tests), nvim/test, web/test, qa/briefs and .agents/skills for hostForProcess, processAlive, sameProcess, pidIdentity/pid_identity, harness_processes and pendingStops. Runtime consumers: Sessions lookup/startup/deaf/pending-stop/legacy upgrade; Claude/Codex/OpenCode liveness and stop; LaunchFiles rollback; local Host/processes/system-processes native identity; orphans local-only snapshot; dispatch/requests frame projection. Tests: session-host, host-registry, host-orphans, claude-code-host, codex-host, opencode-host, launch-recovery, session-resume-component, pid-identity, termination-ownership, session-stop-races/session-async-processes and colocated hub/src/hub/worktrees.test.ts. Executor/fixture/suite ownership paths use their separate local process authority and remain unaffected. No wire/schema shape change; local compatibility and existing unknown-host regressions retained. Agreed seams from C1–C5: recording Host via Sessions/real adapters, projectHub frame protocol with CLAND_TEST_HOSTS, and existing orphan snapshot/sweep seam. Add remote Linux proof fencing at registry boundary; local Host remains unchanged.

### impl-1554 · 2026-11-02T02:01:14.821Z

Consumer inventory and targeted evidence retained as A-15520 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15520-t-1554-consumer-inventory-and-routing-evidence.md. New regressions also found/fixed Claude native stop fallback after remote ownership refusal. Documentation is confined to existing Host sections; no CLI/schema/frame/role permission change. npm run test:lint exit 0: 0 refusals, 122 report-only findings in 59 files; known CLI install baseline T-1484 remains report-only. First origin/dev fetch/merge is already up to date.

### rev-35 · 2026-11-02T02:05:14.808Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1554-source-1
commit: 6d36f1d014e6452e1b4e09af311cfffec87141b3
scope: full
findings: [{"severity":"medium","text":"For a new agents-reported PID, #pidAlive passes {pid}, which new remote processHost.matches rejects before Host observation. Poll846 never reaches replacement proof acquisition850 (and recheck862 also fails); resume1006 discards proof fetched1003. Matching remote native jobs cannot acquire initial/replacement PIDs and may be retired as the old PID dies. Bind observed Linux proof to captured job/session/row for candidate liveness and add poll/resume replacement + stale-owner/mismatch controls, allowing null legacy pid_started remotely.","file":"hub/src/adapters/claude-code.ts","line":317}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear: one medium Claude:317 consumer incompatibility with the new proof-checking registry wrapper. Fixed-PID tests miss replacement acquisition in poll846/862 and resume1003–1006. Preserve job/session ownership and post-await fences; verify candidate Linux birth without requiring a remote legacy timestamp. C1 failed; C2–C6 runtime unverified. Remaining registry/local compatibility/rollback/stop changes and matching docs reviewed; local preservation files unchanged. A-15524 details both review axes and concrete regression requirements. A-15520 reported local checks supplemental only. Fresh source review before verification. No Reviewer execution/browser/edits; QA after-stage separate.

Criteria: C1 failed (Remote Claude initial/replacement PID liveness is rejected before it reaches the owning Host with its observed Linux proof, breaking matching-job poll/resume acquisition.).

### impl-1554 · 2026-11-02T02:08:39.833Z

Source correction inventory: searched recordPid across hub/src, hub/test, all nvim/web/shared sources, QA briefs, shipped skills/docs. Its only production writer is Claude poll and its only implementation is Sessions.host; all other matches are AdapterHost test doubles (mostly zero-argument callbacks; schedule tests consume PID only), including colocated opencode.test.ts. Internal recordPid pidStarted accepts explicit null as additive input so remote Linux proof can publish atomically without re-probing an acquired candidate. No wire change; omitted timestamp still follows the previous identity-observation path. Remote poll/resume tests now cover both replacement and initial pending PID, no timestamp, mismatched births, foreign/stale native owners, and close.

### rev-35 · 2026-11-02T02:11:50.725Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1554-source-2
commit: 197b6e09d4932a30121794cd3c87072c772a8d98
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear, no findings. A-15524 resolved: remote Claude poll/resume candidate liveness uses observed Linux proof bound to captured native job/conversation, with owner/PID/object/pending-identity/stopping/closed fences after I/O. Null remote timestamp accepted atomically in recordPid; omitted input/local legacy behavior retained; shared Linux parser. Four durable persisted-PID positive cases and six bounded foreign/stale/birth/close controls reviewed; routing now16. Internal recordPid additive contract inventory checked across production/colocated/tests/docs; original preservation files unchanged. C1–C6 runtime criteria await exact-head queued mode-free verification and named routing/registry/Host/unknown-orphan/local6+3/schedule46 outcomes; deferred files require labeled native receipts. A-15528 local/static reports supplemental. Details A-15529. No Reviewer execution/browser/edits; QA full after-stage separate.

### rev-35 · 2026-11-02T02:32:53.344Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1554-final-1
commit: 197b6e09d4932a30121794cd3c87072c772a8d98
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, C1–C6 verified; no findings. Exact-head uncached1df009f1/A-15535 exit0,4668 pass, zero fail/cancel/skip/todo. Streamed named outcomes routing16 (collision/startup/poll/resume/stop/sweep/frame, pending-stop, candidate/stale/birth/close), session-host8, registry4, ClaudeHost9/schedule46, CodexHost19/OpenCodeHost9 and unchanged async-processes3 pass. Required stop-races6 named native exit0/no signal now at exact clean head/Git treea3ca5f350721da61880abb758b971d7fc249028c in A-15536, local Darwin arm64 Node24.21/no browser. Both C6 files unchanged. Remote Linux x64 droplet Node24.21/Neovim0.12.5/isolated HeadlessShell1248 Chrome156.0.8078.4, candidate treefc4d26d48bbeeb3d07330fbc21d693a22034aa6a; T0/T1/allT2/Web/mappedT4base complete, T3 deferred/T4 repetitions skipped, diagnostics report-only. host-orphans deferred; routing sweep case directly passed. A-15537 details limits. Source head unchanged; merge-batch/QA full after-stage separate. No Reviewer execution/edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-11-02T03:19:22.868Z

Merged fa5e2b180e9f0ca831c02aac7964d311f7ac308d onto dev.
