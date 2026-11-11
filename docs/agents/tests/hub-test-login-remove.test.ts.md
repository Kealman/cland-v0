# hub/test/login-remove.test.ts

T2, fake providers only. Run with supported Node 24 via
`node --test hub/test/login-remove.test.ts` after stripping inherited `CLAND_*`.
Disposable roots use the fixture environment builder and directory ownership;
clocks are shared with storage and the fake provider. No real network, harness,
volume or key is used. Sentinel key files are encrypted.

Cases:

- `remove key deletes only its encrypted file and metadata, retaining the auth store key`: local-human socket removal and preserved shared auth key (C4).
- `in-use and creating refusals retain every byte and name the host or running sign-in`: C1/C5 refusal and full fake disk/snapshot deletion (C2).
- `unconfirmed volume delete retains exact id and storage accrual, retry completes after restart`: C3/C6; fake provider ignores volume deletion, confirmed snapshot deletions stop accruing, and reopened storage retains the sign-in fence. DigitalOcean metadata selects published nonzero prices; all effects still use the directory-only fake provider.
- `a lost volume-delete response retries from its captured identity after the volume disappears`: unknown-send recovery uses the persisted exact volume identity, never inventory absence alone.

- `concurrent disk removals join one deletion owner`: duplicate requests join the same provider work.
- `pending reader intent refuses removal without clearing its owner fence`: an unbound reader intent stays owned.

- `remove CLI refuses a bound login, then removes ready storage and leaves list after release`: full CLI/list/help integration through the shared markSignedOut method.
- `removal joins an accepted snapshot and deletes its retained receipt before the row`: accepted snapshot I/O joins before storage deletion.

- `unknown snapshot keeps removal fenced through retry and reconciliation; reopen=false` and `reopen=true`: provider commits a snapshot then loses its reply. First removal, retry and reopened-store removal keep the original volume, row and orphan candidate fenced until the snapshot owner supplies its positive receipt. Both cases failed on the original head before the durable-admission fix.
- `forced fixture failure releases held writers and joins them before storage closes`: forced-failure cleanup releases the gate, joins provider/removal work and observes SQLite close, with a bounded condition wait and final ordering assertions.

- `confirmed snapshot not-sent releases admission for removal` and `confirmed snapshot refused releases admission for removal`: positive non-send outcomes settle admission and allow deletion.

- `snapshot receipt recovery restores accounting and partial-delete accrual; reopen=false` and `reopen=true`: a one-shot accounting write failure retains the positive receipt and admission; owner recovery restores the snapshot lifetime before settlement. Partial deletion retains only this snapshot, whose nonzero fake-provider metadata price continues accruing, and retry finally removes the row. Both cases failed before the accounting fix.

- `remove CLI reports remaining volume and persists the real signed-out removal receipt`: C3 nonzero CLI result, reason/host/id/store-clock receipt, capacity exclusion and durable sign-in refusal.
- `hub startup reconciliation preserves removal claim and unsettled snapshot admission`: two projectHub starts retain both owner fences and every storage resource.

- `direct removal repairs failed snapshot accounting; reopen=<false|true>; partial=<false|true>`: four cases call removal directly after failed accounting, with no successful snapshot retry. Known positive receipt repair runs inside the snapshot owner before the unknown-admission guard, accounting survives a partial delete and rerun completes. All four were red before the ordering fix. Unknown/no-receipt cases above remain fenced.

- `removal suppresses unusable sign-in cards and preserves genuine notice; <ready-full|ready-partial|signed-out-partial>`: actual CLI removal checks durable cards, inbox and notices before and after hub restart. Ready removals emit no sign-in notice; an older genuine notice stays and its card withdraws. The three cases were red before the claim-eligibility fix.
- `sign-in card eligibility uses removal claim rather than sign-out reason text`: a genuine episode with reason `removing` remains eligible until the durable claim is published; the live notification then withdraws its card while retaining receipt/notice.

Stage QA runs on integrated dev.
Check the ready-row removal path from the CLI, including `login list` absence,
with the existing fake host provider and the same supplied disposable fixture.
Full T3 belongs to the merge batch; T4 belongs to stage/epic occasions. These T2
cases do not claim native host shutdown, real provider or browser coverage.
