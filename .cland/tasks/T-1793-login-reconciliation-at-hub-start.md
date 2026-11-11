---
id: T-1793
kind: task
title: Login reconciliation at hub start
state: closed
status: done
size: S
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1779
  - T-1786
topic: topic-1476
branch: t/T-1793-login-reconciliation-at-hub-start
created: 2026-11-09T12:44:12.593Z
updated: 2026-11-11T12:24:13.828Z
closed: 2026-11-11T12:24:13.828Z
---

## Summary

At start the hub lists the provider's volumes and frees each login whose host is gone, rather than leaving it `in-use`; a host its watchdog deleted while the hub was stopped is the case in point. The hub deletes reader volumes of gone hosts, and marks a login whose volume is missing `signed-out`, with that reason.

## What to build

A reconciliation pass after the host-lease reconciliation and before the pool runtime's first pass. For each provider, it reads `listVolumes(project)`, then:
- A login in use whose host is destroyed or unknown, or whose volume is detached, loses its binding and reads `ready`.
- A reader volume that is not attached is deleted, with a confirming read.
- A login whose volume is not listed reads `signed-out` with "volume missing".
- A failed inventory changes nothing, is retried on the next pass, and sends one Agents line.
- A tagged volume that matches no login is logged and left to the lost-work check.

## Acceptance criteria

- [x] C1. A fake host deleted by its watchdog while the hub was stopped leaves its login `ready`, with the same volume, after the next start (test).
  - done: impl-1793 · 2026-11-11T09:46:02.785Z
  - verified: rev-35 [reviewer] · run rev-35-1793-final-1 · 2026-11-11T11:40:10.509Z · commit e3767adfd76507a471ec0d1e1b692e4bb5f42e1a
- [x] C2. A login bound to a live host stays `in-use` through a restart, and its host's sessions keep using it (test).
  - done: impl-1793 · 2026-11-11T10:24:56.172Z
  - verified: rev-35 [reviewer] · run rev-35-1793-final-1 · 2026-11-11T11:40:10.509Z · commit e3767adfd76507a471ec0d1e1b692e4bb5f42e1a
- [x] C3. A reader volume of a gone host is deleted at start with a confirming read (test).
  - done: impl-1793 · 2026-11-11T09:46:03.082Z
  - verified: rev-35 [reviewer] · run rev-35-1793-final-1 · 2026-11-11T11:40:10.509Z · commit e3767adfd76507a471ec0d1e1b692e4bb5f42e1a
- [x] C4. A login whose volume the provider no longer lists reads `signed-out` with the reason "volume missing" (test).
  - done: impl-1793 · 2026-11-11T10:28:34.567Z
  - verified: rev-35 [reviewer] · run rev-35-1793-final-1 · 2026-11-11T11:40:10.509Z · commit e3767adfd76507a471ec0d1e1b692e4bb5f42e1a
- [x] C5. A failed volume inventory changes no login, is retried, and sends one Agents line (test).
  - done: impl-1793 · 2026-11-11T09:46:03.461Z
  - verified: rev-35 [reviewer] · run rev-35-1793-final-1 · 2026-11-11T11:40:10.509Z · commit e3767adfd76507a471ec0d1e1b692e4bb5f42e1a

- [x] C6. The pass leaves pending bindings and reader intents in creating/deleted phases (the T-1778 fence) to their owners' receipts, never clearing them by row edits, and records each confirmed volume deletion through LoginRecords.deleteStorage (test).
  - done: impl-1793 · 2026-11-11T11:05:27.128Z
  - verified: rev-35 [reviewer] · run rev-35-1793-final-1 · 2026-11-11T11:40:10.509Z · commit e3767adfd76507a471ec0d1e1b692e4bb5f42e1a
## Blocked by

- T-1779
- T-1786

## Notes

- Hot files: `hub/src/host/login-reconcile.ts` (new), `hub/src/host/host-restart.ts`, `hub/src/hub/daemon.ts` (the start order).
- Tests: new `hub/test/login-reconcile.test.ts` (T3: the hub stopped, the watchdog deleting a fake host, then a start; T2 for C3 to C5).
- Serves epic C9. The spec calls this inferred and verified in the live run; on fakes it is fully testable.

