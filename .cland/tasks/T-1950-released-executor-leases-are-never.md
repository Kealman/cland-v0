---
id: T-1950
kind: task
title: Released executor leases are never removed, so every readLeases() call reads and parses 4,202 lease.json files and the hub idles at 75–105% CPU
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1605
branch: t/T-1950-released-executor-leases-are-never
created: 2026-11-17T20:26:17.945Z
updated: 2026-11-18T04:18:37.905Z
closed: 2026-11-18T04:18:37.905Z
---

## Summary

Hub 58279 (restart #81) sits at 75–105% CPU with an empty queue (sampled 20:24–20:30Z, 2026-11-17, by cland-impl). Load average is 8 and RSS 0.8 GB. `.cland/run/executor/leases` holds 4,202 directories, all `state: released`, the oldest with a 2026-10-14 deadline, and nothing ever removes them. `readLeases` (hub/src/executor/droplet/lease.ts:88) reads and JSON-parses every `lease.json` sequentially on each call, and callers then filter out released ones. The callers are suites.ts:853, 966 and 1057; droplet.ts:81, 88, 104, 515, 540, 589 and 609; and spend.ts:256. droplet.ts:88, 104 and 589 also serialise all 4,202 into the `executor-leases` meta row. CPU profiles show `readLease` as the top project frame at 7–9% self. The four libuv pool threads have about 79 min of system time each against 2.7 min of user time, so the cost is file I/O in the pool. Deliveries still inject within a second; nothing is broken yet.

## What to build

A released lease leaves the hot read path once the spend ledger has recorded it. That means archiving it to a cold directory or deleting it, or keeping an index of non-released leases that `readLeases` reads instead of the whole directory. The `executor-leases` meta row holds only live leases. Existing released leases are moved out once, by the hub itself at startup or through a migration, never by hand, and only after their spend records are confirmed.

## Acceptance criteria

- [x] C1. With 5,000 released leases and 2 live ones, `readLeases` reads at most the live leases plus a bounded index, and the `executor-leases` meta row lists only live leases (test with a fake leases root, counting files read).
  - done: impl-1950 · 2026-11-18T01:35:17.178Z
  - verified: rev-35 [reviewer] · run rev-35-1950-evidence-3 · 2026-11-18T03:18:13.113Z · commit aacf00c0fdc35923dd77b028cd7c178fab365720
- [x] C2. A released lease is removed from the hot path only after its spend entry is durable; a lease whose spend entry is missing stays put and is reported (test).
  - done: impl-1950 · 2026-11-18T00:59:32.240Z
  - verified: rev-35 [reviewer] · run rev-35-1950-evidence-3 · 2026-11-18T03:18:13.113Z · commit aacf00c0fdc35923dd77b028cd7c178fab365720
- [x] C3. The one-off migration of existing released leases is idempotent and safe across a crash part-way through, and every reader (rule 41: suites.ts, droplet.ts, spend.ts, doctor, status) is listed with its disposition (test).
  - done: impl-1950 · 2026-11-18T00:59:32.980Z
  - verified: rev-35 [reviewer] · run rev-35-1950-evidence-3 · 2026-11-18T03:18:13.113Z · commit aacf00c0fdc35923dd77b028cd7c178fab365720

## Comments

### coord · 2026-11-17T21:07:21.475Z

Coordinator, 2026-11-17 21:10Z. (1) Added to E-1883 stage 1 by the human stand-in's decision on ask fd6a70ec (D24): T-1950 lands before the next macOS cover if the current one fails. (2) Restart #82 (pid 57331) did not lower the load: 95–109% CPU again, and a `topic answer` took 3,218 ms against the 250 ms slow-request budget. (3) The restart gap was 87 s. The startup step from "binding listeners" to "binding web listener" took 64 s (21:02:52Z to 21:03:56Z). Find out whether the lease read sits inside that step, and if so measure it before and after the fix. If it doesn't, report it and I'll file a separate item.

### impl-1950 · 2026-11-17T21:12:49.543Z

Consumer inventory (rg on readLeases/readLease/leaseRoot/lease.json/executor-leases across hub/src, hub/test, nvim, web, shared, docs and .agents/skills): production hot readers are suites.ts (budget, restore, retry/accounting), merge-queue.ts (idle), droplet.ts (admission, save/checkpoint meta, inspect, reconcile, sweep), spend.ts hostLeases (cross-project orphan safety), heartbeat.ts (meta), git-maintenance.ts (meta + former raw directory scan, migrated to readLeases). Doctor/status/CLI consume executor.inspect via dispatcher and have no direct file reader; wire reply unchanged. Demos.reconcile remains hot; Demos.#leases status/stop uses bounded latest-per-epic demo index. Direct readLease users suites.ts, droplet.ts, watchdog.ts retain original paths/files. lease.ts serialized writers maintain index-before-file publication. All test-tier consumers found: executor-admission, executor-spend, demo-release, executor-deletion-confirmation, executor-lock-liveness, verification-workers, executor-reap-confirmation, demo-start helper, demo-release-component, executor-watchdog, executor-recovery-collection, suite-accounting, executor-safety-component/case, git-maintenance-recovery, suite-remote-budget, demo, suite-close-component, executor-prepare-component, system-processes, state-inventory, remote-scripted, executor-admission-lock, heartbeat, executor-droplet-component, startup-ready-component, remote-cleanup helper, scenarios/droplet-verify, executor-prepare, daemon, remote-fixture-parent. Historical released-list assertions will use explicit retained-history lookup; live-only guards stay on readLeases. No frozen CLI bytes or wire fields change. docs/hub/running.md describes ownership; no shipped skill example/raw nvim/web reader found.

### impl-1950 · 2026-11-17T21:19:56.087Z

Rule 41 follow-through: raw reader qa/briefs/T-271.md newlease/leasef intentionally locates and reads retained original directories in a disposable QA root; unchanged paths/bytes make it unaffected. host/agent release.json readers are a different host-launch release receipt, unaffected. suite-admission-cost raw readdir asserts no acquisition directories, unaffected (index lives beside leases/). merge-queue.test.ts deliberately corrupts a lease file after startup; its fixture now explicitly puts that damaged lease in the hot index. Current old-list historical consumers migrated to readLeaseHistory: executor-admission, executor-lock-liveness, daemon, demo-start, executor-admission-lock, executor-prepare and component, executor-safety-case and component, remote-cleanup, remote-scripted, scenarios/droplet-verify, startup-ready-component, suite-accounting, suite-close-component, verification-workers. Remaining live-only readers executor-recovery-collection, state-inventory, suite-remote-budget and remote-fixture-parent retain readLeases. No UI wire shape change, and previous wire readers remain compatible.

### impl-1950 · 2026-11-17T23:16:04.884Z

Post-quiet follow-through: Demos.reconcile now reads the bounded latest-per-epic demo index too, so restart still emits the destruction report after released entries leave the hot list. New regression shown red (`restart reports the latest released demo after compaction`, 0 !== 1), then green after migration. Source inventory disposition supersedes earlier note saying Demos.reconcile remains readLeases-only. Full lint found owned sorted-tier-manifest insertion failure; corrected new entry ordering. remote-scripted T2 now 5/5 green after slot release.

### rev-35 · 2026-11-17T23:47:14.569Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1950-source-1
commit: 4987996287a270922aabb1aa5d91de979233e211
scope: full
findings: [{"severity":"medium","text":"Standards / C1: every hot read parses the demos map, which grows without aggregate bound across historical epics. The 5,000-record test has only one demo and proves file count, not bounded index bytes/work. Separate the approved latest-per-epic cold lookup from hot metadata and cover many distinct epics.","file":"hub/src/executor/droplet/lease.ts","line":52},{"severity":"medium","text":"Spec / C2,C3: compaction drops an enumerated id on missing lease.json without released/settled proof. After repair, requireFiles and git-maintenance cannot see the incomplete directory and lose the old conservative no-prune guard. Retain/report uncertainty and test repair followed by maintenance.","file":"hub/src/executor/droplet/lease.ts","line":94},{"severity":"medium","text":"Spec / C3: startup compacts settled released leases before the recovery list and its key/key.pub cleanup. A crash between spend settlement and cleanup therefore leaves keys with no cold cleanup owner; already-released #release also compacts without cleanup. Preserve cleanup ownership and test that ordered crash window.","file":"hub/src/executor/droplet/droplet.ts","line":546},{"severity":"medium","text":"Spec / C3: failed acquisition can finish release/settlement/compaction before rejecting, so the unchanged hot-only lookup no longer attaches the released lease to job.lease as before. Preserve this result through a bounded run-bound receipt/lookup and regression; the retained spend entry alone is insufficient.","file":"hub/src/hub/suites.ts","line":1057}]
finding_counts: {"high":0,"medium":4,"low":0}

Full source review against fixed base 85a289f6dd1993180194246ff0fd1e22cd9b8254, head 4987996287a270922aabb1aa5d91de979233e211 / Git tree 28207400bd1206b1bd75d44c4214e59d1e0990d8. Not clear: Standards 1 medium, Spec 3 mediums; all details and retained evidence limits in A-20954 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20954-t-1950-full-source-review-bounded-index-and-recovery-gaps.md). No fifth mock-lifetime finding: the reviewed unbounded original-work join does not establish the earlier bounded-join restoration defect. A-20941/A-20951 remain qualified local support: broad T1 historical round 879 pass/3 fail, narrower corrections green, T2 before final periodic repair, lint overlapped wrapper edit, final committed-head typecheck exit0; no configured verification. QA none. Consolidated correction followed by fresh source review; Coordinator window after clear. No Reviewer execution or edits.

