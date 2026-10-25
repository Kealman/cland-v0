---
id: T-1303
kind: task
title: cland qa lint crashes in a production install since T-1225 (protocol-frame.ts not shipped)
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1283
blocked_by: []
regression_of: T-1225
found_by: cover
topic: topic-1055
branch: t/T-1303-cland-qa-lint-crashes-in-a-production
created: 2026-10-25T12:52:03.115Z
updated: 2026-10-25T12:53:09.233Z
---

## Summary

Since T-1225 (8fa66512), `cland qa lint` fails in a production install: `hub/src/qa-lint.ts` now imports `./protocol.ts` (for `isVerifyOccasion`) and `./verification-occasion.ts`, and `protocol.ts` imports `shared/protocol-frame.ts`, which a production install does not ship. The T3 case `hub/test/qa-lint-build.test.ts` "qa lint validates named titles from a production install without dev dependencies" fails with `ERR_MODULE_NOT_FOUND … install/shared/protocol-frame.ts imported from … install/hub/src/protocol.ts`. It passes at 8fa66512^ and fails at 8fa66512 and dev bf26b423 (Coordinator, local macOS); the periodic dev T3 run fee2e7ee (A-11934) caught it. T-1225's merge batch ran T1 only. This would ship broken in v0.2.2 for Homebrew and install.sh users.

Fix: keep `qa lint`'s import graph inside what a production install ships. Either import the occasion predicate from a module with no `shared/protocol-frame.ts` dependency, or add the missing shared file to the production install's file set, whichever matches how the install is defined; record which and why.

## Acceptance criteria

- [ ] C1. `hub/test/qa-lint-build.test.ts` passes at the fix head, including "qa lint validates named titles from a production install without dev dependencies", with its assertions unchanged.
- [ ] C2. A test (the existing production-install case or a new T1 import-graph check) fails if `qa lint`'s module graph reaches a file the production install does not ship; a negative control re-adding the T-1225 import shape fails it.
