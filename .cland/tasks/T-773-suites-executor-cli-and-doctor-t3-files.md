---
id: T-773
kind: task
title: Suites, executor, CLI and doctor T3 files move their rule tests to T2 under the same titles (A-4961 groups, ~70 s)
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - tests
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
topic: null
branch: t/T-773-suites-executor-cli-and-doctor-t3-files
created: 2026-10-18T04:49:25.413Z
updated: 2026-10-18T04:50:07.313Z
---

## Summary

This is a split of T-708, from its C1 inventory A-4961. It covers the "Suites and executor" group (42 files, 758.9 s) and the "CLI and doctor" group (31 files, 287.5 s). Scripted-provider replacement and refusal tables and queue/TTL rules move to T2 under the same titles. Worker, timeout, sentinel and watchdog claims stay native. The proposed removal is 70.4 s.

## What to build

Apply those rows of A-4961 exactly. Note in the audit which native files dominate the remaining seconds (suites and executor keep 691 s), as input for the T3 residual follow-up.

## Acceptance criteria

- [ ] C1. Every "Suites and executor" and "CLI and doctor" row in A-4961 is applied or explicitly kept, with each moved test's title and assertion meaning unchanged, recorded as an audit artifact that lists the five slowest remaining native files with their seconds.
- [ ] C2. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
