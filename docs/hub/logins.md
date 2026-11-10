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
snapshots once, detaches, records the last sign-in and marks the login ready.
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
- `bindings(name)` returns rows sorted by host, each containing login, host,
  `role: 'writer' | 'reader'` and `volumeId: string | null`.
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
