---
id: T-1431
kind: task
title: tracker-summary's dropped-events test waits only 5 s for macOS to deliver a native FSEvents callback and fails on a busy Mac
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: null
branch: null
created: 2026-10-28T15:10:06.059Z
updated: 2026-10-29T15:59:40.605Z
---

## Summary

`hub/test/tracker-summary.test.ts` "a healthy watcher with dropped events still indexes hand edits, additions and removals" (from T-1377) waits 5000 ms for macOS to deliver the native FSEvents callback it then drops ("native notifications deliberately dropped: not within 5000 ms", line 480). It failed in the E-1311 stage-2 macOS cover aadf5738 at 60ad6021 (A-13360, T1, peak load 8.99, fseventsd at about 90–125% CPU all afternoon). It passed 5/5 alone right after (coord, 2026-10-28 15:10Z). The rescan is mocked; only native delivery latency is bounded, by a guess. Same family as T-1427 (FSEvents latency on a busy Mac).

## Acceptance criteria

- [ ] C1. The native-delivery wait is sized from measured FSEvents latency receipts under load, or replaced with a trigger the test owns, without weakening what the test proves (healthy watcher, events dropped, safety rescan indexes everything), with 10/10 under two workers plus CPU load on macOS.

## Notes

Load flake under the flaky-rerun rule (first sighting; one cover resubmit). Regression candidate of T-1377.
