# hub/test/task-plan.test.ts

Wait for reindexedAfter before checking refused/accepted hand plans; keep the journal and retained-plan assertions across restart.

The receipt helper allows 15 s on loaded hosts; the healthy-watch safety interval
is 5 s, and failed native watching checks every 500 ms. No platform credentials
or browser are involved. Use sealed disposable project fixtures.
