---
id: R-1530
kind: release
version: 0.4.0
title: "cland beyond one machine: agent sessions on pools of remote hosts, logins and users"
state: open
labels: []
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-31T18:03:30.138Z
updated: 2026-11-15T23:29:38.022Z
---

## Goal

cland's agent sessions run beyond the human's machine: the hub stays on the Mac and launches sessions on pools of small remote Linux hosts it creates, packs, watches and destroys through a host provider, DigitalOcean first, over one hub-owned SSH tunnel per host that carries the spoke, the hub's socket and the territory over `git daemon`. Harness sign-ins on hosts are logins, each on its own provider volume that cland never reads, handed to hosts by the scheduler; static keys are key logins in an encrypted store. The web workbench gains a sign-in mode, single as today or users with passkeys and invitations. The hub is made ready for shape B, the hub in Kubernetes, which the spec designs for 0.4.x. Spec: `docs/spec/v0.4.md` (complete, 2026-10-31). Vocabulary: Host, Host agent, Host provider, Host pool, Slot, Waiting launch, Tunnel, Login, Login disk, Key login, User and Sign-in mode in `GLOSSARY.md`.

## Notes

The scope comes from `docs/spec/v0.4.md` (complete on 2026-10-31, charted by the map M-1511, with the cut Q-1522 in §4). It has nine epics, E-1531 to E-1539. The research Q-1513 to Q-1516 and the prototypes Q-1517 (an agent host) and Q-1518 (login disks) came first, on branches that were never merged. Version 0.4.0 is R-1530's recorded version, and T-1872 moved the root `package.json` and the lockfile to it. The build started on 2026-10-31 at 23:48Z, right after v0.3.2 shipped, and ran to 2026-11-15. The Coordinator led it and the crew ran on Codex. Every epic closed on a demo on the fake host provider, a fake DigitalOcean API and the fake transport in the suite, where hosts are processes on the same machine. No test created a real host, volume or key. About 200 items closed under R-1530.

The goal: cland's agent sessions run beyond the human's machine. The hub stays on the Mac. It launches sessions on pools of small remote Linux hosts that it creates, packs, watches and destroys through a host provider, DigitalOcean first. One hub-owned SSH connection per host carries the session's spoke, the hub's socket and the territory over `git daemon`. Harness sign-ins on hosts become logins: each lives on its own provider volume that cland never reads, and the scheduler hands it to hosts. Static keys are key logins in an encrypted store. The web workbench gains a sign-in mode: single, as before, or users, with passkeys and invitations. The hub also gets the changes that shape B, the hub in Kubernetes, will need in 0.4.x.

What the human can now do, by epic:

