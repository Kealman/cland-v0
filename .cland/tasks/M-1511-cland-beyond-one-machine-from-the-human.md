---
id: M-1511
kind: map
title: "cland beyond one machine: from the human's direction to spec v0.4, prototypes of agent hosts and credentials, and the epics"
state: open
labels:
  - wayfinder:map
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-31T14:35:06.562Z
updated: 2026-10-31T17:09:25.360Z
---

## Destination

The spec `docs/spec/v0.4.md` "cland v0.4: beyond one machine", its glossary entries and the epics under the 0.4 release item, handed to the Coordinator. The thing it describes: agent sessions running on pools of remote hosts while the hub stays on the human's machine (shape A, ships in 0.4.0), and the whole hub running server-side on Kubernetes (shape B, designed in the same spec, built in 0.4.x), on one Host abstraction beside the existing Executor. Verification runs stay a separate executor concern on powerful machines; agent hosts are small, sized by measurement.

## Notes

- Domain: cland's hub (Node 24 TypeScript). Closest prior art: the droplet executor (hub/src/executor/**: acquire/prepare/deliver/start/status/log/cancel/release/reap, SSH + git bundle, snapshot keyed by Node/Neovim/lockfile, spend ledger, detached watchdog, reap by tag). Session launch and the ties to the hub's machine: hub/src/adapters/{sessions,claude-code,codex,opencode}.ts, hub/src/spoke/spoke.ts (ws://127.0.0.1 hardcoded, reads hub.json and hub.db), hub/src/hub/socket.ts, territory.ts (worktrees in .cland/worktrees, origin = .cland/territory.git), accounts/registry.ts (one path variable per harness). ADR 0003 (spokes on loopback, only the web edge binds a network address), ADR 0004 (territory is a local bare repo), spec v0.1.2 §3.13 (cland reads no credential store) and §3.14 (own orchestration, not SSH-assuming interface).
- Skills: research tickets call `research`; prototypes `prototype`; grilling `grilling` and `domain-modeling`; the spec `to-spec`; the epics `to-tickets`. Dialogue with the human in Russian, every artifact in English.
- Standing preferences: price first (cheapest hosts that work), universal where cheap, DigitalOcean as the first provider because its token flow exists; QA on fakes with one live run before release; real provider tokens never leave the hub's machine; research and prototype branches are pushed to `origin` only and never merged.

### Round-1 decisions (2026-10-31, all accepted)

1. One spec for both shapes; A in 0.4.0, B in 0.4.x.
2. The unit of remoteness is a host (a Linux machine running several sessions), with an abstract host provider; a serverless container per session is a later provider.
3. The hub connects to a host over SSH (as to droplets) and keeps a reverse tunnel; a host agent (`cland host serve`) on the host spawns harnesses, checks liveness, serves files and limits; spokes, hooks and the CLI on the host still see the hub on 127.0.0.1 through the tunnel. Outbound WSS from the host agent is the extension for providers without SSH.
4. Code flows as git through the tunnel in both directions: the hub serves `.cland/territory.git` over `git daemon` on loopback, the host fetches and pushes task branches; merge, queue and verify stay in the hub. Bundles only as a fallback.
5. (superseded by round 3) Credentials are not logged in per host.
6. One image recipe (provision.sh + `[verification].prepare`) for the droplet snapshot, the agent host image and the Kubernetes image.
7. Research compares host providers by price for a live host and for idle (DO small droplets, Hetzner, Fly Machines, serverless containers, managed Kubernetes) and measures the real per-session footprint of each harness; DO first, Hetzner or Fly second by the numbers.
8. Hosts start on demand and stop after idle with their disk kept where the provider bills stopped machines less; the spend ledger and the daily cap gain a separate line for agent hosts.
9. `[role.launch] host`/pool placement per role; Coordinator and Aide local by default in shape A; any role, the Coordinator included, can be placed on a host.
10. Attach wraps the harness attach command in `ssh -t`; the web terminal stays deferred; in shape B the web and the messenger remotes are the main surfaces.
11. Shape B: hub as a one-replica Deployment with a PVC for `.cland` (SQLite unchanged), sessions as processes in agent-host pods, web through an Ingress with TLS, territory on the PVC, tests on droplets or a second executor on a node group; no multi-tenancy, no hub replicas.
12. Out of scope for 0.4: web terminal, macOS hosts, several projects on one agent host, one host for both tests and agents, autoscale from the queue, model-cost accounting.

### Round-2 decisions (host anatomy, all accepted)

1. A Host interface with `local` and `ssh` implementations takes over everything the hub does to a session's files and processes: spawn with env and cwd, liveness by pid and `claude agents --json`, cwd stat, `git worktree add/remove` and the node_modules symlink, artifact bytes by path (through `artifact.upload`), "who stands inside a worktree", limit polls.
2. Harnesses and the host agent run detached and survive hub death, tunnel loss and hub restart (systemd unit in the image); on reconnect the hub re-establishes the tunnel, spokes reconnect by re-reading hub.json, the host agent reports its process table, `harness_processes` gains a `host` column; a rebooted host means exited sessions and vacated roles.
3. The host's work disk holds a clone of the territory, worktrees and a root node_modules for symlinks; the host agent fetches the task branch and runs `worktree add`; the task branch is pushed to the territory on every commit; `cland verify` from a host session goes through the tunnel and the hub takes the branch from the territory, not from cwd.
4. Sessions run targeted tests, typecheck and the CLI on the host; full runs only on droplets through the hub; no load limiter in 0.4, only CPU and memory in the host status.
5–8. (superseded by round 3: the single auth volume) 
9. Hub secrets (DO, Telegram, Discord, ElevenLabs) never reach a host; a host gets only its lease SSH key and the tunnel secret; in shape B they live in secrets.toml on the hub's PVC and env from a Kubernetes Secret.

### Round-3 decisions (several hosts per project, all accepted)

1. Pools in config: `[hosts.<pool>]` with provider, size, region, sessions per host, min_hosts, max_hosts, idle_stop; `[role.launch] pool` per role, default `local`; hot-reloaded, `cland config set hosts.<pool>.max_hosts N` scales at once.
2. Placement: dense packing by default (the fullest host with a free slot), even spread as a pool flag; no slot and no room for a host → the launch waits in a visible hub queue ("waiting for a host"), the Coordinator sees it in Agents.
3. A task's worktree lives on the host of its session; relaunch elsewhere re-fetches the pushed branch and re-adds the worktree; uncommitted edits are lost as today; reviewers read branches from the territory on any host; a lead and its implementer need not share a host.
4. Scale down: an empty host stops after idle_stop, never below min_hosts; a host with sessions is never stopped by the scheduler, only by `cland host stop <id>`; the hub-side watchdog deletes a host at its lease deadline (about 12 h, renewed while sessions run) even if the hub dies.
5. Credentials principle: one login, replicated to N hosts, no volume. The hub keeps an opaque encrypted credential store per account (a harness home archive or a long-lived token); at host start the archive is unpacked into a tmpfs and passed through CLAUDE_CONFIG_DIR/CODEX_HOME/OPENCODE_DB; it vanishes with the host. cland never parses the contents.
6. Per harness: Claude `setup-token` (one-year inference-only OAuth token, limits then come from live sessions) is the candidate; Codex subscription auth.json rotates refresh tokens and is documented as one per machine, so research plus a two-host prototype decide between copy, API key and a login per host; OpenCode has `auth export/import`.
7. `cland host login <account>` runs device-auth on a temporary host, the host agent packs the result into the store; on expiry (Claude signed-out, Codex 401) the hub marks the account, stops new launches on it, sends a "sign in again" card, the re-login refreshes the store, live hosts get the update in place; an account whose archive rotates on use is pinned to one host at a time by the scheduler.
8. The store lives in `.cland/auth/` encrypted with a key from `.cland/secrets.toml` (shape A) or on the hub's PVC with the key from a Kubernetes Secret (shape B); no object-storage backup in 0.4.
9. Accounts bind to roles as today; a host receives the archives of the accounts of the roles placed on it; limited and signed-out marks act on launches regardless of host; no automatic rotation across accounts.

### Round-4 decisions (logins as a resource, 2026-10-31, all accepted)

Round-3 decisions 5–9 are replaced by these.

1. **Login** is an abstraction: one sign-in to a harness, recorded in hub.db as `[logins.<name>]` with harness, account (the human's subscription), kind (`disk` for session logins, `key` for static keys), `exclusive` (true: at most one host at a time, the default for Claude and Codex; false: the snapshot may be mounted on several hosts, no write-back, the human's responsibility), provider and snapshot id, state (`creating`, `ready`, `in-use <host>`, `signed-out`), last successful sign-in. The Mac's own logins are outside cland.
2. `disk` logins live on a small provider volume (about 1 GiB) mounted into the host; cland never reads its bytes. On host stop the volume is snapshotted (fresh tokens) and detached, the login becomes free; the last two snapshots are kept. DO Volumes, Fly Volumes, Kubernetes PVC per login (RWO gives exclusive naturally); providers without disks support `key` logins only.
3. `cland login add <harness> [--name]` (also from the web and the remotes by card) boots or reuses a host, creates an empty login disk, opens the harness's own sign-in over `ssh -t` in the human's terminal (link and code in a card for the web and the phone), snapshots on success, marks `ready`. Logins can be created ahead of pool growth.
4. A host needs one free login per harness of the roles placed on it; the scheduler picks it, creates the volume from the snapshot, mounts it, and releases it at stop. Effective pool capacity = min(max_hosts, free logins of the scarcest harness); a launch blocked on logins shows "waiting for a login <harness>" in the queue, the Coordinator sees it in Agents, the human gets a "not enough logins, create one?" card; `cland host status` and the workbench row show hosts and logins in use.
5. A dead login reported by the harness (Claude `authentication_failed`, Codex `refresh_token_reused`/401, OpenCode `provider.auth`) marks the login `signed-out`, blocks new sessions on that host, and sends a "sign in again" card that re-runs the sign-in on the same host and disk. A second `signed-out` of one account within a day triggers the hint "this account seems to allow one sign-in: set exclusive or add an account".
6. cland stores only metadata and snapshot ids for `disk` logins; `key` logins (OpenCode Go, API keys) are stored encrypted in `.cland/auth/` with the key from `.cland/secrets.toml`, entered by the human through stdin as `cland secret set` already does; an ADR amendment records that cland stores keys the human hands it but never reads a harness's session credentials.
7. The credentials prototype (Q-1518) tests the disk mechanics with OpenCode and a fake harness, not copies of real logins; real accounts are signed in once each where production needs it (Claude during the host prototype's sizing; Codex at a moment the human picks with no Codex crew sessions running, then a day of watching the Mac).

## Decisions so far

- [Host providers and their prices for agent hosts](Q-1513): DigitalOcean droplets first (reuses the executor's token, snapshot and ledger; destroy on idle, keep a snapshot or volume), Fly Machines second (stopped bills storage only, no systemd), Hetzner cheapest but unorderable, serverless 2–12× and without SSH; Mac footprint 250–550 MB per Claude session, 150–250 MB per Codex session; 2 vCPU/4 GB ≈ 3–4 sessions.
- [Harness credentials replicated across hosts](Q-1514): no subscription login survives copying to concurrent hosts (rotating refresh tokens); Anthropic's terms bar storing or intermediating Claude.ai credentials, so round-3 decision 5 is reopened in Q-1520; compliant Claude default is a login per host over `ssh -t`; Codex Pro: a pinned copy with write-back or device-auth per host; OpenCode: copy the static key.
- [SSH tunnel, git daemon and host-agent transport facts](Q-1515): one SSH ControlMaster per host owned by the hub with its own reconnect loop; every host endpoint a Unix socket (new spoke socket edge, git daemon --inetd per connection over a per-host socket, hub.sock, agent.sock); harnesses outside the host agent's cgroup; attach by a separate `ssh -t`; the territory guard env must be stripped from the daemon.
- [Shape B: the hub in Kubernetes, requirements and costs](Q-1516): works with nine hub changes; cheapest k3s on one Hetzner CX33 (€8.99/month), DOKS $62, GKE ≈ $80–141; the hub is a one-replica StatefulSet (amends round-1 decision 11); the hub lock needs a host identity and heartbeat; the hub creates agent pods itself as a provider; web through Traefik + cert-manager (ingress-nginx retired); CLI and Neovim via `kubectl exec`.

- [Prototype: an agent host on a small droplet with the hub tunnelled in](Q-1517): the whole shape-A path works on a $0.036/h droplet (tunnel, git daemon, sessions, artifacts, attach, survival of hub restart and tunnel loss, packing, idle_stop, watchdog); no systemd needed; defaults 4 sessions per 2 vCPU/4 GB and 8 per 4 vCPU/8 GB; Claude 510–600 MB, OpenCode 345–437 MB per session on Linux; cold boot ~3.6 min; Ctrl+Z ends attach; 13 decisions in the README.

- [Scheduler, pools and host lifecycle in detail](Q-1519): weighted slots (Claude 1.0, Codex 0.5, OpenCode 0.75; 8 on the default s-4vcpu-8gb), image snapshots per pool with `cland host prepare`, min_hosts 1 for agents, idle_stop 20 min, lease 12 h with the watchdog, failure rules (5 min boot, 3 min unreachable line, 15 min exit), Hosts row and queue lines, `hosts` ledger category with a $3 sub-cap, Coordinator and Aide local, a task stays on one host, provider interface mirrors the executor with a separate transport layer, nine prototype findings adopted.

### Amendments from research

- Round-1 decision 11: StatefulSet, not Deployment.
- Round-2 decision 2: the host agent and the harness supervision must not depend on systemd (Fly and pods have none); systemd where present, a plain supervisor otherwise.
- Round-3 decisions 5–9: replaced by round 4 (logins as a resource).

## Not yet specified

- The host agent protocol in detail (frames, auth, versioning against the hub) and how `local` degenerates to in-process.
- Provider accounts and tokens for whichever second provider wins the price comparison (a HITL task once chosen).
- Shape B details beyond round 1 Q11: image build and publish, Helm chart or kustomize, SQLite on a PVC under one replica, how the human reaches the hub (web, remotes, `kubectl port-forward` for Neovim), how `cland` CLI commands reach a cluster hub, in-cluster git serving, secrets and the DO token for droplets from a cluster.
- Serverless container per session as a later host provider (outbound WSS host agent); what the Host interface must leave room for.
- Scheduler details after the sizing prototype: defaults for sessions per host, idle_stop, lease length, the queue's visibility in web and Neovim, the host rows in doctor and status.
- Cost accounting for hosts in the spend ledger and the daily cap; what the human sees.
- QA on fakes: a fake host provider and a fake SSH host in the test suite; the one live run before release.
- Docs and site pages: hosts, pools, login, Kubernetes install.

## Out of scope

- Web terminal, macOS hosts, several projects on one agent host, one host for tests and agents, autoscale from the queue, model-cost accounting (round 1 Q12).
