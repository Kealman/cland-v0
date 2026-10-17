---
id: T-693
kind: task
title: opencode-adapter.test.ts becomes OpenCode's contract file without the cross-adapter duplicates
state: closed
status: done
size: S
criterion_seq: 4
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
topic: topic-434
branch: t/T-693-opencode-adapter-test-ts-becomes
created: 2026-10-16T19:59:35.909Z
updated: 2026-10-17T13:40:54.256Z
closed: 2026-10-17T13:40:54.256Z
---

## Summary

`opencode-adapter.test.ts` (62.3 s, 17 tests; 24 fake-binary sites) is the OpenCode frame family, but it also re-proves hub-side behaviour other adapters prove: the launch brief after the role clause (×2), the shared-artifact envelope, the Lead's clause and claim (report-slice3 anti-pattern 10), and runs approval-snapshot edges through the binary.

## What to build

`opencode-adapter.test.ts` is tagged `{ "tier": "T3", "contract": "opencode" }` with T-691's checklist steps, one test each. The cross-adapter duplicates go, because T-691's composition file proves the hub's part once in-process. Approval-snapshot edges run on a scripted SSE transport double in a T1 or T2 file.

## Acceptance criteria

- [x] C1. `opencode-adapter.test.ts` is the `opencode` contract entry, with its header mapping each checklist step to one test.
  - done: impl-693 · 2026-10-17T11:36:43.044Z
  - verified: rev-30 [reviewer] · run rev-20261017-693-source · 2026-10-17T11:39:32.082Z · commit 8c1e3e849d8af85d1b746b35a3d9008e91b1e2c5
  - verified: rev-30 [reviewer] · run rev-20261017-693-final · 2026-10-17T12:30:46.567Z · commit 8c1e3e849d8af85d1b746b35a3d9008e91b1e2c5
- [x] C2. Manifest seconds of the touched and new files fall from 62.3 s (A-3877) to 45 s or less, and fake-binary call sites from 24 to 14 or less.
  - done: impl-693 · 2026-10-17T11:36:43.471Z
  - verified: rev-30 [reviewer] · run rev-20261017-693-final · 2026-10-17T12:30:46.567Z · commit 8c1e3e849d8af85d1b746b35a3d9008e91b1e2c5
- [x] C3. An audit maps every removed duplicate to the test that proves the same behaviour and every moved assertion to its new place, with no behaviour claim dropped.
  - done: impl-693 · 2026-10-17T11:36:44.013Z
  - verified: rev-30 [reviewer] · run rev-20261017-693-source · 2026-10-17T11:39:32.082Z · commit 8c1e3e849d8af85d1b746b35a3d9008e91b1e2c5
  - verified: rev-30 [reviewer] · run rev-20261017-693-final · 2026-10-17T12:30:46.567Z · commit 8c1e3e849d8af85d1b746b35a3d9008e91b1e2c5
- [x] C4. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - done: impl-693 · 2026-10-17T12:27:13.106Z
  - verified: rev-30 [reviewer] · run rev-20261017-693-final · 2026-10-17T12:30:46.567Z · commit 8c1e3e849d8af85d1b746b35a3d9008e91b1e2c5

## Blocked by

T-686.

## Comments

### impl-693 · 2026-10-17T11:33:04.334Z

Implementation keeps a 14-test real-binary OpenCode contract and adds eight T2 tests on scripted HTTP/SSE with in-process spokes. Approval snapshots, rejected-approval command recovery, queued-turn failure attribution, missed-completion cleanup and role-instruction cleanup retain hub frame/journal assertions. Cross-adapter brief/Lead/artifact duplicates map to adapter-composition.test.ts. First timings: contract 29.94 s, native 1.76 s; required final 5/5 serial runs underway. Source adds an optional Clock for watcher polling/reconnect scheduling; defaults remain real.

### rev-30 · 2026-10-17T11:39:32.082Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-693-source
commit: 8c1e3e849d8af85d1b746b35a3d9008e91b1e2c5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review T-693 at 8c1e3e849d8af85d1b746b35a3d9008e91b1e2c5, fixed point incoming dev79c1b84ec501c4d78ac0dc095fe389533351aa54. Origin matches. Reviewed all six changed files, production watcher/client handling, A-4482's26-row assertion audit and raw Mac receipts, and referenced adapter-composition proof. Read-only review; no Reviewer execution or delegation.

Standards
No findings. Optional OpenCode Clock owns only watcher PID interval and SSE reconnect backoff; defaults remain realClock, and interval cancellation uses that same owner. Native HTTP/process deadlines and native spawn/identity behavior are unchanged. The new T2 helper replaces process lifecycle with T-686 fakeHarness and overrides only OpenCodeClient request/events native transport. Production OpenCodeAdapter inject/watch/unwatch/usage, SessionTracker, OpenCodeClient command extraction and actual hub/frame/journal/peer routing remain exercised. Synthetic process PID is null and no real OpenCode binary is launched by these T2 cases.

