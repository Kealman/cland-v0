---
id: T-1944
kind: task
title: Two back-to-back Neovim fixture refreshes still differ in incidental task.view captures (T-654 benchmark row, R-1), so a refresh leaves a versioned diff
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2073
blocked_by:
  - T-2112
topic: topic-1781
branch: t/T-1944-two-back-to-back-neovim-fixture
created: 2026-11-17T12:09:38.187Z
updated: 2026-11-26T19:23:54.344Z
---

## Summary

After T-1804 removed the archive-loading dependency from explorer recording keys, two back-to-back `npm run test:nvim-fixtures` runs (2026-11-17, impl-1804, topic-1602, A-20864) still differ. Run 1's main catalog has 6061 records and run 2's has 6058. The difference is exactly three task.view captures, present only in run 1: the T-654 benchmark row and R-1 from two scenarios, one of whose outputs is already known. Every other slice and the live baseline are byte-identical. Compared with the migrated catalog, the first refresh also dropped 36 incidental captures. Which card frames get captured varies with selection and coalescing timing, independent of the key.

## What to build

The recorder captures a deterministic set of frames per scenario, either by awaiting a defined card-selection state or by recording only frames a scenario asserts on, so a refresh run twice in a row leaves no versioned diff.

## Acceptance criteria

- [x] C1. `npm run test:nvim-fixtures` run twice in a row leaves no versioned diff across the catalog, every slice and the live baseline (test).
  - done: impl-1944 · 2026-11-26T18:45:38.086Z
  - verified: rev-35 [reviewer] · run rev-35-1944-evidence-3 · 2026-11-26T19:23:11.687Z · commit 90718147c3c30de304eed3801f47ffd3fbce24fa
- [x] C2. The cause of the varying captures is named with a deterministic reproducer that fails first (test).
  - verified: rev-35 [reviewer] · run rev-35-1944-evidence-1 · 2026-11-26T01:49:01.653Z · commit 75e9ab74b419435ed9745139c9aa5de0d569f520
  - done: impl-1944 · 2026-11-26T18:45:38.314Z
  - verified: rev-35 [reviewer] · run rev-35-1944-evidence-3 · 2026-11-26T19:23:11.687Z · commit 90718147c3c30de304eed3801f47ffd3fbce24fa

## Comments

### impl-1944 · 2026-11-25T13:07:31.136Z

Consumer inventory before recorder contract change: replayFrame/frameRecorder in nvim/test/frame-fixtures.ts and stub-hub.ts; installed by hub/test/nvim-recorder-preload.ts and record-nvim-frames.ts; refreshFrameCatalog and nvim-frame-refresh.test.ts; producer/drift readers nvim-frame-source.ts, nvim-fixture-check.ts, nvim-fixture-boundary.test.ts; qa-stub-hub.ts and all runtime stub consumers discovered by nvim-frame-consumers.ts, including T3/T4. Wire shape and normal replay unchanged; shared cardValue migrates stub plus maintenance producer. Documentation consumers: docs/agents/tests.md and per-file fixture guidance; no CLI/help or permission changes. Cause: append-on-demand records optional debounced/coalesced task.view requests. Deterministic zero/two selections regression failed first on catalog/slice byte inequality, then passed with eager context capture.

### rev-35 · 2026-11-25T13:38:22.083Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1944-source-1
commit: f18979366b9315586f0be5b66f5230a837c46ad5
scope: full
findings: [{"severity":"medium","text":"M1: controlContext catches recorder.cards including appendFileSync persistence failure, silently treating a lost valid transient capture as invalid projection deferral. Approval covers invalid-context projection only; no append-failure refusal/control retained.","file":"hub/test/nvim-frame-recorder.ts","line":35},{"severity":"medium","text":"M2: A-23433 retains only an authored summary and one final27-file hash map; both native full logs/separate per-run inventories/source identities were deleted. Transcript exits/comparison tails are limited observations, not independently retained proof of both complete50-consumer+baseline runs. Final27 hashes match this head; C1 pair proof remains missing."}]
finding_counts: {"high":0,"medium":2,"low":0}

A-23436 consolidates both confirmed findings and correction bar: distinguish materialization deferral from persistence failure, add injected append/failed-capture refusal while preserving existing deterministic controls; in Coordinator-authorized native slot retain actual command/runtime/source/native-exit/full file+baseline output and both27-file maps/comparison for corrected-source pair. No reconstruction of deleted logs; no stress measurement. C2 source cause/reproducer review retained/unverified. Hold released for correction/authorized evidence work; fresh committed-head review before configured verification; human midnight/Coordinator budget hold remains. Reviewer ran no tests/lint/native/Neovim/browser.