- **E-1531 The Host interface and the local host.** Nothing changes on the Mac, and every session runs as before. Underneath, everything the hub does to a session's files and processes now goes through one Host interface, and today's behaviour is its first implementation, the `local` host. The adapters of all three harnesses, the worktree code and artifact path reads act only through the session's host. Each session row records its host, and the hub never probes or signals a remote row's process on the Mac. An item launch creates its task branch in the territory first, and the host then adds the worktree from it. The Coordinator and the Aide always stay local: a launch of either anywhere else is refused with a reason.
- **E-1532 The SSH transport, the host agent and git through the tunnel.** A session on a remote Linux host behaves like a local one. The hub keeps one SSH connection per host, the tunnel, with pinned host keys and its own reconnect loop (backoff from 1 to 30 seconds and a liveness probe every 30 seconds). The tunnel forwards only Unix sockets: the hub's socket, a spoke socket, a per-host git socket and the host agent's socket. It has no TCP forward, and nothing new listens on a network address. On the host, the host agent `cland host serve` starts the harnesses, keeps the process table, reads files for artifacts and adds worktrees. Its supervisor restarts it within seconds, without systemd. Claude Code, Codex and OpenCode all run on hosts. Every commit on a host reaches the territory without the session pushing, and `cland verify` and `ready` wait for that push first. A host may push only its own leased task branches: a push to `dev`, to another host's branch, or a branch deletion is refused. Sessions survive a hub restart, a lost tunnel and a host agent restart. `cland session attach` on a host session opens its own `ssh -t`. A rebooted host makes its sessions exited and frees their roles. A relaunch elsewhere recreates the worktree from the pushed branch. Each host's spoke secret can be revoked. ADR 0003 and ADR 0004 carry the amendments.
- **E-1533 Host providers, images and DigitalOcean.** The hub can create real agent hosts. A host provider sits beside the executor. It creates, prepares, reports and deletes machines, declares prices and limits, and gives volumes for login disks. DigitalOcean is the first provider, and it reads the token from the hub's `DIGITALOCEAN_TOKEN` as the executor does. Hosts go to lon1 by default (fra1 and ams3 are allowed) and are tagged `cland`, the project and the pool. Reaping goes by tag, and API calls stay within DigitalOcean's rate. A refused create pauses and retries. Every deletion of a droplet, key or volume is confirmed by a read: a DELETE 404 alone no longer counts as deleted. One image recipe, for x86_64 or arm64, holds only what cland needs on any project. A project's own system packages now go through a `[verification] provision` hook that runs once as root on the image builder. Neovim and the Chromium libraries left the base recipe, and this project installs them through its hook. A project whose droplet suites need them must do the same. `cland host prepare [<pool>]` builds a pool image keyed on Node, the lockfile, the harness versions and the hook. It reports `current` when nothing changed. A host boots from that image with a pinned host key, set sshd settings and the login-disk helper. It carries no hub secret, provider token or stray Anthropic or OpenAI key. `cland host list` and `cland host destroy <id>` manage hosts.
- **E-1534 Pools, placement and the scheduler.** Roles run on pools of hosts that the hub sizes by itself. A pool is a `[hosts.<pool>]` table: provider, size, region, slots, `min_hosts`, `max_hosts`, `idle_stop`, `spread` and transport. `cland config set` applies changes at once: raising `max_hosts` lets a waiting launch start a host without a restart. `pool` under `[<role>.launch]`, or `cland role launch <role> --pool <pool>`, places a role on a pool. Slots count weight: Claude Code 1, Codex 0.5 and OpenCode 0.75, with 8 slots on `s-4vcpu-8gb` and 4 on `s-2vcpu-4gb`. A host refuses a launch below 1.3 GB of free memory. Placement packs the fullest host that fits, or the emptiest one with `spread = true`. A launch that cannot be placed becomes a waiting launch, shown in both inboxes, in Agents and in `cland session list` with its current reason ("waiting for a host", "waiting for host <id> to boot"). It is never an ask, and it is placed when room appears. Pools keep `min_hosts` (1 for `agents`), start hosts on demand up to `max_hosts` (2 by default), and stop an empty host after `idle_stop` (20 minutes) and the provider's billing minimum. A host with sessions stops only through `cland host stop <id>`. Each host has a 12-hour lease, renewed while it works. A detached watchdog deletes the host at the deadline even when the hub is gone, so stopping the hub does not stop the bill by itself. Failures follow fixed times. A host with no machine or SSH within 5 minutes is destroyed, and its launches keep waiting. A lost tunnel turns the Hosts row red at once, and General gets "host <id> unreachable" after 3 minutes. After 15 minutes the host's sessions end as exited and the host is destroyed. A host deleted outside cland makes its sessions exited. Money: the spend ledger now separates `hosts` from `verify`. `[hosts] daily_spend_usd` ($3 by default) is a sub-cap inside the verification cap. At 80 % General gets one line a day. At 100 % no new host starts, and live hosts keep running. `cland host status` shows each pool's hosts, slots and spend for today and the month, and each host's size, region, uptime, sessions and price. `cland host create <pool>` creates a host by hand.
- **E-1535 Logins.** Harness sign-ins on hosts are logins, a resource the scheduler hands to hosts and takes back. A disk login is one Claude Code, Codex or OpenCode sign-in, made by the harness's own flow on a 1 GiB provider volume. cland mounts that volume for the harness and never reads it. The volume is kept for good: it detaches at host stop and re-attaches at the next bind, so the next host reads the newest sign-in. Snapshots are backups, taken after a sign-in and at most daily, with the last two kept, and a host stop never waits on one. Claude Code and Codex logins are exclusive by default, one host at a time. `cland login set <name> --exclusive false` lets other hosts read from the latest snapshot without writing back. A login belongs to its volume's region. A key login is a static key, the OpenCode key in 0.4.0. It is read from stdin or a hidden prompt, stored AES-256-GCM in `.cland/auth`, and given to a session only in its spawn environment, on any number of hosts. A key login for Claude Code or Codex is refused, naming 0.4.x. A pool grows only while its scarcest harness has a free login. A launch blocked on logins waits as "waiting for a login <harness>", and the human gets one "Not enough <harness> logins. Create one?" card per wait. `cland login add <harness> --pool <pool>` runs the harness's own sign-in over `ssh -t` in the human's terminal. From the web and the remotes the same sign-in is a card with its link and code, and Claude Code's pasted code goes back through the card's answer. Nothing cland starts ever runs a logout. When a harness reports a dead login, the login is marked signed out. Placement skips that host for that harness, sessions already there keep running, and a "sign in again" card goes out. `cland login signin <name>` signs in again on the same volume. A second sign-out of one account within a day adds the hint "This account seems to allow one sign-in: set exclusive or add an account." Codex keeps one login in use at one place per ChatGPT account, the Mac included, and the docs warn about it. `cland login list` shows each login with the capacity per pool and harness. `cland login remove` is refused while the login is in use, and `cland login snapshot` takes a backup. At start the hub frees a login whose host is gone. The ADR and spec amendment records that cland stores the keys the human enters and the metadata of disk logins, and never reads a login disk or keeps a harness's session tokens.
- **E-1536 Users and sign-in modes.** A project chooses how the web admits people. Single mode, the default, is unchanged. `cland auth mode users` switches to users mode. It creates the first admin from git's `user.name`, signs out current browser sessions, and attributes the earlier history to that user. `cland auth reset` is the only way back: it keeps the users and revokes browser sessions and open invites. An admin creates a user with `cland user add <name>` or from the web and gets a one-time invite link, valid for 24 hours. `cland user invite <name>` replaces it. The invite page registers a passkey or a password of at least 12 characters, built on Node's own crypto with no new dependency. Messages, ask answers, approvals, pairings, web sessions and artifacts record who did them. Outcomes show who answered, deliveries to agents name the author, and the journal records the user of every human action. Every user is an admin in 0.4.0. The permission checks read the user's role from one table, so more roles later are rows. In users mode the CLI acts as the first user, and `--as <user>` acts as another. Each Telegram or Discord pairing belongs to one user. General reaches every paired user, and the first answer to an ask wins and shows the answerer on every copy. Everyone shares one inbox.
- **E-1537 Workbenches, doctor, setup and docs for hosts.** Both workbenches show a Hosts row per pool beside Remotes, such as "agents 2/4 hosts · 7/16 slots · logins claude 2/3, codex 1/1". It turns red at once for an unreachable host or a provider failure and expands to the host list. In the web it opens the hosts view, where hosts can be stopped and logins added, signed in again, snapshotted and removed. A sign-in's link and code show inline on the login's line. Neovim shows the row but has no login actions. Session rows name their host, and in users mode the launching user too. Waiting launches show their current reason in both inboxes. Attaching to a host session from Neovim runs the `ssh -t` attach. `cland doctor` checks the provider token's presence and fingerprint, each pool's image, free and signed-out logins, the hosts' reachability, the hosts' spend against the sub-cap and the sign-in mode with its user counts. Each warning carries its fix, and doctor makes no paid or provider call. `cland setup` gains two optional steps, both defaulting to No. The sign-in mode step comes after the hub. It waits for the first user's passkey, and Enter skips the wait. The agent-hosts step comes after remotes and before the Aide. It asks which roles go on the `agents` pool, with the Implementer preselected. The always-on host, the image build and each first login each get their own yes, naming the price, and `--yes` grants no paid consent. The onboarding tour has a stage on agent hosts. The site has two new pages, "Hosts, pools and logins" and "Users and sign-in modes". The first has a DigitalOcean price table checked on 2026-11-15: $0.07143 an hour for `s-4vcpu-8gb`, and the default $3 sub-cap buys about 42 host-hours. The web-and-phone page gains a multi-user sign-in section, and the CLI page lists the `cland host`, `cland login`, `cland user` and `cland auth` commands.
- **E-1538 Shape-B readiness.** Nothing changes on the Mac. The hub lock records the machine's identity and a heartbeat, so two hubs on one shared volume can never both hold it. Every file the hub keeps outside the project resolves under `XDG_STATE_HOME` or `HOME`. The web's session cookie is `Secure` whenever `[web] origin` is `https`, also on a navigation without an `Origin` header. Pools declare a transport, and `ssh` is the only accepted value: `outbound` is refused with a message naming 0.4.x. The droplet executor now confirms a droplet or key deletion with a read, and reaping retries until the machine is gone.
- **Also on `dev`, directly under R-1530.** Several fixes and gap-closers landed:
  - Two paired users in users mode, Discord's `/cland` commands, and first-answer-wins across both remotes now have tests (T-1650).
  - Native Codex and Claude Code sessions on a fake host that report a dead login now have end-to-end tests (T-1813).
  - Setup and doctor now report a role placed on a missing pool as `open` and `warn` with the fix, not `skip` (T-1860).
  - Setup's sign-in step reads `skip` in single mode when the hub is down (T-1866).
  - Host admission no longer refuses a valid DigitalOcean create when an unrelated lease changes the spend ledger (T-1862).
  - A droplet run retries a failed or stalled bundle upload instead of failing on the first try (T-1842).
  - A local merge-batch checkout gets its dependencies (T-1844).
  - Native host fixtures no longer leave socket folders in `/tmp` (T-1806). Closing a git daemon that has already exited no longer reports a failure (T-1854).
  - The merge queue no longer lands an interrupted batch after rerunning only its failing file: the files the interruption skipped must run green first (T-1760).
  - The Telegram pacing fixture waits for the hub's start with the shared load-scaled wait instead of a fixed second (T-1874).

  Load flakes that reddened suite runs were fixed: T-1845 to T-1847, T-1849, T-1851 to T-1853, T-1855 and T-1863.
