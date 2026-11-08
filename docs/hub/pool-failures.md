# Pool boot failures and provider limits

Automatic pool creation keeps launches waiting through a provider refusal or boot
failure. A provider retry time pauses that pool until the stated hub-clock time.
A failure without a retry time backs off one minute, doubling to thirty minutes.
A ready host or a change to that pool's configuration resets the boot-failure streak. The provider not-before time is independent and survives either reset. Changes
to another pool do not reset it. Reload and `config set` apply the new settings
immediately. The minimum and waiting-launch demand are rechecked before creation.

The five-minute boot deadline starts immediately before provider acquisition.
Both machine readiness and the pinned SSH key must answer before that deadline. Scoped provider reads and the native SSH process receive deadline cancellation; the owner joins their completion before confirmed cleanup. SSH receives the time remaining after the status read.
A failed machine goes through the confirmed destruction owner, preserving leases,
watchdog and spend settlement. One `host-boot-failed` Agents notice names the host
and addresses the Coordinator; it is never posted in General.

An acquisition still pending at the deadline is persisted as failed with its
acquisition outcome unknown. It retains its occupied slot and spend reservation;
no replacement can consume that slot. A late machine identity is released through
confirmed deletion and spend settlement using the pinned billing minimum. A
never-settling acquire needs a provider reconciliation contract; the hub cannot
infer native absence from elapsed time. The in-flight operation remains owned
until it settles, including during shutdown.

`CLAND_TEST_HOST_BOOT_MS` shortens (never extends) the deadline only with
`CLAND_FAKE_HOST_ROOT` set. Without that fake-host fence the deadline remains
300000 ms. This is a test control, not a project setting. Provider auth, network,
image currency and declarations still govern admission; this policy grants no
DigitalOcean production creation capability.

`HostProvider.status(machine, scope?)` accepts an optional signal and absolute
hub-clock deadline. Scoped reads are read-only, cancel cooperatively, and join
before rejecting; they do not hold the provider mutation queue while waiting
for network I/O. Unscoped calls preserve their prior serialization. DigitalOcean
passes the scope to its droplet GET; the API shares its existing token budget
and request transport. The scripted fake handles the same optional signal and
keeps its ordinary delay driver for unscoped calls.

Creator results still in creating/booting/connecting/cloning retain their owner;
only failed/refused results enter failure settlement. If provider resolution or
confirmed cleanup fails, the existing provision gets `failure.code =
"cleanup-unavailable"`, state failed and release incomplete. Its machine and
acquisition identity remain occupied. One failure notice is emitted for that
record, and further creation below max_hosts follows backoff; ready siblings
remain placeable. Rejected cleanup work is observed so shutdown can drain it.

Retained cleanup failures keep the same consecutive boot-failure streak; cleanup
errors do not reset it. Failure publication after an asynchronous cleanup
revalidates acquisition ownership and preserves newer confirmed deletion, release,
readiness or replacement checkpoints. A ready checkpoint also keeps its backoff
reset rather than accepting an older rejected cleanup continuation.
