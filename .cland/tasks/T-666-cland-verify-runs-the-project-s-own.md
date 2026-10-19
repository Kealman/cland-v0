---
id: T-666
kind: task
title: cland verify runs the project's own check and test, and this repository names its own in the same merge
state: open
status: ready
size: M
criterion_seq: 7
labels:
  - v0.1.4
  - verification
assignee: null
parent: E-614
blocked_by:
  - T-663
  - T-665
topic: topic-580
branch: t/T-666-cland-verify-runs-the-project-s-own
created: 2026-10-16T16:35:24.419Z
updated: 2026-10-19T12:39:08.344Z
---

## Summary

The resolver from ticket T-663 reads `[verification] check`, `test` and `prepare` from the project's `config.toml` instead of returning npm lines, so a local `cland verify` runs the project's own commands (E-614 C1). This repository's `config.toml` gains `check = "npm run check"` (typecheck plus test:lint) and `test = "npm test"` in the same merge. Every one of cland's modes runs that one `test` line, with the mode carried by the selection as today (E-614 C4).

## What to build

- **Where the commands come from.** Each key comes from the candidate worktree's `.cland/config.toml` when that file sets it (as the suite limits are read today, in `hub/src/suite-limits.ts`). Otherwise the key comes from the hub root's config. So a branch cut before its project named the commands, this repository's open task branches included, verifies with `dev`'s values.
- **Recorded at submission.** The resolved `prepare`, `check` and `test` go into the job record and its `RunRef` and are printed in the log header (`Commands: check <line> · test <line>`). A hub restart, the host gate, the droplet's `run.sh` and every shard use the recorded lines and never re-read the file.
- **Without `test`.** `cland verify` refuses at submission, with no job queued and no worker started: `no [verification] test for this project; set it: cland config set verification.test '<command>'`. An unset `check` logs `check: not set` and the run goes straight to `test`. `prepare` is recorded for the droplet (ticket T-670), and a local run never runs it.
- **cland's modes on one line.** The resolver drops its per-mode npm lines: `hub`, `nvim`, `auto` and `all` all run `test`. cland's runner already takes its phases from `CLAND_SUITE_SELECTION` when it is set, and its argument only forces `all` (`runPackageSuite` in `hub/test/run-suite.ts`). The hub's selection, `hub-only`, `hub-selected`, `nvim-only`, `full` or a shard, still reaches it unchanged. Prove that the old per-mode scripts and `npm test` with the same selection plan the same phases, targets, workers and locks.
- **This repository's values.** `.cland/config.toml` gets `check = "npm run check"` (typecheck plus test:lint) and `test = "npm test"`, with the template's comment lines, in this ticket's merge. `prepare` stays empty until ticket T-670.

**Keeping cland's own suite intact.** A verify always runs the running hub's code, so this branch's own verify still runs today's lines. After the merge and the hub restart, the new code reads `dev`'s values, which name the same commands. Branches without the keys take those values too. The `hub` and `nvim` modes change from `npm test --workspace hub` and `npm run test:nvim` to `npm test` with the same selection, which C5 proves equivalent. The stage-close checklist adds one local `cland verify hub` and one `cland verify nvim` on a task branch after the hub restart.

## Acceptance criteria

- [x] C1. In a fixture project whose package scripts differ from its `[verification]` lines, a local `cland verify` runs the config's `check` then `test`, and its log shows `$ <check>` then `$ <test>` (suite CLI test against a temporary project's hub).
  - done: impl-666 · 2026-10-19T11:53:17.270Z
  - verified: rev-30 [reviewer] · run rev-20261019-666-final · 2026-10-19T12:39:05.047Z · commit 408d20bcd3a072a63ae2f9dc3638a731c478435d
- [x] C2. A candidate whose `config.toml` sets no commands runs the root's values, and its log header names them (suite CLI test with a task worktree).
  - done: impl-666 · 2026-10-19T11:53:17.825Z
  - verified: rev-30 [reviewer] · run rev-20261019-666-final · 2026-10-19T12:39:05.047Z · commit 408d20bcd3a072a63ae2f9dc3638a731c478435d
