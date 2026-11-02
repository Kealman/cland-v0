# hub/test/executor-deletion-confirmation.test.ts

`hub/test/executor-deletion-confirmation.test.ts` (T2) uses the scripted fake API,
its shared FakeClock and remoteWaits driver. No real token, droplet or browser.
The release cases use remote-fixture's scratch project/environment and read the
durable lease and spend receipts. They retain pending spend and attention until
GET-by-id confirms absence, then retry release and assert settlement.

Reusable fake faults: `dropletDelete404Reads`, `keyDelete404Reads` and
`snapshotDelete404Reads` return DELETE 404 while preserving GET 200 for exactly
that many id reads after the first DELETE. The next id read removes the resource
and answers 404. Lists never advance these counters; repeated DELETE does not
reset them. `getDelayMs` delays GET only, restricted by optional `getDelayPath`
(e.g. `/snapshots/42`, without `/v2`). Existing faults retain their semantics.
`beforeKeyRead` observes the key-id read before its split counter advances.
The client exposes `key(id, deadline)` and `snapshot(id, deadline)`.

Run one file at a time after checking free disk and load per the shared guidance.

Additional-resource controls retain duplicate droplet/key ids across a durable
lease reload while subsequent lists omit them. `omitDropletIds` and `omitKeyIds`
filter lists only; GET-by-id remains authoritative. `beforeDropletRead` can hold
or fail the confirmation GET. Its held control reads the durable `deleteStarted`
before releasing the GET, then requires the original timeout and one DELETE.
