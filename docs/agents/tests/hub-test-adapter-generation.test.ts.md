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

Retained receipt retirement is exercised over 100 facade/transport cycles. Each
cycle consumes the stopped carrier proof twice while held, then releases its last
reference and requires that exact proof to be refused. Unknown proof is refused
as a positive control. The facade census must return zero scopes, identity aliases,
current/launching entries and forward owners after explicit retirement; captured
process objects remain weakly fenced. The Sessions fixture uses an older adapter
shape plus the optional retirement hook, holds a confirmed retained obligation,
and observes the host settlement report and empty retirement iterator before
requiring both carrier proof and Sessions forward lookup to refuse replay.

The new retirement fixtures create a hostFixtureOwner before tempProject, own the
complete callback through its run method, and join that body before disposing
registered resources or storage. A root-removal guard retains the directory if
that join or disposal fails. The local production regressions run 100 successful
relaunches and 100 stop/spawn replacements with the same session id, including a
restored row stopped before any watch. They invoke production facade methods,
never the retirement hook, and require exactly one current scope and identity
throughout. The current stopped scope remains available for resume. Separate held
stop cases prove pending and failed closure remain retained; confirmed late stop
completion retires the superseded scope. These are in-process receipts, not real
native launch or memory measurements.

Failed-spawn retention uses real adapter producers: each native adapter rejects
100 times before acquisition and must leave zero facade indexes. Codex and
OpenCode exercise the real durable LaunchRecoveryPending/LaunchFiles path with a
recording local Host that refuses native spawn. Failed undo retains its scope;
completed file undo alone retains it; the captured producer's final settled
callback removes it. A local Claude fixture writes prepared files and observes
ten synthetic native refusals followed by rollback and zero scopes. A separate
unknown-outcome adapter supplies no receipt and stays retained beside a successful
replacement. All use the same pre-acquisition whole-body owner; native operations
are recording fakes, with no harness or live-hub access.
A later success after 100 settled failures leaves exactly one current generation.
A late receipt for an unknown failed attempt removes only that captured scope,
preserving the replacement's current, launch, identity and forward indexes.

The close/admission ordering regression holds a failed spawn before any returned
row, observes transient adapter close, then releases the failure and joins facade
close. Its synthetic credential file and strong scope must remain owned until the
captured rollback callback removes the file and publishes settlement. Register
spawn completion before native callbacks can re-enter close; transient close alone
is no proof that an external durable rollback owner finished.
