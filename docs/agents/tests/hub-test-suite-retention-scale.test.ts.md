# hub/test/suite-retention-scale.test.ts

The live unindexed case uses the actual projectHub serving owner on 50,000 aged
directories. Observers precede startup. A positive removal receipt starts the
task.view measurement (<1000 ms); the full pass records its own durationMs,
4096 visited/4093 removed roots and zero removed files. Pin, young-root and
fresh-descendant controls remain. Startup/setup/cleanup are excluded from pass
duration and included in the separately reported case/file wall. All original
work and stop promises join before root/guard cleanup. Native slot required.
The separate named `live unindexed setup` deadline encloses root acquisition,
seeding, controls/pinning, hub startup, UI connection and task creation. It uses
the shared load-scaled 120 s wait bound. Seeding yields through setImmediate
and checks FixtureStep admission again before each batch of at most 32 roots;
an expired setup cannot admit the next batch. The original setup remains owned
and joined before resources/root/guard release, independently of the later
first-removal and pass-completion waits. Final behaviour assertions stay intact.

The live replacement covers one full 4096-candidate pass over 50,000 owned
directories, records wall time and removal count, and requires task.view
within 1000 ms while removal is active. Setup is excluded from that latency.
Five visited candidates exercise reference, missing-artifact, pin and age-floor
protection, so exactly 4091 directories retire; those directories contain no
files, making their actual file-removal count zero. The seven-day floor applies
to completion timestamps, with the same real clock used for fixture ages.
Its E-880 allowance expires 2026-11-26 alongside the other temporary allowances.

T4 setup creates directory-only roots with retained markers; production
retirement exercises its real batch durability and removal IO. The indexed
case uses a shared durable artifact and exact kept/removed counts. The artifact
scale case runs actual scheduler callbacks beside 50,000 artifact records,
rejects full artifact-index reads and counts indexed lookups. All cases retain
the positive task.view receipt and 1000 ms bound
while work remains active. Whole callbacks, acquisitions and seams use the shared
guarded owner. Guarded fixture deletion and map recovery are component cases.
It needs the Coordinator's native slot on
the shared machine. Its 50,000-directory root uses named largeRootTeardownMs,
the shared waitTimeoutMs(testWaitMs(120_000)) load-scaled owned
teardown bound because native recursive removal exceeds the shared owner's
ordinary 5 s bound; this does not detach cleanup or change other callers.
Empty-directory pass timing is a floor: populated real runs add inventory and
removal IO. Lower verification.suite_retention_pass_limit and reload to throttle
subsequent live passes if the initial ones run long. The new unindexed case
has an approved 52 s allowance and the file 89 s, E-880/2026-11-26; the indexed
case retains 35 s. Their samples and separate-epoch limits are in durations.json.
Do not run it on the live `.cland/run` tree. Run with
`node --test hub/test/suite-retention-scale.test.ts`.
