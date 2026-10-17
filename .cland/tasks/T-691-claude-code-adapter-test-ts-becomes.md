---
id: T-691
kind: task
title: claude-code-adapter.test.ts becomes Claude Code's one contract file; its permutations and negative sleeps leave the real binary
state: closed
status: done
size: M
criterion_seq: 7
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-686
  - T-679
topic: topic-422
branch: t/T-691-claude-code-adapter-test-ts-becomes
created: 2026-10-16T19:59:35.709Z
updated: 2026-10-17T07:27:21.117Z
closed: 2026-10-17T07:27:21.117Z
---

## Summary

Decision 5: one real-binary contract file per harness, plus the T3 scenarios, carry the fake harness binaries; everything else uses T-686's in-process fake adapter. This ticket defines the contract file for Claude Code and the checklist the Codex and OpenCode tickets reuse. `claude-code-adapter.test.ts` (56.2 s, 9 tests; 4 `startDaemon`, 3 `spawnSpoke`, 10 fake-binary sites, 13 numeric sleeps at f63afbac) is the frame proof for the family but also loops `CLAUDE_CONFIG_DIR` four ways through launch, stop, resume and relaunch and proves seven negatives by `sleep(k * POLL_MS)` (report-slice4 T-692, anti-pattern C). `claude-code-sessions.test.ts` (40.8 s) holds the signal-ordering proofs across real `cland hook` processes.

## What to build

- **The contract file.** `claude-code-adapter.test.ts` is tagged `{ "tier": "T3", "contract": "claude-code" }`. Its header lists the contract steps it proves once each, through the real fake binary, real spoke, hooks and mod: launch and attach command, role clause in the first turn, inject through the mod bridge to `injected`, hook signals to session state, usage and model, stop, resume across a hub restart, relaunch. The checklist goes into `docs/agents/tests.md` for T-692 and T-693.
- **Out of the binary.** The four `CLAUDE_CONFIG_DIR` selections become one frame proof plus a T1 table test of the environment the adapter composes. Each negative wait becomes a positive barrier (the next recorded call or event) or moves to the in-process fake.
- **The hub's own composition, once.** A new T2 file proves on T-686's fake adapter, for all three flavours as one table, what the hub composes before any adapter sees it: the launch brief after the role clause, the shared-artifact envelope naming its id and durable path, and a Lead's claim with its clause. T-692, T-693 and T-695 delete the per-adapter duplicates against it.
- **claude-code-sessions.test.ts** keeps the signal-ordering and pid-reuse proofs as T3 with a header; `resume never adopts … pid` runs on `projectHub` instead of a spawned hub.

## Acceptance criteria

- [x] C1. `claude-code-adapter.test.ts` is the `claude-code` contract entry in `tiers.json`, and its header lists each contract step with the one test that proves it.
  - verified: rev-30 [reviewer] · run rev-20261017-691-hook-correction · 2026-10-17T06:48:17.536Z · commit 65356952c278c4351a2dbb1a36fcd031fe49cec9
  - verified: rev-30 [reviewer] · run rev-20261017-691-final · 2026-10-17T07:26:28.295Z · commit 65356952c278c4351a2dbb1a36fcd031fe49cec9
  - done: impl-691 · 2026-10-17T07:27:07.851Z
- [x] C2. The two files' manifest seconds fall from 97.0 s (A-3877) to 80 s or less, and the numeric sleeps in them from 14 to 0 apart from reasoned markers.
  - verified: rev-30 [reviewer] · run rev-20261017-691-hook-correction · 2026-10-17T06:48:17.536Z · commit 65356952c278c4351a2dbb1a36fcd031fe49cec9
  - verified: rev-30 [reviewer] · run rev-20261017-691-final · 2026-10-17T07:26:28.295Z · commit 65356952c278c4351a2dbb1a36fcd031fe49cec9
  - done: impl-691 · 2026-10-17T07:27:08.220Z
- [x] C3. Their `startDaemon`, `spawnSpoke` and fake-binary call sites are recorded before and after, and every remaining one is in a test whose title names the process or harness behaviour it proves.
  - verified: rev-30 [reviewer] · run rev-20261017-691-hook-correction · 2026-10-17T06:48:17.536Z · commit 65356952c278c4351a2dbb1a36fcd031fe49cec9
  - verified: rev-30 [reviewer] · run rev-20261017-691-final · 2026-10-17T07:26:28.295Z · commit 65356952c278c4351a2dbb1a36fcd031fe49cec9
  - done: impl-691 · 2026-10-17T07:27:08.642Z
