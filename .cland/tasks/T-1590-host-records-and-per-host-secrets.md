---
id: T-1590
kind: task
title: Host records and per-host secrets
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: null
branch: null
created: 2026-11-02T03:33:53.028Z
updated: 2026-11-02T03:34:40.514Z
---

## Summary

`hub.db` gains a `hosts` table, created in place. Each row holds the host's id, transport (`ssh`), address, user, state and the digest of its per-host secret. Each host gets a 0700 directory under the hub's `.cland/` holding its client key path, its per-lease `known_hosts` and its secret at 0600. At start `CLAND_FAKE_HOSTS` with `CLAND_FAKE_HOST_ROOT` registers fake hosts. Per-host socket and control paths fall back to a short path as the hub socket does.

Hot files: `hub/src/host/records.ts` (new), `hub/test/host-records.test.ts` (new)

## Acceptance criteria

- [ ] C1. A hub opened on a `hub.db` without the table creates it, and existing tables and rows are untouched (test).
- [ ] C2. Registering a host mints a random per-host secret, stores only its digest in `hub.db`, writes the secret at 0600 in the host's 0700 directory, and never writes it to `hub.log`, the journal or a frame (test).
- [ ] C3. `CLAND_FAKE_HOSTS=f1,f2` with `CLAND_FAKE_HOST_ROOT` registers two `ssh` host records whose `known_hosts` pins each fake host's key, and with either variable absent no fake host exists (test).
- [ ] C4. For a project root deep enough that a per-host socket or control path would exceed the platform's socket path limit, the paths fall back to a short directory, as `layout().socket` does (test).
- [ ] C5. A secret matches only its own host's digest, and a revoked host's secret matches nothing (test).

## Notes

Shared files: the `hosts` table schema (E-1533 adds provider columns, E-1534 keeps leases in its own table)