Held request state is explicit: delayed approval tests observe one/two native message lookups before release, and raw request completion plus subsequent hub frame/journal barriers precede final stale-command checks. Reconnects advance the injected scheduler until the positive snapshot/reconnected receipt; no elapsed-time inference or long synthetic turn is used. Native crash settling sleep becomes the relaunched server's correlated reply followed by the retained one-exit-log assertion. The readiness<3000ms elapsed assertion becomes a3000ms whole-test bound while retaining rejected1000ms readiness/log diagnosis and no surviving owned server assertion.

Spec and criteria
C1 verified: opencode-adapter is the single T3/opencode contract descriptor; its header maps first native role clause/brief, launch/attach, envelope/injection/reply correlation, model/usage/state/failure/approval, stop, real hub-process restart and native conversation relaunch. Fourteen native cases retain real chosen-port/rebind/readiness, config/password/spoke/attach, queue/steer, permission/form, crash/restart and opt-in instruction endpoint proofs. Two actual startDaemon calls stay solely in the explicitly named hub restart test.

C3 verified: A-4482 individually maps all26 old expanded runtime cases, including later regressions. Duplicate preassigned brief, artifact envelope and Lead claim/address checks map to adapter-composition's OpenCode table rows; that proof actually checks spawn fields, clause/brief acknowledgement and delivery history, artifact id/path envelope and Lead role/claim/direct address. Native first-prompt and main envelope/reply contracts remain as transport proof. Eight T2 edge declarations retain known/delayed approval rejection, correct referenced command/privacy and missing-source fallback, pending snapshot, late lookup across episodes, queued-turn and missed-completion failure attribution, and instruction fallback/change/revocation/failed-cleanup retry with the same message id. The native generic turn-failure contract also retains exactly-one Agents entry, session-specific events row, original sender and live process. No behavior claim is dropped.

C2 census portion independently confirmed: fakeOpenCode tokens24→14 (13 invocation sites plus helper declaration); expanded real fixtures26→14. Daemon calls2→2; outside-binary spoke invocations5→1. C2's complete timing criterion awaits exact-head Linux. Per E-677's timing policy, all split files count and baseline fields are not task-refreshed. Independent duration audit: all non-allow fields unchanged; two moved attribution allowances removed; existing E-677 legacy file allowance shrinks62.340098→40 with the native contract reason; no new allowance or unrelated modification.

A-4482 independently audited ten raw logs: native contract14/14 five times, scripted-native8/8 five times, zero failures/cancellations/skips. Admission loads6.5419921875–11.40185546875<15. Recomputed Mac median test-seconds are31.117505877+1.563123500=32.680629377; the audit's distinct combined whole-file median33.576s is also below45. These metrics are not conflated. Typecheck/tier lint and no touched-file lint finding are recorded. C4's Mac portion is established, but exact-head droplet execution remains pending.

Source clear, no findings. C1/C3 verified at this head. Submit normal mode-free exact-head droplet verification; final C2/C4 settlement awaits its per-file timing and result. QA scope none.

Criteria: C1 verified, C3 verified.

### impl-693 · 2026-10-17T12:28:06.702Z

Final evidence at unchanged 8c1e3e84: A-4509 summarizes A-4506 exact-head Linux run ef1934ff (2067 pass /0 fail /5 skip; all14 contract +8 native cases and their selected load gates green). Only exit1 is known out-of-diff T-734 verifier-routing duration allowance, accepted by Coordinator disposition f2856399. Mac median test-seconds31.117505877+1.563123500=32.680629377≤45s settles C2 per Coordinator decision5ee61bcf; Linux48.220389073+8.830077555=57.050466628s disclosed, peak1m load10.32, load-gate extra wall49.51s. C4 marked done; all criteria done. Final same-head evidence review requested from Reviewer. No source change or dev merge.

### rev-30 · 2026-10-17T12:30:46.567Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-693-final
commit: 8c1e3e849d8af85d1b746b35a3d9008e91b1e2c5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear under primaryf2856399/5ee61bcf; source A-4483 unchanged. A-4506/ef1934ff exact head:2072tests/2067pass/0fail/5skip; all22 owned cases and14new identities5/5 (70/70) pass. Only hard red is external verifier-routing Codex relaunch5.254s, known T-734 allowanceb170e855 on dev; primary explicitly accepts receipt and directs keep head/final verdict. No overall-green or Neovim-executed claim. C2: independently recomputed ten A-4482 raw Mac logs, all5/5 whole files zero fail/cancel/skip; median test-seconds31.117505877+1.563123500=32.680629377<=45, native call census24→14 unchanged. Distinct whole-file sum33.576109458. Primary5ee61bcf makes Mac decisive; Linux48.220389073+8.830077555=57.050466628 disclosed (>45), peak10.32/extra gate49.51s, no causal normalization. C1/C3 source-current refreshed; C2/C4 now verified. Linux2workers,suite2720.47s,reported lifetime2805s/cost$0.1948. No new run or source change requested.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-17T13:40:54.256Z

Merged e07fe54be16380074405e5584ccc4fe72b5adc82 onto dev.