- [x] C4. An audit of test declarations and assertions before and after maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
  - verified: rev-30 [reviewer] · run rev-20261017-691-hook-correction · 2026-10-17T06:48:17.536Z · commit 65356952c278c4351a2dbb1a36fcd031fe49cec9
  - verified: rev-30 [reviewer] · run rev-20261017-691-final · 2026-10-17T07:26:28.295Z · commit 65356952c278c4351a2dbb1a36fcd031fe49cec9
  - done: impl-691 · 2026-10-17T07:27:08.989Z
- [x] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - verified: rev-30 [reviewer] · run rev-20261017-691-final · 2026-10-17T07:26:28.295Z · commit 65356952c278c4351a2dbb1a36fcd031fe49cec9
  - done: impl-691 · 2026-10-17T07:27:09.274Z
- [x] C6. The new T2 composition file passes the tier lint with no child process and covers the three flavours.
  - verified: rev-30 [reviewer] · run rev-20261017-691-hook-correction · 2026-10-17T06:48:17.536Z · commit 65356952c278c4351a2dbb1a36fcd031fe49cec9
  - verified: rev-30 [reviewer] · run rev-20261017-691-final · 2026-10-17T07:26:28.295Z · commit 65356952c278c4351a2dbb1a36fcd031fe49cec9
  - done: impl-691 · 2026-10-17T07:27:09.753Z
- [x] C7. `docs/agents/tests.md` carries the contract-file checklist.
  - verified: rev-30 [reviewer] · run rev-20261017-691-hook-correction · 2026-10-17T06:48:17.536Z · commit 65356952c278c4351a2dbb1a36fcd031fe49cec9
  - verified: rev-30 [reviewer] · run rev-20261017-691-final · 2026-10-17T07:26:28.295Z · commit 65356952c278c4351a2dbb1a36fcd031fe49cec9
  - done: impl-691 · 2026-10-17T07:27:10.106Z

## Blocked by

T-686 (in-process fake adapter), T-679 (`tiers.json` object entries).

## Comments

### impl-691 · 2026-10-17T06:32:23.401Z

Implemented shared three-flavour T2 composition (brief order for explicit/preassigned roles, artifact envelope, Lead claim/clause), adapterless refusals and idle retry policy. Added memory-only production-adapter environment table (T2 due child_process import false-positive); retained one unset-directory binary frame. Replaced hook startup sleep/spin with fd-3 release barrier and converted PID-reuse reopen to projectHub. Per Coordinator decision 2a1f74fe in topic-422, scheduler/signed-out waits stay pending T-696 Clock at first review; source untouched.

### impl-691 · 2026-10-17T06:40:44.305Z

Ready for source review at 0fb6d9f16cc3df9322b22d850b475c9487243298 (pushed origin). Evidence A-4322 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4322-t-691-assertion-migration-audit-and-5x-mac-receipts/README.md includes declaration-by-declaration assertion map, census and all 20 final serial Mac TAP receipts. Historical manifest seconds 56.219873+40.798841 → 35.014601+21.823140=56.837741; new T2 composition .517101s and env table .005697s. All touched files 5/5, start loads 5.70–13.19; typecheck/tier lint/diff check green. Removed 10 legacy allowances (120.938 allowance-seconds), no new allowance. Scheduler/auth waits explicitly deferred by Coordinator decision 2a1f74fe until T-696 Clock merges; T-696 remains in progress, production adapter untouched. QA policy scope none; Linux task verify awaits clear source verdict.

