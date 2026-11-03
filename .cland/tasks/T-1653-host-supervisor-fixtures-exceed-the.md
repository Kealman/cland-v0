---
id: T-1653
kind: task
title: host-supervisor fixtures exceed the macOS 104-byte Unix socket path limit under the suite's temp root
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1594
topic: null
branch: null
created: 2026-11-03T04:59:56.359Z
updated: 2026-11-03T04:59:56.359Z
---

## Summary

The E-1536 stage-4 macOS cover 94521ff5 (A-16171, dev bf486cb6) failed two tests in `hub/test/host-supervisor.test.ts` on every repetition (0/5): "supervisor C1-C4: singleton, detached lifetime, HUP, kill-agent restart and retained harness identity" and "kill-agent refuses another live fake host receipt and preserves both agents and harnesses". The output is `cland: connect EINVAL /private/tmp/cland-suite-80f39b05-b212-4aee-a22d-73ea7008dad2/hs-IkJDyQ/one/home/.cland-host/run/agent.sock`, a 107-byte path; macOS limits `sun_path` to 104 bytes. The Linux batch and droplet verifies passed because Linux allows 108, and local runs used a shorter TMPDIR.

## What to build

Build the fixture's fake-host HOME, and so `.cland-host/run/*.sock`, under a short root through the existing shared short-socket fixture helper (see `hub/test/fixture-socket-path.test.ts`), so every socket path stays within 104 bytes under the suite's longest temp root, `/private/tmp/cland-suite-<uuid>/`. Search the other host fixtures (fake-host, host-agent, transport tests) for the same pattern and fix each one, or record why it is unaffected.

## Acceptance criteria

- [ ] C1. Both named host-supervisor tests pass five load-gate repetitions on macOS with TMPDIR set to a `/private/tmp/cland-suite-<36-char uuid>` root (test).
- [ ] C2. A guard fails a fake-host fixture whose socket path would exceed 104 bytes, naming the path, before any connect (test).
