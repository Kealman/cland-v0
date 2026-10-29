# hub/test/suite-candidate.test.ts

The local candidate barrier uses `fakes/finish-poller.ts` with a five-minute
exit-124 backstop. Teardown stops owned writers and checks an empty native cwd
census before directory removal. The independent short-bound exit regression
lives in executor-safety.test.ts; this file uses a local suite, not a droplet.
