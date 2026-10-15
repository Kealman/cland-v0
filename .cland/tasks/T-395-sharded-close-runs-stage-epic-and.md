---
id: T-395
kind: task
title: "Sharded close runs: stage, epic and release integrated runs shard the hub phase across droplets within the $3/day cap, balanced by recorded durations, with one merged report"
state: open
status: review
size: L
criterion_seq: 8
labels:
  - v0.1.3
  - hub
  - ready-for-agent
assignee: null
parent: E-387
blocked_by:
  - T-390
  - T-347
topic: topic-274
branch: t/T-395-sharded-close-runs-stage-epic-and
created: 2026-10-14T12:28:19.467Z
updated: 2026-10-15T08:35:00.010Z
---

## Summary

A c-8 droplet runs the hub phase in about 1,257 s, 1.55 times the Mac. Split across droplets, a full run's wall time drops to the slowest shard plus about 150 s of provisioning and typecheck. By the human's decision (b) of 2026-10-14 12:20Z, only stage, epic and release runs shard, within the $3/day cap. Ordinary integrated batch runs stay on one slot. This ticket adds the occasion on the Coordinator's integrated request, the balanced split, Neovim on the lightest shard, one merged report and the cap check. It also splits `suite.test.ts` and `merge.test.ts` so that no single file is a shard's floor.

## Parent

"Test speed: structural" (R-294), tracer bullet 3; research #8 (`docs/research/test-speed.md` §3.6, §3.10 "Split `suite.test.ts` and `merge.test.ts`"). **Decided (b), 2026-10-14 12:20Z:** sharding applies only to stage, epic and release runs, within $3/day, and batch runs stay on one slot. Needs E-271's executor and T-347's remote budget. Balancing reads `hub/test/durations.json` from quick-03.

## What to build

**The occasion.** `cland verify all --occasion stage|epic|release` (and the same field on the MCP verify request). The Coordinator may set it on an integrated `dev` request; QA may set `epic` for an epic demo run on `dev`. The hub refuses it from any other role, and on any head that is not integrated `dev`, naming the rule. Only a request with an occasion shards. The occasion is recorded on the job and shown in `cland verify queue` and the result.

**The split.**

