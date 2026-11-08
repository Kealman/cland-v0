# Host tunnel outages

The hub tracks each registered, provisioned host with a registry-owned carrier
through the registry's tunnel transition subscription. Supplied Hosts whose
transport is owned elsewhere are unmonitored here: no carrier is no observation,
so initial replay emits nothing for them and Health grants no outage hold. SSH reconnect continues independently. A loss starts two
hub-clock timers. After 3 minutes the provision state becomes `unreachable` and
General receives exactly `host <id> unreachable`, once for that outage. Host list
and status expose that state. It remains occupied inventory and cannot accept pool
placements. Every host in outage grace is held by the shared hostInUse predicate, alongside
running sessions and placement promises. The hold begins at loss, before the
warning, and ends at recovery or terminal loss. Sessions excludes held hosts
from placement immediately. Minimum and maximum inventory still count them;
a waiting launch can demand-create another host below max_hosts.

An up transition before the 15-minute deadline restores `ready` without another
General line. The hub checks the provider on loss, at most once per host per
minute, without periodic polling. Failed or unavailable status reads do not prove
absence. A late reply from an earlier outage has no authority over a newer one.
A positive `gone` reply enters the same deletion owner immediately.

At 15 minutes, running work does not veto the loss policy: the hub records the
shared `hostInUse` result, stops and joins lease renewal, persists a deadline of
now in the database and watchdog mirror, then calls confirmed host destruction.
The detached watchdog is the backstop. Session generation obligations and roles
settle through `Sessions.hostDeleted` with the checkpointed machine-absence read;
unknown deletion retains the lease and spend fence. If shortening the mirror
fails after the database checkpoint, a typed diagnostic is recorded once and an
owned next-second publication retry remains armed while primary destruction
continues. Publication, lease release and shutdown stop that retry. No missing-transport shortcut
releases ownership.

After startup restores sessions and lease owners, the registry replays initial
status. A down host's timers count from registry startup, including restore time. An up-to-down transition during restoration instead
retains its actual transition time, unchanged by connecting/down churn.
An already-up host clears any retained unreachable state. Health shutdown cancels
its timers and joins its admitted provider and destruction work before storage
closes.

The production bounds are fixed. Positive integer values below the defaults in
`CLAND_TEST_HOST_UNREACHABLE_MS` and `CLAND_TEST_HOST_LOST_MS` shorten them only
when `CLAND_FAKE_HOST_ROOT` is set. Tests use isolated fake providers/transports;
these are not pool configuration settings. Manual SSH registrations without a
provisioned provider machine retain their existing reconnect-only behavior.

## Contract consumers

The additive `unreachable` provision state participates in active/current/occupied
inventory. Ready-only pool membership excludes it. The shared
`hostLeaseRenewable` predicate keeps create-time and restart-time renewal aligned.
`records`, `settle`, `destroyHost`, `Sessions.hostDeleted` and the watchdog retain
their existing positive-receipt boundaries. `cland host list` and `cland host list --json` both return JSON; other extra
arguments remain refused. `listHosts` and `hostStatus` forward
the state using their existing fields; CLI, protocol, shared wire, Neovim and web
frame shapes are unchanged. Old `ready` records remain readable. No authority or
admission permission changes.

PoolRuntime accepts an optional default-false outageHold input. Sessions feeds
Health into that shared input and its existing availability callback, leaving
callers without a hold on their existing behavior.

The optional SSH `onStatus` hook preserves existing constructors. Registry
subscriptions provide `(id, up, hubClockTime)` and return an unsubscribe function.
Carrier `connecting` and `down` transitions belong to the same continuous outage.
The registry does not poll. Existing QA briefs for E-1532 stages 2–4, E-1533
stages 1/3 and E-1534 stage 2 consume the unchanged host/session frames.

Tests importing the changed runtime modules are recorded by tier and actual
execution in the item's evidence artifact; this includes native SSH, host,
restart, lease, destroy and daemon consumers. File-specific QA cases are in
[the test guide](../agents/tests/hub-test-host-unreachable.test.ts.md).
