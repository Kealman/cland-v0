---
id: T-1052
kind: task
title: Summaries and roll-ups computed in the hub, equal to the Lua's
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
topic: topic-805
branch: t/T-1052-summaries-and-roll-ups-computed-in-the
created: 2026-10-21T14:04:14.472Z
updated: 2026-10-21T18:40:59.066Z
closed: 2026-10-21T18:40:59.066Z
---

## Summary

Move the summary rule and the container roll-ups from Lua into the hub, guarded by a differential test against the Lua on a copy of the live tracker. This is E-413's first tracer bullet and the one E-416 reads without an edge, so it lands first.

## Parent

E-413 (§3.3 "The explorer's roll-ups and the summary rule"; tracer step 1).

## What to build

Each item summary in the snapshot and the deltas carries the summary text with its provenance line, by the v0.1.2 §3.9 rule that `nvim/lua/cland/explorer_summary.lua` implements. A container additionally carries done/total, the status breakdown, the derived status, glyph and layer, the stage in work, its tasks' claims and holds, the latest verdict of its subtree naming the item, and the last activity naming its source. Every item carries `blocked`; every container carries `next`. Roll-ups are recomputed only for the changed item's ancestors, and a delta carries only the items whose fields changed. The fields are projections and are never written into item files (ADR 0002). The Lua rules define the results; the Q-405 port on `prototype/web-shell` (`web/src/summary.ts`, `web/src/explorer.ts`, `web/proto/summary-lua.test.ts`) is a reference only.

## Acceptance criteria

- [x] C1. A differential test runs the hub's summary rule and roll-ups and the Lua's (`explorer_summary.lua` and the Lua roll-ups, through headless Neovim) over every body of a copy of the live tracker and reports zero differences (test).
  - verified: rev-23 [reviewer] · run rev-20261021-1052-final · 2026-10-21T15:53:19.762Z · commit ada57feabc11c66dc531cb83c07fe1f03b2a3813
  - done: impl-1052 · 2026-10-21T17:54:22.445Z
  - verified: rev-23 [reviewer] · run rev-20261021-1052-merge-final · 2026-10-21T18:36:05.097Z · commit bd3bf94fe637e8bd33cbecbc7bd32e0ba069eae8
- [x] C2. A frame client reads an item's summary with its provenance, a container's roll-ups, `blocked` and `next` from the snapshot, with no `task.view` (test).
  - verified: rev-23 [reviewer] · run rev-20261021-1052-final · 2026-10-21T15:53:19.762Z · commit ada57feabc11c66dc531cb83c07fe1f03b2a3813
  - done: impl-1052 · 2026-10-21T17:54:22.466Z
  - verified: rev-23 [reviewer] · run rev-20261021-1052-merge-final · 2026-10-21T18:36:05.097Z · commit bd3bf94fe637e8bd33cbecbc7bd32e0ba069eae8
- [x] C3. A change to one task produces a delta that carries only that task and its ancestors whose fields changed, and the recomputation touches only that chain (test).
  - verified: rev-23 [reviewer] · run rev-20261021-1052-final · 2026-10-21T15:53:19.762Z · commit ada57feabc11c66dc531cb83c07fe1f03b2a3813
  - done: impl-1052 · 2026-10-21T17:54:22.485Z
  - verified: rev-23 [reviewer] · run rev-20261021-1052-merge-final · 2026-10-21T18:36:05.097Z · commit bd3bf94fe637e8bd33cbecbc7bd32e0ba069eae8
- [x] C4. On a thousand-item fixture, recomputing after one task change stays under a measured bound recorded in the test, and the startup reply budgets of T-1038 still hold (test).
  - verified: rev-23 [reviewer] · run rev-20261021-1052-final · 2026-10-21T15:53:19.762Z · commit ada57feabc11c66dc531cb83c07fe1f03b2a3813
  - done: impl-1052 · 2026-10-21T17:54:22.505Z
  - verified: rev-23 [reviewer] · run rev-20261021-1052-merge-final · 2026-10-21T18:36:05.097Z · commit bd3bf94fe637e8bd33cbecbc7bd32e0ba069eae8
