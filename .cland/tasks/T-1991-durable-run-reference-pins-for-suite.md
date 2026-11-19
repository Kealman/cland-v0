---
id: T-1991
kind: task
title: "Durable run-reference pins for suite runs: verdict, criterion, coverage and duration publishers pin a raw run before referencing it, with an exclusive retirement claim"
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by:
  - T-1957
topic: topic-1657
branch: t/T-1991-durable-run-reference-pins-for-suite
created: 2026-11-19T01:26:31.956Z
updated: 2026-11-19T16:59:35.596Z
closed: 2026-11-19T16:59:35.596Z
---

## Summary

Split from T-1957 by the Coordinator on 2026-11-19. impl-1957's publisher census showed that tracker verdict and criterion writes, duration refresh and delayed coverage publication can all reference suite runs of any age. So an age floor can't make deleting `.cland/run/suites` entries race-free. This item adds the capability retention needs before it may delete (rule 19).

## What to build

Before a publisher's final check and write, it creates a durable per-run pin. Retirement takes an exclusive claim, so a pin present before the claim makes retirement keep the run. A publisher that finds a run already retired refuses the new raw-run reference with the existing error transport. Unknown or crashed pins keep the run indefinitely. This covers tracker verdict and criterion writes, coverage-pointer publication and duration refresh.

## Acceptance criteria

- [x] C1. For each publisher class, a deterministic overlap regression shows a pin taken before the claim retains the run, and a publish attempted after retirement is refused (test).
  - done: impl-1991 · 2026-11-19T16:01:16.471Z
  - verified: rev-35 [reviewer] · run rev-35-1991-evidence-3 · 2026-11-19T16:04:31.616Z · commit b35d36e30dba2b9b460bd04b62e804bf61a8d355
- [x] C2. A crash between pin and write leaves the run retained, and recovery never ages an unknown pin out (test).
  - done: impl-1991 · 2026-11-19T13:38:14.868Z
  - verified: rev-35 [reviewer] · run rev-35-1991-evidence-3 · 2026-11-19T16:04:31.616Z · commit b35d36e30dba2b9b460bd04b62e804bf61a8d355
- [x] C3. Every publisher and reader of raw-run references is listed with its disposition (rules 20 and 41).
  - done: impl-1991 · 2026-11-19T13:38:15.468Z
  - verified: rev-35 [reviewer] · run rev-35-1991-source-3 · 2026-11-19T13:41:13.953Z · commit b35d36e30dba2b9b460bd04b62e804bf61a8d355

## Comments

### impl-1991 · 2026-11-19T12:53:25.359Z

C3 initial consumer dispositions before changing admission: tracker/tracker.ts comment/#writeComment (including stage QA and verdict+criterion marks) and criterion are reference publishers; tracker/item.ts/criteria.ts/index-db.ts/gate-verdicts.ts/explorer-fields.ts read persisted run identities and remain compatible. suite-coverage.ts registerCoverageMap publishes pointers; coverageMaps/selection and selection-replay read durable artifacts. hub/test/durations.ts refreshDurations accepts raw suite log paths or durable artifacts. hub/dispatch.ts reports artifacts and pointers; hub/suites.ts, suite-history.ts, suite-isolation.ts, suite-worker.ts and executor/droplet/run.ts/run.sh own unsettled raw output. hub/merge-batches.ts and dev-T3/cache/cover selection read indexed metadata/artifacts and are conservatively retained. suite-log/load diagnostics read raw logs under settled-owner protection. CLI/web/Neovim history render hub metadata/artifact paths; no wire shape changes. QA briefs and fixtures contain explicit historical paths; no migration removes their inputs. Census searches include raw path/field/function names across hub/src, hub/test (all tier assignments), nvim, web, docs, qa and shipped skills; exact filename inventory will be committed in docs/hub/suite-retention.md. Pins will be immutable and unexpired; incomplete pins retain forever. Production deletion remains off.

### impl-1991 · 2026-11-19T13:07:49.483Z

Implemented and pushed ea6de661cac0b844af0be973c9d50844c38b3b1d (tree 3eab77e10cdd94cabea584bed95f1e64dec6a09d), clean branch. Fetched and merged origin/dev once before source review (already up to date). C1/C2: immutable exclusive admission records, actual final-write overlaps for all four publisher classes, refusal after retirement, crash/unknown retention and renamed/symlink duration inputs. C3: docs/hub/suite-run-references.md exact inventory and dispositions; pre-existing criterion-only marks are handled by T-1992 C5, not this new-write item. Local macOS Node v24.21.0: 145 reachable T1 files, 1482 passed tests; final targeted T2 24/24; no skipped/cancelled/todo/fail. Full npm run test:lint including test:static exit0, zero refusals; typecheck exit0. Report-only lint findings remain advisory (131 in 62 files; known Site/CLI-install/build reports). No T3/T4/Web or configured verify yet. Evidence A-21778 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21778-t-1991-publisher-pins-red-to-green-and-local-test-evidence.md. Production deletion stays off; pins do not expire or release.

