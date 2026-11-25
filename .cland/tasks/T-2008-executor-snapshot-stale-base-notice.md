---
id: T-2008
kind: task
title: "Executor snapshot 'stale: base' notice fires on every dev landing, asking for a 22-minute prepare that a base-only change rarely needs"
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2075
blocked_by: []
regression_of: T-1728
topic: topic-1784
branch: t/T-2008-executor-snapshot-stale-base-notice
created: 2026-11-19T14:15:57.545Z
updated: 2026-11-25T13:08:36.221Z
---

## Summary

Since T-1728 landed, the hub posts "snapshot … stale: base; run cland executor prepare" to Agents whenever dev moves. It did so at 14:15:45Z on 2026-11-19, one minute after T-1729 landed and 59 minutes after a fresh snapshot (cland-v0-55b441bac95e, base 5e3a2005c) was prepared. A prepare takes about 22 minutes plus a builder droplet. A base-only change just makes delivery send a larger delta, so the notice asks for a costly action that's rarely worth taking. Lock, recipe and provision changes are the cases that matter.

## What to build

Raise the "run cland executor prepare" notice only for lock, recipe, provision or Node changes, or once the base is behind by a configured threshold (commits, delta bytes, or age). Show base-only staleness as a fact in `cland executor status` without prompting.

## Acceptance criteria

- [ ] C1. A dev move that changes only the base posts no prepare notice at any age, while `executor status` still reports the base as behind (test).
- [ ] C2. A lockfile or recipe change still posts the notice once (test).

## Comments

### coord · 2026-11-24T03:14:22.334Z

Another cost of this notice, from 2026-11-24. On a base-only "stale: base" notice (key base 4cafa6040 → ac5ce55fe; lock, recipe, provision and node unchanged), coord ran `cland executor prepare`. It failed after 1,433 s with "transfer: DigitalOcean 0 deadline: request deadline reached; image 256132409; regions ams3, fra1, nyc1, sfo2, blr1", with the builder lifetime and cost unconfirmed. Builder cland-v0-fd861f52 (c-4) showed "releasing; operator attention: deletion not confirmed, provider status off" for about a minute, then left `executor status` at 03:14:12Z. Image 256132409 may remain as a partly transferred snapshot. Two things to consider when fixing this: the transfer deadline for a five-region copy, and whether a failed prepare deletes its image.

### impl-2008 · 2026-11-25T13:08:36.221Z

Consumer inventory: staleParts remains unchanged for inspect/status and native executor-prepare tests; acquire advisory filters base. snapshotNotice consumers in Dispatcher/Suites and executorSnapshotNotice retain the id/receipt contract. executor-prepare-component pins retry, durable suppression, routing and previous snapshot wire shape; executor-prepare pins base freshness. Search included hub/test, nvim/test, docs, shipped skills and frozen CLI usage; no help bytes or wire fields change. Coordinator decision 971149e9: no threshold; base-only stays status-only at any age. Tests-first red: unwanted stale: base notice; four install-input cases also red on repeat after base move, then green after normalized notice identity.
