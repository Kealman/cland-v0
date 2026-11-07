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

Birth strings are `linux:<boot UUID>:<start ticks>`. The single agent boot-source helper, `agentBootId`, uses the boot-id file whenever `CLAND_FAKE_HOSTS` is enabled, on Linux and macOS. Missing or invalid fake boot evidence rejects agent admission before recovery; it never falls back to the kernel. Non-fake Linux reads the kernel boot id and ignores a stray boot-file variable. Linux uses `/proc/<pid>/stat` start ticks; fake macOS uses ps start time in milliseconds with the same wire format. Agent hello, supervisor child observation, admission bootstrap and agent process observers share this source. The push worker copies its admitted birth receipt rather than minting an identity from its filtered command environment. Hub-local native cleanup and local Host identities retain the physical machine boot and do not compare against fake-host births.

Unknown births grant no signal authority. Signals require a recorded matching root selector and independently observed native births for each admitted root or captured descendant target. Each captured PID is rechecked immediately before signaling; numeric process groups confer no signal authority. A member arriving after capture is excluded, and stop reports incomplete if a new member remains. Spawn receives an explicit environment; all `CLAND_HOST_*` keys are removed. Logs append both output streams. Processes are detached from the agent's session/group. The pinned Node 24 runtime supplies native execve: a bootstrap checkpoints its own birth from the private admission plan's fake-host controls and waits for durable release before replacing itself with the requested program at the same PID and birth. A log-descriptor close error after acceptance preserves pid/identity and returns an optional warning.

The private process table retains active/unresolved ownership and the latest 256 confirmed closed trees; it is a state checkpoint rather than an exit journal. It is atomically replaced before spawn replies and exit events. An agent restart retains liveness and resource observations, but cannot recover the native exit status of a child it did not reap: a root exit it did not observe records null code/signal and authority unknown, keeping its admission and unresolved metadata. It never replaces an exact native code with null. Unreadable birth remains unresolved; processes renders unavailable resource samples as null. Recovery shares one in-flight observation pass. Only confirmed closed trees enter bounded history; unresolved ownership remains current state. Admission receipts under launches/<UUID> are persisted before spawn; the bootstrap writes its own birth before release, so agent death before processes.json can be reconciled. Private launch environments are removed after bootstrap read. While live, the agent checkpoints descendant PID/birth pairs from intact PPID ancestry during reconciliation and stop; native root close retains those earlier captures and samples remaining group members. The row retains those targets through restart and permits a later stop even though the root is gone. Launch receipts remain until the captured tree is positively gone and the closed checkpoint is durable. A per-admission closed receipt permits cleanup recovery if the agent exits between checkpoint and removal. Native process-exited reports the root code with optional authority and ended fields; it does not imply that every descendant exited. Closed-tree and unknown-authority resource samples are null; a dead root with owned live descendants still reports their tree samples. Native exit events are `{event:"process-exited",pid,identity,code,signal}`. Every five seconds authenticated clients receive `{event:"memory",totalBytes,availableBytes}`; Linux available bytes come from MemAvailable, other platforms without a fake override have no available-memory verdict and emit no memory sample. RSS and CPU sum current ancestry plus birth-validated retained targets even while the root remains alive; duplicate PIDs count once. A failed, unreadable or changing native observation leaves the sample null. CPU is the ps percentage snapshot, not interval utilization. Every harness launch, including Claude through `run-host`, and direct/prepared spawns refuse below 1,300,000,000 available bytes (decimal 1.3 GB), independently of slots; equality is admitted. The shared admission guard checks fresh memory immediately on native spawn admission or Claude launch admission; prepared spawns check at commit, so a drop after preparation refuses. The agent replies with code `memory-floor`, `availableBytes` and `floorBytes`; prepared failure receipts retain these fields through settlement. SSH raises `HostMemoryFloorRefusal` with `host` and both byte counts. An old agent failure without these fields stays a generic failure. Durable Claude command failures also preserve these refusal fields, and the adapter treats a positively typed floor refusal as pre-spawn non-admission for cleanup. With `CLAND_FAKE_HOSTS` only, `available-memory` beside the fake host’s boot-id file overrides the reading with JSON `{ "availableBytes": <nonnegative integer> }` (fallback location: agent run directory if no boot file is configured). Unitless values and invalid overrides refuse admission. Missing overrides use Linux `MemAvailable`; non-Linux has no verdict and admits launches. Shared fake-host creation seeds 8 GiB for deterministic fixtures on all platforms. The same reader supplies memory events.

