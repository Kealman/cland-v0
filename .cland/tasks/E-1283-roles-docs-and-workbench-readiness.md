---
id: E-1283
kind: epic
title: Roles, docs and workbench readiness
state: open
labels: []
assignee: null
parent: R-1277
blocked_by: []
topic: topic-1059
branch: null
created: 2026-10-25T09:52:49.457Z
updated: 2026-10-25T17:20:07.041Z
---

## Summary

Clauses, skills and lint agree with the runtime policy, and actions issued before the workbench's first snapshots are kept: who commits at the root, Aide verify rows in qa lint, cover-quiet waits with a wake-up instead of polling, and early Neovim actions. Triage: A-11669 (approved by the human, ask f93ccf6a).

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.

## Plan

```yaml
stages:
  - name: clauses, lint and early actions
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1275
        - T-1260
      - - T-1225
        - T-1303
      - - T-323
        - T-1315
      - - T-1300
```

## Comments

### qa-677 · 2026-10-25T17:20:07.041Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-stage-2026-10-25-677-1283
commit: 2b9d3c2b422f72f82a3011984f8cd48544d96341
stage: clauses, lint and early actions
stage_hash: 1508a2fa5e55c388a64c0092e14bb7beab0dfbdd18a5c00d7499865d09e5d6e5
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

CLEAR — stage clauses, lint and early actions. Clean detached HEAD matched dev and origin/dev before and after at 2b9d3c2b422f72f82a3011984f8cd48544d96341. All seven stage items have dev landing receipts. Hub cover pair has no missing platforms at tree 2bc8ecaf43f7326a238bdd164dfcbd7e4422bba9: Linux 7cf7c622 and macOS 7867cc49.

| Case | Result | Observation |
|---|---|---|
| M1 | PASS | roles-clauses 39 + roles-editor 13; conditional Aide clauses, migration and byte reserves |
| M2 | PASS | Four sources define conditional root publication; literal search plus onboarding section 7 direct inspection |
| M3 | PASS | test-admission 4; durable one-shot slot wake-up across reconnect/restart |
| M4 | PASS | suite-admission 9; shared lint/runtime Aide command matrix |
| M5 | PASS | plan-component 20 + launcher-component 15; real headless key input, both snapshot orders, all three owner outcomes, delayed role defaults |
| M6 | PASS | cli-command-help 17 + cli-help 4; each task subcommand and native entry point |
| M7 | PASS | Build CLI task criterion --help exited 0 with own usage; no Unknown option |
| X1 T-1303 | PASS | qa-lint-build 3; named production-install/no-dev-dependencies case |
| X2 T-1315 | PASS | ARTIFACT-001 passes through the headless QA runner: exactly 1 matching test |

125/125 tests passed in ten serial files; no skipped/cancelled/todo/failed tests. Actual generated names and native count/exit records are in case-summary.json. Local darwin arm64, Node v24.21.0; sealed headless NVIM v0.12.5 binary /Users/evgeniyivanov/Projects/cland/v0/.cache/nvim/v0.12.5/nvim-macos-arm64/bin/nvim. Disposable HOME/XDG/Git via shared fixture builder; no browser, real harness/provider, GUI, full suite or performance budget claim. Selected T1/T2/T3 plus one T4 catalogue case only; remaining tiers/cases were not rerun. The original T-1303 negative control is historical item evidence, not a new mutation run; ARTIFACT-001 ran once here, not 3/3.

Observation corrections: onboarding uses “root Git metadata access”, so the brief's exact M2 phrase misses that file; full controlling context confirms the expected ownership. M7's initial capture checker wrongly expected a “Usage:” prefix and threw “Error: M7 failed”; the unchanged command capture starts “  task criterion <id> <done|verify|fail|edit|remove>” and exits 0. Corrected checker, no command rerun or product failure.

No findings and no epic criterion marks. Evidence A-12049: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12049-e-1283-stage-qa-clear-125-tests-at-2b9d3c2b/report.md. Includes all commands, native outputs, build/landing/plan records and nine recorder rows. Shared secret scan passed before publication.
