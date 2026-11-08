# Pool scale-up

The hub maintains `hosts.<pool>.min_hosts` from startup and rechecks it when
capacity changes. `agents` defaults to one; other pools default to zero. Set a
pool's provider and prepare its image with `cland host prepare <pool>` before
expecting creation to succeed. Provider admission, configured spend caps, image
freshness, authentication and network access still apply.

A validated, durably admitted pool wait without room starts a host through the same create path as
`cland host create`: its spend reservation, lease and detached watchdog precede
machine acquisition. Selection itself creates nothing. One automatic create is
in flight per pool. Manual and automatic creates share a synchronous checkpoint
after image reads and before the creating row: current pool settings, billable
occupancy and the durable demand are revalidated without an intervening await.
Removed pools, lowered limits, canceled waits and lost item/caller authority
refuse before a row, spend reservation or provider acquisition. Startup minimum
maintenance supplies its own service demand. Creating, booting,
connecting and cloning hosts supply the existing `waiting for host <id> to boot`
reason; readiness retries the durable launch. Full pools retain `waiting for a
host`. Ready and booting hosts count against `max_hosts`; destroying hosts also
count until confirmed deletion and supply no placement capacity. Terminal
history is excluded by the state-indexed active inventory. A separate indexed
occupied count also retains failed acquisitions whose outcome or release is
unknown. SQL counts active rows and narrows unreleased failed rows; the same
JavaScript receipt parser as spend validates only those anomaly records. Confirmed release, or a valid `not-called`/`provider-refused` receipt
without a machine or acquisition, frees those failed rows' slots.

`cland config set hosts.agents.max_hosts 2` immediately retries waiting placement
and minimum maintenance. The hub never raises the limit itself. Lowering a
limit does not destroy existing machines. Explicit host launches remain pinned
and refuse when full. Coordinator and Aide launches remain local.

Automatic creation failures pause that pool's creates until configuration is
applied again. Boot failure retry/backoff is a separate lifecycle owner; scale-up
itself installs no native timers. Shutdown aborts creation and joins its existing
owner before storage closes.


A ready host refused by the agent's memory floor retains its memory diagnostic.
When that host still has room by weight, memory refusal does not start another
host. Memory reports can retry the wait. Name syntax, Lead item requirements and
current role membership are validated before a wait is admitted and again before
its create can publish a row.
