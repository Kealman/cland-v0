# hub/test/login-release.test.ts

T2: directory-backed fake provider, recording Host, Store and shared FakeClock.
Run `node --test hub/test/login-release.test.ts` on supported Node 24 with local
CLAND variables stripped. No native harness, browser, mount or network is used.

- `host stop unmounts and detaches the same volume before deletion` proves C1
  through the shared destroy boundary used by host.stop and host.destroy.
- `two login unmounts run concurrently before detach` proves C3 with held
  operations; both unmount entries precede any detach, and cleanup joins them.
- `writers remaining retain host and binding and emit one notice` proves C6,
  including a repeat attempt without another Coordinator notice.
- `lost host retains settled binding until detached inventory` proves C5's
  delayed provider read; the next positive detached read frees the disk.
- `health 15-minute loss reaches login release` and `health gone receipt reaches
  login release` exercise HostHealth with its exact FakeClock deadline and the
  shared loseHost path. Persisted destroyed/ready records are the final receipts.
- Pending binding, thaw refusal, no-owner/no-login, provider-gone and concurrent
  stop cases preserve the integration fences.

Setup waits use eventually/testWaitMs. No wall time establishes lifecycle truth.

`refusal then hard deadline emits exactly one destruction notice after detached
read` first refuses unmount, advances the same FakeClock to the hard deadline,
models the external watchdog's provider deletion and reconciles its gone receipt.
It checks retained binding before the deadline, ready after the detached read,
and exactly two host/login notices across retries.

Review repairs add held-freeze lost/gone abandonment, reachable thaw refusal,
automatic retry termination, restart recovery with 500 retained signed-out rows
and a decode-count control, close during held inventory, and forced early body
failure before ordered teardown. The fixture uses one LIFO teardown stack so
held producers and HostHealth close before SQLite; directory cleanup follows it.
The atomic inventory control keeps a partial temporary alongside a valid record
then corrupts the canonical record, checking success and failure independently.

`refusal then deleted attached inventory and automatic detach emit two total
notices` combines the refusal, hard deletion, delayed provider inventory and
automatic retry paths. No intermediate inventory notice follows a refusal;
only the confirmed detached release emits the second and final notice.

Native-batch repairs add `unreachable tunnel deletes and settles session before
held volume reconciliation` and `gone startup revokes and settles spend before
installed owner reconciles destroyed host disk`. They prove callback/deletion
ordering with held inventory and early ownerless startup, followed by an installed
scheduler/release owner at the same durable store. The latter waits on the
persisted incomplete receipt before allowing a later detached read.

`dispatcher composition recovers a destroyed host disk from durable startup
records` starts a real in-process projectHub around the retained revoked row.
It proves the production retry closure does not attempt a second Sessions
removal for a host with no carrier in this hub lifetime. This differs from the
recording-owner cases and caught the native restart integration failure.