Criteria: C1 failed (Historical demo-epic pointers leave every hot index read proportional to retained history.), C2 failed (Index repair drops incomplete lease ids without settlement proof and hides them from conservative readers.), C3 failed (Repair loses incomplete-directory protection; pre-cleanup compaction skips key disposal; Suites failed-acquisition lookup loses released lease metadata.).

### impl-1950 · 2026-11-18T00:01:31.532Z

A-20954 correction census: compactLeaseIndex's callback now carries a structured reason (spend vs missing record); sole production consumer compactLeaseHistory updated. Incomplete prior index ids are unioned with scanned directories on repair and retained/reported. New cold formats demo-leases/<sha256(epic)>.json and demo-reports/<lease>.json are produced only by compaction; readDemoLeases consumes the requested pointer or at most 32 queued report entries. Demos status/stop/reconcile are the only readers; acknowledgeDemoReport persists the lease-bound reporting receipt before queue removal. No hot reader decodes a cold epic map. Both local key removals precede compaction's membership removal. Optional admitted callback on DropletExecutor.acquire: Suites captures/saves the exact run-bound lease after durable reservation; suite-unit fixture semantic fake migrated. suite-cover wrappers forward rest args; suite-close/suite-soak early-refusal fakes create no lease, unaffected; suite-queue-policy success fake returns its lease, unaffected. Direct executor/demos callers omit the callback, retaining prior interface behavior; wire/CLI shapes and frozen help bytes remain unchanged. No dev merge after first source review.

