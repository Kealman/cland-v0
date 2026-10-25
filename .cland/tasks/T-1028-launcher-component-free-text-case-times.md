---
id: T-1028
kind: task
title: launcher-component free-text case times out waiting for Insert mode under load-gate pressure
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - needs-triage
assignee: null
parent: E-1282
blocked_by: []
regression_of: T-882
found_by: cover
topic: topic-1037
branch: t/T-1028-launcher-component-free-text-case-times
created: 2026-10-20T20:13:05.016Z
updated: 2026-10-25T11:24:26.258Z
closed: 2026-10-25T11:24:26.258Z
---

## Summary

`nvim/test/launcher-component.test.ts` "failed or empty model answers keep free text with a one-line reason" timed out waiting for Insert mode (`the launcher model field accepts Insert input: not within 15000 ms`, 15.33 s against its 2 s T2 budget) in the Linux stage cover 90cd4eeb at 44097bad (A-8033), while the load gate ran five repetitions of other Neovim files beside it. The test file and the launcher are unchanged since T-882, and the same case passed in stage cover 888e98da at 7c1aeae9 an hour earlier.

## What to build

Make the case wait on the state it asserts (the model field's mode or buffer state through a completion receipt, per rule 9) rather than a 15 s wall-clock poll, and check whether its 2 s T2 budget is realistic (T-882 history).

## Acceptance criteria

- [x] C1. The case passes 20/20 under the load gate's parallel repetitions on a droplet, waiting on a state receipt, not a wall-clock poll (receipt named in the item).
  - done: impl-1028 · 2026-10-25T11:16:32.149Z
  - verified: rev-31 [reviewer] · run rev-20261025-1028-final · 2026-10-25T11:19:30.100Z · commit 6b8ff8de2bdca5e44c349d70712e52a7f5be588a

## Comments

### coord · 2026-10-20T20:19:02.324Z

Flaky-rerun rule applied 2026-10-20 20:22Z: the case passed 5/5 alone on macOS arm64 locally at 44097bad (node --test --test-name-pattern, quiet machine); one resubmit of the Linux stage cover follows. Linux evidence of the flake: stage cover 90cd4eeb (A-8033).

### impl-1028 · 2026-10-25T10:34:46.539Z

Triage evidence A-11669 points at launcher-component.test.ts:208's Insert-mode eventually poll. Worktree inherited clean. Pre-agreed seam from C1: the existing T2 owned headless Neovim/recorded stub launcher case, observing native mode/buffer completion and the exact outbound session.launch.model. Plan: arm a bounded native completion receipt before opening/typing, retain free-text/reason/submitted-model assertions, prove the replaced wait's failure with a deterministic regression before making it pass. No production reply/schema/policy change intended.

### impl-1028 · 2026-10-25T10:42:21.064Z

Source ready at 1bee70f99226ff89b04ca86508f4428a4d449e18 (pushed origin task branch). A-11747 records native launcher-model-input/TextChangedI receipt, exact model/name/role/row/mode assertion, negative Normal-mode control, and local evidence. T2 launcher-component passed 12/12 on macOS arm64/pinned headless Neovim v0.12.5; owned case 0.304262s. Typecheck and tier manifest passed; test lint report-only (0 refusals), wording guard and diff check passed. New mapped T4 identity: nvim/test/launcher-input-load.test.ts::launcher Insert receipt holds 20/20 under parallel load, child launcher case 1 through 20, batches of 2; requires 20 case completions/40 input receipts with every original reason/popup/outbound assertion. Stress guard deliberately not run locally; source review then one mode-free droplet task verify supplies C1 evidence. C1 remains pending that receipt; QA scope none. No production/shared-contract change.

### rev-26 · 2026-10-25T10:44:30.752Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1028-source-1
commit: 1bee70f99226ff89b04ca86508f4428a4d449e18
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; A-11748, Standards0/Spec0. Native observer armed before keys requires exact TextChangedI name/role/model/row/Insert-mode receipt under separate 5s bound, retaining error/empty reasons, no popup and exact outbound model assertions. Shared owned recorded-client case remains T2; mapped T4 runs 20 independent native cases in pairs, requires all 20 completions/40 receipts, no extra T4 repetitions. Fixture drain-before-directory and sealed env retained; no product/wire/keymap/permissions change. A-11747 local summaries/Normal-mode sensitivity control are supplemental, not reproduced Linux flake or full raw/configured proof. C1 runtime pending and intentionally not claimant-done yet. Submit ordinary mode-free exact-head configured verify, preserve actual T4 20-child/40-receipt/no-skip proof and T2 timing; T4 has no budget/stanza, so >3s alone needs no allowance. Preserve original local receipt limits without transcription reruns.

### rev-26 · 2026-10-25T10:55:32.776Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261025-1028-evidence-1
commit: 1bee70f99226ff89b04ca86508f4428a4d449e18
scope: evidence
findings: [{"severity":"medium","text":"M1: configured run69adb5aa exits1 because the new aggregate T4 identity has no measured reasoned duration entry and exceeds the separate legacy generic5s new-identity gate (native7.129787690s). Assertions pass but Web never runs. Prepare a narrow dated/owned measured allowance without changing twenty cases, forty receipts, concurrency, deadlines or generic enforcement; fresh source review before new-head configured retry.","file":"hub/test/durations.json"}]
finding_counts: {"high":0,"medium":1,"low":0}

Not-clear configured evidence; A-11759 audits A-11758 exact head. T0/T1/fallback T2 pass; T4 parent and all20 children pass, diagnostic confirms40 asserted input receipts; T2 owned case0.484586995s. Parent7.129787690s fails enforcing generic5s unknown-identity gate despite T4 null tier budget; selected added wall7.419s, phase12s, file7.268468582s kept separate. 2879 completed passing test outcomes, no assertion fail/skip/cancel, no Web/no overall pass. My prior no-T4-budget guidance omitted this separate generic gate; corrected in A-11759. No unchanged-head retry; reasoned measured allowance correction then fresh source review and mode-free configured evidence. Other budgets/lint remain report-only; no shared-defect classification or QA claim.

Criteria: C1 failed (Twenty-case behavior passed, but configured evidence is incomplete/red on the aggregate new-identity duration gate; Web did not execute.).

### impl-1028 · 2026-10-25T10:56:20.802Z

Evidence-1 run69adb5aa/A-11758 at1bee70f9 passed parent and exact launcher case1–20 (40 native receipts; T2 case0.484586995s) but exit1 from generic new-identity duration gate7.129787690s>5s. Reviewer not-clear A-11759. Correction pushed77f6c45004d23574968d308ea8e1117f0d452358: only dated exact-key10.695s E-1282 allowance (1.5× measured sample, 2026-10-25 through2026-11-01) and per-file doc clarification. No fixture/assertion/deadline/concurrency change. Captured-sample checkDurations replay fails without entry and clears with it; lint0 refusals, wording0 findings, diff check passed. Fresh source review before mode-free retry; no overall-green claim and C1 pending final settlement.

### rev-31 · 2026-10-25T10:57:37.854Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1028-source2
commit: 77f6c45004d23574968d308ea8e1117f0d452358
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1028 allowance correction source review — CLEAR

Head77f6c45004d23574968d308ea8e1117f0d452358/tree01e396ac49092eb4b0dc19def1a917abd1a729b3, direct parent1bee70f99226ff89b04ca86508f4428a4d449e18. Named correction request reached rev-31 with no hold; carries rev-26 full source A-11748 and failed evidence A-11759. No competing review or dev merge.

## Standards

M1 resolved in source. Entire diff adds one exact-key allowance and six explanatory doc lines. The key exactly matches the recorded T4 parent identity `nvim/test/launcher-input-load.test.ts::launcher Insert receipt holds 20/20 under parallel load`. 10.695s equals ceil(1.5 × 7.129787690 ×1000)/1000. OwnerE-1282 is an open epic in task.view; added2026-10-25, expiry2026-11-01 is seven days, no legacy/global/E-880 change. Reason identifies executor/run/sample and unchanged twenty independent clients/forty native receipts. No fixture/test/runner/assertion, concurrency, teardown or input-deadline change. No findings.

## Spec

Carry accepted A-11748 source conclusions unchanged: exact native TextChangedI name/role/model/row/Insert receipt armed before keys, separate bound, final error/empty/popup/outbound assertions; owned T2 case plus T4 twenty cases in pairs. The allowance addresses aggregate measured execution cost only. Documentation correctly distinguishes T4's absent tier budget from the still-enforced generic new-identity 5s gate even when overall duration policy is report mode; it does not make the failed run green or relax the input receipt. No shared wire, keymap or permissions change.

## Original evidence and disposition

Independently parsed original A-11758/69adb5aa finish records: parent7.129787690s passes; exactly launcher case1–20 all pass, children0.632593598–0.783484083s; diagnostic confirms20/20 in batches2 and40native TextChangedI receipts. Actual run failure remains `duration budget: nvim/test/launcher-input-load.test.ts::launcher Insert receipt holds 20/20 under parallel load 7.13 s > 5 s (add to hub/test/durations.json with a reason)`. T0/T1/T2 pass, T4 phase exits1 on that gate, Web/T3 absent; 2879 executed passing outcomes are partial evidence, not an overall pass. Native parent, file, selected added wall7.419s excluding machine wait and phase12s remain separate. Linux x64/c-8lon1 Node24.21/Neovim0.12.5, workers2, lifetime515s/$0.0358 describes the old executed run, not current-head execution.

A-11762's captured-sample checkDurations red/green replay is pure policy validation, not a new native measurement or configured pass. Reviewer performed read-only source/data/artifact inspection only; no test/replay/stress/browser/fetch/Git mutation. No transcription reruns requested.

Source CLEAR, findings empty. C1 remains failed/runtime-unverified until one successful ordinary mode-free configured run at unchanged77f6c450, exact new-head20/20 child and40receipt proof, and final evidence settlement; claimant then restores done. Old69adb5aa/A-11758 stays red history. No additional dev merge, stress invocation or extra T4 repetitions requested. QA none/after-stage.
Durable review: A-11763.

### impl-1028 · 2026-10-25T10:58:35.629Z

Coordinator instruction delivered after source2 required 11 s, rounded from the measured 7.129787690 s sample for Linux variance. Pushed 6b8ff8de2bdca5e44c349d70712e52a7f5be588a: only 10.695→11 in the same dated E-1282 allowance and matching reason/doc rounding text. No test, fixture, assertion, deadline, concurrency, generic enforcement or dev merge change. Test lint remains report-only/0 refusals; wording guard 0 findings; diff check passes. Fresh source review requested before the one mode-free retry; no run at 77f6c450.

### rev-31 · 2026-10-25T11:04:34.169Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1028-source3
commit: 6b8ff8de2bdca5e44c349d70712e52a7f5be588a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1028 selected-head allowance delta — CLEAR

Head6b8ff8de2bdca5e44c349d70712e52a7f5be588a/treee0abd919faad95566311b8f5bea942c614ceb6ad, direct parent/source-clear77f6c45004d23574968d308ea8e1117f0d452358 (A-11763). Read-only branch tip matches6b8ff8de. Coordinator decision6c592919-031e-4452-919f-31336a38084b at11:01:43 explicitly selects the actual local/origin head6b8ff8de, prohibits further ref changes, and supersedes all crossed earlier head instructions. This resolves the authorization conflict noted before review; no Reviewer ref mutation occurred.

## Standards

No findings. Complete delta changes only exact allowance10.695→11s and matching measured-reason/per-file documentation rounding text. Same exact identity, open epicE-1282, added2026-10-25/expiry2026-11-01, no legacy/global allowance change. 11s is the whole-second upward rounding of1.5×7.129787690s, explicitly directed by the Coordinator. No fixture/test/runner/assertion/cleanup/input deadline/concurrency change or dev merge.

## Spec

Carry rev-26 full source A-11748 and own measured correction A-11763 unchanged. Twenty independently owned native launcher cases in pairs, forty exact TextChangedI receipts, original reasons/popup/outbound assertions and separate input deadline stay intact. The aggregate-duration allowance does not weaken behavior. No extra stress or T4 repetitions requested.

## Evidence and disposition

Original69adb5aa/A-11758 remains failed overall despite20/20 children/40receipts and parent7.129787690s passing; the generic5s new-identity gate, independent of absent T4 tier budget, failed before Web. The measured source2 policy replay remains supplemental, not new runtime proof.

Original7016939b/A-11767 is also terminal failed at admitted77f6c450: `dirty or changed worktree cannot be bundled for droplet: HEAD changed`. HostT0 exits0/32.632s, but no runtime tier or child case ran. Counts and remote platform/browser/health are unavailable, not zero/pass. The reported attempted droplet lifetime52s/cost$0.0042 describes that failed attempt, not suite wall or executed test evidence. It cannot verify C1 at either head. It is already terminal in task.view; Reviewer neither cancelled it nor requested another cancellation.

Source delta CLEAR, findings empty. C1 remains failed/runtime-pending until one ordinary mode-free configured verify at unchanged6b8ff8de and final exact-head20/20+40receipt settlement; claimant restores done after actual behavior proof. Keep all earlier red receipts attributed as above. Coordinator owns any queue/run disposition; no ref changes, dev merge or extra test/stress repetitions requested. Reviewer only inspected immutable source, metadata and original artifacts. QA none/after-stage.
Durable review: A-11772.

### impl-1028 · 2026-10-25T11:17:17.780Z

C1 done at unchanged reviewed head 6b8ff8de2bdca5e44c349d70712e52a7f5be588a. Fresh mode-free droplet run cd53fb1e-509f-4eda-9bd8-84941e90b008/A-11790 exit0: 3161/3161 pass, 0 fail/skip/cancel. Parsed exact T4 parent + launcher case1–20 finish records all pass; diagnostic confirms 20/20 cases in batches2 and40 native TextChangedI receipts. Parent6.892762309s; T2 owned case0.463652518s (<2s). Linux x64 c-8 lon1, Node24.21/Neovim0.12.5, lifetime636s/$0.0442. T0/T1/fallback allT2/mappedT4/Web completed; remainingT3 deferred, otherT4 absent. Chrome Headless Shell156.0.8078.4 isolated; budgets/ratchet/lint report-only, generic new-identity gate active. Final evidence artifact records exact names, bounds and phase scope. Source3 A-11772 unchanged; final evidence review requested, claim retained; Coordinator enqueues.

### rev-31 · 2026-10-25T11:19:30.100Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1028-final
commit: 6b8ff8de2bdca5e44c349d70712e52a7f5be588a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1028 final Linux evidence — CLEAR

Exact unchanged head 6b8ff8de2bdca5e44c349d70712e52a7f5be588a, tree e0abd919faad95566311b8f5bea942c614ceb6ad. Branch tip matches. Carry full source A-11748, correction A-11763 and selected authorized delta A-11772. task.view confirms configured mode-free cd53fb1e-509f-4eda-9bd8-84941e90b008 finished/passed at this head; C1 claimant done restored. Original evidence A-11790; A-11791 indexes the facts.

## Criterion

C1 verified. Independently parsed original progress records select exactly the expected twenty names, launcher case 1 through 20, in nvim/test/launcher-input-load.test.ts; all pass, no skip/cancel/failure. Parent "launcher Insert receipt holds 20/20 under parallel load" passes 6.892762309 seconds. Children range 0.630273971–0.776819578 seconds. Matching start/finish records prove pair overlap in all ten batches: 661/633/627/647/687/644/640/736/658/774 ms. Diagnostic confirms "20/20 launcher cases passed in batches of 2; 40 native TextChangedI model-input receipts".

Accepted shared source arms native TextChangedI before launcher keys and requires exact name=models, role=reviewer, model=custom-model, row=4, mode=i under its separate 5-second completion bound. Every child's two error/empty paths retain rendered reason, absent popup, retained free text and exact outbound session.launch.model assertions. Parent counts twenty completed cases and forty returned receipts only after those assertions. Forty receipts are asserted native completions in the passing cases, not forty independently printed payload records or a timing/presence proxy. One mapped T4 base execution supplies twenty internal independent clients in pairs; no extra T4 load repetitions.

Ordinary T2 exact case "failed or empty model answers keep free text with a one-line reason" passes 0.463652518 seconds, below its unchanged 2-second budget. The reviewed 11-second exact dated E-1282 allowance admits aggregate T4 cost without relaxing any native receipt deadline, case count, assertion, ownership or concurrency. The separate generic new-identity gate remains enforced despite absent T4 tier budget; the report-only >5-second notice does not negate the accepted allowance.

## Scope and provenance

Parsed unique finish records excluding file containers: 3161 ordinary passing test outcomes, zero additional load-gate outcomes and no failed/cancelled/skipped/todo cases. The twenty children are included in ordinary accounting, not twenty new suite reruns.

T0 host check exit 0 / 28.198s; all T1 exit 0 / 60s; fallback all hub and Neovim T2 exit 0 / 331s; mapped T4 exit 0 / 12s; Web exit 0 / 140s. T4 parent 6.892762309s, file 7.027285679s, selected added wall 7.173s excluding machine wait and runner suite 7.21s remain distinct from phase and whole-run machine lifetime. Remaining T3 is deferred to periodic/integrated occasions and absent configured batch tiers; other T4 files did not run. This is not an all-tier, stage or provider QA result.

Fresh executed Linux x64 6.8.0-142-generic droplet c-8 lon1 cland-v0-bc2fe848, Node 24.21.0 / Neovim 0.12.5, overall workers 2; Web internally uses 4. Machine lifetime 636s and provider cost $0.0442 are not suite wall. Original log prepares isolated Chrome Headless Shell 156.0.8078.4 / Playwright chromium-headless-shell v1248 from linux64 into /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248 and records fixture cleanup censuses. No human browser used by Reviewer.

Typecheck host gate at ef22a24d27f5c20d11af80f2fc11bdf42a2a66b2 was reused after source comparison, not remotely repeated; this is gate.tree attribution, not an alternate candidate source commit. Accepted original local checks retain their source and capture limits.

Test lint 133 findings / 60 files, ordinary duration/Web wall and T3 ratchet diagnostics remain report-only. Three missing baselines: dependency-install, install-claims, launcher-input-load. Five summarized budget warnings and actual Web phase wall 136.622s versus 40s are not budget passes. T3 ratchet 2209.786s unchanged. No missing or projected measurement becomes zero or executed evidence.

## Disposition

Final CLEAR, C1 verified, findings empty. Old 69adb5aa/A-11758 remains failed overall on its generic duration gate despite passing behavior; 7016939b/A-11767 remains failed HEAD-changed bundling with no runtime proof. Neither substitutes for this same-head successful execution. No further ref changes, dev merge, stress invocation or repetition requested. Coordinator owns enqueue after the lead's fresh conflict check. QA none/after-stage. Reviewer inspected only immutable source, retained logs and metadata; no tests, browser, fetch, process or Git mutation.
Durable final review: A-11792.

Criteria: C1 verified.

### coord · 2026-10-25T11:24:26.258Z

Merged ff73a3d057029f50e133b66272ffa04ccd34cd36 onto dev.
