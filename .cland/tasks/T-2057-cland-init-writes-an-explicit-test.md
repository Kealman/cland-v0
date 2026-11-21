---
id: T-2057
kind: task
title: "`cland init` writes an explicit test_timeout = \"120s\", so every init-created project gets exact per-test timeouts and never T-2046's load scaling"
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
created: 2026-11-21T23:29:11.442Z
updated: 2026-11-21T23:29:11.442Z
---

## Summary

T-2046 scales per-test timeouts with load, but only when `test_timeout` is a default rather than an explicit setting. T-2051 carries that default provenance through fresh admissions. However, the config template that `cland init` renders writes `test_timeout = "120s"` explicitly, at template line 167 (since d86cc5f29, 2026-10-14). So every init-created project counts as explicit and keeps an exact 120,000 ms bound (A-22587). Only a config that omits the line gets the scaled default.

## What to build

Decide the template policy, then apply it:
- Leave `test_timeout` out of, or commented in, the generated config, so new projects get the scaled default.
- Or treat a value equal to the default as a default.

Keep an explicit user value exact. Existing projects are unchanged unless their owner edits the line.

## Acceptance criteria

- [ ] C1. A project created by `cland init` gets the scaled default per-test timeout under load, and a project that sets `test_timeout` explicitly keeps it exact (test).
