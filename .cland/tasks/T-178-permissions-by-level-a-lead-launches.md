---
id: T-178
kind: task
title: "Permissions by level: a Lead launches, stops, requests review and merges
  inside its subtree; refusals name the level"
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: impl-178
parent: E-113
blocked_by:
  - T-176
topic: topic-107
branch: t/T-178-permissions-by-level-a-lead-launches
created: 2026-10-10T15:38:36.029Z
updated: 2026-10-11T02:40:27.216Z
closed: 2026-10-11T02:40:27.304Z
---

## Parent

T-113, slice 3 of 7. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

A Lead launches and stops sessions for its epic's items, requests review and QA, and merges its items through the same gate; a request outside its subtree is refused, naming the level; the Coordinator keeps releases, sync, push, unscheduled merges and the launch of Leads.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-178 · 2026-10-10T22:21:07.784Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-178-2 · 2026-10-10T22:22:16.154Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-178-4 · 2026-10-11T00:08:01.966Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-178-6 · 2026-10-11T01:44:20.630Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-178-7 · 2026-10-11T01:45:15.787Z
- [x] C2. Demo: `lead-1` merges one of its items and is refused on an item of another epic.
  - done: impl-178 · 2026-10-10T22:11:34.750Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-178-1 · 2026-10-10T22:15:00.964Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-178-2 · 2026-10-10T22:22:16.154Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-178-4 · 2026-10-11T00:08:01.966Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-178-6 · 2026-10-11T01:44:20.758Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-178-7 · 2026-10-11T01:45:15.787Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-178 · 2026-10-10T22:11:34.994Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-178-1 · 2026-10-10T22:15:01.156Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-178-2 · 2026-10-10T22:22:16.154Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-178-4 · 2026-10-11T00:08:01.966Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-178-6 · 2026-10-11T01:44:20.860Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-178-7 · 2026-10-11T01:45:15.787Z
- [x] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
  - verified: rev-13 [reviewer] · run rev-13-20261011-178-5 · 2026-10-11T01:35:38.073Z
  - done: impl-178 · 2026-10-11T02:39:31.927Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-178-8 · 2026-10-11T02:40:07.217Z

## Comments

### impl-178 · 2026-10-10T21:50:09.354Z

Claimed T-178 in its task worktree. Confirmed seams from T-113: real hub frame/MCP+CLI protocol with fake harness launches/stops; no Neovim surface is touched. Scope uses live container claims and current item ancestry, not launched-by links. Implementing scoped launch/stop/request/merge checks and retaining the existing merge verdict gate.

### impl-178 · 2026-10-10T22:02:01.385Z

Initial two protocol cases pass: Lead launch/stop and scheduled gated merge/cross-epic refusal, plus live reparenting during real merge-tree preparation. Internal Standards review found async worktree authorization and typed late-refusal gaps; Spec review found verifier acceptance and merge recovery gaps. Fixed admission at spawn acceptance with existing owned-process cleanup, at branch linking, checkout/ref recovery and tracker closure; adding protocol regressions for these timing boundaries. Proven interim HubClient dummy completed as impl-178: artifact A-815, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-815-t-178-dummy-callback-proof-at-4d4ac56.log. Full suite has not started.

### impl-178 · 2026-10-10T22:09:20.192Z

All internal review findings fixed; Standards recheck clear. End-to-end verifier startup now rechecks scope before acceptance and retains worktree reservation through startup; live stop authority reaches advisory harness stop and each identity-checked OS signal. Process API tests pass 18/18, verifier startup/prune regression passes, real Git preparation/landing/receipt-recovery scope regressions pass, and typecheck passes. Running the complete new protocol file before freezing the review head. No full suite started.

### rev-13 · 2026-10-10T22:15:21.955Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261011-178-1
commit: dddd1ae1c690ddca49e9b67f85d7c72ec47bf78f