- The shard count is the free remote slots at admission, up to `[verification] shards` (default 2, this project's `remote_budget`).
- Files go largest first onto the lightest shard, using `durations.json` `files[*].seconds`. Unknown files count as the manifest's median.
- The Neovim phase goes onto the shard with the least hub time, as part of its balance. No extra droplet runs and no local load is added.
- Each shard runs on its own droplet through E-271's executor, with `CLAND_SUITE_SELECTION` naming its files. `hub/src/suite-shards.ts` and `hub/test/run-suite.ts` accept an explicit file list for a shard, keeping the free/machine resource classes inside it.

**The cap.** Before admission the hub reserves every shard's estimated cost against the day's spend ledger (`~/.cland/executor/spend.json`, the $3/day cap). If any reservation would pass the cap, or fewer than two remote slots are free, the run goes whole to one slot. It posts a warn-level notice naming the cause (`sharding skipped: daily spend cap $3 would be exceeded` / `fewer than 2 remote slots free`). It never runs partially sharded and never silently.

**One merged report.** One result per run, with these parts:

- the counts summed across shards;
- the failures with their shard;
- one `shard duration` line per shard with its machine, size, time and cost;
- the total cost;
- the overall wall time, from admission to the last shard collected.

A failed or lost shard fails the run once, naming the shard. The hub does not rerun the shard on its own. The receipt, the artifact (one log per shard plus the merged summary) and the tree-hash cache behave as for an unsharded run. A cache hit for the same tree and mode serves a later sharded request.

**The file splits.** `hub/test/suite.test.ts` (61 tests, 242 s) and `hub/test/merge.test.ts` (40 tests, 182 s) split by theme into files of at most 60 s each in the manifest, with `shards.json` and `durations.json` updated.

**Real check** (the Implementer, under D27/D28): one sharded `--occasion stage` run on a scratch project's copy of `dev` with two c-8 droplets, with create, destroy and cost posted on the item.

## Acceptance criteria

- [x] C1. Only an integrated `dev` request with `--occasion stage|epic|release` from the Coordinator (or `epic` from QA) shards; other roles, task heads and batch runs are refused or run on one slot, proven by tests against the fake DigitalOcean API.
  - done: impl-395 · 2026-10-15T07:59:04.864Z
- [x] C2. Files are split largest-first by `durations.json`, the Neovim phase goes to the lightest shard, and a test proves the balance on a fixture manifest.
  - done: impl-395 · 2026-10-15T07:42:02.736Z
  - verified: rev-26 [reviewer] · run rev-20261015-395-source-2 · 2026-10-15T08:00:52.613Z · commit f3346d60b4ded82a109a0f2dc4165f3ee88f8154
- [x] C3. When the shards' reservations would pass the daily cap or fewer than two remote slots are free, the run goes whole to one slot with one warn-level notice naming the cause, proven by tests.
  - done: impl-395 · 2026-10-15T07:59:06.045Z
- [x] C4. A sharded run posts one result with summed counts, per-shard duration, machine and cost lines and the total cost; a failed shard fails the run once naming the shard.
  - done: impl-395 · 2026-10-15T07:59:07.412Z
- [x] C5. `suite.test.ts` and `merge.test.ts` are split into files of at most 60 s each in `durations.json`, with every test kept and its assertions unchanged.
  - done: impl-395 · 2026-10-15T07:42:04.045Z
  - verified: rev-26 [reviewer] · run rev-20261015-395-source-2 · 2026-10-15T08:00:52.613Z · commit f3346d60b4ded82a109a0f2dc4165f3ee88f8154
- [x] C6. A real two-shard c-8 `--occasion stage` run of `dev` is executed by the Coordinator from the procedure A-2727 after this ticket merges, as E-387's stage-1 close run once T-393 has also merged; it posts create, destroy, each shard's time and the cost, and its wall is judged against 10 minutes there (Coordinator amendment 2026-10-15 07:37Z: the 10-minute bound depends on T-393's in-process hub). Pre-merge, this criterion is met by the procedure and a fake-provider two-shard run proving the same report fields.
  - done: impl-395 · 2026-10-15T07:42:04.484Z
  - verified: rev-26 [reviewer] · run rev-20261015-395-source-2 · 2026-10-15T08:00:52.613Z · commit f3346d60b4ded82a109a0f2dc4165f3ee88f8154
- [x] C7. The real check's spend stays within the shared $3 daily cap and the provider's `cland` tag listing is empty afterwards, recorded on E-387 with the stage-1 close run; pre-merge, the fake-provider run proves the all-shard reservation, the cap refusal and the zero-tag teardown.
  - done: impl-395 · 2026-10-15T07:42:04.916Z
  - verified: rev-26 [reviewer] · run rev-20261015-395-source-2 · 2026-10-15T08:00:52.613Z · commit f3346d60b4ded82a109a0f2dc4165f3ee88f8154
- [x] C8. `hub/README.md` (Remote executors, Tests), `docs/agents/tests.md`, the Coordinator and QA clauses and the `merge` and `qa` skills describe `--occasion`, which runs shard, the cap fallback and the cost per run.
  - done: impl-395 · 2026-10-15T08:34:43.011Z

## Comments

### impl-395 · 2026-10-15T07:07:43.833Z

Implementation started in task worktree. Test boundaries: existing verify frame/CLI with fake DigitalOcean for admission, fallback and result semantics; explicit fixture manifest for balancing. C6/C7 delegated by role clause to Coordinator real check, steps to follow with reviewed build.

### impl-395 · 2026-10-15T07:42:57.326Z

Implementation pushed at 994131b88b18884a1c29c835e27960683f5478c2 after merging origin/dev 9ec1da30. All 18 touched/new targeted files pass serially (131 Node tests including nested cases); typecheck, shard lint and diff checks pass. Exact split mapping A-2722 preserves 110 top-level identities plus nested test bodies unchanged. Final fake-provider proofs: A-2734 (admission/reservation/cap/MCP/cache/zero-tag teardown), A-2735 (failed/lost shards, actual hub restart, parent cancellation). C1-C8 marked done; amended C6/C7 use these proofs and Coordinator-only procedure A-2727, with the real two-c-8 <=10-minute check owed on E-387 stage-1 close after both T-393 and T-395 merge. Source review requested next; no pre-review full verification run and no real droplets created here.

### rev-26 · 2026-10-15T07:50:33.737Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261015-395-source-1
commit: 994131b88b18884a1c29c835e27960683f5478c2
scope: full

Medium — hub/src/hub/suites.ts:374: cancellation can finish/report the queued group while reserveShards awaits provider sizes; late placeholders then survive completion and consume the daily budget (C3/C4).
Medium — hub/src/hub/suites.ts:221: origin/dev equality accepts stale tracking data after selectPackageSuite catches a failed fetch; fresh integrated-dev proof is not established (C1).
Medium — hub/src/roles/default-roles.ts:58 and .cland/roles.toml:46: the project Coordinator clause is 7,764 bytes before wrapping, beyond the unchanged 7,680-byte complete-reply headroom limit (C8).
Evidence and separate Standards/Spec assessment: A-2743, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2743-t-395-source-not-clear-at-994131b8-reservation-cancellation-fresh-fetch-and-clau.md. All original 102 top-level statements (110 expanded cases) and extracted helpers are byte-preserved; split-file manifest times are <60s. Fake admission/recovery logs pass 5/5 and 4/4. C6/C7 use the amended premerge scope; real two-c-8 <=10m proof remains E-387 stage-1-close work, not completed evidence. No tests run by Reviewer.

Criteria: C1 failed (Occasion admission accepts failed fetch proof when stale origin/dev still equals local dev.), C3 failed (Cancellation during provider sizes can complete before group spend reservation, leaving late placeholders permanently reserved.), C4 failed (Parent cancellation can report before its in-flight group reservation is settled.), C8 failed (Added Coordinator clause exceeds the unchanged 7680-byte complete-reply headroom bound.).

### impl-395 · 2026-10-15T07:59:09.540Z

Replacement source pushed at f3346d60b4ded82a109a0f2dc4165f3ee88f8154 after merging origin/dev 74cddcdd. A-2747 records red→green actual frame/provider reservation cancellation and Git/MCP stale-fetch regressions, plus 80 passing tests in the four affected full files run serially. Both new tests <5s; close/recovery files <60s. Entire planning window now defers collection/reporting until reservation settles; admission requires successful fresh-fetch dev proof. Both Coordinator clauses fit unchanged complete-reply bound (7578/7629 <=7680); role assertions/tests untouched. Typecheck, shard lint and diff check pass. Requesting replacement source review; no verification run before that verdict.

### rev-26 · 2026-10-15T08:00:52.614Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261015-395-source-2
commit: f3346d60b4ded82a109a0f2dc4165f3ee88f8154
scope: full

No high or medium source findings remain. hub/src/hub/suites.ts:362 guards the entire planning await window against premature cancelled reporting; hub/src/hub/suites.ts:222 requires explicit successful fetched-dev provenance. Real frame/provider and Git/MCP red→green regressions cover both previous failures. hub/src/roles/default-roles.ts:58 and .cland/roles.toml:46 now fit the unchanged complete-reply headroom tests while preserving canonical review/QA, human requests and exact-head/cache wording. A-2747 records 80/80 tests across four complete affected files, typecheck and shard lint. Original split tests/helpers remain unchanged.
Source-established criteria C2,C5,C6,C7,C8 are verified; C1,C3,C4 execution settlement and final verdict await accepted same-head verification. C6/C7 use the explicit premerge amendment: procedure A-2727 and fake report/reservation/cap/zero-tag proof; real two-c-8 <=10-minute assessment remains the Coordinator's E-387 stage-1 close obligation after T-393/T-395 merge. No tests run by Reviewer.

Criteria: C2 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### rev-26 · 2026-10-15T08:25:48.293Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261015-395-evidence-1
commit: f3346d60b4ded82a109a0f2dc4165f3ee88f8154
scope: evidence

Medium — hub/test/tracker-container-source.test.ts:129: six new epic occasion literals conflict with the categorical architecture guard. Distinguish the required operational enum narrowly while preserving tracker Kind rejection; do not cast/widen to evade the guard.
Medium — hub/test/resilience.test.ts:42/104, hub/test/spoke-identity.test.ts:18, hub/test/surface.test.ts:16: four exact inventories omit the new required verify tool (38 vs 37 / array mismatch); preserve behavior assertions and explicitly add the tool.
Medium — hub/src/roles/default-roles.ts:69 / .cland/roles.toml:57: compact wording breaks unchanged surface.test.ts:75 canonical Coordinator decision-routing sentence. Previous source pass missed this assertion; C8 failed.
Medium — hub/test/claude-code-sessions.test.ts:251: retry-injection case times out waiting for clause injection; separate attribution pending.
A-2770 exact-head full receipt 14e7a2bc exits 1: 1733 tests, 1723 pass, 7 fail, 3 platform skips; Neovim not reached. Reported c-8 lifetime 1326s, cost $0.0921, peak load 14.45. C1/C3/C4 remain unverified; C2/C5/C6/C7 source marks retained under the explicit premerge scope. Corrected-head source review is required before another verification.

Criteria: C8 failed (Compacted Coordinator decision-routing sentence breaks unchanged surface.test.ts:75 canonical wording guard; restore both copies within reply headroom.).

### impl-395 · 2026-10-15T08:34:47.118Z

Corrected head e9e6fab93d101114eff353ed98f60e765824895c pushed after merging origin/dev 3d300562, with the duration refresh reconciled through all110 mapped identities. A-2782:44 serial targeted tests pass, plus typecheck/shard lint. Six attributable A-2770 guards fixed without weakening canonical wording or tool checks; operational enum declaration has a narrow compiler exception with positive/negative Kind fixtures. Cache recovery re-split preserves byte-identical statements, final110-identity audit A-2776; Linux file totals42.84s/25.63s. Requesting source re-review. T-447's separate injection-timeout fix will be integrated from Coordinator's named merge commit before verification.
