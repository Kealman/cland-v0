# hub/test/qa-demo-policy.test.ts

`hub/test/qa-demo-policy.test.ts` is T1 at the pure recorder policy seam. Missing expected facts and recorded step errors each had a failing control before the gate; the secret scanner has a positive control built from obviously fake values at runtime and asserts value-free diagnostics. No process, socket or browser is required.

Run it as one targeted file. `hub/test/skills-qa.test.ts` owns the T2 persisted-recorder boundary; unchanged `hub/test/demo.test.ts` owns real remote execution, accounting and recovery at T3.
