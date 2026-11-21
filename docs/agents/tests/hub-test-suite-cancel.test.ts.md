# hub/test/suite-cancel.test.ts

T3 owns real worker cancellation, descendant death and restart receipts. The
cross-session refusal case holds fixture-local admission to force a queued,
PID-null submission reply, releases that hold, then reads the worker PID from
the recorded job and waits for the fake package body's PID receipt. The old
single-snapshot liveness assertion fails deterministically at that boundary:
`pidAlive(null)` is false, with state `queued` and no native exit receipt.
This reproduces a startup-snapshot defect; the original Linux failure had no
PID/outcome diagnostics, so its exact native cause remains unknown.

The in-process hub's native signal sends are observed without suppression.
Refused cancellation must send none; human cancellation must send SIGTERM to
the recorded worker as the observer's positive control. Keep the exact refusal,
worker/child liveness, cancelled report and repeat-cancel assertions. Failure
diagnostics name the launch PID, recorded state/outcome (native exit code/signal
when available), result receipt and bounded log tail. The observer identifies
signals from the hub; external signal senders are not available from Node's
native exit receipt. No production cancellation policy changes are involved.

For T-1863 C2, run only the refusal identity twenty times serially in a sealed
Linux Docker container with `--init`, disposable source and dependencies, and
fixtureEnvironment/scratchGitEnvironment. Record each native child exit code,
signal/error, terminal test counts and 1-minute load; require load >=8 and <20
for every run. Coordinate the exclusive load slot with the item lead, use the
suite and preservation locks, and stop all load children before deleting roots.

The
detached fake harness scenarios use the public verify CLI on a sealed project
with fixture-local compatibility locks. Wait for the fake child's PID/root
receipt before cancelling. One fake recreates the root after its runner dies;
the other retains the inode. A filesystem-boundary observer records any attempt
to remove that exact root while the detached child lives. Keep the final
absence assertion, confirmed child death, cancelled result and next-run success.
Stop the fake before removing its exact root, original and quarantine paths.

The product regression `cancel retry retains a detached native identity
reparented before the next tree walk` injects native inspection failure after
the first TERM. The captured child has its own group and reparents to PID 1
before retry; cancellation must still terminate that exact native birth.
This fails against the old product's per-call tree tracking without load.
Companion synthetic cases preserve a reused birth, accept structured native
zombie death, refuse an unlisted but live PID or an EIO/unknown absence probe,
and prevent copied metadata from
inheriting the original live owner's retained tree. They use the existing
guarded synthetic OS boundary; source wire/resource shapes stay unchanged.
The initial-validation and grace-discovery variants put the unreadable sibling
first and last in the snapshot. Both retain every verified eligible sibling before refusing the
incomplete tree, apply the same self/ancestor fence, then confirm that the
known child drains after reparenting while the unknown sibling is unsignalled.

The acquisition-rejection variants replace every `TerminationOwner` reservation
boundary with a fake. Grace capture rejects with an ordinary error and removes
the parent from the synthetic OS table. The expanded variant also removes the
first child, leaving its sibling and nested descendant reparented. Publish the
complete verified reachable set before any acquisition await. The first cancel
must reject; retry terminates every retained survivor and observes ESRCH for
each discovery. Neither variant sends real PID signals or uses shared locks.

These new callers pass their TestContext to `systemProcessProbe`. That optional
path installs shared `fixtureWork` before acquisition, separately bounds root
setup and native spawn receipt, and retains the returned ChildProcess until
both its callback and native close settle. Cancellation kills through that
handle and joins the whole admitted callback before guarded root removal.
Incomplete close retains roots. A positively guarded fake-native control aborts
the callback while holding close and invokes the real `ownDirectory` remover
independently of ordinary disposal. An added guard asserts and records that
the captured child's native close has arrived before that removal attempt
passes the drain barrier. The root stays present while close is held; releasing
that same close permits guard entry, remover completion and ENOENT. Existing
callers keep their prior path.

