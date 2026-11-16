# hub/test/suite-persistence.test.ts

Terminal no-lease remote seeds lose both result and log receipts before recovery,
with and without a scheduler restart. Queue membership, explicit missing-receipt
outcome, persisted reported state, heartbeat clearance and no repeat publication
after another restart are asserted on fake-clock ticks. No provider is contacted.
Missing-result cases retain a surviving log's pass/fail counts and failure
identity through suiteSummary and devT3Result. Known nonzero, green and unknown
prior outcomes become failures without inventing non-execution; an original
pre-execution refusal retains its not-run classification. The cases have a
30-second outer failure bound and use only fake scheduler time for behavior.
The refusal control preserves its exact producer cause: its first result write
is normal materialization, not lost collection. LocalExecutor.holder is faked
alongside reconcile, so explicit queue reads never reach native lock inspection.
The both-files-lost matrix includes executed failures and terminal provider
refusals, each with and without a pre-recovery restart. Refusals reconstruct
report inputs from their terminal checkpoint without changing outcome/cause;
the log names missing inputs, the result retains its original finish time,
heartbeat clears and another restart produces no second publication.
The legacy green report-only seed deliberately has no native finish timestamp
or result file. Its zero outcome and surviving log stay unchanged; absence before
first materialization does not establish lost execution evidence.

`node --test hub/test/suite-persistence.test.ts` uses scratch SQLite files,
sealed child environments and fake scheduler time. No browser or native worker
is started. The 3,000-job legacy-storage regression seeds over 250 MB of planning
payload, then checks at most 3,000 summary rows, less than 1,500 bytes each and
4.5 MB total returned to JavaScript at startup. It asserts zero full archive
reads, a positive large-input control, by-id full retrieval and index deletion.
These are work-count assertions, not wall-time or RSS budgets. SQLite's native
first-run backfill scans the original JSON once; this cost is excluded from the
JavaScript byte guard and checkpointed for subsequent starts. The reporting
recovery case proves unfinished archives still hydrate full plans.

The manual `hub/scripts/measure-suite-history.ts` is report-only synthetic
instrumentation, approximately ten seconds. Live-scale comparisons require the
Coordinator's measurement slot and the T-1467 probe; publish stage receipts with
head, machine, platform, exclusions and completion outcome.

The large-history case also drives two retained MergeBatches ticks and a real
DevT3Probes lookup, asserting zero full-record reads across those automatic
controller boundaries. Internal controllers use `Suites.findRun` facts; only an
explicit history request or selected receipt may hydrate plans. Finished,
message-completed and cached legacy timing cases reopen the archive, check
queue duration estimates, and prove the timing-only SQL patch happens once
without loading or altering the retained selection plan.
The legacy release-evidence case preserves JSON booleans for `soak`/`loadGate`
and distinguishes absent selection restrictions from present empty test lists;
those facts must keep the production release eligibility predicate unchanged.
The archived two-shard Linux stage case verifies both the original and a cached
receipt after reopening. Keep the source shard array and cached.run provenance;
stageMissing must report only macOS. The summary SQL qualifies meta.value inside
json_each so the inner table's value column cannot shadow the archived record.
The unchanged native component restart/cache regression remains in
`hub/test/suite-close-component.test.ts`.

The local and scripted-droplet footer cases each finish an admitted run and await
its durable reported state before inspecting the final raw log. They check one
terminal footer, head/tree, measured platform, ordinary occasion, browser facts,
skip reasons and advisory missing-reason counts without changing exit zero.
Each reuses the cache and checks replacement of the original footer plus retained
browser/original-run provenance. These are scheduler/transport fixture tests,
not real local-worker or cloud/browser execution measurements.
Setup, admission, reported completion and cache observations use the shared
`caseDeadlines` owner, each with its own bound. The proxied fixture hooks drain
registered operations before closing the scheduler/store and removing the root;
a deadline cannot detach an observer from that cleanup owner.