### rev-36 · 2026-11-18T00:25:32.868Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1950-source-2
commit: d2a2b6fbd63969d34c8a80d3795181919a5a2855
scope: full
findings: [{"severity":"medium","text":"Standards/rule39: new compaction failure overwrites confirmed Released results. The already-released branch rejects; the normal confirmed/settled branch's #compact:488 rejection enters provider cleanup catch and returns null accounting/unconfirmed despite durable release. Preserve selected release result and report compaction secondarily on both paths; add focused fake fault controls. Author confirms4d752c62.","file":"hub/src/executor/droplet/droplet.ts","line":471},{"severity":"medium","text":"Standards/rules9/12: the new failed-acquire regression has raw suiteUnit(t), no pre-acquisition whole-case join/fence/root adoption or separately named setup bound. The two new repair-to-maintenance rows at git-maintenance-recovery:80–83 share this gap; ownPolicyDirectory only registers rm after acquisition. Own/join complete caller continuations before teardown and separately bound setup; preserve assertions. Confirmed2e0f9a2e/ea21fb26.","file":"hub/test/suite-accounting.test.ts","line":32},{"severity":"medium","text":"Standards/rule38: new fake-command repair-to-maintenance cases inject run/lock semantics but have no positively exercised native launch guard from setup through teardown, including callback/custom-promisify routes. Reuse the shared fake-only guard under joined ownership; no real process probe needed. Author confirmsea21fb26.","file":"hub/test/git-maintenance-recovery.test.ts","line":83},{"severity":"low","text":"Evidence scope: A-20957's 14-file 'T2-selected' command actually includes12 T2 +2 T1 files (suite-remote-budget and web-notifications are T1 at the pinned manifest). Retain its188 positive outcomes/command unchanged and correct the tier description additively; no rerun or classification change needed."}]
finding_counts: {"high":0,"medium":3,"low":1}