## Comments

### impl-1793 · 2026-11-11T09:08:03.165Z

Rule 20 sweep before changing Login: suite shared transitive graph reaches 697 tests, including 15 unknowns conservatively reached; complete path sets published in this item topic. Explicit field/frame/function sweep includes production logins store/readers/binder/release/snapshots/verdicts/keys/signin, scheduler, HostRecords, daemon/dispatch, CLI login JSON formatter, protocol and shared/wire exports, adapter claude-code; web/Neovim have no login-row parser. Docs/skills: docs/hub/logins.md, host-providers, accounts-and-limits, running, adapters-and-sessions, implement skill; QA E-1535 stages 1–3 and E-1531/E-1536 briefs. All prior Login shapes remain valid: optional signedOut only, no frame changes, CLI JSON passes rows through. Exact old-shape login-records and login-list regressions retained. Native reached owners specifically host-create-ready, host-destroy-native, host-restart, host-unreachable, host-stop, login-write-back; task native evidence limited to changed startup behavior and macOS cases, full coverage deferred to configured batch/stage occasions. Approved seam markSignedOut retains bindings/readers; transition ready→signed-out added; sign-in clears signedOut. Red proof: signed-out receipt test fails TypeError r.markSignedOut is not a function on baseline.

### rev-35 · 2026-11-11T09:24:11.435Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1793-source-1
commit: 6db1bb6c61c02973a8b2268b778f0b6c906fb671
scope: full
findings: [{"severity":"medium","text":"Standards / rule26: the pass awaits inventory before enumerating current login identities. A retry can therefore apply an old inventory to a newly signed-in/ready volume and mark it missing. Capture bounded candidate ownership before the read and revalidate after awaits; lead024e2732 confirms no admission exclusion or generation owner.","file":"hub/src/host/login-reconcile.ts","line":35},{"severity":"medium","text":"Standards / rules24,26: detached reader cleanup replaces the admitted operation.volume with inventory before deleteReaderVolume's identity guard. saveReader does not compare retained created/size, so changed native identity is normalized away. Preserve and compare the captured volume via the shared reader identity policy before any deleting checkpoint; leadf1e0202e confirms.","file":"hub/src/host/login-release.ts","line":44},{"severity":"medium","text":"Standards / rule23: bindings(login) materializes the complete non-exclusive reader set with .all(); no cardinality bound exists. The active-disk decode test does not cover this retained set. Use indexed bounded/incremental binding work and a reader-heavy work-budget control; lead79870252 confirms.","file":"hub/src/host/login-reconcile.ts","line":38},{"severity":"medium","text":"Standards / rule12: fixture cleanup awaits owner/release/store fail-fast; a rejected earlier close skips later drainage. The inventory/held-close cases also register Store cleanup only after seeding. Prearm each allocated handle and attempt all closes in dependency order on setup and teardown failure; lead0f0941a4 confirms no earlier owner.","file":"hub/test/login-reconcile.test.ts","line":29},{"severity":"low","text":"Standards / rule16: 'leaving [in-use] clears bindings atomically' contradicts the new markSignedOut retained-binding path documented later. Qualify transition() versus markSignedOut at this current state-model description; lead27350785 confirms the drift.","file":"docs/hub/logins.md","line":86},{"severity":"medium","text":"Spec / C3: missing original volume signs out and continues before settled reader cleanup; the active-only cursor then excludes that row, as well as pre-existing signed-out rows with outstanding readers. Those clones can remain billable indefinitely, especially for unknown hosts. Discover indexed settled-reader obligations independently of sign-in state while preserving pending intents; lead3995bb88 confirms no recovery guarantee.","file":"hub/src/host/login-reconcile.ts","line":42},{"severity":"medium","text":"Spec / reconciliation progress: a still-attached settled binding is skipped without retry. For an unknown/gone host lacking provision recovery, a delayed detach is never revisited until restart. Retain actionable ownership and retry for positive detachment, without polling healthy live attachments; lead79870252 confirms.","file":"hub/src/host/login-reconcile.ts","line":46},{"severity":"medium","text":"Spec / C2: retained binding plus persisted running status does not establish continued native login use. The fixture mounts an empty disk and leaves fake login access disabled; no post-restart turn/read is observed. Seed/enable the existing rotating fake login and assert a fresh native receipt on that same retained volume. Lead27350785 withdraws the broader diagnostic C2 claim.","file":"hub/test/host-restart.test.ts","line":75}]
finding_counts: {"high":0,"medium":7,"low":1}

