---
id: T-828
kind: task
title: cland --help's push line omits the Aide after T-630
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: C-326
blocked_by: []
regression_of: T-630
topic: null
branch: null
created: 2026-10-19T05:57:33.676Z
updated: 2026-10-19T05:57:33.676Z
---

## Summary

`cland --help`'s push line (`PUSH_USAGE` in `hub/src/cli/usage.ts`) still says the push runs from the "Coordinator’s shell or human". T-630 let the Aide publish `dev` with `cland push`. Found while drafting E-611's QA brief.

## Acceptance criteria

- [ ] C1. The push usage line names who may run `cland push` as the hub actually allows it (Coordinator, Aide, human), and a usage test pins the text.
