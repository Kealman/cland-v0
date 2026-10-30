# hub/test/session-retry.test.ts

T2 composes `caseDeadlines` before root acquisition and `claudeComponentOwner`
before hub/UI/spoke acquisition. It uses a disposable projectHub, fake Claude
harness, in-process spoke, FakeClock for policy age, and the shared sealed `cland`
CLI launcher. Setup has a separate bound from CLI results and injection receipts.
The component owner drains late acquisitions and frame observations before hub
and root disposal; its directory guard retains the root on incomplete drainage. It starts no real
harness or browser. Run `node --test hub/test/session-retry.test.ts` alone.

Keep explicit-id fresh-queued refusal and injected-stage refusal, plus the
message-less native CLI invocation. Arm the exact injected delivery observer
before invoking retry, and retain the final one-injection assertion. This covers
CLI parsing, frame validation, busy bypass, acknowledgement and native fake
confirmation; it excludes real bridge/harness latency. The memory controls in
`human-hold.test.ts` cover the exact age boundary and attempted-unconfirmed fence.


The shared owner's missing/aborted setup controls live in
`hub/test/claude-component-fixture.test.ts`; run that file unchanged when this
composition changes. Keep `owner.frame` admission before invoking the CLI so a
failed CLI assertion still leaves the observation owned through teardown. Do not
replace the owner with local timeout races.
