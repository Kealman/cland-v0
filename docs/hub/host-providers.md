# Host providers

## Provider token diagnostics

The optional `provider: "digitalocean"` request filter returns that provider's
metadata even before any pool uses it, for setup's first-pool offer. Without the
filter the reply stays limited to configured providers. Neither form instantiates
a provider or makes an API call. Older hubs may ignore the filter and return an
empty list; setup then leaves the step open.

The running hub answers `host.providers` for the local human CLI or Neovim
only. Sessions, web clients and remote ingress cannot request it. It returns
`{providers: [{provider, tokenNeeded, present, fingerprint}]}` once per distinct
provider in configured pools, sorted by name (an empty array without pools).
DigitalOcean uses stored `digitalocean.token`, resolved at hub startup (an explicit hub `DIGITALOCEAN_TOKEN` overrides it); an empty or
missing value reports `present: false` and `fingerprint: null`. A present value
reports the same 12-character SHA-256 prefix as `cland secret list`. The fake
provider needs no token and reports `tokenNeeded: false`, `present: false`,
`fingerprint: null`. An unknown provider refuses rather than claiming no token
is needed. No token value is returned by this diagnostic, and this request never
constructs a provider or makes a network call. It does not inspect the caller's
shell environment. This is a pull-only diagnostic for doctor/setup consumers;
it does not alter `host.status` or the connect sequence.

`hub/src/host/provider/provider.ts` provisions session machines independently of
verification's `Executor`. A provider exposes `transport: 'ssh'`, side-effect-free
`createAdmission()` and acquire,
prepare, status, release and reap. Machines carry provider identity, address,
architecture (`x86_64` or `arm64`) and ISO creation time. Create admission returns
allowed or refused with a reason and optional retryAt; acquire owns dynamic
resource admission. Acquire returns created,
refused (reason and ISO retryAt), or failed. Status reports booting, ready, gone
or failed. Booting is an observation; the caller owns its bounded readiness wait.
Preparation reports prepared, current or failed. Provider failures use fixed,
credential-free reasons rather than propagating native error text.

Release returns released only after a native read confirms absence; incomplete
retains ownership. The caller settles sessions, native workers and transport
writers before release or reap. Reap selects a project and pool, returns each
confirmed released id and each incomplete id, and reports failed if inventory
cannot be read reliably. A missing ownership record is not native absence.
No territory lock may span these operations.

`HostProviderRegistry.resolve({provider})` selects a hub-registered factory and
caches one instance per provider. `register` refuses duplicate names, including
the reserved fake provider. Unknown names refuse. No config parser, command,
frame or executor kind is changed by this module.

The fake provider requires an absolute `CLAND_FAKE_HOST_ROOT` in its explicit
environment; project configuration alone cannot enable it. The caller owns that
disposable directory and seals the environment through `fixtureEnvironment`.
It creates no network socket or process. Its machine address is its fake host id;
For create-to-ready, gate and delivery commands use a private `CLAND_FAKE_HOSTS`
environment; the shared runtime membership is published only after the intended
HostRecord persists. Startup and automatic fake registration fence every captured
provision-owned machine id/address, including failed or released rows without a
HostRecord. A matching registered identity may rejoin only after provider validation.
Independent manually configured fake hosts keep the existing registration path.
Both the provider and `createFakeHost` use `shared/fake-host-machine.ts` and the
short directory alias from `hostDirectory`. Homes, run directories, boot ids and
pinned keys retain the existing fake transport shape. The shared factory writes
a self-ignore in each private machine directory before keys and runtime files,
so a disposable parent Git project never stages the machine home or atomic
checkpoint temporaries.

Fake options include an injected clock, bootDelayMs, neverBoot, refuseUntil,
failAcquire and ignoreDelete. Default lifecycle operations use no real timers. Lifecycle calls on one
instance serialize and join their writes before returning. provider.json retains
the captured identity and project/pool; another instance can recover inventory.
Release removes fake keys and writes the deleted marker, then reads the marker
and confirms key absence. A transport's temporary gone marker is not deletion.
Retired directory metadata remains for fixture diagnostics; the fixture owner
removes it only after every transport and writer has stopped. One registry owns
one root; concurrent independent owners of the same fake root are unsupported.

