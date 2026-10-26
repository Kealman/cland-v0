# hub/test/remote-state.test.ts

T1 persistence seam: `Store.remotes.forMessenger(id)` shares Store's SQLite
handle. Use a disposable database and close every handle before directory
cleanup. Reopen it and compare literal Discord ids above 2^53, pairings,
waiting codes, stranger counts, cursor/resume/identify scalars, message maps,
outbox jobs and attempts. The other messenger must see none of those records.
No native process, socket or real token is needed. Queue semantics belong to
the outbox tests; these tests prove only durable round trips and isolation.
