---
id: T-141
kind: task
title: "The item's lead: the claimant leads its item; events, reports and
  verdicts route to it; @lead T-n resolves to it, else to the Coordinator"
state: closed
status: done
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: E-108
blocked_by:
  - T-139
topic: topic-58
branch: t/T-141-the-item-s-lead-the-claimant-leads-its
created: 2026-10-10T01:52:18.890Z
updated: 2026-10-10T08:39:58.009Z
---

## Parent

T-108 (A quiet Coordinator), slice 4 of 6. Spec §3.7 (Routing, the item lead).

## What to build

The Implementer that claims an item leads it. Events, reports and verdicts about the item go to that lead, then to the Coordinator, then to the human. The address `@lead T-n` resolves to the item's current claimant, else to the Coordinator, when the hub records the message. The Reviewer and QA clauses report to `@lead T-n`. A message with no item goes to the Coordinator, as today.

## Acceptance criteria

- [ ] A Reviewer's "review not clear T-n" sent to `@lead T-n` reaches the Implementer holding the claim, not the Coordinator.
- [ ] With no claimant, `@lead T-n` resolves to the Coordinator; resolution happens when the hub records the message, and the recorded addressee is the resolved session.
- [ ] A claim change after recording does not reroute an already recorded message.
- [ ] The default Reviewer and QA clauses report to `@lead T-n`; list the exact `.cland/roles.toml` lines in your report.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. ADRs 0007 (events reach sessions as deliveries, digested at turn boundaries: one queue, no second channel), 0006 (the hierarchy is the item tree), 0001, 0003. Research: `research/coordinator-load` (T-82, with `analyse.py`), `research/harness-surfaces` (what each harness accepts between turns, and where steering exists), `research/bcas-hub`. Tests through the v0 seams: the hub frame protocol first, then the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; no new seams inside the hub. The epic's "choices where the spec is silent" apply. A-96 classes: the delivery path is request-path async, so await races, partial failure and restart durability are the review focus.

## Comments

### impl-141 · 2026-10-10T04:00:17.977Z

Implementing record-time @lead T-n resolution and item-event routing through the existing hub frame protocol and delivery queue; verifying claimant/fallback, fixed recorded addressees, authoritative identity adoption, and closed/unknown item errors.

### impl-141 · 2026-10-10T04:18:40.731Z

Committed and pushed local task branch at f7f3e92d1b4bccd267f45d02387108d8ec655caa. Typecheck and targeted routing/adoption regressions pass. A-412 records exact .cland/roles.toml report replacements (Reviewer 106, QA 133); A-415 records standards/spec self-review. Final root npm test is running once on the committed head under Node v24.21.0 and the machine suite lock.

### rev-8 · 2026-10-10T04:22:47.126Z

verdict: review
result: not clear
by: rev-8 [reviewer]
run: rev-8-20261010-141-1
commit: f7f3e92d1b4bccd267f45d02387108d8ec655caa

High — hub/src/hub/core.ts:392: generated-name allocation ignores durable session aliases; after a failed-adoption rename and old-name traffic pruning, an unnamed launched session can receive the reserved provisional name and queue adoption of the previous claimant's rows to its own identity, redirecting ownership and lead reports. Include alias names in generatedName's exclusions and cover the unnamed/recycled-name path through the protocol.

Invariant: every name allocation must respect pending adoption aliases until successful adoption. Explicit hello, rename and production role admission enforce it; generated hello does not. In-memory probe confirms explicit session-1 is refused but unnamed hello gets session-1 while alias=old-id and stored actual=new-id. Downstream adoption was traced, not executed. No suite run, per request. No other findings; exact Reviewer/QA instance report lines 106/133 verified.

Two-axis report and probe evidence: A-416, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-416-t-141-review-rev-8-141-1-generated-name-alias-reservation-bypass.md. Full acceptance-suite evidence remains the Implementer's/QA's responsibility.

### impl-141 · 2026-10-10T04:30:24.062Z

Independent review A-416 found generated hello could reuse a pending durable alias after old traffic was pruned. Cancelled queued full suite before execution. Added shared nameReservation across generated/explicit hello, rename, role assignment/admission and named/roleless launch; existing historic-name reuse remains. New frame-protocol fixture reproduces unnamed launched hello defect on f7f3e92 and passes with fix, checking lead and task-write fence remain with original claimant. Delta review/typecheck/targeted tests underway before new commit.

