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

Run this file alone with `node --test hub/test/hub-lock-readers.test.ts` after
cover-quiet releases and disk/load checks. Preserve `edges.test.ts`,
`orphan-servers.test.ts`, `doctor.test.ts`, `doctor-cli.test.ts`, `daemon.test.ts`
and `telegram-polling-restart.test.ts` unedited and run them as targeted files;
the native T3 lifecycle cases are outside ordinary mode-free item verification.
Every native-to-embedded restart carries captured native `lockIdentity` rather
than the synthetic fixture identity. Doctor's matrix fixture supplies the same
captured native identity as its embedded hub through `ProjectReaders.lockOptions`.
All local embedded hubs use the shared native capture by default; synthetic host
identity is explicit for foreign-holder negative controls.
No real provider, inherited credentials or human browser is used.

Held stop-request failure installs a same-number foreign successor while the
request is pending; exact successor bytes survive, with no later local PID probe.
Held migration reads use a shared FakeClock for lock acquisition, renewals and
contenders across three 70-second advances. Replacement before release must
fence publication, retain the successor, clear renewal, and never recreate a
released lock. A held Tracker temporary-file write separately proves ownership
is rechecked before publishing item bytes; final original bytes remain intact.
