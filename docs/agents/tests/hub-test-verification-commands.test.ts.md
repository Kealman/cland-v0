# hub/test/verification-commands.test.ts

Compare candidate diffs with and without a `web/` path under the shipped config:
only the former adds the named Web command after T1. Keep the no-Web plan literal
so an unconditional Web addition cannot pass.

Use the T1 admission seam with a disposable `suiteUnit` candidate and executor
receipts. Resolve the shipped repository config read-only, copy it into the
candidate, and assert the pinned batch plan runs `npm run check` before configured
tiers with the candidate as cwd. Follow the shipped package scripts to establish
that this check includes typecheck and static lints; do not run them against the
live project from a fixture. A red fake host gate must collect the timed T0
receipt without acquiring a droplet. Command records survive config changes and
store reopen. See [Queued merge batches](../tests.md#queued-merge-batches).

The host T0 clock-correction case retains its `stageCase` whole-case owner,
positive native launch guard and pre-acquisition cleanup registration. Observe
fixture setup and the persisted host-gate completion receipt with separate named
bounds from `testSetupWaitMs` and `testDeadlineMs`; their observation clocks use
shared load headroom, independently of the fake product clock correction.
Keep the exact monotonic duration assertion and empty acquisition inventory.
