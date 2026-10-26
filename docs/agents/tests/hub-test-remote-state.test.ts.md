# hub/test/remote-state.test.ts

T1 persistence seam: `Store.remotes.forMessenger(id)` shares Store's SQLite
handle. Use a disposable database and close every handle before directory
cleanup. Reopen it and compare literal Discord ids above 2^53, pairings,
waiting codes, stranger counts, cursor/resume/identify scalars, message maps,
outbox jobs and attempts. The other messenger must see none of those records.
No native process, socket or real token is needed. Queue semantics belong to
the outbox tests; these tests prove only durable round trips and isolation.


The additive edit-target migration starts with a literal old-schema database,
then checks the complete old job object before and after reopening through Store.
Keep missing targets absent from old row shapes. A native NOT NULL failure on a
platform receipt proves `writeOutbox` rolls back the job and attempt as well as
the message map; a successful retry is the positive control.
