# hub/test/suite-accounting.test.ts

The unconfirmed-acquisition case enters its guarded caller owner before setup.
The fallback observer is installed by `suiteUnit` before submission; bounded
producer settlement precedes explicit notice assertions, so a missing notice
fails instead of leaving an unbounded waiter. It retains both budget assertions,
the later sweep's provider-absence receipt and cancellation/report receipts.
Already-releasing resources stay with reconciliation; replacement must not
swallow the acquisition owner's fallback notice or allocate another machine.

The parallel-acquire control reads pending reservations with the shared validated
hasUnknownSpend policy: terminal unknown cost:null rows are distinct from pending
reservations. Two refused peers retain their bound unknown receipts, and a later
fresh acquisition must still see exactly one pending reservation of 0.0625.
The provider hook's assertion must not enroll the retained unknown rows. The
fake API currently converts a rejected hook into a 500; T-1994 tracks preserving
that original fixture failure instead of leaving a status waiter unresolved.

The failed-acquisition control rejects scripted readiness after durable admission
and completes provider cleanup. Suites retains the same released lease identity
and cost even though the hot index has removed it; no historical scan supplies
that handoff. Both provider absence and the persisted job lease are asserted.
Its caseDeadlines owner is enrolled before acquisition, separately bounds fixture
setup, adopts the root, fences later caller steps and joins them before cleanup.

The unfinished-coverage matrix reproduces a persisted running/outcome-null job
with a green native result, surviving log, partial temporary coverage map and
no final map. A failed fake collection triggers a provider read by captured id.
Absent inventory checkpoints an incomplete scheduler outcome while retaining
the original result bytes and native exit zero. Present and failed-read controls
retain capacity. Another restart neither recollects coverage nor republishes.
The map is never parsed; a collection-attempt count bounds that work. A positive
release-cover control then proves the incomplete outcome cannot supply the gate;
cache and derived cover remain unavailable. The separate suite-protocol case
checks the actual posted message includes the incomplete cause verbatim.
The matrix includes both a surviving and a missing local log with the same
green native result. Missing-log recovery confirms provider absence before
creating a diagnostic mirror; present and unknown inventory retain capacity.
Each new case uses caseDeadlines.run before fixture acquisition and steps fence
later awaited operations; whole continuations join before captured teardown.

The running-remote recovery matrix deletes local collection files from a
persisted running job and restarts the scheduler. Production DropletRun status
reads the fake provider by the captured machine id; transport execution is an
in-memory rejection. Provider-confirmed absence releases capacity, checkpoints
reported completion, records the machine name in the reconstructed log and
publishes once across another restart. A successor acquires the sole slot.
Present and failed-read inventory controls retain the original slot and publish
nothing. No provider network, SSH, worker or browser is used. Fake-clock ticks
drive inspection; each case has a separate ten-second failure bound.

The C1 executor isolation regression uses `suiteUnit` with real accounting and a
partial `options.env` and explicit hostile path overlays. Set ambient HOME, XDG state and the executor override to a
hostile scratch machine, seed both primary and legacy ledgers, and snapshot that
HOME before and after a completed executor run. Observe actual fixture ledger
entries before stopping its writers and removing it. The hostile HOME snapshot
and inherited override stay unchanged. Never run the proof against real HOME.

`suiteUnit` layers partial environment extras into `fixtureEnvironment` and passes
that sealed environment after the final options spread. XDG extras are filtered
before construction so every XDG path stays fixture-owned, including explicit
overlays; HOME/Git are reset by the builder and executor state is fixed here.
Its injected provider is
reintroduced through `syntheticProviderEnvironment`; native provider/account
variables remain filtered. Reopening uses the same seal.
