---
id: T-679
kind: task
title: "hub/test/tiers.json replaces shards.json: every hub and Neovim test file declares T1, T2, T3 or T4, sorted by path"
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by: []
topic: topic-408
branch: t/T-679-hub-test-tiers-json-replaces-shards-json
created: 2026-10-16T19:59:27.652Z
updated: 2026-10-16T21:51:48.050Z
closed: 2026-10-16T21:51:48.050Z
---

## Summary

`hub/test/shards.json` classifies the 208 hub test files by resource (201 `machine`, 7 `free`) and leaves the 37 Neovim files out. The memo makes the tier, not the resource, the unit the hub enforces (memo §5.1, §5.2.1; report-strategy §4.2.1). This ticket lands the manifest in week 0 with no change to what any run executes: the seven free files become T1, every other file T3. It folds in T-662's declared-tier lint and T-672's sorted map.

## What to build

- **The manifest.** `hub/test/tiers.json`, `version: 1`, a `tests` map keyed by path and sorted by path. A value is a tier string (`"T1"`, `"T2"`, `"T3"`, `"T4"`) or an object `{ "tier": "T3", "contract": "<harness>" }` / `{ "tier": "T3", "scenario": "<name>" }` (E-677 fills the object forms; the lint accepts them now). It covers `hub/src/**/*.test.ts`, `hub/test/**/*.test.ts` and `nvim/test/**/*.test.ts`. The initial content is mechanical: today's `free` files are T1, every other file is T3. `shards.json` is deleted in the same change.
- **Same runs as today.** T1 maps to today's hermetic phase (one worker), T2, T3 and T4 to today's machine phase, and the Neovim phase stays as it is. T4 files run wherever T3 files run until E-678 gives T4 its own occasions. Close-run sharding (`balanceCloseShards`) treats every tier the same way it treats files today.
- **The lint** (`npm run test:tiers`, with `test:shards` kept as an alias for one release) refuses an unclassified file, an entry naming a missing file, an invalid tier or object, and a map not sorted by path, naming the first out-of-order path. A T1 file must still pass today's hermetic check (the `MACHINE` pattern in `hub/src/suite-shards.ts`). Admission refuses with `verify-tiers`; the merge gate refuses with `merge-tiers` before it changes refs. The old codes stay accepted on the wire as aliases.
- **Transition.** A candidate tree that carries `shards.json` and no `tiers.json` (a branch cut before this change) is admitted and run with `free` read as T1 and `machine` as T3, so in-flight branches keep verifying until they merge `dev`.
- **Writers keep it sorted.** Every tool or fixture that writes the manifest writes it sorted; fixtures that write `shards.json` move to `tiers.json`.

## Acceptance criteria

- [x] C1. `hub/test/tiers.json` lists every hub and Neovim test file sorted by path, the seven current free files as T1 and all others as T3, and `shards.json` no longer exists, proved by the lint run over the repository.
  - done: impl-679 · 2026-10-16T20:16:55.058Z
  - verified: rev-30 [reviewer] · run rev-20261016-679-final · 2026-10-16T20:59:06.069Z · commit f97e2ab41f44769a298f5011cba459ebb51e96f0
  - verified: rev-30 [reviewer] · run rev-20261016-679-manifest-merge · 2026-10-16T21:47:35.147Z · commit d0d8d05b3a411b425dcf879c6c253960a4428218
  - verified: rev-30 [reviewer] · run rev-20261016-679-cover-manifest-merge · 2026-10-16T21:51:32.038Z · commit 40a4e6ddc539b44f44d3e3d152ea19cd749d0467
