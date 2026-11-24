# hub/test/remote-scripted.test.ts

Use the existing sealed remote fixture with an in-process fake provider,
scripted transport and shared FakeClock. The acquire/deliver/start/collect test
appends a local delivery attempt before the delivered receipt. Wait for the
durable suite report, then assert both the local attempt and the complete remote
test census in the log. This proves remote byte zero starts after local delivery
writes; the previous checkpoint skipped remote bytes and lost the census.
No SSH, provider network, worker process or browser runs in these cases.

The orchestration case observes the exact `suite:<run-id>` message receipt with
the UI client's shared per-operation load-scaled setup default. Its fixture
control rejects an explicit timeout override, so restoring the former 15000 ms
bound fails deterministically before waiting. Keep the start receipt before
advancing the fake execution clock and retain the final report assertions.

The red/lost/slow case drives direct executor operations through `remote-clock`
and tracks native publications. The fixture hub's startup sweep may hold the
sealed spend ledger lock during acquisition: a retry requests fake time and
cannot complete under a bare await. Semantic machine-start and report waits also
drive requested delays. The 384-byte case holds the sealed ledger after the
initial sweep's persisted receipt, arms the retry observer before submission and
releases the holder after the retry request, making this regression deterministic.

`scriptedCase` uses `stageCase` and fenced registered cleanup. Named operation
observations have five-second bounds. A rejected close retains the remaining
roots, native guard and seams until the same registered cleanup succeeds. Each
injected native database is owned before Tracker or Store construction continues;
fallback native close follows the fixture hub's registered stop and precedes root
removal. The controls reject registered resource cleanup and each constructor's
native database close, then repair through that owner and observe closed databases,
removed roots and restored seams. No settled rejection counts as closure.

Caller-owned executor close and held ledger release use `ownResource`, registered
in that fenced owner's resource phase, before its directory phase. Early abort
starts and retains the same close promise. A rejected promise must reach the
registered owner before it is cleared for retry; an absent, not-yet-acquired
resource cannot cache a successful close for a later acquisition. Held/rejected
executor and ledger controls exercise this order through actual cleanup, then
confirm native completion before roots disappear and seams restore.

Keep every outcome, report cap/cache, log-offset and release assertion. Reproduce
suite timing beside `remote-cli.test.ts` with two test workers; load-gate all five
original identities for five repetitions. The helper's new optional `openDatabase`
input is used only by this file; other remote-fixture callers retain their default.
