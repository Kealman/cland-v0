---
id: T-1500
kind: task
title: Other Unix-socket test fixtures are not safe under a deep TMPDIR on macOS
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - needs-triage
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1272
branch: t/T-1500-other-unix-socket-test-fixtures-are-not
created: 2026-10-31T04:21:28.348Z
updated: 2026-10-31T20:18:33.394Z
closed: 2026-10-31T20:18:33.394Z
---

## Summary

T-1499 fixed the admission exchange socket, which exceeded macOS's 104-byte `sun_path` limit under the suite temp root. Its rule 20 audit, recorded on T-1499, found the remaining direct Unix-socket fixture paths in hub/test, nvim/test and web/test. They fit today's suite root but are not safe under a deeper TMPDIR. A longer suite root or project path would break them on macOS the same way. Follow-up of T-1499 (0.3.1).

## Acceptance criteria

- [x] C1. Every Unix-socket listener created by test fixtures allocates its path through one shared helper that budgets UTF-8 bytes including the NUL under 104, independent of TMPDIR depth, and a control proves a deep TMPDIR (≥ 90 bytes) still binds.
  - done: impl-1500 · 2026-10-31T14:50:46.362Z
  - verified: rev-26 [reviewer] · run rev-20261031-1500-evidence-2 · 2026-10-31T15:54:12.644Z · commit 6aaba7080ddc9ad1769f4b0cb119ca8c10f10646
  - verified: rev-26 [reviewer] · run rev-20261031-1500-evidence-3 · 2026-10-31T19:23:31.780Z · commit 133a4da02b6f82618b624232402a5c58a3f01d2e
  - verified: rev-26 [reviewer] · run rev-20261031-1500-evidence-4 · 2026-10-31T20:08:17.787Z · commit 133a4da02b6f82618b624232402a5c58a3f01d2e
  - verified: rev-26 [reviewer] · run rev-20261031-1500-source-7 · 2026-10-31T20:11:37.596Z · commit 5af0807b4f4227462d3ec39ec99676bbe92028d7

## Comments

### impl-1500 · 2026-10-31T14:45:21.575Z

C1 seam: shared fixture path allocator + real native listen/close with >=90-byte TMPDIR. Consumer audit searches .sock, listen, createServer/createSocketEdge, controlPath, --listen across hub/test, nvim/test, web/test. Production layout and absent socket/discovery assertions remain unchanged. Migrating explicit stub/listener/control paths and matching client reads; no wire contract changes.

### impl-1500 · 2026-10-31T14:48:58.660Z

Consumer audit complete: explicit hub fixture listeners migrated in account-cli, admission-exchange, artifact-lifecycle, cli, codex-native, cover-quiet, fakes/legacy-remote-hub, harness-framing, hub-status-component, init-machine-lifecycle (generated child import), item-lead, name-reservation, plan-stage-fixture, prompt-races, request-guard, roles-snapshot-cli, session-brief[-component], session-credential-io, suite-admission, task-card-component, test-admission, tracker-rank, verify-submission, visibility-component, web-auth and web-authority. Neovim stub callers and all control lookups migrated, plus client.ts native RPC --listen and startup-budget-support listener. Web tests have no direct Unix listeners; they consume migrated hub/Neovim fixtures or production daemons. Remaining sockets: production daemon/layout/edge lifecycle assertions, fake-codex receiving production argv, absent/occupied socket controls and textual test-lint samples stay unchanged to preserve production contracts. Raw frames/previous wire shapes unchanged; endpoint is still an ordinary path. Native server.close retains unlink ownership; no directory writer/cleanup order changes. Full exact file inventory will accompany source review artifact.

