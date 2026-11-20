---
id: T-2039
kind: task
title: "Scripted DigitalOcean test fake finish(id, code) drops the exit code: finish(id, 137) reports code 1"
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-20T18:19:50.706Z
updated: 2026-11-20T18:19:50.706Z
---

## Summary

The test fake `hub/test/fakes/digitalocean/scripted-machine.ts` `finish(id, code)` sets the outcome to red or green but doesn't store `script.code`, so `finish(id, 137)` is observed as status code 1 (`{"code":1,"cause":""}`; 1 !== 137). Reported by impl-1897 on 2026-11-20 while writing T-1897's handoff control, which injects its own exact receipt to avoid it.

## Acceptance criteria

- [ ] C1. `finish(id, code)` makes the fake machine report exactly that code, shown red first, with existing callers unchanged (test).
