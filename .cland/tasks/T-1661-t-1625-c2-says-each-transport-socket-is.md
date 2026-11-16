---
id: T-1661
kind: task
title: T-1625 C2 says each transport socket is mode 0700; the contract checks the run directory at 0700 and the sockets as 0600 nodes
state: open
status: backlog
size: XS
labels: []
assignee: null
parent: E-1887
blocked_by: []
regression_of: T-1625
topic: null
branch: null
created: 2026-11-03T11:05:50.288Z
updated: 2026-11-16T07:29:25.689Z
---

## Summary

Found by QA in the E-1538 stage-2 run (qa-678, topic-1346, dev 3b391058). T-1625 C2 reads "each of the four is a Unix socket in the host's agent-owned run directory at mode 0700". The contract asserts the run directory is 0700 (`transport-contract.ts:32`) and that each endpoint is a socket node (lines 33–37), and the fixture creates the stub sockets at 0600 (`transport-contract-fixture.ts:80`). The behaviour is sound, since the 0700 directory guards the sockets, but the criterion's wording doesn't match it, which can mislead a later carrier's author.

## What to build

Amend the guide (`docs/agents/tests/hub-test-transport-ssh-contract.test.ts.md`) to state the actual requirement: the run directory is 0700 and agent-owned, and each endpoint is a Unix socket inside it. Optionally assert the sockets' own mode, if a carrier must guarantee it. Correct T-1625's closed criterion text through the tracker, with a note.

## Acceptance criteria

- [ ] C1. The contract guide states the directory-mode and socket-node requirements exactly as the contract asserts them, and T-1625's C2 text matches, with a dated note.