### rev-35 · 2026-11-19T13:16:31.241Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1991-source-1
commit: ea6de661cac0b844af0be973c9d50844c38b3b1d
scope: full
findings: [{"severity":"medium","text":"Spec M1: admitted create/edit body writes can introduce parsed verified criterion marks with raw run ids without either new pin site. #criteriaOf and index-db recognize those marks; they are structured references, not arbitrary prose. The C3 body-write exclusion is incorrect, and T-1992 C5 covers pre-existing marks only. Admit recognized references at the shared final-write owner using the existing parser, add create/edit overlap and post-retirement refusal controls, and correct the census.","file":"hub/src/tracker/tracker.ts","line":3179},{"severity":"medium","text":"Spec M2: pinSuiteLog pins the resolved symlink target then returns void, while refreshDurations subsequently readFile's the original mutable pathname (durations.ts:128). A target swap after admission can consume a different unpinned or retiring run. Bind consumption to the admitted file/run identity and add a deterministic swap between admission and read; the static alias regression does not establish that boundary.","file":"hub/src/suite-reference-pins.ts","line":74}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source NOT CLEAR at cleanea6de661cac0b844af0be973c9d50844c38b3b1d/tree3eab77e1, fixed parent5e3a2005c80cd62166b635f132a037a2aedf62fd. A-21780 records2medium Spec findings,nohigh/low/additionalindependentStandards finding. M1Trackercreate2916/edit3179 body writes can persist parsed verified run marks without new pin sites3051/3373; C3's arbitrary-prose exclusion is wrong. Primary7d9603be and T1992C5cover only pre-existing marks, not these new admitted writes. M2pinSuiteLog74returns after pinning currenttarget, but durations128reopens originalmutablealias; targetswap canconsume anotherunpinned/retiringrun. Lead49c805bb confirms neither has anothercontrol/disposition. Admit recognized body references at shared finalwriter with existingparser; bind duration read to admittedidentity, add deterministic create/edit overlap+refusal and alias-swapcontrols, correct C3. ImmutableP/Rexclusivecreation,boundedread,syncedadmission,unknownnoexpiry,productionremovaloff and existing guarded tests reviewedpositively; no wire change. Independent135path lexicalinventoryaudit found noadditionalmatch exceptcensusitself, not semanticcompleteness. A21778 stagedtree matchesGit;145uniqueT1rows sum1482reportedpasses/allpinnedT1,24targetT2/full lint-static+typecheck0 are selectedlocalmacOSarm64/Node24.21 authored-evidence observations, not currentconfigured/T3/T4/Web proof. Earlier import/environment/true!==false/alias/tierlintreds remainseparate; perinvocationnative/raw/source/scanreceiptfacts unavailable remainunknown. C1/C3failed,C2doneunverified,nothingverified. Hold released; bounded corrections then fresh exacthead source review before verification. Static Reviewer reads only.

Criteria: C1 failed (New create/edit body references bypass pin admission, and duration alias consumption can use a different unpinned run after its target changes.), C3 failed (The census incorrectly excludes recognized criterion-run marks in newly admitted body writes and does not account for duration input identity changing after admission.).

### impl-1991 · 2026-11-19T13:19:47.084Z

Source review rev-35-1991-source-1 not clear (A-21780): M1 create/edit bodies introduced parsed verified marks without pins; M2 duration refresh reopened mutable alias after pinning its old target. Both were reproduced deterministically, then corrected: #write now admits references from exact parsed final item through existing item/criteria parsers; pinSuiteLog returns the captured canonical path and its sole caller refreshDurations reads it. Consumer search for pinSuiteLog across hub/docs/qa/skills/nvim/web found only the helper definition and durations.ts caller; caller migrated, internal return only, no wire/persisted shape change. C3 body-write exclusion corrected; old-mark T-1992 C5 unchanged. New create/edit controls failed true !== false before fix; alias-swap control consumed replacement instead of pinned timing before fix. Eleven targeted admission tests now pass, full typecheck exit0 on local macOS Node24.21. Fresh T1/T2/lint and evidence pending; no configured verify or dev merge after review.

### impl-1991 · 2026-11-19T13:24:41.572Z

Review corrections committed/pushed 5a63d3facbb9e8c6b477dd0da92a1df429dcc66f, tree c3ba15d57d888e7c1ab59a85dda1aa4d866c67f2; clean worktree. No merge from dev after first source review. M1 shared #write now admits exact parsed verdict/verified-mark references, including create/edit/import bodies. M2 duration refresh reads the canonical input returned by pinSuiteLog, with deterministic alias swap proving pinned timing consumed and replacement run unreferenced. C3 incorrect prose exclusion replaced; T-1992 C5 remains untouched old-mark migration. Local macOS arm64 Node24.21: fresh 145 reachable T1 files/1482 passes; 27 targeted T2 passes, zero skips/fails/cancels/todos; full typecheck exit0 and full test:lint including static exit0, zero refusals. Existing report-only findings remain advisory. T3/T4/Web/configured verify unexecuted. New authored evidence A-21785 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21785-t-1991-review-corrections-m1-and-m2-local-evidence.md preserves earlier not-clear and red rounds and states provenance limits. Production deletion remains off.

### rev-35 · 2026-11-19T13:28:15.561Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1991-source-2
commit: 5a63d3facbb9e8c6b477dd0da92a1df429dcc66f
scope: full
findings: [{"severity":"medium","text":"Standards M3 (rule23): every write now serially re-admits every distinct historical verdict/criterion run from the full candidate item. Already durable immutable pins still incur fence's directory/record opens and fsyncs. There is no positive admission checkpoint/shared pending result or retained-reference work budget, so an ordinary edit adds filesystem work proportional to retained history. Checkpoint only positively completed admissions under the owning tracker, share pending work, retain failed/unknown refusal semantics and prove bounded new I/O over repeated writes with many retained references.","file":"hub/src/tracker/tracker.ts","line":2663}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source2 NOT CLEAR at clean5a63d3facbb9e8c6b477dd0da92a1df429dcc66f/treec3ba15d5, parent reviewed ea6de661/base5e3a2005; no dev merge. A-21789 records1mediumStandards M3/nohigh/low. OriginalSpec M1/M2 resolved: exact parsed candidate references admitted in shared#write before temp/finalauth, create/edit positive marks+overlap/refusal; pinSuiteLog returnscanonicalinput consumed by sole caller, deterministicalias-swap consumes pinnedtiming/retains original/allows replacement retirement. C3 corrected, oldmarkscopeT1992C5unchanged. M3: tracker2663 now serially reopens/syncs every historicalrun on everywrite, includingalreadydurableimmutablepins; Set dedupsonecandidateonly. No ownercheckpoint/sharedpending/budgetorcap; lead23d88a54 confirms. Add positive-only owner admissioncheckpoint/sharing and meaningfulretainedhistoryI/Obudget, preservingfailed/unknownfences. Productionremovaloff,wire/schema,guardedtestownershipandimmutableP/Rdurabilityremainpositive. A21785 matchingstagedtree reports localprecommitmacOSarm64Node24.21 selected145T1/1482+27T2/11pins/full lint-static+typecheck0/zerorefusals,not exactper-invocationnative/tree/rawproof orwork-budgetproof;T3/T4/Web/configuredunexecuted. Newbodytrue!==falseandaliasswapreds,source1NC/A21780/A21778historyretained. C1failed,C2/C3doneunverified,nothingverified. Hold released; boundedcorrection then freshfixedheadsource review beforeverify. Static Reviewer reads only.

Criteria: C1 failed (Shared admission now repeats per-run filesystem opens/syncs for all retained references on every write, without a positive checkpoint/shared flight or retained-history work budget (rule23).).

### impl-1991 · 2026-11-19T13:38:16.121Z

M3 correction committed/pushed b35d36e30dba2b9b460bd04b62e804bf61a8d355, tree 931d630c02fc2ac4854f3a3f10266a03f4e19366; clean worktree, no dev merge since first source review. Tracker-owned SuiteReferencePins checkpoints only synced positive admissions and shares pending promises; failed/unknown outcomes remain retryable/refused. A recovered owner lazily revalidates durable pins. Copied real-world snapshot reference control first failed 988 !== 0 admission entry calls over four title edits, now passes zero repeated calls and fixed <=16 entry calls for one new reference. Separate controls cover sharing, success, failure, unknown and recovery. Earlier invalid fixture setup rounds remain failures, not coverage. Local macOS arm64 Node24.21: fresh 145 reachable T1 files/1482 passes;29 targeted T2 passes (13 pin cases), no fail/skip/cancel/todo; full typecheck exit0 and full npm run test:lint including test:static exit0, zero refusals. Existing advisory findings remain report-only. T3/T4/Web/configured verify unexecuted. Authored scoped evidence A-21801 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21801-t-1991-m3-correction-positive-pin-checkpoint-and-work-budget.md preserves prior not-clear/red epochs and provenance limits. Production deletion stays off; T-1992 C5 old-mark migration unchanged.

### rev-35 · 2026-11-19T13:41:13.953Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1991-source-3
commit: b35d36e30dba2b9b460bd04b62e804bf61a8d355
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source3 CLEAR at cleanb35d36e30dba2b9b460bd04b62e804bf61a8d355/tree931d630c, parent reviewed5a63d3fa/base5e3a2005; no dev merge. A-21802 records zeroStandards/Spec findings. M3resolved: tracker-owned positive-only SuiteReferencePins shares wholependingpromise, checkpoints only afterdurableadmission succeeds, removespendingonrejection, nevercachesunknown/retired/failed; newownerempty/lazywrite revalidation,no startupscan/globalcache. Copied real-world snapshot96238cb9a body/parsed reference corpus>=16: positivecoldadmission, fourrewriteszero matchingrealpath/mkdir/lstat/openentries, newrefpositive<=16; prior988!==0redretained. CounterexplicitlynotallfilesystemIO/timingspeedup. Separatepending/success/failure/unknown/coldowneropen-count controls meaningfullyretainrefusal. M1exactparsedsharedwriter/bodyadmission andM2capturedcanonicaldurationconsumptionremaincorrect; authorizations/concurrent source checks unchanged. C3correctedpublisher/reader/ownerinventory sourceverified; primary7d9603be/T1992C5oldmarkmigration only, deletionoff,legacywire/recordshapes unchanged. A21801 stagedtreematchesreviewedtree; selectedlocalprecommitmacOSarm64Node24.21 145T1/1482+29T2/13pins,fullcompiler/lintstatic0/zero refusals remain authored scopedobservations, not independentper-invocationtree/raw/native/scanproof. No configured/T3/T4/Web/provider/browser receipt. Setupfailures,988redandearlierM1/M2/source1/source2NCepochsretained. C3verified,C1/C2doneunverifiedpendingexactheadconfiguredfacts. Holdreleased forCoordinatorwindow. Static Reviewer reads only.

Criteria: C3 verified.

### rev-35 · 2026-11-19T14:44:22.115Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1991-evidence-1
commit: b35d36e30dba2b9b460bd04b62e804bf61a8d355
scope: evidence
findings: [{"severity":"medium","text":"Verification E1: exact-head all-mode run 56cc3b92 exited 1 at 'replacement started during teardown is joined' (expected empty census, actual one live host-serve row). Own pin controls passed, but the original failed/partial run cannot supply final clearance. Coordinator 8a85ede1 attributes it to unrelated T-2009 and authorizes one same-head retry bf7a2441 after five isolated passes; preserve the original red and await that retry's producing receipt.","file":"hub/test/host-supervisor.test.ts","line":216}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence1 NOT CLEAR at unchanged clean b35d36e30dba2b9b460bd04b62e804bf61a8d355/Git931d630c. A-21815 audits failed56cc3b92/A21814 ownerexit1; A-21817 adds later Coordinator8a85ede1 attribution to unrelatedT2009 and exactlyone retrybf7a2441 after five isolatedpasses/A21816. Originalred remainsred; no new pin-source defect inferred, source3A21802/C3currentverification retained. Literal log47342 failure: AssertionError [ERR_ASSERTION]: replacement started during teardown is joined; expected[], actual one live host-serve row after awaitedclose; case40164fail2.477070765s at host-supervisor216. Own13pin cases28833–28897 allpass +5distinct each/65loadpasses; extra5durationwrapperloads yield70total. Ordinary8649=8639pass/1fail/9skip, separate70loadpass; combinedcompleted8719isnotordinarypasscount. No duplicate/unmatchedstarts/finishes. Returnedfiles917pass/1fail; T0/all232T1/all441T2 inclNVM44/385 complete. T3failed:272selected but only245returnedfileenvelopes, no completioninferred forothers. Web/T4unexecuted/browsernull;9skips carry platform/binaryreasons. UncachedLinuxx646.8.0-149Node24.21/Nv0.12.5,c8nyc1workers2,3328s/$0.2311accounting;104.803sT0hoststep distinct;advisoriesremainreport-only. C1failed only on originalverificationgate,C2doneunverified,C3sourcecurrent;nothingnewverified. Holdreleased; authorizedretryresultwillreceivefreshsameheadevidenceaudit, no furtherexperimentor sourcechange requested. Static Reviewer reads only.

Criteria: C1 failed (The required configured all-mode run 56cc3b92 failed in host-supervisor; pin assertions passed, but final verification awaits the single authorized same-head retry (unrelated T-2009 attribution).).

### rev-35 · 2026-11-19T14:48:47.937Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1991-evidence-2
commit: b35d36e30dba2b9b460bd04b62e804bf61a8d355
scope: evidence
findings: [{"severity":"medium","text":"Verification E2: the producing hub result records retry bf7a2441 exit 1 during delivery fetch, SSH exit 255 with 'Operation timed out'. The retained log binds this head but contains no test progress records; counts and remote platform/browser are unavailable. This failed pre-test attempt supplies no final clearance. Keep it separate from 56cc3b92 and await the Coordinator-authorized rule-35 run 29e3e474.","file":".cland/artifacts/A-21818-suite-bf7a2441-3368-4375-af97-9d717085e59e-all-at-b35d36e.log","line":124}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence2 NOT CLEAR at unchanged clean b35d36e30dba2b9b460bd04b62e804bf61a8d355/Git931d630c. A-21819 retains bf7a2441/A21818 as a separate failed pre-test attempt: producing hub result reports delivery fetch, SSH exit255 and Operation timed out; retained log itself lacks that failure payload. No new pin-source defect inferred. Log124 binds same head/snapshotdea94c39; no suite-progress records, counts unavailable rather than zero/passing. T0 exit0/80.246s and successful delivery uploads do not imply tests ran; all runtime/Web/T4 phases unexecuted or without completion, planned counts/projections not passes. Remote platform/browser null, c8sfo2 lifetime123s/$0.0085 accounting only. Source3 clearance/C3 current verification retained; C1 final gate failed, C2 done/unverified, nothing new verified. Original56cc3b92 host-supervisor red, own13base+5 passes, CoordinatorT2009 attribution/A21816isolatedpasses remain distinct/A21815+A21817. Primarya7a60a60 authorizes rule35 resubmission1of2, pending29e3e474 at samehead; it is not current proof. Hold released; no source change/additional experiment or retry requested by Reviewer. Static reads only.

Criteria: C1 failed (Retry bf7a2441 failed in delivery fetch before tests; counts are unavailable and final verification awaits Coordinator-authorized rule-35 run 29e3e474.).

### rev-35 · 2026-11-19T16:04:31.616Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1991-evidence-3
commit: b35d36e30dba2b9b460bd04b62e804bf61a8d355
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence3 CLEAR at unchanged clean b35d36e30dba2b9b460bd04b62e804bf61a8d355/Git931d630c; source3 A21802 retained. A-21831 independently audits authorized29e3e474/A21830 finished/passed ownerexit0, provenance50851 samehead/snapshotdea94c39 distinct from Git. Ordinary9145=9133pass(8906top+227nested)/12reasonedskips(8top+4nested),1000passingfiles;70separate currentloadpasses. Own13 cases28840–28904 each basepass+5distinct currentrepetitions/65loads;extra5durationwrapper. CurrentloadIDs have zero overlap with56cc3b92, not reused old proof. C1create/edit/verdict/criterion/coverage/duration overlap/refusal and captured alias passes; owner positive/pending/failure/unknown/recovery controls and zero repeat-entry/<=16new-entry work asserts pass. C2unknown-age and abandonedpin/recovery pass base+5 each. C3sourcecurrentverified retained/T1992C5oldmarkmigration/deletionoff unchanged. All232T1/441T2/272T3/55Web complete,T4unexecuted;NVM71files530records incl3skips. Twelve skip reasons retained;lint/duration/ratchet advisories report-only. UncachedLinuxx646.8.0-149Node24.21/Nv0.12.5,c8sfo2workers2,actual isolatedHeadless1248/ChromeTesting156.0.8078.4;4291s/$0.2980accounting,85.616sT0hoststep distinct. Prior supervisor case now40179pass2.570790423s; original56cc red and bf7 pre-testSSHfailure remain separately scoped A21815/17/19, CoordinatorT2009 attribution/A21816isolatedpasses and a7a60a60 single rule35retry authorization retained. No failed epoch erased or partial proofs combined. No findings;C1/C2verified,C3currentmarkretained,allcriteria verified. Hold released. Static Reviewer reads only.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-19T16:59:35.596Z

Merged 4ccc058a5046770341d529d17e0ec40eb72d5025 onto dev.