## Extension points

Login disks use `createVolume`, `attachVolume`, `detachVolume`,
`snapshotVolume`, `deleteVolume` and project-scoped `listVolumes`. Volumes carry
an opaque id, project, name, region, sizeGiB, ISO created time and nullable
attachedTo machine id. Acquire accepts an optional region; existing fake requests
without it use `fake-1`. The fake stores the machine region privately, preserving
the existing Machine shape and requests.

Create returns created, failed, or a typed refusal with a reason and optional ISO retryAt. Attach/detach return attached/detached, failed,
or a typed refusal (attached elsewhere, region mismatch, project mismatch or
machine unavailable). Attachment requires a ready machine in the same project
and region. Same-machine attach and already-detached detach are idempotent;
detaching another machine's attachment refuses. Delete refuses attached volumes;
otherwise it returns deleted only after a read confirms absence, or incomplete.
List failures never become an empty successful inventory. Snapshot returns
snapshotted with an opaque snapshot id, volumeId and ISO created time, failed,
or refused with reason rate limited and ISO retryAt.

The fake persists volume identity, attachment and the latest snapshot receipt
under its disposable root. A shared record parser validates identity, explicit
string-or-null attachment ownership and paired snapshot/timestamp facts for
both inventory and mutations. Malformed retained state reports failed/incomplete
and leaves the bytes untouched. Its per-volume snapshotWindowMs defaults to 60 seconds
and must be a positive safe integer; the injected clock controls its exact
boundary. ignoreVolumeDelete simulates an acknowledged deletion that retains the
volume. Operations serialize with machine operations and drain writes before
returning. Recreating a provider recovers these records; independent concurrent
owners of one root remain unsupported. No operation mounts or reads disk contents.

`hostProviderVolumeContract` in the same contract module registers mandatory
volume cases. Each provider's runnable test entry supplies
`(name, run) => test(name, run)`. The factory accepts normal and
ignored-volume-delete scenarios and returns provider, region, otherRegion,
snapshotRetryAt, ready and advanceSnapshotWindow. ready observes all acquired
machines ready; advanceSnapshotWindow reaches the retry boundary using the
fixture clock. Keep all provider-specific fault injection in that factory.
See the [volume test guide](../agents/tests/hub-test-host-provider-volumes.test.ts.md).
Keep provider resource formats and tokens behind the interface. The DigitalOcean
implementation invokes `hostProviderContract` from
`hub/test/host-provider-contract.ts`. The runnable test entry passes `(name, run) => test(name, run)` as the third
argument, keeping native file identities on that entry for exact-name reruns.
Its factory supplies an isolated provider
and a ready callback which observes readiness with a bounded receipt; the fake
factory uses an injected clock. Contract assertions contain no fake directories
or DigitalOcean fields. Fault injection and transport isolation assertions live
in the provider-specific file. Pool image inputs belong to the later preparation
implementation; this foundation's prepare has no pool arguments.

## Declarations and stopping policy

Every provider exposes `declarations`: either validated, immutable values or
`{ state: "unavailable", reason }` before its first successful API read. Consumers
must narrow that state before prices, capabilities or `earliestStop` are used.
The successful shape is unchanged for compatibility. Validation comes from
`host/provider/declarations.ts`. `declareHostProvider` accepts a nonempty size
price map in USD/hour (`livePerHour`, `idleComputePerHour`), `stoppedBills`,
positive integer `billingGranularityMs` and `billingMinimumMs` (minimum must be a
multiple of granularity), `tokenConfinement` (`account`, `project` or `resource`),
positive integer `apiRequestsPerMinute` and `machineLimit`, a nonempty
`architectures` list (`x86_64`, `arm64`), and `extraAddressPerHour`. Account
confinement means the token cannot be narrowed below the provider account;
project/resource describe the narrowest scope supported. Prices must be finite
and nonnegative. Live price is the provider's live size price; idle compute is
its retained idle compute price, before the required SSH address charge.

