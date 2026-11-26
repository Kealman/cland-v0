# hub/test/after-hooks.test.ts

`hub/test/after-hooks.test.ts` is T3 because native Node test-worker exit and
reporter propagation are the boundary under test. One shared whole-case fixture
owner acquires the root, joins child close, and removes the root after writers
stop. No browser, provider, network or hub daemon is involved.

All three cases seed an inherited `NODE_TEST_CONTEXT=child-v8` into the environment
builder. Direct `--test` and `runSuite` with concurrency 1 and 2 must observe the
hook marker, assertion diagnostic, native exit 1 and fail count 1. Suite cases
also inspect the structured failure list for the file identity. No duration or
wall-clock speed assertion is made. Fixture counts are bounded to one file and
one child per case, with one suite phase for each suite case.

Named observations separately bound root allocation/adoption, fixture writing,
native launch/adoption and native close. `caseDeadlines` retains each original
promise past observation expiry, using `testDeadlineMs` for real-time headroom.
Its whole-case sequence fences admission and stops the captured child before
joining pending work. Late roots/children are adopted before returning; directory
removal waits for the original operations and native close. A missing completion
prints an incomplete diagnostic with native exit/signal and a bounded output tail.
The final exit, hook, fail-count and file-failure assertions remain unchanged.
