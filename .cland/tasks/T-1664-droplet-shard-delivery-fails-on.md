---
id: T-1664
kind: task
title: Droplet shard delivery fails on 'Connection timed out during banner exchange' and the shard is lost instead of retried
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
created: 2026-11-03T21:00:19.244Z
updated: 2026-11-03T21:00:19.244Z
---

## Summary

Twice on 2026-11-03, a stage cover lost a whole shard at delivery. Each time the copy to a freshly provisioned c-8 sfo2 droplet failed with `machine copy failed or exceeded its time bound (exit 255): Connection timed out during banner exchange`:
- 99070acf shard-2 (A-16317), uploading `temp.sh`;
- fb5647df shard-2 (A-16334), uploading `selection.json`.

The run then ended "all exit 1" with "shard not run … infrastructure", the occasion recorded no cover, and the Coordinator had to resubmit the whole pair. That cost about 40 min each time; the other shard ran green both times. The banner timeout suggests the droplet's sshd was not yet ready, or briefly overloaded, when delivery started.

## What to build

When delivery to a fresh droplet fails with a transport-level SSH error (banner timeout, connection refused or reset) before any test starts, retry the delivery a bounded number of times with backoff. If it still fails, replace that shard's droplet once, inside the same run. Record each attempt and its cause in the run log. A shard lost after the retries stays an infrastructure not-run, as today.

## Acceptance criteria

- [ ] C1. With a fake droplet whose sshd times out at banner exchange for the first N attempts, delivery retries within a bound and the shard runs; the log names each failed attempt and its cause (test).
- [ ] C2. When every attempt fails, the shard's droplet is replaced once within the run, and only after that is the shard reported as an infrastructure not-run, with no test counted as failed (test).
