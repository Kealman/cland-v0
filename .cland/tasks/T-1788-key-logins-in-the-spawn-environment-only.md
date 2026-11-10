---
id: T-1788
kind: task
title: Key logins in the spawn environment only
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1778
  - T-1783
topic: null
branch: null
created: 2026-11-09T12:44:11.572Z
updated: 2026-11-10T20:59:37.838Z
---

## Summary

A launch on a pool host whose harness uses a key login gets the key only in that harness's spawn environment, sent over `agent.sock`. The key is never in argv, a file on the host, a process row, `hub.db`, a frame, a log line, the journal or an error, and the redactor covers it. One key login runs on any number of hosts at once.

## What to build

The key travels from the store to the spawn and nowhere else:
- **Per launch.** The hub decrypts the key in memory (T-1783) and passes it through a secret environment on the spawn request. Adapters forward it to the host's spawn and never store it; it never enters the account environment.
- **OpenCode** receives it as `OPENCODE_API_KEY` (question 5).
- **The host agent.** Today its admission plan file, `launches/<id>/plan.json`, carries the whole spawn environment until the bootstrap reads it. That file stops carrying environment values: the bootstrap uses the environment it was spawned with, so no file on the host ever holds the key.
- **The redactor** registers each key value at hub start and at every key add.

A resume or relaunch re-reads the key file.

## Acceptance criteria

- [ ] C1. An OpenCode session launched on a fake host with a key login receives the sentinel key in its environment, and its process row's account environment holds no part of it (test).
- [ ] C2. With the sentinel key launched on two fake hosts at once, a search of every launched argv, every file under both fake host directories, the process rows, `hub.db`, the hub log and the journal finds no byte of it, and `.cland/auth` holds ciphertext only (test).
- [ ] C3. The host agent's admission plan file holds no environment value, and a launch still starts with its full environment (test).
- [ ] C4. An error raised while spawning with a key login names the login and never the key, and the redactor masks the key in any frame (test).
- [ ] C5. A key login is never attached or detached: a host stop leaves it `ready` and unchanged (test).

## Blocked by

- T-1778
- T-1783

## Notes

- Hot files: `hub/src/host/login-binding.ts`, `hub/src/host/login-keys.ts`, `hub/src/adapters/contract.ts` (the secret environment on the spawn request), `hub/src/adapters/opencode.ts`, `hub/src/host/agent/processes.ts`, `hub/src/host/agent/bootstrap.ts`, `hub/src/remote/redact.ts`, `docs/agents/host-agent.md` (the plan-file sentence).
- Tests: new `hub/test/login-key-spawn.test.ts` (T3: two fake hosts, the fake OpenCode, sentinel key); `hub/test/host-agent.test.ts` (T3, a new case for C3).
- Serves epic C5. C2 is the DoD's key search, on fake host directories; a real host's `/proc` is the live run's (see the report).
