# Host agent protocol v1

Each UTF-8 JSON line is at most 1 MiB. Requests are `{id,op,args}` with a nonempty string id and object args. Replies are `{id,ok:true,result}` or `{id,ok:false,error}`. Malformed requests use a null id. An authenticated stream stays open after malformed input or unknown operations. Before any operation send `hello` with `{protocol:1,secret}`. Invalid hello or pre-hello operations receive an error and close. Hello returns `{protocol:1,version,pid,bootId}`. Protocol mismatch refuses; product version mismatch is exposed for the code-delivery owner to handle. This protocol is new; there is no previous agent wire version. Existing hub/spoke wire shapes are unaffected.

| Operation | Args | Result |
| --- | --- | --- |
| spawn | command, args (string array), cwd, env (string map), optional logFile | pid, identity, optional warning |
| identity | pid | birth string or null |
| alive | pid, identity | boolean |
| signal | pid, identity, signal | boolean; false means no authority or failed signal |
| stop | pid, identity | boolean; true only after captured tree absence; unknown authority is an error |
| processes | empty object | recorded processes with pid, identity, alive, rssBytes, cpuPercent, optional launchId/ended/code/signal/targets/rootExitObserved; authority owned, unknown or closed |

File, command and worktree operations are additive in protocol 1. Their complete
argument/result table, byte caps and local Host behavior are documented in
[Host agent protocol](../hub/adapters-and-sessions.md#host-agent-protocol-t-1588).
The file-operation regression uses an isolated fake host and scratch Git root;
no SSH carrier or real host is needed to call these agent operations.

Birth strings are `linux:<boot UUID>:<start ticks>`. Linux reads the shared boot reader and `/proc/<pid>/stat`. Fake macOS hosts use ps start time as milliseconds and a boot-id file; they preserve the same wire format. Unknown births grant no signal authority. Signals require a recorded matching root selector and independently observed native births for each admitted root or captured descendant target. Each captured PID is rechecked immediately before signaling; numeric process groups confer no signal authority. A member arriving after capture is excluded, and stop reports incomplete if a new member remains. Spawn receives an explicit environment; all `CLAND_HOST_*` keys are removed. Logs append both output streams. Processes are detached from the agent's session/group. The pinned Node 24 runtime supplies native execve: a bootstrap checkpoints its own birth and waits for durable release before replacing itself with the requested program at the same PID and birth. A log-descriptor close error after acceptance preserves pid/identity and returns an optional warning.

The private process table retains active/unresolved ownership and the latest 256 confirmed closed trees; it is a state checkpoint rather than an exit journal. It is atomically replaced before spawn replies and exit events. An agent restart retains liveness and resource observations, but cannot recover the native exit status of a child it did not reap: a root exit it did not observe records null code/signal and authority unknown, keeping its admission and unresolved metadata. It never replaces an exact native code with null. Unreadable birth remains unresolved; processes renders unavailable resource samples as null. Recovery shares one in-flight observation pass. Only confirmed closed trees enter bounded history; unresolved ownership remains current state. Admission receipts under launches/<UUID> are persisted before spawn; the bootstrap writes its own birth before release, so agent death before processes.json can be reconciled. Private launch environments are removed after bootstrap read. While live, the agent checkpoints descendant PID/birth pairs from intact PPID ancestry during reconciliation and stop; native root close retains those earlier captures and samples remaining group members. The row retains those targets through restart and permits a later stop even though the root is gone. Launch receipts remain until the captured tree is positively gone and the closed checkpoint is durable. A per-admission closed receipt permits cleanup recovery if the agent exits between checkpoint and removal. Native process-exited reports the root code with optional authority and ended fields; it does not imply that every descendant exited. Closed-tree and unknown-authority resource samples are null; a dead root with owned live descendants still reports their tree samples. Native exit events are `{event:"process-exited",pid,identity,code,signal}`. Every five seconds authenticated clients receive `{event:"memory",totalBytes,availableBytes}`; Linux available bytes come from MemAvailable, while fake macOS uses OS free memory. RSS and CPU sum current ancestry plus birth-validated retained targets even while the root remains alive; duplicate PIDs count once. A failed, unreadable or changing native observation leaves the sample null. CPU is the ps percentage snapshot, not interval utilization. No memory floor or capacity gate is enforced here.

The hub-side `AgentClient` multiplexes requests and emits `event` and `closed`. Timed-out requests report an unknown outcome; callers must reconcile before retrying a mutating operation. Stream close rejects pending requests. The SSH Host owns reconnection and retained-table reconciliation, as described below.

Authority `owned` means every signal target has an admitted root or a durable descendant birth captured while ancestry was intact or by its live native close owner. Each target is independently revalidated before signaling. Authority `closed` and ended=true mean the owned tree was observed gone. Authority `unknown` fences an exit missed during agent downtime or an ownership observation that cannot be completed. Stop refuses with `process authority unknown; stop requires host reboot or recycling` and signals nothing. Observational process listing still works; it does not manufacture descendant authority from a numeric group. A host reboot ends its sessions through the host lifecycle (T-1613), and recycling clears unresolved host state. Reverting a fake boot-id file does not restore revoked authority.

This follows the Coordinator's 2026-11-02 06:35Z decision on T-1588: no long-lived Node supervisor per launch, preserving session density on small disposable hosts. [The shell supervisor](../hub/adapters-and-sessions.md#host-agent-supervisor) supervises the agent itself; a missed exit stays conservatively fenced, and the host lifecycle clears it.

The local and remote Host share this capture boundary: descendants are captured by PPID ancestry while the root is live, with native birth identities. Captured descendants remain owned after they change session/group or become reparented, and every signal rechecks that birth. The agent persists captures during reconciliation and stop, and retains them at observed root close. A natural exit closes normally when the root and every captured descendant are gone.

A descendant that escaped before any capture is outside cland’s authority on both Hosts and is never signalled; host recycling clears it.

This is the Coordinator's final 2026-11-02 06:59Z refinement (24e17b6f), replacing the intermediate group-only note. Local `endProcess` walks ancestry while intact; remote capture follows that boundary. An already reparented escape cannot be discovered from its old parent PID. The missed-exit unknown fence remains; routine observed exits do not all become unknown.

The [SSH carrier](../hub/ssh-transport.md) streams bootstrap secrets only on stdin,
reuses `supervisor.sh --check` liveness and exposes optional tunnel facts in
`hub.status.hosts`. Stop joins the hub-owned carrier while host processes survive.

## Hub admission

A host agent does not call hub.sock. Session CLI, hooks and mod-bridge clients
using its forwarded socket carry their own session credentials. A host secret
never acts as the human; see [Host-secret admission and revocation](../hub/adapters-and-sessions.md#host-secret-admission-and-revocation).
Only the human CLI or Neovim on a local connection may run `cland host revoke <id>`.

## SSH Host callbacks and environments

The [SSH Host](../hub/ssh-host.md) requires the optional `host-prepared-v1`
capability. Additive prepare/commit/abort operations preserve hub-side callback
boundaries and expire unfinished resources on a deadline, disconnect or restart.
Monolithic protocol-1 operations remain supported. Error replies may carry an
optional native `code`; clients accept older replies without it. Remote adapter
commands carry explicit additions; the agent merges its own base and filters
hub-only credentials after overlays. No hub base environment is forwarded.

Stop rechecks a ps member's native observation: a positive `ended:true` is closed
even when the PID was reaped between snapshots. An absent birth without positive
end remains unresolved and grants no ownership. This applies equally to resumed
native owners and newly captured trees; legacy timestamps grant no signals.

## Claude launch receipts

An agent advertising `claude-launch-adopt-v1` accepts the optional Host
`launchClaude(command, generation)` and `adopt(generation)` operations. The
agent runs `--bg` and exactly one `agents --json`, then atomically pins the
unique matching job, native conversation, PID, Linux birth and agent UID before
returning success. Adoption reads that receipt and rechecks the native birth and
UID. A missing capability refuses explicitly. The account config root remains the
login's existing root and must be an agent-owned directory with mode0700. The
receipt pins the canonical config/jobs directory identities. Before any Claude command, jobs/ must be a real agent-owned directory; the agent creates it privately when absent and rechecks the pinned identity after launch. While running,
token bytes may occur in the private generation files and own account-private
job record; confirmed stop/rollback removes exactly the pinned job file and
private generation files, preserving sibling jobs. Failed or ambiguous discovery
retains an incomplete launch fence and its private files when cleanup cannot be
proved; a caller must not retry or delete them as though launch never happened.

Freshly adopted Claude workers may create SessionEnd descendants after TERM.
Only observed parent chains to the live pinned root or captured descendants,
with the agent UID and a PID absent from the initial census, grant new capture.
Each birth is checkpointed before signals. Natural shutdown has a bounded grace,
then TERM and KILL target the pinned set. Root exit ends new acquisition;
reparented, foreign or unknown writers remain incomplete. Serialized adoption
markers never grant this acquisition authority after restart: a fresh verified
adopt is required. Other native owners retain capture-once stop.

The opaque adoption receipt supplies a generation-bound release callback. The
adapter invokes it only after tree closure and native stop or positive native
absence, then removes the private settings. A failed release stays pending and
is idempotently retried without repeating an already confirmed native stop.
Closed adopted rows remain current until release; after a hub restart a fresh
adopt may recover their positive closure and finish this sequence. These closed
receipts grant no signal authority over a reused PID.

Release atomically replaces the live receipt with a private0600 terminal receipt
(`released:true`), containing identity/config metadata only. Re-adopt of that
receipt grants no signal authority. After private-directory deletion is observed,
the adapter checkpoints that fact in hub state, then calls the idempotent forget
closure. The checkpoint also recovers a lost forget reply without requiring a
missing agent record to grant process authority. Forget verifies directory
absence before removing the terminal receipt. The normal bound is one receipt
per active or cleanup-incomplete generation and zero after confirmed cleanup,
with no time eviction. T-1666 owns revoke/remove settlement before the authority
cut; this implementation never cleans through a revoked Host. Reads are exact
generation lookups, outside startup/liveness history scans. Concurrent writers
for a generation share their producer and serialize release/forget.

A terminal PID observation owns one bounded native settlement before publishing
exit. It runs at most one stop command and, if needed, one absence query. A
failed confirmation retains the row, role, generation files and an explicit
cleanup-incomplete cause. Its exact-generation marker permits one retry through
re-adopt after hub restart; no liveness timer retries CLI commands. Explicit
stop remains available for recovery.

For an adopted worker, a newly born descendant between stop preparation and
commit can change the approved tree before any signal. One bounded recapture
uses the same ancestry, UID, initial-census and native-birth policy as SessionEnd
joining. A second change or an unproved process remains incomplete and is never
replayed. A pinned member's positive exit or changed native birth settles that
old member and is removed from comparisons; it does not spend the recapture
allowance or authorize the replacement. An unknown identity gets one native
re-read before the decision. A persistent unknown still ends incomplete. Only
new unpinned descendants count as new capture; the one-recapture bound, UID,
ancestry and birth gates stay in force. Other refusals retain the running row and role with cleanup-incomplete;
recovery uses an explicit re-stop after the blocking ownership condition resolves.
The one recapture budget belongs to the admitted stop, shared by the agent's
outer capture comparison and the final pre-TERM helper. It is a fresh in-memory
closure for each admission, never a frame field or persisted flag. If the outer
layer has not spent it, the helper can capture the first late descendant only
after a fresh matching UID/ancestry/birth observation and durable checkpoint.
If already spent, or a further descendant appears during that validation, the
operation remains incomplete with no replay.

An unconfirmed explicit stop is not retried by liveness timers or startup. It
keeps its generation-scoped cause until explicit re-stop confirms cleanup.
Recovery may finish an already released receipt or confirmed private-deletion
checkpoint, which grants no signal authority.

Every adopted ledger capture uses that acquisition policy, including later
explicit stops: a refused reparented child cannot become approved merely by
retrying. Its external owner must confirm cleanup before the worker can settle.
Fresh adoption's process census is memory-only; a recovered adoption flag alone
grants no new acquisition.

## Failed Claude launch settlement

Pending agent records retain the generation, private-directory/config/jobs
identities and the printed job handle when valid, plus the native stop receipt.
They contain no token or settings/MCP bytes and grant no process authority.
Incomplete discovery never replays --bg or guesses a PID. Leading-option job
handles are rejected before they can become a stop argument.

Remote private MCP/settings are excluded from generic LaunchFiles rollback.
Claude's bounded LaunchSettled callback owns re-adopt, native settlement, release,
private-file deletion and forget. A lost accepted result can therefore be joined
even when close began before adoption. An unknown result stays under the durable
pending-stop owner with its original session identity and launch credential.
After restart the optional settleFailedLaunch fallback reconstructs the same
callback; missing state/receipt remains cleanup-incomplete.

The agent's receipt bound stays one per active/incomplete generation and zero
after cleanup. A terminal hub marker remains until durable pending-stop cleanup
acknowledges it. The outstanding acknowledgement index is normally empty; an
interrupted post-clear prune is recovered without native work. No time eviction
or revoked-Host cleanup is introduced.

## Atomic file RPCs

The additive `publishFile`, `appendFile` and `stat` operations share the local
Host implementation. Publish defaults to create-only and returns false on an
existing path; `options.replace:true` atomically replaces complete bytes, with
optional mode. Stat returns native mode and size. Payload validation uses the
same 512 KiB cap as writeFile. SSH uses `prepare-publishFile` / `prepare-appendFile`
with the existing `commit-prepared` and `settle-prepared` result protocol. Direct
file RPCs remain available for compatibility and discovery's same-stream drain
owner. Unknown interrupted commits retain their ownership checkpoint and refuse
mutations instead of replaying side effects. See [SSH Host](../hub/ssh-host.md#atomic-files-and-metadata).

## Host territory worktrees

The SSH registry prepares a managed territory clone for task worktrees after
carrier readiness; clone work never holds tunnel readiness. Projects without a
territory attempt no clone. See
[territory clone and task worktrees](../hub/ssh-host.md#territory-clone-and-task-worktrees)
for the clone-local proxy, bundle fallback, immutable discovery copy and hub.db
records used to list/prune after restart. The proxy wrapper contains paths only;
per-host authentication remains on the forwarded sockets.

## Agent package and version replacement

`hub/bin/generate-host-agent-closure.ts` derives the runtime from
`host/agent/entry.ts` through literal import/export, dynamic-import and native
bootstrap/supervisor URL edges. It writes the committed `host/agent/closure.json`
projection (paths and SHA-256 hashes). A T1 regeneration test rejects stale
projections. Runtime delivery reads that projection and verifies its source
hashes; it loads no compiler. Run `node hub/bin/generate-host-agent-closure.ts`
after changing the runtime. Initial provisioning uses the same committed graph. Only
Node built-ins, agent source modules and the credential-filter leaf are admitted.
There are currently no npm dependencies in this closure; a package import refuses
delivery until it is explicitly vendored. The standalone runtime requires Node
24 and does not resolve the project's node_modules. Initial host provisioning
must use this same package format; host images supply Node only.

The wire bundle contains `version` and `files`, with `path`, `sha256` and base64
`bytes` per file. The installed `agent-manifest.json` retains version and each
file's path/hash, omitting bytes. Paths preserve the repository layout within
`~/.cland-host/code/<VERSION>`. No project files, environment, account data or
credentials enter the source graph. The version is one safe path component.

On a mismatched hello, the registry copies the bundle over the existing SSH
ControlMaster with pinned known-hosts and no independent-connection fallback.
The shared `agentVersionHandoff` owner fences a successful publication while the
supervisor replaces its child; a matching hello also settles a lost publication
reply. The host checks paths and hashes, writes a private staging directory under
`code`, verifies the written package and atomically renames it to VERSION.
Failed or partial staging directories cannot be selected. Existing version
directories are immutable: an occupied version is verified against every incoming
manifest path/hash and reused only when identical. A retry after installation or
restart-publication interruption can therefore complete without replacing code.

Only after installation does a private `code/restart` request select VERSION.
The supervisor uses `CLAND_HOST_NODE` for its Node helpers and replacement
entrypoint, defaulting to `node` on PATH. SSH bootstrap sets it to the layout's
pinned Node runtime; the initial agent command may independently use an exec
wrapper. The supervisor validates the manifest, rechecks its directly launched agent's
native birth and sends SIGTERM to that child alone, waits for it, then starts
the selected standalone entrypoint. Before launching it, the supervisor advances
its verifier path to that selected package, so later retention can remove its
original version. Repeated requests for the same immutable selected version
return an `already-selected` receipt with that direct child’s PID/birth and do
not signal it again. The standalone agent checkpoints `code/applied.json` only
after socket/process-table readiness, with version and its native PID/birth.
Shutdown joins that readiness checkpoint. Harnesses have independent lifetimes.
After the new authenticated hello and retained-table read, retention keeps the
current version and the previous hello's version. Older manifested packages
are pruned; unknown directories are preserved.

SSH Host owns one reconnect driver, retrying every 500 ms while active. Each recovery
acquisition reads `processes` and exact native completion receipts before it
becomes available to mutations; the separately owned observation stream below
keeps native identity and file/usage reads independent of that checkpoint. Stream loss never changes session identity or
manufactures an exit receipt. Close/quiesce cancels retries and joins acquisition
and delivery work. Quiesce aborts delivery between joined copy/install boundaries
and fences late restart publication. AgentClient continues to accept the original protocol-1 hello
without optional capabilities; SSH Host separately requires prepared operations.


## Reconnect adoption

The registry wires `restoreAdoptedWorkers` before each newly authenticated
connection reads the retained table. Agents advertise optional
`claude-restart-adopt-v1`; the additive `restore-claude` operation keeps its null
result for requests without options. Optional `{report:true}` returns an
`incomplete` list of generation identifiers and stages (`pending`, `receipt`,
`adoption`). A new client accepts older null reports as unknown, not zero failures;
the registry records these facts in its host recovery log.
An older hello without this capability retains the previous behavior. Standalone
AgentClient connections do not restore implicitly. Neither agent startup nor
liveness replies scan or restore generations.

The Claude receipt owner streams the current run/claude generation records on
this explicit recovery admission, sharing one in-flight restoration. Pending launches are reported without adoption; released receipts are skipped. Ready candidates use
`claudeLaunches(runDir, env).receipt(generation, confirmedClosed)`; confirmed
closed workers are skipped. Only that validated generation receipt can authorize
fresh live adoption. The retained process ledger is reconciled before receipt
validation, so a positively closed tree can finish release/forget even if its root
exited while the agent was down. An unresolved generation retains its receipt and
private files, gains no fresh authority and appears in the incomplete report; it
does not block the table or mutations for healthy generations. Caller PIDs and serialized adopted flags grant no authority.
The agent remembers successfully admitted live generations until release or
forget, sharing the normal explicit-adopt path so reconnects do not reset its native census.
Stop still creates its own single recapture budget and preserves settled-exit
rules; recovery never signals a worker or retries an incomplete stop.

After changing the runtime, regenerate closure.json, including claude.ts,
claude-stop.ts and state-paths.ts, using the committed source projection workflow.

The SSH Host keeps a separately owned authenticated observation stream for
identity and filesystem/usage reads. Those reads do not wait for the recovery
stream’s held process checkpoint: stop settlement may need a native identity
observation to release that checkpoint. Both streams recheck admission and are
joined on close. The mutation/recovery stream still restores generations and
reads the retained table before becoming available. Local delivery bundles use
the central agentDeliveryStagingPrefix temporary path owner and are removed after
all copy/install writers have joined.
