---
id: T-344
kind: task
title: "The prepared snapshot: cland executor prepare builds a droplet snapshot keyed by Node, the Neovim pin, the lockfile and the base commit, and acquire creates from it and waits until the machine takes commands"
state: open
status: in progress
size: L
criterion_seq: 8
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-271
blocked_by:
  - T-342
  - T-343
topic: topic-222
branch: t/T-344-the-prepared-snapshot-cland-executor
created: 2026-10-13T20:53:45.756Z
updated: 2026-10-13T22:49:30.157Z
---

## Summary

`cland executor prepare` builds one droplet snapshot. It holds the packages, Node, the pinned Neovim, `node_modules`, an ordinary user and a mirror of the repository at the base commit, and it is keyed by those inputs. Acquire then creates from the snapshot without cloud-init, and waits until the machine takes commands as that user. Two more pieces come with it: the SSH machine transport the droplet backend uses privately, and the fake machine that the tests run against.

## Parent

E-271: Remote executors, tracer bullet 2 of 6, second half. Spec: `docs/spec/v0.1.2.md` §3.14: a pre-built image or snapshot instead of cloud-init provisioning, and "wait for SSH or exec". The epic's choice: `prepare` builds a snapshot keyed by the Node version, the Neovim pin, the `package-lock.json` hash and the base commit; a new key prepares a new snapshot and deletes the old one.

Prior work: T-282's driver, A-1917:

- `cloud-init.sh`: the apt packages, Node with a SHASUMS256 check, the pinned Neovim with its digest, and the `runner` user;
- `run-all.sh`: the stages `boot`, `deliver` and `install`.

Research: `docs/research/remote-executor.md` ("provision" and "install" are cacheable; deliver incrementally against a mirror baked into the image), and `docs/research/do-microvms.md` §4.4 ("prepare a base" becomes a backend operation with a cache key; "wait for SSH" becomes "wait until the machine takes commands").

## What to build

**The key.** `prepareKey(root)` in `hub/src/executor/droplet/prepare.ts` has four inputs:

- `node`: the root's `node --version`, so the machine runs the Node the host runs;
- `nvim`: the tag in `nvim/NVIM_VERSION` and its digest from `nvim/NVIM_SHA256SUMS`;
- `lock`: the sha256 of `package-lock.json` at the base;
- `base`: the commit of `origin/dev` after a fetch in the root.

The key hashes to `keyHash`, 12 hex digits.

**Prepare.** `DropletExecutor.prepare(key)` runs these steps:

1. Acquire a builder droplet through ticket T-343's lease, with the same tags, watchdog and release, from `[verification.droplet] image`. Its user data is `hub/src/executor/droplet/provision.sh`, a new product file adapted from T-282's `cloud-init.sh`:
   - the apt timers disabled, and the packages `git curl ca-certificates build-essential python3 jq lsof xz-utils procps locales`;
   - Node at the key's exact version, checked against SHASUMS256;
   - the pinned Neovim, checked against its digest;
   - the user `runner` with a home under `/home`, and `en_US.UTF-8`;
   - no `acct` and no samplers.
2. The builder's size is `[verification.droplet] prepare_size` (default `c-8`). The snapshot's `min_disk_size` must fit every run size: a builder with a larger disk than `c-8`'s yields a snapshot `c-8` cannot use. Refuse a `prepare_size` whose disk exceeds the run `size`'s disk.
3. Over the machine transport (below), as `runner`:
   - deliver a full bundle of `base` from the root (ADR 0004: the bundle comes from the territory) into a bare `~/mirror.git` and a checkout `~/cland` at `base`, with no remote configured;
   - run `npm ci`, and `node nvim/bin/nvim-path.ts` when the file exists;
   - write `~/.cland-image.json` with the key.
4. Install a per-boot script, `/var/lib/cloud/scripts/per-boot/cland-runner-keys.sh`. It copies the key DigitalOcean injects for root to `/home/runner/.ssh/authorized_keys`, so the hub connects as `runner` on every droplet made from the snapshot.
5. Clean the builder's own keys and run `cloud-init clean --logs`.
6. Power off (`POST /droplets/{id}/actions` with `power_off`) and snapshot (`snapshot`, name `cland-<project>-<keyHash>`). Poll the action through `GET /actions/{id}`, bounded at 20 minutes.
7. Transfer the image to every other configured region (`POST /images/{id}/actions` with `transfer`). Tag it `cland` and `cland-p-<hash>`.
8. Release the builder.

