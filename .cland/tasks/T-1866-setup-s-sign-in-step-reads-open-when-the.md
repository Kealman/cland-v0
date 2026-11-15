---
id: T-1866
kind: task
title: Setup's sign-in step reads open when the hub is down, even in single mode
state: open
status: review
size: S
criterion_seq: 2
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1521
branch: t/T-1866-setup-s-sign-in-step-reads-open-when-the
created: 2026-11-15T08:06:05.452Z
updated: 2026-11-15T10:23:14.574Z
---

## Summary

When the hub can't be reached, setup's sign-in mode step (`hub/src/setup/steps/signin.ts`, T-1835) reads `open` with "choose the web sign-in mode", unless `--yes` or `--no-aide` is given. That happens even when the project config says single mode. The step asks only the hub for the mode and never reads config. T-1835's amended C4 and the users docs page (T-1838) both say a single-mode project without a terminal reads `skip` with `cland auth mode users` as its fix. Setup's exit status is unaffected today, because the hub row is already `open` when no hub answers. But the extra `open` row contradicts the docs, and so does the "choose" wording for a project that already has a mode. Found by the E-1537 stage-5 QA brief draft at ef9f52fc9.

## What to build

When the hub can't be reached, the step reads `auth.mode` from the project config, as doctor's mode line does (T-1836):
- **single:** `skip`, detail "single mode", fix `cland auth mode users`, the same row as the reachable-hub case;
- **users:** `open` with `cland hub start`, since the user counts need the hub;
- **config unreadable:** the step keeps today's `open`.

Nothing is written.

## Acceptance criteria

- [x] C1. With no hub running and config in single mode, the sign-in step reads `skip` with fix `cland auth mode users`, both with and without a terminal, and writes nothing (test).
  - done: impl-1866 · 2026-11-15T10:18:12.963Z
- [x] C2. With no hub running and config in users mode, it reads `open` with `cland hub start`. With a reachable hub, every existing T-1835 row is unchanged (test).
  - done: impl-1866 · 2026-11-15T10:18:35.404Z

## Comments

### impl-1866 · 2026-11-15T10:17:11.908Z

Rule 20 sweep: signinStatus/signinUsers/sign-in mode/step name consumers searched across hub, web, nvim, shared, docs, .agents, site and qa (all tiers). Migrated: offline signin rows, shared config reader with doctor, setup docs and users guide, setup-signin tests/per-test note. Unaffected: setup runner ordering and SetupLine renderer/exit aggregation (shape unchanged); SetupHub/user.list wire (no protocol change); setup-flow/setup-hub/setup-cli/setup-remotes/setup-remote-component/scenarios/setup and web/setup-signin reachable cases; users/auth-mode/doctor-users and users-docs-invite tests; setup/auth/doctor CLI usage and fixture declarations (no syntax change); hub README, web-edge/cland-doctor/secrets/spec/features/cli/web-and-phone docs (generic facts unchanged); shipped implement skill reachable flow; E-1537-stage-5 known T-1866 historical observations remain correct at their pinned build; E-1537 epic brief not yet present; other historical QA briefs unchanged. Kept older hub metadata regression and legacy user.list shape regression. Missing config uses doctor default single; malformed config retains old fallback. Red observed for single and users separately before each fix.

### rev-35 · 2026-11-15T10:22:39.161Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1866-source-1
commit: 9a197bf0b3f465ac79fd7e9be2a820cffbf69b5e
scope: full
findings: [{"severity":"low","text":"Guide incorrectly attributes missing/default and invalid-config coverage to doctor-users.test.ts; those new cases are in setup-signin.test.ts. Lead confirmed no such doctor cases exist. Correct the attribution; production source is clear.","file":"docs/agents/tests/hub-test-setup-signin.test.ts.md","line":22}]
finding_counts: {"high":0,"medium":0,"low":1}

A-19603 source clear with one low guide-attribution finding. Exact 9a197bf0b/treee1e1f3a15 clean; fixed point8f4592f11. Offline single/users/unreadable rows match task; shared read-only policy, successful reachable branch unchanged, older metadata/legacy wire retained, no new effects. C1/C2 unverified pending actual same-head configured receipts. A-19601 preserves transcribed argv/cwd/summaries and wrapper/precommit/raw-capture limits; original A-19600 publication scan was missing, not upgraded by fixture controls. Consumer list is source-search limited, actual selection/finish accounting pending, Web not established/deferred by local absence. E1537 stage5 historical known T1866 remains pinned history. Hold released; if correcting guide now, fresh delta source request before verify. Reviewer performed read-only analysis only.
