---
id: T-1707
kind: task
title: The host provider interface and the fake host provider's machines
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by: []
topic: topic-1401
branch: t/T-1707-the-host-provider-interface-and-the-fake
created: 2026-11-06T10:47:48.096Z
updated: 2026-11-06T10:50:16.443Z
---

## Summary

A `HostProvider` interface beside the Executor: acquire, prepare, status, release and reap, mirroring `executor.ts`, plus the transport kind a host is reached by. A provider registry resolves a pool's `provider` name. A fake host provider creates fake-transport hosts (directories with their own home, run directory, boot id and pinned key), with a configurable boot time and injected failures. A reusable contract suite runs against any provider.

Hot files: `hub/src/host/provider/provider.ts` (new), `hub/src/host/provider/registry.ts` (new), `hub/src/host/provider/fake.ts` (new), `hub/test/host-provider-contract.ts` (new), `hub/test/host-provider-fake.test.ts` (new)

## What to build

The interface and its result types: a machine handle with id, address, architecture and created time; acquire outcomes `created`, `refused` with a retry time, and `failed`; `released` only after a confirming read. The fake provider is selectable only when the test environment names a fake-host root, as `registerFakeHosts` is, so a project config cannot pick it in production. The contract suite takes a provider factory and checks every operation's outcome shape, so the DigitalOcean tickets run it against DigitalOcean.

Notes: the provider registry is shared; the DigitalOcean machines ticket adds `digitalocean`, and the pool-images ticket reads pools through it.

## Acceptance criteria

- [ ] C1. The interface has acquire, prepare, status, release and reap, mirroring the Executor's operations, and names its transport kind, which is `ssh` only (test of the contract suite on the fake provider).
- [ ] C2. On the fake provider, acquire, status, release and reap pass the contract suite, and release reports `released` only after a read finds the machine gone (test).
- [ ] C3. A configured boot delay, a refused acquire with a retry time and a machine that never boots are each reported as their typed outcome, never as a thrown string (test).
- [ ] C4. `provider = "fake"` is refused outside the test environment with a message naming the reason, and the fake provider opens no network socket (test).