- [x] C5. `hub/README.md` describes the new summary fields, their provenance and the incremental rule.
  - verified: rev-23 [reviewer] · run rev-20261021-1052-source-2 · 2026-10-21T14:52:30.592Z · commit 3a7b4f034b219461c7e87be4558a944a19fa9bc7
  - verified: rev-23 [reviewer] · run rev-20261021-1052-source-3 · 2026-10-21T14:58:35.648Z · commit e79e1231f323b223c469f89c6ed7de485b021c26
  - verified: rev-23 [reviewer] · run rev-20261021-1052-source-4 · 2026-10-21T15:42:01.750Z · commit ada57feabc11c66dc531cb83c07fe1f03b2a3813
  - verified: rev-23 [reviewer] · run rev-20261021-1052-final · 2026-10-21T15:53:19.762Z · commit ada57feabc11c66dc531cb83c07fe1f03b2a3813
  - verified: rev-23 [reviewer] · run rev-20261021-1052-merge-source · 2026-10-21T15:56:58.063Z · commit 21c1018922f3564e187ad5ebf44907d01f17a90d
  - verified: rev-23 [reviewer] · run rev-20261021-1052-merge-source-2 · 2026-10-21T17:54:15.627Z · commit bd3bf94fe637e8bd33cbecbc7bd32e0ba069eae8
  - done: impl-1052 · 2026-10-21T17:54:22.529Z
  - verified: rev-23 [reviewer] · run rev-20261021-1052-merge-final · 2026-10-21T18:36:05.097Z · commit bd3bf94fe637e8bd33cbecbc7bd32e0ba069eae8

## Comments

### impl-1052 · 2026-10-21T14:31:49.829Z

Implemented the Lua-guarded cached summary/roll-up projection and bounded closed-summary by-id reads under the Coordinator's 2026-10-21 decision. Local Darwin arm64 targeted evidence on the working tree: C1 compared 1,051 copied tracker bodies, zero differences; items snapshot 822,111 bytes within 1 MiB. C3 frame mutations send only changed task/ancestors, with unchanged ancestor rows omitted. C4 1,000-row fixture recomputed only the three-row chain in 0.259 ms against 100 ms; existing eight startup reply guards pass. Root npm run check passes (test lint report mode, zero refusals). Source review and mode-free verification remain pending.

### rev-23 · 2026-10-21T14:44:07.081Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1052-source
commit: 6c49c3b53bbfa1ffdcf77b3e3a977d591834827a
scope: full
findings: [{"severity":"medium","text":"Stage-cover/tree settlement calls #announce(id,true), but its shown signature excludes rollup.stage. A stage-only transition is refreshed into the cache then suppressed when criteria/base/tip/verdict freshness stay equal, leaving existing frame clients on the old stage. Publish changed projection fields and add an observer-before-settlement frame regression.","file":"hub/src/tracker/tracker.ts","line":672},{"severity":"medium","text":"next checks only this row and descendants, not ancestors above the scoped container. Closed R-1 / open E-2 / planned unblocked T-3 yields E-2.next=T-3, while Lua vboard.compose excludes it through open_parents. Preserve Lua's full ancestor condition and test state/move invalidation against Lua and frame output.","file":"hub/src/tracker/explorer-fields.ts","line":137}]
finding_counts: {"high":0,"medium":2,"low":0}

Not clear; A-8488 records full Standards/Spec audit at exact pushed 6c49c3b5/tree0223201a against fixed incoming dev e133ead3 (61c78e93 is merge commit). Standards0, Spec2 medium findings. M1 tracker.ts:672 suppresses stage-only rollup transitions from stage-cover/tree callbacks; M2 explorer-fields.ts:137 ignores closed ancestors above a container for next, unlike Lua open_parents. C1/C3 failed. Shared two-commit palette allowance delta accepted as confined dated E-880 12s expiry2026-10-28; no broader dev merge. Bounded closed-summary read/1MiB policy and docs/skill/wire/test scopes otherwise reviewed. A-8472 remains targeted Darwin development evidence, no queued pass. No Reviewer runtime. Correct both findings with exact-boundary regressions, then request fresh full source review before verification; after-stage QA separate.

Criteria: C1 failed (Hub next can disagree with Lua when an open container is beneath a closed ancestor.), C3 failed (A changed stage roll-up can be swallowed by the ifMoved freshness publication guard.).

