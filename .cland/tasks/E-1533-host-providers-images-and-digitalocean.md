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
topic: topic-1409
branch: null
created: 2026-10-31T18:22:03.678Z
updated: 2026-11-07T03:27:49.897Z
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

## Plan

```yaml
stages:
  - name: provider interface, fake provider, hook and prelude
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1706
      - - T-1707
        - T-1711
        - T-1712
      - - T-1708
      - - T-1709
      - - T-1710
  - name: DigitalOcean on a fake API, the recipe and pool images
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1713
        - T-1715
        - T-1717
      - - T-1714
      - - T-1716
      - - T-1723
      - - T-1727
      - - T-1704
      - - T-1670
      - - T-1733
  - name: create to ready
    qa:
      scope: full
      when: after-stage
    lanes:
      - - T-1719
      - - T-1718
        - T-1720
      - - T-1730
```

## Comments

### coord · 2026-11-04T09:59:05.254Z

Note for planning (coord, 2026-11-04, from T-1605): `remoteHostLayout` defaults `layout.node` to the literal `node`, so a registered host resolves Node through PATH. That is correct only while the host image's PATH Node is the hub's exact version, as the v0.4 spec's image recipe guarantees. When E-1533 builds images and provisioning, it should record an absolute Node path in the layout, or refuse a layout whose Node version differs from the hub's at admission. T-1605 pins every registry-created transport to `layout.node` and proves the generic SshOptions fallback is never used for registered hosts.

### coord · 2026-11-04T14:54:44.260Z

Planning note (coord, 2026-11-04, from T-1666): host remove and destroy are not implemented today. Only revoke exists (`host.revoke`, `HostRecords.revoke`). T-1666 builds the pre-cut settlement of session generations as one reusable, bounded operation; E-1533's remove or destroy path must call it before cutting authority or destroying the machine, and report leftovers by name.

### qa-678 · 2026-11-06T20:34:07.638Z

verdict: qa
result: clear
by: qa-678 [qa]
run: qa-s1-2026-11-06-qa678-1
commit: 5795362b04395d88d08cdbb3069b16d38d4c5054
stage: provider interface, fake provider, hook and prelude
stage_hash: a16d1d4c9b5dad638b9e1fe100599cd1bc56c69d03a3420c3966c33fee5110c2
findings: [{"severity":"low","text":"E1533S1-36: T-1676 (Bugs, S) found aside; seven dead TMPDIR entries from executor-droplet/executor-prepare, zero open listeners, six receipt PIDs gone. Original census retained; coord-authorised literal cleanup and repeated census zero.","file":"hub/test/executor-droplet.test.ts"},{"severity":"low","text":"Brief omitted fresh per-command sealing/streaming redaction and the known-residue cleanup precondition from reused kit corrections. Both corrected in run copy with Coordinator authority; original blocks/captures retained, assertions unchanged.","file":"qa/briefs/E-1533-stage-1.md"}]
finding_counts: {"high":0,"medium":0,"low":2}