The hub-side `AgentClient` multiplexes requests and emits `event` and `closed`. Timed-out requests report an unknown outcome; callers must reconcile before retrying a mutating operation. Stream close rejects pending requests. The SSH Host owns reconnection and retained-table reconciliation, as described below.

Authority `owned` means every signal target has an admitted root or a durable descendant birth captured while ancestry was intact or by its live native close owner. Each target is independently revalidated before signaling. Authority `closed` and ended=true mean the owned tree was observed gone. Authority `unknown` fences an exit missed during agent downtime or an ownership observation that cannot be completed. Stop refuses with `process authority unknown; stop requires host reboot or recycling` and signals nothing. Observational process listing still works; it does not manufacture descendant authority from a numeric group. A changed boot identity ends its sessions through the host lifecycle (T-1613); host revoke settlement records unresolved ownership as a leftover. Recycling without proven boot change is not closure evidence. Reverting a fake boot-id file does not restore revoked authority.

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
with no time eviction. Revocation settles generations before the authority
cut and never cleans through a revoked Host. Reads are exact
generation lookups, outside startup/liveness history scans. Concurrent writers
for a generation share their producer and serialize release/forget.

A terminal PID observation owns one bounded native settlement before publishing
exit. It runs at most one stop command and, if needed, one absence query. A
failed confirmation retains the row, role, generation files and an explicit
cleanup-incomplete cause. Its exact-generation marker permits one retry through
re-adopt after hub restart; no liveness timer retries CLI commands. Explicit
stop remains available for recovery.

For a freshly adopted worker, admission validates the pinned root birth and UID,
then checkpoints a best-effort positive descendant baseline and first census.
Descendant churn or a concurrent descendant-set mismatch cannot refuse that
admission; unproved members gain no authority and remain subject to post-TERM
ancestry, UID and birth checks. Public capture retains its independent
reconciliation guard. Unknown or recovered owners keep their conservative path.
Commit uses the admitted pins and census without a fresh descendant capture,
validates the pinned root and signals that birth with TERM before waiting
for descendant stability. A busy root can still start turn or SessionEnd writers
while exiting. The stop owner repeatedly captures their identities until two
consecutive sets match, within the native closure helper's existing three-phase deadline (9 seconds
with the default 3-second grace). It checkpoints every acquired or retired set
before signalling descendants. Stable survivors receive TERM, then KILL; closure
requires two consecutive empty captures, never just root absence.

This graceful path assumes real Claude Code starts no new turn hooks after
SIGTERM, beyond SessionEnd. That assumption has not been verified against the
real binary. The scripted fixture latches stopping once, prevents new turn/mod
posts, and in awaitSignals mode joins already-started managed posts before native
exit. Its asynchronous SessionEnd mode stays available for adverse controls. If
a real harness violates the assumption and a child is orphaned before ancestry
can be observed, stop safely ends cleanup-incomplete with the row and role held;
it never signals a process based only on the old numeric root or group.


New members require the same UID, a currently observed parent chain through the
pinned root or an already pinned live birth, and absence from the first census.
Every acquired member is pinned by PID and native birth. A pinned parent can
anchor a new child after the root exits; an orphan with no proved live parent
cannot. Already pinned descendants retain authority across reparenting. Positive
exit or a changed birth settles the old member without authorizing its replacement.
An unknown identity gets one native re-read; persistent unknown, a foreign UID,
unproved ancestry or an unstable set at the deadline ends cleanup-incomplete and
keeps the row and role held. There is no descendant-count or recapture budget.
The admission census is in-memory authority, never a frame field or persisted flag.
A failed post-TERM acquisition durably marks authority unknown. It never gains
signal or closure authority from later absence of known births or the old group:
an unobserved detached writer may still survive. Explicit stops keep that row and
role held with the process-authority-unknown cleanup-incomplete cause, even after
independent fixture cleanup. Release requires a proven changed boot identity
through host-generation retention, host revoke settlement naming the leftover,
or an already supported explicit human override. Stop adds no override or native
ownership capability. An owned row with positively exited root can retry its
already pinned live descendant births; it never signals a replacement root.
A positively different birth at the old root PID is excluded from the old tree
refusal census. Every other unowned member still refuses, including a child
that cannot be attributed to a live pinned parent; numeric group reuse grants
no acquisition or signal authority.


