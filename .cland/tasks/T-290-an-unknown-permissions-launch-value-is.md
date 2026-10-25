---
id: T-290
kind: task
title: "An unknown `permissions` launch value is swallowed: RolesFile keeps the last good policy and the launch proceeds (T-289 follow-up)"
state: open
status: in progress
size: S
labels:
  - hub
  - ready-for-agent
assignee: null
parent: E-1280
blocked_by: []
topic: topic-1067
branch: t/T-290-an-unknown-permissions-launch-value-is
created: 2026-10-12T12:17:37.170Z
updated: 2026-10-25T19:57:55.112Z
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

- [ ] C1. A launch or relaunch under a role whose `permissions` value is unknown is refused, naming the roles file, the role, the value and every accepted value (`""`, `"auto"`, `"skip"`); the hub log names the key.
- [ ] C2. A corrected roles file lets the next launch proceed without a hub restart.
- [ ] C3. The parser's diagnostic names every accepted value; `approval` and `sandbox` are checked for the same gap and the finding recorded in the item.
- [ ] C4. Tests cover the refusal, the recovery and the diagnostic at the roles and adapter seams; `npm run typecheck` and the targeted tests pass; `cland verify` is green.

## Comments

### impl-290 · 2026-10-25T19:54:44.731Z

Rule 20 before changes: changing launch admission when the roles file is invalid, with additive optional RolesSource.launchError getter (older/fixed sources remain valid; no wire/list/schema changes). Production consumers searched: Sessions launch, pool launch, fresh resume and relaunch (all use fresh; refusal before spawn/stop), hub core role/permission snapshots and dispatch role assignment/list, ProjectConfiguration and RolesFile readers, fixedRoles, roleLaunchPolicy, roles launch/editor/template and CLI role/session. Snapshot, grant, persisted process readers and wire clients keep last-good shapes; no migration required. Tests/fixtures searched across all tiers plus nvim/web, qa briefs, docs, shipped skills and startup: consumers include roles*, config-reload-component, session-credential-io, launch-admission/recovery, session-launch*, session-resume*, lifecycle*, adapter-composition, opencode-launch-policy, custom-roles*, lead*, crew*, scenarios/crew-launch and QA role launch/resume cases. These retain normal valid-file behavior; regressions will cover both real reader implementations through fake adapter Sessions, parser diagnostics, last-good snapshot retention, no-stop refusal and correction. Existing sources without launchError remain a compatibility regression via unchanged launch-admission tests. No new native process required. approval and sandbox share the same caught parse-error gap; both get identical admission treatment. Current permissions contract also includes auto; preserve it.
