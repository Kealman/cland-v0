---
id: T-746
kind: task
title: "suite-remote-process: 'remote group started' misses its 15 s bound on dev (1 in 5 on the Mac)"
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-17T17:23:11.458Z
updated: 2026-10-17T17:23:11.458Z
---

## Summary

impl-742's alternating comparison (T-742, 2026-10-17 17:22Z) reproduced `hub/test/suite-remote-process.test.ts` failing on origin/dev at line 52, `f.remote(a.id)`, with "remote group started: not within 15000 ms" (26.8 s), in 1 of 5 whole-file runs at load below 4. Dev's passing runs took 17.5–19.3 s per file. At T-742's head the same file passed 5/5 in 9.5–10.7 s, so T-742's release and accounting change may remove the cause. Check this after T-742 merges.

## What to build

After T-742 lands, rerun the file 20× whole-file on the Mac. If it still fails, replace the 15 s real-time wait for "remote group started" with the hub's own start receipt, driving the fixture's clock if it uses one, and keep the assertions. If T-742 fixed it, record the 20× evidence and close this as covered.

## Acceptance criteria

- [ ] C1. suite-remote-process.test.ts passes 20/20 whole-file on the Mac at dev after T-742, with its assertions unchanged, or with the fix named.