- [x] C2. The lint refuses an unclassified file, a missing file, an invalid tier, an unsorted map (naming the first out-of-order path) and a T1 file that uses a process, port, timer or harness API, proved by lint tests.
  - done: impl-679 · 2026-10-16T20:16:55.340Z
  - verified: rev-30 [reviewer] · run rev-20261016-679-final · 2026-10-16T20:59:06.069Z · commit f97e2ab41f44769a298f5011cba459ebb51e96f0
  - verified: rev-30 [reviewer] · run rev-20261016-679-manifest-merge · 2026-10-16T21:47:35.147Z · commit d0d8d05b3a411b425dcf879c6c253960a4428218
  - verified: rev-30 [reviewer] · run rev-20261016-679-cover-manifest-merge · 2026-10-16T21:51:32.038Z · commit 40a4e6ddc539b44f44d3e3d152ea19cd749d0467
- [x] C3. `cland verify` refuses those faults with `verify-tiers` and `cland merge` with `merge-tiers`, before queueing or changing refs, proved by admission and merge-gate tests.
  - done: impl-679 · 2026-10-16T20:16:55.726Z
  - verified: rev-30 [reviewer] · run rev-20261016-679-final · 2026-10-16T20:59:06.069Z · commit f97e2ab41f44769a298f5011cba459ebb51e96f0
  - verified: rev-30 [reviewer] · run rev-20261016-679-manifest-merge · 2026-10-16T21:47:35.147Z · commit d0d8d05b3a411b425dcf879c6c253960a4428218
  - verified: rev-30 [reviewer] · run rev-20261016-679-cover-manifest-merge · 2026-10-16T21:51:32.038Z · commit 40a4e6ddc539b44f44d3e3d152ea19cd749d0467
- [x] C4. A candidate tree with only `shards.json` is admitted and planned with free as T1 and machine as T3, proved by an admission test.
  - done: impl-679 · 2026-10-16T20:16:56.012Z
  - verified: rev-30 [reviewer] · run rev-20261016-679-final · 2026-10-16T20:59:06.069Z · commit f97e2ab41f44769a298f5011cba459ebb51e96f0
  - verified: rev-30 [reviewer] · run rev-20261016-679-manifest-merge · 2026-10-16T21:47:35.147Z · commit d0d8d05b3a411b425dcf879c6c253960a4428218
  - verified: rev-30 [reviewer] · run rev-20261016-679-cover-manifest-merge · 2026-10-16T21:51:32.038Z · commit 40a4e6ddc539b44f44d3e3d152ea19cd749d0467
- [x] C5. The planned phases, file sets and worker counts for a full run of this repository equal those planned from `shards.json` at the merge base, proved by a planning test.
  - done: impl-679 · 2026-10-16T20:16:56.356Z
  - verified: rev-30 [reviewer] · run rev-20261016-679-final · 2026-10-16T20:59:06.069Z · commit f97e2ab41f44769a298f5011cba459ebb51e96f0
  - verified: rev-30 [reviewer] · run rev-20261016-679-manifest-merge · 2026-10-16T21:47:35.147Z · commit d0d8d05b3a411b425dcf879c6c253960a4428218
  - verified: rev-30 [reviewer] · run rev-20261016-679-cover-manifest-merge · 2026-10-16T21:51:32.038Z · commit 40a4e6ddc539b44f44d3e3d152ea19cd749d0467
- [x] C6. Every tool that writes the manifest writes it sorted, proved by a test that adds an entry, and `docs/agents/tests.md` and `hub/README.md` (Tests) describe `tiers.json`, the four tiers and where a new line goes.
  - verified: rev-30 [reviewer] · run rev-20261016-679-source · 2026-10-16T20:16:39.163Z · commit f97e2ab41f44769a298f5011cba459ebb51e96f0
  - done: impl-679 · 2026-10-16T20:16:56.640Z
  - verified: rev-30 [reviewer] · run rev-20261016-679-final · 2026-10-16T20:59:06.069Z · commit f97e2ab41f44769a298f5011cba459ebb51e96f0
  - verified: rev-30 [reviewer] · run rev-20261016-679-manifest-merge · 2026-10-16T21:47:35.147Z · commit d0d8d05b3a411b425dcf879c6c253960a4428218
  - verified: rev-30 [reviewer] · run rev-20261016-679-cover-manifest-merge · 2026-10-16T21:51:32.038Z · commit 40a4e6ddc539b44f44d3e3d152ea19cd749d0467

