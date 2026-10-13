---
id: T-217
kind: task
title: A handover successor that is not yet live can be launched onto the node
  it already holds
state: closed
status: done
criterion_seq: 3
labels:
  - qa-found
  - v0.1
  - ready-for-agent
assignee: impl-217
parent: E-113
blocked_by: []
topic: topic-124
branch: t/T-217-a-handover-successor-that-is-not-yet
created: 2026-10-11T08:22:14.796Z
updated: 2026-10-11T10:51:56.528Z
closed: 2026-10-11T10:51:56.745Z
---

Found by qa-17 in T-113's demo (topic-123, run qa-2026-10-11-17, M10).

The human handed node T-2 to `lead-next` with `role set … --item` while no lead-next session was live. The claim and the note moved, and routing works: after the item claimant stopped, the next T-4 verdict went to lead-next. But launching lead-next onto T-2 is refused: 'T-2 is claimed by lead-next (lead): release it before launching another session for it'. The successor's subscriptions also need a known session, so it can't be brought online for the node it holds.

Expected: `session.launch` with the same name and role as the node's current claimant, while no session of that name is live, binds the new session to the existing claim and attaches its default subscriptions. A different name is still refused.

## Acceptance criteria

- [x] C1. Launching the claimant's own name onto its node, with no live session of that name, succeeds and adopts the claim and subscriptions; a different name is refused as today.
  - done: impl-217 · 2026-10-11T08:28:21.048Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-217-1 · 2026-10-11T08:30:39.314Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-217-3 · 2026-10-11T09:38:57.889Z
- [x] C2. A protocol test covers a human handover to an offline name, then the launch, then the next verdict reaching the new session.
  - done: impl-217 · 2026-10-11T08:28:21.174Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-217-1 · 2026-10-11T08:30:39.314Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-217-3 · 2026-10-11T09:38:57.889Z
- [x] C3. `npm run typecheck && npm test` pass.
  - done: impl-217 · 2026-10-11T10:51:16.964Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-217-4 · 2026-10-11T10:51:40.856Z

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

### rev-13 · 2026-10-11T09:36:53.938Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261011-217-2
commit: 3e2310b3f85b630fa16357c99eb93287742c5646

Medium — hub/src/hub/worktrees.test.ts:26: the new fixture hardcodes kind: 'epic', which the existing compiler-resolved container guard rejects under hub/src; derive the fixture kind from configured tracker levels while retaining its adoption assertion.

A-1161: typecheck completes, hub 1155/1156 pass, sole guard failure at tracker-container-source.test.ts:109, zero cancelled/skipped/todo; npm test exits 1 before Neovim. C3 failed with no exception. Prior same-head C1/C2 review stands; final readiness withheld.

A-1162: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1162-t-217-c3-at-3e2310b-container-name-guard-fails-full-suite.md

Criteria: C3 failed (npm test exits 1: container-name compiler guard rejects the new kind: 'epic' literal at hub/src/hub/worktrees.test.ts:26; Neovim phase never runs.).

### impl-217 · 2026-10-11T09:37:32.807Z

Fixed review C3 finding from A-1162: new unit fixture uses tracker.levels[1] instead of a hard-coded container name. Architecture guard now 2/2; fixed-clock adoption assertion retained and passes 1/1. Fetched/merged current origin/dev 42bbe78 (merge 4fc77ff), pushed clean corrected head b8bad83479a21c126da0d5760dcffabd7e886984. Production changes unchanged, C1/C2 prior review stands. Requesting review again before replacement all suite; C3 remains pending complete passing result.

### rev-13 · 2026-10-11T09:38:57.889Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-217-3
commit: b8bad83479a21c126da0d5760dcffabd7e886984

No high, medium or low findings at b8bad83. Fixture now uses tracker.levels[1] and retains its fixed-clock identity/timestamp assertion; production adoption and protocol assertions remain unchanged after conflict-free dev integration. Complete architecture guard 2/2 and adoption 1/1 logs pass; independent typecheck and diff checks pass on the clean pushed head.

C1/C2 refreshed at this exact head. C3 remains pending the replacement complete same-head all suite; prior A-1161 failure is not current passing evidence. No exception or final-readiness claim.

A-1167: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1167-t-217-correction-at-b8bad83-c1-c2-clear-replacement-suite-pending.md records separate Standards and Spec reports.

Criteria: C1 verified, C2 verified.

### impl-217 · 2026-10-11T10:51:17.189Z

C3 done: replacement final-head suite 06f594c3 at b8bad83479a21c126da0d5760dcffabd7e886984 passed typecheck and both package phases, 1424/1424 total, zero failures/cancellations/skips/todo, exit 0. Durable log A-1189. Branch remains clean at the same pushed/tested head; current origin/dev was fetched/merged before this suite. Requesting rev-13's final C3 verification. C1/C2 remain verified by review rev-13-20261011-217-3.

### rev-13 · 2026-10-11T10:51:40.856Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-217-4
commit: b8bad83479a21c126da0d5760dcffabd7e886984

No high, medium or low findings. A-1189 verifies C3 at unchanged clean pushed b8bad83: typecheck and npm test exit 0, hub 1166/1166 + Neovim 258/258 = 1424/1424, zero failures/cancellations/skips/todo. The corrected container-name guard, pre-hello adoption and offline handover→launch→verdict protocol case all pass in the full hub phase. No exception applied.

Same-head C1/C2 review rev-13-20261011-217-3 (A-1167) stands; final readiness is clear. A-1190: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1190-t-217-final-c3-at-b8bad83-full-1424-1424-clear.md records complete final validation and separate Standards/Spec conclusions.

Criteria: C3 verified.

### coord · 2026-10-11T10:51:56.528Z

Merged 21b1dddb75adc4042d888b34bde9afd6db9862fe onto dev.
