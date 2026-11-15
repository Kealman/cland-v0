---
title: Hosts, pools and logins
description: Configure agent host pools, place roles, manage logins and track spending.
---

A host runs agent sessions away from the hub machine. A pool groups hosts with
the same provider, size, region and slot budget. Project logins supply those
hosts with harness authentication. The hub remains the owner of scheduling,
the tracker and your workbenches.

## Configuration

Pools live in `.cland/config.toml`. No pool is created by the default config.
DigitalOcean needs `DIGITALOCEAN_TOKEN` in the **running hub's environment**;
restart the hub after changing it. Never put the token in project config or a
command argument. Provider API access and SSH connectivity are required for
real host creation and disk sign-in.

The `[hosts]` settings are:

| Key | Default and meaning |
| --- | --- |
| `hosts.daily_spend_usd` | 3; host creation sub-cap in USD per UTC day |
| `hosts.lease` | `12h`; minimum `30s` |
| `hosts.harnesses` | Empty version pins; harness IDs map to exact `x.y.z` versions for images |
| `hosts.weights` | Overrides for harness slot weights; omitted uses the weights below |
| `hosts.relaunch_after_signin` | `false`; when enabled, relaunch live sessions of that host/harness after disk renewal |

Each `[hosts.<pool>]` table has these keys. Pool names contain 1–64 letters,
digits or hyphens, starting with a letter or digit.

| Key | Default and meaning |
| --- | --- |
| `hosts.<pool>.provider` | Required; `digitalocean` for DigitalOcean |
| `hosts.<pool>.size` | `s-4vcpu-8gb` |
| `hosts.<pool>.region` | `lon1` |
| `hosts.<pool>.transport` | `ssh` |
| `hosts.<pool>.slots` | 8 for `s-4vcpu-8gb`, 4 for `s-2vcpu-4gb`; explicit positive number required for other sizes |
| `hosts.<pool>.min_hosts` | 1 for `agents`, 0 for other pools |
| `hosts.<pool>.max_hosts` | 2; nonnegative integer, at least the minimum |
| `hosts.<pool>.idle_stop` | `20m` |
| `hosts.<pool>.spread` | `false`; pack busy hosts first; true prefers less occupied hosts |

### Configure a second pool

Start with a running hub, a cland-managed config file and an existing pool. Run these blocks in order from
the project root. Replace `<provider>` with `digitalocean`. The isolated
documentation test substitutes the fake provider; it never contacts a cloud.
The pool is called `second`. Keeping its minimum at zero avoids an always-on
host; these commands configure capacity without preparing an image or creating
a machine.

```sh host-pool
cland config set hosts.second.provider <provider>
cland config set hosts.second.size s-4vcpu-8gb
cland config set hosts.second.region lon1
cland config set hosts.second.slots 8
cland config set hosts.second.min_hosts 0
cland config set hosts.second.max_hosts 2
cland config set hosts.second.idle_stop 20m
cland config set hosts.second.spread false
cland hub reload
cland host status
```

Config writes validate the complete candidate and apply pool settings live.
Reload also rereads settings and applies scheduling and idle deadlines;
existing hosts keep their captured machine identity. A prepared image must be
current before a host can be created. Use `cland host prepare second` when
ready for its paid image build, then add the required logins.

## Role placement

Set `pool` under `[<role>.launch]` in `.cland/roles.toml`, or use
`cland role launch implementer --pool second`, then `cland hub reload`.
The default is `local`. Coordinator and Aide stay local. A role account selects
a project login account on a pool host, rather than a hub-machine account path.
Changing a role's pool affects new launches. An existing waiting launch keeps
its original pool; stop and launch it again to change that placement.

Slots are weights: Claude Code uses 1, Codex 0.5 and OpenCode 0.75. Pending
placements reserve their weight too. The agent independently enforces a decimal
**1.3 GB** available-memory floor; free slots alone do not guarantee admission.

