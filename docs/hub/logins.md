# Logins

`cland login list [--json]` reads project login metadata from `hub.db`. It is
available only through a local human CLI or Neovim connection. Sessions, web
clients and remotes cannot list logins. In users mode the local user must also
have administrative authority. The command never reads the user-level accounts
registry, harness files or key material, and creates no logins.

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

Each method returns detached values. Metadata updates beyond transitions are
not exposed by this initial store API.

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


The agent reserves writer admission before login-disk drainage, joins already admitted operations, and refuses new writer-capable requests from every connection through unlink. Native cancellation and observation remain available. Fake process drainage performs repeated captured censuses, signals only members actually using the disk, and refuses uncertain ownership. The native TERM escalation and final closure bounds use the shared Clock (2 s and 4 s respectively); no successful unlink is reported on exhaustion.

A closed process row alone does not settle drainage. The agent joins any current-lifetime root completion that has observed native exit through its durable checkpoint and exit publication before unlinking. The same drainage deadline bounds that join; failure or missing completion retains the disk. A still-live unrelated root does not enter this completion join.