### rev-8 · 2026-10-10T04:34:31.024Z

verdict: review
result: not clear
by: rev-8 [reviewer]
run: rev-8-20261010-141-2
commit: f6cfaf3e736fdd0e0addb93c15996c72132d346b

Medium — hub/src/adapters/sessions.ts:353: final process publication does not recheck nameReservation after await adapter.spawn; a conflicting live name or durable alias created during spawn can leave launch reporting target/new-id as running while its subsequent hello is refused. Recheck final acceptance using the spawned identity and clean up the harness on conflict.

Invariant: live names and durable aliases must remain reserved for their owning identity at every allocation/acceptance. All static paths now share the predicate, but launch checks end before spawn/pid awaits. Deferred in-memory probe: roleless launch target waits in fake spawn; old-id renames other→target→renamed with provisional target state, creating alias target→old-id; releasing spawn returns running target/new-id; its hello is refused. This is a stranded launch, not adoption theft.

A-416 is resolved: rerun allocates session-2, explicit alias remains refused, and original authoritative identity stays old-id. Direct alias probes cover rename, role assignment/admission/reservation/handover and named/roleless launch. No other full-item findings; Reviewer/QA instance lines106/133 remain correct. No suite run. Full evidence and separate Standards/Spec reports: A-420, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-420-t-141-delta-review-rev-8-141-2-launch-acceptance-after-spawn.md.

### impl-141 · 2026-10-10T04:36:40.648Z

A-420 found the post-spawn await race: alias created while adapter.spawn waits was accepted at publication. Running root suite on f6cfaf3 cancelled with exit 130 after partial passing cases. Deferred-spawn protocol regression reproduced success where refusal was expected; final post-spawn/PID-await reservation check now invokes the adapter's ownership-verified stop before refusal and publishes no running process row. Adding own-early-hello compatibility regression before commit.

### rev-8 · 2026-10-10T04:46:59.620Z

verdict: review
result: not clear
by: rev-8 [reviewer]
run: rev-8-20261010-141-3
commit: ac29db3c77cc2a388f23ce7db6d29d3262b2f21c

Medium — hub/src/adapters/sessions.ts:354: when conflict cleanup stop refuses, launch ownership is discarded without watch/recovery; the spawned process has no row, no watch call and lifecyclePending=false. Retain private cleanup supervision/resources until verified exit, as hub/README.md:664/668 requires, while preserving the foreign owner and refusing successful publication.

Medium — hub/src/adapters/sessions.ts:372: spawn rejection leaves conflictingSpawn undefined, so releaseLaunchRole skips its identity guard and can revoke an unrelated session's role. Deferred probe: old-id takes target with Implementer role during spawn; spawn rejects; role changes Implementer→null. This is the pre-existing sibling exposed by the requested generalized rollback audit. Owner preservation must also cover spawn-error rollback.

A-420 is resolved: rerun now refuses the alias conflict, stops only new-id, writes no row and preserves the alias owner. Own early hello and live/offline/unknown-owner stop-wait variations pass. No other full-item findings; A-416 remains resolved and instance report lines106/133 remain correct. No suite run. Evidence/two-axis reports A-428: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-428-t-141-review-rev-8-141-3-cleanup-supervision-and-spawn-error-rollback.md.

### impl-141 · 2026-10-10T05:07:43.487Z

A-428 fix round: failed returned processes enter durable pending-stop supervision, with atomic accepted-row quarantine, ownership-verified stop retry and guarded rollback receipt. Recovery keeps the receipt through deletion/role rollback failure; restart retries cleanup. Spawn rejection protects foreign role owners. session.cleanup removes stale process identity from live and delayed Neovim snapshots. Targeted checks: name-reservation 17, item-lead 10, adapter-native-boundary 58, request-guard 14, new Neovim snapshot case and typecheck pass; self-review has no blockers. Full suite waits for T-140 merge and the agreed rebase.

### rev-67 · 2026-10-10T05:13:16.223Z

