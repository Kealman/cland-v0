---
id: E-1535
kind: epic
title: Logins
state: open
labels:
  - epic
  - v0.4
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by:
  - E-1534
follows:
  - E-1534
topic: null
branch: null
created: 2026-10-31T18:22:03.944Z
updated: 2026-10-31T18:22:55.790Z
---

## Goal

Harness sign-ins on hosts become logins: a resource the scheduler hands to hosts and takes back. A `disk` login is one sign-in to Claude Code or Codex, made by the harness's own flow on a small provider volume. It is mounted into one host at a time, and cland never reads it. A `key` login is a static key the human hands to cland, such as the OpenCode Go key or an API key. It is stored encrypted and given to a session only in its environment. A pool can only grow as far as its scarcest harness has free logins. A launch blocked on logins waits with that reason, and the human gets a card offering to create one. A login a harness reports dead is marked signed out, and the human signs it in again in place from the terminal, the web or the phone. The login-disk prototype ran all of it on real DigitalOcean volumes with OpenCode and a fake harness, and changed the design to keep each login's volume (Q-1518). The credential grilling fixed the per-harness rules (Q-1520). The research showed that no subscription login survives being copied to concurrent hosts, and that cland may not hold Claude.ai credentials (Q-1514).

## Contents

- **The login model** (spec §3.7). Rows in `hub.db`: name, harness, account, kind (`disk` or `key`), `exclusive`, provider, region, volume id, backup snapshot ids, state (`creating`, `ready`, `in-use <host>`, `signed-out`) and last sign-in; a login still being signed in never counts as bound; the Mac's logins stay outside cland. Demo: `cland login list` shows each field for a fake disk login and a key login.
- **Disk logins** (§3.7). A 1 GiB volume per login, created empty at `login add`, mounted at `/cland/auth/<harness>-<login>` and passed as `CLAUDE_CONFIG_DIR`, `CODEX_HOME` or `OPENCODE_DB`; kept for good, detached at host stop and re-attached at the next bind; snapshots after a sign-in and at most daily in use, the last two kept, never blocking a host stop (snapshot the detached volume later; respect one snapshot per volume per 10 minutes). Demo: a fake harness's rotating login written on host A is read at its newer generation on host B after A stops, from the same volume.
- **`exclusive`** (§3.7). True by default for Claude Code and Codex, enforced by the scheduler and, on DigitalOcean, by the volume's single attachment; false lets readers mount volumes from the latest snapshot, the writer being the holder of the login's own volume, readers never writing back and their volumes deleted at stop. Demo: a second host refuses an exclusive login in use; with `exclusive = false` two hosts run, and only the writer's turns survive.
- **Regions** (§3.7). A login belongs to its volume's region, and a pool in another region cannot bind it. Demo: a pool in a second fake region waits for a login of its own.
- **Key logins** (§3.7). `cland login add <harness> --kind key` reads the key from stdin or a hidden prompt as `cland secret set` does, and stores it AES-256-GCM in `.cland/auth/<login>.key` with the store key from the `[auth]` section of `.cland/secrets.toml`, which the strict secrets reader and `cland secret` learn. The key goes only into the spawn environment of the harness over `agent.sock`. Demo: a key login runs on two fake hosts at once, and a search of argv, host files, process rows, `hub.db`, the log and the journal finds no key; `.cland/auth` holds ciphertext only.
- **The login-disk helper** (§3.7). `cland-auth` on the host, through sudo with strict arguments (mount, unmount, freeze, thaw; volume names and `/cland/auth/<x>` paths only); the host agent stays unprivileged; any other mount of the device is unmounted. Demo: the helper refuses a path outside `/cland/auth/`.
- **Binding and release** (§3.7). A host needs one bound login per harness of the roles placed on it, a role's `account` narrowing the choice (assumed in the spec). Volumes attach while a new host provisions; a bind on a running host adds 8 to 10 s; a host's logins are released in parallel, after every process using the disk is ended. Demo: a cold host's bind adds no wait to its boot; a release ends a background process left holding the disk.
- **Capacity and the waiting reason** (§3.5, §3.7). Placement asks each host for a verdict per harness: serves, can bind, signed out, or no login. A pool grows only with a free login, so its effective size is min(`max_hosts`, free logins of its scarcest harness). A blocked launch waits as "waiting for a login <harness>", then "waiting for host <id> to boot" once a login frees. The human gets one "Not enough <harness> logins. Create one?" card per wait. Demo: with one login in use and `max_hosts = 2`, a launch waits with no host booted; `cland login add` releases it and a host boots.
- **Signing in** (§3.7). `cland login add <harness> [--name] [--pool]` boots or reuses a pool host, creates an empty disk, and opens the harness's own sign-in over `ssh -t` in the human's terminal: `claude auth login` for Claude Code, `codex login --device-auth` in an empty `CODEX_HOME` for Codex. On success it snapshots and marks the login `ready`. From the web and the remotes the same is a card the hub raises with the link and code; for Claude Code the card's free answer carries the pasted code back (assumed in the spec). Nothing cland starts runs a logout. Demo: with the fake harness, a login added from the CLI, and one added by answering a card on the test messenger.
- **Signed out** (§3.7). Dead-login signals (Claude Code `authentication_failed`, `Login expired`, `OAuth token revoked`, 401; Codex `refresh_token_reused`, `codexErrorInfo: "unauthorized"`, 401; OpenCode `provider.auth`) mark the login `signed-out`. Placement skips that host for the harness, sessions there keep running, and a "sign in again" card goes out. `cland login signin <n>` re-runs the sign-in on the same host and volume and snapshots under `fsfreeze`. A second sign-out of one account within a day adds the hint "This account seems to allow one sign-in: set exclusive or add an account." Demo: the fake harness reports a dead login, the next launch skips that host, `signin` reuses the volume, and the hint appears on the second sign-out.
- **Cards on the remotes** (§3.7). The "create one?", "sign in again" and add-login cards on Telegram and Discord through the v0.3 card model, raised by the hub; the remotes' authority table gains no request (assumed in the spec). Demo: each card on the test messenger, answered once, folds on both remotes.
- **Operations** (§3.7). `cland login add`, `list` (with capacity per pool and harness), `signin`, `remove` (volume and snapshots, refused while in use) and `snapshot`. Demo: `remove` of a login in use is refused, then works after its host stops.
- **Reconciliation and the open point** (§3.7). At start the hub lists the provider's volumes and frees a login whose host died. If a live process does not pick up re-signed tokens (the live run decides), `login signin` relaunches that host's sessions of the harness in their worktrees, behind a switch the live run sets. Demo: a host deleted by its watchdog with the hub stopped leaves its login `ready` after the next start.
- **The ADR and v0.1.2 §3.13 amendment** (§3.12). cland stores the keys the human enters through stdin and the metadata of disk logins, and never reads a login disk's contents or keeps a harness's session tokens; the local registry stays names and paths.

