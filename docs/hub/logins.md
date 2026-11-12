# Logins

`cland login signin <name>` renews a signed-out disk through the local human
terminal, using login add's pinned `ssh -t` command and connection-owned
completion. It keeps the writer host, volume and bindings.
An unbound disk uses login add's pool selection, attach/mount and cleanup path
with its existing volume from inventory. Real hosts require provider API and
terminal SSH access; fake-provider tests use no network. Keys refuse disk sign-in.

`LoginRecords.beginSignIn` records a durable admission, moves signed-out to
creating and clears `signedOut`, retaining binding and reader rows. Pending
bindings, release and snapshot ownership refuse admission. Native exit zero
freezes, snapshots and thaws the mounted disk through the existing snapshot owner.
Unbound mounts detach before `finishSignIn` publishes last sign-in and ready;
retained bindings publish in-use. Nonzero exit records a sign-in-failed episode;
unknown cleanup retains the creating fence. The generic transition to creating
keeps its previous binding-deleting semantics; renewal uses these dedicated methods.

Renewal snapshots enter `LoginSnapshots.signIn` and its shared work map. Release
joins the admitted native freeze and thaw before unmount, and shutdown joins the
same work before storage closes. Renewal captures the writer binding's private
episode, host registration, machine birth and volume birth. Indexed writer and
binding-existence reads avoid materializing retained readers. Fresh inventory
checks across admission, native effects and completion fence changed attachment
or volume identity before publication. Provider and Host disk owners retain their
own native identity checks.
Both the resolver and renewal use `snapshotHostIdentity` for that freeze identity;
a returning machine may thaw its own retained intent, while a different birth
refuses it. The direct renewal entry requires the captured Machine and identity
before any effect, including callers that bypass pool selection.
The real removal and snapshot admission accessors fence both begin and finish;
the admitted snapshot may use its own private admission while running. A queued
backup without native admission is not an unknown native outcome.
If an older scheduled or manual backup still owns preparation, renewal drains
that generation first, revalidates its durable admission and admits its own
backup. Only work for the same renewal admission shares a result.

A positive native exit proves sign-in success. A known provider rate refusal
keeps the login in-use or ready, with `backup.pending` and `retryAt`; the shared
snapshot owner retries at that time. An unknown snapshot outcome or changed
authority retains creating and its owner fences. A deferred backup is shown as
pending and never counted as a completed snapshot.

After startup volume reconciliation and before pool scaling, the sign-in owner
reverts an orphaned renewal admission to signed-out with `sign-in interrupted`,
invalidates its old token and retains all bindings. It resumes no terminal and
infers no success. If a host was admitted before native effects, an interrupted
fence names that exact host and machine birth. The card explains that another
sign-in may still be running there, and a new sign-in refuses. No elapsed time
or detached-volume inventory clears the fence. Only that machine's persisted
deletion receipt from the existing release owner does: a pool host's idle stop
or manual `cland host destroy` supplies it. A long-lived host keeps the login
fenced until then. There is no existing census identity for terminal SSH sign-in,
so no process-census recovery is attempted. A failure before host admission has
no native writer and needs no interrupted-host fence.
The CLI sends `login.signed-in` only after its SSH child closes. That frame on
the exact owning connection is the positive close receipt; the pending owner
holds the durable token. Success or failure then follows its native result,
including `sign-in failed` for a closed failed child. A dispatcher-generated
peer-close or graceful hub stop instead calls `LoginSignIn.interrupt`, with no
unmount or detach, invalidates the pending entry and retains the same interrupted
fence as abrupt death. Other-connection and late interrupted frames refuse.
Owner loss joins an already-admitted close-confirmed completion, preserving its
snapshot work rather than replacing it with interruption.
For a temporary unbound mount, the same exact-machine deletion receipt also
calls the snapshot owner's existing lost-kernel abandonment path. It settles
that machine's freeze without adding a release fence, and preserves any positive
snapshot receipt or native admission. Those retained snapshot obligations still
refuse a new sign-in; machine deletion never manufactures a successful backup.

A second operational sign-out within 24 hours adds “This account seems to allow
one sign-in: set exclusive or add an account.” to the card, Agents notice and
text list. The hub clock and account key define the window; empty accounts key
by login name. Exactly 24 hours is outside it, and failed creating attempts do
not count. Additive `signedOut.oneSignIn` retains the hint across restart.
Hostless administrative transitions such as removal and volume-missing recovery
do not count as dead-login episodes for this hint.
Older rows omit it. A private `login_signout_window` table migrates empty and retains
one timestamp per identity. Each sign-out prunes at most 64 expired entries
through an expiry index; reads and startup scan no retained sign-out history.
See [renewal cases](../agents/tests/hub-test-login-resignin-native.test.ts.md).

`cland login list [--json]` reads project login metadata from `hub.db`. It is
available only through a local human CLI or Neovim connection. Sessions, web
clients and remotes cannot list logins. In users mode the local user must also
have administrative authority. The command never reads the user-level accounts
registry, harness files or key material, and creates no logins.

Text output ends with `capacity <pool>/<harness>: <n>` from `host.status`.
It lists login harnesses and the harnesses of roles bound to each pool. Capacity
is the smaller of max_hosts and eligible exclusive disks in the pool provider
and region; an eligible non-exclusive disk or key supplies max_hosts. Pending,
creating, signed-out and exclusively bound disks supply no new-host capacity.
JSON retains the login array; an older hub without capacity omits the text lines.

Disk rows may include additive `storage: {pool, items}` metadata. Items retain
kind, id, sizeGiB, provider-created time and confirmed deletion time (or null).
The pool is captured at disk creation; reader clones belong to that login pool.
Storage writes prune deletions before the current UTC month. Private indexed
storage_pool/storage_through columns filter out earlier deleted-only logins
before JSON decoding; neither private field appears in public output. Harness
enumeration uses three indexed existence reads. Legacy rows without
storage contribute zero; there is no inferred backfill. Keys have no storage.
`host status` adds accrued storage to month spend only, using overlap with the
current UTC month divided by that month’s length. Fake rates are zero; declared
DigitalOcean rates are $0.10/GiB-month for volumes and $0.06 for snapshots,
checked 2026-11-11. Storage never enters hosts reservations or today spend.

