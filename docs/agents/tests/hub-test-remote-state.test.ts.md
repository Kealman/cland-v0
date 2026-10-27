# hub/test/remote-state.test.ts

T1 persistence seam: `Store.remotes.forMessenger(id)` shares Store's SQLite
handle. Use a disposable database and close every handle before directory
cleanup. Reopen it and compare literal Discord ids above 2^53, pairings,
waiting codes, stranger counts, cursor/resume/identify scalars, message maps,
outbox jobs and attempts. The other messenger must see none of those records.
`entries(prefix)` retains messenger isolation and treats `%` and `_` as literal
prefix bytes; this is the startup feedback scan, not SQL wildcard matching.
No native process, socket or real token is needed. Queue semantics belong to
the outbox tests; these tests prove only durable round trips and isolation.


The additive edit-target migration starts with a literal old-schema database,
then checks the complete old job object before and after reopening through Store.
Keep missing targets absent from old row shapes. A native NOT NULL failure on a
platform receipt proves `writeOutbox` rolls back the job and attempt as well as
the message map; a successful retry is the positive control.

`Telegram dedupe receipts and offset commit together and survive reopening`
uses a native SQLite trigger to reject the offset insert. It retains absent
update/message receipts and offset after failure, then removes the fault,
confirms successfully and reopens the database. The earlier-id confirmation
keeps the literal next offset 2; the Discord scope remains empty. This tests the
savepoint boundary independently of the poller's successful exit.
