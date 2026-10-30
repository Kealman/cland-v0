---
id: T-1469
kind: task
title: Claude Code poll must not turn a pushed idle into busy
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1468
blocked_by: []
topic: topic-1226
branch: t/T-1469-probe
created: 2026-10-30T07:50:08.613Z
updated: 2026-10-30T08:16:29.179Z
---

## Summary

Background sessions report `busy` in `claude agents --json` while background shells, monitors or sub-agents run, so the 15 s poll override flips an idle coord to busy. Hooks are the reliable source for busy. Let the poll report idle, waiting or unknown, and liveness, but never override a pushed idle with busy.

Root cause: A-14159 (deaf-bridge RCA, 2026-10-30). Epic E-1468.

## Acceptance criteria

- [x] C1. A Claude Code session whose last push signal is idle stays idle when `claude agents --json` reports `status: busy` for it.
  - done: impl-1469 · 2026-10-30T08:00:03.151Z
- [x] C2. A poll busy still applies to a launch that has sent no push signal yet (state `unknown`).
  - done: impl-1469 · 2026-10-30T08:00:03.284Z
- [x] C3. A test replays idle hook → poll busy 37 s later → human send and asserts outcome `delivered` and one inject frame.
  - done: impl-1469 · 2026-10-30T08:09:26.665Z

## Comments

### impl-1469 · 2026-10-30T07:58:04.569Z

Contract inventory before policy change: searched pushTrustMs, CLAND_PUSH_TRUST_MS, signal-stale, stateOfAgent and agents --json across production, all test tiers, web/nvim/shared, shipped skills, docs and QA briefs. Production owner Sessions.#signal; adapter claude-code.ts retains stateOfAgent busy and liveness for unknown launches; adapters/index.ts timing comment updated. Doctor ranges unaffected. Wire/session.list shapes and state labels unchanged; previous-wire injected acknowledgement regression remains in touched test. Consumers in harness.ts, fakes/claude-code, claude-code-sessions/lifecycle, codex-adapter, default-subscriptions-lifecycle, lead-routing-process, inbox-requests and QA T-108/T-115/T-229/T-272/T-386/E-414/E-414-stage-1/E-417-stage-1 remain valid: their poll suppression or CLI discovery still applies. New policy is Claude-only busy suppression after any accepted push. Other adapters and non-busy poll states keep existing trust window. Reproducer written first failed with actual 'busy' !== expected 'idle' after 37 virtual seconds. With narrow guard, touched T2 file now passes 23/23 locally (macOS arm64 Node 24.21.0; scripted execFile, no harness/browser, not a suite or memory benchmark).

### rev-26 · 2026-10-30T08:03:53.658Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1469-source-1
commit: 21e0174f0d6ca756b8a959dea0d066ee1caac519
scope: full
findings: [{"severity":"medium","text":"M1: new replay mocks only realClock.now while timers remain native and copies a custom polling loop. Use a complete owned transport Clock/default seam and shared bounded poll observation, preserving37s sensitivity and all final assertions.","file":"hub/test/claude-code-schedule.test.ts","line":242},{"severity":"medium","text":"M2: pre-armed inject promise is unowned while send can fail/wait longer; receipt races do not cancel/join losers. Raw bridge/setup acquisition also precedes bounded cleanup ownership. Reuse shared owner/buffered observation and omitted/aborted setup controls.","file":"hub/test/claude-code-schedule.test.ts","line":265}]
finding_counts: {"high":0,"medium":2,"low":0}

A-14166 consolidated Standards M1/M2; no extra product defect found in narrow Claude busy suppression. C1/C2 runtime pending, C3 test proof incomplete. Preserve local A-14162 before/after summary and exact state/delivered/id/count assertions; fix together then fresh pushed-head source review before any configured verify. No Reviewer execution.

Criteria: C3 failed (The37s replay uses a partial global clock and unowned acquisition/inject observation, so its requested proof needs correction before verification.).

### impl-1469 · 2026-10-30T08:09:00.707Z

Review M1/M2 rework inventory: new optional complete transportClock flows projectHub→serveProject→projectSessions→Sessions; omission defaults to realClock and retains existing production behavior. Sessions' hook interpretation/default signal times, push receipt age, retry signal and injection sentAt all share this identity. Adapter scheduling explicitly receives the same FakeClock in the replay. Existing server.ts transportClock only controls WebSocket liveness and is unaffected; direct projectSessions consumers (server.ts; session-brief(-component), account-coalescing, request-guard, session-credential-io, inject-stalled, task-worktrees, session-async-processes, system-processes, session-cwd, orphan-servers, name-reservation, launch-admission, lifecycle-serialization, session-events) omit the new optional property and keep real time. new Sessions callers in session-archive, artifact-lifecycle, tracker-native-boundary and roles-session-refresh also retain defaults. Search covered all new Sessions/projectSessions call sites. No wire/config/permission expansion. Reused cardWebOwner and pacingOwner without modifying them; new replay omitted/aborted readiness controls check matched native close counts, joined owner, zero pending observations/timers and stopped hub. Negative control on a disposable tracked-source copy (excluding .cland) removes only the busy guard: pushed case fails actual busy != expected idle, no-push case passes. Normal touched file 25/25 locally; static checks in progress.

### rev-26 · 2026-10-30T08:16:29.179Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1469-source-2
commit: 0e4e1b87643220261273efa18ce2a885776df26f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14180: Standards and Spec source clear; M1 complete transport Clock/default forwarding and M2 owned setup/buffered exact-id observation resolved. C1-C3 runtime verification remains pending configured evidence at this exact frozen head. Local A-14174 summary retained with platform and negative-control limits. No Reviewer execution. Coordinator owns T-1471 second-landing resolution and any later merge-delta review.
