# Suite raw-run reference census

T-1991 admission inventory, searched before changing publisher admission. This
extends the T-1957 census; production deletion stays disabled. Search roots were
hub/src, hub/test, nvim, web, docs, qa and .agents/skills, including frozen fixtures
and tier assignments. Searches used raw path and format strings (`run/suites`,
`suite.log`, `coverage-maps`, `suite-retirement`), publisher and reader names
(`registerCoverageMap`, `refreshDurations`, `retainsSuiteRun`, `suiteTextLines`,
`suiteLogLines`, `readSuiteEvidence`, `retainedLoadProofs`, `coveragePointerEntries`,
`CriterionMark`, `verdictOfText`), and tracker run fields and call sites.

## Publisher dispositions

| Publisher | Admission and disposition |
| --- | --- |
| tracker/tracker.ts #write (shared final owner) | Serialize and parse the candidate item with existing item/criteria parsers, then admit parsed verdict and verified criterion runs through its tracker-owned SuiteReferencePins before temporary write/final authorization. Covers create/edit bodies, explicit comments/verdicts, stage QA, criterion operations and import. Successful immutable admissions are checkpointed; concurrent callers share pending work; failed/unknown outcomes never checkpoint. Repeated historical references add no admission I/O. Recovery revalidates lazily on write, with no startup scan or background migration. |
| suite-coverage.ts registerCoverageMap | Pin before pointer directory/write; expiry removes only lookup pointers, never pins. |
| hub/test/durations.ts refreshDurations | pinSuiteLog pins lexical and canonical raw owners and returns the admitted canonical path. The sole caller reads that captured path, never reopens the mutable alias. Renamed inputs and durable artifact logs retain support. A deterministic alias swap proves the consumed timing belongs to the pinned run. |
| hub/dispatch.ts #reportSuite / coverage publication | Raw artifact copy remains under unsettled scheduler ownership until publication; pointer registration additionally pins. No separate arbitrary-age raw publisher. |
| hub/suites.ts and executor/droplet/run.ts/run.sh | Launch/output/shard/cache metadata belongs to the scheduler. Unsettled, ancestry, batch, cover and integrated evidence stays retained independently. |
| Tracker create/edit/import bodies | Recognized structured marks and verdict comments go through the shared #write admission above. Ordinary prose is not a reference. Offline frontmatter migration preserves existing body/comment bytes without introducing references; old criterion-only protection is T-1992 C5. External filesystem writers are outside admitted publisher APIs. |

## Reader dispositions

| Readers | Disposition |
| --- | --- |
| tracker/item.ts, criteria.ts, index-db.ts, gate-verdicts.ts, explorer-fields.ts, tracker.ts | Persisted run strings and criterion marks retain their existing shape. New writes pin; old verdict references remain in retention's indexed keep set. Old criterion-only marks are not in that index: handled by T-1992 C5 before activation. |
| hub/suite-history.ts, hub/merge-batches.ts, dev-T3 search, cache and cover selection | Indexed metadata, baselines and artifact identities; existing conservative ancestry/evidence classes retained. |
| suite-log.ts, suite-provenance.ts, suite-load-diagnostics.ts, hub/suites.ts, executor/droplet collection | Raw log reads occur under unsettled owner or retained evidence classes; durable log artifacts survive retirement. |
| suite-coverage.ts coverageMaps/coverageSelection, suite-selection.ts, selection-replay.ts | Read durable artifact map paths through unchanged pointer grammar. Pointer run ids remain protected; older hub pointer shape stays supported. |
| suite-retention.ts, suite-raw-coverage.ts | Inspect bounded per-run admission state, retain unknown/pinned records; only explicit disposable-root switch claims retirement. |
| CLI verification/history, web sessions/verification and verification panels, Neovim verification/QA/item panels | Read hub metadata and durable artifact links, no raw directory reads and no protocol additions or removals. |
| QA briefs, shipped QA templates, startup/cover fixtures | Explicit artifact or test-owned raw paths; no changed grammar. Production deletion off; fixtures retain ownership of their roots. |
| Frozen CLI usage and tracker snapshot fixtures | No help bytes or persisted item schema changes; no migration. |
| All tiered tests in the search inventory below | Existing consumers keep prior wire/record shape. New admission cases are T2; no tier moves or borrowed T1 proof. |

## Exact search inventory

Each path below has the disposition in its corresponding publisher/reader row.
Test fixtures are disposable; prose/briefs retain their existing input paths.
The list includes textual matches that do not dereference a raw directory, so
those consumers are explicitly unaffected rather than treated as migrated.

