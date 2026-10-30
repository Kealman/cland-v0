---
id: T-1467
kind: task
title: Measure what holds the hub's memory at startup and at rest
state: open
status: ready
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1466
blocked_by: []
topic: topic-1221
branch: t/T-1467-measure-what-holds-the-hub-s-memory-at
created: 2026-10-30T06:38:36.583Z
updated: 2026-10-30T08:42:19.215Z
---

## Summary

Measure what holds the hub's memory at startup and at rest on a scratch copy of this project's live data, and name the top retainers with sizes and code paths, so the fix tickets can be cut from facts.

## What to build

- A reproducible measurement script, committed under `hub/test/` or `tools/`. It copies the live project's `.cland` state into a disposable root (rule 15) and starts a sealed hub on it. It samples RSS, heap used and total, external memory and array buffers every second through startup and 10 minutes at rest. It takes heap snapshots at the end of startup and at rest.
- An artifact with the breakdown:
  - the top retainers by retained size, with their code paths, such as tracker index, artifact index, message history, coverage maps, journals and caches;
  - the non-heap memory: buffers, SQLite and native;
  - the growth over time, if any.
- Each holder gets a proposed fix and its estimated saving.

Context: hub 88459 (v0.3.0) held 3.0 GB RSS 80 s after start on this project (about 1,460 tracker items, 14,000 artifacts). Hubs run with an 8 GB heap cap since the restart-#22 OOM (T-912). Earlier fixes with the same pattern: T-912, T-1038, coverage-map OOM, T-1436. Rule 23 applies to any fix.

## Acceptance criteria

- [x] C1. The script runs a sealed hub on a scratch copy of the live .cland state, never the live hub, stops it at readiness, and records RSS, heap and external memory at a checkpoint after each startup stage (journal read, each history replay, tracker, artifact index, subscriptions, inbox) with record counts; a guard stop leaves a stop receipt.
  - done: impl-1467 · 2026-10-30T08:22:50.200Z
  - verified: rev-26 [reviewer] · run rev-20261030-1467-evidence-1 · 2026-10-30T08:42:19.075Z · commit d4d9f479ab5380438ebe724644be6e9857961fab
- [x] C2. A sampling heap profile of startup attributes allocations to call stacks, and an artifact names the top allocation sites by size per startup stage.
  - done: impl-1467 · 2026-10-30T07:53:00.270Z
  - verified: rev-26 [reviewer] · run rev-20261030-1467-evidence-1 · 2026-10-30T08:42:19.075Z · commit d4d9f479ab5380438ebe724644be6e9857961fab
- [x] C3. The artifact proposes a fix per dominant startup allocator with an estimated saving; retained-at-rest analysis and the RSS budget are deferred to the fix tickets.
  - done: impl-1467 · 2026-10-30T07:53:00.637Z
  - verified: rev-26 [reviewer] · run rev-20261030-1467-source-3 · 2026-10-30T08:26:37.908Z · commit d4d9f479ab5380438ebe724644be6e9857961fab
  - verified: rev-26 [reviewer] · run rev-20261030-1467-evidence-1 · 2026-10-30T08:42:19.075Z · commit d4d9f479ab5380438ebe724644be6e9857961fab

## Comments

### impl-1467 · 2026-10-30T06:44:31.628Z

Script-first implementation underway: sealed projectHub child, consistent read-only SQLite backup, full tracker/journal/log copy, sparse artifact-body placeholders, one-second process samples and sequential startup/rest heap snapshots. Independent supervisor watches swap every 30s. Dry plan about 1.86 GiB allocated payload plus metadata/snapshots; no secrets/config/accounts/worktree copy. Measurement blocked pending Coordinator slot and swap <=80% (dry preflight 84.67%).

### impl-1467 · 2026-10-30T07:49:52.125Z

First live-scale attempt 422b5b7a5 was partial: swap >92% guard at30s, child exit143, missing worker stop receipt, no snapshots/rest. Published A-14157 analysis and A-14158 seven numeric receipts; removed original scratch state after child close. Coordinator narrowed C1–C3 to startup allocations. c8defa34d implements startup-only 1MiB sampling with stage counts and IPC stop receipts; six focused controls, typecheck and report-mode lint pass. Awaiting second Coordinator slot.

### rev-26 · 2026-10-30T07:58:18.788Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1467-source-1
commit: 1b73911eade90c41d8ff00342a5f4539c9c9dd99
scope: full
findings: [{"severity":"medium","text":"M1: owning guide H1/index Test file/Notes row violate unchanged test-docs guard; reproduce red and migrate only new metadata, also correct stale 'no hub starts' T3 header.","file":"docs/agents/tests/hub-test-measure-memory.test.ts.md","line":1},{"severity":"medium","text":"M2: IPC ready/close promises lack immediate rejection ownership/shared setup disposer and native-drain beforeRemove barrier. Pre-own/cancel/join setup and non-expiring close fact; add omitted/aborted controls and bound graph Python child.","file":"hub/test/measure-memory.test.ts","line":63},{"severity":"medium","text":"M3: supervisor has unbounded IPC-to-close/interruption path; unowned write rejection can skip worker hub.stop/outcome, and held acquisition only receives a flag. Add shared pre-registered cancellable owner, bounded native join and durable incomplete/stop receipts on write/acquisition failures.","file":"hub/test/measure-memory.ts","line":214}]
finding_counts: {"high":0,"medium":3,"low":0}

