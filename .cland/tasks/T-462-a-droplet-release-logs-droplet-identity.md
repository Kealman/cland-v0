---
id: T-462
kind: task
title: A droplet release logs 'droplet identity differs from its lease; refusing deletion' and recovers a minute later
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-15T08:24:29.318Z
updated: 2026-10-15T08:42:54.789Z
---

## Summary

At 07:57Z on 2026-10-15, lease 2ab57276 (droplet 609282755) logged `executor-release-unconfirmed: droplet identity differs from its lease; refusing deletion`, then released a minute later. DigitalOcean showed no leftover (stand-in's hourly check). The safety check tripped and recovered. Find out what made the identity differ: provider eventual consistency, a name or tag mismatch, or a stale lease read. If it is a benign race, release on the next consistent read without a warning.

## Acceptance criteria

- [ ] C1. The cause is named from the lease and the provider records, and a benign provider race no longer logs a refusal, while a real identity mismatch still refuses deletion.

## Comments

### coord · 2026-10-15T08:42:54.789Z

Possibly related: T-464, a reconcile race that re-arms a stale active lease released by another executor instance.
