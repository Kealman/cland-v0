# hub/test/suite-retention-scale.test.ts

T4 creates 50,000 directory entries in one owned pass, with one shared durable
artifact and a retained-run marker. There is no per-run file or fsync loop. The
test exercises report-only classification, exact kept/would-retire counts,
zero deletions and idempotence. Its second case runs actual scheduler callbacks
beside 50,000 artifact records, rejects full artifact-index reads and counts
indexed lookups. Both retain the positive task.view receipt and 1000 ms bound
while work remains active. Whole callbacks, acquisitions and seams use the shared
guarded owner. Guarded fixture deletion and map recovery are component cases.
It needs the Coordinator's native slot on
the shared machine. Its 50,000-directory root uses named largeRootTeardownMs,
the shared waitTimeoutMs(testWaitMs(120_000)) load-scaled owned
teardown bound because native recursive removal exceeds the shared owner's
ordinary 5 s bound; this does not detach cleanup or change other callers.
Do not run it on the live `.cland/run` tree. Run with
`node --test hub/test/suite-retention-scale.test.ts`.
