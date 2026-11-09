# Stage QA brief: E-1534 stage 3 — idle stop, failures, restart, money, host status and DigitalOcean

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (start `bash` first; zsh reads `$S:q`, `$B:h` or `${B}:hub` as modifiers and does not split unquoted path lists; always brace a variable before `:`). The run is local, on macOS (BSD `stat`, Node 24 with `node:sqlite`, `uuidgen`, `lsof`). A platform skip is a FAIL, not a pass. **No real SSH, host, droplet, volume, DigitalOcean API, key, credential, npm registry or network (R-1530's QA rule).** The named files use only their own fakes (fake host provider, fake `ssh`/`scp` on fake hosts, the scripted fake DigitalOcean API, an isolated state directory for every spend ledger). The scratch rows create fake hosts only, through the real CLI on a scratch hub. **No real harness.** The browser is the pinned Playwright Headless Shell (E1534S3-41 only); Neovim is headless from the repository's pinned cache (E1534S3-40 only). No GUI.

**Working copy, settled at the stage's last landing.** The Coordinator commits it when the stage lands; every member's rows are settled at the tested dev SHA first ("Rows to verify after landing"). Markers: VERIFIED = read at origin/dev `0a4e5372057b00624ef2b26548c5e41e8b9ea761` (every stage member landed; T-1751 last, as `0a4e53720`); INFERRED = a reasoned expectation no read or run has proven. Nothing is UNVERIFIED and nothing rests on a branch read. An INFERRED line is never a pass condition on its own.

The stage is lifecycle, restart, money and view level. The run is meant to take about four and a half hours: setup and E1534S3-00 to E1534S3-04 about 25 minutes (including the web build); the named files E1534S3-10 to E1534S3-59 about 150 minutes, one file at a time, the native T3 files under the preservation lock; scratch rows E1534S3-60 to E1534S3-79 about 70 minutes (several wait out real host boots and a 2-minute lease cadence). Waits for cover-quiet admission, the preservation lock or load are not product results.

## Carried corrections

A reused kit block must be reconciled against the source brief's recorded run corrections. This brief reuses the stage-3 kit of E-1533, the stage-4 kit of E-1532 and the stage-2 brief's own additions (`relays.mjs`, the scratch helpers), all taken from one fixed commit `K` (`f43f4e21049e9c62a97c8dec1ebf37f9c7035a62`, the committed stage-2 brief), never by blob (A-17643). It carries the stage-2 brief's chain of corrections verbatim as `qa/briefs/E-1534-stage-2.md` holds it at `K` (E-1533 stage 2, stage 3, the E-1533 Definition-of-done run and E-1534 stage 1), then that brief's own first-run corrections (A-17820), verbatim, then its rerun's (A-17843). What was carried, and how, is stated here; nothing below is optional.

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

### From `qa/briefs/E-1534-stage-2.md`, "Corrections from this brief's own first run (qa-678, A-17820)", verbatim

The first run at `4688f956` (run qa-e1534s2-2026-11-08-qa678-1, A-17820) was not clear: E1534S2-55 FAIL, E1534S2-56 INCONCLUSIVE, the other 37 checks PASS. It applied two Coordinator-approved run-copy corrections and found one product defect. A brief that copies this kit carries them as written here:

- **Casing (ask 7199f474, decision d9b1c31c).** The CLI prints session lines with the role's display label (`withRole`, `hub/src/names.ts`): `launched w1 [Implementer] …` and `w1 [Implementer] … host <id>` in `cland session list`. The waiting-line formatter keeps the raw role id: `w2 [implementer] pool agents: waiting for a host`. Row 52 expects `[Implementer]`; rows 53 and 54 keep `[implementer]`.
- **Census (ask b9c53ce3, decision 0dcf424b).** A spoke child of the fake OpenCode under the host agent (spoke → fake OpenCode → agent → `supervisor.sh`, all under the alias or `$Q/fh`) is an expected fake-host survivor, in the carried agent-descendant class. Row 57 records each survivor's identity, ancestry and cwd before the TERM drain; nothing outside the fixture trees is exempted.
- **Rows 55 and 56.** Row 55 printed `lease files 1`: H1, the `min_hosts` startup host running w1, stopped renewing once row 53 scaled H2 up, and its watchdog deleted it before the deliberate hub stop. Hub-side creation passed no `inUse` predicate (`dispatch.ts`), so renewal fell back to `heldByMinimum`, which picks the minimum by host id. T-1763 (landed `550e59aca`, regression-of T-1746) added one shared in-use predicate for manual, startup and demand creates, and is a stage member here. **Both lease mirrors must renew while their hosts are in use:** row 55 expects `lease files 2`, both deadlines moving forward while w1 and w2 run, and both hosts still ready after the wait. **Row 56's after-stop proof needs both hosts alive at its start:** it first checks two `ready` agents hosts; with fewer, the row is BLOCKED naming row 55, never judged on the survivor.


### From the stage-2 rerun (qa-678, A-17843, clear at `966f6fef`)

The rerun (run qa-e1534s2-…-2, clear) applied one Coordinator-approved documentary correction and recorded one finding aside. A brief that copies this kit carries them as written here:

- **Mapping row ids (decision 8c0a533f).** The committed brief's criteria map named E1534S2-27 for T-1744 C4, a row that did not exist; the test ran in E1534S2-21. Every row id a criteria map names must exist in the case or manual tables, and the map must name the row whose command runs the cited test. This brief checks that mechanically (E1534S3-04).
- **Dead T-1676 receipts (finding aside, Low).** Both stage-2 runs left 37 fixture-owner receipt files in `$T` after the Neovim row (E1534S2-26); every receipt PID was absent, no file was open and every temporary fixture root was gone. The residue was attributed to the row's producer group by per-file `$T` listings and receipt mtimes (the listings name the directory, not each receipt, so no per-test attribution is claimed), the producers (the row's test files plus `nvim/test/stub-hub.ts`, `nvim/test/client.ts`, `nvim/test/fixture.ts` and `shared/fixture-ownership.ts`) were compared by SHA-256 with the baseline, and the checked dead directory was removed by literal path after the owned-process drain. Expect the same class after this brief's Neovim rows (E1534S3-40).

**Known flakes for this stage.** T-1731 (`hub/test/host-ssh-contract.test.ts`, run alone), T-1758 and T-1689 (both `hub/test/suite-cancel.test.ts`) are known flakes only by their exact signatures: T-1731 and T-1758 as quoted above; T-1689 (added by the stage-2 brief) is its case named exactly `suite cancel refuses another session’s run while the human can cancel it by id`, failing at line 141 (`assert.equal(pidAlive(job.pid!), true)`) with `false !== true`; any other line or message in that case is not T-1689. T-1735 and T-1732 are fixed: a recurrence of either signature is a regression finding, never a rerun. **T-1736 and T-1761 are not flakes**: a failure there is judged as it stands. None of these files is in this brief's tables; the signatures matter if a cover or a rerun is read beside it.

### How this brief applies them, and the reconciliation

