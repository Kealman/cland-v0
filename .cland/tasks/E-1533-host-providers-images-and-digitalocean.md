---
id: E-1533
kind: epic
title: Host providers, images and DigitalOcean
state: open
labels:
  - epic
  - v0.4
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by:
  - E-1532
follows:
  - E-1532
topic: null
branch: null
created: 2026-10-31T18:22:03.678Z
updated: 2026-10-31T18:22:33.628Z
---

## Goal

The hub can create real agent hosts. A host provider interface beside the Executor creates, prepares, reports and deletes machines, declares their prices and limits, and offers volumes for login disks. DigitalOcean is the first provider, reusing the executor's token, API client, tags and snapshot code. One image recipe now builds the executor's droplet snapshot, the agent host image and, later, the Kubernetes image. It holds only what cland needs on any project, and a project's own system packages go through a new root provisioning hook. Hosts boot from a pool image snapshot that `cland host prepare` builds, so a host is ready in 60 to 90 seconds instead of 218 to 232. The suite gains a fake host provider, so the scheduler epics never touch a real cloud. The provider research and the host prototype fixed the choices (Q-1513, Q-1517) and the image audit of 2026-10-31 fixed the image contents.

## Contents

- **The host provider interface** (spec §3.4). Acquire, prepare, status, release and reap, mirroring `hub/src/executor/executor.ts`, plus the transport a host is reached by and the volume operations for login disks: create, attach, detach, snapshot and delete. It is a separate interface, not an executor kind. Demo: the fake host provider passes the provider's contract tests.
- **Provider declarations** (§3.4). Price per live and idle hour from the provider's own size listing, whether a stopped machine bills compute (then stopping destroys), billing granularity and minimum, token confinement, API pacing, machine limit, architecture, and an extra paid address for SSH. Demo: `cland host status` on the fake provider shows the declared prices, and a declared minimum keeps `idle_stop` from stopping a host sooner.
- **The DigitalOcean provider** (§3.4). Droplets in lon1 by default (fra1 and ams3 allowed), tagged `cland`, the project and the pool; reaping by tag; prices from `/v2/sizes`; pacing within 250 requests a minute and the account's machine limit, with a refused create pausing with a retry; the token from the hub's `DIGITALOCEAN_TOKEN` as the executor reads it; volumes for login disks through DigitalOcean Volumes. Demo: against a fake DigitalOcean API in the suite, a create, a 429 with a retry, a tag-based reap and a volume attach and detach.
- **Deletion confirmed by a GET** (§3.4). Every deletion of a droplet, key or volume is read back; a DELETE 404 alone is not success. Demo: the fake API answers a DELETE with 404 while a GET still answers 200, and the provider reports the resource as not deleted.
- **One image recipe** (§3.4). `provision.sh` split into what cland needs on any project (Ubuntu with apt timers off, git, curl, ca-certificates, jq, lsof, procps, xz-utils, locales, the hub's exact Node version, the `runner` user, build-essential and python3) and, for agent hosts, the harness installers on pinned channels (OpenCode 2 from `https://opencode.ai/v2/install`), with the CPU architecture as a parameter. Neovim and the Chromium runtime libraries leave the recipe. Demo: the rendered recipe for x86_64 and for arm64 names the right Node download and contains no Neovim or Chromium package.
- **The project provisioning hook** (§3.4). `[verification] provision` names a script run once as root on the image builder, before `prepare`. This project's hook installs its Chromium runtime libraries and its pinned Neovim, so the executor's droplet snapshot keeps passing this project's suites. Demo: the executor's prepare on the fake provider runs the hook as root before `prepare` as `runner`, and the snapshot key changes when the hook's content changes.
- **Pool images and `cland host prepare`** (§3.4). A pool image snapshot built by the recipe and `[verification] prepare`, keyed from the Node version, the lockfile, the harness versions and the hook's content, rebuilt by `cland host prepare [<pool>]`; a host boots from the current image. Demo: `cland host prepare` reports `current` when nothing changed and `prepared` after a harness version changes.
- **The host prelude** (§3.4, §3.2). User-data that installs the pinned host key and the sshd settings (`StreamLocalBindUnlink yes`, `ClientAlive` 15×4, `MaxSessions 32`), deletes DigitalOcean's `99-digitalocean-automount.rules`, and installs the login-disk helper `cland-auth` with its sudoers line (used by "Logins"). Hosts carry no stray `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `OPENAI_API_KEY`, `CODEX_API_KEY` or `CODEX_ACCESS_TOKEN`, and Codex's `config.toml` sets `cli_auth_credentials_store = "file"`. Demo: the rendered user-data contains each setting and no hub secret or provider token.
- **A host from create to ready** (§3.2, §3.4). Create from the pool image, wait for the pinned key, start the supervisor and the host agent, open the tunnel, clone the territory: the `ssh` Host of the previous epic on a provider's machine. `cland host list` and `cland host destroy <id>`. Demo: on the fake provider a host goes from create to ready, its first session runs, and `destroy` removes it with its key, confirmed by reads.
- **The fake host provider** (§3.13). The provider interface over fake-transport hosts, with configurable boot time, failures, prices and volume behaviour (one attachment at a time, a snapshot rate limit). Demo: the scheduler's tests in the next epic run on it.

Not in this epic: pools, placement, idle stop, leases and money ("Pools, placement and the scheduler"); login disks' use ("Logins"); the executor's own DELETE 404 fix ("Shape-B readiness"); Fly Machines and serverless providers (0.4.x).

## Order

1. **The interface, the declarations and the fake provider.** Demo: the contract tests pass on the fake provider.
2. **DigitalOcean against a fake API.** Create, pacing, tags, reap, volumes, deletion confirmed by a GET. Demo: the 429 retry and the DELETE 404 case.
3. **The image recipe and the provisioning hook.** The split, the architecture parameter, this project's hook with Chromium libraries and Neovim. Demo: the executor's snapshot still passes this project's suite on a droplet run.
4. **Pool images and the prelude.** `cland host prepare`, the key, the user-data. Demo: `current` and `prepared` as above; the user-data checked.
5. **Create to ready.** A host from the fake provider through the tunnel to its first session; `cland host list` and `destroy`. Demo: as above.

## Definition of done

QA runs the demo below on `dev` through the `cland` CLI and the hub's frame protocol, with the fake host provider and a fake DigitalOcean API in the suite, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. No real droplet, volume or key is created; the executor's droplet snapshot is checked by the build's ordinary droplet runs.

In a scratch project QA configures a pool on the fake provider, runs `cland host prepare` twice and reads `prepared` then `current`, changes a harness version and reads `prepared` again. It creates a host, reads it in `cland host list` with its declared price, launches a session on it, then destroys it and reads the confirming reads in the log. Against the fake DigitalOcean API it makes a create answer 429 and reads the retry, makes a DELETE answer 404 while a GET answers 200 and reads the provider refusing to call it deleted, and reaps by tag. It reads the rendered recipe for x86_64 and arm64, the user-data, and this project's provisioning hook, and checks the latest droplet suite run on `dev` is green with the new snapshot.

- [ ] C1. The host provider interface mirrors the executor's operations plus the transport and volume operations, and the fake provider passes its contract tests.
- [ ] C2. Each provider declares live and idle prices, whether stopped machines bill, billing minimum, token confinement, pacing, machine limit, architecture and extra addresses, and `idle_stop` respects the minimum.
- [ ] C3. The DigitalOcean provider tags hosts with `cland`, the project and the pool, reaps by tag, paces its API calls, and retries a refused create without a cascade.
- [ ] C4. Every deletion is confirmed by a GET, and a DELETE 404 with a live GET is reported as not deleted.
- [ ] C5. One image recipe with an architecture parameter holds only cland's needs, and Neovim and the Chromium libraries are installed by this project's `[verification] provision` hook.
- [ ] C6. `cland host prepare` builds a pool image keyed from Node, the lockfile, the harness versions and the hook, and reports `current` when nothing changed.
- [ ] C7. The host prelude pins the host key, sets sshd's socket and keepalive settings, removes the provider's volume automount and installs the login-disk helper, with no hub secret or stray API key on the host.
- [ ] C8. A host goes from create to ready on its pool image and runs a session, and `cland host destroy` removes it and its key.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub. Commit on the task branch, push to `origin`, reach `dev` only through `cland merge`; only `cland release` pushes to GitHub. Suites run through `cland verify`. Items through `cland task` only.
- **The hub's code.** TypeScript on Node 24 under the hub's tsconfig. No new runtime dependency; the DigitalOcean client stays hand-written on `fetch` as the executor's is.
- **Tests.** Test first (`tdd`) on the fake provider and a fake DigitalOcean API reached through an API-root override. No test creates a real droplet, volume, snapshot or key.
- **Money and tokens.** The provider token never leaves the hub's machine, never appears in argv, a log line, an error or an artifact, and never reaches a host or a session. Any manual check against the real DigitalOcean API spends under the project's daily cap, tags its resources `cland`, and confirms their deletion by listing.
- **The executor stays green.** Moving Neovim and Chromium into this project's hook must not break the executor's droplet runs; the snapshot key change triggers one rebuild.
- **Out of scope.** The suite planner's hard-coded prefixes and the snapshot key's lockfile-only hashing are tech debt for a later sweep (spec §4), not this epic.
- **The prototype.** `prototype/agent-host` at 7f7ecb0f is never merged; read `hub/src/host/hosts.ts` (the DigitalOcean provider), `host-root.sh` and `host-runner.sh`, follow the spec.
- **Plan.** The Coordinator drafts the plan with `plan-epic` and approves it itself (spec §4).
- **Order.** Third in the hub lane, after "The SSH transport, the host agent and git through the tunnel". "Pools, placement and the scheduler" follows it.

## References

- Spec: `docs/spec/v0.4.md` §3.4 (providers, images, the hook and DigitalOcean), §3.2 (the sshd settings), §3.13 and §4.
- Items: R-1530; the map M-1511, round 1 decisions 2, 6 and 7, and the image-audit amendment; Q-1513; Q-1517 (decisions 11, 12, 17 and 19, boot timings); Q-1518 (the automount and helper frictions); Q-1519 §2 and §8.
- Research: `docs/research/host-providers.md` on `research/host-providers` (359d08df), sections 3, 4.1 and 7.
- Prototype, on `prototype/agent-host` at 7f7ecb0f: `hub/src/host/README.md` (boot to ready, decisions 11, 12, 17 and 19), `hosts.ts`, `host-root.sh`, `host-runner.sh`, `watchdog.ts`.
- Code: `hub/src/executor/executor.ts`, `hub/src/executor/droplet/{api,droplet,machine,prepare,lease,cleanup}.ts`, `provision.sh`, `shared/executor-credentials.ts`, `hub/src/init/config.ts` (`[verification]`).
- GLOSSARY: Host provider, Host (added for v0.4); Executor and Lease (amended for v0.4).
