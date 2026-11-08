# T-1753: host outage implementation

Host health consumes registry transition events, never a periodic probe. Preserve
3/15-minute hub-clock bounds and fake-host-only shortening. An outage is not a
native absence receipt. Loss stops/joins renewal and shortens the durable lease
and mirror before confirmed destruction; use the shared in-use predicate for
accounting, without allowing running work to veto the 15-minute loss policy.
Use the existing hostDeleted checkpointed-read settlement for sessions and roles.
See docs/hub/host-health.md and the host-unreachable test guide.

Review corrections: every grace host contributes an outage hold to shared
hostInUse, including idle non-minimum hosts. Preserve actual continuous-outage
start times through initial subscription replay. A mirror publication error
retains its owned next-tick retry and cannot skip primary confirmed destruction.
Prearm attempt-all fixture cleanup in health/session/registry/storage order.
`host list --json` is an explicit alias for the existing JSON list output.

Configured coverage correction: a supplied Host with no registry-owned carrier
is unmonitored, never inferred down. Initial replay emits only owned carrier
observations. Use the shared suite import graph through fixture helpers plus
explicit contract consumers; a direct-import regex alone missed supplied-Host
restart regressions after the grace callback was added.
