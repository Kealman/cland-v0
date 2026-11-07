# hub/test/host-provision-records.test.ts

T1 in-memory SQLite storage seam. `node --test hub/test/host-provision-records.test.ts`
proves a ready checkpoint cannot use a revoked or different-address registration,
and revocation changes a previously ready provision row in the same database
transaction. No native processes, files, sockets or clocks.
