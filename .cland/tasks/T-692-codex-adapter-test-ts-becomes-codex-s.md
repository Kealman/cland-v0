---
id: T-692
kind: task
title: codex-adapter.test.ts becomes Codex's contract file; steer, snapshot and recovery permutations move to a scripted native transport
state: open
status: review
size: M
criterion_seq: 6
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-691
  - T-686
topic: topic-427
branch: t/T-692-codex-adapter-test-ts-becomes-codex-s
created: 2026-10-16T19:59:35.806Z
updated: 2026-10-17T09:27:53.689Z
---

## Summary

`codex-adapter.test.ts` (80.0 s, 35 tests; 28 fake-binary sites, 8 numeric sleeps) launches a fresh fake app-server for each of 13 steer-reconciliation permutations: late steer ×5, reconnect snapshot ×2, idle snapshot ×2, recovery ×4 (report-slice1 top 10 #5). `docs/agents/tests.md` already allows a fake native transport for adapter parsing edges. `codex-delivery.test.ts` (19.1 s) boots a hub process five times with no lifecycle assertion and repeats OpenCode's artifact-envelope proof (report-slice3).

## What to build

- **The contract file.** `codex-adapter.test.ts` is tagged `{ "tier": "T3", "contract": "codex" }` and keeps one proof per T-691 checklist step: launch, attach, per-role tools, restart-resume, relaunch.
- **A scripted native transport.** The Codex adapter's app-server connection takes an in-process double that scripts the replies, and the 13 permutations run against it in a new T1 or T2 file with their assertions.
- **codex-delivery.test.ts** runs on `projectHub`. The artifact-envelope composition is the hub's, so it is proven once in-process by T-691's composition file, and the per-adapter duplicate goes.

## Acceptance criteria

- [ ] C1. `codex-adapter.test.ts` is the `codex` contract entry, with its header mapping each checklist step to one test.
  - verified: rev-30 [reviewer] · run rev-20261017-692-source · 2026-10-17T08:39:44.336Z · commit 95fafe3ab9fb76c4db27b9f8be35c60992f14947
  - verified: rev-30 [reviewer] · run rev-20261017-692-final · 2026-10-17T09:25:07.288Z · commit 95fafe3ab9fb76c4db27b9f8be35c60992f14947
  - verified: rev-30 [reviewer] · run rev-20261017-692-harness-merge · 2026-10-17T09:27:40.238Z · commit ae783036b64f0d336fa9e74462c830ba73009645
- [ ] C2. The steer, snapshot and recovery permutations run in a T1 or T2 file on the scripted transport, passing the tier lint.
  - verified: rev-30 [reviewer] · run rev-20261017-692-source · 2026-10-17T08:39:44.336Z · commit 95fafe3ab9fb76c4db27b9f8be35c60992f14947
  - verified: rev-30 [reviewer] · run rev-20261017-692-final · 2026-10-17T09:25:07.288Z · commit 95fafe3ab9fb76c4db27b9f8be35c60992f14947
  - verified: rev-30 [reviewer] · run rev-20261017-692-harness-merge · 2026-10-17T09:27:40.238Z · commit ae783036b64f0d336fa9e74462c830ba73009645
- [ ] C3. Manifest seconds of the touched and new files fall from 99.1 s (A-3877) to 55 s or less, and their fake-binary call sites from 33 to 15 or less.
  - verified: rev-30 [reviewer] · run rev-20261017-692-final · 2026-10-17T09:25:07.288Z · commit 95fafe3ab9fb76c4db27b9f8be35c60992f14947
- [ ] C4. Their `startDaemon` call sites fall from 9 to 2 or less, each in a test naming its restart behaviour.
  - verified: rev-30 [reviewer] · run rev-20261017-692-source · 2026-10-17T08:39:44.336Z · commit 95fafe3ab9fb76c4db27b9f8be35c60992f14947
  - verified: rev-30 [reviewer] · run rev-20261017-692-final · 2026-10-17T09:25:07.288Z · commit 95fafe3ab9fb76c4db27b9f8be35c60992f14947
  - verified: rev-30 [reviewer] · run rev-20261017-692-harness-merge · 2026-10-17T09:27:40.238Z · commit ae783036b64f0d336fa9e74462c830ba73009645
- [ ] C5. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
  - verified: rev-30 [reviewer] · run rev-20261017-692-source · 2026-10-17T08:39:44.336Z · commit 95fafe3ab9fb76c4db27b9f8be35c60992f14947
  - verified: rev-30 [reviewer] · run rev-20261017-692-final · 2026-10-17T09:25:07.288Z · commit 95fafe3ab9fb76c4db27b9f8be35c60992f14947
  - verified: rev-30 [reviewer] · run rev-20261017-692-harness-merge · 2026-10-17T09:27:40.238Z · commit ae783036b64f0d336fa9e74462c830ba73009645
- [ ] C6. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - verified: rev-30 [reviewer] · run rev-20261017-692-final · 2026-10-17T09:25:07.288Z · commit 95fafe3ab9fb76c4db27b9f8be35c60992f14947

## Blocked by

T-686.

## Comments

### impl-692 · 2026-10-17T08:33:45.278Z

Migration implemented at the production Codex connection boundary: scripted native T2 tests retain reconciliation/readback/snapshot and report routing; delivery policy uses T-686 fake adapter. Real contract retains launch/attach/first-turn refusal, per-role policy+effort, failure/approval/model/usage, process relaunch and one combined two-spoke hub restart. Current census: two startDaemon sites (one restart test), twelve fakeCodex calls plus its definition, zero negative sleeps in touched files. Baseline Mac original whole files passed: adapter 39.633s/35 tests, delivery 9.473s/6 tests. Final five-run evidence and source review pending.

### impl-692 · 2026-10-17T08:37:19.035Z

Source review requested from reviewer at pushed head 95fafe3ab9fb76c4db27b9f8be35c60992f14947; request resolved to rev-30. A-4400 durable evidence: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4400-t-692-assertion-audit-and-fifteen-mac-whole-file-receipts/README.md. Three files ×5 serial Mac passes, start load 2.01–2.45; median test-seconds 16.378168 + .240138 + 1.103214 =17.721520 (<55), typecheck/tiers/diff checks pass. Token census 33→13 fake-binary, actual incoming 4→2 daemon sites, 5→1 spoke children, 10→0 sleeps. Removed 79.959893 legacy allowance-seconds, duration baselines unchanged. origin/dev merged/current before first review; no source edits afterward. Waiting for source verdict before exact-head droplet verification.

### rev-30 · 2026-10-17T08:39:44.336Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-692-source
commit: 95fafe3ab9fb76c4db27b9f8be35c60992f14947
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review T-692 at 95fafe3ab9fb76c4db27b9f8be35c60992f14947, fixed incoming dev 6485162f464067cb6addc93a61bbd25d3cfa6cfc. Origin matches. Reviewed all eight changed files, item criteria, A-4400 declaration audit/before snapshots, and E-677's primary timing/allowance dispositions. Read-only review; no Reviewer execution or delegation.

## Standards
No findings. Structural AppServerConnection exposes only request/close/closed and the three consumed events. Default connection remains AppServerClient.connect with the same metadata, spawn deadline and 3000 ms connect deadline. The constructor's deferred factory reads the configured deadline when invoked, after construction. Only supervision interval ownership changes to optional Clock, defaulting to realClock; native process creation/identity, RPC deadlines and reconciliation code stay production. projectHub forwards the existing serveProject adapter-factory option without changing default fixture selection.

The new scripted/retry files are T2 with real in-process hub frames and no harness/spoke children. One CLI subprocess remains because explicit session retry is the behavior under test. Production AppServerClient malformed/disconnected classification runs over memory streams; a real binary timeout remains in the T3 contract. Scripted connection close rejects outstanding requests. Native PID-reaping checks use bounded exact observations and retain final assertions. Negative sleeps are replaced by native input/terminal/uncertain completion receipts and request barriers; explicit clock ticks follow refusal/completion observations rather than pumping I/O.

## Spec and criteria
C1 verified: sorted codex T3 contract descriptor and header map launch/first clause/refusal, attach, native injection/reply/approval/usage, role/effort tools and sandbox policy, crash/live relaunch/rename identity, combined two-spoke hub-process restart, and native missing-result timeout. The combined restart retains both spoke reconnections, same PID/thread, resumed delivery/tool reply and confirmed-stop reaping; two daemon starts remain in that explicitly named lifecycle test.
C2 verified: the scripted transport supplies native frames/RPC replies; production CodexAdapter retains admission, snapshot sequence, consumption/readback and recovery decisions. Held late responses, event/snapshot order, retained/reconstructed Live, consumed/dropped/unknown readback, ambiguous admission, newer-turn/two-attempt recovery and failure audience tables are covered. Real peer sends exercise routing after observed adapter decisions, not a model-quality claim. T2 tier lint records success.
C4 verified: independent literal census falls from current-base 4 daemon calls to 2 (historical brief 9 predates T-575), both in the restart test; spokes 5→1. C3 census portion is 33→13 fakeCodex tokens (12 calls plus definition), within 15, and sleeps 10→0.
C5 verified: A-4400 maps every original declaration/table cell and rewritten negative observation. Before source snapshots independently match fixed dev. Effort moves into native role policy, restart declarations combine, Lead/artifact/preassigned composition maps to T-691's three-flavour table. Native main still proves first-turn/injection/reply framing; sparse native account read ordering is untouched. No behavior claim is dropped by the reviewed split.

Timing policy: primary E-677 comment 2026-10-17T06:34:55Z judges seconds from per-file five-run Mac medians plus exact-head Linux, with baseline refresh only at green integrated stage close. Independently confirmed durations.json only removes the 79.959893 s legacy adapter-file allowance; no other field, allowance or baseline changes. A-4400's fifteen whole-file receipts are each zero failures/skips, five per three files, admission loads below 15. Medians: native contract 16.378167751 s, delivery 0.240138292 s, scripted native 1.103214082 s, total 17.721520125 s (<55). Claimant static checks are green. Current original before observations are disclosed separately from historical A-3877.

Source clear, no findings. C1/C2/C4/C5 verified at this head. C3's complete timing settlement and C6 await the normal mode-free exact-head droplet receipt; no per-item QA under none/after-stage policy. Verification may proceed.

Criteria: C1 verified, C2 verified, C4 verified, C5 verified.

### impl-692 · 2026-10-17T09:24:26.182Z

Same-head Linux droplet verification 6a98be00-db09-4728-b556-fdfd1650fed5 passed at 95fafe3ab9fb76c4db27b9f8be35c60992f14947 (A-4436). Automatic selection widened to full because Neovim imports hub/test/harness.ts; no explicit full mode was requested. 2464 tests, 2456 passed, zero failures/cancellations, eight suite skips. All 26 owned cases have positive timing receipts: contract 12/35.149156s, delivery 2/1.053786s, scripted native 12/4.269804s =40.472745s (<55); Mac medians remain 17.721520s. All 16 new owned identities passed load repetitions 5/5. Source/head unchanged since source clear; working tree clean. c-8 lon1, Linux x64, Node 24.21.0, Neovim 0.12.5, workers 2; suite 2557.46s, peak load 10.38, lifetime 2625s, cost $0.1823. No owned duration-budget failure. C3/C6 now have the requested same-head Linux evidence; final Reviewer verdict pending. Durable log: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4436-suite-6a98be00-db09-4728-b556-fdfd1650fed5-auto-at-95fafe3.log

### rev-30 · 2026-10-17T09:25:07.288Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-692-final
commit: 95fafe3ab9fb76c4db27b9f8be35c60992f14947
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review T-692 at unchanged source-reviewed 95fafe3ab9fb76c4db27b9f8be35c60992f14947. Origin and the hub verification record match. Source clearance is A-4401 / rev-20261017-692-source. Mode-free droplet run 6a98be00-db09-4728-b556-fdfd1650fed5 / A-4436 exits zero in full mode, selected because of the harness import. Read-only receipt audit; no Reviewer execution.

Standards
No findings. All 26 owned cases have positive ordinary timing receipts: 12 native contract, two delivery/retry, 12 scripted-native. Sixteen new identities each pass 5/5 fresh load repetitions (80/80): two native contract identities, two delivery identities and twelve scripted-native identities. The native RPC timeout, first-clause/refusal, crash/restart/relaunch, role/tool/effort and PID lifecycle proofs execute alongside the lowered snapshot/steer/recovery/readback permutations. There is no failing load gate or execution failure. Duration/tier projection notices are explicitly report-only; the run finishes exit zero.

Spec and criteria
C3 verified under E-677's primary timing policy, using actual per-file seconds rather than a partial manifest refresh. Independently summed A-4436 ordinary receipts:
- codex-adapter.test.ts: 35.149156026 s, 12 cases.
- codex-delivery.test.ts: 1.053785698 s, two cases.
- codex-native.test.ts: 4.269803505 s, 12 cases.
Combined Linux 40.472745229 s (<55). Accepted A-4400 five-run Mac median totals are 16.378167751 + 0.240138292 + 1.103214082 = 17.721520125 s (<55); all fifteen raw logs were rechecked for zero failures/cancellations/skips. All split files are included. The source-reviewed fake-binary census remains 33→13 tokens (12 calls plus definition), within 15. The historical 99.1 s reference and the separate current-base observations remain disclosed in A-4401. No baseline values were rewritten.

C6 verified: all three touched test files have five serial whole-file Mac passes in A-4400 and pass in this exact-head Linux task run. No owned case is skipped. Full run counts independently reconcile: hub free 56/56; hub machine 2014 total, 2009 pass/five skips; Neovim 394 total, 391 pass/three skips. Total 2464, 2456 pass, zero fail/cancel, eight suite skips.

C1/C2/C4/C5 remain source-current and are refreshed in the final pass: headed codex contract checklist, production-native scripted boundary permutations at T2, two daemon starts in the explicit restart contract, and the complete assertion map with retained cross-harness composition. The structural connection seam and supervision-only Clock default retain production native process/RPC behavior. New execution evidence corroborates the reviewed split; no new head or design change.

Host typecheck completes with candidate-tree gate receipt 6e269720d811f77f07718edfe31c2d6a50756918 reused remotely (not a task-head SHA claim). Linux x64 c-8 lon1, Node 24.21.0 / Neovim 0.12.5, two workers; suite wall 2557.46 s, peak one-minute load 10.38, load-gate extra wall 13.91 s; lifetime 2625 s, cost $0.1823.

Final review clear, no findings; C1-C6 verified at this exact head. QA policy is none/after-stage, with no per-item QA condition.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-692 · 2026-10-17T09:26:42.072Z

Coordinator-authorized dev conflict resolution pushed as ae783036b64f0d336fa9e74462c830ba73009645, parents95fafe3a/cc5394c0. projectHub keeps both droplet dependencies and adapter factory options. Five owned Codex source/test/helper files unchanged from first review; durations take all dev entries except our removed allowance; tier sets combined sorted. Typecheck/tiers/diff pass; each Codex whole file3/3 serial, plus project-hub/executor-droplet-component/remote-scripted each1/1, start loads1.81–3.00. A-4438 has raw receipts and resolution audit. Delta source review requested from reviewer; new exact-head droplet run will follow clear verdict. Previous A-4436 green/A-4437 final verdict refer only to95fafe3a.

### rev-30 · 2026-10-17T09:27:40.238Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-692-harness-merge
commit: ae783036b64f0d336fa9e74462c830ba73009645
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merge-delta source review T-692 at ae783036b64f0d336fa9e74462c830ba73009645, parents prior final-green 95fafe3ab9fb76c4db27b9f8be35c60992f14947 and incoming dev cc5394c06c61ee2dc92192740284ee80cbc656dd. Origin matches. Primary Coordinator 507229d6-9cec-45c3-9ab9-379ba5480838 authorizes this rule-11 code-conflict merge, the serial checks and a fresh diff-selected droplet verification after source clearance. Reviewed A-4438. Read-only review; no Reviewer execution.

Standards
No findings. projectHub retains incoming DropletDependencies import and droplet option plus the previously reviewed optional AdapterFactory[] option. Relative to incoming dev, the only harness change is that single adapter option in the type. The existing serveProject options spread forwards both droplet and explicit adapters; harnesses:'fake' retains its intentional generated-adapter override. No behavior branch, cleanup ownership or default fixture path is dropped.

Independent structured reconciliation: tiers.json exactly equals incoming dev plus the prior T-692 delta against common base 6485162f, preserving the complete sorted test map. durations.json equals incoming dev in every non-allow field and every retained allowance; its sole difference is removal of hub/test/codex-adapter.test.ts's previously reviewed legacy file allowance. No new or modified allowance or baseline. All five owned Codex source/test/helper Git blobs are identical to 95fafe3a. Diff against incoming dev contains only the same eight task paths; no unrelated authored additions.

Spec and criteria
C1/C2/C4/C5 source verification refreshed at this head: contract header/checklist, scripted-native T2 permutations, two daemon sites in the named restart contract, and A-4400's assertion map remain applicable. The production connection/supervision seam is unchanged; incoming projectHub dependency support is retained and composes with T-692's adapter factories.

A-4438's twelve raw serial Mac logs independently have zero failures/cancellations/skips: each Codex whole file three times, plus project-hub, executor-droplet-component and remote-scripted once. Start loads span 1.80908203125–3.00048828125. Codex medians are 16.428056167 / 0.232783167 / 1.127565 s; the prior fifteen 5/5 whole-file receipts remain the historical source-identical proof, supplemented by these Coordinator-requested post-merge reruns. remote-scripted exercises the retained droplet option; the other component files cover normal fixture paths. Recorded static typecheck, tier lint and diff check pass.

Prior Linux A-4436 and final audit A-4437 remain measurements of 95fafe3a (40.472745229 s across owned files, full green), not execution of this merge. C3 complete timing and C6 current-head Linux settlement are pending the newly required task run. No previous receipt is substituted for it.

Delta source clear with no findings. C1/C2/C4/C5 verified. Proceed with the authorized normal mode-free exact-head droplet verification; final C3/C6 settlement waits for the new receipt.

Criteria: C1 verified, C2 verified, C4 verified, C5 verified.

### impl-692 · 2026-10-17T09:27:53.689Z

Delta source clear at ae783036b64f0d336fa9e74462c830ba73009645 (rev-20261017-692-harness-merge / A-4439). Submitted fresh mode-free droplet verification 05742a49-105f-467f-a1aa-44ef94e212ff at that exact head, reporting to topic-427 and item lead/Coordinator/Reviewer. Queue admission succeeded. No further source/head changes; waiting for result.
