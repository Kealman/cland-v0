# hub/test/codex-remote-cleanup.test.ts

T2 recording Hosts and scripted native connections prove durable/deferred
failed-handshake cancellation, admitted Host retention, mirrored hub file/PID
survival, revoked Host refusal, confirmed-exit retry and stop joining held
forward/client/subscription acquisitions. There are no native children. Unique
scratch roots and cleanup are owned by tempProject; release held producers
before adapter/storage shutdown. The role-release case holds the actual
unforward producer and checks the recovery row and role before/after its receipt.
It fails after the native client is attached and counts close calls across a
deferred retry admitted while unforward is held: native cleanup happens once,
and the row and role remain reserved until cancellation completes.
Run `node --test hub/test/codex-remote-cleanup.test.ts`.

All held gates are fixture-owned. beforeDirectories releases them before Sessions
drain and storage close; directory guards require both receipts. Two forced
assertion-failure controls exercise the actual registered teardown with held
subscription/settlement producers, observe their written completion file while
storage and roots are still open, and verify removal afterwards. Keep these
controls when changing fixture setup or ownership hooks.

T-1644 forced fixture edit: stat maps into the same scratch storage as the
recording Host fileType/read/write/remove operations. The planted hub-side mirror
and all original assertions remain unchanged.