`cland login add <claude-code|codex|opencode> [--name <name>] [--pool <pool>]
[--account <account>] [--kind disk]` creates a disk login through a local human
terminal. The default pool is `agents`, otherwise the only configured pool;
the default name is the lowest free `<harness>-N`, and account defaults to name.
It reuses any ready host in the pool, including full hosts, joins a boot already
in progress, or creates a host through the normal host-create admission path.
Creation requires a current prepared pool image and obeys `max_hosts`.
Login name validation and the creating-row reservation precede asynchronous host
work. A duplicate request owns neither that row nor a host pin. The operation
revalidates the captured ready host, machine birth and registration before each
native effect and terminal-plan publication; changed authority triggers cleanup
using the originally admitted resources.

The provider creates a 1 GiB volume in the pool region. The host mounts it at
`/cland/auth/<harness>-<name>`. The CLI runs the harness's own sign-in through
pinned `ssh -t`: Claude uses `CLAUDE_CONFIG_DIR` and `claude auth login`, Codex
uses `CODEX_HOME` and `codex login --device-auth`, and OpenCode uses `OPENCODE_DB`
and `opencode auth login`. Codex receives a new `config.toml` selecting the file
credential store before the terminal starts. cland never reads the disk contents.
OpenCode database names remain owned by `accounts/registry.ts`; callers use its
pure `mountedOpenCodeDatabase(mount)` helper for mounted login paths. The source
policy permits that exact path constructor and rejects database access elsewhere.

`login.add` with disk kind returns only a public terminal plan. `login.signed-in` reports the
native exit code on the same authenticated connection. Exit zero unmounts,
requests a backup, detaches, records the last sign-in and marks the login ready.
A provider rate refusal retains the pending backup and retry time while sign-in
finishes ready; other snapshot failures keep the disk signed out.
A nonzero exit or connection close unmounts and detaches the kept disk, then
marks it signed out. A missing native cleanup receipt retains creating state
and its resource fence. While a newly added login is creating, it has no bindings or free
capacity. No step logs out a harness. Provider API access and terminal SSH
connectivity are required on real hosts; fake-provider tests use no network.

The CLI owns the spawned SSH process through native close. Socket loss or CLI
cancellation requests termination and joins it; cancellation keeps the hub
connection until that receipt, then reports a null exit. TERM escalates after
two seconds, with a five-second native-close bound. Incomplete native cleanup
reports exit/signal facts and retains the open connection until late closure.

The sign-in owner pins the selected host before preparing the disk and releases
the pin after confirmed cleanup. `PoolIdleLifecycle.busyHost(id)`, supplied
through `Sessions.startPoolScaling`, counts these owners alongside sessions
for idle-stop and lease renewal. Incomplete cleanup retains the pin and reports
the failure. Consumers creating login operations reuse this seam.

Rows show name, harness, account, kind, state and last sign-in. Disk rows also
show exclusive (default true), provider, region, volume id and snapshot ids.
Key rows have none of those disk properties and support OpenCode only. Text
uses `-` for absent values; JSON omits disk properties on key rows. Each JSON
row includes `bindings` with login name, host, writer/reader role and volume id;
text appends bound hosts to the state.

`HostRecords.logins` constructs `LoginRecords` on the hub database. Names match
`[a-z0-9][a-z0-9-]{0,31}` and are project-unique. New rows start creating, with
no bindings and no free capacity. Transitions are creating → ready or signed-out,
ready → in-use or signed-out, in-use → ready or signed-out, and signed-out → creating.
Entering in-use requires a binding. `transition()` clears bindings when leaving
in-use; `markSignedOut()` retains bindings and reader ownership for their release owners.
Removing the final binding returns the login to ready. Exclusive disks permit
one writer; non-exclusive disks can retain multiple readers. Bindings and rows
persist across hub restarts. This store contains metadata only.

## Store API

`cland login set <name> --exclusive true|false` changes an idle disk login.
It requires the same local human CLI/Neovim administrative authority as list.
In-use logins refuse changes; key logins have no exclusive flag.
Disk logins default to exclusive. An exclusive login already bound elsewhere
is unavailable; an attached-elsewhere provider refusal rolls back the attempted
binding without changing the login.

For a non-exclusive disk the first host receives its original writer volume.
Later hosts receive separate volumes cloned from the latest recorded snapshot;
without a snapshot the reader launch refuses naming the login. Readers can
rotate their clone's login files, but those changes never write back to the
original. Release unmounts and detaches a reader, then confirms clone deletion
before removing its binding. Lost-host release uses detached provider inventory
before deletion. Missing receipts retain the binding. Listing includes every
writer and reader host. Real providers require API and host connectivity;
fake-provider tests use directory volumes and fake harnesses without network.

Selection first reuses the host's settled binding, then a ready key matching harness/account, then a ready disk;
only when none is ready does it offer an in-use non-exclusive disk as a reader.
Harness, provider, region and optional account must match. A pending binding or
unresolved reader-create or deleted-but-unacknowledged intent fences selection
and exclusive-flag changes. A reader requires
a recorded snapshot. Exclusive in-use disks are never offered to another host.
`hasPendingBinding` includes reader phases `creating` and `deleted` so capacity verdicts and
snapshot deferral use the same fence. T-1784's availability query builds on this
rule; `free()` remains the legacy ready-state listing and is not launch admission.

`LoginRecords` retains a private reader operation before sending create: login,
host, captured machine generation, provider/project/region, snapshot and a unique
volume name. A returned volume id is checkpointed before binding publication.
Unknown creation retains that intent; launch retry or the existing host-release
owner reconciles its exact admitted name from provider inventory, deletes the
unattached clone and requires a fresh launch retry. Absence alone never clears an
unknown create. Indexed host pages include unbound intents for restart recovery.
A confirmed provider create refusal clears its exact untouched intent and permits
retry; an unconfirmed failure keeps it fenced.

