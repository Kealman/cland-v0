# hub/test/suite-human-queue.test.ts

T-444: test `waitForHumanSlot` at T1 with counted fake hub replies and an injected
clock/wait. Keep the request-spacing assertions and the admitted result/locks:
releases just before, on and after poll boundaries must be admitted within two
simulated seconds, including after a five-minute wait. Bound simulated time and
request count so broken retry loops fail without real sleeps, sockets or Git.
The package runner uses the same helper on its existing connection; process and
lease ownership remain covered by `hub/test/suite-human.test.ts` at T3.