A-20960 full review at tree1931d4350d99183e6eea43cdf49871ea88b615ad, fixed base85a289f6dd1993180194246ff0fd1e22cd9b8254. Standards3medium+1low; Spec0 independent findings. All four A-20954 production findings are corrected: cold per-epic pointers outside hot metadata, retained/reported uncertain IDs through repair, ordered key cleanup before hot removal, and run-checked admitted lease handoff into Suites. Approved bounded demo-report drain/source controls present. C3 fails on remaining standards defects; C1/C2 have no source finding and remain unverified pending configured evidence. A-20957 immutable-head local commands retain884+188 named pass lines,0fail/cancel/skip; exact631-byte/3-file many-epic control and new named controls found independently. Mixed selection corrected to12T2+2T1;102 requested files, not complete tiers or typed per-file envelopes. Full lint/typecheck exit0/0refusals with130report-only advisories; old879/3 round and raw/native/hash limits retained. No configured/T3/T4/provider/browser or idle-CPU proof.84-path direct/transitive census and all102 selections recorded. No Reviewer execution or edits. Hold released for consolidated source/test/evidence correction and fresh source review before verify/window; no dev merge or stress run requested.

Criteria: C3 failed (Ancillary compaction can overwrite confirmed release/accounting, and the new recovery regressions lack caller ownership/setup bounds or a positive native guard.).

### rev-36 · 2026-11-18T01:08:30.874Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1950-source-3
commit: 1eedd9ec2b75564d17530911b9289bee5eb011fd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-20986 consolidated full source review: Standards clear / Spec clear, no findings. Head/tree1eedd9ec2b75564d17530911b9289bee5eb011fd /9a63a2a2f5326b5de816d95ea42f05bdb0e63f48; fixed base85a289f6dd1993180194246ff0fd1e22cd9b8254, clean/pushed, no dev merge. All A-20960 findings resolved: both new compaction awaits preserve confirmed Released accounting with secondary maintenance diagnostics; failed-acquire caller now pre-enrolls bounded whole-case ownership/fixtures/root adoption/steps; repair cases moved to existing T2 per62307899 with positive fakeNativeGuard retained through joined teardown; new release-fault controls independently join original release before restoring injection. All predicates/receipt/no-prune/accounting assertions retained. A-20974 corrects historical mixed-tier label without reusing oldT1 proof; current192 selection is12T2+2T1. Full33-file/six-production-file source basis retained and92-path refreshed/retained census recorded. A-20978 immutable tracked-source local receipts parsed: root typecheck/lint exit0,0refusals/130report-only advisories;88T1files882 positive named passes,14mixedfiles192,0fail/cancel/skip, exact current631UTF8-byte/3-read5000epic control and new repair/release/accounting names positive. No complete tiers/per-file envelopes/configured/T3/T4/provider/browser/CPU speedup claimed; raw native/hash limits, untracked noncompiler Markdown staging interval, parent/historical red epochs qualified. C1–C3 source correct but runtime criteria remain unverified pending configured same-head named evidence. QA none. Hold released; lead may request Coordinator verification window. Reviewer did no tests/compiler/lint/generator/probes/edits.

