---
id: T-1874
kind: task
title: Telegram pacing fixture bounds hub start with a fixed 1 s setup deadline (remotes scenario fails under load)
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - flaky
  - release-blocker
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1529
branch: t/T-1874-telegram-pacing-fixture-bounds-hub-start
created: 2026-11-15T17:13:05.465Z
updated: 2026-11-15T19:44:46.942Z
---

## Summary

`hub/test/scenarios/remotes.test.ts::Both remotes share answers, media, restart catch-up and isolate revoked Telegram` failed in merge batch 537bdc1c (T-1870 alone), run 47201382, on a Linux droplet: c-8, nyc1, workers 2, peak load 14.7, slow disk fsync of 26 ms, log A-19743. The error was `Telegram pacing fixture setup receipt deadline reached` at 2.2 s. The cause is `hub/test/telegram-pacing-fixture.ts`, which bounds the hub start in fixture setup with a fixed `options.setupTimeoutMs ?? 1_000` ms deadline. Under batch load, `projectHub` takes longer than that to start. The deadline is a setup barrier, not a behaviour under test, so a fixed 1 s bound breaks the rule that setup readiness uses the shared load-scaled waits (T-1853). T-1870 doesn't touch this file or its imports. The hub's singleton bisect dropped T-1870 on it.

## What to build

Make the pacing fixture's setup deadline use the shared load-scaled wait (`testWaitMs()` or `remoteWaitMs()`) with a named reason. Check every caller that passes `setupTimeoutMs`, and the other fixtures that copy this pattern. Behaviour bounds under test stay exact.

## Acceptance criteria

- [ ] C1. The fixture setup deadline is load-scaled, and every caller and sibling fixture with a fixed setup deadline is listed and fixed or justified (test).
  - failed: rev-35 [reviewer] · 2026-11-15T19:44:46.942Z · note Principal default fixed, but nested sibling setup deadlines omitted from required complete audit; source fixes and matching guidance pending.
- [x] C2. remotes.test.ts passes 20 out of 20 runs at a 1-minute load of at least 8, with unchanged assertions (test).
  - done: impl-1874 · 2026-11-15T19:39:49.745Z

## Comments

### impl-1874 · 2026-11-15T19:37:42.708Z

Red control: on dev base c9c4fffe8 with only default setup bound deliberately reduced to 1 ms, node --test hub/test/scenarios/remotes.test.ts failed 0/1 with Telegram pacing fixture setup receipt deadline reached. Restored with shared scaled real setup default; initial Mac Node 24.21.0 scenario passed 1/1. Audit and C2 stress receipts follow in topic-1529. Assertions unchanged.

### impl-1874 · 2026-11-15T19:38:05.171Z

Correction: local red/green control and C2 candidate base HEAD is 43d349e64c767e3ab7b31a2e4a2622e9a6ccd77e (current origin/dev), not the historical release failure head c9c4fffe8. Candidate patch is five test fixture/caller files; no scenario assertion changes.

### impl-1874 · 2026-11-15T19:40:22.957Z

Implemented and pushed 28d131d6f691e707ec284bce84a018594123a3a8. C1 audit and exclusions: A-19755. C2 raw 20/20 serial scenario receipts at load1 8.015625–10.447265625: A-19754. CPU workers stopped and observed absent; load fell to 5.55. Final targeted fixtures: pacing35, liveness11, cards62, endpoints11, Claude2, Discord16, memory58 all pass without skips. Typecheck passes. Source review requested from reviewer; no per-item QA required. Mode-free verification follows source clear.

### rev-35 · 2026-11-15T19:44:46.942Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1874-source-1
commit: 28d131d6f691e707ec284bce84a018594123a3a8
scope: full
findings: [{"severity":"medium","text":"Enlarged noncancellable FrameClient request/welcome waits can outlive the unchanged2s dispose join after abort or held setup; transport close does not cancel their timers. Add cancellation/drain ownership and held-inner-receipt controls while preserving required setup scaling.","file":"hub/test/telegram-card-web-fixture.ts","line":68},{"severity":"medium","text":"Current pacing and liveness guides still promise real1s setup defaults, contradicting the scaled real defaults. Update both existing claims with injected-clock/fault conditions (rule16).","file":"docs/agents/tests/hub-test-telegram-pacing.test.ts.md","line":134},{"severity":"medium","text":"C1 sibling audit misses nested real setup bounds: Telegram/Discord fake listening, legacy hub listening, capped-download held setup and Discord exchange outer startup envelope. Complete recursive classification and fix or explicitly justify them; retained exact behavior/fault and accepted exclusions remain separate.","file":"hub/test/fakes/telegram/fake-api.ts","line":530}]
finding_counts: {"high":0,"medium":3,"low":0}

A-19760 contains both review axes and consolidated findings. Independently read20/20 candidate scenario positives atload1 8.015625–10.447265625, nativecode0/signalnull, unchanged scenario assertions; preserve as qualified precommit evidence without immutable per-run hash. Six raw targeted captures160pass plus transcribed pacing35/typecheck retained;195 is not seven raw files. A-19756/57/58/59 inventory/producer/capture limits retained. C2 remains unverified, not failed. Coordinator28243759 named exclusions respected. No source/runtime/provenance rerun by Reviewer. Hold released; fresh committed source request before configured verify.

Criteria: C1 failed (Principal default fixed, but nested sibling setup deadlines omitted from required complete audit; source fixes and matching guidance pending.).