Concurrent reconciliation can publish the same identities an in-flight capture
observed. Capture accepts that update only when the reconciled and freshly settled
sets match by PID and native birth. A differing concurrent set remains incomplete;
the convergence loop does not turn a conflicting observer into signal authority.

An unconfirmed explicit stop is not retried by liveness timers or startup. It
keeps its generation-scoped cause. An owned row may explicitly retry retained
pins; an unknown-authority row requires the release paths above.
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
callback; missing state/receipt remains cleanup-incomplete. A positively typed
pre-spawn refusal (including account-root mode/ownership validation) settles
without worker adoption; fixing the root permits immediate same-name and other-name
launches on that host. The native run owner proves an already-aborted signal,
synchronous spawn throw or a closed no-PID spawn error with a typed no-process
receipt. Claude removes its pending checkpoint before publishing non-admission.
An observed PID, lost reply or missing/unreadable receipt remains fenced.
Older untyped replies and unknown native outcomes remain
fenced.

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

Prune checkpoints `removing` with a unique id, captured territory tip and lease owners before releasing the territory lock to join agent removal. Add, relaunch and publication admission reject this phase. After removal it reacquires the lock and repeats ownership, tip, lease, closed-item and occupant checks. A `host-prune-changed` refusal preserves the current row/ref/lease; unknown removal retains its checkpoint and is reconciled through the existing agent removal receipt. Legacy rows without a phase remain readable.

