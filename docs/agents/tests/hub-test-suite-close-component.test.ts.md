# hub/test/suite-close-component.test.ts

T-1029: execute two scripted Linux shards through the production scheduler, wait
for the parent result and drain verification work before stopping the first
`projectHub`. Start a second hub with the same owned provider and clock; its first
stage submission must reuse the original run, count Linux in the result, and
create no replacement droplets. This is T2: no worker process, real provider or
browser runs. Do not replace completion with seeded successful parent fields.
Post-restart plan and QA currency use the held-tree case in
`stage-closure-component.test.ts`, which keeps the older receipt shape covered.

Cancellation during a held provider-size reply keeps the original no-result,
cancelled, zero-spend and no-provider-create assertions. Finish the initial
executor sweep through its flushed journal receipt and defer periodic sweeps;
then hold the scratch spend lock as the provider reply resumes, observe the
scripted retry and release that holder. Join submission with `drive(f,
submission)`: shard ledger contention now uses the injected fake clock/wait,
so a raw promise await leaves the retry asleep until the client times out.
Register holder release before resuming the provider and drain the fixture
before removing its directories. This pins contention without real time or
deliberate machine load.

T-1434: the batch sharding fallback pins contention at its own scratch spend
ledger after observing the initial executor-sweep journal receipt. Periodic
sweeps are deferred so the regression owns the contending writer. Arm the retry
observer before submission, release the holder after the reservation requests
its retry, then join `drive(f, submission)`. Keep the native machine-start,
durably-running state, warning severity/count, whole-run result and provider
cleanup assertions. A plain submission await strands the injected 25 ms retry
even after the lock is released and hits the frame client's 5 s deadline; a
larger wall deadline cannot advance that clock. Fixture acquisition has a named deadline; retry setup has its own 2 s bound.
Register the submission owner before `caseDeadlines` and fixture creation, so
its disposer runs before pending fixture drainage. The owner catches the
submission immediately, releases any acquired holder, cancels/joins observation,
drives/joins submission and native verification work before storage cleanup.
The omitted and aborted observation controls use that same owner and prove
lock removal, zero pending retries, durable running state, final successful
result and provider deletion. Keep every other normal scripted submission in
this file inside `drive`; deliberately held cancellation submissions release
at their existing boundary before driving. `suiteUnit.launch` already drives;
native integrated fixtures use real retries, and executor-admission-lock's
shutdown controls intentionally observe a held planner through persisted jobs.

The seven landings between 60ad6021 and 2a0f4c43 did not change this test, its
remote fixture/clock, the scheduler, or the droplet/spend implementation. Added
remote tests/imports change scheduling opportunities; they do not share the
fixture's private ledger. Do not attribute the timeout to a particular remote
landing without a receipt identifying it. Reproduce the contended boundary
rather than depending on a full-suite startup/sweep interleaving.
