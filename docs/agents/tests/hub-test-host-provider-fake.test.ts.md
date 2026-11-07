# hub/test/host-provider-fake.test.ts

Run `node --test hub/test/host-provider-fake.test.ts` with supported Node 24,
using the targeted admission procedure in ../tests.md and stripping inherited
CLAND variables. This T2 file (socket API instrumentation requires the machine tier) has no network, process, browser or real-time wait;
it needs no preservation lock. It creates disposable roots, seals explicit fake
inputs through fixtureEnvironment and removes socket aliases before root cleanup.
All timing uses the same injected clock, including created timestamps and retries.

The generated cases `fake: provider contract creates, prepares, observes and
confirms release` and `fake: reap releases only the requested project and pool`
come from host-provider-contract.ts. A provider factory accepts a named fault scenario and owns isolation and the
ready callback. The entry file supplies the registrar wrapper:
`hostProviderContract('fake', factory, (name, run) => test(name, run))`.
Keep that wrapper in the runnable `.test.ts` file: native receipts must name the
entry file so the load gate can rerun each exact case there. Passing the native
`test` function directly attributes registration to the helper and loses the
standalone rerun receipt. T-1713, T-1715 and T-1717 must run the same named scenarios
against their provider factory, using the fake DigitalOcean API only:

| Factory scenario | Required observation |
| --- | --- |
| `normal` | prepare prepared/current, acquire created, ready, confirmed release and scoped reap |
| `refused` | acquire refused with a reason and a parseable ISO retryAt |
| `failed-acquire` | acquire failed with a reason |
| `delayed-boot` | booting before the ready callback, then ready |
| `never-boot` | status failed with a reason |
| `ignored-delete` | release incomplete, status not gone, reap lists the incomplete id |

The factory configures each failure at the provider's external seam (fake options
or fake API replies). It owns cleanup even for an ignored deletion; the contract
suite never reaches inside a provider to repair its state. The ready callback
advances the fake clock or observes a bounded native readiness receipt.

Provider-specific cases cover independent homes/run permissions/boot ids/keys,
the exact boot-delay boundary, refusal retryAt, never-boot and create failure,
ignored delete returning incomplete, reap after restart, environment refusal,
registry identity, and no network socket during any operation. The network case
instruments TCP connect, listen/server creation, TLS connect and fetch. Missing
inventory and ownership records must report failed/incomplete, never released.

QA can run this file in stage 1 without real SSH or a cloud account. Read the
individual case receipts rather than treating a zero exit as proof of all cases.
No CLI or browser demonstration is shipped by this item. Existing SSH lifecycle
regressions exercise the unchanged createFakeHost signature and directory shape;
heavy runs take the Coordinator's preservation lock.

The contract also registers `fake: provider declares sane prices, billing and
capabilities` in the normal scenario. The configurable declaration case proves
paid-address charges appear in the idle size price, billed stopped compute
selects `destroy`, unbilled stopped compute selects `stop`, custom pacing is
retained, and malformed billing minimums refuse construction. The pure policy
and malformed-provider contract cases are in host-provider-declarations.test.ts.

The full named contract also registers under `fake arm64 only` and
`fake x86_64 only`. Each factory declares one architecture and asserts at the
acquire seam that every normal/fault request uses it; the normal case retains
its created-machine architecture assertion. These are positive controls for
single-architecture providers in both directions. The unsupported acquisition
case separately requires failed and an empty reap inventory from the fake.

Volume contract registration and fake volume regressions live in
[host-provider-volumes.test.ts](hub-test-host-provider-volumes.test.ts.md).
They use a separate exported contract registrar in host-provider-contract.ts;
existing lifecycle factories and registration remain compatible.

`fake provider refuses underscore pools consistently with config` proves direct
acquire and reap reject `agents_1` using the shared pool grammar.
