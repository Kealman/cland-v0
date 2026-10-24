---
id: T-1231
kind: task
title: Coverage selection parses every coverage map at once and runs the hub out of heap
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: topic-964
branch: t/T-1231-coverage-selection-parses-every-coverage
created: 2026-10-24T10:52:41.168Z
updated: 2026-10-24T11:53:07.370Z
closed: 2026-10-24T11:53:07.370Z
---

## Summary

P1: the hub died of heap OOM twice on 2026-10-24: pid 63237 at 10:46:48Z, and pid 24276 95 s after its start at 10:51:13Z. `coverageSelection` (hub/src/suite-coverage.ts) calls `coverageMaps(root)`, which reads and parses every map listed in `.cland/run/coverage-maps/` and keeps all of them in memory before it picks the newest ancestor. There were 170 pointers, 2,039 MB of JSON, 143 maps over 10 MB. Every task verify or batch preparation that touches hub/src triggers it, and every green dev run adds a map, so the cost grows without bound. The crash stack is `JSON.parse` after `await readFile`, with a nesting that matches the map shape.

Coord archived all but the newest 5 pointers to `.cland/run/coverage-maps-archive-20261024/` as a stopgap. Nothing was deleted.

## What to build

- Selection reads pointers newest-first and parses at most one map at a time. It stops at the first map whose head is an ancestor of the merge base, and keeps no other map in memory.
- Pointer order must not depend on parsing the maps: record `created` (and head) in the pointer, and fall back to the pointer mtime for old pointers.
- Pointers have retention: keep the newest N (configurable, default about 10). When a pointer is dropped, its artifact copy follows the artifact rules, never a silent delete of anything the human can see.
- Batch-shard map merging (`suites.ts`, the `Promise.all` over shard maps) stays bounded the same way.

## Acceptance criteria

- [x] C1. With 50 synthetic pointers to large maps, coverage selection parses at most the maps up to and including the first ancestor, and peak retained heap stays bounded by one map (test).
  - done: impl-1231 · 2026-10-24T10:59:28.300Z
  - verified: rev-32 [reviewer] · run rev-20261024-1231-final · 2026-10-24T11:20:16.274Z · commit 4c58347868db204bce28ce583723d81e5426dc6a
  - verified: rev-23 [reviewer] · run rev-20261024-1231-final2 · 2026-10-24T11:39:27.689Z · commit 959f26cd7a01a67a4c492774713da086bdd865ee
- [x] C2. Pointers record created/head; old pointers without them still order by mtime (test).
  - done: impl-1231 · 2026-10-24T10:59:28.403Z
  - verified: rev-32 [reviewer] · run rev-20261024-1231-final · 2026-10-24T11:20:16.274Z · commit 4c58347868db204bce28ce583723d81e5426dc6a
  - verified: rev-23 [reviewer] · run rev-20261024-1231-final2 · 2026-10-24T11:39:27.689Z · commit 959f26cd7a01a67a4c492774713da086bdd865ee
- [x] C3. Registering a new map beyond the retention limit removes the oldest pointer with an event naming it (test).
  - done: impl-1231 · 2026-10-24T10:59:28.737Z
  - verified: rev-32 [reviewer] · run rev-20261024-1231-final · 2026-10-24T11:20:16.274Z · commit 4c58347868db204bce28ce583723d81e5426dc6a
  - verified: rev-23 [reviewer] · run rev-20261024-1231-final2 · 2026-10-24T11:39:27.689Z · commit 959f26cd7a01a67a4c492774713da086bdd865ee

## Comments

### impl-1231 · 2026-10-24T10:56:50.714Z

Implemented C1–C3 at deterministic T1 seams: 50 x 256 KiB maps, exactly 3 parsed through newest ancestor, peak retained map count 1; pointer metadata and mtime ordering; configured retention removes pointers with named events while preserving artifacts. Shard merge historical Promise.all control failed 3 !== 1, sequential loader passes. Local macOS arm64 targeted files only so far; source review and mode-free verification remain. Matching help/docs/implement skill updated; no role clause expansion per brief.

### rev-32 · 2026-10-24T11:05:03.190Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1231-source
commit: 4c58347868db204bce28ce583723d81e5426dc6a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1231 full source review — clear

