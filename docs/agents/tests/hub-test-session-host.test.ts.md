# hub/test/session-host.test.ts

T2 recording local Host tests at the Sessions/AdapterHost and LaunchFiles seams.
Use tempProject for disposable roots, in-memory HubCore and a fake harness; no
native harness or provider starts. Inject hosts into Sessions. Assert directory
refusals and stable Host lookup, identity publication, legacy birth upgrade,
checkpoint-before-stop ordering, old durable pending-stop recovery after database
reopen, and startup/timer deaf liveness. Wait for the durable episode checkpoint
with eventually. Host stop options retain launch grace and permit proven reuse
only on the rollback path. The five required session regression files stay
unedited; their individual runs prove behaviour preservation.

Keep adapter-native-boundary.test.ts unedited as the native rollback control:
its OpenCode case holds libuv's exit receipt after OS termination and waits for
the owner's harness-ended log before asserting that no files were undone. The
local Host must forward termination logs, then LaunchFiles joins child exit.
