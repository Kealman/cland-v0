---
id: T-1657
kind: task
title: registerFakeHosts reads host keys at the fake-host root, but createFakeHost now writes them behind the short-socket alias
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: null
branch: null
created: 2026-11-03T05:54:51.539Z
updated: 2026-11-03T05:54:51.539Z
---

## Summary

T-1653 (macOS socket fixture fix) moved fake-host directories behind the short-socket alias. For `CLAND_FAKE_HOST_ROOT=R` and host `one`, `createFakeHost` now writes `<realpath(/tmp)>/ct-<32hex>/one/host-key.pub`, which resolves to `<realpath(R)>/.fixture-sockets/one/host-key.pub`. The hub's `registerFakeHosts` (hub/src/host/records.ts:119–120) still reads `R/one/host-key.pub` and points `clientKeyPath` at `R/one/client-key`, so a hub started on a fresh `createFakeHost` root throws ENOENT. Nothing hits this today, because host-records.test.ts writes keys by hand, but E-1532 stage 3 (the ssh Host and the remote spoke) will. Confirmed from source by impl-1653.

## What to build

One shared resolver for the fake-host directory, used by both `createFakeHost` and `registerFakeHosts`, so a hub started on a `createFakeHost` root registers every host with the right public key and client-key path. Socket paths stay within the macOS 104-byte limit.

## Acceptance criteria

- [ ] C1. A hub started with `CLAND_FAKE_HOST_ROOT` pointing at a fresh `createFakeHost` root registers each fake host with the key `createFakeHost` wrote and a client-key path that exists (test).
- [ ] C2. The same test passes with TMPDIR at a `/private/tmp/cland-suite-<36-char uuid>` root on macOS (test).