### rev-36 · 2026-11-18T01:22:34.227Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1950-evidence-1
commit: 1eedd9ec2b75564d17530911b9289bee5eb011fd
scope: evidence
findings: [{"severity":"medium","text":"Configured run ce49a5f7 / A-20988 fails the enforcing new-identity 5 s budget: the new history-counting case records 5.595559226000001 s (reported 5.596 > 5), despite passing its assertions. T1 command and owner exit 1; five passing assertion repetitions do not supersede the gate failure. Coordinator 0eac0460 attributes this to T-1950 and orders fixture-cost correction, no allowance, preserving scale/controls, then delta review and a new window.","file":"hub/test/executor-lease-index.test.ts","line":15}]
finding_counts: {"high":0,"medium":1,"low":0}

A-20990 failed-evidence settlement at unchanged clean head 1eedd9ec2 / Git tree 9a63a2a2f5326b5de816d95ea42f05bdb0e63f48. Hub ce49a5f7-c99b-4fe6-a8ee-9522601cbe5d is finished/failed, verification snapshot 60bb668bbc37df9e4cc995fec6bbb6d9d19d0747. Literal enforcing diagnostic A-20988:10104, T1 command end 10134 exit 1, owner finish 10136 exit 1. Base history case finish/timing 1791/1792 pass 5.595559226000001 s, diagnostic 1794 retains 5000 distinct epics, 2 live, 3 files/631 UTF-8 bytes. Both task identities have exact 5/5 assertion proofs; all repetition durations retained, not promoted to budget success. T0 exit 0; 225 base file envelopes and 1818 base test finishes positive, separate 10 load finishes explain 1828 completed count. T1 phase fails its gate; selected T2/4 T3/1 T4 guard/Web unexecuted. Linux x64 droplet Node24.21.0/nvim0.12.5, cached:null, browser binary/version null. Report-only 0.5 s T1 row and unrelated duration regressions are distinct, unattributed here. C1 failed for test-gate rejection, not a functional count mismatch; C2/C3 unverified. Source basis A-20986 retained. Coordinator 0eac0460 authorizes reduced repeated fixture work, preserving all scale/spend/repair/crash controls, no allowance; before/after quantities, delta source review and new window, no resubmit of this run. Reviewer hold released for that correction; prior run stays FAILED/PARTIAL. No Reviewer execution, edits or retry.

Criteria: C1 failed (The new counting test passes its functional 3-file/631-byte assertions but breaches the enforcing 5 s budget in configured run ce49a5f7.).

### impl-1950 · 2026-11-18T01:34:50.089Z

A-20990 duration correction at 5e382f502e24e47be9d198d30afa91bff8b80c60, test/doc-only, no allowance. 5000-distinct-epic historical root repaired once, reused read-only; report mutations65demo root, spend/repair faults4record root, batched seed joins all writers. Same88file local T1 importer command:884/884; scale1471.359250ms, report48.883375ms, spend/repair72.252000ms, unchanged recovery110.868208ms; exact3reads/631bytes/no enumeration retained. Full typecheck and full test:lint exit0 at this immutable head;130 existing report-only lint findings/0refusals. A-20998 retains full merged command transcripts, prior local4325.117292ms combined case and failed Linux5595.559226ms, scope/platform/load limits. ce49a5f7/A-20988 remains FAILED/PARTIAL; revised head has no configured/T2/T3/T4/Web proof yet. Requesting Coordinator-directed delta review.