## Comments

### impl-679 · 2026-10-16T20:06:53.899Z

Implemented tier manifest/legacy reader, sorted serializer used by all live fixture writers, new verify-tiers/merge-tiers refusals (wire type aliases retained), and docs. T1/2/3/4 planning preserves current resource phases and worker counts. Local tier/lint tests and suite-admission.test.ts green (13.02 s); the admission test includes committed shards-only fallback with unsorted legacy keys and Neovim omitted from the old manifest. Continuing targeted files before source review.

### rev-30 · 2026-10-16T20:16:39.163Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-679-source
commit: f97e2ab41f44769a298f5011cba459ebb51e96f0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-679 full source review clear at f97e2ab41f44769a298f5011cba459ebb51e96f0, fixed point freshly merged origin/dev 528a2109555ab4833ff0336e50b59f22486f06a6. Diff: git diff 528a2109...f97e2ab4; task implementation, dev merge and classification-refresh commits inspected. Both axes reviewed in-session under the role's no-delegation constraint.

Standards: no findings. Tier schema and sorted serializer share the existing suite-shards module seam; resource planning remains explicit. T1 uses the unchanged conservative MACHINE check, one free worker; T2–T4 retain machine grouping and configured workers. Neovim is validated in the common manifest but retains its existing package phase. New suite-tiers file states T2 and starts no hub/process or real-time wait; literal process/timer fixtures are data in JSON. Existing integration fixture changes are manifest substitutions and a single refusal-family table, not duplicated harness permutations. No removed lifecycle assertions, new execution sleeps or broadened skips found. Independent whitespace check passes.

Spec: no findings. Static Git-tree/JSON audit independently finds exactly 247 tracked test paths and 247 sorted entries, no missing/extra paths, shards.json removed. Current fetched base has eight free files (including incoming T-621), all preserved as T1; every baseline machine file stays T3. New owned planner/lint test is T2; totals eight T1/one T2/238 T3. Frozen legacy-shards fixture is JSON-identical to the fetched base. C1's historical seven-file count therefore does not describe an eighth resource reclassification.

Reader validates strict tier strings or two-field T3 contract/scenario descriptors, missing/extra paths, malformed maps/JSON, first out-of-order key, and T1 source violations. Tiers take precedence without masking malformed tiers behind legacy. Legacy-only unsorted resource maps preserve hub-only classification coverage and free=T1/machine=T3 behavior; candidate-tree lint also includes Neovim only for the tier format. Admission binds lint to committed head plus working files before durable job/queue creation; merge checks the immutable merged tree before ref/index/worktree changes. New verify-tiers/merge-tiers outputs coexist with old typed wire aliases.

Tests cover the refusal table through one fixture, unchanged refs/queue on refusal, a committed unsorted legacy-only candidate with omitted Neovim classifications and successful run, all four tier groupings, no-manifest Neovim planning, strict descriptors, invalid top-level structures and T1 source cases in both packages. Baseline plan comparison preserves every frozen file/phase/worker count, filtering only added later test paths while separately checking full current manifest coverage. Close balancing itself is unchanged.

C6 source established: all normal fixture writers found use serializeTierManifest; deliberate malformed/legacy compatibility inputs bypass it explicitly. Sorted insertion regression remains, and both required docs explain path order, tiers, object forms, new-file placement, transition scheduling and legacy aliases. test:tiers is the new entry; test:shards forwards for one release.

A-4179 reports exact-head typecheck, tier lint and alias green, plus serial targeted whole-file results and timings; seven new in-process cases each below 0.03 s. No Reviewer tests/compiler execution. C6 verified by source; C1–C5 run-dependent lint/gate/legacy/planning proof remains unverified until the normal exact-head droplet receipt. Claimant done marks should be recorded for supported evidence before final settlement. Source clearance does not itself lift submission holds: use the Coordinator's applicable explicit hold-lift instruction, then normal mode-free cland verify --executor droplet at this head. No full local suite or per-item QA requested.
Review artifact A-4183.

