---
id: T-1809
kind: task
title: login-snapshots ten-thousand-login budget case slowed by T-1784's capacity index and triggers
state: open
status: ready
size: S
criterion_seq: 3
labels: []
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1784
topic: topic-1683
branch: t/T-1809-login-snapshots-ten-thousand-login
created: 2026-11-11T02:13:21.099Z
updated: 2026-11-20T18:23:37.815Z
---

## Summary

`hub/test/login-snapshots.test.ts::one login save has bounded scheduling work across ten thousand retained logins` went over its 5 s hard limit on the periodic dev T3 run 20d0d38d at 9ae466067 (5.425 s on Linux, log A-18558; the previous green aca1a4ffb measured 2.141 s, A-18540). Local macOS timing bisects the slowdown to T-1784 (e14c3bf6d): 0.74 s at aca1a4ffb, 1.21 s at e14c3bf6d, unchanged after. The assertions on one save's bounded work still pass; the extra time is the fixture's 10,000 inserts and transitions, which now maintain the partial `login_capacity_launch` index and the `pending_bindings` triggers.

## What to build

Make the case's setup cost proportionate again, without weakening what it proves about one save. Measure where the time goes first (seeding vs the two positive-control `list()` decodes vs the traced save), then either seed the retained history through a cheaper path that still produces real index and trigger state, or show that per-write maintenance is the cost and record it in docs/hub/logins.md. Remove the temporary duration allowance coord adds for this key once the case is back under budget.

## Acceptance criteria

- [x] C1. The case's per-phase timing (seed, positive controls, traced save) at the fix head is recorded in an item comment, with the macOS before/after figures above as baseline.
  - done: impl-1809 · 2026-11-20T17:44:08.777Z
  - verified: rev-40 [reviewer] · run rev-40-20261120-1809-source · 2026-11-20T17:45:24.833Z · commit 5c679537f54a32514da391565fcf9766f80cdb54
  - verified: rev-40 [reviewer] · run rev-40-20261120-1809-final · 2026-11-20T18:23:37.170Z · commit 5c679537f54a32514da391565fcf9766f80cdb54
- [x] C2. The case runs under 2 s on macOS and its allowance entry is removed from hub/test/durations.json, or the comment explains why the per-write cost is inherent and the allowance is re-sized from measured samples.
  - done: impl-1809 · 2026-11-20T17:44:09.817Z
  - verified: rev-40 [reviewer] · run rev-40-20261120-1809-final · 2026-11-20T18:23:37.170Z · commit 5c679537f54a32514da391565fcf9766f80cdb54
- [x] C3. The case's bounds on decoded rows, query count and indexed plans for one save are unchanged.
  - done: impl-1809 · 2026-11-20T17:44:10.889Z
  - verified: rev-40 [reviewer] · run rev-40-20261120-1809-source · 2026-11-20T17:45:24.833Z · commit 5c679537f54a32514da391565fcf9766f80cdb54
  - verified: rev-40 [reviewer] · run rev-40-20261120-1809-final · 2026-11-20T18:23:37.170Z · commit 5c679537f54a32514da391565fcf9766f80cdb54

## Comments

### impl-1809 · 2026-11-20T17:39:37.817Z

Measured local macOS arm64, Node v24.21.0, original prepared dev tree with diagnostics: case 2647.600 ms, seed 2138.006 ms / 40000 writes, two positive-control list decodes 71.032 ms, traced save 1.953 ms. Deterministic regression failed: `history seed used 40000 writes for 10000 final rows`. Historical baseline from brief: aca1a4ffb 0.74 s; T-1784 e14c3bf6d 1.21 s. Optimized candidate: exact case 1154.209 ms (seed 219.849 ms, controls 124.820 ms, save 2.395 ms); full 29/29 T2 file passed with budget case 961.808 ms (seed 179.656 ms, controls 115.105 ms, save 2.280 ms). Each phase excludes schema creation, scheduler startup and cleanup; case time includes those. Fixture uses prepared final-state inserts with production schema/indexes/triggers intact, verifies capacity membership and pending-trigger increment/decrement. Save assertions unchanged: <=8 decoded rows, <=12 queries, nonempty indexed plans without scan/temp sort; observed 3 rows/7 queries. Removed this case's temporary duration allowance. No production code, shared contracts, CLI text, runtime policy, tier or test name changes; retained duration baseline unchanged. Exact fix-head confirmation to follow after lint/typecheck and commit.

### impl-1809 · 2026-11-20T17:43:56.106Z