Medium — hub/src/adapters/sessions.ts:539: adapter.spawn receives no authorize callback; the new check at552 comes after process/native first-turn admission. Codex awaits version/policy at570/579, spawns at393 via580, and starts the brief turn at603. Reparenting/revoking while --version is pending still launches work after authority is lost; later cleanup cannot undo it. Carry live authority through adapters to check before process creation/first-turn submission and cover this pre-spawn race through the existing fake harness.

Standards and Spec independently corroborate the gap (hub/README.md:193; T-178 outside-subtree refusal). C1 failed. C2 scheduled gated merge/cross-epic refusal and C3 docs/exact role handover verified separately. Independent typecheck/diff check and table probes pass; clean pinned worktree. A-833 protocol3/3 inspected; writing tests not rerun. C4 unverified pending full-suite evidence on the final corrected head.

Review A-835: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-835-t-178-review-at-dddd1ae-authority-gap-before-native-launch.md.

Criteria: C1 failed (Adapter spawn preparation has no live authority callback; after scope loss during version/policy awaits, native process/first turn starts before Sessions post-spawn refusal.).

### impl-178 · 2026-10-10T22:17:35.916Z

Hub review A-835 failed C1 for native adapter prelaunch admission, beyond the final Sessions acceptance check. Reproduced both cases red through real Codex fake-harness gates: version preparation followed by out-of-subtree reparenting still created a server, and paused thread/start followed by Lead-claim release still submitted a native clause turn. Propagated authorize through HarnessAdapter.spawn into all three adapters: immediately before CLI/server creation, Codex thread/start and native turn/start, and OpenCode session creation. Existing identity-safe rollback handles refusals before acceptance. Both native regressions now pass, and typecheck passes; rerunning all five protocol cases with an explicit launch brief. Interrupted old dddd1ae full-suite runner cleanly (exit143; A-836), so C4 remains pending a new frozen-head suite.

### impl-178 · 2026-10-10T22:21:23.538Z

C1 fix frozen/pushed at 9f604abbbddd74196881a14fcbf9927a1c47bb93, origin/dev fetched and merged (83f0698), worktree clean. Five protocol cases pass (A-839), including pre-server reparenting and pre-first-turn claim revocation with explicit launch brief. Native-boundary file passes 64/64 (A-843), including typed ToolForbidden preserved while child identity is unavailable, blocked duplicate launch and cleanup after verified child exit. Typecheck passes; internal follow-up clear (A-840). Requested re-review from rev-13 at this head; restarting typecheck + full npm test through the proved persistent callback, then idle. Obsolete interrupted A-836 does not establish C4.

### rev-13 · 2026-10-10T22:22:16.154Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-178-2
commit: 9f604abbbddd74196881a14fcbf9927a1c47bb93

No remaining high or medium findings. A-835's native launch gap is resolved: Sessions propagates live authorize to all adapters, immediately before process creation and Codex thread/turn or OpenCode session admission. Original typed ToolForbidden survives pending rollback with captured child supervision; recovery retains the relaunch fence until safe settlement.

Separate Standards/Spec reviews clear. Independent typecheck/diff check and in-memory typed-refusal/pending-recovery probe pass; clean pinned head. A-839 real-hub/fake-harness5/5 includes both native races with explicit brief and no server/turn after scope loss; existing gated merge/refusal checks pass. Exact role replacements remain valid; handover adds native behavior. C1–C3 verified. Writing tests inspected rather than independently rerun; focused adapter result was still pending at request time. C4 unverified pending complete final-head full suite, with no readiness conclusion.

Review A-846: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-846-t-178-re-review-at-9f604ab-native-admission-gap-resolved.md.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-13 · 2026-10-11T00:03:50.451Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261011-178-3
commit: 9f604abbbddd74196881a14fcbf9927a1c47bb93

Medium — nvim/test/thread.test.ts:677: append+eviction2.045125ms exceeds the2ms rendering budget; complete npm test exits1. A-913 is otherwise clean: typecheck0, hub1073/1073, Neovim243/244, zero cancelled/skipped/todo. Rewrite30.341ms and exact200cold/0warm parse checks pass; no other failure.

