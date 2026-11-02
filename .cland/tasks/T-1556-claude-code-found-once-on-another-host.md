---
id: T-1556
kind: task
title: Claude Code found once on another host
state: open
status: review
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1547
  - T-1554
topic: topic-1320
branch: t/T-1556-claude-code-found-once-on-another-host
created: 2026-10-31T23:47:43.786Z
updated: 2026-11-02T03:33:00.864Z
---

## Summary

For a Claude Code row on a host other than `local`, one `claude agents --json` at launch finds the worker, and a claimed warm spare keeps its pid. After that no short-lived `claude` command runs on a timer for that row, and liveness is by pid through its Host.

Hot files: `hub/src/adapters/claude-code.ts`

## Acceptance criteria

- [x] C1. A contract test with a recording host other than `local` counts exactly one `claude agents --json` per launch (test).
  - done: impl-1556 · 2026-11-02T03:33:00.864Z
- [x] C2. Over several poll intervals, no short-lived `claude` command runs through that host for a running row, and its liveness comes from the Host's alive (test).
  - done: impl-1556 · 2026-11-02T03:24:34.332Z
- [x] C3. A resume of such a row after a hub restart runs at most one discovery (test).
  - done: impl-1556 · 2026-11-02T03:24:34.443Z
- [x] C4. Rows on `local` keep today's `agents --json` schedule, and `claude-code-schedule.test.ts` passes with no test edited.
  - done: impl-1556 · 2026-11-02T03:24:34.768Z

## Comments

### impl-1556 · 2026-11-02T03:21:10.558Z

Rule 20 inventory: searched hub/src and hub/test plus qa, docs/agents, shipped skills, nvim/test and web/test for ClaudeCodeAdapter, claude-poll:, agentsMs/agentsVersion, claude agents/agents --json. Runtime consumers: adapters/index.ts constructs adapter; adapters/sessions.ts owns spawn/resume/watch/stop and warm-spare claim (no discovery there); doctor/ranges.ts only parses usage and is unaffected. Tests: claude-code-{host,sessions,schedule,accounts,environment}, session-host-routing, project-hub, adapter-native-boundary, human-hold, secrets-environment, mod-bridge and harness/fake Claude. Local controls stay unchanged. Remote poll-replacement expectations need migration to the new no-timer contract; resume proof assertions retained. No wire or persisted process shape changes. Local claude-poll:<configDir> stored schedule stays compatible; nonlocal discovery schedules will be separated from local and other remote rows. QA briefs E-1531-stage-2 and historical E-414/E-417/T-108/115/229/272 exercise local/fake CLI and are unaffected; hooks/test docs clarify nonlocal policy.

### impl-1556 · 2026-11-02T03:22:42.204Z

Coordinator decision 77fb0104-e8f3-4971-9482-d07f7dea1c5d (coord, 2026-11-02 03:22Z) authorizes consumer migration under spec §3.1. Changed the two T-1554 cases formerly named 'remote Claude poll persists pending PID Linux proof without a legacy timestamp' and 'remote Claude poll persists replacement PID Linux proof without a legacy timestamp': they now assert no timer discovery/acquisition, retain Linux birth and native-owner assertions, and check Host.alive for recorded PIDs. Resume variants retain their persistence/ownership assertions. Missing launch PID remains supervised/running with unknown PID, logs harness-pid-unknown, performs no local or remote PID probe, and has no timer retry; explicit resume can discover once.

### rev-35 · 2026-11-02T03:26:54.430Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1556-source-1
commit: b843ae249de9b6ef37b4a4523115b6be2f4fd1c2
scope: full
findings: [{"severity":"medium","text":"Forced launch discovery still joins d.agentsFlight before refresh; same-session relaunch reuses its old schedule key. A held predecessor hook/native-identity query can survive successful stop and be reused after the new --bg launch, yielding old-job-only entries, pid:null and no timer retry. Isolate/drain prior-generation work then issue one launch-owned fresh query; add held same-session relaunch regression with new PID/birth and no later timer commands.","file":"hub/src/adapters/claude-code.ts","line":365}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear: one medium inherited remote discovery-flight finding at Claude:365/292/548. Different-session and fresh-adapter tests miss same-session relaunch overlap. Other nonlocal timer/resume/local schedule slices inspected, C2–C4 runtime unverified. Coordinator77fb0104 confirms two T-1554 poll test migrations; Linux/native-owner assertions retained, resume/schedule preservation unchanged. Missing-PID policy explicit. A-15556 has concrete held-flight control and both review axes. Local15/16/46/static evidence supplemental only; fresh source review before verify. No Reviewer tests/browser/edits; QA after-stage separate.

Criteria: C1 failed (A same-session relaunch can consume a predecessor's in-flight agents snapshot instead of its own single fresh worker discovery.).

### rev-35 · 2026-11-02T03:30:30.001Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1556-source-2
commit: 8b6f7942f20efd9e1c99b4da054ea325e53fbd8b
scope: full
findings: [{"severity":"medium","text":"held.release after-hook is registered after remoteFixture's awaited adapter.close. Node runs these hooks in registration order. A setup timeout before explicit release303 leaves close awaiting the held query/resume and never reaches the release hook. Release gates before bounded drains in finally/fixture cleanup; retain a setup-failure control and final functional assertions (rules9/12).","file":"hub/test/claude-code-host.test.ts","line":298}]
finding_counts: {"high":0,"medium":1,"low":0}

Runtime A-15556 fix is addressed: nonlocal launch drains predecessor with agentsAfterCurrent then fresh post-bg discovery; local path retained. New positive second-launch/new PID+birth/query-count regression is appropriate, but medium after-hook ordering deadlock remains on setup failure. C1 failed for bounded test cleanup, C2–C4 runtime unverified. A-15558 records precise flow and primary Node hook-order source; no Reviewer execution. Fresh source review before verification; local16/static reports supplemental. QA after-stage separate.

Criteria: C1 failed (The new held same-session launch regression can hang indefinitely in teardown when its setup boundary is missing, despite nominal 5s setup waits.).

### rev-35 · 2026-11-02T03:32:54.116Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1556-source-3
commit: dc7d07ac8e77509b503c898c1de2a42e547ceb02
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear, no findings. A-15558 resolved: fixture-owned gate releases registered at acquisition run before bounded adapter joins; later after-hook removed; before/after-entry abandonment controls close in finally and join inspection, preserving final assertions. Runtime A-15556 predecessor drain/fresh query fix remains unchanged and new PID/birth/query-count regression retained. No-timer/unknown-PID/restart/mixed local schedule source plus authorized prior poll migrations inspected; local schedule file unchanged. C1–C4 runtime criteria await same-head queued mode-free evidence/named Host18/routing16/schedule46. Local targeted/static reports supplemental. C1 done still unchecked in task.view; claimant should re-mark done for fix. Details A-15560. No Reviewer execution/browser/edits; QA full after-stage separate.
