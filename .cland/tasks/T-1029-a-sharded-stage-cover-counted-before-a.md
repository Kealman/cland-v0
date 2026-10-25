---
id: T-1029
kind: task
title: A sharded stage cover counted before a hub restart is lost after it
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1281
blocked_by: []
topic: topic-1061
branch: t/T-1029-a-sharded-stage-cover-counted-before-a
created: 2026-10-20T20:41:07.527Z
updated: 2026-10-25T17:43:05.479Z
closed: 2026-10-25T17:43:05.479Z
---

## Summary

A sharded Linux stage cover counted before a hub restart is lost after it. Stage cover 918b2a95 (2 droplet shards, green, A-8040) completed at 20:35:16Z on 2026-10-20 and the hub reported "stage cover complete (Linux droplet, macOS)" at tree 60732b92; after hub restart #35 at 20:36Z, `task plan show` for E-1006, E-789 and E-412 reports "stage cover missing Linux droplet" at the same tree, while the unsharded macOS cover 53af0d11 is still counted. QA's stage verdict for E-1006 was then recorded current:false and the stage stayed open, so the Linux cover had to run again (about 30 minutes and a droplet pair).

## What to build

Persist the merged result of a sharded close run (stage, epic, release) as a durable cover record at completion, as for unsharded runs, and restore it on hub start. Check whether T-1025's cover/receipt changes (Web phase fields) affect how stored receipts are read back.

## Acceptance criteria

- [x] C1. A green two-shard stage cover recorded before a hub restart still counts after it (test with two hub starts).
  - done: impl-1029 · 2026-10-25T17:16:21.456Z
  - verified: rev-34 [reviewer] · run rev-34-20261025-1029-final · 2026-10-25T17:35:31.046Z · commit fdac373eef93ae4162d036a762c6bffb1986f2df
- [x] C2. A stage QA verdict recorded after the restart is current when both covers exist (test).
  - done: impl-1029 · 2026-10-25T17:16:21.533Z
  - verified: rev-34 [reviewer] · run rev-34-20261025-1029-final · 2026-10-25T17:35:31.046Z · commit fdac373eef93ae4162d036a762c6bffb1986f2df

## Comments

### coord · 2026-10-20T20:53:07.127Z

Update 2026-10-20 20:53Z: the loss was transient. Right after restart #35 (20:36Z) plan show reported 'stage cover missing Linux droplet' for all three stages and E-1006's QA verdict was recorded current:false; by 20:52Z the original sharded cover 918b2a95 counted again (E-789 closed on it, E-1006 re-evaluated to closed). The redundant rerun 571c4631 was cancelled. Remaining defect: for some minutes after a restart the hub reports a recorded sharded cover as missing, and a verdict recorded in that window is stored current:false; find whether covers load lazily after start and make plan show and verdict recording wait for or read the stored record.

### impl-1029 · 2026-10-25T17:11:41.834Z

Diagnosis: clean inherited worktree at 871fc363. Triaged lines synchronously restore suite-job history; T-1049 (7c153e51) already added pending ancestry handling and two-hub-start seeded cover coverage. Adding a live two-shard completion/recovery regression to distinguish an actual persistence defect from this earlier fixed tracker freshness defect. No shared wire/schema/permission change planned.

### impl-1029 · 2026-10-25T17:16:21.400Z

C1/C2 are covered by two new T2 regressions. Unchanged product code already passes; T-1049 (7c153e51) fixed pending restored cover/QA currency. A-12042 records the diagnosis, red mutation controls and excluded exploratory results. Local macOS at base 871fc363 + test diff: suite-close-component.test.ts 12/12 (new restart case 0.704 s; final bounded-setup repeat 1.000 s); stage-closure-component.test.ts 7/7 (new post-restart QA case 0.211 s); root npm run typecheck and closed-item wording lint pass. No browser, native worker or real provider ran. No command/policy/schema/wire/permission changes: rule 16 public docs/help/skill/role behavior remains accurate; file-specific test guidance added. QA policy none after-stage, no per-item QA brief required. Source review and mode-free Linux verification remain.

### rev-34 · 2026-10-25T17:21:38.799Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1029-source1
commit: fdac373eef93ae4162d036a762c6bffb1986f2df
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear at correctedfdac373e; A-12050 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12050-t-1029-full-source-review-at-fdac373e.md). PreliminaryM1 resolved: restarted clients/spoke now share setup.fixtures resource owner before hub/root cleanup. C1 retains actual two-shard scheduler completion, exact original cached run after second start, Linux cover report and no extra provider creates. C2 retains legacy two-platform shape, held product tree read, post-restart authenticated QA unknown→current and no prior closure shortcut. Mutation controls correctly distinguished from current-product reproduction; T-1049 already fixed behavior, no production change. Local12/7case/static reports retain source/platform limits. C1/C2 remain unverified pending same-head configured evidence; QA none.

### impl-1029 · 2026-10-25T17:33:39.803Z

Same-head configured verify 8e1ff102 / A-12059 passed at fdac373e on Linux x64 droplet c-8 lon1 (Node v24.21.0, Neovim v0.12.5; Web Chrome Headless Shell 156.0.8078.4/v1248): 3239/3239, T0 + all T1 + fallback all T2 + Web. T3/T4 did not run; periodic/integrated coverage deferred. Duration/test lint report-only. Generated cases: hub/test/suite-close-component.test.ts::a reported two-shard Linux stage cover counts on the first run after hub restart: base 0.950 s + 5/5 load pass (max 1.139 s). hub/test/stage-closure-component.test.ts::stage QA recorded after restart stays pending then current with restored two-platform covers: base 0.350 s + 5/5 load pass (max 0.393 s). No >=3 s new case; no duration allowance needed. Evidence review requested; source head unchanged and worktree clean.

### rev-34 · 2026-10-25T17:35:31.046Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1029-final
commit: fdac373eef93ae4162d036a762c6bffb1986f2df
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; Standards and Spec clear, no findings. A-12062 audits raw A-12059/run 8e1ff102: 3239 ordinary passes plus 10 separate load passes, no fail/cancel/skip/todo. C1 exact two-shard first-run-after-restart regression and C2 pending-to-current post-restart QA regression each pass ordinary + 5/5 load; maxima 1.138786369 s and 0.392740086 s. Host T0; Linux droplet T1/all-T2 fallback/Web complete. T3/T4 and stage QA did not run; report-only budget/lint diagnostics retained. Scripted provider/shard fixtures do not claim real provider execution. Isolated Chrome Headless Shell 156.0.8078.4/build1248 for Web. Source A-12050 unchanged. C1/C2 verified.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T17:43:05.479Z

Merged 0b75729b4d3ec701a1735b45febc35a0671ece7c onto dev.
