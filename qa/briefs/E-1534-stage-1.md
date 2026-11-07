# Stage QA brief: E-1534 stage 1 — pool config, role placement, placement core, memory floor and ledger categories

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (start `bash` first; zsh reads `$S:q`, `$B:h` or `${B}:hub` as modifiers; always brace a variable before `:`). The run is local, on macOS (BSD `stat`, Node 24 with `node:sqlite`, `uuidgen`, `lsof`). A platform skip is a FAIL, not a pass. **No real SSH, host, droplet, volume, DigitalOcean API, key, credential, npm registry or network (R-1530's QA rule).** The named files use only their own fakes (fake host provider, fake `ssh`/`scp` on fake hosts, the scripted fake DigitalOcean API, an isolated `XDG_STATE_HOME` for every spend ledger). The scratch rows touch only a scratch project's `config.toml` and `roles.toml` through the real CLI; they create no host. **No real harness.** No browser, no GUI, no Neovim.

The stage is library, configuration and CLI level. The run is meant to take about three hours: setup and E1534S1-00 to E1534S1-03 about 20 minutes (the typecheck included); the named files E1534S1-10 to E1534S1-49 about 130 minutes, one file at a time, the native T3 files under the preservation lock; scratch rows E1534S1-50 to E1534S1-58 about 25 minutes. Waits for cover-quiet admission, the preservation lock or load are not product results.

**Status at writing (dev `5a359016d2860395373f840759aec83baa67bbde`).** T-1740 (`d87501912`), T-1739 (`69cdf36a6`), T-1742 (`f405478eb`), T-1737 (`bbdf693e6`) and T-1738 (`5a359016d`) have landed: VERIFIED at dev `5a359016`. Their landed test files are byte-identical to the branch heads first read, except where a later landing changed them on purpose (T-1738's integration `72d21ebc6` migrated T-1737's `host-provision-gate.test.ts` to the new `HostPool` shape, titles unchanged; the merged `commands.json` and `tiers.json`). T-1741 had not landed: it was read at its branch head `0b2a3f8f759baca1a9c5d60102a378bf1d4021ab` (three commits on `d87501912`, about to merge dev): VERIFIED-on-branch. Three fixes from outside the stage also landed and change rows here: T-1759 (`82bd5c3fc`, `nvim/test/qa.test.ts`'s roles fixture gains `pool: 'local'`, a T-1739 regression its batch never ran), T-1735 (`7926f3203`, fixed) and T-1732 (`10b63fc8c`, fixed). What is still INFERRED is listed under "Rows to verify after landing".

## Carried corrections

A reused kit block must be reconciled against the source brief's recorded run corrections. This brief reuses the stage-3 kit of E-1533 (`qa/briefs/E-1533-stage-3.md`, blob `997909c0c8ac8770cd879e0862816ca22743c939` on dev), which carries stage 2's and stage 1's corrections, and applies the corrections recorded by the E-1533 Definition-of-done run (`qa/briefs/E-1533.md`, blob `354c85e75bc341ba57c43c69d3a352001bd78842`, A-17472). What was carried, and how, is stated here; nothing below is optional.

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

### How this brief applies them, and the reconciliation

- **Fresh seal, streaming redaction, `QA_SESSION` (carried).** Every named file, the typecheck and every scratch command runs through the stage-3 kit's `fresh.mjs`, which builds its environment with `seal()` (the shared builder, `fixtureEnvironment` wrapped by `scratchGitEnvironment`) at the moment it starts, refuses on any credential-prefix name, streams stdout and stderr through the redactor and carries `QA_SESSION` from `state.json`. `body.sh` repeats the gate before a scratch row's function runs. QA's own shell runs with `login:false`. No `env.sh`, no `env -i`.
- **Known dead TMPDIR residue and the unchanged-producer clause (carried, re-scoped).** The 5+5 and 1+1 counts are stage 1's; this run re-inventories them. Residue first seen after a file a stage-1 landing added or edited (E1534S1-02) is a finding unless the A-17342 clause clears it (dead, and the producing block's SHA-256 equal at `<dev SHA>` and at `d875019127a99729ef1ead76f4bdebc602b36dc4`).
- **Expected-registration corrections (carried, applied in advance).** Lists are read at dev `5a359016` (VERIFIED) and, for T-1741's files, at its head `0b2a3f8f` (VERIFIED-on-branch). Before the case rows run, QA re-derives every list a stage landing touched from its file at `<dev SHA>` and records each difference in `$EV/expect-corrections.txt`; a title that proves a criterion and is missing at the build is a FAIL, never a correction.
- **Cleanup order (carried).** After the cleanup census E1534S1-57, remove the known dead T-1676 residue by literal path; run and record E1534S1-58 with `$Q` and `$T` still present; after the verdict, remove `$Q`, `$T` and the worktree by literal paths. E1534S1-60 creates one fake host, so its fixture-socket alias (recorded in `$Q/alias.txt`) is removed in step 1 too.
- **E1533S3-56 and `m56` (carried as not used).** This brief launches no session and never sources stage 3's `scratch.sh`; it writes its own.
- **Kit pin (carried).** kit3 is taken at blob `997909c0c8ac8770cd879e0862816ca22743c939` (the current dev blob); a different blob is a setup BLOCKED. If a later brief edits that kit, it updates this pin in the same commit.
- **Epic occasion suite, droplet gate filter, dpkg quoting (carried as not applicable).** This is a stage run: no epic occasion, no `cland demo`, no droplet gate and no `dpkg` probe exist here. Any later copy of this kit that adds a droplet gate or a `dpkg-query` probe carries the last two as written; an epic DoD carries the first.
- **Known flakes (T-1731 and T-1758 kept by exact signature; T-1735 and T-1732 retired as fixed; T-1736 excluded).** Of their files only `host-ssh-contract` is in this stage's rows (E1534S1-46, run alone); `suite-cancel` applies only if a rerun or a request adds it. A T-1735 or T-1732 signature is a regression finding, never a rerun.
- **From `qa/briefs/E-1532-stage-6.md` through stage 3:** the S0 PATH exemption (exactly the running Node `bin` and the pinned Neovim directory, by realpath) is carried; censuses exclude the census process and its ancestors and match only this run's paths; ids come from listings and files, never from a create or send result (rule 22); the word naming the HTTP Authorization scheme followed by another word is never written (T-1665).

### Kit conventions carried

- **Rule 22.** Every selector, test name and string is marked VERIFIED, VERIFIED-on-branch or INFERRED; an INFERRED expectation is never a pass condition on its own.
- **TAP.** `node --test <file>` reports top-level registrations with `1..N` and `# tests/pass/fail/cancelled/skipped/todo` counters that include nested subtests; names escape `#` and `\`. `tap.mjs` parses exactly that.
- **Exact strings** are counted by `src.mjs` with `String.split`, never by shell `grep`.
- **The preservation lock** is the directory `/tmp/cland-preserve.lock`, taken with `mkdir`, an owner file naming this run and row, and an owner-checked removal by literal path. A held lock makes the row BLOCKED for now (retry later; never remove another owner's lock).

## Stage

- Epic: E-1534 (Pools, placement and the scheduler, under R-1530; after E-1533, closed with DoD A-17472).
- Exact stage name: pool config, role placement, placement core, memory floor and ledger categories.
- Items, in plan order: T-1738 (pool configuration in `[hosts]` and `[hosts.<pool>]`, hot-reloaded and set with `cland config set`), T-1739 (role placement: `[<role>.launch] pool` in `roles.toml`), T-1740 (weighted slots and placement decisions), T-1737 (the hub clock through host creation and readiness, and an in-hub create entry), T-1741 (the host agent's memory floor), T-1742 (spend-ledger categories and host reservations). The run reads membership, counts and state from `task plan show E-1534 --json` (E1534S1-00), never from this list. QA finding fixes added after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: **affected.** The combined changed behaviour of the stage through its named test files, the importer and preservation files its items name, read-only source checks, and scratch checks on the real CLI where an item has a user surface (T-1738's config, T-1739's role CLI). No earlier-epic regression pass beyond those files.
  - T-1740 (landed `d875019127a99729ef1ead76f4bdebc602b36dc4`; VERIFIED): the pure scheduler `decidePlacement` in `hub/src/host/scheduler.ts`, on integer milli-slots (**Coordinator decision 6e81c6b7**: `usedMilli`/`promisedMilli`, one `Math.round(weight * 1000)` conversion, no epsilon): default weights Claude Code 1, Codex 0.5, OpenCode 0.75 (1000/500/750 milli), `[hosts] weights` overrides, dense packing or `spread`, verdict hook defaulting to `serves`, `create` / `waiting for host <id> to boot` / `waiting for a host`. No production caller yet (T-1743).
  - T-1739 (landed `69cdf36a6`; VERIFIED at dev `5a359016`, byte-identical to its head `5d25fee85` apart from the merged usage fixture; reviewer clear rev-36 A-17528): `[<role>.launch] pool` parsed with `parsePoolName`, default `local`; the Coordinator and the Aide only `local`, refused at load (last good roles kept) and by `cland role launch <role> --pool <pool>` (file unchanged); `cland role list` and `cland role launch` show `pool <pool>`; `--pool` in the help. Pool existence is T-1743's, at launch. **Its importer regression is fixed outside the stage:** `nvim/test/qa.test.ts`'s roles fixture deep-equals the launch defaults and lacked `pool: 'local'`; T-1759 (`82bd5c3fc`) added it (E1534S1-16).
  - T-1742 (landed `f405478eb`; VERIFIED at dev `5a359016`, byte-identical to its head `4ba7d8902` apart from the merged `tiers.json`; reviewer clear rev-37): spend entries gain `category` (`verify`, the default for an entry without one, or `hosts`) and host entries their pool; host reservations, renewal, settlement on the real lifetime with the billing minimum, totals per category and pool; the shared cap bounds both categories and the hosts cap bounds `hosts`; no ledger version bump (**A-17473 decision 17**). The executor's spend files pass unedited (C5).
  - T-1737 (landed `bbdf693e6`; VERIFIED at dev `5a359016`; first read at its merge head `31aef1ec8`; T-1738's integration `72d21ebc6` migrated its `host-provision-gate.test.ts` to the new `HostPool` shape (required `slots`, settings built with `readHostPools`), titles unchanged): `createHost`'s 5-minute gate (`PROVISION_GATE_MS`, unchanged) and the registry's tunnel-readiness wait move onto an injected `Clock` (`hub/src/host/clock-delay.ts`); an in-hub create entry takes a pool's settings as an object, reports the host id at the `creating` checkpoint (`onCreating`) and accepts an injected create seam; the readiness owner drains its waits on close and remove. No behaviour change for `cland host create`.
  - T-1738 (landed `5a359016d`; VERIFIED at dev `5a359016`, byte-identical to its final head `72d21ebc6`; first read at `08960ab54`): one parser for the hosts table in `hub/src/host/pools.ts` (`readHostPools` keeps its name and shape, extended): `[hosts]` `daily_spend_usd` (3), `lease` (`"12h"`, at least 30 s), `weights`, `harnesses`; `[hosts.<pool>]` `provider` (required), `size` (`s-4vcpu-8gb`), `region` (`lon1`), `transport` (`ssh`), `slots` (4 for `s-2vcpu-4gb`, 8 for `s-4vcpu-8gb`, required for any other size), `min_hosts` (1 for `agents`, 0 otherwise), `max_hosts` (2), `idle_stop` (`"20m"`), `spread` (false); each refusal names its key; host policy errors refuse hub start; pools are published configuration, so `cland config set hosts.<pool>.<key>` applies now; `cland init` writes `[hosts]` with no pool and `cland update` adds it. Fixtures with custom sizes gained explicit `slots`.
  - T-1741 (VERIFIED-on-branch at `0b2a3f8f759baca1a9c5d60102a378bf1d4021ab`, not landed at writing): `hub/src/host/agent/memory.ts` holds the floor `MEMORY_FLOOR_BYTES = 1_300_000_000` (decimal) and one reading, `availableMemory`: under the fake-host marker `CLAND_FAKE_HOSTS` it reads the JSON `{availableBytes:<nonnegative integer>}` from `available-memory` in the fake host's directory (beside its boot-id file), refusing malformed JSON or bytes; otherwise Linux `/proc/meminfo` `MemAvailable` only; on any other platform with no override there is no verdict (`null`) and the launch is admitted (**A-17473 decision 20**). `requireSpawnMemory` refuses below the floor with `MemoryFloorRefusal` (code `memory-floor`, `availableBytes`, `floorBytes`; text `available memory <n> bytes is below floor 1300000000 bytes`) and admits at or above it. One admission point serves the agent's direct spawn, its prepared spawn and Claude's `launchClaude` run-command path. The agent reply carries `code`, `availableBytes` and `floorBytes`; the hub's ssh Host raises `HostMemoryFloorRefusal` (`host <id>: available memory <n> bytes is below floor <floor> bytes`, with `host`), distinct from a spawn failure; the Claude Code adapter settles a refused launch as never spawned. The shared fake-host creator (`shared/fake-host-machine.ts`, used by `createFakeHost` and the fake provider) seeds 8 GiB (`{"availableBytes":8589934592}`), so existing fake hosts stay above the floor.

### Criteria map

The stage verdict carries no item or epic marks; this tells the run which check proves what. T-1740, T-1739, T-1742, T-1737 and T-1738: VERIFIED at dev `5a359016`; T-1741: VERIFIED-on-branch at `0b2a3f8f`.

| criterion | proven by |
| --- | --- |
| T-1740 C1 (eight Claude Code fill `slots = 8`; seven plus two Codex fill it; seven plus one Codex leave no room for OpenCode) | E1534S1-10 (test `default weights fill eight slots with Claude Code or mixed Codex sessions`; test `accumulated fractional weights fill eight slots exactly`); E1534S1-03 (1000/500/750 computed) |
| T-1740 C2 (dense chooses the fullest host with room; `spread` the emptiest) | E1534S1-10 (test `dense packing chooses fullest eligible host and spread chooses emptiest`; test `used and promised milli-slots share capacity and affect dense packing`) |
| T-1740 C3 (a `[hosts] weights` override changes the decision) | E1534S1-10 (test `weight overrides change placement and leave unspecified defaults intact`; test `fractional overrides convert once to milli-slots and reject one milli excess`) |
| T-1740 C4 (a non-`serves` verdict skips the host; the default hook serves every harness) | E1534S1-10 (test `non-serving hosts are skipped for each verdict and default serves every harness`) |
| T-1740 C5 (`create` below `max_hosts`; waiting for a booting host with room; otherwise waiting for a host) | E1534S1-10 (test `no room creates below the limit but promises booting room before another create`; test `reservations, unavailable hosts and verdicts preserve the boot and maximum fences`) |
| T-1739 C1 (`pool = "agents"` parses; no key reads `local`) | E1534S1-11 (test `role pools default to local and accept named pools for built-in and custom workers`); E1534S1-16 (the Neovim QA fixture's launch defaults now read `pool: 'local'`, T-1759); E1534S1-55 |
| T-1739 C2 (`cland role launch implementer --pool agents` writes the key; `--help` names `--pool`) | E1534S1-13 (test `role launch pool CLI writes a named pool and help advertises it`); E1534S1-55 |
| T-1739 C3 (`[coordinator.launch]` or `[aide.launch]` `pool = "agents"` refused at load, last good roles kept) | E1534S1-12 (test `invalid Coordinator and Aide pools retain the last good role snapshot and loaded pools`); E1534S1-11 (test `role pool validation shares pool-name syntax and the local-only role policy`); E1534S1-56 |
| T-1739 C4 (`cland role launch coordinator --pool agents` refused with the same reason, file unchanged) | E1534S1-13 (the `coordinator` and `aide` expansions of `role launch pool refuses remote <role> without writing`); E1534S1-55 |
| T-1742 C1 (entries carry `category`, host entries their pool; no category reads `verify`; a previous ledger keeps every entry and settled cost after a host reservation) | E1534S1-20 (test `host reservation preserves previous v1 settlements and legacy reconciliation`); E1534S1-03 |
| T-1742 C2 (a host reservation refused past the hosts cap or the shared cap; executor reservations count `hosts` entries) | E1534S1-20 (test `host and executor admissions share the cap while hosts also obey their own cap`; test `executor shard admission does not mistake a host identity for a verification run`; the `native` and `shard` expansions of `<mode> host lease conflict refuses admission without changing durable accounting`) |
| T-1742 C3 (renewal raises the reservation; settlement bills the real lifetime with the billing minimum) | E1534S1-20 (test `renewal raises the held lifetime and settlement bills actual lifetime with a minimum`) |
| T-1742 C4 (today's and the month's totals per category and pool) | E1534S1-20 (test `settled UTC totals separate days, months and pools while pending costs stay excluded`; test `offset settlement instants count in the UTC day and month and shared cap`) |
| T-1742 C5 (the executor's spend test files pass unedited) | E1534S1-02 (no executor spend importer edited); E1534S1-21 to E1534S1-24 |
| T-1737 C1 (a never-booting fake machine fails the gate at 300 000 ms of clock time with no real wait, and is released) | E1534S1-25 (test `never-booting creation releases at exactly 300000 ms on the hub clock`) |
| T-1737 C2 (the tunnel-readiness wait bounded by the same injected clock) | E1534S1-25 (test `tunnel readiness expires at exactly 300000 ms on its injected clock`); E1534S1-27 (the `close` and `remove` expansions of `owner <action> drains down-tunnel readiness without advancing time`) |
| T-1737 C3 (an in-hub caller gets the host id at `creating`, before acquire resolves) | E1534S1-25 (test `settings entry publishes durable creating id before held acquisition completes`); E1534S1-26 (test `hub create entry passes its clock and owner to the injected create path`) |
| T-1737 C4 (host create, destroy and provision-records files pass unedited) | E1534S1-02; E1534S1-28 to E1534S1-33 |
| T-1738 C1 (`[hosts]` and `[hosts.<pool>]` keys parse with their defaults; each invalid value refused naming its key) | E1534S1-34 (test `host pools default capacity, agent minimum and global policy`; the expansions of `host pool refuses invalid <key> naming its key` and `hosts refuses invalid <key> naming its key`; test `required provider, custom size slots, lease boundary and explicit overrides`); E1534S1-38 (test `malformed non-transport hosts keys are refused by project config`); E1534S1-03 |
| T-1738 C2 (a pool without `provider` refused at config read naming `provider`; `config set hosts.qa.provider fake` writes a valid pool with every other key defaulted) | E1534S1-34; E1534S1-35 (test `config set creates pools through provider and publishes capacity immediately`); E1534S1-52, E1534S1-54 |
| T-1738 C3 (`slots` 4 and 8 by size; `agents` `min_hosts` 1, others 0; an unlisted size without `slots` refused naming `slots`) | E1534S1-34; E1534S1-03 (the size table, the `agents` default); E1534S1-52 |
| T-1738 C4 (`lease` under 30 s refused naming `hosts.lease`) | E1534S1-34 (the `lease` expansion of `hosts refuses invalid <key> naming its key`; the 30 s boundary in the required-provider test); E1534S1-53, E1534S1-54 |
| T-1738 C5 (`cland init` writes `[hosts]` with `daily_spend_usd = 3` and `lease = "12h"` and no pool; `cland update` adds it, keeping pools and pins) | E1534S1-37 (test `managed init and update add hosts defaults without a pool and keep pins`); E1534S1-34 (test `hosts rendering adds global defaults without creating a pool and upgrades old config`); E1534S1-50, E1534S1-51 |
| T-1738 C6 (`config set hosts.agents.max_hosts 4` applies now; the published pool configuration holds 4 without a restart) | E1534S1-36 (test `pool settings publish the new capacity on the running configuration owner`: published 2 then 4); E1534S1-35; E1534S1-52 (the real CLI, same hub pid) |
| T-1738 C7 (`config set` refuses an unknown pool key and an invalid pool name, naming keys and characters) | E1534S1-35 (the same config-set test's refusal loop; test `config set replaces subset and empty host weights and harness pin tables`); E1534S1-53 |
| T-1738 C8 (`host prepare` and `host create` unchanged on their tests) | E1534S1-39 (`host-prepare`), E1534S1-40 (`host-create-admission`), E1534S1-41, E1534S1-42; E1534S1-28 (`host-create-ready`) |
| T-1738 extra (host policy errors refuse startup; the frozen `CONFIG_USAGE`) | E1534S1-35 (test `host policy errors refuse startup rather than loading whole-config defaults`); E1534S1-45 (`cli-help`); E1534S1-47 (`startup-cleanup`, a daemon importer) |
| T-1741 C1 (spawn refused with `memory-floor` below 1.3 GB, spawned at or above) | E1534S1-48 (test `launch memory policy refuses below floor, admits exact floor and unknown non-Linux memory`: 1200000000 and 1299999999 refused as `MemoryFloorRefusal` with `floorBytes` 1300000000; 1300000000, 1400000000 and `null` admitted); E1534S1-17 (test `memory floor refuses direct and prepared spawn, reports fake bytes and admits the exact floor`); E1534S1-03 |
| T-1741 C2 (a fake host set to 1.2 GB refuses, and its `memory` event reports that amount) | E1534S1-17 (the same test: the fake `available-memory` bytes in the refusal and the `memory` event); E1534S1-57 (the real CLI on a created fake host) |
| T-1741 C3 (the ssh Host raises a typed memory-floor refusal naming the host and the free memory, distinct from a spawn failure) | E1534S1-18 (test `remote Claude memory floor refuses actual launchClaude with no process then admits exact floor`: `available memory 1200000000 bytes`, no `--bg` call, no process row, `code` `memory-floor`, `host` `f1`, `availableBytes` 1200000000; then the exact floor launches); E1534S1-19 (`host-agent-client`, the reply's typed fields); E1534S1-03 (`HostMemoryFloorRefusal`); E1534S1-57 |
| T-1741 C4 (the override ignored without the fake-host marker) | E1534S1-17 (test `memory override is ignored without the fake-host marker and malformed fake bytes refuse`) |
| T-1741 extra (one admission point for every harness launch, Claude's run-command path included; the 8 GiB seed keeps existing fake hosts admitted) | E1534S1-18; E1534S1-03 (the admission calls in the agent's spawn, prepared spawn and Claude launch); E1534S1-46 (`host-ssh-contract`, unedited) and E1534S1-28, E1534S1-31 (fake hosts seeded at 8 GiB still launch) |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1534 --json` lists in stage `pool config, role placement, placement core, memory floor and ledger categories`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit. A task with a branch still needs its landing receipt even if the branch has no commits; a task closed `done` with no branch and no landing receipt must have no `Item:` trailer on dev (evidence-only completion). A dirty build, a missing required merge (**every member needs a landing here**) or moved dev blocks this run: retain any collected evidence and report to the requester. The brief names no run id on purpose.

At writing (dev `5a359016d2860395373f840759aec83baa67bbde`): T-1740 landed as `d875019127a99729ef1ead76f4bdebc602b36dc4`, T-1739 as `69cdf36a6`, T-1742 as `f405478eb`, T-1737 as `bbdf693e6` and T-1738 as `5a359016d` (each with its `Item:` trailer); their test and product files were re-read at that dev (VERIFIED). T-1741 had not landed: read at `t/T-1741-the-host-agent-s-memory-floor` head `0b2a3f8f759baca1a9c5d60102a378bf1d4021ab` (VERIFIED-on-branch). **Landing check (T-1741).** At `<dev SHA>`, QA confirms its landing receipt (E1534S1-00) and that `hub/test/host-memory.test.ts`, `hub/test/host-agent.test.ts`, `hub/test/host-agent-client.test.ts`, `hub/test/claude-code-remote.test.ts`, `hub/test/ssh-host-fixture.ts`, `shared/fake-host-machine.ts` and `hub/src/host/agent/memory.ts` are byte-identical to `0b2a3f8f` (E1534S1-02's `T-1741 files byte-identical to 0b2a3f8f` line). A difference (the pending dev merge may touch `ssh-host-fixture.ts` or the shared creator) is an expected-registration correction under the carried rule, never a silent pass. Every other string, title and path is re-read at `<dev SHA>` and a difference recorded before judging. T-1738 and T-1739 both edited `hub/test/fixtures/cli-usage/commands.json` (`CONFIG_USAGE` and `ROLE_USAGE`); the fixture at dev `5a359016` carries both (`[--pool …]` and `hosts.<pool>.<key>`), and E1534S1-45 judges it.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step. No named file needs `web/dist`; E1534S1-01 runs the typecheck only.

**Where things live.** All scratch state is under `$Q` (`/private/tmp/q53-…`, realpath, 23 bytes; the stage-3 kit's seal accepts exactly this prefix) and `$T` (`/private/tmp/qa-e1533-s3-<uuid>`, the suite root's byte length; also the kit's prefix). The only paths under the repository are `$W` in `.cland/worktrees/` and the evidence `$EV` in `.cland/qa/E-1534/<run>/`, both ignored by Git. Nothing is written to `.cland/tasks/` of the live project; E1534S1-00 and E1534S1-58 compare the root's non-tracker status.

**Isolation (rule 15).** Every scratch check runs in a disposable project p1 with its own HOME, XDG directories and Git config, through the fresh seal. Never the live project's hub, config, roles, territory, `hub.db`, `.cland/secrets.toml` or `.cland/hub.json`, or the human's HOME (`~/.cland`, `~/.ssh`, `~/.claude`, `~/.codex`, `~/.opencode`, `~/.local/state`, `~/.config/cland`) — in particular **never the user's spend ledger** (`~/.local/state/cland/spend.json` or the legacy `~/.cland/executor/spend.json`): T-1742's files use an isolated `XDG_STATE_HOME`, and the seal points `XDG_STATE_HOME` at `$Q/state`. Never read or print a credential; never run `cland config set`, `cland role launch`, `cland update`, `cland hub reload` or `cland host …` against the live project. The live hub is read only by QA's own shell for the plan read and `quiet`.

Two shells, never mixed. **QA's own shell** keeps QA's session identity: worktree, roots, `quiet`, the plan read, the source checks, every record. **Every other command** runs through `$Q/fresh.mjs`: named files and the typecheck in `plain` mode (cwd `$W`), scratch rows in `hub` mode (cwd `$Q/p1`, through `body.sh`).

### Environment

Put Node from `/Users/evgeniyivanov/.nvm/versions/node/v24.21.0/bin` first on `PATH` and check `node --version` against the qa skill's `node-engines.json`. In QA's own shell (bash):

```sh
R=/Users/evgeniyivanov/Projects/cland/v0
S=<dev SHA>                                    # the full dev SHA from the request
RUN=qa-e1534s1-$(date +%F)-1                   # unique run id for E-1534; bump the suffix on a rerun
export QA_SESSION=${QA_SESSION:-${CLAND_SESSION_NAME:-}}
[ -n "$QA_SESSION" ] || echo "BLOCKED: no QA session name"
W=$R/.cland/worktrees/qa-e1534s1-$RUN
EV=$R/.cland/qa/E-1534/$RUN
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
NV=$(cd "$W" && node nvim/bin/nvim-path.ts 2> /dev/null); NVD=$(dirname "${NV:-/nonexistent/x}")
T=/private/tmp/qa-e1533-s3-$(uuidgen | tr 'A-Z' 'a-z'); mkdir -m 700 "$T"
Q=$(cd "$(mktemp -d /tmp/q53-XXXXXX)" && pwd -P); chmod 700 "$Q"
mkdir -p "$Q/home" "$Q/config" "$Q/opencode" "$Q/state" "$Q/cache" "$Q/claude" "$Q/codex" "$Q/fake-claude" "$Q/fake-codex" "$Q/fake-opencode" "$Q/executor-state" "$Q/p1" "$Q/fh" "$Q/bin"
chmod 700 "$Q/claude" "$Q/fake-claude"         # E-1532 DoD fix: Claude roots 0700
: > "$Q/pids"; : > "$Q/home/.gitconfig"; : > "$Q/home/.gitignore-global"
# The stage-3 kit's body.sh gate expects these shims; no row here creates a host:
ln -s "$W/hub/test/fakes/fake-ssh.ts" "$Q/bin/ssh"; ln -s "$W/hub/test/fakes/fake-scp.ts" "$Q/bin/scp"
printf '#!/bin/sh\nexec "$@"\n' > "$Q/bin/setsid"
printf "#!/bin/sh\nln -s '%s/node_modules' node_modules\n" "$W" > "$Q/bin/npm"
chmod 700 "$Q/bin/setsid" "$Q/bin/npm"
printf '{"W":"%s","Q":"%s","EV":"%s","T":"%s","R":"%s","SESSION":"%s"}\n' "$W" "$Q" "$EV" "$T" "$R" "$QA_SESSION" > "$Q/state.json"
```

**The kits, by exact blob.** From the stage-4 brief (`qa/briefs/E-1532-stage-4.md`, blob `4ed467672750bf34179ed72549df863d1541eddb`): `holder`, `quiet`, `ld` (lines 133 to 136) and `tap.mjs` (lines 228 to 279). From the E-1533 stage-3 brief (`qa/briefs/E-1533-stage-3.md`, blob `997909c0c8ac8770cd879e0862816ca22743c939`): its heredocs `seal.mjs`, `fresh.mjs`, `frame.mjs`, `body.sh` and `helpers.sh`, each taken whole by its `cat > "$Q/<name>" <<'…'` line and written to `$Q` unchanged. Not taken: its `scratch.sh`, `expect.json`, `src.mjs` and `checks.sh` (this brief writes its own). A different blob is a setup BLOCKED.

```sh
K4="$W/qa/briefs/E-1532-stage-4.md"; K3="$W/qa/briefs/E-1533-stage-3.md"
echo "kit4 blob $(git -C "$W" rev-parse HEAD:qa/briefs/E-1532-stage-4.md) want 4ed467672750bf34179ed72549df863d1541eddb"
echo "kit3 blob $(git -C "$W" rev-parse HEAD:qa/briefs/E-1533-stage-3.md) want 997909c0c8ac8770cd879e0862816ca22743c939"
sed -n '133,136p' "$K4" > "$Q/kit-shell.sh"; sed -n '228,279p' "$K4" > "$Q/kit-tap.sh"
. "$Q/kit-shell.sh"; . "$Q/kit-tap.sh"
kit3() { awk -v n="$1" 'BEGIN{h="cat > \"$Q/" n "\" <<"} index($0,h)==1{f=1} f{print} f&&/^(JS|SH|JSON)$/{exit}' "$K3"; }
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

Expected: both blobs equal `want`; each `kit3` line starts with `cat > "$Q/<name>" <<'` and has more than two lines; `kits checked`.

The S0 environment prints, each through its own fresh seal:

```sh
for m in plain hub; do node "$Q/fresh.mjs" "$Q" "$m" node -e 'const fs=require("fs"),os=require("os"),path=require("path");const e=process.env,h=os.userInfo().homedir,real=p=>{try{return fs.realpathSync(p)}catch{return p}};const allowed=new Set([real(path.dirname(process.execPath)),real(process.argv[1])]);console.log(process.argv[2]+": credential-prefix names "+Object.keys(e).filter(k=>/^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|CODEX_API|CODEX_ACCESS|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)/.test(k)).length+"; QA_SESSION "+(e.QA_SESSION?"set":"unset")+"; TMPDIR is T "+(e.TMPDIR===e.QA_T)+"; HOME is Q/home "+(e.HOME===e.QA_Q+"/home")+"; XDG_STATE_HOME is Q/state "+(e.XDG_STATE_HOME===e.QA_Q+"/state")+"; real-HOME PATH entries other than the Node bin and the pinned Neovim directory "+e.PATH.split(":").filter(p=>p.startsWith("~")||((p===h||p.startsWith(h+"/"))&&!allowed.has(real(p)))).length)' "$NVD" "$m"; done 2>&1 | tee "$EV/S0-env.txt"
echo "Q bytes $(printf '%s' "$Q" | wc -c | tr -d ' '); T bytes $(printf '%s' "$T" | wc -c | tr -d ' '); a suite root for comparison $(printf '%s' "/private/tmp/cland-suite-$(uuidgen | tr 'A-Z' 'a-z')" | wc -c | tr -d ' ')" | tee -a "$EV/S0-env.txt"
```

Expected (recorded as `S0`): `kits checked`; both modes `credential-prefix names 0`, `QA_SESSION set`, TMPDIR, HOME and `XDG_STATE_HOME is Q/state` `true`, `0` real-HOME entries, each `# fresh: redacted or withheld lines 0`; `Q bytes 23`, `T bytes` equal to the suite root's. A non-zero credential count stops the run (BLOCKED).

The TAP expectations. `exact: true` lists every registration; `exact: false` lists the names that prove a criterion (the rest of the file must still pass); `[]` means the whole file must be `CLEAN`. Lists were read at dev `5a359016` (VERIFIED), T-1741's (`host-memory`, `host-agent`, `claude-code-remote`, `host-agent-client`) at its head `0b2a3f8f` (VERIFIED-on-branch). Re-derive every touched list at `<dev SHA>` before E1534S1-10 (the expected-registration correction).

```sh
cat > "$Q/expect.json" <<'JSON'
{
 "hub/test/host-scheduler.test.ts": {"exact": true, "names": [
  "default weights fill eight slots with Claude Code or mixed Codex sessions",
  "dense packing chooses fullest eligible host and spread chooses emptiest",
  "weight overrides change placement and leave unspecified defaults intact",
  "non-serving hosts are skipped for each verdict and default serves every harness",
  "no room creates below the limit but promises booting room before another create",
  "reservations, unavailable hosts and verdicts preserve the boot and maximum fences",
  "fractional overrides convert once to milli-slots and reject one milli excess",
  "accumulated fractional weights fill eight slots exactly",
  "used and promised milli-slots share capacity and affect dense packing"]},
 "hub/test/roles-harnesses.test.ts": {"exact": false, "names": [
  "role pools default to local and accept named pools for built-in and custom workers",
  "role pool validation shares pool-name syntax and the local-only role policy"]},
 "hub/test/roles-snapshot.test.ts": {"exact": false, "names": [
  "invalid Coordinator and Aide pools retain the last good role snapshot and loaded pools"]},
 "hub/test/role-launch.test.ts": {"exact": false, "names": [
  "role launch pool CLI writes a named pool and help advertises it",
  "role launch pool refuses remote coordinator without writing",
  "role launch pool refuses remote aide without writing"]},
 "hub/test/roles-component.test.ts": {"exact": false, "names": []},
 "hub/test/cli.test.ts": {"exact": false, "names": []},
 "hub/test/session-host-placement.test.ts": {"exact": false, "names": []},
 "nvim/test/qa.test.ts": {"exact": false, "names": []},
 "hub/test/host-agent.test.ts": {"exact": false, "names": [
  "memory floor refuses direct and prepared spawn, reports fake bytes and admits the exact floor",
  "memory fixture drains accepted server after failed client setup before removing its root",
  "memory override is ignored without the fake-host marker and malformed fake bytes refuse"]},
 "hub/test/claude-code-remote.test.ts": {"exact": false, "names": [
  "remote Claude memory floor refuses actual launchClaude with no process then admits exact floor",
  "T-1730 C2 upgraded runtime launches Claude with connected mod bridge"]},
 "hub/test/host-agent-client.test.ts": {"exact": false, "names": []},
 "hub/test/host-memory.test.ts": {"exact": true, "names": [
  "launch memory policy refuses below floor, admits exact floor and unknown non-Linux memory"]},
 "hub/test/roles-editor.test.ts": {"exact": false, "names": []},
 "hub/test/roles-template.test.ts": {"exact": false, "names": []},
 "hub/test/roles-launch-permissions.test.ts": {"exact": false, "names": []},
 "hub/test/host-spend.test.ts": {"exact": true, "names": [
  "host reservation preserves previous v1 settlements and legacy reconciliation",
  "host and executor admissions share the cap while hosts also obey their own cap",
  "renewal raises the held lifetime and settlement bills actual lifetime with a minimum",
  "settled UTC totals separate days, months and pools while pending costs stay excluded",
  "executor shard admission does not mistake a host identity for a verification run",
  "native host lease conflict refuses admission without changing durable accounting",
  "shard host lease conflict refuses admission without changing durable accounting",
  "offset settlement instants count in the UTC day and month and shared cap"]},
 "hub/test/executor-spend.test.ts": {"exact": false, "names": []},
 "hub/test/suite-accounting.test.ts": {"exact": false, "names": []},
 "hub/test/state-paths.test.ts": {"exact": false, "names": []},
 "hub/test/executor-safety.test.ts": {"exact": false, "names": [
  "concurrent host processes share one reservation lock and recover a dead holder",
  "prepare, run, fallback, cancel and stopped-hub watchdog leave the sentinel nowhere"]},
 "hub/test/host-provision-gate.test.ts": {"exact": true, "names": [
  "never-booting creation releases at exactly 300000 ms on the hub clock",
  "tunnel readiness expires at exactly 300000 ms on its injected clock",
  "settings entry publishes durable creating id before held acquisition completes"]},
 "hub/test/host-create-entry.test.ts": {"exact": true, "names": [
  "hub create entry passes its clock and owner to the injected create path"]},
 "hub/test/host-readiness-owner.test.ts": {"exact": true, "names": [
  "owner close drains down-tunnel readiness without advancing time",
  "owner remove drains down-tunnel readiness without advancing time"]},
 "hub/test/host-create-ready.test.ts": {"exact": false, "names": [
  "C1/C2 create reaches ready with clone and tunnel and runs OpenCode; list shows declared facts",
  "C3 mismatched prelude key never registers or starts a supervisor and releases machine after gate"]},
 "hub/test/host-destroy.test.ts": {"exact": false, "names": [
  "C4 destroy refuses an unknown id",
  "release names confirming machine and key reads, including an already gone machine"]},
 "hub/test/host-provision-records.test.ts": {"exact": false, "names": []},
 "hub/test/host-destroy-native.test.ts": {"exact": false, "names": [
  "destroy joins an admitted held acquisition and prevents ready resurrection"]},
 "hub/test/host-runtime-owner.test.ts": {"exact": false, "names": []},
 "hub/test/host-ssh-registry.test.ts": {"exact": false, "names": []},
 "hub/test/host-pools-config.test.ts": {"exact": true, "names": [
  "host pools default capacity, agent minimum and global policy",
  "hosts rendering adds global defaults without creating a pool and upgrades old config",
  "host pool refuses invalid provider naming its key",
  "host pool refuses invalid size naming its key",
  "host pool refuses invalid region naming its key",
  "host pool refuses invalid slots naming its key",
  "host pool refuses invalid min_hosts naming its key",
  "host pool refuses invalid max_hosts naming its key",
  "host pool refuses invalid idle_stop naming its key",
  "host pool refuses invalid spread naming its key",
  "host pool refuses invalid transport naming its key",
  "hosts refuses invalid daily_spend_usd naming its key",
  "hosts refuses invalid lease naming its key",
  "hosts refuses invalid weights naming its key",
  "hosts refuses invalid harnesses naming its key",
  "required provider, custom size slots, lease boundary and explicit overrides"]},
 "hub/test/config-set.test.ts": {"exact": false, "names": [
  "config set creates pools through provider and publishes capacity immediately",
  "host policy errors refuse startup rather than loading whole-config defaults",
  "config set replaces subset and empty host weights and harness pin tables"]},
 "hub/test/config-reload-component.test.ts": {"exact": false, "names": [
  "pool settings publish the new capacity on the running configuration owner"]},
 "hub/test/init-config.test.ts": {"exact": false, "names": [
  "managed init and update add hosts defaults without a pool and keep pins",
  "managed provisioning preserves hosts and unknown keys across every section"]},
 "hub/test/transport-config.test.ts": {"exact": false, "names": [
  "malformed non-transport hosts keys are refused by project config",
  "quoted empty pool transport is refused at startup"]},
 "hub/test/host-prepare.test.ts": {"exact": false, "names": [
  "pool prepare CLI publishes an image and then reports current",
  "config set preserves SSH hosts and both pools before host prepare"]},
 "hub/test/host-create-admission.test.ts": {"exact": false, "names": [
  "C4 create refuses an unprepared pool naming host prepare",
  "DigitalOcean create names missing E-1534 admission before image checks or API calls"]},
 "hub/test/host-provision-recovery.test.ts": {"exact": false, "names": []},
 "hub/test/host-provider-digitalocean-prepare.test.ts": {"exact": false, "names": []},
 "hub/test/setup-accounts.test.ts": {"exact": false, "names": []},
 "hub/test/setup-flow.test.ts": {"exact": false, "names": []},
 "hub/test/cli-help.test.ts": {"exact": false, "names": [
  "cland --help retains its pre-refactor output byte for byte"]},
 "hub/test/host-ssh-contract.test.ts": {"exact": false, "names": [
  "ssh Host runs every shared Host behavioral contract through fake ssh"]},
 "hub/test/startup-cleanup.test.ts": {"exact": false, "names": []},
 "hub/test/test-docs.test.ts": {"exact": false, "names": []},
 "hub/test/suite-tiers.test.ts": {"exact": false, "names": []}
}
JSON
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("expect checked")' "$Q/expect.json"
```

The source checks (`src.mjs`), counted with `String.split` at the build, plus the computed milli-slot conversions:

```sh
cat > "$Q/src.mjs" <<'JS'
// node "$Q/src.mjs" <W>   ok, MISMATCH or info per line; then computed checks
import { readFileSync, existsSync, readdirSync } from 'node:fs';
const W = process.argv[2];
const read = f => existsSync(`${W}/${f}`) ? readFileSync(`${W}/${f}`, 'utf8') : null;
const MEM = 'hub/src/host/agent/memory.ts', SCH = 'hub/src/host/scheduler.ts', POOLS = 'hub/src/host/pools.ts', SPEND = 'hub/src/executor/droplet/spend.ts', ROLES = 'hub/src/roles/config.ts', PH = 'hub/src/host/provision-host.ts';
const C = [
  // T-1740 (VERIFIED at dev 5a359016)
  ['T-1740 default weights', SCH, "'claude-code': 1, codex: 0.5, opencode: 0.75,", '=1'],
  ['T-1740 one rounded milli conversion', SCH, 'const milli = Math.round(weight * 1000);', '=1'],
  ['T-1740 integer capacity on used plus promised milli', SCH, 'host.usedMilli + host.promisedMilli + weightMilli <= host.slots * 1000', '=1'],
  // T-1738 (VERIFIED at dev 5a359016)
  ['T-1738 C3 slots by size', POOLS, "const SIZE_SLOTS: Record<string, number> = { 's-2vcpu-4gb': 4, 's-4vcpu-8gb': 8 };", '=1'],
  ['T-1738 C3 agents minimum 1, others 0', POOLS, "value.min_hosts ?? (name === 'agents' ? 1 : 0)", '=1'],
  ['T-1738 C1 default size', POOLS, "value.size ?? 's-4vcpu-8gb'", '=1'],
  ['T-1738 C1 default region', POOLS, "value.region ?? 'lon1'", '=1'],
  ['T-1738 C1 default idle stop', POOLS, "value.idle_stop ?? '20m'", '=1'],
  ['T-1738 C1 default daily spend', POOLS, "source.daily_spend_usd ?? 3", '=1'],
  ['T-1738 C1 default lease', POOLS, "source.lease ?? '12h'", '=1'],
  ['T-1738 C4 lease minimum', POOLS, "if (leaseMs < 30000) throw new Error('hosts.lease must be at least 30s');", '=1'],
  ['T-1738 C2 provider required (no default)', POOLS, 'const provider = text(value.provider, `${key}.provider`);', '=1'],
  ['T-1738 C7 pool keys', POOLS, "export const POOL_KEYS = ['provider', 'size', 'region', 'transport', 'slots', 'min_hosts', 'max_hosts', 'idle_stop', 'spread'] as const;", '=1'],
  // T-1742 (VERIFIED at dev 5a359016)
  ['T-1742 C1 an entry without a category reads verify', SPEND, "const category = (entry: Entry): 'verify' | 'hosts' => entry.category ?? 'verify';", '=1'],
  ['T-1742 C1 host entries are hosts with their pool', SPEND, "ledger.entries.push({ ...input, category: 'hosts', run: input.lease, reservation, cost: null });", '=1'],
  ['T-1742 C1 executor entries are verify', SPEND, "category: 'verify', project, lease: lease.lease", '=1'],
  ['T-1742 C2 the hosts cap', SPEND, 'throw new Error(`hosts daily spend cap $${caps.hosts} would be exceeded`);', '=1'],
  ['T-1742 C2 the shared cap', SPEND, 'throw new Error(`daily spend cap $${caps.shared} would be exceeded`);', '=1'],
  ['T-1742 the ledger stays version 1', SPEND, 'version: 1', '>=1'],
  ...['export async function reserveHostSpend(', 'export async function renewHostSpend(', 'export async function settleHostSpend(', 'export async function inspectHostSpend('].map(s => ['T-1742 C3/C4 host ledger operation', SPEND, s, '=1']),
  // T-1739 (VERIFIED at dev 5a359016)
  ['T-1739 C1 pool default local, pool-name syntax', ROLES, "const pool = launch.pool === undefined ? 'local' : parsePoolName(typeof launch.pool === 'string' ? launch.pool : '');", '=1'],
  ['T-1739 C3 local-only policy at load', ROLES, 'checkRoleHost(role, pool);', '=1'],
  ['T-1739 C3/C4 the refusal text', 'hub/src/host/role-placement.ts', "throw new Error('Coordinator and Aide roles run only on the local host');", '=1'],
  ['T-1739 the role list shows the pool', 'hub/src/cli/role.ts', "`pool ${r.launch.pool ?? 'local'}`", '=1'],
  ['T-1739 C2 the launch usage names --pool', 'hub/src/cli/role.ts', '[--permissions …] [--pool …] [--json]', '=1'],
  // T-1737 (VERIFIED at dev 5a359016)
  ['T-1737 the gate constant is unchanged', PH, 'export const PROVISION_GATE_MS = 300000;', '=1'],
  ['T-1737 C1 the gate deadline on the hub clock', PH, 'const deadline=clock.now().getTime()+(o.gateMs??PROVISION_GATE_MS);', '=1'],
  ['T-1737 C3 the creating checkpoint reports the id', PH, 'o.onCreating?.(record.id);', '=1'],
  ['T-1737 C2 the clock delay helper', 'hub/src/host/clock-delay.ts', 'export function clockDelay(clock:Clock, ms:number, signal?:AbortSignal):Promise<void> {', '=1'],
  // T-1741 (VERIFIED-on-branch 0b2a3f8f; MISMATCH until it lands)
  ['T-1741 C1 the floor in bytes', MEM, 'export const MEMORY_FLOOR_BYTES = 1_300_000_000;', '=1'],
  ['T-1741 C1 the typed code', MEM, "readonly code = 'memory-floor';", '=1'],
  ['T-1741 C1 refusal below the floor only', MEM, 'if (bytes !== null && bytes < MEMORY_FLOOR_BYTES) throw new MemoryFloorRefusal(bytes);', '=1'],
  ['T-1741 C1 Linux MemAvailable only', MEM, 'MemAvailable', '>=1'],
  ['T-1741 C1 no verdict off Linux without an override', MEM, "if (process.platform !== 'linux') return null;", '=1'],
  ['T-1741 C4 the override only under the fake-host marker', MEM, 'if (env.CLAND_FAKE_HOSTS) {', '=1'],
  ['T-1741 C2 the override file beside the boot id', MEM, "readFile(join(env.CLAND_HOST_BOOT_ID_FILE ? dirname(env.CLAND_HOST_BOOT_ID_FILE) : runDir, 'available-memory'), 'utf8')", '=1'],
  ['T-1741 the agent spawn admission', 'hub/src/host/agent/processes.ts', 'await requireSpawnMemory(this.#runDir, this.#env);', '=1'],
  ['T-1741 the Claude run-command admission', 'hub/src/host/agent/server.ts', "if(typeof command.claudeGeneration==='string'){await requireSpawnMemory(options.runDir,options.env??process.env);", '=1'],
  ['T-1741 C3 the typed ssh Host refusal', 'hub/src/host/ssh-host.ts', 'export class HostMemoryFloorRefusal extends Error {', '=1'],
  ['T-1741 the 8 GiB fake-host seed', 'shared/fake-host-machine.ts', "await writeFile(join(directory, 'available-memory'), JSON.stringify({availableBytes:8 * 1024 ** 3}));", '=1'],
];
const tree = (dir, text) => { let n = 0; const walk = d => { for (const e of readdirSync(`${W}/${d}`, { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) walk(p); else if (/\.(ts|sh)$/.test(p)) n += readFileSync(`${W}/${p}`, 'utf8').split(text).length - 1; } }; walk(dir); return n; };
for (const [label, file, text, e] of C) {
  if (e.startsWith('tree')) { const n = existsSync(`${W}/${file}`) ? tree(file, text) : 'MISSING'; console.log(`${typeof n === 'number' && n >= Number(e.slice(6)) ? 'ok' : 'MISMATCH'} ${label} | ${file} | ${n} | ${e}`); continue; }
  const t = read(file), n = t === null ? 'MISSING' : t.split(text).length - 1;
  const pass = t !== null && (e.startsWith('>=') ? n >= Number(e.slice(2)) : n === Number(e.slice(1)));
  console.log(`${pass ? 'ok' : 'MISMATCH'} ${label} | ${file} | ${n} | ${e}`);
}
// T-1740: the defaults convert to 1000/500/750 milli-slots through the build's own function; slots 8 is 8000
{ const { harnessWeightMilli } = await import(`${W}/${SCH}`);
  const got = ['claude-code', 'codex', 'opencode'].map(h => harnessWeightMilli(h)).join('/');
  console.log(`${got === '1000/500/750' ? 'ok' : 'MISMATCH'} T-1740 default milli-slots | ${SCH} | ${got} | 1000/500/750`); }
// T-1738: the parser's own defaults through readHostPools (pure)
{ try { const { readHostPools } = await import(`${W}/hub/src/host/transport-config.ts`);
    const h = readHostPools({ agents: { provider: 'fake' }, qa: { provider: 'fake', size: 's-2vcpu-4gb' } });
    const a = h.pools.agents, q = h.pools.qa;
    const got = [a.slots, a.minHosts, a.maxHosts, a.idleStop, a.spread, a.size, a.region, q.slots, q.minHosts, h.dailySpendUsd, h.leaseMs].join(' ');
    const want = '8 1 2 20m false s-4vcpu-8gb lon1 4 0 3 43200000';
    console.log(`${got === want ? 'ok' : 'MISMATCH'} T-1738 parsed defaults | hub/src/host/pools.ts | ${got} | ${want}`);
  } catch (e) { console.log(`MISMATCH T-1738 parsed defaults | hub/src/host/pools.ts | ${e.message} | parsed`); } }
JS
node --check "$Q/src.mjs" && echo "src checked"
```

The check functions for QA's own shell, and the scratch functions (body.sh sources `helpers.sh` and this `scratch.sh`):

```sh
cat > "$Q/checks.sh" <<'SH'
landing() { git -C "$W" log --first-parent --format=%H --grep "^Item: $1\$" "$S"; }
# preserved: test files the items name for preservation, which no stage-1 landing may edit
preserved() { printf '%s\n' hub/test/executor-spend.test.ts hub/test/suite-accounting.test.ts hub/test/state-paths.test.ts hub/test/executor-safety.test.ts hub/test/host-create-ready.test.ts hub/test/host-destroy.test.ts hub/test/host-provision-records.test.ts hub/test/host-destroy-native.test.ts hub/test/host-runtime-owner.test.ts hub/test/host-ssh-registry.test.ts hub/test/session-host-placement.test.ts hub/test/roles-editor.test.ts hub/test/roles-template.test.ts hub/test/roles-launch-permissions.test.ts hub/test/startup-cleanup.test.ts hub/test/cli-help.test.ts; }
MEMBERS="T-1738 T-1739 T-1740 T-1737 T-1741 T-1742"
s00() {   # build, plan and landing receipts
  echo "PRE HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) request $S"
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
  git -C "$R" status --porcelain | grep -v ' \.cland/tasks/' > "$EV/root-status-before.txt"; echo "root non-tracker entries $(wc -l < "$EV/root-status-before.txt" | tr -d ' ')"
  (cd "$R" && node "$W/hub/bin/cland.ts" task plan show E-1534 --json) > "$EV/plan.json"; echo "plan read exit $?"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=(v.stages??[]).find(x=>x.name==="pool config, role placement, placement core, memory floor and ledger categories");console.log(s?JSON.stringify({name:s.name,state:s.state,qa:s.qa,items:s.items,merged:s.merged,total:s.total,statuses:s.statuses}):"stage missing")' "$EV/plan.json" | tee "$EV/stage-members.json"
  for id in $(node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log((v.items??[]).join(" "))' "$EV/stage-members.json"); do echo "$id landings $(landing "$id" | wc -l | tr -d ' ') $(landing "$id" | head -n 1)"; done
}
s01() { node "$Q/fresh.mjs" "$W" plain node --version; node "$Q/fresh.mjs" "$W" plain npm run typecheck > "$EV/typecheck.log" 2>&1; echo "typecheck exit $?"; echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"; }
s02() {   # landing diffs (read-only)
  for id in $MEMBERS; do L=$(landing "$id" | head -n 1); echo "$id landing ${L:-none}"; [ -n "$L" ] || continue
    echo "$id test paths: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- hub/test | tr '\n' ' ')"
    echo "$id product paths: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- hub/src shared | tr '\n' ' ')"
    echo "$id package.json and lockfiles: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- package.json package-lock.json hub/package.json web/package.json | wc -l | tr -d ' ')"
    echo "$id preserved files edited at its landing: [$(git -C "$W" diff --name-only "${L}^1" "${L}" -- $(preserved) | tr '\n' ' ')]"
  done
  echo "commits after d87501912 touching preserved files: [$(git -C "$W" log --format=%h d875019127a99729ef1ead76f4bdebc602b36dc4.."$S" -- $(preserved) | tr '\n' ' ')]"
  F41="hub/test/host-memory.test.ts hub/test/host-agent.test.ts hub/test/host-agent-client.test.ts hub/test/claude-code-remote.test.ts hub/test/ssh-host-fixture.ts shared/fake-host-machine.ts hub/src/host/agent/memory.ts"
  echo "T-1741 files byte-identical to 0b2a3f8f: $(git -C "$W" diff --quiet 0b2a3f8f759baca1a9c5d60102a378bf1d4021ab "$S" -- $F41 && echo yes || echo "no: $(git -C "$W" diff --name-only 0b2a3f8f759baca1a9c5d60102a378bf1d4021ab "$S" -- $F41 | tr '\n' ' ')")"
}
s58() {   # end check with $Q and $T still present (the stage-3 cleanup correction)
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
# hcfg: the parsed hosts table of p1's config.toml through the build's own parser (pure; prints facts only)
hcfg() { node --input-type=module -e 'const {parseConfig}=await import(process.env.QA_W+"/hub/src/init/config.ts");const fs=await import("node:fs");const h=parseConfig(fs.readFileSync(".cland/config.toml","utf8"),"",{}).hosts;console.log("  hosts: daily_spend_usd "+h.dailySpendUsd+"; lease "+h.lease+"; pools ["+Object.keys(h.pools).sort().join(",")+"]; harness pins "+JSON.stringify(h.harnesses));for(const [n,p] of Object.entries(h.pools))console.log("  pool "+n+": provider "+p.provider+" size "+p.size+" region "+p.region+" transport "+p.transport+" slots "+p.slots+" min_hosts "+p.minHosts+" max_hosts "+p.maxHosts+" idle_stop "+p.idleStop+" spread "+p.spread)' 2>&1; }
# swap <old> <new>: replace exactly one occurrence in p1's config.toml, or refuse
swap() { node -e 'const fs=require("fs"),f=".cland/config.toml",t=fs.readFileSync(f,"utf8"),[a,b]=process.argv.slice(1);if(t.split(a).length!==2){console.log("swap refused: not exactly one "+JSON.stringify(a));process.exit(1)}fs.writeFileSync(f,t.replace(a,b));console.log("swapped "+JSON.stringify(a))' "$1" "$2"; }
p50() {   # T-1738 C5: init writes [hosts] with its defaults and no pool
  echo "PRE p1 entries $(ls -A "$QA_Q/p1" | wc -l | tr -d ' ')"
  cd "$QA_Q/p1" || return 1
  git init -q -b dev && git commit -q --allow-empty -m init; echo "git exit $?"
  cland init . > "$QA_EV/E1534S1-50-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1; echo "hub after init and stop: $(up)"
  echo "  [hosts] tables $(cnt .cland/config.toml '[hosts]'); pool tables $(cnt .cland/config.toml '[hosts.'); defaults block $(cnt .cland/config.toml "$(printf '[hosts]\ndaily_spend_usd = 3\nlease = "12h"')")"
  hcfg
}
p51() {   # T-1738 C5: update adds the hosts defaults to an older managed config, keeping its pool and pins
  cd "$QA_Q/p1" || return 1
  swap "$(printf '[hosts]\ndaily_spend_usd = 3\nlease = "12h"\n')" "$(printf '[hosts]\nharnesses = { codex = "1.0.0" }\n[hosts.qa]\nprovider = "fake"\n')" || return 1
  echo "  older form: daily_spend_usd $(cnt .cland/config.toml 'daily_spend_usd'); lease $(cnt .cland/config.toml 'lease ='); [hosts.qa] $(cnt .cland/config.toml '[hosts.qa]')"
  run "(update)" cland update .
  echo "  after update: daily_spend_usd lines $(cnt .cland/config.toml 'daily_spend_usd = 3'); lease lines $(cnt .cland/config.toml 'lease = "12h"'); [hosts.qa] $(cnt .cland/config.toml '[hosts.qa]'); pin lines $(cnt .cland/config.toml '"1.0.0"')"
  hcfg
}
p52() {   # T-1738 C2, C6: a pool through provider first, then max_hosts 4 applies now on the same hub
  cd "$QA_Q/p1" || return 1
  hubstart; echo "hub start exit $?; hub $(up)"; P1=$(hp)
  run "(provider)" cland config set hosts.agents.provider fake
  echo "  applies-now lines $(has 'applies now')"; hcfg
  run "(max_hosts 4)" cland config set hosts.agents.max_hosts 4
  echo "  applies-now lines $(has 'applies now'); hub pid unchanged $([ "$(hp)" = "$P1" ] && echo yes || echo no); hub $(up)"; hcfg
}
p53() {   # T-1738 C7, C4: config set refuses an unknown pool key, an invalid pool name and a short lease, file unchanged
  cd "$QA_Q/p1" || return 1
  before=$(dg .cland/config.toml)
  run "(unknown pool key)" cland config set hosts.qa.typo fake
  echo "  allowed-keys lines $(has 'provider'); slots named $(has 'slots')"
  run "(invalid pool name)" cland config set hosts.bad_name.provider fake
  echo "  grammar lines $(has 'letters, digits and hyphens')"
  run "(short lease)" cland config set hosts.lease 29s
  echo "  hosts.lease lines $(has 'hosts.lease')"
  echo "  config unchanged $([ "$(dg .cland/config.toml)" = "$before" ] && echo yes || echo no)"
}
p54() {   # T-1738 C2, C4: a pool without provider and a lease under 30 s are refused at config read (the hub refuses to start)
  cd "$QA_Q/p1" || return 1
  cland hub stop > /dev/null 2>&1; echo "hub after stop: $(up)"; cp .cland/config.toml "$QA_Q/config.before-p54"
  printf '%s\n' '' '[hosts.bare]' 'size = "s-2vcpu-4gb"' >> .cland/config.toml
  hubstart; echo "(bare pool) hub start exit $?; hub $(up); provider-key lines $(cnt "$QA_Q/hubstart.out" 'hosts.bare.provider')"; cland hub stop > /dev/null 2>&1
  cp "$QA_Q/config.before-p54" .cland/config.toml
  swap 'lease = "12h"' 'lease = "29s"' || return 1
  hubstart; echo "(short lease) hub start exit $?; hub $(up); lease-key lines $(cnt "$QA_Q/hubstart.out" 'hosts.lease')"; cland hub stop > /dev/null 2>&1
  cp "$QA_Q/config.before-p54" .cland/config.toml; echo "config restored $([ "$(dg .cland/config.toml)" = "$(dg "$QA_Q/config.before-p54")" ] && echo yes || echo no)"
  hubstart; echo "hub start exit $?; hub $(up)"
}
p55() {   # T-1739 C1, C2, C4: the role CLI shows and writes the pool; a Coordinator bound to a pool is refused, file unchanged
  cd "$QA_Q/p1" || return 1
  run "(launch help)" cland role launch --help
  echo "  --pool lines $(has '--pool')"
  run "(implementer pool)" cland role launch implementer --pool agents --json
  node -e 'try{const v=JSON.parse(require("fs").readFileSync(process.env.QA_Q+"/r.out","utf8"));console.log("  json launch.pool "+v.launch?.pool)}catch{console.log("  json: not JSON")}'
  run "(role list)" cland role list
  echo "  implementer pool agents lines $(node -e 'const t=require("fs").readFileSync(process.env.QA_Q+"/r.out","utf8");console.log(t.split("\n").filter(l=>/Implementer/.test(l)&&l.includes("pool agents")).length)'); coordinator pool local lines $(node -e 'const t=require("fs").readFileSync(process.env.QA_Q+"/r.out","utf8");console.log(t.split("\n").filter(l=>/Coordinator/.test(l)&&l.includes("pool local")).length)')"
  before=$(dg .cland/roles.toml)
  run "(coordinator pool)" cland role launch coordinator --pool agents
  echo "  local-only lines $(has 'Coordinator and Aide roles run only on the local host'); roles.toml unchanged $([ "$(dg .cland/roles.toml)" = "$before" ] && echo yes || echo no)"
}
p56() {   # T-1739 C3: a roles.toml binding the Coordinator to a pool is refused at load; the last good roles stay
  cd "$QA_Q/p1" || return 1
  cp .cland/roles.toml "$QA_Q/roles.before-p56"
  node -e 'const fs=require("fs"),f=".cland/roles.toml",t=fs.readFileSync(f,"utf8");const h="[coordinator.launch]\n";const n=t.split(h).length-1;if(n>1){console.log("roles edit refused: "+n+" coordinator.launch tables");process.exit(1)}fs.writeFileSync(f,n===1?t.replace(h,h+"pool = \"agents\"\n"):t+"\n[coordinator.launch]\npool = \"agents\"\n");console.log("coordinator bound to agents ("+(n===1?"existing table":"new table")+")")' || return 1
  run "(hub reload)" cland hub reload
  echo "  local-only lines $(has 'Coordinator and Aide roles run only on the local host'); exact line $(has "cland: $(pwd -P)/.cland/roles.toml: Coordinator and Aide roles run only on the local host"); config-reloaded lines $(has 'config reloaded:')"
  run "(role list after the refused edit)" cland role list
  echo "  coordinator pool local lines $(node -e 'const t=require("fs").readFileSync(process.env.QA_Q+"/r.out","utf8");console.log(t.split("\n").filter(l=>/Coordinator/.test(l)&&l.includes("pool local")).length)'); implementer pool agents lines $(node -e 'const t=require("fs").readFileSync(process.env.QA_Q+"/r.out","utf8");console.log(t.split("\n").filter(l=>/Implementer/.test(l)&&l.includes("pool agents")).length)')"
  cp "$QA_Q/roles.before-p56" .cland/roles.toml; run "(hub reload after restore)" cland hub reload
}
pm() {   # T-1741 C2, C3 on the real CLI: a created fake host set to 1.2 GB refuses a launch with the typed text; at the floor the memory check passes
  cd "$QA_Q/p1" || return 1
  for kv in "hosts.ram.provider fake" "hosts.ram.size fake" "hosts.ram.slots 8" "hosts.ram.region fake-1"; do run "(config set ${kv%% *})" cland config set $kv; done
  echo "  $(hcfg | grep 'pool ram:' | sed 's/^ *//')"
  run "(prepare ram)" cland host prepare ram; echo "  prepared lines $(has 'ram: prepared')"
  run "(create ram)" cland host create ram; echo "  ready state lines $(has '"state": "ready"')"
  run "(list)" cland host list
  node -e 'const fs=require("fs"),q=process.env.QA_Q;let v=[];try{v=JSON.parse(fs.readFileSync(q+"/r.out","utf8"))}catch{}const r=v.filter(x=>x.pool==="ram"&&x.state==="ready");console.log("  ready ram rows "+r.length);if(r.length===1){fs.writeFileSync(q+"/ram.id",r[0].id);fs.writeFileSync(q+"/ram.machine",r[0].machine.id)}'
  [ -s "$QA_Q/ram.machine" ] || { echo "  no ready ram host"; return 1; }
  readlink "$QA_Q/fh/.fixture-sockets/alias" > "$QA_Q/alias.txt" 2> /dev/null; echo "  alias recorded: $(cat "$QA_Q/alias.txt")"
  M=$(cat "$QA_Q/ram.machine"); ID=$(cat "$QA_Q/ram.id"); D=$QA_Q/fh/.fixture-sockets/$M; H=$(hd "$M")/home
  echo "  seeded override: $(cat "$D/available-memory" 2> /dev/null || echo absent)"
  printf '{"availableBytes":1200000000}' > "$D/available-memory"
  run "(launch below the floor)" node "$QA_Q/frame.mjs" "{\"type\":\"session.launch\",\"name\":\"mem-low\",\"harness\":\"opencode\",\"model\":\"opencode/fake-paid\",\"host\":\"$ID\",\"cwd\":\"$H\"}" 120000
  echo "  ok lines $(has '"ok":true'); floor lines $(has 'available memory 1200000000 bytes is below floor 1300000000 bytes'); not-answered lines $(has 'did not answer')"
  printf '{"availableBytes":1300000000}' > "$D/available-memory"
  run "(launch at the floor)" node "$QA_Q/frame.mjs" "{\"type\":\"session.launch\",\"name\":\"mem-floor\",\"harness\":\"opencode\",\"model\":\"opencode/fake-paid\",\"host\":\"$ID\",\"cwd\":\"$H\"}" 120000
  echo "  floor lines $(has 'below floor')"
  run "(destroy ram)" cland host destroy "$ID"; echo "  destroyed state lines $(has '"state": "destroyed"')"
}
p57() {   # cleanup census: the scratch hub stopped; nothing names the scratch root or this build
  cd "$QA_Q/p1" || return 1
  cland hub stop > /dev/null 2>&1; echo "hub stop exit $?; hub $(up)"
  for p in $(sort -u "$QA_Q/pids"); do echo "recorded pid $p alive $(alive "$p")"; done
  node -e 'const {execFileSync}=require("child_process");const rows=execFileSync("ps",["-axo","pid=,ppid=,command="],{encoding:"utf8"}).split("\n").filter(Boolean).map(l=>{const m=/^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(l);return {pid:+m[1],ppid:+m[2],cmd:m[3]}});const by=new Map(rows.map(r=>[r.pid,r]));const anc=new Set();let p=process.pid;while(p&&by.has(p)&&!anc.has(p)){anc.add(p);p=by.get(p).ppid}const A=process.argv[1]||"";const hits=rows.filter(r=>!anc.has(r.pid)&&(r.cmd.includes(process.env.QA_Q)||r.cmd.includes(process.env.QA_W+"/")||(A&&r.cmd.includes(A))));console.log("processes naming the scratch root, the alias or this build: "+hits.length);for(const h of hits)console.log("  survivor "+h.pid+" "+h.cmd.slice(0,160))' "$(cat "$QA_Q/alias.txt" 2> /dev/null)"
}
SH
. "$Q/checks.sh"; bash -n "$Q/scratch.sh" && echo "scratch checked"
```

Expected: `expect checked`, `src checked`, `scratch checked`. Record the setup in `S0`.

**Cleanup, in this order (the stage-3 cleanup correction).** Step 1, after E1534S1-57 passes: print the alias in `$Q/alias.txt`, check it is a symlink named `/private/tmp/ct-` plus 32 hex resolving into `$Q/fh/.fixture-sockets`, and remove that symlink by its literal path; remove each known dead T-1676 residue entry in `$T` by its literal path, as "Carried corrections" allows. Step 2: run and record E1534S1-58 with `$Q` and `$T` still present. Step 3, after the verdict: print `$Q` and check it begins with `/private/tmp/q53-`, then remove it by that literal path with a non-force recursive remove; print `$T`, check it begins with `/private/tmp/qa-e1533-s3-` and holds nothing but `node-compile-cache`, and remove it by that literal path; remove the worktree with `git -C "$R" worktree remove "$W"` (its `node_modules` symlink first if Git refuses). Secrets in `$Q/p1/.cland/hub.json` and `$Q/p1/.cland/secret` are never printed or posted.

## Cases

Every case is one or more named test files run once at the build, from QA's own shell through `nt` (or `pl` for T3 and native files, under the preservation lock), recorded with `qa-record.sh note` (surface `hub-api`), its evidence `$EV/<id>.log`, `$EV/<id>.check.txt` and `$EV/<id>.tmpdir.txt`. A case passes only when every check line reads `CLEAN` (exit 0; `fail`, `cancelled`, `skipped` and `todo` 0; `pass` equal to `tests`; every listed name `ok`; for an `exact` list, the plan equal to the list and no unlisted name). A missing file is a FAIL naming the file. A `fresh: BLOCKED` line makes the row BLOCKED. Run in table order; never two files at once.

| case | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1534S1-10 | hub-api | QA | `nt E1534S1-10 hub/test/host-scheduler.test.ts` | `CLEAN` with the exact list (T-1740 C1 to C5; T1; VERIFIED at dev). Test `default weights fill eight slots with Claude Code or mixed Codex sessions` (defaults derived as 1000/500/750 and asserted; eight Claude Code fill 8000; seven plus two Codex fill exactly 8000; seven plus one Codex refuse OpenCode); test `accumulated fractional weights fill eight slots exactly`; test `fractional overrides convert once to milli-slots and reject one milli excess`; test `used and promised milli-slots share capacity and affect dense packing` |
| E1534S1-11 | hub-api | QA | `nt E1534S1-11 hub/test/roles-harnesses.test.ts` | `CLEAN` with every listed name (T-1739 C1, C3; T1). Test `role pools default to local and accept named pools for built-in and custom workers`; test `role pool validation shares pool-name syntax and the local-only role policy` |
| E1534S1-12 | hub-api | QA | `nt E1534S1-12 hub/test/roles-snapshot.test.ts` | `CLEAN` with every listed name (T-1739 C3; T2). Test `invalid Coordinator and Aide pools retain the last good role snapshot and loaded pools` (`launchError` names `Coordinator and Aide roles run only on the local host`; the good snapshot and the `roles-loaded` pools stay) |
| E1534S1-13 | hub-api | QA | `nt E1534S1-13 hub/test/role-launch.test.ts` | `CLEAN` with every listed name (T-1739 C2, C4; T2). Test `role launch pool CLI writes a named pool and help advertises it` (JSON `launch.pool` `agents`, `pool = "agents"` in the file, `--pool` in the help, `role list` `Implementer … pool agents`); the `coordinator` and `aide` expansions of `role launch pool refuses remote <role> without writing` (exit 1, the local-only text, file unchanged) |
| E1534S1-14 | hub-api | QA | `nt E1534S1-14 hub/test/roles-component.test.ts hub/test/cli.test.ts` | Both `CLEAN` (T-1739's consumer migrations: whole launch-default objects now carry `pool: local`; no title changed) |
| E1534S1-15 | hub-api | QA | `nt E1534S1-15 hub/test/session-host-placement.test.ts hub/test/roles-editor.test.ts hub/test/roles-template.test.ts hub/test/roles-launch-permissions.test.ts` | Each `CLEAN`, unedited (T-1739 importer preservation: launch placement, the roles editor and template, launch permissions) |
| E1534S1-16 | hub-api | QA | `pl E1534S1-16 nvim/test/qa.test.ts` | `CLEAN`, the whole file, with no skip (T-1739 importer; T3, headless Neovim from the repository's pinned cache, as `nvim/bin/nvim-path.ts` resolves it in a linked worktree). T-1759 (`82bd5c3fc`) added `pool: 'local'` to its roles fixture after T-1739's batch left it red; a red `ROLES` deep-equal here is a regression of T-1759. A `skip` (no pinned Neovim) is BLOCKED, not PASS |
| E1534S1-17 | hub-api | QA | `pl E1534S1-17 hub/test/host-agent.test.ts` | `CLEAN` with every listed name, the whole file (T-1741 C1, C2, C4; T3; VERIFIED-on-branch). Test `memory floor refuses direct and prepared spawn, reports fake bytes and admits the exact floor` (the fake `available-memory` file at 1.2 GB refuses both spawn paths with `memory-floor` and the bytes; the `memory` event reports them; 1300000000 admits); test `memory override is ignored without the fake-host marker and malformed fake bytes refuse`; test `memory fixture drains accepted server after failed client setup before removing its root` |
| E1534S1-18 | hub-api | QA | `pl E1534S1-18 hub/test/claude-code-remote.test.ts` | `CLEAN` with every listed name, the whole file (T-1741 C3 and the one admission point for Claude's run-command path; T3; VERIFIED-on-branch). Test `remote Claude memory floor refuses actual launchClaude with no process then admits exact floor` (launch error `available memory 1200000000 bytes`; zero `--bg` calls; empty `processes.json`; `nativeLaunchClaude` rejects with `code` `memory-floor`, `host` `f1`, `availableBytes` 1200000000; at 1300000000 a frame launch succeeds with a durable native worker, then stops) |
| E1534S1-19 | hub-api | QA | `nt E1534S1-19 hub/test/host-agent-client.test.ts` | `CLEAN`, the whole file (T-1741 C3: the agent client keeps a reply's typed `code` and bytes, and a plain spawn failure carries no `code`; T2; title unchanged) |
| E1534S1-20 | hub-api | QA | `nt E1534S1-20 hub/test/host-spend.test.ts` | `CLEAN` with the exact list (T-1742 C1 to C4; T1; every case on an isolated `XDG_STATE_HOME`). Test `host reservation preserves previous v1 settlements and legacy reconciliation`; test `host and executor admissions share the cap while hosts also obey their own cap`; test `renewal raises the held lifetime and settlement bills actual lifetime with a minimum`; test `settled UTC totals separate days, months and pools while pending costs stay excluded`; the `native` and `shard` expansions of `<mode> host lease conflict refuses admission without changing durable accounting` |
| E1534S1-21 | hub-api | QA | `nt E1534S1-21 hub/test/executor-spend.test.ts` | `CLEAN`, the whole file, unedited (T-1742 C5) |
| E1534S1-22 | hub-api | QA | `nt E1534S1-22 hub/test/suite-accounting.test.ts hub/test/state-paths.test.ts` | Both `CLEAN`, unedited (T-1742 C5: spend importers in the suite accounting and the per-user state inventory) |
| E1534S1-24 | hub-api | QA | `pl E1534S1-24 hub/test/executor-safety.test.ts` | `CLEAN`, the whole file, unedited, nested `shell` and `host` subtests included (T-1742 C5: the executor's reservation lock and sentinel paths over the categorized ledger) |
| E1534S1-25 | hub-api | QA | `pl E1534S1-25 hub/test/host-provision-gate.test.ts` | `CLEAN` with the exact list (T-1737 C1 to C3; T3, `createHost` runs `ssh-keygen`; migrated by T-1738's integration `72d21ebc6` to required `slots` and `readHostPools`-built settings, titles unchanged). Test `never-booting creation releases at exactly 300000 ms on the hub clock` (fake clock, no real wait, machine released); test `tunnel readiness expires at exactly 300000 ms on its injected clock`; test `settings entry publishes durable creating id before held acquisition completes` |
| E1534S1-26 | hub-api | QA | `nt E1534S1-26 hub/test/host-create-entry.test.ts` | `CLEAN` with the exact list (T-1737 C3; T2). Test `hub create entry passes its clock and owner to the injected create path` |
| E1534S1-27 | hub-api | QA | `nt E1534S1-27 hub/test/host-readiness-owner.test.ts` | `CLEAN` with the exact list (T-1737 C2 and its review fix; T2): the `close` and `remove` expansions of `owner <action> drains down-tunnel readiness without advancing time` |
| E1534S1-28 | hub-api | QA | `pl E1534S1-28 hub/test/host-create-ready.test.ts` | `CLEAN`, the whole file, unedited by T-1737 (T-1737 C4; T-1738 C8; T3). T-1738 edits its fixture `hub/test/host-create-fixture.ts` (explicit `slots` for custom sizes) |
| E1534S1-29 | hub-api | QA | `nt E1534S1-29 hub/test/host-destroy.test.ts hub/test/host-provision-records.test.ts` | Both `CLEAN`, unedited (T-1737 C4) |
| E1534S1-31 | hub-api | QA | `pl E1534S1-31 hub/test/host-destroy-native.test.ts` | `CLEAN`, the whole file, unedited (T-1737 importer, T3) |
| E1534S1-32 | hub-api | QA | `nt E1534S1-32 hub/test/host-runtime-owner.test.ts hub/test/host-ssh-registry.test.ts` | Both `CLEAN`, unedited (T-1737's registry readiness change: the owner and registry importers) |
| E1534S1-34 | hub-api | QA | `nt E1534S1-34 hub/test/host-pools-config.test.ts` | `CLEAN` with the exact list (T-1738 C1 to C5; T1). Test `host pools default capacity, agent minimum and global policy` (`agents`: `s-4vcpu-8gb`, `lon1`, `ssh`, slots 8, `min_hosts` 1, `max_hosts` 2, `20m`, spread false; `qa` on `s-2vcpu-4gb`: slots 4, `min_hosts` 0; daily spend 3; lease 43200000 ms); the nine `host pool refuses invalid <key> naming its key` and four `hosts refuses invalid <key> naming its key` expansions (each refusal matches `hosts.qa.<key>` or `hosts.<key>`); test `required provider, custom size slots, lease boundary and explicit overrides` (`hosts.qa.provider`, `hosts.qa.slots`, 30 s accepted, `min_hosts` above `max_hosts` refused) |
| E1534S1-35 | hub-api | QA | `nt E1534S1-35 hub/test/config-set.test.ts` | `CLEAN` with every listed name (T-1738 C2, C6, C7; T2). Test `config set creates pools through provider and publishes capacity immediately` (`applies now` twice and for `max_hosts 4`; saved 4; `hosts.qa.typo` refused naming `provider … size … slots`; `hosts.bad_name.provider` naming the grammar); test `host policy errors refuse startup rather than loading whole-config defaults`; test `config set replaces subset and empty host weights and harness pin tables` |
| E1534S1-36 | hub-api | QA | `nt E1534S1-36 hub/test/config-reload-component.test.ts` | `CLEAN` with every listed name (T-1738 C6; T2). Test `pool settings publish the new capacity on the running configuration owner` (`applies` `now`; published `[2, 4]`; weights and pins replaced exactly) |
| E1534S1-37 | hub-api | QA | `nt E1534S1-37 hub/test/init-config.test.ts` | `CLEAN` with every listed name (T-1738 C5; T1). Test `managed init and update add hosts defaults without a pool and keep pins` (init `hosts` exactly `{ daily_spend_usd: 3, lease: '12h' }`; update keeps `qa` and `codex` `1.2.3`) |
| E1534S1-38 | hub-api | QA | `nt E1534S1-38 hub/test/transport-config.test.ts` | `CLEAN` with every listed name (T-1738 C1; T2). The dev case on omitted transport and malformed non-transport keys (which accepted them) is replaced by test `malformed non-transport hosts keys are refused by project config` (the stricter parser); test `quoted empty pool transport is refused at startup` |
| E1534S1-39 | hub-api | QA | `nt E1534S1-39 hub/test/host-prepare.test.ts hub/test/host-create-admission.test.ts` | Both `CLEAN` with every listed name (T-1738 C8: fixtures gain explicit `slots`, no title changed; T2) |
| E1534S1-41 | hub-api | QA | `nt E1534S1-41 hub/test/host-provision-recovery.test.ts hub/test/host-provider-digitalocean-prepare.test.ts` | Both `CLEAN` (T-1738 C8: fixture `slots` only, no title changed; T2) |
| E1534S1-43 | hub-api | QA | `nt E1534S1-43 hub/test/setup-accounts.test.ts hub/test/setup-flow.test.ts` | Both `CLEAN` (T-1738's managed-config writers in setup; fixture edits only, no title changed; T1) |
| E1534S1-45 | hub-api | QA | `nt E1534S1-45 hub/test/cli-help.test.ts` | `CLEAN` with every listed name, the test file unedited (T-1738 `CONFIG_USAGE` three hosts lines; T-1739 `ROLE_USAGE` `--pool`): `cland --help` equals the merged frozen fixture `hub/test/fixtures/cli-usage/commands.json` |
| E1534S1-46 | hub-api | QA | `pl E1534S1-46 hub/test/host-ssh-contract.test.ts` | `CLEAN`, the whole file, unedited by T-1741, run **alone** in its own row (T-1741's typed refusal in `ssh-host.ts` must keep the shared Host contract; fake hosts now carry the 8 GiB seed; T-1731 is its known mix-only flake, see "Carried corrections") |
| E1534S1-47 | hub-api | QA | `nt E1534S1-47 hub/test/startup-cleanup.test.ts` | `CLEAN`, unedited (T-1738 changes the daemon's config startup refusal; a T2 daemon importer) |
| E1534S1-48 | hub-api | QA | `nt E1534S1-48 hub/test/host-memory.test.ts` | `CLEAN` with the exact list (T-1741 C1; T2, injected reader, no process, socket or wall-clock wait; VERIFIED-on-branch). Test `launch memory policy refuses below floor, admits exact floor and unknown non-Linux memory` (1200000000 and 1299999999 refused as `MemoryFloorRefusal` with `floorBytes` 1300000000; 1300000000 and 1400000000 admitted; a `null` reading, the non-Linux case without an override, admitted) |
| E1534S1-49 | hub-api | QA | `nt E1534S1-49 hub/test/test-docs.test.ts hub/test/suite-tiers.test.ts` | Both `CLEAN`: every new stage test file is in `hub/test/tiers.json` with a guide under `docs/agents/tests/` (`host-scheduler` T1, `host-spend` T1, `host-provision-gate` T3, `host-create-entry` T2, `host-readiness-owner` T2, `host-pools-config` T1 at dev; `host-memory` T2 at T-1741's head) |

### Web cases (when in scope)

none. The stage changes the wire's role list additively (`shared/wire/index.ts`) but no web surface; no browser runs.

## Manual checks

Run in table order: E1534S1-00 to E1534S1-03 before the cases, E1534S1-50 to E1534S1-58 after them. Scratch rows depend on the state the rows before them leave; a row whose prerequisite failed is BLOCKED, naming it. Record each with `sh .agents/skills/qa/qa-record.sh note E-1534 "$RUN" <id> hub-api "<the command you ran>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence file>` from `$W`. Every scratch row's evidence begins with the kit's `PRE gate` line (`credential-prefix names 0`, `QA_SESSION set yes`, HOME, TMPDIR, fake host root, ssh, scp and npm `yes`) and ends with `# fresh: redacted or withheld lines 0` and `row exit 0`; a gate refusal is BLOCKED.

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1534S1-00 | hub-api | QA | `s00 > "$EV/E1534S1-00.txt" 2>&1` | PRE line: HEAD, dev and request the same 40 hex; `dirty entries 0`; root non-tracker count recorded. `plan read exit 0`; the stage line: exact name, `qa` `{"scope":"affected","when":"after-stage"}`, `items` T-1738, T-1739, T-1740, T-1737, T-1741, T-1742 plus any finding fixes the request names, `merged` equal to `total`, `state` not `closed`. Every member `landings 1`; anything else is BLOCKED |
| E1534S1-01 | hub-api | QA | `s01 > "$EV/E1534S1-01.txt" 2>&1` | Node 24; `typecheck exit 0` (the integrated build, including the merged `commands.json` fixture and T-1737/T-1738's shared `readHostPools` caller in `createHost`); `dirty entries 0` |
| E1534S1-02 | hub-api | QA | `s02 > "$EV/E1534S1-02.txt" 2>&1` | Every landing `package.json and lockfiles: 0`; `preserved files edited at its landing: []` for every landing; `commits after d87501912 touching preserved files: []` (a non-empty list is read before judging); **Landing check:** `T-1741 files byte-identical to 0b2a3f8f: yes` (a `no:` list is an expected-registration correction, see "Build"). Test paths per landing, against these sets (VERIFIED at the landings; T-1741 VERIFIED-on-branch; a landing may add `hub/test/durations.json`): T-1740 `hub/test/host-scheduler.test.ts hub/test/tiers.json`; T-1739 `hub/test/cli.test.ts hub/test/fixtures/cli-usage/commands.json hub/test/role-launch.test.ts hub/test/roles-component.test.ts hub/test/roles-harnesses.test.ts hub/test/roles-snapshot.test.ts`; T-1742 `hub/test/host-spend.test.ts hub/test/tiers.json`; T-1737 `hub/test/host-create-entry.test.ts hub/test/host-provision-gate.test.ts hub/test/host-readiness-owner.test.ts hub/test/tiers.json`; T-1738 `hub/test/config-preservation.ts hub/test/config-reload-component.test.ts hub/test/config-set.test.ts hub/test/digitalocean-pool-fixture.ts hub/test/durations.json hub/test/fixtures/cli-usage/commands.json hub/test/host-create-admission.test.ts hub/test/host-create-fixture.ts hub/test/host-pools-config.test.ts hub/test/host-prepare.test.ts hub/test/host-provider-digitalocean-prepare.test.ts hub/test/host-provision-gate.test.ts hub/test/host-provision-recovery.test.ts hub/test/init-config.test.ts hub/test/setup-accounts.test.ts hub/test/setup-flow.test.ts hub/test/tiers.json hub/test/transport-config.test.ts` (it carries the `host-provision-gate` migration); T-1741 `hub/test/claude-code-remote.test.ts hub/test/host-agent-client.test.ts hub/test/host-agent.test.ts hub/test/host-memory.test.ts hub/test/ssh-host-fixture.ts hub/test/tiers.json` (plus `shared/fake-host-machine.ts` under product paths) |
| E1534S1-03 | hub-api | QA | `node "$Q/src.mjs" "$W" > "$EV/E1534S1-03.txt" 2>&1` | Every line `ok`. T-1740: the default weights, one `Math.round(weight * 1000)`, integer capacity, and `default milli-slots 1000/500/750`. T-1738: the size table (4/8), the `agents` minimum, the defaults (`s-4vcpu-8gb`, `lon1`, `20m`, 3, `12h`), the 30 s lease minimum, `provider` required, the pool keys, and `parsed defaults 8 1 2 20m false s-4vcpu-8gb lon1 4 0 3 43200000`. T-1742: no category reads `verify`; host entries `hosts` with their pool; executor entries `verify`; the hosts and shared caps; version 1; the four host operations. T-1739: pool default `local` through `parsePoolName`, the load-time policy, the refusal text, the role list, `--pool` in usage. T-1737: `PROVISION_GATE_MS` unchanged, the gate on the hub clock, `onCreating`, `clockDelay`. T-1741 (VERIFIED-on-branch; `MISMATCH` until it lands): the 1,300,000,000-byte floor, the `memory-floor` code, refusal below the floor only, Linux `MemAvailable`, no verdict off Linux without an override, the override only under `CLAND_FAKE_HOSTS` from `available-memory` beside the boot id, the agent spawn and Claude run-command admissions, `HostMemoryFloorRefusal`, the 8 GiB seed. A `MISMATCH` is read at the build (a renamed string is followed); it is a FAIL unless the landing changed it with a recorded decision |
| E1534S1-50 | hub-api | Human | `mrow E1534S1-50 p50` | **T-1738 C5, init.** `PRE p1 entries 0`; `git exit 0`; `init exit 0`; `hub after init and stop: down`; `[hosts] tables 1; pool tables 0; defaults block 1`; `hosts: daily_spend_usd 3; lease 12h; pools []`. A failure makes E1534S1-51 to E1534S1-56 BLOCKED |
| E1534S1-51 | hub-api | Human | `mrow E1534S1-51 p51` | **T-1738 C5, update.** `swapped …`; `older form: daily_spend_usd 0; lease 0; [hosts.qa] 1`; `(update) exit 0`; `after update: daily_spend_usd lines 1; lease lines 1; [hosts.qa] 1; pin lines 1`; `hosts: daily_spend_usd 3; lease 12h; pools [qa]; harness pins {"codex":"1.0.0"}`; `pool qa: provider fake size s-4vcpu-8gb region lon1 transport ssh slots 8 min_hosts 0 max_hosts 2 idle_stop 20m spread false` |
| E1534S1-52 | hub-api | Human | `mrow E1534S1-52 p52` | **T-1738 C2, C3, C6.** `hub start exit 0; hub up`; `(provider) exit 0` with `applies-now lines` 1 or more; `pool agents: provider fake size s-4vcpu-8gb region lon1 transport ssh slots 8 min_hosts 1 max_hosts 2 idle_stop 20m spread false`; `(max_hosts 4) exit 0` with `applies-now lines` 1 or more; `hub pid unchanged yes; hub up`; `pool agents: … max_hosts 4 …`. The published value itself is E1534S1-36's (no CLI reads the published pools) |
| E1534S1-53 | hub-api | Human | `mrow E1534S1-53 p53` | **T-1738 C7, C4 through the CLI.** `(unknown pool key)` exit non-zero with `allowed-keys lines` and `slots named` 1 or more; `(invalid pool name)` exit non-zero with `grammar lines` 1 or more; `(short lease) exit 1` with no `out:` line and the one `err:` line exactly `cland: hosts.lease must be at least 30s` (`hosts.lease lines 1`; settled by the implementer's answer, the parser's text VERIFIED at dev); `config unchanged yes` |
| E1534S1-54 | hub-api | Human | `mrow E1534S1-54 p54` | **T-1738 C2, C4 at config read.** `hub after stop: down`; `(bare pool) hub start exit 1; hub down; provider-key lines` 1 or more (`hosts.bare.provider`); `swapped "lease = \"12h\""`; `(short lease) hub start exit 1; hub down; lease-key lines` 1 or more; `config restored yes`; the closing `hub start exit 0; hub up`. The key names reach the start output through its log tail (INFERRED; the hub log keeps them too) |
| E1534S1-55 | hub-api | Human | `mrow E1534S1-55 p55` | **T-1739 C1, C2, C4.** `(launch help)` with `--pool lines` 1 or more; `(implementer pool) exit 0`; `json launch.pool agents`; `(role list) exit 0` with `implementer pool agents lines 1` and `coordinator pool local lines 1`; `(coordinator pool) exit 1` with `local-only lines` 1 or more; `roles.toml unchanged yes` |
| E1534S1-56 | hub-api | Human | `mrow E1534S1-56 p56` | **T-1739 C3 at load.** `coordinator bound to agents (…)`; `(hub reload) exit 1` with no `out:` line and the one `err:` line exactly `cland: <p1's absolute root>/.cland/roles.toml: Coordinator and Aide roles run only on the local host` (`local-only lines 1; exact line 1; config-reloaded lines 0`; settled by the implementer's answer); `(role list after the refused edit) exit 0` with `coordinator pool local lines 1` and `implementer pool agents lines 1` (the last good roles stay); `(hub reload after restore) exit 0` |
| E1534S1-60 | hub-api | Human | `mrow E1534S1-60 pm` | **T-1741 C2, C3 on the real CLI (VERIFIED-on-branch strings; the scratch path is INFERRED).** The four `(config set …)` lines exit 0; `pool ram: provider fake size fake region fake-1 transport ssh slots 8 min_hosts 0 max_hosts 2 idle_stop 20m spread false`; `(prepare ram) exit 0`, `prepared lines 1`; `(create ram) exit 0`, `ready state lines` 1 or more; `ready ram rows 1`; an `alias recorded` `/private/tmp/ct-` path; `seeded override: {"availableBytes":8589934592}` (the shared creator's 8 GiB); `(launch below the floor)` with `ok lines 0` and `floor lines` 1 or more (the agent's `memory-floor` refusal through the ssh Host, `available memory 1200000000 bytes is below floor 1300000000 bytes`); `(launch at the floor)` with `floor lines 0` (the memory check admits it; the launch then fails its OpenCode readiness, because the fake OpenCode listens on TCP, as the E-1533 DoD's relay note explains; that outcome is recorded, not judged); `(destroy ram) exit 0` with `destroyed state lines` 1 or more. If the below-floor launch fails without a floor line (the agent did not see the fake-host marker), the row is BLOCKED, not FAIL, and C2/C3 rest on E1534S1-17 and E1534S1-18 |
| E1534S1-57 | hub-api | Human | `mrow E1534S1-57 p57` | `hub stop exit 0; hub down`; every recorded pid `alive no`; `processes naming the scratch root, the alias or this build: 0`. Expected survivors after E1534S1-60 (as the E-1533 DoD run saw): the destroyed fake host's `supervisor.sh` and host agent, whose commands lie under the alias or `$Q/fh` (a released fake machine is a directory, not a stopped computer): each is ended with `kill -TERM <pid>` after re-reading its command, recorded, and the row repeated, which must then print 0. Any other hit is a FINDING unless its command is unrelated (pid reuse, recorded). Then cleanup step 1 |
| E1534S1-58 | hub-api | QA | `s58 > "$EV/E1534S1-58.txt" 2>&1` (after cleanup step 1, with `$Q` and `$T` present) | HEAD, dev and request still the same 40 hex; `dirty entries 0`; `root non-tracker status unchanged: yes`; `preservation lock present: no`; `scratch fixture alias … gone`; `T entries other than node-compile-cache 0` after the T-1676 handling (each leftover with its type, open count and first file; live residue, or residue from a file a stage-1 landing changed outside the unchanged-producer clause, is a finding). A moved dev keeps the evidence and makes the run BLOCKED |

Before requesting QA, run `cland qa lint` with this filled brief at the build under test: from the root, `node hub/bin/cland.ts qa lint qa/briefs/E-1534-stage-1.md --commit <dev SHA>`, with a dev SHA that includes every stage landing. The brief is complete only when qa lint passes at the build.

## Probes that mislead

- **Generated names cannot be certified by `qa lint`.** Loop titles (`host pool refuses invalid <key> naming its key`, `hosts refuses invalid <key> naming its key`, `<mode> host lease conflict refuses …`, `owner <action> drains …`, `role launch pool refuses remote <role> without writing`) are expanded in `expect.json` and checked by `tap.mjs` at the run.
- **Never the user's spend ledger.** T-1742's files and every scratch command use `XDG_STATE_HOME` under their own roots (S0 prints `XDG_STATE_HOME is Q/state true`). Reading `~/.local/state/cland/spend.json` or `~/.cland` is out of bounds even to compare.
- **No CLI reads the published pools.** E1534S1-52 shows `applies now`, the same hub pid and the saved value; the published value is the configuration owner's, proven by E1534S1-36. A missing `applies now` is a FAIL; a restarted hub (pid changed) is a FAIL for C6.
- **A refused hub start is the pass in E1534S1-54.** The row restores the config by byte copy and restarts, so later rows see a running hub.
- **`roles.toml` edits are additions under an existing table.** E1534S1-56 inserts one `pool` key under `[coordinator.launch]` (or appends that table) and restores the file by byte copy.
- **The scheduler has no production caller yet** (T-1743): E1534S1-10 and E1534S1-03 are its only evidence here.
- **The memory floor needs no real memory pressure.** T-1741's tests use an injected reader or the fake host's `available-memory` file; E1534S1-60 writes that file. On this Mac with no override there is no reading at all (`null`) and every launch is admitted: a missing refusal off Linux without the file is the specified behaviour, not a finding. The floor is decimal (1,300,000,000 bytes), not 1.3 GiB.
- **The at-floor launch in E1534S1-60 fails later on purpose.** The fake OpenCode on a created host listens on TCP, which the fake `ssh` cannot forward (the E-1533 DoD's relay note); the row judges only that the memory check no longer refuses.
- **Plain `node --test` is not the suite runner.** It enforces no duration allowance and no resource tripwire preload: a slow pass is not a finding and a fast one proves no budget.
- Process cleanup probes use the fixture-owned pid census (`$Q/pids`) and the scratch-root census; a machine-wide `pgrep` counts other sessions too.
- File-change probes use isolation and digests; mtime alone is confounded by live sessions rewriting the same file.
- Speed criteria use measured wall times, never projections; T-1737's 300 000 ms is clock time on a fake clock, not wall time.
- Slots due or queued before the build count even when their results arrive later.
- "No skip" names platform-only cases: no listed file skips on macOS at writing.
- Re-check helper and function names with grep at the tested build; renames happen. The kits are pinned by blob; a different blob is a setup BLOCKED.

## Out of scope

- The real DigitalOcean API, droplets, volumes, keys, tokens and any network.
- Placement on pool hosts, waiting launches, scale up, lease and watchdog (stage 2: T-1743 to T-1748); idle stop, failures, restart, money, `host status` and DigitalOcean (stage 3).
- The scheduler's production caller and the pool's existence check at launch (T-1743).
- T-1731 and T-1758 as bugs (signatures only); T-1735 and T-1732 (fixed; a recurrence is a regression finding, not a flake); T-1736 (judged as it stands if it appears).
- Linux and container runs, the stage covers and the items' loaded repetitions: their evidence; this run is macOS only and says so.
- Duration allowances (`hub/test/durations.json`) as pass conditions.
- Any `cland config set`, `cland role launch`, `cland update`, `cland hub reload` or `cland host …` on the live project.

Missing authorization (a real provider token, a GUI) is out of scope, not BLOCKED, because no case needs one.

## Grants

none. No grant is needed: every case runs on this Mac against fakes with a disposable HOME and no credential.

## Rows to verify after landing

**Settle every line here at `<dev SHA>` before requesting QA; record each difference in the brief or the request.** VERIFIED = read at dev `5a359016d2860395373f840759aec83baa67bbde`. VERIFIED-on-branch = read at T-1741's head `0b2a3f8f759baca1a9c5d60102a378bf1d4021ab`, confirmed at the build by the Landing check. INFERRED = not proven by a read of the build.

**Settled by the landings (VERIFIED at dev `5a359016`; no longer open):** T-1740's exact list and conversions; T-1739's titles, role list and JSON output, usage and refusal text (its landed test bytes equal its head `5d25fee85`); T-1742's exact list and ledger strings (equal to `4ba7d8902`); T-1737's titles and clock strings (`host-provision-gate.test.ts` migrated by T-1738's `72d21ebc6`, titles unchanged); T-1738's titles, parser texts, init block and `CONFIG_USAGE` (its landing equals its final head `72d21ebc6`); the merged `commands.json`; E1534S1-53's short-lease refusal (`cland: hosts.lease must be at least 30s`, exit 1, empty stdout) and E1534S1-56's reload refusal (`cland: <root>/.cland/roles.toml: Coordinator and Aide roles run only on the local host`, exit 1, empty stdout, no `config reloaded:` line), both from the implementers' answers; T-1759's `nvim/test/qa.test.ts` fix (E1534S1-16); T-1735 and T-1732 fixed and retired as known flakes.

**VERIFIED-on-branch, T-1741 (`0b2a3f8f`, about to merge dev):** E1534S1-17, E1534S1-18, E1534S1-19 and E1534S1-48's titles (`host-memory` T2 new; `host-agent` T3 and `claude-code-remote` T3 edited; `host-agent-client` T2 edited, title unchanged); every T-1741 `src.mjs` string; the override file `available-memory` (JSON `{availableBytes:<integer>}`) beside the fake host's boot id, read only under `CLAND_FAKE_HOSTS`; the 8 GiB seed in `shared/fake-host-machine.ts`; `HostMemoryFloorRefusal`'s text and fields; `host-ssh-contract.test.ts` unedited. **Merge watch:** its pending dev merge may touch `hub/test/ssh-host-fixture.ts` or `shared/fake-host-machine.ts` (T-1735 changed the shared fake-host factory); the Landing check names any difference.

**INFERRED, with the reason:**

- E1534S1-60, the scratch memory floor: that the created host's agent sees `CLAND_FAKE_HOSTS` (the fake `ssh` passes it into the agent's environment, VERIFIED in `hub/test/fakes/fake-ssh.ts`; never run end to end on a CLI-started hub with the floor), and the OpenCode launch reply carrying the agent's refusal text through the frame (the text is VERIFIED-on-branch at the agent and the ssh Host; T-1741's own CLI-level test drives Claude Code). BLOCKED fallback as written.
- E1534S1-51: that `init` writes the exact defaults block once, so `swap` can replace it, and that `cland update` adds exactly one `daily_spend_usd = 3` and one `lease = "12h"`.
- E1534S1-54: the key names reaching `hub start`'s output through the start's 15-line log tail.
- E1534S1-16: a pinned Neovim present in the main worktree's cache (`.cache/nvim/<tag>/`) for the linked worktree; a skip is BLOCKED.

## Source provenance

VERIFIED = read in source at dev `5a359016d2860395373f840759aec83baa67bbde`; VERIFIED-on-branch = read at T-1741's head `0b2a3f8f759baca1a9c5d60102a378bf1d4021ab`; both re-read at the build.

- The kits: `qa/briefs/E-1532-stage-4.md` blob `4ed467672750bf34179ed72549df863d1541eddb`, lines 133 to 136 and 228 to 279; `qa/briefs/E-1533-stage-3.md` blob `997909c0c8ac8770cd879e0862816ca22743c939` (heredocs `seal.mjs`, `fresh.mjs`, `body.sh`, `helpers.sh`; `helpers.sh` provides `cland`, `hp`, `hubstart`, `up`, `run`, `has`, `cnt`, `there`, `dg`, `alive`); `qa/briefs/E-1533.md` blob `354c85e75bc341ba57c43c69d3a352001bd78842` (its run corrections); `fixtureEnvironment` sets `XDG_STATE_HOME` under the root (`test-support/fixture-environment.ts`).
- T-1740: `hub/src/host/scheduler.ts` (`DEFAULT_HOST_WEIGHTS`, `harnessWeightMilli`, `decidePlacement`); `hub/test/host-scheduler.test.ts` titles at 10, 24, 32, 45, 60, 70, 86, 100, 113; tier T1.
- T-1741 (VERIFIED-on-branch): `hub/src/host/agent/memory.ts` (`MEMORY_FLOOR_BYTES`, `MemoryFloorRefusal`, `availableMemory`, `requireSpawnMemory`), the admissions in `hub/src/host/agent/processes.ts` and `hub/src/host/agent/server.ts`, the memory event in `server.ts`, `HostMemoryFloorRefusal` in `hub/src/host/ssh-host.ts`, the typed reply fields in `hub/src/host/agent-client.ts` and `hub/src/host/agent/protocol.ts`, the Claude Code adapter's never-spawned settlement, the 8 GiB seed in `shared/fake-host-machine.ts`; `hub/test/host-memory.test.ts` title at 6; `host-agent.test.ts`, `claude-code-remote.test.ts`, `host-agent-client.test.ts` titles; tiers `host-memory` T2.
- Outside the stage, at dev: T-1759 `82bd5c3fc` (`nvim/test/qa.test.ts`, T3), T-1735 `7926f3203`, T-1732 `10b63fc8c`.
- Plan: stage 1 `open`, `{"scope":"affected","when":"after-stage"}`, items T-1738, T-1739, T-1740, T-1737, T-1741, T-1742; decisions A-17473 (10: renewal cadence and the 30 s lease minimum; 17: no ledger version bump; 20: the memory override on fake hosts) and 6e81c6b7 (integer milli-slots).
- Preservation tiers at dev: `executor-spend` T1, `suite-accounting` T2, `state-paths` T1, `executor-safety` T3, `host-create-ready` T3, `host-destroy` T2, `host-provision-records` T1, `host-destroy-native` T3, `host-runtime-owner` T2, `host-ssh-registry` T2, `session-host-placement` T2, `roles-editor` T1, `roles-template` T1, `roles-launch-permissions` T1, `startup-cleanup` T2, `cli-help` T2.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "pool config, role placement, placement core, memory floor and ledger categories"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Read the request's id and any earlier verdict's id from the epic topic's `history`, never from a `send` result (rule 22). Report `qa clear E-1534 stage pool config, role placement, placement core, memory floor and ledger categories` or `qa not clear E-1534 stage pool config, role placement, placement core, memory floor and ledger categories` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
