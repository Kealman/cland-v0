---
id: T-2048
kind: task
title: Prepared executor snapshot is built on c-8, so a --size c-4 run can't restore it (blocks the T-2036 sizing measurement)
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1693
branch: t/T-2048-prepared-executor-snapshot-is-built-on-c
created: 2026-11-21T03:51:03.851Z
updated: 2026-11-21T11:11:11.627Z
closed: 2026-11-21T11:11:11.627Z
---

## Summary

T-2036's c-4 control run 079f98c4 (A-22315) at 895ad0152 failed before any test: "prepared snapshot disk does not fit size c-4". The prepared executor snapshot (cland-v0-55b441bac95e) was built on the configured c-8 droplet, and a DigitalOcean snapshot can only restore to a droplet whose disk is at least the snapshot's size, so no smaller size can use it. `cland executor prepare` has no size option. This blocks the human's droplet-sizing measurement (2026-10-17 decision; T-1897 C2, now T-2036) and any future move to a smaller size.

## What to build

Make the prepared snapshot usable by every size the project may request: build it on the smallest allowed size (its disk then fits every larger size), or prepare and keep one snapshot per requested size. Admission reports clearly which sizes the current snapshot fits. Keep the cost under the human's $14/day cap, and name the prepare cost.

## Acceptance criteria

- [x] C1. A `verify --size c-4` request with a prepared snapshot built for c-8 either uses a fitting snapshot or is refused at admission, before T0, naming the sizes the current snapshot fits (test).
  - done: impl-2048 · 2026-11-21T07:33:01.538Z
  - verified: rev-41 [reviewer] · run rev-41-20261121-2048-final · 2026-11-21T08:40:39.027Z · commit 72258e3406aa0234eaa5e3e6d3865aae6ec63d63
- [x] C2. After a prepare under the new policy, both c-4 and c-8 requests restore from a prepared snapshot (test with the fake provider).
  - done: impl-2048 · 2026-11-21T07:33:01.874Z
  - verified: rev-41 [reviewer] · run rev-41-20261121-2048-final · 2026-11-21T08:40:39.027Z · commit 72258e3406aa0234eaa5e3e6d3865aae6ec63d63

## Comments

### impl-2048 · 2026-11-21T03:58:11.220Z

Consumer inventory (rule 20): suites.ts validateSize/checkSpend/checkReachability before T0; droplet.ts admission, acquire and prepare; prepare.ts reuse; init/config.ts parse/render/type and init/config-set.ts managed-key schema; CLI CONFIG_USAGE and frozen commands.json. New optional snapshot_size inherits prepare_size only at executor prepare, leaving setup hosts, paidTerms, shared/wire expectedTerms and pool preparation unchanged. Existing Snapshot fields and old config shape retained. Test consumers include executor-admission, executor-prepare and component, snapshot-confirmation, suite-soak-component, suite-release-cache, suite-queue-policy, host-provider-digitalocean-prepare, host-pools-config, setup-hosts and remote/suite-unit/droplet/digitalocean-pool fixtures. Docs: running, README; host implementation/setup docs remain accurate because prepare_size still selects their builder. No skill examples or startup probes refer to prepare_size; raw field search covered hub, nvim, web, shared, docs and shipped skills. New field search has no pre-existing consumers. Frozen CONFIG_USAGE updated with config-set help.

### coord · 2026-11-21T04:00:02.745Z

C2's real-prepare clause moved out of the criteria on 2026-11-21: a real prepare can only run after this lands and the hub restarts, so it's post-landing evidence, not a merge criterion. The Coordinator runs one real `cland executor prepare` after landing and records its price, time and cost here. impl-2048's projection: about $0.0208 for 10 min, at most $0.1875 for the 90 min builder reservation.

