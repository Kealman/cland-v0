---
id: T-1971
kind: task
title: Git-maintenance ownership probes time out after 200 ms under hub load and keep territory ownership for a collector that is already gone
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2076
blocked_by: []
topic: topic-1727
branch: t/T-1971-git-maintenance-ownership-probes-time
created: 2026-11-18T12:31:16.257Z
updated: 2026-11-24T09:03:06.632Z
---

## Summary

Found by the hub operator session after restart #84 (2026-11-18). On hub pid 20702, at about 100% CPU, `git-maintenance-failed` at 12:25:19Z reported "process inspection unavailable" for collector pid 27316, and the hub kept territory ownership ("Git collector pid 27316 retains territory ownership; recovery could not confirm its group is gone"). The `ps` and `pgrep` probes in git-maintenance-owner.ts (around lines 58–60 and 88–90) run with a 200 ms timeout. Under load the probe timed out, while afterwards both took 10 ms and `pgrep -g 27316` returned nothing. A timed-out inspection is unknown, not alive, but the result kept territory mutations blocked until the next hub start cleared it.

## What to build

Ownership inspection gets a load-tolerant bound and retries with backoff before it settles. Its outcome comes from the structured probe receipt (rule 39): a timed-out probe stays "unknown" and is retried, rather than settling as a held group. A later successful probe that shows no group releases ownership without a hub restart.

## Acceptance criteria

- [ ] C1. With a fake probe that times out twice and then reports no group, recovery releases territory ownership on the retry without a restart, and the intermediate state reads as unknown, never as alive (test).
- [ ] C2. A probe that keeps timing out reports a structured "inspection unavailable" diagnostic with its attempt count, and every caller of the ownership probes is listed (rule 41) (test).