### rev-30 · 2026-10-17T06:42:22.563Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-691-source
commit: 0fb6d9f16cc3df9322b22d850b475c9487243298
scope: full
findings: [{"severity":"medium","text":"M1: The newly indefinite held hook has only t.after(() => stop.release()), registered after tempProject/projectHub cleanup, and the callback does not await stop.done. If the newer hook or busy assertion fails before release, fixture cleanup can stop the hub/remove the root while this unregistered hook is still blocked, then release it against a deleted fixture. Register bounded owned-child disposal/completion before directory removal (and for signals), preserving the release/order assertions; exercise the pre-release failure path.","file":"hub/test/claude-code-sessions.test.ts","line":118}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review T-691 at 0fb6d9f16cc3df9322b22d850b475c9487243298. Fixed point 7771468ed697a15667d56306e139d27a42d0f46f (the pre-review incoming dev parent); assertion census also compared against audit baseline 17c31797. Seven owned test/docs/manifest files, no production source edits. Read-only review, no Reviewer execution.

## Standards
Medium M1 — hub/test/claude-code-sessions.test.ts:118: the replacement for the startup sleep can hold its hook indefinitely on fd 3, but cleanup only registers a late native t.after that releases without awaiting completion. tempProject registered its ownership cleanup first; that hook stops registered hubs and removes directories. This hook child is spawned by the local hook helper without ownProcess registration, so it is not in that cleanup's owned identities. If the newer turn-start or busy observation fails before release, root teardown precedes the release callback and the child can remain blocked through deletion, then run against the deleted fixture. This violates project rule 12 and the process-lifecycle boundary rule. Add bounded owned-child disposal before directory removal, covering signal cleanup, and observe completion; retain the successful-path concurrency, release and stale-signal assertions. A controlled pre-release failure should prove the held child is gone before root removal.

## Spec
No separate missing behavior finding. The declaration-level audit maps adapterless refusals and repeated-idle retry to the new fake-adapter composition file; the memory-only four-way production-adapter table retains environment/attach/native resume/remedy assertions, while an unpinned binary frame remains. Shared three-flavour composition checks explicit/preassigned roles, clause/brief order, artifact id/path and Lead claim/routing. The PID-reuse case reopens projectHub with the same native identity refusal assertions.

C1/C7 source shape is present: Claude T3 contract descriptor/header and reusable docs checklist. C2's ten retained scheduler/auth sleeps are explicitly deferred by primary Coordinator 2a1f74fe until T-696 Clock, not treated as completed migration; the permission turn is separately accepted and tracked under T-725. No unapproved deletion of those negative assertions is requested.

Independently checked process-site census matches A-4322: adapter startDaemon 4->4, spawnSpoke 3->2, fakeClaude 10->9, sleep 13->10; sessions 2->0, 2->2, 10->10, 1->0. Only four file timing entries and their own test keys change; ten legacy allowances removed, none added. Combined adapter/sessions seconds 56.838 <=80. All twenty raw Mac logs in A-4322 have zero failures/skips (four files, five passes each), but do not exercise the pre-release teardown failure path. No Linux task run yet.

Verdict not clear for M1; C3 failed for the new unowned lifecycle teardown path. Other criteria remain unverified pending correction and subsequent exact-head verification. After fixing, request source re-review before droplet submission.

Criteria: C3 failed (M1: New indefinitely held hook is not owned/disposed before fixture directory removal on pre-release failure; late t.after releases without completion.).

### impl-691 · 2026-10-17T06:47:25.264Z

M1 fixed at pushed head 65356952c278c4351a2dbb1a36fcd031fe49cec9. Every hook child now registers with ownProcess(t), has a 15s native deadline and an awaited close via beforeDirectories; removed late t.after release. Added controlled pre-release exception proof: actual ownership cleanup observes dead PID while root exists, then root removal. Sessions passes refreshed 5/5 whole-file (13 tests incl nested), load starts 9.37–11.70; typecheck, tiers and diff check pass. Other three test files unchanged from their 5/5 A-4322 receipts. Updated combined manifest seconds 35.014601+26.359923=61.374524 <=80; no new allowances. A-4329 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4329-t-691-m1-fix-audit-and-refreshed-5x-mac-receipts/README.md has correction audit and all 20 final receipts. No dev merge after first source review, per rule 11.

### rev-30 · 2026-10-17T06:48:17.536Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-691-hook-correction
commit: 65356952c278c4351a2dbb1a36fcd031fe49cec9
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source review T-691 at 65356952c278c4351a2dbb1a36fcd031fe49cec9, delta from 0fb6d9f16cc3df9322b22d850b475c9487243298; original full review A-4323. Two files only (sessions test and its timing refresh), no post-review dev merge; origin branch matches. Read-only review.

## Standards
No remaining findings. M1 is resolved: every hook child is registered with ownProcess(t) at spawn, which disposes captured identities in the resource phase and in signal cleanup. A 15 s native child deadline is a fallback bound. beforeDirectories observes the close receipt before removal. Release is guarded/idempotent; the late native t.after release is removed. The successful ordering case still asserts newer busy before release, then awaits old-hook completion before stale-state/log assertions.

The new headed T3 lifecycle probe captures the actual ownership cleanup registration, raises a controlled exception before release, executes that cleanup, observes the exact child dead while the root exists, and then checks root removal. Its own fallback reruns idempotent disposers if the probe fails. The signal cleanup implementation also kills registered identities before awaiting beforeDirectories callbacks and removing roots.

## Spec and criteria
C1 verified: Claude T3 contract descriptor and header map the native launch/attach/clause/mod/hooks/model/usage/stop/restart/relaunch proof families.
C2 verified with primary Coordinator exception 2a1f74fe: combined manifest seconds are independently 61.374524 (<80), including added failure-cleanup proof. Ten scheduler/auth sleeps remain explicitly deferred until T-696 Clock rather than claimed removed; the reasoned permission turn remains under the separately accepted T-725 follow-up.
C3 verified: the previously audited census remains adapter daemon 4, spoke 2, fakeClaude 9 and sessions daemon 0, spoke 2, fakeClaude 10, with all remaining sites in native/lifecycle families. The correction adds one hook invocation under its explicit pre-release failure title, not a fake-binary/daemon/spoke site.
C4 verified: A-4329 updates the declaration/assertion migration map with the new cleanup proof; no previous diagnostic, ordering, identity, refusal, environment or native-boundary assertions are dropped.
C6 verified: sorted T2 composition tier/header and the three-flavour in-process table remain unchanged, with no harness/spoke child. Coordinator permitted T2 tagging for the memory-only env table's lint false positive. Claimant reports current typecheck/tier lint green.
C7 verified: shared contract checklist remains source-identical and current.

C5 partial: A-4329 contains all twenty raw Mac whole-file receipts, four files x5, each zero failures/skips. Updated sessions has 13 passed cases including nested cases and the new cleanup probe; other three source files are byte-identical and reuse their receipts. New source has no task droplet receipt yet, so C5 remains unverified.

Source clear with no remaining findings. Normal mode-free exact-head droplet verification may proceed.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C6 verified, C7 verified.

### impl-691 · 2026-10-17T07:25:57.995Z

Same-head Linux droplet verify 2a7dafc9-d959-481f-8edc-048573a30081 passed at 65356952c278c4351a2dbb1a36fcd031fe49cec9: auto/hub-only exit 0, 2091 tests, 2086 passed, 0 failed, 5 suite skips. Evidence A-4355 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4355-suite-2a7dafc9-d959-481f-8edc-048573a30081-auto-at-6535695.log. Executor c-8 lon1, Linux x64/Node 24.21.0, workers 2; lifetime 2212s, cost $0.1536, peak load 8.04. No head/tree changes after source-clear verdict. C5 now has four files × 5 Mac passes and the exact-head droplet receipt; awaiting Reviewer's final verdict.

### rev-30 · 2026-10-17T07:26:28.295Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-691-final
commit: 65356952c278c4351a2dbb1a36fcd031fe49cec9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review T-691 at 65356952c278c4351a2dbb1a36fcd031fe49cec9, unchanged from A-4330 / rev-20261017-691-hook-correction. Origin branch and hub verification record match. Mode-free droplet 2a7dafc9-d959-481f-8edc-048573a30081 / A-4355 exits zero, hub-only plus completed Neovim smoke. Read-only audit; no Reviewer execution.

## Standards
No remaining findings. Source correction ownership/teardown proof stands. The deliberate pre-release failure regression passes on Linux in 0.053 s; its reviewed assertions require exact child death before root removal and preserve successful old/new-hook ordering checks. No hard budget or load-gate failure appears. T3 report-only notices, including the native contract's 10.259 s case, are recorded rather than treated as failing gates.

## Spec and criteria
C5 verified. All four touched test files execute successfully in this exact-head Linux run: claude-code-adapter has nine top-level cases (42.284 test-seconds), claude-code-sessions has eleven top-level cases plus two nested cases (all thirteen have positive receipts; 27.879 top-level test-seconds), claude-code-environment has one memory-table case (0.010 s), and adapter-composition has three cases (0.963 s). The complete native contract, restart/identity/refusal/order cases, environment permutations, three-flavour composition and the new failure-path cleanup control are present. No additional owned load-repetition claim is made: this migration supplies timing entries for these identities, and C5 asks for one task droplet execution alongside five Mac passes.

A-4329's twenty raw Mac whole-file logs remain applicable to the unchanged source, each zero failures: four files x5, audited during source correction and rechecked here. The old diagnostic red used while developing attribution was not one of those accepted receipts. C1/C2/C3/C4/C6/C7 source verification remains current. In particular C2's 61.374524 manifest test-seconds and explicitly authorized scheduler/auth deferral are unchanged; this receipt does not claim those deferred sleeps have already been migrated by T-696. T-725's separately accepted reasoned permission-turn follow-up also remains explicit.

Phase counts independently sum to 2091 tests, 2086 pass, zero failures/cancellations, five skips: free 52/52; machine 2022 pass/5 skip; Neovim smoke 12/12. Host typecheck completes and its candidate-tree receipt ab4f264bf86ff8089c223f46c068d11817f5685e is reused remotely, not misidentified as the branch head. Linux x64 c-8 lon1, Node 24.21.0/Neovim 0.12.5, two workers; suite wall 2147.99 s, peak one-minute load 8.04, lifetime 2212 s, cost $0.1536.

Final review clear, all C1-C7 verified at this exact head; no remaining findings.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-10-17T07:27:21.117Z

Merged 9a158f8393b532f53ab7c4d283f078021d027161 onto dev.
