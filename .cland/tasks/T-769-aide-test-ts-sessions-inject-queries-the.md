---
id: T-769
kind: task
title: 'aide.test.ts: Sessions.#inject queries the process table after the hub closed its store ("database is not open")'
state: open
status: review
size: S
criterion_seq: 1
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-473
branch: t/T-769-aide-test-ts-sessions-inject-queries-the
created: 2026-10-18T03:35:21.412Z
updated: 2026-10-18T03:44:50.485Z
---

## Summary

hub/test/aide.test.ts, "a fake Claude Aide keeps answering when a settings hook exits without reading stdin", failed with `Error: database is not open` (ERR_INVALID_STATE). The stack ran ProcessTable.bySessionId (hub/src/adapters/processes.ts:217) → Sessions.#inject (hub/src/adapters/sessions.ts:1478, called from :1510) on a microtask after the hub closed its store. There are two receipts:
- A-4041 (2026-10-16, listed under T-657);
- A-4929: the macOS stage run f45ac80d for E-677 stage 2, dev d392167a, 2026-10-18 03:35Z, peak load 14.3.
This is the T-573 signature: an injection continuation outliving hub close.

## What to build

Hub close cancels or awaits pending Sessions injections before closing the store, or #inject checks a closed flag and drops its continuation quietly. The fix is in production code, not the test.

## Acceptance criteria

- [x] C1. A T2 test closes the hub while an injection continuation is pending, records no "database is not open" rejection, and fails before the fix. aide.test.ts then passes 20/20 serially.
  - done: impl-769 · 2026-10-18T03:44:50.187Z

## Comments

### coord · 2026-10-18T03:36:22.324Z

Reproduces alone on dev d392167a. coord ran `node --test hub/test/aide.test.ts` 5× serially on the Mac at load 4.6–5.2 and got 4 pass and 1 fail: run 1 had 7 pass, 1 fail. It isn't load-only. It blocks the E-677 stage-2 macOS stage cover, so it's urgent.

### impl-769 · 2026-10-18T03:39:46.052Z

Merged origin/dev at 37c4921c. Added two T2 component regressions in fake-harness.test.ts using projectHub/FakeClock and in-process adapters: (1) held injection with pending bridge retry at adapter close reproduces the exact ProcessTable.bySessionId → #inject database-is-not-open stack; (2) accept/reject/uncertain outcomes arriving after hub stop reproduce a closed Store.markUncertain rejection. Both observed red on unchanged production source, then green with existing Sessions.#closed guarding entry and all promise continuations. A-4933 preserves the first red. Host typecheck, tiers and lint passed; serial 5x touched-file and 20x aide validation now running below load 15.