### rev-41 · 2026-11-21T04:03:00.423Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261121-2048-source1
commit: 35452541800ce1dbaf8c8ff73d9587cfe1c64f20
scope: full
findings: [{"severity":"medium","text":"Same-key oversized replacement reuses the old key-derived name; snapshots().find(name) can select the old image and fail disk validation after a paid build. Bind selection to the captured builder and seed both provider images in the regression.","file":"hub/src/executor/droplet/prepare.ts","line":129}]
finding_counts: {"high":0,"medium":1,"low":0}

Reviewed 35452541800ce1dbaf8c8ff73d9587cfe1c64f20 against 4e07dbcb882d7ecd47a1029fcf5c218b6c229786. Source review only; Reviewer ran no tests, cloud or browser.

Standards: medium — hub/src/executor/droplet/prepare.ts:129 enables same-key replacement, but line 199 selects by display name rather than the captured builder identity (rule 26). The replacement and retained image share the key-derived name. Select the image produced by the admitted builder and cover both images in the provider fixture.

Spec: medium — the same defect blocks C2: with the existing oversized image returned first, line 199 selects it and line 203 throws 'snapshot minimum disk exceeds run size' after paying for another build. The new test writes only a pointer named 'oversized', leaving the provider image list empty, so it cannot catch the collision. Seed an actual matching-name old provider image and assert the new builder's image is restored by c-4 and c-8.

One finding, appearing on both axes; no additional low findings. C1 source path establishes admission before T0; execution evidence remains pending. C2 failed by source inspection. Implementer confirmed the missing fixture and selection issue in topic message 20c0c581-0012-4a49-9af6-08ecff410fe5. Targeted test receipts were reported by the implementer; no full configured verification receipt has been reviewed.

Criteria: C2 failed (Same-key replacement can select the retained oversized provider image by name; regression omits that image.).

### impl-2048 · 2026-11-21T04:03:59.232Z

Review fix: strengthened C2 regression seeds the real old provider image under its project/key name. Red at 354525418 source: transfer: snapshot minimum disk exceeds run size; image 900. Selection now keys on captured builder resource plus name using snapshotFromBuilder, shared with recovery ownership. Consumers: prepareSnapshot publication and snapshot-recovery belongs; field names resource_id, record.builder and snapshot name searched in provider API/fake, recovery and preparation tests. No wire shape change.

### rev-41 · 2026-11-21T04:08:45.801Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261121-2048-source2
commit: eb243b038e7ebbd4a20043c67758af5ba72c337e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at eb243b038e7ebbd4a20043c67758af5ba72c337e, reviewed against base 4e07dbcb882d7ecd47a1029fcf5c218b6c229786 and prior source1 head 354525418. Standards: 0 findings. Spec: 0 findings. Prior medium finding resolved: selection captures builder.resource and checks provider resource_id plus name; recovery imports the same ownership predicate, retaining candidate-id handling and rejecting undefined builders. Seeded same-name old provider image 900 now exercises the actual collision, with replacement-id, retirement, c-4/c-8 restore and reuse assertions. Existing config compatibility, admission-before-T0 and host-builder separation remain intact.

A-22323 records the prior source red ('transfer: snapshot minimum disk exceeds run size; image 900') and selected macOS/Node24.21 fake-provider T2 evidence 42/42; implementer reports final narrowing regression 1/1 and full lint/typecheck exit 0. Those selected receipts are not a configured verification pass. Earlier T3 6/6 belongs to 354525418, not this head. Reviewer ran no tests, native processes, browser or cloud. No source-established criterion marks added: final C1/C2 execution verification awaits exact-head full verification receipt; implementer should restore C2 done after its fix. Full review scope retained because dev did not move under the branch.

