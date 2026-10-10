---
id: T-141
kind: task
title: "The item's lead: the claimant leads its item; events, reports and verdicts route to it; @lead T-n resolves to it, else to the Coordinator"
state: open
status: review
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-108
blocked_by:
  - T-139
topic: topic-58
branch: t/T-141-the-item-s-lead-the-claimant-leads-its
created: 2026-10-10T01:52:18.890Z
updated: 2026-10-10T05:31:56.999Z
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
