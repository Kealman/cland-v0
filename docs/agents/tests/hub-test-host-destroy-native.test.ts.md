# hub/test/host-destroy-native.test.ts

T3 native fake SSH/OpenCode destruction. Cases `C1/C2/C3 destroy settles native session after confirming deletion; tunnel down=false` and `tunnel down=true` prove reachable and disconnected destruction, exited rows, removed key, and two host-destroy log reads. The disconnected case closes the host and invalidates the pinned key while the worker remains live; ignoreDelete leaves the machine present and session fenced, then a second CLI destroy retries. Uses host-create-fixture.ts and joins all fixture writers before directory removal. Run under the preservation lock, without inherited CLAND_* variables or real provider credentials. The fake provider models machine deletion by its native absence receipt; fixture census cleanup stops physical scripted workers. No real DigitalOcean API, browser or Linux-container claim.

Run: `node --test hub/test/host-destroy-native.test.ts`.

Each launched fake host starts with `mountedSettledLogin`: an attached,
Host.loginDisk-mounted OpenCode volume recorded as settled. Its cleanup follows
all native joins and precedes root disposal; the destruction assertions and
bounds are unchanged. The shared fixture ownership is described below.

`destroy joins an admitted held acquisition and prevents ready resurrection` holds
a provider acquire after its machine is durable but before its result reaches
create. Destroy checkpoints intent, joins aborted creation and confirms deletion;
no ready registration can resurrect. The old source returned incomplete before
acquisition joined (red). Twelve sequential load-scaled setup allowances plus
120 seconds for the fixed 30-second CLI behaviour bounds and cleanup size the
outer timeout; individual setup waits keep SETUP_MS and behaviour bounds remain
the harness's exact 30-second CLI limit.

## Shared settled-login fixture

`settledLogin` seeds metadata for provided in-process Hosts. Its optional
`volumeId` lets native fixtures record an already mounted fake disk without
inventing a second identity. `mountedSettledLogin` in
`hub/test/settled-login-fixture.ts` creates a directory-backed FakeHostProvider
volume, positively attaches it, mounts through Host.loginDisk, observes the
mount link, then seeds settled metadata through `settledLogin`. Both functions
share login-name construction and use the shared fake-layout mount primitive.

Before allocation, the helper registers a `beforeStop` setup join and an
`afterNativeJoin` cleanup with host-create-fixture. Setup settles before borrowed
Store handles or hubs close, including rejection. Cleanup follows all
hub/session, watchdog and native fixture process joins: it unlinks only the
captured fake mount target and observes absence, then confirms volume detach
and deletion before root disposal. No stopped agent is asked to mutate anything.
Cleanup reads captured identities, not the closed Store; uncertain ownership or
cleanup failure retains the root. Destroy and restart cases exercise this
shared helper without changing their assertions or bounds. The native-slot
receipt includes before/after TMPDIR fixture inventories.