| Case | Surface | Result | Evidence |
| --- | --- | --- | --- |
| S0 | hub-api | PASS | [S0-setup.txt](S0-setup.txt), [S0-env.txt](S0-env.txt) |
| E1533S1-00 | hub-api | PASS | [E1533S1-00.txt](E1533S1-00.txt) |
| E1533S1-01 | hub-api | PASS | [E1533S1-01.txt](E1533S1-01.txt) |
| E1533S1-02 | hub-api | PASS | [E1533S1-02.txt](E1533S1-02.txt) |
| E1533S1-03 | hub-api | PASS | [E1533S1-03.txt](E1533S1-03.txt) |
| E1533S1-10 | hub-api | PASS | [E1533S1-10.log](E1533S1-10.log), [E1533S1-10.check.txt](E1533S1-10.check.txt), [E1533S1-10-validation.json](E1533S1-10-validation.json) |
| E1533S1-11 | hub-api | PASS | [E1533S1-11.log](E1533S1-11.log), [E1533S1-11.check.txt](E1533S1-11.check.txt), [E1533S1-11-validation.json](E1533S1-11-validation.json) |
| E1533S1-12 | hub-api | PASS | [E1533S1-12.log](E1533S1-12.log), [E1533S1-12.check.txt](E1533S1-12.check.txt), [E1533S1-12-validation.json](E1533S1-12-validation.json) |
| E1533S1-13 | hub-api | PASS | [E1533S1-13.log](E1533S1-13.log), [E1533S1-13.check.txt](E1533S1-13.check.txt), [E1533S1-13-validation.json](E1533S1-13-validation.json) |
| E1533S1-14 | hub-api | PASS | [E1533S1-14.log](E1533S1-14.log), [E1533S1-14.check.txt](E1533S1-14.check.txt), [E1533S1-14-validation.json](E1533S1-14-validation.json) |
| E1533S1-15 | hub-api | PASS | [E1533S1-15.log](E1533S1-15.log), [E1533S1-15.check.txt](E1533S1-15.check.txt), [E1533S1-15-validation.json](E1533S1-15-validation.json) |
| E1533S1-16 | hub-api | PASS | [E1533S1-16.log](E1533S1-16.log), [E1533S1-16.check.txt](E1533S1-16.check.txt), [E1533S1-16-validation.json](E1533S1-16-validation.json) |
| E1533S1-17 | hub-api | PASS | [E1533S1-17.log](E1533S1-17.log), [E1533S1-17.check.txt](E1533S1-17.check.txt), [E1533S1-17-validation.json](E1533S1-17-validation.json) |
| E1533S1-18 | hub-api | PASS | [E1533S1-18.log](E1533S1-18.log), [E1533S1-18.check.txt](E1533S1-18.check.txt), [E1533S1-18-validation.json](E1533S1-18-validation.json) |
| E1533S1-19 | hub-api | PASS | [E1533S1-19.log](E1533S1-19.log), [E1533S1-19.check.txt](E1533S1-19.check.txt), [E1533S1-19-validation.json](E1533S1-19-validation.json) |
| E1533S1-20 | hub-api | PASS | [E1533S1-20.log](E1533S1-20.log), [E1533S1-20.check.txt](E1533S1-20.check.txt), [E1533S1-20-validation.json](E1533S1-20-validation.json) |
| E1533S1-21 | hub-api | PASS | [E1533S1-21.log](E1533S1-21.log), [E1533S1-21.check.txt](E1533S1-21.check.txt), [E1533S1-21-validation.json](E1533S1-21-validation.json) |
| E1533S1-22 | hub-api | PASS | [E1533S1-22.log](E1533S1-22.log), [E1533S1-22.check.txt](E1533S1-22.check.txt), [E1533S1-22-validation.json](E1533S1-22-validation.json) |
| E1533S1-23 | hub-api | PASS | [E1533S1-23.log](E1533S1-23.log), [E1533S1-23.check.txt](E1533S1-23.check.txt), [E1533S1-23-validation.json](E1533S1-23-validation.json) |
| E1533S1-24 | hub-api | PASS | [E1533S1-24.log](E1533S1-24.log), [E1533S1-24.check.txt](E1533S1-24.check.txt), [E1533S1-24-validation.json](E1533S1-24-validation.json) |
| E1533S1-25 | hub-api | PASS | [E1533S1-25.log](E1533S1-25.log), [E1533S1-25.check.txt](E1533S1-25.check.txt), [E1533S1-25-validation.json](E1533S1-25-validation.json) |
| E1533S1-26 | hub-api | PASS | [E1533S1-26.log](E1533S1-26.log), [E1533S1-26.check.txt](E1533S1-26.check.txt), [E1533S1-26-validation.json](E1533S1-26-validation.json) |
| E1533S1-27 | hub-api | PASS | [E1533S1-27.log](E1533S1-27.log), [E1533S1-27.check.txt](E1533S1-27.check.txt), [E1533S1-27-validation.json](E1533S1-27-validation.json) |
| E1533S1-28 | hub-api | PASS | [E1533S1-28.log](E1533S1-28.log), [E1533S1-28.check.txt](E1533S1-28.check.txt), [E1533S1-28-validation.json](E1533S1-28-validation.json) |
| E1533S1-29 | hub-api | PASS | [E1533S1-29.log](E1533S1-29.log), [E1533S1-29.check.txt](E1533S1-29.check.txt), [E1533S1-29-validation.json](E1533S1-29-validation.json) |
| E1533S1-30 | hub-api | PASS | [E1533S1-30.txt](E1533S1-30.txt) |
| E1533S1-31 | hub-api | PASS | [E1533S1-31.txt](E1533S1-31.txt) |
| E1533S1-32 | hub-api | PASS | [E1533S1-32.txt](E1533S1-32.txt) |
| E1533S1-33 | hub-api | PASS | [E1533S1-33.txt](E1533S1-33.txt) |
| E1533S1-34 | hub-api | PASS | [E1533S1-34.txt](E1533S1-34.txt) |
| E1533S1-35 | hub-api | PASS | [E1533S1-35.txt](E1533S1-35.txt) |
| E1533S1-36 | hub-api | PASS | [E1533S1-36-original.txt](E1533S1-36-original.txt), [E1533S1-36.txt](E1533S1-36.txt), [residue-inventory.json](residue-inventory.json), [residue-removal.sh](residue-removal.sh) |