A-18639 complete two-commit/12-file initial source pass against fixed base697c33ddd: Standards4medium+1low / Spec3medium. Correct startup/shutdown placement and initial retained signed-out seam established; all eight findings confirmed by lead. Diagnostic C2 claim narrowed to binding/running metadata, no native continued-use proof. C1 remains unverified; unknown/gone-host delayed detach also lacks retry. Include Coordinator db5a3d79's later UUID episode-id amendment in the repair, with non-advancing-clock controls and consumer accounting. A-18627/A-18628 reachability only; labelled original output/provenance limits and normalized path-tier-disposition supplement being prepared without reruns. No configured result or Reviewer experiments. Hold released for consolidated fixes, then fresh committed source review before verify and approved exact-head native preservation. Full remainingT3/T4/after-stageQA separate.

Criteria: C2 failed (Retained binding/running metadata lacks a post-restart native login-file use receipt.), C3 failed (Missing/signed-out original paths can strand reader clones, and detached cleanup replaces captured native identity before validation.), C4 failed (A stale retry inventory can sign out a newly published ready volume identity.), C5 failed (New failed-inventory fixture can leak storage on setup or earlier close rejection.), C6 failed (The new shared deletion path overwrites a retained reader volume identity before the exact-identity guard.).

### impl-1793 · 2026-11-11T09:27:18.904Z

Review repair contract amendment (Coordinator db5a3d79): optional signedOut now includes generated UUID id alongside reason/host/at. Existing Login consumers from A-18627/A-18628 retain unchanged handling; no field removed or reply-frame change. T-1789's cards/notices will use id for episode identity. Seam red→green: non-advancing clock distinct episodes failed on missing id, then passed. Reconciliation continues to call the snapshot owner's shared beginRelease(hostLost); it neither clears retained backup intent/receipt nor interprets absent snapshots as non-delivery. No separate snapshot policy/fence added.

### impl-1793 · 2026-11-11T09:40:15.692Z

C2 proof disposition (Coordinator 8c378043): chose retained native worker + binding, post-restart Host.loginDiskReachable at the same machine generation, and a Host.readFile at the validated logical login path whose bytes equal the existing fake OpenCode harness's pre-restart rotation. This is mounted-login persistence/continued host availability evidence; it does not claim an MCP/spoke round trip. Three diagnostic attempts at stronger message/hello gates failed; the last failed initial hello before shutdown and captured native serve logs with only listening lines, no MCP connection attempt. Those unrelated gates were removed; no bound widened or transport code patched.

### impl-1793 · 2026-11-11T09:45:17.692Z

Consolidated repair: active disk and settled binding discovery now use independent indexed pages≤64, including signed-out reader obligations. Captured private store revision before each inventory prevents changed or same-clock ABA sign-in identity from stale reads; point binding lookups/exists checks avoid materializing reader history. Shared native reader volume comparison exported/reused before deleting checkpoint; captured created/size preserved. Unknown/gone delayed detachment retries, including deleting intents requiring exact-id deletion after list omission; healthy attachments remain inert. Fixture handles prearmed on AsyncDisposableStack, attempt-all disposal and adverse-close regression. C2 chosen persistence proof passed macOS diagnostic9.091s; no MCP claim. Retained snapshot receipt test uses beginRelease owner unchanged. A-18645 normalizes reached∪unknown∪explicit by string/object tier and execution/disposition; A-18646 labels original producer/candidate capture limits. Linux/ready verification and exact-reviewed-head native evidence remain unexecuted.

