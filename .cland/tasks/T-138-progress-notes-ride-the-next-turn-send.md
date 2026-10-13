---
id: T-138
kind: task
title: "Progress notes ride the next turn: send gains kind; progress is held and
  digested with the next turn on all three adapters, across a hub restart"
state: closed
status: done
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: E-108
blocked_by: []
topic: topic-52
branch: t/T-138-progress-notes-ride-the-next-turn-send
created: 2026-10-10T01:52:18.096Z
updated: 2026-10-10T03:13:11.367Z
---

## Parent

T-108 (A quiet Coordinator), slice 1 of 6. Spec §3.9 (Progress notes).

## What to build

`send` gains `kind`: `progress`, `report`, `question` or `decision`; a `send` without a kind is a `report`. The hub holds a session's `progress` deliveries without starting a turn and injects them as one digest together with that session's next turn-starting delivery, on Claude Code, Codex and OpenCode. Held notes survive a hub restart. The role clauses tell agents to mark progress notes. The journal records the kind.

## Acceptance criteria

- [ ] On each of the three fake harnesses, three `progress` messages start no turn and arrive in one digest with the next `report`.
- [ ] Held progress notes survive a hub restart and are delivered with the next turn afterwards.
- [ ] A `send` without a kind behaves as `report`; `question` and `decision` start a turn.
- [ ] The default clauses tell agents to mark progress notes; list the exact `.cland/roles.toml` lines in your report.
- [ ] `hub/README.md` documents the kinds.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. ADRs 0007 (events reach sessions as deliveries, digested at turn boundaries: one queue, no second channel), 0006 (the hierarchy is the item tree), 0001, 0003. Research: `research/coordinator-load` (T-82, with `analyse.py`), `research/harness-surfaces` (what each harness accepts between turns, and where steering exists), `research/bcas-hub`. Tests through the v0 seams: the hub frame protocol first, then the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; no new seams inside the hub. The epic's "choices where the spec is silent" apply. A-96 classes: the delivery path is request-path async, so await races, partial failure and restart durability are the review focus.

## Comments

### impl-138 · 2026-10-10T01:53:15.203Z

Implementing at the agreed hub frame protocol and fake harness seams. Initial focus: Claude Code turn boundaries, one durable delivery queue, digest ordering, and hold/release await races.

### impl-138 · 2026-10-10T02:01:23.545Z

Implemented kind validation/defaults and durable per-recipient digest membership inside the existing deliveries queue. All three fake adapters passed ordered three-note batching before and after a hub restart. Lost-ack reconnect and uncertain admission/manual retry tests passed; typecheck passed. Default role clauses and hub README updated; instance roles.toml edits will be supplied as exact old/new lines for the Coordinator.

### rev-65 · 2026-10-10T02:08:55.104Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-138-1
commit: 2b0755ab253689259603891b8b49f12bf136128c

High: 0. Medium: 4. Low: 0.

Medium — hub/src/hub/store.ts:606: claiming a human delivery queued under a vacant role fails to attach the eventual recipient's held progress, so its next turn starts without the digest.

Medium — hub/src/hub/store.ts:513: binding includes expired notes without checking their queue age; a fresh report revives them. Preserve the existing TTL and drop/journal expired notes before binding, as decided in 6cf9c510.

Medium — hub/src/hub/store.ts:915: retention can delete an older note while its triggering delivery remains pending, changing the immutable retry input. Retain pending digest members as decided in 6cf9c510.

Medium — hub/src/hub/core.ts:692 / hub/src/hub/store.ts:620: rename a→offline b merges away P/a when P/a is bound to R1 and P/b to R2; actual rename succeeds and R1's replay loses P. Refuse any target with queued deliveries before mutation, naming target/count, as decided in 8764c2b2; check other moveQueued callers.

All four are reproduced with pinned code and an actual in-memory SQLite Store; rename also exercises the actual Core method. Ordinary batch order, isolation of later notes, uncertain hold/manual retry and whole-batch confirmation pass. Three-adapter/restart regressions were reviewed, not rerun. Default clause changes match A-344's instance lines 45/70/98/122. No suite or edits.

Full item against e4bdb0c. Standards: 0 findings. Spec: 4 medium. Evidence A-347: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-347-t-138-full-review-of-2b0755a-queue-lifetime-and-batch-identity-findings.md. Combined fix head is pending.

### rev-65 · 2026-10-10T02:18:05.010Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-138-2
commit: c92646cf7fe806f3bf9ce7cf5aa2a66d18f80593

High: 0. Medium: 2. Low: 0.

Medium — hub/src/hub/core.ts:712 / hub/src/hub/store.ts:650: the queued-only rename guard permits a→b when b's duplicate P/R2 is delivered, uncertain or injected; moving the rows drops P from a's pending R1[P], leaving R1[]. Refuse before mutation for these destination states, naming target/count, as decided in 340aad67.

Medium — hub/src/hub/store.ts:839: deleting a trigger's topic leaves surviving cross-topic progress queued with a nonexistent digest_id; replay, TTL expiry, pruning and the next report all skip it. Unbind/re-hold surviving notes with their original TTL and journal root/released IDs on every trigger-deletion path, as decided in 340aad67.

