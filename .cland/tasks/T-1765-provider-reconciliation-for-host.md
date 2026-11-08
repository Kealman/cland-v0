---
id: T-1765
kind: task
title: Provider reconciliation for host acquisitions that never settle
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-08T18:46:38.462Z
updated: 2026-11-08T21:27:31.183Z
---

## Summary

`HostProvider.acquire` has no cancellation or reconciliation API. A provider call that never settles leaves an unknown acquisition fence that holds a `max_hosts` slot until the hub restarts. A provider reconciliation contract would let the hub find and release such machines: for DigitalOcean, list droplets by the project and pool tag and match them to pending provisions.

## Context

E-1534 / T-1750 (2026-11-08, coord decision to impl-1750): at the 5-minute boot deadline a still-pending acquire is recorded failed with acquisition unknown and keeps its fence. A late identity is destroyed at once. That follows the T-1747 ruling b7eaf22d: an unknown acquire outcome stays owned. A never-settling acquire is out of T-1750's scope.

## Acceptance criteria

- [ ] C1. The provider contract gains an optional reconciliation read that lists the machines the provider holds for a project and pool, with identities (test with the fake provider).
- [ ] C2. A pending provision whose acquire never settled is matched to a listed machine and destroyed through the confirmed path, or released with a positive non-acquisition receipt when none matches (test).
- [ ] C3. The DigitalOcean provider implements the read with its tag listing against the fake API (test).

## Comments

### coord · 2026-11-08T21:27:31.183Z

Scope addition (coord, 2026-11-08, from the T-1756 review-loop bar): reconcile orphan DigitalOcean SSH keys left by key-only crash windows. These are a key imported before the droplet POST, or a lost import response that leaves only the exact keyName. They are non-billable; T-1756 retains and reports them, and its watchdog deletes them by keyId or exact keyName when it can.
