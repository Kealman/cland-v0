## Connection events filter

`subscribe` accepts `filter?: EventsFilter`, the same fields as `events.list`:

| Field | Meaning |
| --- | --- |
| `kinds?: EventKind[]` | Include these kinds: `session`, `task`, `topic`, `verdict`, `release`, `suite`, `usage`, `artifact`, `heartbeat`, `rule`. Missing or empty means all kinds. |
| `warnings?: boolean` | `true` includes only warning rows, including rows promoted to warnings by visibility rules. |
| `subject?: {kind, id}` | Match an `item`, `session`, `topic`, `artifact` or `rule`; item ids are canonicalised and include descendants. |
| `muted?: Array<{kind, id}>` | Exclude exact subjects. |

The fields combine. For example,
`{type: "subscribe", id: "warnings", filter: {warnings: true}}` installs the
connection's filter immediately and returns `{subscribed: true, events: EventsPage}`.
`events` is its filtered first page (`rows`, `before`, `more`). Buffer live rows
until the reply, then merge by row id and `replaces`, as with ordinary event pages.
Send another `subscribe` with a filter on the same connection to replace it and
receive a fresh first page; wait for that reply before changing it again.
`events.list` without an explicit filter inherits the connection filter, including
older pages. An explicit filter overrides that read only; `{}` reads all rows.
Snapshots prepared on the connection also use its current filter. The initial
hello snapshot precedes subscription setup; use the returned events page to
replace its events domain when installing a filter afterwards.

Only events-view rows are filtered: other model domains continue unchanged.
For numbered clients, an excluded event becomes `{type: "model.advance", epoch,
seq}` without a row. Apply its cursor without changing any domain, preserving
contiguous model sequence numbers. Same-connection `resume` filters replay too.
Filters end with the connection; after reconnect, install the filter with
`subscribe` before sending a `resume` request if filtered catch-up is needed.
A hello resume has no filter yet and replays every row.

`subscribe` without a filter resets to every row and keeps the existing
`{subscribed: true}` reply. Clients that never install a filter, including Neovim,
keep their existing pages and live rows.