The four A-347 findings are resolved. Pinned production Core/SQLite probes pass role-claim binding, expiry-before-binding with a drop journal, retention of complete pending digests, bound trigger TTL, and refusal of the original queued-target rename without mutation. The new rename collision is reproduced in all three destination states; topic deletion leaves one orphan queued note beyond its TTL and excludes it from a later report.

Full item against e4bdb0c. Standards: 0 findings. Spec: 2 medium. Three-adapter/restart regressions reviewed, not rerun. No suite or file edits. Evidence A-352: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-352-t-138-full-review-of-c92646c-digest-collisions-and-orphaned-notes.md.

The new hold clause arrived after review completion. task_hold is absent from this session's MCP tool list; the CLI hold attempt was refused by the sandbox with connect EPERM .cland/hub.sock. Reported to Coordinator.

### impl-138 · 2026-10-10T02:20:16.817Z

Coordinator's review corrections now implemented: rename refuses target queued/delivered/uncertain/injected rows; common transactional physical-message deletion releases surviving pending notes with original queued_at, clears settled bindings without replay, and reports released batches for journalling. New Store/Core lifecycle, restart/TTL and settled-retention regressions pass (15 Store tests). Reviewing the delta before one correction commit; the queued full suite was interrupted before acquiring the lock and will be requeued on the new head.

### rev-65 · 2026-10-10T02:24:50.310Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-138-3
commit: dffd0bba31776fbc6aa0a6c161cedf830acef0a4

High: 0. Medium: 2. Low: 0.

Medium — hub/src/hub/store.ts:651: a dropped-only target permits rename, but update-or-ignore plus deletion discards the source's duplicate note row and changes its still-valid pending R1[P] to R1[]. Refuse any source/target message-row collision in any state, preserving the separate unacknowledged-row refusal, as decided in a68cb134.

Medium — hub/src/hub/core.ts:1383 / hub/src/hub/journal.ts:199: digest-released is logged but absent from JOURNALLED, so Journal.tap discards every release record. Add the event and verify trigger/released IDs at the Core-to-Journal boundary, as decided in a68cb134.

The specified A-352 states now pass: rename refuses queued/delivered/uncertain/injected targets without mutation; trigger deletion re-holds pending notes at original TTL and leaves injected/dropped notes settled. Pinned search confirms all physical message deletion uses the shared transactional helper. Actual Core/SQLite probes reproduce dropped-only digest loss, and actual Core→Journal.tap with an in-memory native append port filters the release while successfully appending a send control.

Full item against e4bdb0c. Standards: 0 findings. Spec: 2 medium. No suite, file edits or CLI hold workaround. Evidence A-356: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-356-t-138-full-review-of-dffd0bb-dropped-collisions-and-journal-filtering.md.

### rev-65 · 2026-10-10T02:29:18.436Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-138-4
commit: f64573ff07c89ee4c57dc17e2f4c3f88f09dbfb6

High: 0. Medium: 0. Low: 0. All earlier findings resolved.

Pinned production Core/SQLite probes now refuse the dropped duplicate before mutation, naming the target and one collision; both R1[P] and R2[P] stay intact. Queued/delivered/uncertain/injected target refusals remain intact. Empty and noncolliding dropped targets still rename successfully with their source digest preserved.

The actual Core→Journal.tap probe now appends digest-released with trigger and note IDs, inject-uncertain for both batch members, and inject-retry. All other added/changed batch controls are whitelisted. The new Core-to-Journal regression checks persisted metadata and private-text exclusion.

Cross-topic trigger deletion still re-holds pending notes with original TTL and leaves injected/dropped notes settled. All physical message deletion uses the shared transactional helper. Earlier kind/default, adapter, restart, immutable-retry, role-claim, expiry and retention reviews carry forward. Default clause changes match A-344's instance lines 45/70/98/122.

Full item against e4bdb0c. Standards: 0 findings. Spec: 0 findings. No suite or file edits; suite validation remains with Implementer/Coordinator as requested. Evidence A-358: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-358-t-138-full-review-of-f64573f-clear.md.

### impl-138 · 2026-10-10T02:29:28.039Z

Latest correction head f64573ff07c89ee4c57dc17e2f4c3f88f09dbfb6 (copied from git log -1) pushed to local origin. Rename now guards duplicate rows in every state as well as target unacknowledged rows. digest-released, inject-uncertain and inject-retry pass JOURNALLED; a real Core-to-Journal regression checks IDs, kinds and transitions. Typecheck, 16 Store/Core tests and journal regression pass; root suite is queued on this head behind the machine lock. Evidence A-357, with A-354 preserving exact instance-role edits.

### rev-66 · 2026-10-10T02:46:50.684Z

verdict: review
result: clear
by: rev-66 [reviewer]
run: rev-66-138-1
commit: 6d6a625eb845c0fd3597a7ceebdd6d10ebaad68c

High: 0. Medium: 0. Low: 1.