The loaded diagnosis established the product branch: a cancelled-report receipt
coexisted with the original live native identity, state Ss and parent PID 1.
The initial test-only zombie explanation does not explain that receipt. The
exact first-attempt abort in the historical loaded run remains unknown; the
deterministic retry regression proves the concrete captured-ownership loss.

The immediate `kill(pid, 0)` assertion can still see a confirmed-dead zombie.
The deterministic delayed-retirement case injects a detached descendant's native
zombie receipt at SIGKILL through `systemProcessProbe`: production `endProcess`
confirms termination while the synthetic kernel retains that PID. The PID
observer must remain pending until the test explicitly retires it. The test
requires the independent reap receipt at settlement, draining
the first observation's async chain through a native turn before injecting reap.
The removal observer uses production `processAlive` with the detached child's
captured native birth. A synthetic positive control detects the live writer,
then accepts its structured native zombie death while `kill(pid, 0)` still
succeeds. Unknown native proof stays conservatively live; PID retirement stays
a separate assertion. This distinguishes native death from PID retirement
without a timing loop. For red
evidence, replace the first `pidAlive(420101)` expectation of `true` with the old
expectation of `false` and its original message, then run only this identity.

After the cancelled report, the CLI cases use the shared setup budget
`waitTimeoutMs(testWaitMs(5_000))` for kernel PID retirement, with `loadFactor: 1`
at `eventually` so the budget is scaled once. The product's ordering boundary
is confirmed native death; launchd's later retirement of its PID is OS setup
headroom, not a product behaviour deadline. Keep the
final PID absence assertion and the existing root-removal observer, raw coverage
absence, recreated-inode and next-run assertions. The ordering claim concerns
confirmed writer death before removal/reporting; kernel PID retirement is a
separate observed boundary. T-1758's loaded evidence runs the affected
`before removing the phase root` identity twenty times serially on macOS with a
CPU burner, each starting at 1-minute load >=10 and <20, under the Coordinator's
native slot after quiet over and T0 clear. Record every native exit and load,
and stop the burner by its captured PID before releasing the slot.

For an authorized diagnosis, `CLAND_TEST_PID_DIAGNOSTICS=1` records at most 33
samples around cancellation, the cancelled-result wait and the existing
retirement wait. The joined final sample is emitted even when the cancelled
report does not arrive. Each names the
captured PID/birth, original parent and runner, observer PID, current parent and
state from a bounded PID-selected `ps`, production native identity/exit receipt,
`processAlive` and `kill(0)` observation. Missing metadata stays unknown. Native
reads and diagnostic work join before teardown; diagnostics never replace the
test outcome or widen its deadline. A sustained native zombie with an owned
parent is reported to the item lead before any product or harness fix.

The diagnostic output also records the local cancellation owner's actual
`suite-process-end-start`, `suite-process-captured`, `suite-process-end` and
`suite-process-exit-probe` receipts, keyed by run and native birth. Forwarded
termination diagnostics keep the `suite-process-` prefix. End outcomes distinguish
confirmed, incomplete and unknown (a thrown native operation); none is inferred
from error text. Native state sampling includes captured identities as well as
the fake child, with at most 32 targets per round and an explicit omitted count.
A pass-through native signal observer records successful and failed sends.
Owner and signal tails each retain 256 records and report dropped counts.
Missing native state stays unknown. These log observations grant no authority
and logger failure cannot change cleanup. The synthetic reparented-retry case
requires capture, incomplete-end and confirmed detached-retry receipts while
preserving its signal and final tree assertions.

The artificial 30-second body hold is ended by cancellation. Polls observe
process death or filesystem receipts; elapsed time is never the asserted fact.

The detached cancellation cases also record raw V8 coverage. A live detached
writer publishes its ready marker after writing raw bytes and keeps writing
until cancellation. A native removal observer records any runner deletion with
that writer still alive. Final cancellation requires its PID gone, no early
removal receipt and ENOENT for raw coverage, proving hub release owns deletion.