- **E-1539 Release v0.4.0 from the item.**
  - T-1870 adds one scenario on the fakes for the paths no single epic covers. A login added from a card releases a waiting launch. A signed-out login is signed in again from the web while its host's sessions keep running. Two users answer and see each other's outcomes. A hub restart with two busy hosts loses nothing, and the sub-cap stops new hosts only.
  - The docs pages and the price table were checked against the build (T-1871).
  - The root `package.json` and the lockfile move to 0.4.0 (T-1872).

Decisions of the run:
- The human, 2026-10-31 (Q-1522): the human accepted the cut and its recommendations. The Coordinator leads, decides the crew and approves every epic plan, and the crew runs on Codex. QA runs every demo on the fakes. Provider tokens never reach hosts.
- The human, 2026-10-31: the live run before the release was to happen on this project with its real crew, and the pool and logins were to stay configured afterwards.
- Coordinator, 2026-11-03: E-1536 closed with the second paired user's press on a card inferred from source, so T-1650 moved into R-1530 as a release blocker. It landed.
- The human, 2026-11-12 (ask 81a9293a): setup asks which roles to place on `agents`, with the Implementer preselected. Each paid step gets its own yes, default No, naming its price, and `min_hosts = 1` stays. The web shows a sign-in's link and code inline on the login's line, and the same card stays in the inbox and on the remotes. Setup waits for the first user's passkey, and Enter skips the wait, leaving the step open with `cland user invite <name>`.
- Answered for the human, 2026-11-12: the native Codex and Claude Code dead-login cases moved into R-1530 to land before the release (T-1813).
- The human, 2026-11-14: T-1846 (ask 96990fef) and T-1854 (ask d641172c) moved into the release.
- The human, 2026-11-15 13:06Z (ask f485cc38): the live run on real DigitalOcean hosts is not needed for 0.4.0. It was dropped, and its points are listed under "Not verified" below.
- Coordinator, 2026-11-15: T-1760 and T-1874 moved into R-1530 as release blockers. T-1760 let the merge queue land an interrupted batch; T-1874 failed the release's stage cover ed6d0724 in two of three full runs. Both landed.
- Choices the spec left as assumed, as built:
  - An invite lasts 24 hours.
  - Claude Code's sign-in code goes back through the card's answer.
  - The hosts view lives inside the web's Sessions area.
  - A role's `account` narrows which login a host binds.
  - `--as` must name a user in users mode and keeps its stand-in meaning in single mode.
  - The open point of re-signed tokens became the switch `hosts.relaunch_after_signin`, off by default. The live run was meant to settle it.

