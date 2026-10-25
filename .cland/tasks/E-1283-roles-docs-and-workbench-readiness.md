---
id: E-1283
kind: epic
title: Roles, docs and workbench readiness
state: closed
criterion_seq: 2
labels: []
assignee: null
parent: R-1277
blocked_by: []
topic: topic-1059
branch: null
created: 2026-10-25T09:52:49.457Z
updated: 2026-10-25T17:28:36.542Z
closed: 2026-10-25T17:28:36.542Z
---

## Summary

Clauses, skills and lint agree with the runtime policy, and actions issued before the workbench's first snapshots are kept: who commits at the root, Aide verify rows in qa lint, cover-quiet waits with a wake-up instead of polling, and early Neovim actions. Triage: A-11669 (approved by the human, ask f93ccf6a).

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677-1283 · 2026-10-25T17:28:17.424Z · commit 9d43be5ee508db7043d02714a8ac5c4fb0567c2f
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677-1283 · 2026-10-25T17:28:17.424Z · commit 9d43be5ee508db7043d02714a8ac5c4fb0567c2f

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

### qa-677 · 2026-10-25T17:28:17.424Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-dod-2026-10-25-677-1283
commit: 9d43be5ee508db7043d02714a8ac5c4fb0567c2f
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Criterion | Result | Evidence |
|---|---|---|
| C1 | PASS | Seven children closed/done/merged; hub-sourced clear reviews match native passed verify heads and Reviewed-by landing trailers; reviewed change sets land on dev. |
| C2 | PASS | Stage closed; Linux/macOS cover pair green with zero failures; all 125 stage test names have passing receipts in each cover; A-12049 stage QA clear; demo freshness current:true. |

CLEAR at 9d43be5ee508db7043d02714a8ac5c4fb0567c2f. Run qa-dod-2026-10-25-677-1283. Criteria verified: C1,C2. No findings.

C1 source head / verify / squash landing:
T-1275 73d5f067 / e544ad80 (A-11760) / c966b086
T-1260 3fd60e91 / df54906c (A-11969) / d1f48007
T-1225 04b63e68 / 7b4a8836 (A-11794) / 8fa66512
T-1303 77afb333 / bc8e1434 (A-11963) / 0ef4dde1
T-323 1f708c1f / bcfeb783 (A-11869) / 9b3ae9f9
T-1315 79f3f205 / 4ad40d51 (A-12018) / fbb21716
T-1300 316c03c8 / 2ba9da7e (A-11886) / 3e208223
Full hashes and review run IDs retained in C1-final.json. Each hub job independently has the reviewed head, finished state and native code 0. All landings are ancestors of the cover commit. Zero-context stable patch IDs agree for source and squash deltas (whitespace normalized); preliminary whole-file/context comparisons are retained and labelled.

C2 covers: 7cf7c622/A-12030 (Linux x64 droplet) and 7867cc49/A-12036 (darwin arm64 local), both at 871fc3639f16dcc071c1da91c630d41fce9e7a7d / verification tree 2bc8ecaf43f7326a238bdd164dfcbd7e4422bba9. Host check and T1–T4 base phases plus Web completed. Linux native summaries: 4665 pass, 9 skip, 0 fail; macOS: 4674 pass, 0 skip/fail. All 125 scoped stage test names independently match pass receipts in both logs. Linux skips are outside those names. T4 repetitions did not run; timing budgets/ratchets were report-only with recorded overages and missing baselines. Green does not mean enforced performance-budget pass.

Both used Node v24.21.0 and Neovim v0.12.5. Linux log names Chrome Headless Shell 156.0.8078.4, Playwright revision1248; exact macOS browser version is not printed in its retained cover log and is not inferred. Linux cover shard lifetimes 1403.262 s / 1380.989 s; costs $0.09744875 / $0.09590201 (about $0.1934 total). Child droplet accounting is in accounting.json; these historical lifetimes are not test wall times or audit costs.

A-12049 is the current clear stage verdict at 2b9d3c2b422f72f82a3011984f8cd48544d96341 and maps every child's behavior. The audited detached checkout is clean, HEAD matches request/dev. demo status E-1283 --commit 9d43be5ee508db7043d02714a8ac5c4fb0567c2f --json reports freshness.current:true, state:none. Later changes are tracker/QA briefs/add-only duration baselines, listed in evidence.

This run audited existing records only: no tests, suites, demo lease, browser, GUI or provider sessions were launched. Durable evidence A-12053: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12053-e-1283-dod-qa-clear-evidence-audit-at-9d43be5e/report.md. Includes named coverage receipts, native summaries, allowlisted job records, SHA-256 log identities, freshness and recorder rows; secret scan passed.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T17:28:36.542Z

Closed on DoD verdict qa-dod-2026-10-25-677-1283 at 9d43be5e (A-12053): C1 and C2 verified. Stage 1 closed on cover pair 7cf7c622/7867cc49 at 871fc363 and stage QA qa-stage-2026-10-25-677-1283 (A-12049).
