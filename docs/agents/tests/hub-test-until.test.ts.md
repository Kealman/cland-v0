# hub/test/until.test.ts

T1 deadline policy and public condition waits. Fake clocks prove setup scaling,
exact injected-clock and named behaviour bounds, including the diagnostic's
deadline value and timer disposal. Pure cases cover local/droplet defaults,
load plus workers, overrides and finite-positive deadline refusal. Environment
controls are restored in finally. No wall-clock sleep, socket or native child
is used. Fractional injected load factors round deadlines upward to integer
milliseconds, including sub-millisecond budgets; the setup helper's result is
accepted by `AbortSignal.timeout`. The suite-runner propagation regression is T3 and needs the exclusive
preservation slot; it remains separate from these unit cases.

The async-check regressions hold a promise past its deadline, then release a
late value, and separately advance fake time inside a check before the timer
callback can run. Both must reject at the named bound. The cadence regression
observes attempts at fake times0/50/100 and returns a zero receipt unchanged.

T-2046 adds an injected OS-load sequence on ten CPUs (0, 6, then 10):
the public budget must grow immediately even below saturation. The runner's
shared argument builder emits `--test-timeout=10000` for a 5000 ms base at load
10; Node reads that backstop once per runner launch. A fake Playwright owner
proves that a retained locator, including one returned by async `all()`, refreshes the timeout on each operation and that
an explicit action timeout keeps its value. Native/browser execution evidence
belongs to the existing Discord, remote-close and Hosts tests, not these T1 cases.

Configured Node timeout controls inject factor three: explicit one-second and
120-second settings remain exact, an absent setting scales the default to
360000 ms, and a previous four-field admitted limits snapshot stays readable
and exact. Config presence comes from the production config parser.

Startup policy controls use an independent runner environment and injected OS
load. Absent factors sample at admission (including the droplet floor), later
loads change the next budget, explicit overrides remain effective, and the
no-output cap stays exact. The negative control passes `Number(undefined)` and
other invalid explicit factors to the real startup helper and requires refusal.

The former generated finish-barrier VM control moved to native CJS/ESM producer
controls in suite-candidate.test.ts. Those T3 cases prove actual module loading;
their coverage cannot reuse the older T1 receipt.

Browser identity controls use native EventEmitter payloads: navigation listeners
and wait predicates compare the exact returned main Frame, including its Page
and context references. The adapter decorates public methods in place; it never
replaces browser objects with proxies. Existing and newly attached Frames and
popup Pages retain their original references and keep sampling current load on
later locator actions. User callback identities remain intact for removal.
