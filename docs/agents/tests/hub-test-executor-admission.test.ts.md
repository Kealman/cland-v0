# hub/test/executor-admission.test.ts

Submission probes use the scripted provider with a positively controlled native
launch guard. Verify unavailable-region names, a skipped-region reason while
another remains available, API-failure guidance, and zero provider mutations.
Their caller owner precedes guard setup. Regional setup has named bounds and
uses the executor's no-spend `checkReachability` boundary. Remote-required
submission adds `checkSpend`; both use the same availability probe. Policy-only
executor fakes must cover both boundaries rather than reaching the provider.
Regional setup composes its normal step fence with the caller's fence. The allocation-cap case
uses the real allocator with the scripted host/provider, advances the shared
clock two minutes, and observes the unchanged original deadline in the persisted
lease and watchdog input. Spend reserves the remaining thirteen minutes of a
fifteen-minute lifetime, rather than allocating another full lifetime.

T1 uses scratch storage and the scripted DigitalOcean provider, host and machine;
it starts no native child and makes no network call. Regional create cases use
the normal paced API path with per-region synthetic refusals. They prove ordered
fallback and run-log diagnostics, an aggregate provider-capacity refusal after
exhaustion, confirmed lease/key cleanup and zero reserved spend. Neighbouring
400/422 refusals stop after one create; a 500 retains the existing ambiguous
create and spend fence. Fake-clock delays cover cleanup without wall-clock sleeps.

The regional fixture registers its work owner before directory acquisition,
tracks setup and the complete test sequence through `fixtureWork`, fences every
new asynchronous step, and joins it before directory removal. Provider/executor
disposal follows the joined sequence and retained caller setup operations with
attempt-all cleanup; late directory/provider results are captured inside their
original setup operations before a raced bound can discard their return value. Failed cleanup
or an incomplete join retains the root. A held filesystem write control closes
the fixture during admitted work and proves the write completes before disposal,
the next step is fenced, and the root is removed only after the join.
Malformed create success is non-capacity, sends no next create and retains the
ambiguous lease/spend fence rather than inventing a refusal.
