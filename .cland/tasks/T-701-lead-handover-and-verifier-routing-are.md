---
id: T-701
kind: task
title: Lead, handover and verifier routing are asserted on the hub's recorded messages in T2, with one process proof per family
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-686
  - T-687
topic: null
branch: t/T-701-lead-handover-and-verifier-routing-are
created: 2026-10-16T19:59:36.941Z
updated: 2026-10-17T06:27:34.626Z
---

## Summary

Routing to a Lead or a verifier is a hub rule, but these files launch two to five fake Claude Leads and read `fake.log` to prove where a message went (memo §2.2 wins 9–10; report-slice2 #2 and anti-pattern B, report-slice4 #4, report-slice1 #4):

| File | Seconds | Note |
|---|---:|---|
| `lead-permissions.test.ts` | 57.5 | |
| `lead-handover.test.ts` | 51.9 | |
| `lead-routing.test.ts` | 26.4 | |
| `verifier-routing.test.ts` | 40.5 | "three live Reviewers receive one request" alone is 12.9 s |
| `lead-launch.test.ts` | 27.9 | |
| `handover.test.ts` | 18.4 | |
| `item-lead.test.ts` | 22.1 | |

## What to build

- **Routing on the record.** Delivery is asserted on the hub's recorded message (`to`, `stage`, `topic.history`), not on the harness's log. Lead sessions are T-686 fake-adapter sessions, and observers are T-687 in-process spokes or `dispatcherUi`.
- **Subtree authority.** The recheck after each await (launch, stop, `task.link` reparenting during merge preparation and landing) runs as a component fixture in the shape of `roles-session-refresh.test.ts`, with a gated roles read and fake git.
- **Verifier routing.** Pool affinity, fallback and verdict-header parsing become a T1 resolver test over presence and holds.
- **One process proof per family stays T3**, with a header:
  - `long idle and death climb …` (SIGKILL of a real pid);
  - `Lead launches and stops only sessions serving its live subtree`;
  - `Codex relaunch injects an early accepted clause`;
  - the mid-turn revocation in `handover.test.ts`.
- **Restarts.** Hub restarts that only reopen state use `projectHub` stop and serve.

## Acceptance criteria

- [ ] C1. The seven files' manifest seconds fall from 244.7 s (A-3877) to 115 s or less.
- [ ] C2. Their fake-binary call sites fall from 18 to 5 or less, `spawnSpoke` sites from 57 to 10 or less, and `startDaemon` sites from 23 to 4 or less.
- [ ] C3. Routing assertions read the hub's recorded messages, and no test outside the kept T3 proofs reads a fake harness log, proved by a source check.
- [ ] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
- [ ] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.

## Blocked by

T-686 (in-process fake adapter), T-687 (in-process spoke).