Low — hub/src/hub/store.ts:981: pending_digests drops recipient identity, so a broadcast R with settled R[P1]/a and pending R[P2]/b retains old settled P1 as well as required R/P2; P1 prunes after b settles. Temporary over-retention, classified low by Coordinator in 982063d6; follow-up planned.

Full-item clear carries rev-65-138-4 on f64573f forward to 6d6a625. Pinned Store/SQLite in-memory probes confirm ordinary queued reports/unbound notes prune, queued/delivered/uncertain digest members stay, injected/dropped batches prune, and all broadcast rows prune once the remaining recipient settles. No loss or duplication observed in the focused cases. Existing open-ask exception and asks.test.ts unchanged.

Agents assertion is stronger: exact ordered kinds, both original report texts and unchanged ID comparisons. Standards: 0 findings. Spec: 1 low temporary-retention finding. No suite or file edits; suite validation remains with Implementer/Coordinator.

Evidence A-364: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-364-t-138-final-review-6d6a625-clear-with-retention-follow-up.md.

### impl-138 · 2026-10-10T03:06:47.358Z

Root run completed: hub 838/838 pass; Neovim 145/146, with only a stale kind??text assertion expecting 'loop sentinel' where required default kind is now report. Production kind/display audit clean (Agents glyph logic gated by fromKind hub; agent text unchanged). Coordinator approved one-test change plus carrying hub result forward. Latest head f84e37a2ebc16a3d8eef31853c765ed4001c2d90 changes only that Neovim assertion, preserving sentinel text/live screen/IDs. Targeted case passes; npm run test:nvim queued/running with Node v24.21.0. Root log A-374.

### rev-66 · 2026-10-10T03:07:54.304Z

verdict: review
result: clear
by: rev-66 [reviewer]
run: rev-66-138-2
commit: f84e37a2ebc16a3d8eef31853c765ed4001c2d90

High: 0. Medium: 0. Low: 1 carried forward; no new findings.

Low — hub/src/hub/store.ts:981: unchanged temporary cross-recipient over-retention from rev-66-138-1/A-364; settled distinct notes prune after the broadcast trigger's final recipient settles. Coordinator follow-up planned.

Full-item clearance carries rev-66-138-1 and rev-65-138-4 forward to f84e37a. The Neovim assertion is stronger: exact ordered kinds plus exact loop sentinel text, with unchanged live-screen exclusion and spoke/history IDs. Production spot-audit confirms Agents notice glyphs are gated by fromKind hub; agent text remains independently rendered. No kind-to-text fallback found; optional kind checks concern metadata forwarding/validation.

A-374's preceding root run confirms hub 838/838 and Neovim 145/146 with only the corrected assertion failing. No suite or edits; latest Neovim validation remains with Implementer/Coordinator. Standards: 0; Spec: 0 new, 1 existing low.

Evidence A-375: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-375-t-138-f84e37a-full-item-review-assertion-delta-clear.md.

### impl-138 · 2026-10-10T03:12:11.003Z

Final handoff at f84e37a2ebc16a3d8eef31853c765ed4001c2d90 (copied git log -1), pushed local origin, clean worktree. Typecheck passed on final head. Root hub838/838 passed; Coordinator-approved carryover after one Neovim test-only correction. Final npm run test:nvim146/146 passed, exit0, no skips. Current clear role-held review rev-66-138-2. Final report A-382 includes implementation/deletion/journal audits, exact instance-role old/new lines, and accepted low broadcast-retention follow-up. Root log A-374; final Neovim log A-381. No merge.

### coord · 2026-10-10T03:12:48.120Z

Merged f9912c258662f7b435c71ac31c0aa3bc7f153cc6 onto dev.

### coord · 2026-10-10T03:13:11.367Z

Merged by the Coordinator through `cland merge T-138`, after `cland push`: squash f9912c2 on dev.
Gate: review rev-66-138-2 clear on f84e37a, carrying forward rev-66-138-1 (6d6a625) and rev-65-138-4 (f64573f, A-358). Earlier rounds:
- rev-65-138-1, -2 and -3 (A-347, A-352, A-356): the role-claim binding, TTL, retention and pending digests, rename collisions, orphaned notes after trigger deletion, and journal filtering.
- The suite rounds: a blanket queued-retention guard was narrowed to pending-digest members (A-363), and the Agents assertions in the hub and Neovim were updated for the default `report` kind after a production audit.
Decisions:
- a missing kind is `report`;
- expired notes are dropped before binding, and bound notes follow their trigger's TTL;
- retention protects pending-digest members only;
- a rename is refused on unacknowledged target rows and on any same-message collision;
- a deleted trigger re-holds pending notes and leaves settled ones settled;
- one transactional helper handles every physical deletion.
Evidence: hub 838 of 838 on 6d6a625 (A-374), Neovim 146 of 146 on f84e37a (A-381); handover A-382. Low follow-up T-144: broadcast retention.
Project instance: the four role-clause lines for progress kinds are committed next. They take effect at the next hub restart and on new launches.
