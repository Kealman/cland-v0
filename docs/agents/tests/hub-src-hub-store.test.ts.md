# hub/src/hub/store.test.ts

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
