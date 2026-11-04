# hub/test/host-clone-integration.test.ts

Uses sshHostFixture's short disposable roots and process census. Real Git and
agent operations cross fake SSH only. The bundle test injects daemon refusal,
then uses real bundle clone and the fake scp on the pinned master. The first
case checks the exact worktree HEAD, branch lease, node_modules link, confirmed
host failure rollback, database reopen, worktree CLI discovery without an
override, list/prune after reopening records, and native removal.

Source-review fault cases retain an actual agent checkout, lease and adding
record when the ready checkpoint throws. A dedicated fake scp loses the mux
socket during native admission and records whether independent connection
fallback was enabled; production requires ProxyCommand=false. Both cases were
observed red before correction. The fake never opens a network connection.

The carrier-ready regression holds preparation at a Host.run seam before
calling the native runner and observes that the carrier remains up. Releasing the held clone
produces a host-named task-add refusal. It uses fake SCP only and does not alter
the unedited host-ssh-contract or remote-discovery-host fixtures.

The disconnected-close regression launches an actual native fake clone writer,
observes its PID file, disconnects the command reply and holds native
cancellation. Direct registry.close must quiesce settlement before joining,
report incomplete ownership and preserve writer storage. After those assertions, fixture cleanup
releases cancellation, observes the durable result and checks PID absence.
