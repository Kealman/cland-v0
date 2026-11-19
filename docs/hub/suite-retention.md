# Suite run retention reports

The hosting scheduler computes retention in **report mode**. It never deletes a
live suite directory. No config key, CLI flag or environment variable enables
deletion. Durable publisher pins and retirement admission are implemented;
activation and the age-floor setting belong to T-1992.

A serving-owner hook starts one shared background pass after the hub publishes
serving. The pass examines at most 32 pending identities per batch and yields
with setImmediate before each batch. Its final batch uses the exact remaining
pass budget, so retained candidates are not revisited to fill a rounded batch.
The existing scheduler checkpoint walk feeds the index; no suite-directory
startup census or startup log scan is added.

The report retains the newest 20 runs per occasion, unsettled jobs, unknown
completion ages and runs settled less than seven days ago. The seven-day floor
is classification policy here, not a configurable deletion setting. Existing
verdicts, latest item results, coverage pointer ids and duration source artifacts
retain their runs. Cover, integrated, batch and dev-T3 evidence classes are
preserved conservatively, as are cached/baseline ancestry identities. Demo
execution is lease-owned outside suite run directories. Arbitrary-age reference
publishers are listed below and in the [exact consumer census](suite-run-references.md).
Durable pins fence their future writes independently of report snapshots.

The structured suite-retention-report log records total, classified, pending,
kept, wouldRetire, removed and reason counts. Production mode is report and
removed stays zero. A stopped/incomplete pass leaves pending counts explicit.
These are observed classification facts, not permission for later deletion.
Missing artifacts or metadata retain candidates. Cleanup diagnostics affect no
verification exit status. The policy requires the updated hosting scheduler;
it is independent of executor, authentication and network availability.

Actual scheduler callbacks use direct artifact identities and the
artifacts_title_topic index, selecting at most one row per coverage/shard
lookup. Latest-item identities are checkpointed in a Set. All batch evidence is
conservatively preserved, so callbacks do not parse batch history or scan
latest-item arrays. Shutdown stops and positively joins retention even if an
earlier cleanup operation rejects; the primary failure remains reported.

## Guarded deletion fixture switch

The suite removal owner defaults to inspection only. Disposable-root tests pass
the explicit remove:true option; the scheduler has no enabling path. The owner
validates literal run ids, directory ancestors and durable artifact containment.
It refuses linked ownership roots and requires map artifacts when a map exists
in either the original run or its renamed tombstone.
Every retry validates the receipt directory and final regular file before
opening it; linked receipt directories and files refuse without removing the
run or external evidence.

Before fixture deletion, the shared atomic checkpoint writer persists the full
required artifact path set outside the directory being removed, under
.cland/run/suite-retirement/<id>.json. A bounded read revalidates those
requirements on retry, even after partial removal. Missing requirements retain
the tombstone. Rename is followed by guarded removal; the receipt is removed
only after native removal completes. Production activation requires its separate
report-log replay and configured age floor.

## Durable reference admission

Before its temporary write and final authorization/rename, the shared tracker
write owner pins run ids in the exact parsed item that readers will index. It
uses the existing item and criteria parsers for verdict comments and verified
marks, including create/edit/import bodies, stage QA and criterion operations.
Existing references in an item being rewritten are pinned conservatively too;
this is admission on write, with no background migration or history scan.
Each tracker owns a SuiteReferencePins checkpoint: only positively completed,
synced immutable pins enter its success set. Concurrent admissions for the same
run share one promise through completion. Failed and unknown admissions never
enter that set. Later writes still parse their exact candidate references but
perform no admission filesystem work for this owner's prior successes. A new
tracker starts empty and lazily revalidates durable records on writes; it does
no startup history scan. The checkpoint is not removal authority and does not
relax unknown/retired refusal. See the per-file pin test guide for the copied
retained-reference corpus and its filesystem work budget.
Coverage-pointer registration also pins before writing. Duration refresh pins
the owning project before opening a raw `.cland/run/suites/<id>/` input,
including renamed log inputs and resolved symlink aliases. Admission returns the
captured canonical input path, and refresh reads that path rather than reopening
the caller's alias; replacing the alias cannot change the consumed run.
Durable artifact inputs do not depend on the raw directory. Existing error
transports carry admission refusal; wire and persisted tracker shapes stay
unchanged, including older hub coverage pointers and non-suite verdict labels.
Old criterion-only verification marks are not covered by the existing verdict
index: their backfill or indexed protection is handled by T-1992 C5 before
activation. T-1991 pins new writes only.

