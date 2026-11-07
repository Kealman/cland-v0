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
of the admitted mux fails the copy. Copy refuses destinations outside host run/work/code directories,
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
host a lease and checkpoints an `adding` row under the same territory lock, then releases the lock before fetching, installing and registering the watch through the agent. Finalization reacquires the lock and checks the exact row, tip and lease owners before marking ready. A confirmed failure revokes the launch lease and deletes only
a newly created territory ref at its captured tip; an unknown outcome stays
fenced. A ready-checkpoint failure after an accepted checkout retains its adding
record, lease and ref rather than rolling back the accepted effect. The root node_modules link uses the existing agent install step.
`host_worktrees` in hub.db retains item, host, clone root, path, branch and tip.
TaskWorktrees reads it for launch reuse, list and prune after restart. Prune
checks the closed item, occupancy, unpublished host work and expected merge tip under the lock, then checkpoints a `removing` row with a unique removal id, captured tip and lease-owner snapshot. Add and relaunch refuse that row. It releases the lock before agent removal drains its publishers, then reacquires and revalidates the exact row, tip, lease owners, closed state and occupancy before revoking the lease. `host-prune-changed` retains the current state when any final check fails; incomplete removal retains its checkpoint for retry. It deletes a territory branch only at its recorded
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
names the required code directory. Initial installation belongs to host provisioning. On a version-mismatched hello, the registry delivers the standalone agent package over the pinned master and restarts it through the supervisor; see [the package contract](../agents/host-agent.md#agent-package-and-version-replacement).

Claude additionally requires agent capability `claude-launch-adopt-v1` for
its generation-scoped launch receipt and adoption. Its private host MCP/settings
files carry the launch credential at mode 0600. The existing account config
root must be agent-owned mode0700; its own job record may retain settings bytes.
Confirmed cleanup removes that pinned job only, preserving sibling jobs. Command argv, agent receipts and
command environments contain no session launch credential. Hooks and the mod bridge use the
forwarded host `hub.sock`, host secret and session launch credential. Confirmed
stop removes the private generation files and receipt. Unknown native
outcomes retain the files and fence subsequent mutations; known refusals hold
the row for explicit re-stop. Local launches
retain their existing CLI discovery and polling schedule. Remote terminal PID
observations perform one bounded generation settlement before publishing exit,
with one restart recovery retry. Failed settlement holds the row and role as
cleanup-incomplete. Liveness and discovery timers remain CLI-free.

The versioned remote layout names `<code>/hub/mod/cland` as `modDir`; host
configuration may override it. Fake hosts use the running installation’s
`hub/mod/cland`. The layout names the path; host code delivery must install
the plugin there. Claude still refuses a layout without a mod directory. OpenCode prepares its shared ignore
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
| `prepare-stop` | Checkpoint native pins for hub authorization and `beforeSignal`; adopted Claude uses the root and a best-effort positive descendant baseline. Commit revalidates authority; adopted Claude sends TERM to the pinned root, then converges on two matching descendant captures within the stop deadline. UID, live-parent ancestry, first-census exclusion and native births gate acquisition; positive pinned exits settle. Unknown births get one bounded re-read and persistent unknown remains incomplete. |
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
Both command paths may add `nativeAdmission: 'no-process'`: the native owner
recorded an already-aborted signal without a spawn call, a synchronous throw,
or an error with no observed PID followed by native close. Any observed PID or
missing close keeps ordinary failure/unknown semantics. Bounded results and
stored settlement replies preserve this receipt. The shared incomplete-result
classifier honors explicit native or generation non-admission before its legacy
error-text fallback, so an executable/config/cwd path containing `cleanup incomplete`
cannot negate positive owner proof. Untyped results retain the fallback. Claude consumes it only within
its captured generation, removes that pending checkpoint, and returns its
matching `claudeAdmission` refusal. Older results without these fields grant no
new cleanup authority. Before preparing a frame, `wire()` maps its own already
aborted signal to typed `CLAND_AGENT_ADMISSION_REFUSED` (`cancelled before send`).
It does not classify generic AbortError names or text. Partial/unflushed request
writes count as sent and retain unknown ownership without a positive receipt.

Claude cleanup retains a terminal generation receipt until the hub confirms
private-file deletion and invokes the receipt's forget closure. Lost release or
forget replies recover without native stop replay. Normal retention is one per
active/pending generation, zero after confirmed cleanup; no time eviction.
Revoke/remove integration belongs to T-1666.

The registry's reconnect hook restores adopted Claude workers through validated
generation receipts before reading the table. The optional restore capability
keeps old-agent hellos compatible; direct clients, startup and liveness perform
no implicit restoration. See [reconnect adoption](../agents/host-agent.md#reconnect-adoption).

Native identity and file/usage observations use a separate owned agent stream,
so a held recovery checkpoint cannot block the observation needed to settle it.
Host shutdown closes and joins both acquisitions; neither stream has a local fallback.

Supporting agents automatically publish task ref changes through the clone's Git
socket proxy. SSH Host registers each non-detached worktree and drains its watch
before removal. Agents without `ref-watch-v1` retain manual push behavior; see
[ref watches](../agents/host-agent.md#ref-watches) for operations and restart state.

### Session recovery after carrier readiness

Each authenticated agent acquisition restores adopted workers and reads the
retained process table before notifying Sessions. The ready notification retries
running rows for that host, including startup attempts made while its tunnel was
down. Concurrent notifications share one recovery flight per host. A readiness receipt
during that flight retains a follow-up pass before it settles, so earlier startup
failures are retried. Shutdown joins
that flight before storage closes. Adapters re-find the recorded PID and native
birth through the owning Host, restore session forwards from their recorded
endpoints, and resume native subscriptions. A failed tunnel observation retains
the running row and role; only a positive native exit or identity mismatch ends
it. The carrier restores its Unix forwards and republishes host discovery before
becoming ready, allowing credentialed spokes to reconnect.

## Terminal attach

`cland session attach <name>` prints a separate `ssh -t` connection for a registered
SSH host. It uses the registered client key and pinned `known_hosts`,
`StrictHostKeyChecking=yes`, `ControlPath=none`, `ControlMaster=no`,
`ClearAllForwardings=yes`, `-a -x` and ignores the user's SSH config. It runs the
installed Node/CLI's `cland host attach <name>` with the host layout's run directory.
Unavailable optional terminal printers project `attach: null` without interrupting
session lists or snapshots; an explicit attach reports the refusal.
Local sessions keep their existing harness commands. Hosts without the optional
terminal printer explicitly refuse remote attach.

Each remote harness launch/relaunch publishes `run/attach/<sha256(name)>.json`
(mode 0600, directory 0700) through its launch transaction. The record holds its
native birth identity, cwd and harness attach command with account paths; it
never copies host/project/session admission secrets or the OpenCode password.
OpenCode reads that password from its existing host file into the attach client's
environment using shell builtins before direct harness exec, with no intermediate
native `env` argv containing the password. Rollback restores the preceding record. Records are replaced at
relaunch; stale terminal records grant no attach because native identity is checked.
The host command reads only that agent's run folder, refuses missing, unsafe or
non-live records, sets cwd, runs `stty susp undef`, and execs the harness client.
Closing the client never invokes the session stop path. A session launched before
this capability has no attach record and requires a relaunch to use host attach.

### Verification publication boundary

Host verify and both explicit and automatic ready flush the agent's existing
leased ref-push owner. The hub compares the owning worktree HEAD with the territory
branch; unknown/fenced pushes and mismatches refuse with both heads named. The
CLI's optional `worktreeHead` is corroborated through the owning Host, never used
as authorization. Old local request shapes remain valid. Old agents without `ref-flush-v1`
cannot establish this receipt and explicitly refuse host admission.
Verification records the pinned territory SHA and branch and uses the scheduler's
hub-local detached source; see [publication admission](../agents/host-agent.md#publication-admission).

Interrupted snapshot preparations are abandoned, never resumed or completed.
Re-admission derives a fresh source/run UUID from its pinned SHA. Abandoned cleanup
checks Git admin/common lock files for at most 250 ms per sweep; locked paths stay
listed in hub status and a later sweep removes them once locks clear. The status
field is optional for older hubs and null while its initial census is pending.

## Host reboot

A returning authenticated agent's boot id accompanies its retained-table readiness
receipt. Sessions compare it with each remote row's persisted Linux native birth.
Tunnel loss and same-boot agent or supervisor replacement retain running rows.
A positively changed boot records T-1666's generation retirement obligation and
native-operation fence before marking the row exited and releasing its role with
the ordinary harness-exit notice. No adapter stop or native signal is sent for
old-boot rows. An in-flight resume cannot republish their old birth as running.

Cleanup-incomplete Claude and failed-launch owners remain live obligations until
this positive changed-boot receipt. Their pending resource undo and private-file
retirement remain durable after exit; boot closure does not imply resource cleanup.
Unavailable or legacy boot evidence grants no reboot authority. Carrier reconnect
runs the existing supervisor bootstrap, starting a fresh agent when reboot removed
the old supervisor. Fake-host mode requires its boot-file control on every
platform and rejects missing evidence before agent recovery. The agent,
supervisor child observers and admission bootstrap share that source; ordinary
Linux agents ignore a stray boot-file variable and read the kernel boot id.

Host checkout checkpoint acquisition uses the existing bounded backoff for up to 32 seconds (the 30 second receive ownership cap plus 2 seconds), at both preflight and finalization. This joins an admitted receive rather than refusing immediately. A caller already holding that territory lock refuses as `host-worktree-lock-order` before any Host operation; it never waits on itself. Receive acquisition remains capped at 30 seconds.

Public cross-host relaunch admission uses the same checkout checkpoint policy before adapter drain: acquire with the bounded backoff, then refresh task eligibility, destination registration and exact row ownership before admission. Prune observes Host state first and refreshes row, tip, leases and synchronous item eligibility after those asynchronous observations, immediately before cleanup admission. An item reopened during an occupant query retains its branch and removing checkpoint.

### Runtime host ownership

The daemon exposes its project SSH lifecycle owner as `dispatcher.hostOwner`.
Provider orchestration persists a registered `HostRecord` and its private
bootstrap material first, then awaits `hostOwner.add(record)`. Startup uses the
same method. Add opens the Git daemon and carrier, publishes the Host to Sessions
with its authority fence, and retains lazy territory cloning on first worktree
add. Carrier start schedules connection recovery; callers needing agent readiness
observe an authenticated Host operation, rather than treating add as a ready
receipt. Duplicate, revoked and changed registrations refuse.

`hostOwner.remove(id)` first calls the dispatcher's existing `revokeHost`, which
settles captured generations and cuts host admission. It returns that settlement
report after quiescing clone preparation, closing the Host, stopping the carrier,
closing the Git daemon, and removing the Sessions map entry. Retained adapter
Hosts remain fenced. A failed close keeps the owner for a cleanup retry. Removal
revokes the persistent registration; ordinary hub shutdown leaves registrations
registered so the next startup reopens them. Add/remove serialize with shutdown;
quiesce prevents new additions and drains in-flight preparation before closure.
No new frame or CLI command is introduced by this owner API.

Spawn admission enforces the agent's decimal 1.3 GB memory floor independently
of slots. `HostMemoryFloorRefusal` (exported from `host/ssh-host.ts`) carries code
`memory-floor`, `host`, `availableBytes` and `floorBytes`. Direct/prepared spawns and Claude launches
share the admission guard; durable prepared failures preserve the typed refusal
when the reply is lost. Older agents' fieldless failures remain generic. Native memory admission uses
Linux MemAvailable only; non-Linux without a fake override has no verdict and
admits launches. See
[the agent memory override](../agents/host-agent.md) for fake-host byte controls.