Clear: E-1533 stage **provider interface, fake provider, hook and prelude** at `5795362b04395d88d08cdbb3069b16d38d4c5054`, run `qa-s1-2026-11-06-qa678-1`. All 32 scoped checks pass. No epic criterion marks were made.

QA ran on macOS 27.0.1 (Darwin 27.0.0) arm64, local executor, Node v24.21.0. The integrated typecheck passed. The 23 named files ran once each, serially, with 232 tests passed and zero failures, cancellations, skips or todos. Exact/subset generated names were validated independently of exit status; all top-level names and native TAP counters remain in the logs. The safety file has 15 top-level results and 17 tests including its nested shell/host cases. The macOS idle-sleep case ran and passed. No browser binary, Neovim process, real provider, SSH service, real harness, GUI, suite or stress load ran in this QA execution. Synthetic loopback provider APIs and native fake fixtures were exercised.

Admission checked the live verify queue and enforced one-minute load <=10 before each file. The explicitly prescribed preservation lock covered only targeted native files and was released after each. Plain node --test enforces neither duration allowances nor resource tripwires; recorded per-invocation wallMs excludes admission and includes child launch/stream drain. It is diagnostic, not a suite wall time or budget pass. Source-only checks do not claim execution of the real provisioning recipe.

Findings, ranked:

- **Low, found aside — T-1676 (Bugs, S):** row36 first read `T entries other than node-compile-cache: 7`. Exact per-invocation inventories attribute five dead spoke fallback sockets and five ownership receipts to executor-droplet.test.ts, and one socket/receipt to executor-prepare.test.ts. The six owner PIDs were absent and lsof found no open Unix entries under this run's TMPDIR. The original inventory and original row36 are retained. No hp-, hp-vol- or cland-auth-script- residue was present. Executor-droplet is unchanged by the stage; the executor-prepare landing diff concerns the hook/key checks, not cleanup. `hub/src/cli/hub.ts:327–328` registers receipt removal on normal process exit; this matches the known T-1676 cleanup defect, not an intentional-retention exemption. This source attribution is not a captured runtime call stack. Coordinator decision 7866d452-0141-4d9c-9bea-5033938bfa28 classifies it found aside and authorises the omitted cleanup precondition. After row35, only the seven inventoried literal paths in residue-removal.sh were removed; repeated row36 reads zero. No test file was rerun.
- **Low, brief defect — execution seal/redaction:** decision 118fbb6b-97c2-4783-831d-d9c4e4114d6c authorised a fresh shared-builder seal for each command, hub inputs inside the builder, an immediate credential-name gate, streaming capture redaction and login:false. Static env.sh/env-hub.sh execution was replaced; no copied credential filter follows the builder. Original blocks and corrected scripts/diffs are retained. Command arguments, assertions and expected values are unchanged. S0 proves zero credential-prefix names, exact permitted CLAND_ names, isolated HOME/TMPDIR, no real harness on PATH, Q=23 bytes and T=61 bytes.
- **Low, brief defect — final cleanup precondition:** Coordinator decision 7866d452-0141-4d9c-9bea-5033938bfa28 for row36 restores the known-residue handling omitted from the reused kit. Original failure of that precondition remains separate from the corrected final census and product results.

