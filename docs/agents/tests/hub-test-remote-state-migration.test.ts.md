# hub/test/remote-state-migration.test.ts

T2 uses disposable SQLite files and Store's injected native connection, without
processes, sockets or real tokens. Run this file alone. The exec trace is kept
outside the T1 persistence file so tier admission does not classify its wrapped
native call as a process launch.

Retain zero stop-cause ALTERs for a fresh schema, exactly one for a literal old
`remote_status` schema and zero when reopening the migrated database. Keep the
native status read/write assertions, unchanged legacy reason and persistence
of the structured cause; recovery clears the optional cause. Close each Store
and old-schema handle before directory cleanup.

The original red receipt observes an unexpected stop-cause ALTER on a fresh
database. Putting the column directly in CREATE makes that case green while
the legacy ALTER path remains covered. This proves the DDL boundary, not
concurrent Linux startup-lock recovery; that needs the configured full run.