The normalized size price includes `idlePerHour = idleComputePerHour +
extraAddressPerHour`; validation of an already-normalized declaration never adds
the address twice. `stopAction` is `destroy` when `stoppedBills` is true and
`stop` otherwise. These declarations describe policy; lifecycle `release` still
confirms removal. The fake accepts the entire input through its `declarations`
option; defaults are a free `fake` size, 1-second granularity, 60-second minimum,
resource confinement, 60 requests/minute, 100 machines, both architectures and
no address charge. These are fake values, not cloud defaults. A DigitalOcean
provider supplies pacing from `parseDigitalOceanEndpoint`'s declaration rather
than repeating its request limit.

DigitalOcean's additive `refreshDeclarations()` reads `/v2/sizes` and `/v2/account`
through the configured API endpoint and shared pacing budget. It publishes the
whole validated result atomically; concurrent refreshes share one read. Failures
retain the last good result, or the typed unavailable state when none exists.
Live prices equal each size's `price_hourly`; idle compute after destruction and
extra address charges are zero. The account's `droplet_limit` supplies capacity.
The provider declares account-confined tokens, x86_64, billed stopped machines,
per-second billing with a 60-second minimum, and the shared 250 requests/minute cap.
Acquisition loads missing declarations first and refuses while unavailable.

A 429 or a droplet-limit 422 pauses creates on that provider instance. Calls during
the pause return `refused` and the same ISO `retryAt` without sending a request or
creating a key. The API's retry headers set the deadline; absent usable headers,
the create pause uses 60 seconds. Other 422s remain failures. After the deadline,
each caller may try once; no automatic replay or retry cascade occurs. The pause
uses the injected clock, independently of shared API pacing, and concurrent
refusals can only extend its deadline. An address-observation failure after a
successful create retains the accepted identity for reap and returns `failed`,
not a retryable refused-create outcome; a 429 still pauses later creates. Status and cleanup
do not consult the create pause (API pacing still applies). Production acquisition requires durable host admission; see
[DigitalOcean host admission](digitalocean-host-admission.md).

`earliestStop({created, idleSince, idleStopMs, declarations})` returns epoch
milliseconds: the later of `created + billingMinimumMs` and
`idleSince + idleStopMs`. Times and durations are safe nonnegative integers;
idleSince cannot precede created, and overflowing deadlines refuse. The [pool idle-stop scheduler](pool-idle-stop.md) calls this policy.

The reusable contract includes `provider declares sane prices, billing and
capabilities`, using `validateHostProviderDeclarations` on the normal factory
scenario. Its other named fault scenarios and lifecycle outcomes remain intact.

Contract lifecycle requests select a validated declared architecture and compare
created machine architecture with that request. Single-architecture providers
need not support the other architecture. The configurable fake returns a typed
failed acquisition for an unsupported architecture without creating a machine.

## DigitalOcean machines

The registry includes `digitalocean`. It uses the executor's DigitalOceanApi,
endpoint parser, shared token budget and confirmed DELETE/GET operations.
The hub environment supplies DIGITALOCEAN_TOKEN; no token enters user-data,
child arguments or returned diagnostics. Acquisition requires the hub’s lease, armed watchdog and hosts reservation
receipts; see [DigitalOcean host admission](digitalocean-host-admission.md). The default region is lon1; fra1 and ams3 are also accepted. The
configured size and image select the droplet; each acquire generates a new key.

