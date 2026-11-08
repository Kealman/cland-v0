# Host status and explicit stop

`cland host status [--json]` reads current provision inventory. Each pool shows
host count, occupied weighted slots (including retained generations and placement promises) against declared capacity, and USD
spend for the current UTC day and month. Settled `hosts` ledger costs from this project count in
their release period. Live machines add uptime times the declared hourly price,
clipped at each period boundary; outstanding reservations do not count as spend.
Prices use the admitted ledger rate, including the provider's extra-address rate,
matched by exact project and host lease id. Status makes no provider API request.
Unknown legacy prices make the affected pool spend unknown. A nonzero placement
promise appears as `promised n` and counts in slots used. Storage is outside this view.
Each host shows id, size, region, state (including `unreachable`), uptime seconds,
running session names and hourly price. Missing machine uptime or price is unknown.
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

Both frames require the local human CLI or Neovim (Unix socket, or Neovim stdio).
Authenticated sessions, host-forwarded clients, web and messenger remotes cannot
invoke them. Implementers use sealed disposable fixtures; they gain no live host
management permission. `host list` and `host destroy` retain their previous shapes.
Manual `host create` shares scheduler admission and counts creating, live,
destroying and unresolved acquisitions toward `max_hosts`.
