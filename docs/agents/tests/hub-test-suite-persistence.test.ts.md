# hub/test/suite-persistence.test.ts

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
