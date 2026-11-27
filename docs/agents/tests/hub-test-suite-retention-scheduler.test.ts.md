# hub/test/suite-retention-scheduler.test.ts

Actual scheduler callbacks run on owned SQLite and filesystem fixtures behind
the shared counted native guard. Two eligible candidates beside 2,048 unrelated
artifact rows require two indexed title lookups and never artifactIndex.
The admitted owner records durationMs from pass admission through joined IO,
on both complete and incomplete reports; the marker precedes the work. This
does not include startup, queue wait or fixture setup/cleanup.
The close rejection case holds an admitted artifact lookup, injects an earlier
cleanup rejection, and observes close only after the held filesystem owner joins.
All roots, callback continuations and seams belong to retentionCase, which keeps
the shared launch guard and filesystem seams until positive resource closure.

The idle-scheduler case uses a fake clock and a one-entry configured pass cap.
It observes complete pass receipts and native directory state through indexed
backlog removal and directory EOF without launching more suites. It checks the
persisted progress through the heartbeat digest. The held-filesystem close case
also checks exclusion of repeated triggers and fake-clock advances, and no
further admission after close. Bounds use work counts, not elapsed time.
Complete seeded setup has its own named observation bound inside the existing
whole-case owner. Setup and asynchronous pass/close observations sample
`testSetupWaitMs()` per operation; cleanup keeps a shared load-scaled bound.
The production cadence remains exact fake-clock time.
