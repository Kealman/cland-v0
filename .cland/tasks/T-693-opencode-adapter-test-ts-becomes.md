---
id: T-693
kind: task
title: opencode-adapter.test.ts becomes OpenCode's contract file without the cross-adapter duplicates
state: open
status: review
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
updated: 2026-10-17T11:39:32.082Z
---

## Summary

`opencode-adapter.test.ts` (62.3 s, 17 tests; 24 fake-binary sites) is the OpenCode frame family, but it also re-proves hub-side behaviour other adapters prove: the launch brief after the role clause (×2), the shared-artifact envelope, the Lead's clause and claim (report-slice3 anti-pattern 10), and runs approval-snapshot edges through the binary.

## What to build

`opencode-adapter.test.ts` is tagged `{ "tier": "T3", "contract": "opencode" }` with T-691's checklist steps, one test each. The cross-adapter duplicates go, because T-691's composition file proves the hub's part once in-process. Approval-snapshot edges run on a scripted SSE transport double in a T1 or T2 file.

## Acceptance criteria

- [x] C1. `opencode-adapter.test.ts` is the `opencode` contract entry, with its header mapping each checklist step to one test.
  - done: impl-693 · 2026-10-17T11:36:43.044Z
  - verified: rev-30 [reviewer] · run rev-20261017-693-source · 2026-10-17T11:39:32.082Z · commit 8c1e3e849d8af85d1b746b35a3d9008e91b1e2c5
- [x] C2. Manifest seconds of the touched and new files fall from 62.3 s (A-3877) to 45 s or less, and fake-binary call sites from 24 to 14 or less.
  - done: impl-693 · 2026-10-17T11:36:43.471Z
- [x] C3. An audit maps every removed duplicate to the test that proves the same behaviour and every moved assertion to its new place, with no behaviour claim dropped.
  - done: impl-693 · 2026-10-17T11:36:44.013Z
  - verified: rev-30 [reviewer] · run rev-20261017-693-source · 2026-10-17T11:39:32.082Z · commit 8c1e3e849d8af85d1b746b35a3d9008e91b1e2c5
- [ ] C4. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.

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
