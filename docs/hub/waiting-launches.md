# Waiting launches

A role's non-local pool launch without an explicit host returns
`{waiting: {name, role, pool, reason, since}}` when no ready member has room.
It has no `process` field. The local pool keeps its existing immediate launch
behavior. An unknown pool refuses. Explicit host pins refuse when full.

`cland session launch` prints `waiting: <reason>`. `session.list` keeps its
processes and rows arrays and adds `waiting` for the active view; the archive view returns no active waits. Inbox frames add optional
`waitingLaunches` status records outside `needsYou`, asks and approvals.
Clients meeting an older hub treat absent waiting arrays as empty.
`session.stop` cancels a wait and returns `{cancelled: <waiting record>}`;
the CLI prints the cancellation. A waiting name remains reserved. Status records may carry the pinned item; Lead stop admission checks that item against the claimed subtree.

Waits are durable in `hub.db`; stopping the hub retains their request, admitted
actor identity, pinned pool, reason and original `since`. Startup restores them
before the first retry pass, without repeating the start notice. Typed memory
refusal evidence is retained while its recorded host remains ready and registered;
a fresh agent memory report releases that host for admission.
They retry serially on positive process exit/stop checkpoints, committed
provision-state changes, pool config publication and agent memory reports.
Only ready registered hosts can place. A typed memory-floor refusal excludes
that host until a fresh memory observation; other pool members may still place.
The reason names the refusing host and its available bytes. Native outcome
uncertainty retains the existing cleanup owner and never becomes a wait.

Agents records `session-waiting` when a wait starts, its reason changes or it
ends. Repeated passes with the same reason produce no lifecycle notice.
A successful retry also records the ordinary session-start notice.
Cancellation and shutdown join in-flight retry work before returning.

`Sessions.capacityChanged()` is the scheduler wake-up seam. ProvisionRecords
listeners receive host id, previous and committed state, after autocommitted
writes; throwing listeners cannot fail a write. Sessions unsubscribes on close.
The SSH Host's capacity subscription carries the existing agent memory event.
The session.stop spoke tool uses the existing role grant and scope checks; no role gains a new grant or cloud API access.

Insertion rechecks capacity to close the selection-to-queue race. Releasing a
placement promise also wakes waiters, including an unpublished failed launch.
Positive pending-stop and retained-generation closure checkpoints wake the
queue even when no new process-status event follows. Memory reasons retain the
last typed refusal while the host remains blocked and ready; unrelated config
or capacity passes do not erase that evidence. Cancelling an idle entry does
not join another entry's admitted retry. Shutdown starts registered adapter
closure before joining cancelled retry work and keeps storage open through it.

An accepted session request retains its admitted actor identity independently
of the originating spoke connection. Placement retries resolve that session id
through the existing dispatcher actor resolver and recheck current role grants
and item scope. Disconnect alone does not cancel a wait; revoked authority
ends it without spawning. Restart recovery retains that actor identity alongside its request and rechecks
the current grant, target username and captured inferred role; it never serializes a transport.

An accepted wait pins the pool it was admitted to. Changing the role's pool
changes new launches; retries continue in the pinned pool. If the human wants
the new pool, they stop the wait and launch again. Removing the pinned pool
ends that wait once with an Agents notice naming the launch, removed pool and
reason; the active list/inbox row disappears and its waiting name is released.
There is no terminal dropped-wait list tail. Retried native authorization also
checks that the pinned pool still exists before publication.

The queue finalizer re-arms a pending capacity notification received after its
last loop check, so neither an add nor a wake is stranded during job handoff.


## Restart settlement

The process-table connection deletes a wait in the transaction that publishes
its session row, using the exact admitted wait id even when an idle worker
keeps a different name. Ordinary process writes do not consume waits. A cancelled wait is deleted before cancellation returns.
Startup drops waits whose role or pinned pool was removed, recording one Agents
notice addressed to the Coordinator in the same transaction as deletion.
Shutdown joins retries but retains unplaced durable rows. This queue does not
claim authority over native launches whose cleanup is still pending.
