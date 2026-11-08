# Host restart recovery

On startup, `host/host-restart.ts` streams the current lease rows, resolving each
captured provision through its provider. A positive `gone` response enters the
same confirmed destroy path used by explicit destruction, which collects machine
and key absence reads before releasing the lease and settling spend. The startup
owner revokes the registration before opening any transport for that machine.
Unknown provider outcomes retain ownership and spend. No shortened lifecycle
knob is used: lease deadlines and renewal cadence come from configuration.

After registered transports and session owners exist, `Dispatcher.restoreSessions`
attaches session settlement, restores lease renewal, then enables pool scaling.
Existing `useSessions` callers still attach and start scaling by default. It keeps a surviving watchdog and replaces
one only after positive native absence or a different native birth. An unreadable
birth on a live PID retains the existing watchdog identity. Recovery captures the effective deadline before replacement and preserves that
earlier deadline in the mirror, including expired, missing or malformed mirrors.
Replacement never repairs an expired effective lease into a live one. The replacement is
checkpointed in the existing database row and mirror before recovery continues.
The [detached watchdog](host-watchdog.md) remains independent of the database.

Restored renewals run every min(1 hour, lease / 4), extending only ready hosts
that the shared in-use predicate holds through running sessions, placement
promises or the deterministic minimum-host selection. Expiry enters the lease
owner's confirmed destroy callback. Recovered inventory already counts toward
pool minimums and maximums; startup does not acquire another host for it.

Session recovery consumes checkpointed provider deletion reads and drains the
captured adapter generation before publishing exited and vacating its role.
A session with neither a durable host registration nor a supplied Host exits
without native operations, retaining its generation as an unknown cleanup
obligation. A registered host with no available transport retains its sessions;
transport failure supplies no provider or native absence authority. These rules
reuse existing persisted rows and wire status fields, so older clients still
read the existing `exited` status.

Component callers may supply the existing lock process-table dependency through
lease options and recovery/destruction, and watchdog observation options through
destruction. Every host spend operation uses the supplied process table at its
actual ledger-lock acquisition; production defaults continue to use native births.