Reader release and binder rollback share `host/login-reader.ts`. Confirmed detach
(or a create that never attached) precedes a durable deletion intent for the
captured volume id. Even when inventory omits that id, recovery calls the
provider's exact-id deletion boundary and requires its confirmed `deleted`
receipt. An intent or list omission never substitutes for that receipt.
Confirmed deletion is persisted before binding removal. Final-reader completion
joins the existing snapshot owner's synchronous `onReleased` acknowledgment with
binding and marker removal in one transaction. A missing or refused acknowledgment
retains the operation and admission fence; its removal rearms pending snapshots.
Deletion or publication failure retains the operation for retry, including lost
hosts. Legacy reader bindings acquire this private record after confirmed detach;
public login and binding reply shapes remain unchanged.

The installed release owner discovers unbound intents on hosts whose destruction
was interrupted, whose creation failed, or whose destruction already completed,
including records without a machine-deletion read. `destroyHost` and the retry
owner share the same release-obligation predicate. A destroyed provision stays
terminal while its actionable reader and disk obligations retry separately;
those retries never rewrite the provision or repeat machine release. Unknown creation on a healthy
ready host remains fenced for launch retry or explicit host release rather than
causing automatic destruction of that healthy host. Pending native bindings stay
with their binder's positive mount/commit or full rollback receipt.

Import `LoginRecords`, `Login`, `LoginInput`, `LoginState` and `LoginBinding`
from `hub/src/host/logins.ts`. The hub constructs `store.hosts.logins` on its
existing database. Callers own admission and native resource receipts.

- `insert(input)` returns a creating row. Base input is name, harness, account,
  kind and `lastSignIn: string | null`. Disk input adds provider, region,
  `volumeId: string | null`, `snapshotIds: string[]` and optional exclusive.
- `get(name)` returns a row or null; `list()` returns rows sorted by name.
  `setExclusive(name, boolean)` changes disks while they are not in use.
  `free()` returns ready rows only.
- `selectForLaunch({host, harness, provider, region, account})` returns at most
  two held host/harness bindings (to detect conflicts), or one ready key/disk login.
  Ready selection uses optional account filtering and stable account/name order.
  It uses the store's maintained indexes rather than decoding retained history.
- `bindings(name)` returns rows sorted by host, each containing login, host,
  `role: 'writer' | 'reader'` and `volumeId: string | null`.
- `hasPendingBinding(name)` checks existence through `login_bindings_pending(login,
  phase)` with a one-row limit, without materializing settled reader bindings.
- `transition(name, state, binding?)` validates the state edge. Entering in-use
  requires a binding without the login field. Leaving in-use clears bindings
  in the same database savepoint. Signing in again moves signed-out → creating.
- `bind(name, {host, role, volumeId})` moves ready to in-use or adds a reader to
  a non-exclusive in-use login. A second writer is refused. A key binding has
  a null volume id.
- `unbind(name, host)` removes that binding; removing the last binding from
  in-use changes the row to ready atomically.

Each method returns detached values. `updateCreatingDisk(name, update)` publishes
volume, snapshot and last-sign-in receipts only while a disk row is creating.

`markSignedOut(name, {reason, host})` changes a creating, ready or in-use login to
signed-out and atomically records public `signedOut: {id, reason, host, at}` metadata.
Every sign-out uses this method; a bare `transition(name, 'signed-out')` refuses.
Failed or abandoned sign-in records reason `sign-in failed` and a null host.
The UUID id is generated inside the transaction and distinguishes episodes even
when the store clock has not advanced.
The time comes from the store clock. This method retains bindings and reader
operations exactly; their release owners still own cleanup. Starting sign-in
(`signed-out` → `creating`) clears the receipt. A signed-out row without its episode
id is a defect and refuses card recovery. `signedOutRows()` streams signed-out
records through the existing state-leading index without decoding other states.

Binding metadata violations throw `LoginBindingRefused` with a stable `code`
(`disk-volume-required`, `writer-volume-mismatch`, `reader-volume-mismatch`,
`key-volume`, `exclusive-writer` or `writer-conflict`) before any write. Every
disk binding requires a non-null volume id; a writer uses the login's original
volume, and a reader uses a different volume (a snapshot clone). Key bindings
have a null volume id. Provider volume existence, attachment and whether a
reader's volume came from this login's snapshot belong to the stage-2 native
binding/release owners; this store enforces only metadata coherence.

## Host login-disk API

SSH Hosts expose optional `loginDisk({op, volume, path})`, with `op` one of
`mount`, `umount`, `freeze`, `thaw`. Local Hosts refuse; callers encountering an
older Host without the method must refuse too. The authenticated agent validates
the helper grammar and existing path ancestors before launching exactly
`sudo -n /usr/local/sbin/cland-auth <op> <volume> <path>`. No login bytes or
provider keys are arguments. Refusals carry `bad-argument`, `busy`,
`writers-remain` or `wrong-volume`; helper exits 4 and 6 retain writer ownership.
Helper execution is checkpointed by the agent’s durable prepared-command owner before native launch. An incomplete native close retains that checkpoint and fences all new mutations across agent restart; recycling the host is required if native settlement cannot be proved. An unknown SSH outcome fences subsequent mutations on that Host; callers must
reconcile the disk rather than blindly retrying.

Mount discovers existing device mount targets, including `/mnt` automounts,
and drains each through the mount-ID/source fence before unmounting it.
Discovery failure retains the mounts. It then mounts at the requested login
path and applies runner ownership and mode 0700.

With both the fake-host marker and fake provider root configured, the agent
uses the fake provider's `volumeContents` attachment check. The logical path
maps beneath that exact machine directory and links to its attached volume's
contents. An unrelated symlink is refused; the helper's exact volume link is
admitted. Relocation drains and unlinks other login links for that volume.
Unmount inspects working directories and open files of agent-owned process
trees, signals only disk users with captured native identities, including retained descendants after their root exits, and confirms their native closure
before unlinking. Uncertain observations retain the link. A restarted agent
cannot acquire signal authority from retained process records: disk users it
did not launch cause `writers-remain`. Fake freeze/thaw validate attachment and
the link but do not emulate filesystem write blocking. These fixtures require
no sudo, mounted device, provider API or real harness login. See
[login-disk tests](../agents/tests/hub-test-host-login-disk.test.ts.md).

