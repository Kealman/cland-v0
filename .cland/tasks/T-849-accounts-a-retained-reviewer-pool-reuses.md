---
id: T-849
kind: task
title: "accounts: a retained Reviewer pool reuses the old member after a same-size roles.toml rewrite (Linux batch run)"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-573
branch: t/T-849-accounts-a-retained-reviewer-pool-reuses
created: 2026-10-19T07:31:31.466Z
updated: 2026-10-19T10:17:00.069Z
closed: 2026-10-19T10:17:00.069Z
---

## Summary

`hub/test/accounts.test.ts` 'a retained Reviewer pool reuses only the same account and keeps its original directory' failed once on Linux, in merge batch e1ed96eb (run 892bfedf, A-5860, tree a43a190c, droplet c-8 lon1, peak load 6.96). The assertion at accounts.test.ts:197 (`next.sessionId !== p.sessionId`) failed: the launch after rewriting `.cland/roles.toml` from account codex-b to codex-a reused the old pool member, so the hub had not yet seen the new roles file.

## Problem

The batch members (T-664, T-663, T-669) do not touch account or pool code; T-664 only adds keys to the applied list in configuration.ts. The test rewrites roles.toml with a same-size body (`codex-b` → `codex-a`) and launches immediately. Change detection in `ProjectConfiguration.fresh()` compares a `dev:ino:size:mtimeMs:ctimeMs` stamp. With the size unchanged, the change rests on mtime/ctime alone, and the coarse kernel timestamp granularity or a reload racing the non-atomic writeFile may leave the launch on the old roles. Whether the product misses a real edit or only the test races is to be established.

## Acceptance criteria

- [x] C1. The root cause is established and recorded in the commit: either a product defect in roles.toml change detection (fixed, with a regression test that fails without the fix) or a test race (the test waits on an observed reload boundary instead of timing). Every existing assertion stays.
  - done: impl-849 · 2026-10-19T08:22:54.222Z
  - verified: rev-30 [reviewer] · run rev-20261019-849-source · 2026-10-19T08:23:57.881Z · commit 277532f498bbe1c47b495f8866d2c6b6c7f33bf8
  - verified: rev-30 [reviewer] · run rev-20261019-849-final · 2026-10-19T08:34:29.757Z · commit 277532f498bbe1c47b495f8866d2c6b6c7f33bf8
- [x] C2. accounts.test.ts passes 20/20 serially on the Mac, whole file and alone, and the mode-free task verify passes at the reviewed head.
  - done: impl-849 · 2026-10-19T08:34:01.589Z
  - verified: rev-30 [reviewer] · run rev-20261019-849-final · 2026-10-19T08:34:29.757Z · commit 277532f498bbe1c47b495f8866d2c6b6c7f33bf8

## Comments

### impl-849 · 2026-10-19T08:21:44.135Z

Diagnosis: reproducible concurrent freshness defect, not just an unobserved reload boundary in the test. Two fresh() calls started after completed roles.toml codex-b→codex-a write both await the old #work, then stat concurrently; one marks #attemptStamp and queues reload, the other skips without awaiting that publication and observes codex-b. New T2 regression at public ProjectConfiguration fresh/get seam failed 5/5 before the fix with [codex-a,codex-b]. Serialized detection plus #reload fixes it. Original accounts.test.ts assertions remain untouched. Typecheck and config-reload-component.test.ts (5 tests, 4.29s) pass; required 20 serial whole-file plus 20 isolated Mac runs in progress.

### rev-30 · 2026-10-19T08:23:57.881Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-849-source
commit: 277532f498bbe1c47b495f8866d2c6b6c7f33bf8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings. A-5888 records complete two-file audit. fresh queues stamp detection and #reload publication together, so an attempted stamp cannot let a concurrent launch return old roles before publication. Regression captures each caller's account at its own return; A-5885 reports red 5/5 before fix, then green. Commit records product diagnosis; historical A-5860 exact interleaving remains unknown, not retroactively asserted. Existing account assertions and failed-reload last-good pair behavior stay intact. C1 verified; C2 awaits complete 20 whole-file + 20 isolated Mac runs and same-head mode-free gate. Reviewer performed no edits/tests.

Criteria: C1 verified.

### impl-849 · 2026-10-19T08:31:47.252Z

Mac validation complete at 277532f4: accounts.test.ts 20/20 whole-file (all 14 tests each run, median 27.403s; total 550.351s), plus retained Reviewer pool test 20/20 alone (median 1.431s; total 28.871s). Serial runs on macOS 27.0.1 arm64; no failures or skips. Complete log A-5893, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5893-t-849-mac-validation-20-whole-file-and-20-isolated-passes.log. Source review clear rev-20261019-849-source at exact head 277532f498bbe1c47b495f8866d2c6b6c7f33bf8. Mode-free verify admitted as 0d9d2cd7-bf5e-49b6-aa83-d368a2625a28; C2 final mark waits for green same-head result.

### rev-30 · 2026-10-19T08:34:29.757Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-849-final
commit: 277532f498bbe1c47b495f8866d2c6b6c7f33bf8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; no findings. A-5897 audits C2's complete Mac A-5893: 20/20 whole files (14 cases each) plus 20/20 isolated retained-pool runs, all zero fail/cancel/skip/todo. Exact-head mode-free A-5896 / 0d9d2cd7 passes 999/999 (377 T1+622 hub T2), concurrent-fresh regression ordinary-pass and 5/5. Zero tier-mismatch rows; all 235 groups pass 5/5. C1/C2 verified at unchanged 277532f4. Host log lacks embedded SHA; unchanged-head/platform provenance is separately disclosed by Implementer. Linux T3 remains landing evidence; historical exact race not reconstructed. No Reviewer edits/tests.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T10:17:00.069Z

Merged 99e0bdca6881864953f07c814d552fca71b52a2b onto dev.
