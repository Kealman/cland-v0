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
updated: 2026-10-17T08:39:44.336Z
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
- [ ] C2. The steer, snapshot and recovery permutations run in a T1 or T2 file on the scripted transport, passing the tier lint.
  - verified: rev-30 [reviewer] · run rev-20261017-692-source · 2026-10-17T08:39:44.336Z · commit 95fafe3ab9fb76c4db27b9f8be35c60992f14947
- [ ] C3. Manifest seconds of the touched and new files fall from 99.1 s (A-3877) to 55 s or less, and their fake-binary call sites from 33 to 15 or less.
- [ ] C4. Their `startDaemon` call sites fall from 9 to 2 or less, each in a test naming its restart behaviour.
  - verified: rev-30 [reviewer] · run rev-20261017-692-source · 2026-10-17T08:39:44.336Z · commit 95fafe3ab9fb76c4db27b9f8be35c60992f14947
- [ ] C5. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
  - verified: rev-30 [reviewer] · run rev-20261017-692-source · 2026-10-17T08:39:44.336Z · commit 95fafe3ab9fb76c4db27b9f8be35c60992f14947
- [ ] C6. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.

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
