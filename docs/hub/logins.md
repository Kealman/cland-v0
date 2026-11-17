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
available through a local human CLI or Neovim connection or an authenticated
web user. Sessions and remotes cannot list logins. In users mode the acting user
must have administrative authority. The command never reads the user-level accounts
registry, harness files or key material, and creates no logins.

The `login.list` frame accepts an optional `name` for an indexed, single-login
metadata read. It returns zero or one `LoginMetadataRow` with name, harness,
account, state, kind and disk provider/region. This row has no `bindings` field;
its absence says nothing about binding inventory. An unfiltered request keeps
the exact prior `ListedLogin[]` reply including all bindings. Setup uses the admitted name from
the terminal add reply for one bounded readback; an older hub that ignores the
filter can return the prior full array, which setup filters by that exact name.

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
A post-close nonzero exit unmounts and detaches the kept disk, then
marks it signed out. Peer close or hub shutdown instead interrupts the add through
the shared sign-in owner: the disk stays mounted and attached, and the signed-out
row records `sign-in interrupted` with the captured host. The existing private
sign-in admission fences retries and removal until that exact machine has a
persisted deletion receipt. Startup recovers lost new-login admissions through
the same indexed recovery as renewals; elapsed time and detached inventory grant
no settlement authority. A missing native cleanup receipt retains creating state
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

**Ownership correction, 2026-11-12.** This correction supersedes three claims in
the original add/sign-in paragraphs above while preserving their historical text.
The sentence that changed captured authority triggers cleanup is not authority
to unmount or detach after admitted attachment, mount or terminal-plan
publication. Those authority-loss paths interrupt the shared sign-in owner,
record `sign-in interrupted` and retain the captured machine/disk admission.
Only a positively admitted native close/completion or that exact machine's
persisted deletion receipt supplies settlement authority. A refusal before
native ownership is captured follows the ordinary failed-admission path.

The cleanup-only pin-release description above is also superseded.
`preparePoolLogin` releases its transient `busyHost` pin when interruption
changes the row from creating to signed-out; the private exact-machine sign-in
fence independently retains disk authority and refuses retries/removal. A pin
release is not a cleanup receipt. A row still creating retains its pin, including
when completion has no confirmed cleanup result.

The canonical mounted OpenCode path helper is now
`hub/src/host/agent/state-paths.ts`'s `mountedOpenCodeDatabase`, which the agent
sign-in command imports directly. Its exact path-construction allowance is
covered by the accounts-policy guard. `accounts/registry.ts` re-exports that
helper for existing callers; import-through-registry guidance remains valid,
but the earlier statement assigning canonical ownership to the registry is
superseded. Neither path permits reading a login database's contents.

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
It requires local human CLI/Neovim administrative authority; web requests stay refused.
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

