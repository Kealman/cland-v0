---
id: T-2019
kind: task
title: Fake DigitalOcean host transport so setup's new-pool and first-login journey runs on fakes
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
created: 2026-11-20T00:24:04.907Z
updated: 2026-11-20T00:24:04.907Z
---

## Summary

T-1868's setup QA journey (HOSTS-003) runs on a prepared fake-provider pool because setup's new-pool branch creates a DigitalOcean pool, and the fake DigitalOcean transport cannot complete the first-login host path. The fake transport (`hub/test/fakes/digitalocean/fake-machine.ts`) implements the executor runner's fixed-vector exec and scp. It doesn't implement the host provider's pinned SSH master and agent, or the login-disk lifecycle; the native host fixture uses a separate directory-backed fake SSH protocol.

## What to build

A fake DigitalOcean host transport that composes the fake API with the host provider's SSH master, agent and login-disk lifecycle, so that setup's new-pool and first-login journey runs end to end on fakes. No test-only branch in production code. Then switch HOSTS-003 to the new-pool route and remove its limitation note.

## Acceptance criteria

- [ ] C1. A scripted `cland setup` run creates a new DigitalOcean pool against the fake API and completes the first login on it, with no real API, token or spend (test).
- [ ] C2. HOSTS-003 runs the new-pool route and records its evidence through `qa-record.sh` (test).