verdict: review
result: not clear
by: rev-67 [reviewer]
run: rev-67-141-1
commit: 1d9d4497f4ab2ac02fb35ab780f75c849e14be03

Medium — hub/src/adapters/sessions.ts:286: after stop verifies exit, a row-removal or role-rollback failure retains a receipt without recording completion; restart/retry calls stop again with stopped status, so a reused original PID is refused forever and pending ownership keeps launches/worktree blocked. Persist verified-exit completion and retry settlement independently. All three native adapters enable allowReused only for exited rows (claude-code.ts:480, codex.ts:900, opencode.ts:380); README:668 promises completion after verified exit, removal and rollback.

Native Node24 memory probe with actual endProcess: stop1 stopped/verified=true, faulted row deletion, reconstructed Sessions, repaired deletion plus reused PID → stop2 stopped/verified=false, pending memory1/stored1 and row stopped. No real signals, files or suite. Crash boundary modeled through retained in-memory durable table, not an on-disk killed-process run.

A-428's two findings are resolved: foreign-owner spawn rejection preserves Implementer role; refused stop retains watched/stored pending ownership. Actual deferred alias rename probe refuses launch, stops only new-id, preserves old-id alias/Coordinator and writes no process row. Own early hello remains accepted; generated hello skips pending alias. Normal quarantine/settlement recovery passes without PID reuse.

Full-item review against 8ac4b70; prior unchanged A-416/A-420/A-428 checks carried forward. Standards: one medium. Spec: no additional findings. Lead routing, authoritative identity, recorded recipient stability, unknown/closed refusal, and exact Reviewer/QA instance replacements remain consistent. Stable identity cleanup and delayed snapshot replay checked. Diff check passes; pinned worktree clean. No suite; future T-140 rebase excluded.

Evidence and runnable probe A-436: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-436-t-141-full-item-review-at-1d9d449-verified-exit-recovery-stage-lost.md

### impl-141 · 2026-10-10T05:16:26.919Z

A-436 fix: pending-stop recovery now persists each completed stage (verified stop, row removed, guarded role rollback). Recovery skips every completed stage, so verified exit is never stopped/watched again after restart or receipt-clear failure. Returned-process rollback belongs exclusively to staged settlement; spawn rejection remains direct and identity-guarded. Protocol regressions cover verified stop + native settlement failure + full restart with reused-pid stop refusal, plus completed rollback surviving receipt-clear failure and a later human role assignment. Typecheck, all 19 name-reservation cases and focused 4 recovery assertions pass; two-axis delta self-review clear. Full suite remains unqueued pending T-140 merge/rebase.

### rev-67 · 2026-10-10T05:21:40.406Z

verdict: review
result: not clear
by: rev-67 [reviewer]
run: rev-67-141-2
commit: bc67f03b0e5c7e89b6818c66987779db01d77dd3

Medium — hub/src/adapters/sessions.ts:297: failure saving verified-stop completion leaves the durable receipt stopped=false; restart retries stop against a reused PID and cannot finish cleanup despite the original identity's verified exit. Native actual-endProcess probe: stop1 verified true, completion write fails, reconstructed Sessions loads false, stop2 verified false, pending memory1/stored1. Handle this external-stop/checkpoint gap safely.

Medium — hub/src/adapters/sessions.ts:272: role rollback commits before its completion marker at :274; marker-write failure followed by a later human same-role assignment and restart causes replayed rollback to revoke that assignment. Native probe: durable stopped=true/rowRemoved=true/roleRolledBack=false; human assigns Implementer; recovery invokes rollback a second time and sets role null. Commit role effect and marker atomically or fence replay by exact reservation/role revision.

A-436's original row-removal/PID-reuse probe is fixed: one stop, pending0. Receipt-clear-failure control preserves later human assignment. A-428 supervision/foreign-owner rollback, early hello, alias creation during spawn and generated alias exclusion remain fixed. Unchanged full-item checks from A-436 and prior reviews carry forward.

Full-item verdict against 8ac4b70. Standards: two mediums; Spec: role-checkpoint medium (same finding counted once). High0/medium2/low0. No suite or edits. Worktree began rebasing during review; all final probes loaded hub sources directly from pinned bc67f03 git objects. Full-base diff check passes. Restart modeled with retained in-memory SQLite, not an on-disk killed-hub run. Rebase excluded.

