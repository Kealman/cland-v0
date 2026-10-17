---
id: T-719
kind: task
title: "T2 projectHub tests start no git or ps probe: injected tracker reader and process table"
state: open
status: in progress
size: S
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-677
blocked_by:
  - T-685
topic: topic-444
branch: t/T-719-t2-projecthub-tests-start-no-git-or-ps
created: 2026-10-16T20:09:33.790Z
updated: 2026-10-17T14:20:34.506Z
---

## Summary

A T2 projectHub test still spawns infrastructure probes: about 6 git calls (configuration source commit, tracker branch tips) and 3 ps calls (lock identity, harness cleanup) per fixture, found by T-685's spawn census. A T2 test should start no child process unless the native boundary is its subject (memo §5.1, A-4143).

## What to build

projectHub and the in-process hub take narrow in-process answers for these probes in T2: the tracker reads branch tips and the configuration commit through an injected reader, and lock identity and cleanup use an injected process table. The real git and ps paths stay the production default and stay covered by their own T3 lifecycle files.

## Acceptance criteria

- [ ] C1. A T2 projectHub test that launches, signals and stops a session through the in-process fake adapter shows zero child processes in its spawn census row, proved by a census test.
- [ ] C2. The production git and ps paths are unchanged and still covered by their existing lifecycle tests, with each T3 file's assertions unchanged in meaning.