- [x] C3. A project with no `test` in either file is refused at submission with the `cland config set verification.test` line, and no run is queued (suite CLI test).
  - done: impl-666 · 2026-10-19T12:20:31.130Z
  - verified: rev-30 [reviewer] · run rev-20261019-666-final · 2026-10-19T12:39:05.047Z · commit 408d20bcd3a072a63ae2f9dc3638a731c478435d
- [x] C4. With `check` unset the log shows `check: not set` and `test` runs. A failing `check` stops the run before `test`, red with its exit code.
  - done: impl-666 · 2026-10-19T11:53:18.857Z
  - verified: rev-30 [reviewer] · run rev-20261019-666-final · 2026-10-19T12:39:05.047Z · commit 408d20bcd3a072a63ae2f9dc3638a731c478435d
- [x] C5. For each selection (`full`, `hub-only`, `hub-selected`, `nvim-only` and a shard), `npm test` with the selection in `CLAND_SUITE_SELECTION` plans the same phases, targets, workers and lock directories as the old per-mode script (`suite-runner.test.ts`).
  - done: impl-666 · 2026-10-19T11:53:19.444Z
  - verified: rev-30 [reviewer] · run rev-20261019-666-source-corrected · 2026-10-19T11:56:53.849Z · commit 4faa12e1bb1aa6f00114fa73739b7041f2015780
  - verified: rev-30 [reviewer] · run rev-20261019-666-fixtures-source · 2026-10-19T12:21:07.879Z · commit 408d20bcd3a072a63ae2f9dc3638a731c478435d
  - verified: rev-30 [reviewer] · run rev-20261019-666-final · 2026-10-19T12:39:05.047Z · commit 408d20bcd3a072a63ae2f9dc3638a731c478435d
- [x] C6. This repository's `.cland/config.toml` sets `check = "npm run check"` (typecheck plus test:lint, as the host gate runs today since T-684) and `test = "npm test"`, and the resolver resolves them for every mode (test reading the repository's own file).
  - done: impl-666 · 2026-10-19T11:53:19.921Z
  - verified: rev-30 [reviewer] · run rev-20261019-666-source-corrected · 2026-10-19T11:56:53.849Z · commit 4faa12e1bb1aa6f00114fa73739b7041f2015780
  - verified: rev-30 [reviewer] · run rev-20261019-666-fixtures-source · 2026-10-19T12:21:07.879Z · commit 408d20bcd3a072a63ae2f9dc3638a731c478435d
  - verified: rev-30 [reviewer] · run rev-20261019-666-final · 2026-10-19T12:39:05.047Z · commit 408d20bcd3a072a63ae2f9dc3638a731c478435d
- [x] C7. The recorded commands survive a hub restart mid-run: the restored run reports with the same lines (`suite-recovery.test.ts`), and a fake-droplet run's `run.sh` carries the recorded lines (`executor-run.test.ts`).
  - done: impl-666 · 2026-10-19T11:56:28.206Z
  - verified: rev-30 [reviewer] · run rev-20261019-666-final · 2026-10-19T12:39:05.047Z · commit 408d20bcd3a072a63ae2f9dc3638a731c478435d

## Comments

### impl-666 · 2026-10-19T11:26:28.292Z

Implementation underway. Confirmed existing shared resolver seam from T-663; resolving nonempty candidate values per key with root fallback, persisting prepare/check/test at admission and consuming records in every backend. T1 resolver inheritance/refusal regressions demonstrated red, now green. CLI/runner/recovery/droplet criteria will be covered before review; T-665 pending merge.

### impl-666 · 2026-10-19T11:35:29.447Z

Committed implementation locally at 61ff5f00. Source includes recorded command execution/cache identity, repository config, T1 planner seam, C1–C7 regressions and policy-only fixture command names. A-5969 maps evidence. npm run check/typecheck pass. T-664 explicitly defines empty as not set, matching per-key nonempty fallback. Waiting for T-665's batch landing before the requested origin/dev merge and final touched-file evidence; no source review or full task run submitted yet.

