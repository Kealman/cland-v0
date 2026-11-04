# Remote discovery

A registered SSH host publishes `~/.cland-host/run/hub.json` through its agent before its carrier becomes `up`. Launched adapters set `CLAND_HUB_FILE` to this canonical file. The clone copy is owned by the clone provisioning flow (T-1604); it is not created by the carrier.

The remote shape is `{ remote: true, socket, spoke, secret, version }`. `socket` is the forwarded absolute `hub.sock` path; `spoke` is `ws+unix:<absolute spoke.sock>:/`. It has no `pid` or `port`. The file is 0600 and carries only the host secret. Older local files, with socket, port, secret, pid and version, retain their meaning. Optional absolute `root` remains compatible; canonical remote files omit it because the hub's root is not a host-local directory.

Spokes reread discovery before every reconnect and use the host bearer with their session launch credential. A host has no role-mapping database. Hooks and the mod bridge keep the session identity and credential on their socket frames. A host bearer grants no human authority: a status or doctor request may be refused by admission even though the tunnel answers. CLI status, task commands and doctor do not inspect a remote hub PID. Remote stop refuses local process management and retains discovery.

The carrier awaits its optional `beforeReady(signal)` callback after the authenticated agent probe and forward restoration. Readiness has a 30 second deadline. On expiry it aborts the signal, then waits up to one second for a positive callback drain. Cooperative cancellation goes through ordinary SSH backoff. An undrained callback retains the master and its ownership, starts no retry, and appears in `hub.status` as `connecting` with reason `host readiness cleanup incomplete`. Stop returns an explicit cleanup-incomplete error while that work is unresolved. It can complete after the callback positively settles; an RPC timeout alone never proves a remote writer finished. Publication reconciles an unknown write only with a later positive receipt on the same serial agent stream; missing receipts retain the fence.

Publication skips identical bytes on reconnect, so hub restarts keep the file unchanged. The agent publishes complete bytes at mode 0600 with Host atomic replacement, including changed per-host credentials after re-admission. An existing different record is replaced without a torn write. Revoking a host closes its peers and refuses the next spoke hello.

Embedding tests can inject `readinessPollMs` and `readinessTimeoutMs` on SshOptions; omitted values retain the carrier's100ms polling and10second setup deadline. These options do not alter readiness receipts or production defaults.

## Spoke startup imports

The spoke loads connection, framing and delivery code at startup. Tool schemas load on the first MCP tools/list request; argument validation and tool frame helpers load on the first tools/call request. ESM shares module initialization across concurrent requests. Named or credentialed sessions do not load the local database or journal to connect, on either platform. An unnamed local session with a native session id still loads the store for its role-mapping lookup; remote discovery skips that lookup. A skipped discovered connection loads and closes the journal to preserve its reason record. Tool schemas, wire frames and refusal shapes remain shared with the hub.

The static startup import policy and native idle RSS measurement are described in [the import-graph test guide](../agents/tests/hub-test-spoke-import-graph.test.ts.md) and [the footprint guide](../agents/tests/hub-test-spoke-footprint.test.ts.md). Linux comparisons name the exact baseline and branch heads, droplet runs, sizes and regions; a missing reading is unknown and no RSS threshold is enforced.
