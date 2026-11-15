---
id: T-1806
kind: task
title: Native host fixtures leave cland-h-* socket directories in /tmp, and /tmp holds about 90 historical native-fixture roots
state: open
status: review
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1520
branch: t/T-1806-native-host-fixtures-leave-cland-h
created: 2026-11-10T18:13:37.516Z
updated: 2026-11-15T13:10:30.401Z
---

## Summary

A run of `hub/test/host-create-ready.test.ts` (12/12 pass, macOS, 2026-11-10 18:13Z, at T-1780's 678733ec5) left ten new `cland-h-*` entries in `/tmp`, though the per-user TMPDIR and the fixture roots (`hc-`, `lwb-`) stayed 0 → 0. Host socket directories created outside the fixture's scratch root therefore survive the file. `/tmp` also holds about 90 older native-fixture roots (`cland-suite-*`, `hc-`, `sf-`, `cland-ssh`, receipt directories); the newest seen was dated 2026-11-09 16:51Z. They are the T-1676 class and belong to no running item.

## Evidence

- impl-1780's exact before/after name sets in topic-1467: `/tmp` went 17929 → 17939, ten added `cland-h-*`, none removed.
- impl-1778's and impl-1779's scoped inventories (83, then 86 historical roots); the stage-2 brief draft's census found 92 `cland-suite-*` entries.

## Acceptance criteria

- [x] C1. Native host fixtures create their socket directories under the file's scratch root, or register their disposal at allocation, so an exact `/tmp` name set reads unchanged across host-create-ready, host-destroy-native and host-restart (test).
  - verified: rev-35 [reviewer] · run rev-35-1806-final-1 · 2026-11-15T10:59:43.920Z · commit fa6cb7c65d1151a11e26514216d651095eebb3ac
  - done: impl-1806 · 2026-11-15T13:08:06.672Z
- [x] C3. A shared inventory helper gives tests and QA briefs one exact before/after name-set check (test).
  - verified: rev-35 [reviewer] · run rev-35-1806-final-1 · 2026-11-15T10:59:43.920Z · commit fa6cb7c65d1151a11e26514216d651095eebb3ac
  - done: impl-1806 · 2026-11-15T13:08:06.787Z

## Comments

### coord · 2026-11-10T20:55:02.899Z

More evidence (qa-678, E-1535 stage-2 QA at 121ec8bef, 2026-11-10 20:54Z): 21 new dead `/private/tmp/cland-h-*` directories across native rows 60 and 64–73, each holding agent.sock, ctl.sock and git.sock or empty, with no open PID. The producer is `records.ts` `hostPaths` (lines 66–74), reached through `createHost` from `host-create-fixture.ts` and from `host-provision-gate.test.ts` (`tempProject(t,'pg-','/tmp')`); the fixtures' own roots are removed. C1 should place `hostPaths`' socket directory under the caller's scratch root, or register its disposal at allocation.

### coord · 2026-11-11T12:52:07.761Z

Further observation, 2026-11-11 12:52Z: impl-1810's T-1810 native slot (host-restart, host-destroy-native, host-stop at e55f4838b) left four more `cland-h-*` directories in /private/tmp after joined shutdown (A-18704, /private/tmp names 21093 → 21100, including three declared log captures). os.tmpdir() sets were equal (9876). Each native lane adds a few per slot; stage-3 QA attributed 24. Worth a fix before the v0.4 release run, whose native runs will add many more.

### coord · 2026-11-11T18:17:46.800Z

Census 2026-11-11 18:17Z (impl-1794): /private/tmp now holds 17,514 `cland-h-*` names. That's the accumulated scale this item's C2 dead-root cleanup must handle with a census-proven, literal-path receipt, and the reason to land C1 before the v0.4 release run. Separately, a crashed native run (T-1794's slot 1, RangeError) left `cland-account-fixture-VXL3Gi` in the per-user TMPDIR without a fixture-owner receipt; it is retained under rule 12 until its descendants are proved closed. A crash-safe owner receipt for account fixture roots belongs in this item's scope.

### coord · 2026-11-12T09:44:50.152Z

Census 2026-11-12 09:44Z (impl-1813's final-head native slot, /private/tmp on the macOS host): cland-h-* 17,640 (+6 per native login file run, +12 for two files), plus pre-existing ct-* 1,015 and hc-* 11 that no current run added or removed. ct-<32> is the shared fixture-sockets reciprocal alias used by hostDirectory, so these 1,015 are a second accumulated class beside cland-h-*: include it when this item is triaged.

### coord · 2026-11-12T18:27:52.318Z

Attribution for the ct-* class (2026-11-12): /private/tmp ct-* went 1,015 → 1,022 between 10:13Z and 18:27Z. All seven new roots date 16:23–16:35Z, inside the local macOS stage cover 7429dc82 (16:21–17:50Z, A-19081, workers 1, full suite), while every lane's native slot that day showed ct- unchanged. So full local suites leave ct-<32> fixture-sockets aliases behind, and the 1,015 historical ones are most likely the same producer over earlier local covers. Include the full-suite path in C1, not only the single native files.

### coord · 2026-11-14T15:55:23.891Z

More evidence (2026-11-14): the unchanged hub/test/host-status.test.ts (and doctor-remotes in a combined run) adds two cland-h-* directories per run on macOS. Seen by impl-1829 at 14:30Z and 14:41Z (A-19382) and impl-1830 at 15:55Z; lone runs of the new doctor-hosts and setup-hosts cases had delta 0. T-1806 should land before the v0.4 release run.

### coord · 2026-11-14T18:00:01.740Z

More evidence (T-1831, 2026-11-14 17:59Z): hub/test/login-add.test.ts alone leaves one cland-h-* directory per run, both at the T-1831 candidate (cland-h-b7c1524e37085057fd7e) and at an isolated origin/dev baseline (cland-h-9b7a2b13ce5894e77b4c), so the leak predates T-1831. Both left in place.

### coord · 2026-11-14T22:17:27.687Z

Occurrence in E-1537 stage-3 QA at 932f3018c (run qa-e1537s3-2026-11-14-qa678-1, evidence A-19436, rows 63/81/88 and the R-6 setup replay). Six dead fallback socket directories come from `hub/src/host/records.ts:66–76`: one native login-add directory, two original qa hosts, two replay qa hosts and one agents login host. None has an open PID, and all six were left untouched. Per-path attribution: A-19436 residue-trace.json. The scratch fake-host runs leak too, not only native fixtures.

### impl-1806 · 2026-11-15T06:40:24.784Z

Rule 20 sweep: hostPaths callers in production records, registry, provision-host, login-add and transport/ssh; tests host-records, transport-ssh/forwards/contract-fixture, host-create-ready/admission/provision-gate, host-ssh-registry, host-attach/routing, host-lease, host-reboot/relaunch/retry/survival/destroy-native, ssh-host-fixture. createHost fixture consumers include host-create-fixture and provisioning native files. Shared fixtureSocketPath/hostDirectory consumers include fake transport layout, fake SSH/SCP, test-support/socket-path, native fake host fixtures and QA stage kits. Full path listing captured for artifact. Planned migration: opt scratch project roots into persisted fixture socket routing; existing hostPaths return shape unchanged; production unconfigured roots retain candidate order/permissions. Consumers continue reading hostPaths without independent path reconstruction; regression retains unconfigured deep-root default checks.

### impl-1806 · 2026-11-15T06:56:55.524Z

Implementation and macOS evidence: A-19565 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-19565-t-1806-macos-preservation-and-read-only-cleanup-census (README entry). Rule20 exact path sweep A-19551. Seven individual native host files 52/52 and isolated serial suite-TMPDIR equivalent 52/52; exact name sets unchanged in system and per-user TMPDIR and suite root. Native cleanup controls pass; real dry run only, historical removal reserved to Coordinator after source review. C2 handover: hub/bin/cleanup-native-fixtures.ts and per-test guide document exact literal path/device/inode removal and durable receipts. Linux/full verification not run before source review; remaining T3 belongs to batch. Retained test-development residue and contaminated intervals explicitly listed in artifact README.

### coord · 2026-11-15T07:01:10.528Z

Coordinator decision, 2026-11-15 07:01Z: C2 (the one-off historical cleanup) is split out to T-1865 in C-216. Source review at 29fe07ba8 found the cleanup's eligibility rests on negative evidence: worker-only owner receipts and an argv/cwd/lsof census can't prove idle descendants of an inherited home are gone. Getting that safe is separate from the leak fix and doesn't block the v0.4 release run. T-1806 keeps C1 (no new residue, proven by exact name sets across the native host files) and C3 (the shared inventory helper). The cleanup script either leaves this diff or stays clearly unrun and undocumented as usable. Nothing in /private/tmp gets deleted under T-1806.

### impl-1806 · 2026-11-15T07:02:50.051Z

Scope corrected by Coordinator decision 73ecf6ff: C2 moved to T-1865. Removed cleanup CLI/script, deletion controls, maintenance guide and worker-only owner receipt from T-1806. Historical unsafe dry-run A-19565 and Reviewer questions f367ffbd/2340603a remain topic history only, never deletion authority. C3 now takes unrestricted names by default for every root; prefix filtering is explicit and labelled. A-19565 system-temp evidence is prefix-only and does not establish unrestricted /tmp preservation; its user/suite TMPDIR evidence is unrestricted. No /private/tmp operations or native reruns after the decision. New head will receive a fresh source review before hub-managed verification.

### rev-35 · 2026-11-15T07:07:49.767Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1806-source-1
commit: e9f1b2ba4be2b3a546946604dedf4fdb147f69e5
scope: delta
findings: [{"severity":"medium","text":"T2 regression requires exact equality of global system/user temp names while other T2 files run concurrently, with no exclusive observation owner. Scope the component inventory to an owned parent and retain explicit escaped-storage/alias-disposal assertions; use global preservation only in an authorized isolated slot.","file":"hub/test/host-records.test.ts","line":26}]
finding_counts: {"high":0,"medium":1,"low":0}

Completed replacement review not clear, A-19567: one medium test-ownership finding confirmed by lead. Coordinator73ecf6ff C2 removal is reflected in tracker/source; all historical deletion code/test/guide/owner receipt removed, safety finding remains A-19566 for T-1865. Routing/nested disposal source otherwise reviewed; full-name default correct, original system snapshots prefix-only. C1 unverified pending authorized clear-head unrestricted preservation; C3 test correction then fresh source review required. Consumer/provenance supplement remains in preparation, no graph-to-execution upgrades. Hold released; no Reviewer runtime/cleanup/census/provenance run.

Criteria: C3 failed (The component exact-name regression observes unowned global namespaces under ordinary parallel T2 execution.).

### impl-1806 · 2026-11-15T07:12:07.766Z

Replacement 6c6506a38661be0ab72c8c3bafd7b59537fcbc69 fixes A-19567: component inventory is over an owned parent, actual socket storage must resolve under child root, exact captured alias must be absent after disposal. No global equality in parallel T2. Supplement A-19568 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-19568-t-1806-pinned-consumer-inventory-and-original-evidence-provenance preserves all 135 A-19551 paths, conservative 1,523 consumers with tiers/dispositions/hashes, original execution provenance and explicit scan/retention limits. Its working-tree source hashes match this replacement commit's corrected files; base e9f1b2ba4 is recorded. This source pass ran no local native/census/provenance tests. Coordinator 8bfacbfe authorizes full-name read-only C1 native preservation at a clear head before verify; historical/retained leftovers stay untouched.

### rev-35 · 2026-11-15T07:15:54.796Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1806-source-2
commit: 6c6506a38661be0ab72c8c3bafd7b59537fcbc69
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at clean6c6506a38661be0ab72c8c3bafd7b59537fcbc69/tree1d1c2fff1398646b8e0fb3bc1cba852fd660c882. A-19571: A-19567 resolved by owned-parent inventory, actual socket realpath containment and exact alias-disappearance assertions; no global T2 observer. C1 routing/disposal unchanged; unsafe C2 scope remains removed/T-1865. A-19568 audit retains135originalpaths/all1523rows, pinned tiers/manifest and current source hashes match, actual/planned/deferred/unknown separated. C1/C3 unverified pending Coordinator8bfacbfe clear-head full-name seven-file native slot, then same-head mode-free verify; contamination attributed/no old-prefix upgrade/no leftover cleanup. No Reviewer runtime/census/provenance run. RemainingT3/T4/parentstage separate, QA none per item.

### impl-1806 · 2026-11-15T07:22:20.280Z

Same reviewed head 6c6506a38661be0ab72c8c3bafd7b59537fcbc69 native C1 evidence complete under Coordinator 8bfacbfe: A-19573 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-19573-t-1806-full-name-native-preservation-at-reviewed-6c6506a38, exact retained launcher A-19572. All seven files 52/52, zero failure/cancel/skip/todo. Full unfiltered system /private/tmp, per-user TMPDIR and suite root name sets unchanged around every file and overall; no contaminated interval. Head/source hashes retained, case lines/counts/native completions independently checked; narrow scan positive control and zero matches. Suite root retained; no historical/development-leftover cleanup. This is local macOS arm64 Node24.21.0 targeted native coverage, not full suite/Linux. Now submitting mode-free exact-head verification; remaining unchanged T3/T4/Web and batch coverage remain separate.

### rev-35 · 2026-11-15T07:44:55.566Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1806-evidence-1
commit: 6c6506a38661be0ab72c8c3bafd7b59537fcbc69
scope: evidence
findings: [{"severity":"medium","text":"Shared tempProject now creates .fixture-sockets, but exact-content consumers artifact-lifecycle:240, artifacts:338 and config-set:418 retain empty/old baseline expectations. All three fail in A-19577; capture complete pre-operation names and assert complete after equality, retaining unexpected-write detection.","file":"hub/test/harness.ts","line":367}]
finding_counts: {"high":0,"medium":1,"low":0}

A-19578 completes the failed-evidence pass. A-19577 is red with three direct fixture-baseline consumer failures, independently confirmed and accepted by lead; no timing/shared-defect waiver or unchanged retry. Ordinary finishes 5605 pass/3 fail across 597 pass/3 fail files; separate load180test/175file positives. T0/T1 pass, T2 fails, Web unexecuted/browser null. Native A-19572/A-19573 separately audited: exact source/launcher hashes, 52/52 across seven files, full sorted unique system/user/suite name arrays equal per file and overall, child status0/signalnull. Positive C1/C3 support retained without final verification marks while compatibility gate fails. C2 stays T-1865; old unsafe/prefix-only evidence not upgraded. Preserve red run and publication/capture/report-mode/T3/T4 boundaries. Hold released for corrected source and fresh review; Reviewer ran no runtime/census/cleanup/provenance experiment.

### impl-1806 · 2026-11-15T08:18:12.994Z

Consolidated replacement e5c0486c576f715e552d67ae73582db30065c8ab, pushed. Chose lazy setup after all-tier sweep exposed prepared-project (30 consumers incl T4) and tracker-native T3 exact guards. tempProject registration adds no entries; first allocation persists existing marker. Shared fixtureEnvironment seals exact layout root after overlays, with explicit projectRoot separate from worker account HOME; CLI/projectHub wrappers pass it. New spawned-hub child control checks first allocation, layout-root binding, persisted reader, native close and alias disposal; not executed before source review. Original artifact-lifecycle/artifacts/config-set/prepared-project/tracker-native-boundary source assertions are byte-identical to 6c6506a38. All-tier listing ledgers A-19581/A-19582 retain 592 candidates (250 listing lines, 351 indirect matches, 9 overlap), 30 prepared consumer files and 305 direct environment consumers with tiers/contexts/dispositions/hashes. Local source pass: empty-root control red before lazy fix; then host-records 13/13, socket-path 6/6, sealing 6/6, three original failed cases 1/1 each; final wrapper/native control unexecuted. Hub typecheck and static checks passed. A-19577 remains red; A-19573 only old-head evidence. Root artifact-staging folders removed after publication per Coordinator; future staging in worktree ignored .tmp. No historical/private-temp cleanup.

### rev-35 · 2026-11-15T08:23:06.252Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1806-source-3
commit: e5c0486c576f715e552d67ae73582db30065c8ab
scope: full
findings: [{"severity":"medium","text":"Lazy optedInRoots retains disposed non-tempProject roots: registerFakeHosts and the deep-root test discard the disposer, while removeFixtureSockets never retires matching registrations. No active-root bound/release owner exists in source. Bind registration retirement to the owned root lifecycle, retaining active/replacement identity safety.","file":"shared/fixture-sockets.ts","line":9},{"severity":"medium","text":"Cold-child control supplies an absolute fake-host root, so registerFakeHosts independently enables memory opt-in before allocation. It can pass if the new environment grant is ignored; layoutRoot equality only proves field construction. Isolate a first allocation with no marker, memory grant or fake-root grant and prove the sealed exact-root grant is consumed.","file":"hub/test/fixture-socket-lifecycle.test.ts","line":25}]
finding_counts: {"high":0,"medium":2,"low":0}

A-19583 completes the reworked lazy source pass at clean e5c0486c5/tree38b3cf52. Standards two medium findings; Spec no additional findings. A-19578 eager-baseline problem resolved in source; original five exact-content consumers byte-identical, no filtering/weakened assertions. Source/manifest fingerprints in A-19582 match; prior union retained; static candidates are not executions and object tiers require .tier normalization. C1/C3 remain unverified pending correction, fresh source review and exact-head native/configured receipts. A-19577 remains red; A-19573 native52/52/full-name evidence old-head-only. C2 stays T-1865, no historical cleanup. Hold released for consolidated correction; no pre-clear native run or unchanged retry requested. Reviewer performed read-only source/Git/artifact analysis only.

### impl-1806 · 2026-11-15T08:36:15.638Z

Replacement fa6cb7c65d1151a11e26514216d651095eebb3ac committed/pushed. A-19587 fingerprints supersede A-19586: shared root disposal captures/retire matching opt-ins after successful alias cleanup; each registration has its own admission token so an old disposal cannot delete a newer same-inode grant. Both public-boundary T2 regressions observed red then green; final socket-path8/8 and host-records13/13 local macOS, hub typecheck/static checks passed before cover-quiet bd28504a. Cold-hub control now bootstraps its first synthetic record before hub startup with no marker/memory/fake-root grant, then starts inert-Host hub from persisted record and checks initial/restored storage + both root bindings + native close. T3 case unexecuted pending review/native slot. Removed obsolete post-root fallback deletion hook. Original five exact-directory consumers unchanged. C1/C3 done, final evidence pending. Coordinator cover-quiet: no local tests/native/load until release notice; dev frozen and merge held for stage-5 QA. Next: clear source, quiet release, same-head native, mode-free verify, ready. A-19577 red and A-19573 old-head-only retained.

### rev-35 · 2026-11-15T08:37:59.160Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1806-source-4
commit: fa6cb7c65d1151a11e26514216d651095eebb3ac
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-19588 source clear at clean fa6cb7c65/treeeaa1efc5: both A-19583 findings resolved. Root disposal retires captured registration identities only after successful alias cleanup; per-admission objects preserve newer grants. New T2 public-behavior controls cover discarded nested grants and replacement admission. Cold child first allocates before hub startup with no marker/memory/fake-root alternative, then restores its persisted host under inert Host and checks initial/restored storage, sealed root, native close and independent reader. Five original exact-directory consumers unchanged; no filtering. All A-19587 source hashes match. C1/C3 remain unverified pending exact-head preservation/configured evidence. Cover-quiet bd28504a remains binding: no local/native/load/merge until Coordinator release; source verdict does not release it. After release, authorized same-head slot then mode-free verify; changed head requires review. A-19577 remains red, A-19573 old-head-only; C2 stays T-1865, no cleanup authority. Hold released; no Reviewer runtime/census/cleanup/provenance run.

### impl-1806 · 2026-11-15T10:03:08.759Z

Source-clear fa6cb7c65d1151a11e26514216d651095eebb3ac same-head native occasion completed after quiet release: A-19596 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-19596-t-1806-fa6cb7c65-full-name-native-control-evidence-88-of-88), original launcher A-19595. Ten serial files 88/88, zero fail/cancel/skip/todo: cold-child lifecycle6, prepared-project1 (T4), tracker-native-boundary29 (T3), seven C1 host files52. Each full unfiltered system/user/suite before-after and overall delta empty; no contamination/retry; exact head/source hashes/native completions/case facts retained. MacOS arm64 Node24.21/local/no browser; normal owned fixtures disposed, historical/development leftovers untouched and suite root retained. Lock released under15min. Not full T3/T4/Web coverage. Publishing to Reviewer and submitting fresh mode-free verification now; A-19577 remains red and A-19573 old-head-only.

### impl-1806 · 2026-11-15T10:23:47.881Z

Configured run 8dd973c2/A-19602 is failed, not passing: T0/T1 completed, T2 one failure, selected T3 and Web unexecuted. Actual 422 case result at host-provider-digitalocean:368 was ['created','failed','created'] vs three created. Coordinator ba007232 classifies this as known shared T-1862, adds evidence there and authorizes exactly one mode-free retry at unchanged fa6cb7c65 after Reviewer finishes failed-evidence pass. No local experiment, diagnosis or source fix on T-1862. If same case fails again, report/stop. Same-head native/control A-19596 remains independently 88/88 with full-name preservation.

### rev-35 · 2026-11-15T10:25:00.122Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1806-evidence-2
commit: fa6cb7c65d1151a11e26514216d651095eebb3ac
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-19606 completes failed-evidence pass for8dd973c2/A-19602: ordinary5609pass/1fail,599pass/1fail files; separate190loadtest/185file positives. T0/T1 pass/T2 red, selectedT3/Web unexecuted. Sole422 final concurrency failure actual created/failed/created has no failed-result reason captured. Coordinator ba007232 directly read: known shared T-1862, exactly one unchanged fa6cb7c65 mode-free retry after this pass, no local experiment; repeated same-case red report/stop, other reds normal ownership. No new T1806 source finding. Earlier three fixture-content failures now ordinary pass. Same-head native A-19595/A-19596 independently audited: source/launcher hashes,88/88tenfiles, status0/signalnull, full sorted unique system/user/suite sets equal per-file/overall, sole-env cold/prepared/tracker controls positive; targeted scope preserved. C1/C3 unverified until new configured settlement. A-19602 stays red, A-19577 failed/A-19573 old-head; C2 T1865/no cleanup. Hold released, completing Coordinator retry prerequisite. Report-only/platform/capture/broadT3/T4 boundaries retained; no Reviewer runtime.

### impl-1806 · 2026-11-15T10:26:24.560Z

After Reviewer failed-evidence completion A-19606, executed Coordinator ba007232's exactly one unchanged-head retry: 064b9526-d2cd-413c-98c9-f753467f9e63 at fa6cb7c65. Durable hub admission and CLI exit0/queue position1 observed; configured result pending. No local/shared-test experiment or source/native changes. Same 422 case failure again => report/stop. Prior configured failures A-19577 and A-19602 remain red; A-19602 is attributed to shared T-1862; same-head native/control A-19596 remains88/88.

### impl-1806 · 2026-11-15T10:54:26.051Z

Authorized retry 064b9526/A-19615 passed at unchanged reviewed fa6cb7c65: hub aggregate6351/6351, zero fail/cancel/skip/todo. T0/T1/T2 + changed T3 file6 identities + Web55files/292 executed; remaining T3/T4 retained their batch/integrated split. Incremental log audit confirms actual finish/pass for all nine required generated cases, including shared422 recovery and original three exact-directory guards. New discarded/replacement/owned-parent cases each base+5 load completions, cold hub one T3 base. Provenance Linux x64 6.8.0-147-generic/Node24.21.0/Neovim0.12.5/droplet, isolated Headless Shell1248 Google Chrome for Testing156.0.8078.4. Report-only duration/ratchet notices are advisories, not enforced gate passes. Native A-19596 independently88/88 full system/user/suite names unchanged at same head. A-19577 remains failed prior own-source evidence, A-19602 remains failed known T-1862 flake. Final Reviewer C1/C3 settlement pending; no source change, claim retained.

### rev-35 · 2026-11-15T10:59:43.920Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1806-final-1
commit: fa6cb7c65d1151a11e26514216d651095eebb3ac
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear A-19618, accounting A-19617. Exact source-clear fa6cb7c65 unchanged; authorized single retry064b9526/A19615 actual6351ordinarytest/700file passes, separate190loadtest/185file positives, no negatives. All981manifest accounted:220T1/424T2/55Web+changedT3one actual ordinary file pass; required25load cases each joined to their file envelope. Native A19595/19596 independently verified88/88tenfiles, direct child status0/signalnull, full sorted unique system15553/user9990/suite2 arrays equal every file/overall; cold sole-env/prepared/tracker guards pass. C1/C3 verified; C2 remains T1865/no cleanup. Original1523consumer identities retained plus82manifest boundaries, inherited unknown/source flags preserved; filename false-positive represented by durable source-row pointer. Actual Linux/Node24.21/Nvim.12.5/Headless1248CfT156 noncached provenance correct; report-only lint/budgets/ratchet are not enforced/performance clearance. Remaining258T3/16T4 and parent occasions deferred; per-item QA none. A19602 stays failed sharedT1862, A19577 stays failed own-source, A19573 old-head. Hold released; no Reviewer runtime/native/census/provider/browser/merge action.

Criteria: C1 verified, C3 verified.

### impl-1806 · 2026-11-15T12:43:20.002Z

Batch regression correction in progress at 267db462901d95dc6cd3ed6a87a4839eb0b37b75. Original unchanged fa6 native red/stat UID evidence A-19654 confirms registration switched from cland-h fallback to ct/hash only at later hub startup; raw sshHostFixture now enrolls before registration. A-19657 preserves the next partial red: Git copied socket metadata with mode755 into remote worktrees and real privacy cleanup rejected it. Raw fixture now initializes disposable Git and installs /.fixture-sockets/ in .git/info/exclude before allocation, with positive seed + exact committed-tree/clone metadata-absence regression. All18 native importers and all981 pinned manifest tests (265T3) listed in A-19658, source-only decisions distinct from runtime coverage. Coordinator c9dc3067 authorized expanded19 serial native set at this exact head; currently running. Historical/development/run residue remains untouched; C2 stays T-1865.

### rev-35 · 2026-11-15T12:56:24.763Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1806-source-5
commit: 267db462901d95dc6cd3ed6a87a4839eb0b37b75
scope: delta
findings: [{"severity":"medium","text":"The new init→exclude/enrollment continuation and host-runtime-join's Git/FS clone sequence have no cancellation fence or whole-sequence join before fixture teardown disposes storage/root. Native census and per-command timeout do not drain awaiting JavaScript continuations. Fence new work and join admitted sequences before disposal; prove the failure path with held work.","file":"hub/test/ssh-host-fixture.ts","line":59}]
finding_counts: {"high":0,"medium":1,"low":0}

Complete pinned three-path delta pass, both Standards and Spec: one medium rule-12 finding, confirmed by lead b1a5ffed. A-19662 records source/consumer review and independent qualification of 19-file/156-pass normal-path evidence. All18 fixture importers accounted; all981 manifest tier/hash rows match. No additional findings. C1/C3 final freshness pending correction and same-head verification; C2 remains T-1865. Prior fa6 configured/native failures retained as history, not relabelled. Hold released; fresh corrected source review before configured verification.

### impl-1806 · 2026-11-15T13:08:07.235Z

Source-5 correction committed/pushed b4d585bae7feaf0edca07a09253848d7a725ff18. A-19665 (observerA-19663/launcherA-19664) proves native failure path red on unmodified archived267 (Git completion callback held across old disposal/root disappearance) then current runtime-join5/5 green including held init and held clone. Exact full system/user/suite deltas empty; Mac arm64 Node24.21/local/no browser. New shared scope fences admission and joins complete sequences before DB/native/root disposal;35s missed join preserves ownership/root. Hub typecheck passed. A-19666 retains current981 tier/hash rows and new helper/field consumers; prior all18 root/Git audit unchanged. Fresh source review requested; Coordinator1787d473 requires current final-reviewed-head19-file slot before mode-free verify. Prior156/156 remains old267 normal-path-only evidence; C2 T-1865, no retained-root cleanup.

### rev-35 · 2026-11-15T13:10:30.401Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1806-source-6
commit: b4d585bae7feaf0edca07a09253848d7a725ff18
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-19669 completes both axes across all four changed paths. A-19662 resolved: synchronous admission abort, whole admitted setup/clone promise ownership and attempt-all join precede native/DB/root disposal; missed35s join reports incomplete and retains ownership. Actual held-init/clone regressions pass and fence continuations; original Git exclusion control uses same scope. All981 manifest tier/hash rows and declared fingerprints match; new helper/field consumers accounted,18 importer root assumptions retained. Independently checked A-19665 expected red archived267/green5-of-5, direct status/signal/error and full sorted unique name equality. Targeted Mac coverage only, C1/C3 current-head final verification pending; C2 remains T-1865. Coordinator1787d473 directly read: final reviewed nineteen-file serial preservation in<=15min slots, then mode-free verify, no retained-root deletion. Hold released; changed source requires fresh review; no Reviewer runtime/census/cleanup.
