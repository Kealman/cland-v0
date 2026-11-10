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


T-1772 adds the opt-in fourth registrar argument for snapshot operations; the
fake enables it, while the unchanged DigitalOcean registrar retains the earlier
volume contract. New generated case `fake: snapshot history, cloning and confirmed
deletion` proves oldest-first history, region inheritance, confirmed removal and
failure to clone a deleted snapshot.

Additional standalone names for stage QA:

- `fake login contents survive snapshots, cloning and machine release`: empty
  contents, attached-machine access, wrong-machine/detached refusal, immutable
  snapshot copy, reattachment after release and contents removal on deletion.
- `fake snapshot deletion confirms absence and retained history fails closed`:
  ignored snapshot deletion is incomplete; old single-receipt records read;
  malformed histories block list/delete/clone and retain exact bytes.

All cases use sealed disposable roots and no native lifecycle processes. Run
individual names with `--test-name-pattern` before the file path. No browser,
cloud account, native preservation slot or duration allowance is required.


The decided surviving-snapshot contract adds `surviving snapshot IDs support
lookup clone and delete after volume deletion`: live-volume listing becomes
`volume-gone` after deletion while the retained ID supports lookup and cloning
with exact saved contents, region inheritance, incomplete ignored deletion,
confirmed deletion and idempotent delete. The generic opt-in contract also
proves ID-based survival. DigitalOcean exercises the same contract in its own
provider test entry.


`snapshot ID deletion retries history publication after provider recreation`
injects a failed live-volume history write after snapshot contents removal. The
first deletion reports incomplete and retains history. A fresh provider retries
with only the ID, publishes the empty history and confirms snapshot absence.
The fake's `failSnapshotHistoryWrite` fault affects only that publication.

T-1782 removes the stage-1 unsupported-operation control. The production-path
DigitalOcean replacement lives in `host-provider-digitalocean-volumes.test.ts`:
`digitalocean: snapshot history, cloning and confirmed deletion` plus
`digitalocean snapshot receipts and source project fence destructive use across restart`.
The original control is historical stage-1 evidence, not a current expectation.