### rev-26 · 2026-10-31T14:55:23.230Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1500-source-1
commit: 82572ae35d467546104ea6cbabedce049e00194c
scope: full
findings: [{"severity":"medium","text":"M1: new sockets live directly in global /tmp outside owned fixture roots. Neovim ownStubClient deliberately SIGKILLs its group, bypassing native close/unlink; root/dir cleanup now leaves RPC/control nodes behind. Admission loses private socket-root owner too. Add private short-path ownership cleanup after positive listener/child+peer drainage, retain on incomplete drain, and normal/killed/incomplete controls.","file":"test-support/socket-path.ts","line":11}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14895 full source review: consolidated M1 only, no additional findings. UTF8+NULbudget/shared identity/path migration/native deepTMPDIRbind source reviewed; all nonimport hunks and listener/client inventory checked, remaining production/absent/occupied/static launch paths have documented dispositions. C1done/runtime-unverified; ownership finding does not refute native path-budget fact, no failed criterion marked. Reported local58file/typecheck/lint outcomes remain partial, original output/provenance needed at final audit. Related inherited-credential failure independently documented inT1525. Finish M1 with shared lifecycle owners/controls, fresh exact pushed-head source review before configured verify. No tests run by reviewer; no dev merge/full local run requested.

### impl-1500 · 2026-10-31T14:59:51.977Z

Addressing review M1: shared allocator now creates private 0700 short directories per canonical fixture root; endpoints remain stable within the owner process and are passed to child listeners through argv/env. removeFixtureSockets is called only by hub and Neovim directory owners beyond resource/native-child drainage. Hub cleanup now matches Neovim's existing incomplete-drain retention: resource errors retain directories, with remaining disposals and final checks still run. Consumer audit includes ownDirectory callers/generated process-cleanup fixtures, hub signalDirectoryCleanup/removeDirectory and nvim ownDirectory/beforeDirectories. Existing positive process ownership and signal fences unchanged. Adding native normal-close, SIGKILL residual endpoint cleanup, and live-endpoint retention after a failed drain; privacy regression failed first on global /tmp mode 0777 vs required 0700.

### rev-26 · 2026-10-31T15:07:31.155Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1500-source-2
commit: 68e0372b9ac3a52c91dda8afbd15b4165b727e7d
scope: full
findings: [{"severity":"medium","text":"Remaining M1: random external private socket directories are known only to the allocating process's Map. SIGKILL of that worker loses the association; fixture guard/suite recovery has an empty registry and removes the root while leaving socket directories behind. Preserve recoverable identity-bound ownership before allocation is lost, then prove a separate recovery owner drains the killed allocator/listener and removes both roots; retain evidence on incomplete drain. Existing killed-listener control keeps its allocating parent alive and misses this boundary.","file":"test-support/socket-path.ts","line":6}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14912 full source2 review: private 0700 ownership, normal/killed-listener cleanup and incomplete-drain retention reviewed; all 12 revision paths read, no further findings. Remaining M1 is allocating-worker crash recovery, with pinned existing fixture-guard/suite-lock/load-gate source receipts in artifact. C1 done/runtime-unverified; no failed mark because native path-budget fact is not refuted. Local 59-file output A-14905 and final 3/3 lifecycle excerpt A-14906 stay targeted Mac evidence; intermediate timeout remains incomplete. Finish consolidated M1, fresh exact pushed-head review before verification. No reviewer test execution/dev merge.

### impl-1500 · 2026-10-31T15:11:21.285Z

Remaining source2 M1 now addressed without a process-local ownership registry: actual socket nodes are in private .fixture-sockets directories under disposable roots. Short /tmp symlink aliases have reciprocal root-owned records installed before alias creation. Recovery incrementally scans only the captured disposable root tree without following symlinks; it validates each alias shape and exact reciprocal target, then unlinks the alias (no external recursive deletion, no global sweep). Existing directory owners still fence this behind writer drainage and own ordinary root removal. New nested worker-allocates/binds -> SIGKILL -> fresh-parent close/removal control failed first with Missing expected rejection, then passed. Final lstat checks prove alias deletion rather than only a dangling target. Deep UTF-8 TMPDIR native bind remains green on macOS.

### rev-26 · 2026-10-31T15:17:46.763Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1500-source-3
commit: 35d278d9f9ef740a00692c7e331f435831509c8e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14921 full source3 clear: remaining M1 closed by root-owned actual nodes plus reciprocal short aliases, recoverable by independent fixture and public suite owners after existing native/root-identity drainage. All eight revision paths read; no new process/quarantine authority, global sweep or external recursive deletion. Native separate-worker controls require lstat alias deletion; normal/killed-listener/incomplete controls and deep UTF8 bind remain. C1 done/runtime-unverified, no verified mark. A-14918 raw59-file + two final5-case runs/A-14919 Mac provenance remain targeted local evidence; earlier intermediate timeout remains incomplete. Submit one mode-free configured verify at frozen35d278d9f, then original-record final review. No reviewer tests/dev merge.

### rev-26 · 2026-10-31T15:35:13.111Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1500-evidence-1
commit: 35d278d9f9ef740a00692c7e331f435831509c8e
scope: evidence
findings: [{"severity":"medium","text":"Original A-14947 fails native-bind consumer: helper realpathSync throws ENOENT synchronously on deliberate absent root before setup owner/listen. Preserve a genuine native bind-error and disposal control under portable socket ownership; do not relabel helper failure as native refusal. Original cec33b90 remains failed; successor source4 is separate.","file":"hub/test/fakes/legacy-remote-hub.ts","line":26}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14953 original-record not-clear: actual ENOENT realpath stack quoted before classification, paired native-bind fail14476→14477/file14559. Ordinary3759pass+1fail/3760test, separate10loadpasses; T0/T1green,T2red,Neovim/T3/T4/Webunexecuted,browsernull. Linuxdroplet exact35d278d9f/candidate7f99a23dd vsGit onlyexcludedtracker/rules. Report-only advisories unchanged. C1budget fact done/runtime-unverified, no unrelated failure mark. New6aaba7080 source4 request received during audit will be reviewed separately; no green relabelling.

### rev-26 · 2026-10-31T15:35:59.084Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1500-source-4
commit: 6aaba7080ddc9ad1769f4b0cb119ca8c10f10646
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14954 source4 clear, only remote-cli test+guide changed. Existing owned root and occupied shared portable endpoint now produce genuine native EADDRINUSE through setup/disposal; listening=false/empty peers/writers assertions and bounds retained, no helper/process authority changes. Source3 recovery/path budget source audit A-14921 unchanged. A-14951raw23/23/nativeexit0+A-14952Macprovenance/typecheck/lint summary reviewed; earlier59file evidence remains prior-head. Originalcec33b90/A-14947remainsred, laterphasesunexecuted. C1done/runtime-unverified. One configured mode-free retry at frozen6aaba7080 then original generated-case/native evidence review; no dev merge.

### rev-26 · 2026-10-31T15:54:12.644Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1500-evidence-2
commit: 6aaba7080ddc9ad1769f4b0cb119ca8c10f10646
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14962 successor original220d380c/A-14958 at exact6aaba7080 independently audited. 5086matching pairs,4536ordinarytest+530file passes,separate10loadtest+10loadfile passes,no adverse/missing/duplicates;sevenfailurearrays[]. C1verified: deep multibyteTMPDIRnativebind andprivacy eachbase+5sequentialloadpasses; correctednativeEADDRINUSE14504→14505 and all five normal/killed/incomplete/separate-allocator/public-sweep lifecyclecasespass. T0host/T1/allfallbackT2inclNeovim/selected10T3files/selectedT4once/Web0;remainingtiersunexecuted,T4repsskipped. T3duration71identities50.597s/T4one11.716s excludingmachinewait,notrepeat/full-allclaims. Linuxx64dropletc8lon1Node24.21/Nvim.12.5,actualShell1248Chrome156.0.8078.4;candidate41ac vsGitd3e2 only1525excludedtracker/rulespaths;cache/occasionnull/skips[];reportadvisoriesretained. MacA14918/19 remainprior35d278 relevantcodeunchanged;A14951currentnativecorrection23/23,notfullMacrun. OriginalA14947remainsred andearlierlocaltimeoutincomplete.

Criteria: C1 verified.

### rev-26 · 2026-10-31T16:05:51.164Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1500-source-5
commit: a46c6f93695fb720cef429bd523b053d7bbdeece
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14971 authorized merge delta clear. Parents6aaba7080+715ad1cdc/tree23a5298c; cover-quiet combines portable allocation with incoming fixtureEnvironment/runner builder, synthetic sentinel actor/identity stripping and all acquisition/drain fences; only new sentinel endpoint migrated. Own helper/recovery/controls byte-identical source4; other importedcode matchesdev. Docssections/index retained,no markers. A14967raw24coverquietpasses/A14968raw59fileexit0 plusA14969Macprovenance/typechecklint summary staytargeted,notcurrentLinux/full. C1old-headverifiedA14962 remains6aaba; fresh runtime mark pending Coordinatorverifyall atmergeda46. OriginalA14947failed/localincomplete retained. Findings[],no duplicate taskverify or newdevmerge.

### rev-26 · 2026-10-31T19:05:54.522Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1500-source-6
commit: 133a4da02b6f82618b624232402a5c58a3f01d2e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-15052 full continuing source6 audit: all12 changed paths read. Best-effort resource/hub/directory/final-check ordering and aggregate errors restored; ownDirectory root/native/live-writer fences unchanged. Incomplete lifecycle control now uses explicit live-listener removal guard and retains positive shutdown/retention/removal assertions. Shared Node module is byte-identical to prior canonical helper; compatibility export remains, hub/Nvim import directly, no wire/browser barrel exposure. Docs/skill provenance aligned. Original A-15044 failed full run's three teardown outputs quoted and preserved; Web unexecuted. Local original red A-15047 and green A-15048/49/50 show61/19/5 passes/nativeexit0 with Mac provenance supplied by A-15051; static/build/typecheck/lint are qualified lead receipts, no reviewer workload. C1 old6aaba verification remains old/stale; fresh exact-head runtime evidence pending. No remaining Standards or Spec findings.

### rev-26 · 2026-10-31T19:23:31.780Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1500-evidence-3
commit: 133a4da02b6f82618b624232402a5c58a3f01d2e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-15060 audits original A-15059/run13bf81df at unchanged source6 head. C1 verified: native deep>=90UTF8 TMPDIR/path+NUL<104 and private ownership each base+5 distinct load passes; five lifecycle/retention/killed-allocator recovery cases plus native EADDRINUSE pass. 5156 complete matching progress pairs:4605ordinarytest/531file plus10loadtest/10loadfile passes, no adverse/unpaired, seven failure arrays[]. T0/T1/allfallbackT2 inclNeovim/selected11T3/oneT4base/Web exit0; remaining tiers unexecuted, T4repetitions skipped. All three prior A-15044 failed case identities ABSENT; their A-15048/49/50 Mac targeted receipts remain local, prior full run stays failed, Coordinator full rerun remains required after readiness. Exact Linuxx64 droplet head/candidate provenance checked; candidate differs only1526excludedtracker/rules, actual isolated Shell1248 Chrome156.0.8078.4, cache/occasionnull/skips[]. Typecheck host reuse, report-mode advisories retained. No reviewer workload or full-Linux-recovery claim.

Criteria: C1 verified.

### rev-26 · 2026-10-31T20:08:17.787Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1500-evidence-4
commit: 133a4da02b6f82618b624232402a5c58a3f01d2e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-15067 independently audits Coordinator full e2a27cbb/A-15066 at exact source6 code head. All three A-15044 teardown failures now pass on Linux: unreadable-birth27571, every-resource/directory27627, suite-fixture child cleanup30203. C1 deepbind/private and five lifecycle cases each base+5 sequential load passes. 7197 complete matching pairs:6080ordinarytest passes/8explicit skips/724file passes; separate200loadtest/185loadfile passes, zero adverse/unpaired and six empty failure arrays. T0/T1/T2/T3/Web native exit0; no T4 phase. Eight skip identities/reasons exactly match provenance(macOS sandbox/caffeinate or missing OpenCode). Exact head/candidate tree checked as in A-15060, no cache, Linuxx64 droplet Node24.21/Nvim0.12.5, actual isolated Shell1248 Chrome156.0.8078.4; host typecheck reused. T3 ratchet2305.593 vs2303.646 and other overages retained as report-only, not gate passes. Prior full red, selected and Mac receipts retain limits. No reviewer workload. C1 verified/full Linux confirmation clear at this code head; any docs-only merge needs separate delta review.

Criteria: C1 verified.

### rev-26 · 2026-10-31T20:11:37.596Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1500-source-7
commit: 5af0807b4f4227462d3ec39ec99676bbe92028d7
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-15072 exact merge-delta clear under independently read Coordinator3afa16b7 authorization; e2a27cbb stands as full code run. Parents133a4da02+7bf54c8ac/tree00e9562f. Classified101 changed paths:96 matchdev, five composed docs/index/helper/tier files checked. Portable skill/README sections exact full-parent text, incoming sections retained/no markers. All75 own code paths match fullparent except expected legacyRemoteHub remoteStatus callback composition and additive tiers rows; canonical socket owner/cleanup/sweep/Nvim/lifecycle logic unchanged. Local A-15068/69/70 original61/19/5 passes/nativeexit0 and A-15071 Mac typecheck/static summary remain targeted, no merged-head full run claimed. C1 refreshed through explicit carry of A-15066/A-15067 at133a4da02:6080passes/8explainedskips,T0–T3/Web0,T4unexecuted, all three prior Linux failures passing. Prior red/selected/local limits and report ratchet growth retained. No findings or reviewer workloads.

Criteria: C1 verified.

### coord · 2026-10-31T20:18:33.394Z

Merged 07c18fb5949a71a723078aeae04f3eab35dcaaff onto dev.
