---
id: T-640
kind: task
title: 'Every cland init ends with "next: cland setup", and --json carries next'
state: open
status: planned
size: XS
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by:
  - T-609
topic: null
branch: null
created: 2026-10-16T16:23:56.644Z
updated: 2026-10-16T16:24:32.365Z
---

## Summary

`cland init` names the step after it: its last line is `next: cland setup`, and its `--json` report carries `"next": "cland setup"` (spec v0.1.4 §3.2, "What comes next"). `cland update` and `cland init --undo` print no such line.

## What to build

- In `hub/src/cli/init.ts`, after the report: the line `next: cland setup` for every `init` that provisions, and `next` in the JSON object beside `root`, `version` and `changes` (prototype/setup 5028220a holds the shape: a `NEXT` constant, so setup and the docs name the same command).
- A refused init (T-609's refusals, the shallow clone of the next ticket) ends with its refusal, not with the next step.
- The hub README's init section shows the closing line.

## Acceptance criteria

- [ ] C1. `cland init` on a scratch folder prints `next: cland setup` as its last line, and `cland init --json` prints an object whose `next` is `cland setup` (init-roots.test.ts, on the scratch machine of ticket T-639).
- [ ] C2. `cland update` and `cland init --undo` print no `next` line and carry no `next` key in `--json`.
- [ ] C3. An init that T-609 refuses prints no `next` line.