Evidence and runnable pinned probes A-441: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-441-t-141-review-at-bc67f03-completion-checkpoint-write-gaps.md

### impl-141 · 2026-10-10T05:31:05.425Z

Rebased once onto origin/dev ceab295 after T-140 squash d9931e4; retained ancestry, expanded subscription instructions, eventSteering and delayed terminal recovery. A-436 follow-up boundaries: durable stop intent before adapter stop; recovery verifies native original pid/start identity (gone/reused settles without signalling, matching live stops through verified path, unreadable keeps receipt and retries). Row deletion+checkpoint atomic in ProcessTable; guarded role rollback+checkpoint atomic in Store, protecting later human assignment even when process receipt save fails. Native adapters expose identity-only unwatch; recovery defers new watching until identity verified, disposes before settlement, and Codex cannot resurrect an in-flight reconnect. Final typecheck, allocation/recovery24, native disposal4, lead10, launch-admission15, session-events3, subscription-hygiene14 and diff check pass; delta self-review clear. Full root suite including Neovim will run after combined-head independent review.

### rev-67 · 2026-10-10T05:36:33.094Z

verdict: review
result: not clear
by: rev-67 [reviewer]
run: rev-67-141-3
commit: ca4adcd751fb48ec923bed7f7e3a3e4e12c84833

Medium — hub/src/adapters/sessions.ts:282: a post-publication launch failure stops/removes the process but emits only session.cleanup, leaving exact-subject and subscriber-owned subscriptions and no final terminal fact. table.put (:441) already emitted launched; quarantine bypasses process listeners and pending identities are excluded from ordinary startup terminal recovery. Integrate durable terminal fan-out/cleanup for the published failed identity while preserving a conflicting owner.

Low — hub/src/hub/core.ts:1070: a throwing rollback logger skips revocation delivery and role announcements bundled later in the same post-commit callback; isolate these committed publications. Native probe: role null/checkpoint done but revocations0/roleEvents0.

Native terminal probe: watch throws after put; stop new-id succeeds, unwatch runs, row null/pending0, subscriptions [exact,role,owned] remain, history only target launched. No suite/files/signals.

A-436 and both A-441 findings are resolved: row-removal/PID-reuse and failed stop-marker probes settle with one stop; unreadable OS identity retains receipt without stop and later retries safely; failed process receipt after role rollback preserves later human assignment through atomic Store checkpoint. All native probes loaded pinned ca4adcd git objects. T-140 steering/callback/factory/daemon order remains; repeated cold recovery gives one now final event and pending1. Ancestry and subscription instructions retained. Native identity unwatch and Codex reconnect guards reviewed.

Full-item review against ceab295, including the rebase; earlier unchanged routing/identity/clauses/snapshot checks carried forward. High0/medium1/low1. Standards: low1, no blockers; Spec: medium1. Committed diff check passes. Restart modeled with retained memory SQLite, not an on-disk killed-hub run. Full suite remains Implementer-owned.

Evidence/probe A-446: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-446-t-141-combined-review-at-ca4adcd-failed-launch-terminal-subscription-gap.md

### impl-141 · 2026-10-10T05:43:07.025Z

A-446 correction underway: published failed launches now use the existing terminal publication path before accepted-row removal; publication ownership commits with the cleanup receipt. Protocol regressions cover launched/stopped delivery, exact and owned subscription closure, terminal-checkpoint failure and on-disk restart recovery, and preserving an unpublished conflicting owner's subscription. Rollback publications are independent post-commit callbacks; a throwing rollback logger no longer suppresses committed revocation or role events. The queued ca4adcd root suite was cancelled before acquiring the machine lock.

### impl-141 · 2026-10-10T05:44:41.427Z

A-446 correction committed/pushed at bafdae1fa6b063cc08ddf64ca17092e97aed7c7f (copied from git log -1). Published cleanup uses the shared terminal transition before row removal and keeps publication ownership durable across restart; rollback observers are independently guarded. Name-reservation protocol regressions pass 27/27, root typecheck (hub+Neovim) and diff check pass; independent self-review Standards/Spec clear. Corrected durable evidence artifact accompanies handover. Root suite remains unqueued pending the delta review.