Criteria: C6 verified.

### rev-30 · 2026-10-16T20:59:06.069Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-679-final
commit: f97e2ab41f44769a298f5011cba459ebb51e96f0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-679 final evidence clear at unchanged source-reviewed f97e2ab41f44769a298f5011cba459ebb51e96f0. Standards and Spec axes: no findings.

Independently audited complete A-4195 / 788795fe-d7b2-4f13-869e-411edb6c8e21. Exact branch/head match A-4183 source clearance; full mode exits 0, 2394 tests, 2386 pass, zero fail, eight prerequisite/platform skips. Hub free 41/41, machine 1955 pass/zero fail/five skips, full Neovim 390 pass/zero fail/three skips. All seven suite-tiers identities pass ordinarily and 5/5 load repetitions (35/35); all six suite-admission and eight merge-gate cases have positive timing receipts. Complete log has no hard duration-budget or load-gate failure; routine regression notices are non-failing. Linux x64 c-8 lon1, Node 24.21.0/Neovim 0.12.5, two workers; suite 2374.10 s, peak load 10.16, lifetime 2445 s, $0.1698.

C1: manifest lint/package admission and repository path-coverage regression execute green; source audit in A-4183 independently matched every one of 247 sorted paths, legacy file deletion and unchanged baseline resource assignments. The fetched baseline had eight free files after T-621, all retained as T1; new owned in-process lint/planner file is T2, other baseline files T3. No existing free/machine phase reclassification is hidden by the historical seven-file wording.

C2: malformed/unclassified/missing/invalid/unsorted maps, strict objects, precedence and T1 hermetic-source table pass, naming tested offending paths. C3: admission/immutable merge-result fault tables pass with verify-tiers/merge-tiers, no queue/ref mutation on refusal, while old typed wire aliases stay accepted. C4: same admission case includes committed unsorted legacy-only candidate, omitted old-format Neovim map entries, explicit resource/worker plan and successful result. C5: frozen baseline plan comparison passes, preserving phases/file sets/worker counts; separate current-tree coverage assertion prevents newly added files escaping classification. C6: sorted insertion and writers/docs proof from A-4183 now has exact-head execution confirmation. Latest task view has all six claimant done marks.

C1–C6 verified at this exact head. No per-item QA or further task run required.
Review artifact A-4197.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### rev-30 · 2026-10-16T21:47:35.147Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-679-manifest-merge
commit: d0d8d05b3a411b425dcf879c6c253960a4428218
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-679 manifest-entry dev-merge delta clear at d0d8d05b3a411b425dcf879c6c253960a4428218. Standards and Spec axes: no findings. Current origin task tip matches. Reviewed the integration chain from final-clear f97e2ab4 through dev merges and the final manifest correction, including fetched dev 18a280fa8ca6d41fc9698cfd9ca2f2052db01e3a.

Independent JSON/Git-tree audit: exactly four entry additions relative to reviewed manifest, no removals or changed prior values: config-set and roles-editor T3; clock and project-clock T2. All 251 tracked hub/Neovim test paths are present exactly once in sorted map order, no missing/extra paths. Frozen legacy fixture has the identical reviewed blob 2547bcfeb03fe799db2a8c2269e069271f5210bd. Rename-detection additions to that frozen file were correctly removed; actual new classifications reside in tiers.json. Owned tier reader/lint/planning/writer/test logic is unchanged. Incoming clock integration, config protocol and documentation are dev changes, not new authored tier logic or a fresh claim that the whole tree is byte-unchanged.

