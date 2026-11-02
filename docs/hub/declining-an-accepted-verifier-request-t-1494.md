## Declining an accepted verifier request (T-1494)

Reviewer and QA use `verification.decline` with `request` set to the delivered
`msg_id` and `reason` set to one nonempty line. The hub checks the caller's durable
session and exact accepted receipt, clears that pending reservation immediately,
and durably returns the reason and request id to the original requester's session
in the request topic. Missing agent identity or incomplete captured-ID delivery
admission refuses and retains pending; retry after identity recovery. Human
requests receive the notice in their topic. It records
no verdict and does not requeue the declined request; the requester decides the
next assignment. Other queued requests can use the released capacity immediately.
A stale id cannot release newer work, even on the same item or head. Existing
tracker holds remain separate: release an acquired hold with `task.hold` too.
Requests without a captured message receipt cannot be declined by guessing prose.

Verifier sessions must be relaunched after this tool lands: tools are fixed at
launch. Inherited roles with explicit tool lists must grant `verification.decline`
to Reviewer/QA; generated defaults include it. Older hubs refuse the new tool
without changing pending state; do not substitute a verdict to clear it.

### Unix spoke edge

A listening project hub also binds `.cland/run/spoke.sock` at 0600. If the path
exceeds 100 UTF-8 bytes or cannot round-trip through a `ws+unix:` URL,
`layout(root).spokeSocket` selects
`cland-spoke-<root hash>.sock` in the system temp directory, then `/tmp` if needed. Both candidate directories
are checked for the byte limit and URL compatibility; the human JSON-lines socket
keeps its existing path selection.
It speaks the existing WebSocket protocol at `ws+unix:<path>:/`, with the same
bearer admission, keepalive and dispatcher identity as the loopback spoke edge.
Missing or wrong bearers get HTTP 401 and an unauthorized refusal log; a client
hello is refused on both spoke edges of a project hub. Startup atomically replaces
stale endpoints under the project lock; shutdown drains connections and removes
only the inode it bound. Listener mode `never` binds none, and `optional` rolls
back all spoke and human listeners on bind failure. Local discovery and spoke URLs
stay unchanged. This edge adds no host admission: per-host credentials and their
principal restrictions are owned by the host admission layer.

### Host agent protocol

`cland host serve` runs without systemd, listening on `agent.sock` (0600) under
`CLAND_HOST_RUN_DIR` (0700; default `~/.cland-host/run`). Supply the per-host
`CLAND_HOST_SECRET` in the environment, never argv. The agent uses only Node
built-ins. Its v1 JSON-lines protocol and recovery semantics are documented in
[the agent protocol](../agents/host-agent.md). Linux uses `/proc` birth
identities; only fake hosts on macOS may use `CLAND_FAKE_HOSTS` with a UUID file
in `CLAND_HOST_BOOT_ID_FILE`. Detached children survive agent termination.
Memory reports are advisory samples and impose no launch floor. The agent retains
captured descendants after root exit; an exit missed during downtime keeps
unknown authority and refuses stop until host reboot or recycling. It adds no
per-launch supervisor process.

### Per-host Git socket

`startGitDaemon` (`host/git-daemon.ts`) serves one territory over a caller-owned
Unix socket in a private directory; it returns after chmod 0600 and never binds
TCP. The transport owner supplies the per-host socket path and closes the listener
before releasing its directory. Each connection runs `git daemon --inetd` with
half-open relays, no inherited write authority or Git configuration environment,
and `CLAND_PUSH_HOST` set from the owning host. Receive policy enables object fsck,
disables automatic GC, denies deletes and caps input at 128 MiB. Eight concurrent
daemons are admitted per listener/host; excess connections close and emit a fixed
capacity refusal. Exit logs contain host, connection, duration, code and signal,
never child stderr or environment values. Close stops owned children and joins
native close receipts. Failed permission setup after bind uses that same shutdown
before reporting the original acquisition error; incomplete cleanup retains both
errors in an aggregate. The built-ins-only `host/git-proxy.ts` takes a socket path
before Git's host/port arguments, preserving request EOF while draining responses;
transport/bootstrap owns installation as `core.gitProxy`. This module does not
install the territory hook or grant branch leases.

### Host records and bootstrap secrets

