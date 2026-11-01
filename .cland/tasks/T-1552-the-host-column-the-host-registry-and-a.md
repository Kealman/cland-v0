---
id: T-1552
kind: task
title: The `host` column, the host registry and a test host
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1544
topic: topic-1300
branch: t/T-1552-the-host-column-the-host-registry-and-a
created: 2026-10-31T23:47:42.826Z
updated: 2026-11-01T07:15:49.115Z
---

## Summary

`harness_processes` gains `host`, added in place with `local` for every existing row, and `HarnessProcess` carries it. The hub's host registry holds `local` and, for tests only, named test hosts: `CLAND_TEST_HOSTS` on a real hub and a `hosts` option in-process. The orphan sweep and doctor's orphan check, the table's other readers, ignore rows on another host.

Hot files: `hub/src/adapters/processes.ts`, `hub/src/adapters/contract.ts` (`HarnessProcess.host`), `hub/src/adapters/index.ts`, `hub/src/hub/daemon.ts`, `hub/src/orphans.ts`, `hub/src/host/test-host.ts` (new)

## Acceptance criteria

- [ ] C1. A hub opened on a `hub.db` written before the column existed adds `host` in place, every existing row reads `local`, and new rows are written with their host (test).
- [ ] C2. `session list` and the session frames show no new field for a `local` row (test).
- [ ] C3. A hub started with `CLAND_TEST_HOSTS=t1` has a test host `t1` that logs each operation it receives to `hub.log`, mints `linux:` identities for what it spawns and refuses spawn with a reason naming it a test host; without the variable no test host exists (test).
- [ ] C4. The orphan sweep and doctor's orphan check neither protect nor sweep a local process because a row on another host carries its pid (test).
- [ ] C5. The orphan-servers, orphan-sweep-lock and session-async-processes test files pass with no test edited.

## Comments

### impl-1552 · 2026-11-01T07:12:00.487Z

Consumer inventory before contract edit: ProcessTable serialization/get/all/bySessionId/running and pending-stop JSON; Sessions views/restore/lifecycle; AdapterHost lookups and Claude/Codex/OpenCode adapters; projectSessions and daemon assembly; orphanSessions shared by findOrphans/startup sweep and doctor/orphans; CLI session formatter, protocol HarnessProcessView, web/nvim sessions and persisted process fixtures across hub/test, web/test, nvim/test. Local wire projection is explicit and will remain unchanged. HarnessProcess.host stays optional for legacy adapter/pending-stop inputs, normalized to local on persisted reads. T-1554 owns adapter routing; T-1553 owns frame placement. Tests will cover migration, local wire compatibility, registry/logging/identity/refusal, and orphan host exclusion.

### impl-1552 · 2026-11-01T07:15:49.115Z

Consumer search recorded as A-15209 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15209-t-1552-host-contract-consumer-inventory.md). Search covers field/table/frame/accessor names beyond imports, across production, all test tiers, shipped skills, QA, clients and docs. Local wire consumers unchanged by explicit omission; pending receipts preserve absent-host compatibility.
