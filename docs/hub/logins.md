# Logins

`cland login list [--json]` reads project login metadata from `hub.db`. It is
available only through a local human CLI or Neovim connection. Sessions, web
clients and remotes cannot list logins. In users mode the local user must also
have administrative authority. The command never reads the user-level accounts
registry, harness files or key material, and creates no logins.

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
and its resource fence. While creating, the login has no bindings or free
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
ready → in-use, in-use → ready or signed-out, and signed-out → creating.
Entering in-use requires a binding; leaving it clears bindings atomically.
Removing the final binding returns the login to ready. Exclusive disks permit
one writer; non-exclusive disks can retain multiple readers. Bindings and rows
persist across hub restarts. This store contains metadata only.

## Store API

Import `LoginRecords`, `Login`, `LoginInput`, `LoginState` and `LoginBinding`
from `hub/src/host/logins.ts`. The hub constructs `store.hosts.logins` on its
existing database. Callers own admission and native resource receipts.

- `insert(input)` returns a creating row. Base input is name, harness, account,
  kind and `lastSignIn: string | null`. Disk input adds provider, region,
  `volumeId: string | null`, `snapshotIds: string[]` and optional exclusive.
- `get(name)` returns a row or null; `list()` returns rows sorted by name.
  `free()` returns ready rows only.
- `selectForLaunch({host, harness, provider, region, account})` returns at most
  two held host/harness bindings (to detect conflicts), or one ready disk login.
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
account refuses. With no eligible login, launch refuses with
`no login <harness> in pool <pool>`.

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
and fail the launch with the login name and `outcome unknown`. Reconciliation
at startup (T-1793) owns recovery of pending bindings; ordinary host-stop release must leave them alone. Shutdown joins in-flight binding work to native
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
maintain this derived selection across writes and connections. The indexed
selector itself scans no retained history. Row and binding changes notify the
snapshot listener with the changed login name. After its initial startup scan,
the scheduler reads and rearms only that login, without decoding retained history.
Pending bindings defer snapshots until settlement or confirmed rollback.

## Backup snapshots

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

The sign-in owner calls the shared `snapshotLoginDisk(logins, name, target,
clock)` after confirmed unmount. Its creating state excludes scheduler admission.
The release owner first awaits `dispatcher.loginSnapshots?.beginRelease(name)`
before asynchronous stop work. It persists a release fence and refuses new
snapshots. It joins any admitted freeze and its thaw independently of the
provider snapshot promise; a failed thaw leaves the fence up and refuses release.
After confirmed detach, it calls
`dispatcher.loginSnapshots?.onReleased(name,
{volumeId})` once the login is ready
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

## Releasing host disks

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
including a provision already marked destroyed. Volume delay never holds a
session's deleted-host exit.
