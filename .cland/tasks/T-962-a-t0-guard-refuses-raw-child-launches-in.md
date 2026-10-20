---
id: T-962
kind: task
title: A T0 guard refuses raw child launches in hub/test that inherit the environment without the sealed builder
state: open
status: in progress
size: S
labels:
  - ready-for-agent
  - tech-debt
assignee: null
parent: E-952
blocked_by:
  - T-961
topic: null
branch: t/T-962-a-t0-guard-refuses-raw-child-launches-in
created: 2026-10-20T10:10:19.498Z
updated: 2026-10-20T10:57:10.709Z
---

## Summary

T-961 seals the shared fixture builders, but nothing stops a test from calling `spawn`, `execFile` or `fork` with an inherited environment. rev-32 found this in T-954's suite-check.test.ts. Add a T0 static guard so rule 15 holds for new tests mechanically.

## What to build

A T0 check over hub/test refuses a child-process launch whose environment is inherited or built from `process.env` without the sealed builder from T-961. Exemptions:

- typed fake-provider and native-credential seams;
- lifecycle and setup helpers that are sealed by construction;
- anything else carrying an inline exemption with a reason.

Each finding is reported with file and line. Found by impl-961 and recorded as a gap outside T-961's C2.

## Acceptance criteria

- [ ] C1. A scratch test that spawns with `env: process.env`, or with no env, fails the T0 check, naming the file and line.
- [ ] C2. Every existing launch either uses the sealed builder or carries a listed exemption with a reason, and the evidence lists them.