### rev-67 · 2026-10-10T05:51:26.182Z

verdict: review
result: not clear
by: rev-67 [reviewer]
run: rev-67-141-4
commit: bafdae1fa6b063cc08ddf64ca17092e97aed7c7f

Medium — hub/src/adapters/sessions.ts:278: failed-launch rollback uses the receipt's original name after an owned early hello renames during the awaited stop; cleanup settles with no row/receipt while the renamed identity retains its live/stored Implementer grant, violating README:228's early-hello rollback contract. Resolve the current name by stable identity with foreign-owner/later-assignment guards preserved.

High 0; medium 1; low 0. Standards clear; Spec one medium. A446's terminal subscription gap and logger suppression are resolved; pinned native probes verify exactly-once final/closure retry, fresh-subscription preservation and foreign-owner protection. Full-item verdict against ceab295. No suites run.

Evidence: A-452, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-452-t-141-full-item-review-at-bafdae1-renamed-failed-launch-grant-survives.md.

### impl-141 · 2026-10-10T05:58:22.881Z

A-452 correction and same-class listener probe: common identity mutation fence refuses rename and role assign/clear/handover while the launch is unfinalized, including early hello and restarted pending receipt. Ordinary publication skips quarantined identities; verified terminal transition uses the current owned row. Role rollback resolves the expected stable identity's current name, preserving reservation/foreign/checkpoint guards. Frame regressions reproduce refusal gaps red, now cover pending Coordinator rename, quarantined role mutations, early hello spawn rejection, restart fencing and later grant after complete settlement. bafdae1 queued suite cancelled before machine lock; no full suite queued during fixes.

### impl-141 · 2026-10-10T06:14:05.020Z

A-452 corrected and rebased onto dev 503f266. Head copied from git log -1: 7a20b54b5017de57c40aa1d70a10aceb1e58b8fc, pushed to local origin. Unfinalized launches fence rename and role mutations by stable prior/current identity, including restart receipts; settlement/rollback use stable session id. Rebased targeted protocol suite 33/33, root typecheck and diff checks pass. Self-review Spec clear, Standards no documented breach. A-471: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-471-t-141-a-452-correction-at-7a20b54.md. Full root suite outstanding.

### rev-67 · 2026-10-10T06:17:46.285Z

verdict: review
result: not clear
by: rev-67 [reviewer]
run: rev-67-141-5
commit: 7a20b54b5017de57c40aa1d70a10aceb1e58b8fc

Medium — hub/src/adapters/sessions.ts:112: every hello at a pending launch name becomes launch.current, including a pre-existing foreign owner reconnecting after it legally renamed into that name. Spawn rejection passes that identity into rollback at :509 and revokes the unrelated owner's role; its role mutations are also incorrectly fenced after reconnect. Preserve early-hello identity provenance without adopting the foreign owner.

Pinned native root and Spec probes: other/foreign-id Implementer → deferred target launch → foreign rename to target/human grant → disconnect/reconnect → spawn rejection leaves foreign stored/live roles null. Same probe on a6a12bd preserves Implementer and its mutation rights. No process returned. A-428 owner-preservation regression; A-471 explicitly promises those rights.

High0/medium1/low0. Standards clear; Spec one medium. A-452 original finding is resolved: rename and all tested role paths refuse during failed stop, terminal waits for verification, owned grant is released, later grant survives resume. Terminal/checkpoint recovery and alias controls pass; full-item carry and rebase inspected against dev 503f266. No suites run.

Evidence and runnable probe: A-472, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-472-t-141-review-at-7a20b54-foreign-reconnect-misclassified-as-owned-early-hello.md.

### impl-141 · 2026-10-10T06:26:30.526Z

A-472 corrected at 909126b7c757f80e5c8fb74aaa6ccc2b7fc50fad (copied git log -1), rebased onto dev5946f37 and pushed to local origin. Early hello identity ownership and first-role consumption require the per-launch credential; foreign reconnect preserves stored/live role after rejected spawn. Protocol regression red before fix, green after; full targeted file 34/34 and native launch-through-spoke cases all pass. Rebased hub+Neovim typecheck/diff check pass, worktree clean. A-476: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-476-t-141-a-472-credential-correction-at-909126b.md. Self-review Spec clear, Standards no documented breach; full root suite outstanding.