`host/transport-kind.ts` owns `TransportKind` and `parseTransportKind(unknown)`.
0.4.0 accepts only `ssh`; `outbound` requires 0.4.x. Explicit transport values in
any `[hosts.<pool>]` are validated at start and `cland hub reload`; a refusal
names `hosts.<pool>.transport` and prevents startup or retains the last loaded
configuration on reload. Omitted transport is accepted. The interim validator
leaves other host keys untouched; pool parsing belongs to E-1534. Persisted host
record reads use the same parser, preserving the existing `ssh` record shape.

Opening `hub.db` adds `hosts` in place. `Store.hosts` stores the id, `ssh`
transport, address, user, state and SHA-256 secret digest. `HostSecretStore`
writes a random 32-byte secret, `known_hosts` pin and `client-key-path` reference
as 0600 files under `.cland/run/hosts/<id>/` (0700). Registration takes the
client key path and pin as inputs; it generates no SSH keys. Public record reads
omit the secret and digest. Bootstrap callers read the private secret explicitly
and deliver it only on stdin, never argv, logs or frames. Startup restores these
values into the project output redactor. Revocation storage fences matching and
secret reads; admission and connection shutdown are separate consumers.

Both `CLAND_FAKE_HOSTS=f1,f2` and `CLAND_FAKE_HOST_ROOT=/absolute/scratch/root`
are required to register fake records at startup. Each named directory supplies
`host-key.pub` and the synthetic `client-key` path; pins use `<id> <public key>`.
Existing records, including revoked records, are never reminted at startup.
The hook creates records only; remote Host operations require the transport.
`hostPaths` owns agent, git, control and hashed session socket paths. It uses
private short directories in the temporary directory, then `/tmp`, when the
project path exceeds the shared 100-byte socket budget, reserving SSH suffix
space. These sockets are per-machine runtime paths; private material stays in
the project directory.

### Host process operations

Local and remote Host stop capture descendants by PPID ancestry while the root
is live and retain each native birth after changes of group/session or
reparenting. Signals recheck each target individually. The remote agent persists
these captures through restart; observed natural exit closes when the captured
members are gone. Unknown authority remains for root exits missed during agent
downtime. Neither path can discover an escape after its ancestry was lost.

A descendant that escaped before any capture is outside cland’s authority on both Hosts and is never signalled; host recycling clears it.

The test-only SSH pairing uses `CLAND_FAKE_HOSTS=f1,f2` and an absolute
`CLAND_FAKE_HOST_ROOT`, containing `<name>/home/.cland-host/run` (0700),
`boot-id`, `host-key.pub`, `client-key` and `known_hosts`. `sshBinaries(env)`
selects system `ssh`/`scp` for the host carrier unless both controls are nonempty; only then may
`CLAND_SSH_BIN`/`CLAND_SCP_BIN` select the executable Node stand-ins under
`hub/test/fakes/`. They pin keys, relay Unix sockets (0600), run commands with
a sealed host HOME and copy files into that HOME. Loopback destination ports
map through `<name>/ports.json` to host Unix sockets; no network socket is opened.
`fake-host.ts create|kill-master|gone <name>` controls disposable hosts; killing
asks the live master to signal itself after checking host/boot identity and its
per-master token; the ownership record publishes only after bind. Commands
are trusted fixture code, not an operating-system sandbox. The separate droplet
executor (`executor/droplet/machine.ts`) still reads these binary overrides
ungated for its own fixtures; T-1626 owns its migration. See
`docs/agents/tests/hub-test-fake-ssh.test.ts.md` for setup and limits.

`hub/src/host/host.ts` defines the process seam for session Hosts.
`localHost(env)` implements `spawn`, `run`, `identity`, `alive`, `stop` and
`processes`; session callers migrate in the following Host items. Spawn accepts
an explicit environment and cwd, uses ignored stdio and a detached session/group,
and returns only a PID after native spawn, with no retained caller handle.
Environment values stay in the environment, never appended to argv.
Short commands use the bounded doctor runner, with cwd, output, exit status and
optional cancellation. Existing runner callers keep their defaults.

Identity includes native birth and the legacy ps start timestamp. Liveness
preserves existing conservative unreadable-proof and legacy timestamp behavior;
stop requires matching native birth and delegates complete tree termination to
`endProcess`. A legacy timestamp alone never authorizes a signal.
`processes` returns resident bytes and ps CPU percentages summed over each PID
and its descendants. These are one OS snapshot's samples, not an interval peak
or a launch gate. This item adds no command, policy, role permission or dependency.

### WebAuthn verification module