The test and production thread implementation are unchanged by T-178. This is the known T-172 load-sensitive case; no T-178-scoped exception supplied, so C4 failed. Obtain scoped Coordinator disposition or validate after shared stabilization lands. No T-178 behavior defect is inferred. Clean unchanged reviewed head; C1–C3 and prior Standards/Spec A-846 stand. Complete durable log inspected read-only; writing suites not independently rerun.

Review A-914: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-914-t-178-c4-at-9f604ab-sole-rendering-append-budget-failure.md.

Criteria: C4 failed (A-913 typecheck exits0; full npm test exits1, hub1073/1073 and Neovim243/244; sole unchanged T-172 append-budget failure2.045125ms >2ms.).

### impl-178 · 2026-10-11T00:04:48.435Z

A-913 full run at9f604ab: typecheck0, hub1073/1073 pass, Neovim243/244 pass; only failure unchanged T-172 rendering append budget2.045125ms>2ms (peak machine load23.28). Reviewer failed C4 only (A-914); C1–C3 stand. Isolated existing test passes append1.402ms/rewrite26.689ms (A-915), zero skips. No timing assertion or rendering code changed. Fetched/merged latest origin/dev01ea28d cleanly, producing06cb6f667c954fd12f3630ece068d7764216da9a with T-190visibility and T-207full-run joint queue admission. Rechecking typecheck and scoped protocol cases, then requesting final-head review and retrying full npm test; C4 remains pending.

### impl-178 · 2026-10-11T00:07:25.947Z

Coordinator disposition 6a0faa9f-2fe4-457e-9d76-54470f6997a6: cancel new run and assess C4 at06cb6f6 using complete prior phases A-913 plus post-merge budget pass A-918, naming the T-172 append-budget exception, conditioned on rev-13 checking merge coverage A-916/A-917. Verified and signalled owned runner85905 with SIGTERM; callback completed A-919/typecheck0/test143 at unchanged clean06cb6f6, releasing queue admission. A-919 is an intentional cancellation and does not change the Coordinator's exception decision. Awaiting rev-13 assessment; no further code changes.

### rev-13 · 2026-10-11T00:08:01.966Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-178-4
commit: 06cb6f667c954fd12f3630ece068d7764216da9a

No high or medium integration findings; both axes clear. Added visibility layers preserve live claims/holds/ancestry/stable identities/refusal fields; native authorization, pending rollback fence, verified stop signals and merge landing/recovery/closure checks remain unchanged. Exact role-handover docs retained. Independent typecheck/diff pass; clean pinned head. A-917 protocol5/5 and A-918 rendering1/1 zero fail/cancelled/skipped/todo inspected read-only. C1–C3 verified cumulatively with A-846.

C4 not verified: Coordinator6a0faa9f's timing exception is conditional on no additional tested code beyond A-916/A-917 coverage. Merge also changes hub visibility and Neovim message-layer/palette/state behavior plus T-207 per-phase runner retention/recovery/interruption; those execution paths are outside the five Lead protocol cases and one rendering case. A-916 is static inspection. Reporting this additional coverage as requested. No imported-code defect asserted. A-919 intentional queue cancellation143 is not new failure or C4 evidence. Final readiness withheld pending full validation or revised explicit coverage disposition.

Review A-920: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-920-t-178-integration-at-06cb6f6-c1-c3-clear-c4-coverage-condition-unmet.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-178 · 2026-10-11T00:58:28.593Z

Final-head A-944 passes1084/1085hub, sole request-guard flood wait671ms>500ms; full npm test stops before Neovim. Targeted unchanged flood reproduces590ms (A-946), so this is not accepted by changing the assertion. Coordinator aa982c38 disposition identifies request-guard as a T-172 named exception with same-way dev-base failure3871ms and directs typecheck plus queued Neovim only, combining phases for C4. Starting that run at frozen clean06cb6f6 using standalone HubClient reporter --nvim; no source changes or hub rerun.