Recorder disclosure: S0 and rows00–03 have session `rescue` in their original recorder lines because the fixture seal removed the inherited session name and the recorder used its default. These were run by qa-678, not a rescue process. Later records explicitly set QA_SESSION=qa-678 through the builder. Originals were not rewritten; this metadata issue did not change captures, execution, case results or the hub verdict's QA identity.

Build and source evidence: brief lint passed at the full requested SHA; the reused kit blob is 4ed467672750bf34179ed72549df863d1541eddb. Stage plan had 7/7 merged, affected/after-stage, stage open. Each item had exactly one first-parent landing. HEAD and dev equalled the requested SHA before and after, detached dirty count0, root non-tracker status unchanged. Preservation file diffs and the seven landing test-path sets matched the brief. All source exact-string checks and the provider filesystem/path/crypto import closure matched. Generated contract variants were re-read from the build's source; required registered names passed. The inferred fresh hub, reload `applies now`, registry construction writing no fh entry and CLI help facts were observed as expected. T-1710 C2 was judged on the supplied test; later provider wiring T-1719 C7 remains outside this stage.

Scratch observations: init and hub start succeeded; the provision template comment/key was present; unknown, absolute and parent paths were refused; a relative path saved with `applies now`, refusal preserved it, and clearing restored the empty key. Registry refused missing/relative fake roots and unknown digitalocean, while the absolute scratch positive control returned ssh. Host help remained revoke/git-proxy/attach/serve only. Final hub stop succeeded, the recorded PID was absent, and no process named this scratch root or build.

Existing cover evidence, inspected rather than rerun:

- Linux ad7e8f92-428c-45d0-af8b-5c4140829acc, A-17195, full head `5795362b04395d88d08cdbb3069b16d38d4c5054`, tree 2c721e12ad362ab66c6658201e3285230981a1ef, droplet Linux x64 6.8.0-147-generic / Node24.21.0 / Neovim0.12.5. Two c-8 sfo2 shards completed T1–T4 and Web after the host check. Nine explicit platform/binary skips are in A-17195-provenance.json. Browser: Google Chrome for Testing156.0.8078.4, `/home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`. Shard admission-to-finish durations were2233.43s and1692.43s; artifact lifetime and cost remain **pending confirmation**, not zero. These are not confirmed billed lifetimes. Prior red2424aed9 and unexecuted255a9c8b are excluded.
- macOS1e5be530-46d3-4c51-b0cb-c5ad33e82dd8, A-17190, head e19c3496074a57d905683f2caf83c31ddb0a3e89, same verification tree; local Darwinarm64 27.0.0 / Node24.21.0 / Neovim0.12.5. T0–T4 and Web exit0. One Linux-only native-birth case skipped, explicitly named in A-17190-provenance.json. Browser: Google Chrome for Testing156.0.8078.4, root node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell. Local cost not applicable.
- Both cover artifacts label T4 repetitions skipped (base phase runs), and budgets/ratchets as report-only. They are not enforce-mode duration evidence. Plan cover names both receipts and has missing=[]; no cached result was reported. Full provenance and phase summaries are retained in the two JSON files. QA's own local run has no droplet lifetime/cost.

