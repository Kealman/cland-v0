# hub/test/users.test.ts

`hub/test/users.test.ts` is T1: Store's public users API on in-memory SQLite.
Prove the sole admin role, deterministic first-user identity, collision refusals,
mode fence and retained attribution rows. Register ordered synchronous revokers
through onReset; a throwing revoker must leave the durable users fence intact.
The explicit web/gateway inventories retain CLI-only authority for the new frames.
