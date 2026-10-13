---
id: T-290
kind: task
title: "An unknown `permissions` launch value is swallowed: RolesFile keeps the
  last good policy and the launch proceeds (T-289 follow-up)"
state: open
status: backlog
labels:
  - hub
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-12T12:17:37.170Z
updated: 2026-10-12T12:17:37.170Z
---

## Summary

T-289 (landed as 71ecabe by the human's override) meant an unknown `[<role>.launch] permissions` value to be refused at launch naming the two values, but the roles reader catches the parser's error and keeps the last good configuration, so the next launch or relaunch proceeds with the previous policy, possibly `skip`. The parser's diagnostic also names only `skip`, not `""`.

## Parent

T-216 Tech debt. Follow-up of T-289 from rev-24's post-merge advisory review (A-1504, 2026-10-12): `hub/src/roles/config.ts:141` rejects the value during parsing, `RolesFile` catches that and `fresh` returns normally.

## What to build

A launch or relaunch whose role's launch table holds an unknown `permissions` value is refused with a reason that names the role, the value and the two accepted values (`""` and `"skip"`), instead of running with a stale policy. The roles file's "keep the last good configuration on a parse error" behaviour stays for the file as a whole, but the refused launch must say that the roles file is in error and which key, so the human can fix it; the hub's log line for the bad file names the key too. The parser's diagnostic names both accepted values. Codex's `approval` and `sandbox` keys get the same treatment only if they share the bug; say so in the item either way.

Tests at the adapter and roles seams: an unknown value refuses the launch and the relaunch with the reason; a corrected file lets the next launch through; the diagnostic text. No real harness needed.

Out of scope: the start-up CLI check warning waived on T-289.

## Acceptance criteria

- [ ] A launch or relaunch under a role whose `permissions` value is unknown is refused, naming the role, the value and the accepted values `""` and `"skip"`; the hub log names the key.
- [ ] A corrected roles file lets the next launch proceed without a hub restart.
- [ ] The parser's diagnostic names both accepted values; `approval` and `sandbox` are checked for the same gap and the finding recorded in the item.
- [ ] Tests cover the refusal, the recovery and the diagnostic at the roles and adapter seams; `npm run typecheck` and the targeted tests pass; `cland verify` is green.
