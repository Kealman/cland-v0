---
id: T-2025
kind: task
title: host-survival-native 'held input mod completion and persisted idle' still flakes after T-1695 (2 of about 16 runs), with no state retained on failure
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1695
topic: topic-1674
branch: t/T-2025-host-survival-native-held-input-mod
created: 2026-11-20T01:52:38.692Z
updated: 2026-11-20T06:05:16.037Z
closed: 2026-11-20T06:05:16.037Z
---

## Summary

`hub/test/host-survival-native.test.ts` "three remote harnesses retain births, forwards and welcomed spokes across 20s hub downtime and master loss" still fails intermittently after T-1695's fix (c352aade5). The failure is `survival behavior step: held input mod completion and persisted idle: not within 30000 ms` (line 190).
- Once in T-1898's Linux merge batch 10a720e2 (log A-21985).
- Once in 5 macOS runs of T-1898 merged with dev (A-22003).
- T-1898 merged with dev then passed 10/10 in an interleaved A/B, against dev 10/10, and dev passed 5/5 earlier.
So: 2 failures in about 16 runs with T-1898 present, 0 in 15 on dev. No mechanism was found in T-1898's diff (A-22006).

The failing runs left no state dump: the case short-circuits its rows when the mod-completion identity is absent, and the SSH fixture removes its own `/tmp/cland-suite-<uuid>` root. So which predicate was missing (mod completion or persisted idle) is unknown.

## What to build

Make the case keep a bounded diagnostic on this predicate's failure: the expected input, the completion membership, the persisted state, a hub-log tail and the ordered hook and mod interpretations. Keep the assertion and the 30 s bound unchanged. Then find and fix the cause, a remaining path of T-1695's idle-overwrite class or a timing interaction, from a held-step reproduction.

## Acceptance criteria

- [x] C1. On this predicate's failure, the case records which component was missing, with the diagnostic above, and keeps its assertion unchanged (test).
  - done: impl-2025 · 2026-11-20T03:54:54.493Z
  - verified: rev-36 [reviewer] · run rev-36-2025-final-1 · 2026-11-20T05:02:55.298Z · commit d407601b1fd940a52fea7f64331551670a1675ff
- [x] C2. The cause is reproduced with a held step and fixed, and the case passes 20/20 on macOS at a 1-minute load of at least 8 (test).
  - done: impl-2025 · 2026-11-20T04:34:40.508Z
  - verified: rev-36 [reviewer] · run rev-36-2025-final-1 · 2026-11-20T05:02:55.298Z · commit d407601b1fd940a52fea7f64331551670a1675ff

## Comments

### coord · 2026-11-20T03:46:31.737Z

Another occurrence, 2026-11-20 03:46Z: T-1873's merge batch 407e9d64 (log A-22075, Linux, peak 1-minute load 11.3) failed with the same `held input mod completion and persisted idle: not within 30000 ms` (host-survival-native.test.ts:190). T-1898 is now on dev, and T-1873 only changes dispatch state replay for unnumbered clients. So this is a dev-level flake under batch load, now seen 3 times in Linux batches.

### impl-2025 · 2026-11-20T03:48:26.622Z

C1 instrumentation added; assertion/wait unchanged. Held-step predictions ranked: (1) independent mod process.run children reorder completion before start, so test associates completion with previous input; holding mod-start before spawn should reproduce missing completion even with persisted idle. (2) late native UserPromptSubmit with unmatched IDs overrides mod idle; holding native start should yield completion present + busy. (3) next input replaces modInputs before completion; ordered interpretations will show intervening mod-start. No cause claimed yet; native slot pending.

### impl-2025 · 2026-11-20T03:52:30.754Z

Held-step red (local macOS arm64, Node24.21.0, base e.g. current task worktree + C1/hold edits, no browser or stress): native exit1, case 50756.546291ms including setup/cleanup. Literal: held input mod completion and persisted idle: not within 15000 ms (default testWaitMs; loaded suite scaling originally 30000, unchanged). Completion interpretation seq14 precedes input mod-start seq15/stateCurrent:false; completionPresent:false, session.list cc idle/running, hub log signal-stale busy/source mod. Product correct. Coordinator approved test-only exact fake-close correlation, no production metadata. Pure negative controls wrong turn/start identity, timestamp, native code, missing interpretation pass. Native green in progress; 20/20 loaded C2 not run.

### impl-2025 · 2026-11-20T03:53:42.544Z

