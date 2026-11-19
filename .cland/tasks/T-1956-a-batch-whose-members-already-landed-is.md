---
id: T-1956
kind: task
title: A batch whose members already landed is reported "blocked" when a post-landing ps check times out, and the notice tells the Coordinator to cancel and re-enqueue the merged members
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1647
branch: t/T-1956-a-batch-whose-members-already-landed-is
created: 2026-11-18T02:51:26.880Z
updated: 2026-11-19T13:34:18.462Z
---

## Summary

Batch 917ab106 (2026-11-18) landed T-1937 at 02:48:20Z (0c2540bc5) and T-1951 at 02:48:52Z (54e153e08). At 02:49:00Z the hub posted "batch 917ab106 blocked: cannot inspect the OS process table: ps failed or timed out … Coordinator: diagnose and resolve the cause, then cancel and re-enqueue each retained head: cland merge T-1937 --cancel; cland merge T-1937; …" to both item topics. Both items were already merged and the queue had moved on to the next batch. Following the notice would cancel and re-enqueue landed work. The same window also had a follow-up failure for T-1937 ("could not stop impl-1937: its process identity cannot be verified"), repaired with cland merge T-1937. The trigger was a ps timeout while the machine and hub were under load (see T-1950).

## What to build

A process-table failure after a member has landed never marks the batch blocked and never suggests cancel or re-enqueue for merged members. It is reported as a follow-up diagnostic on the landed items, with the repair command that applies (rule 39: a later ancillary failure adds a secondary diagnostic and never overwrites the outcome). A ps failure before landing keeps today's blocked behaviour, retry advice included.

## Acceptance criteria

- [x] C1. With a fake ps that times out after every member has landed, the batch records landed outcomes, no blocked notice is posted, and the follow-up diagnostic names the repair (test).
  - verified: rev-36 [reviewer] · run rev-36-1956-final-2 · 2026-11-19T12:47:37.085Z · commit 40724f62627aff2969f0a85f03ec981793f0fd22
  - done: impl-1956 · 2026-11-19T12:55:46.021Z
  - verified: rev-36 [reviewer] · run rev-36-1956-final-3 · 2026-11-19T13:34:18.164Z · commit e5037c0c5c3cdc0e7a8d74687127bfde074ea8ed
- [x] C2. With the same ps timeout before landing, the batch is still held as blocked with its retained heads (test).
  - verified: rev-35 [reviewer] · run rev-35-1956-evidence-1 · 2026-11-19T08:30:04.831Z · commit 8c9379698bd527c26b23952d185947845ced3d26
  - verified: rev-36 [reviewer] · run rev-36-1956-final-1 · 2026-11-19T09:36:25.092Z · commit e4b8c31e5a055211fc2af63533d1bbc076c93df4
  - verified: rev-36 [reviewer] · run rev-36-1956-final-2 · 2026-11-19T12:47:37.085Z · commit 40724f62627aff2969f0a85f03ec981793f0fd22
  - done: impl-1956 · 2026-11-19T12:55:46.269Z
  - verified: rev-36 [reviewer] · run rev-36-1956-final-3 · 2026-11-19T13:34:18.164Z · commit e5037c0c5c3cdc0e7a8d74687127bfde074ea8ed

## Comments

### coord · 2026-11-19T02:56:00.216Z

Recurred 2026-11-19 at 02:53:53Z. Batch 45b4bcd2 landed T-1976 (157bf6b2f, 02:53:13Z) and T-1975 (2d7fe873e, 02:53:46Z). Both items are closed and the queue is empty, yet 7 s later the hub posted "blocked: cannot inspect the OS process table: ps failed or timed out" with cancel and re-enqueue instructions for both merged members. A ps probe right afterwards took 0.03 s for 705 processes at a 1-minute load of 5.3. I did not follow the instructions. This is the second recurrence; worth pulling into the next stage.

### coord · 2026-11-19T04:39:56.909Z

Third recurrence, 2026-11-19 04:39:43Z. Batch 1c6ae520 landed T-1958 as 183f0f95d at 04:39:35Z, and the item is closed. Eight seconds later the hub posted "blocked: cannot inspect the OS process table" with cancel and re-enqueue advice for the merged member. The queue had already moved on to the next batch (5173aa29), with a 1-minute load of 10.4. I didn't act on it. Three recurrences in about 26 h, so this should go into the next stage.

### impl-1956 · 2026-11-19T06:23:22.822Z

Consumer search before change: MergeBatches persisted merge-batch / merge-follow-up-reports and its completion, retry, cleanup and notice paths; dispatch.ts batch boundary, batchNoticeId and verification publication; merge-queue.ts snapshot/retry handling; protocol.ts MergeQueueSnapshot; cli/merge.ts, cli/suite.ts and suite-tier-report.ts blocked projections; web VerificationView.tsx/useVerification.ts and shared/wire verification schemas; nvim verification projections searched. Test consumers include merge-batches, merge-queue, suite-persistence, merge-gate, verification-tree, suite-t3-interactions, merge-batch-dependencies, git-maintenance(-recovery), host-allow-list and executor-prepare-component; QA merge batch briefs and merge skill; frozen CLI usage fixture searched. Intended change keeps existing wire shape; cleanup failure becomes durable secondary cleanup work, so existing clients keep their previous shape. No new outcome inferred from error text.

