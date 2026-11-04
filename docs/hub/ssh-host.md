# SSH Host

The hub registers an SSH Host for each registered host record at startup and
starts its carrier. `local`, injected Hosts and `CLAND_TEST_HOSTS` retain their
registry paths. The testHost recording double refuses native files by default;
its stat delegates only when the double explicitly installs the shared local
fileType/writeFile/removePath functions for scratch file preparation. Real SSH
Hosts always use agent stat and never take that test-only path. Revoked records are excluded; operations recheck registration.
The daemon owns sessions, agent clients, carriers and per-host Git listeners in
that shutdown order. Stopping the hub joins its owned I/O; detached host
harnesses and the host supervisor survive.

`ssh-host.ts` implements the Host interface through the authenticated agent
socket. Files, commands, worktrees, process identities and usage execute on the
host. Per-session forwards use the SSH carrier and return hub-side Unix sockets.
Idle account polling is disabled. A down or connecting tunnel refuses native
operations with the host name and tunnel reason. There is no local fallback.
The layout is a pure value so disconnected rows can still name their paths.

## Territory clone and task worktrees

After carrier readiness, the first task worktree prepares a shared clone at `~/.cland-host/work/<project-key>`
(the first 12 SHA-256 hex digits of the hub project root). Git uses only
`git://cland/territory.git` and the forwarded `git.sock`. `core.gitProxy` takes an
executable filename rather than shell source: an atomically published 0700
`run/git-proxy` wrapper invokes the installed `cland host git-proxy <socket>`.
The setting is clone-local. If daemon cloning fails, a bundle including HEAD
and branches travels over scp on the same pinned ControlMaster; origin returns
to the socket URL. SCP disables independent-connection fallback with `ProxyCommand=false`, so loss
of the admitted mux fails the copy. Copy refuses destinations outside host run/work directories,
has a 10-second native deadline, and returns a path-free failure.
The clone's `.cland/hub.json` has the canonical discovery bytes and mode 0600;
unchanged bytes survive reconnect and restart, and walk-up discovery from a
linked worktree needs no `CLAND_HUB_FILE`. No installer runs on this path. Projects without a managed territory attempt
no clone. Clone work never holds carrier readiness: concurrent task adds share
one preparation, while clone progress/failure is logged separately. A failed
clone refuses the task add with its host name. Registry shutdown quiesces the Host, aborts and joins
preparations before closing the Host, carrier or Git listener. A lost command outcome
reports incomplete ownership and keeps its storage fenced.

Item launch creates its branch from territory dev (main fallback), grants the
host a lease under the same territory lock, then fetches and adds the worktree
through the agent. A confirmed failure revokes the launch lease and deletes only
a newly created territory ref at its captured tip; an unknown outcome stays
fenced. A ready-checkpoint failure after an accepted checkout retains its adding
record, lease and ref rather than rolling back the accepted effect. The root node_modules link uses the existing agent install step.
`host_worktrees` in hub.db retains item, host, clone root, path, branch and tip.
TaskWorktrees reads it for launch reuse, list and prune after restart. Prune
checks the closed item and occupancy, refuses unpublished host work or a moved
merge tip, removes through the owning agent, then revokes the lease. It deletes a territory branch only at its recorded
launch base when this launch created it, or at the expected merged tip; existing
or advanced branches remain. Existing local Git worktree discovery is unchanged.

## Layout and installation

`remote-layout.ts` owns defaults: `~/.cland-host/code/<VERSION>`, the host's
`.cland-host/run` and log directory, and `node` resolved on the host. The daemon's
embedding `hostConfigurations` option can override a host's home, layout and
installed supervisor path. Host records currently carry address and user;
without an override the home is `/root` for root or `/home/<user>` otherwise.
Fake-host configuration uses the shared scratch home and the current checkout's
code. Real images/providers install the version directory (E-1533). Launches
requiring an absent version directory refuse with its path; a down tunnel also
names the required code directory. Code installation is outside this Host.

No remote `modDir` is assumed. Claude refuses a layout without it; callers may
supply an installed host-side mod directory. OpenCode prepares its shared ignore
through the launch Host, preserving existing contents and appending a missing wildcard.

## Atomic files and metadata

`publishFile(path, bytes, {mode?, replace?})` writes and syncs a unique sibling
staging file, then links it without clobbering (false means a path already exists)
or renames it when `replace:true`. It cleans staging before returning. Concurrent
create-only writers have one winner; readers see complete published bytes.
`appendFile` appends exact bytes with O_APPEND. `stat` follows links and returns
native mode and size; missing paths reject with their native error code. These
additive RPCs preserve existing operations and use the existing 512 KiB payload
cap. SSH publish/append use prepare/commit tokens and durable result receipts:
a lost accepted reply reconciles the exact operation without replaying append.
A disconnected in-flight file writer fences mutations on both Host and agent;
settlement and shutdown join it. After an agent restart, an interrupted file
commit with no durable result stays pending and fenced; it is never replayed. Older agents refuse unknown operations; there is no local fallback.
Launch rollback uses stat permissions to restore an overwritten file and size to
truncate an appended log. Discovery replaces changed per-host credentials using
atomic publication with mode 0600; identical bytes keep the current file.

## Command environments

