# hub/test/login-reconcile.test.ts

T2 directory-provider and persisted-store cases in `hub/test/login-reconcile.test.ts`.
Paired `projectHub` restarts exercise the shared async settled-login fixture:
its real fake-provider volume survives as ready/in-use, and an exact-id confirmed
volume deletion produces signed-out with `volume missing` after restart.
Both hub lifetimes, provider receipts and Store use one FakeClock. Explicit fake
process facts cover hub and droplet/spend locks, with a synthetic lock identity;
the startup verification sweep is joined before fixture work.
Run with `node --test hub/test/login-reconcile.test.ts` on supported Node.
The signed-out receipt case checks retained bindings, capacity removal, the store
clock and receipt removal on sign-in. Old Login wire rows omit `signedOut`.

The reader cases cover settled deletion, the provider's positive deletion receipt,
storage time, and unchanged pending bindings/creating/deleted reader fences.
The inventory cases check failed-read preservation, one notice, clock-driven
retry, the exact `volume missing` receipt and a held old inventory racing a new
ready identity. The signed-out receipt has a UUID episode id even with equal
clock timestamps. Setup prearms each handle in an AsyncDisposableStack; disposal
attempts all resource joins before Store close.

The disk cursor decodes one active disk across 200 retained signed-out rows. A
reader-heavy control visits 150 bindings in four indexed pages (at most 64 per
page), forbids `bindings()` materialization and checks the exact row total.
Unknown-host tests cover missing-original and pre-existing signed-out readers,
changed native volume birth without deletion, and a delayed positive detach.
A retained snapshot receipt survives reconciliation through the snapshot owner.
The held-reader-A/rebound-writer-B regression preserves B's new admission despite
identical public binding values and stale detached inventory. A separate writer
snapshot-fence wait checks the same episode fence after its awaited callback.

C1/C2 native evidence is in `hub/test/host-restart.test.ts`: production watchdog
deletion while the hub is stopped, restart with an initially delayed detach read,
the same original disk returning ready and a live host/OpenCode worker retained.
The existing fake OpenCode CLI rotates the mounted login before restart using
its fixture-only `FAKE_LOGIN_HOME`, resolved through `loginFilePath`. The host
read after restart must return those exact rotated bytes; the binding, native
worker and machine generation remain the same and login-disk reachability is
asserted. This is the Coordinator-approved mounted-login persistence proof; it
does not claim an MCP/spoke round trip. The ordinary fixture environment strips
OpenCode account path overlays, so the fake-only home supplies the deliberate
scratch path without weakening the shared credential filter.
Run that file only under the release's native preservation slot protocol. The
watchdog mirror expires relative to the real hub clock; all dates remain real.