- `.agents/skills/qa/BRIEF.md`
- `.agents/skills/qa/STAGE-BRIEF.md`
- `docs/agents/tests.md`
- `docs/agents/tests/hub-test-dev-t3-search-component.test.ts.md`
- `docs/agents/tests/hub-test-executor-prepare-component.test.ts.md`
- `docs/agents/tests/hub-test-suite-log-backfill.test.ts.md`
- `docs/agents/tests/hub-test-suite-runner.test.ts.md`
- `docs/agents/tests/hub-test-suite-selection-component.test.ts.md`
- `docs/agents/tests/index.md`
- `docs/hub/artifacts.md`
- `docs/hub/running.md`
- `docs/hub/suite-retention.md`
- `hub/src/executor/droplet/run.sh`
- `hub/src/executor/droplet/run.ts`
- `hub/src/hub/dispatch.ts`
- `hub/src/hub/suite-isolation.ts`
- `hub/src/hub/suites.ts`
- `hub/src/suite-coverage.ts`
- `hub/src/suite-load-diagnostics.ts`
- `hub/src/suite-load-gate-plan.ts`
- `hub/src/suite-log.ts`
- `hub/src/suite-provenance.ts`
- `hub/src/suite-raw-coverage.ts`
- `hub/src/suite-retention.ts`
- `hub/src/tracker/criteria.ts`
- `hub/src/tracker/index-db.ts`
- `hub/src/tracker/item.ts`
- `hub/src/tracker/tracker.ts`
- `hub/test/dev-t3-search.test.ts`
- `hub/test/durations-refresh.test.ts`
- `hub/test/durations-runner.test.ts`
- `hub/test/durations.json`
- `hub/test/durations.ts`
- `hub/test/executor-admission.test.ts`
- `hub/test/executor-health.test.ts`
- `hub/test/executor-liveness.test.ts`
- `hub/test/executor-prepare.test.ts`
- `hub/test/executor-run.test.ts`
- `hub/test/executor.test.ts`
- `hub/test/fixtures/tracker-snapshot/items.json`
- `hub/test/hub-status-component.test.ts`
- `hub/test/memory-streaming.ts`
- `hub/test/plan-stage-fixture.ts`
- `hub/test/scenarios/droplet-verify.test.ts`
- `hub/test/selection-replay.ts`
- `hub/test/spawn-census.mjs`
- `hub/test/stage-cover-fixture.ts`
- `hub/test/suite-accounting.test.ts`
- `hub/test/suite-admission-cost.test.ts`
- `hub/test/suite-cancel.test.ts`
- `hub/test/suite-close-component.test.ts`
- `hub/test/suite-command.test.ts`
- `hub/test/suite-cover.test.ts`
- `hub/test/suite-coverage-selection.test.ts`
- `hub/test/suite-coverage.test.ts`
- `hub/test/suite-dry-run.test.ts`
- `hub/test/suite-hung-component.test.ts`
- `hub/test/suite-log-backfill.test.ts`
- `hub/test/suite-persistence.test.ts`
- `hub/test/suite-phase.test.ts`
- `hub/test/suite-progress.test.ts`
- `hub/test/suite-protocol.test.ts`
- `hub/test/suite-recovery.test.ts`
- `hub/test/suite-reference-pins.test.ts`
- `hub/test/suite-release-cache.test.ts`
- `hub/test/suite-remote-budget.test.ts`
- `hub/test/suite-remote-process.test.ts`
- `hub/test/suite-retention-component.test.ts`
- `hub/test/suite-retention-scale.test.ts`
- `hub/test/suite-retention-scheduler.test.ts`
- `hub/test/suite-retention-writes.test.ts`
- `hub/test/suite-runner-contract.test.ts`
- `hub/test/suite-runner.test.ts`
- `hub/test/suite-selection-report.test.ts`
- `hub/test/suite-selection.test.ts`
- `hub/test/suite-soak-component.test.ts`
- `hub/test/suite-summary.test.ts`
- `hub/test/suite-timeouts.test.ts`
- `hub/test/suite-unit-fixture.ts`
- `hub/test/suite.test.ts`
- `hub/test/tiers.json`
- `hub/test/verdict-commit-component.test.ts`
- `hub/test/verification-workers.test.ts`
- `hub/test/web-phase.test.ts`
- `qa/briefs/E-1314.md`
- `qa/briefs/E-1532-stage-2.md`
- `qa/briefs/E-1532-stage-3.md`
- `qa/briefs/E-1532-stage-4.md`
- `qa/briefs/E-1533.md`
- `qa/briefs/E-1535-stage-4.md`
- `qa/briefs/E-1536-stage-2.md`
- `qa/briefs/E-1536-stage-3.md`
- `qa/briefs/E-1536-stage-4.md`
- `qa/briefs/E-1537-stage-3.md`
- `qa/briefs/E-1537-stage-4.md`
- `qa/briefs/E-1537-stage-5.md`
- `qa/briefs/E-1538-stage-1.md`
- `qa/briefs/E-1538-stage-2.md`
- `qa/briefs/E-1539.md`
- `qa/briefs/E-387.md`
- `qa/briefs/E-413-stage-2.md`
- `qa/briefs/E-413.md`
- `qa/briefs/E-414-stage-1.md`
- `qa/briefs/E-414-stage-2.md`
- `qa/briefs/E-414-stage-3.md`
- `qa/briefs/E-414.md`
- `qa/briefs/E-415.md`
- `qa/briefs/E-416-stage-3.md`
- `qa/briefs/E-416.md`
- `qa/briefs/E-417-stage-1.md`
- `qa/briefs/E-417-stage-2.md`
- `qa/briefs/E-417-stage-3.md`
- `qa/briefs/E-417-stage-4.md`
- `qa/briefs/E-417.md`
- `qa/briefs/E-418-stage-1.md`
- `qa/briefs/E-418-stage-2.md`
- `qa/briefs/E-418-stage-3.md`
- `qa/briefs/E-418.md`
- `qa/briefs/E-419-stage-1.md`
- `qa/briefs/E-419-stage-2.md`
- `qa/briefs/E-419-stage-3.md`
- `qa/briefs/E-419-stage-4.md`
- `qa/briefs/E-419.md`
- `qa/briefs/E-420.md`
- `qa/briefs/E-426.md`
- `qa/briefs/E-468.md`
- `qa/briefs/E-614.md`
- `qa/briefs/E-617.md`
- `qa/briefs/E-676.md`
- `qa/briefs/E-678.md`
- `qa/briefs/T-230.md`
- `qa/briefs/T-268.md`
- `qa/briefs/T-271.md`
- `qa/briefs/T-386.md`
- `qa/briefs/T-62.md`