Deferred to 0.4.x (spec §4):
- the Fly provider;
- shape B as a whole: the image, the Helm chart, the `kubernetes` provider, the `outbound` transport, `attach-cluster` and the cluster docs;
- OIDC and SSO;
- roles beyond admin;
- serverless providers;
- several projects on one host;
- the tool's ties to this repository: suite planning gated on hard-coded `nvim/`, `web/` and hub prefixes, and the snapshot key hashing only `package-lock.json`.

Not verified:

The human dropped the live run on real DigitalOcean hosts for 0.4.0 on 2026-11-15 (ask f485cc38). Everything below was verified only on the fake host provider, a fake DigitalOcean API and the fake transport, with hosts as processes on one machine. None of it was verified on real hosts:
- the boot-to-ready time of a real host on its pool image;
- Claude Code, Codex and OpenCode sign-ins on real hosts, from the terminal and from a card on the phone;
- the open points of Q-1520 §3 and Q-1522 §3: whether a live Claude Code or Codex process picks up re-signed tokens without a relaunch (`hosts.relaunch_after_signin` stays off);
- whether the Mac stays signed in to Codex after a Codex sign-in on a host;
- the Codex weight of 0.5, measured on a real host;
- a live hub restart under load with sessions on real hosts;
- idle stop, with the login volume detached and re-attached at the next bind;
- real spend in the ledger: host reservations, settlements and the sub-cap against DigitalOcean's bill;
- login-volume reconciliation at hub start after a watchdog deletion;
- sessions of a destroyed host becoming exited;
- Kubernetes (shape B), which ships in 0.4.x. 0.4.0 carries only the hub changes it needs (E-1538).

