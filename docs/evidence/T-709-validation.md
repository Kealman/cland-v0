# T-709 corrected-head Mac validation

After the admission correction: 27 whole files × 5 serial runs = 135 accepted invocations, 1300 passing tests, zero failures/cancellations/skips. Peak sampled one-minute load 4.555 < 15. The validation driver checks read-only admission before each file; no override was used.

Typecheck, tier lint and test lint pass. No existing tier tags, duration allowances or quarantines changed.

| File | Runs | Passes | Seconds (min–max) | Peak 1m load |
| --- | --- | --- | --- | --- |
| hub/test/account-fixture-env.test.ts | 5/5 | 15 | 0.259–0.267 | 3.554 |
| hub/test/account-fixture-isolation.test.ts | 5/5 | 5 | 2.394–2.866 | 4.127 |
| hub/test/cli-identity.test.ts | 5/5 | 30 | 13.821–14.240 | 3.735 |
| hub/test/clock.test.ts | 5/5 | 35 | 0.099–0.102 | 3.735 |
| hub/test/cover-quiet.test.ts | 5/5 | 70 | 5.970–6.219 | 3.934 |
| hub/test/harness-import.test.ts | 5/5 | 5 | 0.254–0.279 | 3.554 |
| hub/test/nvim-fixture-boundary.test.ts | 5/5 | 15 | 0.134–0.156 | 4.095 |
| hub/test/project-probes.test.ts | 5/5 | 10 | 0.374–0.754 | 2.906 |
| hub/test/suite-selection.test.ts | 5/5 | 470 | 21.502–22.085 | 4.377 |
| hub/test/test-admission-outcome.test.ts | 5/5 | 10 | 0.171–0.180 | 3.735 |
| hub/test/test-admission.test.ts | 5/5 | 10 | 0.105–0.355 | 3.735 |
| hub/test/tier-tripwire-runner.test.ts | 5/5 | 85 | 17.573–18.602 | 4.377 |
| nvim/test/account-poll.test.ts | 5/5 | 5 | 0.307–0.456 | 3.111 |
| nvim/test/client.test.ts | 5/5 | 30 | 8.815–9.102 | 4.334 |
| nvim/test/events.test.ts | 5/5 | 20 | 1.887–2.095 | 3.253 |
| nvim/test/explorer-summary.test.ts | 5/5 | 5 | 0.146–0.189 | 3.253 |
| nvim/test/graph.test.ts | 5/5 | 85 | 4.197–4.317 | 3.909 |
| nvim/test/inbox-actions.test.ts | 5/5 | 20 | 1.662–1.943 | 3.883 |
| nvim/test/inbox-sections.test.ts | 5/5 | 15 | 5.838–5.930 | 3.883 |
| nvim/test/layers.test.ts | 5/5 | 70 | 5.296–5.508 | 4.067 |
| nvim/test/qa.test.ts | 5/5 | 115 | 17.719–18.146 | 4.214 |
| nvim/test/scenarios/workbench.test.ts | 5/5 | 30 | 1.644–1.944 | 4.095 |
| nvim/test/session-archive.test.ts | 5/5 | 10 | 0.802–0.889 | 3.884 |
| nvim/test/session-resume.test.ts | 5/5 | 5 | 0.589–0.630 | 4.213 |
| nvim/test/vboard.test.ts | 5/5 | 120 | 6.243–6.479 | 4.213 |
| nvim/test/verification-queue.test.ts | 5/5 | 5 | 0.371–0.475 | 4.516 |
| nvim/test/verification-view.test.ts | 5/5 | 5 | 6.241–6.431 | 4.555 |

## Admission correction

A-4996 identified loss of cover-quiet admission in the new Neovim fixture. The Coordinator authorized one dev merge after T-747 landed; 2ebc5bbe preserves its first-statement native account admission. The correction extracts the existing policy, read-only discovery and one-request transport into neutral modules. Production compatibility exports preserve the clock and timeout identities. Cached Neovim admission returns a fresh caller-owned async promise. Both tempProject and createClient guard before allocation/spawn.

The complete cover-quiet file preserves T-747’s actual-entry default/stub controls and adds direct Neovim-owned tempProject/stub-client refusal controls. Both assert nonzero, the cover-quiet reason, no target marker and an empty scratch parent. The full tripwire-runner file passes all five times, retaining the caller-attribution controls.

The T1 boundary remains empty over all 11 T2 files and their neutral dependencies. Selection follows neutral helpers transitively, detects a planted hub import and keeps full package selection on shared helper changes. The updated last-40-landing replay still selects zero T2 files through nvim test import.

## Earlier feature evidence

A-4995 remains the durable complete bundle for the actual production prefix mutation/rewrite/restoration proof, arbitrary QA route red/green proof and all 17 existing T3 consumers. A-4996 independently inspected those proofs and all 256 unchanged T2 assertions. Those feature implementations are unchanged by the correction; current workbench and QA files also pass five times here.

<!-- cland-allow-closed-wording: historical evidence records review still pending at that head -->
See T-709-admission-audit.md for nine mechanical extraction comparisons. Source re-review and exact-reviewed-head droplet verification remain pending.

## Source carrier follow-up

Review A-5010 resolved admission M1 and identified three fixed-root carriers omitted by the extraction. Their correction changes only source fixture/archive assembly. A-5011 contains complete additional coverage/typecheck test files × 5 runs (15 passing tests), plus modern and pre-extraction archived selectors each 5/5. Both extracted roots are copied and committed in compiler fixtures; replay archives only roots present in its requested historical ref. All existing coverage/compiler assertions remain unchanged. Current T0 checks pass; peak 1m load 4.367 < 15. See T-709-source-carrier-audit.md. The 27-file runtime proof above remains unchanged; fresh source re-review precedes verification.

## Authorized T-708/T-767 integration

See T-709-integration.md: merge5cfc492a preserves minimal compiler timing and both tier entries. Six compiler/Neovim boundary files pass5/5 (235tests,0fail/skip), plus all T0 checks; exact40 replay refreshed at5f8d274a. Prior dropletA-5045 is green; a fresh reviewed-head droplet is required after this authorized merge.

## Authorized T-684 integration

<!-- cland-allow-closed-wording: historical integration evidence; until.ts is a filename -->
See T-709-lint-integration.md: merge723daf59 keeps until.ts/neutral roots and both package scripts. Fetched-origin lint gate and shrink pass; generated baseline5e6e612e adds a zero-debt T1 entry, with total524 allowances unchanged. Seven files5/5 (245passes,0fail/skip), peak1m7.949<15; typecheck/tiers pass; exact40 replay refreshed atb27f71f4. Prior-head A-5059 is green. Delta source review and a fresh exact-head droplet remain required.

## Owned replay cancellation correction

A-5083 cancelled the full-inbox case at 5629976a; A-5084 marked C4 failed. See T-709-replay-runtime-correction.md for the confirmed timestamp-equality and unobserved peer-close causes, red-first regressions and correction. Refreshed ordinary replay passes all 12 T2 files and four boundary/QA files 5/5, plus the other 16 consumers once: 96 serial whole-file invocations, 804 passes, zero failure/cancellation/skip, peak one-minute load 6.941. All 256 original assertions remain unchanged; the exact40 replay at a08e40ec still reports zero import-decided T2 selections. The actual hub-prefix drift/rewrite proof remains red-capable. New source review and an exact-head droplet are required; prior green receipts do not clear this correction.
