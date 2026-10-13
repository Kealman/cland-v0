---
id: T-233
kind: task
title: "cland verify result cache: a green result keyed by the candidate tree,
  reused for the same tree and accepted by the gate"
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1.1
  - ready-for-agent
assignee: impl-233
parent: E-230
blocked_by:
  - T-232
topic: topic-152
branch: t/T-233-cland-verify-result-cache-a-green-result
created: 2026-10-11T17:48:35.341Z
updated: 2026-10-11T21:36:40.414Z
---

## What to build

A result cache for `cland verify`, keyed by the candidate tree (the git tree hash of the head being verified, plus the mode). A green result for a tree is reused when the same tree is requested again: a re-request after a tracker-only dev merge, or a rebase that reproduces the same tree. The merge gate accepts the cached result for that exact tree. Any change in the tree runs again. Cached results expire after a configurable age, and `--fresh` bypasses the cache.

## Acceptance criteria

- [x] C1. The same tree and mode return the cached green result without running, naming the original run; a different tree runs.
  - done: impl-233 · 2026-10-11T20:32:27.703Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-233-1 · 2026-10-11T20:34:50.971Z · commit e4762bc0e01b26a26dee95b1a7b7b0918488af63
- [x] C2. A cache hit posts a result for the requested head that names the original run, its head and the identical tree; that posted result is the suite evidence a reviewer verifies at the new head. The gate is unchanged: criterion marks stay exact-head (T-209), with no cache exception in the gate. Decided by the Coordinator, 2026-10-11 20:23Z.
  - done: impl-233 · 2026-10-11T20:32:27.899Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-233-1 · 2026-10-11T20:34:50.971Z · commit e4762bc0e01b26a26dee95b1a7b7b0918488af63
- [x] C3. `--fresh` and expiry force a run.
  - done: impl-233 · 2026-10-11T20:32:28.111Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-233-1 · 2026-10-11T20:34:50.971Z · commit e4762bc0e01b26a26dee95b1a7b7b0918488af63
- [x] C4. `npm run typecheck && npm test` pass.
  - done: impl-233 · 2026-10-11T21:36:11.696Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-233-1 · 2026-10-11T21:36:25.332Z · commit e4762bc0e01b26a26dee95b1a7b7b0918488af63

## Comments

### impl-233 · 2026-10-11T20:21:34.717Z

Claimed at dev fd57d3e. Read T-232 handover/evidence A-1333, A-1341, A-1355. Using Coordinator-requested public CLI/protocol seam for cache/gate coverage. Plan: candidate tree excludes .cland/tasks so tracker-only merges reuse evidence; mode remains part of the key, cached responses name original run/head, and gate compares candidate trees only for cache evidence.

### impl-233 · 2026-10-11T20:28:19.673Z

Implemented canonical candidate tree (Git private index excluding only .cland/tasks), effective-mode cache, original completion age, --fresh, durable per-request cached reports and original run/head provenance. Green cache, tracker-only dev integration, dirty/staged/untracked bypass, expiry/fresh, restart/mode/failure and unchanged exact-head merge gate regressions pass individually; typecheck passes. Running broader protocol regressions next. Coordinator decision 1cc5ed0c is implemented: no gate changes or criterion tree-equivalence.

### rev-18 · 2026-10-11T20:34:50.971Z

verdict: review
result: clear
by: rev-18 [reviewer]
run: rev-18-20261011-233-1
commit: e4762bc0e01b26a26dee95b1a7b7b0918488af63

No high or medium findings. Reviewed canonical tree/effective-mode identity, conservative cache eligibility, dirty/subdirectory isolation, fresh/expiry, original completion/provenance and durable hit publication. Coordinator's C2 contract is followed: gate/criterion production code is unchanged; real cache/gate regression refuses stale marks until exact-head reviewer verification. C1–C3 verified; C4 awaits the exact-head full suite. Standards/Spec evidence: A-1376 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1376-t-233-review-at-e4762bc-c1-c3-clear-c4-pending.md).

Criteria: C1 verified, C2 verified, C3 verified.

### impl-233 · 2026-10-11T20:35:33.280Z

Pushed clean e4762bc0e01b26a26dee95b1a7b7b0918488af63. Final origin/dev fetch/merge remains up to date at fd57d3e. C1–C3 reviewed/verified clear by rev-18 (A-1376); final protocol file 40/40 passes (A-1377), gate regressions 2/2 (A-1372), init 13/13 (A-1373), typecheck/diff pass. Final full suite b6fd2b28-5466-4a3e-a8f6-fb549ef2d5be submitted after review request, worker PID 31859, queue position 4, reports to topic-152/rev-18/impl-233. C4 remains pending; retaining claim and head stable while idle for hub result.

### impl-233 · 2026-10-11T21:36:11.835Z

C4 done: final suite b6fd2b28-5466-4a3e-a8f6-fb549ef2d5be at unchanged clean/pushed e4762bc0e01b26a26dee95b1a7b7b0918488af63 exits 0. Durable log A-1397: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1397-suite-b6fd2b28-5466-4a3e-a8f6-fb549ef2d5be-all-at-e4762bc.log. Typecheck passes; hub 1282/1282 and Neovim 287/287, total 1569/1569, zero failed/cancelled/skipped/todo. C1–C3 already verified at this exact head; rev-18 requested for final C4 verification. Claim retained pending readiness/merge.

### coord · 2026-10-11T21:36:40.414Z

Merged badc088f5136c9b5ba726d87499906b352f83fed onto dev.
