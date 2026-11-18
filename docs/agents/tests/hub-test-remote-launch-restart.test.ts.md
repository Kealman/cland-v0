# hub/test/remote-launch-restart.test.ts

T2 restart scenarios close Sessions, its core and both SQLite connections, then
reopen the disposable database with a fresh core, Sessions and adapter. All Host
and harness boundaries are fake and the shared native launch guard stays active
through cleanup. This exercises the durable Sessions lifecycle without a native
harness or provider. It does not simulate an abrupt OS process kill.

For both adapters a failed native rollback keeps the role and exact forward.
After restart a held cancellation must retain the persisted row and role; only
its positive receipt permits their removal. The missing-generation variant removes
only the new metadata from the stored receipt, proving old receipts remain held
with the producing cleanup-incomplete cause. Rollback checkpointing is real.
The recording Host supplies a Linux boot/start-shaped birth, because the real
remote process owner refuses legacy or malformed native authority. An explicit
synthetic model keeps catalogue discovery outside this settlement seam.

Run `node --test hub/test/remote-launch-restart.test.ts` after cover quiet ends.
This all-fake seam needs no native slot (Coordinator decision c1aff916).