### rev-23 · 2026-10-21T14:52:30.592Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1052-source-2
commit: 3a7b4f034b219461c7e87be4558a944a19fa9bc7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-8498 extends original full A-8488 audit, Standards0/Spec0. Exact pushed3a7b4f03/tree83e4b3ce, six-file correction after6c49c3b5, no new dev merge. M1 fixed by projected-row equality in place of freshness-only signature; pending verdict guard retained. Observer-before-final-cover frame regression asserts exact stage=null event without an item edit/reread. M2 fixed by full ancestor openness for fields.next plus descendant-container effective-next invalidation/publication on ancestor state/parent/removal changes; internal candidates remain subtree-local. Independent real-Lua oracle guarantees closed-release/open-epic/planned-task boundary; frame regression retains reopen/reparent/second reopen. Ordinary task chain/100ms scale assertions retained. C5 README provenance/incremental/bounded closed-text fields verified; docs/test guide updated. C1-C4 await runtime settlement: preserve original targeted Lua/startup stdout, exit and actual execution-tree provenance durably (no transcription rerun), alongside forthcoming exact-head mode-free receipt. A-8496 is targeted Darwin development summary, not queued full-tier proof. Source clear permits unchanged-head verify. After-stage QA separate; no Reviewer execution.

Criteria: C5 verified.