### rev-67 · 2026-10-10T06:33:20.870Z

verdict: review
result: not clear
by: rev-67 [reviewer]
run: rev-67-141-6
commit: 909126b7c757f80e5c8fb74aaa6ccc2b7fc50fad

Medium — hub/src/adapters/sessions.ts:126: uncredentialed foreign UNKNOWN_SESSION holder at the pending name is fenced by name alone. A foreign other/unknown Implementer legally renames to pending target, then rename and human role changes refuse before/after reconnect despite no credential. Identified foreign-id control permits mutations. Violates README:672's foreign mutation-rights contract; distinguish name-local owned proof from foreign unknown.

Medium — hub/src/adapters/sessions.ts:472: returned process overwrites credential-proven early identity without reconciliation. Credentialed target/unknown hello receives Implementer; spawn returns target/new-id; collision refusal and verified cleanup finish with row/receipt absent but owned early grant remains. Receipt :500 and rollback retain only returned id. Violates README:228 early-hello rollback. Bundled adapters consistently inject their real generated id; this finding is limited to the accepted UNKNOWN protocol/fake-boundary path, not an observed bundled-native mismatch.

High0/medium2/low0. Standards clear; Spec two mediums. Complete A473 matrix swept in one pass. A472 identified foreign reconnect fixed; credential first-role consumption, owned joins/reconnect, PID-await fences, quarantine suppression, legacy stable-id recovery, terminal/row/checkpoint retries, unreadable/PID-reuse recovery and later grant controls pass. Full-item carry/rebase checked against 5946f37; range-diff shows eight prior commits unchanged. No suites run.

Evidence, matrix and both runnable probes: A-478, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-478-t-141-full-identity-class-review-at-909126b-unknown-provenance-boundaries.md.

### impl-141 · 2026-10-10T06:59:31.534Z

A-478 correction committed and rebased onto origin/dev ed63217. Head from git log -1: 066b7e912ec728a5476f4361fb54cbc5238896be; pushed to local origin. A-484 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-484-t-141-a-478-correction-at-066b7e9.md) records credential-keyed/id-only ownership, all proven identities with per-id rollback checkpoints, immediate receipt freeze and accepted first-hello binding. Both A-478 probes and the additional restart/deferred-stop/late-first-hello regressions pass; complete protocol file 39/39, native launch controls 3/3, early grant/carry controls 2/2, hub+Neovim typecheck and both self-review axes clear. Independent matrix and full root suite pending; worktree clean.

### rev-67 · 2026-10-10T07:08:54.433Z

verdict: review
result: not clear
by: rev-67 [reviewer]
run: rev-67-141-7
commit: 066b7e912ec728a5476f4361fb54cbc5238896be

Medium — hub/src/adapters/sessions.ts:155: stale first-role binding overwrites a later post-acceptance human Reviewer grant with Implementer. A successful correct-token join also bypasses binding consumption and enables the same overwrite on reconnect. README:229 makes human assignment authoritative; :672 allows mutation after acceptance.

Medium — hub/src/adapters/sessions.ts:126: credential resolver adds an existing foreign id before Core validates/join-checks it (core.ts:490); credentialed join of other/foreign-id with target's token fences that pre-existing owner and spawn rejection revokes its stored/live role. Preserve join provenance before registering ownership. This is an accepted protocol mismatch control; bundled adapters normally generate matching id/name.

Medium — hub/src/adapters/sessions.ts:494: Store identity commits before table.put (:495); unpublished insertion failure restores prior role but drops prior-id's name and retains failed new-id. An unchanged real prior-id claim's lead route changes target→Coordinator. Stage/restore the owned identity publication on unpublished failure with foreign-owner guards.

Medium — hub/src/adapters/sessions.ts:312: unpublished failed launch skips subscriber cleanup. Credentialed early hello and returned process both new-id; table.put fails before commit; verified stop/settlement clear role and receipt but leave subscriber-owned subscription. End proven subscriber records after death independently of published/exact-subject cleanup (§3.9).

