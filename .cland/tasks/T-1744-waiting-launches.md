---
id: T-1744
kind: task
title: Waiting launches
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1743
  - T-1741
topic: null
branch: null
created: 2026-11-07T16:01:57.997Z
updated: 2026-11-08T00:38:55.869Z
---

## Summary

A launch that no host of its pool can take, with no room for a new host, waits in the hub instead of being refused. The reply returns at once, `{ waiting: { reason, since, pool } }`, with no process, and `cland session launch` prints "waiting: <reason>". The hub holds the launch with its current reason; "waiting for a host" here, and T-1746 adds "waiting for host <id> to boot". The launch shows in four places:
- `cland session list`;
- the inbox frame, as a status line outside needs-you and never an ask;
- Agents, with one notice when the wait starts, one per reason change and one when it ends;
- the session name's reservation.

The wait ends by placement, when a session on the pool's host exits, a host becomes ready or memory frees, or by `cland session stop <name>`. A launch refused by the memory floor waits as if the host were full. In this ticket the waits live in memory; T-1745 makes them durable.

## What to build

The waiting-launch record and its reason tracking, never repeated per poll. Placement is retried on capacity events. The waiting reply covers `session.launch`, the CLI and the Coordinator's tool. Cancellation goes through `session.stop` and the `session.stop` tool, with no new verb. A new Agents lifecycle kind records the wait.

## Acceptance criteria

- [ ] C1. With the pool's only host full and `max_hosts` reached, `session.launch` answers at once with a waiting reply of "waiting for a host", and `cland session list` shows the launch with that reason and no process (test).
- [ ] C2. The inbox frame carries the waiting launch as a status line with name, role, pool, reason and since, it does not count toward needs-you, and no ask is opened (test).
- [ ] C3. Agents gets one notice when the wait starts and one when its reason changes, and none for repeated scheduler passes with the same reason (test).
- [ ] C4. When a session on the full host exits, the waiting launch is placed there, its line ends, and Agents records the session start (test).
- [ ] C5. `cland session stop <name>` cancels a waiting launch and ends its line, and a second launch of a waiting name is refused naming the wait (test).
- [ ] C6. A launch the host agent refuses for the memory floor waits as "waiting for a host" with no session row and no failure notice, and is placed when the host's next memory report is above the floor (test).

## Blocked by

- T-1743
- T-1741

## Notes

- Hot files: `hub/src/adapters/sessions.ts`, `hub/src/host/pool-runtime.ts`, `hub/src/hub/inbox.ts`, `hub/src/hub/agents-topic.ts` (new lifecycle kind), `hub/src/protocol.ts` (inbox type, waiting reply), `hub/src/hub/dispatch.ts`, `hub/src/cli/session.ts`.
- Tests: new `hub/test/waiting-launch.test.ts` (T2); `hub/test/inbox*.test.ts` (T2, edit).
- Serves epic C2 and C3.