A-14161 consolidated audit: Standards M1–M3, Spec C1 incomplete. Startup allocation analysis is useful and accurately limited; preserve measured c8defa34d A-14160 separately from original partial143 A-14157/A-14158. No new live-scale run requested. Small ownership/failed-write/held-acquisition controls, exact docs red/green, then fresh pushed-head review before configured verification. No Reviewer workload.

Criteria: C1 failed (Guard-stop/setup failure paths can lose durable stop outcome or leave an unjoined producer; successful measurement does not cover them.).

### impl-1467 · 2026-10-30T08:01:40.485Z

Source1 fixes underway (M1–M3). Shared fixture contract addition: pacingOwner(t, {setupTimeoutMs?}) preserves the prior 1000ms setup default; only memory probe opts into120000ms. Consumer search: discord-artifacts, discord-inbound-media, discord-messages, discord-workbench-fixture, epic-close, fixture-endpoints, remote-workbench, remotes-fixture, setup-remote-component, telegram-approvals, telegram-artifacts, telegram-cards, telegram-commands, telegram-inbound, telegram-marks-fixture, telegram-mute, telegram-notices, telegram-pacing, telegram-pairing, telegram-polling-restart, telegram-polling and telegram-voice-fixture (hub/test). All existing call sites retain one-argument/default behavior; no production/wire/persisted shape changed. Probe native setup now shares pacingOwner, non-expiring native close and bounded IPC/fallback joins, with root-removal drainage barrier. Five normal/omitted/aborted/held/write-failure lifecycle controls pass without live-scale rerun.

### rev-26 · 2026-10-30T08:19:22.026Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1467-source-2
commit: e35d5156296b004cf8ed6cd27ebc082db396d10e
scope: full
findings: [{"severity":"medium","text":"M3a: supervisor receipt is persisted by a closer concurrent with owned sample-write drainage; a later rejection leaves incomplete:false/empty failures durably. Finalize after native close and all owned write settlements, with held-write-after-close regression.","file":"hub/test/memory-producer.ts","line":36},{"severity":"medium","text":"M3b: finalSystem:system() can throw before outcome write in finally, losing the durable stop receipt after successful drainage. Record unavailable final reading explicitly and preserve incomplete/stop outcome; add isolated failure control.","file":"hub/test/measure-memory.ts","line":266}]
finding_counts: {"high":0,"medium":2,"low":0}

A-14183 consolidated source2: M1/M2 resolved; M3a/M3b final receipt failure paths remain. Preserve A-14160 completed c8defa34d measurement, A-14157/58 partial history and A-14167 SQL-only storage/consumer addendum. No new live-scale measurement requested. Isolated red/green controls then exact pushed-head source review before configured verification; no Reviewer execution.

Criteria: C1 failed (Final receipt can precede failed-write settlement or be skipped by a refused final system reading.).

### rev-26 · 2026-10-30T08:26:37.908Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1467-source-3
commit: d4d9f479ab5380438ebe724644be6e9857961fab
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14194 source3 clear: remaining M3a/M3b resolved; supervisor final receipt follows complete native/write/observer drainage, unavailable final sysctl preserves incomplete stopped outcome. C3 allocation/reader proposals and estimated savings established from A-14160/A-14167 with retention/RSS/at-rest limits. C1/C2 final runtime evidence pending. No new live-scale run requested; original completed c8defa34d and partial143 history remain separately attributed. Read-only Reviewer audit.

Criteria: C3 verified.

### rev-26 · 2026-10-30T08:42:19.075Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1467-evidence-1
commit: d4d9f479ab5380438ebe724644be6e9857961fab
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14210 final original-record audit clear: c4f557d5/A-14208 has4239 ordinary passes+75 separately scoped load passes elsewhere; all14 changedT3 memory controls pass once/no repetitions. C1-C3 verified across exact-head controls/source and explicitly historical c8defa34d startup sampling A-14160 plus SQL addendum A-14167. Original partial/red histories, report-only budgets/ratchet/missing baseline, host gate reuse, platform/browser and allocation-versus-retention/RSS limits preserved. No new live-scale run/Reviewer workload; remainingT3/T4 unrun. Coordinator owns enqueue/restart/integrated gates.

Criteria: C1 verified, C2 verified, C3 verified.
