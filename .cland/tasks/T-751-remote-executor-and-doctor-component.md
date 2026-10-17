---
id: T-751
kind: task
title: Remote, executor and doctor component fixtures inject machine and Git facts instead of bootstrapping native Git and doctor probes
state: open
status: planned
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
topic: null
branch: null
created: 2026-10-17T18:44:08.662Z
updated: 2026-10-17T21:48:43.219Z
---

## Summary

Route R1 in T-748's trip list (A-4703) also covers the scripted remote and executor component fixtures and doctor: demo-cap, demo-release-component, executor-admission(-lock), executor-droplet-component, executor-prepare-retry, executor-safety-component, remote-scripted and doctor (52 rows). They still bootstrap native Git and doctor probes inside T2 fixtures.

## What to build

Inject the Git, snapshot and doctor facts these fixtures need at their seams (T-699's in-process executor fixture, T-719's injected readers), keeping one real-process proof per behaviour in existing T3 files. Every assertion keeps its meaning.

## Acceptance criteria

- [ ] C1. The runtime tripwire reports no child_process trip in these files, proved by a full droplet run's trip report.
- [ ] C2. The review request maps every changed fixture call with Mac 5/5 medians before and after.
