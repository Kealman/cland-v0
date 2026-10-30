# hub/test/measure-memory.test.ts

`node --test hub/test/measure-memory.test.ts` runs T3 controls for scratch copying,
swap receipts, native Python analysis, a small V8 snapshot and sampling profiles,
and an embedded-hub stop over IPC. The shared pacingOwner is registered before spawning. Normal, omitted, aborted,
held-acquisition, failed-write, late rejected write, unavailable-final-reading
and disconnect controls preserve a non-expiring
native exit/pipe-close fact, bound setup and join independently, and gate root
removal on successful disposal. They check native exit, durable outcome and the
root before and after removal. Synchronous analysis children close before directory cleanup. These
controls take a few seconds. The native snapshot identity retains its real V8
snapshot and 800000-byte owned-array assertion. T-1491 replays the passing Linux
c-8 samples from A-14575 (5.133541762 s) and A-14539 (5.283094746 s) through the
production duration checker. Its exact allowance is 7.925 s (1.5x the worst sample,
rounded upward to milliseconds), owned by E-1466 through 2026-11-06; it does not
replace any baseline or change the suite's duration policy.

The manual Mac probe is separate:

```sh
node hub/test/measure-memory.ts --source /absolute/project --plan
node --max-old-space-size=8192 hub/test/measure-memory.ts --source /absolute/project --run
```

The second command needs a Coordinator-granted local measurement slot. Allow
about 1–2 minutes including copy/backup. It stops at readiness, without a rest
phase or full heap snapshots. Its supervisor launches Node with `--heap-prof`,
`--heap-prof-interval=1048576` and a private profile directory. The inspector
captures sampling profiles at startup boundaries. New sample ordinals attribute
sampled surviving allocations between boundaries to call stacks; they are not
retained sizes or exact totals. Garbage collection can remove prior samples.

Preflight refuses load1 above 8 or used swap above 80%. A separate supervisor
checks system swap every 30 seconds and requests stop over IPC above 90%.
The worker uses the shared acquisition/disposal owner, joins the embedded hub's stop and every sampling/profile write, then writes `outcome.json`; the parent
observes native child close and writes `supervisor-outcome.json`. Both receipts
are required. The producer owner bounds graceful IPC drainage; on timeout it
uses captured process ownership to stop the native producer and records an
explicit incomplete native outcome. Roots remain until exit and pipe closure
are observed, including when the combined Node close event is absent. Sample
write failures cannot skip hub shutdown or the durable incomplete outcome. A guard stop remains partial measurement evidence. IPC avoids the
fixture SIGTERM cleanup handler, which can exit before the measurement's finally
block. Synchronous startup work delays IPC handling until JavaScript yields.

Copy/backup preparation happens before launching the measured child, so copy
allocations cannot inflate its RSS. The allowlist copies tracker files, journal
and logs; SQLite's read-only online backup preserves a consistent database.
Artifact entries and sizes use sparse files, excluding all body bytes. The full
artifact index remains in SQLite. Secret-shaped names, symlinks, secrets.toml,
account/config directories, crew, territory and worktrees are excluded. Generated
configuration, fake adapters and account/Git probes exclude real harnesses,
external network and connected clients. CLI-parent and native-adapter memory is
outside the measured child. Keep these differences in comparisons to a live hub.

Private receipts include manifest/script hash, process samples, independent RSS,
startup checkpoints, sampling profiles, vmmap summary when available and outcomes.
Journal-read and startup-step checkpoints capture memory across startup.
On streamed-journal builds, the probe attaches at the daemon’s reading-startup
log boundary to the same shared in-flight reader. Its journal-selection-complete
receipt records selected startup records, exact input bytes and the reader’s
conservative peak-buffer work fact before tracker startup. No second scan runs.
The whole-read-returned checkpoint appears only on the earlier synchronous path. Historical measurements retain their original source head. Probe-only method wrappers record first-call tracker, artifact, topic,
subscription and inbox row counts, plus suiteJobHistory and suiteJobSummaries
rows separately; notice counts are cumulative
calls, not input journal counts. Stage profiles remain private. vmmap failure is
unavailable, not zero. Array buffers are included in external memory; never add
them twice. RSS-minus-heap/external is an approximation, not measured SQLite
allocation. Database file size measures disk storage, not resident memory.

Analyze the small sampling receipts after the producer closes:

```sh
python3 hub/test/analyze-memory.py --profiles /private/root > /private/root/allocation-analysis.json
```

Each sampling receipt has a 32 MiB read bound. The analyzer reports top new sites
per stage with source stacks. Python 3 requires no third-party package. Its legacy
snapshot mode streams numeric graph arrays and computes strong-edge dominators,
excluding weak edges, for small deterministic controls; the manual live-scale
probe no longer creates snapshots.

Publish curated aggregates only, after a secret scan with a positive control.
Profiles and copied state may contain historical strings and paths. Never attach
them. Delete any raw snapshots by literal path before review. Keep startup peaks,
sampled allocation estimates, physical RSS and reported compressed footprint
separate. Rest retention and an RSS budget need separate post-fix measurements.

The SQL-only companion `node hub/test/measure-history-storage.ts --help` describes
a fresh disposable read-only DB backup and aggregate row/field-size inspection.
It starts no hub. Only numeric summaries/field names are exported; historical
values remain private. Allow about ten seconds, then remove the private database
by literal path after publication.

Supervisor receipt finalization follows all native, writer and observer drainage;
it does not run in a closer concurrently with sample writers. A refused final
system reading is persisted as unavailable with an incomplete outcome, after the
hub stop receipt, rather than suppressing that receipt. The controls retain exact
red/green assertions for both failure paths.

The streamed-journal control seeds one selected record beside unrelated/malformed
lines and requires the durable selected-count/input-byte receipt before tracker,
plus successful hub/native disposal. This preserves per-stage counts after the
streaming-reader integration.
