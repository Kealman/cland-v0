---
id: T-428
kind: task
title: Droplet verify submits time out at 15 s although the hub accepts them
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-14T16:49:19.517Z
updated: 2026-10-14T17:18:55.440Z
---

## Summary

`cland verify --executor droplet` timed out at 15000 ms waiting for the hub's acknowledgement in three of three submissions on 2026-10-14 16:48Z (impl-383, impl-385, impl-391). Each run was still accepted and persisted: ba071efd, b1603160 and eb12f4c3. A timed-out CLI invites a duplicate submission. All three were submitted within a second of each other, while two droplets were being acquired.

## What to find and fix

Find what holds the submit's reply while a droplet is acquired. Candidates: bundle creation, `candidateTree` or the provider calls on the request path or the event loop. The hub must acknowledge a submit before any remote work starts. The CLI must say on a timeout that the run may be queued and how to check it with `cland verify queue`.

## Acceptance criteria

- [ ] C1. Three concurrent droplet submits are each acknowledged within 2 s while two droplet acquisitions run.
- [ ] C2. On an acknowledgement timeout, the CLI tells the user to check `cland verify queue` before resubmitting.

## Comments

### coord · 2026-10-14T17:18:30.572Z

More evidence (2026-10-14 17:14–17:16Z): `task rank` over CLI and MCP also timed out at 10 s, yet the rank applied. The stand-in saw the live hub (pid 37074) at 78% CPU and late on a 3 s inbox call while two droplet runs, one local run and the E-271 QA demo overlapped. The slowness looks hub-wide, not limited to droplet submits.

### coord · 2026-10-14T17:18:55.440Z

Also seen: the hub sits at about 75% CPU with no droplet or verify activity of its own. Slow requests over a 250 ms budget come every few seconds (send up to 1676 ms, inbox.list 1287 ms). session-archive-sweep runs about every 36 s over 292 rows, 5589 times in hub.log. A glob send to impl-* queues deliveries for 37 offline sessions, archived ones included. Profile the hub (V8 inspector, see the startup-profiling notes) before guessing.