### rev-41 · 2026-11-21T04:45:37.113Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261121-2048-evidence1
commit: eb243b038e7ebbd4a20043c67758af5ba72c337e
scope: evidence
findings: [{"severity":"medium","text":"Global c-4 fake catalog addition breaks the exact price declarations consumer at host-provider-digitalocean.test.ts:321; full run records that identity failed. Migrate the consumer or scope the fixture catalog change.","file":"hub/test/fakes/digitalocean/fake-api.ts","line":66}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear for eb243b038e7ebbd4a20043c67758af5ba72c337e/tree de23113a48a1c0a44e112d22ca1c59a26c9f8a5d. A-22332 run 57eec9d0-8542-4c29-bb6d-21c035176834: 'all exit 124; stalled: no output for 10 min'; completed 6526 tests, 6517 pass, 3 fail, 6 skipped. T0/T1 completed; T2 incomplete with 44 files unexecuted and executor-prepare-retry in flight; all 273 T3 and 55 Web files unexecuted. Linux x64 6.8.0-149-generic, Node24.21, droplet c-8 ams3 workers2; browser binary/version null. Budget/test-lint advisories report-only. This is no full pass.

Medium — hub/test/fakes/digitalocean/fake-api.ts:66: global c-4 catalog addition changes provider price declarations but hub/test/host-provider-digitalocean.test.ts:321 still deep-equals c-8/second only. A-22332 structured finish for 'digitalocean declarations load API prices and limit atomically and retain the last good read' is outcome fail. Update the exact-shape consumer or scope the catalog expansion. Rule20/41 consumer inventory missed this reader.

The structured receipts also say outcome fail for executor-prepare-retry.test.ts 'executor interface drains pending preparation after omitted setup' and '... after aborted setup'; the file remains in flight. Raw assertion diagnostics are absent from the interrupted log, so their cause is not classified. Diagnose these before another source review/run; source changed prepare's old current-image shortcut to require an API sizes read, which is a path worth checking, not an established diagnosis.

C1/C2 remain unverified pending complete corrected-head evidence; no criterion failed solely for an unrelated consumer assertion or missing run. Earlier collision fix is still source-established, and its passing selected receipts do not override this failed run. Reviewer ran no tests or mutations.

### impl-2048 · 2026-11-21T04:48:10.795Z

Full run 57eec9d0 at eb243b038 incomplete (exit124 stall); T0/T1 complete, T2 incomplete with three failures, T3/Web not run. Coordinator attributed retry drain and host declaration failures to this item. Local red: expected /setup receipt deadline/ or /setup cancelled/, actual AggregateError: upload fixture drainage failed; producer error hub is stopping; executor lease retained for reconciliation. A held prepareKey resumed after close and new unconditional provider lookup used its aborted signal. Fixed by preserving legacy matching-key no-provider reuse when snapshot_size is absent; explicit snapshot_size retains disk validation/rebuild. Strengthened old-shape drain tests assert unchanged provider request count and native process exits cleanly. Global fake c-4 catalog caused declaration deep-equal extra c-4 livePerHour 0.125; restored base catalog and opted in only sizing fixtures. Consumers searched: API sizes/regions/prices, refreshDeclarations, first.prices, prepare legacy overload and executor interface, remote fixtures. No production wire shape changed.

### rev-41 · 2026-11-21T04:49:46.092Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261121-2048-source3
commit: 7607207e674771e4100dbcf54a7f596dfcca143e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 7607207e674771e4100dbcf54a7f596dfcca143e. Reviewed changes from eb243b038 and retained prior full source review context (base 4e07dbcb8); no dev merge. Standards: 0 findings. Spec: 0 findings. Prior evidence finding resolved: fake provider default catalog returns to its original c-8 shape; only the two sizing regressions add c-4. The seeded replacement regression and producer-bound publication remain intact. Matching-key reuse with absent snapshot_size restores the original provider-free path; explicit snapshot_size keeps disk-aware validation/rebuild. Existing drain tests retain setup/result/pending/root cleanup assertions and now prove no extra provider request after held-key release. Running docs qualify this compatibility behavior.

A-22334 preserves actual local red: expected setup receipt deadline/setup cancelled, received 'AggregateError: upload fixture drainage failed'; producer diagnostic 'hub is stopping; executor lease retained for reconciliation'. Incomplete interrupted diagnostic runs remain labelled incomplete. Reported selected macOS Node24.21 scripted/fake-provider T2 evidence: 173/173 across four files, then final strengthened retry file 5/5 with observed process exit0/no signal. Enforcing initial load guards below12. Implementer reports full final lint/typecheck exit0. This evidence addresses the prior failures, but does not supersede run57eec9d0's failed/incomplete full result. No Linux full rerun at this head has been reviewed; C1/C2 execution marks stay unverified pending Coordinator's full all rerun. Earlier T3 does not apply to this head. Reviewer ran no tests, browser or cloud.

### rev-41 · 2026-11-21T06:01:17.533Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261121-2048-evidence2
commit: 7607207e674771e4100dbcf54a7f596dfcca143e
scope: evidence
findings: [{"severity":"medium","text":"New missing-snapshot refusal reaches explicit droplet dry-run via checkSpend and breaks existing CLI planning regression (suite-dry-run.test.ts:57 actual1 expected0). Preserve planning behavior or migrate/document its contract and regression.","file":"hub/src/executor/droplet/droplet.ts","line":246}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear at 7607207e674771e4100dbcf54a7f596dfcca143e/tree8e7c59514f3d3e4d25561663b61ebab5c6f399a3. Full run cca62992-4c46-4f41-a406-7143b272dfe5 (A-22352) exit1. Actual failure output: 'AssertionError [ERR_ASSERTION]: cland: no prepared snapshot; run cland executor prepare', actual1 expected0, suite-dry-run.test.ts:57. Failed identity: 'CLI dry-run prints admission and planned tiers without queueing or reserving spend'. Its planning fixture has no prepared snapshot.

Medium — hub/src/executor/droplet/droplet.ts:246: the new unconditional missing-snapshot refusal in #validateSnapshotDisk changes existing dry-run planning admission. Explicit droplet dry-run calls checkSpend from suites.ts:812, which reaches #probeAvailability and the new snapshot check. This fixture/consumer was omitted from migration. Preserve intended planning behavior or explicitly migrate/document the contract and its CLI/MCP regression; do not silently count the failed test as unrelated. Existing mismatch admission C1 must remain covered.

T0/T1/T2 completed exit0; T3 completed exit1; Web unexecuted (55 files), no T4 requested. Overall producer reports 8946 completed, 8930 pass,1 fail,15 skips. Linuxx64 6.8.0-149-generic, Node24.21/Neovim0.12.5, droplet c-8 ams3 workers2, browser binary/version null; budget/lint advisories report-only. Prior retry/declaration failures are resolved in this run; passing tests do not turn the full failed run into a pass. No criterion marks added; C1/C2 remain unverified pending corrected-head complete evidence. Fresh source review required for changed head before rerun. Reviewer ran no tests or edits.

### impl-2048 · 2026-11-21T06:02:43.255Z

Second full run cca62992 at7607207e6: T0-T2 exit0, T3 exit1 (CLI dry-run test), Web unexecuted. Literal failure: AssertionError [ERR_ASSERTION]: cland: no prepared snapshot; run cland executor prepare; actual1 expected0 at suite-dry-run.test.ts:57. Head reproduction4tests:3pass1fail under load1.488<12. Fetched origin/dev792d643d8 disposable detached control4/4 but unsupported Node25.6.1, not supported proof; control worktree removed. Coordinator explicitly preserves dev behavior when no snapshot exists; disk validation only applies to existing snapshots. Source fixes missing-snapshot validator to return, leaving acquire missing-image refusal intact; docs qualify presence. Unchanged native dry-run test is exact red/green seam (presence is filesystem, no pure T1 seam); green rerun and selected T2 regressions deferred until Coordinator closes macOS quiet window. No full verify resubmitted.

### rev-41 · 2026-11-21T07:33:29.472Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261121-2048-source4
commit: 72258e3406aa0234eaa5e3e6d3865aae6ec63d63
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 72258e3406aa0234eaa5e3e6d3865aae6ec63d63. Narrow two-file fix reviewed from7607207e6 with retained prior full review context; no dev merge. Standards0/Spec0 findings. #validateSnapshotDisk now returns only for absent snapshot, preserving the original CLI/MCP planning contract; existing snapshot mismatch still uses the shared disk predicate and names fitting sizes before T0. acquire still refuses absent image before lease creation (droplet.ts:275); snapshot producer ownership and explicit builder-size policy are untouched. Running docs state snapshot presence as the condition. No fixture was weakened or populated to hide the prior missing-snapshot failure.

A-22364 records supported local red at prior source (unchanged suite-dry-run.test.ts:57 actual1 expected0; 'no prepared snapshot'), prior Linux cca62992 T0-T2 pass/T3 fail/Web unexecuted, and supported final-head local selected green: fake-provider T2 four files173/173 and unchanged native CLI T3 file4/4, macOS Node24.21, observed processes exit0/no signal, initial load guards enforce <12. Unsupported Node25 dev control explicitly excluded. Full lint/typecheck reported exit0; lint advisories remain report-only. Selected greens do not replace earlier failed full receipts. Final C1/C2 verification remains pending exact-head configured full-all rerun. Reviewer ran no tests, native/browser/cloud work or edits.

### rev-41 · 2026-11-21T08:40:39.027Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261121-2048-final
commit: 72258e3406aa0234eaa5e3e6d3865aae6ec63d63
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear at72258e3406aa0234eaa5e3e6d3865aae6ec63d63/treec08a25f731c717980ed7097d78ee1ea031c066c7. Combines prior full source review rev-41-20261121-2048-source4/A-22366 with exact-head noncached full-all run8899f6f5-58dd-467e-ae97-d23f7ddd6f39/A-22434. Standards0/Spec0 findings; earlier source and consumer findings resolved. Independently streamed structured finish records: C1 identity 'snapshot disk incompatibility refuses c-4 admission before T0 and names fitting sizes' has1 base pass+5 load-gate passes; C2 identity 'prepare replaces a matching oversized snapshot so c-4 and c-8 restore it' has1 base pass+5 load-gate passes. Reviewed source keeps pre-T0 fitting-size refusal and seeded old-image/new-builder identity, retirement,both restores and reuse assertions. C1/C2 verified.

Prior failed identities now each have a base pass: omitted and aborted preparation-drain cases; DigitalOcean declaration prices; CLI dry-run planning without snapshot. No failed receipt is reused as proof. Earlier57eec9d0 exit124/T2 incomplete and cca62992 exit1/T3 failure remain retained, not counted as passing attempts.

Run completed T0,T1,T2,fullT3 andWeb exit0; T4 not requested. Aggregate reports9422tests,9409pass,0fail,0cancelled,13skipped; provenance lists platform/prerequisite exclusions including repeated load-gate skips. Linuxx64 6.8.0-149-generic,Node24.21.0,Neovim0.12.5,droplet c-8 ams3,workers2. Browser receipt: Playwright chromium_headless_shell-1248 chrome-headless-shell,Google Chrome for Testing156.0.8078.4; Web executed. Budget/test-lint/T3-ratchet advisories remain report-only; no timing comparison or universal-platform pass inferred. Provider lifetime3740990ms/cost estimate$0.2597909722 belongs to verification, not a real c-4 preparation measurement. Fake-provider C2 is the approved criterion; real preparation, measured price/time/cost and hub restart stay Coordinator-owned after landing per item comment. Reviewer ran no tests, browser/cloud or source edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-21T11:11:11.627Z

Merged 3321d5e2b8652638ff81b628d4063e5b62478903 onto dev.