Provider state lives in `.cland/host-provider/digitalocean` under its root.
Private intent records precede key import and droplet creation, recording the
name and cland/project/pool/intent tags. Pool-qualified project-prefixed key names
allow orphan cleanup without deleting another pool's keys. The host-record owner supplies
`admitReap(target, remove)`: it holds its ownership/admission lock, checks the
current machine id and key name, then either skips (undefined) or awaits remove
through both confirmed deletions before releasing its lock. Host ownership cannot
be published during that removal. Before calling remove, the owner persists a
retirement reservation for both exact identities. An incomplete result, exception
or restart keeps that reservation and refuses matching claims even after the lock
is released. Reconciliation may clear it only on released, after both absence
GETs. Key-only cleanup uses the same admission and rechecks a previously observed
droplet/key association; a list omission cannot settle that retirement. An
omitted integration means no host records exist; a legacy ownedMachineIds
snapshot without admitReap fails closed. Pool identity is parsed exactly using
the fixed UUID suffix, including pool names containing `-host-`. Missing inventory fails closed.
Release confirms both droplet and key absence; an incomplete deletion retains
its intent and keys for reconciliation. A lost create response remains findable
by tags on the next reap, including after provider recreation.

`cland host prepare [pool]` builds DigitalOcean pool images through the executor's
builder admission, lease, watchdog and spend accounting. The agent-host recipe
uses the configured harness pins, then runs `[verification] provision` as root
and `prepare` as runner against the committed territory source. Local lock and
provision inputs must match that source. Preparation transfers the snapshot to
the pool region and tags it `cland`, project and pool. Records and recovery
ownership live under `.cland/run/hosts`, separate from executor snapshots.
The pool recipe key covers the complete rendered agent recipe and effective
harness defaults; the executor retains its legacy recipe digest. An unchanged
pool key in the required region returns current without creating resources.
A region change transfers and republishes the same image after region visibility
is observed. Replacement
publishes the new record before retiring the previous image; retirement stays
recorded until its by-id GET confirms absence, including split DELETE404 replies.
Restart and periodic executor reconciliation retry pool recoveries, including
removed pools, without another prepare command. Active pool preparations own
their snapshot storage through completion; reconciliation skips those owners.

The SSH prelude loads its packaged `cland-auth.sh` only when rendering, so CLI
imports do not require render-only assets. Runtime bundles include that helper;
the source-release installer preserves the tracked source tree.

DigitalOcean host creation requires a current pool image and sends that image id
with the provider-rendered SSH prelude, automount removal, auth helper/sudoers and
Codex file credential store. Missing or stale images name `cland host prepare`.
Host acquisition refuses before API access unless the lease, armed watchdog
and hosts reservation receipts are supplied; see
[DigitalOcean host admission](digitalocean-host-admission.md). Image preparation
remains available through the executor's existing builder controls. A legacy
configured-image receipt does not satisfy a pool recipe key.

The advertised API budget uses the shared production endpoint default. An explicit
test endpoint declaration may change transport pacing; it does not change the
provider's advertised production capability.

Provider intents checkpoint pending retirement before deletion and remain pending
until the owner callback returns its durable settlement acknowledgement. Pending
intents reconcile independently of droplet/key inventories, including after both
resources have disappeared or the owner acknowledgement was lost.

### DigitalOcean volumes

Volume creation requires `CreateVolumeOptions.admission` with a nonempty login
name, matching project and a valid pool. The login owner supplies this context;
a configured provider pool must match. Missing or mismatched admission refuses
before any API call. Creates allocate 1 GiB in lon1, fra1 or ams3 with `cland`,
project and pool tags, including on the production provider path. Tests inject
only the scripted fake API and never allocate cloud resources.

`fromSnapshot` accepts a snapshot ID or receipt. The provider reads the snapshot,
validates a supplied receipt's source volume and creation time, and POSTs
`/volumes` with `snapshot_id` in the snapshot's region. `listSnapshots(volume)`
reads `/volumes/<id>/snapshots` after validating volume ownership; a missing
volume returns `volume-gone`. Snapshots survive source-volume deletion and
`getSnapshot(id)` reads them independently. `deleteSnapshot` uses
`DELETE /snapshots/<id>` followed by GET; only GET 404 confirms deletion.
An ignored DELETE, failed confirmation or unknown outcome stays incomplete.

