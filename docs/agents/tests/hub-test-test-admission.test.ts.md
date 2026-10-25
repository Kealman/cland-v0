# hub/test/test-admission.test.ts

T2 uses the public `assertTestAdmission` client, authenticated socket frames,
`projectHub`, in-process spokes and `FakeClock`. The planted compatibility owner
is an injected fact, never a lock on the shared machine. The refusal registers
before the CLI socket closes. Restart the in-process hub while that owner still
holds capacity; arm the UI and spoke observers before releasing it. Assert the
exact durable report id at the spoke, its single recipient and one history row
after repeated refusals/ticks. A later cover must register a new notice.

The previous-hub regression retains the old refusal string and result shape;
the current client still fails closed. Silent/busy hub deadlines retain their
separate fake-clock tests. No package worker, real harness, browser or full-suite
lease is needed. Run this file alone with
`node --test hub/test/test-admission.test.ts`, subject to live cover-quiet admission.
