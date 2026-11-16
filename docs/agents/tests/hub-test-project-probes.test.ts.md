# hub/test/project-probes.test.ts

Bare-root merge admission uses the hub's injected read-only Git probe in component
fixtures; the production boundary runs native Git. `project-probes.test.ts` proves
the injected bare fact still refuses while imports, merge preflight and cleanup
retain the zero-child census.

Run through `node hub/test/run-suite.ts hub hub/test/project-probes.test.ts`
with `CLAND_SUITE_WORKERS=4` in a sealed fixture environment. The runner captures
the native lock identity once before workers start and supplies the test-only
`CLAND_TEST_LOCK_IDENTITY`; harness imports and fixture operations still count
in the zero-child census. Direct harness callers without this runner value use
a synthetic identity. The standalone regression clears the runner value and
asserts the durable fixture lock identity while retaining the full child census.
`node --test hub/test/project-probes.test.ts` also proves this fallback directly.

The executor sweep case starts and stops two fixture lifetimes with a fake API,
waits for each completed sweep receipt, and checks the persisted ledger project
registration. The same complete child census includes its lock process-start
observations and cleanup.

`fixtureWork` composes the shared admitted-work owner before the first async
step, including initial `tempProject` acquisition. It captures a late root's
remover before the next fenced step, so cleanup does not depend on a test-context
snapshot having seen that root. It fences later steps, adopts late hubs and joins the
body and resource closure before root removal or environment restoration. Held
initial-acquisition, held-startup and held-read controls release and join their gates even on early
assertion failure, assert the retained root during drainage, then keep the final
closed-resource, fenced-next-admission and removed-root assertions. The standalone
identity case supplies `processes: undefined` to guard final default normalization.
The owner's resource closer calls the fixture's `dispose`, which joins both hub
stop and journal closure; the existing `stop` API retains its hub-stop boundary.