Criteria: C1 failed (M1/M2: refuse append failures while retaining invalid-context deferral; retain corrected-source consecutive native pair receipts and separate27-file inventories.).

### impl-1944 · 2026-11-25T13:57:55.632Z

Review correction at 75e9ab74b: materialize card records before persistence; append failure latches an owner receipt, propagates from direct and nested context-read writes, and fences later capture/publication. The append-failure regression failed first on direct swallow and again on nested read; final focused file is 9/9. Full typecheck and full test:lint pass, refusals 0. Prior retained pair at 06069a005 has complete raw logs, native exit 0 twice, unchanged source inventories and 27 equal fixture hashes, but is labeled pre-final because nested-read correction followed. Waiting for authorized native slot for the same retained pair at final head; original A-23433 evidence remains limited to transcript-backed observations, not reconstructed raw proof.

### rev-35 · 2026-11-25T14:14:49.258Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1944-source-2
commit: 75e9ab74b419435ed9745139c9aa5de0d569f520
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-23458 records the full correction/evidence audit. M1 resolved by materialize-before-persist, exact append-failure latching and nested-reader refusal with preserved no-publication assertions. M2 resolved by A-23455's two complete exact-head native refresh receipts: each exit0/null, both streams complete, 51 TAP sections/499 passes/8417 frames; separate27-file inventories equal, and all four6477-entry source inventories independently match this commit's Git blobs. Earlier incomplete/pre-final occasions remain separate. C1/C2 stay unverified pending configured same-head result/final audit. No configured Linux/tier/browser/enforced-timing claim. Human midnight submission hold and subsequent Coordinator window remain in force.

### rev-35 · 2026-11-26T01:49:01.653Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1944-evidence-1
commit: 75e9ab74b419435ed9745139c9aa5de0d569f520
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-23520 combines source2/A-23458, independently retained A-23455 native pair and configured bf3c0845/A-23519. Producer code0/empty cause; recorded T0/T1/T2/selected7 T3/Web complete exit0. The Mac pair each completes499/499 across50 consumer invocations+baseline, with identical27-file hashes and four6477-entry source inventories matching this commit. Linux selection/transient/append-refusal controls each pass base+5 distinct load IDs; refresh9/discovery5/boundary11 all pass;41/50 fixture consumers have actual Linux T2 file passes. Earlier red C2 observations remain summary/transcript-labelled, not recovered native logs. One explicit macOS prerequisite skip;268 other T3/18 T4 unexecuted; report-only budgets/lint; cache unknown. Existing finish-only protected-output accounting kept separate. C1/C2 verified; no findings/source changes/rerun.

Criteria: C1 verified, C2 verified.

### impl-1944 · 2026-11-26T18:06:17.953Z

Compact-ID consumer search before change: only fixtureDecoder in nvim/test/frame-fixtures.ts reads packed nodes/ref directly; IDs are opaque string lookups, no digest validation. parseRecordings/unpackRecordings/recordingReader/replayFrame cover main/slice readers; client.ts only selects paths; stub-hub.ts/qa-stub-hub.ts consume decoded projections. Lua graph/card ref fields are unrelated, with no protocol-catalog parser. Writers: serializeRecordings from record-nvim-frames.ts (full/targeted/from-recordings), migrate-nvim-frame-inputs.ts; refresh/fixture-check and boundary tests use shared codec. All 25 frozen slices and main remain version-1 packed JSON; live baseline is unpacked and unaffected. Shipped docs/QA brief references are path inventories or historical fixed-commit/hash receipts, not node-ID grammar consumers; historical records stay unchanged. Catalog SHA-256 recording keys retain their format. Runtime consumer closure remains 50 files across all tiers. Existing decoder supports both previous full-hash IDs and compact opaque strings; add explicit old-format reader regression and exact full-catalog roundtrip.

### rev-35 · 2026-11-26T18:26:09.675Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1944-source-3
commit: fb3d9f60c3f2df7826222de27e9c7367b3250821
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-23559 records standards/spec review and independent retained-evidence audit. Compact disk IDs preserve SHA-256 interning/recording keys and the unchanged decoder/version-1 format; all 26 packed files independently match an exact lossless reference renaming, with main catalog 9,387,186 bytes and all 8,417 records retained. Live baseline unchanged. Complete roundtrip/reverse-enumeration/legacy/mixed-namespace assertions retained; consumer census and docs match. A-23558 parent-head pair independently checks two native code0/null completions, 499/499 across 51 TAP sections each, 27 equal fixture hashes matching final Git, and four identical 6,477-entry inventories matching parent Git. Coordinator 07e13279 explicitly permits this labelled reuse; parent-to-final delta is solely the unconsumed T1 ownership wrapper, not producer/codec/fixture changes. No fresh pair required for this source pass. Earlier configured evidence remains tied to old head 75e9ab74b; C1/C2 stay unverified at the new head pending its configured result. No findings; hold released, request a new Coordinator verify window. No Reviewer test/probe/run or changes.

