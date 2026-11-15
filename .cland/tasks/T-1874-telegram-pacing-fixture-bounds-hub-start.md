---
id: T-1874
kind: task
title: Telegram pacing fixture bounds hub start with a fixed 1 s setup deadline (remotes scenario fails under load)
state: closed
status: done
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
updated: 2026-11-15T21:47:51.531Z
closed: 2026-11-15T21:47:51.531Z
---

## Summary

`hub/test/scenarios/remotes.test.ts::Both remotes share answers, media, restart catch-up and isolate revoked Telegram` failed in merge batch 537bdc1c (T-1870 alone), run 47201382, on a Linux droplet: c-8, nyc1, workers 2, peak load 14.7, slow disk fsync of 26 ms, log A-19743. The error was `Telegram pacing fixture setup receipt deadline reached` at 2.2 s. The cause is `hub/test/telegram-pacing-fixture.ts`, which bounds the hub start in fixture setup with a fixed `options.setupTimeoutMs ?? 1_000` ms deadline. Under batch load, `projectHub` takes longer than that to start. The deadline is a setup barrier, not a behaviour under test, so a fixed 1 s bound breaks the rule that setup readiness uses the shared load-scaled waits (T-1853). T-1870 doesn't touch this file or its imports. The hub's singleton bisect dropped T-1870 on it.

## What to build

Make the pacing fixture's setup deadline use the shared load-scaled wait (`testWaitMs()` or `remoteWaitMs()`) with a named reason. Check every caller that passes `setupTimeoutMs`, and the other fixtures that copy this pattern. Behaviour bounds under test stay exact.

## Acceptance criteria

- [x] C1. The fixture setup deadline is load-scaled, and every caller and sibling fixture with a fixed setup deadline is listed and fixed or justified (test).
  - done: impl-1874 · 2026-11-15T20:25:18.468Z
  - verified: rev-35 [reviewer] · run rev-35-1874-evidence-1 · 2026-11-15T20:57:04.645Z · commit 3a38ad3890e0797cbb9316de430ead7a6a8faf52
  - verified: rev-35 [reviewer] · run rev-35-1874-final-1 · 2026-11-15T20:59:32.889Z · commit 3a38ad3890e0797cbb9316de430ead7a6a8faf52
- [x] C2. remotes.test.ts passes 20 out of 20 runs at a 1-minute load of at least 8, with unchanged assertions (test).
  - done: impl-1874 · 2026-11-15T19:39:49.745Z
  - verified: rev-35 [reviewer] · run rev-35-1874-final-1 · 2026-11-15T20:59:32.889Z · commit 3a38ad3890e0797cbb9316de430ead7a6a8faf52

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

### rev-35 · 2026-11-15T19:51:50.806Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1874-source-2
commit: 2e92a066e79ceae62a818194ddaf1c5b88446f1d
scope: full
findings: [{"severity":"medium","text":"Capped-download held setup still shares AbortSignal.timeout(2000) with its close observer. Held rejection feeds published/nativeHeld and undercuts the new scaled5s/10s outer setup waits. Split/scale the setup observation while preserving close behavior and exact fault assertions; no exception exists.","file":"hub/test/telegram-api.test.ts","line":500}]
finding_counts: {"high":0,"medium":1,"low":0}

A-19765 completed correction review. Prior card-web lifetime and documentation findings resolved, including independently read Coordinator34f59075/T-1875 exception; other nested setup migrations accepted. One same-class C1 prerequisite remains, confirmed185c2fb4. Preserved80-row inventory loses none of53 original rows; A-19762/63 raw positives and prior parse failure independently checked. Prior20 loaded samples stay qualified precommit; C2 unverified rather than failed. Configured verify pending source clearance, no reviewer runtime/provenance rerun. Hold released; fresh source review before verification.

Criteria: C1 failed (Recursive setup audit still misses the2s inner held-download observation signal, which overrides the scaled outer setup bound.).

### rev-35 · 2026-11-15T19:52:57.506Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1874-source-3
commit: e883c519d12077043b90085e03ef0da892606074
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-19766 records source clearance. Exact one-file delta resolves A-19765: held-download uses its own scaled setup signal; close observer retains exact2s bound and existing assertions/attempt-all disposal. All prior findings resolved; independently read Coordinator34f59075/T-1875 card-web exception remains scoped. Clean head, no dev merge. C1/C2 remain unverified pending configured same-head named/file evidence;20 earlier loaded samples and all capture/source-linkage limits retained. Source clearance permits mode-free verify at this exact head, not final landing. No reviewer runtime/provenance rerun.

### rev-35 · 2026-11-15T20:15:17.056Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1874-failed-evidence-1
commit: e883c519d12077043b90085e03ef0da892606074
scope: evidence
findings: [{"severity":"medium","text":"Reached holdRequest retains f.run's2s envelope around waitForHold now scaled5s/10s. Outer deadline disposes exchange first; actual omitted-setup error is 'Discord exchange disposed: aborted' instead of required hold receipt deadline. Same-item migration gap, not unrelated flake; preserve exact fault assertions and migrate/classify ordinary setup envelope.","file":"hub/test/discord-cards.test.ts","line":24}]
finding_counts: {"high":0,"medium":1,"low":0}

