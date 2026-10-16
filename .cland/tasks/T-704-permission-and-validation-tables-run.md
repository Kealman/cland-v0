---
id: T-704
kind: task
title: Permission and validation tables run through the dispatcher, with one CLI proof per command family
state: open
status: planned
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-687
topic: null
branch: null
created: 2026-10-16T19:59:37.407Z
updated: 2026-10-16T20:00:52.548Z
---

## Summary

`cland(...)` is the default client in 1206 call sites, each a Node start (memo §2.3 anti-pattern 6). In these files it is mostly a transport for permission and validation tables that `decide()` or the dispatcher answer in microseconds (report-slice1 #9, report-slice3 #9 and anti-pattern 3, report-slice4 #9 and anti-pattern I). `docs/agents/tests.md` already allows validation duplicates to call the dispatcher directly while keeping one real frame proof per tool or refusal family.

| File | Seconds | CLI sites | Note |
|---|---:|---:|---|
| `cli-identity.test.ts` | 31.0 | 30 | |
| `rule-cli.test.ts` | 19.3 | 18 | 6 hub starts for rulebook numbering and reload rules |
| `permissions.test.ts` | 14.1 | 11 | re-reads the whole `hub.log` twice per table row |
| `permission-integrity.test.ts` | 12.6 | 11 | the same fixture as `permissions` |
| `tracker-criterion-write.test.ts` | 16.1 | 16 | six spokes for a 6 × 6 matrix |
| `release-item.test.ts` | 24.6 | 27 | |
| `merge-policy.test.ts` | 35.7 | 29 | override path classification is a pure function |

## What to build

- **Tables in-process.** Table rows run through `decide()` or dispatcher-direct requests with `as:` on `projectHub`, asserting on the frame result, not on `hub.log`. Rulebook numbering, reload and high-water rules, and merge-policy path classification are T1 tests on their modules. `permission-integrity.test.ts` merges into `permissions.test.ts`.
- **One CLI proof per command family stays:** `$CLAND_SESSION_ID` makes a call the session's, an exit code, a `--json` shape, and a refusal's rendering.
- **Writers keep their proofs.** The concurrent-writes test in `rule-cli` and the hub's down-signal test in `cli-identity` stay.

## Acceptance criteria

- [ ] C1. The seven files' manifest seconds fall from 153.4 s (A-3877) to 85 s or less.
- [ ] C2. Their CLI call sites fall from 142 to 50 or less, and `startDaemon` sites from 18 to 3 or less.
- [ ] C3. No table row reads `hub.log` as its only oracle, and each command family keeps exactly one CLI proof, named in an audit.
- [ ] C4. The audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
- [ ] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.

## Blocked by

T-687 (in-process spoke).