Read primary Coordinator 36c4481d directing the final dev 18a280fa integration and unchanged frozen fixture. Read primary 3c46f06c expressly approving clock.test.ts T2 despite its T1 header: conservative source scanner matches FakeClock/literal fixture patterns; T-682 fixes that distinction and T-690 retags T1 later. Project-clock declares T2. Both additions retain their previous machine phase, so this temporary classification has no scheduling reduction and is not a finding.

A-4212 reports committed-head typecheck and test:tiers green plus serial below-load-15 suite-tiers 7/7 (0.148 s), close-shards 3/3 (0.110 s), verification-workers 5/5 (18.448 s). Independent whitespace check against incoming dev passes. No Reviewer tests/compiler execution.

Read primary Coordinator 5d64bf5a-3212-4a4a-95e0-ad401e6d68ea: A-4195 stands for the manifest-only integration and no new droplet verification is needed. Later final-merge/clock instructions preserve that plan. Accordingly C1–C6 are refreshed from prior A-4183/A-4197 source/final proof, exact manifest-entry audit and requested local checks, under this explicit gate disposition. A-4195 was full Linux green at f97e2ab4 (2386 pass/zero fail/eight skips), including all tier/gate/legacy/planning proof. It is prior-head accepted evidence, not a new-head run or a tree-hash cache hit. No new execution at d0d8d05b is claimed.

All claimant done marks present. Final delta clear; C1–C6 verified under the specified retained-receipt disposition. No new droplet run or per-item QA required.
Review artifact A-4214.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### rev-30 · 2026-10-16T21:51:32.038Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-679-cover-manifest-merge
commit: 40a4e6ddc539b44f44d3e3d152ea19cd749d0467
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-679 final cover-quiet manifest integration delta clear at 40a4e6ddc539b44f44d3e3d152ea19cd749d0467, reviewed from clear d0d8d05b with dev aa10d609f1b7ac7aae6b5957f2f017e5bcc6e184. Standards and Spec axes: no findings. Origin task tip matches.

Independent JSON/Git-tree audit confirms exactly one owned manifest addition: hub/test/cover-quiet.test.ts = T3, in sorted path order, with every prior tier value unchanged and no removal. All 252 current tracked test files are classified exactly, with no missing/extra paths. Incoming cover-quiet header explicitly names T3 real integrated worker/CLI lifecycle, completion and slot release; unchanged 25 ms poll remains T-684's baseline. Frozen legacy fixture retains exact blob 2547bcfeb03fe799db2a8c2269e069271f5210bd, byte-identical to original reviewed f97e2ab4. Rename-induced fixture conflict is resolved without altering the historical plan reference. Owned tier/lint/planner implementation and tests remain unchanged; incoming T-475 source is integrated dev work, not a new authored tier change. Independent whitespace check passes.

Read primary Coordinator bc4bf2aa directing this final manifest-only merge and expressly retaining A-4195. Read primary 3c0fa546: pre-T-475 live hub refusal governs; drop local verification-workers execution, accept completed tier/planning checks/typecheck, retain old gate coverage and run combined tree in the integrated cover after merge. This is an explicit local-check disposition, not an inferred bypass.

A-4219 reports committed-head typecheck/test:tiers green, suite-tiers 7/7 in 0.153 s and close-shards 3/3 in 0.112 s, serial admission below load 15. verification-workers cases did not execute: module admission refused before them, no retry/override. They are not counted as a local pass. No Reviewer runtime execution.

C1–C6 refreshed using prior source/final proof A-4183/A-4197/A-4214, unchanged implementation, exact one-entry/frozen-fixture audit, requested local checks and the Coordinator's retained A-4195 gate disposition. A-4195 was full green at f97e2ab4, including verification-workers; no task run at 40a4e6dd or tree-hash cache hit is claimed. Integrated post-merge cover remains Coordinator-owned for the combined tree. All claimant done marks present.

Final delta clear, no findings. No new droplet task run or per-item QA required under this disposition.
Review artifact A-4221.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-16T21:51:48.050Z

Merged 42307709f6a3cddac36f83e81028d2d9a7ff4647 onto dev.
