---
id: T-573
kind: task
title: "crew-launch singleton/per-item caps test: Sessions.#inject reads the process table after the database is closed (ERR_INVALID_STATE)"
state: closed
status: done
size: S
labels:
  - bug
  - hub
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-16T05:11:35.666Z
updated: 2026-10-20T06:07:29.779Z
closed: 2026-10-20T06:07:29.779Z
---

## Summary
Seen on 2026-10-16 at 05:11Z in T-523's merged-head Mac proof at df98b29b (A-3731): hub/test/crew-launch.test.ts:210, the singleton/per-item caps/live clause reload case, went 9 pass / 1 fail. The error was `ERR_INVALID_STATE database is not open` from ProcessTable.bySessionId (hub/src/adapters/processes.ts:214), called from Sessions.#inject (sessions.ts:1469/1501) after the async injection's teardown. An injection still in flight when the hub stops reads the closed store. T-523 doesn't touch these paths. T-313, the older shutdown ticket, has a different stack.

## Acceptance criteria
- [ ] C1. Hub shutdown waits for or cancels in-flight session injections before closing the store, or #inject treats a closed store as a stopped hub and returns quietly, with the cause recorded on this item.
- [ ] C2. A test stops the hub while an injection is pending and sees no ERR_INVALID_STATE; crew-launch.test.ts passes 10/10 serially as a whole file on the Mac.

## Comments

### coord · 2026-10-20T06:07:29.779Z

Closed in the D76 triage (2026-10-20, read-only check at dev 9b2cb194, artifact to follow in General): duplicate of T-769 (crew-launch caps reading the process table).
