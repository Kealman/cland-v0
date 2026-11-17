# hub/test/pool-spend-cap.test.ts

T2, sealed disposable HOME/XDG state and fake hub clock. Run with supported Node:
`node --test hub/test/pool-spend-cap.test.ts`.

The renewal case admits $1, extends the same lease to $2 past its $1 hosts cap,
then proves the unchanged $3 shared cap refuses a $4 extension. The pool case
fills one slot, demands a second host at its cap, and observes the reservation
refusal before checking zero acquisition calls, one ledger entry, no second
lease, the retained running host/session and its successful renewal.

The hub case reserves $0.80 against $1 while the hub is running, observes the
durable General message without advancing timers, restarts the same scratch hub,
and repeats a mutation that must keep one warning. It moves the hub clock to the
next UTC day and renews the carried reservation to observe a second warning.
Native timers remain real. Neither startup latency nor provider/native host
behavior is measured. QA can run these generated case names directly.

The fourth case uses the socket launch/list boundary and an injected reservation
owner. It observes two cap refusals one minute apart and checks the launch is
still waiting, with zero acquisition calls and only the original ledger entry.

The mutation observer case counts current-ledger reads across create, renew,
settle and cancel, with one read per transaction and no observer read. It checks
the committed settled/reserved facts and contributing pools, then replaces the
subscriber and proves the retired owner receives no subsequent event. Every
accounting path injects the shared fake lock process facts. Direct SQLite fixture
cleanup is registered before awaited setup and attempts ordered drains in finally.

Full projectHub restart fixtures also pass `droplet: { processes }` using the
shared fake lock facts: startup `DropletExecutor.sweep → sweepProjects →
spend.locked` uses executor dependency facts separately from the hub's own
`options.processes`. The runner supplies `CLAND_TEST_LOCK_IDENTITY` before the
tripwire; a standalone enforce probe must supply that fixture identity too.

The waiting-through-retry case seeds spend before starting projectHub and launches
without waiting for startup sweep completion. Default spend-lock backoff and its
acquisition deadline use native time, independently of the hub FakeClock. An
explicit injected `wait` retains its paired injected clock for scripted lock tests;
ledger dates, reservations and UTC spend windows still use the caller's clock.

`startup sweep and host reservation settle spend contention without advancing hub time`
holds startup sweep publication while it owns the ledger lock, observes the
reservation receiving `EEXIST` from the real spend-lock link, then releases publication. It waits for the
exact reservation in the durable ledger and the successful sweep completion,
asserts $1 reserved and unchanged hub time. Both contention cases compose `fixtureWork(t)` before the first asynchronous
acquisition. Roots, hubs (via `dispose`) and held locks are adopted; hold release
and mock restoration are registered before body admission. Cancellation fences
and joins the whole body and late resources before globals restore or roots
are removed. The reservation is aborted and joined in the body finally. This is a T2
filesystem-contention regression, with fake process facts and no provider or
native harness processes; it does not measure startup latency.


`default registry sweep shutdown joins native contention without advancing hub time`
holds the ledger lock and observes the sweep's real link `EEXIST`. It closes the
executor while retaining the other holder, asserts the admitted sweep completed
with a deferred registry receipt, releases the holder and checks unchanged ledger
bytes and hub time. No explicit executor `wait` is supplied. Executor close aborts
registry acquisition/retry and joins admitted sweeps; `rememberProject` and
`sweepProjects` accept an optional trailing signal, forwarded by the executor.
Existing positional callers without a signal retain their previous API.
