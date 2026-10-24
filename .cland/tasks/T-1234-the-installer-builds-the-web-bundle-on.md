---
id: T-1234
kind: task
title: The installer builds the web bundle on the user's machine instead of using a prebuilt release asset
state: open
status: backlog
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-778
blocked_by: []
topic: null
branch: null
created: 2026-10-24T11:05:26.095Z
updated: 2026-10-24T18:43:26.267Z
---

## Summary

T-780's installer (cland.app/install.sh) builds the web bundle on the user's machine from the tagged source tarball: `npm ci --ignore-scripts`, build, prune. A release asset with the prebuilt bundle would make installs faster and keep a build toolchain off users' machines. It changes what `cland release` publishes, so the human decides.

## Acceptance criteria

- [x] C1. The human's choice (prebuilt release asset or keep building from source) is recorded on this item.
  - done: coord · 2026-10-24T18:43:22.686Z
- [ ] C2. If chosen: `cland release` attaches a checksummed prebuilt web bundle, and install.sh uses it after verifying the checksum, falling back to the source build (test).

## Comments

### coord · 2026-10-24T18:43:19.681Z

Human decision 2026-10-24 18:42Z (ask 7a0fd5b1, General): 'Yes, now, as part of E-778' — cland release attaches a checksummed prebuilt web bundle and install.sh uses it, falling back to the source build. Moved under E-778 stage 2.
