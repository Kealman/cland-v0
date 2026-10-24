---
id: T-1188
kind: task
title: cland release --help exits 1 with Unknown option
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: topic-938
branch: t/T-1188-cland-release-help-exits-1-with-unknown
created: 2026-10-23T21:49:35.727Z
updated: 2026-10-24T08:10:08.287Z
closed: 2026-10-24T08:10:08.287Z
---

## Summary

`cland release --help` exits 1 with `cland: Unknown option '--help'`, because `runRelease`'s parseArgs has no help option. `cland --help` works and documents release. impl-1185 found it at 9a587b59 on 2026-10-23.

## What to build

Give `cland release` a `--help` that prints its usage and exits 0, as the other subcommands do.

## Acceptance criteria

- [x] C1. `cland release --help` prints the release usage and exits 0 (test).
  - done: impl-1188 · 2026-10-24T07:49:53.046Z
  - verified: rev-32 [reviewer] · run rev-20261024-1188-final · 2026-10-24T08:04:52.352Z · commit 378826a08ece9e250aa3d347e5ed3e51a59b9013

## Comments

### impl-1188 · 2026-10-24T07:49:30.025Z

Implemented test-first at the requested executable CLI seam. Initial release help test failed with `cland: Unknown option '--help'` and exit 1; same failure reproduced for sync/publish/push/merge. Minimal parseArgs help/-h options now print existing shared usage and return 0 before argument validation or hub discovery. Local macOS targeted T2 file: node --test hub/test/cli.test.ts, 9/9 pass on working tree (no suite/gate claim); npm run check underway. Documentation updated; no QA brief required (qaPolicy none).

### rev-32 · 2026-10-24T07:51:12.332Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1188-source
commit: 378826a08ece9e250aa3d347e5ed3e51a59b9013
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1188 full source review — clear
Head 378826a08ece9e250aa3d347e5ed3e51a59b9013; tree 6cf97fbde2c1bb7565df1f44f6a1e2e606a9dd6c; fixed parent c880aedd6a3719e1b845affd5f41e6a517749ffe. git diff --no-ext-diff --no-textconv 378826a0^ 378826a0 -- covers nine files, 59 additions/5 removals.

## Standards
No findings. Each command adds the established parseArgs boolean help option with short h and returns its existing usage string before argument validation and discovery. Release/sync/publish reuse RELEASE_USAGE; push/merge use their existing command blocks. No real release, publication, hub, Git or network operation was added.
The five new T2 cases use the executable because CLI exit/stdout/stderr is the subject. Both --help and -h run through cland in a tempProject root with no hub; the shared launcher uses the sealed account fixture environment and bounded execFile completion. Exit zero, empty stderr and command-specific usage are final assertions. No polling, sleeping, real provider or new fixture writer is introduced. Existing tests remain unchanged.
hub README, docs/agents issue-tracker guidance, the matching CLI test note and project-owned release skill describe the shipped help behavior. The release skill has no upstream-origin metadata requiring a retained-upstream change record. No role permission or grant changes; existing clause lines are unaffected.

## Spec
No findings. C1's release --help path now accepts the option and prints release usage with exit zero before requiring a hub or arguments. The release item's usage is also asserted. Sibling sync/publish/push/merge coverage and -h are explicitly approved by Coordinator 00c5b8ac in topic-938; this is authorized scope. Ordinary command paths and unknown-option parsing remain otherwise unchanged.
C1's test-dependent verification remains pending the post-source mode-free receipt at this exact head. No verified criterion is recorded by this source pass. qaPolicy none/after-stage; no per-item QA brief.

A-10425 reports local macOS targeted cli.test.ts 9/9 and npm run check pass with report-only lint, 132 findings and no refusals. It precisely labels these working-tree executions as the tree subsequently committed, not queued suite/load/coverage evidence. Preserve retained original tool output/exits/timing with source provenance without reruns solely for transcription.
Reviewer performed source/Git/docs/artifact reads only; no tests, probes, edits, installs, browser, release or delegation. Standards and Spec were reviewed in this session under the no-subagent role restriction.
Standards: 0 findings. Spec: 0 findings.
Durable audit A-10429: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10429-t-1188-full-source-review-at-378826a0.md

### rev-32 · 2026-10-24T08:04:52.353Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1188-final
commit: 378826a08ece9e250aa3d347e5ed3e51a59b9013
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1188 final evidence review — clear
Exact unchanged head 378826a08ece9e250aa3d347e5ed3e51a59b9013; tree 6cf97fbde2c1bb7565df1f44f6a1e2e606a9dd6c. Source audit rev-20261024-1188-source/A-10429 remains applicable.
Fresh configured mode-free run 531a4424-733d-40a6-88bd-5e6fc697db93, raw log A-10467, exit0.

## Standards
No findings. Original log confirms T0 host npm run check (typechecks/build/test lint), all T1, fallback all T2 across hub/Neovim, and Web completed successfully. Linux x64 6.8.0-142-generic c-8 lon1 droplet cland-v0-2456a683, Node v24.21.0/Neovim v0.12.5, hub/Neovim workers2 and Web4.
Executor base counts: T1 776, hub T2 1399, Neovim T2 346, Web279 = 2800 ordinary passes, zero fail/cancel/skip/todo. The printed file-plan aggregates (774/1708/223) are separate measurements. Five new help identities each have five actual passing scope=load-gate finishes: 25 additional repetition executions, not part of the 2800 ordinary count.
CLI file base9/9 passes. New ordinary samples: release0.595408s, sync0.728264s, publish0.384884s, push0.406121s, merge0.403881s; all 25 repetition samples0.313471–0.765763s. Both --help and -h are exercised within each case. No allowance change needed.

## Spec
C1 verified: the actual executable release help case exits zero, emits release usage/item usage, and has empty stderr in a sealed disposable no-hub root, in the base phase and5/5 repetitions. Authorized sibling cases also pass. Source early returns precede validation/discovery and operation work, as audited in A-10429. Verify all criteria (C1); no QA criterion under none/after-stage policy.

Limits: this is T0–T2 plus Web, not T3/T4/full-suite or release execution. T3 remains deferred to periodic dev/integrated occasions. Host gate tree f5dacb893956cf72a5ca366c3e061a39fa7108a4 was reused, not rerun on droplet. Generic lint/duration/ratchet diagnostics are report-only with one missing baseline and incomplete base timings; this is not a clean/enforced budget claim. Actual Web shard163.62s exceeds40s report-only; projected150.266s at2workers is not its observed wall time. Existing shell/items/inbox/connection/item-summary warnings remain. New CLI cases themselves remain below their individual bounds.
Command durations62/367/168s; measured shard wall57.05/362.35/163.62s; droplet lifetime696s/cost$0.0483, not interchangeable totals. Implementer reports a fresh conflict projection against dev4727549e with no conflict; that is not a merge, head change or runtime receipt. Branch still resolves to reviewed SHA.
Reviewer inspected original logs and source/Git metadata only, without tests, browser, edits, release or delegation.
Standards: 0 findings. Spec: 0 findings; C1 verified.
Durable audit A-10468: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10468-t-1188-final-same-head-evidence-at-378826a0.md

Criteria: C1 verified.

### coord · 2026-10-24T08:10:08.287Z

Merged 76b0549e789ccc69521736111ccaa0587459b315 onto dev.
