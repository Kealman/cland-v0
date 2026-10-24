# hub/test/spoke-artifact-budget.test.ts

The spoke's `artifact.create` reply budget is 120 s; `artifact.list` retains the
ordinary 10 s. This is separate from the outer harness/MCP deadline, which may
expire earlier; a caller using the full creation budget must allow more than
120 s, plus up to 20 s of readiness and transport overhead. Neither timeout
cancels the hub's copy. After a timeout, inspect the destination topic with
`artifact.list` before retrying to avoid a duplicate publication. See
[Spoke readiness and deadlines](../../../hub/README.md#spoke-readiness-and-deadlines).
`spoke-artifact-budget.test.ts` tests these reply boundaries with `FakeClock`
and a slow fake hub. Its setup, result receipts and teardown have separate
failure bounds. After a late result, it waits for an acknowledgement of the
next frame on that ordered WebSocket before asserting no duplicate request;
advancing virtual time alone is not evidence that real socket I/O completed.
