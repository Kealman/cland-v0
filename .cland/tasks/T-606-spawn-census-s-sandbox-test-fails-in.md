---
id: T-606
kind: task
title: "spawn-census's sandbox test fails in integrated macOS runs: the sandboxed child inherits NODE_V8_COVERAGE"
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - v0.1.3
  - hub
  - test
assignee: null
parent: E-426
blocked_by: []
regression_of: T-394
topic: topic-374
branch: t/T-606-spawn-census-s-sandbox-test-fails-in
created: 2026-10-16T12:29:04.656Z
updated: 2026-10-16T12:45:14.272Z
closed: 2026-10-16T12:33:02.612Z
---

## Summary

The v0.1.3 macOS release run dbf1b763 at 0e2a0aee (A-3904) failed hub/test/spawn-census.test.ts:93, "a sandbox denying census log writes preserves child stdout, exit and spawns". Since T-394, integrated dev runs record coverage, so `NODE_V8_COVERAGE` is set to the run's coverage-map.json.raw directory. The test passes `...process.env` to a child under `(deny file-write*)`. That child can't write its coverage file and prints `EPERM: Failed to write file …/coverage-….json` to stderr, which breaks the test's `stderr === ''` assertion. Droplet runs skip the test, because they have no sandbox-exec, so only an integrated macOS run shows it.

## What to build

In that test only, remove `NODE_V8_COVERAGE` from the env given to the launcher, so neither the launcher nor its sandboxed child writes coverage. Grep hub/test and nvim/test for other sandbox-exec tests that pass `process.env` to a child under a write-denying profile, and apply the same removal there if any exist. No production change.

## Acceptance criteria

- [x] C1. The test passes on macOS both with and without `NODE_V8_COVERAGE` set in the parent's environment (run once each way), and every other sandbox-exec test file under hub/test and nvim/test passes with it set.
  - done: impl-606 · 2026-10-16T12:31:19.937Z
  - verified: rev-30 [reviewer] · run rev-20261016-606-full · 2026-10-16T12:32:44.864Z · commit f0bdcd9a6c79764bef13cf26f3cb456752466b34

## Comments

### impl-606 · 2026-10-16T12:31:19.927Z

Implemented test-only empty NODE_V8_COVERAGE overrides for the census sandbox launch and sandbox-prefixed Neovim QA launches. Deleting the variable alone failed because Node restores it from the parent; empty disables coverage writes. Reproduced census failure before fix; after fix census passes with and without coverage (2/2 each), Neovim QA with coverage passes 47/47, no skips. origin/dev fetched/merged (already up to date), committed and pushed f0bdcd9a6c79764bef13cf26f3cb456752466b34. No cland verify per Coordinator launch instructions; integrated macOS release run is full evidence.

### rev-30 · 2026-10-16T12:32:44.864Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-606-full
commit: f0bdcd9a6c79764bef13cf26f3cb456752466b34
scope: full

# T-606 full source and evidence review clear

Reviewed pushed `f0bdcd9a6c79764bef13cf26f3cb456752466b34`, branch `t/T-606-spawn-census-s-sandbox-test-fails-in`; local/origin refs agree. Fixed point/merge base `0e2a0aee87771bc8b3d2f0aa1d548ffa1ca8a7f2`; captured three-dot diff and single implementation commit. Exactly two test files/four added lines. Took hold and read claimant/sole C1 done, QA scope none. Direct review, no delegated work.

**Primary Coordinator59426758-e00d-40ed-86d5-636d2f2d2ad1** explicitly accepts targeted macOS A-3905 as this item's suite evidence, prohibits a task cland verify, and requests one full source/evidence verdict at this head. Post-merge Linux release-occasion and full macOS integrated covers remain the full release evidence; fix forward if red. This item verdict does not claim those covers already ran.

## Standards

No high/medium/low findings. census sandbox test:102–103 sets `env.NODE_V8_COVERAGE=''` on its cloned launch environment before starting the launcher; the launcher and sandboxed Node child inherit disabled coverage. Existing stdout `unchanged`, empty stderr, status0 and census spawn/gap assertions all remain unchanged. Parent/suite coverage stays enabled.

Neovim qa helper:70–71 applies the same empty override only when its command prefix contains the actual sandbox-exec path, after options.env merges. Ordinary launches retain their coverage setting. No process.env mutation, sandbox-profile weakening, stdout/stderr normalization, skip broadening, production code or lifecycle cleanup change. Comments explain why absent/deleted is not sufficient on the observed Node version. Whitespace diff check passes.

This is a scoped test-environment correction, not a blanket suppression of coverage or failures. No Fowler-baseline/documented-standard finding.

## Spec / macOS evidence

Verify **C1 under the explicit Coordinator disposition**. Task's wording says remove the variable; the meaningful requirement is preventing coverage writes in the write-denied child. **A-3905** documents macOS Node24.21.0 exact failure before fix: census1pass/1fail, stderr EPERM writing coverage JSON. Deleting the property still fails because this Node child_process propagates an absent coverage key; explicit empty-value disable succeeds. Thus the empty override is a demonstrated implementation adjustment fulfilling the intent, not an unexplained exception.

A-3905 is a durable detailed note of commands/counts/outcomes, not a separate raw-log bundle. It reports exact source tree subsequently committed:
- census whole file with parent coverage set: **2/2**, no failures/skips,491.294ms;
- census whole file without parent coverage: **2/2**, no failures/skips,457.558ms;
- Neovim QA whole file with parent coverage: **47/47**, no failures/skips,27.0665s, including all three network-denied/write-denied sandbox cases.

Independent sandbox-exec/write-profile search across hub/test+nvim/test confirms the two edited files are the write-denying cases. **edges.test.ts** only denies network-bind, keeps file writes available and is unchanged; no targeted edges-with-coverage run is in A-3905, and none is invented. Primary59426758 expressly settles C1 on the given census/QA targeted evidence, with the complete post-merge integrated macOS cover retained. No Linux test run is a substitute for these macOS sandbox prerequisites.

Full review **clear**, C1 verified, zero findings. **No task cland verify, full local suite or typecheck requested** under the direct release-path disposition; no per-item QA. Conditional merge and post-merge release covers remain Coordinator-owned. Reviewer only reads source/evidence: no tests/compiler/binary/sandbox/provider calls or edits.

Findings: Standards0; Spec0.

Artifact A-3906 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3906-t-606-full-review-clear-sandbox-only-coverage-disable-with-targeted-macos-proof.md

Criteria: C1 verified.

### coord · 2026-10-16T12:33:02.612Z

Merged 4b8912baeaf8c8efde41bbd51d93dc96c618814c onto dev.

### coord · 2026-10-16T12:45:14.272Z

Escape after merge: T-606's `env.NODE_V8_COVERAGE = ''` failed the host typecheck (TS2339 at hub/test/spawn-census.test.ts:103, a property missing on the inferred literal type). The release-occasion run ac648ae5 at 3f57140e was refused before any droplet was created (A-3907). The impl ran the targeted tests only. The review read source and evidence, and no `cland verify` ran under the Coordinator's disposition, so nothing typechecked the head. Fixed forward by the Coordinator in f7711676, with the key moved into the literal; `npm run typecheck` exits 0 and spawn-census passes 2/2 with coverage set. Lesson: a disposition that skips `cland verify` must still require `npm run typecheck` at the head.
