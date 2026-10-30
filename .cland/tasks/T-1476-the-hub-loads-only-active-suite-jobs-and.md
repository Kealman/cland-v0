---
id: T-1476
kind: task
title: The hub loads only active suite jobs and summaries at startup
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1466
blocked_by: []
topic: topic-1224
branch: t/T-1476-the-hub-loads-only-active-suite-jobs-and
created: 2026-10-30T07:54:04.502Z
updated: 2026-10-30T11:42:02.436Z
---

## Summary

At startup the hub reads every archived suite job from hub.db (3,308 rows, 885 MB on this project) and JSON-parses and keeps them all, about 2.5–2.7 GiB of startup heap (A-14160, `Store.suiteJobHistory` store.ts:739, Suites constructor suites.ts:252–257). Load only active and recoverable jobs plus indexed summaries at startup, read an archived job in full only by id, and stop retaining the original JSON strings.

## Acceptance criteria

- [x] C1. Hub startup reads only active or recoverable suite jobs in full, and bounded summary rows for finished ones. A finished job's full record is read by id on demand, and every existing consumer of suite history (selection, durations, culprit search, reports, `verify queue`, web and Neovim views) is listed in the item and migrated or shown unaffected (rule 20).
  - verified: rev-32 [reviewer] · run rev-20261030-1476-evidence2 · 2026-10-30T09:28:03.663Z · commit c51f9984b2c2fe4025c206b08d3733ed1c8af09e
  - done: impl-1476 · 2026-10-30T10:57:25.667Z
- [x] C2. The decoded jobs no longer retain their source JSON strings alongside the parsed objects.
  - done: impl-1476 · 2026-10-30T08:08:53.653Z
  - verified: rev-32 [reviewer] · run rev-20261030-1476-source2 · 2026-10-30T08:23:24.478Z · commit ce11b0942526737921343413b4dff3e2e202d81f
  - verified: rev-32 [reviewer] · run rev-20261030-1476-source3 · 2026-10-30T08:41:43.378Z · commit c51f9984b2c2fe4025c206b08d3733ed1c8af09e
  - verified: rev-32 [reviewer] · run rev-20261030-1476-evidence2 · 2026-10-30T09:28:03.663Z · commit c51f9984b2c2fe4025c206b08d3733ed1c8af09e
  - verified: rev-32 [reviewer] · run rev-20261030-1476-delta1 · 2026-10-30T09:30:31.107Z · commit 2bc3f440505648792e05b2ec1a017fa76f01d721
  - verified: rev-32 [reviewer] · run rev-20261030-1476-delta2 · 2026-10-30T10:17:42.619Z · commit d51049e4722eb33d2fb4ae60925becfcdaafeb86
  - verified: rev-32 [reviewer] · run rev-20261030-1476-delta3 · 2026-10-30T10:58:36.784Z · commit d45333e0537c8cc0be8a490c5fb726295207dc24
- [x] C3. On a T-1467-style scratch copy of this project, the startup heap after the suite-history stage drops by at least 2 GiB against A-14160's 3,567 MiB checkpoint, with the same probe and machine, and the per-stage table is published.
  - done: impl-1476 · 2026-10-30T08:08:54.200Z
  - verified: rev-32 [reviewer] · run rev-20261030-1476-evidence2 · 2026-10-30T09:28:03.663Z · commit c51f9984b2c2fe4025c206b08d3733ed1c8af09e
- [x] C4. A test with a synthetic history of at least 3,000 large finished jobs asserts a bounded number of rows and bytes read at startup (a work-count guard, rule 23).
  - done: impl-1476 · 2026-10-30T08:08:54.661Z
  - verified: rev-32 [reviewer] · run rev-20261030-1476-evidence2 · 2026-10-30T09:28:03.663Z · commit c51f9984b2c2fe4025c206b08d3733ed1c8af09e

## Comments

### impl-1476 · 2026-10-30T07:57:05.401Z

Consumer inventory before changing internal archive reads: Store.suiteJobHistory -> Suites constructor, releaseT3Cover, heartbeatDigest; Suites jobs -> cache selection, stage/landed proof identities, periodic dev/soak anchoring, stageCovers, covers, latest item/branch cards, receipt/evidence and culprit/batch diagnosis, status/history, recentStatus and queue durations/ETA. Wire consumers remain unchanged via explicit full status history projection: hub status/verify queue CLI, web sessions/task views and Neovim suite views. Fixtures/persisted readers: suite-unit-fixture, suite-persistence, suite.test, heartbeat-digest, executor-liveness, hub-status-component, startup-replies-scale, release-cover-fixture, scenarios/droplet-verify. Manual measurement readers: measure-startup and measure-freshness. Legacy suite-job:* and suite-jobs storage will remain readable; legacy suiteJobHistory retained for explicit full-history fixture consumers. Measurement script written first: hub/scripts/measure-suite-history.ts. Full rg inventory recorded locally; final design/evidence artifact will document migration details.

