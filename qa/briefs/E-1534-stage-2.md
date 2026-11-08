# Stage QA brief: E-1534 stage 2 — placement on pool hosts, waiting launches, scale up, lease and watchdog

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (start `bash` first; zsh reads `$S:q`, `$B:h` or `${B}:hub` as modifiers; always brace a variable before `:`). The run is local, on macOS (BSD `stat`, Node 24 with `node:sqlite`, `uuidgen`, `lsof`). A platform skip is a FAIL, not a pass. **No real SSH, host, droplet, volume, DigitalOcean API, key, credential, npm registry or network (R-1530's QA rule).** The named files use only their own fakes (fake host provider, fake `ssh`/`scp` on fake hosts, the scripted fake DigitalOcean API, an isolated `XDG_STATE_HOME` for every spend ledger). The scratch rows create fake hosts only, through the real CLI on a scratch hub; the watchdog row deletes them through the fake provider. **No real harness.** No browser, no GUI; headless Neovim only for the recorded-frame consumers (E1534S2-26), from the repository's pinned cache.

The stage is placement, scheduling, lease and process level. The run is meant to take about four hours: setup and E1534S2-00 to E1534S2-03 about 20 minutes; the named files E1534S2-10 to E1534S2-49 about 150 minutes, one file at a time, the native T3 files under the preservation lock; scratch rows E1534S2-50 to E1534S2-59 about 50 minutes (two of them wait out a 30 s lease in real time). Waits for cover-quiet admission, the preservation lock or load are not product results.

**Status at writing (dev `550e59aca718ee0e8952ce86dfdde984cfc9e33d`, the closest stand-in; the rerun's head is the next tracker commit).** T-1747 (`77579ea01`), T-1743 (`273ddcbdd`), T-1748 (`debeaca4d`), T-1744 (`48e11d905`), T-1745 (`50f0529d2`), T-1746 (`32a5fdbf0`) and T-1763 (`550e59aca`, the fix for the first run's finding) have landed: VERIFIED at that dev. T-1762 (`ee65d6d5b`, the literal-rm hook) landed between them and is outside the stage. All of them are collected under "Rows to verify after landing", which the Coordinator settles at the tested dev SHA before requesting QA.

## Carried corrections

A reused kit block must be reconciled against the source brief's recorded run corrections. This brief reuses the stage-3 kit of E-1533 and the stage-4 kit of E-1532, both taken from one fixed commit `K` (`273ddcbdd485e33aa382a90efedda992ac0e6a00`), never by blob (A-17643). It carries the stage-1 brief's chain of corrections verbatim as `qa/briefs/E-1534-stage-1.md` holds it at `K` (from E-1533 stage 2, stage 3 and the E-1533 Definition-of-done run), then that brief's own run corrections (A-17643), verbatim. What was carried, and how, is stated here; nothing below is optional.

### From `qa/briefs/E-1533-stage-2.md`, its verbatim copy of stage 1's "Corrections from this brief's own run (qa-678, A-17199)", verbatim

The stage-1 run at `5795362b` (run qa-s1-2026-11-06-qa678-1) applied two Coordinator-approved run-copy corrections. Both come from the E-1532 stage-6 run (A-17053), whose kit this brief reused by blob without its recorded corrections. A brief that copies this kit carries them as written here:

- **Seal every command fresh.** Build every files, typecheck and scratch command through a fresh shared-builder seal, with the hub overlay inside the builder and `login:false`. Never build them from a static `env.sh` or `env-hub.sh` snapshot (T-1705). Run the credential-name count as an immediate gate before each command; a non-zero count stops the row. Redact the stdout and stderr captures while they stream. Set `QA_SESSION` inside the builder, so recorder lines name the QA session and not the rescue default.
- **Known dead TMPDIR residue.** Inventory known residue from unchanged test files before the final census, and attribute it per file. At this build that is T-1676's spoke fallback sockets and `cland-fixture-owners-<uid>` receipts from `executor-droplet` (5+5) and `executor-prepare` (1+1). Check it dead (no `lsof` Unix entry, owner PIDs gone), then remove it by literal path after row 35, and repeat row 36. Live residue, or residue attributable to a stage item, stays a finding.

### From `qa/briefs/E-1533-stage-2.md`, "Decisions from this brief’s first run (qa-678, A-17342)", verbatim

- **T-1676 dead residue covers an unchanged producer inside a file the stage edited.** In E1533S2-35 a `cland-fixture-owners-<uid>` receipt came from the CLI-started-hub block of `claude-code-remote.test.ts`, which is byte-identical to the stage-1 build. That counts as T-1676 found aside, once QA has shown the residue is dead (PID absent, receipt not open, fixture root gone) and that the producing block’s SHA-256 is unchanged. Residue whose producing code the stage changed stays a finding.
- **E1533S2-50 found T-1733.** `cland config set` deletes the `[hosts.*]` tables, so the stage was not clear. The rerun after T-1733 lands uses this brief’s original row order, because the fix must make row 50 pass as written. T-1733 landed as `945b974cef3badd17e582c6d3f88f7c0b73fba30` (batch e4878d6a, A-17358). It adds a tenth stage member and changes `hub/src/init/config-set.ts`, `hub/src/init/config.ts` and the other config writers its sweep found. The rerun checks its landing receipt like the other members. The rerun (qa-s2-2026-11-07-qa678-2, A-17366, clear) added T-1733’s committed title `config set preserves SSH hosts and both pools before host prepare` (`hub/test/host-prepare.test.ts`) to host-prepare’s `expect.json` list as an expected-registration correction. A brief that copies this kit adds the new titles of every late-landing member to its lists.

### From `qa/briefs/E-1533-stage-3.md`, "Corrections from this brief's own run (qa-678, A-17467)", verbatim

The stage-3 run at `093f851b` (run qa-s3-2026-11-07-qa678-1, clear) applied two Coordinator decisions and found one kit defect. A brief that copies this kit carries all three:

- **Cleanup order (ask 8483de13).** The cleanup paragraph under "Build" removes `$Q` and `$T` before E1533S3-62, but `s62` reads `$Q/alias.txt`, lists `$T` and is recorded through `$Q/fresh.mjs`. Run it in this order: after E1533S3-61 passes, remove the validated alias and the known dead T-1676 residue by literal path; run and record E1533S3-62 with `$Q` and `$T` still present; after the verdict, remove `$Q`, `$T` and the worktree by literal paths with the checks given.
- **E1533S3-56 is out of stage scope (decision 06c3f284).** `ports()` maps every loopback port to `session.sock`, but the fake OpenCode on a created host listens on TCP loopback (the capture: `opencode serve did not answer within 30000 ms: server listening on http://127.0.0.1:54101`). The scratch launch therefore cannot pass with this kit. T-1718 C1 is proven by E1533S3-20, including the native launch. The scratch launch moved to the E-1533 Definition-of-done demo. E1533S3-57's `oc row` line follows it under the same label; T-1720 C1's settlement is proven by E1533S3-43 and E1533S3-27.
- **`m56` shell defect.** `case "$r" in "host=$ID "*) …` inside a `$(…)` substitution gives `syntax error near unexpected token newline` (scratch.sh:54). Compute the match outside the substitution before reusing `m56`.

### From `qa/briefs/E-1533.md`, "Corrections from this brief's own run (qa-678, A-17472)", verbatim

The Definition-of-done run at `79b350ec` (run qa-dod-2026-11-07-qa678-1, clear, C1–C8 verified) applied four Coordinator-approved run-copy corrections. The captures from before each correction are kept beside the corrected ones. A brief that copies this kit carries them as written here:

- **Kit pin (ask 82fc449f).** `qa/briefs/E-1533-stage-3.md` moved from blob `8db55d9d703238490b373b4045d2834a42259a8c` to `997909c0c8ac8770cd879e0862816ca22743c939` when its own run's corrections were folded in. That is one 8-line prose hunk before `## Stage`, and no heredoc changed. Take `want 997909c0…` for kit3, gated on that one-hunk diff and on byte-identical `kit3` output from both blobs. A brief that edits a kit another brief pins by blob updates that pin in the same commit.
- **Epic occasion suite (ask 9ff76615).** QA's standing clause runs `cland verify all --occasion epic --report <topic> --to <requester> --to <qa>`. The ban on `cland verify` in this brief covers only ad-hoc runs. The hub admits the occasion only as an integrated dev request: run `git fetch origin` in the root, check that HEAD, `refs/heads/dev` and `origin/dev` all equal the request, and submit from the root. A detached worktree is refused. That run (here a047adea, A-17468) is the primary evidence for E1533D-30 and C5; the stage cover is supporting.
- **Droplet gate filter (coord decision).** `cland demo exec` arrives over ssh, so `SSH_CLIENT` and `SSH_CONNECTION` match P_GATE's `SSH_` prefix. Exclude `SSH_CLIENT`, `SSH_CONNECTION` and `SSH_TTY` from P_GATE. Any other matching name still stops every droplet row.
- **dpkg quoting (ask 63d679ac).** P_IMAGE passes `dpkg-query -f "${Package} ${Status}\n"` through `sh -c`, and that shell expands the placeholders before dpkg sees them, which prints blank package lines. Put the format in literal single quotes.

### Known flakes by exact signature

From `qa/briefs/E-1533-stage-2.md`, "Probes that mislead", verbatim:

- **Known flakes by signature, not by guess.** `host-ssh-contract` runs alone because T-1731 (its test `accepted spawn reconciles its durable token after the commit reply is dropped` resolving with a raw `process-exited` event) showed only in a four-file mix. `transport-forwards` C1's two unattributed `MainThrea` loopback listeners are T-1732's open cause; T-1670 now attributes them. If either signature appears, keep the full output (for transport-forwards, the attribution lines: pid, sources, nativeStart, parent, command, raw rows), rerun the row once alone under the lock, and report both runs; the second result stands for the row and both are findings for the requester. Any other failure is judged as it stands. (File paths, added here for lint: `hub/test/host-ssh-contract.test.ts`, `hub/test/transport-forwards.test.ts`.)

**Retired: T-1735 and T-1732 are fixed and are no longer known flakes.** T-1735 landed as `7926f3203` (the shared fake-host factory keeps the private fake-machine directory out of the staged tree): if `hub/test/host-relaunch-native.test.ts`'s `git add .` failure on `processes.json.new` appears again, it is a finding, a regression of T-1735, never a rerun. T-1732 landed as `10b63fc8c` (`transport-forwards`' census is scoped to the fixture's ancestry and excluded holders print a diagnostic line): the T-1732 half of the verbatim rule above no longer applies, and an unattributed listener in `hub/test/transport-forwards.test.ts` is a finding, a regression of T-1732. The T-1731 half (`host-ssh-contract`, run alone) stays.

**Added here, under the same policy as T-1731: T-1758.** `hub/test/suite-cancel.test.ts`, the `recreate=false` expansion of its loop `verify cancel reaps a detached fake child <…>, then admits the next run`, named exactly `verify cancel reaps a detached fake child before removing the phase root, then admits the next run`, failing with `detached descendant is reaped before cancellation is reported` (the `pidAlive(fake.pid)` assertion, under load; T-1758, backlog). Only that title failing with that exact message matches; keep the full output, rerun the row once alone under the lock, report both runs, the second result stands for the row and both are findings for the requester.

**T-1736 is not a known flake** (`hub/test/telegram-polling-restart.test.ts`, its fixed 2000 ms setup wait): a failure there, or anywhere else not listed above, is judged as it stands.

### From `qa/briefs/E-1534-stage-1.md`, "Corrections from this brief's own run (qa-678, A-17643)", verbatim

The stage-1 run at `c130bac4` (run qa-e1534s1-2026-11-08-qa678-1, clear) applied four Coordinator-approved run-copy corrections. A brief that copies this kit carries them as written here:

- **Kit pin (ask 9de5178b).** `qa/briefs/E-1533-stage-3.md` moved again, from blob `997909c0…` to `3e85f49d…`, when T-1738 added three historical-scope prose lines. Every heredoc stayed byte-identical. A blob pin on a brief that later items may edit goes stale, so extract the kit from a fixed commit (`git show <sha>:qa/briefs/E-1533-stage-3.md`) and pin that commit, not the blob.
- **Landing delta from another fix (ask ccf550e7).** T-1741 landed from merge head 042be2f5, which auto-merged T-1735's self-ignore into `shared/fake-host-machine.ts` (`mkdir(directory, 0o700)` plus a `.gitignore` of `*`). A landing check that compares a member's files to its reviewed head names any delta that comes from a separately landed fix, with its commit. The member's own lines must still match.
- **Counter scope (ask 5f1dfe6d).** `cnt` counts a key across the whole config file, so in E1534S1-51 it also counts `[verification].daily_spend_usd`, which `init` writes. Count keys inside the `[hosts]` table only.
- **Fake-host census (ask 76d4b23b).** In E1534S1-60, the at-floor OpenCode launch fails its forward because the scratch `pm` helper never calls `ports()`. `ports.json` is then absent, `fake-ssh.ts` refuses the forward and `ssh.ts` retires the master before cleanup. Its OpenCode process survives under the fake host's agent. A fake-provider destroy releases the record and never kills the fake machine's local processes, so an agent-descendant survivor joins the supervisor and agent in the census and is ended by pid. The hub settled every row (no session, process, pending stop, reservation or lease; two confirming reads). Call `ports()` in `pm` before launching through a created host.

**Known flakes, re-stated for this stage.** T-1731 (`hub/test/host-ssh-contract.test.ts`, run alone) and T-1758 (`hub/test/suite-cancel.test.ts`) stay known flakes by the exact signatures quoted above. **Added here, under the same policy: T-1689.** `hub/test/suite-cancel.test.ts`, its case named exactly `suite cancel refuses another session’s run while the human can cancel it by id`, failing at line 141 (`assert.equal(pidAlive(job.pid!), true)`) with `false !== true`; it recurred on Linux dev-t3 (A-17774) and its rerun was green. Any other failure in that case, or a different line or message, is not T-1689. T-1735 and T-1732 are fixed: a recurrence of either signature is a regression finding, never a rerun. **T-1736 and T-1761 are not flakes** (T-1761: `hub/test/suite-recovery.test.ts`, its nested-runner setup wait on the 15 s default): a failure there is judged as it stands.

### How this brief applies them, and the reconciliation

- **Fresh seal, streaming redaction, `QA_SESSION` (carried).** Every named file, the typecheck and every scratch command runs through the stage-3 kit's `fresh.mjs`; `body.sh` repeats the credential gate before each scratch function. No `env.sh`, no `env -i`. QA's own shell runs with `login:false`.
- **Kit pin (carried as A-17643 corrected it).** Every reused kit block is extracted with `git show 273ddcbdd485e33aa382a90efedda992ac0e6a00:<path>` from that one fixed commit, never from the worktree's copy and never by blob: the stage-4 lines (`holder`, `quiet`, `ld`, `tap.mjs`), the stage-3 heredocs (`seal.mjs`, `fresh.mjs`, `frame.mjs`, `body.sh`, `helpers.sh`) and the E-1533 DoD's `relay.mjs` design (rewritten here as `relays.mjs` for hosts that appear during the run). A later edit to those briefs cannot move this run's kit.
- **Landing delta from another fix (carried).** The landing check for T-1746, T-1748 and T-1763 compares each member's files, at its own landing commit, with the head QA read, and lists later commits that touched them; a delta that comes from a separately landed fix is named with its commit (E1534S2-02), and the member's own lines must still match.
- **Counter scope (carried).** Scratch rows count config keys inside the `[hosts]` table only (`hcnt`, below), never across the file.
- **Fake-host census and `ports()` (carried, re-scoped).** Every launch through a created host has a `ports.json` before it starts. Because the fake OpenCode listens on TCP (the E-1533 DoD's relay note), the map here points each loopback port at `relay/<port>.sock`, served by `relays.mjs`, which writes the map for every fake host as it appears; that is the DoD's validated `relay.mjs` path, generalised to on-demand hosts (OBSERVED serving both created hosts in the first run). A fake-provider destroy, and here the watchdog's deletion, never kills the fake machine's processes: the census ends the supervisor, agent and any agent-descendant survivor by pid.
- **Known dead TMPDIR residue, unchanged-producer clause, expected-registration corrections, cleanup order (carried from the chain above).** Residue first seen after a file a stage-2 landing added or edited is a finding unless the A-17342 clause clears it (dead, and the producing block's SHA-256 equal at `<dev SHA>` and at `4360256ac`). Lists are re-derived at `<dev SHA>` before the cases. Cleanup runs: census, then the alias and dead residue removed by literal path, then the end check with `$Q` and `$T` present, then `$Q`, `$T` and the worktree after the verdict.
- **Epic occasion suite, droplet gate filter, dpkg quoting (not applicable here).** A stage run: no epic occasion, no `cland demo`, no droplet gate, no `dpkg` probe.

### Kit conventions carried

- **Rule 22.** Every selector, test name and string is marked VERIFIED, VERIFIED-on-branch or INFERRED; an INFERRED expectation is never a pass condition on its own.
- **TAP.** `node --test <file>` reports top-level registrations with `1..N` and `# tests/pass/fail/cancelled/skipped/todo` counters that include nested subtests; names escape `#` and `\`. `tap.mjs` parses exactly that.
- **Exact strings** are counted by `src.mjs` with `String.split`, never by shell `grep`.
- **The preservation lock** is the directory `/tmp/cland-preserve.lock`, taken with `mkdir`, an owner file naming this run and row, and an owner-checked removal by literal path. A held lock makes the row BLOCKED for now (retry later; never remove another owner's lock).

## Corrections from this brief's own first run (qa-678, A-17820)

The first run at `4688f956` (run qa-e1534s2-2026-11-08-qa678-1, A-17820) was not clear: E1534S2-55 FAIL, E1534S2-56 INCONCLUSIVE, the other 37 checks PASS. It applied two Coordinator-approved run-copy corrections and found one product defect. A brief that copies this kit carries them as written here:

- **Casing (ask 7199f474, decision d9b1c31c).** The CLI prints session lines with the role's display label (`withRole`, `hub/src/names.ts`): `launched w1 [Implementer] …` and `w1 [Implementer] … host <id>` in `cland session list`. The waiting-line formatter keeps the raw role id: `w2 [implementer] pool agents: waiting for a host`. Row 52 expects `[Implementer]`; rows 53 and 54 keep `[implementer]`.
- **Census (ask b9c53ce3, decision 0dcf424b).** A spoke child of the fake OpenCode under the host agent (spoke → fake OpenCode → agent → `supervisor.sh`, all under the alias or `$Q/fh`) is an expected fake-host survivor, in the carried agent-descendant class. Row 57 records each survivor's identity, ancestry and cwd before the TERM drain; nothing outside the fixture trees is exempted.
- **Rows 55 and 56.** Row 55 printed `lease files 1`: H1, the `min_hosts` startup host running w1, stopped renewing once row 53 scaled H2 up, and its watchdog deleted it before the deliberate hub stop. Hub-side creation passed no `inUse` predicate (`dispatch.ts`), so renewal fell back to `heldByMinimum`, which picks the minimum by host id. T-1763 (landed `550e59aca`, regression-of T-1746) added one shared in-use predicate for manual, startup and demand creates, and is a stage member here. **Both lease mirrors must renew while their hosts are in use:** row 55 expects `lease files 2`, both deadlines moving forward while w1 and w2 run, and both hosts still ready after the wait. **Row 56's after-stop proof needs both hosts alive at its start:** it first checks two `ready` agents hosts; with fewer, the row is BLOCKED naming row 55, never judged on the survivor.

## Stage

- Epic: E-1534 (Pools, placement and the scheduler, under R-1530).
- Exact stage name: placement on pool hosts, waiting launches, scale up, lease and watchdog.
- Items, in plan order: T-1743 (launches placed on a pool's host), T-1744 (waiting launches), T-1745 (waiting launches survive a hub restart), T-1746 (hosts started on demand, `min_hosts` kept, scaling with `cland config set`), T-1747 (the host lease in `hub.db`, its renewal and its spend reservation), T-1748 (the detached host watchdog), T-1763 (pool hosts with running sessions keep renewing; added after A-17820). The run reads membership, counts and state from `task plan show E-1534 --json` (E1534S2-00), never from this list. QA finding fixes added after writing are listed in the request; T-1763 is the first run's.
- Policy: affected/after-stage.
- Scope: **affected.** The combined changed behaviour through the stage's named test files, the importer and preservation files they touch, read-only source checks, and scratch checks on the real CLI with created fake hosts. No earlier-epic regression pass beyond those files. Decisions: A-17473 (4: waiting launches durable in `hub.db`; 9: lease of record in `hub.db`, a per-host lease file mirrors it for the watchdog, which never opens `hub.db`; 10: renewal every min(1 h, lease / 4), lease at least 30 s; 13: the fixed timeouts and the test-only knobs, which belong to stage 3; 14: `cland host create` counts toward `max_hosts`), and the Coordinator decisions recorded on the items after the cut (below).
  - T-1743 (landed `273ddcbdd`; VERIFIED at dev `550e59ac`): `session.launch` reads the role's `pool` at each launch (`hub/src/adapters/sessions.ts`, `hub/src/host/pool-runtime.ts`); a non-`local` pool places the session on a ready member by weight, dense or spread, and the row names the host; a role bound to a pool missing from `config.toml` is refused naming the configured pools (`unknown host pool <pool>; configured pools: local, …`) before any reservation; Coordinator and Aide stay `local`; an explicit `host` pins the launch and bypasses the pool, refused `host <id> has no room` when full. `host-create-ready.test.ts`'s native case launches by role pool, not by host.
  - T-1747 (landed `77579ea01`; VERIFIED): a lease table in `hub.db` (`hub/src/host/host-leases.ts`) written before the provider's acquire with deadline create + `[hosts] lease`; the `hosts` reservation pinned before acquire, a cap refusal stopping the create with no provider call and no lease; renewal on the hub clock every min(1 h, lease / 4) while the host is in use or held by `min_hosts`; the mirror file `.cland/run/host-leases/<id>.json`, never later than the database. **Coordinator decisions:** the effective deadline is min(database, file); a failed mirror publication retries on the next tick and surfaces the typed `host-lease-publication` failure; expiry moves the record `ready` → `destroying` and runs the confirmed destroy; `cancelHostSpend` settles at zero cost only with a positive never-acquired receipt (an unknown acquisition keeps its reservation).
  - T-1748 (landed `debeaca4d`; VERIFIED; its watchdog files are byte-identical to the head `5578a77d5` first read): `hub/src/host/host-watchdog.ts` arms a detached watchdog at create (`spawn(process.execPath, [<module>, <input path>], {detached:true})`, no token in argv) whose pid identity is recorded on the lease; at the file deadline it deletes the machine and its key through the host's provider, each confirmed by a read, writes the receipt `.cland/run/host-leases/<id>.json.watchdog-receipt` (`hostWatchdogPaths`: the lease mirror path plus `.watchdog-receipt`; JSON with the captured input, `confirmedAt` and `reads`, validated by `parseHostAbsenceReceipt`, which requires a `machine` and a `key` read) and settles the host's spend under `hosts`; a renewal moves its deadline; `cland host destroy` stops it after the confirmed deletion. Re-arming after a hub restart is T-1752's.
  - T-1744 (landed `48e11d905`; VERIFIED at dev; its review changed it after the head `e45b6f194` first read): a launch no member can take with no room for a new host waits in the hub: the reply `{ waiting: { reason, since, pool } }` with no process; `cland session launch` prints `waiting: <reason>`; `cland session list` prints `<name> [<role>] pool <pool>: <reason>`; the inbox frame carries `waitingLaunches` as a status line outside needs-you; Agents gets the lifecycle kind `session-waiting` once per start, reason change and end; a second launch of a waiting name is refused (`session "<name>" is waiting for a host`); `cland session stop <name>` (and the Coordinator's new `session.stop` tool) cancels (`cancelled <name>: <reason>`); a memory-floor refusal waits as `waiting for a host: host <id>, available memory <n> bytes`. It regenerated 25 Neovim recorded fixtures (`nvim/test/fixtures/protocol-frames.json`, `live-protocol-frames.json` and 23 per-file slices under `nvim/test/fixtures/protocol-frames/`) and updated `commands.json`. **Coordinator decisions:** a waiting launch pins the pool it was admitted to (a later role default change does not move it); removing that pool ends the wait with one Agents notice; capacity changes reach waits through `Sessions.capacityChanged()` and the provision-records `onChange` seam, after commit; a memory wait retries on the agent's existing 5 s `memory` event; no polling.
  - T-1745 (landed `50f0529d2`; VERIFIED): waits are durable in `hub.db` (table `waiting_launches`, `WAITING_LAUNCH_SCHEMA`), restored once at hub start (`restoreWaitingLaunches`) with their reason and original since; placement removes the row in the same commit that publishes the process; a cancelled wait is not restored; a wait whose role or pool was removed is dropped with one Coordinator notice, and a missing notice receipt keeps the wait for a later restart. Test files `hub/test/waiting-launch-restart.test.ts` (T2) and `hub/test/waiting-launch-store.test.ts` (T1).
  - T-1746 (landed `32a5fdbf0`; VERIFIED; its files byte-identical to its reviewed head `dd1a3a59`, apart from T-1763's later edits of `pool-runtime.ts` and `pool-scale.test.ts`): the pool runtime keeps `min_hosts` from hub start (`reconcile`), and a wait the scheduler answers with `create` starts one host (`demand`), one in-flight create per pool; booting hosts count, and the wait reads `waiting for host <id> to boot` until the host is ready; `cland config set hosts.<pool>.max_hosts` re-runs placement through `configurePools`. **Coordinator decisions:** `ProvisionRecords.active()` covers the six non-terminal states (`creating`, `booting`, `connecting`, `cloning`, `ready`, `destroying`); `occupied(pool)` counts the active rows plus failed, unreleased rows unless a positive never-acquired receipt clears them (the shared `positiveNonAcquisition` parser in `hub/src/host/acquisition-receipt.ts`, which `spend.ts` now uses too); `occupied` fences `max_hosts`, and a `destroying` host counts toward the maximum but takes no placement; manual (`cland host create`) and automatic creates share one admission callback in `provision-host.ts` (`admit`, with no await before publication), which refuses `pool <pool> reached max_hosts <n>`; a ready host refused for memory but with room by weight does not start another host; demand validation (name, Lead without item, role) runs before a wait is admitted and before any row is written (`TaskWorktrees.admitWaiting`). It also edits `hub/src/hub/worktrees.ts`, `CONFIG_USAGE` and `commands.json`.
  - T-1763 (landed `550e59aca`, regression-of T-1746, added to the stage after A-17820; VERIFIED; its files byte-identical to its reviewed head `8ca8c76bd`): one lease policy for every create path. `Dispatcher.#createPoolHost` passes `inUse: id => sessions.hostInUse(id)` to `createHost`, so manual `cland host create`, the `min_hosts` startup create and on-demand scale-up share `PoolRuntime.inUse`: a host is in use while it carries a session that has not exited, holds a placement promise, or is one of the `min_hosts` ready hosts, chosen busy-first, then oldest, then by id. An idle host beyond `min_hosts` stops renewing and expires as T-1747 built it. It edits `hub/src/hub/dispatch.ts`, `hub/src/host/pool-runtime.ts`, `hub/src/adapters/sessions.ts` and `hub/test/pool-scale.test.ts` (three cases).

### Criteria map

The stage verdict carries no item or epic marks; this tells the run which check proves what. Every member: VERIFIED at dev `550e59ac`.

| criterion | proven by |
| --- | --- |
| T-1743 C1 (an Implementer bound to `agents` runs on the pool's ready fake host; `cland session list` names it) | E1534S2-10 (test `C1 pool launch uses a ready member and session list names its host`); E1534S2-11 (`host-create-ready`'s native case launches by role pool); E1534S2-52 |
| T-1743 C2 (no pool or `pool = "local"` stays local) | E1534S2-10 (test `C2 legacy and explicit local pool launches stay local`) |
| T-1743 C3 (dense to the fuller host with room; `spread = true` to the emptiest) | E1534S2-10 (test `C3 dense fills the fuller host; live spread configuration uses the emptiest`) |
| T-1743 C4 (a role bound to a missing pool refused naming the configured pools, nothing reserved or spawned) | E1534S2-10 (test `C4 missing pool refuses before reservation/spawn and names configured pools`); E1534S2-03 |
| T-1743 C5 (a role's `pool` changed in `roles.toml` moves the next launch without restart) | E1534S2-10 (test `C5 changing role pool moves the next launch without restart`) |
| T-1743 C6 (an explicit `host` pins the launch and is refused when full) | E1534S2-10 (test `C6 explicit host bypasses missing role pool but refuses a full pinned host`); E1534S2-03 |
| T-1744 C1 (full pool at `max_hosts`: waiting reply at once, `cland session list` shows the reason and no process) | E1534S2-20 (test `full pool returns a waiting reply without a process and lists the reserved name`; test `CLI prints waiting, lists its status and cancels with stop`); E1534S2-10 (test `pool with no ready member waits without spawning`); E1534S2-53 |
| T-1744 C2 (inbox status line outside needs-you, no ask) | E1534S2-20 (test `waiting inbox status is outside needs-you and cancellation frees the reserved name`); E1534S2-22 (`connection-snapshot`); E1534S2-26 (the regenerated recorded frames carry `waitingLaunches`) |
| T-1744 C3 (one Agents notice per start and reason change, none per repeated pass) | E1534S2-20 (test `memory-floor waits change reason once and recover on the next memory report`; test `a ready host leaving capacity changes a memory wait without polling`); E1534S2-03 (`session-waiting`) |
| T-1744 C4 (a session exiting on the full host places the waiting launch once) | E1534S2-20 (test `a positive exit places a waiting launch once and clears its status`; test `final ready commit wakes waits without polling`; test `positive failed-launch cleanup frees capacity without another process status`); E1534S2-27 (test `an add in the completed-pass finalizer window receives its own placement pass`) |
| T-1744 C5 (`cland session stop` cancels; a second launch of a waiting name refused naming the wait) | E1534S2-20 (test `CLI prints waiting, lists its status and cancels with stop`; test `Coordinator tools return waiting and cancel it through session.stop`; test `stop joins a waiting retry held before native admission`); E1534S2-54 |
| T-1744 C6 (a memory-floor refusal waits as "waiting for a host" and is placed on the next report above the floor) | E1534S2-20 (test `memory-floor waits change reason once and recover on the next memory report`); E1534S2-21 (`host-contract-coverage`: test `optional capacity contract covers absence, report delivery and unsubscribe with positive controls`); E1534S2-03 (the `memory` event) |
| T-1744 decisions (pinned admitted pool; a removed pool ends the wait with one notice; post-commit `capacityChanged()` and `onChange`) | E1534S2-20 (test `an accepted wait pins its admitted pool after the role default changes`; test `removing the pinned pool ends a wait once with its named notice`); E1534S2-15 (test `state observers see committed readiness and departure, isolate failures and unsubscribe`); E1534S2-03 |
| T-1745 C1 (after a restart each wait is listed again with its reason and original since) | E1534S2-40 (test `restart restores the original waiting status in session list and inbox`); E1534S2-03 |
| T-1745 C2 (a restored wait placed once; a launch placed before the stop is not restored) | E1534S2-40 (test `restored wait places once on capacity commit and placed launches never restore`; test `different-name idle reuse consumes the admitted wait at publication and never replays`; test `process publication and wait removal commit together before observers`) |
| T-1745 C3 (a wait whose role or pool was removed is dropped at start with one Coordinator line) | E1534S2-40 (the `role` and `pool` expansions of `restart drops a wait whose <removed> was removed with one Coordinator notice`; test `a missing drop-notice receipt retains the wait for a later restart`) |
| T-1745 C4 (a cancelled wait is not restored) | E1534S2-40 (test `a cancelled wait is absent after restart and its name can launch again`) |
| T-1746 C1 (`min_hosts = 1` creates one fake host at hub start with no launch) | E1534S2-41 (test `C1 startup maintains min_hosts without a launch`); E1534S2-51 |
| T-1746 C2 (a launch below `max_hosts` starts a host, waits as `waiting for host <id> to boot`, is placed when ready) | E1534S2-41 (test `C2/C4 booting counts toward max and two launches share one new host`); E1534S2-11 (test `T-1746 waiting pool launch creates a leased watchdog host and is placed`); E1534S2-20 (T-1746 moved one wait reason to `waiting for host b to boot`); E1534S2-53 |
| T-1746 C3 (`max_hosts` reached: "waiting for a host"; `config set hosts.agents.max_hosts 2` starts a second host and places the launch without restart) | E1534S2-41 (test `C3 raising max_hosts places a waiting launch without restart`); E1534S2-53 |
| T-1746 C4 (booting hosts count toward `max_hosts`; two waits that fit one host start one) | E1534S2-41 (test `C2/C4 booting counts toward max and two launches share one new host`) |
| T-1746 C5 (never above `max_hosts`) | E1534S2-41 (test `C5 overflow never exceeds max_hosts`); E1534S2-54 (host counts and the refused manual create) |
| T-1746 decisions (`active()`; `occupied()` with the shared receipt parser; `destroying` fences max and takes no placement; one admission for manual and automatic create; no create for a memory-refused host with room; demand validated before admission) | E1534S2-41 (test `destroying host fences max_hosts and takes no placement`; test `manual and automatic create race admits exactly one durable row at max_hosts`; test `memory-refused ready host with spare weight does not create another host`; test `invalid item demand cannot start a billable create`; test `Lead without item cannot persist demand or create a host`; test `invalid item-worker name cannot persist demand or create a host`; the `true` and `false` expansions of the failed-row loop); E1534S2-15 (test `active inventory reads only non-terminal rows despite retained history`; test `occupied keeps unresolved failed acquisitions and frees only positive receipts`; test `occupied rejects relative receipt dates exactly like host spend`); E1534S2-42 (test `pre-row admission refusal acquires nothing and publishes no provision record`); E1534S2-03; E1534S2-54 |
| T-1763 C1 (a host with a running session keeps renewing when another pool host appears, `min_hosts = 1`, `max_hosts = 2`) | E1534S2-41 (test `T-1763 startup and demand hosts renew running sessions after scale-up`); E1534S2-55 |
| T-1763 C2 (a host holding a placement promise renews until the promise is released) | E1534S2-41 (test `T-1763 manual host placement promise renews until failed launch releases it`) |
| T-1763 C3 (an idle host beyond `min_hosts` stops renewing; the minimum prefers hosts in use and never drops one) | E1534S2-41 (test `T-1763 minimum keeps older idle startup host when manual host appears`); E1534S2-12 (expiry and confirmed destroy unchanged) |
| T-1763 C4 (manual, startup and demand creates pass the same predicate) | E1534S2-41 (the three T-1763 cases: startup and demand, manual); E1534S2-03 (the `inUse` argument in `#createPoolHost`, `hostInUse`, `PoolRuntime.inUse`, the renewal predicate in `provision-host.ts`); E1534S2-55, E1534S2-56 |
| T-1747 C1 (the lease row exists before acquire; the hosts reservation carries the pool) | E1534S2-12 (test `lease and pinned pool reservation precede acquire; cap refusal leaves no lease`); E1534S2-03 |
| T-1747 C2 (a cap-refused create makes no provider call and leaves no lease) | E1534S2-12 (the same test; test `create cap refusal never calls acquire and destroy holds lease until both deletion reads`) |
| T-1747 C3 (renewal every min(1 h, lease / 4) while in use or held by `min_hosts`; an empty host above `min_hosts` not renewed) | E1534S2-12 (test `renewal cadence raises reservation only while in use; close drains renewal`; test `long leases renew hourly and a refused extension retains the old database and file deadline`); E1534S2-15 (test `minimum holding selects only the configured number of ready hosts in that pool`); E1534S2-55 |
| T-1747 C4 (released and settled only after confirmed deletion; unconfirmed keeps both) | E1534S2-12 (test `create cap refusal never calls acquire and destroy holds lease until both deletion reads`); E1534S2-16 (test `never-acquired receipts cancel at zero while unknown outcomes retain reservation and acquired lifetimes keep minimum`); E1534S2-14 (the `refused` and `unknown` expansions of `acquire <outcome> pins cancellation authority without confusing an unknown outcome`) |
| T-1747 C5 (the file deadline never later than the database's) and the decisions (min(db, file); next-tick publication retry with `host-lease-publication`; expiry ready → destroying → confirmed destroy) | E1534S2-12 (test `failed mirror publication retains the earlier deadline after database renewal`; test `publication retry uses effective deadline and expiry calls confirmed destruction once`; test `successful next-tick publication retry moves effective expiry beyond the old deadline`; the `malformed` and `unreadable` expansions of `published mirror <failure> is an owned typed expiry and shutdown drains`); E1534S2-03; E1534S2-55 |
| T-1748 C1 (create arms a detached watchdog whose pid identity is on the lease) | E1534S2-30 (test `host create arms a watchdog which deletes its machine after the hub stops`); E1534S2-11 (the receipt expansions of `failed readiness releases only after positive settlement: <receipt>`); E1534S2-32 (the `original`, `reused` and `null` expansions of `host watchdog stop respects captured birth: <identity>`) |
| T-1748 C2 (hub stopped, 30 s lease: the watchdog deletes machine and key, both absences confirmed, receipt written) | E1534S2-30 (test `detached watchdog outlives the lease database owner and confirms deletion at a 30 second deadline`; the hub-stopped create test); E1534S2-32 (receipt validation expansions of `absence receipt fences invalid captured <field>`; test `complete absence receipt retains the exact captured acquisition`); E1534S2-56 |
| T-1748 C3 (the watchdog's deletion settles hosts spend) | E1534S2-31 (test `watchdog follows the published renewal and confirms machine/key absence before settling hosts spend`; test `retained receipt without confirming reads cannot settle a live host`); E1534S2-56 |
| T-1748 C4 (after a renewal it does not fire at the old deadline) | E1534S2-31 (the same follow-renewal test; test `watchdog uses the earlier file deadline when database renewal publication fails`) |
| T-1748 C5 (`cland host destroy` stops the watchdog after the confirmed deletion) | E1534S2-34 (`host-destroy-native`, edited by T-1748); E1534S2-03 |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1534 --json` lists in stage `placement on pool hosts, waiting launches, scale up, lease and watchdog`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit. A task with a branch still needs its landing receipt even if the branch has no commits; a task closed `done` with no branch and no landing receipt must have no `Item:` trailer on dev (evidence-only completion). A dirty build, a missing required merge (**every member needs a landing here**) or moved dev blocks this run: retain any collected evidence and report to the requester. The brief names no run id on purpose.

At writing (dev `550e59aca718ee0e8952ce86dfdde984cfc9e33d`): T-1747 landed as `77579ea01c7d2ccc47e9aa39967d58901b83ab21`, T-1743 as `273ddcbdd485e33aa382a90efedda992ac0e6a00`, T-1748 as `debeaca4d8c0e3219bff1c3da35d007cb82b1a35`, T-1744 as `48e11d905672b5ad0a9d6fb7a811c94c71fc4af3`, T-1745 as `50f0529d2795c9b6d47e571b8ce83246fed742e1`, T-1746 as `32a5fdbf0` and T-1763 as `550e59aca718ee0e8952ce86dfdde984cfc9e33d`, each with its `Item:` trailer; their files were read at that dev (VERIFIED). **Landing check.** E1534S2-02 compares each member QA first read on a branch with its own landing commit: `T-1746 files byte-identical to dd1a3a59 at its landing <sha>: yes`, `T-1748 … 5578a77d5 …: yes`, `T-1763 … 8ca8c76bd …: yes`, and lists the commits that touched those files after the landing: `[550e59aca]` for T-1746 (T-1763, the separately landed fix, named as A-17643 requires) and `[]` for T-1748 and T-1763. A difference is named with its source (a separately landed fix with its commit, a review correction, a dev merge); the member's own lines must still match, and every changed list is re-derived (the expected-registration correction), never a silent pass. T-1762 (`ee65d6d5b`) edits `hub/src/cli/literal-rm.ts`, its usage and `commands.json`; E1534S2-24 covers the usage bytes. Every string, title and path is re-read at `<dev SHA>` and a difference recorded before judging.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step. No named file needs `web/dist`; E1534S2-01 runs the typecheck only. E1534S2-26 needs the pinned Neovim that `nvim/bin/nvim-path.ts` resolves (`NV` and `NVD` in the environment block).

**Where things live.** All scratch state is under `$Q` (`/private/tmp/q53-…`, realpath, 23 bytes; the stage-3 kit's seal accepts exactly this prefix) and `$T` (`/private/tmp/qa-e1533-s3-<uuid>`, the suite root's byte length; also the kit's prefix). Created fake hosts live under `$Q/fh/.fixture-sockets/<machine>`, behind one `/private/tmp/ct-<32 hex>` alias, recorded in `$Q/alias.txt` and removed by literal path at cleanup. The spend ledger of the scratch hub and of its watchdogs is `$Q/executor-state/spend.json`: the seal sets `CLAND_EXECUTOR_STATE` to `$Q/executor-state`, which `userStateDirectory` (`hub/src/state-paths.ts`) prefers over `XDG_STATE_HOME`; the watchdog inherits the hub's environment. The only paths under the repository are `$W` in `.cland/worktrees/` and the evidence `$EV` in `.cland/qa/E-1534/<run>/`, both ignored by Git. Nothing is written to `.cland/tasks/` of the live project.

**Isolation (rule 15).** Every scratch check runs in a disposable project p1 with its own HOME, XDG directories and Git config, through the fresh seal. Never the live project's hub, config, roles, territory, `hub.db`, secrets or discovery, and never the human's HOME (`~/.cland`, `~/.ssh`, `~/.claude`, `~/.codex`, `~/.opencode`, `~/.local/state` — **never the user's spend ledger** — `~/.config/cland`). Never read or print a credential; never run `cland config set`, `cland role launch`, `cland session …`, `cland host …` or `cland hub …` against the live project. The live hub is read only by QA's own shell for the plan read and `quiet`.

Two shells, never mixed. **QA's own shell** keeps QA's session identity: worktree, roots, `quiet`, the plan read, the source checks, the relay watcher, every record. **Every other command** runs through `$Q/fresh.mjs`: named files and the typecheck in `plain` mode (cwd `$W`), scratch rows in `hub` mode (cwd `$Q/p1`, through `body.sh`).

### Environment

Put Node from `/Users/evgeniyivanov/.nvm/versions/node/v24.21.0/bin` first on `PATH` and check `node --version` against the qa skill's `node-engines.json`. In QA's own shell (bash):

```sh
R=/Users/evgeniyivanov/Projects/cland/v0
S=<dev SHA>                                    # the full dev SHA from the request
K=273ddcbdd485e33aa382a90efedda992ac0e6a00     # the fixed kit commit (A-17643: pin a commit, never a blob)
RUN=qa-e1534s2-$(date +%F)-1                   # unique run id for E-1534; bump the suffix on a rerun
export QA_SESSION=${QA_SESSION:-${CLAND_SESSION_NAME:-}}
[ -n "$QA_SESSION" ] || echo "BLOCKED: no QA session name"
W=$R/.cland/worktrees/qa-e1534s2-$RUN
EV=$R/.cland/qa/E-1534/$RUN
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
NV=$(cd "$W" && node nvim/bin/nvim-path.ts 2> /dev/null); NVD=$(dirname "${NV:-/nonexistent/x}")
T=/private/tmp/qa-e1533-s3-$(uuidgen | tr 'A-Z' 'a-z'); mkdir -m 700 "$T"
Q=$(cd "$(mktemp -d /tmp/q53-XXXXXX)" && pwd -P); chmod 700 "$Q"
mkdir -p "$Q/home" "$Q/config" "$Q/opencode" "$Q/state" "$Q/cache" "$Q/claude" "$Q/codex" "$Q/fake-claude" "$Q/fake-codex" "$Q/fake-opencode" "$Q/executor-state" "$Q/p1" "$Q/fh" "$Q/bin" "$Q/kit"
chmod 700 "$Q/claude" "$Q/fake-claude"         # E-1532 DoD fix: Claude roots 0700
: > "$Q/pids"; : > "$Q/home/.gitconfig"; : > "$Q/home/.gitignore-global"
# The created hosts' transport shims, as the stage-3 kit and host-create-fixture.ts build them:
ln -s "$W/hub/test/fakes/fake-ssh.ts" "$Q/bin/ssh"; ln -s "$W/hub/test/fakes/fake-scp.ts" "$Q/bin/scp"
printf '#!/bin/sh\nexec "$@"\n' > "$Q/bin/setsid"
printf "#!/bin/sh\nln -s '%s/node_modules' node_modules\n" "$W" > "$Q/bin/npm"
chmod 700 "$Q/bin/setsid" "$Q/bin/npm"
printf '{"W":"%s","Q":"%s","EV":"%s","T":"%s","R":"%s","SESSION":"%s"}\n' "$W" "$Q" "$EV" "$T" "$R" "$QA_SESSION" > "$Q/state.json"
```

**The kits, from one fixed commit.** `K` above. From `qa/briefs/E-1532-stage-4.md` at `K`: `holder`, `quiet`, `ld` (lines 133 to 136) and `tap.mjs` (lines 228 to 279). From `qa/briefs/E-1533-stage-3.md` at `K`: its heredocs `seal.mjs`, `fresh.mjs`, `frame.mjs`, `body.sh` and `helpers.sh`, each taken whole by its `cat > "$Q/<name>" <<'…'` line and written to `$Q` unchanged. Not taken: its `scratch.sh`, `expect.json`, `src.mjs` and `checks.sh`, nor stage 1's (this brief writes its own). A missing kit file or block at `K` is a setup BLOCKED.

```sh
git -C "$R" show "$K:qa/briefs/E-1532-stage-4.md" > "$Q/kit/stage4.md"; git -C "$R" show "$K:qa/briefs/E-1533-stage-3.md" > "$Q/kit/stage3.md"
echo "kit commit $(git -C "$R" rev-parse "$K^{commit}") want 273ddcbdd485e33aa382a90efedda992ac0e6a00"
sed -n '133,136p' "$Q/kit/stage4.md" > "$Q/kit-shell.sh"; sed -n '228,279p' "$Q/kit/stage4.md" > "$Q/kit-tap.sh"
echo "kit first lines: $(head -n 1 "$Q/kit-shell.sh" | cut -c1-10) | $(head -n 1 "$Q/kit-tap.sh" | cut -c1-27)"
. "$Q/kit-shell.sh"; . "$Q/kit-tap.sh"
kit3() { awk -v n="$1" 'BEGIN{h="cat > \"$Q/" n "\" <<"} index($0,h)==1{f=1} f{print} f&&/^(JS|SH|JSON)$/{exit}' "$Q/kit/stage3.md"; }
for n in seal.mjs fresh.mjs frame.mjs body.sh helpers.sh; do kit3 "$n" > "$Q/kit3-$n.sh"; echo "kit3 $n: $(head -n 1 "$Q/kit3-$n.sh" | cut -c1-40) | lines $(wc -l < "$Q/kit3-$n.sh" | tr -d ' ')"; . "$Q/kit3-$n.sh"; done
node --check "$Q/tap.mjs" && node --check "$Q/seal.mjs" && node --check "$Q/fresh.mjs" && node --check "$Q/frame.mjs" && bash -n "$Q/body.sh" && bash -n "$Q/helpers.sh" && echo "kits checked"
# nt <id> <files…>: named files from $W, each in a fresh plain seal (TMPDIR=$T), one at a time, TAP; $T listed after each file; then the tap.mjs check
nt() { local id=$1 f; shift; quiet || return 1; : > "$EV/$id.log"; : > "$EV/$id.tmpdir.txt"; for f in "$@"; do ld >> "$EV/$id.log" || { tail -n 1 "$EV/$id.log"; return 1; }; node "$Q/fresh.mjs" "$W" plain node --test --test-concurrency=1 --test-reporter=tap "$f" >> "$EV/$id.log" 2>&1; echo "exit $? $f" >> "$EV/$id.log"; ls -A "$T" | sed "s|^|$f: |" >> "$EV/$id.tmpdir.txt"; done; node "$Q/tap.mjs" check "$EV/$id.log" "$Q/expect.json" | tee "$EV/$id.check.txt"; }
# pl <id> <files…>: nt under the preservation lock
pl() {
  if ! mkdir /tmp/cland-preserve.lock 2> /dev/null; then echo "BLOCKED: /tmp/cland-preserve.lock is held: $(cat /tmp/cland-preserve.lock/owner 2> /dev/null || echo 'no owner file')"; return 1; fi
  printf 'qa %s %s pid %s %s\n' "$RUN" "$1" "$$" "$(date -u +%FT%TZ)" > /tmp/cland-preserve.lock/owner
  nt "$@"; local x=$?
  if [ "$(cut -d' ' -f1-3 /tmp/cland-preserve.lock/owner 2> /dev/null)" = "qa $RUN $1" ]; then rm /tmp/cland-preserve.lock/owner && rmdir /tmp/cland-preserve.lock && echo "preservation lock released"; else echo "FINDING: preservation lock owner changed during $1; lock left in place"; fi
  return $x
}
# mrow <id> <function>: one scratch row in a fresh hub seal, cwd p1, after cover-quiet admission and the load gate
mrow() { quiet || return 2; { ld; node "$Q/fresh.mjs" "$Q/p1" hub /bin/bash "$Q/body.sh" "$2"; echo "row exit $?"; } > "$EV/$1.txt" 2>&1; tail -n 1 "$EV/$1.txt"; }
```

Expected: `kit commit` equal to `want`; `kit first lines: holder() { | cat > "$Q/tap.mjs" <<'JS'`; each `kit3` line starts with `cat > "$Q/<name>" <<'` and has more than two lines; `kits checked`.

The S0 environment prints, each through its own fresh seal:

```sh
for m in plain hub; do node "$Q/fresh.mjs" "$Q" "$m" node -e 'const fs=require("fs"),os=require("os"),path=require("path");const e=process.env,h=os.userInfo().homedir,real=p=>{try{return fs.realpathSync(p)}catch{return p}};const allowed=new Set([real(path.dirname(process.execPath)),real(process.argv[1])]);console.log(process.argv[2]+": credential-prefix names "+Object.keys(e).filter(k=>/^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|CODEX_API|CODEX_ACCESS|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)/.test(k)).length+"; QA_SESSION "+(e.QA_SESSION?"set":"unset")+"; TMPDIR is T "+(e.TMPDIR===e.QA_T)+"; HOME is Q/home "+(e.HOME===e.QA_Q+"/home")+"; XDG_STATE_HOME is Q/state "+(e.XDG_STATE_HOME===e.QA_Q+"/state")+"; CLAND_EXECUTOR_STATE is Q/executor-state "+(e.CLAND_EXECUTOR_STATE===e.QA_Q+"/executor-state")+"; real-HOME PATH entries other than the Node bin and the pinned Neovim directory "+e.PATH.split(":").filter(p=>p.startsWith("~")||((p===h||p.startsWith(h+"/"))&&!allowed.has(real(p)))).length)' "$NVD" "$m"; done 2>&1 | tee "$EV/S0-env.txt"
echo "Q bytes $(printf '%s' "$Q" | wc -c | tr -d ' '); T bytes $(printf '%s' "$T" | wc -c | tr -d ' '); a suite root for comparison $(printf '%s' "/private/tmp/cland-suite-$(uuidgen | tr 'A-Z' 'a-z')" | wc -c | tr -d ' ')" | tee -a "$EV/S0-env.txt"
```

Expected (recorded as `S0`): `kits checked`; both modes `credential-prefix names 0`, `QA_SESSION set`, TMPDIR, HOME, `XDG_STATE_HOME is Q/state` and `CLAND_EXECUTOR_STATE is Q/executor-state` `true`, `0` real-HOME entries, each `# fresh: redacted or withheld lines 0`; `Q bytes 23`, `T bytes` equal to the suite root's. A non-zero credential count stops the run (BLOCKED).

The TAP expectations. `exact: true` lists every registration; `exact: false` lists the names that prove a criterion (the rest of the file must still pass); `[]` means the whole file must be `CLEAN`. Lists were read at dev `550e59ac` (VERIFIED), including T-1763's three `pool-scale` cases; T-1763 added none to `host-lease`. Generated names are expanded from their loop arrays. Re-derive every touched list at `<dev SHA>` before E1534S2-10 (the expected-registration correction).

```sh
cat > "$Q/expect.json" <<'JSON'
{
 "hub/test/session-pool-placement.test.ts": {"exact": false, "names": [
  "C1 pool launch uses a ready member and session list names its host",
  "C2 legacy and explicit local pool launches stay local",
  "C3 dense fills the fuller host; live spread configuration uses the emptiest",
  "C4 missing pool refuses before reservation/spawn and names configured pools",
  "C5 changing role pool moves the next launch without restart",
  "C6 explicit host bypasses missing role pool but refuses a full pinned host",
  "pool with no ready member waits without spawning"]},
 "hub/test/host-create-ready.test.ts": {"exact": false, "names": [
  "C1/C2 create reaches ready with clone and tunnel and runs OpenCode; list shows declared facts",
  "failed readiness releases only after positive settlement: unknown",
  "failed readiness releases only after positive settlement: inventory unknown",
  "failed readiness releases only after positive settlement: timed out",
  "failed readiness releases only after positive settlement: leftovers",
  "failed readiness releases only after positive settlement: complete",
  "T-1746 waiting pool launch creates a leased watchdog host and is placed"]},
 "hub/test/host-lease.test.ts": {"exact": true, "names": [
  "lease and pinned pool reservation precede acquire; cap refusal leaves no lease",
  "renewal cadence raises reservation only while in use; close drains renewal",
  "create cap refusal never calls acquire and destroy holds lease until both deletion reads",
  "registry shutdown joins a ledger-blocked renewal before database close",
  "long leases renew hourly and a refused extension retains the old database and file deadline",
  "failed mirror publication retains the earlier deadline after database renewal",
  "publication retry uses effective deadline and expiry calls confirmed destruction once",
  "successful next-tick publication retry moves effective expiry beyond the old deadline",
  "initial lease-db failure preserves admission ownership and never leaks a reservation",
  "initial mirror failure preserves admission ownership and never leaks a reservation",
  "initial provision-db failure preserves admission ownership and never leaks a reservation",
  "pre-acquire callback failure cancels the pinned reservation at zero",
  "ledger-held admission past its deadline never acquires or publishes ready",
  "published mirror malformed is an owned typed expiry and shutdown drains",
  "published mirror unreadable is an owned typed expiry and shutdown drains",
  "unknown acquisition cannot cancel its durable owned reservation",
  "forced early body exit joins held admission before storage closes"]},
 "hub/test/host-provision-gate.test.ts": {"exact": false, "names": [
  "never-booting creation releases at exactly 300000 ms on the hub clock",
  "acquire refused pins cancellation authority without confusing an unknown outcome",
  "acquire unknown pins cancellation authority without confusing an unknown outcome"]},
 "hub/test/host-provision-records.test.ts": {"exact": false, "names": [
  "minimum holding selects only the configured number of ready hosts in that pool",
  "state observers see committed readiness and departure, isolate failures and unsubscribe",
  "active inventory reads only non-terminal rows despite retained history",
  "occupied keeps unresolved failed acquisitions and frees only positive receipts",
  "idle pool close stays synchronous for construction rollback",
  "occupied rejects relative receipt dates exactly like host spend",
  "occupied decodes only unreleased anomalies after 10000 released or destroyed records"]},
 "hub/test/host-spend.test.ts": {"exact": false, "names": [
  "never-acquired receipts cancel at zero while unknown outcomes retain reservation and acquired lifetimes keep minimum"]},
 "hub/test/executor-spend.test.ts": {"exact": false, "names": []},
 "hub/test/executor-safety.test.ts": {"exact": false, "names": []},
 "hub/test/executor-watchdog.test.ts": {"exact": false, "names": []},
 "hub/test/waiting-launch.test.ts": {"exact": true, "names": [
  "full pool returns a waiting reply without a process and lists the reserved name",
  "waiting inbox status is outside needs-you and cancellation frees the reserved name",
  "a positive exit places a waiting launch once and clears its status",
  "final ready commit wakes waits without polling",
  "memory-floor waits change reason once and recover on the next memory report",
  "a ready host leaving capacity changes a memory wait without polling",
  "CLI prints waiting, lists its status and cancels with stop",
  "a placed waiting launch admits its credential-proven early hello",
  "stop joins a waiting retry held before native admission",
  "Coordinator tools return waiting and cancel it through session.stop",
  "capacity released between selection failure and wait insertion is rechecked",
  "failed unpublished placement releases its promise and wakes a waiting launch",
  "cancelling idle B does not join unrelated held retry A",
  "shutdown closes the registered adapter before joining its held waiting retry",
  "positive failed-launch cleanup frees capacity without another process status",
  "retained-generation positive closure wakes a launch after the earlier exit",
  "an admitted Coordinator wait survives its requesting spoke disconnecting",
  "an admitted wait rechecks its durable actor grant after disconnect",
  "an accepted wait pins its admitted pool after the role default changes",
  "removing the pinned pool ends a wait once with its named notice"]},
 "hub/test/waiting-launches-owner.test.ts": {"exact": true, "names": [
  "an add in the completed-pass finalizer window receives its own placement pass"]},
 "hub/test/host-contract-coverage.test.ts": {"exact": false, "names": [
  "optional capacity contract covers absence, report delivery and unsubscribe with positive controls"]},
 "hub/test/connection-snapshot.test.ts": {"exact": false, "names": []},
 "hub/test/host-agent.test.ts": {"exact": false, "names": []},
 "hub/test/tool-arguments.test.ts": {"exact": false, "names": []},
 "hub/test/inbox-requests.test.ts": {"exact": false, "names": []},
 "hub/test/inbox-actions.test.ts": {"exact": false, "names": []},
 "hub/test/cli-usage-compatibility.test.ts": {"exact": false, "names": [
  "all command usage exports retain their pre-refactor bytes"]},
 "hub/test/cli-command-help.test.ts": {"exact": false, "names": []},
 "hub/test/cli-help.test.ts": {"exact": false, "names": []},
 "hub/test/roles-clauses.test.ts": {"exact": false, "names": []},
 "hub/test/roles-editor.test.ts": {"exact": false, "names": []},
 "hub/test/roles-launch-permissions.test.ts": {"exact": false, "names": []},
 "hub/test/roles.test.ts": {"exact": false, "names": []},
 "hub/test/spoke-lazy-tools.test.ts": {"exact": false, "names": []},
 "hub/test/session-archive.test.ts": {"exact": false, "names": []},
 "hub/test/nvim-fixture-boundary.test.ts": {"exact": false, "names": []},
 "nvim/test/scenarios/workbench.test.ts": {"exact": false, "names": []},
 "nvim/test/inbox-requests.test.ts": {"exact": false, "names": []},
 "nvim/test/inbox-actions.test.ts": {"exact": false, "names": []},
 "nvim/test/needs-you.test.ts": {"exact": false, "names": []},
 "nvim/test/sessions.test.ts": {"exact": false, "names": []},
 "hub/test/host-watchdog.test.ts": {"exact": true, "names": [
  "detached watchdog outlives the lease database owner and confirms deletion at a 30 second deadline",
  "host create arms a watchdog which deletes its machine after the hub stops"]},
 "hub/test/host-watchdog-loop.test.ts": {"exact": true, "names": [
  "watchdog follows the published renewal and confirms machine/key absence before settling hosts spend",
  "watchdog uses the earlier file deadline when database renewal publication fails",
  "retained receipt without confirming reads cannot settle a live host",
  "receipt publication conflict preserves the first bound absence and fences a mismatched machine",
  "unknown recovered watchdog retains its input and lease identity without signals"]},
 "hub/test/host-watchdog-identity.test.ts": {"exact": true, "names": [
  "host watchdog stop respects captured birth: original",
  "host watchdog stop respects captured birth: reused",
  "host watchdog stop respects captured birth: null",
  "absence receipt fences invalid captured root",
  "absence receipt fences invalid captured host",
  "absence receipt fences invalid captured provider",
  "absence receipt fences invalid captured machine",
  "absence receipt fences invalid captured birth",
  "absence receipt fences invalid captured address",
  "absence receipt fences invalid captured architecture",
  "absence receipt fences invalid captured empty",
  "absence receipt fences invalid captured missingKey",
  "absence receipt fences invalid captured blankRead",
  "absence receipt fences invalid captured badDate",
  "absence receipt fences invalid captured earlyDate",
  "complete absence receipt retains the exact captured acquisition"]},
 "hub/test/host-watchdog-drain.test.ts": {"exact": true, "names": [
  "fixture drain attempts later owners and census after a failed stop, retaining an unknown root",
  "fixture drain accepts positive closure after fallback cleanup while preserving the original failure"]},
 "hub/test/host-destroy-native.test.ts": {"exact": false, "names": [
  "C1/C2/C3 destroy settles native session after confirming deletion; tunnel down=false",
  "C1/C2/C3 destroy settles native session after confirming deletion; tunnel down=true",
  "destroy joins an admitted held acquisition and prevents ready resurrection"]},
 "hub/test/host-ssh-contract.test.ts": {"exact": false, "names": [
  "ssh Host runs every shared Host behavioral contract through fake ssh"]},
 "hub/test/startup-cleanup.test.ts": {"exact": false, "names": []},
 "hub/test/host-scheduler.test.ts": {"exact": false, "names": []},
 "hub/test/host-pools-config.test.ts": {"exact": false, "names": []},
 "hub/test/host-provider-fake.test.ts": {"exact": false, "names": []},
 "hub/test/waiting-launch-restart.test.ts": {"exact": true, "names": [
  "restart restores the original waiting status in session list and inbox",
  "a cancelled wait is absent after restart and its name can launch again",
  "restart drops a wait whose role was removed with one Coordinator notice",
  "restart drops a wait whose pool was removed with one Coordinator notice",
  "restored wait places once on capacity commit and placed launches never restore",
  "restart retains the admitted actor identity and refuses its revoked grant",
  "a missing drop-notice receipt retains the wait for a later restart",
  "restart rechecks a human launch target against newly added user names",
  "restart preserves typed memory evidence until a fresh host memory report",
  "restart preserves the captured inferred role check",
  "different-name idle reuse consumes the admitted wait at publication and never replays"]},
 "hub/test/waiting-launch-store.test.ts": {"exact": true, "names": [
  "process publication and wait removal commit together before observers"]},
 "hub/test/pool-scale.test.ts": {"exact": true, "names": [
  "C1 startup maintains min_hosts without a launch",
  "C2/C4 booting counts toward max and two launches share one new host",
  "C3 raising max_hosts places a waiting launch without restart",
  "C5 overflow never exceeds max_hosts",
  "destroying host fences max_hosts and takes no placement",
  "manual and automatic create race admits exactly one durable row at max_hosts",
  "invalid item demand cannot start a billable create",
  "failed pending acquisition holds max across config and restart",
  "failed incomplete release holds max across config and restart",
  "lowered max is rechecked after asynchronous preparation before row admission",
  "cancelled durable demand cannot publish a host after preparation",
  "removed pool is rechecked before a prepared creator publishes its row",
  "Lead without item cannot persist demand or create a host",
  "invalid item-worker name cannot persist demand or create a host",
  "removed custom role cannot publish a host after held image preparation",
  "memory-refused ready host with spare weight does not create another host",
  "T-1763 startup and demand hosts renew running sessions after scale-up",
  "T-1763 manual host placement promise renews until failed launch releases it",
  "T-1763 minimum keeps older idle startup host when manual host appears"]},
 "hub/test/host-create-admission.test.ts": {"exact": false, "names": [
  "pre-row admission refusal acquires nothing and publishes no provision record"]},
 "hub/test/task-worktrees.test.ts": {"exact": false, "names": []},
 "hub/test/lead-launch.test.ts": {"exact": false, "names": []},
 "hub/test/launch-admission.test.ts": {"exact": false, "names": []},
 "hub/test/test-docs.test.ts": {"exact": false, "names": []},
 "hub/test/suite-tiers.test.ts": {"exact": false, "names": []}
}
JSON
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("expect checked")' "$Q/expect.json"
```

The source checks (`src.mjs`), counted with `String.split` at the build:

```sh
cat > "$Q/src.mjs" <<'JS'
// node "$Q/src.mjs" <W>   ok or MISMATCH per line (VERIFIED at 550e59ac)
import { readFileSync, existsSync } from 'node:fs';
const W = process.argv[2];
const read = f => existsSync(`${W}/${f}`) ? readFileSync(`${W}/${f}`, 'utf8') : null;
const PR = 'hub/src/host/pool-runtime.ts', LE = 'hub/src/host/host-leases.ts', PH = 'hub/src/host/provision-host.ts', SP = 'hub/src/executor/droplet/spend.ts', SE = 'hub/src/adapters/sessions.ts', WD = 'hub/src/host/host-watchdog.ts', SCH = 'hub/src/host/scheduler.ts', CLI = 'hub/src/cli/session.ts', PRC = 'hub/src/host/provision-records.ts', DI = 'hub/src/hub/dispatch.ts';
const C = [
  // T-1743
  ['T-1743 C4 a missing pool names the configured pools', PR, "throw new Error(`unknown host pool ${name}; configured pools: local, ${Object.keys(settings.pools).join(', ')}`);", '=1'],
  ['T-1743 C6 a pinned host without room is refused', PR, '`host ${pinned} has no room`', '=1'],
  ['T-1743 C1/C5 and T-1744 decision: the role pool read per launch, a wait keeps its admitted pool', SE, "const pool = resumed(() => request[waitingPool] ?? (role ? this.#core.roles?.get().get(role)?.launch.pool ?? 'local' : 'local'));", '=1'],
  // T-1747
  ['T-1747 decision: effective deadline is min(database, file)', LE, 'const deadline=new Date(Math.min(Date.parse(row.deadline),Date.parse(file?.deadline??row.created))).toISOString();', '=1'],
  ['T-1747 decision: typed publication failure', LE, "readonly code='host-lease-publication';", '=1'],
  ['T-1747 C3 renewal every min(1 h, lease / 4)', LE, 'Math.min(3600000,o.leaseMs/4)', '>=1'],
  ['T-1747 the 30 s lease floor', LE, "throw Error('host lease must be at least 30s');", '=1'],
  ['T-1747 C5 the mirror file path', LE, "return join(root,'.cland/run/host-leases',id+'.json');", '=1'],
  ['T-1747 C1 the lease before acquire', PH, 'await o.records.leases.create(record.id,leaseOptions);admitted=true;', '=1'],
  ['T-1747 C3 in use or held by min_hosts', PH, 'o.records.provisions.heldByMinimum(record.id,pool,config.minHosts)', '=1'],
  ['T-1747 decision: zero-cost cancel needs a never-acquired receipt', SP, 'export async function cancelHostSpend(identity:{project:string;lease:string},receipt:HostNonAcquisitionReceipt,', '=1'],
  // the scheduler's two wait reasons (T-1740), used by T-1744 and T-1746
  ['T-1746 C2 the boot wait reason', SCH, 'waiting for host ${booting.id} to boot', '=1'],
  ['T-1744/T-1746 the full-pool wait reason', SCH, "reason: 'waiting for a host'", '>=1'],
  // T-1748
  ['T-1748 C1 the detached launch, no token in argv', WD, "spawn(process.execPath,[fileURLToPath(import.meta.url),path],{env,detached:true,stdio:'ignore'})", '=1'],
  ['T-1748 C2 the receipt beside the lease mirror', WD, "return {input:base+'.watchdog-input',receipt:base+'.watchdog-receipt'};", '=1'],
  ['T-1748 C3 settlement after the receipt', WD, 'await settleHostSpend(input.root,input.id,receipt.confirmedAt,env,{clock});', '=1'],
  ['T-1748 C2 a receipt needs machine and key reads', WD, "!row.reads.some(read=>read.resource==='machine')||!row.reads.some(read=>read.resource==='key'))throw Error('invalid host absence receipt');", '=1'],
  // T-1744
  ['T-1744 C1 the CLI waiting line', CLI, 'if (v.waiting) { out(v, `waiting: ${v.waiting.reason}`); return 0; }', '=1'],
  ['T-1744 C5 the CLI cancel line', CLI, 'if (v.cancelled) { out(v, `cancelled ${v.cancelled.name}: ${v.cancelled.reason}`); return 0; }', '=1'],
  ['T-1744 C5 a second launch of a waiting name', SE, 'throw new Error(`session "${request.name}" is waiting for a host`);', '>=1'],
  ['T-1744 C6 the memory wait reason', SE, '`waiting for a host: host ${cause.host}, available memory ${cause.availableBytes} bytes`', '=1'],
  ['T-1744 C3 the Agents lifecycle kind', 'hub/src/hub/agents-topic.ts', "'session-waiting'", '>=1'],
  ['T-1744 decision: capacity after the provision-records commit', SE, 'this.#core.store.hosts.provisions.onChange((id, _previous, state) =>', '=1'],
  ['T-1744 decision: a memory wait retries on the agent memory event', 'hub/src/host/ssh-host.ts', "if(frame.event==='memory'){for(const listener of capacityListeners)", '=1'],
  // T-1745
  ['T-1745 waits durable in hub.db', 'hub/src/adapters/waiting-launches.ts', "export const WAITING_LAUNCH_SCHEMA = 'create table if not exists waiting_launches (name text primary key, value text not null);';", '=1'],
  ['T-1745 C1 restored once at hub start', 'hub/src/hub/daemon.ts', 'hub.dispatcher.restoreWaitingLaunches();', '=1'],
  // T-1746
  ['T-1746 decision: active() is the six non-terminal states', PRC, "export const ACTIVE_PROVISION_STATES: readonly ProvisionState[] = ['creating','booting','connecting','cloning','ready','destroying'];", '=1'],
  ['T-1746 decision: occupied() keeps failed rows without a positive receipt', PRC, 'if(record.machine||record.acquisition||!record.nonAcquisition||!positiveNonAcquisition(record.nonAcquisition))count++;', '=1'],
  ['T-1746 decision: spend shares the receipt parser', SP, " if(!positiveNonAcquisition(receipt))throw Error('positive non-acquisition receipt required');", '=1'],
  ['T-1746 decision: one admission checkpoint for every creator', PH, '// No await between admission and publication: all creators serialize at this checkpoint.', '=1'],
  ['T-1746 C5 and decision 14: occupied fences max_hosts at admission', DI, 'if(this.core.store.hosts.provisions.occupied(name)>=pool.maxHosts)throw new Error(`pool ${name} reached max_hosts ${pool.maxHosts}`);', '=1'],
  ['T-1746 decision: manual create uses the same admission', DI, "host.list'?listHosts(core.store.hosts,env):this.#createPoolHost(frame.pool)", '=1'],
  ['T-1746 decision: destroying counts toward max but not toward minimum capacity', PR, "const capacity = rows.filter(row => row.state !== 'destroying').length;", '=1'],
  ['T-1746 decision: item demand validated before admission', DI, 'return this.#worktrees.admitWaiting({...request,item:request.item},authorize);', '=1'],
  // T-1763: one in-use predicate for every create path
  ['T-1763 C4 every creator passes the shared predicate', DI, '{inUse:id=>this.#sessions?.hostInUse(id) ?? false,', '=1'],
  ['T-1763 C4 Sessions delegates to the pool runtime', SE, 'hostInUse(id: string): boolean { return this.#poolRuntime?.inUse(id) ?? false; }', '=1'],
  ['T-1763 C1/C2 the pool runtime predicate', PR, '/** One lease policy for manual, minimum and demand-created hosts. */', '=1'],
  ['T-1763 C3 the minimum prefers busy, then older hosts', PR, 'candidates.sort((a, b) => Number(busy.has(b.id)) - Number(busy.has(a.id)) || a.created.localeCompare(b.created) || a.id.localeCompare(b.id));', '=1'],
  ['T-1763 renewal uses the predicate, heldByMinimum only without one', PH, '(o.inUse?.(record.id)??o.records.provisions.heldByMinimum(record.id,pool,config.minHosts))', '=1'],
];
for (const [label, file, text, e] of C) {
  const t = read(file), n = t === null ? 'MISSING' : t.split(text).length - 1;
  const pass = t !== null && (e.startsWith('>=') ? n >= Number(e.slice(2)) : n === Number(e.slice(1)));
  console.log(`${pass ? 'ok' : 'MISMATCH'} ${label} | ${file} | ${n} | ${e}`);
}
JS
node --check "$Q/src.mjs" && echo "src checked"
```

`relays.mjs` stands in for sshd's TCP forwarding on every fake host that appears during the run (the E-1533 DoD's validated `relay.mjs`, generalised to on-demand hosts; OBSERVED serving both created hosts in the first run). It writes each host's `ports.json` before any launch reaches it, which also satisfies A-17643's "call `ports()` before launching through a created host":

```sh
cat > "$Q/relays.mjs" <<'JS'
// node "$Q/relays.mjs" <fakeHostRoot> <log> <pidFile>: for every fake-* host directory under <root>/.fixture-sockets, write ports.json
// (every loopback port to relay/<port>.sock) once, and for every port its fake OpenCode records in serve-ports.jsonl, listen on
// <home>/relay/<port>.sock and pipe each connection to 127.0.0.1:<port>. sshd's direct-tcpip, which the fake ssh lacks; no hub code is touched.
import { readdirSync, readFileSync, mkdirSync, existsSync, writeFileSync, appendFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import net from 'node:net';
const [root, log, pidFile] = process.argv.slice(2);
writeFileSync(pidFile, String(process.pid));
const base = join(root, '.fixture-sockets'), open = new Set(), mapped = new Set();
const files = d => { const out = []; for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory() && e.name !== 'node_modules' && !e.isSymbolicLink()) out.push(...files(p)); else if (e.name === 'serve-ports.jsonl') out.push(p); } return out; };
const tick = () => {
  let hosts = [];
  try { hosts = readdirSync(base).filter(n => n.startsWith('fake-')).map(n => realpathSync(join(base, n))); } catch {}
  for (const dir of hosts) {
    if (!mapped.has(dir)) {
      if (!existsSync(join(dir, 'ports.json'))) { const m = {}; for (let p = 1024; p < 65536; p++) m[p] = `relay/${p}.sock`; writeFileSync(join(dir, 'ports.json'), JSON.stringify(m)); appendFileSync(log, `ports map ${dir}\n`); }
      mapped.add(dir);
    }
    const relay = join(dir, 'home', 'relay');
    let ports = [];
    try { for (const f of files(dir)) ports.push(...readFileSync(f, 'utf8').split('\n').filter(Boolean).map(Number)); } catch {}
    for (const p of ports) {
      const key = `${dir}:${p}`;
      if (!(p > 0) || open.has(key) || !existsSync(join(dir, 'home'))) continue;
      open.add(key); mkdirSync(relay, { recursive: true, mode: 0o700 });
      net.createServer(a => { const b = net.createConnection({ host: '127.0.0.1', port: p }); a.pipe(b).pipe(a); a.on('error', () => b.destroy()); b.on('error', () => a.destroy()); })
        .listen(join(relay, `${p}.sock`), () => appendFileSync(log, `relay ${dir} ${p}.sock -> 127.0.0.1:${p}\n`));
    }
  }
};
setInterval(tick, 100); tick();
JS
node --check "$Q/relays.mjs" && echo "relays checked"
# rstart / rstop: the relay watcher, sealed, in the background, owned by QA's own shell
rstart() { : > "$Q/relay.log"; ( node "$Q/fresh.mjs" "$Q" plain node "$Q/relays.mjs" "$Q/fh" "$Q/relay.log" "$Q/relay.pid" > "$Q/relay.out" 2>&1 & ); for i in $(seq 1 20); do [ -s "$Q/relay.pid" ] && break; sleep 0.5; done; echo "relay watcher pid $(cat "$Q/relay.pid" 2> /dev/null || echo none)"; }
rstop() { p=$(cat "$Q/relay.pid" 2> /dev/null); c=$(ps -o command= -p "$p" 2> /dev/null); if [ -n "$p" ] && [ "${c#*"$Q/relays.mjs"}" != "$c" ]; then kill -TERM "$p"; sleep 1; fi; echo "relay watcher alive $(kill -0 "$p" 2> /dev/null && echo yes || echo no)"; }
```

The check functions for QA's own shell, and the scratch functions (body.sh sources `helpers.sh` and this `scratch.sh`):

```sh
cat > "$Q/checks.sh" <<'SH'
landing() { git -C "$W" log --first-parent --format=%H --grep "^Item: $1\$" "$S"; }
# preserved: test files no stage-2 landing may edit
preserved() { printf '%s\n' hub/test/executor-spend.test.ts hub/test/executor-safety.test.ts hub/test/executor-watchdog.test.ts hub/test/host-ssh-contract.test.ts hub/test/startup-cleanup.test.ts hub/test/inbox-requests.test.ts hub/test/inbox-actions.test.ts hub/test/host-provider-fake.test.ts hub/test/host-scheduler.test.ts hub/test/host-pools-config.test.ts; }
MEMBERS="T-1743 T-1744 T-1745 T-1746 T-1747 T-1748 T-1763"
s00() {   # build, plan and landing receipts
  echo "PRE HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) request $S"
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
  git -C "$R" status --porcelain | grep -v ' \.cland/tasks/' > "$EV/root-status-before.txt"; echo "root non-tracker entries $(wc -l < "$EV/root-status-before.txt" | tr -d ' ')"
  (cd "$R" && node "$W/hub/bin/cland.ts" task plan show E-1534 --json) > "$EV/plan.json"; echo "plan read exit $?"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=(v.stages??[]).find(x=>x.name==="placement on pool hosts, waiting launches, scale up, lease and watchdog");console.log(s?JSON.stringify({name:s.name,state:s.state,qa:s.qa,items:s.items,merged:s.merged,total:s.total,statuses:s.statuses}):"stage missing")' "$EV/plan.json" | tee "$EV/stage-members.json"
  for id in $(node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log((v.items??[]).join(" "))' "$EV/stage-members.json"); do echo "$id landings $(landing "$id" | wc -l | tr -d ' ') $(landing "$id" | head -n 1)"; done
}
s01() { node "$Q/fresh.mjs" "$W" plain node --version; node "$Q/fresh.mjs" "$W" plain npm run typecheck > "$EV/typecheck.log" 2>&1; echo "typecheck exit $?"; echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"; }
s02() {   # landing diffs (read-only) and the landing check for members read on a branch
  for id in $MEMBERS; do L=$(landing "$id" | head -n 1); echo "$id landing ${L:-none}"; [ -n "$L" ] || continue
    echo "$id test paths: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- hub/test | tr '\n' ' ')"
    echo "$id product paths: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- hub/src shared | tr '\n' ' ')"
    echo "$id package.json and lockfiles: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- package.json package-lock.json hub/package.json web/package.json | wc -l | tr -d ' ')"
    echo "$id preserved files edited at its landing: [$(git -C "$W" diff --name-only "${L}^1" "${L}" -- $(preserved) | tr '\n' ' ')]"
  done
  echo "commits after 4360256ac touching preserved files: [$(git -C "$W" log --format=%h 4360256ac.."$S" -- $(preserved) | tr '\n' ' ')]"
  F48="hub/test/host-watchdog.test.ts hub/test/host-watchdog-loop.test.ts hub/test/host-watchdog-identity.test.ts hub/test/host-watchdog-drain.test.ts hub/test/host-watchdog-drain.ts hub/src/host/host-watchdog.ts"
  F46="hub/test/pool-scale.test.ts hub/test/host-provision-records.test.ts hub/test/host-create-admission.test.ts hub/test/host-create-ready.test.ts hub/test/waiting-launch.test.ts hub/src/host/pool-runtime.ts hub/src/host/provision-records.ts hub/src/host/acquisition-receipt.ts hub/src/host/provision-host.ts"
  F63="hub/test/pool-scale.test.ts hub/src/host/pool-runtime.ts hub/src/hub/dispatch.ts hub/src/adapters/sessions.ts"
  for pair in "T-1746 dd1a3a59 $F46" "T-1748 5578a77d5 $F48" "T-1763 8ca8c76bd $F63"; do set -- $pair; id=$1; head=$2; shift 2; L=$(landing "$id" | head -n 1)
    echo "$id files byte-identical to $head at its landing ${L:-none}: $( [ -n "$L" ] && git -C "$W" diff --quiet "$head" "$L" -- "$@" && echo yes || echo "no: $(git -C "$W" diff --name-only "$head" "${L:-$S}" -- "$@" | tr '\n' ' ')")"
    echo "$id files changed after its landing: [$( [ -n "$L" ] && git -C "$W" log --format=%h "$L..$S" -- "$@" | tr '\n' ' ')]"; done
}
s59() {   # end check with $Q and $T still present (cleanup order)
  echo "POST HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) request $S"
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
  git -C "$R" status --porcelain | grep -v ' \.cland/tasks/' > "$EV/root-status-after.txt"; echo "root non-tracker status unchanged: $(cmp -s "$EV/root-status-before.txt" "$EV/root-status-after.txt" && echo yes || echo no)"
  echo "preservation lock present: $([ -e /tmp/cland-preserve.lock ] && echo "yes: $(cat /tmp/cland-preserve.lock/owner 2> /dev/null)" || echo no)"
  A=$(cat "$Q/alias.txt" 2> /dev/null); echo "scratch fixture alias: ${A:-none recorded} $([ -n "$A" ] && { [ -L "$A" ] && echo present || echo gone; })"
  echo "T entries other than node-compile-cache: $(ls -A "$T" | grep -v -c -x node-compile-cache)"
  for e in $(ls -A "$T" | grep -v -x node-compile-cache); do echo "  T: $e type $(stat -f %HT "$T/$e") open $(lsof -t "$T/$e" 2> /dev/null | wc -l | tr -d ' ') first seen after $(awk -v e="$e" -F': ' '$2==e{print $1; exit}' $(ls "$EV"/*.tmpdir.txt) /dev/null)"; done
}
SH
cat > "$Q/scratch.sh" <<'SH'
# hcnt <text>: occurrences of the exact text inside p1's [hosts] table and its subtables only (A-17643 counter scope)
hcnt() { node -e 'const t=require("fs").readFileSync(".cland/config.toml","utf8");let on=false,n=0;for(const l of t.split("\n")){if(/^\[/.test(l))on=/^\[hosts(\.|\])/.test(l);if(on)n+=l.split(process.argv[1]).length-1}console.log(n)' "$1"; }
# swap <old> <new>: replace exactly one occurrence in p1's config.toml, or refuse
swap() { node -e 'const fs=require("fs"),f=".cland/config.toml",t=fs.readFileSync(f,"utf8"),[a,b]=process.argv.slice(1);if(t.split(a).length!==2){console.log("swap refused: not exactly one "+JSON.stringify(a));process.exit(1)}fs.writeFileSync(f,t.replace(a,b));console.log("swapped "+JSON.stringify(a))' "$1" "$2"; }
# hosts: the agents rows of `cland host list` as "id state machine" lines; hready: how many are ready
hosts() { cland host list > "$QA_Q/hl.out" 2>&1; node -e 'let v=[];try{v=JSON.parse(require("fs").readFileSync(process.env.QA_Q+"/hl.out","utf8"))}catch{}for(const r of v.filter(r=>r.pool==="agents"))console.log(r.id+" "+r.state+" "+(r.machine?.id??"none"))'; }
hready() { hosts | grep -c ' ready '; }
# waitfor <seconds> <function> [args]: call it every 2 s in this shell until it prints a line, then print that line
waitfor() { local s=$1 o i; shift; for i in $(seq 1 $((s / 2))); do o=$("$@"); [ -n "$o" ] && { echo "$o"; return 0; }; sleep 2; done; return 1; }
# the poll conditions waitfor calls (shell functions, so `cland` and `srow` resolve)
oneready() { [ "$(hready)" -ge 1 ] && echo ready; }
running() { srow "$1" | grep 'status=running'; }
bootwait() { cland session list 2>&1 | grep -E "^$1 \[implementer\] pool agents: waiting for host [^ ]+ to boot"; }
deleted() { [ "$(cat "$1/gone" 2> /dev/null)" = deleted ] && echo gone; }
# lines <regex>: lines of the last run's stdout matching the regex
lines() { node -e 'const t=require("fs").readFileSync(process.env.QA_Q+"/r.out","utf8");console.log(t.split("\n").filter(l=>new RegExp(process.argv[1]).test(l)).length)' "$1"; }
# deadlines <out>: "id deadline" per lease mirror file of p1
deadlines() { node -e 'const fs=require("fs"),d=".cland/run/host-leases";let n=[];try{n=fs.readdirSync(d).filter(f=>/\.json$/.test(f))}catch{}for(const f of n){const v=JSON.parse(fs.readFileSync(d+"/"+f,"utf8"));console.log(v.id+" "+v.deadline)}' > "$1"; }
q50() {   # p1 with a fake `agents` pool (slots 1, min_hosts 0, max_hosts 1), a 30 s lease, a prepared image and the Implementer bound to `agents`
  echo "PRE p1 entries $(ls -A "$QA_Q/p1" | wc -l | tr -d ' '); fh entries $(ls -A "$QA_Q/fh" | wc -l | tr -d ' ')"
  cd "$QA_Q/p1" || return 1
  git init -q -b dev && git commit -q --allow-empty -m init; echo "git exit $?"
  cland init . > "$QA_EV/E1534S2-50-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1; echo "hub after init and stop: $(up)"
  swap 'lease = "12h"' 'lease = "30s"' || return 1
  printf '%s\n' '' '[hosts.agents]' 'provider = "fake"' 'size = "fake"' 'slots = 1' 'region = "fake-1"' 'min_hosts = 0' 'max_hosts = 1' >> .cland/config.toml
  echo "  in [hosts]: lease 30s $(hcnt 'lease = "30s"'); agents table $(hcnt '[hosts.agents]'); slots 1 $(hcnt 'slots = 1'); min_hosts 0 $(hcnt 'min_hosts = 0'); max_hosts 1 $(hcnt 'max_hosts = 1')"
  hubstart; echo "hub start exit $?; hub $(up)"
  run "(prepare agents)" cland host prepare agents; echo "  prepared lines $(has 'agents: prepared')"
  run "(implementer pool)" cland role launch implementer --pool agents --json
  echo "  roles.toml pool lines $(cnt .cland/roles.toml 'pool = "agents"'); agents hosts $(hosts | wc -l | tr -d ' ')"
}
q51() {   # T-1746 C1: a hub starting with min_hosts = 1 creates one fake host with no launch
  cd "$QA_Q/p1" || return 1
  cland hub stop > /dev/null 2>&1; echo "hub after stop: $(up)"
  swap 'min_hosts = 0' 'min_hosts = 1' || return 1
  hubstart; echo "hub start exit $?; hub $(up)"
  r=$(waitfor 180 oneready); echo "  first host: ${r:-not ready within 180 s}; agents hosts: $(hosts | tr '\n' ';')"
  readlink "$QA_Q/fh/.fixture-sockets/alias" > "$QA_Q/alias.txt" 2> /dev/null; echo "  alias recorded: $(cat "$QA_Q/alias.txt" 2> /dev/null)"
}
q52() {   # T-1743 C1: an Implementer bound to `agents` lands on the created fake host
  cd "$QA_Q/p1" || return 1
  H1=$(hosts | awk '$2=="ready"{print $1; exit}'); echo "  ready host ${H1:-none}"
  run "(launch w1)" cland session launch w1 --role implementer --harness opencode --model opencode/fake-paid
  r=$(waitfor 120 running w1); echo "  w1 row: ${r:-$(srow w1)}; on the ready host $([ -n "$r" ] && [ "${r#host=$H1 }" != "$r" ] && echo yes || echo no)"
  run "(session list)" cland session list; echo "  w1 lines naming its host $(lines "^w1 .*host $H1")"
}
q53() {   # T-1744 C1 and T-1746 C3: max_hosts reached, a launch waits; raising max_hosts starts a host and places it, no restart
  cd "$QA_Q/p1" || return 1
  P1=$(hp)
  run "(launch w2)" cland session launch w2 --role implementer --harness opencode --model opencode/fake-paid
  echo "  waiting lines $(has 'waiting: waiting for a host'); agents hosts $(hosts | wc -l | tr -d ' ')"
  run "(session list while waiting)" cland session list; echo "  w2 wait lines $(lines '^w2 \[implementer\] pool agents: waiting for a host$')"
  run "(max_hosts 2)" cland config set hosts.agents.max_hosts 2; echo "  applies-now lines $(has 'applies now')"
  b=$(waitfor 60 bootwait w2); echo "  boot wait seen: ${b:-not seen (recorded, not judged)}"
  r=$(waitfor 240 running w2); echo "  w2 row: ${r:-$(srow w2)}"
  echo "  agents hosts $(hosts | wc -l | tr -d ' '); ready $(hready); hub pid unchanged $([ "$(hp)" = "$P1" ] && echo yes || echo no)"
}
q54() {   # T-1744 C5, T-1746 C5: a waiting launch refuses a second launch of its name and is cancelled by session stop; the pool stays at max_hosts, and a manual create there is refused
  cd "$QA_Q/p1" || return 1
  run "(launch w3)" cland session launch w3 --role implementer --harness opencode --model opencode/fake-paid; echo "  waiting lines $(has 'waiting: waiting for a host')"
  run "(launch w3 again)" cland session launch w3 --role implementer --harness opencode --model opencode/fake-paid; echo "  name-waiting lines $(has 'session "w3" is waiting for a host')"
  run "(stop w3)" cland session stop w3; echo "  cancelled lines $(has 'cancelled w3: waiting for a host')"
  run "(session list after cancel)" cland session list; echo "  w3 lines $(lines '^w3 '); agents hosts $(hosts | wc -l | tr -d ' ')"
  run "(manual create at max)" cland host create agents; echo "  max_hosts refusal lines $(has 'pool agents reached max_hosts 2'); agents hosts $(hosts | wc -l | tr -d ' ')"
}
q55() {   # T-1747 C3, C5, T-1763 C1: with a 30 s lease both mirror deadlines move forward while w1 and w2 run, never past the lease from now
  cd "$QA_Q/p1" || return 1
  deadlines "$QA_Q/lease-1.txt"; echo "  lease files $(wc -l < "$QA_Q/lease-1.txt" | tr -d ' ')"; sleep 12; deadlines "$QA_Q/lease-2.txt"
  node -e 'const fs=require("fs"),rd=f=>fs.readFileSync(f,"utf8").trim().split("\n").filter(Boolean).map(l=>l.split(" ")),a=Object.fromEntries(rd(process.argv[1])),now=Date.now();for(const [id,d] of rd(process.argv[2]))console.log("  "+id+": moved forward "+(a[id]!==undefined&&Date.parse(d)>Date.parse(a[id]))+"; at most 30 s ahead "+(Date.parse(d)-now<=30500))' "$QA_Q/lease-1.txt" "$QA_Q/lease-2.txt"
  echo "  ready agents hosts after the wait $(hready)"
}
q56() {   # T-1748 C2, C3: with the hub stopped, each host's watchdog deletes machine and key at the expired lease, confirmed by reads, receipt written and spend settled
  cd "$QA_Q/p1" || return 1
  hosts > "$QA_Q/hosts-before-stop.txt"; echo "  ready hosts at start $(grep -c ' ready ' "$QA_Q/hosts-before-stop.txt")"; echo "  hosts before stop: $(tr '\n' ';' < "$QA_Q/hosts-before-stop.txt")"
  [ "$(grep -c ' ready ' "$QA_Q/hosts-before-stop.txt")" = 2 ] || { echo "  BLOCKED: two ready hosts are needed before the stop (E1534S2-55)"; return 1; }
  node -e 'console.log(new Date().toISOString())' > "$QA_Q/stop-at.txt"
  cland hub stop > /dev/null 2>&1; echo "hub after stop: $(up)"
  while read -r id st m; do D=$QA_Q/fh/.fixture-sockets/$m
    g=$(waitfor 120 deleted "$D")
    echo "  $id ($m): machine ${g:-not deleted within 120 s}; host-key.pub $(there "$D/host-key.pub"); client-key $(there "$D/client-key"); known_hosts $(there "$D/known_hosts")"
    node -e 'const fs=require("fs");try{const v=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const r=[...new Set((v.reads??[]).map(x=>x.resource))].sort().join(",");const s=Date.parse(fs.readFileSync(process.argv[2],"utf8").trim());console.log("  receipt reads "+r+"; confirmedAt "+(isFinite(Date.parse(v.confirmedAt))?"set":"bad")+"; after the stop "+(Date.parse(v.confirmedAt)>s))}catch{console.log("  receipt absent")}' ".cland/run/host-leases/$id.json.watchdog-receipt" "$QA_Q/stop-at.txt"
  done < "$QA_Q/hosts-before-stop.txt"
  # the scratch ledger only: the seal's CLAND_EXECUTOR_STATE is $QA_Q/executor-state (never the user's ledger)
  node -e 'const fs=require("fs");try{const v=JSON.parse(fs.readFileSync(process.env.CLAND_EXECUTOR_STATE+"/spend.json","utf8"));const h=(v.entries??[]).filter(e=>e.category==="hosts");console.log("  ledger under Q "+process.env.CLAND_EXECUTOR_STATE.startsWith(process.env.QA_Q+"/")+"; hosts entries "+h.length+"; settled "+h.filter(e=>e.cost!==null).length+"; released "+h.filter(e=>e.released).length)}catch(e){console.log("  ledger unreadable: "+e.code)}'
}
q57() {   # cleanup census: hub stopped (the relay watcher was stopped by QA's shell first); fake-machine survivors listed, sent TERM, listed again
  cd "$QA_Q/p1" || return 1
  cland hub stop > /dev/null 2>&1; echo "hub stop exit $?; hub $(up)"
  for p in $(sort -u "$QA_Q/pids"); do echo "recorded pid $p alive $(alive "$p")"; done
  census() { node -e 'const {execFileSync}=require("child_process");const rows=execFileSync("ps",["-axo","pid=,ppid=,command="],{encoding:"utf8"}).split("\n").filter(Boolean).map(l=>{const m=/^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(l);return {pid:+m[1],ppid:+m[2],cmd:m[3]}});const by=new Map(rows.map(r=>[r.pid,r]));const anc=new Set();let p=process.pid;while(p&&by.has(p)&&!anc.has(p)){anc.add(p);p=by.get(p).ppid}const A=process.argv[1]||"";const hits=rows.filter(r=>!anc.has(r.pid)&&(r.cmd.includes(process.env.QA_Q)||r.cmd.includes(process.env.QA_W+"/")||(A&&r.cmd.includes(A))));console.log("processes naming the scratch root, the alias or this build: "+hits.length);for(const h of hits)console.log("  survivor "+h.pid+" parent "+h.ppid+" "+h.cmd.slice(0,160))' "$(cat "$QA_Q/alias.txt" 2> /dev/null)"; }
  census > "$QA_Q/census-1.txt"; cat "$QA_Q/census-1.txt"
  for p in $(awk '$1=="survivor"{print $2}' "$QA_Q/census-1.txt"); do echo "  cwd $p $(lsof -a -p "$p" -d cwd -Fn 2> /dev/null | sed -n 's/^n//p')"; done   # no pipe: a tee naming $QA_Q would list itself
  for p in $(awk '$1=="survivor"{print $2}' "$QA_Q/census-1.txt"); do kill -TERM "$p" 2> /dev/null; done; sleep 3
  echo "after TERM:"; census
}
SH
. "$Q/checks.sh"; bash -n "$Q/scratch.sh" && echo "scratch checked"
```

Expected: `expect checked`, `src checked`, `relays checked`, `scratch checked`. Record the setup in `S0`.

**Cleanup, in this order (the stage-3 and A-17643 corrections).** Step 1, after E1534S2-57 passes: `rstop` (already done in E1534S2-57's command); print the alias in `$Q/alias.txt`, check it is a symlink named `/private/tmp/ct-` plus 32 hex resolving into `$Q/fh/.fixture-sockets`, and remove that symlink by its literal path; remove each known dead T-1676 residue entry in `$T` by its literal path. Step 2: run and record E1534S2-59 with `$Q` and `$T` still present. Step 3, after the verdict: print `$Q` and check it begins with `/private/tmp/q53-`, then remove it by that literal path with a non-force recursive remove; print `$T`, check it begins with `/private/tmp/qa-e1533-s3-` and holds nothing but `node-compile-cache`, and remove it by that literal path; remove the worktree with `git -C "$R" worktree remove "$W"` (its `node_modules` symlink first if Git refuses). Secrets in `$Q/p1/.cland/hub.json`, `$Q/p1/.cland/secret`, `$Q/p1/.cland/run/host-provisions/` and `$Q/fh` are never printed or posted.

## Cases

Every case is one or more named test files run once at the build, from QA's own shell through `nt` (or `pl` for T3 and native files, under the preservation lock), recorded with `qa-record.sh note` (surface `hub-api`), its evidence `$EV/<id>.log`, `$EV/<id>.check.txt` and `$EV/<id>.tmpdir.txt`. A case passes only when every check line reads `CLEAN` (exit 0; `fail`, `cancelled`, `skipped` and `todo` 0; `pass` equal to `tests`; every listed name `ok`; for an `exact` list, the plan equal to the list and no unlisted name). A missing file is a FAIL naming the file. A `fresh: BLOCKED` line makes the row BLOCKED. Run in table order; never two files at once. Tiers are read from `hub/test/tiers.json` at dev and the two heads.

| case | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1534S2-10 | hub-api | QA | `nt E1534S2-10 hub/test/session-pool-placement.test.ts` | `CLEAN` with every listed name (T-1743 C1 to C6, T-1744 C1; T2; VERIFIED at dev). Test `C1 pool launch uses a ready member and session list names its host`; test `C2 legacy and explicit local pool launches stay local`; test `C3 dense fills the fuller host; live spread configuration uses the emptiest`; test `C4 missing pool refuses before reservation/spawn and names configured pools`; test `C5 changing role pool moves the next launch without restart`; test `C6 explicit host bypasses missing role pool but refuses a full pinned host`; test `pool with no ready member waits without spawning` (T-1744 turned the refusal into a wait) |
| E1534S2-11 | hub-api | QA | `pl E1534S2-11 hub/test/host-create-ready.test.ts` | `CLEAN` with every listed name (T-1743 C1 on the native fixture, T-1748 C1 arming, T-1746 C2; T3, native fake SSH and scripted OpenCode). Test `C1/C2 create reaches ready with clone and tunnel and runs OpenCode; list shows declared facts`: with `[implementer.launch] pool="agents"` the Implementer launch lands on the created host by role pool (T-1743). The `unknown`, `inventory unknown`, `timed out`, `leftovers` and `complete` expansions of `failed readiness releases only after positive settlement: <receipt>`: the create armed a watchdog with a pid identity; a `complete` rollback joins it and removes its input and lease; every other receipt keeps it alive as the deletion backstop (T-1748 C1, VERIFIED). Test `T-1746 waiting pool launch creates a leased watchdog host and is placed` (T-1746's T3 case) |
| E1534S2-12 | hub-api | QA | `nt E1534S2-12 hub/test/host-lease.test.ts` | `CLEAN` with the exact list (T-1747 C1 to C5 and the Coordinator's four decisions; T2; VERIFIED at dev). The `lease-db`, `mirror` and `provision-db` expansions of `initial <failure> failure preserves admission ownership and never leaks a reservation`, and the `malformed` and `unreadable` expansions of `published mirror <failure> is an owned typed expiry and shutdown drains`, are generated names; the subtest `scope exits with ledger admission still held` is nested and not on the list |
| E1534S2-14 | hub-api | QA | `pl E1534S2-14 hub/test/host-provision-gate.test.ts` | `CLEAN` with every listed name (T-1747's migration of T-1737's gate; T3). Test `never-booting creation releases at exactly 300000 ms on the hub clock`; the `refused` and `unknown` expansions of `acquire <outcome> pins cancellation authority without confusing an unknown outcome` |
| E1534S2-15 | hub-api | QA | `nt E1534S2-15 hub/test/host-provision-records.test.ts` | `CLEAN` with every listed name (T1). Test `minimum holding selects only the configured number of ready hosts in that pool` (T-1747 C3); test `state observers see committed readiness and departure, isolate failures and unsubscribe` (T-1744's post-commit `onChange` seam); and T-1746's: test `active inventory reads only non-terminal rows despite retained history`; test `occupied keeps unresolved failed acquisitions and frees only positive receipts`; test `idle pool close stays synchronous for construction rollback`; test `occupied rejects relative receipt dates exactly like host spend`; test `occupied decodes only unreleased anomalies after 10000 released or destroyed records` |
| E1534S2-16 | hub-api | QA | `nt E1534S2-16 hub/test/host-spend.test.ts hub/test/executor-spend.test.ts hub/test/executor-watchdog.test.ts` | Each `CLEAN` (T1). `host-spend`: test `never-acquired receipts cancel at zero while unknown outcomes retain reservation and acquired lifetimes keep minimum` (the `cancelHostSpend` decision, now through the shared `positiveNonAcquisition` parser). `executor-spend` and `executor-watchdog` unedited (importer preservation: T-1747 and T-1746 edit `spend.ts`, T-1748 edits `executor/droplet/watchdog.ts`) |
| E1534S2-17 | hub-api | QA | `pl E1534S2-17 hub/test/executor-safety.test.ts` | `CLEAN`, unedited (T3; the droplet watchdog helpers T-1748 reuses) |
| E1534S2-20 | hub-api | QA | `nt E1534S2-20 hub/test/waiting-launch.test.ts` | `CLEAN` with the exact list of twenty (T-1744 C1 to C6 and its decisions; T2; VERIFIED at dev, edited by T-1746 with titles unchanged). Test `CLI prints waiting, lists its status and cancels with stop` (stdout `waiting: waiting for a host`, the list line `<name> … pool agents: waiting for a host`, `cancelled <name>`); test `memory-floor waits change reason once and recover on the next memory report`; test `final ready commit wakes waits without polling`; test `a ready host leaving capacity changes a memory wait without polling` (after T-1746 the departed host's wait reads `waiting for host b to boot`); test `an accepted wait pins its admitted pool after the role default changes`; test `removing the pinned pool ends a wait once with its named notice` |
| E1534S2-21 | hub-api | QA | `nt E1534S2-21 hub/test/host-contract-coverage.test.ts hub/test/waiting-launches-owner.test.ts` | Each `CLEAN` (T1, T1; T-1744). Test `optional capacity contract covers absence, report delivery and unsubscribe with positive controls` (the Host capacity contract the memory retry uses); test `an add in the completed-pass finalizer window receives its own placement pass` |
| E1534S2-22 | hub-api | QA | `nt E1534S2-22 hub/test/connection-snapshot.test.ts` | `CLEAN` (T2; edited by T-1744: the `session.list` reply and its legacy shape now carry `waiting`, no title changed) |
| E1534S2-23 | hub-api | QA | `pl E1534S2-23 hub/test/tool-arguments.test.ts hub/test/inbox-actions.test.ts hub/test/inbox-requests.test.ts hub/test/host-agent.test.ts` | Each `CLEAN` (T1, T2, T3, T3). `tool-arguments` is edited by T-1744 (the `session.stop` tool's arguments); `host-agent` is edited by T-1744 (setup and behaviour time allocations for its memory-floor cases), titles unchanged; the two hub inbox files are unedited preservation for the inbox status line |
| E1534S2-24 | hub-api | QA | `nt E1534S2-24 hub/test/cli-usage-compatibility.test.ts hub/test/cli-command-help.test.ts hub/test/cli-help.test.ts` | Each `CLEAN` (T1, T1, T2). T-1743, T-1744 and T-1746 change `SESSION_USAGE` or `CONFIG_USAGE`; test `all command usage exports retain their pre-refactor bytes` holds `hub/test/fixtures/cli-usage/commands.json` to the landed usage (both equal at dev `550e59ac`, after T-1762's hook usage edit too) |
| E1534S2-25 | hub-api | QA | `pl E1534S2-25 hub/test/roles-clauses.test.ts hub/test/roles-editor.test.ts hub/test/roles-launch-permissions.test.ts hub/test/spoke-lazy-tools.test.ts hub/test/session-archive.test.ts hub/test/roles.test.ts` | Each `CLEAN` (T1, T1, T1, T2, T2, T3). Importer checks for T-1744's Coordinator clause line, its new `session.stop` tool (`spoke-lazy-tools` edited by T-1744, title unchanged) and the `session.launch` description |
| E1534S2-26 | hub-api | QA | `pl E1534S2-26 hub/test/nvim-fixture-boundary.test.ts nvim/test/scenarios/workbench.test.ts nvim/test/inbox-requests.test.ts nvim/test/inbox-actions.test.ts nvim/test/needs-you.test.ts nvim/test/sessions.test.ts` | Each `CLEAN`, with no skip (T1, T3 `workbench` scenario, T2 each; headless Neovim from the repository's pinned cache, as `nvim/bin/nvim-path.ts` resolves it in a linked worktree). T-1744 regenerated 25 recorded fixtures: the `workbench` scenario's `checkRecordings` re-derives every recording in `nvim/test/fixtures/protocol-frames.json` and each per-file slice from the landed hub (a drift names `npm run test:nvim-fixtures`), and checks `live-protocol-frames.json`; the four consumers render the inbox and session frames that now carry `waitingLaunches`. A `skip` (no pinned Neovim) is BLOCKED, not PASS. The other 19 regenerated slices' consumers are the suite's evidence |
| E1534S2-30 | hub-api | QA | `pl E1534S2-30 hub/test/host-watchdog.test.ts` | `CLEAN` with the exact list (T-1748 C1, C2; T3, a real detached process and the fake provider; VERIFIED). Test `detached watchdog outlives the lease database owner and confirms deletion at a 30 second deadline`; test `host create arms a watchdog which deletes its machine after the hub stops`. Its wall time includes the real 30 s lease (no test-only knob exists before stage 3) |
| E1534S2-31 | hub-api | QA | `nt E1534S2-31 hub/test/host-watchdog-loop.test.ts` | `CLEAN` with the exact list (T-1748 C2 to C4; T2). Test `watchdog follows the published renewal and confirms machine/key absence before settling hosts spend`; test `watchdog uses the earlier file deadline when database renewal publication fails`; test `retained receipt without confirming reads cannot settle a live host`; test `receipt publication conflict preserves the first bound absence and fences a mismatched machine`; test `unknown recovered watchdog retains its input and lease identity without signals` |
| E1534S2-32 | hub-api | QA | `nt E1534S2-32 hub/test/host-watchdog-identity.test.ts hub/test/host-watchdog-drain.test.ts` | Each `CLEAN` with the exact list (T1). `host-watchdog-identity`: the `original`, `reused` and `null` expansions of `host watchdog stop respects captured birth: <identity>`; the twelve field expansions of `absence receipt fences invalid captured <field>` (`root`, `host`, `provider`, `machine`, `birth`, `address`, `architecture`, `empty`, `missingKey`, `blankRead`, `badDate`, `earlyDate`); test `complete absence receipt retains the exact captured acquisition`. `host-watchdog-drain`: test `fixture drain attempts later owners and census after a failed stop, retaining an unknown root`; test `fixture drain accepts positive closure after fallback cleanup while preserving the original failure` |
| E1534S2-34 | hub-api | QA | `pl E1534S2-34 hub/test/host-destroy-native.test.ts` | `CLEAN` with every listed name (T-1748 C5; T3, native fake SSH, edited by T-1748). The `tunnel down=false` and `tunnel down=true` expansions of `C1/C2/C3 destroy settles native session after confirming deletion; tunnel down=<bool>` now also read the watchdog's pid identity in the lease file, alive before the destroy and not alive after the confirmed deletion, with the lease file gone; test `destroy joins an admitted held acquisition and prevents ready resurrection`. Run after E1534S2-30, never beside it |
| E1534S2-35 | hub-api | QA | `pl E1534S2-35 hub/test/host-ssh-contract.test.ts hub/test/startup-cleanup.test.ts` | Each `CLEAN`, unedited (T3, T2). Test `ssh Host runs every shared Host behavioral contract through fake ssh` (T-1744 edits `hub/src/host/ssh-host.ts`, `host.ts` and the shared `hub/test/host-contract.ts`). T-1731's signature applies (run alone) |
| E1534S2-36 | hub-api | QA | `nt E1534S2-36 hub/test/host-scheduler.test.ts hub/test/host-pools-config.test.ts hub/test/host-provider-fake.test.ts` | Each `CLEAN`, unedited (T1, T1, T2). Stage-1 behaviour the stage builds on: the scheduler's decisions T-1743 and T-1746 call, the pool keys `config set` writes, the fake provider the scratch rows use |
| E1534S2-40 | hub-api | QA | `nt E1534S2-40 hub/test/waiting-launch-restart.test.ts hub/test/waiting-launch-store.test.ts` | Each `CLEAN` with the exact list (T-1745 C1 to C4; T2, `projectHub` stop and start on one root; T1; VERIFIED at dev). Test `restart restores the original waiting status in session list and inbox`; test `a cancelled wait is absent after restart and its name can launch again`; the `role` and `pool` expansions of `restart drops a wait whose <removed> was removed with one Coordinator notice`; test `restored wait places once on capacity commit and placed launches never restore`; test `a missing drop-notice receipt retains the wait for a later restart`; test `process publication and wait removal commit together before observers` |
| E1534S2-41 | hub-api | QA | `nt E1534S2-41 hub/test/pool-scale.test.ts` | `CLEAN` with the exact list of nineteen (T-1746 C1 to C5 and its decisions, T-1763 C1 to C4; T2, injected create seam; VERIFIED at dev). Test `C1 startup maintains min_hosts without a launch`; test `C2/C4 booting counts toward max and two launches share one new host`; test `C3 raising max_hosts places a waiting launch without restart`; test `C5 overflow never exceeds max_hosts`; test `destroying host fences max_hosts and takes no placement`; test `manual and automatic create race admits exactly one durable row at max_hosts`; test `memory-refused ready host with spare weight does not create another host`; the `true` and `false` expansions of the failed-row loop (`failed pending acquisition …`, `failed incomplete release …`, each `holds max across config and restart`); T-1763's test `T-1763 startup and demand hosts renew running sessions after scale-up` (the A-17820 sequence on the hub clock), test `T-1763 manual host placement promise renews until failed launch releases it` and test `T-1763 minimum keeps older idle startup host when manual host appears` |
| E1534S2-42 | hub-api | QA | `nt E1534S2-42 hub/test/host-create-admission.test.ts` | `CLEAN` with every listed name (T2; edited by T-1746). Test `pre-row admission refusal acquires nothing and publishes no provision record` (the shared admission refuses before any provider call or row) |
| E1534S2-43 | hub-api | QA | `nt E1534S2-43 hub/test/task-worktrees.test.ts hub/test/lead-launch.test.ts hub/test/launch-admission.test.ts` | Each `CLEAN`, unedited (T2 each). Importer preservation for T-1746's refactor of `TaskWorktrees.launch` into `#launchEligibility` and `admitWaiting` (`hub/src/hub/worktrees.ts`) |
| E1534S2-45 | hub-api | QA | `nt E1534S2-45 hub/test/test-docs.test.ts hub/test/suite-tiers.test.ts` | Each `CLEAN` (T1). The per-file docs and `docs/agents/tests/index.md` entries the landings add, and every new test file in `tiers.json` (`pool-scale` T2) |

### Web cases (when in scope)

none. T-1744 changes the wire's inbox type (`shared/wire/index.ts`, `waitingLaunches`) additively and adds no web surface; no browser runs. The Neovim recordings run in E1534S2-26, headless.

## Manual checks

Run in table order: E1534S2-00 to E1534S2-03 before the cases, E1534S2-50 to E1534S2-57 after them, then cleanup step 1, then E1534S2-59. Scratch rows depend on the state the rows before them leave; a row whose prerequisite failed is BLOCKED, naming it. Record each with `sh .agents/skills/qa/qa-record.sh note E-1534 "$RUN" <id> hub-api "<the command you ran>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence file>` from `$W`. Every scratch row's evidence begins with the kit's `PRE gate` line (`credential-prefix names 0`, `QA_SESSION set yes`, HOME, TMPDIR, fake host root, ssh, scp and npm `yes`) and ends with `# fresh: redacted or withheld lines 0` and `row exit 0`; a gate refusal is BLOCKED. The scratch rows wait in real time (the 30 s lease, host boots; stage 3 brings the test-only knobs): about 10 minutes in all.

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1534S2-00 | hub-api | QA | `s00 > "$EV/E1534S2-00.txt" 2>&1` | PRE line: HEAD, dev and request the same 40 hex; `dirty entries 0`; root non-tracker count recorded. `plan read exit 0`; the stage line: exact name, `qa` `{"scope":"affected","when":"after-stage"}`, `items` T-1743, T-1744, T-1745, T-1746, T-1747, T-1748, T-1763 plus any further finding fixes the request names, `merged` equal to `total`, `state` not `closed`. Every member `landings 1`; anything else is BLOCKED |
| E1534S2-01 | hub-api | QA | `s01 > "$EV/E1534S2-01.txt" 2>&1` | Node 24; `typecheck exit 0` (the integrated build: T-1748 on T-1743's `host-create-ready.test.ts` and `tiers.json`, T-1744's `createHost` option in `hub/test/harness.ts`, T-1746's `admit` callback and shared receipt type); `dirty entries 0` |
| E1534S2-02 | hub-api | QA | `s02 > "$EV/E1534S2-02.txt" 2>&1` | Every landing `package.json and lockfiles: 0`; `preserved files edited at its landing: []` for every landing; `commits after 4360256ac touching preserved files: []` (a non-empty list is read before judging). **Landing check:** `T-1746 files byte-identical to dd1a3a59 at its landing <sha>: yes` with `T-1746 files changed after its landing: [550e59aca]` (T-1763); `T-1748 … 5578a77d5 …: yes` and `[]`; `T-1763 … 8ca8c76bd …: yes` and `[]`; a `no:` list, or any other commit in a changed-after list, names its source (a separately landed fix with its commit, a review correction, a dev merge) and is an expected-registration correction, see "Build". Test paths per landing (VERIFIED at the landings; a landing may add `hub/test/durations.json`): T-1747 `hub/test/host-lease.test.ts hub/test/host-provision-gate.test.ts hub/test/host-provision-records.test.ts hub/test/host-spend.test.ts hub/test/tiers.json`; T-1743 `hub/test/fixtures/cli-usage/commands.json hub/test/host-create-ready.test.ts hub/test/session-pool-placement.test.ts hub/test/tiers.json`; T-1748 `hub/test/durations.json hub/test/host-create-fixture.ts hub/test/host-create-ready.test.ts hub/test/host-destroy-native.test.ts hub/test/host-watchdog-drain.test.ts hub/test/host-watchdog-drain.ts hub/test/host-watchdog-identity.test.ts hub/test/host-watchdog-loop.test.ts hub/test/host-watchdog.test.ts hub/test/tiers.json`; T-1744 `hub/test/connection-snapshot.test.ts hub/test/fixtures/cli-usage/commands.json hub/test/harness.ts hub/test/host-agent.test.ts hub/test/host-contract-coverage.test.ts hub/test/host-contract.ts hub/test/host-provision-records.test.ts hub/test/session-pool-placement.test.ts hub/test/spoke-lazy-tools.test.ts hub/test/tiers.json hub/test/tool-arguments.test.ts hub/test/waiting-launch.test.ts hub/test/waiting-launches-owner.test.ts` (its 25 Neovim recordings are under `nvim/`, outside this listing); T-1745 `hub/test/tiers.json hub/test/waiting-launch-restart.test.ts hub/test/waiting-launch-store.test.ts`; T-1746 `hub/test/durations.json hub/test/fixtures/cli-usage/commands.json hub/test/host-create-admission.test.ts hub/test/host-create-fixture.ts hub/test/host-create-ready.test.ts hub/test/host-provision-records.test.ts hub/test/pool-scale.test.ts hub/test/tiers.json hub/test/waiting-launch.test.ts`; T-1763 `hub/test/pool-scale.test.ts` |
| E1534S2-03 | hub-api | QA | `node "$Q/src.mjs" "$W" > "$EV/E1534S2-03.txt" 2>&1` | Every line `ok` (39 lines). T-1743: the missing-pool refusal naming the configured pools, the pinned `host <id> has no room`, the role pool read per launch, which a wait overrides with its admitted pool (T-1744's decision). T-1747: min(database, file); `host-lease-publication`; `Math.min(3600000,o.leaseMs/4)`; the 30 s floor; the mirror path; the lease before acquire; `heldByMinimum`; `cancelHostSpend` taking a never-acquired receipt. The scheduler's two wait reasons. T-1748: the detached spawn with no token in argv, the receipt path, settlement after the receipt, machine and key reads required. T-1744: the CLI `waiting:` and `cancelled` lines, the waiting-name refusal, the memory wait reason, `session-waiting`, the post-commit `onChange` subscription, the agent `memory` event. T-1745: the `waiting_launches` table and the restore at hub start. T-1746: `ACTIVE_PROVISION_STATES`, `occupied` keeping failed rows without a positive receipt, the shared parser in `spend.ts`, the single admission checkpoint, `pool <pool> reached max_hosts <n>`, manual create through `#createPoolHost`, `destroying` excluded from minimum capacity, `admitWaiting`. T-1763: `inUse` passed by `#createPoolHost`, `Sessions.hostInUse`, `PoolRuntime.inUse` with its busy-first, oldest-first minimum, and the renewal predicate falling back to `heldByMinimum` only without one. A `MISMATCH` is read at the build (a renamed string is followed); it is a FAIL unless the landing changed it with a recorded decision |
| E1534S2-50 | hub-api | Human | `mrow E1534S2-50 q50` | **Setup.** `PRE p1 entries 0`; `git exit 0`; `init exit 0`; `hub after init and stop: down`; `swapped "lease = \"12h\""`; `in [hosts]: lease 30s 1; agents table 1; slots 1 1; min_hosts 0 1; max_hosts 1 1`; `hub start exit 0; hub up`; `(prepare agents) exit 0`, `prepared lines 1`; `(implementer pool) exit 0`; `roles.toml pool lines 1; agents hosts 0`. A failure makes E1534S2-51 to E1534S2-56 BLOCKED. Then, in QA's own shell, `rstart` (`relay watcher pid <n>`) |
| E1534S2-51 | hub-api | Human | `mrow E1534S2-51 q51` | **T-1746 C1.** `hub after stop: down`; `swapped "min_hosts = 0"`; `hub start exit 0; hub up`; `first host: ready`; `agents hosts:` exactly one row, `ready`; an `alias recorded` `/private/tmp/ct-` path. `$Q/relay.log` gains `ports map <host directory>` for it (the A-17643 ports-before-launch correction) |
| E1534S2-52 | hub-api | Human | `mrow E1534S2-52 q52` | **T-1743 C1.** `ready host <id>`; `(launch w1) exit 0` with a `launched w1 [Implementer] … host <id>` line (the display label, A-17820 casing correction); `w1 row: host=<id> status=running; on the ready host yes`; `(session list) exit 0`; `w1 lines naming its host 1`. `$Q/relay.log` gains `relay … .sock -> 127.0.0.1:<port>`. The launch uses the hub root as cwd, which the fake host shares (OBSERVED in the first run; the named test uses the host's home); a refusal `launch cwd … is not an accessible directory` makes the row BLOCKED with that text |
| E1534S2-53 | hub-api | Human | `mrow E1534S2-53 q53` | **T-1744 C1, T-1746 C3.** `(launch w2) exit 0` with `waiting lines 1`; `agents hosts 1`; `(session list while waiting) exit 0` with `w2 wait lines 1`; `(max_hosts 2) exit 0` with `applies-now lines` 1 or more; `boot wait seen` recorded (`w2 [implementer] pool agents: waiting for host <id> to boot`, or `not seen` when the boot beat the poll); `w2 row: host=<second id> status=running`; `agents hosts 2; ready 2; hub pid unchanged yes` |
| E1534S2-54 | hub-api | Human | `mrow E1534S2-54 q54` | **T-1744 C5, T-1746 C5.** `(launch w3) exit 0` with `waiting lines 1`; `(launch w3 again)` exit 1 with `name-waiting lines 1` (`session "w3" is waiting for a host`); `(stop w3) exit 0` with `cancelled lines 1` (`cancelled w3: waiting for a host`); `(session list after cancel) exit 0` with `w3 lines 0; agents hosts 2` (never above `max_hosts`); `(manual create at max)` exit non-zero with `max_hosts refusal lines` 1 or more (`pool agents reached max_hosts 2`, T-1746's shared admission and A-17473 decision 14) and `agents hosts 2` (no row written). The refusal is VERIFIED in `dispatch.ts` and was OBSERVED in the first run as the stderr line `cland: pool agents reached max_hosts 2` |
| E1534S2-55 | hub-api | Human | `mrow E1534S2-55 q55` | **T-1747 C3, C5, T-1763 C1.** `lease files 2` (H1, the `min_hosts` startup host running w1, and H2, the scaled-up host running w2); for each host `moved forward true; at most 30 s ahead true` (renewal every 7.5 s while in use; the mirror never later than a full lease from now); `ready agents hosts after the wait 2`. `lease files 1`, or H1 gone, is the A-17820 defect again: a FAIL and a regression of T-1763 |
| E1534S2-56 | hub-api | Human | `mrow E1534S2-56 q56` | **T-1748 C2, C3.** `ready hosts at start 2` and two `hosts before stop` rows, both `ready` (fewer is BLOCKED naming E1534S2-55, never judged on the remaining host); `hub after stop: down`; both hosts deleted after the stop: for each host `machine gone; host-key.pub absent; client-key absent; known_hosts absent`, then `receipt reads key,machine; confirmedAt set; after the stop true`; `ledger under Q true; hosts entries` 2 or more `; settled` equal to the entries for these hosts `; released` likewise. The receipt path and fields are VERIFIED at dev (`hostWatchdogPaths`, `parseHostAbsenceReceipt`); on a CLI-started hub the reads, receipts and settled entries were OBSERVED in the first run; both hosts deleted after the stop is INFERRED until this run (T-1763) |
| E1534S2-57 | hub-api | Human | `rstop` in QA's own shell, then `mrow E1534S2-57 q57` | `relay watcher alive no`; `hub stop exit 0; hub down`; every recorded pid `alive no`; the first census lists survivors, and `after TERM:` reads `processes naming the scratch root, the alias or this build: 0`. Expected survivors (A-17643: the fake provider's deletion never kills fake-machine processes; A-17820: the spoke child of the fake OpenCode): per host its `supervisor.sh`, host agent, fake OpenCode and that OpenCode's spoke, for w1 on H1 and w2 on H2, under the alias, `$Q/fh` or this build; record each survivor's pid, parent and cwd before the TERM. Any other survivor is a FINDING unless its command is unrelated (pid reuse, recorded); a survivor still alive after TERM is listed and ended with `kill -TERM <pid>` after re-reading its command, and the row repeated. Then cleanup step 1 |
| E1534S2-59 | hub-api | QA | `s59 > "$EV/E1534S2-59.txt" 2>&1` (after cleanup step 1, with `$Q` and `$T` present) | HEAD, dev and request still the same 40 hex; `dirty entries 0`; `root non-tracker status unchanged: yes`; `preservation lock present: no`; `scratch fixture alias … gone`; `T entries other than node-compile-cache 0` after the T-1676 handling (each leftover with its type, open count and first file; live residue, or residue from a file a stage-2 landing changed outside the unchanged-producer clause, is a finding). A moved dev keeps the evidence and makes the run BLOCKED |

Before requesting QA, run `cland qa lint` with this filled brief at the build under test: from the root, `node hub/bin/cland.ts qa lint qa/briefs/E-1534-stage-2.md --commit <dev SHA>`, with a dev SHA that includes every stage landing. The brief is complete only when qa lint passes at the build.

## Probes that mislead

- **Generated names cannot be certified by `qa lint`.** Loop titles (`initial <failure> failure …`, `published mirror <failure> …`, `acquire <outcome> pins …`, `host watchdog stop respects captured birth: <identity>`, `absence receipt fences invalid captured <field>`, the `tunnel down=<bool>` destroy case, `restart drops a wait whose <removed> was removed with one Coordinator notice`, and `pool-scale`'s failed-row loop, whose ternary names `failed pending acquisition …` and `failed incomplete release …`) are expanded in `expect.json` and checked by `tap.mjs` at the run.
- **Never the user's spend ledger.** The named tests isolate their own state; the scratch hub and its watchdogs write `$Q/executor-state/spend.json` through the seal's `CLAND_EXECUTOR_STATE` (S0 prints it). Reading `~/.local/state/cland/spend.json` or `~/.cland` is out of bounds even to compare.
- **A host does not die with the hub.** E1534S2-56 stops the hub on purpose; the hosts, their sessions and the watchdogs keep running until the 30 s deadline. A host still present right after `hub stop` is expected; one still present 120 s later is the FAIL.
- **A deleted fake machine is a directory, not a stopped computer.** The fake provider writes `gone` and removes the key files; its supervisor, agent and OpenCode processes survive (A-17643), which is why E1534S2-57 sends TERM.
- **The boot wait may be too short to see.** A fake host boots in a few seconds; E1534S2-53 records the `waiting for host <id> to boot` line when the poll catches it and judges only the placement. T-1746 C2 rests on E1534S2-41.
- **`config set` is the only live trigger.** `hosts.<pool>.<key>` prints `applies now`; a changed hub pid fails T-1746 C3's "without a hub restart".
- **The relay watcher is not hub code.** `relays.mjs` stands in for sshd's TCP forwarding (the E-1533 DoD's validated relay, generalised to hosts created on demand); a launch that fails with `opencode serve did not answer` while `$Q/relay.log` shows no `relay` line is a kit failure (BLOCKED), not a product finding.
- **Two hosts, two renewing leases.** Since T-1763 a host renews while it carries a live session or a placement promise, or is one of the `min_hosts` hosts chosen busy-first, then oldest. In rows 53 to 56 both H1 and H2 carry sessions, so both renew; a host lost before the hub stop is the A-17820 defect, not a timing flake.
- **No scratch restart while hosts live.** T-1745's restore is proven by E1534S2-40 only. Re-attaching lease renewal and watchdogs after a hub restart is T-1752's (stage 3): a restart with live hosts and a 30 s lease would let the watchdogs delete them under the restarted hub. The one scratch restart (E1534S2-51) happens before any host exists.
- **T-1746 owns `min_hosts` from hub start.** The `agents` pool defaults to `min_hosts = 1`, so E1534S2-50 writes `min_hosts = 0` until the image is prepared; a host appearing during E1534S2-50 is a FAIL of that line, not a flake.
- **No test-only knobs yet.** Stage 3 adds the fenced lease and boot knobs (A-17473 decision 13); this stage's scratch rows and `hub/test/host-watchdog.test.ts` wait real time.
- **Plain `node --test` is not the suite runner.** It enforces no duration allowance and no resource tripwire preload: a slow pass is not a finding and a fast one proves no budget.
- Process cleanup probes use the fixture-owned pid census (`$Q/pids`) and the scratch-root census; a machine-wide `pgrep` counts other sessions too.
- File-change probes use isolation and digests; mtime alone is confounded by live sessions rewriting the same file.
- Speed criteria use measured wall times, never projections; the 300 000 ms gate is clock time on a fake clock, not wall time.
- Slots due or queued before the build count even when their results arrive later.
- "No skip" names platform-only cases: no listed file skips on macOS at writing.
- Re-check helper and function names with grep at the tested build; renames happen. The kits come from commit `K`; a different commit is a setup BLOCKED.

## Out of scope

- The real DigitalOcean API, droplets, volumes, keys, tokens and any network.
- Idle stop, failures, restart re-attachment of renewal and watchdogs (T-1752), money views, `host status` and DigitalOcean creation (stage 3).
- The load guard `hub/test/inbox-verifier-load.test.ts` (`tiers.json` `loadGuards` for `sessions.ts`, `requests.ts` and `core.ts`): the suite's evidence, not this run's.
- T-1731, T-1758 and T-1689 as bugs (signatures only); T-1735 and T-1732 (fixed; a recurrence is a regression finding, not a flake); T-1736 and T-1761 (judged as they stand if they appear).
- Linux and container runs, the stage covers and the items' loaded repetitions: their evidence; this run is macOS only and says so.
- Duration allowances (`hub/test/durations.json`) as pass conditions.
- Any `cland config set`, `cland role launch`, `cland session …`, `cland hub …` or `cland host …` on the live project.

Missing authorization (a real provider token, a GUI) is out of scope, not BLOCKED, because no case needs one.

## Grants

none. No grant is needed: every case runs on this Mac against fakes with a disposable HOME and no credential.

## Rows to verify after landing

**Settle every line here at `<dev SHA>` before requesting QA; record each difference in the brief or the request.** VERIFIED = read at dev `550e59aca718ee0e8952ce86dfdde984cfc9e33d`, the closest stand-in for the rerun's head (the next tracker commit). OBSERVED = seen in the first run at `4688f956` (A-17820). INFERRED = not proven by a read of the build or by a run.

**Settled by the landings (VERIFIED at dev `550e59ac`):** every member's exact lists, titles and strings; T-1746's landed files equal to `dd1a3a59` apart from T-1763's edits; T-1763's files equal to its reviewed head `8ca8c76bd` and its three `pool-scale` cases (none added to `host-lease`); T-1748's receipt path and fields; T-1744's 25 Neovim recordings and `commands.json`; `CONFIG_USAGE` and `SESSION_USAGE` equal to `commands.json` (T-1762 also edits it, outside the stage); the fake provider's deletion markers and confirming reads; `CLAND_EXECUTOR_STATE` before `XDG_STATE_HOME`; default OpenCode weight 0.75, so `slots = 1` holds one OpenCode session.

**OBSERVED in the first run (A-17820, at `4688f956`), re-judged at the build:** rows 50 to 54 pass as written once the casing correction applies (the CLI prints `[Implementer]`, waiting lines keep `implementer`); the hub-root cwd launches on a fake host; `relays.mjs` writes each host's map and serves its OpenCode port; `cland host create agents` at the maximum prints the `reached max_hosts` refusal; the pinned Neovim resolves in the linked worktree (E1534S2-26); row 56's reads, receipts and settled ledger entries on a CLI-started hub; row 57's eight-process survivor class, with the OpenCode spoke.

**INFERRED, with the reason:**

- E1534S2-55 and E1534S2-56 at the new build: that both hosts keep renewing through rows 53 to 55 and that both are deleted only after the hub stop. T-1763's three `pool-scale` cases prove the predicate on the hub clock (E1534S2-41); the CLI-started sequence has not run since the fix.

## Source provenance

VERIFIED = read in source at dev `550e59aca718ee0e8952ce86dfdde984cfc9e33d`; re-read at the build.

- The kits: commit `K` = `273ddcbdd485e33aa382a90efedda992ac0e6a00`: `qa/briefs/E-1532-stage-4.md` lines 133 to 136 and 228 to 279; `qa/briefs/E-1533-stage-3.md` heredocs `seal.mjs`, `fresh.mjs`, `frame.mjs`, `body.sh`, `helpers.sh` (`helpers.sh` provides `cland`, `hp`, `hubstart`, `up`, `alive`, `run`, `has`, `cnt`, `there`, `dg`, `machines`, `hl`, `pick`, `hd`, `ports`, `srow`); `qa/briefs/E-1533.md`'s `relay.mjs`, generalised here; `qa/briefs/E-1534-stage-1.md`'s carried corrections; this brief's first run, A-17820 (`report.md`, `corrections.txt`).
- T-1743 (`273ddcbdd`): `hub/src/host/pool-runtime.ts`, `hub/src/adapters/sessions.ts`, `hub/src/cli/session.ts` (`sessionLine`, `withRole` from `hub/src/names.ts`); `hub/test/session-pool-placement.test.ts` (T2), `hub/test/host-create-ready.test.ts` (T3).
- T-1747 (`77579ea01`): `hub/src/host/host-leases.ts`, `hub/src/host/provision-host.ts`, `hub/src/host/provision-records.ts`, `hub/src/executor/droplet/spend.ts`; `hub/test/host-lease.test.ts` (T2), `host-provision-gate` (T3), `host-provision-records` (T1), `host-spend` (T1).
- T-1748 (`debeaca4d`): `hub/src/host/host-watchdog.ts` (`hostWatchdogPaths`, `parseHostAbsenceReceipt`, `recordHostAbsence`), `hub/src/executor/droplet/watchdog.ts`, `hub/src/host/provision-host.ts`; tiers `host-watchdog` T3, `host-watchdog-loop` T2, `host-watchdog-identity` T1, `host-watchdog-drain` T1.
- T-1744 (`48e11d905`): `hub/src/adapters/waiting-launches.ts`, `sessions.ts`, `requests.ts`, `hub/src/cli/session.ts`, `hub/src/cli/usage/session.ts`, `hub/src/host/ssh-host.ts`, `host.ts`, `provision-records.ts`, `hub/src/hub/agents-topic.ts`, `inbox.ts`, `core.ts`, `dispatch.ts`, `hub/src/protocol.ts`, `shared/wire/index.ts`, `hub/src/spoke/tools.ts`, `hub/src/roles/default-roles.ts`; the Neovim recordings under `nvim/test/fixtures/`, checked by `hub/test/nvim-fixture-check.ts` from `nvim/test/scenarios/workbench.test.ts`; tiers `waiting-launch` T2, `waiting-launches-owner` T1, `host-contract-coverage` T1, `connection-snapshot` T2, `host-agent` T3, `spoke-lazy-tools` T2.
- T-1745 (`50f0529d2`): `hub/src/adapters/waiting-launches.ts` (`WAITING_LAUNCH_SCHEMA`), `hub/src/hub/store.ts`, `hub/src/hub/daemon.ts` (`restoreWaitingLaunches`), `hub/src/hub/dispatch.ts`, `hub/src/adapters/processes.ts`; tiers `waiting-launch-restart` T2, `waiting-launch-store` T1.
- T-1746 (`32a5fdbf0`): `hub/src/host/pool-runtime.ts` (`reconcile`, `demand`, `PoolCreationNotAdmitted`), `hub/src/host/provision-records.ts` (`ACTIVE_PROVISION_STATES`, `active`, `occupied`), `hub/src/host/acquisition-receipt.ts`, `hub/src/host/provision-host.ts` (`admit`), `hub/src/hub/dispatch.ts` (`#createPoolHost`), `hub/src/hub/worktrees.ts` (`admitWaiting`), `hub/src/cli/usage/config.ts`; tier `pool-scale` T2.
- T-1763 (`550e59aca`): `hub/src/hub/dispatch.ts` (`inUse` in `#createPoolHost`), `hub/src/adapters/sessions.ts` (`hostInUse`), `hub/src/host/pool-runtime.ts` (`inUse`), the renewal predicate at `hub/src/host/provision-host.ts` line 86 (unchanged; it now receives `inUse`); `hub/test/pool-scale.test.ts`.
- Outside the stage: T-1762 (`ee65d6d5b`, `hub/src/cli/literal-rm.ts`, `hub/test/literal-rm.test.ts`).
- The fake host: `hub/src/host/provider/fake.ts` (deletion and confirming reads), `shared/fake-host-directory.ts`, `shared/fixture-sockets.ts` (the `/private/tmp/ct-<32 hex>` alias); `hub/src/state-paths.ts` (`CLAND_EXECUTOR_STATE` first).
- Plan: stage 2 `{"scope":"affected","when":"after-stage"}`, items T-1743, T-1744, T-1745, T-1746, T-1747, T-1748, T-1763; decisions A-17473 (4, 9, 10, 13, 14) and the Coordinator's item decisions above.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "placement on pool hosts, waiting launches, scale up, lease and watchdog"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Read the request's id and any earlier verdict's id from the epic topic's `history`, never from a `send` result (rule 22). Report `qa clear E-1534 stage placement on pool hosts, waiting launches, scale up, lease and watchdog` or `qa not clear E-1534 stage placement on pool hosts, waiting launches, scale up, lease and watchdog` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
