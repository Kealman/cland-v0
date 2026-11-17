---
id: T-1932
kind: task
title: "Five more T2 files opt into nativeIdentityProjectHub: migrate them onto T-1915's hermetic CLI boundary or move them to T3 with a reason"
state: open
status: planned
size: M
labels: []
assignee: null
parent: E-1882
blocked_by:
  - T-1915
topic: null
branch: null
created: 2026-11-17T04:43:21.058Z
updated: 2026-11-17T23:14:15.747Z
---

## Summary

Split from T-1915 (A-20619). T-1915 builds the shared hermetic CLI and fixture boundary and migrates five consumers. Five more T2 files still import `nativeIdentityProjectHub` and read the real machine lock identity: roles-component, suite-protocol, suite-wait-metrics, merge-queue and auth-mode.

## Evidence

- A-20205: T-1768's macOS enforce census (239 files).
- A-20619: impl-1915's scope inventory and split (2026-11-17). auth-mode passed the old census and needs route classification; merge-queue has further native paths, which A-20619 lists.

## What to build

Move each of the five files onto T-1915's boundary, so that under the T2 tripwire it makes no native process call. Where a file truly needs the native path, move it to T3 with its reason recorded in the tier manifest.

## Acceptance criteria

- [ ] C1. Each of roles-component, suite-protocol, suite-wait-metrics, merge-queue and auth-mode either passes an enforce-mode T2 tripwire run with no native process call, or is in T3 with its reason recorded (test).
- [ ] C2. No T2 file imports `nativeIdentityProjectHub` afterwards, or each remaining import has a recorded reason (test).
