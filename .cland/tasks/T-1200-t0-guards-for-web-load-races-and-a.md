---
id: T-1200
kind: task
title: T0 guards for Web load races and a repetition gate for new Web files
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-980
branch: t/T-1200-t0-guards-for-web-load-races-and-a
created: 2026-10-24T06:46:04.641Z
updated: 2026-10-24T12:27:17.162Z
---

## Summary

Three Web load races in v0.2 (T-1157 auto-retry, T-1182 measuring before the phone layout switch, T-1183 clock pause). T-1183 guards only the clock pattern. Retro A-10321, triage A-10327.

## Acceptance criteria

- [ ] C1. A T0 check refuses raw viewport resizes across 640 px outside the helper that waits for [data-phone], and refuses waits on negated predicates, each with a planted violation (test).
- [ ] C2. A new Web test file passes 10 repetitions at two workers under CPU load before ready, and verify reports the count (test).
