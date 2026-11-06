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
failAcquire and ignoreDelete. There are no real timers. Lifecycle calls on one
instance serialize and join their writes before returning. provider.json retains
the captured identity and project/pool; another instance can recover inventory.
Release removes fake keys and writes the deleted marker, then reads the marker
and confirms key absence. A transport's temporary gone marker is not deletion.
Retired directory metadata remains for fixture diagnostics; the fixture owner
removes it only after every transport and writer has stopped. One registry owns
one root; concurrent independent owners of the same fake root are unsupported.

## Extension points

T-1711 adds declarations to this interface and T-1712 adds volume operations.
Keep provider resource formats and tokens behind the interface. T-1713 registers
the DigitalOcean implementation and invokes `hostProviderContract` from
`hub/test/host-provider-contract.ts`. The runnable test entry passes `(name, run) => test(name, run)` as the third
argument, keeping native file identities on that entry for exact-name reruns.
Its factory supplies an isolated provider
and a ready callback which observes readiness with a bounded receipt; the fake
factory uses an injected clock. Contract assertions contain no fake directories
or DigitalOcean fields. Fault injection and transport isolation assertions live
in the provider-specific file. Pool image inputs belong to the later preparation
implementation; this foundation's prepare has no pool arguments.
