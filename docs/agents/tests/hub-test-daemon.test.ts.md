# hub/test/daemon.test.ts

Long fixture roots opt into root-owned short aliases. The native regression
checks the alias's real directory inside the fixture, byte limit, status, stop,
native process closure and endpoint deletion. Its containing directory is fenced
by the item ownership scope through original acquisition and positive close.
Separate non-fixture layout assertions retain the ordinary temporary-directory
fallback and stable production basename. The final named census checks roots,
aliases and exact fallback paths after every case's cleanup.

For hub shutdown, `daemon.test.ts` runs a real `hub serve` with the web edge
enabled and a scratch epic-demo freshness Git command held at its batched raw history read.
It arms the durable `stopped` log observer before stopping, then separately
bounds process exit to two seconds and asserts both hub and Git PIDs are gone.
The background-drain regression holds conflict-retention native I/O outside the
storage operation queue. After its entry receipt, it requires an idle operation
queue, an abandonment event with `operations: []`, a durable `stopped` receipt,
exit code 1 and a reaped hub PID. The normal-stop case retains exit code 0 and
asserts that no abandonment event was recorded.
Provisioning shutdown uses the fake DigitalOcean HTTP API: hold create after its
durable lease is armed, observe `stopped` and OS exit within an unscaled three
seconds of `hub.stop`, then release the late create and confirm reconciliation
deletes the owned resource while preserving a foreign-tagged one. Separate
SIGTERM cases retain that exit bound, including a native socket-close callback
held through the CLI's two-second signal deadline (exit 1 with incomplete cleanup).
`executor-safety-component.test.ts` covers detached create replies after store
closure and interrupted provider cleanup on fake time at T2. Preparation's
restart test waits for the durable released lease before its empty-resource
assertions; the outcome notice alone is not a deletion receipt.
The CLI diagnostic case keeps a fully stopped process alive deliberately and
advances only its stop deadline after the shutdown receipt. It expects exit 1
and `stopped, lock released, process still alive`, with no signal after lock
release; the unrelated-PID case retains its separate safety assertion.

Raw authenticated Unix client cases assert and drain the additive hosts.state
projection after remote.state, before requesting hub.status. Keep the wrong
secret WebSocket/Unix refusals, spoke-role hello/ack/who checks, refusal of human
client hellos over the spoke WebSocket, and exact successful status facts. The
connect projection is not a status result. Run the native file alone under the
project preservation slot and observe its terminal producer completion.