Agent filesystem operations use exported `loginFilePath(path, env)` from
`agent/fake-login-mount.ts` for validated logical login paths, including the
mount root. Directory setup, stat/type/list/read and removal share the same
provider attachment and exact-link validation as publication and other writes.
Real hosts and ordinary paths retain their existing behavior; fake `realpath`
replies keep logical disk paths. Host-execution consumers may use this export
for harness home and database paths without persisting fixture paths in metadata.


The agent reserves writer admission before login-disk drainage, joins already admitted operations, and refuses new writer-capable requests from every connection through unlink. Native cancellation and observation remain available. Fake process drainage performs repeated captured censuses, signals only members actually using the disk, and refuses uncertain ownership. The native TERM escalation and final closure bounds use the shared Clock (2 s and 4 s respectively); no successful unlink is reported on exhaustion.

A closed process row alone does not settle drainage. The agent joins any current-lifetime root completion that has observed native exit through its durable checkpoint and exit publication before unlinking. The same drainage deadline bounds that join; failure or missing completion retains the disk. A still-live unrelated root does not enter this completion join.

## Binding at launch

A pool-host launch first reserves host capacity. After item, role and checkout
admission, the shared native spawn boundary selects a ready disk login of the
harness, provider and host region, attaches its volume and mounts it before
spawning. An explicit launch account or matching role harness account narrows
selection. An explicit empty account clears a role pin and remains unpinned, as
for local account resolution. This uses project login accounts, without looking up a path on the
hub machine. Before provider work, the binder checks the selected login's actual
account through the existing account-limit owner, and repeats that check after
each await before effects and settlement. An already-limited selected account
refuses without consuming a ready login. A host's settled
disk binding must match its provider and region and remain in-use; key bindings
cannot supply a disk mount. A settled binding is reused by later launches of
that harness; a different requested
account refuses. Pool placement holds an accepted durable `waiting for a login <harness>` wait
when no eligible login exists. The binder independently refuses
`no login <harness> in pool <pool>` if eligibility disappears after placement
or a direct binding caller has no eligible login.

Demand-created hosts prepare logins at the `createHost.onConnecting` checkpoint.
`PoolRuntime.start` passes a demand reader through `Sessions.startPoolScaling`
and the dispatch create composition; the checkpoint captures waiting harnesses
and their explicit or role account pins. Each capture retains the exact durable
wait's admission authority, including cancellation, role eligibility and item
admission. Every asynchronous boundary rechecks that authority and the current
harness/account selection before effects and settlement. One disk per harness is prepared by the
Sessions-owned `LoginBinder.prepare`, using the same indexed selector and pending
fence as launch binding. Provider attachment runs alongside runtime delivery and
cloning. The hook's `ready()` mounts through the answering Host and joins every
finish before the provision row becomes ready. Launch then reuses the settled
binding. With no waiting demand, manual and minimum creation bind no login.

The hook's `failed()` joins preparations and the binder's rollback before the
existing host-stop release owner runs. Before a mount attempt, positive detach
alone permits reuse; after an attempted mount, positive unmount and detach are
required. An unknown outcome retains the pending fence and is never retried by
the provision owner. Settled bindings follow the normal host-stop release path.
Tests use an injected create seam, directory provider and hub FakeClock; the
simulated attachment overlaps cloning without advancing the ready timestamp.
Real provider and agent latency can still delay ready when binding outlasts boot.
Selected-account-limit and invalid-demand binder refusals remain launch-scoped:
the healthy host becomes ready and normal launch admission publishes the refusal.
No-login capacity holds demand before creation. If login preparation produces an
unknown outcome, its pending fence remains; later pool placement holds that
harness's durable login wait without turning the machine into a boot retry.
The first uncertain binder operation still reports its own failure.
The creation signal and a synchronous failed-hook fence prevent new attachment
admission after failure or abort; cleanup joins admitted work before rollback.

`LoginBinder` in `hub/src/host/login-binding.ts` serializes selection. The mount
is `/cland/auth/<harness>-<login>` using the full harness id. `CODEX_HOME` and
`CLAUDE_CONFIG_DIR` name that directory; `OPENCODE_DB` names its `opencode.db`.
The process table persists optional `login`, the account, and only this mount
overlay in `accountEnv`. Public session views add optional `login`; older rows
and replies without it remain readable. Local launches and manually registered
hosts outside pools retain the existing account registry behavior.

Before attachment the owner commits an in-use writer binding with optional
`phase: pending`. A successful mount and metadata commit change it to `settled`.
An absent phase is a legacy settled binding. `bindings(name)` and `login.list`
include phase only when stored, preserving the previous shape for older rows.
`settleBinding(name, host)` requires that exact pending binding. No new public
login state is introduced. A pending binding is never reused or offered by
`free()`. A failed bind unmounts and detaches before removing its binding and
returning to ready. Missing positive cleanup receipts retain the pending binding
and fail the launch with the login name and `outcome unknown`. Startup login
reconciliation leaves pending bindings to the binder's own receipts and never clears them by row edits; ordinary host-stop release must leave them alone too. Shutdown joins in-flight binding work to native
settlement or its existing operation deadline before storage closes. It introduces no raced timeout.
Abortable volume and login-disk operations are follow-up T-1801.

The same spawn boundary binds or reuses the destination login for fresh and
cross-host resumes, replacing the source overlay and persisting the destination
login. A same-host fresh resume keeps its settled binding. Normal native
conversation resume retains its recorded login and mount without rebinding.

Remote command environments remove `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`,
`OPENAI_API_KEY`, `CODEX_API_KEY` and `CODEX_ACCESS_TOKEN` after all overlays,
on both sides of the agent connection. Local command filtering is unchanged.
See [binding tests](../agents/tests/hub-test-login-binding.test.ts.md).

At host execution, `loginExecutionEnvironment` maps the three login home/database
variables through the agent's exported `loginFilePath` using the authoritative
fake-host layout. Spawn, generic run and run-host/Claude command owners share it.
T-1777's file-operation mapper handles directory preparation and file access;
real hosts keep logical paths unchanged. Hub requests and process/session rows
retain the logical mount paths. OpenCode mount construction imports the canonical
`mountedOpenCodeDatabase` helper from the account registry.