## Commands

These operations run through the local human CLI:

- `cland host list` lists host identity, pool, provider, size, region, state, uptime and hourly rate.
- `cland host status` shows pool hosts, weighted slots, bound logins and UTC spend.
- `cland host prepare second` prepares the pool image; omitting the pool prepares all configured pools.
- `cland host create second` manually creates a host through normal image, capacity and spend admission.
- `cland host stop <id>` stops renewal and destroys the machine through confirming reads. Local Neovim and authenticated web users can also stop hosts.
- `cland host destroy <id>` removes the host and deletes its machine and key through confirming reads.

Host list and status support `--json`. Sessions and messenger remotes cannot
perform host or login administration. In users mode, web administration requires
an active admin. A deletion whose outcome is unknown retains ownership and
spend fences; a missing reply does not mean the machine is gone.

## Lifecycle and failures

Scale-up fills `min_hosts` and creates capacity for waiting demand up to
`max_hosts`, subject to logins, prepared images, provider limits and both spend
caps. An eligible boot already in progress is reused. Beyond the minimum,
idle hosts are destroyed after `idle_stop` and the provider billing minimum
have both elapsed. Active sessions and placement promises keep hosts in use.
Restart starts a fresh idle interval.

A create has a five-minute boot gate. Failure goes through confirmed cleanup;
automatic retries back off from 1 to 30 minutes. A provider retry deadline
pauses that pool's creates. Unknown cleanup retains its occupied capacity.

On tunnel loss the Hosts row turns red immediately and placement excludes the
host. After **3 minutes**, General says `host <id> unreachable`. Reconnection
before **15 minutes** restores ready state. At 15 minutes the hub stops renewal,
shortens the lease and requests destruction, even with running work. A positive
provider report that a host is gone triggers settlement immediately, including
when somebody destroyed it outside cland. An unavailable provider read is not
proof of deletion. Check the recorded loss reason and available capacity before
relaunching affected work.

Waiting launches remain visible in both inboxes with their current reason:

- `waiting for a host`
- `waiting for host <id> to boot`
- `waiting for a login <harness>`

Memory refusals also name the host and available bytes. Waits survive hub
restart and retry on capacity or login changes; stopping a wait cancels it.

## Money

Before acquisition, cland reserves the host's lease under the shared verification
daily cap and the hosts sub-cap. Existing hosts keep running when a new create
is refused. Renewal of admitted leases bypasses the hosts sub-cap, but still
checks the shared cap. In-use ready hosts renew at the smaller of one hour and
a quarter lease, extending to a full lease from now.

A detached watchdog watches the published lease deadline and confirms provider
machine/key deletion at expiry. It survives hub shutdown. Stopping the hub alone
does not stop the bill or destroy its hosts.

The spend ledger distinguishes `hosts` and `verify`; image preparation uses
the executor's verification accounting. The
**80%** hosts warning posts once per UTC day in General with contributing pools,
using settled host costs plus pending host reservations across projects.
Verification costs do not enter that percentage. A zero hosts cap admits no
positive-cost creates and produces no percentage warning.

Host status includes live and settled host cost. Its month figure also includes
accrued login volumes and snapshots in their recorded pool, including storage
left after a host is destroyed. Storage does not enter today's host spend or
host reservations. Missing cost evidence is shown as unknown.

### Provider price table

<!-- Price table insertion point: T-1834. Keep this heading stable. -->

Check provider pricing and the separately billed image builder before approving
paid operations. Setup names its recorded machine and builder terms at each offer.

## Logins

Project logins are separate from [accounts on the hub machine](/docs/accounts/).
A disk login uses a 1 GiB volume in its pool's provider and region and keeps
harness credentials there. cland mounts it for the harness without reading its
contents. A key login is encrypted locally; in this build key logins are
OpenCode-only and need no pool or image.