### rev-30 · 2026-10-19T11:55:01.355Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-666-source
commit: d188f60ce561bb4d9166963f55a330a172b43a4f
scope: full
findings: [{"severity":"medium","text":"M1: The new generated barrier.mjs waits with an unbounded while/existsSync loop and literal setTimeout(resolve, 25). docs/agents/tests.md:103 forbids a new setTimeout used as a wait. Replace it with an event-driven held-worker release, retaining the entered observation and separate completion-receipt/report assertions.","file":"hub/test/suite-recovery.test.ts","line":200}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear; A-6006. Standards M1 at suite-recovery.test.ts:200 adds an unbounded setTimeout(25) polling wait in generated barrier.mjs, prohibited by docs/agents/tests.md:103. Keep the actual restart and entered/completion/report boundaries, replacing only the release wait with an event. Spec trace found no additional issue in per-key fallback, persistence/shard copy, recorded execution, cache compatibility or planner equivalence. Fresh source review required before verify; no Reviewer tests run.

Criteria: C7 failed (New hub-restart barrier uses literal setTimeout polling; replace with an event-driven release while retaining completion/report proof.).

### rev-30 · 2026-10-19T11:56:53.849Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-666-source-corrected
commit: 4faa12e1bb1aa6f00114fa73739b7041f2015780
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-6009. M1 resolved with fs.watch installed before entered, closed on release; no timer polling. Actual restart, worker ownership and separate completion/report assertions preserved. A-6007 seven-test recovery pass inspected; full original source audit A-6006 otherwise unchanged. C5/C6 verified; C1–C4/C7 await final evidence with exact-head mode-free task gate. No dev merge or Reviewer tests.

Criteria: C5 verified, C6 verified.

### rev-30 · 2026-10-19T12:19:23.603Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-666-runtime
commit: 4faa12e1bb1aa6f00114fa73739b7041f2015780
scope: evidence
findings: [{"severity":"medium","text":"M1: The fixture declares executor but no verification.test. With the new admission rule, three existing accepted/dry-run/retry cases now fail immediately with the exact missing-test refusal (A-6020:49462/49476/49493); preserve their timeout/concurrency assertions and supply a semantic command at the fixture boundary.","file":"hub/test/verify-submission.test.ts","line":27},{"severity":"medium","text":"M2: The fixture writes only merge.queue, so both root and simulated candidate lack verification.test. The new resolver refuses batch admission before the mocked executor start; two tests await started.promise and reach 120 s timeouts (base and 0/5 repetitions). Supply fixture command configuration and prove both complete without weakening queue/rebuild controls.","file":"hub/test/merge-queue.test.ts","line":24}]
finding_counts: {"high":0,"medium":2,"low":0}

Runtime not clear; A-6021 audits failed A-6020 / b34daced. Three verify-submission cases explicitly fail with the new missing-test refusal; two merge-queue cases wait for mocked executor start and time out, with root/candidate command omission established by source. Five groups are 0/5. This is task-owned fixture migration, not a shared-flake classification. Preserve admission/refusal and queue assertions; correct carriers, reproduce serially and request fresh source review before replacement verify. No Reviewer tests run.

Criteria: C3 failed (New missing-test refusal breaks existing admitted verify-submission and merge-queue fixtures that omit verification.test; gate b34daced failed.).

### rev-30 · 2026-10-19T12:21:07.879Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-666-fixtures-source
commit: 408d20bcd3a072a63ae2f9dc3638a731c478435d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-6025. Only two semantic fixture configs add test="true"; runtime M1/M2 resolved without assertion or production changes. A-6023 preserves serial red/green proof and full files, including dedicated missing-test refusal. C5/C6 refreshed; C1–C4/C7 await final evidence with a replacement exact-head mode-free task gate. Prior failed A-6020 retained; no dev merge or Reviewer execution.

Criteria: C5 verified, C6 verified.

### rev-30 · 2026-10-19T12:39:05.047Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-666-final
commit: 408d20bcd3a072a63ae2f9dc3638a731c478435d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6035 audits A-6033 / c538f727 at unchanged source-clear head. Ordinary 1513/1513, zero fail/cancel/skip/TODO, all 436 load-gate groups 5/5, zero tier-mismatch rows. Prior five failed fixture identities now pass, dedicated missing-test refusal remains green. C1–C7 verified using source, this exact-head task gate, and explicitly qualified host lifecycle receipts A-6002/A-6007 whose relevant blobs are unchanged. Failed A-6020 retained. T3 and post-restart local hub/nvim checks remain landing/stage obligations; no Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.
