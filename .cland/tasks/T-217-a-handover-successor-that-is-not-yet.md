---
id: T-217
kind: task
title: A handover successor that is not yet live can be launched onto the node it already holds
state: open
status: review
criterion_seq: 3
labels:
  - qa-found
  - v0.1
  - ready-for-agent
assignee: impl-217
parent: T-113
blocked_by: []
topic: topic-124
branch: t/T-217-a-handover-successor-that-is-not-yet
created: 2026-10-11T08:22:14.796Z
updated: 2026-10-11T08:30:39.314Z
---

Found by qa-17 in T-113's demo (topic-123, run qa-2026-10-11-17, M10).

The human handed node T-2 to `lead-next` with `role set … --item` while no lead-next session was live. The claim and the note moved, and routing works: after the item claimant stopped, the next T-4 verdict went to lead-next. But launching lead-next onto T-2 is refused: 'T-2 is claimed by lead-next (lead): release it before launching another session for it'. The successor's subscriptions also need a known session, so it can't be brought online for the node it holds.

Expected: `session.launch` with the same name and role as the node's current claimant, while no session of that name is live, binds the new session to the existing claim and attaches its default subscriptions. A different name is still refused.

## Acceptance criteria

- [x] C1. Launching the claimant's own name onto its node, with no live session of that name, succeeds and adopts the claim and subscriptions; a different name is refused as today.
  - done: impl-217 · 2026-10-11T08:28:21.048Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-217-1 · 2026-10-11T08:30:39.314Z
- [x] C2. A protocol test covers a human handover to an offline name, then the launch, then the next verdict reaching the new session.
  - done: impl-217 · 2026-10-11T08:28:21.174Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-217-1 · 2026-10-11T08:30:39.314Z
- [ ] C3. `npm run typecheck && npm test` pass.

## Comments

### impl-217 · 2026-10-11T08:23:04.326Z

Claimed on task branch at dev f8e2dcf. Building a real protocol regression for human handover to an offline successor, launch claim adoption and default subscriptions/verdict delivery. Scope remains the same-name/same-role offline claim admission; no role-file change or per-item QA policy.

### impl-217 · 2026-10-11T08:27:04.076Z

The new protocol regression reproduced the exact launch admission refusal (A-1130). Admission now accepts matching name+role and rejects other names, mismatched roles and live duplicates. Broader targeted handover testing additionally exposed a before-first-hello ordering: without settling provisional identity, claim() can replace claim time. Added explicit tracker adoption after the proven adapter launch and before claim(), plus deterministic unit coverage. Final validation remains pending; initial pushed ab4ed67 is superseded by this fix.

### impl-217 · 2026-10-11T08:28:21.421Z

Final pushed clean head 3e2310b3f85b630fa16357c99eb93287742c5646. Fetched/merged origin/dev 8667214 before the final suite (already up to date). Matching claimant admission plus existing tracker.adoptSession before claim settles launch-before-hello ownership without resetting claim time. Handover 4/4, launch 5/5, worktrees 6/6; deterministic fixed-clock adoption regression proved red/green. C1/C2 done, C3 pending required all suite. README updated; no roles.toml changes. Review request to rev-13 precedes suite launch.

### rev-13 · 2026-10-11T08:30:39.314Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-217-1
commit: 3e2310b3f85b630fa16357c99eb93287742c5646

No high, medium or low findings. Matching offline claimant name+role admission retains different-name, wrong-role, live-name, reservation and late claim-race checks. Existing queued identity adoption before claim preserves its timestamp, note and default subscriptions even before first hello.

C1/C2 verified at 3e2310b. Complete targeted logs establish handover4/4, launch5/5, worktrees6/6 with no failure/cancel/skip/todo; deterministic timestamp regression is red→green. Independent typecheck/diff check passed. A-1139 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1139-t-217-review-at-3e2310b-offline-successor-adoption-clear-suite-pending.md records both clear axes.

C3 and final readiness remain pending the complete same-head all suite. No exception applied.

Criteria: C1 verified, C2 verified.