- `cland login add codex --pool second` signs in through the harness in your local terminal; it requires a current pool image and can boot a paid host.
- `cland login list` lists metadata, bindings and capacity per pool/harness; `--json` returns the login array.
- `cland login signin <name>` renews a signed-out disk, retaining its volume and running bindings.
- `cland login snapshot <name>` backs up a ready or in-use disk; a provider window may defer the backup.
- `cland login remove <name>` deletes an idle login and storage. Repeat after incomplete deletion to finish remaining resources.
- `cland login set <name> --exclusive true` changes an idle disk's exclusivity; `false` permits sharing.
- `cland login add opencode --kind key` reads the key from stdin or a hidden prompt. Never pass a key value in argv.

Disk names default to the lowest free harness-N, account to name, and pool to
`agents` or the only configured pool. Disk eligibility follows provider, region,
account and readiness. Exclusive disks allow one host binding; non-exclusive
disks can supply reader clones to other hosts. Capacity is limited by eligible
logins and `max_hosts`; a pending or signed-out disk supplies no new capacity.
An eligible key can serve concurrent hosts without disk bindings.

| Harness | Login rule |
| --- | --- |
| Claude Code | Disk authentication; default exclusive. Provider account limits still apply. |
| Codex | Disk authentication; default exclusive. One ChatGPT account keeps one login in use at **one place**, the human’s Mac included. A new sign-in may invalidate another place. Use separate accounts for simultaneous places. |
| OpenCode | Disk authentication or a locally encrypted API key; disks default exclusive. Keys can serve concurrent hosts. |

A shortage raises the shared “create one?” login card for the pool/harness.
Signed-out disks show a sign-in card. The web's Add and Sign in again use link/code
cards inline on the login row and in the inbox and remotes. Claude's code field
answers that same card. Expiry stops input; positive native completion is needed
to declare success. Repeated sign-outs within 24 hours suggest exclusivity or
another account. Enable `hosts.relaunch_after_signin` only if live sessions should
relaunch after renewal; stopped sessions remain stopped.

## Workbench, doctor and setup

Both workbenches show a Hosts row per pool with hosts, slots and logins in use;
expand it for individual hosts. Session rows name their host. The web Hosts
view lists logins and offers disk Add, Sign in again, Snapshot and unbound Remove.
Neovim has no login action controls.

`cland doctor` makes no paid or provider call. Its hosts block reads local image
metadata and the running hub's metadata. These line labels use the actual pool,
provider, login, harness or host in place of `<name>`:

| Line | Reading and recovery |
| --- | --- |
| `host <name> image` | current, stale, absent or image key unavailable; prepare that pool |
| `host <name> token` | present fingerprint, absent or not required; set the provider token in the hub environment and restart |
| `host login <name>` | signed-out; renew that login |
| `host <name> <name> logins` | free count per pool/harness; add an eligible login when zero |
| `host <name> reachability` | ready or state/outage; destroy unreachable hosts, stop other unhealthy hosts |
| `host spend` | today versus daily cap, warning at 80%; review the cap and spending |

Without pools doctor's `hosts` line reads `no host pool`. A stopped hub or an older reply
without the needed metadata reports unavailable, rather than assuming readiness.

`cland setup` includes the optional **agent hosts** step after remote setup and
before the Aide. It asks which roles to place on `agents`, with Implementer
preselected. The always-on pool (`min_hosts` 1), image build and each first login
have separate default-No paid confirmations. The image row is `agent hosts image`;
login rows name the harness. Setup verifies a current image and eligible logins
for the chosen role accounts.

With `--yes`, an untouched project reads `skip` with
`optional agent hosts; default No`. Without a terminal, untouched hosts read
`skip` and include exact configuration/placement/reload commands. A configured
but incomplete pool reads `open` unattended; missing placement reads
`agent hosts need role placement`. Image or sign-in work left incomplete stays
visible with its command, and setup continues to the Aide.
