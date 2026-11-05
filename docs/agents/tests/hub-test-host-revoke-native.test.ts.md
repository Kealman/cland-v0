# hub/test/host-revoke-native.test.ts

T3 uses the production Claude, Codex and OpenCode adapters on fake SSH/agent
infrastructure. Claude and OpenCode use their native fakes; Codex uses a native
worker and scripted RPC at the existing adapter connection seam. It checks
live identity receipts, actual private files, a durably released Claude receipt
whose deletion was interrupted, native worker exits, absent generation files,
and no requests through the revoked SSH Host. Fixture owners drain every writer
before root removal. Run under the stage-5 preservation lock, sequentially.

T-1678 owns the observed close-after-turn refusal. Setup joins native turn-end
hook writers using the existing Claude fixture observer before the stop; the
failed variant and timings are retained in artifact A-16592. Cleanup assertions
remain unchanged.

The native fixture also normally stops an earlier OpenCode generation, confirms
its config/password remain for resume, and requires both files absent at revoke.
The stage-5 shared T-1678 fix supplies root-first bounded native stop.

T-1678 correction: a pre-delivery count arms each fresh session.measure completion
wait; stale launch-time matches cannot settle the turn. The fixture then joins
all turn-end hook writers before the retained-generation stop or revoke.


OpenCode metadata-release failures retain bounded, shared-redacted producer
messages in the final assertion diagnostic. The fake host's short ancestor
alias exercises launch-captured canonical private-directory ownership; final
file-removal assertions remain unchanged.

T-1685 migrates the revoke frame wait to `HOST_SETTLEMENT_MS + 3000`,
matching the CLI. The whole-test timeout adds a named `testWaitMs(45000)` setup/teardown
budget to that frame wait (60 seconds at the 12-second settlement cap with the default45 s fallback;
`CLAND_TEST_WAIT_MS` overrides setup only). All
native, private-file, receipt and post-cut assertions remain unchanged. The
sampled duration allowance is separate and must stay below the whole-test timeout.
