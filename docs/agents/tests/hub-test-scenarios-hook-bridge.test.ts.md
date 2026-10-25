# hub/test/scenarios/hook-bridge.test.ts

The real bridge reattaches across two sequential in-process native project hubs,
then expires while its harness parent remains alive. Before starting the second
hub, the fake Claude provider holds `agents --json` using `agents-hold`; setup
waits for its `agents-started` PID receipt. Stop must reap that transient query,
while preserving the harness session. An explicit resource check immediately
after stop prevents the later bridge-expiry wait or fixture cleanup from hiding
a surviving native deadline.

T-1261's red control held the query on Darwin arm64 and reported `projectHub
leaked resources` with `PROCESSWRAP`, `PIPEWRAP` and `Timeout`. Temporary
`async_hooks` creation stacks identified Node's `execFile` `delayedKill` timer
(15000 ms), created by `ClaudeCodeAdapter.#run` for `#agents`. Without the hold,
the command usually completed before the final leak check; Linux covers exposed
the window intermittently. The production fix kills transient commands and
awaits their callbacks, which follow child close and clear the native timeout.
The T2 scheduling regression proves cancellation/draining without a real child.

T-1267 arms that hold before restart so native startup resume can finish during
stop. Its red creation stack names `ClaudeCodeAdapter.watch`, called by the
session layer's live-process fallback after adapter closure: that restarted the
polling interval. The session layer fences both native resume completion and
the later identity-probe completion before watching or publishing. The T1
held-result matrix in `lifecycle-serialization.test.ts` covers found, alive and
identity-probe results. This scenario retains opt-in async-hooks creation stacks
in the resource assertion's failure message; successful runs print no stacks.

Run standalone with `node --test hub/test/scenarios/hook-bridge.test.ts`.
Linux evidence comes from mode-free task verification on the droplet executor
with two workers; local Darwin results are separate evidence.