The shared owner uses exclusive file creation in
`.cland/run/suite-references/<id>`. Its immutable byte is `P` for pinned or `R`
for retirement. Files and parent directory entries are synced before admission
returns. A competing publisher also syncs an existing pin before relying on it.
An empty or malformed record is unknown: it retains the run forever and refuses
new publication. Recovery has no TTL, PID inference or stale-pin deletion.

Retirement checks pins in report mode and takes the competing exclusive record
only for explicit removal, before the retirement checkpoint and rename. A pin
that wins keeps the run; a retirement record that wins refuses every later raw
reference. The retirement record remains after removal. If later artifact or
eligibility checks refuse, the run remains fenced conservatively. Pins are never
released by pointer expiry or a publisher failure. This is independent of clock,
executor, network and authentication. Existing references continue to be kept by
the scheduler's indexed reference and evidence-class checks.

## Watchers and consumers

The only production filesystem event subscription is hub/src/watch.ts:
nonrecursive fs.watch on the tracker's .cland/tasks. Healthy reconciliation runs
every five seconds and refusal fallback every 500 ms. No production watcher
subscribes recursively to .cland/run. RefWatches in host/agent/watch.ts polls Git
refs for task checkouts; adapter watch methods inspect harness receipts,
transports and processes. Startup watchdogs use timers. Neovim and web consume
hub events. No watcher narrowing is needed. The incident's recursive watcher was
a hypothesis, not an observed owner.

| Reader or publisher | Report-mode disposition |
| --- | --- |
| hub/suites.ts, suite-history.ts, suite-isolation.ts, local/droplet collection | Unsettled runs retained. Completed metadata and durable artifacts remain readable. No live paths removed. |
| hub/dispatch.ts report/shard/coverage publication | Can recover an arbitrarily old unfinished report. Preserve unsettled/integrated evidence; pointer registration pins. |
| hub/merge-batches.ts, batch baselines, dev-T3 search | Baselines and previous covers have no universal age bound. Preserve these evidence classes and ancestry conservatively. |
| suite-coverage.ts pointer publication/selection | Publication pins before writing; selection reads durable artifacts. |
| suite-durations.ts and hub/test/durations.ts refresh | Explicit raw logs pin before opening; durable source artifacts remain independent. |
| Tracker verdicts and criteria | Shared final-write admission pins parsed comments and marks, including create/edit bodies; existing verdict index protection remains, and old criterion-only backfill is T-1992 C5. |
| Cache admission | Its age bound is configurable. Preserve captured cache ancestry rather than infer a bound below the report floor. |
| CLI/web/Neovim verification/history | Consume hub metadata and artifact paths. No reply/history/wire shape changes. |
| QA briefs and stage-cover fixtures | Explicit run/artifact receipts; no bounded-age assumption. No live paths removed. |
| T1–T4 tests | Owned disposable roots. Retention-specific settlement transfers native root removal until all resource closures succeed. Rejected closures retain roots, fs seams and the counted native guard, while independent cleanup still runs. Actual-scheduler work counts and socket liveness supplement direct classifier scale tests. |

The census artifacts preserve exact searched filenames and original evidence
epochs. No live run directory or hub database was inspected. Earlier deletion
and direct-classifier timings remain historical scoped results; they are not
final-head or actual-scheduler liveness proof.