Consumer inventory: test-only FAKE_CLAUDE_MOD_START_HOLD and completion native close records have one producer (fake-claude.ts process.run) and one consumer (host-survival-native.test.ts + pure claude-mod-receipt.ts). Searches across hub/test, nvim/test, web/test, qa, docs and shipped skills show no other readers; per-file guide updated. Production signalPayload, mod wire fields, persisted readers, clients, frozen usage bytes and every production adapter remain unchanged. Existing FAKE_CLAUDE_START_HOLD remains unchanged. Corrected initial assumption: CLI strips turnId; native held start payload supplies turn identity, its exact at matches interpreted confirmed input; completion close's captured turn identity and exact payload.at match independently interpreted completion.

### rev-35 · 2026-11-20T03:59:46.012Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2025-source-1
commit: a30e84d72ad1bbf9001c53760a416aa264b8b5ef
scope: full
findings: [{"severity":"medium","text":"M1: the new mod-start hold resumes into spawn without rechecking stopping; its promise is tracked/joined only with awaitSignals, disabled in this case. Releasing a held post during shutdown can therefore launch a new native child. Fence/cancel and settle this held work in the shutdown owner, with a deterministic stop-while-held/no-late-child control; retain all survival assertions and bounds.","file":"hub/test/fakes/claude-code/fake-claude.ts","line":394}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear at a30e84d72ad1bbf9001c53760a416aa264b8b5ef: one medium Standards finding M1 (new held-post shutdown admission), confirmed in implementer decision ae2b01d1. A-22081 records the complete Standards and Spec review. C1's bounded pre-teardown component diagnostics and the approved exact native-turn/timestamp correlation are implemented; C1 remains unverified pending execution evidence. The actual eventually helper retries partial completion JSON; the started receipt is ordered before completion close, so no publication finding is recorded. A-22080's uncommitted local red/intermediate red/green remain separate with their provenance limits; none proves a configured exact-head run or the pending macOS loaded 20/20. No runtime/probe/check performed by this review. Hold released for one correction and fresh source review before the campaign or configured verification.

Criteria: C2 failed (The new mod-start hold permits native launch after shutdown admission closes and has no unconditional shutdown join/control; the loaded campaign remains outstanding.).

### impl-2025 · 2026-11-20T04:03:04.296Z

M1 corrected and pushed b80a3df52 (tree cd3fa8d6b8fe63d0767387fa754662b7a550c82e). Pure owner stop-held red: expected cancelled, actual launched; green3/3 after pre/post-hold abort fence. Fake configured hold now has unconditional owner tracking and TERM abort/release+join through native close, regardless awaitSignals; child errors settle on close. Immutable-head original native file exit0/1 of1 on local macOS arm64 Node24.21, startload1.68/no generator, case37935.0395ms/file38329.892125ms including setup/cleanup. No source edits during run. Required full typecheck exit0, full lint ongoing before fresh source review. No C2 loaded proof claimed; earlier A-22080 remains separate.

### rev-36 · 2026-11-20T04:07:55.423Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-2025-source-2
commit: b80a3df52f2bcea4b252cdc637001dd0689d57f7
scope: full
findings: [{"severity":"medium","text":"M2: prepare's catch calls finish(), resolving the hold promise, then throws; that throw is ignored after resolution. A failed .started write therefore loses its original setup error and can proceed to native launch. Separate watcher cleanup from successful resolution, reject preparation with the original error, and prove the actual failed-publication path admits no child.","file":"hub/test/fakes/claude-code/fake-claude.ts","line":395}]
finding_counts: {"high":0,"medium":1,"low":0}

Source2 not clear at b80a3df52 / tree cd3fa8d6b8fe63d0767387fa754662b7a550c82e. A-22087 records the full Standards/Spec pass. Source1 M1's stop admission and unconditional original-work/native-close join are otherwise corrected; future owner.run calls return the cancellation value after stop. One residual medium M2 loses a setup error and admits launch, confirmed by implementer decision a1f1b322; no omitted owner/exclusion. The approved exact native-turn/timestamp correlation and C1's bounded pre-teardown component diagnostics remain implemented, with all original survival assertions/deadlines retained. C1 remains unverified. A-22085's final-head 22/22 selected T1 and ordinary-load native 1/1 are separate from earlier failed/precommit epochs and do not establish C2's loaded campaign or configured proof. No runtime/experimental check performed by this review. Hold released for one consolidated M2 correction and fresh exact-head source review before campaign or configured verification.

Criteria: C2 failed (The held-step preparation can swallow its .started write failure and admit native launch; loaded macOS 20/20 remains pending.).

### impl-2025 · 2026-11-20T04:10:53.160Z

M2 corrected at pushed d407601b1/tree914e915e5864973dcecc1c79288059b530d45a3c: actual hold-preparation extracted to shared pure seam; cleanup separately rejects setup-write error instead of resolving then throwing. Deterministic control red Missing expected rejection -> green4/4, checks exact original error, closed observer, zero launches. Stop-held control now uses same preparation seam. Immutable-head original native file passed1/1 exit0 on macOS arm64 Node24.21, startload2.80/no generator, case37849.019375ms/file38246.909959ms includes setup/cleanup. Native slot released. Full lint finishing; fresh review before campaign/verify. C2 remains pending.

### rev-36 · 2026-11-20T04:12:53.467Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-2025-source-3
commit: d407601b1fd940a52fea7f64331551670a1675ff
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 clear at d407601b1 / tree 914e915e5864973dcecc1c79288059b530d45a3c. A-22089 records Standards/Spec consolidation. M2 is corrected through the same waitForModHold seam in the fake and deterministic controls: failed receipt publication closes its observer, rejects by original error identity and admits no launch. Stop-while-held now exercises that seam; M1's synchronous admission fence, unconditional held-work/native-close join and admitted-close control remain. Exact native-turn/timestamp correlation, C1 bounded component diagnostics and all original survival assertions/deadlines are retained; no production shape changes. A-22088's distinct red/green epochs, final-head selected T1 23/23 and ordinary macOS native1/1 are retained with their scopes. C1/C2 remain unverified; C2's loaded macOS20/20 at one-minute load>=8 and configured evidence remain pending. No Reviewer runtime/experimental checks. Hold released for the Coordinator-authorized campaign at this exact head under its machine slot; changed head needs fresh review.

### impl-2025 · 2026-11-20T04:34:53.919Z

C2 done at reviewed d407601b1/tree914e915e: A-22094 retains20/20 consecutive loaded macOS arm64 Node24.21.0 original cases, native exits0/signalsnull, generated exact case passes and TAP fail0 independently audited; no retries. Coordinator exclusive quiet window; calibration ambient1.336<5, starts8.522–11.510 (<12), sample min8.522/max12.990 (last round rose above12 after admission, retained). All eight owned in-process burner terminate/join receipts observed before release04:33:05Z; capture writers drained. Per-round full samples/min/max/native/case/TAP retained, only declared exports published through shared scanner. Source unchanged and worktree clean after staged export removal. Both criteria done; Reviewer final evidence settlement and Coordinator verify window requested; configured verification not yet run.

### rev-36 · 2026-11-20T05:02:55.298Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-2025-final-1
commit: d407601b1fd940a52fea7f64331551670a1675ff
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear at source3-reviewed d407601b1 / Git tree 914e915e5864973dcecc1c79288059b530d45a3c. A-22098 independently audits A-22094 loaded macOS20/20 and configured c45e5f4b/A-22097. Every Mac round has exact-case pass, TAP pass1/fail0, native0/signalnull/no timeout, distinct PID and startload8.52197–11.50977; all retained samples>=8, peak12.98975 after final admission retained without continuous-band claim. Forty positive native hook receipts and 8 Worker termination joins checked; source digests/head/tree remain fixed. C1's bounded component-failure capture and unchanged assertion are established by source3 plus separately retained diagnostic red; test-only exact correlation follows Coordinator62b4ed40. Configured full T1/T2, changed T3 and Web complete/exit0 at runtime tree f94df5bdf841e703016bfc3508de3e55f95a4e74: all734 file envelopes match selection, ordinary7090passes/zero fail/cancel/skip plus separate20 load passes (four controls×5); native survival case passes41.453191197s. No unfinished producer. RemainingT3 deferred batch/T4unexecuted, report-only advisories/allowance suggestion retained. Uncached c-8 ams3 Linuxx64 6.8.0-149, Node24.21/Nvim0.12.5, isolated HeadlessShell1248 Chrome156.0.8078.4. Machine lifetime/cost and Mac setup-inclusive timings remain separate scopes. Earlier failed/precommit/ordinary epochs retained; no Reviewer rerun/probe/source change. C1/C2 verified current; hold released.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-20T06:05:16.037Z

Merged 9b49690eadab0bc66f571dad0e5971dac32988fa onto dev.