### impl-178 · 2026-10-11T01:35:01.268Z

Final same-head Neovim phase completed at06cb6f667c954fd12f3630ece068d7764216da9a: typecheck0, npm run test:nvim0,249/249 pass, zero failures/cancellations/skips/todos, unchanged clean head (A-955). Standalone callback marked C4 done and requested rev-13 verification. Combined C4 evidence is A-944hub1084/1085 with the Coordinator-authorized same-way request-guard T-172 exception (aa982c38; base evidence A-911 and task reproduction A-946), plus A-955 complete Neovim phase; reviewer interim disposition A-945 accepted the hub phase. No source changes; awaiting final C4 verdict and hub ready event, keeping the claim until merge.

### rev-13 · 2026-10-11T01:35:38.073Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-178-5
commit: 06cb6f667c954fd12f3630ece068d7764216da9a

No high or medium findings remain. C4 verified under Coordinator aa982c38's explicit T-172 request-guard exception: A-944 typecheck0 and complete hub1084/1085, plus A-955 fresh typecheck0 and complete queued Neovim249/249 exit0. Combined1334 tests,1333 pass; zero cancelled/skipped/todo, no other failure. Sole exception: hub/test/request-guard.test.ts:59, other client671ms behind the flood. A-946 reproduces590ms on this head; A-911 documents the same-way3871ms failure on merged dev base01ea28d, meeting the standing00:41Z amendment. Raw npm test exited1 before Neovim; separate complete same-head phase coverage is accepted by that disposition.

Clean unchanged pinned head; independent diff check passes. Logs/counts independently inspected read-only; writing suites not independently rerun. Prior same-head Standards/Spec and C1–C3 verification in A-920 stand; review gate complete.

Evidence A-956: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-956-t-178-final-c4-at-06cb6f6-clear-with-named-t-172-request-guard-exception.md.

Criteria: C4 verified.

### impl-178 · 2026-10-11T01:39:31.945Z

Coordinator requested fresh integration after ready head06cb6f6 conflicted with dev. Merged origin/dev1c2f5d6 and pushed e98771b6df9893338a36dcd52b38230d3e686689, preserving T-184 plan QA and T-193 artifact grants alongside live Lead permissions. Four conflicts resolved; handover replacement now retains artifact.keep/move/archive (A-959). Internal Standards/Spec integration review clear (A-960); typecheck and permission table5/5 pass. Lead protocol and plan-policy checks still running; fresh delta review and hub-owned cland suite all will validate this new head. Prior C4 evidence applies only to06cb6f6.

### impl-178 · 2026-10-11T01:40:31.954Z

Fresh delta review requested from rev-13 at pushed clean e98771b6df9893338a36dcd52b38230d3e686689. Fetched origin again immediately before suite; dev1c2f5d6 already included. Typecheck0, permissions5/5, Lead protocol5/5 and plan-QA8/8 all pass, no cancellations/skips/todos (A-970). Started hub-owned full suite54290fa7-3dde-41c6-a57f-f5523d94ea86, worker40790, initial project queue position2, reporting to rev-13 and impl-178 in topic-107. Going idle without polling; C4 needs fresh result on this integration head.

### impl-178 · 2026-10-11T01:44:39.837Z

Review A-973 reports one medium imported T-193×T-203 defect: delayed suite result publication retries a deleted original log path after artifact.move. Lead authority/C1–C3 integration passes; final verdict withheld. Confirmed original-path read and escalated via lead T-178 for shared fix assignment or scoped authorization. No source changes or suite polling; existing full run54290fa7 remains on frozen e98771b.

### impl-178 · 2026-10-11T01:44:48.045Z

Coordinator disposition b4ef984b: moved-suite-log reporter defect is shared dev item T-208 under T-115, outside T-178 scope and does not block it. No changes made for the defect. rev-13 to assess C1–C3 at merged e98771b and C4 on already-running cland suite54290fa7 under standing T-172 rule. Remaining idle until fresh result; head stays clean/frozen.

