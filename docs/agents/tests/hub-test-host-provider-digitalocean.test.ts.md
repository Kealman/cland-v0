# hub/test/host-provider-digitalocean.test.ts

T-1862 deterministic diagnosis: `digitalocean acquire survives an unrelated
reservation during <boundary> watchdog observation`, expanded for `key import`
and `droplet POST`, inserts another admitted reservation after the exact ledger
read and before the watchdog identity reply. With the stable-observation retry
disabled, both fail with `DigitalOcean create failed; retained for reap`.
The fake request counts are respectively key POSTs 0/1, droplet POSTs 0/0,
droplets 0/0, retained keys 0/1. This reproduction creates no billable droplet;
the second boundary retains an imported key for recovery. With the retry, both
create exactly one droplet and one key. This does not establish the cost of an
unobserved historical failure.

`digitalocean admission ledger retry preserves <change> policy` expands to
released, revoked, backing, reservation, cap and churn. Existing reserved capacity is never
revoked by later reservations. A new over-cap reservation is refused at
reserveHostSpend while the existing admission can send. Release, revocation and
backing changes refuse without sending; eight consecutive unrelated publications
exhaust the retry bound with HostAdmissionUnavailable. The bound also checks
15 seconds of native-I/O elapsed time between observations, rather than waiting
for FakeClock time to advance.

The fixture serializes only admission issuance, joining durable lease/watchdog
and ledger setup before issuing another fixture lease. Otherwise concurrent
fixture setup can park on spend-lock retry timers in an undriven FakeClock.
Provider acquisitions and product admission remain concurrent. The original
macOS two-second cancellation has not yet been reproduced deterministically;
the fixture wait is a candidate explanation, not a confirmed historical cause.
The original pause assertions and two-second test watchdog are unchanged;
failed recovery assertions now include the sanitized non-created results.

`digitalocean provider fixture drains queued issuance before storage and root
disposal` exercises the actual factory's staged teardown hook. The shared
`host-admission-close-contract.ts` holds issuance at its persisted watchdog,
queues a failing issue and another valid issue, starts disposal, checks the exact
watchdog file and live SQLite owner, and refuses new work. Repeated close returns
the same completion. Releasing the hold must settle all three queued attempts
before SQLite closes and the API removes its root. Matching preparation and
volume factory tests exercise the same owner. `ownAdmissionApi` joins every
issuance owner registered in its TestContext before API disposal, including the
signal cleanup path; failed drainage retains the root while API close is still
attempted. Product acquisition remains outside the setup queue.

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
requests. Missing production admission receipts are covered here and in
host-provider-digitalocean-prepare; the public CLI checks the prepared-image prerequisite.
T-1734: `digitalocean refuses invalid pool <name> before acquire or reap API calls`
proves refusal before fake API traffic. `digitalocean reaps valid pool tags and
keys exactly: <pool>` covers the 64-character boundary and embedded `-host-`,
preserving malformed sibling tags/keys and malformed UUID suffixes. These use
the scripted fake API only; no real DigitalOcean service or browser is used.

T-1756 exact cases:

- `DigitalOcean requires lease, watchdog and hosts reservation even with an injected API` and `DigitalOcean missing <field> refuses before any API call` prove the missing-receipt paths for lease, watchdog and reservation.
- `DigitalOcean binds create to durable watchdog input and discovers the exact lease after a lost checkpoint` proves the lease tag alongside existing tags and exact-tag discovery.
- `DigitalOcean watchdog deletes an admitted droplet after owner closure before machine checkpoint` observes the published watchdog birth before POST, loses the address reply, closes the lease database owner, advances the shared FakeClock to the exact deadline, then checks durable absence reads and both GET-confirmed deletions.
- `DigitalOcean watchdog with no exact tag match retains ownership and reports once` bounds retries with an abort, asserts no DELETE and an unsettled reservation. This is retained ownership, not a successful deletion.

The admission fixture scripts native watchdog birth and ledger lock identity; lease,
mirror, watchdog input, spend and receipt issuance use production modules. Its
zero-price reservations avoid consuming unrelated image-builder test budgets.
No real detached worker, provider network or browser runs in these T2 cases.
Run the unchanged host-create-ready and host-watchdog native files separately
under the preservation lock for process and fake create-to-ready evidence.

Additional T-1756 controls: `DigitalOcean admission creates at most one provider intent per lease`
checks a durable create-only lease fence with no second API call, and
`DigitalOcean rejects a lease admitted for another provider before API access`
checks the provider binding. The worker-owner-closure case also reruns the worker
from its original machine-less input and requires reuse of the bound durable
absence receipt with zero rediscovery calls. The failed-discovery-list expansion
keeps an unrelated admitted machine and key and leaves spend unsettled.

Source-review repairs add nine `DigitalOcean revalidates <component> <boundary> before provider mutations`
cases: lease, watchdog and spend before acquire, after declaration reads and
after key import. They prove zero unauthorized droplet POSTs and exact preceding
key effects. The 429/422 imported-key refusal cases assert DELETE then confirming
GET and a bound receipt; unconfirmed deletion remains owned and replays by exact
key id. `DigitalOcean machine-less watchdog replays a hub-originated absence receipt without API rediscovery`
uses the same short input shape as hub cleanup and requires settlement at its
original timestamp without API rediscovery.

`DigitalOcean cooldown key cleanup completes through <owner>` has live acquisition
and stopped-hub watchdog expansions. Both prearm an observer for the durable
refused-POST/key checkpoint, assert no delete or spend release before the exact
cooldown boundary, and require one exact-id DELETE, confirming GET and zero cost
cancellation after confirmation. The live path scripts native watchdog retirement;
the stopped path aborts acquisition, closes its lease DB and runs the worker at
the deadline. These T2 observations are not real native worker-exit evidence.
The shared cooldown regression cases observe persisted refusal before advancing
the FakeClock; no launch snapshot or pending timer count substitutes for it.
The renamed CLI image-currency case has no transferred historical timing sample;
its new ordinary/load evidence is collected by verification under its own identity.

Final source-review controls use the suite tier bootstrap in report-only mode,
with the assignment and JSONL resource receipt retained next to native child
completion metadata. A before-change control catches the ledger's native ps
probe; after injecting hostLockProcesses the same control has zero findings.
The shared lock table is separate from WatchdogProcesses and is passed through
lease creation, spend settlement/cancellation and worker options.

`DigitalOcean <mutation> revalidates <component> inside API pacing` covers key
import and droplet POST against lease, watchdog, spend and signal invalidation.
Its observer is the API's onWait receipt after the pacing timer/listener is
installed. It exhausts the actual shared budget, invalidates inside the wait,
advances the same FakeClock and asserts no additional native mutation. This is
actual-send evidence, not only API-method invocation.

Stopped-hub recovery cases cover persisted key id, lost import reply/exact name,
confirmed deletion, failed deletion, absent/failed/ambiguous lookup and reported
orphans. The unknown-POST regression hides a created droplet for one discovery,
confirms key cleanup without releasing spend, then exposes the exact tag and
requires confirmed droplet deletion before settlement. Exact-name ambiguity
never authorizes deleting either candidate. Non-billable orphan completion is
outside this item's final bar; the orphan and reason remain durable for explicit
reap and T-1765.
