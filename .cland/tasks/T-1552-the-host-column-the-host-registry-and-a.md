---
id: T-1552
kind: task
title: The `host` column, the host registry and a test host
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1544
topic: topic-1300
branch: t/T-1552-the-host-column-the-host-registry-and-a
created: 2026-10-31T23:47:42.826Z
updated: 2026-11-01T07:32:53.432Z
---

## Summary

`harness_processes` gains `host`, added in place with `local` for every existing row, and `HarnessProcess` carries it. The hub's host registry holds `local` and, for tests only, named test hosts: `CLAND_TEST_HOSTS` on a real hub and a `hosts` option in-process. The orphan sweep and doctor's orphan check, the table's other readers, ignore rows on another host.

Hot files: `hub/src/adapters/processes.ts`, `hub/src/adapters/contract.ts` (`HarnessProcess.host`), `hub/src/adapters/index.ts`, `hub/src/hub/daemon.ts`, `hub/src/orphans.ts`, `hub/src/host/test-host.ts` (new)

## Acceptance criteria

- [x] C1. A hub opened on a `hub.db` written before the column existed adds `host` in place, every existing row reads `local`, and new rows are written with their host (test).
  - done: impl-1552 · 2026-11-01T07:24:19.248Z
- [x] C2. `session list` and the session frames show no new field for a `local` row (test).
  - done: impl-1552 · 2026-11-01T07:24:19.486Z
- [x] C3. A hub started with `CLAND_TEST_HOSTS=t1` has a test host `t1` that logs each operation it receives to `hub.log`, mints `linux:` identities for what it spawns and refuses spawn with a reason naming it a test host; without the variable no test host exists (test).
  - done: impl-1552 · 2026-11-01T07:24:20.229Z
- [x] C4. The orphan sweep and doctor's orphan check neither protect nor sweep a local process because a row on another host carries its pid (test).
  - done: impl-1552 · 2026-11-01T07:31:31.329Z
- [x] C5. The orphan-servers, orphan-sweep-lock and session-async-processes test files pass with no test edited.
  - done: impl-1552 · 2026-11-01T07:24:22.251Z

## Comments

### impl-1552 · 2026-11-01T07:12:00.487Z

Consumer inventory before contract edit: ProcessTable serialization/get/all/bySessionId/running and pending-stop JSON; Sessions views/restore/lifecycle; AdapterHost lookups and Claude/Codex/OpenCode adapters; projectSessions and daemon assembly; orphanSessions shared by findOrphans/startup sweep and doctor/orphans; CLI session formatter, protocol HarnessProcessView, web/nvim sessions and persisted process fixtures across hub/test, web/test, nvim/test. Local wire projection is explicit and will remain unchanged. HarnessProcess.host stays optional for legacy adapter/pending-stop inputs, normalized to local on persisted reads. T-1554 owns adapter routing; T-1553 owns frame placement. Tests will cover migration, local wire compatibility, registry/logging/identity/refusal, and orphan host exclusion.

### impl-1552 · 2026-11-01T07:15:49.115Z

Consumer search recorded as A-15209 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15209-t-1552-host-contract-consumer-inventory.md). Search covers field/table/frame/accessor names beyond imports, across production, all test tiers, shipped skills, QA, clients and docs. Local wire consumers unchanged by explicit omission; pending receipts preserve absent-host compatibility.

### rev-36 · 2026-11-01T07:27:24.438Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1552-source-1
commit: ee6f7eef4c513cad657dd81319efffde076257a2
scope: full
findings: [{"severity":"medium","text":"New native orphan launches pass a sealed env into leftoverOpenCode, but orphan-server-fixture.ts:22 reintroduces process.env at final spawn. Removed provider credentials and GIT_* repository/config variables are restored; rule 15 requires shared-builder sealing after the final overlay.","file":"hub/test/host-orphans.test.ts","line":18}]
finding_counts: {"high":0,"medium":1,"low":0}

Medium — hub/test/host-orphans.test.ts:18 (second call also affected), through orphan-server-fixture.ts:22: final spawn uses `{ ...process.env, ...env }`, restoring credentials and GIT_* keys absent from the sealed argument. Fix final launch sealing through the shared builder, preserving owned fixture paths, and prove it with synthetic inherited credential/Git controls while retaining orphan assertions. Standards: one medium rule-15 finding; Spec: no separate behavior finding. C4 failed for test isolation, other criteria remain unverified/run-dependent. Read migration, registry/fences, explicit local wire projection, shared orphan snapshot, inventory/docs/tiers; required preservation tests unedited. Reviewer ran no tests/browser. Preliminary A-15221 macOS targeted evidence is not full verification.

Criteria: C4 failed (New orphan PID-collision test violates fixture isolation: its helper reintroduces inherited credentials/GIT_* after the caller's filter; final native launch must use the shared builder after overlays.).

### impl-1552 · 2026-11-01T07:29:18.060Z

Review fix consumer inventory: leftoverOpenCode is used by host-orphans (T3), orphan-servers (T3), orphan-servers-perf (T4). Sealing moves to its final spawn boundary. Shared ScratchAccountPaths adds optional validated OpenCode config path/explicit inline config; consumers: test-support/fixture-environment.ts, hub/test compatibility export, harness.ts, accounts.test.ts, fixture-environment.test.ts. Existing home/database inputs remain compatible; fixture tests add config-path containment and native synthetic final-environment controls. No production contract changes.

### rev-36 · 2026-11-01T07:32:53.432Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1552-source-2
commit: d5929211c594959bafe4cd3d89f1834d635fabcc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source review clear. Standards/spec: no findings. Prior C4 isolation finding resolved: final helper spawn uses shared fixtureEnvironment after overlays, then validated scratchAccountEnvironment inputs, with no inherited spread afterwards. Reviewed all changes since ee6f7eef: native seven-sentinel positive/red-first control, exact presence/path assertions, shared optional config-path/content extension, containment tests, docs and consumer audit; original orphan assertions retained. C1–C5 are all run-dependent and remain unverified pending same-head post-source verification. A-15227 reports local macOS arm64 Node 24.21.0 targeted host-orphans 2, fixture-environment 6 and unchanged orphan-servers 18 passes plus typecheck; lint rerun pending at request, no pass claimed. Reviewer ran no tests/browser. No full verification yet.
