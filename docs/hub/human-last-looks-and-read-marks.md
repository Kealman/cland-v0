## Human last looks and read marks

The project currently has one human identity. Every authenticated browser cookie,
Unix UI and stdio UI reads and updates that human's marks; a cookie or connection
never gets its own copy. The `topics` snapshot includes `marks`:
`{ events: string | null, plans: Record<string, string>, imported: boolean }`.
`marks.get` returns `{ marks }` for clients using individual reads. `marks.set`
accepts an optional `events` ISO timestamp and/or `plans` mapping item IDs to plan
history receipt IDs, and returns the complete `{ marks }`. Both frames are
human-only, including on the web; there is no agent tool or CLI command for them.
A changed mark emits a `marks` replacement delta, with the usual model sequence
and replay guarantees, and a legacy push for Neovim. Marks persist in the hub's
SQLite store and survive reopening it.

An events timestamp only increases. Plan receipts are opaque IDs ordered by the
hub's plan history, including publications with identical timestamps; older
receipts cannot replace later ones. The map uses canonical `T-<number>` keys so
legacy and current item prefixes refer to the same plan. Normal writes reject
unknown receipts. Topics keep their existing `topic.read { topic, upTo? }` act:
`upTo` is a message ID (absent means the latest); `Topic.readSeq` exposes the
highest durable message number read. A later older read cannot decrease it.
The topic replacement and its authoritative unread count reach all clients.

Neovim first reads the shared marks, then imports legacy `events.last_look` and
`plan_seen` from `.cland/ui.json` with `marks.set { import: true, ... }`. The hub
merges forward and records `imported` in the same durable write. Only the first
import applies; retries and stale copies cannot overwrite current marks. An
import may preserve a receipt whose history has already been retained away,
without replacing a known newer receipt. After the acknowledgement Neovim
removes the legacy keys atomically, preserving filters, folds, current release,
other owners' preferences and existing pins/mutes. If the reply or local cleanup
is interrupted, the next start reads the durable receipt before retrying cleanup.