Launch selection uses `login_bindings_launch(host,harness,login)` and a JSON-field
`login_ready_launch` index matching the ready/disk/harness/provider/region/account
query. The private binding harness column is backfilled from existing rows in a
savepoint with index creation; public binding shapes are unchanged. Every binding
insert supplies its harness. Selection decodes at most two bound rows or one ready
row, independently of signed-out/ineligible history. The normal SQLite indexes
maintain this derived selection across writes and connections. OpenCode key selection uses the partial login_ready_keys harness/account/name index, with no temporary sort. Other harnesses retain their existing query path: held selection takes one query, ready disk selection two. OpenCode ready-key selection takes two queries; falling through to a ready disk takes three. The indexed
selector itself scans no retained history. Row and binding changes notify the
snapshot listener with the changed login name. After its initial startup scan,
the scheduler reads and rearms only that login, without decoding retained history.
Pending bindings defer snapshots until settlement or confirmed rollback.

## Backup snapshots

The snapshot owner retains every provider admission in the private SQLite
`logins.snapshot_admission` column, through `LoginRecords.beginSnapshotAdmission`
and `settleSnapshotAdmission`. It writes the volume identity immediately before
every provider snapshot admission, including unfrozen ready disks. The existing
freeze intent identifies a specific mounted Host for thaw and cannot represent
that unfrozen case. The admission clears only on a confirmed not-sent/refusal or
in the same transaction that durably captures a matching snapshot receipt and
its storage lifetime. If accounting persistence fails, the owner retains the
positive receipt and unsettled admission; receipt recovery repairs accounting
before clearing admission.
Failed or lost replies retain it across retries and hub restart. Removal and
reconciliation only read it through `assertSnapshotSettled`; they never clear it.
A retained admission refuses deletion of any login storage until its snapshot
owner positively reconciles it. This private column never enters Login JSON.

`cland login snapshot <name>` requests a backup of a ready or in-use disk login.
Like list and add, it requires a local human CLI or Neovim connection and local
administrative authority in users mode. A key login refuses with `key login has
no disk`. The command reports a confirmed snapshot, a provider retry time, or a
failure; a queued retry is not a completed backup. Real providers require API
access and mounted snapshots require the authenticated writer Host.

`LoginSnapshots` in `host/login-snapshots.ts` owns scheduled and on-demand work.
The hub clock schedules an in-use disk 24 hours after the last confirmed backup
(or last sign-in for legacy rows). A legacy row with neither timestamp gets
a persisted initial deadline; it does not move on reevaluation. It freezes the mounted writer disk, snapshots,
and thaws in a finally block, including on provider failure. Detached disks need
no Host operation. Concurrent requests for one login join one operation.
Provider rate refusals persist `backup.pending` and `backup.retryAt`; the timer
runs at that time. Other scheduled failures retain a pending retry after one
minute and report the failure. Freeze intent (captured host, target identity and volume id) is persisted before
freeze admission. A snapshot receipt is retained before thaw and publication.
Start first attempts thaw of its own retained intents on that exact target; it
never transfers an old intent to a replacement host. Unconfirmed thaw keeps its
intent and fence and is reported. T-1793 owns binding/volume reconciliation.
Target authorization rechecks row state, writer bindings, provision and host
registration around awaits. A changed owner receives no new snapshot effect or
publication; an admitted provider receipt stays retained for reconciliation.
Retained and new receipts must match the current volume id. A creating-row volume
change refuses while pending, freeze or receipt ownership remains retained.
Stop cancels timers and joins admitted work before
storage closes. Start resumes overdue in-use disks and persisted pending work.

Scheduled and manual backups defer while any binding has `phase: pending`.
They persist `backup.pending` and the outcome `login snapshot deferred: pending
binding`, without freezing the disk or calling the provider. Settlement or
binding removal rearms that login; absent phase retains legacy settled behavior.
Each login owns its timer, so another login's change cannot move its deadline.

`LoginRecords.updateBackup(name, backup, snapshotIds?)` persists optional disk
backup metadata; older rows without it remain valid. `onChange(listener)` passes
the changed login name and returns an unsubscribe function. Existing listeners
that ignore arguments remain valid. Row saves and binding-only additions,
settlement and removals notify the scheduler. These methods do not alter bindings.
The new snapshot id is persisted before pruning;
older ids beyond two are removed only after `deleteSnapshot` confirms deletion
with its provider read. Interrupted pruning resumes before another snapshot.

New-login add calls the shared `snapshotLoginDisk(logins, name, target,
clock)` after confirmed unmount. Its creating state excludes scheduler admission.
Renewal on an existing disk instead enters `LoginSnapshots.signIn`, keeping the
mounted freeze/thaw registered with the same release and shutdown owner.
The release owner first awaits `dispatcher.loginSnapshots?.beginRelease(name)`
before asynchronous stop work. It persists a release fence and refuses new
snapshots. It joins any admitted freeze and its thaw independently of the
provider snapshot promise; a failed thaw leaves the fence up and refuses release.
After confirmed detach, it calls
`dispatcher.loginSnapshots?.onReleased(name,
{volumeId})` once the login is ready or signed-out
with no bindings. This synchronous notification validates the volume id, clears the release fence and
queues a due backup without awaiting provider work. The host release owner makes those calls; this module never stops a host or mutates bindings. A future provider retry
remains at its recorded deadline after release.

See [snapshot tests](../agents/tests/hub-test-login-snapshots.test.ts.md) and
[command tests](../agents/tests/hub-test-login-snapshot-cli.test.ts.md).


`HostProvider.snapshotVolume(volume, {authorize?})` accepts a synchronous send
check. Both providers invoke it at their native snapshot boundary; DigitalOcean
passes it through `DigitalOceanApi.volumeSnapshot`'s optional mutation scope so
it runs after owned-volume reads and every API pacing wait, immediately before
POST. Throwing returns `{state: 'not-sent', reason: 'snapshot authorization refused'}`
and sends no mutation. With no callback, prior provider behavior is unchanged.
The scheduler supplies its captured ownership/release check: a snapshot queued
before release cannot start after thaw. Already-admitted effects keep their
provider receipt until reconciled. `not-sent` is not a completed backup.


