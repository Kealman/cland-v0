---
id: T-1157
kind: task
title: "Topics Web test: Retry button sometimes never shows within 3 s"
state: open
status: backlog
size: XS
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-22T23:18:03.338Z
updated: 2026-10-22T23:18:03.338Z
---

## Summary

One local macOS run of web/test/topics.test.ts on T-1119's working tree (base 52657840, 2026-10-22 ~23:17Z) failed with `locator.waitFor: Timeout 3000ms exceeded ... waiting for getByRole('button', { name: 'Retry', exact: true }) to be visible`; the isolated rerun and the complete rerun passed. impl-1119 suspects a duplicate scroll-triggered automatic retry that hides the Retry button; the cause is unconfirmed.

## What to build

Reproduce the failure under load or repetition, find whether an automatic retry can race the visible Retry button, and make the Topics area and its test deterministic about when Retry shows.

## Acceptance criteria

- [ ] C1. The Retry case of web/test/topics.test.ts passes 20 of 20 repeated runs at 2 workers on macOS, with the cause named in the item (test).
