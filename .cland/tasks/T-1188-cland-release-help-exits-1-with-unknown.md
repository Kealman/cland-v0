---
id: T-1188
kind: task
title: cland release --help exits 1 with Unknown option
state: open
status: review
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
updated: 2026-10-24T07:51:12.332Z
---

## Summary

`cland release --help` exits 1 with `cland: Unknown option '--help'`, because `runRelease`'s parseArgs has no help option. `cland --help` works and documents release. impl-1185 found it at 9a587b59 on 2026-10-23.

## What to build

Give `cland release` a `--help` that prints its usage and exits 0, as the other subcommands do.

## Acceptance criteria

- [x] C1. `cland release --help` prints the release usage and exits 0 (test).
  - done: impl-1188 · 2026-10-24T07:49:53.046Z

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
