# hub/test/passwords.test.ts

`hub/test/passwords.test.ts` uses node:crypto and in-memory Users storage. It proves
independent salted records, password verification, rollback after session issuance
failure and expiry/consumption. It runs at T1 without a native hub or credentials.