### rev-35 · 2026-11-18T01:40:15.927Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1950-source-4
commit: 5e382f502e24e47be9d198d30afa91bff8b80c60
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-20999 clears Coordinator0eac0460's duration-correction delta against source-cleared1eedd9ec2 / A-20986, current Git treebfb935e6fe1051b8b4439d2d05fd53479fc48a53. Standards0 / Spec0. Only test/guide changed, no production/tier/budget/allowance/dev merge.5000-distinct-epic count/bytes/status checks preserved; independent65-demo report and four-record mutation roots retain original assertions. AllSettled seed joins every writer before failure; shared fakeOnlyFixture/positive native guard retained. Complete recovery/meta/key-cleanup/periodic-repair case tail byte-identical; outside controls untouched. Independently parsed A-20998 current immutable-head transcripts: full typecheck/lint exit0,0refusals/130 report-only; same88 selected T1 files884 pass (882 top-level +2 indented), no nonpass. Scale1471.359250ms/report48.883375ms/spend-repair72.252000ms/recovery110.868208ms; exact3reads/631bytes/zero enumeration. Artifact copy SHA256 matches9a50600f1bec36cae29a002a914af7f97a2bcefa4f86315ef9c8e2559c57890f. Case partitions/work/load/platform limits retained, no uniform speedup or configured gate pass claimed. Failed ce49a5f7/A-20988 remainsFAILED/PARTIAL: base5.595559226s breached enforcing5s gate despite assertion/repetition passes; later phases unexecuted. C1/C2/C3 runtime verification remains pending new exact-head configured evidence. Hold released for new Coordinator window; no resubmit of failed run or further local stress/native request. QA none; Reviewer static reads only.

### rev-35 · 2026-11-18T02:07:00.779Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1950-evidence-2
commit: 5e382f502e24e47be9d198d30afa91bff8b80c60
scope: evidence
findings: [{"severity":"medium","text":"Configured0d27cbd4/A-21013 fails four credential-I/O identities: first/fourth ERR_INVALID_STATE database-not-open from ProcessTable→Sessions→HubCore→Immediate; archive/relaunch realpathSync ESM-loader stacks versus expected[]. T2 and owner exit1. Coordinator961c854e/47f6537b provisionally attributes to T-1950 and directs unloaded base/head file comparison before correction/shared disposition; underlying cause remains unproven. No retry or promotion of this partial run.","file":"hub/test/session-credential-io.test.ts","line":72}]
finding_counts: {"high":0,"medium":1,"low":0}

A-21023 failed/partial evidence settlement at unchanged clean5e382f502 / Git treebfb935e6fe1051b8b4439d2d05fd53479fc48a53; delivered snapshot a0dab6478ae46003cbad366ea53286c4d364d5eb, cached:null Linuxx64 droplet Node24.21/Nvim0.12.5, browser null. Actual fail frames25189/25193/25197/25201,file fail25225,diagnostics32340–32422;T2exit1 32550,ownerexit1 32554. T0/T1exit0;225T1filepasses;387T2files386pass/1fail,44NeovimT2unexecuted.5955pass/4fail ordinary plus45loadpasses explain6000pass/4fail completed count. Four taskT1cases and five taskT2controls ordinary+5/5 positive retained. Scale base1.981781195s, repetitions1.8784–2.3835s,3reads/631bytes/no enumeration; currentT1 enforcing5s gate passes,0.5s notice report-only. Selected4T3/1T4guard/55Web unexecuted. No C1/C2/C3 runtime verification marks or new criterion failure inferred solely from provisional attribution. Prior ce49a5f7 remainsFAILED/PARTIAL. Coordinator primary decisions authorize base-vs-head unloaded comparison after this pin releases, then attributed ownership/import correction+regression or both-red report for shared attribution; changed head source review/new window required. No Reviewer probes/edits/retry. Hold released;QA none.

### impl-1950 · 2026-11-18T02:38:36.183Z