Head4c58347868db204bce28ce583723d81e5426dc6a; treeda196a69f7cdded0a6af9786de3c329c4b9c46eb; parent/fixed base230669296771cf8f282ab2d050fc48603ce0de39. One task commit; diff14files334additions/56removals. Reviewed source, all changed tests, consumers, config/help/docs and A-10783. Standards and Spec both completed personally; no delegation.

## Standards

No findings. coverageMaps now returns only lightweight descriptors, ordered without parsing artifact maps. coverageSelection awaits one reader, checks ancestry, selects and returns, with release in finally on continue/return/selection failure. It holds no array of decoded maps. Missing/damaged artifact evidence is skipped and unsupported/shared source rules still fall back before loading. Future/old/mappable-hunk behavior remains explicit.

mergeCoverageFiles replaces shard Promise.all with sequential reads; the result accumulator may retain transferred function objects, while only one incoming map is owned. Function-boundary attribution merging and admitted head/tree provenance refusal remain. The loader test counts simultaneous ownership, including mismatch release; it does not mistake GC/RSS timing for a deterministic receipt.

T1 tests use disposable filesystem fixtures, fixed dates and fake Git replies, no native processes/real-time latency waits:50x256KiB map fixture expects reads newest49/48/47 only, selected head47 and peak1/final0; pointer ordering uses metadata versus legacy mtime with missing artifacts to ensure no artifact read; retention asserts exact pointer set and named expiry events while every artifact file remains. Sequential shard counter/attribution and legacy consumer adapter controls use the same public/helper seams. Config tests cover default10, configured3, render roundtrip and invalid0/negative/fraction/string. Existing T2 fake-executor publication asserts created/head. Existing T3 replay consumer remains the process seam; no new native launch is added.

The suite-coverage-selection/doc procedure is shared coverage guidance, not a new indexed note with an invalid heading. Help, rendered config, hub README, docs/agents/tests and implement skill agree on pointer retention/loader ownership; skill CHANGES records the edit. Built-in role clause unchanged; this adds no role authority or new agent action. No independent smell finding.

## Spec

C1 source-established: the index visits pointers newest-first; each actual map load is awaited individually and discarded before the next candidate; first valid ancestor returns immediately. The test asserts exactly three decodes out of50 and peak owned decoded maps1, with final selected tests/head. It is a deterministic retained-input proof, not a measured whole-process heap/RSS claim. Shard input retention is bounded to one beside its required output accumulator.

C2 source-established: publication parses/validates the actual coverage artifact against admitted job head/tree, writes pointer created/head, and atomically renames its small temporary pointer. Valid pointer.created determines order; legacy/invalid timestamp falls back to pointer file mtime. Reading order never requires opening the artifact. Existing live selection/replay/T2 consumers migrate to descriptors, and historical selector compatibility feeds one loaded map per invocation with ancestor/nearest behavior retained.

C3 source-established: verification.coverage_map_retention is a positive safe integer/default10; runtime publication reads current project config, so after reload the next publication applies it. Registration is sequenced on the hub artifact queue. Entries beyond newestN are unlinked with coverage-pointer-expired naming pointer/artifact/path; artifact copies are neither removed nor archived by this path and retain ordinary lifecycle ownership. Config/header/help/docs describe this distinction. Test verifies configured2 leaves exactlyrun2/run3 and preserves all four artifact files.

No findings. All three criteria explicitly require execution; no verified marks on this source pass. Proceed with fresh mode-free configured verification at this exact head; QA policy none/after-stage, no item QA brief/criteria. Work ends at ready; Coordinator enqueues merge.

## Evidence and limits

A-10783 reports local Darwin arm64 Node24.21 targeted files: coverage-selection9/9T1, init-config13/13T1, suite-soak-component35/35T2, close-shards3/3T1 and one name-selected coverage replay T3 test. It reports typecheck/static/lint exit0 with report-only133findings60files/zero refusals and a corrected interim tuple typing error. Those are targeted implementation reports, not an original configured/Linux receipt or full-suite/actual heap measurement. Preserve original commands/stdout/exits/native timings with exact source/tree/platform attribution; no evidence-only reruns requested. No full npm check/build or integrated receipt claimed beyond what A-10783 names.

Aside S Tech debt on the pre-existing unsealed outer native Git/manual replay path was reported separately; Coordinator4e876aba filed T-1233 and explicitly kept it outside T-1231. Known loose-object maintenance was left untouched under the human's freeze. No request to repair either in this item.

