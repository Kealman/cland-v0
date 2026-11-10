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