Not in this epic: the web's hosts view and its login actions, doctor's login rows and setup's first login ("Workbenches, doctor, setup and docs for hosts"); the real Claude Code and Codex sign-ins, which happen once each in the live run ("Release v0.4.0 from the item").

## Order

1. **A disk login on one fake host.** The model, `login add` with the fake harness, mount and the helper. Demo: `cland login list` shows a `ready` login on its volume.
2. **Bind, release and write-back across hosts.** The kept volume, detach and re-attach, parallel release, ending processes, snapshots as backups. Demo: host B reads host A's newer generation.
3. **Capacity.** Verdicts, the waiting reason, the card once per wait, `exclusive` and regions. Demo: the waiting launch released by `login add`.
4. **Key logins.** The store, the `[auth]` section, the spawn environment. Demo: the key on two hosts and nowhere else.
5. **Signed out and sign-in again.** Signals, skip, card, `signin` in place, the hint. Demo: as above.
6. **Cards, operations, reconciliation and the amendment.** Demo: cards on the test messenger; a watchdog-deleted host's login freed at start; the amendment on `dev`.

## Definition of done

QA runs the demo below on `dev` through the `cland` CLI and the hub's frame protocol, with the fake host provider (volumes attaching to one host at a time and a snapshot rate limit), the fake transport, the fake harness and a test messenger in the suite, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. No real provider, volume or subscription login is involved.

In a scratch project with an `agents` pool on the fake provider, QA adds a fake-harness disk login and reads it `ready`, launches a session, rotates the login over two turns, stops the host and launches again on a new host, and reads the newer generation. With `max_hosts = 2` and one login in use it launches a second session and reads "waiting for a login fake", the card once, and no host booted; it adds a login from the test messenger's card and reads the host boot and the reason change. It sets `exclusive = false` and reads two hosts running with only the writer's turns kept. It adds an OpenCode key login through stdin, runs it on two hosts, and searches argv, host files, process rows, `hub.db`, the log and the journal for the key. It makes the fake harness report a dead login and reads the mark, the skipped host, the running session and the card; runs `cland login signin` and reads the same volume id; makes the account sign out again and reads the hint. It stops the hub, lets the watchdog delete a host holding a login, restarts and reads the login free. It tries `login remove` on a login in use and reads the refusal, then reads the ADR and v0.1.2 §3.13 amendment.

