---
id: T-1836
kind: task
title: Doctor's sign-in mode line
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1829
topic: null
branch: null
created: 2026-11-12T10:07:22.789Z
updated: 2026-11-15T04:20:08.405Z
---

## Summary

`cland doctor` reports the sign-in mode. In users mode it also gives the number of users and of admins, read from the running hub.

## What to build

One line in doctor's shape, with `--json`. In single mode it reads `ok`, "sign-in mode single". In users mode it reads `ok`, naming the mode, the number of users by state, and the number of admins, from `user.list` on the running hub. Without a hub, the line reads the mode from config and says "hub not running" for the counts, with `cland hub start`. A users-mode project with no active admin is `warn`, with `cland user invite <name>`. No invite link, passkey material or password material appears in the output.

## Acceptance criteria

- [ ] C1. In single mode doctor prints one `ok` line naming the sign-in mode (test).
- [ ] C2. In users mode doctor names the mode with the number of users by state and of admins from a running hub, and "hub not running" with `cland hub start` without one (test).
- [ ] C3. A users-mode project with no active admin reads `warn` with `cland user invite <name>` (test).
- [ ] C4. No invite link, passkey or password material appears in the text or the `--json` output (test).

## Blocked by

- E-1536 (closed)
- T-1829 (the doctor check list)

## Notes

- Hot files: `hub/src/doctor/users.ts` (new), `hub/src/cli/doctor.ts`.
- Tests: new `hub/test/doctor-users.test.ts` (T2, `projectHub` in both modes).
- Serves the Contents' users stage (doctor's mode line); no checkbox names it.