High0/medium4/low0. Standards one medium (foreign join); Spec four mediums; overlap counted once. Complete A473 matrix and all remaining findings in one round. Root/Spec independently reproduce all four; Standards reproduces join. A478 findings fixed; anonymous proof/restart, deferred-stop freeze, PID await, quarantine mutators, terminal/row/role checkpoint retries, PID reuse/unreadable and later-grant controls pass. Range-diff nine prior commits unchanged; full-item base ed63217. No suites run.

Evidence, complete matrix and four runnable probes: A-487, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-487-t-141-full-matrix-review-at-066b7e9-grants-joins-and-unpublished-identity-cleanu.md.

### impl-141 · 2026-10-10T07:25:21.487Z

A-487 role findings 1/2 corrected at 7fcf37cca89b48d678f121dd868a693913288bde from git log -1, rebased onto eb096a1 and pushed to local origin. A-490 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-490-t-141-a-487-role-integrity-correction-at-7fcf37c.md) documents first-grant retirement/human role preservation and validated proof excluding joins/refusals/foreign identity bindings. Frame/SQLite regressions 47/47 on rebased head; Claude/OpenCode controls and hub+Neovim typecheck pass there; Codex and early-failure/carry controls pass during correction. Standards and scoped Spec self-reviews clear. Findings 3/4 remain with T-129 per Coordinator. Independent sweep and root suite pending; worktree clean.

### rev-67 · 2026-10-10T07:31:54.315Z

verdict: review
result: not clear
by: rev-67 [reviewer]
run: rev-67-141-8
commit: 7fcf37cca89b48d678f121dd868a693913288bde

Medium — hub/src/hub/core.ts:496 (proof insertion: hub/src/adapters/sessions.ts:127): a pre-existing foreign offline id whose current name equals the pending launch name passes credential validation, becomes mutation-fenced, and loses its stored/live Implementer role on spawn rejection. Independently reproduced on both axes and in a root pinned memory probe: connect other/foreign-id, start target launch, legally rename other→target and human-assign Implementer, disconnect, then reconnect target/foreign-id using the launch credential. Name equality does not prove launch ownership (hub/README.md:672).

One full-item verdict under the approved role-integrity/claimant-lead bar; duplicate finding counted once. A487 stale first-grant and foreign live-join cases now pass; adjacent identity, grant, mutation and recovery controls pass as detailed in A-491. Range-diff confirms the ten prior T-141 patches are unchanged; lead checks carry forward. A487 injected acceptance-ordering and unpublished subscriber gaps remain T-129 notes, explicitly excluded by the Coordinator. No suites or edits performed by Reviewer.

Evidence: A-491, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-491-t-141-full-scoped-review-at-7fcf37c-same-name-offline-foreign-ownership.md

### impl-141 · 2026-10-10T07:53:17.840Z

A-491 corrected with launch-start identity snapshots and a shared resolved-candidate guard: pre-existing/UNKNOWN ids cannot enter credential proof or rollback ownership, including adapter-return/PID-await paths. Combined correction also updates the three stale root tests. Protocol 51/51, targeted stale tests and root typecheck pass; rebased to latest dev (tracker-only delta), pushed locally, root hub+Neovim suite running. Self-review has no remaining in-scope findings. Exact instance role old→new lines are in the handover artifact; Coordinator applies them at merge.

### rev-67 · 2026-10-10T08:01:12.421Z

verdict: review
result: not clear
by: rev-67 [reviewer]
run: rev-67-141-9
commit: eafd512e6ed85ad7597f3deea32faef032804de5

Medium — hub/src/adapters/sessions.ts:41 (snapshot :422): a foreign identity first connecting while spawn awaits is absent from existingIds and can become launch proof. A same-name offline credential reconnect becomes fenced and spawn rejection clears its stored/live Implementer role. Adapter-return and anonymous PID-await candidates share the gap; root reproduces all three forms. Validate current authoritative provenance before admitting new proof (README:672).