Rule proposal sent in this topic: reconcile any reused pinned kit block with the source brief's recorded run corrections; a matching blob alone is insufficient. Coordinator queued it for rule batch6.

Evidence publication uses the unchanged qa-demo-policy secret scanner with a positive control. Only declared evidence and source/run-copy helpers are exported, never scratch HOME, environment snapshots, hub config/credentials or cookies. Cleanup of the stopped scratch and detached worktree follows the recorded verdict.


Durable evidence: A-17199 — /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17199-e-1533-stage-1-qa-232-tests-and-32-checks-clear-at-5795362b/report.md

### qa-678 · 2026-11-07T03:27:33.972Z

verdict: qa
result: not clear
by: qa-678 [qa]
run: qa-s2-2026-11-07-qa678-1
commit: 08bf3e544b01c92ef823a24cf22fded489f8b115
stage: DigitalOcean on a fake API, the recipe and pool images
stage_hash: fe3efe736f538daa3f6d021c3a3773f423926c4949ae4a7654e04872e3dbee5b
findings: [{"severity":"high","text":"E1533S2-50 / T-1733: config set verification.provision setup.sh succeeds but silently deletes both hosts pool tables (1/1 to 0/0), losing user configuration. Original capture retained; dependent cases passed only after authorised fresh-project setup order correction.","file":"hub/src/init/config-set.ts","line":68},{"severity":"low","text":"E1533S2-58 / T-1676, Bugs S, found aside: six dead fallback sockets and seven dead owner receipts. Row35 producer is byte-identical to stage1 within a stage-edited file; PID42616 absent, receipt not open, fixture root gone. All residue dead and removed by authorised literal paths before clean repeated census.","file":"hub/test/claude-code-remote.test.ts","line":646}]
finding_counts: {"high":1,"medium":0,"low":1}