### rev-13 · 2026-10-11T01:45:15.787Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-178-7
commit: e98771b6df9893338a36dcd52b38230d3e686689

No high or medium in-scope findings. Standards clear; Spec clears T-178 authority, native admission, merge/ready routing and exact role handover. Conflict resolutions preserve T-184 plan QA and T-193 artifact grants alongside scoped Lead launch/stop/merge. All five exact handover replacement blocks match shipped defaults. Independent typecheck/diff checks pass on clean pinned head; A-970 permissions5/5, Lead5/5 and plan-QA8/8 counts inspected, zero failure/cancel/skip/todo. C1–C3 verified cumulatively.

The imported moved-suite-log defect at dispatch.ts519–521 remains recorded in A-973 but Coordinator b4ef984b assigns it to T-208 and explicitly excludes it from T-178's blocking scope. No fix or waiver of that defect here.

C4 is pending fresh running cland suite54290fa7 on e98771b. Existing C4 marks/evidence apply only06cb6f6; this verdict does not verify C4 or establish final readiness on the new head. Apply standing T-172 conditions after its complete result.

Review A-974: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-974-t-178-integration-at-e98771b-c1-c3-clear-imported-defect-assigned-t-208.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-178 · 2026-10-11T02:08:54.960Z

Full hub-owned run54290fa7 completed at clean unchanged e98771b (A-982): typecheck completes; hub1117/1118pass, sole failure request-guard other-client delay531ms>500ms, zero cancellations/skips/todos. This matches the standing named T-172 request-guard exception; no other failure. npm test stops before Neovim, so requested explicit new-head C4 review and launched hub-owned Neovim-only phase on e98771b, retaining same-head combined coverage. No source or gate changes; going idle until phase result.

### impl-178 · 2026-10-11T02:39:32.112Z

Fresh same-head Neovim suite5f399d4e completed successfully at e98771b (A-995): typecheck completed, Neovim252/252pass exit0, zero failures/cancellations/skips/todos. Clean unchanged pushed head confirmed. Combined with A-982hub1117/1118 and sole reviewer-accepted named T-172 request-guard531ms exception, C4 done marked for new-head1370test coverage; requested rev-13 explicit C4 verification at e98771b as Coordinator3a3699f1 requires. Keeping claim until merge; no further changes.

### rev-13 · 2026-10-11T02:40:07.217Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-178-8
commit: e98771b6df9893338a36dcd52b38230d3e686689

No remaining high or medium in-scope findings. C4 explicitly verified at e98771b using A-982 hub1117/1118 and A-995 Neovim252/252, both with successful typecheck. Combined1370tests/1369pass, zero cancel/skipped/todo; sole named T-172 request-guard exception at hub/test/request-guard.test.ts:59 (531ms>500ms), no other failure. A-911/A-946 establish same-way inherited dev/task failure under the00:41Z amendment. Coordinator da0dc4d9 explicitly retains this exception for older running e98771b after T-172 merge; no exception applied beyond that case. Raw npm test exits1 before Neovim; complete separate same-head Neovim exits0.

Counts, exact head headers, commands and complete logs independently inspected read-only; writing suites not independently rerun. Current worktree clean/unchanged and diff check passes. Old06cb6f6 C4 marks/artifacts and premature ready status are not evidence for this verification.

C1–C3 same-head A-974 remain clear. Imported reporter defect assigned T-208 is outside T-178's blocking scope by Coordinator b4ef984b. Review gate complete for e98771b; no conclusion about later integration heads.

A-996: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-996-t-178-final-c4-at-e98771b-clear-under-retained-request-guard-exception.md.

Criteria: C4 verified.

### coord · 2026-10-11T02:40:27.216Z

Merged 5b9a24e8c0db02fc74e8a693d0f5bad61c17beb7 onto dev.
