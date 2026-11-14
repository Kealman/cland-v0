# Host status and explicit stop

Setup requests `host.status` with optional `roleLogins: true`. Only that opt-in
reply adds a top-level `roleLogins` map: each role placed on a nonlocal pool maps
to whether it has an eligible login matching the pool's provider/region and the
role's optional account pin. It shares `LoginRecords.freeCount` with pool
`freeLogins`; no client copies the eligibility policy. Plain status replies keep
their shape. Older hubs omit the map, which means unknown readiness, never `ok`.
This is metadata only and does not bind a login or contact the provider.

`host.status` host rows optionally include `outageSince` from the health owner.
It is absent when no outage is observed and on older hubs. Clients must treat
absence as unknown when the host is unreachable. Healthy ready rows without an
observed outage retain their shape. During the three-minute outage grace period,
a still-ready row may already carry `outageSince`.
Doctor reads this timestamp without initiating a health or provider probe.

Pool `freeLogins` maps harnesses of roles placed on that configured pool to actual
eligible login counts. A reusable key or shared disk counts once, and exclusive
counts are not capped at `max_hosts`. It shares the store's indexed eligibility
predicate with `capacity`, which retains its admission semantics. Older replies
without `freeLogins` mean the count is unavailable, not zero or `capacity`.

`cland host status [--json]` reads current provision inventory. Each pool shows
host count, occupied weighted slots (including retained generations and placement promises) against declared capacity, and USD
spend for the current UTC day and month. Settled `hosts` ledger costs from this project count in
their release period. Live machines add uptime times the declared hourly price,
clipped at each period boundary; outstanding reservations do not count as spend.
Prices use the admitted ledger rate, including the provider's extra-address rate,
matched by exact project and host lease id. Status makes no provider API request.
Unknown legacy prices make the affected pool spend unknown. A nonzero placement
promise appears as `promised n` and counts in slots used. Each pool adds `capacity` by harness and `storage` (USD accrued this UTC month).
Storage uses recorded login volume and snapshot lifetimes at provider-declared
rates and adds only to month spend; it creates no reservation. Missing legacy
storage metadata contributes zero. Status performs no provider calls.
Each host shows id, size, region, state (including `unreachable`), uptime seconds,
running session names, bound logins by harness/name and hourly price. Missing machine uptime or price is unknown.
Removed pools with current inventory or settled spend remain visible.

`cland host stop <id>` is an explicit human stop. It joins the lease renewal
owner before using the same confirmed destroy path as `host destroy`. Running
sessions and placement promises do not veto this explicit stop. The host enters
`destroying`, preventing placement; the existing owner settles sessions and cuts
host authority. A persisted provider deletion read permits sessions to become
`exited`. Confirmed machine and key absence releases the lease and settles spend.
A failed deletion reports `destroying`/`incomplete` and CLI exit 1, keeps the host
out of placement and leaves renewal stopped; the watchdog retains its deadline.
Pool minimum/demand reconciliation may create a replacement within `max_hosts`.

Status requires the local human CLI or Neovim (Unix socket, or Neovim stdio).
Stop also accepts an authenticated web user (an active admin in users mode).
Authenticated sessions, host-forwarded clients and messenger remotes cannot
invoke either frame. Implementers use sealed disposable fixtures; they gain no live host
management permission. `host list` and `host destroy` retain their previous shapes.
Manual `host create` shares scheduler admission and counts creating, live,
destroying and unresolved acquisitions toward `max_hosts`.

## Pushed workbench host state

The hub sends `hosts.state` with `{ pools }` on a non-snapshot workbench hello;
featured snapshots include the same projection in optional `sessions.hosts`.
Subscribed clients receive replacements at most once per second. Older clients
ignore the additive event and older hubs may omit the optional snapshot field.
No configured pool tables means an empty pool list.

Each configured pool includes its provider, region, host count/maxHosts, weighted
slots used/total, and per-harness login counts (`inUse`, `usable`, `signedOut`).
Logins are scoped to the pool's provider and region; key logins are portable.
Signed-out logins count separately. Each host exposes id, size, region, state,
creation time, running session names, admitted declared hourly price including address
charges, and today's UTC live accrual. Rates come from the indexed lease billing checkpoint, populated after spend reservation
and by a renewal owner for older leases; no new provider read is needed. Older
rows without that checkpoint keep price/spend unknown (null) while a machine is
live. Pre-acquisition and positively deleted machines contribute zero live spend. Spend
sampling occurs at most once a minute while inventory is live. The projection
never includes addresses, SSH identities, native volume identifiers or tokens.

Tunnel loss sets an outage alert with its host and start time before the existing
three-minute unreachable state and General notice. Recovery clears that alert.
Pool creation refusal/rate-limit pause sets a provider alert until successful
creation; an outage takes display precedence when both exist. Pool configuration,
placement, session exit and login changes trigger the same publication owner.
Login mutations publish a coalesced replacement even when the aggregate counts
are equal, allowing the web's open Hosts view to refresh `login.list` metadata.
The view confirms Stop with the host name and session count, displays the host
state, and retains a returned incomplete deletion state and reason on that line.
Connect and snapshot use cached state; no network or ledger read runs there.
