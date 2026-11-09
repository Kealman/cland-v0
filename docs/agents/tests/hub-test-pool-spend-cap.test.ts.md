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

The waiting-through-retry case seeds spend before starting projectHub. Prearm
its `executor-sweep` log observer, await a successful completion (`failures: 0`),
then assert the spend lock file is absent before triggering launch. The sweep
emits that receipt after releasing its registry spend lock. Without this setup
barrier, a competing reservation may enter contention backoff on the injected
FakeClock before the test advances it: first refusal never arrives and shutdown
joins an unresolved creator. Keep setup completion separate from the exact
60-second retry behavior bound; do not replace the waiting/retry assertions.
