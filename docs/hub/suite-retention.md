# Suite run retention

The hosting scheduler deletes eligible indexed and unindexed suite directories
in yielding background passes after serving. Unindexed deletion is enabled by
the human's one-off rule 27 exception (General, 2026-11-19 18:36Z, answer to ask
2da0c7c7). The effective `[verification]` settings are
`suite_retention_min_age_days = 7` and `suite_retention_pass_limit = 4096`.
Both parse as positive integer values; the pass limit is capped at 4096 and may
be lowered with `cland config set`, then `cland hub reload`. The next pass
uses the reloaded values. Missing settings inherit these defaults. Executors,
authentication and network availability do not change retention policy.

Each pass visits at most the configured number of indexed pending identities
and the same number of directory entries, yielding every 32 entries. Thus the
default upper bound is 4096 indexed retirement candidates and 4096 discovered
classification entries per pass, with eligible unindexed entries also removed.
After serving admits the first pass, the scheduler runs another pass two minutes
after completion while indexed candidates or an open directory cursor remain,
and ten minutes after completion otherwise. Suite launches retain their trigger;
concurrent triggers share the admitted pass, and a launch replaces a pending
timer. No sweep runs during startup recovery. The timer is unreferenced, uses
the scheduler clock, and stops before shutdown joins admitted IO. The cadence
does not depend on executor, authentication or network availability. Lower the
existing pass limit and reload to throttle subsequent passes on the live machine.

Indexed runs retain the newest 20 per occasion, unsettled/unknown-age jobs,
references, pins, coverage pointers, duration sources and conservative cover,
integrated, batch, cached/baseline and dev-T3 evidence classes. Indexed deletion
requires durable log/map artifacts. Consumers use artifact paths for completed
evidence. Cleanup diagnostics do not change verification exit status.

Directory discovery uses a bounded streaming cursor after serving, never a
startup directory census or log scan. An unindexed run requires a positive
absence lookup in the scheduler's durable run index (including shard ownership),
the newest mtime across the root and its bounded inventory older than the floor,
and no tracker, ancestry, latest-result,
pin or pointer reference. Names supply neither age nor absence. Unknown or
linked roots stay. A per-directory inventory stops at 4096 entries or depth 16;
oversized trees stay. Contents are not copied: a capped durable per-pass ledger
under artifacts records id, root/newest mtime, root device/inode, bytes, file count and the passed absence/keep
checks before retirement. Inventories count non-directory entries and their
lstat byte sizes, including links themselves; directory inode/allocation bytes
are excluded. The same guarded retirement owner validates the
inventory, claims exclusive retirement against publishers, checkpoints
requirements and re-reads bounded metadata before rename and immediately before
removal of the renamed root. The same exported inventory reader serves both
discovery and removal. It requires unchanged root device/inode, root/newest
mtime and byte/entry counts. A changed or unusable inventory keeps the run;
a newly renamed root is restored on refusal. This is conservative revalidation,
not a claim that native writers have closed. Pins and unknown admission
records retain their roots. Interrupted indexed removals revalidate their full
artifact requirements, including tombstone maps. Linked receipt roots refuse.

The indexed report retains its existing fields and reason counts; mode is now
live and removed is a positive native-removal count. Its total describes indexed
runs, not all directories. Its additive unindexed report records the pass mode,
scanned entries, would-retire and removed counts, and classes: indexed,
reference, pin, pointer, age-floor, inventory-bound, eligible, ignored and
unknown. Report mode makes no retirement claim and keeps every directory.
SUITE_UNINDEXED_RETENTION_REMOVE is the independent activation default; its
enabled value cites the human's exception beside the declaration. Disposable
tests explicitly exercise production default, report and deletion settings.
The serving owner emits suite-retention-start and one summary rather than
per-run decision lines, with removal and error counts and the first error
(capped at 1024 characters). It emits durationMs on its complete
or incomplete pass receipt. Duration covers admitted background work and its
IO, excluding startup, queue wait, fixture setup and teardown.
Shutdown stops and joins
both work and the directory cursor even after another cleanup failure.

Each successful pass checkpoints progress for the Coordinator heartbeat: last
completion time, passes for that scheduler owner, remaining indexed candidates
(including protected runs), cumulative indexed removals, last directory-pass
scan/removal counts, and whether discovery continues. Directory backlog size
remains unknown until EOF; a closed cursor means discovery completed, not that
every retained directory was eligible for deletion. Progress is the last stored
receipt and its timestamp remains visible after a hub restart.

Before serving on an older tracker index, one schema migration invalidates item
hashes so the existing bootstrap walk indexes parsed verified criterion run
identities. Indexed keep protection is ready before the first live pass, even
when those old marks have no publisher pin. New tracker writes continue to pin
references before publication.
An indexed invalid hash left by incomplete migration fences all run absence
checks until a positive reindex receipt replaces it; the lookup uses a partial
index rather than scanning item history per retirement candidate.

## Durable reference admission

Live retirement batches contain at most 32 candidates. One synced immutable R
inode is hard-linked into their reference records, competing atomically with
pin publication; the reference directory is synced before any deletion. One
synced version-2 requirements checkpoint is hard-linked into each per-run
retirement receipt, followed by one receipt-directory sync. Only a positive
in-process batch token skips repeated claim/checkpoint fsyncs. A crash leaves
runs retained or covered by durable native claims and requirements. Recovery
accepts both version-1 individual receipts and version-2 batch receipts, checks
the requested run's complete paths, and revalidates its claim. Per-run outcomes
survive later failures; cleanup errors remain secondary diagnostics.

Unindexed inventories checkpoint at each batch boundary, before claiming or
removing those runs; the full per-pass inventory remains bounded to 2 MiB.

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