## Key store

Key logins support OpenCode only in 0.4.x. The local key-input module reads one
line from stdin or a hidden prompt and encrypts it before invoking the metadata
sender. The CLI first requests `login.list` under the same local-human/users-admin
authority as add, before requesting key input or writing auth files. Names default
to the first `opencode-N` absent from both project login rows and local key files;
account defaults to name. Final add revalidates authority and name uniqueness. An existing name refuses rather than replacing its key. An interrupted
metadata submission retains the encrypted file for reconciliation.

`.cland/auth/<name>.key` is a create-only mode 0600 JSON envelope with `version: 1`,
base64 `nonce` (12 bytes), `ciphertext` and `tag` (16 bytes). The cipher is
AES-256-GCM under `[auth] key` from `.cland/secrets.toml`. Associated data is UTF-8
`JSON.stringify([projectTag, name])`; the tag is the existing project tag, including
the canonical root and configured project name. Moving or renaming a project
therefore requires reconciling key files before they can be used there.
The auth directory is mode 0700 and the managed ignore file includes `auth/`.
Custom ignore files must finish with `/secrets.toml` and `/auth/` (either order).
Symlink paths, linked/nonregular key files and oversized envelopes are refused.
Decrypt failures identify only the login. The admitted hub path decrypts in memory,
registers the value with its redactor, then stores a ready metadata row with no
volume. A missing registration callback must refuse admission.

`cland login add opencode --kind key [--name <name>] [--account <account>]`
uses this key path. It needs a running local hub, but no host pool, prepared image,
provider API, terminal SSH or network. The local human CLI/Neovim admission and
users-mode administrator check match disk add. Claude Code and Codex key requests
refuse with the 0.4.x limitation. The hub requires its redactor registration hook,
decrypts before inserting metadata and returns the ready key row. `login.add`
carries harness, kind, name and account only; no key material or ciphertext. See the
[key-store cases](../agents/tests/hub-test-login-keys.test.ts.md).

## Key spawn environment

A pool-host OpenCode launch selects a ready key by account without provider or region constraints. The same key can serve concurrent hosts. It remains ready with no bindings; provisioning, stop and destroy perform no key attach or detach. Existing settled disk bindings still take precedence on their host.

The hub decrypts the key file per native generation, including resume/relaunch, and registers its value with the project redactor. Startup streams indexed ready-key names to register launchable values; creating/signed-out metadata without admitted key material remains listable and does not block startup; key add registers before publication. `SpawnRequest.secretEnv` carries `OPENCODE_API_KEY` only until native spawn over the authenticated agent socket. Adapters return the login name and an empty account environment; process rows, attach records, config files and argv contain no key. Key launch errors identify the login and scrub registered secret values from diagnostics while preserving typed refusal classes and safe ownership/receipt fields. Registered secret bytes are scrubbed before journal/log persistence.

Prepared agent checkpoints preserve nonsecret environment values and hold the key only in lifetime memory. The native bootstrap inherits its environment; `launches/<id>/plan.json` holds no environment values. Restart reconciles native receipts rather than replaying a prepared spawn; a fresh launch reads the encrypted key again. This requires the updated host-agent runtime as well as the hub. Local launches and manually registered non-pool hosts keep account-registry behavior. See [key spawn tests](../agents/tests/hub-test-login-key-spawn.test.ts.md).

## Releasing host disks

Before pool scaling's first pass, startup reconciles active disks after host-lease
recovery. Provider inventory must positively report a detached volume before the
shared release owner clears its binding. Reader clones use the same exact-id
confirmed-deletion boundary and storage deletion stamps as ordinary release.
Pending native bindings and reader intents in creating/deleted phases stay with
their owners. An absent original volume marks the login signed-out with
`signedOut.reason = 'volume missing'` and retains resource ownership metadata.
Failed inventory changes no login, sends one Coordinator Agents notice per provider
in that hub lifetime and retries using the hub clock. Shutdown cancels retries and
joins inventory work before release/snapshot owners and storage close. Unmatched
project volumes are logged and left intact for lost-work inspection. These reads
require provider API availability on real providers; fake tests use directory
inventory and no network. Indexed pages contain at most 64 active disks or settled
bindings. The independent binding cursor includes outstanding signed-out readers
without decoding unbound signed-out history. Candidates and their private store
revisions are captured before each inventory read and revalidated before effects.
Settled binding candidates also capture a private admission episode. Rebinding
the same public login/host/volume values creates a new episode; completion of
another binding's release never advances that captured authority. The shared
release/reader owner revalidates it across snapshot and provider waits. Private
episodes are absent from public binding replies and require no client migration.
Unresolved unknown/gone-host detachments retry; healthy attached bindings do not
create a retry loop. Reader deletion preserves the captured native volume birth.

The confirmed host-destroy boundary releases settled disk bindings concurrently,
including explicit stop/destroy, idle stop, lease expiry and boot-failure cleanup.
The dispatcher registers the release owner's Host lookup, snapshot fence and
Coordinator notice once for its `HostRecords`. Hosts with no disk bindings need
no release owner. Host lookups use the indexed `LoginRecords.forHost(id)` query.

Each disk first enters `beginRelease`, then the agent ends its disk users and
unmounts it. The provider must confirm detach before the binding is removed and
the same volume returns to ready. `onReleased` receives that detach receipt.
All parallel work joins before transport removal or provider deletion. Concurrent
destroy callers join the same operation. A refused unmount or unconfirmed thaw
or detach retains the host and binding and emits one Coordinator Agents notice
per host/login in the hub lifetime. It never authorizes deletion.

For a lost host (15 minutes) or a provider-confirmed gone machine, the release
owner skips unmount. Machine deletion precedes a fresh volume inventory read;
only an existing volume reported detached permits unbinding. Missing inventory,
a missing volume or a still-attached volume keeps the binding fenced and the
destroy result incomplete. Pending bindings remain untouched for startup
reconciliation. The provider retains the volume and its rotated harness files;
the next bind mounts those same bytes on its destination host.