`hub/src/hub/webauthn.ts` exports bounded, synchronous, nonthrowing
`verifyRegistration(response, expected)` and
`verifyAssertion(response, expected, credential)`. Responses carry decoded byte
arrays, including the credential id; expected values come from the server's
ceremony record, never the response. Registration returns a credential containing
its id, SPKI PEM public key, COSE algorithm and sign counter. Assertion returns
the next counter. Failures return `{ ok: false, reason }` without input bytes or
native crypto diagnostics.

Only attestation `none`, ES256/P-256 and Ed25519 are supported. RS256 and other
attestations fail closed. Both ceremonies validate type, canonical base64url
challenge, exact origin, RP hash, presence, optional required user verification,
flags and complete authenticator-data consumption. Origins must be HTTPS, or
HTTP localhost; RP ID equals the origin hostname (v0.4 decision A8). Cross-origin
ceremonies are refused. Assertions verify the signature over authenticator data
and SHA-256 of the original client JSON bytes; any nonzero counter must advance.
The parser accepts definite-length CBOR only, caps input at 64 KiB, client JSON
at 8 KiB, CBOR depth at eight and total CBOR items at 4096, and rejects duplicate
map keys, invalid UTF-8 and trailing bytes.

The integrating sign-in flow must generate unpredictable challenges, expire and
atomically consume them, bind the expected origin/RP and credential to the user,
enforce credential uniqueness, and atomically persist counters before admitting
a session. None attestation provides no authenticator provenance or registration
signature. This module adds no sign-in route or changes to single mode. See the
[W3C registration and assertion procedures](https://www.w3.org/TR/webauthn-3/#sctn-rp-operations).

### Local Host files, worktrees and polling

Host launch primitives include exact byte writes with explicit modes (including
existing files), single-directory creation, nonrecursive path removal, and a
loopback port probe that releases the port before returning. Forwarding is
session-owned: local returns the supplied Unix-socket or loopback-port endpoint
and cancellation is a no-op. The read-only layout resolver preserves the supplied
discovery, node, CLI and spoke entries and derives run/log directories beside
discovery. LaunchFiles journals and mutates through its Host, retaining hub-local
undo metadata reads and the previous pending-stop journal format. Remote test
Hosts refuse these operations by name. Adapter layout adoption is separate from
these primitives.

Claude Code rows on a Host other than `local` run one `claude agents --json`
for each launch and at most one for an explicit restart resume. Discovery is
isolated by host and session and never writes the local directory schedule.
A relaunch drains any predecessor query before its fresh launch discovery.
Timers run only Host liveness with the recorded Linux birth identity; hooks and
the mod bridge supply state. A missing launch PID remains supervised as `running`
with an unknown PID, logs `harness-pid-unknown`, and receives no timer discovery
or PID probe. Explicit resume can discover it once. A claimed warm spare keeps
its PID. Explicit stop and native-identity hook reconciliation still use Host
commands. Local directory polling and its persisted schedule stay unchanged.
No CLI, setting or role permission changes apply.

Task launch creates a missing task branch in the territory under the territory
lock before calling the launch Host. Local publication requires an absent-ref
lease and a native new-ref receipt; an up-to-date result grants no ownership.
The Host fetches the captured commit without reading or writing FETCH_HEAD. On
local the base is the root task-base tip (including unpublished commits), pushed
into the territory; on a nonlocal Host the base is the territory task-base tip.
The local Host adds the linked worktree in the root repository; branch names,
paths and task-worktree journal fields retain their existing form. An existing
territory branch supplies its tip; a root-only branch keeps its local tip.
Failed add rolls back newly created refs only at their captured tips and without
a registered worktree. Territory config `branch.<name>.clandLaunchBase` records
launch-created refs: prune deletes those refs only while unchanged at that base,
retaining pushed commits and pre-existing territory branches. Calls that omit the
optional worktreeAdd territory source keep legacy local-ref behavior.
No command, setting exposed to the human, or role permission changes.

Codex app-server launch and relaunch use the session's Host for the cwd check,
`codex --version` (once per launch), detached spawn with the existing appended
log, native birth identity, liveness and stop. Executor credentials are filtered
after account environment overlays. Poll and connection-close checks revalidate
the watched row after asynchronous Host replies. The admitted Host is captured
once and its name stays on both returned and internally watched process rows.
Concurrent probes share one in-flight check per captured row. Codex close returns
a promise that joins admitted launch, resume, stop, reconnect and probe work;
late accepted launches roll back before it settles. Incomplete cleanup retains
the PID/undo receipt and rejects close rather than claiming shutdown complete.
Standalone adapters without Host lookup callbacks use the local Host.
Codex sandbox profiles resolve writable roots, linked-worktree Git directories
and local-network socket allow/deny paths through that captured Host's realpath,
statDirectory and readFile. Local profiles retain their serialized bytes.
Adapter launch path selection, sockets and RPC transport remain hub-local;
Host layout adoption is handled by the adapter migration item.

Sessions owns a registry containing `local`.
Remote liveness and stop use only that row's registered Host and require its
recorded `linux:<boot-id>:<start-ticks>` birth to match the Host's current identity.
Missing or mismatched proof grants no signal authority. Legacy `pid_started`
upgrades apply only to `local`; remote pending-stop recovery accepts Linux proof
without a legacy timestamp. Unknown hosts remain `unknown` and refuse lifecycle
operations, with no local fallback. Remote Claude rows without a PID cannot use
native job-id stop as a substitute for process proof. Claude PID discovery binds
fresh Linux proof to the captured native job and conversation before checking
liveness; launch and resume can publish it without `pid_started`. Changed owners,
changed births and adapter shutdown fence acquisition.
`session.launch` frames accept an optional registered `host`, defaulting to `local`;
unknown names are refused before launch or item-worktree admission. Coordinator
and Aide roles run only on the local host: launch, relaunch, fresh resume, role
assignment and handover refuse other hosts with the same placement reason.
Assignment and handover read the owning Host from the durable process row;
names without a process row retain local behavior. No CLI placement flag is added.
Process rows persist an owning `host`; opening an older database adds the column
in place with `local` as its default. Older adapter results and pending-stop
receipts without a host retain local semantics. Local session wire views omit
this storage field. Doctor and the orphan sweeper read only local rows, including
when a remote PID collides with a native PID; pre-column snapshots remain readable.

For tests, `CLAND_TEST_HOSTS=t1,t2` registers named test Hosts in project hubs;
in-process callers may pass `hosts` to Sessions, projectSessions or serveProject.
Without that environment or option only local exists. Each test Host operation
writes `test-host-operation` with `host` and `operation` to the hub logger.
Its identity operation returns synthetic `linux:` birth identities, liveness is
false, stop grants no authority, and spawn refuses with a test-host reason.
File and command operations also refuse without native work. An unregistered
host stays `unknown`, has no attach command, and refuses resume/stop before any
adapter operation. No CLI placement flag or role permission is added.

Sessions owns a registry containing `local`. Programmatic `projectSessions`,
`serveProject` and `projectHub` callers can inject `hosts` to exercise default
adapter construction against recording Hosts; omitted injection keeps the
existing local default. Its AdapterHost supplies
`hostForProcess` and `hostForLaunch`; standalone adapters using the previous
contract may omit these callbacks and retain local behaviour. Launch admission,
crew-pool restart and relaunch check directories through the Host, preserving
existing refusals. Identity publication, legacy identity upgrades, deferred-stop
recovery and deaf-episode liveness use Host operations. Async liveness checks
drain on close and recheck the captured launch before publishing.

OpenCode starts its detached server through the launch Host and routes poll,
stream-disconnect, resume and stop checks through the row Host. Polls coalesce. Close joins resume, stream, stop and launch operations, fences
late continuations, and rolls back accepted launches before releasing files. `HostCommand.logFile`, when supplied, is a host-side
path receiving appended stdout and stderr; omitted output remains ignored.
`Host.spawn` returns `{ pid, exited }`, where `exited` resolves once with
`{ code, signal }` on native exit, without exposing a child-process handle.
`HostSpawnOptions.authorize` is a hub-side callback after log preparation and
immediately before native spawn. A refusal closes the prepared descriptor and
spawns nothing. A remote implementation must return to the hub for that callback
between opening the log and spawning. Spawn errors reject the launch.
After successful spawn, descriptor-close failure reports
`host-spawn-log-close-failed` with the PID and still returns its ownership and
completion receipt; a diagnostic cannot discard an accepted child. `LaunchFiles.spawned` registers that PID and
completion receipt immediately: failed handshakes stop through the same Host
and join completion before undoing files. The SSH transport must supply the
same receipt, as must test Hosts. LaunchFiles mutations use the session Host; undo metadata stays hub-local.

LaunchFiles captures child identity and rolls failed launches back through the
Host. The local Host retains its owner's termination logger, including the
`harness-ended` OS termination receipt before LaunchFiles waits for libuv's
separate child-exit receipt. Its stop options preserve the recorded grace period and permit positively
observed disappearance or PID reuse during rollback; an unknown native identity
never grants signal authority. Legacy pending-stop and undo receipts retain their
shape and gain matching native birth proof durably before a signal. Undo metadata
for hub-side launch files stays in the named `hubFileMeta` helper; moving those
files to a remote transport belongs to E-1532. The harness adapters route their
process operations through the Host.

Claude Code routes background launch, `agents --json`, `claude stop`, cwd
`.claude` settings reads, identity acquisition and resume/poll liveness through
the session Host. The existing directory discovery schedule is unchanged.
Closing the adapter aborts and joins command work and joins outstanding Host
liveness observations and resume flights before releasing ownership. Shutdown
cancels resume directory-slot waits and rejects their continuation before a
running-row result can publish. An interrupted relaunch stops its newly accepted
native job through the Host and rolls back private files inside the launch
failure boundary. An unconfirmed native cleanup retains its launch owner and
files and makes close fail explicitly; it never reports a completed shutdown.
Hub-generated private launch
files remain hub-local. Legacy standalone fixtures can omit Host lookup; their
injected process observers also retain the existing local synthetic seam, never
overriding another Host.

A local `Host.alive` request with neither a recorded start stamp nor a native
birth is an existence-only signal-0 probe, with no identity subprocess. This
keeps Claude PID polling on its existing schedule. Supplying either proof field
retains the existing identity-aware liveness path; existence alone grants no
signal authority.

`Host.stop` accepts optional hub-side `beforeSignal` and `authorize` callbacks.
The Host captures its owned tree first and passes plain PID, start-stamp and
native-birth records to them; callbacks carry no native handles. Authorization
is rechecked before signals. A remote implementation must preserve this capture,
hub callback and signal order. `log` optionally selects the caller's termination
logger; omitting it preserves the Host owner's logger. An absent process is
already stopped. A live mismatched birth refuses without a signal; the explicit
`allowReused` rollback option may acknowledge the recorded process gone.

Artifact creation resolves a relative source against the captured caller cwd.
Session path types, folder listings and bytes go through Sessions' Host lookup;
human calls and hub-generated suite artifacts use `local`. Stored output stays
hub-local. Upload bytes arrive in the frame; only checks of existing attached
artifact files use the local Host. Artifact creator fields are unchanged.

The Host contract includes `fileType` (lstat without following symlinks;
`missing` for ENOENT/ENOTDIR, other errors reject), `statDirectory` (cwd refusal and device/inode),
`realpath` (original path on failure), `readFile` (regular-file bytes),
`listFolder` (sorted relative regular-file names, rejecting symbolic links),
`worktreeAdd`, `worktreeRemove`, `occupants` and the `limitPolls` flag.
Local worktree operations use the supplied repository root, path and existing
branch. Add shares the root install and returns the existing stale-install
warning without replacing installs; remove uses Git's ordinary dirty refusal.
Task worktree creation and prune pass a Host (local by default) through the
territory module. Territory retains the lock, branch policy, confinement checks,
fixture drainage and final revalidation; the Host performs add/remove, including
rollback restoration. Add accepts `reuseOnly` for install diagnostics without Git
creation, and `detached` for recovery at a retained tip. Its optional `beforeInstall`
barrier is awaited after Git and before install I/O: territory verifies confinement
and authorization there. Recovery can return false from the barrier to restore
bytes without install effects. Install failures retain a confined registered
worktree and branch. New branches are pinned
before add; every post-branch failure drops a newly created branch only at its captured tip
and only when no worktree was registered. TaskWorktrees forwards the Host warning.
Legacy injected WorktreeGit overrides are adapted in host/legacy-worktree-git.ts,
so their empty-folder fixtures keep install behaviour through the Host too.
No command, setting or role permission changes.

TaskWorktrees reads list and prune occupants through the Host, including locked
admission and the last check before Git removes a worktree. The Host resolves
aliases and directory boundaries against the supplied session cwd snapshot.
TaskWorktrees revalidates item and session snapshots, and uses Host `realpath`
and `statDirectory` for alias and directory identity changes before removal.
When a changed session alias is now occupied, the refusal reports both facts.

The local Host permits idle account polling. AccountPoller reads the flag at
admission and again when a queued idle poll starts; after-hit live-session reads
retain their existing path. No new setting, CLI flag or role permission is added.
The reusable contract and its T1 member-coverage check are documented in
`docs/agents/tests/hub-test-host-local-contract.test.ts.md`.
