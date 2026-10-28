---
id: T-1417
kind: task
title: Telegram input fixture's aborted-setup drain test misses its observation bound once in five under a loaded macOS cover
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
regression_of: T-1378
topic: topic-1139
branch: t/T-1417-telegram-input-fixture-s-aborted-setup
created: 2026-10-28T06:30:22.866Z
updated: 2026-10-28T07:34:10.521Z
closed: 2026-10-28T07:34:10.521Z
---

## Summary

`hub/test/telegram-inbound.test.ts::Telegram input fixture drains observers after aborted setup receipt` (added by T-1378) passed 4/5 in the load gate of the macOS stage cover 59165f59 at dev 10a58d78 (A-13085, local 2 workers, peak 1m load 6.29): repetition 5 failed with `fake Telegram observation aborted or exceeded its time bound` from hub/test/fakes/telegram/fake-api.ts. Alone on dev it passes 5/5 (~0.4 s). The cover's tracker-watcher identities (T-1377) all passed; this is the only failure.

## What to build

Find why the fake's observation bound runs out once under CPU load (a fixed wall-clock bound in the fixture, or an observer that waits on a receipt the aborted setup never sends) and make the test wait on the fixture's own receipt with a bound sized for a loaded runner, without hiding a leaked observer.

## Acceptance criteria

- [x] C1. The cause is attributed with the failing output and a reproduction under CPU load.
  - done: impl-1417 · 2026-10-28T07:06:12.632Z
  - verified: rev-31 [reviewer] · run rev-20261028-1417-final1 · 2026-10-28T07:27:23.172Z · commit 4fd30659a307ad5be7646323f37af825ac1d11c0
- [x] C2. The identity passes 10/10 at two workers plus owned CPU load on macOS.
  - done: impl-1417 · 2026-10-28T07:06:12.849Z
  - verified: rev-31 [reviewer] · run rev-20261028-1417-final1 · 2026-10-28T07:27:23.172Z · commit 4fd30659a307ad5be7646323f37af825ac1d11c0

## Comments

### impl-1417 · 2026-10-28T07:04:22.211Z

Cause reproduced at the existing T2 fixture seam under 8 owned CPU workers / two test lanes, with a controlled 1100 ms setup delay: 0/10; each failed `Error: fake Telegram observation aborted or exceeded its time bound` at fake-api.ts:66, native Timeout._onTimeout. Unmodified CPU-only probes at 8/24/48 workers each passed 10/10: the delay is explicit fault injection, not an organically recurring failure. The drain observer starts AbortSignal.timeout(1000) before owner.start; it can expire before a native send even exists. Fix will retain its early observer but start a separate 5 s shutdown budget at disposal. Test-only consumer census: pacingOwner callers telegram-{inbound,cards,pacing,mute,commands,polling,approvals,notices}.test.ts; only inbound uses {drain:true}; guides for inbound/cards/mute/approvals/notices and implement skill mention ownership. No production/wire/schema/credential contract changes; other callers keep cancellation semantics.

### rev-31 · 2026-10-28T07:09:05.294Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261028-1417-source1
commit: 54f790e04dec75f80a93253c0b88c8373066f8b5
scope: full
findings: [{"severity":"medium","text":"M1 Standards: the new numeric setTimeout(1100) has no same-line lint-allow-wall-clock reason. The frozen test-lint allowance has no wall-clock-wait entry for this file, so admission rejects it despite the accepted fault-injection purpose. Preserve guard/baseline and add the specific intentional delayed-acquisition reason through the documented exemption; retain original red and green guard outputs.","file":"hub/test/telegram-inbound.test.ts","line":455}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source1 A-13097: Standards 1 medium M1 (intentional numeric 1100-ms delay missing documented same-line wall-clock reason, frozen allowance absent); Spec0. Disposal-started drain-observer deadline and independent setup bounds implement accepted diagnosis; early native-close observer and exact close-id/stopped-hub/Store/leak assertions retained. A-13094 independently has ten red and ten green one-test summaries; controlled delay distinguished from non-reproducing CPU-only probes. Local macOS evidence remains distinct from pending configured/Linux proof. Push reasoned-exemption correction with unchanged guard/baseline red/green receipts, request fresh source review before mode-free verify, no extra dev merge. C1/C2 final verification pending; no per-item QA.

### rev-31 · 2026-10-28T07:11:31.892Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261028-1417-source2
commit: 4fd30659a307ad5be7646323f37af825ac1d11c0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source2 clear, A-13099. Sole parent source1; only same-line reason comment changed, resolving M1 through documented intentional-fault exemption. No runtime/assertion/guard/baseline change or dev merge. A-13098 retains unchanged lint red exit1/one refusal ->green exit0/zero refusals; existing report-only134findings61files remains. Owner/observer/close/leak and accepted diagnosis audit carries A-13097. A-13093/94 remain original local macOS behavior evidence with capture/source limits; corrected-head configured/Linux evidence pending. Keep this exact head stable, submit one ordinary mode-free verify, then final original-record review for C1/C2. No per-item QA or extra full cover.

### rev-31 · 2026-10-28T07:27:23.172Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261028-1417-final1
commit: 4fd30659a307ad5be7646323f37af825ac1d11c0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, A-13103. Same-head 9b0dbbdf/A-13102 exit 0: 3839 ordinary passes plus 25 separate inherited site load passes; exact omitted/aborted setup outcomes pass 1.174073803/1.170780916 s, owning inbound 12/12 and all inventoried shared-fixture T2 consumers pass. C1/C2 verified from accepted controlled-delay diagnosis and A-13094 ten native red/ten green local completions under recorded two-worker/eight-CPU load; comment-only successor preserves executable behavior and original capture provenance. Host T0/all T1/fallback all T2/Web complete on Linux droplet; T3/T4 absent. Host gate TREE reuse and report-only timing/lint/ratchet warnings retained, no enforced-budget claim. Source2 unchanged; no new identity/allowance. No per-item QA or extra full cover per Coordinator. Ready/enqueue follows fresh conflict check.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-28T07:34:10.521Z

Merged a75e2fd8897174b1faa4f0bbc80be7ca3d15fa60 onto dev.
