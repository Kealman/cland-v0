# Logins implementation notes

Read the matching [subsystem reference](../../../hub/README.md) alongside these notes.

Login thaw replay uses the helper's exit-0 receipt, including `already thawed by userspace`
for the exact util-linux C-locale FITHAW EINVAL diagnostic on a validated ext4
mount with FSTYPE and mount identity rechecked under the operation lock. Provisioned
hosts use the helper as sole freeze owner; kernel freeze holders (Linux v6.8
fs/super.c), device-mapper snapshots, suspend/hibernate and other FIFREEZE users
are outside that host contract. This receipt concerns cland's userspace freeze.
The agent's null
reply and Host's void result remain compatible; snapshot recovery removes its
freeze after success and release still requires confirmed detach. Existing hosts
need the updated image or installed helper; see docs/hub/logins.md.

For project login work, use `HostRecords.logins` and isolated SQLite or projectHub
fixtures. Authenticated web users can list, snapshot and remove logins, stop hosts,
and start disk sign-ins through the card runner; users mode requires an admin.
Login set, key adds and terminal completion stay local human CLI/Neovim only;
sessions and remotes remain refused. `cland login signin <name>`
renews a signed-out disk through the same terminal owner, preserving live bindings
and sessions. Use beginSignIn/finishSignIn rather than the generic creating
transition; refuse unresolved binding, snapshot, release and removal ownership.
Renewal snapshots enter LoginSnapshots.signIn so release joins the same freeze
and thaw. Peer loss, graceful stop and startup recovery use the renewal owner's
interrupt path without native cleanup, retaining an exact-machine fence until
the release owner's persisted machine deletion receipt, never elapsed time or
detached inventory. No existing terminal SSH census identifies that writer.
The exact pending connection's post-child-close completion is the native receipt;
owner loss joins a completion already admitted with that receipt. Renewal drains
older snapshot preparation before validating and admitting its own generation.
Exercise `login.add`, `login.signin` and
connection-pinned `login.signed-in` only in disposable fake-provider fixtures.
Cards use the same preparation/snapshot owners through the captured Host's
`signin-v1` operation and shared SignIn types/close parser. Web disk starts
return the persisted link/code card; terminal completion stays connection-owned.
Existing hub cards can be answered from web and remotes.
At expiry withdraw the code card and stop input; disk settlement still requires
the exact native close. See [project logins](../../../docs/hub/logins.md).

Pool-host launch binds a project disk login at the shared native spawn boundary,
after item/role/checkout admission; role accounts select
login account names rather than hub-machine paths. Missing eligible logins refuse
with the harness and pool. Keep `LoginBinding.phase: pending` fenced until a
positive mount/commit or full rollback receipt; shutdown joins binding work to
native settlement or existing deadlines (abortable
operations are T-1801). Fresh/cross-host spawns bind at their destination; normal
native resume keeps its recorded binding.
Host-stop release leaves pending bindings fenced for the binder's positive
mount/commit or full rollback receipt. Settled disk
bindings release in parallel through the shared destroy boundary before transport
removal. Destroy also joins watchdog retirement before lease cancellation or
release; retain `watchdog-stop-incomplete` ownership for retry (see
docs/hub/host-providers.md). Use the snapshot beginRelease/onReleased hooks and positive detach
receipts; lost/gone hosts use the snapshot owner's hostLost release mode,
skip unmount and retry detached volume inventory with the hub Clock. Existing
SSH reachability is observed synchronously; deleted-host sessions settle before
volume inventory, and early gone-host startup keeps the disk bound for the
installed release owner.
An unconfirmed release retains the binding and existing hard spend deadline. Use explicit
settledLogin seeds in placement fixtures and readyLogin directory-backed volumes
for native host-create fixtures. See [login binding](../../../docs/hub/logins.md#binding-at-launch).


Demand-created pool hosts start disk attachment at createHost.onConnecting through
the Sessions-owned binder. Join the hook's ready finish before publishing host
readiness, and its failed rollback before host-stop release. Preserve pending
bindings on unknown outcomes. Captured waits retain exact admission and current
account checks after awaits; creation failure/abort fences new attachment work.
Ordinary login refusal stays launch-scoped and preserves a healthy host; see
docs/hub/logins.md, Binding at launch.

Login storage reporting retains provider lifetime receipts on the disk row. Use the existing create/delete owners and LoginRecords storage methods, with the hub Clock; never infer dates from sign-in or reserve storage as host spend. See docs/hub/logins.md.

Project login removal accepts local-human CLI/Neovim or authenticated web users. Use disposable fake
fixtures when implementing it; partial deletion retains its removal claim and
remaining ids for `cland login remove <name>` to retry. Never clear that claim
through another transition. See [login removal](../../../docs/hub/logins.md#removing-a-login).

Disk renewal uses the shared afterSignIn hook after finishSignIn commits. The
hot-applied hosts.relaunch_after_signin boolean defaults false and init omits it;
when enabled only live sessions of that host/harness relaunch through the existing
resume owner, preserving worktree and conversation. Stopped sessions stay stopped.
