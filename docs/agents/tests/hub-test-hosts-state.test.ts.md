# hub/test/hosts-state.test.ts

T2 uses projectHub, sealed disposable roots, provided test Hosts, fake harnesses,
fake lock processes and FakeClock. No provider API, real credential, GUI or
browser is used. Run the file alone with CLAND_* removed from the runner's
inherited environment. projectHub seals its fixture environment and owns root
and writer disposal. In-memory projection cases close their publisher and health
or pool runtime before SQLite storage closes.

- `hosts state connects with empty pools on previous and featured wire shapes`
  sends literal protocol-2 hellos, checks the empty standalone frame and optional
  sessions.hosts snapshot field. Keep the old request/result flow usable.
- `legacy subscription replaces hello facts and orders publications during none`,
  `registration` and `replay` use the in-memory dispatcher with a fake clock.
  Change presence, remote and host facts after hello and before subscribe;
  assert all three current replacements and idempotent subsequent subscriptions.
  Inject a newer host publication at registration or during replacement delivery
  and retain the exact ready-then-unreachable ordering assertion. No native
  process or wall-clock readiness wait is needed at this seam.
  `suiteCase` enrolls the original callback before root acquisition, bounds each
  setup/body step, joins the conversation before the hub, and retains its
  positively controlled native-launch guard through successful resource and
  directory cleanup. Each callback first fences the outer cleanup context and
  registers its root on that same context, rather than the proxy's ancillary
  hooks. A rejected close then stops before directory removal or guard release;
  settled work alone cannot authorize either. Capture acquired close owners
  before returning each step. The shared `suiteCase` helper is unchanged here.
- `host projection allows only public facts and coalesces changes within one second`
  asserts the literal public host allowlist, weighted usage, and no native identity;
  999 ms has no second publication and 1000 ms carries the changed provision state.
- `tunnel loss alerts before unreachable and clears on recovery` uses the health
  owner's synthetic status transitions. The outage start is exact; provision state
  is still ready and General has no notice when the pool alert arrives.
- `pool create stays alerted through backoff and clears after success: rate limit=false`
  and `rate limit=true` exercise refused create and provider retryAt. Wait for the
  failure owner and persisted ready receipt separately from hub-clock bounds.
- `placement, exit, login state and hot pool settings push socket replacements`
  arms each frame observer before session.launch, session.stop, sign-out and
  config.set. The fake host/login belong to this project only. Use the human CLI
  edge for the host setup command. Assert weighted slots, sessions, login counts
  and maxHosts in the received replacements.

The connect request is not a publication subscription: legacy clients send
subscribe; featured clients negotiate numbered deltas. Snapshot and connect reads
use the cached projection and perform no provider or history I/O. These targeted
receipts are component evidence, not a suite pass. Stage QA runs on integrated dev.
The first unnumbered subscription replaces the three hello facts so a publication
between hello and subscribe cannot strand the client on its old projection.

Review regressions retain the production boundaries: `pre-acquisition and confirmed
machine deletion never accrue live spend` checks positive machine receipts;
`manual create refusal alerts and unrelated outage recovery cannot settle it`
uses the shared dispatcher create owner for both failure and success; `workbench
prices come from the admitted DigitalOcean declaration checkpoint` obtains a
literal 0.25/hour declaration from the scripted fake DigitalOcean API, admits it
through HostLeases.create and observes the real socket frame. No real API call
or account credential is used. Existing lease records without the additive
billing checkpoint remain readable and unknown until an owner checkpoints a rate.
