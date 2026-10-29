---
id: T-1426
kind: task
title: Queued review requests wait while reviewers sit idle with stale pending markers
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1188
branch: t/T-1426-queued-review-requests-wait-while
created: 2026-10-28T12:40:05.299Z
updated: 2026-10-29T16:04:11.386Z
---

## Summary

Review requests queued "for the next free live Reviewer" weren't delivered for about 40 minutes while three reviewers sat idle. On 2026-10-28, impl-1423 (T-1423, 11:55:33Z, msg 99ecfb37) and impl-1387 (T-1387, ~11:55Z) sent `review request` to `reviewer`, and the hub reported them queued. rev-26, rev-31 and rev-32 were idle the whole time, but `who` listed each with a `pending` review of an item whose review was already done (T-1405, T-1402, T-1406), and rev-34 was busy. When coord assigned both requests by name at 12:37Z, rev-26 cleared T-1423 within 2 minutes and rev-32 confirmed it had "no live pending review". So stale pending markers seem to keep idle reviewers from counting as free.

## Acceptance criteria

- [x] C1. A reviewer's pending marker clears when its review verdict is recorded, or when the item moves on (ready, merged or closed), and an idle reviewer with no live pending review counts as free (test).
  - done: impl-1426 · 2026-10-29T16:03:32.966Z
- [x] C2. A queued review request goes to an idle, free reviewer within one assignment tick (test with one busy and one idle reviewer).
  - done: impl-1426 · 2026-10-29T16:03:33.409Z

## Notes

Evidence: `who` at 12:37Z (rev-26 pending T-1405, rev-31 pending T-1402, rev-32 pending T-1406, all idle); A-13282 (rev-26 cleared T-1423 at 12:39Z after the direct assignment). Incident in T-204.

## Comments

### coord · 2026-10-28T14:25:12.590Z

Again 2026-10-28 13:57–14:25Z: T-1405's delta review request (5291b0c2) waited about 28 min unassigned; coord assigned it to rev-26 by name at 14:25Z.

### coord · 2026-10-28T19:25:26.964Z

Opposite race 2026-10-28 19:25Z: coord's by-name assignment of T-1390 to rev-34 raced the hub queue, which assigned rev-26 five seconds earlier, so both held T-1390. Resolved by coord (rev-34 keeps it). A by-name assignment should check for an existing queue hold first, or the queue should drop its pending request when a named verifier takes the hold.

### impl-1426 · 2026-10-29T16:01:20.158Z

Current-head investigation (6a24facf): T-1247/ed314b768 already clears closed/landed-item reservations and T-587 handles uncertain-delivery eligibility. Existing verifier-routing.test.ts passes 16/16 locally (macOS, in-process fake adapters; no suite or browser). Remaining suspected C1 gap: ready is still open and publishTask/sessionPending only retire closed/missing items. Testing ready transition with one busy and one idle reviewer next.
Rule 20 inventory before lifecycle-policy edit: HubCore.publishTask/sessionPending/clearPendingVerification/#rememberVerification/#requestVerifier, server.ts onVerdict, Store.pendingVerifications/session removal, adapters/sessions.ts pool reuse and process projection; consumers of projected pending in who/session.list and workbench session rows. Tests: verifier-routing (T2), verifier-resolver (T1), session-holds (T3), inbox-archive-workload; shipped docs issue-tracker.md, hub/README.md and verifier-routing guide; implement skill request procedure. No wire/metadata shape changes planned; old {item,kind} pending remains readable. Existing old-wire recovery tests remain. QA/startup and other tiers will be searched for pending field consumers before editing.

### impl-1426 · 2026-10-29T16:02:56.267Z

Reproduced before fixes at production frame/fake seam: ready-transition assertion expected ['rev-idle'] but got ['reviewer']; legacy ready restart expected undefined but got {item:'T-1',kind:'review'} and queued destination stayed ['reviewer']; late ready request replaced live pending and its next read returned undefined. Added ready cleanup on publication, legacy read cleanup and delivery-admission guard without changing the {item,kind} format.
Additional consumer search: nvim/lua/cland/panels.lua and nvim/test/shell-component.test.ts render pending.item/kind unchanged; qa/briefs/T-275.md exercises unchanged open pending work. No web/shared reader or startup-probe match for pending.item/kind. Those consumers are unaffected because only stale ready markers disappear. Existing T1/T2/T3 and archive consumers retain the same schema. Skill file remains frozen; proposed guidance sent to Coordinator. No command, role permission or CLI shape changes; help and role clause need no edits.