Neither the fakes nor any real run covered these:
- The real DigitalOcean API for hosts and volumes: creates, pacing, refusals, tag reaps, volume attach and detach, and snapshot windows. `cland host prepare` building a real pool image is not covered either. The executor's droplet snapshot, built from the same recipe and this project's provision hook, did run the build's suites on real droplets.
- The tunnel over a real network to a real sshd: reconnects, the 3- and 15-minute outage rules, and `cland session attach` over `ssh -t`.
- Passkeys on a real phone or browser authenticator: the tests used headless Chromium's virtual authenticator. Users mode on real Telegram and Discord: the tests used the test messengers.
- Four of E-1537's journeys were shown with substitute evidence, because no driver for them ships yet (T-1868): both workbenches against sessions on two hosts, logins added and removed from the web, one setup run through both new steps, and the combined doctor.

Known issues, in Bugs (C-325) and Tech debt (C-216), all filed during this release:

Hosts, logins and security:
- T-1705: a role session's login shell can read `DIGITALOCEAN_TOKEN` when the human's shell startup file exports it. Until the fix, export the token only in the shell that starts the hub, not in `~/.zshrc` or another startup file;
- T-1858: setup's paid offers re-read the pool terms after the yes and stop if they changed, but a narrow window remains;
- T-1869: `cland host destroy` returns about 10 seconds before the host's watchdog exits, with no cost or leak;
- T-1672: renaming an OpenCode session on a remote host moves its config folder on the Mac, not on the host;
- T-1688: the host agent can read a live process as exited when `/proc` hides other users' processes;
- T-1697: two close host-agent checkpoints can collide on one temporary file name;
- T-1802: the login-disk helper refuses a repeated thaw of a disk that is already thawed;
- T-1859: a droplet run stops on a region's "size not available" instead of trying the next region.