### rev-35 · 2026-11-26T18:37:45.848Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1944-evidence-2
commit: fb3d9f60c3f2df7826222de27e9c7367b3250821
scope: evidence
findings: [{"severity":"medium","text":"E1: configured T1 exits 1 because the new complete-catalog codec control takes 10.934 s against the enforcing 5 s case budget; all five loaded repetitions also exceed 5 s (11.078–12.975 s), despite passing assertions. T2/T3/T4/Web unexecuted; final configured clearance unavailable.","file":"hub/test/nvim-fixture-boundary.test.ts","line":12}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-23567 records exact-head 975356b5/A-23566. Producer code1/cause empty unspecified, unfinished[]; T0 complete0, T1 complete1, canonical tree3868080892a8f5d458d7e9e7191abedf6c93fe78. Literal budget diagnostic at log14701: complete-catalog compatibility/roundtrip 10.934 s >5 s. Base plus all5 loaded assertion outcomes pass, durations10.934–12.975s; no timeout/codec-failure classification inferred. 2286 base +25 loaded cases pass; 251 T1 file finishes pass, no duplicate/unmatched/unfinished progress. Remaining tiers/Web unexecuted. Prior A-23558 parent pair and lossless/source proof remain positive, explicitly parent-scoped; old-head green does not clear this changed head. C1 failed only at current configured gate; C2 remains unverified. Lead/Coordinator cost disposition required while preserving assertions; no allowance/tier change/retry authorized by Reviewer. Hold released, no Reviewer edits or runs.

Criteria: C1 failed (Current-head configured gate fails the added complete-catalog control's enforced duration budget; the accepted parent-head no-diff producer pair remains positive subproof, not a failed capture assertion.).

### rev-35 · 2026-11-26T18:46:51.791Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1944-source-4
commit: 90718147c3c30de304eed3801f47ffd3fbce24fa
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-23571 records the scoped review. The complete-data oracle now checks committed file size and full decode/re-encode SHA-256 equality with one packing pass, retaining all-byte/key/input/output coverage. Reverse-record enumeration and legacy readability assertions remain explicit in the small mixed-format case with both namespace/fallback directions; both owners retained. A-23568's real operation corruption fails the byte oracle, mutation removed; final local file13/13 with authoritative941.561041ms Mac/Node24.21 case observation, not a Linux gate claim. Only T1 test/docs changed, no budget relaxation/allowance/retier; writer/decoder/fixtures/producer/client unchanged. Previously audited and Coordinator-approved parent-head native pair remains explicitly parent-scoped. Prior975356b5/A-23566 remains failed; C1/C2 stay unverified at this new head pending configured Linux receipts and duration outcome. No findings; hold released, request new Coordinator window. No Reviewer test/probe/run or changes.

### rev-35 · 2026-11-26T19:23:11.687Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1944-evidence-3
commit: 90718147c3c30de304eed3801f47ffd3fbce24fa
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear; A-23590 combines source3/source4, accepted A-23558 parent native pair and configured de08d6d3/A-23588. Producer code0/empty cause, unfinished[], T0/T1/T2/selected32 T3/Web complete exit0 at canonical1ad63c2d30cf645ef4206ab666bc82be12eceffc. Full-catalog case base4.418251964s and all5 distinct loaded observations pass, maximum4.715693604s below unchanged5s gate. Mixed-format plus selection/transient/append controls also each pass base+5; boundary13/refresh9/discovery5 all pass. Parent pair remains explicitly ed504424f-scoped, independently audited499/499 twice with27 matching fixture hashes/four matching source inventories; only non-consumed T1 test/docs differ. Current Linux receipts cover47/50 maintenance consumers, three T4 unexecuted. Four macOS prerequisite skips retained;243 other T3/18 T4 unexecuted;7884 paired base pass/4skip plus25 loaded pass, known3 finish-only accounting records separate. Linuxc8nyc1 Node24.21/Nvim0.12.5 workers2, isolated HeadlessShell1248/Chrome156.0.8078.4; advisory checks/cache limits recorded. Prior975356b5 duration failure remains historical, no gate relaxation. C1/C2 verified; findings none, no Reviewer changes or additional run.

Criteria: C1 verified, C2 verified.