Medium — hub/src/adapters/sessions.ts:514 (receipt :538): invalid-proof refusal is treated as an intervening owner conflict, discarding previousSessionId. An offline target/prior-id Reviewer launching as Implementer, with UNKNOWN or pre-existing adapter return, is correctly refused but completed empty-proof cleanup leaves Implementer on its unchanged prior identity. Preserve guarded prior-role rollback when no intervening owner took the name (README:228).

Full-item verdict under the approved role/claimant-lead bar: high0/medium2/low0; both axes independently reproduce both, duplicates counted once. Exact A491 pre-admission case and earlier stale-grant/live-join cases now pass. Related grant, identity, mutator and recovery controls pass; eleven prior commits are range-diff identical and lead checks carry forward. Instance report replacements remain Reviewer line106/QA line133 for Coordinator to apply. No Reviewer suites or edits; external root suite runs separately.

T129 notes: prior approved Store/row ordering and unpublished-subscriber gaps; rejected pre-existing returned-id cleanup can delete a foreign process row and release verifier holds while preserving its Store role and Implementer claim. Excluded from this bar, not a third blocker.

Evidence: A-497, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-497-t-141-full-review-at-eafd512-proof-timing-and-prior-role-rollback.md

### impl-141 · 2026-10-10T08:06:51.216Z

A-497 medium 2 fixed: proof refusal keeps the reservation's previousSessionId; only a real owner collision clears it. Four prior stable/UNKNOWN rollback probes went red (reserved Implementer retained) then green; combined targeted protocol 9/9 and hub+Neovim typecheck pass. README now states the Coordinator-approved bearer-token/trusted-adapter model; snapshot remains defence in depth without extension. Rebased and pushed, root full suite queued behind T-154/T-159 on the corrected head. Cancelled prior head completed hub 937/937 but not Neovim; its redacted recorded log and updated handover are published.

### rev-67 · 2026-10-10T08:11:43.470Z

verdict: review
result: clear
by: rev-67 [reviewer]
run: rev-67-141-10
commit: d2481e568787d5d3bce3708ab097c90ffc0022c1

Clear within the Coordinator's final scope: high0/medium0/low0. Standards and Spec independently clear.

A497 medium 2 is fixed at hub/src/adapters/sessions.ts:513–516: proof refusal exits before the actual owner-collision flag, retaining previousSessionId. All four stable/UNKNOWN prior × invalid returned-id memory probes restore Reviewer to the unchanged prior identity, leave no row/receipt, and preserve the separate foreign role. Real collisions retain their guard. README:672 documents the approved bearer-token/own-process adapter trust model; native token transport matches it.

Full-item carry and tracker-only rebase checked: twelve prior patches range-diff identical, diff check passes. Root directly verifies claimant changes, fixed recorded recipients, claimant rename, Coordinator fallback and unknown/closed refusal. Earlier grant, mutation, alias and retry controls pass. Exact instance report replacements remain Reviewer .cland/roles.toml:106 and QA :133, A494, for Coordinator to apply at merge.

Explicit exclusions: A497 medium 1 token-sharing/foreign-adapter-id hardening, rejected foreign returned-id lifecycle, A487 Store-before-row identity/lead failure and unpublished subscriber lifetime belong to T129. No new same-class finding. A500 includes pinned probes for all four notes; these remain unresolved outside this verdict's bar.

Reviewer ran no suite or edits. A499 reports focused9/9 and typecheck; earlier eafd512 hub937/937 was cancelled before Neovim, so it is not a full pass. Corrected-head root hub+Neovim validation remains a separate merge/QA requirement.

Evidence: A-500, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-500-t-141-final-scoped-review-at-d2481e5-clear-with-t129-probes.md

### impl-141 · 2026-10-10T08:39:48.972Z

Final root npm test passes on d2481e568787d5d3bce3708ab097c90ffc0022c1: hub 941/941, Neovim 202/202, zero failures/cancellations/skips; exit 0. Required Node v24.21.0 first on PATH. Full run 920.14s, lock wait 0.01s. Complete redacted log A-506; final validation A-507. Worktree clean, local head pushed; review clear rev-67-141-10. Instance role old→new replacements remain A-494 for Coordinator's merge commit; no merge performed.

### coord · 2026-10-10T08:39:58.009Z

Merged 1f56cf16f6de8f8a9ea36b2842fc5af29956f237 onto dev.
