---
id: T-1092
kind: task
title: OpenCode port-retry test fails under load on macOS with setTypeOfService EINVAL from undici
state: open
status: backlog
size: XS
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-22T03:17:55.717Z
updated: 2026-10-22T03:17:55.717Z
---

## Summary

The macOS stage cover 017af6bd (A-8877, dev 4912d98d, local darwin arm64, 2 workers, peak 1m load 9.56) failed `hub/test/opencode-adapter.test.ts` "OpenCode retries a port taken between choice and bind on a different port" in 222 ms with `Error: setTypeOfService EINVAL` (errno -22, syscall setTypeOfService) thrown from undici's `writeH1` on a socket. The same test passed 5/5 alone at the same commit (coord, 2026-10-22 03:19Z), and the Linux cover 5a43d79c at that commit was green. It is a load-dependent flake: undici sets the type of service on a socket that the test's port-race fixture has already closed.

## Acceptance criteria

- [ ] C1. The test no longer fails when undici's socket option call meets a closed socket: the fixture closes the taken port only after the client request settles, or the adapter's poll treats this error as a retryable connection failure; the planted race is still exercised (test).
- [ ] C2. The test passes 20/20 under `--test-concurrency 4` with a parallel CPU load on macOS, run in a disposable root under rule 15 (test).
