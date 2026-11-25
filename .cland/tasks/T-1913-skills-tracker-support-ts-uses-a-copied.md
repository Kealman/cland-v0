---
id: T-1913
kind: task
title: skills-tracker-support.ts uses a copied CLAND_* filter instead of the shared fixture environment builder
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2073
blocked_by: []
topic: topic-1761
branch: t/T-1913-skills-tracker-support-ts-uses-a-copied
created: 2026-11-16T14:43:54.752Z
updated: 2026-11-25T03:52:31.162Z
closed: 2026-11-25T03:52:31.162Z
---

## Summary

`hub/test/skills-tracker-support.ts:17` filters `CLAND_*` names with its own copied filter, not `fixtureEnvironment`. It stops the session-identity leak that T-1904 fixed elsewhere, but its in-process task fixture still inherits HOME, `GIT_*` and provider variables from the caller, which rule 15 forbids. Found by impl-1904 during T-1904, 2026-11-16 (topic-1556).

## What to build

Replace the copied filter with the shared builder (`fixtureEnvironment`, plus `scratchGitEnvironment` where a scratch Git config is needed), applied after the final overlay. Do the rule 20 sweep for any other copied `CLAND_*` or credential filter in hub/test and nvim/test.

## Acceptance criteria

- [x] C1. The skills tracker fixture runs with no inherited HOME, `GIT_*` or provider credential name when its caller has them set, shown with a synthetic outer environment (test, red before the fix).
  - done: impl-1913 · 2026-11-25T01:48:27.647Z
  - verified: rev-40 [reviewer] · run rev-40-20261125-1913-final · 2026-11-25T02:31:14.676Z · commit fe626051fa0622b12f8cfc0e1cf0e5a7817b8e3f
- [x] C2. No test helper keeps its own copy of the credential or `CLAND_*` filter; each one is migrated to the shared builder or named as unaffected (test).
  - done: impl-1913 · 2026-11-25T01:48:27.872Z
  - verified: rev-40 [reviewer] · run rev-40-20261125-1913-final · 2026-11-25T02:31:14.676Z · commit fe626051fa0622b12f8cfc0e1cf0e5a7817b8e3f

## Comments

### impl-1913 · 2026-11-25T01:47:36.972Z

Rule 20/41 consumer sweep: skills-tracker-support imports only in skills-tracker.test.ts (T2) and skills-tracker-jq.test.ts (T3). Shared builder unchanged; no wire or production policy change. Migrated 13 copied filters across 12 files: skills-tracker-support, cli-imports (2), edges, topics, task-worktrees-lifecycle, claude-code-sessions-lifecycle, init-process, skills-tracker-jq, fake-harness, v01-migration, scenarios/startup-smoke and generated fixture-worker-lifecycle launch. All use fixtureEnvironment after environment inputs; existing runnerFixtureEnvironment remains the final child seal. Scratch Git overrides are not used at these seams, so scratchGitEnvironment is unnecessary. Kept intentionally: account-fixture-env worker reconciliation from shared builder; account-poller output assertion; fake-Claude background native identity loss preserving synthetic account paths; spawn-census deliberate discovery stripping as recorder positive control. Other CLAND matches in fake OpenCode/Codex/Claude are observations of launched identity, not isolation filters; login-card-signin-trace validates an error code. Credential-name sweep found shared withoutExecutorCredentials uses and explicit production-policy assertion fixtures, no copied credential policy in hub/test or nvim/test. Regression scans hub/test and nvim/test recursively, with positive control and named intentional exclusions. No production callers, shipped skill/QA examples, frozen wire/help bytes or persisted formats change.

### rev-40 · 2026-11-25T01:53:22.340Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-1913-source
commit: fe626051fa0622b12f8cfc0e1cf0e5a7817b8e3f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. Tracker's in-process helper now passes the shared sealed environment to runTask; synthetic-parent regression covers HOME/Git/provider/session removal with positive harmless-variable and nonmutation assertions. All13 migrated copied-filter sites use the shared builder, final runner overlays remain sealed, and the four named unaffected seams match their observed purpose. Census has a positive copied-filter detection control; manual source/consumer searches complement its specific spelling. No production policy/wire/schema change or new native launch. C1/C2 remain unverified pending configured exact-head named-case/native consumer receipts. A-23111 targeted local macOS checks and later static exits0 do not substitute for configured verification. No Reviewer runs. Standards/Spec: A-23118, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23118-t-1913-source-clear-at-fe626051f.md.

### rev-40 · 2026-11-25T02:31:14.676Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-1913-final
commit: fe626051fa0622b12f8cfc0e1cf0e5a7817b8e3f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1/C2 verified. Same-head/tree runa2e99629/A-23172 finished passed. Independently checked both exact new synthetic-isolation/census bases at31832/31844, distinct5/5 load finishes and receipts32182/32295, plus all available base outcomes across changed native launch files/tracker consumers (details in audit). T0/T1/fallbackallT2/selected15T3files134passing identities/Web exit0; T4 unexecuted, remaining process scope merge-batch policy, macOS stage-selector/sandbox prerequisites explicitly skipped. Noncached Linuxx64 dropletc8sfo2 workers2 Node24.21/Nvim0.12.5, isolated HeadlessShell1248/CfT156.0.8078.4. Advisory budgets remain report-only; no macOS native rerun or performance clearance claimed. No findings/Reviewer runs. A-23175: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23175-t-1913-final-clear-at-fe626051f.md.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-25T03:52:31.162Z

Merged e94dcff8ab42a707149ea2e940570c808ca7adc9 onto dev.
