---
id: T-343
kind: task
title: "Droplet leases: a DigitalOcean API client that reads the token at use, a durable lease with its own SSH key and a detached watchdog per droplet, and cland executor status and reap"
state: open
status: in progress
size: L
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-271
blocked_by: []
topic: topic-216
branch: t/T-343-droplet-leases-a-digitalocean-api-client
created: 2026-10-13T20:53:45.647Z
updated: 2026-10-13T21:15:11.917Z
---

## Summary

This ticket builds the droplet backend's lifecycle, still without a run. It has five parts:

- a REST client for the DigitalOcean API that reads `DIGITALOCEAN_TOKEN` at each call;
- a durable lease, written before the create call;
- an SSH key per lease;
- a detached watchdog on the hub host that deletes the droplet at its lifetime, whatever the hub does;
- the CLI commands `cland executor status` and `cland executor reap`.

Reap deletes two kinds of droplet: this project's tagged droplets that have no live lease, and any `cland`-tagged droplet past its lifetime.

## Parent

E-271: Remote executors, tracer bullet 2 of 6, first half. Ticket T-344 adds `prepare` and the snapshot. Spec: `docs/spec/v0.1.2.md` §3.14, and §4 (Secrets). The decisions behind it:

- D25: the `cland` tag, a watchdog, destroy on exit, a token never printed.
- D27: the hub refuses a create beyond the budget or the cap, sweeps every droplet past its lifetime, and requires the `cland` tag.

Prior work: T-282's driver (artifact A-1917, `.cland/artifacts/A-1917-d25-plain-c-8-driver-…/`: `run-all.sh` with stages `key`, `create`, `destroy` and `_watchdog`, `bounded.py`, `c8-run.py`). The research note `docs/research/remote-executor.md` on `prototype/remote-executor`. ADR 0003: the hub owns the leases, while the watchdog runs apart from it on purpose.

## What to build

**The client.** `hub/src/executor/droplet/api.ts` calls the DigitalOcean API with `fetch`, against `https://api.digitalocean.com/v2` or the base URL in `CLAND_DIGITALOCEAN_API`.

- The token comes from `process.env.DIGITALOCEAN_TOKEN` at each call and goes only into the `Authorization: Bearer` header. It is never cached in a variable that outlives the call, never logged and never part of an error.
- Calls this ticket needs: `GET /account`, `GET /sizes`, `GET /regions`, `POST /droplets`, `GET /droplets/{id}`, `GET /droplets?tag_name=`, `DELETE /droplets/{id}`, `POST /account/keys`, `GET /account/keys`, `DELETE /account/keys/{id}`.
- Each call is bounded at 15 s, as T-282's `bounded.py` bounded `doctl`, with no automatic retry.
- An error carries the HTTP status and the API's `id` and `message`, never the request headers.
- The client uses REST, not `doctl`, for two reasons. There is no binary dependency, and the fake API can stand in for it. It is also a T-282 lesson: `doctl create --wait` returned before the droplet was active.

**Config.** `hub/src/init/config.ts` (`ProjectConfig`, `parseConfig`, `renderConfig`) adds to `[verification]` a `lifetime` duration string, `"110m"` by default, parsed with `durationMs` (`hub/src/duration.ts`), so tests can use seconds. It also adds a `[verification.droplet]` table:

- `size = "c-8"`;
- `regions = ["lon1", "nyc1", "sfo2"]`, the regions where this account is offered `c-8`;
- `image = "ubuntu-24-04-x64"`, which ticket T-344 replaces with the snapshot.

The droplet table is read again at each acquire, so a size changed in `config.toml` applies to the next run without a restart (D27: the size comes per run from config). An invalid value is refused and named.

**Acquire.** `DropletExecutor.acquire(run, deadline)` lives in `hub/src/executor/droplet/droplet.ts`. Its steps, in order:

1. Choose the size's price from `GET /sizes`, and the first configured region that is `available` and lists the size (the driver's `stage_preflight`). If none qualifies, refuse with a cause naming size and regions.
2. Generate an ed25519 key with `ssh-keygen -t ed25519 -N ''` into `.cland/run/executor/leases/<lease>/key` (mode 0600; `.cland/.gitignore` already ignores `run/`).
3. Write the lease durably: `.cland/run/executor/leases/<lease>/lease.json`, mode 0600, written with fsync and then a rename. Mirror it in `hub.db` meta under `executor-leases`. The lease records:
   - provider `digitalocean`, the run id, and name `cland-<project>-<lease8>`;
   - the tags `cland` and `cland-p-<hash>`, where the hash is 12 hex digits of the root path and project name;
   - size, region, price, the key's name, `created`, and `deadline = created + lifetime`;
   - state `creating`.
4. Arm the watchdog, then import the key.
5. `POST /droplets` with both tags and the key. Record the returned id in the lease.
6. Poll `GET /droplets/{id}` until `status` is `active` and a public IPv4 address exists, under a 300 s deadline. The create response is not enough (T-282's first attempt). Record the address and set the lease `active`. At the deadline, release the droplet and refuse.

**Release.** `release(lease)` does the following:

- deletes the droplet and the key;
- confirms both are absent, by listing the tag and the keys (the driver's `stage_destroy`);
- computes the lifetime from the create call to the delete call, and the cost as `max(60 s, lifetime) × price_hourly`;
- sets the lease `released`, stops its watchdog by verified PID identity, and removes the key files.

If absence is unconfirmed, the lease stays `releasing` and the hub's timer retries it. A lease is never forgotten while its droplet may exist.

**The watchdog.** `hub/src/executor/droplet/watchdog.ts` runs as a detached process, in its own session (`spawn(process.execPath, [watchdog.ts, leaseDir], { detached: true, stdio: 'ignore' }).unref()`).

- It inherits the hub's environment, so the token stays in memory. The argument list holds only the lease directory.
- It sleeps until the lease's `deadline`. It looks at the lease file every 15 s and exits once the lease is `released`.
- At the deadline it deletes the droplet by id, only if the droplet's name and tags match the lease, and deletes the key by name. It retries until listing confirms absence.
- It writes `watchdog.json` (`{ fired, deleted, confirmedAt }`) into the lease directory and exits.
- Its PID and start identity go into the lease. The hub never needs to be alive for it to fire (risk: a stray c-8 costs about $6 a day).

On its next start, the hub journals `executor-watchdog-fired` from that receipt.

**Reap.** `reap()` lists `tag_name=cland` and deletes two kinds of droplet:

- (a) every droplet with this project's tag `cland-p-<hash>` whose id has no live lease (`creating`, `active` or `releasing`, and before its deadline);
- (b) every `cland`-tagged droplet older than `lifetime` plus 10 minutes by its `created_at`, whatever its project. D27: no droplet outlives its lifetime.

It also deletes keys named `cland-<project>-*` that have no live lease. It never touches a droplet without the `cland` tag, such as the human's n8n droplet. A T-282 hand-driver droplet (`cland-proto-*`, only the `cland` tag) is reaped only under (b). Journal: `executor-reaped`, with id, name, age and reason for each droplet.

**Restart.** At hub start, every lease in `.cland/run/executor/leases/` is reconciled:

- A `creating` lease without a resource id: find the droplet by name and release it.
- An `active` lease with no run: release it. Ticket T-345 adds reattaching runs.
- A lease past its deadline: release it.
- A dead watchdog of a live lease is re-armed for the remaining time (`executor-watchdog-rearmed`).

**CLI and frames.** A new file, `hub/src/cli/executor.ts`, provides `cland executor status [--json]` and `cland executor reap [--json]`, wired in `hub/bin/cland.ts`.

- The frames are `executor.status` and `executor.reap`. Add them in `hub/src/protocol.ts`, `SESSION_CLI_FRAMES` and a `dispatch.ts` handler.
- They are for the human and the Coordinator only. Other roles get the same inline `ToolForbidden` refusal that `crew.set` gives.
- `status` prints: whether the token is present, as `token: present` or `token: absent (DIGITALOCEAN_TOKEN)`, never its value; the leases (name, id, region, size, state, age, deadline, watchdog alive); the cost of today's released leases; and the tagged droplet count.
- `reap` without a token refuses, naming the variable.
- All new journal events go into `JOURNALLED` (`hub/src/hub/journal.ts`).

**The fake API.** A new file, `hub/test/fakes/digitalocean/fake-api.ts`, is an HTTP server that keeps account, sizes, regions, droplets and keys in memory.

- A droplet's `created_at` is set, its `status` moves from `new` to `active` after N polls, and its public IP appears one poll after that (T-282's lesson).
- It keeps a request log of method, path and body. It checks that `Authorization` equals the expected sentinel and does not log the header.
- Faults can be injected: a 422 or 429 on create, slow answers past the 15 s bound, and a delete that leaves the droplet listed for N polls.
- Tests start it and pass its URL to the daemon as `CLAND_DIGITALOCEAN_API`, with `DIGITALOCEAN_TOKEN` set to a sentinel.

**Docs.** `hub/README.md` gains a new "Remote executors: droplets" section covering the token, the two tags, the lease and where it lives, the watchdog, reap, `cland executor status` and the new config keys.

**Demo** (the epic's words, its reap part). `cland executor reap` deletes a stray droplet made by hand with the tags. `cland executor status` lists nothing afterwards.

**Out of scope.** The snapshot, `prepare` and SSH to the machine (ticket T-344). Runs (ticket T-345). The sweep timer, the spend cap and the fallback (ticket T-346). The remote budget (ticket T-347).

**Constraints.**

- Tests go through the frame protocol first: a real hub, a real spoke and the CLI on a temporary project (`hub/test/harness.ts`). The droplet side runs against the fake API above. No `npm test` case reaches DigitalOcean or reads a real token.
- No new seams inside the hub. The fake is reached through environment, as `CLAND_CLAUDE_BIN` reaches the fake Claude Code. A test-only timing override follows the `CLAND_TEST_*` pattern. Put new helpers in the test file or a new helper module, never in `hub/test/harness.ts`. Classify new test files in `hub/test/shards.json`.
- Read `hub.log` and `journal.jsonl` only after the `flushLogs` barrier (T-291).
- The token is never stored, printed, put in an argument list, or written into a file, record, log, artifact, item or commit. A real check scans every published log for it before publishing, as T-282 did.
- A real check runs in a scratch project hub on the branch, under D25 until ticket T-346 enforces the cap: one `cland` droplet alive at a time (list the tag first), at most 45 minutes, and create, destroy and cost posted on this item. Use the smallest size (`s-1vcpu-512mb-10gb`) for lifecycle checks: no suite runs here.
- Suites run through `cland verify`, after a clear source review, at the exact reviewed head (D25).
- Commit on the task branch and push it to `origin`; `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. Against the fake API, through the real hub, the fake sees `lease.json` with state `creating` and the armed watchdog's PID before it answers `POST /droplets`. Acquire then polls through a `new` answer with no IP, and returns only when the droplet is `active` with a public address. At the 300 s deadline (shortened by a `CLAND_TEST_*` override), acquire releases the droplet and refuses.
- [ ] C2. Release deletes the droplet and the key, and confirms absence by listing, also when the fake keeps a deleted droplet listed for a few polls. It records the lifetime and the cost, with a 60 s minimum, at the size's price. An unconfirmed release stays `releasing` and is retried.
- [ ] C3. With `lifetime = "3s"`, the hub is stopped right after an acquire. The watchdog deletes the droplet and the key while no hub runs. The next start journals `executor-watchdog-fired` and the lease `released`, and `cland executor status` lists no lease.
- [ ] C4. Reap deletes a project-tagged droplet with no lease, and another project's `cland` droplet older than its lifetime plus 10 minutes. It leaves another project's younger droplet and an untagged droplet, and journals `executor-reaped`.
- [ ] C5. At restart, a `creating` lease without a resource id finds its droplet by name and releases it. A live lease whose watchdog died gets a re-armed watchdog.
- [ ] C6. The sentinel token appears nowhere: not in `hub.log`, the journal, the lease files, `watchdog.json`, the artifacts, the fake API's request bodies, or the `ps` command lines of the hub's children. Without a token, `reap` refuses and `status` shows `token: absent (DIGITALOCEAN_TOKEN)`.
- [ ] C7. `cland executor status` and `reap` are refused for an Implementer, a Reviewer and a QA session, and allowed for the Coordinator and the human.
- [ ] C8. Real check, posted on this item with create, destroy and cost: one stray droplet of the smallest size, made by hand with the `cland` and project tags, is deleted by `cland executor reap`. The tag listing is empty afterwards.
- [ ] C9. On macOS the watchdog holds `caffeinate -i -w <its pid>` while its lease is live, so a sleeping hub host cannot strand a billing droplet. A test on macOS sees the `caffeinate` child for a live lease and none after release (Coordinator decision, approved by the stand-in under D24 on 2026-10-13).
- [ ] C10. `hub/README.md` describes the token, the tags, the lease, the watchdog, reap, status and the config keys.

## Comments

### coord · 2026-10-13T20:55:58.417Z

Coordinator decision (2026-10-13 20:56Z) on C1 and C3, which name acquire through the real hub:
- No acquire command or frame. Acquisition reaches the hub through runs in T-345.
- C1: acquire and release are tested through the public DropletExecutor against the fake API, using the hub's lease directory. The fake checks lease.json (creating) and the armed watchdog PID before answering POST /droplets.
- C3: acquire through DropletExecutor into a temporary project's executor state, then start the real hub on that project. Read the watchdog, its receipt, executor-watchdog-fired and cland executor status through the hub and the CLI.
- Status, reap, restart reconciliation and the watchdog receipts go through frames and the CLI.
- No test-only exports or hooks in the hub beyond the CLAND_TEST_* deadline override.

### impl-343 · 2026-10-13T21:01:17.945Z

Implemented the first CLI/frame slice (missing token and role controls), fake DigitalOcean boundary, project/age-based reap, config lifetime/droplet settings, and public acquire/release with a durable lease before create. Targeted frame tests pass; lifecycle test covers key/lease modes, watchdog armed before POST, delayed public IP, delayed deletion and minimum billing. Next: detached watchdog receipts, restart reconciliation and failure paths. C1/C3 use the Coordinator-approved seam reading.

### impl-343 · 2026-10-13T21:14:02.026Z

Real lifecycle attempt 1 (A-2068): created droplet 608821301, cland-t343-8fff8ebb-8fff8ebb, s-1vcpu-512mb-10gb in lon1 at 2026-10-13T21:11:21.280Z. Reap did not match the hand-check's noncanonical macOS temp path tag; fallback deleted this droplet and key. Provider listings confirm zero cland droplets and the key absent. Cost estimate $0.00009917 (60 s minimum at $0.00595/hour); token scan clear. Fixed canonical project-root hashing and added alias coverage. The bounded check will be repeated; no other resource touched.

### impl-343 · 2026-10-13T21:15:11.917Z

Real check passed on attempt 2: created droplet 608821765, cland-t343-f1c71d7c-f1c71d7c, smallest size s-1vcpu-512mb-10gb in lon1 at 2026-10-13T21:14:05.361Z. cland executor reap deleted it at 21:14:30.281Z; provider tag count 0, key absent, executor status leases empty and taggedDroplets 0. Lifetime 24.920 s; estimate $0.00009917 at $0.00595/hour with the 60-second minimum. Token scan clear after flushLogs; scratch hub stopped. Two attempts total $0.00019833; never more than one cland droplet alive. The first-attempt artifact is A-2070 (correcting the prior comment's A-2068 reference); the corrected script is A-2071.
