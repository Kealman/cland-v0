# Hosts implementation notes

Read the matching [subsystem reference](../../../hub/README.md) alongside these notes.

## Host admission

Demand placement requires regional login capacity; fixtures that expect growth
seed a ready regional disk before launch. Minimum/manual/login-add creates need
no free login. Use the indexed capacity selector and existing LoginBinder; see
[login capacity](../../../docs/hub/logins.md#placement-capacity).

Pool settings use the shared `host/pools.ts` parser; config set publishes them
immediately. Start a pool by setting provider; custom sizes require slots.
See [pool configuration](../../../docs/hub/host-providers.md#pool-configuration).
Pool names use `host/pool-name.ts`: 1–64 ASCII letters, digits and hyphens,
starting with a letter or digit; config reading rejects underscores.

Pool image preparation, creation, inventory and destruction (`cland host prepare [pool]`,
`cland host create [pool]`, `cland host list`, `cland host destroy <id>`) are restricted to the local human CLI or Neovim, like host revocation. Implementers
prove it in disposable sealed fixtures, never by preparing the live project.
See [pool images](../../../docs/hub/host-providers.md#pool-images).

Host file preparation uses `publishFile` for atomic create-only or replacement,
`appendFile` for shared-ignore repair and `stat` for rollback permissions/offsets.
OpenCode's shared ignore runs on its launch Host; do not add local filesystem
exceptions. Remote publish/append settle their prepared token after a lost reply;
never retry an unknown append. See [atomic files](../../../docs/hub/ssh-host.md#atomic-files-and-metadata).

SSH item worktrees come from the host clone's socket origin; the hub grants the
branch lease and stores the owning host/root/path in hub.db. List and prune use
that owner after restart. Preserve the executable proxy wrapper: Git does not
interpret `core.gitProxy` as shell source. See
[host clone and worktrees](../../../docs/hub/ssh-host.md#territory-clone-and-task-worktrees).

## Subsystem documentation

Host branch lease changes use `host/branch-leases.ts`: grant/revoke own the
territory lock; public revoke waits up to the push cap plus 2 seconds for a
receive/release, using the shared bounded lock backoff. Its `waitMs` is injectable;
an active matching-root lock is reused without waiting. Immediate contention and
bounded-wait exhaustion both refuse as `TerritoryBusy` with "another territory
operation holds the lock", appending the last observed holder PID when known. Merge's branch-wide revoke
requires the caller's existing lock; receive waits up to 30 seconds through bounded lock backoff; merge keeps immediate refusal.
Keep receive-pack locked through native close with a 30 second stalled-push cap,
test expiry with an injected short `receiveTimeoutMs` plus a default-constant
assertion, leave upload-pack concurrent, and pin batch member heads in a short revoke/read
critical section. Preserve `worktrees.serial` → `territory.lock` → Git lock order. Host add/relaunch preparation and watch registration run outside the territory lock between durable `adding` and revalidated finalization. Prune checkpoints `removing`, releases the lock for agent publisher drainage/removal, then reacquires and revalidates row, tip, lease and eligibility before deleting metadata. Add/relaunch refuse removing rows; `host-prune-changed` retains new state. Never hold the territory lock while joining a Host operation that can await a push. Both checkpoint acquisitions use the existing 32 second bounded backoff; an already-locked caller refuses before any Host operation rather than waiting on itself.

Public cross-host relaunch admission uses the same checkout checkpoint policy before adapter drain: acquire with the bounded backoff, then refresh task eligibility, destination registration and exact row ownership before admission. Prune observes Host state first and refreshes row, tip, leases and synchronous item eligibility after those asynchronous observations, immediately before cleanup admission. An item reopened during an occupant query retains its branch and removing checkpoint.
Use scratch host socket tests and the unedited territory/merge preservation files;
see `docs/agents/tests/hub-test-host-allow-list.test.ts.md`.

Host revocation uses `Sessions.settleHostBeforeCut` / `host/settle.ts` before the
authority cut. Its derived 12-second bound (concurrent generation stop/reap plus
retirement and inventory headroom) reports unresolved generations and unknown
inventory; no later Host cleanup is authorised. Provider removal will reuse this
entry point; no remove command is shipped. See docs/agents/host-agent.md.

Changed-boot lifecycle owners call `Sessions.retainHostGeneration(process,
{cause: 'host-rebooted', bootId})` before exit publication, with the authenticated
returning boot id. It records exact native closure for any harness and fences
pending failed-launch retries without signals or file deletion. Preserve pending
undo and host-local files outside the run folder for authorised retirement;
closure alone never proves those resources removed.

Fake-host agent, supervisor and admission-bootstrap identity observations share
`agentBootId`: fake mode requires `CLAND_HOST_BOOT_ID_FILE` on every platform,
and missing evidence refuses before agent recovery. Non-fake Linux ignores a
stray boot-file variable and uses the kernel. Keep fixture birth expectations
in that host's boot namespace; hub-local cleanup retains physical native births.

Keep the old-generation native fence independently of resource retirement:
clearing the final file/receipt obligation must never reopen native operations
through previously captured Hosts, including before the eventual authority cut.

Remote terminal attach uses the launch-written private host record and a separate
pinned-key SSH connection. Never print session credentials in the attach command.
Use `cland host attach` on the host; ending its client leaves the session alive.
See [terminal attach](../../../docs/hub/ssh-host.md#terminal-attach).

Host task branches are published by cland on every commit/ref move. Verify and
ready flush the existing leased agent publisher and require matching worktree
and territory HEADs. A fenced watch, unknown push or mismatch refuses admission;
resolve the named cause through the item lead. Verification uses a pinned,
hub-local detached territory snapshot, never the host session directory. See
[host publication admission](../../../docs/agents/host-agent.md#publication-admission).

A cross-host item relaunch uses optional `session.resume.host` with `relaunch`
(frame only). An available original host refuses migration. A lost or rebooted
host permits a registered destination to fetch the pushed task tip, take the
exclusive branch lease and start a fresh native conversation with the recorded
brief and loss note. Cland identity and claim stay; old native obligations stay
retained. See docs/agents/host-agent.md, "Relaunching an item on another host".

A pending or unknown cross-host handoff remains fenced with its destination owner
and failure reason. A settled native-admission failure with a captured checkout
receipt permits explicit retry even if the source has returned: same-host retry
validates checkout/Git-admin identity and refreshes the pushed tip; onward retry
retains the old checkout/ref-watch as a named settlement obligation. Missing
receipts stay fenced. Report unresolved obligations to the item lead; never resume
the old native generation or discard retained ownership. Successful publication commits the native
row, ready checkout, restart warning and intent completion atomically.

DigitalOcean pool image preparation uses the executor builder lease, watchdog and
spend with pool-specific image/recovery records. Host creation uses the published lease, armed watchdog and hosts reservation
receipts; see docs/hub/digitalocean-host-admission.md. Image preparation uses its
existing executor builder controls.
Use the scripted pool preparation tests and preserve executor preparation tests
unchanged. See [pool preparation](../../../docs/hub/host-providers.md#pool-images).

For host spawn memory admission and fake byte controls, see
[host-agent memory admission](../../../docs/agents/host-agent.md).

Role host pool settings use `[<role>.launch] pool` (default `local`) or
`cland role launch <role> --pool <pool>`. Coordinator and Aide accept only
`local`. Check syntax independently of pool existence; see
[role pool defaults](../../../docs/hub/roles.md#role-host-pool-defaults).