Reviewer performed read-only Git/source/docs/topic/artifact inspection; no tests, probes, live coverage reads, file changes, installer, browser, merge or delegation.
Standards:zero findings. Spec:zero findings.

Audit A-10789: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10789-t-1231-full-source-review-at-4c583478.md

### impl-1231 · 2026-10-24T11:19:10.036Z

Configured mode-free verification a323794e-d76d-429a-8929-2fb3dffc9662 passed at exact source-reviewed head 4c58347868db204bce28ce583723d81e5426dc6a: 2931 tests passed, 0 failed/cancelled/skipped. T0, all T1, fallback all T2 and Web completed on droplet Linux x64 6.8.0-142-generic, c-8 lon1, Node v24.21.0, Neovim v0.12.5, workers 2; lifetime 749 s, cost $0.0520. Budget and lint gates are report-only; warnings remain. T3 deferred to periodic dev/integrated occasions, absent from configured batch tiers; queue enabled. Log A-10819: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10819-suite-a323794e-d76d-429a-8929-2fb3dffc9662-auto-at-4c58347.log. Awaiting Reviewer’s same-head final evidence verdict; no source changes after review.

### rev-32 · 2026-10-24T11:20:16.274Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1231-final
commit: 4c58347868db204bce28ce583723d81e5426dc6a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1231 final same-head evidence review — clear

Head4c58347868db204bce28ce583723d81e5426dc6a; treeda196a69f7cdded0a6af9786de3c329c4b9c46eb. Task/origin refs, task.view and A-10819 agree. Source verdict rev-20261024-1231-source/A-10789 carries forward unchanged. Scope evidence; no findings.

## Standards

Original log A-10819, run a323794e-d76d-429a-8929-2fb3dffc9662, finishes exit0. Parsed finish records distinguish 2931 ordinary test passes across422 file completions from30 additional load-gate test passes and30 load file completions. Zero failure/cancel/skip. All six new T1 identities passed five additional sequential repetitions each alongside the phase. No count is inferred from projections.

Actual completed phases: host T0 npm run check28.48s (typecheck, colour/contrast/HTML/hooks, build and static/test lint); remote allT1; fallback allT2 across hub+Neovim; Web. Remote log reuses host gate ba52b4ac00fbf7236b517003515b99fe22250326, not a second droplet typecheck. No T3/T4 command ran. Mode “full” denotes selection fallback here, not a full T1–T4 or stage cover.

Runtime Linux x64 6.8.0-142-generic, c-8 lon1 cland-v0-2b323a1a, Node24.21.0/Neovim0.12.5; configuredworkers2, Webworkers4. Droplet749s/$0.0520. Command durations T1/T2/Web70/391/180s; measured suite durations65.83/386.20/175.15s. Projections are separate: final Web150.266s at2workers is not measured Web wall175.15s at4.

Budgets/test lint/ratchet remain report-only:133findings60files, zero static lint refusals; five missing duration baselines; T3 ratchet2182.786s unchanged with incomplete base timings. Existing unrelated Web, Neovim and item-summary warnings remain, including Web wall over40s and items57.35s over40s. This is an execution pass, not a clean duration-budget pass. No T-1231 new identity approaches its T1 per-case limit: largest base case0.166008s, largest repeated case0.182378s. No allowance edit required.

A-10792 retained partial implementation-time Darwin arm64 Node24.21 outputs is correctly labelled precommit working-tree evidence. It includes9coverage cases,13config cases,3shard cases and one name-selected T3 replay case2.867971s (Node2.982865s), not the whole T3 file. Its35-case suite-soak excerpt is explicitly an excerpt. These remain supplemental, not remote or exact-head configured evidence.

## Spec

C1 verified: original remote log records the50-large-map/first-ancestor/peak-one ownership test passing0.166008s and5/5 repeated0.145002–0.182378s. The accepted source assertion proves exactly three decodes through firstancestor and peak owned decoded-map count1/final0. This is deterministic retained-input ownership, not actual whole-process heap/RSS measurement or a recreation of the2GB live corpus. Sequential shard merging passes0.004931s plus5/5 and retains attribution/provenance checks. Historical selector compatibility passes plus5/5. Actual accumulator storage remains necessary output, separately described in source review.

C2 verified: metadata/legacy-mtime ordering passes0.005490s plus5/5; init-config positive retention/default10/roundtrip/invalid values passes0.001164s plus5/5. T2 public green-nightly publication test passes0.200627s and checks actual pointercreated/head.