### rev-32 · 2026-10-30T08:14:28.871Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261030-1476-source1
commit: 8fcc6189c2838ba2930c056c1fa753b8a841daf0
scope: full
findings: [{"severity":"medium","text":"M1: Preserve the unchanged test-docs contract. The new H1 '# Suite persistence' fails the required '# hub/test/suite-persistence.test.ts' path heading. The added index row also uses a plain test path and Guide label instead of the exact linked-path/Notes row asserted by that guard. Reproduce red and green through the unchanged guard and correct only the owning document/row.","file":"docs/agents/tests/hub-test-suite-persistence.test.ts.md","line":1},{"severity":"medium","text":"M2: Do not hydrate the entire archive for internal status searches. status() now calls #full on every historical job, while MergeBatches.#tick and DevT3Probe.probe call status().find/some to locate individual runs. A retained batch runs this at startup and on its one-second timer, repeatedly decoding the full archive. Migrate internal consumers to summary/index or exact-ID APIs; retain explicit full-history wire compatibility and add large-history work-count controls at batch/probe boundaries.","file":"hub/src/hub/suites.ts","line":1521},{"severity":"medium","text":"M3: Preserve legacy timing repair for archived summary rows. The new early continue skips the existing started/PID admission estimate and completedAt/runMs/waitMs backfill at lines 287–295. Reported/cleaned legacy archives missing those fields now lose queue statistics/ETA history after upgrade instead of receiving the previous repair. Derive/persist repairs from compact facts or bounded one-time ID hydration and cover archived storage plus reopen, not only active snapshots.","file":"hub/src/hub/suites.ts","line":282}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source audit A-14178: three medium findings M1–M3. Fix owning test documentation without weakening guards, migrate automatic batch/probe full-history readers, and preserve archived timing backfill. C1 failed; C2/C4 source implementation present but no runtime criteria verified. A-14172 measurement is explicitly near-final, not exact-head C3 proof; final-head Coordinator slot remains after source clearance. No reviewer execution or successor edits covered.

Criteria: C1 failed (M2/M3: automatic batch/probe status searches rehydrate all archives, and archived legacy timing repair is skipped.).

### rev-32 · 2026-10-30T08:23:24.478Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1476-source2
commit: ce11b0942526737921343413b4dff3e2e202d81f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source2 clear A-14189. M1 owning guide/index corrected; M2 automatic batch/probe searches use typed compact findRun facts, selected receipts stay by-ID; M3 SQL-only legacy timing repair persists and refreshes summaries without plan hydration. Boolean preservation additionally restores unchanged release eligibility. C2 source-verified from digest replacement of archived source JSON; C1/C4 runtime and C3 exact-head final measurement remain pending. A-14184 contains local 11/11 + docs 3/3 red/green evidence; A-14172 remains preliminary memory proof. Configured mode-free verification and Coordinator final-head measurement may proceed at unchanged head before final original-record review.

Criteria: C2 verified.

### rev-32 · 2026-10-30T08:38:12.313Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261030-1476-evidence1
commit: ce11b0942526737921343413b4dff3e2e202d81f
scope: evidence
findings: [{"severity":"medium","text":"Configured same-head run 0a8925bc / A-14203 fails the reported two-shard Linux stage cover restart case: cached.run is undefined instead of the original run ID (assertion, 0.965065114 s). C1 archive/cover compatibility remains unresolved; no unrelated/flake attribution established. T2 is red and Web unexecuted.","file":"hub/test/suite-close-component.test.ts","line":46}]
finding_counts: {"high":0,"medium":1,"low":0}

Original-record evidence not clear, A-14205. Exact source-cleared head, auto exit 1: T0/T1 passed, T2 failed, Web unexecuted, no T3/T4. Eleven persistence primary rows and seven 5/5 summaries pass but do not clear failed restart consumer. Preserve ordinary 3557/3556/1 separately from completed-progress 3667/3666/1. C2 retains source verification; no new runtime marks. A-14193 memory remains separate, not suite clearance. Root cause not established; correction needs fresh exact-head source review before successor verification.

Criteria: C1 failed (A-14203 stage-cover restart/cache compatibility assertion failed: expected original cached.run, actual undefined.).

### rev-32 · 2026-10-30T08:41:43.378Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1476-source3
commit: c51f9984b2c2fe4025c206b08d3733ed1c8af09e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source3 clear A-14209. Explicit outer meta.value qualification preserves archived child shard facts through nested JSON projection; positive original/cached stage-cover restart regression and consumer re-audit checked. C2 source verification refreshed; C1/C4 await successor configured runtime, C3 needs fresh exact-head memory measurement. A-14203/A-14205 remain failed old-head evidence; A-14193 memory is not carried to the changed projection. A-14207 local persistence 12/12 is distinct from failed/refused component attempts (no component pass claimed). Configured mode-free successor and Coordinator measurement slot may proceed at unchanged head; additional full T3 remains separate.

Criteria: C2 verified.

### rev-32 · 2026-10-30T09:28:03.663Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1476-evidence2
commit: c51f9984b2c2fe4025c206b08d3733ed1c8af09e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record clear A-14221. A-14220/0aa034af at source-cleared head: parsed 4233 ordinary test passes/513 files, 115 explicit load passes/115 files, no nonpass/unmatched starts; T0/T1/all T2/Web pass, no T3/T4. Own persistence 12 primary plus 8 new identities×5 load pass; previously failed unchanged stage-cache restart identity passes at line16241. C1/C2/C4 source/runtime checked. C3 original A-14214 current-head numeric checkpoint: heap 932365864 B vs baseline3740349120 B, reduction2807983256 B (2677.93 MiB), manifest probe hash matches, durable joined stop/native close0/null; same-Mac copied startup-only measurement limits retained. C1–C4 verified. Old failed A-14203 and old memory remain separate; report-only lint/budget warnings retained. Coordinator additional full T3 remains a separate landing gate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-32 · 2026-10-30T09:30:31.107Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1476-delta1
commit: 2bc3f440505648792e05b2ec1a017fa76f01d721
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merge delta source clear A-14224. Task suite-history production/test/probe/guide bytes unchanged from cleared c51f9984b; landed T-1477 journal/daemon/tests match dev parent exactly. Manual SKILL merge coherently retains both boundaries and measurement/checkpoint/slot requirements; CHANGES/README/index preserve both. C2 source verification refreshed; no new-head runtime or numeric memory proof inferred. Prior A-14220/A-14214/A-14221 remain predecessor evidence, not relabelled. Coordinator-owned merged-head full T3-inclusive verify-all replaces another Implementer mode-free run, with original-record final settlement after receipt and explicit C3 predecessor carry provenance.

Criteria: C2 verified.

### rev-32 · 2026-10-30T10:17:42.619Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1476-delta2
commit: d51049e4722eb33d2fb4ae60925becfcdaafeb86
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Second merge delta source clear A-14239. Suite-history task bytes unchanged from c51f9984b/prior delta; imported T-1467/T-1469 runtime/test/probe files match dev parent. SKILL and README conflict resolutions retain both contracts and measurement plan/slot/sealing/swap/IPC/native-close/aggregate-only controls without duplicate advice; CHANGES preserves provenance. C2 source verification refreshed; C1/C4 new-head runtime and explicit predecessor C3 carry remain for final evidence. No exact merged-head suite/memory pass inferred. Coordinator-owned T3-inclusive verify-all replaces another Implementer mode-free run.

Criteria: C2 verified.

### impl-1476 · 2026-10-30T10:56:37.820Z

Expanded T3/T4 consumer audit after fa19d304/A-14292: startup-replies-scale.test.ts was the sole old verification-checkpoint/jobs-visited assertion. Migrated it to exactly1645 summaries, bounded returned summary bytes, zero full-job hydration/full-history reads, and one active checkpoint serializing no finished records; all frame/total/snapshot/hang caps unchanged. T3 manual measure-memory observer also migrated to record suiteJobSummaries beside suiteJobHistory; its guide updated. No T4 startup-visit assumptions matched. T2 executor-liveness/hub-status and T1 heartbeat/persistence, plus shared suite-unit-fixture raw-history reads, remain explicit persisted-record checks and are unaffected. Original full run remains failed; targeted T3 file2cases passes locally with1645rows/1416803bytes and zero hydration, root typecheck passed.

### rev-32 · 2026-10-30T10:58:36.784Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1476-delta3
commit: d45333e0537c8cc0be8a490c5fb726295207dc24
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source delta3 clear, A-14298; four-file Coordinator-authorized T3 consumer/probe correction from reviewed d51049e. Positive pre-startup Store observers require1645 bounded summaries/0full hydration/0full-history reads and single checkpoint0full records; original frame/snapshot/item/explorer/hang limits unchanged. Memory probe separately observes summaries; owning guides and tier consumer inventory match. Production suite-history bytes unchanged from c51, C2source refreshed. A-14292 remains full-run red, local A-14297 two-case green is partial macOS only. C1/C4 current-head runtime await Coordinator successor verify all; C3 prior-head numeric proof remains labelled, not relabelled as current. No reviewer execution or head mutation.

Criteria: C2 verified.
