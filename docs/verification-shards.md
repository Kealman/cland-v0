# T-215: conservative resource shards

The production budget remains **1**. The legacy lock pair remains a compatibility
fence for typecheck and all phases. A separate `<lock>.machine` lease is held only
for machine phases. The broker's per-run record follows planned roots, filesystem
identity and runner process identity. No gate/head-binding behavior changes.

## Classification

The manifest classifies 121 hub files: 5 free (30 tests), 116 machine.
The free files are address, log, store, hygiene, and agents-checkpoint. Their
private filesystem/database state and promise gates do not start real processes,
listen on ports, acquire shared locks, run Neovim, or wait on wall-clock timers.
All process fixtures remain machine-bound. Private project roots do not make
real-time/process load hermetic. Free workers: 1 per run. Machine workers: 4.

## Repeated overlap experiment

Runtime: Node v24.21.0, explicitly pinned for the driver and every runner.
Source: integrated dev `ef7c9101ae07f3fdafd1b100280f01d91097c7d8`.
Manifest from T-215 selects unchanged free files on dev. Each lane directly runs
only those five files with Node's worker cap set to 1, its own TMPDIR, and no
machine lock. This is a bounded experiment, not production verification admission.
A sequential two-lane baseline is followed by three overlapping pairs. Every
lane passes all 30 tests. Supported-runtime note A-1391 supersedes the earlier
Node 25 numbers; exact metadata, driver and eight lane logs are in A-1392.

| Run | Pair wall seconds | Peak 1m load | Lane seconds | Passed tests | Queue wait seconds |
| --- | ---: | ---: | --- | --- | ---: |
| sequential | 1.088 | 10.88 | 0.544, 0.543 | 60/60 | 0 |
| overlap-1 | 0.571 | 10.88 | 0.571, 0.566 | 60/60 | 0 |
| overlap-2 | 0.577 | 10.88 | 0.577, 0.576 | 60/60 | 0 |
| overlap-3 | 0.588 | 10.88 | 0.586, 0.588 | 60/60 | 0 |

The average overlapping pair takes 0.579 s versus 1.088 s sequentially: about
0.509 s saved for two free shards. Peak observed load stays below 15 during these
short probes, but a one-minute load average is a coarse measure for a subsecond
run. These probes establish safety only for these five files on this machine at
this observed background load. They do not establish safety for overlapping
process-heavy shards, typechecks or full runs. Node 25 and Node 24 numbers were
collected under different background conditions and are not a runtime comparison.

## Whole-suite comparison

Before: integrated dev `fdb8c5c8558ce42f933bb4d296950ea03181e8f3`, durable log
A-1363: 862.15 s suite wall time, 2771.54 s compatibility wait, peak 1m load
14.89. T-232's final branch log A-1368: 871.15 s suite time, 2861.50 s wait,
peak 20.13. These are historical observations under differing background load,
not a controlled paired benchmark. The older 789.50 s dev observation (A-1278)
waited 3911.52 s, illustrating why queue delay dominates.

The first T-215 full run (A-1409) failed two nested fixture lint checks and a
report-settlement race in the priority test. It stopped after hub: 797.69 s total,
0.89 s free, 796.39 s machine, 0.01 s compatibility wait, peak load 21.45.
Neovim did not run; this is not a successful after measurement. The fixture
paths were private `/tmp/cland-suite-*` roots, not the shared lock files. Lint now
recognizes the actual legacy lock names, and the priority test waits for reported
completion before checking history. All original resource/count assertions remain.

After: the corrected final hub-managed T-215 suite will provide the whole-suite wall time,
hub queue wait, compatibility wait and each shard's duration in its durable log.
It must be read alongside this note; no whole-suite speedup is claimed before it.

Even the measured two-free-shard gain is about 0.06% of an 862 s suite. It cannot
materially improve the 2772 s queue delay while the compatibility fence is held.
Enabling full-run overlap would expose the known load failures (14 shell timeouts
at load 28.7, and six-worker failures in A-1251) for a marginal gain. Keep budget
one. Further process-fixture isolation and crew-scale scheduling belong to the
T-218 programme.

## Reproduce

Run `npm run test:tiers`. From `hub/test/tiers.json`, select only T1 files (the `free` resource phase). On the
same dev build, run two Node test invocations with `--test-concurrency=1`, one
TMPDIR per lane, first sequentially and then as three concurrent pairs. Record
exit codes, test counts, wall time, queue wait (zero for direct probes), and load.
Do not use this direct probe to run machine shards or full suites. Task runs use
`cland verify` with no mode (D29); full suites are the Coordinator's integrated
`dev` runs (`cland verify all`).

## Executor credentials

`DIGITALOCEAN_TOKEN` stays in the hub's executor environment and its local
watchdog, which needs DigitalOcean API access if the hub dies. The shared
`shared/executor-credentials.ts` deny-list removes it from harness launches
(including account environment overlays), local verification workers and
commands, suite and load-gate test processes, Neovim test/QA clients, and local
SSH/SCP tools. Remote machines receive no provider token. The executor currently
uses this fixed variable name; configuration does not select another token
variable. New provider credential names must join the same deny-list.

The same deny-list filters saved account overlays before they become attach
shell command text, so executor credentials cannot enter the shell's argv through
account environment serialization. Account paths and their quoting are preserved.
The [scoped argv audit](executor-argv-audit.md) documents the fake-token
reproduction, launch-site inventory and current-source checks; the historical
`test:nvim` npm process remains unattributed.

The shell that exported the token still holds it. This filtering does not remove
it from independently launched processes or scrub arbitrary commands or output
that a user supplied with a secret embedded in them. Do not put secrets in argv.
