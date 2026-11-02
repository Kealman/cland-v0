# hub/test/topic-withdraw.test.ts

Use the projectHub frame seam with fake adapters; existing tests retain injection,
late acknowledgement and atomic broadcast fences. Users-mode coverage persists
two active admins sharing one display name, queues input to an unheld role,
refuses a forged cross-user withdrawal, reads unchanged queued history and then
observes successful owner and legacy-admin withdrawal receipts. SQLite setup
plants users only inside the disposable root. No live hub or native harness.
