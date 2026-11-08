# hub/test/pool-idle-stop.test.ts

T2, PoolRuntime's lifecycle seam with SQLite provision inventory, FakeClock,
parser-built pools and a directory-only fake provider. No real provider, native
transport, browser or child process. The injected transport removal revokes
registration; destruction uses production destroyHost, positive provider reads,
absence records and lease release. All fixed lifecycle dates use the same clock.

Run `node --test hub/test/pool-idle-stop.test.ts` on supported Node with CLAND_ 
variables removed. The fixture uses a disposable root and fixtureEnvironment.

Cases:

- `C1 idle host is destroyed at one minute while min_hosts stays`: ready excess
  z reaches the confirmed destroyed record at 60s; a stays ready at min=1.
- `C2 billing minimum delays destruction beyond idle_stop`: 180s minimum holds
  the excess host past the 60s idle deadline.
- `C3 running host stays beyond idle_stop and billing minimum`: busy z holds
  the minimum despite reverse lexical order; idle a is destroyed.
- `C4 session gained during idle wait restarts the full wait after exit`: no
  old-deadline deletion; the full minute restarts when the session exits.
- `placement promise resets idle wait even if released before the old timer`:
  promise acquisition invalidates the old interval without requiring a timer tick.
- `simultaneous deadlines never stop below a raised minimum`: configuration
  reconciles immediately and only the excess host is destroyed.

Positive assertions await the destruction receipt with eventually; pre-deadline
assertions retain the ready-state check. Setup and cleanup finish provider writes
before closing SQLite or removing fixture directories. The tests do not prove
native SSH drainage, detached watchdog reaping or a live DigitalOcean API.

`hub config idle_stop hot apply reaches confirmed destruction through the lifecycle owner`
serves projectHub with a provided empty fake transport and directory fake provider.
It changes config through config.set and observes the provision's confirmed
`destroyed` / `released` record, proving Sessions/Dispatcher lifecycle wiring.

The matching `hub config min_hosts hot apply reaches confirmed destruction through the lifecycle owner`
case raises min_hosts to retain the host beyond the old idle deadline, then lowers
it to zero and observes destruction after a new idle interval. Both config cases
assert `applies: now`; `ok: true` alone can mean saved but not applied.

`asynchronous provider declarations are shared and precede idle destruction`
uses one async provider read for two ready hosts and observes both confirmed
destructions only after the billing/idle deadline. This covers the lazy declaration
boundary used by DigitalOcean without making a real API request.

`synchronous declaration failure retries after 60 seconds without external reconciliation`
uses one quiet ready host. Its declaration callback throws once, then succeeds.
Only FakeClock advances; the test observes the confirmed destroyed receipt at
60s with no configuration or capacity event. A two-host fixture would mask this
failure by attempting another read during the same inventory traversal.