### impl-1956 · 2026-11-19T06:26:47.956Z

Consumer inventory correction/addition: actual web readers are web/src/sessions/VerifyLine.tsx, verification.ts, state.ts and connection.ts; Neovim readers are verification.lua, state.lua, init.lua and hub.lua. They currently ignore batch diagnostics and accept additive optional cleanups; previous queue-shape regression remains in web-verification-model.test.ts. Additional persistence/maintenance consumers: git-maintenance.ts, daemon.ts, dev-t3-probe.ts; no changed batch wire fields. Optional cleanups projection is added to merge.queue, suite.queue, verification.queue and hub.status; CLI merge and verify queues render path/error/retry time. Private cleanup metadata is not sent on the wire. Existing outcome, failed and notice ids remain compatible. Coordinator approved separate retained cleanup with capped backoff and guarded removal.

### rev-35 · 2026-11-19T06:43:07.251Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1956-source-1
commit: d1ba716fee1cc5bb9b51cddefe6bb7bbdb82d9c8
scope: full
findings: [{"severity":"medium","text":"Spec M1: new cleanup persistence invokes changed() without containment; a publication/reconciliation exception can escape before terminal batch clearance or during old cleanup retry and tick's generic catch marks the landed or unrelated active batch blocked. Keep ancillary errors separate, preserve positive cleanup, and independently control changed/report failures.","file":"hub/src/hub/merge-batches.ts","line":123},{"severity":"medium","text":"Standards M2: delayed/restarted cleanup reuses cwd/head/tree but boundary removal only stat-checks the path, without validating the current root/worktree against the admitted candidate. UUID uniqueness is not authority over a replacement checkout. Add captured identity revalidation before signals/removal, with fresh cleanup and replacement/restart no-inherited-authority controls.","file":"hub/src/hub/merge-batches.ts","line":367},{"severity":"medium","text":"Standards M3: full retained batch snapshots are parsed/rewritten/projected without cardinality/work bounds, and all due cleanup is awaited before batch progress. Backoff caps delay, not backlog or liveness work. Apply Coordinatoraaa9a35e's existing-store cap32oldest/visible overflow/bounded tick and projection scope, demonstrating bounded work while retaining pending-root ownership; no indexed redesign without prior concrete scope decision.","file":"hub/src/hub/merge-batches.ts","line":118},{"severity":"medium","text":"Standards M4: new T2 projection callback has no pre-acquisition whole-callback owner, separate setup bound, constructor-rejection fallback ownership or positively controlled full native-launch guard. Existing fixture/projectHub resources do not join the enclosing original setup/body. Use existing owner/guard and retain controls through positive closure; preserve public/private projection assertions.","file":"hub/test/merge-queue.test.ts","line":77}]
finding_counts: {"high":0,"medium":4,"low":0}

Full source NOT CLEAR at cleand1ba716fee1cc5bb9b51cddefe6bb7bbdb82d9c8/tree340f2df2, base808a00be1 after pre-first-review dev merge. Four medium findings in A-21622, no high/low; lead83cdd43d/b03633b5/2596aa40/519bb7b8 confirms no omitted owner/contract/bound. Primaryf2d25b4c accepts automatic guarded cleanup separate from item follow-ups; aaa9a35e limits correction to existing-store32oldest cap/visible overflow/bounded tick/backoff/projection plus three correctness fixes, no indexed redesign mandated. Preserve every pending root's authority until positive cleanup. Source primary outcome catch, filtered recovery advice, additive optional projection and previous-shape/consumer/docs scope reviewed; tests cover ordinary/report failure but not these gaps. A-21619 corrects A-21613:108T1,39T2,58cases across5namedT1files and full lint/typecheck0 are evolving precommit observations, not fixed-d1 runs; original red and inner T1484advisory retained, unknown invocation/raw/native/scan facts stay unknown. No configured/T3/T4/Web pass. C1failed,C2doneunverified,nothing verified. Hold released for bounded fixes and fresh immutable-head source review before verification. Reviewer no runtime/probe/source edit.

Criteria: C1 failed (Ancillary changed-callback failures can still publish blocked landed outcomes; delayed cleanup lacks identity/bounded-work fences and new projection regression lacks complete ownership/guard.).

### impl-1956 · 2026-11-19T06:52:16.819Z

Correction consumer inventory: BatchCandidate adds optional captured checkout ownership, used by checkoutMergeBatch and removeMergeBatch through batch-candidate-ownership.ts. merge-batch-dependencies.test.ts now supplies actual HEAD^{tree} instead of 'fixture'. DevT3Probes' current independent-clone path is unaffected; historical linked-worktree checkpoints without a captured marker now preserve the root and refuse automatic retirement (no inherited cleanup authority). Provider BatchRepository fakes remain responsible for their fake checkout/remove boundary and need no native marker. Ownership metadata stays private in durable candidates; optional public cleanupOverflow adds unresolved count/oldestPath. CLI merge/verify queues render overflow; existing web/Neovim queue clients ignore optional fields. Coordinator approved capped retry/overflow disposition in 8c142478.

