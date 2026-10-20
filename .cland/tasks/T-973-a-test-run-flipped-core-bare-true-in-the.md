---
id: T-973
kind: task
title: A test run flipped core.bare=true in the live repository (shared by all worktrees), breaking merge admission
state: open
status: review
size: S
criterion_seq: 3
labels:
  - bug
  - security
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: topic-749
branch: t/T-973-a-test-run-flipped-core-bare-true-in-the
created: 2026-10-20T13:44:18.343Z
updated: 2026-10-20T16:50:16.897Z
---

## Summary

At 2026-10-20 13:31:25Z (.git/config mtime), `core.bare` became `true` in the live repository's config, which every task worktree shares. The hub's merge admission then failed with `merge-tiers: git rev-parse --show-toplevel: fatal: this operation must be run in a work tree`, dropping T-970 and T-972 (13:42:58Z). The Coordinator restored it with `git config core.bare false`. In that window, implementers impl-970 and impl-972 were running targeted test files in their task worktrees, and the Coordinator had just run bisection probes in detached worktrees of the live repository. The usual mechanism is `git init --bare` or `git clone --bare` running with GIT_DIR or GIT_COMMON_DIR inherited, which reinitialises the inherited repository as bare.

## What to build

Find the writer and close the class. Every test and fixture child strips GIT_DIR, GIT_WORK_TREE, GIT_COMMON_DIR, GIT_INDEX_FILE and the other GIT_* repository-location variables. The sealed builder from T-961 should already do this; check whether it covers these and whether the culprit bypassed it. The hub refuses to admit or batch while the root reports `core.bare=true`, with a clear message naming the fix. Rule 15 applies.

## Acceptance criteria

- [x] C1. The writer is identified (test, command or session) from a reproduction in a scratch repository, or the evidence lists every candidate checked.
  - done: impl-973 · 2026-10-20T16:48:12.002Z
- [x] C2. A T1 test with a poisoned GIT_DIR/GIT_COMMON_DIR proves the fixture environment strips them, and a native T3 case in territory-cli.test.ts shows a fixture git init --bare / clone --bare leaves the scratch parent repository's config bytes unchanged (targeted local run before review; its Linux receipt is landing evidence).
  - done: impl-973 · 2026-10-20T16:48:12.596Z
- [x] C3. Merge admission reports `core.bare=true` in the root as its own clear error instead of a raw rev-parse failure.
  - done: impl-973 · 2026-10-20T16:48:13.215Z

## Comments

### coord · 2026-10-20T13:45:01.828Z

Coordinator investigation notes (13:45Z): impl-970 and impl-972 report that all their test runs used disposable roots and fixture environments that strip GIT_DIR, GIT_WORK_TREE and GIT_COMMON_DIR, and that only read-only or operational git ran in task worktrees. The Coordinator's bisect probes (13:13–13:28Z) ran node --test in detached worktrees of the live repository with only HOME replaced, which is a rule-15 gap, but they ended about 3 minutes before the 13:31:25Z write. Other sessions on this machine with worktrees of this repository include ~/.claude/jobs/723d0f6e/tmp/wt-fix and wt-ps (another Claude job), plus cland-explorer, brand, setup, onboarding and the research worktrees. The writer is unidentified; C1 stays open.

### impl-973 · 2026-10-20T16:48:29.917Z

Implemented and pushed c888e8e2c057ad64b3532d52ab44732c2d1e8eee. C1 candidate evidence is artifact A-7710 (durable path /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7710-t-973-scratch-reproductions-candidate-audit-and-regression-evidence.md): historical writer remains unidentified, but inherited GIT_DIR and GIT_COMMON_DIR scratch writers are reproduced; init-fixture.sh's late-overlay bypass is reproduced and fixed. C2 follows Coordinator-approved T1/T3 split. C3 returns merge-bare at admission and batch preparation before worktree-dependent operations, without repairing config. Local macOS direct targeted 82-test run passed on implementation tree; final pure 52-test run passed; hub typecheck and diff check passed. No suite/tripwire gate mode enabled on those direct runs. Full mode-free T0–T2 verification will follow clear source review. Native Linux T3 remains landing evidence per Coordinator decision. QA policy scope none.

### impl-973 · 2026-10-20T16:50:16.897Z

M1 corrected in pushed head f52a9182afc9a97b838ee90c9d64a08aab9cb302: .cland/roles.toml Coordinator/Lead now carry merge-bare guidance. Coordinator default/project clauses point to the merge skill to preserve byte reserve; equivalent project heartbeat prose shortened. roles-clauses.test.ts passed 27/27 at this head on local macOS (direct targeted T1; no suite/tripwire gate mode). All existing reserve/wording guards retained. No dev merge or verification run after first source review request.
