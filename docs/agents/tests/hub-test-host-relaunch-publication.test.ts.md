# hub/test/host-relaunch-publication.test.ts

T2 real SQLite transactions, no Git or native processes. Inject a warning
checkpoint failure after process/checkout writes and prove all facts roll back.
Then inject a post-commit observer failure and reopen: the new native row, ready
checkout, warning and cleared intent are durable together; the old unknown native
generation remains retained. Run `node --test hub/test/host-relaunch-publication.test.ts`.
