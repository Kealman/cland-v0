# hub/test/hub-lock-readers.test.ts

T2 persisted-record and CLI reader seam, using disposable roots and the shared
fixture environment. No hub process or browser is launched. A spawn observer
proves fresh foreign start refuses before launch; a native signal observer catches
both kill(0) and destructive signals. Stop must retain the exact lock and discovery
bytes. Status and doctor cover fresh and lapsed holders, with unknown/future time
and the inclusive 60-second boundary checked through the shared readers.
The orphan reader observes zero local row reads before rejecting a foreign
identity and retains a legacy local control. Offline migration proves fresh refusal
and lapsed guarded takeover (a config parser failure after acquisition is the
receipt, with final released-lock assertion). The lapsed start case proves launch
admission only; lock identity tests prove guarded replacement.

This T2 file passes fixture identity through CLI start/status/stop and doctor's
`lockOptions`. Offline migration takes `hostIdentity` and a `LockProcessTable`
through its optional options argument, including acquisition and release. Omitted
options retain native production readers. The shared `fixtureNativeGuard` guards
all child-process entry points, custom promisifiers and cleanup, with positive
controls. The lapsed-start test replaces only its expected launch with a fake.
Run this file alone with `node --test hub/test/hub-lock-readers.test.ts` after
cover-quiet releases and disk/load checks. Native lifecycle evidence remains in
the separately selected T3 files.
Every native-to-embedded restart carries captured native `lockIdentity` rather
than the synthetic fixture identity. Doctor's matrix fixture supplies the same
fixture identity as its embedded hub through `ProjectReaders.lockOptions`.
Embedded hubs use runner-captured identity when available and a standalone
synthetic identity otherwise. Native CLI interoperability opts in explicitly
with `lockIdentity: 'native'` or `nativeIdentityProjectHub`; a different synthetic
identity remains the foreign-holder negative control.
No real provider, inherited credentials or human browser is used.

Held stop-request failure installs a same-number foreign successor while the
request is pending; exact successor bytes survive, with no later local PID probe.
Held migration reads use a shared FakeClock for lock acquisition, renewals and
contenders across three 70-second advances. Replacement before release must
fence publication, retain the successor, clear renewal, and never recreate a
released lock. A held Tracker temporary-file write separately proves ownership
is rechecked before publishing item bytes; final original bytes remain intact.
