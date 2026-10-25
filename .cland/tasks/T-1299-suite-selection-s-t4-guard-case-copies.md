---
id: T-1299
kind: task
title: suite-selection's T4 guard case copies every production loadGuard into a one-guard fixture
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1282
blocked_by: []
regression_of: T-1259
found_by: cover
topic: topic-1048
branch: t/T-1299-suite-selection-s-t4-guard-case-copies
created: 2026-10-25T11:30:32.519Z
updated: 2026-10-25T11:31:08.748Z
---

## Summary

`hub/test/suite-selection.test.ts` "task admission selects unchanged T4 guards from the manifest and reports the mapped source" copies the production `loadGuards` from `hub/test/tiers.json` into a fixture manifest that declares only `hub/test/inbox-verifier-load.test.ts` as T4. Every new production load guard therefore fails manifest validation in that fixture (`invalid loadGuards … names a missing or non-T4 test`). T-1259 (executor-safety-load) and T-1028 (launcher-input-load) each added one; their merge batches ran T1 only, so dev now fails this T3 case. Reported by impl-1233 at dev 8fa66512 and reproduced by the Coordinator on dev.

The fix keeps the fixture self-contained: it derives only the guard entries for the guard it declares (or declares its own mapping), so adding production guards cannot break it.

## Acceptance criteria

- C1. The case passes at the fix head with the current production `loadGuards` (three guard files) and still asserts the inbox-verifier-load selection and description; a second fixture-local guard added to production `tiers.json` in a scratch copy does not break it.
