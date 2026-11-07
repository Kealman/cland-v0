# Host providers

`hub/src/host/provider/provider.ts` provisions session machines independently of
verification's `Executor`. A provider exposes `transport: 'ssh'` and acquire,
prepare, status, release and reap. Machines carry provider identity, address,
architecture (`x86_64` or `arm64`) and ISO creation time. Acquire returns created,
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
add that id to `CLAND_FAKE_HOSTS` when starting the existing fake SSH transport.
Both the provider and `createFakeHost` use `shared/fake-host-machine.ts` and the
short directory alias from `hostDirectory`. Homes, run directories, boot ids and
pinned keys retain the existing fake transport shape.

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
do not consult the create pause (API pacing still applies). Production acquisition
remains test-only; endpoint configuration and credentials do not enable it.

`earliestStop({created, idleSince, idleStopMs, declarations})` returns epoch
milliseconds: the later of `created + billingMinimumMs` and
`idleSince + idleStopMs`. Times and durations are safe nonnegative integers;
idleSince cannot precede created, and overflowing deadlines refuse. E-1534's
scheduler must call this policy when implementing `idle_stop`.

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
child arguments or returned diagnostics. Acquisition remains test-only: both an
injected API and a matching CLAND_FAKE_HOST_ROOT are required. No CLI admission
is added. The default region is lon1; fra1 and ams3 are also accepted. The
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
Outside the sealed test environment, host creation refuses before API access:
E-1534 host lease, watchdog and spend admission are required. Image preparation
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

Volume creation uses the same injected-API and disposable-root fence as machine
acquisition. It creates 1 GiB in lon1, fra1 or ams3 with cland, project and pool
tags. The provider's configured `pool` also constrains machine acquire inputs;
without it, volume creation resolves one unambiguous pool from that project's
persisted acquire intents. Missing or ambiguous pool context refuses before API
calls. No default pool is invented. CreateVolumeOptions remains unchanged.
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

Each command reads `[hosts.<pool>]` provider, size, region and transport (`ssh`
by default), and the exact `x.y.z` version strings in `[hosts] harnesses` (keys
`claude-code`, `codex`, `opencode`; omitted pins are left to the renderer defaults). The remaining pool
settings belong to the scheduler. For example:

```toml
[hosts]
harnesses = { codex = "0.50.0", claude-code = "2.0.0" }
[hosts.agents]
provider = "fake"
size = "fake"
region = "fake-1"
transport = "ssh"
```

Only the fake provider supports keyed pool preparation at this stage. It requires
the explicit disposable `CLAND_FAKE_HOST_ROOT` environment fence. DigitalOcean
is registered for machine operations but rejects keyed pool preparation before
any provider API call; configured-image observation is not a pool recipe build.
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