| Case | Surface | Result | Evidence |
| --- | --- | --- | --- |
| S0 | hub-api | PASS | [S0-setup.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/S0-setup.txt), [S0-env.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/S0-env.txt) |
| E1533S2-00 | hub-api | PASS | [E1533S2-00.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-00.txt) |
| E1533S2-01 | hub-api | PASS | [E1533S2-01.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-01.txt) |
| E1533S2-02 | hub-api | PASS | [E1533S2-02.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-02.txt) |
| E1533S2-03 | hub-api | PASS | [E1533S2-03.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-03.txt) |
| E1533S2-10 | hub-api | PASS | [E1533S2-10.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-10.log), [E1533S2-10.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-10.check.txt) |
| E1533S2-11 | hub-api | PASS | [E1533S2-11.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-11.log), [E1533S2-11.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-11.check.txt) |
| E1533S2-12 | hub-api | PASS | [E1533S2-12.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-12.log), [E1533S2-12.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-12.check.txt) |
| E1533S2-13 | hub-api | PASS | [E1533S2-13.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-13.log), [E1533S2-13.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-13.check.txt) |
| E1533S2-14 | hub-api | PASS | [E1533S2-14.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-14.log), [E1533S2-14.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-14.check.txt) |
| E1533S2-15 | hub-api | PASS | [E1533S2-15.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-15.log), [E1533S2-15.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-15.check.txt) |
| E1533S2-16 | hub-api | PASS | [E1533S2-16.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-16.log), [E1533S2-16.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-16.check.txt) |
| E1533S2-17 | hub-api | PASS | [E1533S2-17.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-17.log), [E1533S2-17.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-17.check.txt) |
| E1533S2-18 | hub-api | PASS | [E1533S2-18.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-18.log), [E1533S2-18.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-18.check.txt) |
| E1533S2-19 | hub-api | PASS | [E1533S2-19.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-19.log), [E1533S2-19.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-19.check.txt) |
| E1533S2-20 | hub-api | PASS | [E1533S2-20.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-20.log), [E1533S2-20.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-20.check.txt) |
| E1533S2-21 | hub-api | PASS | [E1533S2-21.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-21.log), [E1533S2-21.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-21.check.txt) |
| E1533S2-22 | hub-api | PASS | [E1533S2-22.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-22.log), [E1533S2-22.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-22.check.txt) |
| E1533S2-23 | hub-api | PASS | [E1533S2-23.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-23.log), [E1533S2-23.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-23.check.txt) |
| E1533S2-24 | hub-api | PASS | [E1533S2-24.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-24.log), [E1533S2-24.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-24.check.txt) |
| E1533S2-25 | hub-api | PASS | [E1533S2-25.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-25.log), [E1533S2-25.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-25.check.txt) |
| E1533S2-26 | hub-api | PASS | [E1533S2-26.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-26.log), [E1533S2-26.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-26.check.txt) |
| E1533S2-27 | hub-api | PASS | [E1533S2-27.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-27.log), [E1533S2-27.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-27.check.txt) |
| E1533S2-28 | hub-api | PASS | [E1533S2-28.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-28.log), [E1533S2-28.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-28.check.txt) |
| E1533S2-29 | hub-api | PASS | [E1533S2-29.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-29.log), [E1533S2-29.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-29.check.txt) |
| E1533S2-30 | hub-api | PASS | [E1533S2-30.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-30.log), [E1533S2-30.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-30.check.txt) |
| E1533S2-31 | hub-api | PASS | [E1533S2-31.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-31.log), [E1533S2-31.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-31.check.txt) |
| E1533S2-32 | hub-api | PASS | [E1533S2-32.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-32.log), [E1533S2-32.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-32.check.txt) |
| E1533S2-33 | hub-api | PASS | [E1533S2-33.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-33.log), [E1533S2-33.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-33.check.txt) |
| E1533S2-34 | hub-api | PASS | [E1533S2-34.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-34.log), [E1533S2-34.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-34.check.txt) |
| E1533S2-35 | hub-api | PASS | [E1533S2-35.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-35.log), [E1533S2-35.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-35.check.txt) |
| E1533S2-36 | hub-api | PASS | [E1533S2-36.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-36.log), [E1533S2-36.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-36.check.txt) |
| E1533S2-37 | hub-api | PASS | [E1533S2-37.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-37.log), [E1533S2-37.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-37.check.txt) |
| E1533S2-38 | hub-api | PASS | [E1533S2-38.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-38.log), [E1533S2-38.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-38.check.txt) |
| E1533S2-39 | hub-api | PASS | [E1533S2-39.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-39.log), [E1533S2-39.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-39.check.txt) |
| E1533S2-40 | hub-api | PASS | [E1533S2-40.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-40.log), [E1533S2-40.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-40.check.txt) |
| E1533S2-41 | hub-api | PASS | [E1533S2-41.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-41.log), [E1533S2-41.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-41.check.txt) |
| E1533S2-42 | hub-api | PASS | [E1533S2-42.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-42.log), [E1533S2-42.check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-42.check.txt) |
| E1533S2-50 | hub-api | FAIL | [E1533S2-50.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-50.txt), [row50-config-source.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/row50-config-source.txt) |
| E1533S2-51 | hub-api | PASS | [E1533S2-51.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-51.txt) |
| E1533S2-52 | hub-api | PASS; corrected setup in fresh p3 | [E1533S2-52.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-52.txt), [E1533S2-50-corrected-setup-2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-50-corrected-setup-2.txt) |
| E1533S2-53 | hub-api | PASS; corrected setup in fresh p3 | [E1533S2-53.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-53.txt), [E1533S2-50-corrected-setup-2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-50-corrected-setup-2.txt) |
| E1533S2-54 | hub-api | PASS; corrected setup in fresh p3 | [E1533S2-54.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-54.txt), [E1533S2-50-corrected-setup-2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-50-corrected-setup-2.txt) |
| E1533S2-55 | hub-api | PASS; corrected setup in fresh p3 | [E1533S2-55.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-55.txt), [E1533S2-50-corrected-setup-2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-50-corrected-setup-2.txt) |
| E1533S2-56 | hub-api | PASS; corrected setup in fresh p3 | [E1533S2-56.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-56.txt), [E1533S2-50-corrected-setup-2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-50-corrected-setup-2.txt) |
| E1533S2-57 | hub-api | PASS | [E1533S2-57.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-57.txt), [E1533S2-50-original-drain.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-50-original-drain.txt) |
| E1533S2-58 | hub-api | PASS; authorised T-1676 cleanup, repeated census | [E1533S2-58-original.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-58-original.txt), [E1533S2-58.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-58.txt) |

