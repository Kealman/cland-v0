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
updated: 2026-10-23T10:53:00.953Z
---

## Summary

One local macOS run of web/test/topics.test.ts on T-1119's working tree (base 52657840, 2026-10-22 ~23:17Z) failed with `locator.waitFor: Timeout 3000ms exceeded ... waiting for getByRole('button', { name: 'Retry', exact: true }) to be visible`; the isolated rerun and the complete rerun passed. impl-1119 suspects a duplicate scroll-triggered automatic retry that hides the Retry button; the cause is unconfirmed.

## What to build

Reproduce the failure under load or repetition, find whether an automatic retry can race the visible Retry button, and make the Topics area and its test deterministic about when Retry shows.

## Acceptance criteria

- [ ] C1. The Retry case of web/test/topics.test.ts passes 20 of 20 repeated runs at 2 workers on macOS, with the cause named in the item (test).

## Comments

### coord · 2026-10-23T10:53:00.953Z

Cause found by impl-1141 while building T-1141 (2026-10-23 10:52Z, topic-904). Thread.tsx's automatic earlier-page loader has no error guard. When an earlier-page read is rejected (`Rejected earlier page`), a native or synthetic scroll event asks for the page again about 9 ms later, and that clears the error before the human's Retry, so the Retry button may never show. Decision: T-1141 fixes it (suppress automatic earlier-page loads while an error is set; an explicit Retry loads with the original anchor) and adds a guard test. Its ready report carries a 20-run macOS count of the Topics Retry case. Close this item against T-1141's landing.