### rev-35 · 2026-11-11T09:52:22.299Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1793-source-2
commit: a2591d49a10a04be2964f69ab4f2253b36f49603
scope: full
findings: [{"severity":"medium","text":"Standards / rule26: after one awaited binding release, page() copies the latest login revision onto every same-login candidate. identity() excludes state/storage/backup and contains no binding episode, so an external same-values writer unbind/rebind/reattach during reader A's deletion is blessed with A's old detached inventory. Writer cleanup only compares public binding JSON. Preserve each candidate's admitted episode through awaits or obtain fresh inventory for changed ownership; lead7c84cacd confirms no excluding owner.","file":"hub/src/host/login-reconcile.ts","line":62}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18650 complete nine-file corrective pass: Standards1medium / Spec0additional. Seven prior findings resolved in source; original inventory/new-publication case improved but a later held-release/rebound-writer variant still bypasses captured revision ownership (lead7c84cacd). C2 Coordinator8c378043 mounted-byte persistence proof implemented and honestly excludes MCP roundtrip; signedOut UUID amendment and equal-clock controls present. A-18645 normalized721 paths/15unknowns, diagnostics A-18646/A-18647 remain pre-review dirty-candidate support, no configured/exact-head runtime proof. Explicit five-file native set and wrapper linkage supplement forthcoming without reruns. C6failed; other criteria remain for final same-head evidence. Hold released for remaining per-binding episode fence and regression, then fresh source review before verify. No Reviewer experiments; broaderT3/T4/after-stageQA separate.

Criteria: C6 failed (Page-wide latest-revision refresh can authorize old inventory after a concurrent same-values binding episode.).

### impl-1793 · 2026-11-11T09:54:27.436Z

Source2 remaining ownership repair: private login_bindings.episode generated at each binding admission, read by indexed exact login/host key, retained by phase settlement. It is absent from public LoginBinding/wire JSON. Candidate captures this episode before inventory; no page-wide revision blessing remains. Shared detached release coalescing keys on episode and revalidates it after snapshot/native awaits, including the reader deletion owner's authorization callback. Existing bindings migrate with an empty private episode sentinel; any later admission gets a fresh UUID. Sweep of login_bindings insertion/schema consumers includes store constructor/addBinding plus login-capacity's explicit-column migration fixture; public shapes unchanged. Held-reader-A/rebound-writer-B test failed with actual binding=null on a2591d49a, then passed with exact public values retained.

### rev-35 · 2026-11-11T09:58:39.837Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1793-source-3
commit: 1732420869289dae13566af4c04e3f0b54a70943
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18651 complete eight-file corrective pass: Standards0/Spec0. Per-binding private episode captured before inventory, never page-refreshed; shared coalescing and writer/reader authorization retain it across awaits. Held-A/rebound-B and held-writer-fence controls preserve replacement admissions. Private legacy migration/public-shape/downgrade consumer handled; earlier repairs and Coordinator C2 mounted-byte scope preserved. All original findings source-resolved. C1–C6 done but final verification awaits unchanged-head configured and approved five-file native receipts. A-18648 finite native/deferred split, A-18649 reconstructed exact launcher linkage and A-18647 dirty-candidate outputs remain qualified support, not head proof. Hold released for mode-free verify then serial exact-head native preservation with native close/signal/error and full inventory facts. No Reviewer experiments/provenance-only reruns/full task-head suite requested. Remaining229T3/broaderT4/after-stageQA separate.

### rev-35 · 2026-11-11T10:20:24.786Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1793-evidence-1
commit: 1732420869289dae13566af4c04e3f0b54a70943
scope: evidence
findings: [{"severity":"medium","text":"Standards / rule20 missed startup consumer: the required restored-wait test seeds an in-use synthetic volume-codex-a without a provider volume. New startup inventory correctly marks codex-a signed-out ('volume missing'), so required placement never publishes and A-18652 fails 'restored process publication: not within 15000 ms'. Lead8df4f76b reproduces exact before/after facts at173242086. Migrate this startup fixture to a matching directory-provider volume/attachment and sweep other startup consumers; retain the placement assertion and existing bound, then request fresh source review.","file":"hub/test/waiting-launch-restart.test.ts","line":119}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18653 audits failed configured run1fab93a1/A-18652 at source3head: exact error 'restored process publication: not within15000ms', waiting-launch-restart:100/fixture119. Lead8df4f76b task-head reproduction confirms codex-a in-use→signed-out, syntheticvolume-codex-a, volume missing. Missed task-reached fixture migration; no shared/flake disposition. Base5314completed tests=5313pass1fail,575passfile1failfile; separate225load test/file passes, completedtotal5539/5538pass1fail. Reconcile20cases eachbase+5positive butnotfinalclear. T0/T1exit0,T2partialred;changedT3/Webunexecuted, browsernull. UncachedLinuxx64Node24.21/Nvim0.12.5,1016s/$0.0705; advisorybudget/lint/tier findings separate. Source3ownershipfixes remain source-established. No finalcriteria verified; C2failed. Hold released for matching fake-provider volume/attachment fixture migration and broader startup-consumer sweep, then fresh source review before verify/native slot. Devcomparison pending, no result inferred. No Reviewer experiments/unchanged-headfullretry/provenance-only rerun.

Criteria: C2 failed (Required restored-session compatibility case times out after its synthetic login is signed out by startup; C2 native acceptance phase remains unexecuted.).

### impl-1793 · 2026-11-11T10:24:24.355Z

Configured red1fab93a1 fixture migration diagnosis: exact case waiting-launch-restart::restored wait places once on capacity commit and placed launches never restore failed task173242086 alone on macOS15.205s; origin/dev697c33ddd archived disposable checkout passed242.286ms. Temporary read-only import probe captured codex-a in-use→signed-out, volumeId volume-codex-a, reason volume missing. Shared settledLogin now async allocates real fake-provider inventory via FakeHostProvider with captured project/region/id/clock; optional real acquired machine attach is positively confirmed. All explicit callsites in9files migrated/awaited; nonfake metadata-only seams remain scoped provided fixtures, explicit volume callers own existing native volumes. Failing restored-placement case now passes257.957ms, and both surviving/deleted-volume projectHub restart controls pass. Full targeted8-file T2 group125/125. Widened shared transitive consumer sweep:15known+16unknown=31 reached, unknown conservatively counted; source2 explicit6-file native set adds host-relaunch, remaining T3/full Linux batch and T4/stage split recorded in artifact. No reconciliation test exemption and no dev merge.

### rev-35 · 2026-11-11T10:27:27.511Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1793-source-4
commit: 60f949e949c9fc053e9c899f237be6b342b9cdf3
scope: full
findings: [{"severity":"medium","text":"Standards / docs/agents/tests.md Test levels and rule28: both new T2 projectHub restart cases omit FakeClock and explicit fake process/lock facts on both hub lifetimes. They inherit real timers/dates and the harness PID/identity probe defaults. Supply one shared FakeClock to hub/provider/fixture time readers and explicit fakeLockProcesses facts for hub and droplet/spend seams; lead a0622d18 confirms no outer injection. Keep restart assertions and resource tier intact.","file":"hub/test/login-reconcile.test.ts","line":17}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18655 complete12-file shared-fixture migration review: Standards1medium/Spec0additional. Original synthetic-volume consumer mismatch resolved by sealed directory-provider allocation, confirmed actual-machine attachment and all awaited callsites; production source unchanged. New paired T2 projectHub controls lack fake clock/process seams (leada0622d18), requiring one shared FakeClock and both fake lock/process fact owners. C4failed; no finalcriteria verified. A-18654 adds31 conservative fixture consumers/16unknowns, six directed native files; finalaccounting must union prior inventory. Task/dev diagnostic/red history retained, no new configured/native receipt. Hold released for fixture correction and fresh source review before verify/native slot. No Reviewer experiments or provenance-only reruns; broaderT3/T4/after-stageQA separate.

Criteria: C4 failed (New paired missing-volume T2 startup regression uses real clock/default process probes instead of shared fake clock/process facts.).

### rev-35 · 2026-11-11T10:29:23.261Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1793-source-5
commit: f1c001fc801ac5063ee9f4fd1565efa48f6ca2e4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18656 focused two-file corrective pass: Standards0/Spec0. Both new T2 hub lifetimes/provider/allocator/outer Store share one FakeClock, explicit hub/droplet fake process facts and synthetic lock identity; startup verification joins before fixture work. Assertion/tier/bounds/attempt-all cleanup preserved. A-18655 finding resolved; production source3 and source4 positive-volume migration intact. C1–C6done, final verification awaits current-head configured/native receipts. Retain A-18653 red history; union A-18648 full721 with A-18654 fixture31 for final case/file accounting; six directed native files, remainingT3/T4/after-stageQA separate. Hold released for mode-free same-head verify then approved serial exact-head native slot after hub result. No Reviewer experiments/provenance-only/full-task-head run requested.

### rev-35 · 2026-11-11T10:49:16.747Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1793-evidence-2
commit: f1c001fc801ac5063ee9f4fd1565efa48f6ca2e4
scope: evidence
findings: [{"severity":"medium","text":"Standards / rule20: native settled-login migration creates detached provider inventory but supplies no actual attachment/mount before hub startup; provision machines are synthesized only afterward. Startup clears the seeded binding and initial worker launch at line90 fails 'login codex-f1: outcome unknown' in all three relaunch cases (A-18657). Lead a3bff642 confirms no earlier positive receipt. Migrate this native fixture through existing confirmed FakeHostProvider/mounted-login seams, preserving all relaunch assertions and captured cleanup ownership.","file":"hub/test/host-relaunch.test.ts","line":56}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18658 audits configured a68fbca8/A-18657: all3 host-relaunch variants fail initial launch:90 with exact 'login codex-f1: outcome unknown'. Confirmed missed native fixture boundary (lead a3bff642): detached allocated volume, no actual pre-start attachment/mount, synthetic machines added afterward. Base5701finishes=5698pass3fail/620passfile1failfile; separate235load test/filepasses; completed5936/5933pass3fail. T0/T1/T2exit0; changedT3host-restart passes10.916s once,host-relaunch3fails;Webunexecuted/browsernull. Reconcile22cases eachbase+5pass and priorwaitingconsumerpass retained. C6 mark records incomplete required native ownership-consumer acceptance, not a failure of its positive component cases; no finalcriteria verified. UncachedLinuxx64Node24.21/Nvim0.12.5,966s/$0.0670; advisoriesreport-only. Hold released for positive native volume/machine/mount fixture migration and fresh source review before replacement verify/native slot. No Reviewer experiments/unchangedhead retry/provenance-onlyrerun; allredhistoryretained.

Criteria: C6 failed (Required native settled-binding consumer cannot reach its ownership assertions: all three initial admissions return outcome unknown because fixture attachment/mount is unestablished.).

### impl-1793 · 2026-11-11T10:55:43.236Z

Second enforced-red a68fbca8 native migration fixed: isolated host-relaunch running case reproduced at f1c001fc8 (login codex-f1 outcome unknown, native code1/null signal). Native host-relaunch now opts into shared sshHostFixture FakeHostProvider acquisition, sharing project fake inventory for both exact machines; mountedSettledLogin confirms attach/mount before hub startup and retains original work account/assertions. Provision metadata uses captured native machine births. Shared SSH fixture adds optional provider-acquisition and afterNativeJoin hooks; default provided-host consumers unchanged. Mounted cleanup occurs after native/agent/carrier census join before outer storage removal, and a cleanup callback failure retains the root. Shared helper account option is additive. Transitive contract consumers32known+16unknown conservatively reached; A-18662 records scope/disposition. Full native host-relaunch3/3 passes diagnostic (7.149640/6.054891/5.888818s; code0/null signal), full TMPDIR sets9874→9874 no appeared/disappeared, A-18661. Existing allowances29/24/27s cover projected Linux/headroom ceilings18/15/15, ownerC-216 addedNov11 expiresNov18. No replacement configured run or final reviewed-head native receipts yet.

### rev-35 · 2026-11-11T10:58:28.129Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1793-source-6
commit: 191e7357eca818fe6af3ced3c015f77d231a8980
scope: full
findings: [{"severity":"medium","text":"Standards / rules12,26: the new opt-in nested provider branch places f2 native writers under f1's shared providerRoot, but f2 cleanup's positive census still covers only f2.root. If host/agent close rejects while a captured f2 writer remains in its provider machine directory, cleanup can set joined=true and remove f2 ownership/secret/DB storage before the outer census joins it. Lead93850b70 confirms no earlier closure guarantee. Include the captured f2 machine/children in positive closure, retain f2 metadata on incomplete join, and prove live sibling f1 is untouched; do not scan/signal the whole shared provider root.","file":"hub/test/ssh-host-fixture.ts","line":41}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18663 complete four-file native-fixture corrective pass: Standards1medium/Spec0additional. Original detached inventory mismatch corrected via actual captured provider machines and positive mounted login before startup; account/generation/control/checkout/relaunch assertions preserved. New providerRoot moves nested f2 writers outside f2.root, but final census only covers f2.root, allowing premature metadata/root disposal after rejected joins (lead93850b70). C6failed; hold released for captured-machine/children closure and adverse/no-sibling control, then fresh source review before configured/native evidence. A-18661 precommit diagnostics/fullTMP sets and existing unchanged allowances remain qualified support; A-18662 shared-fixture32+16unknown joins prior conservative union. No finalcriteria verified/Reviewer experiments/provenance-only or unchangedhead run requested; redhistory and T3/T4/stage split retained.

Criteria: C6 failed (Nested provider fixture can remove ownership storage before captured out-of-root native writers are positively joined on close rejection.).

### impl-1793 · 2026-11-11T11:04:34.314Z

Source6 cleanup correction: opt-in SSH provider fixture captures its exact machine directory at acquisition; native census/join covers own root plus only that directory/descendants, never whole shared provider root. Provider-owner close errors retain ownership metadata/root even after fallback native join. New adverse native test reproduced root deletion (ENOENT on nested root) on prior code, then whole file4/4 and final focused prearmed-native-receipt control passed; sibling worker remains alive. A-18664 preserves raw producer output/code/signal/argv/cwd and full TMPDIR9874→9874 no changes, labelled dirty diagnostic. Existing three allowances29/24/27 cover updated samples7.818/7.182/6.825s; new native control samples3.210/3.114s gets report-mode8s allowance ownerC-216 added2026-11-11 expires2026-11-18 (Linux1.6x projection, not a receipt). Shared fixture consumers/default-options scope unchanged from A-18662. No dev merge/configured replacement or final-head native receipts yet.

### rev-35 · 2026-11-11T11:08:06.319Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1793-source-7
commit: e3767adfd76507a471ec0d1e1b692e4bb5f42e1a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18665 complete four-file/two-commit focused pass: Standards0/Spec0. Exact acquired machineDirectory joins own-root census with deduplicated captured identities; no shared-parent sweep/sibling signals. Provider close failures retain metadata/root even after fallback joins. Adverse native test prearms exact completion observer, proves retained root/secret and live sibling, then restores/joins owner; original3relaunch assertions unchanged. New8s allowance reports mac samples/unexecuted Linux projection, owner/expiry; no policy/baseline transfer or other duration entry change. Source6 finding resolved; earlier production/source repairs preserved. A-18664 raw dirty-candidate diagnostics/fullTMP sets remain qualified support, notheadproof. Hold released for unchanged-head mode-free verify then six-file exact-head native set after hub result. FinalC1–C6await receipts; union all conservative consumer inventories. Redhistory and broaderT3/T4/after-stageQA split retained. No Reviewer experiments/provenance-only/full-task-head run requested.

### impl-1793 · 2026-11-11T11:34:10.063Z

Final exact-head evidence at e3767adfd76507a471ec0d1e1b692e4bb5f42e1a/tree60e54b9e4f6211ad8960a8a24a87da518a89a94e: configured run98952686/A-18666 exited0, reported6018/6018 pass; T0,T1,fallback-all T2,changed T3 twofiles/fivecases once,Web completed on Linuxx64 6.8.0-147-generic Node24.21.0 c-8/lon1 (1156s,$0.0803). Web used pinned Chrome Headless Shell1248 GoogleChromeForTesting156.0.8078.4; budgets report-only. All22 reconciliation generated case names have six recorded passing observations each (base+5), explicitly checked apart from exitstatus.
Directed native preservation at same clean head: sixfiles22/22 passed serially on macOSarm64 Node24.21.0, each producer code0/signalnull/spawnErrornull, no browser/local suite gate. A-18667 contains original launcher source/argv/cwd/pid/native closes/TAP and full before/after inventories; slot and per-file TMPDIR9874→9874, appeared/disappearedempty. A-18668 unions all consumer inventories with actual case/file receipts, conservative unknowns and explicit unexecuted dispositions. Secret-pattern scans had positive controls before publication. Existing relaunch29/24/27s allowances sufficient; new adversecontrol8s allowance retained. Prior enforced-redA-18653/A-18658 preserved. Remaining fullT3 belongs to Linux merge batch; broaderT4 and after-stage QA unexecuted/separate. All criteria done; requesting Reviewer final same-head settlement.

### impl-1793 · 2026-11-11T11:37:19.646Z

Final capture disposition per Coordinator dbe5ec1e: A-18667 meets this release's publication rule because the secret scan exited0 with a matched positive control over exactly the declared outputs before publication. Runs were fake-only/sentinel; no real credential was used. The executed capture launcher still lacked a shared write-time redactor; A-18669 preserves that limitation and the original scan facts without relabelling raw TAP. Existing T-1808 tracks the shared evidence publish helper; this capture limitation does not block T-1793. Runtime/source head remains e3767adfd, no rerun or code change.

### rev-35 · 2026-11-11T11:40:10.509Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1793-final-1
commit: e3767adfd76507a471ec0d1e1b692e4bb5f42e1a
scope: evidence
findings: [{"severity":"low","text":"Known nonblocking capture limitation: A-18667 executed runner writes raw TAP without shared write-time token/bearer redaction. A-18669 labels original raw streams and exact9-output positive-control pre-publication scan transcription/limits; no redacted-stream claim. Coordinator dbe5ec1e explicitly accepted this fake-only release publication and tracks the shared guard under open T-1808. No provenance-only rerun or source change requested."}]
finding_counts: {"high":0,"medium":0,"low":1}

A-18670 final same-head settlement. C1–C6verified via source7/current98952686/A-18666 and nativeA-18667. Independent6018base test/673base file pass;235separate load test/file pass,47identities×5. All671manifest lower/Web+all468requiredunion lower files case+file positive; reconciliation22case names eachbase+5; host-restart1+host-relaunch4baseonce, priorwaitingfailure passes. Union721=716tests+5static;470configured+4additionalnative+242deferred(228T3/14T4). A-18668's4582eventrefs checked0discrepancy. Native6files22/22 currenthead darwinarm64kernel27.0.0Node24.21 eachPID/argv/cwd/close0/signalnull/spawnErrornull; allperfile/slotTMPDIR9874unchanged (os.tmpdironly, notall/tmp/globalempty). Git60e54b9e/export17a830cf independentlymatched. UncachedLinuxx64Node24.21/Nvim0.12.5HeadlessShell1248Chrome156.0.8078.4,1156s/$0.0803. Existing/newallowances/report-onlynotices retained. Oneacceptednonblockinglow rawcapture/T1808 disposition explicit, noactualcredential claim beyondpatterns/fake-only. Bothredhistoriesretained. FullremainingLinuxT3/broaderT4/after-stageQA separate; no peritemQA. Holdreleased; no further run/sourcechange/Reviewerexperiment.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-11-11T12:24:13.828Z

Merged 15ee523432c0b8e2acbab8552b40485eaeec947c onto dev.