See [release cases](../agents/tests/hub-test-login-release.test.ts.md) and
[write-back case](../agents/tests/hub-test-login-write-back.test.ts.md).

A refused release preserves the existing hard lease/watchdog spend deadline;
stop does not renew it. If that deadline later destroys the retained host,
reconciliation follows the lost/gone path with no unmount and waits for a
positive detached-volume inventory read. After that read clears the binding, a
second Agents notice names the host and login and reports deadline destruction.
Retries do not repeat either notice in the same hub lifetime.

Lost/gone classification precedes the snapshot fence. The additive
`beginRelease(name, {hostLost: true})` mode persists releasing state and records
any retained freeze identity in `backup.outcome` as abandoned with the lost host,
clearing the freeze without resolving or calling that Host. Its kernel freeze
ends with the dying machine. Normal release still requires a confirmed thaw.

The release owner automatically retries a missing or still-attached post-deletion
inventory, using the hub Clock at 1 s with exponential backoff capped at 30 s.
The persisted `machineDeletionRead` and settled disk bindings seed recovery after
restart. `boundHosts(after, limit)` pages the host index at at most 64 hosts per
page and decodes no retained login records. Concurrent retries share the destroy
owner; successful reconciliation stops retrying. Shutdown cancels timers and
joins release work before the snapshot scheduler or database closes.

Two-disk concurrency is measured at the hub boundary: both unmount requests are
issued and outstanding before either detach completes. The real SSH Host's
agent connection processes requests serially; the privileged helper also holds
one global operation lock. This does not claim parallel helper execution.
Fake inventory reads inspect only canonical volume record filenames; atomic
write temporaries are ignored, while malformed canonical records still fail.

An existing tunnel that is down, a closed/quiescing SSH Host, or revoked Host
admission takes the unreachable-host path without another reconnect wait.
`Host.loginDiskReachable()` is an optional synchronous observation of those
existing states; older Hosts without it retain the previous release behavior.
An answering agent's writer refusal remains the retained-host C6 path.

Machine deletion settles sessions before waiting on post-delete volume inventory.
During early startup, before a scheduler exists, the snapshot module's shared
`fenceLostLoginRelease` persists the same lost-host fence and abandoned freeze.
Gone-host deletion/revocation and spend settlement finish with the login still
bound. Once installed, the release owner reconciles its retained deletion receipt,
including a provision already marked destroyed, without changing that provision's
terminal state, deletion receipt or settled spend. Volume delay never holds a
session's deleted-host exit.


## Placement capacity

`host/login-verdicts.ts` supplies `loginVerdict` from indexed metadata reads.
A settled in-use binding in the host's provider and region serves its harness;
a retained signed-out binding reports signed-out, while pending or incompatible
bindings offer no capacity. An eligible free login reports can-bind. Placement
prefers serving ready hosts, then bindable ready hosts, before eligible booting
hosts. The existing LoginBinder owns every native bind.

`LoginRecords.selectCapacityLogin({harness, provider, region, account?})` reads at most one
eligible row: a ready exclusive disk in that provider and region, a ready or
in-use non-exclusive disk there, or a ready or in-use OpenCode key. Creating and
signed-out rows never qualify. Disks with pending bindings or reader intents in creating/deleted phases remain
fenced. The private integer `logins.pending_bindings` equals the count of
`login_bindings.phase = pending` plus `login_readers.phase` in creating/deleted.
The store migration backfills it once and installs INSERT, DELETE and phase/login
UPDATE triggers on both tables. The triggers update the count in each writer's
native SQLite transaction, including rollback, final-reader acknowledgment and
release. JSON row state, volume and exclusive edits update index eligibility
through SQLite itself; no caller maintains a parallel counter. Public Login and
LoginBinding records omit this private column.

One partial `login_capacity_launch` index contains only eligible states with zero
pending count and a key or a volume-bearing disk. Its harness, kind, provider,
region and account prefix bounds capacity reads even across matching pending or
null-volume history. `heldForLaunch({host,harness})` shares the unchanged indexed
two-binding lookup with selectForLaunch. Verdicts call that bounded read directly,
so they never walk the binder's candidate history before checking capacity. The effective explicit or role account pin narrows placement, held bindings,
capacity selection and demand creation; an explicit empty account remains unpinned.
The binder repeats its account check at native admission.

Demand growth waits with `waiting for a login <harness>` when no login is free,
and rechecks at creation admission. A waiting launch follows the current role
harness/account: a creator held in preparation refuses its obsolete selection
before row or machine admission. Explicit pins still override role defaults.
Login changes wake waiting placement.
Minimum hosts still boot without logins. Manual creation and login-add creation
remain exempt from demand capacity checks and still obey max_hosts and provider
admission. Shared/key capacity does not claim native spawn coverage from these
metadata tests; the binding and spawn owners supply those operations.

See [capacity cases](../agents/tests/hub-test-login-capacity.test.ts.md).

## Login wait cards

The hub registers the card sign-in owner with its session and secret-registry
runtime. It runs the prepared Host's `signIn` operation, requiring agent capability
`signin-v1`; older Hosts/agents refuse before native admission. The optional
`runLoginSignIn` override is for component fixtures. Preparation captures the Host
object as internal metadata, so a reused display name cannot redirect the run.
The owner shares `preparePoolLogin` with the CLI, including existing disk renewal,
host selection and busy-host pins. It never supplies a second completion or
relaunch path. A `login-signin-code` card displays the harness link and device
code; Claude Code's free answer is secret. Codex completes without an answer.
Output received during native start stays in bounded memory. The owner validates
the captured run/admission and prearms input in the card transaction before its
publication; a visible card's first answer can use that owner.
The remote Gateway preserves only the parsed link for that stored, hub-owned
card. Its exact origin must occur beside the per-harness patterns in
`host/login-signin-output.ts`: Claude account/Console, OpenAI sign-in, or the
existing fake harness origin. Custom origins remain masked. Registered secret
bytes anywhere in the question keep normal masking. All other URLs, questions
and values pass through the ordinary output redaction; inbound redaction is
unchanged. The parser accepts complete Codex device/user-code labels and its
one-time-code prompt. These text fixtures prove parsing, not a real login.
The timer is 15 minutes on the hub clock. Expiry stops accepting input, immediately
withdraws the code card with `sign-in timed out; closing`, then requests
cancellation. Elapsed time changes visibility only: the login state and disk
ownership remain unchanged. A matching durable native close permits failed
completion and disk cleanup. A typed
`nativeAdmission: 'not-admitted'` refusal also permits failed completion. Unknown
renewal outcomes use the existing interrupted-sign-in fence. An uncertain new
login instead retains its `creating` row and its attached, mounted disk. Its
card withdraws with `sign-in outcome unknown`, and one Agents line names the
login and host. Those identities persist before the native run starts. This
conservative cut performs no cleanup or second fence; T-1814 owns subsequent
shared CLI/card new-login recovery.

