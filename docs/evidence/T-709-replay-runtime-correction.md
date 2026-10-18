# T-709 replay timestamp and control-close correction

Delta from reviewed source 5629976a, following owned cancellation A-5083 and runtime verdict A-5084. Coordinator 373d88d3 approved this correction. No further dev merge was taken: the fetched-origin lint gate passes without one. Source re-review precedes a fresh exact-head droplet; the announced hub-restart submission hold remains in force.

## Cause and red controls

The original full-inbox case passes on this Mac with ordinary clock timing. Forcing only its input timestamp calls onto distinct millisecond ticks reproduces the cancellation within a diagnostic 12-second bound, while the ordinary control passes in 0.666 seconds. A minimized captured input changes one request's `since` timestamp by one millisecond and loses the replay key. The missing operation is `frame`, request `inbox`, key `0c63d2a9fc2ca6147d43b8e2971701c49807a3a30b0119a0deb7d9addbc8f6b1`.

Timestamp canonicalization reused a binding when two timestamp strings happened to be equal. Clock coincidences therefore changed the shape of the recording key. The uncaught projection error then killed the control peer before acknowledgement. The caller's control Promise observed errors and data, but ignored a clean peer close, leaving the test waiting until the suite's 120-second cancellation. Neither a missing ask/command expansion recording nor the RPC client's existing close handling caused this wait.

Regressions were run red before their fixes: the canonicalization control fails on coincident versus adjacent input timestamps; the actual socket exchange cancels when a peer closes without replying and fails to reject a refused reply; the actual stub integration fails its subsequent request because the projection error kills the peer. The diagnostic bound is confined to the throwaway reproducer. No committed test timeout or duration allowance changed.

## Correction

Timestamp bindings now allocate a stable slot per occurrence, retaining each original wire timestamp on restoration and the existing seven-day age classification. UUID identity reuse remains unchanged. The full fixture refresh runs the existing consumers against hub-owned producers and commits their recordings: 4464 frames, with 321 passes across 29 whole-file consumers plus the live recorder check, no failure, cancellation or skip.

An unmatched replay names its operation, protocol request and recording key. The Neovim-owned control exchange handles complete newline-delimited replies, explicit refusals and peer end/close. The stub reports a projection failure without requiring another recording and keeps its control peer available. A new in-process T2 socket test covers close, refusal and fragmented successful replies; the existing inbox file adds an actual-client rejection/recovery control. These add no hub runtime import, wall-clock wait or process helper.

Ordinary replay, with no recorder hook or hub producer, passes the original full-inbox case 5/5 with coincident timestamp calls and 5/5 with distinct ticks. The refreshed corpus still fails on the actual planted production-prefix change, passes after the maintenance rewrite and passes after exact restoration of source and both fixture files.

## Assertions and selection

An AST audit against task starting HEAD 29ba661e confirms all 256 original assertion calls across the original 11 T2 files remain byte-identical and in their original order. The inbox helper now rejects incomplete/refused exchanges; its original screen, row and request-count assertions remain unchanged. Two assertions are appended to that file, and three new socket controls occupy their own T2 file. No existing title, expectation, input table or age assertion was removed or weakened.

The current manifest has 12 T2 files, all with an empty runtime hub import closure. The exact last-40-landing replay at origin/dev a08e40ec reports zero T2 selections decided by `nvim test import`. Shared-contract and infrastructure package selection remains intact. The test-lint baseline adds only an empty entry for the new zero-debt socket test; total existing allowances remain 524. No quarantine, process-lifecycle classification or duration allowance changed.

## Whole-file validation

All 12 T2 files, the hub fixture boundary, tripwire runner, workbench recorder and QA CLI pass 5/5 serially: 16 files, 80 invocations and 570 passes. Each of the other 16 existing stub consumers also passes once through ordinary replay, adding 234 passes. Total: 32 files, 96 invocations, 804 passes, zero failures, cancellations or skips. Every invocation runs one complete file with no test-name filter or diagnostic preload; admission is checked before each file and sampled one-minute load peaks at 6.941, below 15.

Typecheck, test:tiers, test:lint and baseline shrink pass. After the complete runtime checks, origin is fetched again and the gated lint check passes without a dev merge. The baseline adds only the empty socket-test entry; debt remains 524.

The evidence bundle retains each whole-file receipt, sampled loads, the refreshed maintenance run, original red regressions, ordinary replay under both clock patterns, the actual production-prefix mutation/rewrite/restoration sequence and the complete assertion/selection audits. Prior source-carrier and admission proofs remain recorded in their separate audits; this correction changes neither seam. Delta source review and a new exact-head droplet receipt remain required.

Durable bundle: A-5093, `/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5093-t-709-replay-timestamp-and-peer-close-correction-red-green-and-96-whole-file-run` (entry README.md).