`HostCommand.env` carries explicit additions at remote adapter boundaries.
`hostCommandEnvironment` retains the existing local base/addition merge and
credential filter. Remote commands receive the agent's base plus additions,
never the hub's base. `remoteCommandEnvironment` applies the shared executor
credential deny-list after overlays on both ends and removes project/host
secrets. Session launch credentials remain explicit additions. Remote default
account paths are resolved on the host; a selected account's explicit overlay
still travels with the command. Synthetic planted-value tests exercise these
boundaries without reading real credentials.

## Prepared operations and compatibility

Hello adds optional `capabilities`. The SSH Host requires `host-prepared-v1` and
refuses older agents naming the missing capability. The original protocol-1
monolithic operations remain available and keep their original behavior.
Native errors may add an optional string `code`; new clients retain it for Host
filesystem decisions and accept old error replies without it.

| Operation | Boundary |
| --- | --- |
| `prepare-spawn` | Open the remote log and return a connection-owned token before hub authorization. Commit uses that held descriptor. |
| `prepare-stop` | Capture and checkpoint the native tree, then return its births for hub authorization and `beforeSignal`. Commit revalidates the same captured set. |
| `prepare-worktree` | Complete Git work before the hub's `beforeInstall` callback. |
| `commit-prepared` | Consume the token once; optional `install:false` retains Git work and skips installation. |
| `abort-prepared` | Close held resources and clean newly created empty logs or newly created worktrees. |
| `run-host` | Run a bounded command with filtered host base/additions, an operation UUID and recovery key. Persist its result only after native cleanup. |
| `cancel-run` | Abort that connection's matching command; the original run reply follows native cleanup. |
| `processUsage` | Return the shared Host native process-usage snapshot and tree aggregation. |

Prepared work expires after 10 seconds, on connection close, or before a restarted
agent admits work. Private plans retain cleanup ownership across restart. Existing
logs are preserved; a new log is removed only when its captured inode is still
empty. Committed process ownership transfers to the agent's existing admission
and native completion machinery before the child can write. A spawn's `exited`
resolves from its matching `process-exited` receipt. Reconnection reconciles exact
retained native receipts; an unobserved exit remains unknown.

The contract's behavioral cases run through the fake SSH carrier. Only its
local-specific forwarding/layout row accepts per-Host expected values; local
assertions remain unchanged. Fixture socket paths use the shared digest fallback
and reciprocal aliases, assert actual connect-path byte budgets, and clean only
their owned aliases/fallbacks after native process drainage.

## Reconciliation and cleanup ownership

The hub admits a UUID operation id and a separate recovery key before preparation.
The agent checkpoints that binding and a terminal outcome. Spawn transfers the id
to its native launch admission and records the accepted PID/birth result before
releasing the bootstrap. `settle-prepared` can recover the exact result on a new
authenticated stream using that recovery key; a lost commit reply does not imply
failure. Unknown outcomes fence remote mutations and remain pending until a
positive result. Shutdown quiesces those waits and reports unresolved ownership
as incomplete while preserving their storage.

While spawn completions are outstanding, one per-Host reconnect driver reads
`native-receipts`; these contain only native receipts recorded after their durable
checkpoint (or loaded from it). A carrier interruption therefore does not require
an unrelated Host call to settle `exited`. A root's absence alone never settles
its retained descendants: stop delegates to the agent's admitted owner and waits
for complete captured-tree closure.

Prepared checkout cleanup requires the reserved directory identity, the observed
`.git` identity, Git metadata-directory identity, repository and expected tip.
Replacement or modified checkouts are retained with explicit incomplete cleanup.
Proven absence and pre-create interruptions are idempotent. A restart during an
unjoined native Git command keeps that operation and its storage fenced; it does
not guess that the writer ended. Committed results live in a separate directory
and are read by exact id; startup streams only unfinished plans, without scanning
retained result history.

The agent's dependency closure permits one external leaf,
`shared/executor-credentials.ts`, imported only by its command-environment owner.
That leaf must retain a Node-only import closure. Usage aggregation lives under
`host/agent`; the local Host imports that owner. The source guard checks the
closure and includes an allowlist-omission control.

Preparation registers its owned plan before effects begin. Every failed abort or
cleanup attempt fences mutations until a positive cleanup receipt clears it;
close examines both active work and unresolved fences and reports incomplete
ownership explicitly. This includes failure before the prepared token reply.

Commands use the same durable operation settlement as prepared effects. A stream
loss aborts the connection's command, while the Host keeps its result pending and
its storage fenced until `settle-prepared` returns the native cleanup result.
A restart without that command receipt remains unknown and requires recovery or
host recycling; it is never rendered as successful cleanup. Invalid command
arguments use the existing agent parser before native admission.

Host close fences late acquisitions, joins their handshake work and closes every
client it acquired. Failed close obligations stay tracked for retry.

Every prepared Git boundary checkpoints `git-running` before inspection or
mutation, including commit validation and abort/restart removal. Only a joined
native result restores the previous phase. An incomplete native writer retains
that durable fence; settle, close and restart cannot retry Git against it.

For `run-host`, a serialized command result above half the agent's 1 MiB frame
budget becomes a bounded terminal result before persistence. It retains the
native exit code, the final 4096 characters of stdout and stderr, and an explicit
error naming the cap and original output byte counts. Small results retain their
original bytes. The same stored result serves the first reply and later
settlement replies, so escaped output and a lost reply cannot prevent completion.
The retained monolithic `run` operation is unchanged.