**Not clear: E1533S2-50 FAIL.** 46 of 47 scoped checks pass. Tested commit `08bf3e544b01c92ef823a24cf22fded489f8b115`; run `qa-s2-2026-11-07-qa678-1`; stage `DigitalOcean on a fake API, the recipe and pool images`; qa-678 [QA]. No epic criterion marks: this is stage QA, not the Definition-of-done demo.

High — **T-1733**, E1533S2-50, silent loss of user configuration. `cland config set verification.provision setup.sh` exits 0 and prints `verification.provision = "setup.sh"; applies now`. The capture first reads `hosts tables written: agents 1 spare 1`, then `hosts tables kept: agents 0 spare 0`. Read-only inspection confirms no hosts tables remain. `hub/src/init/config-set.ts:66–68` reparses through ProjectConfig and renders it; `hub/src/init/config.ts:259` validates hosts but renderConfig does not retain them. This destroys the pools needed by the stage's host-prepare surface. Coordinator decision `2838b3ef-17b0-4567-836b-6e6061dac58d` classifies this as a stage finding, even though the config writer predates this stage. Original capture and source excerpts: [row50](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/E1533S2-50.txt), [source](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/row50-config-source.txt). No product fix was made.

Low, found aside — **T-1676**, Bugs, S, E1533S2-58. Six dead fallback sockets and seven dead owner receipts remained in TMPDIR (14 recursive entries including the receipt directory). Rows16/17 produced five-plus-one sockets and six receipts from unchanged executor files; row35 produced the seventh receipt from an unchanged producer in a stage-edited file. All seven owner PIDs were absent, all fixture roots were gone (the separately listed tested worktree still existed), and the Unix listener/open census under TMPDIR was empty. Row35's receipt PID42616 was absent and the receipt was not open; fixture root `/private/tmp/cland-suite-088bbee4-cb16-4bd9-93a8-0c2da97626b6` was gone. Its `claude-code-remote.test.ts:628–673` producer is byte-identical to stage1, SHA256 `b181f687851741c71731f288501a7058c5fa6f966e51a137eb1a6d10c6baac74`; the CLI ownership/exit-removal block at `hub/src/cli/hub.ts:327–328` is also identical, SHA256 `b5f6967cb6b0548f3443fbfe19ff3f65732542bf5a11301174e948a14a656904`. Parent attribution is from source, not a captured runtime call stack. Classified by Coordinator decision `f536e225-4e61-44dc-83a1-4270a3d3fdc9` as **T-1676 (unchanged producer in a stage-edited file)**. Original row58, recursive inventory, landing diff, comparison and literal removal list are retained. After authorised removal, repeated row58 reads zero entries except Node compile cache. A premature progress note said row35 had no new residue; the recursive inventory corrected that note before classification.

Execution and limits: local macOS27.0.1 / Darwin27.0.0 arm64, Node v24.21.0. All 33 named-test rows ran once, serially: **472 tests across 34 files**, all passed, zero failures/cancellations/skips/todos. The brief's generated-name checks and supplemental validations check recorded facts as well as exit codes; see each `.check.txt`, `-validation.json`, the original brief, `expect.json` and source digests. Typecheck passed for the whole workspace. No known-flake retry was needed. QA did not run a full suite, browser, Neovim, real provider, real SSH, real harness or npm install. Runtime-delivery npm was an offline stub; it proves argv and tree publication, not a real install. No duration-budget/resource enforcement was claimed for plain node --test; quiet admission and the load≤10 gate were enforced. Times in TAP are diagnostics, not a stage wall-time claim. Local cases have no droplet lifetime or cost.

