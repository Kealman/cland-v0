# hub/test/host-provider-digitalocean.test.ts

T2, macOS and Linux. Run `node --test hub/test/host-provider-digitalocean.test.ts`
with a supported Node 24 runtime and a fixtureEnvironment-sealed launcher (shared
procedure in tests.md). No credentials, real API, native machine or browser is
needed. The fake API uses `machine: 'scripted'`, a FakeClock and disposable state.
The provider writes only in that state; fake close drains work before removal.

The `digitalocean:` cases come from hostProviderContract: declarations; prepare,
create, observe and confirmed release; project/pool reap isolation; refused and
failed acquisition; delayed boot, never boot and ignored deletion. Scenarios map
to fake API faults, not parallel provider behavior. Ready explicitly GETs every
created droplet after making boot observable; no wall-clock sleep is used.

The remaining exact case names in the test entry cover C1 configured inputs,
region refusal and unique SSH keys; C2 split DELETE 404/GET 200 for both resources;
C3 tagged orphan and pool-prefixed key deletion with no intent, and retained host
ownership; C4 lost create response recovered after provider recreation; C5
sentinel-free output/errors/request bodies and no native launch; missing images;
and registry caching plus the production acquisition fence. Use Node's
`--test-name-pattern` with the full name to rerun one case.

Preserve executor-droplet, executor-prepare and executor-safety unedited under
the stage's preservation lock. Also run digitalocean-pacing, digitalocean-endpoint,
host-provider-fake, host-provider-declarations and host-provider-volumes one file
at a time. T0 includes lints and typecheck. These are required preservation
receipts, separate from the new provider's T2 receipt. Stage QA runs affected
coverage on dev; this item supplies no real cloud or production admission proof.

Review regressions cover ownership published while inventory or a preceding
delete is held, an owner fence retained through both GET absence receipts,
key-only owner admission, legacy snapshot-only fail-closed behavior, and the
overlapping pools `agents` / `agents-host-x` with and without local intents.

The incomplete retirement regression persists an owner reservation, refuses claims
after incomplete removal and owner/provider recreation, withholds a droplet from
list inventory, and keeps claims refused until both deletion GETs confirm absence.

The empty-inventory recovery case injects a transient final key GET failure,
recreates the owner/provider and proves both positive absence GETs settle the
persisted pending target even when neither inventory lists a resource.

Machine fixtures seed prepared pool image records. Configured base images never
override those records. Pool builds, keyed reuse and retirement now run in
[the pool preparation entry](hub-test-host-provider-digitalocean-prepare.test.ts.md).
The common contract starts at current for this already-prepared fixture.

T-1715 declaration and pause cases (exact generated names):

- `digitalocean declarations load API prices and limit atomically and retain the last good read`: two size prices, API machine limit, fixed billing/capability facts, 429/lost-reply/503 preservation.
- `digitalocean unavailable declarations refuse safely and recover without partial publication`: typed initial failure, no POST, malformed account rejection, shared concurrent refresh, last-good atomic retention.
- `digitalocean initial declaration 429 holds subsequent creates without a request`: missing declarations load on acquire, typed refusal and recovery at the deadline.
- `digitalocean 429 pauses every create until retry time without POST cascades or token leaks` and `digitalocean 422 pauses every create until retry time without POST cascades or token leaks`: second/third requests (different pools) return immediately with no request; 1999 ms stays paused, 2000 ms allows exactly one POST per create. Sentinel never enters refusal text. New fake create-limit identity and retry headers are opt-in.
- `digitalocean unrelated 422 is failed and does not pause creation`: ordinary validation refusal does not become a droplet-limit cooldown.

The normal DigitalOcean contract factory explicitly loads declarations before
validation and architecture selection. The fake provider retains its synchronous
successful declaration shape. These are scripted T2 receipts, not real cloud
pricing, Linux native process or browser evidence. Stage QA can rerun this entry
and the unchanged preservation files at the integrated head.

Review controls:

- `digitalocean accepted create followed by address GET 429 retains ownership and pauses later creates`: successful POST followed by observation refusal returns failed with no retryAt; later acquire is paused without API work; original droplet/key are reaped after the deadline without another create.
- `digitalocean held create refusal cannot shorten a concurrent declaration refresh pause`: arm a held POST observer, complete a concurrent refresh's 10-second refusal, then release the shorter 2-second create refusal. Both the original and later callers report the 10-second deadline with no API work before it; exactly one new POST is sent after it.

The held-response fixture prearms release and join of the provider acquire before
API close/root removal, and joins in finally on exceptional setup exits. Setup
uses testWaitMs with an explicit 2x factor on every executor; the outer watchdog
includes that same scaled setup budget plus separate remaining-work/drainage
headroom. These are setup/watchdog caps, not the exact 2s/10s product boundaries.

The shared `create admission is allowed without side effects` case compares the
factory's observable file/API effects before and after `createAdmission()`. The
fake factory snapshots its directory; DigitalOcean also counts scripted API
requests. Production DigitalOcean refusal parity with acquire is covered in
host-provider-digitalocean-prepare and the public create CLI admission test.
T-1734: `digitalocean refuses invalid pool <name> before acquire or reap API calls`
proves refusal before fake API traffic. `digitalocean reaps valid pool tags and
keys exactly: <pool>` covers the 64-character boundary and embedded `-host-`,
preserving malformed sibling tags/keys and malformed UUID suffixes. These use
the scripted fake API only; no real DigitalOcean service or browser is used.
