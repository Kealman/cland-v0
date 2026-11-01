---
id: T-1552
kind: task
title: The `host` column, the host registry and a test host
state: closed
status: done
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
updated: 2026-11-01T19:05:02.455Z
closed: 2026-11-01T19:05:02.455Z
---

## Summary

`harness_processes` gains `host`, added in place with `local` for every existing row, and `HarnessProcess` carries it. The hub's host registry holds `local` and, for tests only, named test hosts: `CLAND_TEST_HOSTS` on a real hub and a `hosts` option in-process. The orphan sweep and doctor's orphan check, the table's other readers, ignore rows on another host.

Hot files: `hub/src/adapters/processes.ts`, `hub/src/adapters/contract.ts` (`HarnessProcess.host`), `hub/src/adapters/index.ts`, `hub/src/hub/daemon.ts`, `hub/src/orphans.ts`, `hub/src/host/test-host.ts` (new)

## Acceptance criteria

- [x] C1. A hub opened on a `hub.db` written before the column existed adds `host` in place, every existing row reads `local`, and new rows are written with their host (test).
  - verified: rev-36 [reviewer] · run rev-36-1552-final-1 · 2026-11-01T07:51:32.298Z · commit d5929211c594959bafe4cd3d89f1834d635fabcc
  - done: impl-1552 · 2026-11-01T17:07:42.234Z
  - verified: rev-36 [reviewer] · run rev-36-1552-final-2 · 2026-11-01T17:25:30.148Z · commit a000ebca80374d5c2477cd6437652e46733a9fa6
- [x] C2. `session list` and the session frames show no new field for a `local` row (test).
  - verified: rev-36 [reviewer] · run rev-36-1552-final-1 · 2026-11-01T07:51:32.299Z · commit d5929211c594959bafe4cd3d89f1834d635fabcc
  - done: impl-1552 · 2026-11-01T17:07:42.354Z
  - verified: rev-36 [reviewer] · run rev-36-1552-final-2 · 2026-11-01T17:25:30.148Z · commit a000ebca80374d5c2477cd6437652e46733a9fa6
- [x] C3. A hub started with `CLAND_TEST_HOSTS=t1` has a test host `t1` that logs each operation it receives to `hub.log`, mints `linux:` identities for what it spawns and refuses spawn with a reason naming it a test host; without the variable no test host exists (test).
  - verified: rev-36 [reviewer] · run rev-36-1552-final-1 · 2026-11-01T07:51:32.299Z · commit d5929211c594959bafe4cd3d89f1834d635fabcc
  - done: impl-1552 · 2026-11-01T17:07:42.671Z
  - verified: rev-36 [reviewer] · run rev-36-1552-final-2 · 2026-11-01T17:25:30.148Z · commit a000ebca80374d5c2477cd6437652e46733a9fa6
- [x] C4. The orphan sweep and doctor's orphan check neither protect nor sweep a local process because a row on another host carries its pid (test).
  - verified: rev-36 [reviewer] · run rev-36-1552-final-1 · 2026-11-01T07:51:32.299Z · commit d5929211c594959bafe4cd3d89f1834d635fabcc
  - done: impl-1552 · 2026-11-01T17:07:42.798Z
  - verified: rev-36 [reviewer] · run rev-36-1552-final-2 · 2026-11-01T17:25:30.148Z · commit a000ebca80374d5c2477cd6437652e46733a9fa6
- [x] C5. The orphan-servers, orphan-sweep-lock and session-async-processes test files pass with no test edited.
  - verified: rev-36 [reviewer] · run rev-36-1552-final-1 · 2026-11-01T07:51:32.299Z · commit d5929211c594959bafe4cd3d89f1834d635fabcc
  - done: impl-1552 · 2026-11-01T17:07:42.911Z
  - verified: rev-36 [reviewer] · run rev-36-1552-final-2 · 2026-11-01T17:25:30.148Z · commit a000ebca80374d5c2477cd6437652e46733a9fa6

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

