---
id: T-1024
kind: task
title: The Neovim frame recorder refuses green runs whose frame count depends on scheduling
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: E-1282
blocked_by: []
topic: null
branch: null
created: 2026-10-20T19:05:14.551Z
updated: 2026-10-25T09:53:26.076Z
---

## Summary

The Neovim frame recorder refuses to publish when a run under concurrent load records fewer frames than its floor (`explorer-component.test.ts recorded 251 frames; expected at least 253`), although every consumer test passed and a serial retry published byte-identical fixtures. Found by impl-1002 on T-1002 (2026-10-20, Darwin arm64).

## What to build

Make the recorder's completeness check independent of scheduling: count recorded test identities or required frame kinds instead of a raw frame floor, or run the recorder serially by default, so a green run under load publishes.

## Acceptance criteria

- [ ] C1. A recorder run with concurrent targets publishes when every consumer test passed and no file was skipped (test simulating a scheduling-dependent frame count).
- [ ] C2. The recorder still refuses a run that skipped a file or a test (test).
