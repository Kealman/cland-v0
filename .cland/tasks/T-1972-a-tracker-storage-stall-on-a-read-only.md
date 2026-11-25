---
id: T-1972
kind: task
title: A tracker storage stall on a read-only planned check still exits the hub with running suites (repeat class after T-253/T-483)
state: open
status: in progress
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-2076
blocked_by: []
topic: topic-1791
branch: t/T-1972-a-tracker-storage-stall-on-a-read-only
created: 2026-11-18T12:31:23.399Z
updated: 2026-11-25T13:44:00.632Z
---

## Summary

Three minutes after restart #84 (2026-11-18, hub pid 20702 at 85–109% CPU from start, `slow-request` lines at 12:26:35–43Z), the hub logged `tracker-storage-stalled` for a "planned check" on E-1883 (started 12:26:57.008Z, warning threshold 5000 ms), declared it fatal at 12:27:57.102Z after 60 s, and abandoned the queue behind it (two more planned checks on E-1883 and ready checks on T-953, T-1642 and others). It then exited with code 1 ("shutdown deadline expired; exiting with code 1 before cleanup completed"), with three remote suite runs in flight; launchd respawned it. The same exit message appears twice earlier in hub.log. T-253 made a serving-time stall fail fast and T-483 moved the exit off the 5 s warning, but a read-only check that stalls under CPU load still kills the hub and every session's connection.

## What to build

Make the fatal path depend on what stalled. A stalled read-only check (planned, ready or summary computation) is cancelled and reported, and its callers retry or degrade, while the hub keeps serving; only a stalled write that may leave storage inconsistent exits. Record the CPU and event-loop delay at the stall, so the cause is diagnosable.

## Acceptance criteria

- [x] C1. A fake tracker whose read-only planned check never settles produces a structured stall diagnostic and a refused or degraded reply to its caller, and the hub keeps serving other requests (test).
  - done: impl-1972 · 2026-11-25T13:44:00.231Z
- [x] C2. A stalled write still exits as today, after recording its pending writes (test).
  - done: impl-1972 · 2026-11-25T13:44:00.398Z
- [x] C3. The stall diagnostic includes the operation kind, item, wait time, queue depth and event-loop delay at the stall; every caller of the tracker queue's fatal path is listed (rule 41) (test).
  - done: impl-1972 · 2026-11-25T13:44:00.632Z

## Comments

### impl-1972 · 2026-11-25T13:37:37.812Z

Consumer inventory (rule 20/41): #serial has one fatal timer invocation, wired by Tracker constructor onStorageFatal to hub/src/hub/daemon.ts (sole production callback). All admissions searched by #serial, StorageOperation, onStorageFatal, STORAGE_FATAL_MS and tracker-storage-* across hub/nvim/web/shared/docs/qa/skills, including raw readers. Planned check, ready check and view now start as cancellable reads; #mutate promotes mixed checks before native mutation. All other admissions (watch read/poll, rescan, create/edit/comment, plan/approval, finish merge, imports, id reservation, status/claim/hold/session adoption and remaining generic writes) conservatively retain fatal semantics. Synchronous summary/list are unaffected. hub/src/hub/journal.ts admits structured diagnostic records. hub/src/cli/startup-diagnostic.ts and its tests consume warning/fatal log events, unaffected/additive fields; hub/test/startup-deadline-component.test.ts likewise. shared/wire/index.ts, wire-conformance.ts, daemon.test.ts preserve storage-status wire shape (no added required fields). tracker-async.test.ts retains native write-exit coverage; tracker-async-component.test.ts adds fake-clock cancellation/write controls. verifier-resolver.test.ts retains historical fatal notice compatibility. qa/briefs/T-229.md and T-273.md cover writes and remain valid; docs/spec/v0.1.md is historical. docs/hub/the-tracker.md updated for current mixed-phase policy. No CLI/help bytes change, no frozen help fixture migration required.

### impl-1972 · 2026-11-25T13:41:45.416Z

Exact admission inventory supplement: planned check, ready check, watch poll, status migration, rescan, watch read, plan set, plan approve, migration preview, item migration, QA migration, view, finish merge, create, comment, edit, criterion, close, link, rank, topic binding, import files, import, reserve id, generic writeItem(op), session adoption, release holds, hold and claim. Sole timer fatal call is #serial -> #onStorageFatal; sole daemon subscriber is serveProject's callback. Three named reads gain cancellation; remaining admissions keep prior conservative ownership. Red test failure and first green recorded locally on Node 24.21.0 macOS; no live project data or native process fixture used.