- [ ] C1. A login is a `hub.db` row with harness, account, kind, `exclusive`, region, volume and snapshot ids, state and last sign-in, and `cland login list` shows them with the capacity per pool and harness.
- [ ] C2. A disk login keeps its volume, detaches at host stop and re-attaches at the next bind, and a rotated login written on one host is read at its newer generation on the next.
- [ ] C3. Snapshots are taken after a sign-in and at most daily, the last two kept, and a host stop never waits on a snapshot.
- [ ] C4. An exclusive login is used by one host at a time; a non-exclusive one serves readers from its latest snapshot, and only the writer's changes are kept.
- [ ] C5. A key login is stored encrypted under the `[auth]` store key and reaches a session only in its spawn environment, on any number of hosts.
- [ ] C6. A pool grows only with a free login, a blocked launch waits as "waiting for a login <harness>" with its reason kept current, and the "create one?" card goes once per wait.
- [ ] C7. A login is signed in through the harness's own flow in the terminal or from a card, and nothing cland starts runs a logout.
- [ ] C8. A dead-login signal marks the login signed out, placement skips that host, sessions there keep running, `cland login signin` reuses the same volume, and a second sign-out of one account within a day adds the hint.
- [ ] C9. At start the hub frees a login whose host is gone, and `cland login remove` is refused while a login is in use.
- [ ] C10. The ADR and spec v0.1.2 §3.13 carry the amendment of spec §3.12.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub. Commit on the task branch, push to `origin`, reach `dev` only through `cland merge`; only `cland release` pushes to GitHub. Suites run through `cland verify`. Items through `cland task` only.
- **The hub's code.** TypeScript on Node 24 under the hub's tsconfig. No new runtime dependency; encryption with `node:crypto`.
- **Tests.** Test first (`tdd`) with the fake harness whose login is a file it rotates every turn (`FAKE_LOGIN_HOME`). No test uses a real subscription login, real volume or real key.
- **The terms boundary.** cland never stores, copies, reads or intermediates a Claude.ai or ChatGPT session credential: no setup-token, no `.credentials.json`, no `auth.json` in cland's store. The Mac's logins are never snapshotted or copied.
- **Never sign anyone out.** No `codex logout`, `/logout` or `claude auth logout` from anything cland starts; a Codex sign-in always starts in an empty home.
- **Secrets.** A key never appears in argv, a frame, a log line, an error, the journal, `hub.db` or an artifact; the redactor covers login output. The store key lives only in `.cland/secrets.toml`.
- **ADRs.** 0003: cards are raised by the hub, and the remotes' authority table does not grow. The v0.1.2 §3.13 boundary is amended here.
- **The prototype.** `prototype/agent-host` at 7f7ecb0f is never merged; read `hub/src/host/logins.ts`, `fake-harness.ts`, `fake-adapter.ts` and the "Logins" section of `hub/src/host/README.md`, follow the spec where it amends the prototype (keep the volume; snapshots are backups).
- **Plan.** The Coordinator drafts the plan with `plan-epic` and approves it itself (spec §4).
- **Order.** Last in the hub lane, after "Pools, placement and the scheduler". "Workbenches, doctor, setup and docs for hosts" waits for it.

## References

- Spec: `docs/spec/v0.4.md` §3.7 (logins), §3.5 (capacity in placement), §3.12 (the amendment), §3.13 and §4.
- Items: R-1530; the map M-1511, round 4 decisions 1 to 7 and its amendment; Q-1514 (and its addendum); Q-1518; Q-1520 §1 to §5.
- Research: `docs/research/harness-credentials.md` on `research/harness-credentials` (87db57e2): the decision table, sections 1.4, 1.5, 2.4, 2.5, 3.5, and the rules.
- Prototype, on `prototype/agent-host` at 7f7ecb0f: `hub/src/host/README.md` ("Logins": timings, checks, frictions, decisions), `logins.ts`, `fake-harness.ts`, `fake-adapter.ts`, `host-root.sh` (the helper); the sandbox's `HOW-TO-TRY.md`, "Try logins".
- Code: `hub/src/accounts/registry.ts`, `hub/src/remote/secrets.ts`, `hub/src/cli/secret.ts`, `hub/src/adapters/sessions.ts`, the v0.3 remote card model in `hub/src/remote/`; `docs/spec/v0.1.2.md` §3.13.
- GLOSSARY: Login, Login disk, Key login (added for v0.4); Account (amended); Remote card.
