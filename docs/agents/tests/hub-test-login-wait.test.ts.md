# hub/test/login-wait.test.ts

T2: embedded projectHub, FakeClock, in-process harnesses, test messenger and
injected sign-in/host creation. No native harness, provider API, network beyond
fixture sockets, real credential, browser or web/dist. tempProject owns each
disposable root and its isolated environment. Record cland-proj- TMPDIR inventory
before and after the file; this file leaves no additional roots.

- `login waits share one create card and the final cancellation withdraws it`:
  C1/C3/C4. Session list and inbox expose the verdict reason, Agents records one
  notice for the launch, two launches share the card and final stop withdraws it.
- `login cards are scoped by pool and harness across repeated scheduler passes`:
  C3, two pools and two harnesses keep three stable ask identities through config
  changes that wake placement.
- `login add ready receipt wakes host growth, changes the reason and places the launch`:
  C2/C4. Both pools explicitly set min_hosts=0. No creator is admitted and
  host.list has no provision row while the login is absent or creating.
  login.signed-in commits ready, exactly one admitted creator saves a boot row,
  host.list observes it, the durable wait names it, then readiness publishes the process.
  The injected creator settles a binding; native attach/mount and sign-in are
  covered by login-provision-bind and login-add files, not claimed by this case.
- `login card option 1 folds once across retries and restart`: the registered
  card owner answers `Signing in`. Explicit injected preparation reserves one
  login and fails before native admission, matching the CLI's signed-out result.
  The count changes from zero open asks to one distinct `login-signin` card for
  that login's exact signed-out episode. The original `login-create` ask stays
  answered once, retries refuse, scheduler passes and restart keep that same
  episode/card identity, and the counters remain one preparation and zero native
  runner calls. The observer is armed before the answer and waits for the
  persisted login plus card, rather than elapsed time. No provider or host
  creation runs in this case.
- `login create without a sign-in owner keeps the terminal command hint and one wait card`:
  a separate in-memory LoginCards control preserves the fallback command hint,
  one answered wait-card identity through reconciliation and service recovery,
  and no login preparation. The core closes before its store.
- `login card option 2 folds once across retries and restart`: C5. The test
  messenger answers Not now; both launches remain waiting after restart.
- `login card option decline folds once across retries and restart`: explicit
  declined:true through the test messenger, preserving the wait and dismissal.
- `open login card survives restart and a later independent wait gets a new card`:
  C3/C4. Original ask identity persists; cancelling the last wait ends its group.

Run alone with CLAND_* removed from the runner environment. Setup observations
use eventually's bounded testWaitMs defaults. Boot progresses only on the explicit
fixture gate; final assertions inspect process publication and waiting rows.