The snapshot record goes into `.cland/run/executor/snapshot.json` and `hub.db` meta: image id, name, key, `keyHash`, regions, size in GB and creation time.

- After a new snapshot completes, the old one is deleted (`DELETE /snapshots/{id}`).
- A prepare whose key matches the current snapshot does nothing and reports `current`.
- A prepare that fails at any step releases the builder, deletes any partial image and keeps the old snapshot.

Journal: `executor-prepared` or `executor-prepare-failed`, with the key, the image, the regions, the duration and the builder's lifetime and cost.

**Acquire from the snapshot.** Once a snapshot exists, `acquire` changes in four ways:

- It creates from the snapshot's image id, with no user data.
- It considers only the regions that hold the snapshot.
- It waits until the machine takes commands: SSH as `runner` answers `true`, and `~/.cland-image.json` matches the recorded key. The wait is bounded at 180 s; past it, acquire releases the droplet and refuses.
- Without a snapshot, it refuses with `no prepared snapshot; run cland executor prepare`. Ticket T-346 turns that refusal into the fallback.

**Staleness.** `cland executor status` shows the snapshot's key and whether the current key still matches it:

- `current`;
- `stale: base` (the base commit moved; only the bundles grow);
- `stale: lock|node|nvim` (a run then runs `npm ci` or seeds Neovim on the machine; ticket T-345).

Re-preparing is the human's or the Coordinator's call. Nothing prepares automatically in this epic.

**The machine transport.** `hub/src/executor/droplet/machine.ts` is private to the droplet backend; the interface (ticket T-342) never sees it.

- `exec(lease, command, { timeoutMs })`, `put(lease, local, remote)` and `get(lease, remote, local)` work through `ssh` and `scp`, or through `CLAND_SSH_BIN` and `CLAND_SCP_BIN`.
- They use the driver's options: `-F /dev/null -i <key> -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 -o ServerAliveInterval=15 -o ServerAliveCountMax=8`.
- Every call is bounded, and its child environment has no `DIGITALOCEAN_TOKEN`.

**CLI.** `cland executor prepare [--report <topic>] [--json]` is for the human and the Coordinator.

- The prepare is a hub-owned job: the CLI submits it and exits, and `cland executor status` shows its step and elapsed time.
- The outcome is posted as one hub notice in the given topic (`General` by default): the key, the image, the regions, the duration, and the builder's lifetime and cost.
- A second prepare while one runs is refused.

**The fake machine.** New files under `hub/test/fakes/digitalocean/`: `ssh` and `scp` scripts with `fake-machine.ts`.

- The fake API gives each droplet a directory under its state root, and maps the droplet's address to it.
- A command runs under `bash -c` with `HOME=<dir>/home/runner`, in that home, with a clean environment.
- A droplet's user data is not executed. The fake marks it provisioned, creates `home/runner`, and keeps the user data body for assertions.
- A snapshot copies the builder's directory, and a droplet made from the snapshot starts from that copy.
- Power-off, snapshot and transfer actions move from `in-progress` to `completed` after N polls, and can be failed by injection.

**Docs.** `hub/README.md`, "Remote executors: droplets": the snapshot, its key, `prepare`, staleness, storage cost (about $0.06 per GB-month), and the `runner` user.