A-21023 correction at aacf00c0fdc35923dd77b028cd7c178fab365720, approved Coordinatorbd3b14ea. Base85a289f isolated comparison7/7 vs5e382f4/7 (ERR_INVALID_STATE) confirmed owned exposure. Fixes: credential fixture core publications stop before separate table disposal (daemon.ts:619 order); pool-image import only after recovery discovery; Droplet.close tracks/joins direct startup+periodic reconcile. Shared all-sync trap unchanged, extracted once. Three new T2 controls shown intended red then green, with positive loader control/native launch guards/joined fault restoration; original credential7 assertions retained. Initial observer/drain setup failures explicitly retained and not treated as intended red. Rule41 census64 broadclose/73 constructor paths, other ordering candidates/dispositions listed in A-21032. Exact-head full typecheck/full test:lint exit0/0refusals130report-only;90 selectedT1 aggregate908/908 (one truncated toolchunk,835 top-level named lines retained; controls/aggregate complete);21 selectedT2272/272 with272 named positives. Scale0.792876792s/5000epics/3reads/631bytes. No configured/current-headT3/T4/Web/native lifecycle evidence. ce49a5f7 and0d27cbd4 stay FAILED/PARTIAL. Comparison root retained after automatic deletion rejection; Coordinator noted cleanup. A-21032 durable copy SHA2564ac4e82b88fa5ada2b9bfb762cb9d0e299ce63a8e4534aab27ecfcb0f360a4d8.

### rev-35 · 2026-11-18T02:46:23.333Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1950-source-5
commit: aacf00c0fdc35923dd77b028cd7c178fab365720
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-21035: approved recovery correction delta clear, Standards/Spec no findings, exact Git tree980184fdc0a1ea3f50a3c64962f3995268443fd5; base5e382f502 with full basisA-20986/A-20999. Production-order credential disposal, positive-discovery lazy import and enrolled/joined direct reconcile satisfy Coordinatorbd3b14ea. Original7 criterion callbacks/assertions and noSync trap body retained verbatim; held-index controls join original promises before restoring faults. Static consumer census distinguishes bare/lightweight hubs from root-bearing recovery. A-21032 hash independently matches4ac4e82b..., selectedT2 has272 positive lines/272aggregate; T1 has908aggregate but only835top-level+2nested retained positive names due explicit truncated chunk. Current full typecheck/lint exit0/zero refusals,130report-only advisories; local scale792.876792ms/3reads/631bytes is not loaded Linux/CPU proof. Failed setup epochs and both failed configured runs remain failed/partial. C1–C3 runtime unverified, QA none; lead may seek new Coordinator window for fresh same-head mode-free evidence. Reviewer static reads only; no execution/edits.

### rev-35 · 2026-11-18T03:18:13.113Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1950-evidence-3
commit: aacf00c0fdc35923dd77b028cd7c178fab365720
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-21043 final evidence clear at unchanged clean aacf00c0f / Git tree980184fdc; source basisA-20986/A-20999/A-21035. New run2e47bcfe/A-21042 finished/passed, delivered tree8b13b62e. Static structured audit:225/225T1,431/431T2,55/55Web,4selectedT3+1T4 all716file envelopes and6744ordinary tests pass;60separate task load passes across12identities each5/5, zero unfinished/orphan/nonpass/skip/cancel. Scale2.136688381s with5000epics/2live/3reads/631bytes;5reps1.735–2.151s below enforcing5s,0.5snotice advisory. Durable-spend/interrupted-repair, live-onlymeta/directhistory, keycleanup, boundedreports, maintenance uncertainty, compaction-secondary accounting and failed-acquire attachment controls all positive. Original credential7 and three correction controls positive, resolving relevant prior failure boundaries.116warning identities exactly matchA-21013; eight T1 rows are positively controlled shared lower-spawn refusal paths.15ticket-lost strings attributed to15source fake-stderr modes with corresponding structured pass frames, not outer failure. T0/T1/T2/T3/T4/Web+ownerexit0. Remaining265T3/16T4unexecuted;selectedT4baseonly. Linuxx64 Node24.21/Nvim0.12.5,isolated CfT156Headless1248,cached:null;1477s/$0.1026 billing not wall. Lint130/63,zero refusals,ratchet equal/budgetsreport-only. Both prior failed rounds stayfailed/partial. C1/C2/C3 verified,QA none; no Reviewer execution/edits or CPU-speedup claim.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-18T04:18:37.905Z

Merged 91d59bbe8aa34f06ac43dc7e9b43483d036aa034 onto dev.