### rev-35 · 2026-11-19T07:10:19.286Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1956-source-2
commit: f949c1bb1ae3f31d59432635e32faac513247f52
scope: full
findings: [{"severity":"medium","text":"Spec/Standards M1: cleanup admission reserves ASCII error bytes, while initial/retry errors are truncated by UTF-16 code units and serialized as JSON. Multibyte or escaped errors can exceed that reservation and make #saveCleanups throw into tick's generic blocked handler, overwriting a landed or unrelated active batch outcome. Bound actual encoded bytes and contain ancillary failure; cover near-capacity admission and retry with multibyte/escaped errors.","file":"hub/src/hub/merge-batches.ts","line":356},{"severity":"medium","text":"Standards M2: native ownership validates canonical owner.cwd, but process guarding receives raw candidate.cwd. The var/private-var alias can therefore pass identity validation while resolve(worktree) misses canonical receipt roots and live writers. Pass the validated canonical cwd to the process guard and exercise an actual nonempty owned-writer receipt; the empty-row alias control does not prove this boundary.","file":"hub/src/batch-candidate-ownership.ts","line":72},{"severity":"medium","text":"Standards M3: afterCleanup's bodyClosed receipt proves callback settlement only. After captured hub cleanup rejects, this fallback can close its still-owned databases and restore the native guard without positive hub/resource closure. Distinguish constructor-failure fallback from returned-owner cleanup, retain controls/resources after rejected closure, and prove retention through registered cleanup.","file":"hub/test/merge-queue.test.ts","line":86},{"severity":"medium","text":"Spec M4: overflow reporting is attempted once; on rejection only count/oldestPath and a publication-error remain, without item diagnostic or recipients. Clearing the batch can permanently lose the required notice. Apply Coordinator29cf62b3: individual durable notice obligations in existing meta/outbox, bounded pages per tick, release only on positive delivery receipt, and throw-then-redelivery with the active batch cleared; leave checkout markers and the 32-record cleanup retry cap unchanged.","file":"hub/src/hub/merge-batches.ts","line":363}]
finding_counts: {"high":0,"medium":4,"low":0}

Full source NOT CLEAR at clean f949c1bb1ae3f31d59432635e32faac513247f52/tree23030fc47e8f9ea246fe8c2b871464b891be0517, parent d1ba716f, original base808a00be. A-21643 records four medium residual findings, no high/low: encoded-byte reservation/outcome containment; validated canonical cwd must scope writer guard; returned-hub positive close must fence DB/control teardown; durable overflow notice obligations. Lead confirmations bbc957be/097b0a30/c17a6389/e9c0c09f retained. Primary29cf62b3 authorizes individual existing-meta/outbox notices with bounded pages/positive delivery, without marker extension; retry cap32 and overflow/no-admission-hold scope remain. Normal changed callback containment, capped retries, native ownership checks and additive consumer/docs corrections are retained positives. A-21634's fixed-head local209/209/full typecheck/lint0 are selected evidence; precommit native red/greens and A-21619 earlier epochs remain separately scoped, unknown raw/native/scan facts stay unknown. No configured verification pass. C1failed,C2done/unverified,nothing verified. Hold released for bounded corrections and fresh immutable-head source review before verification. Reviewer performed no runtime/probe/edit.