C1/C2 fix-head confirmation at 5c679537f54a32514da391565fcf9766f80cdb54, local macOS arm64 Node 24.21.0: case 1438.307 ms; seed 255.985 ms (10000 writes), both positive controls 140.807 ms, traced save 5.485 ms. Ambient 1-minute load 11.51, ordinary single-file run, no deliberate load generator. Phases exclude schema, scheduler startup and cleanup; case includes these. Previous baseline and candidate samples are in preceding comment. Still 3 decoded rows/7 queries, indexed plans, original bounds unchanged. Full npm run test:lint and npm run typecheck passed; seven affected T1 duration-manifest files passed 194/194; complete T2 login-snapshots file passed 29/29 before commit with identical source. No Linux, full suite, other T2, T3/T4 or Web receipt claimed. Known report-only site advisory T-1910; allowance removed and duration policy stays report-only.

### rev-40 · 2026-11-20T17:45:24.833Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1809-source
commit: 5c679537f54a32514da391565fcf9766f80cdb54
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source review clear at 5c679537f54a32514da391565fcf9766f80cdb54. Standards: no findings. Spec: no findings. Prepared final-state fixture keeps real schema/indexes/triggers, explicit capacity membership and pending-trigger receipts; original save bounds and positive controls unchanged. C1 exact-head phase measurements and baseline recorded in comments; C3 established by source diff. Allowance removal confirmed; C2 and final run-dependent clearance await same-head cland verify. A-22187 supplies partial local macOS arm64 Node 24.21.0 timing evidence (1.438 s exact case), not full verification. Reviewer ran no tests/browser.

Criteria: C1 verified, C3 verified.

### rev-40 · 2026-11-20T17:54:54.004Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261120-1809-evidence1
commit: 5c679537f54a32514da391565fcf9766f80cdb54
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Evidence incomplete, not clear. Exact-head run dbe6b506-c007-4cb7-8764-a98ba7278221 (A-22200) producer result cancelled/exit143: `Finished: exit 143; worker interrupted by SIGTERM`; check command receipt exit1. No new source finding or criterion failure inferred from cancellation; C1/C3 source proofs retained and C2 stays unverified. Provenance: head5c679537f54a32514da391565fcf9766f80cdb54 treee056ef3a4a331c80216c64270d7bed57ea570ddf, local darwin arm64 Node24.21.0. Typecheck/build output completed; configured check did not pass. T1/T2 tests0, observations unavailable; T3/T4/Web unexecuted, browser binary/version null. Report-only advisories are not classified as the failure cause. Need completed successful unchanged-head verification before final clearance; no edit or dev merge requested.

### impl-1809 · 2026-11-20T18:23:18.269Z

Completed exact-head verification 43e76b14-411f-4e56-bd51-626ba5004fe6 / A-22212 at 5c679537f (tree e056ef3a4a331c80216c64270d7bed57ea570ddf): exit 0; 7127/7127 tests passed, no fail/cancel/skip. T0 host check passed; T1/T2/Web completed on droplet Linux x64 6.8.0-149-generic, Node v24.21.0, Neovim v0.12.5; Chrome Headless Shell 1248, Google Chrome for Testing 156.0.8078.4. T3 deferred to merge batch, T4 not run. Budget policy report-only; unrelated advisory overages remain, not new failures. Budget case's structured finish receipt records pass at 1.368382281 s; seed 205.683 ms / 10000 writes, positive controls 201.496 ms, traced save 1.223 ms. Same phase exclusions as earlier comments. Droplet c-8 ams3 cland-v0-c0cc5a82, lifetime 1358 s, reported cost $0.0943. Earlier local run dbe6b506 / A-22200 was Coordinator-cancelled exit143 before runtime tests and remains separate evidence, not a passing receipt. Final same-head evidence settlement awaits responsible Reviewer.

### rev-40 · 2026-11-20T18:23:37.170Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1809-final
commit: 5c679537f54a32514da391565fcf9766f80cdb54
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged5c679537f54a32514da391565fcf9766f80cdb54. Independently inspected A-22212 run43e76b14-411f-4e56-bd51-626ba5004fe6: producer pass7127/7127, no failed/cancelled/skipped; T0/T1/fallback-all-T2/Web exit0, T3 deferred batch, T4 unexecuted. Head/tree match reviewed source (treee056ef3a4a331c80216c64270d7bed57ea570ddf), no cache. C2 combines exact-head recorded local macOS arm64 Node24.21 sample1438.307ms (A-22187/item comment; under2s) with confirmed allowance removal and successful configured verification. Linux exact generated budget identity passes1.368382281s; seed205.683ms/10000writes, controls201.496ms, save1.223ms. Linux timing is separate from macOS proof; phase timings exclude schema/startup/cleanup while case includes them. C1/C3 source proofs retained. Droplet c-8 ams3 Linuxx64 6.8.0-149-generic Node24.21.0 workers2; Web Headless Shell1248, Chrome for Testing156.0.8078.4. Host gate at admitted tree, not repeated remotely; budgets report-only. Earlier dbe6b506/A-22200 remains cancelled/exit143/unexecuted, not counted as a passing round; replacement independently passes. Reviewer ran no tests/browser; no new source findings.

Criteria: C1 verified, C2 verified, C3 verified.