The Coordinator's two stage cover receipts were read, not rerun by QA: A-17336 / Linux `8f3ebd6f-948b-437a-aeea-14ad20e19e9a`, and A-17340 / local macOS `56560294-763e-4004-a5d4-9327b1d90afd`, both at the full tested SHA and tree `1b2060fd53bd929e97206068ac10060f58608f24`. Both report T0,T1,T2,T3,T4 and Web exit0; T4 ran base files only, with repetitions of17 files explicitly skipped. Duration budgets/ratchet were report-only. Linux has9 explicit platform/binary skips, macOS1 Linux-only skip; those are not passes. Linux platform kernel6.8.0-147-generic x64, Node24.21.0, Neovim0.12.5; macOS Darwin27 arm64 uses the same Node/Neovim versions. Cover browser: Google Chrome for Testing156.0.8078.4, Chromium Headless Shell1248, exact binary paths in the two provenance JSON files. Linux shard machines `cland-v0-6de9ff41` and `cland-v0-2713e62c`, c-8 lon1: confirmed lifetimes1861s/$0.1292 and1945s/$0.1350, total$0.2642. Admission-to-finish intervals1903.38s and1984.38s are distinct from those lifetimes. Loaded repetitions for T-1704 and T-1670 are prior item evidence, named in [prior-item-evidence.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/prior-item-evidence.md), not repetitions in this run.

Corrections and supplemental observations:

- The committed brief already contains the shared-builder seal, streaming redaction, immediate credential gate, QA_SESSION, exact pinned-Neovim PATH exemption and known-residue clause. Those ran as committed; no seal exception was added.
- Coordinator-authorised setup-order correction for dependent rows52–56: preserve original row50 as FAIL; drain original p1; create fresh p3, start its empty-pools hub, set provision, stop, append hosts tables, restart. Assertions unchanged. All dependent cases pass on p3, without converting row50 to a pass. Original and corrected helper texts are retained. My first supplemental p2 setup called config set while the hub was down, returned `cland: no hub runs for this project — run cland hub start`, and is **BLOCKED (QA setup)**; no dependent case ran there. Its capture is retained, p2 drained, and the successful p3 setup is separate.
- Row25 supplemental parser correction: the brief checker passed17/17; the redactor intentionally withheld exactly two lines for its known C1 title. My additional visible-name parser initially omitted seven existing generated variants and raised AssertionError. Read-only correction from the source established16 visible names plus the withheld known name,17 tests/counters and exactly two withheld markers. No test reran and no expected result changed. Original parser/output and corrected parser are retained in [supplemental-parser-correction.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/supplemental-parser-correction.md).
- Row58's dead-residue clause was clarified by Coordinator to cover the unchanged row35 producer inside an edited file. All captures and the literal removal commands are retained; no live or changed-producer residue was found.

End state: all five registered scratch hub PIDs are gone, process census naming scratch/build is0, preservation lock absent, TMPDIR contains only Node compile cache. HEAD and dev still equal the requested full SHA; detached worktree clean and root non-tracker status unchanged. Brief lint passes at the tested build. Evidence has no scratch HOME, environment snapshots, cookies or one-use links. Publication scan uses the unchanged project scanner with a positive control; its result is in `publication-scan.txt`.


Publication presentation correction: Coordinator decision 2bab6aaa-f244-4cd7-b14e-2a70af656c58 authorises presentation-only omission of exactly two static source lines (44–45) from exported row35-stage-landing.diff. The exact original remains in the local run evidence tree. The lines assign a local test variable and are readable at landing a03310d3c6562b590d94fdcf8683d2de0147dd94, hub/test/claude-code-remote.test.ts. No runtime capture, test, assertion or scanner changed.

Durable evidence: A-17342, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17342-e-1533-stage-2-qa-not-clear-config-set-loses-host-pools-at-08bf3e54/report.md
