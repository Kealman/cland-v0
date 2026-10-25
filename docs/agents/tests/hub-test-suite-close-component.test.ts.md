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
