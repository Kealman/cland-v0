---
id: T-1813
kind: task
title: Native fake-host end-to-end dead-login cases for Codex and Claude Code
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-11T13:10:03.001Z
updated: 2026-11-11T13:10:03.001Z
---

## Summary

T-1789's native end-to-end proof (signal → login signed-out with its host → next launch skips that host → the session keeps running) is green for OpenCode on a fake host. The same native cases for Codex and Claude Code did not reach the signal within T-1789's time-box: at its head 691f5d2dd, Codex's `session.launch` reply times out after 15 s although its spoke hello and role clause succeed, and Claude's dead-login receipt times out after 15 s (impl-1789's receipts A-18714, A-18716, topic-1474). Each harness's signal classification is covered at T2 with the in-process fakes, and the post-classification path is harness-agnostic, so this item adds the remaining native coverage, not new behaviour.

## What to build

Make the fake Codex and fake Claude native launches on a fake host complete the way the existing native fake-harness files do (host-create-ready and host-relaunch launch them), then add one native end-to-end dead-login case for each, beside T-1789's OpenCode case.

## Acceptance criteria

- [ ] C1. A native Codex session on a fake host that emits a dead-login signal marks its login signed-out with that host, the next Codex launch in the pool skips the host, and the first session keeps running (test).
- [ ] C2. The same holds for a native Claude Code session on a fake host (test).
- [ ] C3. Both cases pass five lone repetitions on macOS, and their duration allowances come from green samples (test).
