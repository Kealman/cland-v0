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

Remote registry cases reject missing, malformed, mismatched boot and reused start
proofs, and verify a matching birth reaches the named Host stop. Remote legacy
timestamps never upgrade ownership in Sessions or restored LaunchFiles; the
pending receipt remains retained. Local Host lookup identity stays unchanged.

The remote pool cwd rejection control keeps the idle member and its durable row,
names the refusing Host and checks that no replacement row or stop was produced.

The new cwd callbacks enter fixtureWork(t) before acquisition. Root adoption,
resource acquisition and fenced body steps join setup and late owners before
resource disposal and root removal; exact refusal and process assertions remain.
