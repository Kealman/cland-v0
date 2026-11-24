---
id: T-2057
kind: task
title: Generated and managed configs write an explicit test_timeout (`cland init`, and any managed config rendering such as `config set`), so projects lose default provenance and T-2046's load scaling
state: open
status: planned
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: null
branch: null
created: 2026-11-21T23:29:11.442Z
updated: 2026-11-24T09:01:17.746Z
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
- [ ] C2. Rendering a managed config setting (for example `config set` on a verification key) in a project that leaves `test_timeout` unset keeps it unset, or keeps default provenance, so load scaling survives (test).

## Comments

### coord · 2026-11-22T00:29:34.117Z

Widened (2026-11-22): T-2051's verify 8fce93e4 (A-22602) showed `hub/test/verification-workers.test.ts` failing on `testTimeoutIsDefault` true before versus false after managed config rendering. So managed rendering (for example `config set` on a verification setting) also writes `test_timeout` explicitly. A project that left it unset loses default provenance, and load scaling, as soon as any managed setting is rendered. This item covers both the init template and managed rendering. Rendering should keep an unset `test_timeout` unset, or keep its default provenance.
