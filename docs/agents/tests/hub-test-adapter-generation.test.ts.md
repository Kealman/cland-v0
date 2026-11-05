# hub/test/adapter-generation.test.ts

T2 generation ownership tests use recording Hosts, scripted RPC and a fake clock.
They start no native process. Every fixture uses fixtureEnvironment and a disposable
root, closes the adapter and joins the held read before directory removal.

For OpenCode, Codex and Claude, hold the exact old liveness request before releasing
its generation. Start the replacement watch with the same stable id and native
endpoint while that request remains held. Require separate forward ownership where
the adapter has a forward. Join the old drain, then observe a new-generation alive
request after cleanup; Codex also asserts its new native client remains open.
Repeated release must return the same receipt and never repeat native stop or
forward cancellation. Shared until/testWaitMs bounds cover setup receipts.

Run with `node --test hub/test/adapter-generation.test.ts` under the preservation
lock when a stage brief requires one. These are component receipts, not proof of
real harness or network behavior.

Equal timestamps with distinct native births must stay isolated. Releasing an unseen
retained row must not redirect id-only unwatch away from the current generation.
A held admitted stop also proves that late metadata writes and Host callbacks stay
fenced until the drain joins it. Public wrappers exercise both the routed scope and
the baseline fallback, including the no-current-generation forget path.

A facade-only fresh-resume test simulates the existing positive stop boundary,
returns a new native birth, then invokes the old-row release hook. It went red at
33f931c6f because that hook dropped the new watch. Alias retirement fixes only
facade routing; adapter same-host stop/resume/launch paths are unchanged.
