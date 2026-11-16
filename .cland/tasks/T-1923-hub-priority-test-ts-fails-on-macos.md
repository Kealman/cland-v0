---
id: T-1923
kind: task
title: "hub-priority.test.ts fails on macOS since T-1768: the doctor report has no hub priority check under nativeIdentityProjectHub"
state: open
status: in progress
size: S
labels: []
assignee: null
parent: E-1882
blocked_by: []
regression_of: T-1768
topic: topic-1567
branch: t/T-1923-hub-priority-test-ts-fails-on-macos
created: 2026-11-16T22:08:41.630Z
updated: 2026-11-16T22:09:37.491Z
---

## Summary

hub-priority.test.ts fails on macOS at dev since T-1768 (84f58ecdb) switched it to `nativeIdentityProjectHub`: the in-process doctor report has no `hub priority` check, while `hub status --json` in the same test does carry the priority warning. The Linux droplet batch 256ef4e8 passed it, so the failure is macOS-only and every crew session's local T2 run of this file is red.

## Evidence

- `node --test hub/test/hub-priority.test.ts` in a detached worktree on macOS (coord's shell; also with every `CLAND_*` variable removed): 020aef2e0 fail (the crew-identity failure T-1904 fixed), 802acd529 pass, 84f58ecdb fail, 0e093db62 (dev tip) fail.
- Failure: `AssertionError [ERR_ASSERTION]: no check named hub priority in ps, claude-code, …, hub, hub.json, secret, territory, …` at doctor-fixture.ts `check` from hub-priority.test.ts `check((await report(root, tools.env)).report, 'hub priority')`; actual undefined, expected true.
- impl-1705 hit the same red at T-1705's merged head 6579171d9 (topic-1552).

## Acceptance criteria

- [ ] C1. hub-priority.test.ts passes on macOS and on the Linux droplet at the fixed head, from a crew session's shell, with the hub priority warning reported by both `hub status` and the doctor report.
- [ ] C2. The fix keeps T-1768's guarantee that this file's fixture never spawns native sysctl through the default lock identity, or records why native identity is required here and makes the doctor path agree with it.