Accepted intents are indexed rows with a captured sequence boundary. Recovery
pages at most 64 rows per event-loop turn outside synchronous startup; later
admissions are excluded. It withdraws open code cards and reports once, without
native replay. Every admitted native/input join settles before failures propagate
and before snapshot/release owners close. See the
[owner component cases](../agents/tests/hub-test-login-card-signin-owner.test.ts.md)
and [remote cases](../agents/tests/hub-test-login-card-signin-remote.test.ts.md).

A launch with the placement verdict `waiting for a login <harness>` raises one
hub-owned `login-create` card in General per pool and harness, shared by every
matching launch. The options are Create one and Not now. Create one starts
the shared preparation and Host sign-in path when the card owner is installed;
an older runtime without it returns the terminal command hint
`cland login add <harness> --pool <pool>`. Not now or decline folds the card
and keeps launches waiting. Answers and open cards survive hub restart.
The active-only `login-wait-cards` metadata preserves deduplication without
scanning retained ask history. A card withdraws when no matching login wait
remains, including cancellation or a change to a host-boot wait. A later
independent wait can raise a new card. Login metadata changes wake placement
through PoolRuntime; the existing binder and provisioning owners perform effects.
See [login wait tests](../agents/tests/hub-test-login-wait.test.ts.md).

## Removing a login

`cland login remove <name>` is restricted to the local human CLI or Neovim.
Creating logins refuse removal while sign-in runs. Bound logins refuse with the
host names, including signed-out rows retaining bindings. Pending binding and
reader outcomes remain fenced by their existing owners.

Removal takes a private durable store claim and marks a ready login signed out
with reason `removing`. The claim refuses new bindings and sign-in, survives
restart and is never part of the public Login JSON. `LoginRecords.isRemoving`
is its single read boundary. The claim is published before sign-out notification,
including when the login was already signed out. `LoginCards.withdrawRemoving`
suppresses new sign-in cards/notices and withdraws an existing sign-in card in
live and startup paths; a previously delivered genuine sign-out notice stays.
Eligibility follows the claim, never the sign-out reason text. Removal fences snapshots
through their existing owner and joins accepted snapshot work and thaw before
provider deletion. Unresolved snapshot outcomes refuse deletion.

For disks, provider-confirmed snapshot deletions precede volume deletion. Each
`deleted` provider result includes its absence read. Confirmed deletions update
`LoginRecords.deleteStorage` and remove only the confirmed ids. A missing or
failed confirmation exits nonzero naming the remaining ids; rerun the same
command to finish. A captured volume identity persists privately before delete,
so a lost reply can retry its exact provider operation after restart. Inventory
absence alone does not settle a deletion without that captured identity.

For keys, removal deletes only `.cland/auth/<name>.key` and its metadata row;
the shared `[auth]` store key stays. Symlink paths refuse removal. The metadata
row disappears only after all deletions are confirmed. While a partial row
remains, confirmed deletions stop accruing storage charges at the store clock's
receipt time; remaining resources continue accruing. Full removal removes that
login's storage contribution from host status with its row.

See [removal cases](../agents/tests/hub-test-login-remove.test.ts.md).

## Dead-login signals

On pool hosts the adapters report Claude Code `authentication_failed`,
`Login expired`, `OAuth token revoked` or 401; Codex `refresh_token_reused`,
`codexErrorInfo: "unauthorized"` or 401; OpenCode `provider.auth`. A report from
an admitted session marks its selected login signed-out, including a reader's
report. The binding and every running session remain owned by their existing
owners. Subsequent pool placement skips the signed-out login/host for that
harness. Local sessions change no project login; local Claude signed-out
latching remains unchanged.

Each durable episode raises one `login-signin` card in General with Sign in again
and Not now. Card metadata carries its episode id; answered or declined cards
stay folded across restarts for that episode. A ready login withdraws its open
card; a new episode withdraws any previous open card and raises another even at
the same clock timestamp. Startup recovers missing publications from signed-out
rows. The Coordinator receives one `login-signed-out` Agents notice naming the
login, host and bounded signal. Its deterministic episode identity and positive
`noticed` receipt commit together through the existing notice store and active
card metadata, preserving deduplication after message retention. Neither the
card nor the notice contains native diagnostic bodies or login contents.

See [component cases](../agents/tests/hub-test-login-signed-out.test.ts.md) and
[native fake-harness cases](../agents/tests/hub-test-login-signed-out-native.test.ts.md).

## Relaunch after sign-in

`[hosts] relaunch_after_signin` is a boolean defaulting to false. `cland init`
omits it. `cland config set hosts.relaunch_after_signin true` applies now;
config reload also publishes changes. The shared renewal success hook reads the
current setting after `finishSignIn` durably commits. CLI and card renewal use
this same hook; failed and interrupted sign-ins never invoke it.

When enabled, each live session of the renewed harness on that host goes through
`Sessions.resume(name, true)` in its existing worktree and native conversation.
Other hosts, other harnesses, archived and explicitly stopped sessions stay as
they are. A failed relaunch is reported by session name after attempting the
remaining sessions; the successful sign-in stays committed. No fresh-conversation
fallback is requested. Real hosts still require their native harness, SSH and
provider availability; tests use only fake hosts and adapters.

See [relaunch cases](../agents/tests/hub-test-login-relaunch.test.ts.md).