- **Fresh seal, streaming redaction, `QA_SESSION` (carried).** Every named file, the typecheck, the web build and every scratch command runs through the stage-3 kit's `fresh.mjs`; `body.sh` repeats the credential gate before each scratch function. No `env.sh`, no `env -i`.
- **Kit pin (carried; commit `f43f4e21`).** Every reused block is extracted with `git show f43f4e21049e9c62a97c8dec1ebf37f9c7035a62:<path>`: the stage-4 lines (`holder`, `quiet`, `ld`, `tap.mjs`), the stage-3 heredocs (`seal.mjs`, `fresh.mjs`, `frame.mjs`, `body.sh`, `helpers.sh`), and from the committed stage-2 brief its `relays.mjs`, `rstart`/`rstop` and the helper functions of its `scratch.sh` (`hcnt`, `swap`, `hosts`, `hready`, `waitfor`, `oneready`, `running`, `bootwait`, `deleted`, `lines`, `deadlines`; `srow` comes from the stage-3 kit's `helpers.sh`), written to `$Q/scratch2.sh` and sourced by this brief's `scratch.sh`. The stage-2 row functions (`q50` to `q57`) come along unused; this brief's rows are `r60` to `r69`.
- **Landing delta from another fix (carried).** E1534S3-02 compares each member QA read on a branch with its own landing commit and lists later commits that touched those files; a delta from a separately landed fix is named with its commit.
- **Counter scope, `ports()` and the relay (carried).** Config keys are counted inside `[hosts]` only (`hcnt`); `relays.mjs` writes each created host's `ports.json` before any launch reaches it and serves its OpenCode port.
- **Casing and census (A-17820, carried).** Launch and list lines read `[Implementer]`; waiting lines keep `[implementer]`. The census expects, per created host still holding sessions, `supervisor.sh`, the host agent, the fake OpenCode and its spoke; each is recorded (pid, parent, cwd) before the TERM.
- **Both hosts must be alive before an after-stop proof (A-17820, carried).** E1534S3-66 checks its live and doomed hosts are both `ready` before the hub stop, or is BLOCKED naming the row that lost one.
- **Mapping ids (A-17843).** E1534S3-04 checks every `E1534S3-NN` the criteria map names exists as a row. **Dead receipts (A-17843).** E1534S3-79 inventories `$T` as the carried T-1676 clause says, with baseline `7c0320829` for the producers; T-1754 edits `nvim/test/inbox-sections.test.ts` but none of the four fixture producers, so dead residue from it is attributed and reported aside, never exempted silently.
- **Known dead TMPDIR residue, unchanged-producer clause, expected-registration corrections, cleanup order (carried).** Lists are re-derived at `<dev SHA>` before the cases. Cleanup runs: census, then the alias and dead residue removed by literal path, then the end check with `$Q` and `$T` present, then `$Q`, `$T` and the worktree after the verdict.
- **Epic occasion suite, droplet gate filter, dpkg quoting (not applicable here).** A stage run: no epic occasion, no `cland demo`, no droplet gate, no `dpkg` probe.

### Kit conventions carried

- **Rule 22.** Every selector, test name and string is marked VERIFIED, VERIFIED-on-branch or INFERRED; an INFERRED expectation is never a pass condition on its own.
- **TAP.** `node --test <file>` reports top-level registrations with `1..N` and `# tests/pass/fail/cancelled/skipped/todo` counters that include nested subtests; names escape `#` and `\`. `tap.mjs` parses exactly that.
- **Exact strings** are counted by `src.mjs` with `String.split`, never by shell `grep`.
- **The preservation lock** is the directory `/tmp/cland-preserve.lock`, taken with `mkdir`, an owner file naming this run and row, and an owner-checked removal by literal path. A held lock makes the row BLOCKED for now (retry later; never remove another owner's lock).

## Stage

- Epic: E-1534 (Pools, placement and the scheduler, under R-1530).
- Exact stage name: idle stop, failures, restart, money, host status and DigitalOcean.
- Items, in plan order, by lane: [T-1749 (idle stop), T-1750 (boot failures and provider API limits), T-1751 (the hosts sub-cap in the scheduler)], [T-1752 (hub restart with hosts, and gone hosts' sessions exited), T-1753 (unreachable hosts: 3 and 15 minutes, and hosts destroyed by anyone), T-1756 (DigitalOcean host creation under the lease, the watchdog and the spend)], [T-1754 (waiting launches in the Neovim and web inboxes)], [T-1755 (`cland host status` and `cland host stop`)]. The run reads membership, counts and state from `task plan show E-1534 --json` (E1534S3-00), never from this list. QA finding fixes added after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: **affected.** The combined changed behaviour through the stage's named test files, the importer and preservation files they touch, read-only source checks, and scratch checks on the real CLI with created fake hosts. No earlier-epic regression pass beyond those files. The stage-2 behaviour the scratch rows rely on (role pool placement, waits, scale up, leases, watchdogs) is exercised again by rows 60 to 63 and judged there.
  - T-1754 (landed `ee0e19117`, the first landing; VERIFIED at dev; its files byte-identical to its reviewed head `1c20f7bdc`): Neovim's inbox (`nvim/lua/cland/inbox.lua`) and the web inbox (`web/src/InboxArea.tsx`, `.module.css`) show each `waitingLaunches` row as one status line with session, role, pool, reason and since, replaced in place on a reason change, outside needs-you, removed on placement or cancel. **Narrow layout (Coordinator decisions c4167bf3, a8cc9213):** at a 64-column Neovim panel and a 360 px web inbox the since stays visible, compact (`HH:MM` today, date and time otherwise; the full ISO in the web title); only an overflowing identity is clipped with an ellipsis. Tests `nvim/test/inbox-sections.test.ts` (Neovim T2, skipped without Neovim) and `web/test/inbox.test.ts` (Web), both edited.
  - T-1755 (landed `100937ae6`; VERIFIED; byte-identical to its reviewed head `9427dbcb5`): `cland host status [--json]` (frame `host.status`, `hub/src/host/status.ts`) prints per pool `<pool>: <n> hosts · slots <used>/<total>[ · promised <p>] · today $<x> · month $<y>` (slots by weight including placement promises through the shared `PoolRuntime` capacity, `Sessions.hostUsage`; today and month from that project's settled `hosts` ledger entries via `inspectHostSpendSnapshot` plus live hosts' accrued cost, UTC; an unknown price makes the totals `unknown`), and per host `<id> <size> <region> <state> · uptime <s>s · sessions <names> · $<price>/hour`, over `ProvisionRecords.currentInventory()` (approved additive); a host saved `unreachable` reads `unreachable`; `cland host stop <id>` (frame `host.stop`) stops the lease renewal and runs the confirmed destroy, ending the host's sessions as exited; both frames are refused to the web edge and to sessions and remotes; `cland host status|stop --help`; frozen help in `commands.json` migrated. Tests `hub/test/host-status.test.ts`, `hub/test/host-stop.test.ts` (T2, new); edits to `host-provision-records`, `host-spend`, `cli-help`, `web-authority`, `host-secret-admission`; docs `docs/hub/host-status-stop.md`.
  - T-1752 (landed `d57dd0205`; VERIFIED; its files byte-identical to its final branch tip `80fb4f940`, which added injected lock-process and watchdog observations after the head `fe8358dc6` this draft first read, so the restart components run without native processes; T-1753's `241992ac1` later edits `hub/src/host/host-restart.ts`): at hub start, before transports open, `reconcileHostLeases` (`hub/src/host/host-restart.ts`) destroys, through the ordinary confirmed destroy, each leased host its provider reports `gone`; then the order is **attach sessions → restore leases → start scaling** (`Dispatcher.restoreSessions` with `restoreHostLeaseOwners`): a session whose host is deleted, or whose host registration is missing, reads `exited` with its role vacated, while a registered host without a transport stays `running` (an outage, not a gone host); each lease re-arms its watchdog only when the old one is gone and renews on the min(1 h, lease / 4) cadence under the shared in-use predicate; the minimum uses restored inventory without another acquire. Test files `hub/test/host-restart.test.ts` (T3, native, under the preservation lock) and `hub/test/host-restart-reconcile.test.ts` (T2, now with `hub/test/fakes/lock-processes.ts`); `hub/test/host-registry.test.ts` edited (an unknown host row now exits); docs `docs/hub/host-restart.md`.
  - T-1749 (landed `ba3e6e17f`; VERIFIED; its files byte-identical to its final tip `9a7a11116`): an emptied ready host above `min_hosts` is destroyed, with confirmed reads, once both its idle wait (`[hosts.<pool>] idle_stop`) and its provider billing minimum (`earliestStop`, `hub/src/host/provider/declarations.ts`) have passed; a host with a session or a placement promise (the shared `inUse` predicate) is never stopped, and gaining one restarts the full wait; the pool's last hosts at `min_hosts` stay. `PoolRuntime.start` takes an idle lifecycle from `Dispatcher.useSessions`; `Dispatcher.configure` hands its incoming config to `Sessions.configurePools(config)` so `cland config set hosts.<pool>.idle_stop|min_hosts` hot-applies (Coordinator decision f1c0841e). Test file `hub/test/pool-idle-stop.test.ts` (T2, fake clock); docs `docs/hub/pool-idle-stop.md`.
  - T-1753 (landed `241992ac1`; VERIFIED; byte-identical to its final tip `2621bbcdb`): `HostHealth` (`hub/src/host/host-health.ts`) owns the outage clocks on the tunnel status the SSH registry now publishes (`SshTransport` `onStatus`, `registry.subscribeStatus`, wired in `daemon.ts`). After `CLAND_TEST_HOST_UNREACHABLE_MS` or 180 000 ms down it saves the host `unreachable` (a new provision state; `ACTIVE_PROVISION_STATES` and `hostLeaseRenewable` include it) and posts one General line `host <id> unreachable`; a tunnel back clears it with sessions kept; after `CLAND_TEST_HOST_LOST_MS` or 900 000 ms, or as soon as a provider read (at most one a minute) reports the machine `gone`, `loseHost` moves the lease deadline to now (`expireNow`) and runs the confirmed destroy, settling sessions as exited and vacating roles; an outage at hub start counts from the start; both knobs apply only below their defaults and only with `CLAND_FAKE_HOST_ROOT`. `cland host list --json` is accepted. Test files `hub/test/host-unreachable.test.ts` (T2, injected transport status and fake clock) and an added case in `hub/test/host-create-entry.test.ts`; docs `docs/hub/host-health.md`. **No CLI way to drop a fake tunnel:** the tunnel state comes only from the SSH carrier, and the tests inject it; the CLI part of this item is the `host list --json` surface (E1534S3-67).
  - T-1750 (landed `a5673acf5`; VERIFIED; byte-identical to its final tip `a8fc09822`): the boot gate (`hub/src/host/boot-gate.ts`, `HOST_BOOT_MS = 300000`, shortened by `CLAND_TEST_HOST_BOOT_MS` only with `CLAND_FAKE_HOST_ROOT` and never lengthened) destroys a never-booting or never-answering host with confirmed deletion at the deadline while its launch keeps waiting; one Agents line `host <id> in pool <pool> failed to boot: <reason>` (kind `host-boot-failed`) goes to the Coordinator only; a provider refusal's retry time holds creation until then; a pool's create backoff is 1 minute doubling to 30 minutes (`Math.min(1800000, 60000 * 2 ** Math.min(5, count - 1))`), reset by a `ready` host or a changed pool configuration, and a cleanup refusal keeps its record without breaking the streak. The fake provider gained `neverBoot` and `refuseUntil` modes and the fake DigitalOcean API its pacing. Test file `hub/test/pool-failures.test.ts` (T2); edits to `host-provision-gate` (T3), `waiting-launch-restart` (T2) and `digitalocean-pacing` (T2); docs `docs/hub/pool-failures.md`.
  - T-1751 (landed `0a4e53720`, the stage's last landing; VERIFIED; its files byte-identical to its final tip `467af71d4`, the landing adding only tracker files): the hosts sub-cap now governs creation in the scheduler while an admitted host keeps renewing at the sub-cap with the shared cap still applying (`spend.ts`: "Existing hosts keep renewing at the hosts sub-cap; the shared cap still applies."); a create refused at the cap keeps the launch waiting (durably) with no provider acquisition and no new ledger entry, and the busy host keeps its sessions and renewals; committed host-spend mutations notify an in-process observer (`onHostSpendChange`) that reuses the transaction's loaded ledger, and `Dispatcher` posts one General line `hosts daily spend and reservations reached 80% of $<cap>` per UTC day (meta `hosts-spend-warning-day`, so a restart does not repeat it). Test file `hub/test/pool-spend-cap.test.ts` (T2, five cases); `hub/test/host-spend.test.ts` edited (one renewal assertion now expects `daily spend cap` at 18:00, titles unchanged); docs `docs/hub/host-spend-cap.md` and the per-test doc. **Startup-barrier fixture fact (from that doc):** the waiting-through-retry case seeds spend before `projectHub` starts, prearms its `executor-sweep` log observer, awaits a successful sweep (`failures: 0`) and checks the spend lock file is absent before the launch; without that barrier a competing reservation can enter contention backoff on the injected FakeClock, the first refusal never arrives and shutdown joins an unresolved creator. Full `projectHub` restart fixtures pass `droplet: { processes }` with the shared fake lock facts, and a standalone enforce probe must supply `CLAND_TEST_LOCK_IDENTITY`.
  - T-1756 (landed `49b3099fa`; VERIFIED; byte-identical to its final tip `52f12c657`): DigitalOcean create runs under the lease, the armed watchdog and the hosts reservation through `hub/src/host/create-admission.ts` (`hostCreateAdmission`, `HostAdmissionUnavailable`), `admission-fence.ts` and the provider's `createAdmission`, which refuses before any API call with `DigitalOcean host.create requires <missing>` naming `lease`, `armed watchdog` and `hosts reservation`; the provisioning SSH gate (`hub/src/host/provision-ssh.ts`) uses only the provision record's identity and the machine address; the watchdog deletes droplet and key through the fake API with confirming GETs, including a stopped hub; the E-1534 refusal is gone from code, tests and docs. Tests `hub/test/host-provider-digitalocean.test.ts` (T2, 70 registrations) and `hub/test/host-create-admission.test.ts` (T2, 6) edited, with `hub/test/host-admission-fixture.ts`; `host-watchdog-loop`, `host-provider-digitalocean-prepare` and `-volumes` edited without title changes. It also edits `qa/briefs/E-1533-stage-3.md`, `E-1533.md` and `E-1534-stage-1.md`; this run's kit is read at `K` and is unaffected.
- **Merge watch.** T-1749, T-1750, T-1752, T-1753 and T-1755 all edit `hub/src/hub/dispatch.ts` or `hub/src/adapters/sessions.ts`; T-1749, T-1750, T-1753 and T-1755 edit `hub/src/host/pool-runtime.ts`; T-1752, T-1753 and T-1756 share `host-restart.ts`, `host-watchdog.ts` and `provision-records.ts`; T-1750, T-1753, T-1755 and T-1756 each edit `commands.json`. Each landing check names any delta from a later landing.

### Criteria map

The stage verdict carries no item or epic marks; this tells the run which check proves what. E1534S3-04 checks that every row id named here exists in the tables below. Every row is VERIFIED at dev `0a4e5372`.

| criterion | proven by |
| --- | --- |
| T-1749 C1 (`idle_stop = "1m"`: an emptied host above `min_hosts` destroyed after one minute; the pool's last host at `min_hosts` stays) | E1534S3-10 (test `C1 idle host is destroyed at one minute while min_hosts stays`; the `min_hosts` and `idle_stop` expansions of `hub config <key> hot apply reaches confirmed destruction through the lifecycle owner`); E1534S3-65 |
| T-1749 C2 (no stop before the provider billing minimum, `earliestStop`) | E1534S3-10 (test `C2 billing minimum delays destruction beyond idle_stop`; test `asynchronous provider declarations are shared and precede idle destruction`; test `synchronous declaration failure retries after 60 seconds without external reconciliation`); E1534S3-03 |
| T-1749 C3 (a host with a session is never idle-stopped) | E1534S3-10 (test `C3 running host stays beyond idle_stop and billing minimum`); E1534S3-65 (H1 with w1 stays) |
| T-1749 C4 (gaining a session during the idle wait cancels the old time) | E1534S3-10 (test `C4 session gained during idle wait restarts the full wait after exit`; test `placement promise resets idle wait even if released before the old timer`; test `simultaneous deadlines never stop below a raised minimum`) |
| T-1750 C1 (never-booting fake host destroyed with confirmed deletion at 5 minutes; launch stays waiting; one Coordinator Agents line naming the host) | E1534S3-11 (the `neverBoot` expansion of `C1/C2 <mode> fails at five minutes and deletion is confirmed`; test `boot failure lifecycle notice names the host and addresses only Coordinator`; the `neverBoot` expansion of `waiting launch survives <mode> with one failure notice and bounded retry`); E1534S3-24 (test `pending acquire checkpoints unknown at five minutes and destroys a late identity`); E1534S3-03 |
| T-1750 C2 (a pinned key that never answers within the gate, the same) | E1534S3-11 (the `pinned-key` expansions of the same two loops; the `status` and `ssh` expansions of `identified <phase> probe is cancelled and joined at the absolute boot deadline`); E1534S3-24 (the `status` and `ssh` expansions of `identified machine <phase> is cancelled at its boot deadline and deletion confirmed`) |
| T-1750 C3 (a provider refusal with a retry time: no acquire before it, launch waiting, one create after) | E1534S3-11 (test `C3 provider retry time holds capacity creation without a cascade`; the `refuseUntil` expansion of `waiting launch survives <mode> …`; the `configure` and `ready` expansions of `provider not-before survives <reset> reset`); E1534S3-03 |
| T-1750 C4 (create backoff 1 minute doubling to 30 minutes; a `ready` host resets it) | E1534S3-11 (test `C4 retries double to thirty minutes and ready resets the failure streak`; test `only a changed pool configuration resets its backoff, including no-argument configure`; test `consecutive retained cleanup failures preserve the exponential backoff streak`; test `cleanup refusal retains its record while a ready sibling places waiting launches`; the four expansions of `rejected cleanup preserves a newer <completion> checkpoint`); E1534S3-03 |
| T-1750 C5 (`CLAND_TEST_HOST_BOOT_MS` inside the fake-host fence only) | E1534S3-11 (test `C5 boot shortening is fenced to fake hosts`; test `fake boot knob cannot extend the fixed deadline`); E1534S3-03 |
| T-1751 C1 (tiny sub-cap: a second host refused at 100 %, launch waiting, first host keeps sessions and renewals) | E1534S3-12 (test `full hosts cap keeps demand waiting without provider acquisition or ledger entry and retains busy host`; test `admitted host renews beyond hosts sub-cap while shared cap still applies`; test `cap-refused scheduler launch remains in the durable waiting list through retry`); E1534S3-14 (`host-spend`, edited); E1534S3-03 |
| T-1751 C2 (crossing 80 % posts exactly one General line that day, across a restart too) | E1534S3-12 (test `80 percent General warning survives restart and repeats only on a new UTC day`; test `mutation notices reuse loaded ledger with no observer reads and unsubscribe retires owner`); E1534S3-03 |
| T-1751 C3 (a refused create makes no provider call and no ledger entry) | E1534S3-12 (test `full hosts cap keeps demand waiting without provider acquisition or ledger entry and retains busy host`; test `cap-refused scheduler launch remains in the durable waiting list through retry`) |
| T-1752 C1 (restart with two fake hosts, one deleted while stopped: live session running, deleted host's session exited, role vacated) | E1534S3-21 (test `restart keeps the live host and exits the deleted host, settles spend, and restores watchdog ownership`); E1534S3-20 (the `gone=true` and `gone=false` expansions of `restart settles only positive provider absence: gone=<bool>`); E1534S3-66 |
| T-1752 C2 (the deleted host's lease released and spend settled) | E1534S3-21 (the same test); E1534S3-20 (the same expansions; test `lease spend lifecycle uses injected lock births with a positive no-native control`); E1534S3-66 |
| T-1752 C3 (a session whose host is unknown reads exited, never running) | E1534S3-22 (test `without the test-host environment only local is registered; unknown host rows exit without native authority`; test `registered host without a transport remains running during restart recovery`); E1534S3-03 |
| T-1752 C4 (restart with `min_hosts = 1` and one live host creates no further host) | E1534S3-20 (the `minimum=1` and `minimum=2` expansions of `reopened minimum-host scheduler completes admitted work: minimum=<n>`); E1534S3-21; E1534S3-66 |
| T-1752 C5 (a lease whose watchdog is gone is re-armed; a live watchdog is not given a second one) | E1534S3-21; E1534S3-20 (the `missing`, `malformed`, `earlier-expired` and `earlier-live` expansions of `watchdog recovery preserves effective mirror deadline: <fault>`; test `startup attaches session settlement before an already-expired lease enters destruction`); E1534S3-03 |
| T-1752 C6 (after a restart a live host in use renews on min(1 h, lease / 4)) | E1534S3-20 (the `1h` and `12h` expansions of `reopened lease renews at min(1h, <lease>/4) with a live watchdog`); E1534S3-66 |
| T-1753 C1 (3 minutes down: one General line `host <id> unreachable`; `unreachable` in `cland host list --json`) | E1534S3-23 (test `three minutes down publishes one unreachable line and recovery preserves the host`); E1534S3-25 (test `host list accepts its JSON alias and refuses other extra arguments`); E1534S3-03; E1534S3-67 (the CLI surface only) |
| T-1753 C2 (back within 15 minutes: state cleared, sessions kept, no second line) | E1534S3-23 (the same test; test `a restored unreachable host already up clears its retained outage state`; the `recovered` expansion of `outage settles sessions and roles: <outcome>`; test `provider replies are fenced by the outage and flapping checks are rate bounded`) |
| T-1753 C3 (15 minutes down: sessions exited, roles vacated, confirmed destroy, lease file deadline moved) | E1534S3-23 (the `gone=false` expansion of `lost host invokes the confirmed deletion owner: provider gone=<bool>`; test `lost deadline joins renewal and publishes now before deletion ownership`; the `lost` and `mirror-failure` expansions of `outage settles sessions and roles: <outcome>`; test `loss waits for ledger-blocked renewal before publishing the watchdog deadline`; test `failed lease shortening retains an owned next-tick mirror retry`); E1534S3-03 |
| T-1753 C4 (a provider-reported gone machine ends its sessions at once) | E1534S3-23 (the `gone=true` expansion of `lost host invokes the confirmed deletion owner: provider gone=<bool>`; the `gone` expansion of `outage settles sessions and roles: <outcome>`); E1534S3-03 |
| T-1753 C5 (an unreopenable tunnel at hub start starts the outage clock then) | E1534S3-23 (the `false` and `true` expansions of `registry replays the continuous outage start: later loss=<bool>`) |
| T-1753 C6 (`CLAND_TEST_HOST_UNREACHABLE_MS`, `CLAND_TEST_HOST_LOST_MS` inside the fence only) | E1534S3-23 (the `false` and `true` expansions of `shortened health clocks require the fake-host fence: <bool>`); E1534S3-03; S0 (`CLAND_TEST_HOST_ knobs 0`) |
| T-1754 C1 (Neovim: one line with session, role, pool, reason and since; reason change in place) | E1534S3-40 (test `waiting launches render facts and replace reasons without needs-you or departure rows`, including the 64-column panel with the since visible) |
| T-1754 C2 (web: the same line, updated in place; colour and contrast checks pass) | E1534S3-41 (test `waiting launches update status facts in place without needs-you and disappear on placement or cancel`, including the 360 px width with the since visible); E1534S3-01 (the web typecheck's token and contrast check) |
| T-1754 C3 (neither inbox counts a wait toward needs-you; both drop the line on placement or cancel) | E1534S3-40; E1534S3-41 (the same tests); E1534S3-63 (the hub's inbox frame carries the wait outside needs-you) |
| T-1755 C1 (per pool: hosts, slots used of total by weight, today's and the month's spend from that pool's `hosts` entries plus live accrual) | E1534S3-30 (test `C1 status includes configured empty pools and zero settled spend`; test `C1/C2 status weights sessions and clips live accrual to UTC day/month, excluding reservations`); E1534S3-14 (test `settled UTC totals separate days, months and pools while pending costs stay excluded`; test `host status snapshot pins billing by exact project and lease without changing totals shape`; test `usage and reserve share retained-generation and placement-promise capacity`); E1534S3-64 |
| T-1755 C2 (each host line: id, size, region, uptime, sessions, price per hour, state; a host recorded `unreachable` reads `unreachable`) | E1534S3-30 (test `C1/C2 status weights sessions and clips live accrual to UTC day/month, excluding reservations`, which saves a host `unreachable` and reads it back); E1534S3-64 |
| T-1755 C3 (`cland host stop <id>` ends the host's sessions as exited and destroys it with confirmed reads) | E1534S3-31 (the `true` and `false` expansions of `C3 stop joins lease renewal and requires confirmed destroy: <bool>`); E1534S3-68 |
| T-1755 C4 (`cland host create` at `max_hosts` refused naming `max_hosts`) | E1534S3-31 (test `C4 manual create refuses occupied max_hosts before publishing another row`); E1534S3-14 (test `current inventory matches occupied including acquired failures and excluding positive non-acquisition`) |
| T-1755 C5 (`host.status`, `host.stop` refused from a session or a remote; `cland host --help` lists `status` and `stop`) | E1534S3-31 (test `C5 host help lists status and stop`); E1534S3-32 (the `status` and `stop` expansions of `cland host <command> --help exits without a hub`); E1534S3-33 (the `host.status` and `host.stop` expansions of `web refuses <type> even from authenticated human`, and `host-secret-admission`); E1534S3-03 |
| T-1756 C1 (DigitalOcean create with lease, watchdog and reservation reaches the droplet create with image and tags, fake API) | E1534S3-50 (test `digitalocean create carries configured inputs, isolated key and project/pool tags; invalid region makes no call`; test `DigitalOcean binds create to durable watchdog input and discovers the exact lease after a lost checkpoint`; test `DigitalOcean admission creates at most one provider intent per lease`; test `DigitalOcean create requires a prepared pool before acquisition API calls`); E1534S3-03 |
| T-1756 C2 (missing any of the three: refused before any API call, naming it) | E1534S3-50 (the `lease`, `watchdog` and `reservation` expansions of `DigitalOcean missing <field> refuses before any API call`; test `DigitalOcean rejects a lease admitted for another provider before API access`; the nine `DigitalOcean revalidates <invalidation> <boundary> before provider mutations` and eight `DigitalOcean <phase> revalidates <invalidation> inside API pacing` expansions); E1534S3-03 |
| T-1756 C3 (the SSH gate from the provision record and machine address, never a fake host directory or `CLAND_FAKE_HOSTS`) | E1534S3-50 (test `DigitalOcean SSH gate records the provision identity and address without fake environment reads`); E1534S3-03 |
| T-1756 C4 (hub stopped: the watchdog deletes droplet and key through the fake API, each confirmed by a GET) | E1534S3-50 (test `DigitalOcean watchdog deletes an admitted droplet after owner closure before machine checkpoint`; the six `DigitalOcean stopped-hub key recovery by <identity>: <outcome>` expansions; the `stopped-hub watchdog` expansion of `DigitalOcean cooldown key cleanup completes through <owner>`; test `DigitalOcean machine-less watchdog replays a hub-originated absence receipt without API rediscovery`); E1534S3-25 (`host-watchdog-loop`, edited) |
| T-1756 C5 (the fake provider's create-to-ready tests pass with no test edited) | E1534S3-24 (`host-create-ready`, `host-destroy-native`, `host-watchdog`); E1534S3-25 (`host-create-entry`); E1534S3-02 (T-1756's landing edits none of the preserved files) |
| T-1756 C6 (no code, test or doc still names the E-1534 refusal) | E1534S3-52 (`files naming the E-1534 refusal: 0`, VERIFIED at dev) |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1534 --json` lists in stage `idle stop, failures, restart, money, host status and DigitalOcean`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit. A task closed `done` with no branch and no landing receipt must have no `Item:` trailer on dev (evidence-only completion). A dirty build, a missing required merge (**every member needs a landing here**) or moved dev blocks this run: retain any collected evidence and report to the requester. The brief names no run id on purpose.

At writing (dev `0a4e5372`): T-1754 landed as `ee0e19117`, T-1755 as `100937ae6`, T-1752 as `d57dd0205`, T-1749 as `ba3e6e17f`, T-1753 as `241992ac1`, T-1750 as `a5673acf5`, T-1756 as `49b3099fa` and T-1751 as `0a4e53720`, each with its `Item:` trailer; their files were read at that dev (VERIFIED). **Landing check.** E1534S3-02 compares each member's own files at its landing commit with its final branch tip and lists the later commits that touched those files; a difference is named with its source (a separately landed fix with its commit, a review correction, a dev merge), the member's own lines must still match, and every changed list is re-derived (the expected-registration correction), never a silent pass. Every string, title and path is re-read at `<dev SHA>` and a difference recorded before judging.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step. E1534S3-05 builds `web/dist` in the worktree (ignored by Git) for E1534S3-41, whose pinned Headless Shell comes from `node_modules/playwright-core/.local-browsers`. E1534S3-40 needs the pinned Neovim that `nvim/bin/nvim-path.ts` resolves (`NV` and `NVD` in the environment block).

**Where things live.** All scratch state is under `$Q` (`/private/tmp/q53-…`, realpath, 23 bytes; the stage-3 kit's seal accepts exactly this prefix) and `$T` (`/private/tmp/qa-e1533-s3-<uuid>`, the suite root's byte length; also the kit's prefix). Created fake hosts live under `$Q/fh/.fixture-sockets/<machine>`, behind one `/private/tmp/ct-<32 hex>` alias, recorded in `$Q/alias.txt` and removed by literal path at cleanup. The spend ledger of the scratch hub and of its watchdogs is `$Q/executor-state/spend.json` (the seal's `CLAND_EXECUTOR_STATE`); never the user's ledger. The only paths under the repository are `$W` in `.cland/worktrees/` and the evidence `$EV` in `.cland/qa/E-1534/<run>/`, both ignored by Git. Nothing is written to `.cland/tasks/` of the live project.

**Isolation (rule 15).** Every scratch check runs in a disposable project p1 with its own HOME, XDG directories and Git config, through the fresh seal. Never the live project's hub, config, roles, territory, `hub.db`, secrets or discovery, and never the human's HOME (`~/.cland`, `~/.ssh`, `~/.claude`, `~/.codex`, `~/.opencode`, `~/.local/state`, `~/.config/cland`). Never read or print a credential; never run `cland config set`, `cland role launch`, `cland session …`, `cland host …` or `cland hub …` against the live project. The live hub is read only by QA's own shell for the plan read and `quiet`.

Two shells, never mixed. **QA's own shell** keeps QA's session identity: worktree, roots, `quiet`, the plan read, the source checks, the relay watcher, every record. **Every other command** runs through `$Q/fresh.mjs`: named files, the typecheck and the web build in `plain` mode (cwd `$W`), scratch rows in `hub` mode (cwd `$Q/p1`, through `body.sh`).

**Removals.** Every `rm` names one literal path, written out in full after it was printed and checked; never a glob, a variable, a command substitution or `xargs` (the project's literal-rm hook refuses them and stalls the session). Scratch helpers write into fresh `mktemp -d` directories under `$Q`, removed with `$Q` at the end.

### Environment

Put Node from `/Users/evgeniyivanov/.nvm/versions/node/v24.21.0/bin` first on `PATH` and check `node --version` against the qa skill's `node-engines.json`. In QA's own shell (bash):

```sh
R=/Users/evgeniyivanov/Projects/cland/v0
S=<dev SHA>                                    # the full dev SHA from the request
K=f43f4e21049e9c62a97c8dec1ebf37f9c7035a62     # the fixed kit commit (A-17643: pin a commit, never a blob)
RUN=qa-e1534s3-$(date +%F)-1                   # unique run id for E-1534; bump the suffix on a rerun
export QA_SESSION=${QA_SESSION:-${CLAND_SESSION_NAME:-}}
[ -n "$QA_SESSION" ] || echo "BLOCKED: no QA session name"
W=$R/.cland/worktrees/qa-e1534s3-$RUN
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

**The kits, from one fixed commit.** `K` above. From `qa/briefs/E-1532-stage-4.md` at `K`: `holder`, `quiet`, `ld` (lines 133 to 136) and `tap.mjs` (lines 228 to 279). From `qa/briefs/E-1533-stage-3.md` at `K`: its heredocs `seal.mjs`, `fresh.mjs`, `frame.mjs`, `body.sh` and `helpers.sh`, each taken whole and written to `$Q` unchanged. From `qa/briefs/E-1534-stage-2.md` at `K`: its `relays.mjs` heredoc and its `rstart`/`rstop` lines, unchanged, and its `scratch.sh` heredoc written to `$Q/scratch2.sh` (the helper functions; its row functions stay unused). Not taken: any brief's `expect.json`, `src.mjs`, `checks.sh` (this brief writes its own). A missing kit file or block at `K` is a setup BLOCKED.

```sh
for b in E-1532-stage-4 E-1533-stage-3 E-1534-stage-2; do git -C "$R" show "$K:qa/briefs/$b.md" > "$Q/kit/$b.md"; done
echo "kit commit $(git -C "$R" rev-parse "$K^{commit}") want f43f4e21049e9c62a97c8dec1ebf37f9c7035a62"
sed -n '133,136p' "$Q/kit/E-1532-stage-4.md" > "$Q/kit-shell.sh"; sed -n '228,279p' "$Q/kit/E-1532-stage-4.md" > "$Q/kit-tap.sh"
echo "kit first lines: $(head -n 1 "$Q/kit-shell.sh" | cut -c1-10) | $(head -n 1 "$Q/kit-tap.sh" | cut -c1-27)"
. "$Q/kit-shell.sh"; . "$Q/kit-tap.sh"
kitb() { awk -v n="$2" 'BEGIN{h="cat > \"$Q/" n "\" <<"} index($0,h)==1{f=1} f{print} f&&/^(JS|SH|JSON)$/{exit}' "$Q/kit/$1.md"; }
for n in seal.mjs fresh.mjs frame.mjs body.sh helpers.sh; do kitb E-1533-stage-3 "$n" > "$Q/kit3-$n.sh"; echo "kit3 $n: $(head -n 1 "$Q/kit3-$n.sh" | cut -c1-40) | lines $(wc -l < "$Q/kit3-$n.sh" | tr -d ' ')"; . "$Q/kit3-$n.sh"; done
kitb E-1534-stage-2 relays.mjs > "$Q/kit2-relays.sh"; kitb E-1534-stage-2 scratch.sh | sed '1s|"$Q/scratch.sh"|"$Q/scratch2.sh"|' > "$Q/kit2-scratch.sh"
grep -E '^(rstart|rstop)\(\) ' "$Q/kit/E-1534-stage-2.md" > "$Q/kit2-relay-fns.sh"
for n in relays scratch relay-fns; do echo "kit2 $n: $(head -n 1 "$Q/kit2-$n.sh" | cut -c1-40) | lines $(wc -l < "$Q/kit2-$n.sh" | tr -d ' ')"; . "$Q/kit2-$n.sh"; done
node --check "$Q/tap.mjs" && node --check "$Q/seal.mjs" && node --check "$Q/fresh.mjs" && node --check "$Q/frame.mjs" && node --check "$Q/relays.mjs" && bash -n "$Q/body.sh" && bash -n "$Q/helpers.sh" && bash -n "$Q/scratch2.sh" && type rstart rstop > /dev/null && echo "kits checked"
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

Expected: `kit commit` equal to `want`; `kit first lines: holder() { | cat > "$Q/tap.mjs" <<'JS'`; each `kit3` and `kit2` line starts with `cat > "$Q/<name>" <<'` (or `rstart() {` for `relay-fns`) and has more than one line; `kits checked`.

The S0 environment prints, each through its own fresh seal:

```sh
for m in plain hub; do node "$Q/fresh.mjs" "$Q" "$m" node -e 'const fs=require("fs"),os=require("os"),path=require("path");const e=process.env,h=os.userInfo().homedir,real=p=>{try{return fs.realpathSync(p)}catch{return p}};const allowed=new Set([real(path.dirname(process.execPath)),real(process.argv[1])]);console.log(process.argv[2]+": credential-prefix names "+Object.keys(e).filter(k=>/^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|CODEX_API|CODEX_ACCESS|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)/.test(k)).length+"; QA_SESSION "+(e.QA_SESSION?"set":"unset")+"; TMPDIR is T "+(e.TMPDIR===e.QA_T)+"; HOME is Q/home "+(e.HOME===e.QA_Q+"/home")+"; XDG_STATE_HOME is Q/state "+(e.XDG_STATE_HOME===e.QA_Q+"/state")+"; CLAND_EXECUTOR_STATE is Q/executor-state "+(e.CLAND_EXECUTOR_STATE===e.QA_Q+"/executor-state")+"; CLAND_TEST_HOST_ knobs "+Object.keys(e).filter(k=>k.startsWith("CLAND_TEST_HOST_")).length+"; real-HOME PATH entries other than the Node bin and the pinned Neovim directory "+e.PATH.split(":").filter(p=>p.startsWith("~")||((p===h||p.startsWith(h+"/"))&&!allowed.has(real(p)))).length)' "$NVD" "$m"; done 2>&1 | tee "$EV/S0-env.txt"
echo "Q bytes $(printf '%s' "$Q" | wc -c | tr -d ' '); T bytes $(printf '%s' "$T" | wc -c | tr -d ' '); a suite root for comparison $(printf '%s' "/private/tmp/cland-suite-$(uuidgen | tr 'A-Z' 'a-z')" | wc -c | tr -d ' ')" | tee -a "$EV/S0-env.txt"
```

Expected (recorded as `S0`): `kits checked`; both modes `credential-prefix names 0`, `QA_SESSION set`, TMPDIR, HOME, `XDG_STATE_HOME is Q/state` and `CLAND_EXECUTOR_STATE is Q/executor-state` `true`, `CLAND_TEST_HOST_ knobs 0` (the scratch hub gets them only where a row sets them), `0` real-HOME entries, each `# fresh: redacted or withheld lines 0`; `Q bytes 23`, `T bytes` equal to the suite root's. A non-zero credential count stops the run (BLOCKED).

The TAP expectations. `exact: true` lists every registration; `exact: false` lists the names that prove a criterion (the rest of the file must still pass); `[]` means the whole file must be `CLEAN`. Lists were read at dev `0a4e5372` (VERIFIED), after the stage's last landing. Generated names, nested loops included, were expanded statically from their loop arrays and each exact list compared with the full expansion. Re-derive every touched list at `<dev SHA>` before E1534S3-10 (the expected-registration correction).

```sh
cat > "$Q/expect.json" <<'JSON'
{
 "hub/test/pool-idle-stop.test.ts": {"exact": true, "names": [
  "C1 idle host is destroyed at one minute while min_hosts stays",
  "C2 billing minimum delays destruction beyond idle_stop",
  "C3 running host stays beyond idle_stop and billing minimum",
  "C4 session gained during idle wait restarts the full wait after exit",
  "placement promise resets idle wait even if released before the old timer",
  "simultaneous deadlines never stop below a raised minimum",
  "hub config idle_stop hot apply reaches confirmed destruction through the lifecycle owner",
  "hub config min_hosts hot apply reaches confirmed destruction through the lifecycle owner",
  "asynchronous provider declarations are shared and precede idle destruction",
  "synchronous declaration failure retries after 60 seconds without external reconciliation"]},
 "hub/test/pool-failures.test.ts": {"exact": true, "names": [
  "C3 provider retry time holds capacity creation without a cascade",
  "C1/C2 neverBoot fails at five minutes and deletion is confirmed",
  "C1/C2 pinned-key fails at five minutes and deletion is confirmed",
  "C5 boot shortening is fenced to fake hosts",
  "boot failure lifecycle notice names the host and addresses only Coordinator",
  "C4 retries double to thirty minutes and ready resets the failure streak",
  "waiting launch survives neverBoot with one failure notice and bounded retry",
  "waiting launch survives pinned-key with one failure notice and bounded retry",
  "waiting launch survives refuseUntil with one failure notice and bounded retry",
  "only a changed pool configuration resets its backoff, including no-argument configure",
  "provider not-before survives configure reset",
  "provider not-before survives ready reset",
  "fake boot knob cannot extend the fixed deadline",
  "identified status probe is cancelled and joined at the absolute boot deadline",
  "identified ssh probe is cancelled and joined at the absolute boot deadline",
  "cleanup refusal retains its record while a ready sibling places waiting launches",
  "consecutive retained cleanup failures preserve the exponential backoff streak",
  "rejected cleanup preserves a newer destroyed checkpoint",
  "rejected cleanup preserves a newer released checkpoint",
  "rejected cleanup preserves a newer replacement checkpoint",
  "rejected cleanup preserves a newer ready checkpoint"]},
 "hub/test/pool-spend-cap.test.ts": {"exact": true, "names": [
  "admitted host renews beyond hosts sub-cap while shared cap still applies",
  "80 percent General warning survives restart and repeats only on a new UTC day",
  "full hosts cap keeps demand waiting without provider acquisition or ledger entry and retains busy host",
  "cap-refused scheduler launch remains in the durable waiting list through retry",
  "mutation notices reuse loaded ledger with no observer reads and unsubscribe retires owner"]},
 "hub/test/pool-scale.test.ts": {"exact": false, "names": [
  "C1 startup maintains min_hosts without a launch",
  "C2/C4 booting counts toward max and two launches share one new host",
  "C3 raising max_hosts places a waiting launch without restart",
  "C5 overflow never exceeds max_hosts",
  "T-1763 startup and demand hosts renew running sessions after scale-up",
  "T-1763 manual host placement promise renews until failed launch releases it",
  "T-1763 minimum keeps older idle startup host when manual host appears"]},
 "hub/test/host-lease.test.ts": {"exact": false, "names": []},
 "hub/test/waiting-launch-restart.test.ts": {"exact": false, "names": []},
 "hub/test/digitalocean-pacing.test.ts": {"exact": false, "names": [
  "aborted scoped droplet GET joins the fake request before returning"]},
 "hub/test/host-provision-gate.test.ts": {"exact": false, "names": [
  "never-booting creation releases at exactly 300000 ms on the hub clock",
  "pending acquire checkpoints unknown at five minutes and destroys a late identity",
  "identified machine status is cancelled at its boot deadline and deletion confirmed",
  "identified machine ssh is cancelled at its boot deadline and deletion confirmed"]},
 "hub/test/host-provision-records.test.ts": {"exact": false, "names": [
  "active inventory reads only non-terminal rows despite retained history",
  "occupied keeps unresolved failed acquisitions and frees only positive receipts",
  "current inventory matches occupied including acquired failures and excluding positive non-acquisition",
  "usage and reserve share retained-generation and placement-promise capacity"]},
 "hub/test/host-spend.test.ts": {"exact": false, "names": [
  "settled UTC totals separate days, months and pools while pending costs stay excluded",
  "never-acquired receipts cancel at zero while unknown outcomes retain reservation and acquired lifetimes keep minimum",
  "host status snapshot pins billing by exact project and lease without changing totals shape"]},
 "hub/test/host-restart-reconcile.test.ts": {"exact": true, "names": [
  "restart settles only positive provider absence: gone=true",
  "restart settles only positive provider absence: gone=false",
  "reopened lease renews at min(1h, 1h/4) with a live watchdog",
  "reopened lease renews at min(1h, 12h/4) with a live watchdog",
  "watchdog recovery preserves effective mirror deadline: missing",
  "watchdog recovery preserves effective mirror deadline: malformed",
  "watchdog recovery preserves effective mirror deadline: earlier-expired",
  "watchdog recovery preserves effective mirror deadline: earlier-live",
  "startup attaches session settlement before an already-expired lease enters destruction",
  "reopened minimum-host scheduler completes admitted work: minimum=1",
  "reopened minimum-host scheduler completes admitted work: minimum=2",
  "lease spend lifecycle uses injected lock births with a positive no-native control"]},
 "hub/test/host-restart.test.ts": {"exact": true, "names": [
  "restart keeps the live host and exits the deleted host, settles spend, and restores watchdog ownership"]},
 "hub/test/host-registry.test.ts": {"exact": true, "names": [
  "legacy process database migrates host in place and persists named hosts",
  "test Host logs every operation, returns synthetic Linux identities and refuses native work",
  "real project hub registers only opted-in test hosts and keeps local session frames unchanged",
  "without the test-host environment only local is registered; unknown host rows exit without native authority",
  "registered host without a transport remains running during restart recovery"]},
 "hub/test/host-unreachable.test.ts": {"exact": true, "names": [
  "three minutes down publishes one unreachable line and recovery preserves the host",
  "lost host invokes the confirmed deletion owner: provider gone=false",
  "lost host invokes the confirmed deletion owner: provider gone=true",
  "shortened health clocks require the fake-host fence: false",
  "shortened health clocks require the fake-host fence: true",
  "lost deadline joins renewal and publishes now before deletion ownership",
  "a restored unreachable host already up clears its retained outage state",
  "registry replays the continuous outage start: later loss=false",
  "registry replays the continuous outage start: later loss=true",
  "outage settles sessions and roles: recovered",
  "outage settles sessions and roles: lost",
  "outage settles sessions and roles: gone",
  "outage settles sessions and roles: mirror-failure",
  "provider replies are fenced by the outage and flapping checks are rate bounded",
  "loss waits for ledger-blocked renewal before publishing the watchdog deadline",
  "failed lease shortening retains an owned next-tick mirror retry",
  "idle stop and outage grace retain a 30s lease: spare=false recover=false",
  "idle stop and outage grace retain a 30s lease: spare=false recover=true",
  "idle stop and outage grace retain a 30s lease: spare=true recover=false",
  "idle stop and outage grace retain a 30s lease: spare=true recover=true"]},
 "hub/test/host-watchdog.test.ts": {"exact": false, "names": []},
 "hub/test/host-destroy-native.test.ts": {"exact": false, "names": []},
 "hub/test/host-create-ready.test.ts": {"exact": false, "names": []},
 "hub/test/host-watchdog-loop.test.ts": {"exact": false, "names": []},
 "hub/test/host-watchdog-identity.test.ts": {"exact": false, "names": []},
 "hub/test/host-create-entry.test.ts": {"exact": true, "names": [
  "hub create entry passes its clock and owner to the injected create path",
  "host list accepts its JSON alias and refuses other extra arguments"]},
 "hub/test/host-status.test.ts": {"exact": true, "names": [
  "C1 status includes configured empty pools and zero settled spend",
  "C1/C2 status weights sessions and clips live accrual to UTC day/month, excluding reservations",
  "status ledger read drains before storage closes; setup failure=false",
  "status ledger read drains before storage closes; setup failure=true"]},
 "hub/test/host-stop.test.ts": {"exact": true, "names": [
  "C3 stop joins lease renewal and requires confirmed destroy: true",
  "C3 stop joins lease renewal and requires confirmed destroy: false",
  "C5 host help lists status and stop",
  "C4 manual create refuses occupied max_hosts before publishing another row"]},
 "hub/test/cli-help.test.ts": {"exact": false, "names": [
  "cland host status --help exits without a hub",
  "cland host stop --help exits without a hub"]},
 "hub/test/cli-usage-compatibility.test.ts": {"exact": false, "names": [
  "all command usage exports retain their pre-refactor bytes"]},
 "hub/test/cli-command-help.test.ts": {"exact": false, "names": []},
 "hub/test/web-authority.test.ts": {"exact": false, "names": [
  "web refuses host.status even from authenticated human",
  "web refuses host.stop even from authenticated human"]},
 "hub/test/host-secret-admission.test.ts": {"exact": false, "names": []},
 "nvim/test/inbox-sections.test.ts": {"exact": false, "names": [
  "waiting launches render facts and replace reasons without needs-you or departure rows"]},
 "nvim/test/inbox-actions.test.ts": {"exact": false, "names": []},
 "nvim/test/inbox-requests.test.ts": {"exact": false, "names": []},
 "nvim/test/needs-you.test.ts": {"exact": false, "names": []},
 "web/test/inbox.test.ts": {"exact": false, "names": [
  "waiting launches update status facts in place without needs-you and disappear on placement or cancel"]},
 "web/test/phone-inbox.test.ts": {"exact": false, "names": []},
 "hub/test/host-provider-digitalocean.test.ts": {"exact": true, "names": [
  "digitalocean create carries configured inputs, isolated key and project/pool tags; invalid region makes no call",
  "digitalocean release confirms both droplet and key with GET after split DELETE 404",
  "digitalocean lost create response is reaped after provider restart; other pool and project survive",
  "digitalocean owned host and its key survive reap while an unowned host is removed",
  "digitalocean configured base image does not override a prepared pool image",
  "digitalocean provider keeps sentinel out of output, errors and user-data, and launches no child",
  "digitalocean registry resolves and production acquisition refuses before any API request",
  "digitalocean reap finds tagged droplets and pool-prefixed keys without local intents",
  "digitalocean reap rechecks owner admission after held inventory and preceding deletion",
  "digitalocean reap preserves overlapping pool keys with and without intent records",
  "digitalocean reap holds owner admission through both confirmed deletes; snapshot-only callers fail closed",
  "digitalocean reap admits orphan key cleanup through its current owner",
  "digitalocean incomplete retirement blocks owner claims through restart until both resources reconcile",
  "digitalocean pending retirement reconciles after transient key GET failure and empty inventories",
  "digitalocean pending retirement survives a lost owner settlement acknowledgement",
  "digitalocean declarations load API prices and limit atomically and retain the last good read",
  "digitalocean 429 pauses every create until retry time without POST cascades or token leaks",
  "digitalocean 422 pauses every create until retry time without POST cascades or token leaks",
  "digitalocean unavailable declarations refuse safely and recover without partial publication",
  "digitalocean initial declaration 429 holds subsequent creates without a request",
  "digitalocean unrelated 422 is failed and does not pause creation",
  "digitalocean accepted create followed by address GET 429 retains ownership and pauses later creates",
  "digitalocean held create refusal cannot shorten a concurrent declaration refresh pause",
  "digitalocean refuses invalid pool \"agents_1\" before acquire or reap API calls",
  "digitalocean refuses invalid pool \"-agents\" before acquire or reap API calls",
  "digitalocean refuses invalid pool \"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\" before acquire or reap API calls",
  "digitalocean reaps valid pool tags and keys exactly: agents-host-x",
  "digitalocean reaps valid pool tags and keys exactly: Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "DigitalOcean missing lease refuses before any API call",
  "DigitalOcean missing watchdog refuses before any API call",
  "DigitalOcean missing reservation refuses before any API call",
  "DigitalOcean binds create to durable watchdog input and discovers the exact lease after a lost checkpoint",
  "DigitalOcean watchdog deletes an admitted droplet after owner closure before machine checkpoint",
  "DigitalOcean watchdog with no exact tag match retains ownership and reports once",
  "DigitalOcean watchdog with failed discovery list retains ownership and reports once",
  "DigitalOcean admission creates at most one provider intent per lease",
  "DigitalOcean rejects a lease admitted for another provider before API access",
  "DigitalOcean revalidates lease before acquire before provider mutations",
  "DigitalOcean revalidates watchdog before acquire before provider mutations",
  "DigitalOcean revalidates spend before acquire before provider mutations",
  "DigitalOcean revalidates lease after declarations before provider mutations",
  "DigitalOcean revalidates watchdog after declarations before provider mutations",
  "DigitalOcean revalidates spend after declarations before provider mutations",
  "DigitalOcean revalidates lease after key import before provider mutations",
  "DigitalOcean revalidates watchdog after key import before provider mutations",
  "DigitalOcean revalidates spend after key import before provider mutations",
  "DigitalOcean 429 refusal confirms imported key absence before returning non-acquisition",
  "DigitalOcean 422 refusal confirms imported key absence before returning non-acquisition",
  "DigitalOcean unconfirmed refused-create key deletion stays owned and key-only watchdog replay confirms it",
  "DigitalOcean machine-less watchdog replays a hub-originated absence receipt without API rediscovery",
  "DigitalOcean cooldown key cleanup completes through live acquisition owner",
  "DigitalOcean cooldown key cleanup completes through stopped-hub watchdog",
  "DigitalOcean key import revalidates lease inside API pacing",
  "DigitalOcean key import revalidates watchdog inside API pacing",
  "DigitalOcean key import revalidates spend inside API pacing",
  "DigitalOcean key import revalidates signal inside API pacing",
  "DigitalOcean droplet POST revalidates lease inside API pacing",
  "DigitalOcean droplet POST revalidates watchdog inside API pacing",
  "DigitalOcean droplet POST revalidates spend inside API pacing",
  "DigitalOcean droplet POST revalidates signal inside API pacing",
  "DigitalOcean stopped-hub key recovery by id: confirmed",
  "DigitalOcean stopped-hub key recovery by id: delete-failed",
  "DigitalOcean stopped-hub key recovery by id: lookup-missing",
  "DigitalOcean stopped-hub key recovery by name: confirmed",
  "DigitalOcean stopped-hub key recovery by name: delete-failed",
  "DigitalOcean stopped-hub key recovery by name: lookup-missing",
  "DigitalOcean lost import reply recovers the unique exact key name after owner closes",
  "DigitalOcean unknown POST stays reserved through key cleanup until exact-tag droplet deletion",
  "DigitalOcean exact-name orphan remains reported: lookup-failed",
  "DigitalOcean exact-name orphan remains reported: lookup-ambiguous"]},
 "hub/test/host-create-admission.test.ts": {"exact": true, "names": [
  "C4 create refuses an unprepared pool naming host prepare",
  "C5 host help lists create and list",
  "C4 create refuses a prepared image after harness pins change",
  "DigitalOcean create requires a prepared pool before acquisition API calls",
  "pre-row admission refusal acquires nothing and publishes no provision record",
  "DigitalOcean SSH gate records the provision identity and address without fake environment reads"]},
 "hub/test/host-provider-digitalocean-prepare.test.ts": {"exact": false, "names": []},
 "hub/test/host-provider-digitalocean-volumes.test.ts": {"exact": false, "names": []},
 "hub/test/digitalocean-endpoint.test.ts": {"exact": false, "names": []},
 "hub/test/test-docs.test.ts": {"exact": false, "names": []},
 "hub/test/suite-tiers.test.ts": {"exact": false, "names": []}
}
JSON
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("expect checked")' "$Q/expect.json"
```

The source checks (`src.mjs`), counted with `String.split` at the build. A file of `*` means the concatenated text of every `.ts` file under `hub/src`. Lines were read at dev `0a4e5372` (VERIFIED; all 46 read `ok`).

```sh
cat > "$Q/src.mjs" <<'JS'
// node "$Q/src.mjs" <W>   ok or MISMATCH per line (VERIFIED at dev 0a4e5372, all 46 ok)
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const W = process.argv[2];
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.ts') ? [join(d, e.name)] : []);
const all = () => walk(`${W}/hub/src`).map(f => readFileSync(f, 'utf8')).join('\n');
const read = f => f === '*' ? all() : existsSync(`${W}/${f}`) ? readFileSync(`${W}/${f}`, 'utf8') : null;
const PR = 'hub/src/host/pool-runtime.ts', DI = 'hub/src/hub/dispatch.ts', SE = 'hub/src/adapters/sessions.ts', DA = 'hub/src/hub/daemon.ts', HR = 'hub/src/host/host-restart.ts', CH = 'hub/src/cli/host.ts', ST = 'hub/src/host/status.ts', WA = 'hub/src/hub/web-authority.ts', HH = 'hub/src/host/host-health.ts', BG = 'hub/src/host/boot-gate.ts', RC = 'hub/src/host/provision-records.ts';
const C = [
  // T-1749
  ['T-1749 C1 config hot-apply reaches the pool runtime', DI, 'this.#suites?.configure(config); this.#sessions?.configurePools(config); }', '=1'],
  ['T-1749 C2 the stop time is earliestStop', PR, 'deadline = earliestStop({ created: Date.parse(row.machine?.created ?? row.created), idleSince: idle.since, idleStopMs: pool.idleStopMs, declarations });', '=1'],
  ['T-1749 C3/C4 a host in use is never idle', PR, "if (!pool || row.state !== 'ready' || this.#stopping.has(row.id) || this.inUse(row.id)) { this.#idle.delete(row.id); continue; }", '=1'],
  ['T-1749 C2 the billing minimum', 'hub/src/host/provider/declarations.ts', 'const deadline = Math.max(created + declarations.billingMinimumMs, idleSince + idleStopMs);', '=1'],
  // T-1750
  ['T-1750 C1 the five-minute boot gate', BG, 'export const HOST_BOOT_MS = 300000;', '=1'],
  ['T-1750 C5 the boot knob only shortens, only with the fake-host root', BG, 'return env.CLAND_FAKE_HOST_ROOT && Number.isFinite(value) && value>0 ? Math.min(value,HOST_BOOT_MS) : HOST_BOOT_MS;', '=1'],
  ['T-1750 C1 one Coordinator line naming the host', 'hub/src/hub/agents-topic.ts', "return {kind:'host-boot-failed',to:['coordinator'],text:`host ${String(entry.host)} in pool ${String(entry.pool)} failed to boot: ${String(entry.reason)}`", '=1'],
  ['T-1750 C3 the provider retry time holds creation', PR, 'const until=Math.max(clock.now().getTime()+1,Date.parse(retryAt));', '=1'],
  ['T-1750 C4 backoff 1 minute doubling to 30 minutes', PR, 'Math.min(1800000, 60000 * 2 ** Math.min(5, count - 1))', '=1'],
  // T-1752
  ['T-1752 C1/C2 positive provider absence at start', HR, "if((await provider.status(record.machine)).state!=='gone')continue;", '=1'],
  ['T-1752 C5 a live watchdog is reused, a stopped one re-armed', HR, 'if(!lease.watchdog||await watchdogStopped(lease.watchdog,o.env,{...o.watchdogOptions,clock:o.clock})) {', '=1'],
  ['T-1752 start: reconcile before transports open', DA, 'await reconcileHostLeases({root,records:store.hosts,env,clock,log', '=1'],
  ['T-1752 start: attach sessions, then restore leases, then scale', DA, 'await hub.dispatcher.restoreSessions(adapters.sessions, () => restoreHostLeaseOwners(', '=1'],
  ['T-1752 C3 an unknown host row exits, a missing transport is an outage', SE, '// Missing transport is an outage. Only absent durable registration is gone.', '=1'],
  ['T-1752 C1/C3 the role is vacated', SE, "this.#vacate(p, 'its host is no longer registered');", '=1'],
  // T-1753
  ['T-1753 C1 one General line', HH, 'o.notice(`host ${id} unreachable`);', '=1'],
  ['T-1753 C1/C6 the unreachable clock', HH, "remaining(bound('CLAND_TEST_HOST_UNREACHABLE_MS',180000))", '=1'],
  ['T-1753 C3/C6 the lost clock', HH, "remaining(bound('CLAND_TEST_HOST_LOST_MS',900000))", '=1'],
  ['T-1753 C6 knobs only shorten, only with the fake-host root', HH, 'return o.env.CLAND_FAKE_HOST_ROOT&&Number.isSafeInteger(value)&&value>0&&value<normal?value:normal;', '=1'],
  ['T-1753 C3 loss moves the lease deadline to now', HH, 'try{await o.records.leases.expireNow(o.id,o.root,o.clock??realClock);}', '=1'],
  ['T-1753 C4 a provider-reported gone machine is lost at once', HH, "this.#own(o.status(id).then(status=>{if(status.state==='gone')lose();}));", '=1'],
  ['T-1753 C1 the unreachable state keeps renewing', RC, "export const hostLeaseRenewable=(state:ProvisionState|undefined)=>state==='ready'||state==='unreachable';", '=1'],
  ['T-1753 the tunnel status feed reaches the health owner', DA, 'unsubscribeHostStatus=sshHosts.subscribeStatus((id,up,at)=>{hostHealth!.transition(id,up,at);adapters!.sessions.capacityChanged();});', '=1'],
  // T-1754
  ['T-1754 C1 Neovim renders waitingLaunches', 'nvim/lua/cland/inbox.lua', 'for _, launch in ipairs(state.S.inbox.waitingLaunches or {}) do', '=1'],
  ['T-1754 C1 Neovim compact since below 100 columns', 'nvim/lua/cland/inbox.lua', 'if c.width < 100 then', '>=1'],
  ['T-1754 C2 web renders waitingLaunches', 'web/src/InboxArea.tsx', '(props.connection.inbox?.waitingLaunches ?? []).map(launch =>', '=1'],
  ['T-1754 C2 web keeps the full since in a time element', 'web/src/InboxArea.tsx', '<time dateTime={launch.since}>', '=1'],
  // T-1755
  ['T-1755 C1 the pool status line', CH, 'process.stdout.write(`${pool.name}: ${pool.hostCount} hosts · slots ${pool.slotsUsed}/${pool.slotsTotal}', '=1'],
  ['T-1755 C2 the host status line', CH, "process.stdout.write(`  ${host.id} ${host.size} ${host.region} ${host.state} · uptime ${host.uptime ?? 'unknown'}s · sessions ${host.sessions.join(', ') || 'none'} · $${host.priceHourly ?? 'unknown'}/hour\\n`);", '=1'],
  ['T-1755 C1 project-scoped settled spend', ST, 'const {totals:settled,billing}=await inspectHostSpendSnapshot(env,clock,project);', '=1'],
  ['T-1755 C3 stop ends renewal, then the confirmed destroy', DI, "const work=frame.type==='host.stop'?(async()=>{await core.store.hosts.leases.stop(frame.host);return destroyHost(", '=1'],
  ['T-1755 C5 the web edge refuses host.status', WA, "'host.status': 'requires the local human CLI or Neovim',", '=1'],
  ['T-1755 C5 the web edge refuses host.stop', WA, "'host.stop': 'requires the local human CLI or Neovim',", '=1'],
  ['T-1755 current inventory', RC, '*currentInventory():Iterable<ProvisionRecord> {', '=1'],
  ['T-1755 slots by the shared capacity', SE, 'hostUsage(id: string): {usedMilli:number;promisedMilli:number} { return this.#poolRuntime?.usage(id)??{usedMilli:0,promisedMilli:0}; }', '=1'],
  // T-1756
  ['T-1756 C6 the E-1534 refusal is gone', 'hub/src/host/provider/digitalocean.ts', 'requires E-1534 host lease, watchdog and spend', '=0'],
  ['T-1756 C2 the refusal names what is missing', 'hub/src/host/provider/digitalocean.ts', "if(missing.length)return {state:'refused',reason:'DigitalOcean host.create requires '+missing.join(', '),", '=1'],
  ['T-1756 C1/C2 an armed watchdog is required', 'hub/src/host/provider/digitalocean.ts', "if(!admission?.watchdog?.pidIdentity)missing.push('armed watchdog');", '=1'],
  ['T-1756 C1 the hub-side admission checks the armed watchdog', 'hub/src/host/create-admission.ts', "throw new HostAdmissionUnavailable('host create requires an armed watchdog');", '=1'],
  ['T-1756 C3 the SSH gate from the record identity and machine address', 'hub/src/host/provision-ssh.ts', "const identity=record.ssh,destination=`${record.ssh.user??'agent'}@${record.machine.address}`;", '=1'],
  ['T-1756 C3 the provider never reads CLAND_FAKE_HOSTS', 'hub/src/host/provider/digitalocean.ts', 'CLAND_FAKE_HOSTS', '=0'],
  ['T-1756 C3 the SSH gate never reads CLAND_FAKE_HOSTS', 'hub/src/host/provision-ssh.ts', 'CLAND_FAKE_HOSTS', '=0'],
  // T-1751
  ['T-1751 C1 admitted hosts keep renewing at the sub-cap', 'hub/src/executor/droplet/spend.ts', '// Existing hosts keep renewing at the hosts sub-cap; the shared cap still applies.', '=1'],
  ['T-1751 C2 the committed-mutation observer', 'hub/src/executor/droplet/spend.ts', 'export function onHostSpendChange(env: NodeJS.ProcessEnv, project: string, changed: (value: HostSpendChange) => void): () => void {', '=1'],
  ['T-1751 C2 the 80 % threshold, once per UTC day', 'hub/src/hub/dispatch.ts', "if (cap === undefined || cap <= 0 || spend.spent + spend.reserved < cap * 0.8 || this.core.store.meta('hosts-spend-warning-day') === spend.day) return;", '=1'],
  ['T-1751 C2 the General line', 'hub/src/hub/dispatch.ts', "text: `hosts daily spend and reservations reached 80% of $${cap}`", '=1'],
];
for (const [label, file, text, e] of C) {
  const t = read(file), n = t === null ? 'MISSING' : t.split(text).length - 1;
  const pass = t !== null && (e.startsWith('>=') ? n >= Number(e.slice(2)) : n === Number(e.slice(1)));
  console.log(`${pass ? 'ok' : 'MISMATCH'} ${label} | ${file} | ${n} | ${e}`);
}
JS
node --check "$Q/src.mjs" && echo "src checked"
# refusal.mjs <W>: T-1756 C6, files under hub/src, hub/test and docs naming the E-1534 refusal (qa/briefs is history and is not read)
cat > "$Q/refusal.mjs" <<'JS'
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const W = process.argv[2], needles = ['requires E-1534 host lease, watchdog and spend', 'missing E-1534 admission'];
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(join(d, e.name))) : [join(d, e.name)]);
const hits = ['hub/src', 'hub/test', 'docs'].flatMap(d => walk(join(W, d))).filter(f => { const t = readFileSync(f, 'utf8'); return needles.some(n => t.includes(n)); });
console.log(`files naming the E-1534 refusal: ${hits.length}`); for (const f of hits) console.log(`  ${f.slice(W.length + 1)}`);
JS
node --check "$Q/refusal.mjs" && echo "refusal checked"
# ids.mjs <brief>: A-17843 — every E1534S3-NN the criteria map names exists as a row of the case or manual tables
cat > "$Q/ids.mjs" <<'JS'
import { readFileSync } from 'node:fs';
const t = readFileSync(process.argv[2], 'utf8'), map = t.slice(t.indexOf('### Criteria map'), t.indexOf('## Build'));
const named = new Set(map.match(/E1534S3-\d+/g) ?? []), rows = new Set([...t.matchAll(/^\| (E1534S3-\d+) \|/gm)].map(m => m[1]));
const missing = [...named].filter(id => !rows.has(id));
console.log(`criteria-map ids ${named.size}; table rows ${rows.size}; missing from the tables: ${missing.length}${missing.length ? ' ' + missing.join(' ') : ''}`);
JS
node --check "$Q/ids.mjs" && echo "ids checked"
```

The check functions for QA's own shell, and this brief's scratch functions (`body.sh` sources `helpers.sh` and `scratch.sh`; `scratch.sh` sources the stage-2 helpers in `scratch2.sh` first):

```sh
cat > "$Q/checks.sh" <<'SH'
landing() { git -C "$W" log --first-parent --format=%H --grep "^Item: $1\$" "$S"; }
# preserved: test files no stage-3 landing may edit (T-1756 C5 and the stage-2 behaviour the rows rely on)
preserved() { printf '%s\n' hub/test/host-create-ready.test.ts hub/test/host-destroy-native.test.ts hub/test/host-watchdog.test.ts hub/test/host-watchdog-identity.test.ts hub/test/host-lease.test.ts hub/test/pool-scale.test.ts; }   # T-1750 edits host-provision-gate and waiting-launch-restart, T-1753 host-create-entry, T-1756 host-watchdog-loop: not preserved
MEMBERS="T-1749 T-1750 T-1751 T-1752 T-1753 T-1754 T-1755 T-1756"
s00() {   # build, plan and landing receipts
  echo "PRE HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) request $S"
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
  git -C "$R" status --porcelain | grep -v ' \.cland/tasks/' > "$EV/root-status-before.txt"; echo "root non-tracker entries $(wc -l < "$EV/root-status-before.txt" | tr -d ' ')"
  (cd "$R" && node "$W/hub/bin/cland.ts" task plan show E-1534 --json) > "$EV/plan.json"; echo "plan read exit $?"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=(v.stages??[]).find(x=>x.name==="idle stop, failures, restart, money, host status and DigitalOcean");console.log(s?JSON.stringify({name:s.name,state:s.state,qa:s.qa,items:s.items,merged:s.merged,total:s.total,statuses:s.statuses}):"stage missing")' "$EV/plan.json" | tee "$EV/stage-members.json"
  for id in $(node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log((v.items??[]).join(" "))' "$EV/stage-members.json"); do echo "$id landings $(landing "$id" | wc -l | tr -d ' ') $(landing "$id" | head -n 1)"; done
}
s01() { node "$Q/fresh.mjs" "$W" plain node --version; node "$Q/fresh.mjs" "$W" plain npm run typecheck > "$EV/typecheck.log" 2>&1; echo "typecheck exit $?"; echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"; }
s02() {   # landing diffs (read-only) and the landing check for members read on a branch
  for id in $MEMBERS; do L=$(landing "$id" | head -n 1); echo "$id landing ${L:-none}"; [ -n "$L" ] || continue
    echo "$id test paths: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- hub/test nvim/test web/test | tr '\n' ' ')"
    echo "$id product paths: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- hub/src shared nvim/lua web/src | tr '\n' ' ')"
    echo "$id package.json and lockfiles: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- package.json package-lock.json hub/package.json web/package.json | wc -l | tr -d ' ')"
    echo "$id preserved files edited at its landing: [$(git -C "$W" diff --name-only "${L}^1" "${L}" -- $(preserved) | tr '\n' ' ')]"
  done
  echo "commits after 7c0320829 touching preserved files: [$(git -C "$W" log --format=%h 7c0320829.."$S" -- $(preserved) | tr '\n' ' ')]"
  F49="hub/test/pool-idle-stop.test.ts docs/hub/pool-idle-stop.md"; F50="hub/test/pool-failures.test.ts hub/src/host/boot-gate.ts docs/hub/pool-failures.md hub/test/host-provision-gate.test.ts"; F53="hub/test/host-unreachable.test.ts hub/src/host/host-health.ts docs/hub/host-health.md hub/test/host-create-entry.test.ts"
  F52="hub/test/host-restart.test.ts hub/test/host-restart-reconcile.test.ts hub/test/host-registry.test.ts hub/src/host/host-restart.ts docs/hub/host-restart.md"
  F54="nvim/test/inbox-sections.test.ts web/test/inbox.test.ts nvim/lua/cland/inbox.lua web/src/InboxArea.tsx web/src/InboxArea.module.css"
  F55="hub/test/host-status.test.ts hub/test/host-stop.test.ts hub/src/host/status.ts hub/src/cli/host.ts docs/hub/host-status-stop.md"
  F56="hub/test/host-provider-digitalocean.test.ts hub/test/host-create-admission.test.ts hub/test/host-admission-fixture.ts hub/src/host/create-admission.ts hub/src/host/admission-fence.ts hub/src/host/provision-ssh.ts docs/hub/digitalocean-host-admission.md"; F51="hub/test/pool-spend-cap.test.ts hub/test/host-spend.test.ts docs/hub/host-spend-cap.md"
  for pair in "T-1749 9a7a11116 $F49" "T-1750 a8fc09822 $F50" "T-1752 80fb4f940 $F52" "T-1753 2621bbcdb $F53" "T-1754 1c20f7bdc $F54" "T-1755 9427dbcb5 $F55" "T-1756 52f12c657 $F56" "T-1751 467af71d4 $F51"; do set -- $pair; id=$1; head=$2; shift 2; L=$(landing "$id" | head -n 1)
    echo "$id files byte-identical to $head at its landing ${L:-none}: $( [ -n "$L" ] && git -C "$W" diff --quiet "$head" "$L" -- "$@" && echo yes || echo "no: $(git -C "$W" diff --name-only "$head" "${L:-$S}" -- "$@" | tr '\n' ' ')")"
    echo "$id files changed after its landing: [$( [ -n "$L" ] && git -C "$W" log --format=%h "$L..$S" -- "$@" | tr '\n' ' ')]"; done
}
s79() {   # end check with $Q and $T still present (cleanup order)
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
# the stage-2 helpers (hcnt, swap, hosts, hready, waitfor, oneready, running, bootwait, deleted, lines, deadlines) and its q51 to q57; srow is the kit's helpers.sh
. "$QA_Q/scratch2.sh"
exitedrow() { srow "$1" | grep 'status=exited'; }
hostof() { srow "$1" | sed -n 's/^host=\([^ ]*\) .*/\1/p'; }
machineof() { hosts | awk -v h="$1" '$1==h{print $3; exit}'; }
deadlineof() { node -e 'try{console.log(JSON.parse(require("fs").readFileSync(".cland/run/host-leases/"+process.argv[1]+".json","utf8")).deadline)}catch{console.log("none")}' "$1"; }
now() { node -e 'console.log(new Date().toISOString())'; }
r60() {   # p1 with a fake `agents` pool (slots 1, min_hosts 0, max_hosts 1), a 2-minute lease, a prepared image and the Implementer bound to `agents`
  echo "PRE p1 entries $(ls -A "$QA_Q/p1" | wc -l | tr -d ' '); fh entries $(ls -A "$QA_Q/fh" | wc -l | tr -d ' ')"
  cd "$QA_Q/p1" || return 1
  git init -q -b dev && git commit -q --allow-empty -m init; echo "git exit $?"
  cland init . > "$QA_EV/E1534S3-60-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1; echo "hub after init and stop: $(up)"
  swap 'lease = "12h"' 'lease = "2m"' || return 1
  printf '%s\n' '' '[hosts.agents]' 'provider = "fake"' 'size = "fake"' 'slots = 1' 'region = "fake-1"' 'min_hosts = 0' 'max_hosts = 1' >> .cland/config.toml
  echo "  in [hosts]: lease 2m $(hcnt 'lease = "2m"'); agents table $(hcnt '[hosts.agents]'); slots 1 $(hcnt 'slots = 1'); min_hosts 0 $(hcnt 'min_hosts = 0'); max_hosts 1 $(hcnt 'max_hosts = 1')"
  hubstart; echo "hub start exit $?; hub $(up)"
  run "(prepare agents)" cland host prepare agents; echo "  prepared lines $(has 'agents: prepared')"
  run "(implementer pool)" cland role launch implementer --pool agents --json
  echo "  roles.toml pool lines $(cnt .cland/roles.toml 'pool = "agents"'); agents hosts $(hosts | wc -l | tr -d ' ')"
}
r63() {   # stage-2 q53 with the hub's inbox frame read while w2 waits (T-1754 C3 hub side)
  cd "$QA_Q/p1" || return 1
  P1=$(hp)
  run "(launch w2)" cland session launch w2 --role implementer --harness opencode --model opencode/fake-paid
  echo "  waiting lines $(has 'waiting: waiting for a host'); agents hosts $(hosts | wc -l | tr -d ' ')"
  run "(inbox frame while waiting)" node "$QA_Q/frame.mjs" '{"type":"inbox.list"}' 30000
  node -e 'const t=require("fs").readFileSync(process.env.QA_Q+"/r.out","utf8");let v;try{v=JSON.parse(t.slice(t.indexOf("{")))}catch{console.log("  inbox: not JSON");process.exit(0)}const i=v.value??v;const w=(i.waitingLaunches??[]).filter(x=>x.name==="w2");console.log("  inbox waiting w2 rows "+w.length+(w[0]?"; role "+w[0].role+"; pool "+w[0].pool+"; reason "+w[0].reason+"; since "+(isFinite(Date.parse(w[0].since))?"set":"bad"):"")+"; needsYou "+i.needsYou+"; asks naming w2 "+(i.asks??[]).filter(a=>JSON.stringify(a).includes("w2")).length)'
  run "(max_hosts 2)" cland config set hosts.agents.max_hosts 2; echo "  applies-now lines $(has 'applies now')"
  r=$(waitfor 240 running w2); echo "  w2 row: ${r:-$(srow w2)}"
  run "(inbox frame after placement)" node "$QA_Q/frame.mjs" '{"type":"inbox.list"}' 30000
  node -e 'const t=require("fs").readFileSync(process.env.QA_Q+"/r.out","utf8");let v;try{v=JSON.parse(t.slice(t.indexOf("{")))}catch{console.log("  inbox: not JSON");process.exit(0)}const i=v.value??v;console.log("  inbox waiting w2 rows after placement "+(i.waitingLaunches??[]).filter(x=>x.name==="w2").length)'
  echo "  agents hosts $(hosts | wc -l | tr -d ' '); ready $(hready); hub pid unchanged $([ "$(hp)" = "$P1" ] && echo yes || echo no)"
}
r64() {   # T-1755 C1, C2: host status with two hosts, one session each
  cd "$QA_Q/p1" || return 1
  run "(host status)" cland host status
  echo "  pool lines $(lines '^agents: 2 hosts · slots 1.5/2 · today \$0\.0000 · month \$0\.0000$')"
  echo "  host lines $(lines '^  host-[^ ]+ fake fake-1 ready · uptime [0-9.]+s · sessions w[12] · \$0/hour$')"
  run "(host status json)" cland host status --json
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.env.QA_Q+"/r.out","utf8"));const p=(v.pools??[]).find(x=>x.name==="agents");if(!p){console.log("  json: no agents pool");process.exit(0)}console.log("  json agents: hostCount "+p.hostCount+"; slotsUsed "+p.slotsUsed+"; slotsTotal "+p.slotsTotal+"; promised "+(p.slotsPromised??0)+"; today "+p.spend.today+"; month "+p.spend.month);for(const h of p.hosts)console.log("  json host: state "+h.state+"; sessions "+h.sessions.join(",")+"; slotsUsed "+h.slotsUsed+"; priceHourly "+h.priceHourly+"; uptime nonnegative "+(h.uptime>=0))'
}
r65() {   # T-1749 C1, C3 and the hot apply: w2 stops, idle_stop 10s applies now, H2 is destroyed before its lease deadline while H1 (w1, min_hosts) stays
  cd "$QA_Q/p1" || return 1
  H1=$(hostof w1); H2=$(hostof w2); M2=$(machineof "$H2"); D2=$QA_Q/fh/.fixture-sockets/$M2; DL=$(deadlineof "$H2")
  echo "  H1 ${H1:-none}; H2 ${H2:-none} ($M2); H2 lease deadline before the stop $DL"
  run "(stop w2)" cland session stop w2; r=$(waitfor 60 exitedrow w2); echo "  w2 row: ${r:-$(srow w2)}"
  run "(idle_stop 10s)" cland config set hosts.agents.idle_stop 10s; echo "  applies-now lines $(has 'applies now')"
  g=$(waitfor 150 deleted "$D2"); T2=$(now)
  echo "  H2 machine: ${g:-not deleted within 150 s}; host-key.pub $(there "$D2/host-key.pub"); client-key $(there "$D2/client-key"); known_hosts $(there "$D2/known_hosts")"
  node -e 'const [a,b]=process.argv.slice(1);console.log("  destroyed before the lease deadline "+(Date.parse(a)<Date.parse(b)))' "$T2" "$DL"
  echo "  hosts now: $(hosts | tr '\n' ';'); H1 ready $(hosts | awk -v h="$H1" '$1==h{print ($2=="ready")?"yes":"no"}'); w1 $(srow w1)"
}
r66() {   # T-1752 C1, C2, C4, C6: a hub restart while H3 (w3) is deleted: w3 exits, w1 runs, H3 settled, no new host, H1 renews
  cd "$QA_Q/p1" || return 1
  run "(launch w3)" cland session launch w3 --role implementer --harness opencode --model opencode/fake-paid
  r=$(waitfor 240 running w3); echo "  w3 row: ${r:-$(srow w3)}"
  H1=$(hostof w1); H3=$(hostof w3); hosts > "$QA_Q/hosts-66.txt"
  echo "  ready hosts at start $(grep -c ' ready ' "$QA_Q/hosts-66.txt"); H1 ${H1:-none}; H3 ${H3:-none}"
  [ "$(grep -c ' ready ' "$QA_Q/hosts-66.txt")" = 2 ] && [ -n "$H3" ] && [ "$H3" != "$H1" ] || { echo "  BLOCKED: two ready hosts, w1 and w3 on different hosts, are needed before the stop"; return 1; }
  cland host list > "$QA_Q/hl-66.json" 2>&1
  cland hub stop > /dev/null 2>&1; echo "hub after stop: $(up)"
  node --input-type=module -e 'const fs=await import("node:fs");const {FakeHostProvider}=await import(process.env.QA_W+"/hub/src/host/provider/fake.ts");const row=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).find(r=>r.id===process.argv[2]);if(!row?.machine){console.log("  release: no machine for H3");process.exit(1)}const r=await new FakeHostProvider({env:process.env}).release(row.machine);console.log("  release of H3 while the hub is stopped: "+r.state)' "$QA_Q/hl-66.json" "$H3"
  hubstart; echo "hub start exit $?; hub $(up)"
  r=$(waitfor 120 exitedrow w3); echo "  w3 row after restart: ${r:-$(srow w3)}; w1 row: $(srow w1)"
  echo "  hosts after restart: $(hosts | tr '\n' ';'); ready $(hready); H3 lease mirror $(there ".cland/run/host-leases/$H3.json")"
  node -e 'const fs=require("fs");try{const v=JSON.parse(fs.readFileSync(process.env.CLAND_EXECUTOR_STATE+"/spend.json","utf8"));const e=(v.entries??[]).find(x=>x.lease===process.argv[1]);console.log("  ledger H3 entry "+(e?"present; cost "+e.cost+"; released "+(isFinite(Date.parse(e.released))?"set":"unset"):"absent"))}catch(e){console.log("  ledger unreadable: "+e.code)}' "$H3"
  A=$(deadlineof "$H1"); sleep 35; B=$(deadlineof "$H1")
  node -e 'const [a,b]=process.argv.slice(1);console.log("  H1 deadline moved forward after restart "+(Date.parse(b)>Date.parse(a))+"; at most 2 min ahead "+(Date.parse(b)-Date.now()<=120500))' "$A" "$B"
  echo "  agents hosts after the wait $(hosts | grep -v -c ' destroyed '); ready $(hready)"
}
r67() {   # T-1753 C1, the CLI surface: host list --json reads every pool row and its state (the outage itself is component-only)
  cd "$QA_Q/p1" || return 1
  run "(host list json)" cland host list --json
  node -e 'let v;try{v=JSON.parse(require("fs").readFileSync(process.env.QA_Q+"/r.out","utf8"))}catch{console.log("  json rows: not JSON");process.exit(0)}console.log("  json rows "+(Array.isArray(v)?"array of "+v.length:"not an array"));const a=(Array.isArray(v)?v:[]).filter(r=>r.pool==="agents");console.log("  agents rows "+a.map(r=>r.id+"="+r.state).join(" "));console.log("  unreachable rows "+a.filter(r=>r.state==="unreachable").length)'
}
r68() {   # T-1755 C3: host stop with a live session; min_hosts 0 first so no replacement host starts
  cd "$QA_Q/p1" || return 1
  run "(min_hosts 0)" cland config set hosts.agents.min_hosts 0; echo "  applies-now lines $(has 'applies now')"
  H1=$(hostof w1); M1=$(machineof "$H1"); D1=$QA_Q/fh/.fixture-sockets/$M1; echo "  H1 ${H1:-none} ($M1); w1 $(srow w1)"
  run "(host stop H1)" cland host stop "$H1"; echo "  destroyed state lines $(has '"state": "destroyed"')"
  r=$(waitfor 60 exitedrow w1); echo "  w1 row: ${r:-$(srow w1)}"
  echo "  H1 machine $(deleted "$D1"); host-key.pub $(there "$D1/host-key.pub"); client-key $(there "$D1/client-key")"
  run "(host status after stop)" cland host status; echo "  empty pool lines $(lines '^agents: 0 hosts')"
}
SH
. "$Q/checks.sh"; bash -n "$Q/scratch.sh" && echo "scratch checked"
```

Expected: `expect checked`, `src checked`, `refusal checked`, `ids checked`, `scratch checked`. Record the setup in `S0`.

**Cleanup, in this order (carried).** Step 1, after E1534S3-69 passes: `rstop` (already done in E1534S3-69's command); print the alias in `$Q/alias.txt`, check it is a symlink named `/private/tmp/ct-` plus 32 hex resolving into `$Q/fh/.fixture-sockets`, and remove that symlink by its literal path; inventory each dead T-1676 residue entry in `$T` (A-17843) and remove it by its literal path. Step 2: run and record E1534S3-79 with `$Q` and `$T` still present. Step 3, after the verdict: print `$Q` and check it begins with `/private/tmp/q53-`, then remove it by that literal path with a non-force recursive remove; print `$T`, check it begins with `/private/tmp/qa-e1533-s3-` and holds nothing but `node-compile-cache`, and remove it by that literal path; remove the worktree with `git -C "$R" worktree remove "$W"` (its `node_modules` symlink and `web/dist` first, each by literal path, if Git refuses). Secrets in `$Q/p1/.cland/hub.json`, `$Q/p1/.cland/secret`, `$Q/p1/.cland/run/host-provisions/` and `$Q/fh` are never printed or posted.

## Cases

Every case is one or more named test files run once at the build, from QA's own shell through `nt` (or `pl` for T3 and native files, under the preservation lock), recorded with `qa-record.sh note` (surface `hub-api`; E1534S3-41 drives the pinned Headless Shell inside its named file), its evidence `$EV/<id>.log`, `$EV/<id>.check.txt` and `$EV/<id>.tmpdir.txt`. A case passes only when every check line reads `CLEAN` (exit 0; `fail`, `cancelled`, `skipped` and `todo` 0; `pass` equal to `tests`; every listed name `ok`; for an `exact` list, the plan equal to the list and no unlisted name). A missing file is a FAIL naming the file. A `fresh: BLOCKED` line makes the row BLOCKED. Run in table order; never two files at once. Tiers are read from `hub/test/tiers.json` at the heads and at dev.

| case | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1534S3-10 | hub-api | QA | `nt E1534S3-10 hub/test/pool-idle-stop.test.ts` | `CLEAN` with the exact list (T-1749 C1 to C4; T2, fake clock; VERIFIED at dev). Test `C1 idle host is destroyed at one minute while min_hosts stays`; test `C2 billing minimum delays destruction beyond idle_stop`; test `C3 running host stays beyond idle_stop and billing minimum`; test `C4 session gained during idle wait restarts the full wait after exit`; the `idle_stop` and `min_hosts` expansions of `hub config <key> hot apply reaches confirmed destruction through the lifecycle owner` (the `Dispatcher.configure` → `configurePools(config)` path); test `asynchronous provider declarations are shared and precede idle destruction`; test `synchronous declaration failure retries after 60 seconds without external reconciliation` |
| E1534S3-11 | hub-api | QA | `nt E1534S3-11 hub/test/pool-failures.test.ts` | `CLEAN` with the exact list of 21 (T-1750 C1 to C5; T2, fake clock, fake provider `neverBoot`, `pinned-key` and `refuseUntil`; VERIFIED at dev `907fc679`). The `neverBoot` and `pinned-key` expansions of `C1/C2 <mode> fails at five minutes and deletion is confirmed`; test `boot failure lifecycle notice names the host and addresses only Coordinator`; test `C3 provider retry time holds capacity creation without a cascade`; test `C4 retries double to thirty minutes and ready resets the failure streak`; test `C5 boot shortening is fenced to fake hosts`; test `fake boot knob cannot extend the fixed deadline`; the `neverBoot`, `pinned-key` and `refuseUntil` expansions of `waiting launch survives <mode> with one failure notice and bounded retry`; the `configure` and `ready` expansions of `provider not-before survives <reset> reset`; the `status` and `ssh` expansions of `identified <phase> probe is cancelled and joined at the absolute boot deadline`; the `destroyed`, `released`, `replacement` and `ready` expansions of `rejected cleanup preserves a newer <completion> checkpoint` |
| E1534S3-12 | hub-api | QA | `nt E1534S3-12 hub/test/pool-spend-cap.test.ts` | `CLEAN` with the exact list of 5 (T-1751 C1 to C3; T2, sealed disposable HOME and state, fake hub clock; VERIFIED at dev). Test `admitted host renews beyond hosts sub-cap while shared cap still applies`; test `80 percent General warning survives restart and repeats only on a new UTC day`; test `full hosts cap keeps demand waiting without provider acquisition or ledger entry and retains busy host`; test `cap-refused scheduler launch remains in the durable waiting list through retry` (its fixture waits on a successful `executor-sweep` and an absent spend lock before the launch, the startup barrier its test doc names; a first refusal that never arrives is that barrier failing, a FINDING, not a flake); test `mutation notices reuse loaded ledger with no observer reads and unsubscribe retires owner`. `host-spend` (row 14) is edited by T-1751 with titles unchanged |
| E1534S3-13 | hub-api | QA | `nt E1534S3-13 hub/test/pool-scale.test.ts hub/test/host-lease.test.ts hub/test/waiting-launch-restart.test.ts hub/test/digitalocean-pacing.test.ts` | Each `CLEAN` (T2 each; VERIFIED at dev). `pool-scale` and `host-lease` are unedited preservation for the lanes' edits of `pool-runtime.ts`, `dispatch.ts` and `sessions.ts` (stage 2's scale up and T-1763's three renewal cases); `waiting-launch-restart` (titles unchanged) and `digitalocean-pacing` (test `aborted scoped droplet GET joins the fake request before returning` added) are edited by T-1750 |
| E1534S3-14 | hub-api | QA | `nt E1534S3-14 hub/test/host-provision-records.test.ts hub/test/host-spend.test.ts` | Each `CLEAN` with every listed name (T1 each; edited by T-1755, VERIFIED at dev). Test `current inventory matches occupied including acquired failures and excluding positive non-acquisition`; test `usage and reserve share retained-generation and placement-promise capacity`; test `settled UTC totals separate days, months and pools while pending costs stay excluded`; test `host status snapshot pins billing by exact project and lease without changing totals shape`. T-1750 and T-1753 edit `provision-records.ts` but not this test file; T-1756 edits `provision-records.ts` and not this test file; T-1751 edits `host-spend.test.ts`, changing one renewal assertion and no title, so the list stands |
| E1534S3-20 | hub-api | QA | `nt E1534S3-20 hub/test/host-restart-reconcile.test.ts` | `CLEAN` with the exact list of 12 (T-1752 C1, C2, C4 to C6; T2 with injected lock-process and watchdog observations from `hub/test/fakes/lock-processes.ts`; VERIFIED at dev). The `gone=true` and `gone=false` expansions of `restart settles only positive provider absence: gone=<bool>`; the `1h` and `12h` expansions of `reopened lease renews at min(1h, <lease>/4) with a live watchdog`; the `missing`, `malformed`, `earlier-expired` and `earlier-live` expansions of `watchdog recovery preserves effective mirror deadline: <fault>`; test `startup attaches session settlement before an already-expired lease enters destruction`; the `minimum=1` and `minimum=2` expansions of `reopened minimum-host scheduler completes admitted work: minimum=<n>`; test `lease spend lifecycle uses injected lock births with a positive no-native control` (added after the head this draft first read) |
| E1534S3-21 | hub-api | QA | `pl E1534S3-21 hub/test/host-restart.test.ts` | `CLEAN` with the exact list (T-1752 C1, C2, C4, C5; T3, two native fake SSH hosts and an OpenCode worker, under the preservation lock). Test `restart keeps the live host and exits the deleted host, settles spend, and restores watchdog ownership`: the deleted host's session `exited` and the live one `running`; the Implementer role vacated; the deleted host's lease gone, its ledger entry settled (`cost` 0, `released` set) and its record `destroyed`; the live watchdog reused, then re-armed after a second restart with it stopped; two provision records only. Its wall time includes real host boots |
| E1534S3-22 | hub-api | QA | `nt E1534S3-22 hub/test/host-registry.test.ts` | `CLEAN` with the exact list (T-1752 C3; T2; edited by T-1752). Test `without the test-host environment only local is registered; unknown host rows exit without native authority` (renamed from the base's unknown-rows case); test `registered host without a transport remains running during restart recovery` |
| E1534S3-23 | hub-api | QA | `nt E1534S3-23 hub/test/host-unreachable.test.ts` | `CLEAN` with the exact list of 20 (T-1753 C1 to C6; T2, injected transport status and fake clock; VERIFIED at dev). Test `three minutes down publishes one unreachable line and recovery preserves the host`; the `false` and `true` expansions of `lost host invokes the confirmed deletion owner: provider gone=<bool>`; the `false` and `true` expansions of `shortened health clocks require the fake-host fence: <bool>`; test `lost deadline joins renewal and publishes now before deletion ownership`; test `a restored unreachable host already up clears its retained outage state`; the `false` and `true` expansions of `registry replays the continuous outage start: later loss=<bool>`; the `recovered`, `lost`, `gone` and `mirror-failure` expansions of `outage settles sessions and roles: <outcome>`; test `provider replies are fenced by the outage and flapping checks are rate bounded`; test `loss waits for ledger-blocked renewal before publishing the watchdog deadline`; test `failed lease shortening retains an owned next-tick mirror retry`; the four `spare=<bool> recover=<bool>` expansions of the nested loop `idle stop and outage grace retain a 30s lease: spare=<bool> recover=<bool>` (missed by the previous fill's single-loop count) |
| E1534S3-24 | hub-api | QA | `pl E1534S3-24 hub/test/host-watchdog.test.ts hub/test/host-destroy-native.test.ts hub/test/host-create-ready.test.ts hub/test/host-provision-gate.test.ts` | Each `CLEAN` (T3 each, under the preservation lock; run after E1534S3-21, never beside it). The first three are unedited preservation for T-1752's watchdog re-arm, T-1753's and T-1756's shared `host-watchdog.ts` and `provision-records.ts`, and T-1756 C5's fake create-to-ready tests. `host-provision-gate` is edited by T-1750 (T-1750 C1, C2): test `never-booting creation releases at exactly 300000 ms on the hub clock`; test `pending acquire checkpoints unknown at five minutes and destroys a late identity`; the `status` and `ssh` expansions of `identified machine <phase> is cancelled at its boot deadline and deletion confirmed` |
| E1534S3-25 | hub-api | QA | `nt E1534S3-25 hub/test/host-watchdog-loop.test.ts hub/test/host-watchdog-identity.test.ts hub/test/host-create-entry.test.ts` | Each `CLEAN` (T2, T1, T2). `host-watchdog-loop` and `host-watchdog-identity` are unedited at dev (T-1756's branch edits `host-watchdog-loop`: settle its titles when it lands). `host-create-entry` is edited by T-1753 (exact list of 2): test `hub create entry passes its clock and owner to the injected create path`; test `host list accepts its JSON alias and refuses other extra arguments` (T-1753 C1: `cland host list --json` shows a saved `unreachable` host) |
| E1534S3-30 | hub-api | QA | `nt E1534S3-30 hub/test/host-status.test.ts` | `CLEAN` with the exact list (T-1755 C1, C2; T2; VERIFIED at dev). Test `C1 status includes configured empty pools and zero settled spend`; test `C1/C2 status weights sessions and clips live accrual to UTC day/month, excluding reservations`; the `false` and `true` expansions of `status ledger read drains before storage closes; setup failure=<bool>` |
| E1534S3-31 | hub-api | QA | `nt E1534S3-31 hub/test/host-stop.test.ts` | `CLEAN` with the exact list (T-1755 C3 to C5; T2). The `true` and `false` expansions of `C3 stop joins lease renewal and requires confirmed destroy: <bool>`; test `C5 host help lists status and stop`; test `C4 manual create refuses occupied max_hosts before publishing another row` |
| E1534S3-32 | hub-api | QA | `nt E1534S3-32 hub/test/cli-help.test.ts hub/test/cli-usage-compatibility.test.ts hub/test/cli-command-help.test.ts` | Each `CLEAN` (T2, T1, T1). T-1755 edits `cli-help` and migrates `HOST_USAGE` in `hub/test/fixtures/cli-usage/commands.json`: the `status` and `stop` expansions of `cland host <command> --help exits without a hub`; test `all command usage exports retain their pre-refactor bytes` holds the frozen help to the landed usage |
| E1534S3-33 | hub-api | QA | `nt E1534S3-33 hub/test/web-authority.test.ts hub/test/host-secret-admission.test.ts` | Each `CLEAN` (T2 each; edited by T-1755). The `host.status` and `host.stop` expansions of `web refuses <type> even from authenticated human`; `host-secret-admission` keeps a host session from human frames |
| E1534S3-40 | hub-api | QA | `nt E1534S3-40 nvim/test/inbox-sections.test.ts nvim/test/inbox-actions.test.ts nvim/test/inbox-requests.test.ts nvim/test/needs-you.test.ts` | Each `CLEAN` with no skip (Neovim T2 each; headless Neovim from the pinned cache). Test `waiting launches render facts and replace reasons without needs-you or departure rows` (T-1754 C1, C3; VERIFIED at dev): one line with session, role, pool, reason and since, replaced in place; at a 64-column right panel the since stays visible, compact (`HH:MM` today, date and time otherwise), the maximum identity still shows its date. A `skip` (no pinned Neovim) is BLOCKED, not PASS. The other three are unedited preservation for the inbox. Dead fixture-owner receipts in `$T` after this row are the A-17843 class |
| E1534S3-41 | hub-api | QA | `nt E1534S3-41 web/test/inbox.test.ts web/test/phone-inbox.test.ts` (after E1534S3-05) | Each `CLEAN` (Web; pinned Headless Shell; no other browser). Test `waiting launches update status facts in place without needs-you and disappear on placement or cancel` (T-1754 C2, C3): the row, its `time` element's `datetime`, the in-place reason update, at 360 × 740 the since visible and only the identity ellipsized, the title carrying the full facts, removal on placement and cancel. `phone-inbox` is unedited preservation. The log's `Web prerequisites (report only)` line must read `current web/dist and resolvable node_modules`; a missing Headless Shell is BLOCKED |
| E1534S3-45 | hub-api | QA | `nt E1534S3-45 hub/test/test-docs.test.ts hub/test/suite-tiers.test.ts` | Each `CLEAN` (T1). The per-file docs and `docs/agents/tests/index.md` entries the landings add (`pool-idle-stop`, `pool-failures`, `host-restart`, `host-restart-reconcile`, `host-unreachable`, `host-create-entry`, `host-status`, `host-stop`, `inbox-sections`, `web/test/inbox`; later `pool-spend-cap` and T-1756's files), and every new test file in `tiers.json` |
| E1534S3-50 | hub-api | QA | `nt E1534S3-50 hub/test/host-provider-digitalocean.test.ts hub/test/host-create-admission.test.ts` | Each `CLEAN` with the exact list (T-1756 C1 to C4; T2 each, fake DigitalOcean API only; VERIFIED at dev). `host-provider-digitalocean`, 70 registrations: test `DigitalOcean binds create to durable watchdog input and discovers the exact lease after a lost checkpoint`; the `lease`, `watchdog` and `reservation` expansions of `DigitalOcean missing <field> refuses before any API call`; test `DigitalOcean watchdog deletes an admitted droplet after owner closure before machine checkpoint`; test `DigitalOcean admission creates at most one provider intent per lease`; test `DigitalOcean rejects a lease admitted for another provider before API access`; the 9 + 8 + 6 nested expansions of `DigitalOcean revalidates <invalidation> <boundary> before provider mutations`, `DigitalOcean <phase> revalidates <invalidation> inside API pacing` and `DigitalOcean stopped-hub key recovery by <identity>: <outcome>`; and the stage-1 provider cases unchanged. `host-create-admission`, 6: test `DigitalOcean create requires a prepared pool before acquisition API calls` (replacing the base's E-1534 case); test `DigitalOcean SSH gate records the provision identity and address without fake environment reads`; test `pre-row admission refusal acquires nothing and publishes no provision record`; the three stage-1 cases |
| E1534S3-51 | hub-api | QA | `nt E1534S3-51 hub/test/host-provider-digitalocean-prepare.test.ts hub/test/host-provider-digitalocean-volumes.test.ts hub/test/digitalocean-endpoint.test.ts` | Each `CLEAN` (T2, T2, T1; VERIFIED at dev). `-prepare` and `-volumes` are edited by T-1756 with their titles unchanged (`-prepare` keeps `digitalocean production create names the missing host lease watchdog and spend before API access`, which names none of the removed refusal text); `digitalocean-endpoint` is unedited preservation for T-1750's and T-1756's `provider.ts`, `digitalocean.ts` and `api.ts` edits. `digitalocean-pacing` runs in E1534S3-13 |
| E1534S3-52 | hub-api | QA | `node "$Q/refusal.mjs" "$W" > "$EV/E1534S3-52.txt" 2>&1` | `files naming the E-1534 refusal: 0` (T-1756 C6; VERIFIED at dev `0a4e5372` over the hub source tree, the hub test tree and the docs tree; before T-1756 it listed four files: the DigitalOcean provider source, the admission case file, the duration manifest and that case file's per-file doc). `qa/briefs` is history and is not read |

### Web cases (when in scope)

E1534S3-41 only: T-1754's web inbox through `web/test/inbox.test.ts` in the pinned Headless Shell, at the default size and at 360 × 740. No other browser, no GUI, no screenshot is a pass condition.

## Manual checks

Run in table order: E1534S3-00 to E1534S3-05 before the cases, E1534S3-60 to E1534S3-69 after them, then cleanup step 1, then E1534S3-79. Scratch rows depend on the state the rows before them leave; a row whose prerequisite failed is BLOCKED, naming it. Record each with `sh .agents/skills/qa/qa-record.sh note E-1534 "$RUN" <id> hub-api "<the command you ran>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence file>` from `$W`. Every scratch row's evidence begins with the kit's `PRE gate` line and ends with `# fresh: redacted or withheld lines 0` and `row exit 0`; a gate refusal is BLOCKED.

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1534S3-00 | hub-api | QA | `s00 > "$EV/E1534S3-00.txt" 2>&1` | PRE line: HEAD, dev and request the same 40 hex; `dirty entries 0`; root non-tracker count recorded. `plan read exit 0`; the stage line: exact name, `qa` `{"scope":"affected","when":"after-stage"}`, `items` T-1749, T-1750, T-1751, T-1752, T-1753, T-1756, T-1754, T-1755 plus any finding fixes the request names, `merged` equal to `total`, `state` not `closed`. Every member `landings 1`; anything else is BLOCKED |
| E1534S3-01 | hub-api | QA | `s01 > "$EV/E1534S3-01.txt" 2>&1` | Node 24; `typecheck exit 0` (the integrated build: the three lanes' `dispatch.ts`, `sessions.ts` and `pool-runtime.ts` edits together, and the web workspace's token and 4.5:1 contrast check over T-1754's `InboxArea.module.css`, T-1754 C2); `dirty entries 0` |
| E1534S3-02 | hub-api | QA | `s02 > "$EV/E1534S3-02.txt" 2>&1` | Every landing `package.json and lockfiles: 0`; `preserved files edited at its landing: []` for every landing (T-1756 C5 among them); `commits after 7c0320829 touching preserved files: []`. **Landing check** (each member's own files at its landing against its final branch tip): `T-1749 … 9a7a11116 …: yes`, `T-1750 … a8fc09822 …: yes`, `T-1752 … 80fb4f940 …: yes`, `T-1753 … 2621bbcdb …: yes`, `T-1754 … 1c20f7bdc …: yes`, `T-1755 … 9427dbcb5 …: yes`, `T-1756 … 52f12c657 …: yes` (VERIFIED with `git diff` at writing), and `T-1751 … 467af71d4 at its landing 0a4e53720: yes`; `files changed after its landing: []` for each, except T-1752 and T-1755, each `[241992ac1]` (T-1753's later edits of `hub/src/host/host-restart.ts` and `hub/src/cli/host.ts`, named), plus any landing after `0a4e5372` named with its commit (all eight pairs computed with this loop at `0a4e5372`). Test paths per landing (VERIFIED; a landing may add `hub/test/durations.json`): T-1754 `nvim/test/inbox-sections.test.ts web/test/inbox.test.ts`; T-1755 `hub/test/cli-help.test.ts hub/test/fixtures/cli-usage/commands.json hub/test/host-provision-records.test.ts hub/test/host-secret-admission.test.ts hub/test/host-spend.test.ts hub/test/host-status.test.ts hub/test/host-stop.test.ts hub/test/tiers.json hub/test/web-authority.test.ts`; T-1752 `hub/test/fakes/lock-processes.ts hub/test/host-registry.test.ts hub/test/host-restart-reconcile.test.ts hub/test/host-restart.test.ts hub/test/tiers.json`; T-1749 `hub/test/pool-idle-stop.test.ts hub/test/tiers.json`; T-1753 `hub/test/fixtures/cli-usage/commands.json hub/test/host-create-entry.test.ts hub/test/host-unreachable.test.ts hub/test/tiers.json`; T-1750 `hub/test/digitalocean-pacing.test.ts hub/test/fakes/digitalocean/fake-api.ts hub/test/fixtures/cli-usage/commands.json hub/test/host-provision-gate.test.ts hub/test/pool-failures.test.ts hub/test/tiers.json hub/test/waiting-launch-restart.test.ts`; T-1756 `hub/test/fixtures/cli-usage/commands.json hub/test/host-admission-fixture.ts hub/test/host-create-admission.test.ts hub/test/host-provider-digitalocean-prepare.test.ts hub/test/host-provider-digitalocean-volumes.test.ts hub/test/host-provider-digitalocean.test.ts hub/test/host-watchdog-loop.test.ts` (VERIFIED); T-1751 `hub/test/host-spend.test.ts hub/test/pool-spend-cap.test.ts hub/test/tiers.json` (VERIFIED); neither includes a preserved file |
| E1534S3-03 | hub-api | QA | `node "$Q/src.mjs" "$W" > "$EV/E1534S3-03.txt" 2>&1` | Every line `ok` (46 lines; all `ok` at dev `0a4e5372`, VERIFIED). T-1749's hot apply, `earliestStop` and in-use guard; T-1750's five-minute gate, fenced shortening-only knob, Coordinator-only boot-failure line, provider retry time and 1-to-30-minute backoff; T-1752's positive-absence reconcile, watchdog reuse, start order and unknown-host exit with role vacated; T-1753's General line, both clocks, the fence, `expireNow` at loss, the provider-gone shortcut, `unreachable` as a renewable state and the tunnel status feed; T-1754's Neovim and web rendering; T-1755's status lines, project-scoped spend, stop path, web refusals, `currentInventory` and `hostUsage`. T-1756's removed refusal, the missing-receipt refusal naming `armed watchdog`, the hub-side admission, the SSH gate from the record's identity and address, and `CLAND_FAKE_HOSTS` in neither the provider nor the gate. T-1751's sub-cap renewal, the mutation observer, the 80 % once-a-day threshold and its General line. A `MISMATCH` on a settled line is read at the build (a renamed string is followed); it is a FAIL unless the landing changed it with a recorded decision |
| E1534S3-04 | hub-api | QA | `node "$Q/ids.mjs" "$W/qa/briefs/E-1534-stage-3.md" > "$EV/E1534S3-04.txt" 2>&1` | `missing from the tables: 0` (A-17843: every row id the criteria map names exists as a table row). Also read by hand: each map row cites tests that row's command runs |
| E1534S3-05 | hub-api | QA | `node "$Q/fresh.mjs" "$W" plain npm run build > "$EV/E1534S3-05.txt" 2>&1; echo "build exit $?"` | `build exit 0`; `web/dist/index.html` present in `$W` (ignored by Git, so `dirty entries` stays 0). E1534S3-41 is BLOCKED without it |
| E1534S3-60 | hub-api | Human | `mrow E1534S3-60 r60` | **Setup.** `PRE p1 entries 0`; `git exit 0`; `init exit 0`; `hub after init and stop: down`; `swapped "lease = \"12h\""`; `in [hosts]: lease 2m 1; agents table 1; slots 1 1; min_hosts 0 1; max_hosts 1 1`; `hub start exit 0; hub up`; `(prepare agents) exit 0`, `prepared lines 1`; `(implementer pool) exit 0`; `roles.toml pool lines 1; agents hosts 0`. A failure makes E1534S3-61 to E1534S3-68 BLOCKED. Then, in QA's own shell, `rstart` (`relay watcher pid <n>`) |
| E1534S3-61 | hub-api | Human | `mrow E1534S3-61 q51` | Stage 2's row 51 (`q51`, from `scratch2.sh`): `swapped "min_hosts = 0"`; `hub start exit 0; hub up`; `first host: ready`; one `agents` row `ready` (H1); an `alias recorded` `/private/tmp/ct-` path; `$Q/relay.log` gains `ports map …` |
| E1534S3-62 | hub-api | Human | `mrow E1534S3-62 q52` | Stage 2's row 52: `(launch w1) exit 0` with a `launched w1 [Implementer] … host <H1>` line (A-17820 casing); `w1 row: host=<H1> status=running; on the ready host yes`; `w1 lines naming its host 1` |
| E1534S3-63 | hub-api | Human | `mrow E1534S3-63 r63` | **T-1754 C3, hub side.** `(launch w2) exit 0` with `waiting lines 1`; `agents hosts 1`; `(inbox frame while waiting) exit 0` with `inbox waiting w2 rows 1; role implementer; pool agents; reason waiting for a host; since set`, `needsYou` unchanged by the wait (0 in this fresh project) and `asks naming w2 0`; `(max_hosts 2) exit 0` with `applies-now lines` 1 or more; `w2 row: host=<H2> status=running`; `inbox waiting w2 rows after placement 0`; `agents hosts 2; ready 2; hub pid unchanged yes`. The narrow rendering of that row is E1534S3-40 and E1534S3-41 (headless); no client is driven against the scratch hub |
| E1534S3-64 | hub-api | Human | `mrow E1534S3-64 r64` | **T-1755 C1, C2.** `(host status) exit 0` with `pool lines 1` (`agents: 2 hosts · slots 1.5/2 · today $0.0000 · month $0.0000`: two OpenCode sessions of weight 0.75 on two one-slot hosts; the fake provider's price is 0) and `host lines 2` (`<id> fake fake-1 ready · uptime <s>s · sessions w1|w2 · $0/hour`); `(host status json) exit 0` with `json agents: hostCount 2; slotsUsed 1.5; slotsTotal 2; promised 0; today 0; month 0` and two `json host:` lines `state ready`, one session each, `slotsUsed 0.75`, `priceHourly 0`, `uptime nonnegative true`. Promised slots appear only while a launch is being placed; they are proven by E1534S3-14 (test `usage and reserve share retained-generation and placement-promise capacity`), not caught here. INFERRED: the exact numbers come from the source, not from a run |
| E1534S3-65 | hub-api | Human | `mrow E1534S3-65 r65` | **T-1749 C1, C3, the hot apply.** `H2 lease deadline before the stop` an ISO time; `(stop w2) exit 0`; `w2 row: … status=exited`; `(idle_stop 10s) exit 0` with `applies-now lines` 1 or more; `H2 machine: gone; host-key.pub absent; client-key absent; known_hosts absent` within 150 s (the fake provider's billing minimum is 60 s from creation, the idle wait 10 s); `destroyed before the lease deadline true` (idle stop, not lease expiry); `H1 ready yes; w1 host=<H1> status=running` (`min_hosts = 1` and a session keep H1) |
| E1534S3-66 | hub-api | Human | `mrow E1534S3-66 r66` | **T-1752 C1, C2, C4, C6.** `(launch w3) exit 0`; `w3 row: host=<H3> status=running` (a new host started for the wait, `max_hosts = 2`); `ready hosts at start 2` (fewer, or w3 on H1, is BLOCKED); `hub after stop: down`; `release of H3 while the hub is stopped: released`; `hub start exit 0; hub up`; `w3 row after restart: … status=exited; w1 row: host=<H1> status=running`; hosts after restart show H3 not `ready` and `ready 1`; `H3 lease mirror absent`; `ledger H3 entry present; cost 0; released set`; `H1 deadline moved forward after restart true; at most 2 min ahead true` (min(1 h, 2 min / 4) = 30 s cadence); `agents hosts after the wait` 1 non-destroyed, `ready 1` (no host created at start). INFERRED: the `cland host list` row carries the `machine` object the fake `release` takes, and the restart settles H3 by positive provider absence (T-1752's reconcile, before transports open) rather than starting T-1753's outage clock for it |
| E1534S3-67 | hub-api | Human | `mrow E1534S3-67 r67` | **T-1753 C1, the CLI surface only.** `(host list json) exit 0`; `json rows` an array; `agents rows` listing H1 `ready` and the destroyed hosts; `unreachable rows 0`. **The outage itself is component-only** (E1534S3-23): T-1753 ships no CLI command or test hook that drops a fake host's tunnel; the tunnel state comes only from the SSH carrier's status (`SshTransport` `onStatus` → `registry.subscribeStatus` → `HostHealth`), and its tests inject that status through a provided transport. Forcing it on the scratch hub would mean killing the fake host's SSH master and blocking its reconnect by hand, outside T-1753's design, so no scratch row judges the unreachable or lost clocks |
| E1534S3-68 | hub-api | Human | `mrow E1534S3-68 r68` | **T-1755 C3.** `(min_hosts 0) exit 0` with `applies-now lines` 1 or more; `H1 <id> (<machine>); w1 host=<H1> status=running`; `(host stop H1) exit 0` with `destroyed state lines 1`; `w1 row: … status=exited`; `H1 machine gone; host-key.pub absent; client-key absent`; `(host status after stop) exit 0` with `empty pool lines 1` (`agents: 0 hosts …`) |
| E1534S3-69 | hub-api | Human | `rstop` in QA's own shell, then `mrow E1534S3-69 q57` | Stage 2's census (`q57`): `relay watcher alive no`; `hub stop exit 0; hub down`; every recorded pid `alive no`; the first census lists survivors with parent and cwd, and `after TERM:` reads `processes naming the scratch root, the alias or this build: 0`. Expected survivors (A-17643, A-17820; the fake provider's deletion never kills fake-machine processes): for each of H1, H2 and H3 its `supervisor.sh` and host agent, and for H1 (w1) and H3 (w3), which held a live session when destroyed, also the fake OpenCode and that OpenCode's spoke, under the alias or `$Q/fh` (INFERRED: H2's OpenCode and spoke may have ended with w2's stop). Any other survivor is a FINDING unless its command is unrelated (pid reuse, recorded). Then cleanup step 1 |
| E1534S3-79 | hub-api | QA | `s79 > "$EV/E1534S3-79.txt" 2>&1` (after cleanup step 1, with `$Q` and `$T` present) | HEAD, dev and request still the same 40 hex; `dirty entries 0`; `root non-tracker status unchanged: yes`; `preservation lock present: no`; `scratch fixture alias … gone`; `T entries other than node-compile-cache 0` after the T-1676 handling (A-17843: each dead receipt inventoried with its count, PIDs absent, no open handle and its fixture root gone, attributed to the producing row by the `$T` listings, the four fixture producers compared by SHA-256 with `7c0320829`; live residue, or residue from a changed producer outside the clause, is a finding). A moved dev keeps the evidence and makes the run BLOCKED |

Before requesting QA, run `cland qa lint` with this filled brief at the build under test: from the root, `node hub/bin/cland.ts qa lint qa/briefs/E-1534-stage-3.md --commit <dev SHA>`, with a dev SHA that includes every stage landing. The brief is complete only when qa lint passes at the build.

## Probes that mislead

- **Generated names cannot be certified by `qa lint`.** Loop titles (`hub config <key> hot apply …`, `restart settles only positive provider absence: gone=<bool>`, `reopened lease renews at min(1h, <lease>/4) …`, `watchdog recovery preserves effective mirror deadline: <fault>`, `reopened minimum-host scheduler completes admitted work: minimum=<n>`, `status ledger read drains …; setup failure=<bool>`, `C3 stop joins lease renewal and requires confirmed destroy: <bool>`, `cland host <command> --help exits without a hub`, `web refuses <type> even from authenticated human`) are expanded in `expect.json` and checked by `tap.mjs` at the run.
- **Idle stop versus lease expiry.** With a 2-minute lease, an emptied host also stops renewing; E1534S3-65 judges idle stop only when the host is gone before the lease deadline read before the session stopped. A host gone after that deadline is not evidence for T-1749.
- **A missing transport is an outage, not a gone host.** After E1534S3-66's restart only the released H3 is settled; a registered host whose tunnel is slow to reopen stays `running` (T-1752's `registered host without a transport remains running during restart recovery`). Gone-by-outage is T-1753's 15-minute rule.
- **No host-status promise snapshot.** A placement promise lives only while a launch is being placed; E1534S3-64 shows `promised 0` and the named test proves the promised sum.
- **Fake prices are zero.** Today's and the month's totals read `$0.0000` on the fake provider; non-zero accrual and UTC clipping are E1534S3-30's.
- **Never the user's spend ledger.** The scratch hub, its watchdogs and the fake `release` write `$Q/executor-state/spend.json` through the seal's `CLAND_EXECUTOR_STATE`. Reading `~/.local/state/cland/spend.json` or `~/.cland` is out of bounds even to compare.
- **Test-only knobs stay fenced.** S0 prints no `CLAND_TEST_HOST_` name; no scratch row sets one (T-1750's boot knob and T-1753's two clocks are proven by their named tests, E1534S3-11 and E1534S3-23).
- **Headless only.** Neovim and the browser are the pinned headless builds; the web log's `Web prerequisites (report only)` line is the build's state, not a pass by itself.
- **Plain `node --test` is not the suite runner.** It enforces no duration allowance and no resource tripwire preload: a slow pass is not a finding and a fast one proves no budget.
- Process cleanup probes use the fixture-owned pid census (`$Q/pids`) and the scratch-root census; a machine-wide `pgrep` counts other sessions too.
- File-change probes use isolation and digests; mtime alone is confounded by live sessions rewriting the same file.
- Speed criteria use measured wall times, never projections; T-1749's minute, T-1750's 5 minutes and T-1753's 3 and 15 minutes are hub-clock time in the named tests, not wall time.
- Re-check helper and function names with grep at the tested build; renames happen. The kits come from commit `K`; a different commit is a setup BLOCKED.

## Out of scope

- The real DigitalOcean API, droplets, volumes, keys, tokens and any network; T-1756 runs against the fake API only.
- T-1750's, T-1751's and T-1753's clocks on the CLI (named tests only: no CLI drives a boot failure, a sub-cap or a tunnel outage on the scratch hub).
- Linux and container runs, the stage covers and the items' loaded repetitions: their evidence; this run is macOS only and says so.
- Duration allowances (`hub/test/durations.json`) as pass conditions.
- T-1731, T-1758 and T-1689 as bugs (signatures only); T-1735 and T-1732 (fixed; a recurrence is a regression finding); T-1736 and T-1761 (judged as they stand if they appear).
- Any `cland config set`, `cland role launch`, `cland session …`, `cland hub …` or `cland host …` on the live project.

Missing authorization (a real provider token, a GUI) is out of scope, not BLOCKED, because no case needs one.

## Grants

none. No grant is needed: every case runs on this Mac against fakes with a disposable HOME and no credential.

## Rows to verify after landing

**Settle every line here at `<dev SHA>` before requesting QA; record each difference in the brief or the request.** VERIFIED = read at dev `0a4e5372057b00624ef2b26548c5e41e8b9ea761`; INFERRED = reasoned, unproven.

**Settled at dev `0a4e5372` (VERIFIED):** T-1751's five `pool-spend-cap` registrations, its `host-spend` edit, its four source lines and its landing pair (`467af71d4` vs `0a4e53720`, identical apart from tracker files); T-1756's 70 `host-provider-digitalocean` and 6 `host-create-admission` registrations, its untitled edits of `host-watchdog-loop`, `-prepare` and `-volumes`, seven source lines and the empty C6 sweep; T-1753's `host-unreachable` list corrected to 20 (four nested-loop expansions); T-1749's ten registrations and four source lines; T-1750's 21 `pool-failures` registrations, its `host-provision-gate`, `waiting-launch-restart` and `digitalocean-pacing` edits, and five source lines; T-1752's twelve `host-restart-reconcile` registrations (one added after the first read), its native case, the renamed `host-registry` case and the start order; T-1753's 16 `host-unreachable` registrations, its `host-create-entry` case and eight source lines; T-1754's two rendering tests and four source lines; T-1755's status and stop lists, the CLI line formats, `currentInventory`, `hostUsage`, the web refusals and the frozen help. Each landed member's own files equal its final branch tip (E1534S3-02). **Merge watch:** none left; any landing after `0a4e5372` that touches a stage file is named by E1534S3-02.

**Component-only, with the reason:** T-1753's outage clocks (C1 to C6) on a CLI-started hub. No command or hook drops a fake host's tunnel; its tests inject the SSH carrier's status (E1534S3-23). E1534S3-67 checks the CLI surface (`cland host list --json`) only.

**INFERRED, with the reason:**

- E1534S3-64: the exact status numbers (`slots 1.5/2`, `$0.0000`, `$0/hour`), derived from `hub/src/host/status.ts` and the fake declarations, not from a run.
- E1534S3-65: that `idle_stop = "10s"` parses and fires within 150 s on the real clock with the fake billing minimum of 60 s.
- E1534S3-66: that `cland host list` exposes the provision record's `machine` for the fake `release`, and that the restarted hub settles the released host before `w3` is read (T-1752's native test drives the same path in process). Since T-1753, H3's tunnel is also down after the release: the restart must still settle it as gone (positive provider absence), not hold it as an outage.
- E1534S3-68: that `config set hosts.agents.min_hosts 0` with H1 busy starts no replacement after the stop.
- E1534S3-61 and E1534S3-62 reuse stage 2's `q51` and `q52` unchanged (both passed in A-17843); the 2-minute lease replaces stage 2's 30 s.

## Source provenance

VERIFIED = read in source at dev `0a4e5372057b00624ef2b26548c5e41e8b9ea761`; all re-read at the build.

- The kits: commit `K` = `f43f4e21049e9c62a97c8dec1ebf37f9c7035a62`: `qa/briefs/E-1532-stage-4.md` lines 133 to 136 and 228 to 279; `qa/briefs/E-1533-stage-3.md` heredocs `seal.mjs`, `fresh.mjs`, `frame.mjs`, `body.sh`, `helpers.sh`; `qa/briefs/E-1534-stage-2.md` heredocs `relays.mjs` and `scratch.sh` (as `scratch2.sh`) and its `rstart`/`rstop` lines; the stage-2 corrections A-17820 (in that brief) and A-17843 (`.cland/artifacts/A-17843-…/report.md`, `corrections.txt`). T-1756's branch edits three earlier briefs; the kit is read at `K` and is unaffected.
- T-1749 (`ba3e6e17f`, tip `9a7a11116`): `hub/src/host/pool-runtime.ts` (idle lifecycle, `earliestStop`), `hub/src/hub/dispatch.ts` (`configure`, `useSessions` lifecycle), `hub/src/adapters/sessions.ts` (`startPoolScaling`, `configurePools(config)`), `hub/src/host/provider/declarations.ts`, `hub/src/host/provider/fake.ts` (`billingMinimumMs: 60_000`); `hub/test/pool-idle-stop.test.ts` (T2).
- T-1750 (`a5673acf5`, tip `a8fc09822`): `hub/src/host/boot-gate.ts`, `hub/src/host/pool-runtime.ts` (retry time, backoff), `hub/src/hub/agents-topic.ts` (`host-boot-failed`), `hub/src/host/provider/fake.ts` and `provider.ts`, `hub/src/host/provider/digitalocean.ts`, `hub/src/executor/droplet/api.ts`; `hub/test/pool-failures.test.ts` (T2), `host-provision-gate` (T3), `waiting-launch-restart` (T2), `digitalocean-pacing` (T2).
- T-1752 (`d57dd0205`, tip `80fb4f940`): `hub/src/host/host-restart.ts`, `hub/src/hub/daemon.ts`, `hub/src/hub/dispatch.ts` (`restoreSessions`), `hub/src/adapters/sessions.ts`, `hub/src/adapters/processes.ts` (`runningRows`), `hub/src/host/host-leases.ts`, `hub/src/host/provision-host.ts`; `hub/test/host-restart.test.ts` (T3), `host-restart-reconcile` (T2), `host-registry` (T2), `hub/test/fakes/lock-processes.ts`.
- T-1753 (`241992ac1`, tip `2621bbcdb`): `hub/src/host/host-health.ts` (`HostHealth`, `loseHost`), `hub/src/host/registry.ts` (`subscribeStatus`), `hub/src/transport/ssh.ts` (`onStatus`), `hub/src/hub/daemon.ts`, `hub/src/host/provision-records.ts` (`unreachable`, `hostLeaseRenewable`), `hub/src/host/host-leases.ts` (`expireNow`), `hub/src/cli/host.ts` (`list --json`); `hub/test/host-unreachable.test.ts` (T2), `host-create-entry` (T2).
- T-1754 (`ee0e19117`, tip `1c20f7bdc`): `nvim/lua/cland/inbox.lua`, `nvim/lua/cland/state.lua`, `web/src/InboxArea.tsx`, `web/src/InboxArea.module.css`; `nvim/test/inbox-sections.test.ts` (T2), `web/test/inbox.test.ts` (Web); `web/test/harness.ts` and `web/test/prerequisite.ts` (pinned Headless Shell).
- T-1755 (`100937ae6`, tip `9427dbcb5`): `hub/src/host/status.ts`, `hub/src/cli/host.ts`, `hub/src/cli/usage.ts`, `hub/src/hub/dispatch.ts`, `hub/src/hub/web-authority.ts`, `hub/src/protocol.ts`, `hub/src/host/provision-records.ts` (`currentInventory`), `hub/src/host/pool-runtime.ts` and `hub/src/adapters/sessions.ts` (`hostUsage`), `hub/src/executor/droplet/spend.ts` (`inspectHostSpendSnapshot`); tests `host-status`, `host-stop` (T2).
- T-1756 (`49b3099fa`, tip `52f12c657`): `hub/src/host/create-admission.ts`, `admission-fence.ts`, `provision-ssh.ts`, `hub/src/host/provider/digitalocean.ts` (`createAdmission`), `provider.ts`, `fake.ts`, `hub/src/host/host-watchdog.ts`, `host-leases.ts`, `provision-host.ts`, `provision-records.ts`, `acquisition-receipt.ts`, `hub/src/executor/droplet/api.ts` and `spend.ts`; tests `host-provider-digitalocean`, `host-create-admission` (T2), `hub/test/host-admission-fixture.ts`.
- T-1751 (`0a4e53720`, tip `467af71d4`): `hub/src/executor/droplet/spend.ts` (`onHostSpendChange`, sub-cap renewal), `hub/src/hub/dispatch.ts` (the 80 % line, meta `hosts-spend-warning-day`); `hub/test/pool-spend-cap.test.ts` (T2) and its per-test doc (the startup barrier), `hub/test/host-spend.test.ts`; docs `docs/hub/host-spend-cap.md`.
- Plan: stage 3 `{"scope":"affected","when":"after-stage"}`, lanes [T-1749, T-1750, T-1751], [T-1752, T-1753, T-1756], [T-1754], [T-1755]; Coordinator decisions f1c0841e (T-1749 config hand-off), c4167bf3 and a8cc9213 (T-1754 narrow layout), e3b8d634 and 2f951981 (T-1752 native receipts).

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "idle stop, failures, restart, money, host status and DigitalOcean"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Read the request's id and any earlier verdict's id from the epic topic's `history`, never from a `send` result (rule 22). Report `qa clear E-1534 stage idle stop, failures, restart, money, host status and DigitalOcean` or `qa not clear E-1534 stage idle stop, failures, restart, money, host status and DigitalOcean` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
