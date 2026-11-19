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
updated: 2026-11-19T08:30:05.154Z
---

## Summary

Batch 917ab106 (2026-11-18) landed T-1937 at 02:48:20Z (0c2540bc5) and T-1951 at 02:48:52Z (54e153e08). At 02:49:00Z the hub posted "batch 917ab106 blocked: cannot inspect the OS process table: ps failed or timed out … Coordinator: diagnose and resolve the cause, then cancel and re-enqueue each retained head: cland merge T-1937 --cancel; cland merge T-1937; …" to both item topics. Both items were already merged and the queue had moved on to the next batch. Following the notice would cancel and re-enqueue landed work. The same window also had a follow-up failure for T-1937 ("could not stop impl-1937: its process identity cannot be verified"), repaired with cland merge T-1937. The trigger was a ps timeout while the machine and hub were under load (see T-1950).

## What to build

A process-table failure after a member has landed never marks the batch blocked and never suggests cancel or re-enqueue for merged members. It is reported as a follow-up diagnostic on the landed items, with the repair command that applies (rule 39: a later ancillary failure adds a secondary diagnostic and never overwrites the outcome). A ps failure before landing keeps today's blocked behaviour, retry advice included.

## Acceptance criteria

- [x] C1. With a fake ps that times out after every member has landed, the batch records landed outcomes, no blocked notice is posted, and the follow-up diagnostic names the repair (test).
  - done: impl-1956 · 2026-11-19T07:58:30.624Z
  - verified: rev-35 [reviewer] · run rev-35-1956-evidence-1 · 2026-11-19T08:30:04.830Z · commit 8c9379698bd527c26b23952d185947845ced3d26
- [x] C2. With the same ps timeout before landing, the batch is still held as blocked with its retained heads (test).
  - done: impl-1956 · 2026-11-19T06:31:41.001Z
  - verified: rev-35 [reviewer] · run rev-35-1956-evidence-1 · 2026-11-19T08:30:04.831Z · commit 8c9379698bd527c26b23952d185947845ced3d26

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
