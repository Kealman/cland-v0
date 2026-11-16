# hub/test/executor-admission.test.ts

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
disposal runs inside the joined sequence with attempt-all cleanup; failed cleanup
or an incomplete join retains the root. A held filesystem write control closes
the fixture during admitted work and proves the write completes before disposal,
the next step is fenced, and the root is removed only after the join.
Malformed create success is non-capacity, sends no next create and retains the
ambiguous lease/spend fence rather than inventing a refusal.
