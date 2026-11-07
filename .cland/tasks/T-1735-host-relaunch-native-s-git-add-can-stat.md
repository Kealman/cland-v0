---
id: T-1735
kind: task
title: host-relaunch-native's `git add .` can stat the fake host's `processes.json.new` mid-rename, because the fake host home is inside the staged tree
state: open
status: backlog
size: S
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-07T06:15:51.014Z
updated: 2026-11-07T06:15:51.014Z
---

## Summary

During T-1718's preservation run (local macOS arm64, Node 24.21.0, load under 4), `hub/test/host-relaunch-native.test.ts` "C2 production Codex relaunch crosses owned carriers and consumes a fresh native first input" failed with `Error: git -c gc.auto=0 add .: fatal: unable to stat '.fixture-sockets/f1/home/.cland-host/run/processes.json.new': No such file or directory` (code 128, `hub/src/territory.ts:398`). The fake host agent writes `processes.json` atomically (`.new`, then rename) inside a home that lies under the directory a territory `git add .` stages, so the scan can see the temp file and then fail to stat it.

A differential under the preservation lock passed 5/5 at origin/dev efd68fbf and 5/5 at T-1718's head 9a369e72, so this is a rare, pre-existing race, not a T-1718 regression.

## What to build

- Find why the fake host's home (`.fixture-sockets/<host>/home`) sits inside a tree that `git add .` stages in this fixture. Move it out, or exclude it (for example with a fixture `.gitignore` or `info/exclude`). Never weaken the staging step.
- A deterministic test holds an agent `processes.json.new` write during the staging step and shows the staging no longer sees it. Red before the fix.

## Acceptance criteria

- [ ] C1. With a `processes.json.new` held in the fake host home during the relaunch's staging step, the staging succeeds and does not include the fake host home (test, red before the fix).
- [ ] C2. `host-relaunch-native` passes 10/10 locally under the preservation lock after the fix (evidence).
