---
id: T-669
kind: task
title: A project without a Neovim pin or package-lock.json gets a prepared droplet snapshot
state: open
status: planned
size: S
labels:
  - v0.1.4
  - verification
assignee: null
parent: E-614
blocked_by: []
topic: null
branch: null
created: 2026-10-16T16:35:25.691Z
updated: 2026-10-16T16:36:05.515Z
---

## Summary

Prefactoring for the droplet's `prepare` (ticket T-670). The snapshot's prepare key no longer requires cland's own pins. Today `prepareKey` throws `invalid Node or Neovim prepare pin` without `nvim/NVIM_VERSION` and `nvim/NVIM_SHA256SUMS`, and fails without `package-lock.json` at the base. After this ticket, a project in another stack can run `cland executor prepare`, and the builder installs Neovim only when the project pins it. For a key shaped like this repository's, the hash is unchanged, so its current snapshot stays current.

## What to build

- **The key** (`hub/src/executor/droplet/prepare.ts`). `PrepareKey.nvim` and `PrepareKey.lock` become optional. `nvim` is present when the base pins Neovim in `nvim/NVIM_VERSION` and `nvim/NVIM_SHA256SUMS`, and it is validated as today when present. `lock` is present when `package-lock.json` exists at the base. `node` and `base` stay required: the runner's platform line and the hub's status probe run `node` on the machine. `keyHash` and `sameKey` handle absent parts. A key with all four parts serializes exactly as today, so its `keyHash` is unchanged. `staleParts` compares absent parts as `none`. `readSnapshot` accepts a record without `nvim`.
- **The builder** (`provision.sh`). The Neovim download, checksum check and link run only when the key pins Neovim, for example behind an empty `__NVIM_VERSION__` guard. Node and the apt packages stay.
- **Delivery** (`run.ts`). The delivery's `package-lock.json` and Neovim checks run only for the parts the snapshot's key holds. A project without them prints neither line. Ticket T-670 replaces this block with `prepare`, so keep the change minimal.
- **Status.** `cland executor status` prints an absent part as `none` in the key and never reports it as stale.

**Keeping cland's own suite intact.** This repository pins Neovim and commits `package-lock.json`, so its key has the same four parts and the same hash, and its snapshot stays current with no re-prepare (C3). Its builder still installs Neovim, and its delivery prints the same lock and pin lines.

## Acceptance criteria

- [ ] C1. `cland executor prepare` in a temporary project with neither `nvim/` nor `package-lock.json` builds a snapshot through the fake DigitalOcean API and machine, with a key without `nvim` and `lock` (`executor-prepare.test.ts`).
- [ ] C2. That builder's user data installs Node and has no Neovim download, while a project pinning Neovim still gets it (assertions on the fake API's recorded `user_data`).
- [ ] C3. `keyHash` of a four-part key equals a recorded golden value, so this repository's existing snapshot reads `current` (unit test).
- [ ] C4. A run delivered to the pin-less snapshot prints no lock or Neovim line and verifies on the fake machine, and `cland executor status` shows `none` for the absent parts without `stale`.
