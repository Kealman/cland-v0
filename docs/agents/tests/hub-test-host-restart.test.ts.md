# hub/test/host-restart.test.ts

`hub/test/host-restart.test.ts` is T3. Run serially in the Coordinator's
preservation slot. It uses `host-create-fixture.ts`, native fake SSH transports,
two directory-provider hosts, detached watchdogs and native fake OpenCode.
No real provider API or human browser is used. Fixture owners join hubs,
watchdogs and descendants before root removal.

Both fake hosts receive `mountedSettledLogin` OpenCode disks before launch.
The helper records real fake-provider volume identities and owns unmount/detach
after all restarted hubs and native processes join. Existing restart, deletion,
spend and watchdog assertions and bounds stay unchanged.
See [shared fixture ownership](hub-test-host-destroy-native.test.ts.md#shared-settled-login-fixture).

The case `restart keeps the live host and exits the deleted host, settles spend,
and restores watchdog ownership` asserts the persisted session rows, vacated
Implementer role, released lease and settled spend after external fake-provider
deletion during hub downtime. It checks the surviving watchdog's exact identity,
then stops it and restarts again to prove a replacement is live. A restored
minimum of one host preserves inventory without an extra acquisition.

The companion T2 minimum-host scheduler case supplies the completed scaling-owner
receipt; this native case retains the final inventory count. Native spend proof
requires the exact lease ledger entry, the fake provider's expected zero cost and
a finite released timestamp.

The deleted host's provision must durably read `destroyed` within the named
`SETUP_MS = testWaitMs(60000)` setup bound before the lease and spend reads.
Detached-login `ready` alone does not prove the release owner has settled the
provision. The final `destroyed`, absent lease, settled spend, live host and
watchdog assertions remain; an incomplete settlement times out and fails.
A commit observer armed before restart records the gone provision's transitions
across Store instances. After joining the final hub's release retries, the case
asserts that `destroyed` was published and no transition left that terminal state.
For T-1810 preservation, run the exact case alone in five fresh Node processes
on macOS, serially under the Coordinator's native-slot policy. Linux evidence
comes from the changed-T3 mode-free verification and merge-batch receipt. The
local container diagnostic stopped at missing `ssh-keygen` before acquisition;
it supplies no Linux behaviour evidence. No browser or real provider is required.

T-1779 preservation: deleted/unreachable sessions must exit while volume inventory
remains held or reports attached. The original destroy/restart final assertions
stay; additional disk assertions observe eventual ready only after detached
inventory. This also exercises the optional synchronous SSH reachability fact
without adding a reconnect or changing request streams.

A missing detached receipt retains a bounded diagnostic of provider-read count,
provision state/release, deletion receipt presence and binding/backup facts.
The fixture never infers signal or completion from that diagnostic.

Login reconciliation C1/C2: the production watchdog deletes the fake gone host
while the hub is stopped and publishes machine/key absence receipts. Its original
login volume returns ready only after detached inventory. The existing fake
OpenCode CLI rotates each mounted login before restart. After restart the live
worker/binding and exact machine generation are retained; the Host's validated
logical login path returns the same rotated bytes and loginDiskReachable is true.
This Coordinator-approved persistence proof does not require an MCP/spoke turn.
