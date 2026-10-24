# hub/test/suite-runner.test.ts

This T3 file owns native runner lifecycle checks: lock ownership, interruption,
stale-process recovery, bundle prerequisites and Web repetition child cleanup.
The process boundary is necessary to observe actual child exits and owned
resources; pure selection and summary rules belong in `web-phase.test.ts`.

The T-1200 Web repetition contract creates a disposable directory with a new
synthetic `web/test/new.test.ts` and an explicit host-admitted repetition list.
It calls the real repetition launcher, which starts ten fresh file processes in
two sequential lanes of five. This synthetic file proves admission and lifecycle
behavior; it is not a real-browser load soak or an ordinary Web timing sample.
The runner does no Git lookup; T1 owns host merge-base selection and the
populated/empty/absent-list distinction. The native fixture needs no Git project.

Run this file through queued `cland verify` while the runner holds its machine
lease. Its deliberate CPU load must not run as an unleased targeted local
probe. The owning item lead requests source review before verification and
receives the exact-head receipt in the item topic; no per-item QA is required
unless the item policy or a supplied brief says otherwise.

Each repetition owns a separate directory, HOME, XDG/Git configuration and
credential-filtered launch environment. The child bootstrap waits at a gate
until its process identity is registered. Setup separately observes the owned
CPU worker's ready message with a five-second bound. Passing repetition proof
requires CPU progress across the child run, a still-live load worker, exit zero
and one typed terminal Node summary: positive passing count and no failure,
cancellation, skip or todo. Missing, torn or multiple summaries supply no proof.

Keep the final assertions: the launcher reports exactly `10/10 passed`, two
workers and ten attempts; all ten distinct repetition directories retain a
complete terminal summary; the active child-identity set is empty. These are
completion receipts, not launch acknowledgements. Native children have bounded
timeouts, and `finally` observes owned-process cleanup and child `close` before
dropping the identity. The load worker is terminated and its exit observed before
the launcher returns. Fixture removal follows that cleanup, after every writer
has stopped.

The new-file admission check starts in report mode. Its count and missing-proof
diagnostics are separate from the normal Web phase and its wall budget, and use
the existing load-worker summary prefix for running-hub compatibility. A failed
synthetic contract remains an ordinary T3 test failure. See
[Web phase](../tests.md#web-phase) for admission selection and rollout behavior.
