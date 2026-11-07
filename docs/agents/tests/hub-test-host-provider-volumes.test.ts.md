# hub/test/host-provider-volumes.test.ts

Run `node --test hub/test/host-provider-volumes.test.ts` on supported Node 24
with targeted admission (../tests.md). This T2 filesystem fake uses disposable
roots sealed by fixtureEnvironment, no processes, sockets, browser or real-time
waits. Fake-machine socket aliases are removed before the root; all operations drain
before fixture removal. No native fake-host consumer or preservation lock is involved.

The runnable entry calls `hostProviderVolumeContract('fake', factory,
(name, run) => test(name, run))`. Keep this registrar in each provider's own
`.test.ts` file so standalone load repetitions resolve native test identities.
The contract module is provider-generic; the factory supplies region names,
readiness, a snapshot-window clock advance and normal/ignored-volume-delete
fault scenarios. The DigitalOcean volume entry also invokes it with the scripted fake API.

Required generated names:

- `fake: volumes create, list and confirm deletion`: project-scoped inventory,
  native absence after delete and idempotent delete.
- `fake: volumes enforce one attachment and region binding`: C1/C3, wrong-owner
  detach refusal, attached-delete refusal, idempotence and reattachment.
- `fake: ignored volume deletion retains inventory`: C4, incomplete deletion
  retains the exact volume record.
- `fake: volumes rate limit snapshots until retry time`: C2, exact ISO retryAt,
  snapshot identity and success at the boundary with a distinct snapshot id.

The mandatory-case negative control replaces delete with an acknowledgement
that retains inventory, runs the actual registered lifecycle case, and requires
an assertion failure. Provider-specific cases cover recreation with persisted
attachment and snapshot pacing, concurrent single-winner operations, forged
volume identity and invalid snapshot windows. Existing lifecycle tests preserve
acquisition without region. Stage QA needs no cloud credentials or CLI demo.

The faulted-record regression removes or malforms attachedTo, breaks either half
of the snapshot/timestamp pair, supplies a negative timestamp, mismatches the
snapshot time or volume identity, and corrupts its date. Every candidate must
fail inventory, attach, detach and snapshot, report incomplete deletion, and
retain the exact faulted bytes. This proves unknown ownership/pacing never
becomes permission to mutate; normal recreation remains the positive control.
