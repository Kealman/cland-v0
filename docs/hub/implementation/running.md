# Running implementation notes

Read the matching [subsystem reference](../../../hub/README.md) alongside these notes.

Waiting suite tickets have no age expiry; native birth protects new tickets across
clock corrections. Exit 75 plus a runner-recorded `suite infrastructure:` cause is
incomplete infrastructure evidence; a matching test-output line supplies no cause.
See `docs/hub/running.md#waiting-suite-tickets` for older-runner compatibility.

## Merge-delta advisory comments

Nightly soak admission calibrates worker projections, including Web, against
observed soak receipts with a 2.17 floor, retaining its deadline reserve. Dynamic
calibration requires a remote start log marker and native finish on the same
remote clock; unknown intervals retain the last valid calibration or floor,
and exclude host T0. Oversized
bases rotate files within each tier through durable cursors before repetitions;
omitted files stay unexecuted in the log and heartbeat. An unfittable first-file
set refuses before machine creation.
Timeout evidence distinguishes unexecuted files from incomplete files and
completed tests. See `docs/hub/running.md#soak-deadline-accounting`.

The hosting hub records clean reviewed-head/dev merges as report-only item
comments with path and shared-import-graph facts. The conservative rule treats
runtime/config/test/generated changes as potentially coupled. Unknown graph
facts are explicit. `patchIdCurrent` is freshness eligibility, not a gate receipt.
These comments never replace the Reviewer's merge-delta review before the next
verification under rule 11; existing patch-id carry-over stays unchanged. See
`docs/hub/web-workspace.md`, "Merge-delta assessments (report mode)". No role clause changes
or additional permissions are needed.

Landing test-lint read failures retry three times, then retain batch membership and green evidence under `merge-git` for automatic retry, including after restart. Genuine lint findings still drop their member. See `docs/hub/running.md`.

Batch preparation shares the standalone closed-item wording policy and checks
candidate blobs with prepared member IDs projected closed. Findings refuse the
member before admission with file/line diagnostics. Tracker files stay intact;
unavailable blob reads retain the batch as infrastructure failures.

After shutdown, a later passing host-check receipt supersedes an aborted attempt
only at the same run, tree and command. Retain both attempts in log and notice;
unbound legacy interruptions stay inconclusive. No recovery command is added.

Run typechecking and targeted single test files while implementing. Merge batches run T0 before configured tiers, skip T1 only with complete structured mode-free exact-head member receipts and another configured runtime tier, and add Web after T1 (after configured tiers without T1) for web/ diffs; use the receipt/bisection seams in `docs/agents/tests.md#queued-merge-batches` for changes there. A green same-tree batch with structured T0/T3 and executed or member-verified T1 suppresses periodic dev admission; changed-tree batch-only suppression has a durable 24h full-periodic backstop, while unchanged trees retain their skip. See `docs/hub/running.md` for cadence and executor availability. In a hub session, run the full suite only after a clear source review, as described below; outside the hub, run it once at the end.

Batch interaction reports also include advisory T3 importer files, separately
from the T2/Web run switch. These files are unexecuted projections, including
when the switch is `run`; null means unknown and older reports may omit them.
See docs/hub/additive-interaction-selection-t-1454.md.

Verify CLI admission waits up to 90 seconds for local or remote discovery (diagnostics: 120 seconds), including candidate validation before persistence.
Verify admission returns the durable run id before scheduler inspection and
worker launch. If a sent request exits 75 without a reply, check the queue once
before any explicit retry; the CLI does not resubmit automatically.

A verify queued locally after a remote-budget fallback can reclaim a free remote slot in its original queue order, including after a hub restart; the hub reports the move in its topic. Wait for that request rather than resubmitting. Explicit `--executor local` stays local.

Typed file-start progress arms the command worker's startup watchdog: 30 seconds
of shared load-scaled setup headroom, capped at half the no-output timeout.
First test/suite start or a completed empty file disarms it. A startup stall
uses the existing owned cleanup and native exit/pipe/process evidence; it does
not change test behaviour deadlines. The delivered-tree package runner owns the
same guard on droplets; phase start/finish receipts delegate local outer
startup cleanup, with native exit/close reclaim and the no-output backstop for
a hung inner runner. See docs/hub/running.md and the suite-command/phase guides.
