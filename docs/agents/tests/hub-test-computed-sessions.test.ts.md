# hub/test/computed-sessions.test.ts

`hub/test/computed-sessions.test.ts` exercises the same disposable T2 frame seam
for authoritative unread/last-message values, `topic.read`, merged session
snapshots and row replacements. Fake time proves waiting age without timer-only
updates; the row carries approval command, account, usage, newest verifier hold
and +N, or accepted requested work. A later snapshot is compared with each
presence/process/rename/disconnect delta, and an ordered request fences the
single-row assertion. Snapshot-only subscribers also receive unmanaged rows and
removals; unknown identities remain separate by name. No new process is used.

Keep the human topic.send requested-work regression unchanged when admission
receipts change: after releasing real holds, a human's review request in General
must produce the requested session.row. Human input has no sender session; its
trusted producer records admission before native delivery.
