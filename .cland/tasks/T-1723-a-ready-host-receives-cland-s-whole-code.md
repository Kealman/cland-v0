---
id: T-1723
kind: task
title: A ready host receives cland's whole code tree for its version (CLI, spoke and the Claude Code mod)
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1722
topic: null
branch: null
created: 2026-11-06T11:10:54.543Z
updated: 2026-11-06T11:10:54.543Z
---

## Summary

The version handoff (hub/src/host/code-delivery.ts) ships only the host agent's closure. `remoteHostLayout` expects `<home>/.cland-host/code/<version>` to hold the whole installed tree: `hub/bin/cland.ts`, `hub/bin/cland-spoke.ts` and, after T-1722, `mod/cland` for Claude Code. Its comment says "E-1533 images install this version directory". Coord decided that cland's code is delivered at ready, not baked into the pool image (E-1533 open question 9), so the ready step must deliver the tree. Without it, a real provider host has no CLI, no spoke and no mod, and no session can run on it.

## What to build

- A versioned delivery of the cland runtime tree (hub sources and bins, shared, the mod directory and the `package.json`/lockfile needed by `npm ci -w hub`) to `<code>/<version>`. It follows the agent bundle's pattern: a staging directory, a digest manifest, an atomic rename, and a reuse when the version and digest match. Dependencies install with `npm ci -w hub --omit=dev` on the host.
- The create-to-ready sequence (T-1718) calls it before starting the supervisor.
- Fake hosts keep using the hub's installed tree.
- Rule 20 sweep: the agent bundle's consumers and the version handoff tests.

## Acceptance criteria

- [ ] C1. Delivering to a fake host's scratch home installs `<code>/<version>` with `hub/bin/cland.ts`, `hub/bin/cland-spoke.ts` and `mod/cland`, each file matching the manifest digest (test).
- [ ] C2. A second delivery of the same version and digest copies nothing, and a changed digest replaces the tree atomically, never leaving a half-written version directory (test).
- [ ] C3. The delivered spoke and CLI start from that tree on the fake host and answer `--version` with the hub's version (test).
- [ ] C4. The agent bundle tests (host-agent-restart, host-agent-closure and the version-handoff cases) pass with no test edited.