Snapshot creation and owned-volume history listing persist a root-local ownership
receipt (project, source volume, creation time and region). Lookup, restore and
deletion require that receipt; unknown snapshot IDs fail closed. Restore matches
the target project to the retained source project, including after source-volume
deletion and provider restart. Object receipts must match volumeId and created
before deletion; a fresh provider read validates native identity before DELETE.
Ownership receipts remain after deletion for idempotent absence confirmation.

Machine and volume creates share the provider creation pause. All volume calls
use DigitalOceanApi's endpoint/token pacing budget. The provider holds the raw
API: only action polling passes an explicit deadline. The additive volume
argument map also keeps the executor's bounded-provider wrapper compatible.

Attach and detach observe machine readiness, project, pool and region identity,
refuse another attachment as `attached elsewhere`, and await the DigitalOcean
action's `completed` receipt with a 60 second deadline. An errored action or
unknown response fails conservatively. List filters by project tag; delete
confirms absence with GET even when DELETE returns 404. Snapshot's 429 returns
`rate limited` and the API header's retryAt. Repeated calls for that exact
volume identity return the cached refusal before any wire call until expiry;
expiry permits an explicit caller retry and never automatically replays it. The fake models a 10 minute snapshot
window, a single attachment and opt-in split-delete/lost-reply faults, all off
by default. The lost-create reply occurs after the fake volume is stored.
No cloud operation or disk contents are exercised by the tests; see the
[DigitalOcean volume cases](../agents/tests/hub-test-host-provider-digitalocean-volumes.test.ts.md).

## Pool images

The local human CLI or Neovim can submit `host.prepare`; sessions, host-secret
connections and web/remotes cannot. `cland host prepare [pool]` prepares one pool
or every configured pool. Unknown names report the configured choices. A running
hub with this frame is required; older hubs return their unsupported-frame error.

Pool names use 1–64 ASCII letters, digits and hyphens, starting with a letter
or digit. Config reading refuses other names (including underscores) and names
the allowed characters. Snapshot storage, provider tags, key identities and
orphan recovery use the same parser.