The SSH registry prepares a managed territory clone for task worktrees after
carrier readiness; clone work never holds tunnel readiness. Projects without a
territory attempt no clone. See
[territory clone and task worktrees](../hub/ssh-host.md#territory-clone-and-task-worktrees)
for the clone-local proxy, bundle fallback, immutable discovery copy and hub.db
records used to list/prune after restart. The proxy wrapper contains paths only;
per-host authentication remains on the forwarded sockets.

## Whole runtime delivery at ready

`deliverRuntime` in `host/code-delivery.ts` delivers hub sources, bins,
`hub/mod/cland`, shared sources and root/hub package manifests plus the root
lockfile to `<home>/.cland-host/code/<version>`. The ready sequence calls it
before starting the supervisor. Pool images supply Node and npm. A real install
requires registry access (or a prefilled npm cache); the manifest pins the hub's
lockfile. The host runs `npm ci -w hub --omit=dev --ignore-scripts`, skipping the
root web build/browser prepare script. Future runtime install scripts need an
explicit rebuild step. No dependency installation occurs on unchanged reuse. A confirmed upload aborted
before installer admission is reclaimed after its copy writer joins. Unconfirmed
copy, installer or cleanup outcomes raise `RuntimeDeliveryIncomplete` with the
exact `remoteInput` identity retained for reconciliation.

Each source file is verified against its SHA-256 digest before and after npm.
A complete immutable sibling generation is selected by atomically renaming a
version symlink. Failed staging leaves the old pointer intact. Old generations
are retained for running readers. Existing non-symlink version directories refuse
replacement; migration requires a new version name. Version handoffs use the same whole-runtime delivery, dependency installation and
atomic pointer mechanism. Legacy closure packages remain readable; a new handoff
uses a new version name when the old version occupies a directory. Fake registry
hosts continue to use the hub's installed tree; scratch delivery tests separately
prove the whole-tree path. See the [delivery test guide](tests/hub-test-host-runtime-delivery.test.ts.md).

The spoke supports `node hub/bin/cland-spoke.ts --version` from the installed
runtime tree; it prints the same version as `cland --version` and exits.

## Agent package and version replacement

Whole-runtime handoff compatibility starts at v0.4.0, the first release with
host agents. The first v0.4 host is made ready with the whole runtime by the
provider ready flow. Earlier unreleased dev-agent supervisors are outside this
compatibility boundary. `git ls-tree v0.3.2` has neither agent supervisor nor
package verifier. The current-source V1→V2 composition guard installs V1 from
the shipped source, then proves its supervisor/verifier accept V2's symlinked
runtime and Claude's mod bridge connects through that upgraded tree.


`hub/bin/generate-host-agent-closure.ts` derives the runtime from
`host/agent/entry.ts` through literal import/export, dynamic-import and native
bootstrap/supervisor URL edges. It writes the committed `host/agent/closure.json`
projection (paths and SHA-256 hashes). A T1 regeneration test rejects stale
projections. Runtime delivery reads that projection and verifies its source
hashes; it loads no compiler. Run `node hub/bin/generate-host-agent-closure.ts`
after changing the runtime. The legacy standalone agent installer uses this committed graph; production version handoffs use the whole runtime. Only
Node built-ins, agent source modules and the credential-filter leaf are admitted.
There are currently no npm dependencies in this closure; a package import refuses
delivery until it is explicitly vendored. The standalone runtime requires Node
24 and does not resolve the project's node_modules. Host images supply Node; whole-tree ready delivery is described below.

The wire bundle contains `version` and `files`, with `path`, `sha256` and base64
`bytes` per file. The installed `agent-manifest.json` retains version and each
file's path/hash, omitting bytes. Paths preserve the repository layout within
`~/.cland-host/code/<VERSION>`. No project files, environment, account data or
credentials enter the source graph. The version is one safe path component.

On a mismatched hello, the registry copies the bundle over the existing SSH
ControlMaster with pinned known-hosts and no independent-connection fallback.
The shared `agentVersionHandoff` owner fences a successful publication while the
supervisor replaces its child; a matching hello also settles a lost publication
reply. The host checks the whole runtime manifest and source digests, installs production
dependencies, then atomically selects its immutable generation through VERSION.
The agent and supervisor accept `runtime-manifest.json` and the sibling version
symlink; legacy `agent-manifest.json` directories remain supported. A matching
whole-runtime digest is reused after installation or publication interruption.

Only after installation does a private `code/restart` request select VERSION.
The supervisor uses `CLAND_HOST_NODE` for its Node helpers and replacement
entrypoint, defaulting to `node` on PATH. SSH bootstrap sets it to the layout's
pinned Node runtime; the initial agent command may independently use an exec
wrapper. Verification returns the canonical generation; the supervisor captures
that identity before effects and uses it for the entrypoint and future verifier,
even if the version pointer changes in between. The supervisor validates the manifest, rechecks its directly launched agent's
native birth and sends SIGTERM to that child alone, waits for it, then starts
the selected standalone entrypoint. Before launching it, the supervisor advances
its verifier path to that selected package, so later retention can remove its
original version. Repeated requests for the same immutable selected version
return an `already-selected` receipt with that direct child’s PID/birth and do
not signal it again. The standalone agent checkpoints `code/applied.json` only
after socket/process-table readiness, with version and its native PID/birth.
Shutdown joins that readiness checkpoint. Harnesses have independent lifetimes.
After the new authenticated hello and retained-table read, retention keeps the
current version and the previous hello's version. Older legacy manifested directories
are pruned; runtime symlinks and immutable generations remain for running readers,
as do unknown directories. The supervisor pins its selected entrypoint and verifier
to the resolved generation so later pointer replacement cannot change those readers.

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
Stop retains its first census and converges after signalling the pinned root,
with settled-exit rules intact; recovery never signals a worker or retries an incomplete stop.

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

## Settlement before host revocation

`cland host revoke <id>` runs `Sessions.settleHostBeforeCut`, backed by the reusable
`settleHostBeforeCut` in `hub/src/host/settle.ts`, through the still-authorised
Host. Captured generations settle concurrently after retained ownership fences
are collected. The complete operation has a 12-second deadline, derived as
`2 * LAUNCH_SETTLEMENT_MS + 2000`: one five-second stop/reap bound, one
five-second private-resource retirement allowance, and two seconds of shared
inventory/transport headroom. This is a total cap, including retained inventory;
unbounded or excessive retained work remains explicitly incomplete. The CLI
frame timeout is `HOST_SETTLEMENT_MS + 3000` (15 seconds). Stop the live sessions,
join pending failed-launch cleanup, release private generation resources and
inspect retained state, then cut authority even when cleanup is incomplete.
Stop authority pins the captured session, host, native birth and generation
across renames and lifecycle waits. Settler work is joined before storage closes.

Positive normal stops and OpenCode's joined native-exit callback persist indexed
metadata retirement before reporting terminal state. These receipts keep only native identity and file-owner metadata, without account
environment, brief or usage data and survive archive/prune/restart. They grant metadata cleanup
only, never recovered PID signal authority. Outstanding native generations of one stable
session have distinct keys; clearing one owner preserves older unknown workers,
which fence shared private files. Explicit retirement streams this host's
receipts and legacy terminal rows, yielding every 32 records within its deadline.
Missing legacy closure stays named as incomplete, including after later prune
or name reuse; display status alone grants no cleanup authority.

The changed-boot lifecycle caller uses the public
`Sessions.retainHostGeneration(process, {cause: 'host-rebooted', bootId})` before
publishing exit. The authenticated returning agent supplies `bootId`; the shared
`hostBootChanged` predicate requires a canonical boot id different from the boot
in the captured Linux birth. The entry matches the durable native-generation row
or pending failed-launch owner, accepts every harness, and performs no Host call
or adapter stop. It does not publish exit or vacate roles itself.

The durable optional `hostRebooted: {bootId, launchGeneration?}` receipt preserves
Claude generation identity and the pending launch's original file undo. Retry,
restart and previously captured process Hosts cannot issue native operations for
that old generation. An indexed exact-generation native fence persists separately
from resource retirement, including after metadata deletion and storage reopen;
completing cleanup never restores old native authority. Old resource-row markers
are preserved into that fence before clearing, without a startup history scan.
A new native birth does not inherit an older generation's fence.
File ownership remains retained, including host-local files
outside the run directory after a reboot clears it. Revoke names remaining
resource retirement with native closure confirmed; it does not infer cleanup
from an empty run folder or erase the pending undo. Optional metadata-only
adapter retirement can still settle known private files while authorised.

After confirmed closure, optional `releaseHostGeneration` removes OpenCode config
and password files that ordinary stop/exit retains for resume. New launches retain
the private directory's canonical path and device/inode identity under the exact
native-generation key. Retirement validates that captured owner after restart,
then deletes via its canonical path. A stable ancestor alias is supported;
a retargeted alias, session-directory symlink or replaced inode stays incomplete.
Older receipts without this file-owner record retain the strict canonical-path
fallback. OpenCode emits
`hostGenerationClosed` only after its owned tree, clients and forwards settle.
Claude stop already releases its private files and receipts. Retained Claude
agent records use adoption, positive stop, release, private deletion and forget.
Codex MCP configuration travels in argv and its stopped socket is removed. A
read-only Host inventory also names orphaned OpenCode private files and agent launch records
whose owners cannot be recovered, granting no deletion or signal authority.

The additive `cleanup` reply names unresolved generations and remaining workers,
receipts or private files. Unconfirmed facts and unavailable or pending inventory
stay explicitly unknown; late replies never upgrade the cut receipt. CLI output
prints that report and accepts old replies without `cleanup`. A replaced owner
leaves its generation named rather than deleting another generation's files.
Never clean through a revoked Host: SSH admission is checked after acquisition
and immediately before every agent request, including ref-watch registration,
status/flush helpers and adopted-worker restoration after reacquisition.

Host removal is not implemented yet. E-1533's provider remove/destroy will reuse
this pre-cut entry point before cutting authority or destroying the host.

## Ref watches

Agents advertising `ref-watch-v1` accept `watch {path,branch}`, `unwatch {path}`
and `flush {}` (all return null). SSH Host registers non-detached `t/` task
worktrees after accepted checkout; registration/reacquisition failure retains
accepted checkout ownership as unknown. Agent worktree removal holds the watch
owner, joins its push, and removes its durable watch only after successful native
removal. Removal admission pins the directory identity before native effects;
a checkpoint/reply-loss retry settles only after observing both directory and
Git-worktree-index absence. A replaced directory is retained. A dirty refusal
keeps publication active. Older agents omit the
capability and retain manual push behavior. Host interface members stay unchanged.

The agent polls branch-ref, branch-reflog and packed-ref metadata every 200 ms,
requiring a stable second sample. Metadata schedules inspection; actual attempted
heads deduplicate pushes, including refused heads. It reads no reflog history and
installs no hooks. A normal push pins the captured object ID and uses
`--force-with-lease=<branch ref>:<last confirmed remote SHA>` to the socket origin
`git://cland/territory.git`. The clone config must name `run/git-proxy`; native
Git additionally sets its authoritative `GIT_PROXY_COMMAND` to the agent-owned 0700
`run/ref-git-proxy`, invoking only the standalone built-in Unix proxy at
`run/git.sock`. Inherited Git environment/configuration overrides are removed;
no clone-supplied proxy executable is run by publication. CLI and standalone
proxy entries share the same implementation.

`run/ref-watches.json` is an atomic private 0600 checkpoint of paths, branches,
attempted heads, confirmed remote tips, native pending admissions and bounded
results/decisions. Each pending push has the existing AgentProcesses launch ID,
captured SHA and native PID/birth; its accepted callback checkpoints that birth
before bootstrap release. The short-lived bounded agent-code producer owns Git
and its pipes and atomically writes `run/ref-push/<launch ID>.json` (0600) after
command close: launch/native birth, pushed SHA, exit status and at most 4096
characters of shared-redacted stderr. It stores no environment or credential URL.
A missing result never turns an unknown native ledger into a completed operation.
`run/ref-push/<launch ID>.log` is the producer's private diagnostic file and is
removed only after positive native closure and durable result settlement. Native launches retain their existing
launch/process records; no separate process ledger is created.

Restart loads current watch records without resolving paths or launching Git on
startup/liveness. Background recovery joins live owned pushes, rechecks captured
native births and targets, and reports unknown children by watch without holding
healthy peers. A later head admits a distinct leased generation while keeping
unresolved earlier native metadata; only a successful leased result or positive
remote settlement clears its publication fence. Cleanup still joins every retained
native owner before unwatch/remove/close. After positive closure it re-reads the branch's current head and
uses the lease; the interrupted captured SHA only identifies its result. A failed
or unknown push fetches the remote ref once and checkpoints whether it is already
at/past the captured head or differs. The recovering phase stays durable through its current-head decision, including a
second restart after settlement. Recovery also checks the current head
against that fetched remote before republishing, so an advanced remote never
moves backwards due to recovery. Native unknown exit codes remain null even when
remote inspection positively settles publication. Refusals retry only at another
actual head. Inaccessible retained watches remain explicitly incomplete while
healthy watches and agent admission continue. Agents separately advertising `ref-watch-status-v1` support additive `watch-status {}` and
`ref-watch-status` frames supply named branch/path/state/cause facts to optional
`hub.status.hosts[].watches`; the CLI prints fenced watches beneath their host.
Older agents/status replies omit that field.

`{event:"ref-moved",path,branch,head,result:{code,stdout,stderr,error?}}` follows
its durable result checkpoint and names the exact captured push head. Unknown
identity/incomplete notices carry null native code and fence only that watch.
`flush` scans immediately and joins pending pushes with a bound; unchanged refused
heads do not retry. Close stops scheduling and joins native push/checkpoint
writers; unresolved native ownership reports incomplete cleanup and retains state.

### Publication admission

On hosts cland pushes the task branch on every commit and other ref moves through
the agent's leased ref-push owner. `cland verify` and `cland task edit --status ready`
flush that same owner first. Automatic verdict-driven ready uses the same check.
The remote CLI reports its HEAD; the hub reads the recorded worktree on its owning
Host and compares the confirmed HEAD with the territory branch. An absent agent
`ref-flush-v1` capability, fenced watch, unknown push, lease failure or differing HEAD refuses
admission with a reason and both heads (unavailable facts say `unknown`). Local
sessions retain their existing admission flow. Report the named cause to the item
lead; a session directory is never a fallback source on the hub machine.

Host verification runs from a hub-local detached territory checkout at the pinned
SHA and branch. The scheduler owns `.cland/run/host-verify/<id>` from admission
through queued/running execution and removes it after writer settlement and
reporting. Startup sweeps snapshots without a surviving pending run. No Git
maintenance is performed by this lifecycle.

Each host verification source has a sibling private `<UUID>.json` ownership
receipt capturing its parent and directory identities and preparation completion.
The job keeps that admitted receipt across restart. Admission/reuse, execution
and cleanup reject symlinked parents or replaced directories. A preparation
interrupted before its ready checkpoint is abandoned and never completed or
trusted. Re-admission creates a fresh unique path at the pinned SHA; each source
UUID is its run identity, bounding abandoned sources to one per run. Cleanup checks
the owning Git admin directory and common Git locks for at most 250 ms per sweep;
`index.lock`, other `*.lock` files and `locked` keep it named in hub status. The next
sweep removes it after those locks clear. No PID, signal, replay or Git maintenance
authority is inferred from an abandoned receipt. Startup cleanup shares one attempt, isolates retained
orphans and retries on later host admission after transient territory contention.
An authenticated host launch or recorded host worktree keeps verify on this
receipt path before the session's process row is published; unavailable placement
refuses rather than using a hub-local task directory.

## Reboot session retirement

Returning SSH readiness carries the authenticated boot id into Sessions. A changed
boot, compared with a recorded native birth, admits `retainHostGeneration` before
exit publication. Sessions release the normal harness-exit role and retain all
metadata/private-file obligations, including held unknown-authority Claude and
pending failed-launch undo. Same-boot tunnel loss does not release those owners.
The old generation remains fenced against native operations after cleanup or
hub restart; a late resume result cannot restore its running status. See
[host reboot](../hub/ssh-host.md#host-reboot).

## Push identity diagnostics

Unknown native push outcomes remain fenced. Watch status/flush failures identify
the boundary: pending native admission receipt, admission PID/identity/boot
mismatch, unreadable producer receipt, unobservable captured target, or a live
target without its native ledger. Diagnostics name differing fields without
printing native admission secrets or account paths. They grant no new cleanup or
retry authority. Clients still accept older observations without optional cause.

## Relaunching an item on another host

A task stays on its host while that host's tunnel is up. Same-host relaunch
reuses its worktree and native conversation. A `session.resume` frame may carry
`relaunch: true` and `host: "f2"`; there is no CLI host flag. A different host is
refused while the original is available. A down, gone or authenticated rebooted
original permits relaunch on a registered destination host.

A short worktree-serial/territory-locked admission persists the exact source
generation, destination and cause before the old adapter is irreversibly released.
The public `Sessions.releaseUnreachableGeneration` method fences and drains
transient adapter work and joins captured hub-local forward cleanup outside both
locks; captured work can itself be awaiting territory I/O. Missing capability or
a mismatched release receipt refuses the move. Native/file settlement obligations
remain retained. A returning original host does not undo committed admission.

The destination fetches the territory's pushed task tip and adds its checkout.
The worktree serial queue precedes the territory lock. Tip capture, exclusive branch-lease replacement and the `adding` checkpoint hold that lock; destination preparation and watch registration run after releasing it. Finalization reacquires the lock and checks the exact row, tip and lease owners before accepting preparation. Host operations that join pushes never run under the territory lock. The old host's
pushes are refused after transfer. Native publication atomically commits the new
process row, ready checkout owner, restart warning and intent completion in the
shared database. A post-commit observer failure does not roll back the native owner.

An incomplete or refused destination/native admission retains its durable intent
and failure reason. After checkout/lease transfer its owner stays `adding` and
delivery stays held. A known, settled native-admission failure with a captured
checkout receipt permits an explicit retry with `relaunch: true` and `host` even
if the original host has returned. The same destination validates the captured
directory, Git file and Git-admin directory identities and previous tip, fetches
the current territory tip and resets the same checkout before reinstalling.
An onward destination takes the branch lease under the territory lock; the previous
destination's full checkout record and ref-watch remain a named retained settlement
obligation in the current owner. Reply notes and the durable session warning name
that host/path and ref-watch. Prune refuses while such obligations remain.
Older agents/records without a checkout receipt and unknown preparation remain
fenced for reconciliation. Nothing restores old push authority.

This starts a fresh native conversation. The cland name, sessionId, role, claim,
item, topic and subscriptions stay with the session. Its first input carries the
recorded brief and a note naming both hosts, cause and territory SHA, saying
native history and uncommitted edits were lost, and directing it to item-topic
`history`. The reply notes and persisted generation warning show that restart.
The old native generation stays a named settlement obligation; tunnel loss does
not prove it exited. Reboot closure retains the existing authenticated boot proof.
No conversation files are copied from the old host.

The cross-host path performs no stop/reap on the unreachable host and adds no
outer stop deadline. Worktree preparation and native spawn are awaited in order,
under the session lifecycle reservation; each keeps its own native operation
bounds. A client request timeout does not cancel or release that reservation.
See [relaunch tests](tests/hub-test-host-relaunch.test.ts.md).

Remote-to-local relaunch is refused explicitly; choose a registered remote host.

Host checkout checkpoint acquisition uses the existing bounded backoff for up to 32 seconds (the 30 second receive ownership cap plus 2 seconds), at both preflight and finalization. This joins an admitted receive rather than refusing immediately. A caller already holding that territory lock refuses as `host-worktree-lock-order` before any Host operation; it never waits on itself. Receive acquisition remains capped at 30 seconds.

Public cross-host relaunch admission uses the same checkout checkpoint policy before adapter drain: acquire with the bounded backoff, then refresh task eligibility, destination registration and exact row ownership before admission. Prune observes Host state first and refreshes row, tip, leases and synchronous item eligibility after those asynchronous observations, immediately before cleanup admission. An item reopened during an occupant query retains its branch and removing checkpoint.

## Host bootstrap and login disks

`host/prelude.ts` renders user-data from an explicit pinned SSH key pair and trusted provider shell steps. A DigitalOcean caller supplies removal of `/etc/udev/rules.d/99-digitalocean-automount.rules` and a udev reload. The renderer installs the hardened sshd drop-in, `cland-auth`, the runner sudoers grant and `/home/runner/.codex/config.toml` with `cli_auth_credentials_store = "file"`. It never inherits hub environment values. The image must already provide `runner`, sshd, mount/findmnt, flock, psmisc fuser and fsfreeze.

The root-owned helper accepts exactly `cland-auth mount|umount|freeze|thaw <volume-name> /cland/auth/<harness>-<login>`. Volume names match `[a-z][a-z0-9-]{0,63}`; the final path component matches `[a-z][a-z0-9]*-[a-z0-9][a-z0-9-]*`. `/cland/auth` stays root-owned and final symlinks are refused. Devices use DigitalOcean's `/dev/disk/by-id/scsi-0DO_Volume_<volume-name>` naming; another provider needs a matching helper device convention before using login disks. All operations hold one root-owned `/cland/auth/.operation.lock` with a 30 second acquisition bound. Existing mounted paths must belong to that volume; their mount ID and exact source are pinned and rechecked before each census, signal, freeze/thaw, permission change and unmount. Helper operations are the mount owner; concurrent administrative mount changes outside the helper are outside this ownership contract. Signals use fuser’s mountpoint-only `-M` safeguard. Missing, changed or ambiguous mount receipts refuse mutation, including unmount of an already absent mount. Mount waits at most 120 quarter-second device polls. Unmount first observes writers. If needed, it sends TERM, observes up to 20 quarter-second writer polls, then KILL and another 20 polls; remaining writers keep the disk mounted with a nonzero result. Freeze syncs before freezing; thaw unfreezes. A silent psmisc fuser census must first successfully detect the helper’s open lock file as a positive control; only a subsequent silent status 1 with no diagnostic counts as no users. Status 0 means users; other statuses, missing commands or census diagnostics fence the operation. Signal errors also fence it. Exit 2 means invalid arguments, 3 means missing/wrong/changed mount, 4 means persistent writers, 5 means lock contention and 6 means incomplete writer census or signal; the latter includes native status and bounded diagnostics. Other native command failures propagate their status.

Stub-script and rendering checks are documented in [cland-auth tests](tests/hub-test-cland-auth.test.ts.md) and [prelude tests](tests/hub-test-host-prelude.test.ts.md).

Pool images are prepared by the local human CLI or Neovim through `host.prepare`
(`cland host prepare [pool]`); sessions and remote connections cannot submit it.
Pool names use 1–64 ASCII letters, digits and hyphens, starting with a letter
or digit; invalid names fail config reading. The fake provider requires a
disposable sealed root. See [pool images](../hub/host-providers.md#pool-images).

Managed config writes through settings/auth, init/update and setup retain `[hosts]`
and unknown TOML fields. They may regenerate formatting and comments; removing
the managed mark leaves the file under human control.

Host creation, inventory and destruction (`cland host create [pool]`, `cland host list`, `cland host destroy <id>`)
share prepare/revoke's local human CLI or Neovim boundary. Implementers exercise
these through sealed disposable fixtures. The [provider reference](../hub/host-providers.md#create-to-ready)
names current provider prerequisites, lifecycle receipts and retained failures.


Pool configuration is now modeled by `host/pools.ts`; the transport-config entry
point remains compatible for provider callers. Managed init/update add the hosts
spend and lease defaults with no pool. Settings writers validate full pools and
publish them immediately; custom sizes need slots. See
[pool configuration](../hub/host-providers.md#pool-configuration).

Role placement intent is stored in `[<role>.launch] pool` in `roles.toml`,
defaulting to `local`. `cland role launch <role> --pool <pool>` edits it;
Coordinator and Aide accept only `local`. Syntax is checked when loading roles,
independently of the pool configuration. See [role pool defaults](../hub/roles.md#role-host-pool-defaults).