Criteria: C1 failed (Ancillary encoded-byte budget errors can still select blocked outcomes; failed overflow reports lose the required durable item diagnostic. Canonical process guarding and the new fixture's positive-close fence also remain incomplete.).

### impl-1956 · 2026-11-19T07:26:24.290Z

Source3 consumer/flow additions: individual merge-cleanup-notice:<candidate hash>:<item> records in existing Store.meta retain text, one pinned member and captured requester id; Store.metaPage uses primary-key keyset paging with SQLite-side byte clipping (no new table), cursor persisted separately, at most one overflow notice replay per tick. BatchBoundary.report now requires positive durable notice receipts; dispatch checks item/Agents publication ids, replays requester delivery via noticeToSessions(captured by.id), and routes unknown-item responsibility to Coordinator. Stable ids support replay after a partial publication. Counted overflow roots have an idempotent per-identity count marker. No wire shape/help/config change in source3. Canonical owner.cwd now scopes the real fixture guard; encoded-byte and live-writer controls reproduced source2 failures before fixes. Returned T2 owners require successful dispose and registered-cleanup receipts; rejected cleanup retains DB/root/native guard, constructor-only fallback stays distinct.

### rev-35 · 2026-11-19T07:44:35.460Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1956-source-3
commit: 2ab7882185d094d7aeb32b2c7ac1719a3d657f10
scope: full
findings: [{"severity":"medium","text":"Spec/Standards M1: each overflow notice copies the full queue entry, retaining unneeded dependencies and its uncapped changed-path list. A valid large dependency entry can exceed the 64 KiB notice cap, roll back the notice/count transaction and repeatedly retain a fully terminal active batch, blocking next-batch progress. Use an explicit minimal delivery/member projection and cover a large dependency-bearing entry through overflow, batch clearance and later notice replay.","file":"hub/src/hub/merge-batches.ts","line":422},{"severity":"medium","text":"Standards/Spec M2: captured-id requester publication is restricted to cleanup:overflow:. Ordinary durable cleanup: notices still resolve copied by.name, so a rename can omit the admitted requester or deliver to a replacement name holder while report returns successfully and reported=true releases its obligation. Apply the same captured-id/positive-publication policy to all retained cleanup phases, preserving human handling; cover unavailable, renamed and reused-name requester recovery.","file":"hub/src/hub/dispatch.ts","line":452},{"severity":"low","text":"Standards L1: #reportCleanup discards the publication exception. The unreported flag preserves retry, so this is not a lost-obligation blocker, but the known secondary cause disappears while the original ps error remains. Retain a bounded secondary publication diagnostic, as the overflow path does, without replacing the cleanup outcome; assert that both causes survive failure.","file":"hub/src/hub/merge-batches.ts","line":398}]
finding_counts: {"high":0,"medium":2,"low":1}

Full source3 NOT CLEAR at clean2ab7882185d094d7aeb32b2c7ac1719a3d657f10/tree269f3b21, parentf949c1bb, originalbase808a00be, no dev merge. A-21659 records two medium residual notice findings and one low: full-entry dependencies can exceed notice budget/rollback and hold terminal batch; ordinary cleanup: phases still route requester by copied name, while captured-id positive-publication is overflow-only; ordinary report catch loses secondary cause although retry survives. Lead1bc37328 confirms no admission bound/exclusion for oversized dependencies. Bounded fixes: explicit minimal delivery/member projection; shared captured-id policy for retained cleanup phases with human semantics preserved; bounded secondary report diagnostic. No table/marker extension, cleanup cap32 unchanged. Actual encoded-byte bound, canonical nonempty writer guarding, positive returned-hub/registered-cleanup fence and admitted-tick retry/page budgets address source2. A-21658 retains fixed-head selected213/213,10/10CLI,fulltypecheck/lint0 (129advisories/zero refusals); precommit native2/2/red epochs remain separately scoped, no configured/Web/T4 proof. C1failed,C2done/unverified,nothing verified. Hold released; fresh immutable-head source review before configured verification. Reviewer static inspection only.

Criteria: C1 failed (Full-entry overflow notices can exceed 64 KiB and hold terminal batch progress; ordinary retained cleanup notices can mark publication complete after losing the captured requester through name-based routing.).

### impl-1956 · 2026-11-19T07:53:27.565Z

Source4 closes A-21659 M1/M2/L1 at 8c9379698: overflow notices explicitly project item/head/captured requester id with placeholder unused fields (no dependencies/display-role payload); all cleanup: phases share captured-id/positive-publication routing; ordinary report failures use the existing bounded secondary diagnostic while preserving job.error. Regressions shown red first: >64KiB dependency metadata retained a terminal batch; ordinary requester receipt was absent under old-name reuse; secondary diagnostic was empty. Fixed-head nine-file batch now 223/223 passed, including CLI compatibility/help. Final full compiler/lint checks follow with no source change.

### rev-35 · 2026-11-19T08:00:30.552Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1956-source-4
commit: 8c9379698bd527c26b23952d185947845ced3d26
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source CLEAR at clean8c9379698bd527c26b23952d185947845ced3d26/tree60a76fc1, parent2ab788218, originalbase808a00be; no dev merge. A-21667 closes A-21659 M1/M2/L1: explicit minimal overflow delivery projection excludes dependency/display payload; all retained cleanup: phases use captured requester-id/positive durable-publication policy with human semantics preserved; ordinary report errors retain bounded secondary context without replacing ps cause. Positive >64KiB/5000-path control checks separate landed/terminal-clearance/compact-obligation/replay facts; public ordinary+overflow receipts exclude another live holder of the old name. Existing callback/resource/guard ownership, canonical native writer checks, actual encoded-byte bounds and admitted-tick budgets remain intact. Standards and Spec source clear, findings[]. A-21664 fixed-head selected223/223 nine files, full typecheck/lint0 (129report-only/zero refusals) are local Darwin/Node24.21 evidence; three actual red controls and evolving precommit native2/2 remain separate, missing raw/native/scan facts unknown. No configured/full-tier/Web/T4 pass inferred. C1/C2done but both runtime-dependent/unverified. Hold released; Implementer may request Coordinator mode-free verification window at this exact head, then same-head evidence settlement. No extra standalone/provenance run requested. Reviewer static inspection only.

### rev-35 · 2026-11-19T08:30:04.831Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1956-evidence-1
commit: 8c9379698bd527c26b23952d185947845ced3d26
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head CLEAR at clean8c9379698bd527c26b23952d185947845ced3d26/Git tree60a76fc1; source4 A-21667 current. A-21677 audits bc99f3c2/A-21676 beyond exit0. C1 two post-landing cases pass ordinary0.120179037/0.154154452s plus5/5 each, retaining landed/null-active/guarded-root/repair/no-blocked facts, next-batch progress and positive cleanup/nonrepetition. C2 pre-landing case0.104899860s+5/5 preserves blocked pinned heads/recovery. All12owned generated T1/T2 regression identities base+5/5; complete index6942pass/723file envelopes,0nonpass/unfinished. Separate270load tests+270files cover54identities,60owned+210site, not added toordinarytotal. T0/allT1/allfallbackT2 inclNeovim44files385tests/Web complete. T3 changed-duration only merge-batch-dependencies2/2 once,0.284003811/0.267051603s; addedwall1.247s excludesmachinewait, no fullT3/repetition claim. RemainingT3batchdeferred,T4unexecuted. Uncached snapshot706d79d0 differs fromGit tree; Linuxx64/Node24.21,nvim0.12.5,c8ams3,1395s/$0.0969; actualHeadlessShell1248/ChromeTesting156. Generalduration/lintadvisoriesreport-only, includingmerge-batches19.108s>advisory10s and129lintfindings62files. Earlierlocal/red/precommitnativeepochs remain separately labelled; no retroactivefixedheadclaim. C1/C2verified,findings[]. Hold released; no further item runtime/source change requested. Reviewer static log/source/index inspection only.

Criteria: C1 verified, C2 verified.

### rev-36 · 2026-11-19T09:03:25.583Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1956-delta-1
commit: e4b8c31e5a055211fc2af63533d1bbc076c93df4
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta SOURCE CLEAR at clean pushede4b8c31e5a055211fc2af63533d1bbc076c93df4/tree37d406de84dad99d5d6ec41133e17f233019a915; A-21684. Exact parents reviewed8c9379698 anddev330472a52; Coordinatora7067a19/822ad74d authorizes one merge. Compared resolutions against both parents: injected CLIout preserves cleanup/overflow/JSON rendering; dispatch retains runReferenced/retainsSuiteRun plus cleanup snapshots and dev retention startup; merge-queue retains sealed component CLI/defaultprojectHub/stageTree and dispose capture. Shared exact two-case table selects the existing whole-case positive-close native guard, with consumed membership assertions; all other cases keep file guard. No loss of callback/custom/sync/lower-spawn positive controls or previous root/DB/guard retention assertions. Per-file guidance agrees. Own merge-batches/candidate-ownership/native dependency file unchanged. Prior rev35 source4/evidence remains basis for unchanged T-1956 behavior, not new-head runtime proof. A-21682 retains fixed-head283selected passes/exit0 under standard tripwire enforce; manifest confirms8T1+11T2, not whole tiers. Fulltypecheck/lint exit0 summaries,zero refusals/129report-only findings62files; retained narrative lacks fullraw/native-close/per-checktree/case census facts. Independent source read confirms no nativeIdentityProjectHub in440normalizedT2files. Previous bc99f3c2/A-21676 applies only8c9379698; configured/Web/T3/T4 not rerun at this merge head. No findings/Reviewer runtime/edits. C1/C2done,earlier verification stale; neither verified here. Hold released; request Coordinator's new exact-head verification window and then same-head evidence settlement.

### rev-36 · 2026-11-19T09:36:25.092Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1956-final-1
commit: e4b8c31e5a055211fc2af63533d1bbc076c93df4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head CLEAR at unchanged clean/pushede4b8c31e5a055211fc2af63533d1bbc076c93df4; source deltaA-21684 current. A-21692 auditsc4cee9d7/A-21690 finished/passed,autoexit0. C1 post-landing generated cases finish/pass4619/4628,timing4620/4629,0.124045347/0.175057769s plus5distinct loadpasses each; retain all landed/null-active/guarded-root/original-cause/repair/no-blocked,next-batch,reopen/backoff/once-only-positive-cleanup assertions. C2 pre-landing case4679/timing4680,0.096034757s+5/5, retains pinned heads,blocked ps cause,recovery advice and no landings. All12owned regressions base+5; two merge-queue projection/constructor cases23188/23192+5 each preserve exact guard delegation and positive disposal/database/root/guard assertions after merged seams.6963basepass=6818top+145nested,60separateloadpasses,0nonpass/unfinished/duplicate.729base file envelopes pass232T1/440T2/1selectedT3/1mappedT4/55Web; complete T1/T2/Web index matches. T0/T1/T2/selectedT3/mappedT4/Web exit0. Native dependency/removal T3 two cases36087/36092 pass once,addedwall1.266s excludingmachinewait; T4retention-scale two cases36130/36136 pass once,57.315436132/0.974553943s,addedwall59.591s excludingmachinewait,T4repetitionsskipped. RemainingT3batchdeferred/otherT4unexecuted. Provenance38753 exacthead/runtime tree6c2b1de82c4f9d16df570f5a222e2963667d0f95,cachednull,Linuxx64 6.8.0-147-generic Node24.21/Nv0.12.5,c8nyc1,actual HeadlessShell1248/ChromeTesting156.0.8078.4.1461237ms/$0.10147479166666666 executoraccounting;106.469s T0hoststep.129lint62files,budgets/ratchet/T4overage report-only,no timing speedup claim. Priorbc99f3c2 remains bound to8c9379698;newrun supplies currentproof. No findings,Reviewer runtime/edits or whole-macOS/fullT3T4 claim. C1/C2verified;holdreleased.

Criteria: C1 verified, C2 verified.

### impl-1956 · 2026-11-19T11:03:10.602Z

Missed-consumer correction in progress after attributed batch 0aeef731 failure: durations.test.ts's legacy-worktree setup produces an unmarked linked candidate consumed by DevT3Probes.checkout/remove → removeMergeBatch. Previous 'legacy refusal unaffected' disposition was incorrect for upgrade progress. Current production creates independent clones; persisted old linked roots must remain refused/preserved while a fresh clone completes the probe (Coordinator 99ec55a2). Consumers: default DevT3Probes repository in dispatch/daemon, probe meta checkpoint/restart, fake repositories in dev-t3-search/component and suite-persistence tests, native dependencies test, durations historical setup; no CLI/web wire shape changes. New pure relocation checkpoint regression was shown red (actual old cwd vs expected replacement cwd), then green after persisting the actual candidate before worker admission. Native upgrade/ownership controls pending slot.

### impl-1956 · 2026-11-19T11:13:46.940Z

Correction committed/pushed at 3539ad50a641eab63a4ca62b1b4afee348faab29 (tree 89d8e9b808899de3252c6307304a0970775800bd), parent e4b8c31e5, no dev merge. Native red controls reproduced checkout and already-completed cleanup refusal. Default DevT3Probes now catches only CandidateOwnershipUnavailable (typed code ownership-unavailable), records cwd/head/tree/reason/replacement in direct-key existing meta, preserves unmarked roots, and proceeds through a deterministic standalone clone or already-collected receipt. Changed ownership still refuses; no removal adoption. Actual checkout path is saved before Suites admission. Fixture legacy producer uses checkoutMergeBatch; its node_modules ignore reflects unchanged pre-item dependency-link behavior. Additional consumer: existing admitted legacy jobs skip checkout and reach repository.remove after restart (Coordinator d8f27764 scope). Native full durations 25/25 and dependencies 2/2 passed on local Darwin arm64/Node24.21 during labeled precommit epochs; separate relocation T1 red→green and reachable 174/174 pass, full fixed-head lint/typecheck/batch follow. No new verify claim.

### rev-36 · 2026-11-19T11:21:53.625Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1956-upgrade-source-1
commit: 3539ad50a641eab63a4ca62b1b4afee348faab29
scope: full
findings: [{"severity":"medium","text":"After probe collects/validates the completed worker receipt/verdict(:140–145), the missing-ownership cleanup catch directly invokes #preserveLegacy/store.setMeta(:100–103). A diagnostic write throw escapes remove/probe and prevents the selected ProbeReceipt from returning. Durable Suites evidence for a later retry does not contain this ancillary failure. Implementer0822b289 confirms no preservation boundary; completed-legacy control covers successful persistence only. Preserve the completed receipt/root with bounded secondary persistence diagnostics and failure-path proof, without weakening required pre-admission durable writes or changed-ownership refusal (rule39/Coordinatord8f27764).","file":"hub/src/hub/dev-t3-probe.ts","line":93}]
finding_counts: {"high":0,"medium":1,"low":0}

Source NOT CLEAR at3539ad50a641eab63a4ca62b1b4afee348faab29/tree89d8e9b808899de3252c6307304a0970775800bd, parente4b8c31e5, no dev merge; A-21745. Full Standards/Spec pass of changed upgrade design, unchanged batch source/evidence retain prior basis. One medium finding shared across axes, no high/low. Typed missing-authority classification, deterministic retained-root/separate clone, actual-path checkpoint before Suites admission, owned fixture producer and suiteCase/native lifecycle controls otherwise reviewed. Changed ownership still refuses and no deletion-time adoption is introduced. Coordinatord8f27764 requires preserving completed legacy result, which the diagnostic-write failure path does not meet; the pre-admission failure behavior must stay deliberate. A-21743 retains original failed0aeef731/A-21730 and824e6ee4, separate red/green epochs, dependencies2/2 before completed-worker fix, durations25/25 precommit after it, missing invocation-tree/native facts unknown. Fixed-head fulltypecheck/lint0 (129report-only/zero refusals), selected2T1+2T2 174/174 with enforced tripwire are narrower receipts; no new configured/full-tier/Web/T4 proof. Priorc4cee9d7 is parent-head evidence only. C1failed; C2done unverified at newhead; nothingverified. Hold released for bounded outcome-preservation correction then fresh immutable-head source review before configured verification. No Reviewer edits/tests/probes/scanners/generators/provider calls.

Criteria: C1 failed (The authorized completed-legacy path still loses its selected ProbeReceipt return when ancillary preservation-diagnostic persistence throws.).

### impl-1956 · 2026-11-19T11:29:32.611Z

A-21745 correction: preservation writer now emits a structured bounded persistence-failure line through the injected hub LogFn and throws a private typed receipt. Before admission that remains fatal to preparation. After a collected/validated worker result, only this typed ancillary failure is contained; the original result/run/artifact remain selected and bounded secondary context travels in the existing optional ProbeReceipt.reason. DevT3Search already persists that field; dev-t3-report now renders it. A subsequent same-job call can persist the dedicated root diagnostic without another worker. Original admission failures remain primary if their ancillary cleanup diagnostic fails. Changed ownership continues to refuse. Consumer additions: dispatch constructor log injection; shared cleanupError export reused by batch and probe (no copied byte policy); ProbeReceipt reason readers in DevT3Search/probeEvidence/reportDevT3Search and their tests, suite-soak reporter scenarios. Old reason-less receipts keep previous rendering; no new wire field or CLI/help text. Native fault reproduced red before fix, then green and full durations26/26 at local Darwin/Node24.21 in precommit epoch; intermediate unsupported TS parameter-property attempt separately retained. Fixed-head checks follow.

### rev-36 · 2026-11-19T11:38:40.750Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1956-upgrade-source-2
commit: 40724f62627aff2969f0a85f03ec981793f0fd22
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards/Spec SOURCE CLEAR at40724f62627aff2969f0a85f03ec981793f0fd22/treed6685819647b49397253cf303d00bdd16fb25d7a, parent3539ad50a, no dev merge; A-21755. M1 resolved: private producing persistence-failure receipt is contained only after collected/identity-validated completion, preserves result/run/artifact and bounded secondary reason, with nonthrowing structured LogFn observer. Search checkpoint/report retain existing reason; old reason-less rendering unchanged. Required pre-admission diagnostic/candidate writes and changed-ownership refusals remain fatal, no deletion authority adoption. Existing encoded-byte cleanupError policy exported/reused unchanged; dispatch log injection and consumer/report/docs migration reviewed. Guarded T1 checkpoint/report and owned T3 native fault/root/diagnostic-retry controls retain assertions and no extra worker. A-21753 fixed-head fulltypecheck/lint0 (129report-only/zero refusals), selected246/246 with enforced tripwire; pinned manifest confirms4T1+2T2. Native red and unsupported-TS intermediate remainfailed; focused1/1/full durations26/26 are precommit localDarwin/Node24.21 source/test epochs, missing independent tree/native facts unknown, dependencies2/2 earlier. A-21752 corrects earlier174 batch to3T1+1T2. Old failed0aeef731/824e6ee4 retained, parentc4cee9d7 not current-head proof. No configured/full-tier/Web/T4 pass at407yet; source review grants no criterion verification. C1/C2 remain run-dependent unverified/stale. Findings[]; hold released. Implementer may obtain Coordinator window for exact-head configured verification; final settlement requires its named receipts. Reviewer source/log/metadata inspection only, no edits/runtime/scans/generators/provider/browser.

### rev-36 · 2026-11-19T12:47:37.085Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1956-final-2
commit: 40724f62627aff2969f0a85f03ec981793f0fd22
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head CLEAR at40724f62627aff2969f0a85f03ec981793f0fd22, current sourceA-21755; A-21774 audits3af4522b/A-21773 beyond exit0. C1postlanding andnoticefailure4713/4714(0.159145925s)/4720/4721(0.142709621s) passordinary+5/5, retaining landed/no-blocked/no-cancel/repair/root/retry/nextbatch assertions. C2prelanding4769/4770(0.070945919s)+5/5 preservesblocked pinnedheads/recovery. Nativehistorical6controls39537/39538,39550/39551,39558/39559,39570/39571,39578/39579,39595/39596pass; newunmarked/completed/diagnosticfailure each+5/5, old3notrepeated. Rootidentity/sentinel/replacementcleanup/completedreceipt/boundedsecondary/retry-without-newworker facts retained. Relocation1557/1558 andreasoncheckpoint/report1567/1568 passordinary+5/5. All232T1/440T2/272T3/55Webfilesfinishpass(999), noindexgaps/extras/duplicates/unfinished. Ordinary9108=9096pass12skip,0fail/cancel;295separateloadgatepasses. T0/T1/T2/T3/Webexit0;18T4unexecuted. Provenance52345 exacthead/runtime treea47d9f3cbcfba47790abce18d558d9d5349b6fc3,uncachedLinuxx64Node24.21Nv0.12.5,c8nyc1,actualHeadlessShell1248/ChromeTesting156.0.8078.4,3751053ms/$0.2604897916666667;T0host101.246s separate.12skips=5sandbox-exec/1caffeinate/2missingOpenCode/4missingzsh, notpasses.129lint62files/budgets/ratchet/Webwallreport-only. Earlierfailed0aeef731/824e6ee4 anddiagnosticred/syntax/precommit epochs remainseparate;A-21752tiercorrection retained, parentc4cee9d7 not reusedascurrent. Findings[];C1/C2verified;holdreleased. No further run/sourcechange requested;Reviewerstaticlog/source/indexinspectiononly.

Criteria: C1 verified, C2 verified.

### impl-1956 · 2026-11-19T12:50:19.882Z

Coordinator f27ce1d0 authorized current-dev merge after new dispatch conflict. Merged/pushed e5037c0c5c3cdc0e7a8d74687127bfde074ea8ed (tree9067ca90441533758a9c560d753a53a16f5d84c0), parents40724f626 and5e3a2005c. Exactly one conflict hunk: Suites constructor keeps dev dropletServices {...options.droplet,snapshotNotice}, own cleanups/cleanupOverflow queue projection and DevT3Probes LogFn, plus shared retention/taskLanding callbacks. Incoming executorSnapshotNotice export/standalone executor wiring and TaskWorktrees checkpoint:options.territoryLock merged automatically and retained. No own source edits beyond conflict resolution. Full merged-head compiler passed; full lint and reachable T1/T2 next. Prior full3af4522b remains bound40724f626; not borrowed as merged-head runtime evidence. Native upstream Codex contract remains T3/deferred to Coordinator's new verification; no ungranted native run.

### rev-36 · 2026-11-19T12:58:18.706Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1956-delta-2
commit: e5037c0c5c3cdc0e7a8d74687127bfde074ea8ed
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta SOURCE CLEAR ate5037c0c5c3cdc0e7a8d74687127bfde074ea8ed/tree9067ca90441533758a9c560d753a53a16f5d84c0; A-21777. Coordinatorf27ce1d0 authorizes parents40724f626+5e3a2005c. One manualdispatchconstructor conflict checked againstbothparents: exactownline+devdropletServices substitution andexactdevline+owncleanups/overflow substitution; DevT3Probes LogFn equalsownparent. StandaloneDropletExecutor/snapshotNotice helper/TaskWorktrees checkpoint equaldevparent. Own7production/native-testfiles byte-identical407;incoming4files byte-identicaldev. Shared runReferenced/taskLanding retained, no ownership/outcome-policy rewrite. A-21776 fixed-head fulltypecheck/lint0/0refusals,131report-only62files actualcountdifferent129;selected12files356/356pass withtripwireenforce,4T1+8T2 pinnedtiers checked,two workers,localDarwinNode24.21,no browser/nativeT3T4file/newconfiguredproof. Missingnative/invocationtreefactsunknown. PriorA-21755/A-21774reviewed407 implementation/runtime basis unchanged,3af4522b remains407 proof;priorfailedred/precommitrounds/A-21752classificationcorrection retained. Findings[];noC1/C2verification atnewhead(stale/run-dependent);holdreleased. Coordinator submitsnewexact-head verification afterclear;Reviewerread-onlysource/loginspection,noedits/runtime/scans/generators/provider/browser.

### rev-36 · 2026-11-19T13:34:18.164Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1956-final-3
commit: e5037c0c5c3cdc0e7a8d74687127bfde074ea8ed
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head CLEAR ate5037c0c5/tree9067ca90441533758a9c560d753a53a16f5d84c0; A-21795 independently audits A-21794/run197ac550 against source-clearA-21777. C1 postlanding ordinaryfinish/timing4709/4710 andnoticefailure4714/4715pass,each+5loadpasses;C2prelanding4768/4769pass+5. Exactretainedassertions reviewed; sixhistoricalnativeowner/upgrade/completed/diagnosticfailurecases36972–36993ordinarypass once; reasoncheckpoint/report1561/1562 andrelocation1551pass+5each. Fullindex7196ordinarypass/0fail/cancel/skip,separate70loadpasses;739filespass,noduplicates/unfinished. All232T1/440T2/55Web,selected11T3 andmapped1T4 executed; remaining261T3/17T4unexecuted. T4baseonly2identities/noloadrepetitions; nofull-all claim. T0/T1/T2/T3/T4/Webexit0;T0host114.569s. Provenance40053 exacthead/runtime8df199b7999763e91bc32c84bf3d000c1a268f9a,uncachedLinuxx64/Node24.21/Nv0.12.5,c8sfo2,1815768ms/$0.126095,HeadlessShell1248ChromeTesting156.0.8078.4;skips[],skipreasonreportmissing0. Lint131/62,duration/ratchet/Webadvisoriesreportonly; printedallowancestanzanotnewgrant. Own/sourcepolicy unchangedauthorizedmerge; prior407full3af4522b/A21774remains407epoch;0aeef731/A21730,824e6ee4/localred/precommit andA21752tiercorrectionretainedseparately. Findings[];C1/C2verifiedatcurrenthead,holdreleased,hubreadyroutesresult. Reviewerread-onlysource/log/manifestinspection;noedits/tests/probes/scans/native/browser/delegation.

Criteria: C1 verified, C2 verified.
