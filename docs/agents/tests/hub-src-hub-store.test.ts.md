# hub/src/hub/store.test.ts

Historical-answer controls use the production TrackerIndex in memory to fence
wrong recipient, kind, time and head; a wrong recipient reply cannot confirm the
root. Unknown ancestry keeps replay held until positive coverage, while queued
input remains queued. Exact authenticated receipts bypass unrelated older
facts; dedicated receipt pages have a 32-row bound and exclusive cursor.

Verdict settlement pages attempted pending roots through their retained
acceptance, exact admitted recipient identity, item and kind. The T1 in-memory
case crosses the 32-row page boundary, preserves admitted heads, and checks that
unrelated heads, other kinds, unattempted and queued deliveries remain unchanged.
An explicit matching verdict settles every matching page; no latest-item receipt
or sequence watermark substitutes for each request's proof.

`hub/src/hub/store.test.ts` covers numeric `topic.history` pagination at T1 through
`HubCore` and the store: 450 rows in three pages each way, exclusive cursors,
interleaved writes, timestamp-independent sequence order, cursor validation and
unchanged no-cursor/message-id history. `TopicMessage.seq`, `TopicHistoryFilter`
and the request fields are checked against `shared/wire` by the T0 conformance
assertions. Neovim's thread tests exercise the unchanged message-id archive reader.
The existing monotonic store sequence is reused; no new migration/backfill is
needed for an already numbered database. Measure upgrades only on a consistent
SQLite backup in a disposable root with the shared fixture environment, never on
the live file; report copy size, row count, startup duration, writes, head/tree and
platform separately from suite evidence.