A-19768 independently reconciles original A-19767/23d825b6 exit1. Actual fail31891–31907; one negative test14475 and file14905. 5644 positive ordinary tests/600 files plus210 separate load test/file positives; T0/T1 exit0,T2 exit1. ChangedT3/Web unexecuted; browser null.80-row consumer union retained:50T1/T2 consumers pass,1fails;6T3/2Web unexecuted,21helpers no standalone claim. C2 remains unverified with qualified prior20 candidate samples retained. Author5b4dd324 confirms gap. Hold released for correction/fresh source request; no verify retry or reviewer experiment authorized.

Criteria: C1 failed (Configured same-head Discord omitted-hold control fails because the unmigrated outer2s bound wins over the scaled inner setup deadline.).

### impl-1874 · 2026-11-15T20:25:32.037Z

Class-wide correction committed/pushed 3a38ad3890e0797cbb9316de430ead7a6a8faf52 after failed configured23d825b6. Probe inventory A-19769:207 declarations in46 files, original fault bounds explicit. Serial local factor2 run879/879, no skips/cancels/fails A-19770; five final callsite pins rechecked135 repeated tests A-19771. Final typecheck/lint pass. Re-review requested with inventory A-19773 and correction/provenance A-19774 per Coordinator final-round decision e93ff4c1. Next mode-free verify awaits source clear.

### rev-35 · 2026-11-15T20:29:02.352Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1874-source-4
commit: 3a38ad3890e0797cbb9316de430ead7a6a8faf52
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-19776 records class-wide source clearance under independently read Coordinatore93ff4c1. Reached holdRequest outer envelope scales; omitted/pre-aborted probe explicitly pins1000 without changing expected assertions. Audited207 declaration/46file class; additive timeout overrides preserve original fault values. Corrected metadata A-19775 identifies helper bounds and preserves original rows. All80 consumers retained. Independently matched A-19770 46files879pass and A-19771 five repeated files135pass/native0/null, zero negatives/skips; later snapshot diff exactly matches final source. Prior configured red and all candidate/capture/provenance limits retained. C1/C2 unverified pending configured same-head settlement. Hold released; mode-free verify at this unchanged head permitted, not final readiness. No reviewer runtime work.

### impl-1874 · 2026-11-15T20:54:25.291Z

Configured same-head run b44f4edf at3a38ad389 passed exit0:6447pass,0fail/cancel/skip. T0,T1,allT2 fallback,2changedT3 files andWeb completed; remainingT3 deferred to batch/integrated, not claimed run. Linux x64 c-8 nyc1 Node24.21.0 Neovim0.12.5, lifetime1417s cost$0.0984, workers2. Duration/lint gates report mode; no allowance added. Canonical log A-19777. Reviewer receives same-head receipt and settles final readiness; no source changes.

### rev-35 · 2026-11-15T20:57:04.645Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1874-evidence-1
commit: 3a38ad3890e0797cbb9316de430ead7a6a8faf52
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-19778 independently settles C1 on same-head b44f4edf/A-19777:6447 base tests/702files plus210 separate load test/file passes, zero negatives/skips. All220T1/425T2/55Web selected files and two actualT3/66identities pass; all46 class files positive, exact prior omitted-hold control pass14442. All80consumer dispositions retained. C2 pending independently read Coordinatora16649a2 fresh final-head20-run stress receipt; old20 remain historical, not carried. RemainingT3/T4 deferred, report-only/capture limits retained. This is not final readiness. Hold released while authorized C2 producer runs; no reviewer runtime work.

Criteria: C1 verified.

### impl-1874 · 2026-11-15T20:58:07.950Z

Fresh final-head C2 completed under Coordinator a16649a2:20/20 remotes scenarios at3a38ad389 with load1 samples8.150390625–9.8466796875, each native0/null and1pass/0fail/cancel/skip. Raw A-19779, original producer A-19780, shutdown/provenance A-19781. Generator80482 stopped by captured PID, nine workerSIGTERM receipts and generator0/null; all absent by ps, load fell to6.91. Clean head unchanged. Reviewer received final C2 receipts; configured b44f4edf same-head green retained.

### rev-35 · 2026-11-15T20:59:32.889Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1874-final-1
commit: 3a38ad3890e0797cbb9316de430ead7a6a8faf52
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear, A-19782. Independently audited A-19779 fresh20 exact scenario positives, raw1pass/0fail/cancel/skip/todo per run, native0/null, load1 before/after8.150390625–9.8466796875, captured clean final head/tree unchanged afterward. A-19780 serial producer and retained owned generator/9worker close receipts checked; A-19781 reported load decay6.91 distinguished from Reviewer observations. Meets Coordinatora16649a2 without old-sample carry. C1 configured b44f4edf/A-19777 remains green6447base/702files plus210 separate load test/file positives; all selected and46class files pass.80consumer rows retained; fresh C2 adds remotes scenario to actual occasions. Old configured red, old precommit20, report-only/capture limits and T-1875 exception remain historical/scoped. RemainingT3/T4/landing separate. Hold released; no further run/source action requested.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-15T21:47:51.531Z

Merged a6bb5e86775fcee1a15f127dfbdca8e7db32e47b onto dev.