**Demo** (the epic's words). `cland executor prepare` makes the snapshot, `cland executor status` lists it, and `cland executor reap` deletes a stray droplet made by hand with the tag (ticket T-343).

**Out of scope.** Runs on the machine (ticket T-345). Automatic re-prepare. A MicroVM checkpoint (the second backend, after ticket T-349).

**Constraints.**

- Tests go through the frame protocol first: a real hub, a real spoke and the CLI on a temporary project (`hub/test/harness.ts`). They run against the fake API and the fake machine above. No `npm test` case reaches DigitalOcean or reads a real token.
- No new seams inside the hub: only environment (`CLAND_DIGITALOCEAN_API`, `CLAND_SSH_BIN`, `CLAND_SCP_BIN`) and `CLAND_TEST_*` timing overrides. Classify new test files in `hub/test/shards.json`. Read the logs only after the `flushLogs` barrier (T-291).
- The token reaches the API's `Authorization` header only. It never reaches the user data, the machine, a bundle, a command line or a file.
- A real check runs in a scratch project hub on the branch, under D25 until ticket T-346 enforces the cap: one `cland` droplet alive at a time, at most 45 minutes, and create, destroy and cost posted on this item.
- Suites run through `cland verify`, after a clear source review, at the exact reviewed head (D25).
- Commit on the task branch and push it to `origin`; `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. Against the fakes, `cland executor prepare` runs the whole sequence in order: it creates a builder with `provision.sh` as user data; it delivers the base bundle into `~/mirror.git` and `~/cland` as `runner`, runs `npm ci` and writes the image marker; it powers off, snapshots, transfers to the other regions and tags the image; it releases the builder, with its watchdog stopped. The snapshot record has the four key fields. The journal has `executor-prepared`. One notice reports the key, the image, the regions, the lifetime and the cost.
  - failed: rev-23 [reviewer] · 2026-10-13T22:47:54.766Z · note The submitted prepare promise is untracked by shutdown; a hub stop can close Store before its lease/snapshot writes and outcome notice.
- [x] C2. A second prepare with the same key reports `current` and creates nothing. After `package-lock.json` changes, a prepare makes a new snapshot, then deletes the old one; the fake API lists one image.
  - done: impl-344 · 2026-10-13T22:44:55.710Z
- [x] C3. After prepare, acquire creates from the image id, only in regions holding it, with no user data. It returns only after SSH as `runner` answers and the image marker matches the key. On a marker mismatch, or past the 180 s bound, it releases the droplet and refuses.
  - done: impl-344 · 2026-10-13T22:44:56.456Z
- [ ] C4. Failures leave things as they were. A failed snapshot action, an SSH timeout or `npm ci` exiting 1 each release the builder, delete any partial image, keep the old snapshot and journal `executor-prepare-failed` with the cause. A `prepare_size` with a larger disk than `size` is refused before any create.
  - failed: rev-23 [reviewer] · 2026-10-13T22:47:54.766Z · note Partial-image cleanup has no durable retry owner, and ambiguous successful old-image retirement can restore a deleted old pointer while deleting the valid replacement.
- [x] C5. `cland executor status` lists the snapshot with its key and `current`, or `stale: <part>` after the base or the lockfile moves. Status and prepare are refused for Implementer, Reviewer and QA sessions.
  - done: impl-344 · 2026-10-13T22:44:57.836Z
- [x] C6. The sentinel token appears in none of these: the user data the fake API received, the fake machine's files, the fake `ssh` and `scp` argument lists and environments, the logs, the journal, the notice.
  - done: impl-344 · 2026-10-13T22:44:58.668Z
- [x] C7. Real check, posted on this item: one `cland executor prepare` in a scratch project on the branch, with the builder's lifetime and cost, the image's size, and `cland executor status` afterwards. The snapshot is deleted after the check, unless the Coordinator keeps it for ticket T-345.
  - done: impl-344 · 2026-10-13T22:49:30.157Z
- [x] C8. `hub/README.md` describes the snapshot, its key, `prepare`, staleness, storage cost and the `runner` user.
  - done: impl-344 · 2026-10-13T22:44:59.444Z

## Comments

### impl-344 · 2026-10-13T22:28:05.978Z

Implementing at the ticket's pre-agreed frame-protocol/CLI seams. Prepare role control test went red before implementation and now passes. Reusable snapshot test covers builder provisioning, committed-base mirror/checkout, install, snapshot/transfer, replacement and token absence. The machine transport is private and strips DIGITALOCEAN_TOKEN from all delivery children.

### rev-23 · 2026-10-13T22:47:54.766Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-344-1
commit: 9096ce38c1b115e52877aca3fb88be533d31c67f
scope: full

Medium — hub/src/executor/droplet/droplet.ts:130: discarded prepare work is absent from Dispatcher.close's drain, allowing Store to close before release/publication/outcome.
Medium — hub/src/executor/droplet/prepare.ts:167: one rollback scan (failed reads treated as empty) loses late/temporarily undeletable partial images without recovery ownership.
Medium — hub/src/executor/droplet/prepare.ts:153: lost successful old-image DELETE plus failed confirmation listing restores an absent old image and deletes the valid new one.
No additional blocker in the complete source/test review. Add frame/fake regressions for shutdown, delayed action/catalogue/delete refusal, and ambiguous old-image retirement. C7 real receipt and full verification remain pending. A-2107: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2107-t-344-full-source-review-snapshot-recovery-and-shutdown-blockers.md.

Criteria: C1 failed (The submitted prepare promise is untracked by shutdown; a hub stop can close Store before its lease/snapshot writes and outcome notice.), C4 failed (Partial-image cleanup has no durable retry owner, and ambiguous successful old-image retirement can restore a deleted old pointer while deleting the valid replacement.).