Each command reads `[hosts.<pool>]` provider, size, region and transport (`ssh`
by default), and the exact `x.y.z` version strings in `[hosts] harnesses` (keys
`claude-code`, `codex`, `opencode`; omitted pins are left to the renderer defaults). Pool capacity and lifecycle settings are described under [pool configuration](#pool-configuration). For example:

```toml
[hosts]
harnesses = { codex = "0.50.0", claude-code = "2.0.0" }
[hosts.agents]
provider = "fake"
size = "fake"
slots = 8
region = "fake-1"
transport = "ssh"
```

The fake provider requires the explicit disposable `CLAND_FAKE_HOST_ROOT`
environment fence. DigitalOcean keyed preparation uses the executor-backed pool
image flow described above; configured-image observation is not a pool recipe build.
Pool image keys include the running Node version, package-lock.json byte digest,
sorted harness pins, the generic recipe digest and `[verification] provision`
path/content digest. Recipe and provision hashing and stale names come from the
executor preparation code. Project commits are excluded: code arrives at ready.
A configured hook must exist; an absent lock or hook is represented as absent.

The fake provider records each pool key under its root's `images/`, with its
build time. `buildTimeMs` defaults to zero; tests can inject `wait` to advance a
fake clock, while an explicitly configured delay without `wait` uses a timer.
The hub writes `.cland/run/hosts/<pool>-image.json` only after provider completion.
CLI replies name `prepared` or `current` and changed key parts (`node`, `lock`,
`recipe`, `provision`, `harnesses`). Calls serialize per project; shutdown drains
admitted preparations before storage closes.

## Create to ready

`cland host create [pool]` and `cland host list [--json]` (`host.create`, `host.list`)
require the local human CLI or Neovim. Sessions, host-secret connections, web
and messenger remotes are refused. Creation supports the directory-only fake provider under its explicit
fake-host environment and DigitalOcean under durable admission
([details](digitalocean-host-admission.md)). The omitted pool selects
`agents`, or the sole configured pool; ambiguous pools require a name.

Creation compares the prepared pool key with the current Node, lock, recipe,
harness pins and provision hook. A stale or absent key names
`cland host prepare <pool>` before acquisition. It renders a fresh pinned host
key in the prelude user-data. Before acquiring the machine, it reserves hosts
spend, publishes the lease, arms the detached watchdog and passes the durable
admission through `createAdmission` and `acquire`. See
[DigitalOcean host admission](digitalocean-host-admission.md).
The SSH gate allows five minutes for boot and successful strict pinned-key
admission, before any runtime delivery or registration. A mismatching key never
starts the supervisor. Whole-runtime delivery then precedes registration and
runtime add. Ready waits for authenticated tunnel readiness and the territory
clone when the project has a territory.

Lifecycle records live in the `provisioned_hosts` table in hub.db, independently
of the public SSH registration shape, and retain provider, pool, size, region, machine identity,
creation time, state and failure/release outcome. States are `creating`,
`booting`, `connecting`, `cloning`, `ready`, `failed`. A failed machine is released
only after positive complete runtime settlement (known inventory, no timeout or
leftovers); unknown delivery or cleanup retains it as
`release: incomplete`. `host list` reads these records and reports uptime in
seconds for ready hosts and the provider's declared live USD/hour for its size.
Unavailable facts are `null`. It does not implement `host status`.

See [create test cases](../agents/tests/hub-test-host-create-ready.test.ts.md).

Final ready publication is one SQLite checkpoint conditional on the captured
registration id/address still being registered. Revocation changes the provision
state in the same database statement; shutdown aborts readiness before that
checkpoint. Bootstrap keys remain private under `.cland/run/host-provisions/<id>/`.

At startup, interrupted creating/booting/connecting/cloning checkpoints become
explicit failed/incomplete records. Unknown acquisitions, copies and installs
are retained, with no acquire/delivery replay or inferred release. Registered
fake machines first lose any preexisting provision-owned environment membership,
then restore it only after matching the durable
registration/address and provider machine identity. Physical addresses never
mint duplicate registrations. A missing fake environment or unverifiable machine
is retained as failed/incomplete and is never opened through real SSH fallback.

## Destroying a provisioned host

The local human CLI or Neovim can run `cland host destroy <id>` (`host.destroy`).
Sessions, host-secret peers, web and remote clients cannot destroy hosts. Unknown
provision ids are refused. Destruction works when the tunnel is down and does
not require a reachable agent or a current pool image.

The hub checkpoints `destroying`, aborts and joins an active creation for that exact
project/provision id, then removes the runtime owner through the existing
revoke settlement, then calls the recorded provider's `release`. Each positive
machine/key absence read produces a `host-destroy` event naming the read. The
machine read is also persisted as `machineDeletionRead` before remaining session
rows settle as exited; an incomplete native inventory alone cannot settle them.
The existing Sessions unreachable-generation owner validates the adapter receipt
and drains identity-bound local forwards. Cleanup streams retained generations,
including those whose display row moved; only an exact current generation can
receive the exited update after an asynchronous release. Failed cleanup retains
the obligation and leaves destruction incomplete.
After both deletions are confirmed the provision record becomes `destroyed`.
Records remain in `host list` as lifecycle history. If deletion cannot be
confirmed, the record stays `destroying` with `deletion not confirmed`; its
unconfirmed sessions stay fenced. A second destroy retries the removal and
provider release. A repeated destroy of a destroyed record retries any retained
login cleanup without writing the provision or repeating machine release; it
always preserves `destroyed`. A restarted ambiguous
acquisition with no returned machine remains deletion-not-confirmed; absence of
a machine id supplies no non-admission receipt.

The fake provider reads its machine tombstone and stats all associated key files
for absence. DigitalOcean release uses the API's confirmed DELETE/GET paths,
logging GET 404 for the droplet and its key. DigitalOcean creation
uses [durable host admission](digitalocean-host-admission.md). No provider
credentials or private key bytes appear in the deletion evidence.

### In-hub creation and clock

`createHost` accepts optional `settings` (a parsed HostPool), `clock`, and
`onCreating(id)`. With settings supplied it uses that pool object; the prepared
image key still reflects the project's recipe and harness pins. The callback
runs after the `creating` provision checkpoint and cancellation owner are saved,
before provider acquisition. A thrown callback follows failed-create cleanup.
Without settings, the manual CLI keeps its configured-pool selection.

The daemon passes its clock to creation and `projectSshHosts` tunnel readiness.
Both polling deadlines remain 300000 ms; creation retains its explicit `gateMs`
option. Native command I/O and transport deadlines use real time. Dispatcher and
serveProject accept an injected `createHost` function for callers testing host
admission without native creation. No wire reply or provision-record shape changes.

Readiness belongs to the host runtime owner as well as its optional caller.
Quiesce aborts down-tunnel polling even on a frozen clock; close/remove join
active readiness after closing the Host client and before reporting completion.


## Pool configuration

`cland init` writes `[hosts] daily_spend_usd = 3` and `lease = "12h"`
without a pool. Managed `cland update` adds these defaults while retaining pools,
harness pins and unknown fields. Existing unmanaged files stay unchanged.
Start a pool with `cland config set hosts.qa.provider fake` (or `digitalocean`).
Provider is required. Other defaults are size `s-4vcpu-8gb`, region `lon1`,
transport `ssh`, max_hosts 2, idle_stop `20m`, spread false. Slots default to 4
for `s-2vcpu-4gb`, 8 for `s-4vcpu-8gb`; other sizes require explicit positive
slots. The agents pool defaults min_hosts to 1; other pools to 0. Host counts
are nonnegative integers with min_hosts no greater than max_hosts.

`hosts.lease` is a positive integer duration with s/m/h/d suffix, at least 30s;
idle_stop uses the same duration syntax. Spend is finite and nonnegative.
Optional `hosts.weights` overrides positive finite weights for claude-code,
codex and opencode; scheduler owns the defaults. `hosts.harnesses` keeps exact
x.y.z pins. Pool names use 1–64 ASCII letters, digits and hyphens, starting with
a letter or digit. `outbound` remains refused. Pool settings validate through
the same parser on startup, reload and config set; config set publishes them
immediately to the running configuration owner. This configuration alone does
not enable production DigitalOcean creation or network access.

## Placement decision core

`host/scheduler.ts` exports the pure `decidePlacement` policy. It accepts one
pool snapshot and one launch harness and returns `place` with a host id, `create`,
or `wait` with a reason. It does not launch, provision or reserve capacity.
Default weights are Claude Code 1, Codex 0.5 and OpenCode 0.75; partial weight
overrides replace individual defaults, and a custom harness needs an explicit
positive finite weight. Missing or invalid selected weights are errors.

Callers map lifecycle states to ready, booting or unavailable and supply slots,
`usedMilli` and `promisedMilli` for every host in the pool. Capacity uses integer
milli-slots: convert each harness weight once with the exported
`harnessWeightMilli(harness, overrides)` (`Math.round(weight * 1000)`), then sum
those integers. Overrides are honoured to 0.001 slot; finer values round at
conversion, including rounding very small positive weights to zero. Defaults
convert to 1000, 500 and 750. `usedMilli` counts running sessions;
`promisedMilli` counts reservations for earlier waiting launches. The caller
must reserve those integers before its next decision. The exact fit rule is
`usedMilli + promisedMilli + weightMilli <= slots * 1000`, without an epsilon.
Snapshot totals and converted capacity must be nonnegative safe integers;
weights that exceed safe milli-slot capacity are errors.

Ready hosts with room come first, ordered by greatest used plus promised
milli-slots for dense placement or least for spread;
equal weights preserve snapshot order. Healthy `serves` bindings precede
`can-bind` hosts within each readiness class; `signed-out` and `no-login` hosts
are skipped. PoolRuntime supplies login metadata verdicts. Callers without
metadata retain the default hook, which serves every harness.

With no ready host, eligible booting room yields `waiting for host <id> to boot`
before another create. Ready plus booting hosts count toward `max_hosts`, even
when full or ineligible. Demand creation also requires a free login for the
launch harness in the pool's provider and region. Without one the result is
`waiting for a login <harness>`. Ready exclusive disks supply one free binding;
creating, pending and signed-out disks supply none. Ready or in-use non-exclusive
disks and OpenCode keys do not exhaust capacity. Keys have no region restriction.
Below the maximum with login capacity the result is `create`; otherwise it is
`waiting for a host`. Creation revalidates login capacity at admission. Unavailable hosts offer no room and do not count in
that snapshot. `min_hosts` is carried in the pool policy for callers; maintaining
the floor is a separate lifecycle operation, not an extra creation decision for
one launch. This core alone does not enable automatic or production host creation.


### Pool host lease usage

Manual `host create`, startup `min_hosts` and demand scale-up share the hub's
live usage predicate. A running or unresolved native generation, or a held
placement promise, keeps its host renewing. Ready minimum hosts prefer those
with live usage, then older creation timestamps (host id breaks ties). A newer
idle host cannot displace an older minimum host. Idle hosts beyond this minimum
stop renewing and follow the existing expiry and confirmed-destruction flow.
The predicate reads current pool settings, so configuration changes apply to
existing renewal owners too.


### Fake login-volume contents and snapshot history

`CreateVolumeOptions.fromSnapshot` accepts a snapshot ID or a `VolumeSnapshot` receipt. The fake
copies its saved contents into a new detached volume in the snapshot's region;
project ownership must match and the requested size must hold the source.
Without a snapshot, contents start empty. `listSnapshots(volume)` returns all
retained receipts oldest first. `deleteSnapshot(snapshot)` confirms absence by
reading after deletion and otherwise reports incomplete. Deleting a snapshot
keeps the volume's snapshot pacing window. Listing is per live volume: after
volume deletion it returns `{state: 'volume-gone'}`. Snapshots survive volume
deletion and are addressed by ID, with no deleted-volume index. `getSnapshot(id)`
returns `{state: 'found', snapshot}` or failed; clone and delete also accept IDs.
Consumers retain snapshot IDs in their login records. Snapshot deletion keeps
its own metadata until live-volume history publication succeeds; an ID-only retry
after provider recreation can finish an incomplete deletion.

The fake's test-only `volumeContents(volume, machine)` returns
`{state: 'ready', directory}` only for the attached, ready machine with matching
identity; other access returns failed. Callers drain file users before detach,
release or deletion. Machine release detaches volumes and preserves contents;
volume deletion removes contents. Fake volume records accept the legacy single
snapshot receipt and the additive history list; invalid retained records fail
closed. Old receipts without saved contents can be listed and deleted, but
cannot supply a clone.

DigitalOcean implements snapshot history, lookup, restoration and confirmed
deletion through its API; see [DigitalOcean volumes](#digitalocean-volumes).


### Snapshot send authorization

`HostProvider.snapshotVolume(volume, options?)` accepts optional synchronous
`options.authorize()`. It runs immediately before the snapshot native effect.
DigitalOcean uses the API mutation scope after its owned-volume GET and every
pacing wait; the fake checks before copying volume contents. A throwing check
returns `{state: 'not-sent', reason: 'snapshot authorization refused'}` without
sending the snapshot. Omitting the options preserves the prior behavior.
The hub snapshot scheduler uses this boundary to fence a queued send when release
has begun; see [login backups](logins.md#backup-snapshots).

Provider declarations require nonnegative `volumePerGiBMonth` and `snapshotPerGiBMonth` (USD/GiB-month); a missing or invalid value names its key. Fake declares zero, and DigitalOcean declares 0.10 and 0.06 respectively (checked 2026-11-11). These reporting prices do not enter machine reservations.

`hosts.relaunch_after_signin` is a boolean defaulting to false, omitted by init.
Config set and reload apply it immediately. Successful CLI/card disk renewal
then relaunches live sessions of that harness on the writer host, resuming their
conversations in their existing worktrees. See [renewal](logins.md#relaunch-after-sign-in).
