# hub/test/host-fixture-cleanup.test.ts

T3 lifecycle regressions for the T-1870 fixture corrections. Run alone in an
authorized preservation slot, supported Node, sealed runner environment and
load below 20. The two native setup cases each have a 60-second outer test bound;
readiness waits use shared load scaling, and cleanup joins have a five-second
bound that reports incomplete and retains the root rather than claiming closure.

`held fixture setup joins its last write before storage and root teardown`
holds the actual host-create fixture setup callback. Its owner cancellation
receipt must precede downstream storage cleanup; releasing the gate performs
the final write before the fixture rejects further initialization and removes
the root. An independent release remains registered on the outer test.

`held fixture restart joins startup before closing handles and rejects later starts`
uses actual projectHub startup, then holds its optional readiness receipt. While
the startup continuation remains held, the scratch SQLite handle and root stay
open. Further starts refuse. Release joins the continuation, closes the handle
and removes the root. `late restart acquisition stops its returned hub exactly
once before close completes` checks the same exported owner with a controlled
late acquisition, without another native process.

The `thrown code-1 upload ...` and `thrown bob-answer upload ...` cases invoke
the actual test messenger upload boundary with an injected send failure. The
shared scenario reply owner must join the failed pre-armed result and an
unrelated pending receipt, reject later uploads, and clear its fake-clock timers.
The exact rejected/joined promises are primary receipts; timer counts are
additional checks. A synchronous successful result proves pre-arming still works.

Only the first two cases require the native Git/projectHub fixture; the small
owner controls accompany that same failure-path file. No real provider,
credential, browser or live project database is used. Controlled cleanup runs
the real registered onCleanup/beforeDirectories/root phases. Every held gate is
released independently before the outer test's final cleanup joins.

Every control registers `controlCleanup` after creating its owners and before
admitting initialization, acquisition or a receipt. It releases gates and fences
the synthetic context first, then uses attempt-all joins for initialization,
startup/disposal, reply owners, individual replies and messenger loops. A failed
join does not suppress another. Synthetic cleanup keeps a hook cursor and performs
a final pass after all admitted continuations join, covering hooks registered
after cancelled initialization. These controls do not depend on reaching a later
try/finally or an explicit happy-path close.

`control cleanup drains hooks registered after cancelled fixture initialization`
cancels before the real fixture's asynchronous initialization returns. A hook
registered by that continuation must publish its closure receipt during the
final cleanup pass. `control cleanup releases first and attempts every join after
one rejects` plants a rejected cleanup owner and retains the other owner's join
and the final-pass assertion. Its independent fallback is registered before the
planted failure. These are failure-path controls, not additional scenario runs.