Sessions, the hub and the remotes:
- T-1812: a spoke that starts while the hub is down never connects, even after the hub is back;
- T-1679: session recovery can resume a renamed or replaced session from a stale snapshot;
- T-1651: after the Coordinator's harness reconnects, the hub can replay deliveries it already handled;
- T-1764: one pending sub-agent permission prompt sends a new Telegram approval card at every turn of the Coordinator;
- T-1864: `artifact.create` with very large inline content times out after 300 seconds with an unknown outcome;
- T-1857: a long verify result cuts off its executor, lifetime and cost line;
- T-1843: a finished suite with no lease can keep holding a remote slot across hub restarts;
- T-1856: a hub stop cannot cancel a hung `git worktree prune`;
- T-1876: `cland release` reports a bare "gh auth failed (ENOENT)" when the hub's PATH lacks `gh`. Start the hub with Homebrew's bin on its PATH.

Tests and contributors:
- T-1861: `cland qa lint` reads a per-test docs path (`.test.ts.md`) as a missing test file;
- T-1865: the one-off cleanup of historical fixture leftovers in `/private/tmp` waits for positive proof that they are unused;
- T-1867: the closed-item wording lint skips `.mdx` site pages;
- T-1868: QA has no drivers yet for the host and user end-to-end journeys;
- T-1875: the card-web Telegram fixture keeps fixed 1 s inner waits until the shared test client can cancel them;
- T-1805 and T-1676: test fixtures leave owner registries, fallback sockets and Codex placeholder sockets in TMPDIR, and one registry names the live source worktree;
- known load flakes in suite runs: T-1641, T-1642, T-1643, T-1648, T-1695, T-1731, T-1736, T-1758, T-1761, T-1798, T-1841 and T-1873.

In all, 56 items are open in Bugs and 26 in Tech debt.

The retrospective artifact of the run follows the release and will be linked from R-1530.

## Comments

### human · 2026-10-31T18:23:30.372Z

## Handover from the planning session (2026-10-31)

The planning package of v0.4 is complete: docs/spec/v0.4.md (Status complete), the glossary's Hosts section and amended terms (commit 650fa8df4), and the nine epics E-1531 → E-1539 with their blocked-by and follows edges. Map M-1511 holds every decision (rounds 1–9, research Q-1513–Q-1516, prototypes Q-1517 and Q-1518, grillings Q-1519–Q-1522 and Q-1527). Research notes live on research/host-providers (359d08df), research/harness-credentials (87db57e2), research/host-transport (9aac93c0), research/kubernetes-shape (b7f82197); the prototype on prototype/agent-host (7f7ecb0f; hub/src/host/README.md with the host and login decisions). None of these branches is merged, ever; the build may read the prototype's code.

Build order and lanes: E-1531 → E-1532 → E-1533 → E-1534 → E-1535 (hub lane, follows); E-1536 in parallel from the start; E-1538 after E-1531 in parallel; E-1537 after E-1534 and E-1535, its users stage after E-1536; E-1539 last. The Coordinator decides the crew and approves every plan; QA on the fake host provider and the fake transport; no real droplet, volume or key in tests; one live run with the human before the release (E-1539). The build starts on the human's word.

### human · 2026-10-31T18:33:55.436Z

Human decision (2026-10-31): the live run before the release happens on THIS project (cland/v0) with its real crew, as 0.3 did for the remotes; the host pool and the logins stay configured afterwards. The sandbox project serves the build's own tries before that. The spec §4 and E-1539 are updated accordingly.