C3 verified: configured retention test passes0.013622s plus5/5, retaining newest pointers, naming expiry events and preserving all artifact copies. Source confirms serialized publication and runtime config read.

All C1–C3 done marks are current. Final verified all. QA none/after-stage; no QA, stage closure, full-suite or landing claim. T-1233 separately owns the pre-existing unsealed manual-replay Git debt. Reviewer performed read-only source/ref/artifact/log audit, no tests, probes, live-map reads, edits, browser or delegation. Coordinator’s11:18 cover/enqueue hold remains in force; this verdict makes the item ready for that normal queue, not an enqueue authorization.

Standards0 findings; Spec0 findings.

Audit A-10823.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-23 · 2026-10-24T11:24:14.882Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1231-delta
commit: 959f26cd7a01a67a4c492774713da086bdd865ee
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1231 authorized integration delta review — clear

Head959f26cd7a01a67a4c492774713da086bdd865ee/treea3f2e2d53682c0bab87352201257ac775b74c31f. Parents independently confirmed: reviewed task4c58347868db204bce28ce583723d81e5426dc6a and specified dev956624130bbc3ba3ab80ade149a40c0b2c481cab. Coordinator0ea519d9 explicitly authorized this one merge, retaining both skill guidance additions and CHANGES; no further dev merge authorized. Origin task ref matches. Scope delta, run rev-20261024-1231-delta. Hold transferred to routed rev-23 after rev-32's prior-head final verdict completed; no competing review.

Standards: clear. Inspected both-parent diffs and the manual implement/SKILL.md resolution. Coverage loader/retention guidance and dev's explicit unknown provider-size guidance both remain as independent paragraphs, alongside custom-role guidance. CHANGES retains T-781/T-1228/T-1231 provenance. No markers or whitespace errors. Independently compared added/removed lines per task path: every one of the14 task files has exactly the same task edits when comparing original base23066929→4c583478 versus dev95662413→959f26cd (334 additions/56 removals). This includes seven overlapping dev/task paths: skill/CHANGES, tests.md, hubREADME, usage, dispatch and suite-soak component. Integration introduces no extra task edits or weakened assertions.

Spec: prior full source audit A-10789 and final prior-head audit A-10823 carry forward as design/implementation provenance. The merge preserves bounded one-at-a-time coverage selection, sequential shard-input ownership beside the output accumulator, created/head pointer metadata with legacy-mtime ordering, positive configurable retention/default10, serialized publication and named expiration without deleting artifact copies. New task edits are patch-identical even where surrounding dev changed. The merged dispatcher retains dev's role/argument changes plus the same coverage publication queue; merged suite-soak test retains dev controls plus created/head assertions. No remaining Standards or Spec findings.

All C1–C3 require runtime tests, so their old4c583478 verified marks remain historical; no current runtime criterion is newly verified by this delta. A-10819/a323794e at4c583478 is a green prior-head receipt, not proof of959f26cd. A-10792 partial implementation-time local stdout stays separately attributed. A-10825 accurately describes integration and absence of local tests/check under current macOS cover-quiet. No local execution requested or bypassed.

Source clear permits a fresh mode-free configured droplet verify at exact unchanged959f26cd, report result to Reviewer/lead, followed by same-head evidence review. Keep actual phases, host-gate tree attribution, native counts/timings and report-only diagnostics; no full-tier/stage claim. QA policy none/after-stage, no item brief. Existing T-1233 manual replay environment debt remains separate under Coordinator4e876aba, not newly introduced/resolved by this integration. Coordinator stage-cover enqueue hold remains in force. Reviewer used only static Git/source/artifact/tracker/topic reads; no tests, live-map probes, edits, install, Git mutation, browser or delegation. Standards0 findings; Spec0 findings.
Durable audit A-10831.

### impl-1231 · 2026-10-24T11:38:52.623Z

After Coordinator-authorized dev 95662413 merge, delta source review rev-20261024-1231-delta is clear at new head 959f26cd7a01a67a4c492774713da086bdd865ee. Fresh mode-free verification b6405a51-bbb1-4f4a-ab49-a01068d9a880 passes at that exact unchanged head: 2951 tests pass, zero failed/cancelled/skipped; T0/all T1/fallback all hub+Neovim T2/Web completed, T3/T4 unrun/deferred. Droplet Linux x64 6.8.0-142-generic, c-8 lon1, Node v24.21.0, Neovim v0.12.5, workers 2; lifetime 725 s, cost $0.0503. Budget/lint warnings are report-only. Original log A-10844: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10844-suite-b6405a51-bbb1-4f4a-ab49-a01068d9a880-auto-at-959f26c.log. Requested evidence-only review for C1–C3. No further dev merge or local tests under cover hold.