### rev-36 · 2026-11-01T07:51:32.299Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1552-final-1
commit: d5929211c594959bafe4cd3d89f1834d635fabcc
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final task evidence clear at unchanged d5929211c594959bafe4cd3d89f1834d635fabcc; Standards/spec no findings, C1–C5 verified. Independently read A-15242 pass facts: host-registry 4, host-orphans 2 (including native sealing control), fixture-environment 6, session-async-processes 3. Uncached Linux x64 droplet Node24.21.0, T0/T1/fallback T2/changed T3/mapped T4 base/Web exit0, 4562 passed; isolated chromium_headless_shell-1248 Chrome for Testing156.0.8078.4. Remaining T3/T4 deferred, no repetitions/all-tier occasion claimed; advisory budgets/ratchet/lint/skip check report-only. A-15244 supplies same-head Darwin arm64 Node24.21.0 native exit0 and complete named unedited orphan-servers18/orphan-sweep-lock4 passes; all C5 files confirmed unedited. Reviewer ran no tests/browser. Coordinator's separate full pre-merge suite remains its next gate, not claimed complete here.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-1552 · 2026-11-01T17:06:12.894Z

Coordinator-authorized dev merge completed at a000ebca80374d5c2477cd6437652e46733a9fa6 (parents d5929211c and origin/dev 912b7172da7d741faf5752b3f0e9ec8330848b9b). Resolved index/daemon as one hosts path: projectHub options → serveProject hosts → projectSessions composition of injected hosts plus CLAND_TEST_HOSTS → Sessions. README unique prose retained verbatim; tiers retains sorted entries from both sides. Dev adds Host.fileType; test host now logs/refuses it and exhaustive refusal regression includes it. Typecheck/test:lint exit0, host-registry4/4, host-orphans2/2, project-hub1/1, claude-code-host9/9 at current head, macOS arm64 Node24.21.0, sequential admission load <10. Renewing unchanged C5 native receipts before final evidence review. No separate full suite; T1–T3 merge batch is pre-merge gate.

### rev-36 · 2026-11-01T17:07:06.038Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1552-source-3
commit: a000ebca80374d5c2477cd6437652e46733a9fa6
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh merged-source delta clear. Standards/spec no findings. Inspected Coordinator-authorized merge: one hosts path projectHub→serveProject→projectSessions composed registry→Sessions; object references retained, default local preserved. Required fileType on testHost logs/refuses and exhaustive operation assertion includes it. Prior migration/wire/orphan-filter/isolation fixes unchanged; incoming hostForSession uses registry/unknown-host refusal. README preserves both guidance sections; tiers retains both inventories. Preliminary request reports macOS arm64 Node24.21.0 registry4/orphans2/project-hub1/Claude-host9 and typecheck/lint exit0; C5 renewal incomplete at request, no pass assumed. C1–C5 remain pending same-head post-source verification. Reviewer ran no tests/browser.

### rev-36 · 2026-11-01T17:25:30.148Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1552-final-2
commit: a000ebca80374d5c2477cd6437652e46733a9fa6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head task evidence clear; Standards/spec no findings, C1–C5 verified. A-15330 current-head uncached Linux x64 droplet Node24.21.0 T0/T1/fallback T2/selected T3/mapped T4 base/Web exit0,4601 pass. Actual named registry4/orphan2/sealing6/session-async3/project-hub1/Claude-host9 pass records checked; browser isolated chromium_headless_shell-1248 Chrome for Testing156.0.8078.4. Remaining T3 in batch, other T4/repetitions unexecuted; advisory checks report mode. A-15325 exact-head macOS arm64 Node24 native exit0 and complete named C5 orphan-servers18/orphan-sweep-lock4/session-async3 passes; files confirmed unedited. Reviewer ran no tests/browser. Task coverage only, not full-tier occasion; T1–T3 merge batch remains the separate pre-merge gate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-01T19:05:02.455Z

Merged cca4b422b055aba187fcb333864e18141ed2a7b0 onto dev.