### rev-23 · 2026-10-21T14:57:04.249Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1052-evidence-red
commit: 3a7b4f034b219461c7e87be4558a944a19fa9bc7
scope: evidence
findings: [{"severity":"medium","text":"The added Implementer procedure line breaches the enforced reply growth reserve: A-8504 log3984 reports6715bytes versus6528allowed. Relocate this task's added detail behind the existing procedure pointer or shorten the addition, preserving unrelated requirements and unchanged byte assertions.","file":"hub/src/roles/default-roles.ts","line":150}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear: A-8504/f0cef846 at3a7b4f03 autoexit1. Exact assertion log3984: 'defaults implementer: clause reply is 6715 bytes; 15% growth headroom requires at most 6528 of 7680 bytes'. Linux droplet T1 exit1,703pass/1fail; T2/Web not run, no new load/T3/T4 receipt. Task-owned clause growth, not shared defect/report-only debt. M3 medium default-roles.ts:150; relocate task-added procedural detail behind existing pointer or shorten only this addition, retain byte ceiling and assertions. C2 failed for blocked required frame verification. M1/M2 source corrections retained; runtime final criteria remain pending. Host28b36cf7 reusednotremote, lint/duration/ratchet report-only. A-8505 targeted startup receipt arrived separately, not a green task run. No Reviewer execution. Corrected head needs new source review before replacement verify.

Criteria: C2 failed (Required task verification stops in enforced T1 clause-reserve assertion (6715 > 6528 bytes), before the frame tests execute.).

### rev-23 · 2026-10-21T14:58:35.648Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1052-source-3
commit: e79e1231f323b223c469f89c6ed7de485b021c26
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; one-line deletion resolves M3. Exact origin e79e1231/tree43e82996; default-roles.ts equals incoming-dev baseline, existing Implementer skill pointer and full skill procedure/metadata/README guidance retained. No reserve/assertion/unrelated requirement edits or dev merge. Prior full source A-8488 and corrected design A-8498 remain applicable; M1/M2 runtime/tests unchanged. A-8507 original targeted Darwin27/27 clause output supports source fix, reported execution overlay is precisely this deletion. C5 reverified. Qualified corrected-Lua overlay A-8503 and clean3a7b4f03 startup-byte stdout A-8505 retained; neither is a current Linux T3 suite claim, and clause-only deletion changes no oracle/startup runtime dependency. C1-C4 final settlement awaits replacement exact-head mode-free test/load receipt. A-8504 remains historical red, noT2/Web. No Reviewer runtime; QA after-stage separate.

Criteria: C5 verified.

### impl-1052 · 2026-10-21T15:39:20.126Z

Cancelled hung droplet verify 56752f57 at e79e1231 through the hub at Coordinator request; A-8525 retains Linux T1 green and incomplete T2 with 3 failures, no Web. A-8534 records exact targeted red assertions after cover-quiet lifted. Fixed each independently in ada57fea: lazy hydrate projection rows added through the real index adapter after startup, refresh cached source rows when restored receipt lookup binds, preserve internal write notifications for idempotent writes while HubCore still deduplicates unchanged client deltas. Original three targeted assertions now pass, including task-prefixes exiting normally without force-exit; complete affected files and summary guards are being validated. Fresh source review precedes replacement verification.

### rev-23 · 2026-10-21T15:40:50.765Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1052-evidence-red-2
commit: e79e1231f323b223c469f89c6ed7de485b021c26
scope: evidence
findings: [{"severity":"medium","text":"Cached projection can return an incomplete row for an indexed item absent from explorer.rows; task-prefixes workload subsequently throws on verdicts.length in #tipsMoved and its file does not exit. Hydrate cache misses while preserving bounded per-publication work.","file":"hub/src/tracker/tracker.ts","line":2004},{"severity":"medium","text":"Binding restored verification lookup after cached rows exist does not refresh verify facts; suite-admission's reopen assertion reads a null card. Refresh cached source facts on binding and retain the existing reopen assertions.","file":"hub/src/tracker/tracker.ts","line":2085},{"severity":"medium","text":"Whole-row equality suppresses internal tracker write observers as well as client deltas; inbox-workload's archive sweep assertion reports0 instead of1. Preserve internal write notifications while deduplicating unchanged external frames/ancestor work.","file":"hub/src/tracker/tracker.ts","line":668}]
finding_counts: {"high":0,"medium":3,"low":0}

Historical not clear: A-8525/56752f57 cancelled143 with completed T2 failures despite T1green/owned7x5loadpasses. Parsed ordinary1970pass/3fail, files309pass/2fail plus unfinishedtask-prefixes1837s; noWeb/T3/T4. A-8534 actual same-head pre-edit reds: TypeError undefined.length at #tipsMoved548; archive sweep0!==1 at inbox-archive-workload106; null.id at suite-admission49 reopened verify card. Three medium cache/observer compatibility findings: missing indexed-row hydration, stale lookup binding, suppressed internal idempotent-write observers. Runtime criteria remain unverified; own item checks passed individually, compatibility failures prevent final clearance. No extra done-mark resets for tests outside own criterion checks. Linuxx64c8lon1life2143s/$0.1488,host25acf65d reused; lint/durationreportonly,scale whole-test3.494s over2s not recompute measurement. New ada57fea correction request already arrived and awaits fresh source review; this is only historical e79e1231. No Reviewer execution.

### rev-23 · 2026-10-21T15:42:01.750Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1052-source-4
commit: ada57feabc11c66dc531cb83c07fe1f03b2a3813
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at exact originada57fea/treef5c4cebc; one-file13add/3delete sincee79e1231, no dev merge. Original full source/design audits remain applicable. Missing indexed rows hydrate on cache miss; useVerify refreshes cached source facts when restored lookup binds; #changed preserves internal idempotent-write observers while ordinary ancestor/freshness equality and HubCore client-delta dedup stay intact. Historical three compatibility failures resolved without changing their assertions. A-8537 exact clean-head localDarwin64 targeted passes across9files, normal exits/no force-exit, checkexit0/lintreportonly; wrong nonexistent stage filename ran no tests, corrected invocation5passesexplicitlylogged. A-8538 fresh exact-head targetedT3 Lua1063copied+3regression rows0differences/833088bytes and startup8replyguard1/1exit0 now replace old provenance-qualified support. No integrated/LinuxT3 claim; whole-test timings not startup latency. C5 docs reverified; C1-C4 final settlement awaits replacement same-head mode-free/load evidence. A-8525 remains historicalcancelled/incompleteT2red/noWeb; A-8542 records that verdict. No Reviewer runtime; after-stage QA separate.

Criteria: C5 verified.

### rev-23 · 2026-10-21T15:53:19.762Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1052-final
commit: ada57feabc11c66dc531cb83c07fe1f03b2a3813
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-8554, Standards0/Spec0, C1–C5 verified at exact originada57fea/treef5c4cebc. A-8550 mode-free5d3d21a0 exit0 Linuxx64 c8lon1:2313 ordinary test/354filepasses plus35 distinct loadtest/filepasses; seven owned identities each explicit5/5. Actual allT1/fallbackallT2hub+Neovim/Web4files; formerly failing task-prefixes/archive/suite-admission pass normally. Host check90524363 reusednotremote; T2workers2/Webactual4,life438s/$0.0304 estimated. C1 A-8538 exact clean-head targetedDarwin realLua1063copied+3ancestorrows0differences,833088bytes<1MiB; startup8replyguard1/1. C2 snapshot/provenance/rollups/blocked/next/frame checks pass; C3 only changed chain/stage settlement/closed-ancestor next regressions pass. C4 Linux synchronous chain recomputation1.066ms<100ms; whole-test4.397s exceeds report-only2s and is not that measurement. C5 unchanged docs source verified. Lint132/59,duration/ratchet report-only,3missingbaselines; no4sWeb-budgetpass, queuedT3/T4/integrated/QA claim. Earlier cancelled/red receipts stay historical; after-stage affected QA separate. No Reviewer runtime.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-1052 · 2026-10-21T15:55:34.104Z

At Coordinator request (topic805 decision5f42dd2c), merged origin/dev81b69649 into reviewed ada57fea; pushed21c10189/treee58c3c22. Manual resolutions keep task-frame dedup plus computed session-row scheduling in core.ts and both skill metadata entries; upstream subscription filtering preserved. A-8555 records49/49 targeted Darwin tests, no skips, at clean merged head; Lua1067 copied+3 regression bodies zero differences, snapshot836897bytes below1MiB; incremental0.243ms/100ms; root check0 (lint report-only). Delta source review requested before mode-free verification; Coordinator plans separate full pre-merge all receipt. Previous green A-8550 applies to ada57fea only.

### rev-23 · 2026-10-21T15:56:58.063Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1052-merge-source
commit: 21c1018922f3564e187ad5ebf44907d01f17a90d
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta source clear; A-8556, Standards0/Spec0. Exact origin21c10189/treee58c3c22, parents acceptedada57fea/incoming81b69649; Coordinator5f42dd2c independently confirmed. Core task-only dedup and incoming session scheduling both retained with disjoint trigger types/caches; snapshot-only session delivery and close cleanup retained. T-1055 dispatch/snapshot blobs equal incomingdev; tracker/projection/topics blobs equal acceptedhead; authoritative message-topic fields and event filter semantics preserved. Implement skill retains both procedure paragraphs and both metadata entries; summary/Lua/startup docs preserved, C5 reverified. A-8555 exact clean Darwin49/49 targeted/check0 support: sessions/filter/snapshot/summary/nvim, realLua1067+3rows0diff,836897bytes<1MiB,incremental0.243ms<100ms. No queued merge-head pass yet; oldA-8550 historical. C1–C4 final settlement awaits new same-head mode-free plus Coordinator-required full pre-merge run; refresh stale claimant marks before submission. QA affected/afterstage separate; no Reviewer runtime.

Criteria: C5 verified.

### rev-23 · 2026-10-21T16:05:48.238Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1052-merge-evidence-1
commit: 21c1018922f3564e187ad5ebf44907d01f17a90d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Task evidence clear, not final readiness; A-8560. Independently parsed A-8559/43fca595 at reviewed21c10189:2331ordinarytest/357filepass+35loadtest/filepass; all7ownedidentities5distinctpassingfinishes+explicit5/5. Actual Linuxx64c8lon1 T1/allfallbackT2hub+nvim/Web5files exit0;host35dee8c7 reusednotremote,T2workers2/Web4,life433s/$0.0300estimated. Incremental chain0.904ms<100ms; scale whole-test3.542s/maxload4.491s exceed report-only2s, distinct from recomputation. Lint132/59,duration/ratchetreportonly,6missingbaselines; no4sWeb-budgetpass. C1–C4 final settlement remains pending Coordinator-required full pre-merge run5f42dd2c; scheduledafterT1065 per20a90108. C5 source proof retained; A-8555 local merge-head Lua/startup supports but is no full receipt. NoT3/T4/integrated/QA claim from this task run; afterstageQA separate. No Reviewer runtime.

### impl-1052 · 2026-10-21T17:52:51.101Z

Full pre-merge265c0baa at21c10189 failed only stale live-protocol-frames.json attach baseline (A-8569), with T1/T2 green and T3 incomplete/red, no Web. At quiet lift, full npm recorder stopped safely on artifact-browser native consumer with0capturedframes (A-8588); reported separately as S Bugs. Documented existing-recordings refresh then passed real attach recorder1/1, validating catalog/slices (A-8589). Generated diff is exactly9 additive lines for this item's new list fields, no catalog/slice/runtime/assertion changes. Committed/pushed bd3bf94f; delta source review requested before new mode-free run; Coordinator full pre-merge retry remains required.

### rev-23 · 2026-10-21T17:54:15.628Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1052-merge-source-2
commit: bd3bf94fe637e8bd33cbecbc7bd32e0ba069eae8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-8590, Standards0/Spec0. Exact origin bd3bf94f/treefeb1c68f, parent21c10189, no dev merge. Entire correction9 JSON additions in live-protocol-frames: empty summary/null from+provenance, no open blockers, blockedfalse, backlog/○. Matches real fixture task (criteria-only body/no blockers) and reviewed projection. No source/assertion/catalogue/slice changes; previous full/merge audits retained, C5 docs reverified. Historical A-8569/265c0baa at21c10189 stays red: actual19668 'live hub protocol drifted; run npm run test:nvim-fixtures',3529pass/1fail/8skip, T1/T2green/T3exit1/noWeb. A-8588 recorder stopped at0frames<1guard; A-8589 documented --from-recordings maintenance/real attach1/1exit0 generated precisely this9-line overlay; local Darwin, not committed-head queued or non-rewrite full evidence. C1–C4 final settlement awaits new same-head mode-free and Coordinator replacement full pre-merge including unchanged live attach assertion. Refresh stale claimant marks before submit. No new Linux/T3/Web/load/QA pass; afterstageQA separate. No Reviewer runtime.

Criteria: C5 verified.

### rev-23 · 2026-10-21T18:03:38.023Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1052-merge-evidence-2
commit: bd3bf94fe637e8bd33cbecbc7bd32e0ba069eae8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Task evidence clear, not final readiness; A-8599. Exact unchanged bd3bf94f/treefeb1c68f. A-8598/f60bea5b raw2331ordinarytest/357filepasses+35loadtest/filepasses, actual T1/allfallbackT2hub+nvim/Web5files exit0. Seven owned identities each5distinctpassingfinishes+explicit5/5; chain work0.661ms<100ms, whole scale4.371s/maxload4.285s remain over report-only2s. Linuxx64 c8lon1 Node24.21/Nvim0.12.5,T2workers2/Web4,life465s/$0.0323estimated; host52dff9ee reusednotremote. Lint132/59,6missingbaselines,duration/resource/ratchet report-only; no4sWeb-tier-budgetpass. NoT3/T4 in task receipt; unchanged non-rewrite live attach T3 assertion still awaits Coordinator replacement full pre-merge run at this head. C1–C4 final evidence pending that full receipt; C5 source proof retained. Historical fullA-8569 stays red at21c10189. No integrated/stage/QA claim; afterstageQA separate. No Reviewer runtime.

### rev-23 · 2026-10-21T18:36:05.097Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1052-merge-final
commit: bd3bf94fe637e8bd33cbecbc7bd32e0ba069eae8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-8615, Standards0/Spec0, C1–C5 verified at unchanged origin bd3bf94f/treefeb1c68f. Required Coordinator full69958e15/A-8614 exit0:3561test/537filepasses,8environment skips,0fails/cancellations; actual Linuxx64c8lon1 T1/allT2hub+nvim/T3hub+nvim/Web5files. Real Lua14759–14763:1067copied+3ancestorrows0differences,836897bytes<1MiB. Startup8replyguard16436passes; unchanged non-rewrite live attach fixture19374passes, fixing priorA-8569 red. Incremental work0.907ms<100ms onlyT12/E2/R1; whole scale3.146s remains report-only2s overage. Same-head taskA-8598 audited inA-8599:2331ordinarytest/357filepasses+35loadtest/filepasses, all7ownedT2identities5/5. Snapshot/provenance/rollups/blocked/next, bounded closed reads, changed-chain/stage/ancestor next, compatibility observers and docs source retained. Host52dff9ee reusednotremote; T2/T3workers2/Web4,life1520s/$0.1055estimated. Lint132/59,8missingbaselines,duration/ratchet report-only: T3phase1083.45>900, ratchet2149.221>2135.601 (+13.620), compiler/CLI/Web overages retained; T-1068 follow-up filed. NoT4/stage/afterstageQA pass; affected afterstageQA separate, Coordinator owns enqueue. No Reviewer runtime.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-21T18:40:59.066Z

Merged ee95f17e73aaa62bba63e6ec010fd1741c084f11 onto dev.