### rev-23 · 2026-10-24T11:39:27.689Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1231-final2
commit: 959f26cd7a01a67a4c492774713da086bdd865ee
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1231 integrated-head final evidence — clear

Head959f26cd7a01a67a4c492774713da086bdd865ee/treea3f2e2d53682c0bab87352201257ac775b74c31f. Delta source verdict rev-20261024-1231-delta/A-10831 stands unchanged, with full source A-10789 and prior-head final A-10823 retained as historical provenance. Scope evidence, run rev-20261024-1231-final2; findings []; C1–C3 verified.

Configured mode-free b6405a51-bbb1-4f4a-ab49-a01068d9a880 / original log A-10844 finished exit0 at this exact integrated head, agreeing with task.view. Parsed native finishes2951 ordinary passing tests/423passing file finishes, plus30actual load-gate test/file passes: six new T1 identities each have five additional passing repetitions. Zero failures/cancellations/skips. AllT1 (137files/848top-level tests), fallback allT2 across hub+Neovim (242files/1768top-level tests), fullWeb (44files/225top-level tests) complete. No T3/T4 command ran; remaining process coverage is deferred to configured periodic/integrated occasions, not claimed passed by “mode full”.

C1:50-large-map newest-ancestor test passes0.173608501s, repeated5/5 maximum0.181042388s. Accepted unchanged source asserts exactly three map decodes through first valid ancestor, peak owned decoded input1/final0. It is deterministic input ownership, not a whole-process RSS/heap measurement or live2GB corpus replay. Sequential shard merge passes0.004701181s plus5/5, retaining function attribution and mismatched-provenance release. Legacy selector adapter passes0.00542784s plus5/5. Output accumulator remains required output beside one incoming map.

C2:pointer created/head/legacy-mtime ordering passes0.005531082s plus5/5; positive retention/default10/render roundtrip/invalid values passes0.001154015s plus5/5. Public T2 green-nightly publication passes0.201654809s and retains actual created/head pointer assertions on the merged source.

C3:newest-N registration/pointer-expiry test passes0.0120644s plus5/5, with exact retained pointer set, named expiration events and preservation of every artifact copy. Source/delta confirms serialized artifact publication, runtime config read and unchanged artifact ownership rules. None of the new T1 identities approaches0.5s; no allowance edit required.

Host T0 npmcheck exits0/40.115s. Gate17ef90b414abe67ecffaaaeaf786bcf82fb0552d independently is a Git tree; the retained host check is not a repeated droplet typecheck. T1/T2/Web phase envelopes68/376/175s are distinct from measured suite walls63.66/371.00/170.33s and final Web projection150.266s at2workers. Runtime Web phase uses4workers; ordinary phases configured2.

Executor droplet c-8lon1 cland-v0-64453ed0 Linuxx64 6.8.0-142-generic, Node24.21/Nvim0.12.5; life725s/$0.0503. Diskfsync22.37ms/SQLite54.77ms. Report-mode lint133findings/60files, six missing baselines, incomplete-base ratchet2182.786s unchanged and unrelated Web/Neovim/scale diagnostics remain visible. Web measured wall170.33s over40s, items55.312s and other warnings do not become a clean enforcing-budget claim.

A-10792 local implementation-time partial receipts remain separately attributed; A-10819 at4c583478 is prior-head green evidence, not reused as this run. New merged-head evidence supplies current C1–C3 verification after all14task edits and both skill guidance/provenance additions were checked in A-10831. No further dev merge/local execution was needed or requested. T-1233 separately owns pre-existing unsealed manual replay Git debt.

QA none/after-stage, no item brief, no stage closure, live-memory profiling or landing claim. Coordinator's stage-cover enqueue hold remains in force. Reviewer performed read-only Git/source/tracker/artifact/log audits only; no tests, probes, live-map reads, edits, install, browser, Git mutation or delegation. Standards0 findings; Spec0 findings.
Durable audit A-10845.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-24T11:53:07.370Z

Merged 655b6770d5579e22bb1c3960d5a34208a53d8247 onto dev.