On cland-provisioned hosts this helper is the sole freeze owner: kernel-held freezes ([Linux v6.8 fs/super.c](https://github.com/torvalds/linux/blob/v6.8/fs/super.c#L1993-L2004)), device-mapper snapshots, suspend/hibernate freezes and other FIFREEZE users are outside the host contract.

On a validated matching ext4 mount, `thaw` also succeeds with stdout `already thawed by userspace`
when util-linux fsfreeze exits 1 with exactly its C-locale
`fsfreeze: <path>: unfreeze failed: Invalid argument` diagnostic (FITHAW EINVAL).
The helper observes FSTYPE and rechecks the mount ID/source under its operation
lock before accepting that diagnostic. Unsupported or unknown filesystem types
and other failures remain failures. This result means no userspace freeze held
by cland remains; it does not prove the absence of a kernel freeze holder.
The agent maps either successful thaw to its
existing null reply; snapshot recovery clears the persisted freeze on that
success, and the release owner clears its fence after confirmed detach.
This behaviour requires a host image or installed helper containing the change;
updating the hub alone does not replace `/usr/local/sbin/cland-auth` on existing hosts.

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
Like list, it accepts local human CLI/Neovim and authenticated web requests,
with administrative authority in users mode. A key login refuses with `key login has
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
users-mode administrator check apply; web key adds stay refused. Claude Code and Codex key requests
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
login uses that same owner and exact-machine fence, records `sign-in interrupted`
and retains its attached, mounted disk. Its
card withdraws with `sign-in outcome unknown`, and one Agents line names the
login and host. Those identities persist before the native run starts. The shared CLI/card owner performs no native cleanup or second fence on owner
loss; its exact-machine deletion settlement is the same as renewal recovery.

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

## Storage boundary

[ADR 0009](../adr/0009-login-storage-boundary.md) records the split between
project login metadata, encrypted human-entered keys and harness-owned disk
contents. The [v0.1.2 amendment](../spec/v0.1.2.md#313-accounts-and-limits)
preserves the local names-and-paths account registry. A pool launch uses
`LoginRecords` and `LoginBinder`; it never resolves a disk login through that
local registry. Local launches and manually registered non-pool hosts retain
their existing registry behavior.

Agents must reuse the owners described above. `LoginRecords` owns state and
indexed eligibility; `LoginBinder.prepare` and its finish/rollback own native
binding; the sign-in owner pins the host through `busyHost`; the release owner
and snapshot scheduler share `beginRelease`/`onReleased`, including `hostLost`.
A provider response or an absent inventory row cannot replace the exact native
cleanup receipt. Pending bindings and reader intents stay with their admitted
owner, and a missing receipt retains the admission fence across restart.

Use `mountedOpenCodeDatabase` to construct a mounted database path and the
agent's `loginFilePath` for fake-host path translation. Neither helper permits
reading login bytes from the hub. Tests use the existing fake harness binaries
to rotate sentinel login files, the fake provider and transport, and the hub
clock. They never use a real login, key, volume or network provider. The
[write-back case](../agents/tests/hub-test-login-write-back.test.ts.md) proves
that a later host receives the rotated file through the retained volume;
metadata, binding and capacity tests make no native-harness claim.

## Startup reconciliation owner

`LoginReconciliation` in `host/login-reconcile.ts` is installed by the daemon
inside session restoration, after `restoreHostLeaseOwners` and before the
first pool-scaling pass. Its `start()` joins an existing pass rather than
starting another. A pass captures candidates before reading project volume
inventory, pages active disks and settled bindings independently at 64 rows,
and delegates detached binding settlement to `releaseDetachedLoginBinding`.
That shared release boundary validates project, region, exact volume and the
captured binding episode; writers use the lost-host snapshot fence and readers
use their existing deletion owner. A missing release owner retains the binding.

The independent binding cursor reaches signed-out readers even when the original
disk is missing. Pending native bindings and reader operations in creating or
deleted phases stay fenced. Detached inventory is a positive release receipt;
host disappearance or list omission alone cannot free a binding. A retained
reader deletion intent still requires its exact-id provider deletion receipt.
An attached volume remains bound. Unknown or gone hosts with unresolved volume
inventory schedule another pass; a healthy attached binding needs no retry loop.

Missing original volumes on active disk rows use `markSignedOut(name,
{reason: 'volume missing', host: null})`. The `signedOut` UUID and store-clock
timestamp identify that episode without removing its resource ownership.
Private row revisions and binding episodes reject inventory captured before a
new sign-in or rebind, including replacements with identical public values at
the same clock time. Reconciliation does not create a login or run sign-in.

Unavailable provider inventory leaves rows unchanged and emits one Coordinator
Agents notice per provider in that hub lifetime. Retryable work uses a 1 s hub
Clock timer; `close()` cancels that timer and joins the admitted pass before
dispatcher release/snapshot owners and storage close. Unmatched project volumes
produce `login-reconcile-unmatched-volume` diagnostics and remain intact.

See [reconciliation cases](../agents/tests/hub-test-login-reconcile.test.ts.md)
for T2 inventory, receipt, stale-episode and indexed-work assertions, and
[host restart cases](../agents/tests/hub-test-host-restart.test.ts.md) for the
native watchdog/deferred-detach and retained mounted-login proofs. Fixtures
using `settledLogin` await its fake-provider volume allocation, supply their
disposable project and shared clock, and attach to the captured machine when
testing an attached login; invented volume ids cannot model restart persistence.
These are references to the landed cases, not a claim that this documentation
change reran their runtime coverage.

## Removing a login

`login.remove` accepts the local human CLI/Neovim or an authenticated web user.
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

`removeLogin` in `host/login-remove.ts` joins concurrent calls for the same
`LoginRecords` instance and login name. `beginRemove` is the store's admission
boundary before provider work; callers must not infer eligibility from the
public state or reason alone. The dispatcher tracks admitted removal work
through shutdown. In users mode the acting user needs administrative
authority; sessions, remotes and host-origin connections cannot
invoke `login.remove`.

`LoginSnapshots.beginRemoval` joins accepted snapshot work and thaw through the
existing release fence. If a positive snapshot receipt survived a failed
accounting write, that owner repairs its storage lifetime and captures the
snapshot id before checking `assertSnapshotSettled`. An unknown admission
without a positive receipt remains fenced. The removal owner never clears
`snapshot_admission` itself or treats an inventory omission as snapshot success.
`confirmRemovedResource` joins each confirmed resource-id removal and
`deleteStorage` stamp in one store transaction; final `remove` rechecks the
claim, bindings, snapshot admission and retained storage before deleting the row.

Removal also narrows the sign-out card behavior described below: a durable
removal claim suppresses episode publication and withdraws the existing card,
including on startup. A genuine sign-out whose reason happens to be `removing`
still has normal card eligibility when no removal claim exists. The sign-out
reason is diagnostic metadata, never removal authority.

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

`deadLoginReason` in `host/login-signals.ts` classifies native error fields and
returns a bounded signal name. Ordinary output or unrelated failures do not
authorize sign-out. `Sessions` resolves callbacks by the admitted native session
id and processes them only for a running row. `LoginSignals.report` requires a
non-local host, the selected login and matching harness; a disk also needs that
host's settled binding. A reader can report death of the shared login. Missing,
unrelated, pending-binding and already-signed-out selections cause no new episode.

All sign-outs, including a failed sign-in, use the store's `markSignedOut` receipt
path. Its atomic UUID distinguishes episodes even at the same store-clock time;
it preserves bindings and reader operations for their receipt owners. Callers
must not substitute `transition(name, 'signed-out')`, which refuses. The creating
state is also admitted by `markSignedOut` for failed sign-in settlement; a new
sign-in clears the old receipt when it transitions to creating.

`LoginCards` recovers publications from indexed `signedOutRows()` and uses
`login-signin-cards` active metadata to retain each episode's card identity and
notice receipt. A row lacking its episode id refuses recovery explicitly.
Repeated reports do not reopen an answered or declined card. Not now or decline
keeps the login signed-out; it grants no sign-in operation. The card's presence
is not a native sign-in receipt. These signal and publication cases preserve
running sessions; they make no claim that a live harness picks up refreshed
login files without relaunch.

## Sign-in owner entry points

Renewal enters `preparePoolLogin` with `signin: true`; it uses the captured writer's
pool and ready host, or the existing disk's storage pool for an unbound login.
`prepareExistingLoginSignIn` owns mounted-writer completion and is also reused
after the ordinary preparation path mounts an unbound existing volume. It
requires the captured Machine and `snapshotHostIdentity` before native work.
Use these entry points with `beginSignIn`/`finishSignIn`, rather than a generic
state transition or a second mount/sign-in path. `busyHost` pins the same owner.

`recoverLoginSignIns` runs after volume reconciliation and before scaling,
using indexed active admissions and host cursors. It invalidates orphaned
completion authority without restarting a terminal. `settleLoginSignInsForHost`
uses the release owner's persisted `machineDeletionRead` and captured Machine;
it cannot borrow a replacement host's deletion or a detached inventory reading.
`assertNotSigningIn` also guards `beginRemove`, so a temporarily mounted unbound
login still refuses removal while that interrupted writer fence stands.

See [sign-in cases](../agents/tests/hub-test-login-signin.test.ts.md),
[restart recovery cases](../agents/tests/hub-test-login-signin-recovery.test.ts.md)
and [native renewal cases](../agents/tests/hub-test-login-resignin-native.test.ts.md).
The native cases use the existing fake harnesses and directory provider; they
prove native close, binding preservation and snapshot settlement, not live
subscription behavior. References here describe landed coverage; this
documentation change does not rerun those runtime cases.

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

The sign-in owner calls `afterSignIn(host, harness)` after committing
`finishSignIn`, rather than relaunching from a CLI result or card publication.
`Sessions.relaunchAfterSignIn` captures the active rows on that host, then
revalidates session id, harness conversation and host for each candidate.
Its admission callback runs inside the existing resume lifecycle slot before
directory or native work and requires the same host generation, running state
and no archive. A queued stop, archive or newer resume can supersede the
automatic operation. The relaunch owner does not turn that supersession into
a request to start a stopped session.

Use the shared hook and resume owner for every renewal front end. A relaunch
failure can make the command report an error after durable sign-in success;
inspect the committed login and named failed sessions rather than inferring
that the sign-in itself rolled back. The disabled setting requires no native
process replacement, and no relaunch here requests a fresh conversation.

## Agent-owned interactive sign-in

An SSH Host's optional `signIn({harness, path}, onOutput)` uses the authenticated
agent operation advertised by `signin-v1`. It shares the terminal flow's public
harness command grammar; it does not accept arbitrary command arguments. Older
agents and Hosts without this method refuse before native work. See the
[transport contract](ssh-host.md#interactive-sign-in) for the wire operations.

`SignInRun` pins one connection and admission. Its `write(text)` registers input
with both agent-side in-memory stream redactors before writing stdin. Output
callbacks carry admission, stdout/stderr and text, bounded to 4096 UTF-8 bytes
per chunk and 64 KiB total. Raw or rendered output overflow stops the owned
tree and reports `outcome: 'output-limit'`. Input never enters argv; raw input
and output are absent from persisted agent operation receipts and history.

The `closed` promise and `cancel()` require the matching admission's native
tree-close receipt, with an exit code or signal and a synced operation
checkpoint. Null code and null signal are incomplete. The disk mutation lease
is held through persistence, so an unmount cannot race a live sign-in writer.
Input and cancellation remain available while an unmount waits. Each peer owns
only its own admissions; a replacement connection cannot inherit them.

Only proven pre-native refusal carries `nativeAdmission: 'not-admitted'`:
`CLAND_SIGNIN_UNAVAILABLE` for missing capability, `CLAND_SIGNIN_REFUSED` for
validation/writer admission, or `CLAND_SIGNIN_SPAWN_REFUSED` for a pre-native
spawn refusal. Other failures, lost transport and missing close are incomplete
native outcomes. They grant no cleanup or success authority. Renewal and
new-login creation share the interrupted sign-in owner and exact-machine fence;
both retain disk ownership without unmount or detach on owner loss. Elapsed
time or local SSH closure cannot substitute for this agent operation's receipt.

Failed close persistence/publication retains the operation and disk lease;
disk mutations refuse with `writers-remain`. Agent shutdown joins all admitted
peer work and reports incomplete owners. Completed native objects retire only
after checkpointing; at most 32 receipt-only entries per peer support repeated
cancel without granting process authority. See
[interactive sign-in cases](../agents/tests/hub-test-host-agent-signin-op.test.ts.md)
for native fake-harness and T1 companion coverage. These links describe landed
cases; this documentation change does not rerun them or perform a real login.

## Sign-in from a card: secret answers and expiry

`LoginCardSignIn` owns card orchestration around `preparePoolLogin` and the
captured Host's `signIn` operation. Card handlers persist the accepted intent
with the answer and start work only after commit. Renewal rechecks the stored
sign-out episode and removal claim. Parsed native output publishes the code card
only after its admission matches the returned run; input ownership is armed in
that publication transaction. There is no second disk completion or relaunch
owner behind the card.

Claude Code's text answer is registered with the project redactor before input
is sent; the agent separately registers it before stdin. The secret hub-card
path carries raw text only in a memory-only dispatch argument after checking
the stored hub identity. Persisted answers, handler outcomes, journal and mirrors
contain only `answered`, including when a handler returns its input. Secret
voice replies refuse before download or transcription. See
[secret hub-card answers](asks-and-the-inbox.md#hub-cards) for the shared path.

The captured native message identity and deletion obligation commit with the
secret answer before acknowledgement. `SecretAnswerCleanupOwner` recovers the
indexed obligations without needing the message text or its hash. It joins
duplicate work, retries transient or unknown deletion outcomes on the hub clock
from 1 s up to 30 s, and joins admitted work before adapter shutdown. Telegram
and Discord delete the exact message where supported; unsupported or positively
refused deletion yields one keyed line asking the human to delete it. Native
absence confirmation settles cleanup; a sent request alone does not.

The 15-minute deadline begins at accepted intent time and includes preparation.
Expiry immediately closes input and withdraws the code card, then asks the native
owner to cancel. Only the matching native close or a typed pre-native refusal
permits failed completion and disk cleanup. Unknown renewal and new-login
creation use the shared interrupted sign-in fence, retaining the attached/mounted
disk. Unknown new-login creation withdraws its card and reports the persisted
login/host identities once; it performs no cleanup or second fence. Recovery pages accepted intents at
64 per event-loop turn through a captured sequence boundary and never replays
native sign-in.

See [owner cases](../agents/tests/hub-test-login-card-signin-owner.test.ts.md),
[remote secret cases](../agents/tests/hub-test-login-card-signin-remote.test.ts.md)
and [intent recovery cases](../agents/tests/hub-test-login-card-recovery.test.ts.md).
These are landed component references, not runtime executions by this change.

## Shared new-login interruption and recovery

New disk sign-ins from the CLI and a card's Create one enter the same private
sign-in admission as renewal. After the volume is persisted,
`LoginRecords.beginAddSignIn` captures the unbound creating disk and exact Host
machine/identity before attach and mount. `prepareLoginSignIn` now returns the
shared `interrupt()` boundary as well as `complete()`. This supersedes the
earlier new-login cut that retained only a creating row on unknown native outcome.

Peer loss, hub shutdown or an uncertain card run interrupts that owner without
unmounting or detaching. `markSignedOut` records `sign-in interrupted` and its
captured host, and the retained admission refuses another sign-in or removal.
The disk remains attached until this owner confirms its own native close and
cleanup, or the release owner observes that exact machine's persisted deletion
receipt. An already-admitted close-confirmed completion is joined rather than
replaced by interruption; after interruption invalidates the token, a late
completion cannot acquire cleanup authority.

Startup uses the existing indexed `recoverLoginSignIns` and exact-machine
settlement path for both adds and renewals. No timer, missing inventory row or
replacement machine grants recovery authority. A post-child-close CLI frame on
its pending connection or the matching card operation's native close remains
the completion receipt; a dispatcher-synthesized null result is not one.

See [new-login component cases](../agents/tests/hub-test-login-add-component.test.ts.md),
[host-pin cases](../agents/tests/hub-test-login-host-pin.test.ts.md) and
[card-owner cases](../agents/tests/hub-test-login-card-signin-owner.test.ts.md)
for shared-owner interruption and unchanged close-confirmed cleanup. These
references describe landed tests; this documentation item makes no new native
execution claim.

## Web-started sign-in

Authenticated web users can request `login.add` for a disk or `login.signin`
for a signed-out disk. Users mode requires an active admin. Both enter the
existing card runner directly, without answering a create/renew card. The reply
is `{name, card}`, where `card` identifies the persisted `login-signin-code`
card carrying the link and code; it does not wait for sign-in completion.
Preparation or native failure before a link card returns an error. The runner
owns the operation through web disconnect, hub shutdown and its 15-minute bound.
Codex completes device sign-in without an answer; Claude Code receives the
secret card answer on the captured input handle. The same pool preparation,
disk fences, snapshot and native close receipts apply as for card answers.

`login.list`, `login.snapshot`, `login.remove` and `host.stop` also accept
these web users. Key adds require local stdin. `login.set`, `login.signed-in`,
`host.status`, `host.list`, `host.create`, `host.destroy`, `host.revoke` and
`host.prepare` stay local. Session and messenger ingress remain refused for
all host/login frames. Audit records and their journal copies use the user id
resolved from web authentication, never a frame-supplied identity.

## Removing and snapshotting from the web

With a configured host pool, the Sessions area's expanded Hosts view shows
Remove on unbound logins. Confirmation names the login and deletion of its
volume and snapshots, or its key file for a key login. Cancel and folding the
view discard an unconfirmed action. Bound logins offer no Remove; the hub still
checks removal ownership and running sign-ins when confirming. Its refusal stays
on the login line, with the login retained.

Disk login lines also offer Snapshot through `login.snapshot`. The line shows
the confirmed snapshot id or the hub/provider refusal, including the provider's
snapshot window. Key logins offer Remove only. These actions use the existing
authenticated web authority (an active admin in users mode), and refresh through
`login.list` after the hub result.

The Hosts view offers Add per pool. Its harness list combines the pool's role
harnesses and actual eligible login harnesses (keys, or disks matching the pool’s provider and region); all-zero summary keys contribute no choice. Name is optional. Add sends `login.add`, and
Sign in again on a signed-out disk sends `login.signin`. Both use the hub's
card runner. The returned card appears inline on the login line with its link
and device code, alongside its existing inbox and remote copies. The hub adds optional `signInLogin` metadata to its sign-in card and flattened inbox projection, derived only from its persisted hub card payload. It contains the login name and no native admission, URL or answer. The view matches open cards by that authoritative name, including when it folds or reloads before the initiating request returns. It also keeps captured login/card IDs in tab sessionStorage for older hubs that lack the optional field; that fallback restores only associations already received. Known terminal IDs are pruned. No answer is stored there. Claude's inline
Sign-in code field sends `topic.answer` on that card and clears before the
request. It keeps no draft in React state or browser storage. Answering elsewhere
folds the same card; expiry stops input and the login line reads the hub's state
and signed-out reason after native settlement. Login changes wake waiting launches;
the inbox names the current login or boot wait until placement commits.

Web `login.add` and `login.signin` wait up to 16 minutes for the card receipt:
this includes cold-host preparation and the sign-in owner's 15-minute lifetime,
plus one minute for its receipt. Other web commands keep their 10-second default.
While the request is pending the initiating control remains disabled. A missing
receipt remains unknown; the client neither declares native failure nor resends
the request. The hub's sign-in expiry and exact native close rules are unchanged.
