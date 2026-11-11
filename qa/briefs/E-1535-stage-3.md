# Stage QA brief: E-1535 stage 3 — capacity, the login wait and its card, exclusive logins and keys at spawn

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (start `bash` first; zsh reads `$S:q`, `$B:h` or `${B}:hub` as modifiers and does not split unquoted path lists; always brace a variable before `:`; `set -- $pair` does not split in zsh). The run is local, on macOS (BSD `stat`, Node 24 with `node:sqlite`, `uuidgen`, `lsof`, `shasum`, `getconf DARWIN_USER_TEMP_DIR`). A platform skip is a FAIL, not a pass. **No real SSH, host, droplet, volume, snapshot, DigitalOcean API, key, credential, harness login, sudo, mount, Telegram, Discord, speech API, npm registry or network (R-1530's QA rule).** The named files use only their own fakes (the fake host provider and its directory-backed volumes, the scripted fake DigitalOcean API, fake SSH and scp, fake agents on Unix sockets, the fake Claude Code, Codex and OpenCode binaries with their fake login files and the fake OpenCode `key-proof` command, FakeClock, in-memory or temporary SQLite). Key values are fixture sentinels only. The scratch rows start one hub through the real CLI in a disposable project with one fake pool that has no minimum; they create no host and sign in nothing. **No real harness, no browser, no Neovim, no GUI.** Never read, print or log `DIGITALOCEAN_TOKEN` or any key value; no secret is ever an argv element.

**Landing markers filled (at T-1787's landing `427f522ec`).** T-1787 was written from its reviewed head `b0903704b63487d91b2e14f381881c7391d3362e` (rev-35 `rev-35-1787-source-2` and `rev-35-1787-final-1` clear there, C1 to C4 verified; mode-free verify `3e2e79a6-41c8-4e67-8175-0a1877108f80` finished `passed` at that head, A-18578), and its landing `427f522ec88e9ad77d4fa39257a650980c383422` (merge batch 4f0adb73, suite `9b73bc7d-d095-4323-a2c5-ab0ad8f630a4`, A-18585 and A-18586) is byte-identical to that head for every file it changes, with equal own lines against their merge base `26dc219eb` (VERIFIED with `git diff` and the `ownlines` comparison). Every T-1787 line was re-read at the landing; E1535S3-04 expects `open landing markers: 0`.

**Written at dev `26dc219ebfa4882a50750397ba14fe08c8ee9562`, landing lines settled at dev `427f522ec88e9ad77d4fa39257a650980c383422`** (T-1787's landing, the last of the five). Markers: VERIFIED = read in source, Git or the tracker at `427f522ec` (rows settled earlier say `26dc219eb`; nothing they read changed in the landing, VERIFIED); INFERRED = a reasoned expectation no read or run has proven (rule 22: an INFERRED line is never a pass condition on its own). The build is the dev SHA the QA request names, expected to be `427f522ec` followed by exactly the two Coordinator commits E1535S3-02 accepts (this brief with a durations refresh, then a tracker commit); any other later commit is BLOCKED there.

The stage turns logins into placement capacity: per-host verdicts and the login rule for pool growth (T-1784), the durable "waiting for a login" reason and its one "create one?" card (T-1785), the capacity line and login storage in `login list` and `host status` (T-1787), exclusive and non-exclusive logins with writer and reader volumes (T-1786), and key logins passed only in the spawn environment (T-1788). The run is meant to take about three and a half hours: setup and E1535S3-00 to E1535S3-06 about 25 minutes; the sealed T1/T2 rows E1535S3-10 to E1535S3-56 about 60 minutes; the native rows E1535S3-60 to E1535S3-74 about 100 minutes, one file per preservation slot; scratch rows E1535S3-80 to E1535S3-89 about 10 minutes. Waits for cover-quiet admission, the preservation lock or load are not product results.

## Carried corrections

A reused kit block must be reconciled against the source brief's recorded run corrections. This brief reuses blocks from two fixed commits, never by blob (A-17643): the kits of stages 1 and 2 from commit `K` (`f43f4e21049e9c62a97c8dec1ebf37f9c7035a62`, as both earlier stage briefs took them); the stage-2 brief's own helpers and check functions from commit `M3` (`18911bda46c7c0dc332619e93d25041069d3704a`, the tracker commit that recorded stage 2's clear verdict and the parent of this stage's first landing; the brief's blob there is `a5df2de9a6ae74874906244473cac002ea0dab22`, which already holds its "Run 1 corrections", VERIFIED). It therefore carries the whole chain of corrections:

- the stage-1 chain exactly as `qa/briefs/E-1535-stage-1.md` holds it at commit `M2` (`0d0618042fae7b76919d1be152e252b09e4a43ad`; blob `dd84d5b93927798242c0bee78ddc3310145ecbf0`; every section from `## Carried corrections` up to `## Stage`, 127 lines, VERIFIED), read into `$EV/carried-from-M2.md`;
- the stage-2 chain exactly as `qa/briefs/E-1535-stage-2.md` holds it at `M3` (every section from `## Carried corrections` up to `## Stage`, 55 lines, VERIFIED; it includes stage 2's "Run 1 corrections"), read into `$EV/carried-from-M3.md`;

both followed as written, then the stage-2 run's outcome and this stage's evidence below. T-1784's landing `e14c3bf6d` later edited the stage-2 brief (three selector renames in its `expect.json` and an appended replay paragraph); it touches neither the carried sections nor any line this brief extracts (VERIFIED: its hunks begin at lines 477, 501, 688 and 1147 of the `M3` blob, outside the carried lines 11 to 65 and outside every extracted range listed in "How this brief applies them"); in any case this brief reads the stage-2 brief at `M3`, never at dev. What applies here, and how, is stated in "How this brief applies them"; nothing below is optional.

### From the E-1535 stage-2 run (qa-678, A-18475, clear at `121ec8bef`)

The run recorded three corrections, already in the carried `M3` text ("Run 1 corrections"): the tree-wide absence scan must exclude its own brief (it matched its own two literals, Coordinator decision 788ff6b1); the T-1806 `cland-h-*` class covers every native row whose test reaches `createHost` through `records.ts` `hostPaths` (decisions 6be29ff4 and 846009f2); the DigitalOcean volume fixtures use `cland-fake-do-` and `host-unreachable` uses `cland-init-machine-` (replacing two INFERRED families). Its findings aside, both Low: T-1806, 21 dead `cland-h-*` socket directories in `/private/tmp` after native rows 60, 65, 66, 67, 69 and 73, untouched; T-1805, the `login-add` fixture-owner receipt whose `roots` names the live source worktree, untouched. The run's proposed rule stays in force here: **a whole-tree negative scan excludes the documents that define its own literals** (this brief and the two earlier stage briefs), keeping the original match count when it differs. The supplementary parser and output-path corrections in `.cland/artifacts/A-18475-e-1535-stage-2-qa-clear-at-121ec8bef-disk-logins-across-hosts/corrections.md` concern QA's own audit tooling and change no row here.

### From the stage-3 implementer, reviewer and Coordinator evidence (not a QA run)

- **Renamed selectors (T-1784, T-1785).** T-1784 renamed two stage-2 cases (`no eligible login waits with harness before spawning` in `hub/test/login-binding.test.ts`, `missing login holds demand without creating a host` in `hub/test/login-provision-bind.test.ts`) and added the explicit and role account-pin expansions; T-1785 renamed one E-1534 case (`login wait card adds one ask and cancellation frees the reserved name` in `hub/test/waiting-launch.test.ts`) and edited `qa/briefs/E-1534-stage-2.md` and `qa/briefs/E-1534.md` with a replay note (VERIFIED in `e14c3bf6d` and `bd8550b4d`). This brief's lists use the current names only; the historical names belong to the earlier receipts and are never expected here.
- **Durations commits inside the stage (VERIFIED).** `2b5513725` changes 103 existing allowances (98 owned by C-216, 5 by E-880; only `added`, `expires` and `reason` change, and for one of them only `reason`; `seconds` and `owner` kept; every expiry later or equal; no entry outside `allow` touched), and `639ccb373` adds one temporary allowance (T-1809, 9 s). Neither is an `Item:` commit. The stage-2 `addonly` function would report the renewal as 103 changed entries and is not used; this brief's `durdelta` prints the shape instead.
- **The Coordinator's commits after T-1787's landing (announced by the Coordinator, not yet made at filling; checked in E1535S3-02).** Exactly two first-parent commits follow `427f522ec`: (1) one commit touching only `qa/briefs/E-1535-stage-3.md` (this brief) and `hub/test/durations.json`, whose durations change is an add-only refresh from the stage-3 batch logs (new keys only; no existing entry outside `allow` changed or removed; no allowance added or removed) plus reason-text-only corrections to exactly four existing allowances, misplaced renewal notes from `2b5513725` (`seconds`, `owner`, `added` and `expires` unchanged): `hub/test/measure-memory.test.ts::offline analyzer reads a real V8 snapshot and finds an owned large array` (stray note removed), `hub/test/login-capacity.test.ts::capacity index bounds visits across same-region rejected rows and agrees with pending fences` (doubled note collapsed), `hub/test/inbox-query.test.ts::existing large synthetic database migrates and serves hub.status within 15 seconds` and `hub/test/host-relaunch.test.ts::C2/C3 admitted host relaunch no-login keeps durable native and checkout ownership` (missing note added); all four keys exist at `427f522ec` (VERIFIED); (2) one tracker commit touching only `.cland/tasks/*.md`.
- **T-1788's merge batch (VERIFIED).** Batch suite `d38f3f52-ac9e-4349-bc6c-8df676d6b0b2` (A-18550, head `673c3245…`) lists T-1788's own paths as its deciding files (`docs/agents/host-agent.md`, the `login-key-spawn` per-test note, `hub/src/adapters/contract.ts`, …) and none of T-1785's (`hub/src/host/login-cards.ts` absent); suite `d0622810-…` (A-18559) lists T-1785's. The item-topic landing reports were not read for this brief (no hub access); E1535S3-06 still has QA record them.
- **T-1809's budget case.** `hub/test/login-snapshots.test.ts`'s ten-thousand-login case went over its 5 s budget on the periodic dev T3 run `20d0d38d` (A-18558, Linux, 5.425 s; budget only, every assertion passed). Plain `node --test` enforces no budget, so its wall time is recorded in E1535S3-30 and never fails a row.
- **Implementer-only repetitions.** Several per-test notes (the `login-key-spawn` note under `docs/agents/tests/` among them) ask implementers for five fresh-process repetitions; QA runs each file once here (load repetitions are the occasion's).
- **T-1806 scope for this stage.** Native files that build fake hosts through `hostPaths` (every native row here except E1535S3-62, E1535S3-63, E1535S3-71 and E1535S3-73, INFERRED from their imports) may leave new `cland-h-*` socket directories in `/private/tmp`; `invd.mjs` marks them `known-class` and they never fail a row.

### Known flakes for this stage

Carried from `M3` by exact signature only: T-1731 (`hub/test/host-ssh-contract.test.ts`, which runs alone here in E1535S3-70) and T-1770 (`hub/test/host-provider-digitalocean.test.ts`, E1535S3-50: only the `422` expansion of `digitalocean <status> pauses every create …`, failing at line 368 with actual `['created','failed','created']`; line 368 is still `assert.deepEqual(results.map(r => r.state), ['created', 'created', 'created']);` at `26dc219eb` and at `b0903704b`, VERIFIED). For either: keep the full output, rerun that file once alone (T-1731 under the lock in the standard environment; T-1770 through `nt`), report both runs; the second result stands for the row and both are findings for the requester.

**Regressions, never reruns:** T-1735, T-1732 and T-1797 (all `done`, VERIFIED), as the carried text names them. **T-1736 is not a flake.** Any other failure is judged as it stands.

### Known non-blocking items (record if seen; never a stage failure on their own)

Each read with `task view` at writing (VERIFIED; all `backlog` with `needs-triage`):

- **T-1801:** `LoginBinder.close` joins in-flight attach, list and `loginDisk` calls but cannot abort them, because `Host.loginDisk` and the provider volume methods take no `AbortSignal`; shutdown waits for each operation's deadline. A slow but positive close in `login-binding`, `login-exclusive` or `login-capacity` is this item, recorded with its wall time.
- **T-1802** (regression of T-1776): `cland-auth thaw` is a bare `fsfreeze -u`, so a replay after a lost thaw receipt is refused on an unfrozen disk and the snapshot scheduler keeps its freeze and release fence. A retained fence with that cause is this item.
- **T-1804:** explorer protocol recordings key on archive-loading state. This brief runs no recording refresh; if anything leaves `nvim/test/fixtures/` changed, record it as T-1804 and keep the diff (it also makes `dirty entries` non-zero: report it, never revert by hand).
- **T-1805** (regression of T-1777): `hub/test/login-add.test.ts` leaves a fixture-owner receipt whose `roots` lists a removed `/tmp/hc-…` root and the live source worktree (E1535S3-68). Record it; never remove it, rewrite it or act on its `roots`.
- **T-1806:** native host fixtures leave `cland-h-*` socket directories in `/private/tmp`, which also holds about 90 historical native-fixture roots (`cland-suite-*`, `hc-`, `sf-`, `cland-ssh`, receipt directories). New `cland-h-*` names after a native row are this item.
- **T-1807:** `LoginBinder`'s `selectForLaunch` still visits rejected reader-intent history (about 2000 visits on a synthetic corpus before T-1784 extracted `heldForLaunch`); no slowness claim beyond the work count. A slow but positive launch-selection case is this item.
- **T-1808:** a shared evidence-publish helper that publishes only after a clean secret scan with a positive control does not exist yet. QA's publication follows rule 15 by hand: nothing is published after a non-zero scan, a missing exit code or an unmatched positive control.
- **T-1809** (regression of T-1784): the `login-snapshots` ten-thousand-login budget case, slowed by T-1784's capacity index and triggers, holds a temporary 9 s allowance from `639ccb373` (expires 2026-11-18). Its wall time is recorded only.
- **T-1676** (also `qa-found`): dead hub and spoke fallback sockets, Codex placeholder sockets and fixture-owner receipts in TMPDIR from unchanged producers, the carried class.

### How this brief applies them, and the reconciliation

- **Two environments (carried, A-18378).** The sealed T1 and T2 rows, the typecheck and every scratch command run through the stage-3 kit's `fresh.mjs` (fresh seal, streaming redaction, `QA_SESSION`, `TMPDIR=$T`). The native rows (the T3 files, plus the T2 files stage 2 grouped with them: `hub/test/host-unreachable.test.ts`, `hub/test/host-stop.test.ts` and the two provider-volume files) run through the stage-2 brief's `std.mjs`: QA's own environment with every `CLAND_*`, every shared-filter credential name and every `FAKE_` name removed, nothing added; it refuses (BLOCKED) a HOME other than the user's, a TMPDIR other than the system per-user TMPDIR, or a set `NODE_COMPILE_CACHE`, and streams through the same redactor and publication scan. Fixtures seal their own children with `fixtureEnvironment`.
- **Kit and helper pins.** From `K`: `holder`, `quiet`, `ld` (lines 133 to 136 of `qa/briefs/E-1532-stage-4.md`) and `tap.mjs` (lines 228 to 279), and the heredocs `seal.mjs`, `fresh.mjs`, `frame.mjs`, `body.sh`, `helpers.sh` of `qa/briefs/E-1533-stage-3.md`. From `M3`, in `qa/briefs/E-1535-stage-2.md`: the heredocs `std.mjs`, `invd.mjs` and `rcp.mjs`; lines 308 to 332 (`snapt`, `snaps`, `nt`, `slot`, `unslot`, `ns`); lines 336 and 337 (`mrow`); lines 345 to 347 (the S0 environment probes); lines 857 to 861 (`ownlines`), line 870 (`s01`) and lines 901 to 915 (`s99`) of its `checks.sh`; line 922 (`sentinels`) and lines 965 to 973 (`r89`) of its `scratch.sh`. Each range is checked by its SHA-1 at setup (values VERIFIED at `M3`). Not taken: the stage-2 `expect.json`, `src.mjs`, `ids.mjs`, `OWN63`, `OWN71`, `addonly`, `preserved`, `s00`, `s02`, `s05`, `r80` to `r83`; this brief writes its own.
- **Reconciliation of the reused blocks with the stage-2 corrections.** `invd.mjs` at `M3` already marks `cland-h-*` as `known-class` (the T-1806 correction needs no code change); the self-match correction applies to this brief's own `s05`, which excludes `qa/briefs/` and `.cland/` from every whole-tree scan; the fixture-prefix correction applies through `OWN67` and `OWN74` below. No extracted block is edited.
- **Per-file name-set inventories (carried).** Every file gets an exact before and after name set, taken only after its `exit` line: of `$T` for sealed rows; of the system TMPDIR (`$ST`), of `/private/tmp` and of `$ST/cland-fixture-owners-<uid>` for native rows. A new own-family name is a FAIL of that row, against the member whose landing edited the file (or, for an unedited consumer, against the member whose product change it consumes, named in the row); every other new name is recorded with its first-seen file and attributed; a new name that is live (an open handle or a live owner PID) is a FINDING. Pre-existing entries are attributed, never failed.
- **Expected-registration correction (carried).** Every exact list below was expanded from source through its loops and concatenations, then matched name by name against its registration calls (VERIFIED at `26dc219eb`; the T-1787-dependent lists at `b0903704b`). No stage file registers a title with leading whitespace (VERIFIED: the two indented registrations, in `host-status` and `host-provider-declarations`, are top-level calls with an indented line start, not indented titles). Lists are re-derived at `<dev SHA>` if it is later than `26dc219eb`.
- **Landing delta (carried).** E1535S3-02 compares each member's own changed lines at its landing with its reviewed tip's against their merge base, and names every tree difference. VERIFIED at `26dc219eb` for T-1786, T-1784, T-1788 and T-1785, and at `427f522ec` for T-1787: each landing is byte-identical to its reviewed tip for every file it changes, with equal own lines.
- **Presentation substitution (carried).** If any capture loses lines to the scanner (`# fresh: line withheld by the publication scan` or the `std.mjs` equivalent), the row is INCONCLUSIVE, not FAIL: keep the capture and ask the requester before any substitution. Stage titles say `key`, `secret`, `login` and `sentinel`; none was found to match the scanner (INFERRED).
- **Mapping ids (carried, A-17843).** E1535S3-04 checks that every `E1535S3-NN` the criteria map names exists as a row, and counts the open T-1787 landing markers.
- **Dead receipts and sockets (carried T-1676 clause).** In `$T`: inventoried, checked dead, attributed by the per-file inventories, then removed by literal path before E1535S3-99. **In the shared system TMPDIR and `/private/tmp`, QA removes nothing.**
- **Cleanup order (carried).** Census, then the dead `$T` residue removed by literal path, then the end check with `$Q` and `$T` present, then `$Q`, `$T` and the worktree after the verdict. If any inventory shows a new own-family name, nothing is removed anywhere: keep `$Q`, `$T` and `$W` and report.
- **Evidence split (this stage).** T1, T2, Web and each member's changed T3 files come from the member's mode-free `cland verify` on the Linux droplet at its reviewed head; full T3 comes from the merge batch that landed it; the stage covers (a Linux `verify all --occasion stage` and a macOS `--executor local --workers 1` run) are submitted by the Coordinator at the stage SHA. **QA starts none of them**: E1535S3-06 reads them as evidence. This run adds the macOS sealed and native file runs, the source and tree checks and the scratch CLI checks.
- **Not applicable here:** Neovim, web and messenger rows (no stage path under `nvim/` or `web/`, VERIFIED; `shared/wire/index.ts` gains the additive `login.set` frame, covered by the typecheck); standalone filtered cases; the epic occasion suite (a stage run, no `cland demo`).

### Kit conventions carried

- **Rule 22.** Every selector, test name and string is marked VERIFIED or INFERRED; an INFERRED expectation is never a pass condition on its own.
- **TAP.** `node --test <file>` reports top-level registrations with `1..N` and counters that include nested subtests; `tap.mjs` parses exactly that. Nested registrations here: one in `hub/test/login-binding.test.ts`, one in `hub/test/login-exclusive.test.ts`, one in `hub/test/login-key-spawn.test.ts` (VERIFIED), plus the carried ones of `hub/test/login-release.test.ts`, `hub/test/host-create-ready.test.ts` and `hub/test/login-provision-bind.test.ts`.
- **Exact strings** are counted by `src.mjs` with `String.split`, never by shell `grep`; tree-wide absence checks use `git grep` at `$S`.
- **The preservation lock** is `/tmp/cland-preserve.lock`: `mkdir` must exit 0, then an owner file naming this run, row and file; removal only after the owner check, by literal path. One native file per slot, at most 15 minutes (`std.mjs` exits 124 at 900 s: INCONCLUSIVE). A held lock makes the row BLOCKED for now (retry later; never remove another owner's lock).

## Stage

- Epic: E-1535 (Logins).
- Exact stage name: capacity, the login wait and its card, exclusive logins and keys at spawn.
- Items, in plan order, by lane (VERIFIED in `task plan show E-1535 --json` at `26dc219eb`): [T-1784 (login verdicts, regions and pool growth), T-1785 (waiting for a login, and the "create one?" card), T-1787 (capacity and login storage in `login list` and `host status`)], [T-1786 (exclusive and non-exclusive logins), T-1788 (key logins in the spawn environment only)]. The run reads membership, counts and state from `task plan show E-1535 --json` (E1535S3-00), never from this list. QA finding fixes added after writing are listed in the request.
- Policy: affected/after-stage (the stage default; no item override, VERIFIED: each member's `qaPolicy` is `{"scope":"affected","when":"after-stage"}` with no QA criteria).
- Scope: **affected.** The combined changed behaviour through the stage's named test files, the importers of the fixtures and fakes the stage edits, selected direct consumers of the changed product modules, read-only source and tree checks, the evidence read of E1535S3-06, and scratch checks of key logins, `login set` refusals and the capacity line on a CLI-started hub with one fake pool. No earlier-epic regression pass beyond those files: the stage covers carry the full suites.
  - T-1786 (landed `aca1a4ffb`, the first landing; VERIFIED; byte-identical to its reviewed tip `e9ec2f1cf`, rev-36 `rev-36-1786-final-1`): writer and reader bindings. A second host of an in-use non-exclusive disk gets a reader volume created from the latest snapshot (`hub/src/host/login-binding.ts`, `login-reader.ts` new), never writes back, and its clone is deleted with a confirmed delete before the binding is removed; a reader with no snapshot is refused naming it; an exclusive login in use is never offered; an attach refused as attached elsewhere rolls the binding back; private reader operations survive restart (`hub/src/host/logins.ts`, `login-release.ts`, `login-release-owner.ts`, `login-release-policy.ts` new, `provision-host.ts`); `cland login set <name> --exclusive true|false` (frame `login.set`, local human CLI or Neovim only, refused while in use; `hub/src/cli/login.ts`, `usage/login.ts`, `help.ts`, `protocol.ts`, `hub/src/hub/dispatch.ts`, `web-authority.ts`, `shared/wire/index.ts`). Tests: `hub/test/login-exclusive.test.ts` (T2, new), `hub/test/login-exclusive-native.test.ts` (T3, new), `hub/test/login-list.test.ts` (edited), the frozen usage fixture.
  - T-1784 (landed `e14c3bf6d`; VERIFIED; byte-identical to its tip `3be2cf5a0`, rev-35 `rev-35-1784-final-1`): `loginVerdict` (`hub/src/host/login-verdicts.ts`, new) answers `serves`, `can-bind`, `signed-out` or `no-login` per host and harness from indexed metadata; `decidePlacement` keeps serving and bindable hosts, serving first, and decides "waiting for a login <harness>" when no free login exists (`hub/src/host/scheduler.ts`); the pool runtime passes the verdict, the account pin and a create check, rechecks capacity at creation admission and wakes placement on login changes (`hub/src/host/pool-runtime.ts`, `hub/src/adapters/sessions.ts`); `selectCapacityLogin`, the private `pending_bindings` counter, its triggers and the partial `login_capacity_launch` index (`hub/src/host/logins.ts`); minimum and `login add` creation exempt. Tests: `hub/test/login-capacity.test.ts` (T2, new), `host-scheduler` (T1), `host-provision-records` (T1), `login-binding`, `login-host-pin`, `login-provision-bind`, `login-selection`, `pool-failures`, `pool-idle-stop`, `pool-scale`, `pool-spend-cap`, `session-pool-placement`, `waiting-launch` (T2, edited), `hub/test/settled-login-fixture.ts`.
  - T-1788 (landed `6252673e8`; VERIFIED; byte-identical to its tip `57ea80287`, rev-36 `rev-36-1788-final-2`): a pool OpenCode launch selects a ready key login (no provider or region), the hub decrypts it per native generation and registers it with the redactor (`hub/src/host/login-keys.ts` `loginKeyEnvironment`; startup streams ready key names, `hub/src/hub/daemon.ts`), the spawn request carries it in `secretEnv` as `OPENCODE_API_KEY` (`hub/src/adapters/contract.ts`, `index.ts`, `opencode.ts`, `sessions.ts`), the agent keeps it in memory and out of `launches/<id>/plan.json` and the prepared record (`hub/src/host/agent/prepared.ts`, `processes.ts`, `bootstrap.ts`, `closure.json`), spawn errors name the login with the key redacted, and a key login is never attached or detached (`login-binding.ts`). Tests: `hub/test/login-key-spawn.test.ts` (T3, new), `host-agent` (T3, one new case), `login-binding`, `login-selection`, `opencode-launch-policy` (T2, edited), `hub/test/fakes/opencode/fake-opencode.ts` (the gated `key-proof` command).
  - T-1785 (landed `bd8550b4d`; VERIFIED; byte-identical to its tip `35aeccff3`, rev-35 `rev-35-1785-final-2`): the waiting table reconciles one hub-owned `login-create` card in General per pool and harness whose waits read "waiting for a login <harness>", options Create one (answers `cland login add <harness> --pool <pool>`) and Not now (folds, keeps the wait), withdrawn when no matching wait remains, durable across restart through active-only metadata (`hub/src/host/login-cards.ts` new, `hub/src/adapters/sessions.ts`). Tests: `hub/test/login-wait.test.ts` (T2, new), `waiting-launch` (renamed case); docs `docs/hub/waiting-launches.md`.
  - T-1787 (landed `427f522ec`, the last landing; VERIFIED; byte-identical to its reviewed tip `b0903704b`, rev-35 `rev-35-1787-final-1`, with equal own lines against the merge base `26dc219eb`; 34 files, no `.cland/` path): `LoginRecords.capacity` (min(`max_hosts`, eligible free logins), a key or eligible shared disk gives `max_hosts`), per-pool `capacity` and `storage` and per-host `logins` in `host.status` (`hub/src/host/status.ts`, `hub/src/hub/dispatch.ts`), the text `capacity <pool>/<harness>: <n>` after `cland login list` and `logins <harness>/<name>` per host in `cland host status` (`hub/src/cli/login.ts`, `host.ts`, `usage.ts`, `usage/login.ts`); storage receipts on disk rows with private indexed columns (`hub/src/host/logins.ts`, `login-signin.ts`, `login-snapshots.ts`, `hub/src/hub/core.ts`); required `volumePerGiBMonth` and `snapshotPerGiBMonth` declarations (`hub/src/host/provider/declarations.ts`; fake 0, DigitalOcean 0.10 and 0.06). Tests: `hub/test/login-capacity-list.test.ts` (T2, new), `host-status`, `host-provider-fake`, `login-capacity`, `login-selection`, `pool-idle-stop` (T2, edited), `host-provider-declarations`, `login-signin` (T1, edited).
- **Merge watch.** `hub/src/host/logins.ts` is edited by every member; `hub/src/host/login-binding.ts` by T-1786 and T-1788; `hub/src/adapters/sessions.ts` by T-1784, T-1788 and T-1785; `docs/hub/logins.md`, `hub/README.md`, `docs/agents/tests/index.md` and `hub/test/tiers.json` by all; `hub/test/durations.json` by T-1784, T-1788, T-1785 and the two Coordinator durations commits; `hub/test/login-selection.test.ts` by T-1784, T-1788 and T-1787. E1535S3-02 names every later commit that touched a member's files.

### Criteria map

The stage verdict carries no item or epic marks; this tells the run which check proves what. E1535S3-04 checks that every row id named here exists in the tables below. VERIFIED at `26dc219eb`; the T-1787 rows VERIFIED at its reviewed head `b0903704b` and re-read at its landing `427f522ec` (unchanged). Generated titles are named as expansions of their templates; `expect.json` holds every full title.

| criterion | proven by |
| --- | --- |
| T-1784 C1 (verdict `serves` for a healthy binding, `can-bind` with a free login in its region, `signed-out`, `no-login`; placement skips `signed-out` and `no-login`) | E1535S3-10 (test `settled bindings serve first and pending bindings cannot serve`; test `login verdict classifies a retained signed-out binding and refuses region drift`; test `non-serving hosts are skipped for each verdict and default serves every harness`; test `healthy binding precedes can-bind and bindable room precedes creation`); E1535S3-03 |
| T-1784 C2 (`max_hosts = 2`, one exclusive login in use, none free: "waiting for a login <harness>", no host) | E1535S3-10 (test `exclusive login in use holds demand growth below max_hosts`; test `demand create rechecks login capacity at the creator admission boundary`); E1535S3-11 (test `missing login holds demand without creating a host`); E1535S3-40 (test `no eligible login waits with harness before spawning`); E1535S3-03 |
| T-1784 C3 (a `fake-1` login is never bound by a `fake-2` pool host; that pool waits for its own) | E1535S3-10 (the `wrong region` expansion of `<label> login supplies no pool capacity`; the region-drift verdict test above); E1535S3-03 |
| T-1784 C4 (a non-exclusive or key login lets every pool host serve its harness) | E1535S3-10 (the `shared` and `key` expansions of `<kind> login permits every pool host and further growth`); E1535S3-40 (test `ready key selection permits simultaneous hosts without disk bindings`); E1535S3-81 (scratch: `capacity qa/opencode: 2` from two key logins) |
| T-1784 C5 (`min_hosts` hosts created with no free login; a create for `cland login add` not held back) | E1535S3-10 (test `minimum creates hosts without any login`); E1535S3-11 (test `login add creates a host while its only login is still creating`); E1535S3-03 |
| T-1784 C6 (a `creating` login is never counted free) | E1535S3-10 (the `creating` expansion of `<label> login supplies no pool capacity`); E1535S3-11 (the login-add case above); E1535S3-03 (the eligibility SQL) |
| T-1784 review regressions (no ticket criterion: account pins, bounded capacity reads, the counter and its migration) | E1535S3-10 (test `pinned account with no free login cannot authorize host growth`; test `pinned account skips incompatible healthy binding for compatible bindable host`; test `demand retains the admitted account pin after a competing bind`; test `pending capacity counter follows every binding and reader writer and transaction rollback`; test `capacity index bounds visits across same-region rejected rows and agrees with pending fences`; test `capacity migration backfills both fences and preserves counts across reopen`; test `verdict reads only held bindings and eligible capacity across pending reader history`; test `capacity selection bounds decoded rows and indexed query work over retained metadata`); E1535S3-11 (the `account` and `harness` expansions of `current role <change> change prevents obsolete create admission after held preparation`); E1535S3-40 (the `explicit` and `role` expansions of `<pin> account without a matching login waits before growth`) |
| T-1785 C1 (a launch blocked on logins reads "waiting for a login <harness>" in `cland session list` and the inbox frame; one Agents notice) | E1535S3-20 (test `login waits share one create card and the final cancellation withdraws it`); E1535S3-03 |
| T-1785 C2 (`cland login add` of that harness releases the wait: a host starts, "waiting for host <id> to boot", placed when ready) | E1535S3-20 (test `login add ready receipt wakes host growth, changes the reason and places the launch`); E1535S3-03 (login changes wake placement) |
| T-1785 C3 (exactly one "Not enough <harness> logins. Create one?" card per pool and harness, whatever the passes or waits) | E1535S3-20 (test `login cards are scoped by pool and harness across repeated scheduler passes`; the shared-card test above; test `open login card survives restart and a later independent wait gets a new card`); E1535S3-03 |
| T-1785 C4 (the card folds when the last waiting launch is placed or cancelled) | E1535S3-20 (the shared-card test, the ready-receipt test and the restart test above; test `login wait card adds one ask and cancellation frees the reserved name`); E1535S3-03 |
| T-1785 C5 ("Not now" folds the card and leaves the launch waiting) | E1535S3-20 (the `2` and `decline` expansions of `login card option <option> folds once across retries and restart`, and the `1` expansion for Create one); E1535S3-03 |
| T-1786 C1 (a second host cannot bind an exclusive login in use; an attach refused as attached elsewhere leaves the launch unplaced and the login unchanged) | E1535S3-30 (test `exclusive login refuses a second host and attached-elsewhere refusal preserves metadata`); E1535S3-03 |
| T-1786 C2 (`exclusive = false`: two fake hosts run on one login, the first on its own volume, the second on a volume from the latest snapshot) | E1535S3-30 (test `non-exclusive login binds a writer and a reader cloned from its latest snapshot`); E1535S3-60 (test `two hosts rotate separate writer and reader files; stop deletes only the reader volume`); E1535S3-03 |
| T-1786 C3 (after both stop, the own volume holds only the writer's turns; the reader's volume is deleted with a confirming read) | E1535S3-60 (the native test above); E1535S3-30 (test `reader release deletes its clone before removing the binding, retaining the writer`; test `reader deletion without a receipt retains the binding until confirmed`; test `lost reader host deletes its clone only after detached inventory`); E1535S3-03 |
| T-1786 C4 (`cland login set <name> --exclusive false` refused while in use; `cland login list` shows the writer's and each reader's host) | E1535S3-30 (test `local login set CLI changes idle disks and refuses an in-use disk; list shows every host`; `login-list`'s edge refusals with `login.set`); E1535S3-82 (scratch: the key, value and unknown-login refusals); E1535S3-03 |
| T-1786 C5 (a reader bind with no snapshot refused naming the missing snapshot) | E1535S3-30 (test `reader without snapshot refuses naming the login and missing snapshot`); E1535S3-03 |
| T-1786 review regressions (no ticket criterion: reader ownership across restart and lost responses) | E1535S3-30 (test `lost clone-create response retains ownership across restart and recovers without another allocation`; the four expansions of `reader release recovers <fault> failure after restart; lost=<lost>`; test `forced fixture failure joins a held reader creation before storage closes`; both expansions of `failed reader binding publication <fault> its write cleans its captured clone`; test `unknown create without inventory receipt stays fenced rather than allocating again`; test `confirmed clone-create refusal permits retry without an unknown-outcome fence`; test `host release recovers an unbound create intent retained after lost response`; both expansions of `installed owner recovers an unbound reader on <state> host after reopen`; test `missing reader volume without a deletion intent retains binding ownership`; test `deleting intent with an omitted but existing clone still requires exact provider deletion`; both expansions of `final reader <route> recovery clears snapshot release and resumes pending backup`); E1535S3-64, E1535S3-65, E1535S3-66, E1535S3-72 (native consumers of the edited release and provisioning owners) |
| T-1788 C1 (an OpenCode session on a fake host with a key login receives the sentinel in its environment; the process row's account environment holds none of it) | E1535S3-61 (test `two fake hosts receive a key only at spawn and retain no plaintext through agent restart`; test `composed key launches on two hosts resume a persisted conversation after hub and agent restart`); E1535S3-40 (test `pool key launch carries a secret separately from persisted account environment`); E1535S3-03 |
| T-1788 C2 (the sentinel on two fake hosts at once: no byte in argv, host files, process rows, `hub.db`, the hub log or the journal; `.cland/auth` ciphertext only) | E1535S3-61 (both tests above, each with its file and argv scans and positive control); E1535S3-40 (the pool key launch test above); E1535S3-81 and E1535S3-83 (scratch: sentinel occurrences 0 under `.cland`, hub log included, before and after a restart) |
| T-1788 C3 (the agent's admission plan file holds no environment value; the launch still starts with its full environment) | E1535S3-62 (test `admission plan excludes environment while native launch receives it`); E1535S3-63 (`host-prepared` over the edited prepared record); E1535S3-03 |
| T-1788 C4 (a spawn error with a key login names the login, never the key; the redactor masks the key in any frame) | E1535S3-40 (test `key spawn environment reaches native spawn but never the returned process or errors`; the four expansions of `key launch preserves <kind> refusal identity and ownership facts`; the pool key launch test above); E1535S3-03 |
| T-1788 C5 (a key login is never attached or detached; a host stop leaves it `ready` and unchanged) | E1535S3-40 (the pool key launch test above: human `host.stop` leaves the key ready with no bindings; test `ready key selection permits simultaneous hosts without disk bindings`); E1535S3-61; E1535S3-03 |
| T-1787 C1 (`cland login list` shows "capacity <pool>/<harness>: <n>" = min(`max_hosts`, free logins of that harness in the pool's region)) | E1535S3-50 (test `capacity counts regional exclusive disks and unlimited shared and key logins`); E1535S3-81 (scratch: one capacity line); E1535S3-03 |
| T-1787 C2 (`cland host status` lists each host's bound logins by harness and name) | E1535S3-50 (test `C1/C2 status weights sessions and clips live accrual to UTC day/month, excluding reservations`; test `status reads decode current storage only and bound harness work across retained history`); E1535S3-03 |
| T-1787 C3 (each pool's month figure adds accrued storage at the declared prices; no hosts reservation includes storage) | E1535S3-50 (test `login storage accrues in its recorded pool month only without reserving spend`; test `sign-in records volume and snapshot lifetime receipts in the admitted pool`); E1535S3-82 (scratch: storage 0 with no disk login); E1535S3-03; E1535S3-05 (no storage in the spend reservation module) |
| T-1787 C4 (a declaration without the storage prices refused naming the keys; the fake declares 0) | E1535S3-50 (test `storage prices are required and identify their missing keys`; test `fake storage declarations are zero`; `host-provider-fake` and the unedited DigitalOcean provider files); E1535S3-74 (the provider volume contracts over the edited providers); E1535S3-03 |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1535 --json` lists in stage `capacity, the login wait and its card, exclusive logins and keys at spawn`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit. A task closed `done` with no branch and no landing receipt must have no `Item:` trailer on dev (evidence-only completion). A dirty build, a missing required merge (**every member needs a landing here, T-1787 included**) or moved dev blocks this run: retain any collected evidence and report to the requester. The brief names no run id on purpose.

At writing (dev `26dc219ebfa4882a50750397ba14fe08c8ee9562`): T-1786 landed as `aca1a4ffb` (`aca1a4ffb520105269e8212795c997e7f27fc78e`), T-1784 as `e14c3bf6d` (`e14c3bf6d2ece55e17a497112bf7e9bc8d3aaba7`), T-1788 as `6252673e8` (`6252673e8cbf560c8de994c0147ac31f2551cecd`) and T-1785 as `bd8550b4d` (`bd8550b4db0abcd5a102538d44a762bc0b4866d9`), each with exactly one `Item:` trailer on the first-parent history (VERIFIED). T-1787 landed as `427f522ec` (`427f522ec88e9ad77d4fa39257a650980c383422`, batch 4f0adb73, one `Item: T-1787` trailer, `Reviewed-by: rev-35 (rev-35-1787-final-1)`; its files byte-identical to the reviewed tip `b0903704b`, VERIFIED), and the plan then read the stage `open`, `merged 5`, `total 5`, `statuses {"done":5}`, cover `missing ["Linux droplet","macOS"]` (VERIFIED at the landing). The stage cover pair is the one the Coordinator submits at the requested dev SHA, after the two accepted Coordinator commits.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step. No row needs `web/dist`, a browser or Neovim.

**Where things live.** Scratch state is under `$Q` (`/private/tmp/q53-…`, realpath, 23 bytes; the stage-3 kit's seal accepts exactly this prefix) and `$T` (`/private/tmp/qa-e1533-s3-<uuid>`, the suite root's byte length; also the kit's prefix), as in stages 1 and 2. Native rows use the system per-user TMPDIR `$ST` and `/private/tmp` as they are: QA reads their name sets and writes nothing there. The scratch project is `$Q/p1`; its `hub.db`, `.cland/auth/` and `.cland/secrets.toml` hold the only login rows, key files and store key this run writes. The only paths under the repository are `$W` in `.cland/worktrees/` and the evidence `$EV` in `.cland/qa/E-1535/<run>/`, both ignored by Git. Nothing is written to `.cland/tasks/` of the live project.

**Isolation (rule 15).** Every scratch check runs in the disposable project p1 with its own HOME, XDG directories and Git config, through the fresh seal (its hub seal sets `CLAND_FAKE_HOST_ROOT` to `$Q/fh`, VERIFIED in the kit's `body.sh` gate). Never the live project's hub, config, roles, territory, `hub.db`, secrets or discovery, and never the human's HOME (`~/.cland`, `~/.ssh`, `~/.claude`, `~/.codex`, `~/.opencode`, `~/.local/state`, `~/.config/cland`). The native rows read HOME only as the standard environment does; they write nothing to it (INFERRED from the per-test notes; E1535S3-99's root status and the censuses check what can be checked). Never read or print a credential; never run `cland login …`, `cland secret …`, `cland config set`, `cland role launch`, `cland session …`, `cland host …` or `cland hub …` against the live project. The live hub is read only by QA's own shell for the plan read, the item reads of E1535S3-06 and `quiet`. **No credential reaches a process QA starts:** the seals filter through `fixtureEnvironment`, and `std.mjs` removes the same names through the same shared filter before every native file. QA's shell may hold credential-prefix names (`SSH_AUTH_SOCK` on macOS); S0 records their count and the names `std.mjs` removes, never a value.

Three kinds of command, never mixed. **QA's own shell** keeps QA's session identity: worktree, roots, `quiet`, the plan and item reads, the source and tree checks that read files only, every record. **Sealed commands** run through `$Q/fresh.mjs`: the T1 and T2 files, the typecheck (cwd `$W`, `plain` mode), the scratch rows (`hub` mode, cwd `$Q/p1`, through `body.sh`). **Native commands** run through `$Q/std.mjs` (cwd `$W`), one file per preservation slot.

**Removals.** Every `rm` names one literal path, written out in full after it was printed and checked; never a glob, a variable, a command substitution or `xargs` (the project's literal-rm hook refuses them and stalls the session). Scratch helpers write into `$Q`, removed with `$Q` at the end. Nothing in `$ST` or `/private/tmp` outside `$Q` and `$T` is ever removed.

### Environment

Put Node from `/Users/evgeniyivanov/.nvm/versions/node/v24.21.0/bin` first on `PATH` and check `node --version` against the qa skill's `node-engines.json` (`>=24.13.0 <25`, VERIFIED). If TMPDIR is unset in QA's shell, export it to the value `getconf DARWIN_USER_TEMP_DIR` prints (the system value, not an overlay). In QA's own shell (bash):

```sh
R=/Users/evgeniyivanov/Projects/cland/v0
S=<dev SHA>                                    # the full dev SHA from the request
K=f43f4e21049e9c62a97c8dec1ebf37f9c7035a62     # the fixed kit commit (A-17643: pin a commit, never a blob)
M2=0d0618042fae7b76919d1be152e252b09e4a43ad    # the stage-1 brief as its clear rerun used it; its carried corrections
M3=18911bda46c7c0dc332619e93d25041069d3704a    # the stage-2 brief as its clear run's tracker commit holds it; its helpers and carried corrections
RUN=qa-e1535s3-$(date +%F)-1                   # unique run id for E-1535; bump the suffix on a rerun
export QA_SESSION=${QA_SESSION:-${CLAND_SESSION_NAME:-}}
[ -n "$QA_SESSION" ] || echo "BLOCKED: no QA session name"
echo "QA shell credential-prefix names: $(env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|CODEX_API|CODEX_ACCESS|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)')"
W=$R/.cland/worktrees/qa-e1535s3-$RUN
EV=$R/.cland/qa/E-1535/$RUN
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
ST=$(cd "$(getconf DARWIN_USER_TEMP_DIR)" && pwd -P)   # the system per-user TMPDIR, realpath; native rows run with it unchanged
T=/private/tmp/qa-e1533-s3-$(uuidgen | tr 'A-Z' 'a-z'); mkdir -m 700 "$T"
Q=$(cd "$(mktemp -d /tmp/q53-XXXXXX)" && pwd -P); chmod 700 "$Q"
mkdir -p "$Q/home" "$Q/config" "$Q/opencode" "$Q/state" "$Q/cache" "$Q/claude" "$Q/codex" "$Q/fake-claude" "$Q/fake-codex" "$Q/fake-opencode" "$Q/executor-state" "$Q/p1" "$Q/fh" "$Q/bin" "$Q/kit"
chmod 700 "$Q/claude" "$Q/fake-claude"         # E-1532 DoD fix: Claude roots 0700
: > "$Q/pids"; : > "$Q/home/.gitconfig"; : > "$Q/home/.gitignore-global"
# body.sh's gate requires these shims by name even though this stage's scratch rows create no host:
ln -s "$W/hub/test/fakes/fake-ssh.ts" "$Q/bin/ssh"; ln -s "$W/hub/test/fakes/fake-scp.ts" "$Q/bin/scp"
printf '#!/bin/sh\nexec "$@"\n' > "$Q/bin/setsid"
printf "#!/bin/sh\nln -s '%s/node_modules' node_modules\n" "$W" > "$Q/bin/npm"
chmod 700 "$Q/bin/setsid" "$Q/bin/npm"
printf '{"W":"%s","Q":"%s","EV":"%s","T":"%s","R":"%s","ST":"%s","SESSION":"%s"}\n' "$W" "$Q" "$EV" "$T" "$R" "$ST" "$QA_SESSION" > "$Q/state.json"
git -C "$R" show "$M2:qa/briefs/E-1535-stage-1.md" | awk '/^## Carried corrections/{f=1} /^## Stage$/{exit} f' > "$EV/carried-from-M2.md"
git -C "$R" show "$M3:qa/briefs/E-1535-stage-2.md" | awk '/^## Carried corrections/{f=1} /^## Stage$/{exit} f' > "$EV/carried-from-M3.md"
echo "M2 commit $(git -C "$R" rev-parse "$M2^{commit}") want 0d0618042fae7b76919d1be152e252b09e4a43ad; blob $(git -C "$R" rev-parse "$M2:qa/briefs/E-1535-stage-1.md") want dd84d5b93927798242c0bee78ddc3310145ecbf0; carried lines $(wc -l < "$EV/carried-from-M2.md" | tr -d ' ') want 127"
echo "M3 commit $(git -C "$R" rev-parse "$M3^{commit}") want 18911bda46c7c0dc332619e93d25041069d3704a; blob $(git -C "$R" rev-parse "$M3:qa/briefs/E-1535-stage-2.md") want a5df2de9a6ae74874906244473cac002ea0dab22; carried lines $(wc -l < "$EV/carried-from-M3.md" | tr -d ' ') want 55"
```

**The kits and the stage-2 helpers, from fixed commits.** From `K`, exactly as stages 1 and 2 took them; from `M3`, the stage-2 brief's own helpers by heredoc name and by line range, each range checked by its SHA-1. A missing kit file, block or a SHA-1 other than `want` is a setup BLOCKED.

```sh
for b in E-1532-stage-4 E-1533-stage-3; do git -C "$R" show "$K:qa/briefs/$b.md" > "$Q/kit/$b.md"; done
git -C "$R" show "$M3:qa/briefs/E-1535-stage-2.md" > "$Q/kit/E-1535-stage-2.md"
echo "kit commit $(git -C "$R" rev-parse "$K^{commit}") want f43f4e21049e9c62a97c8dec1ebf37f9c7035a62"
sed -n '133,136p' "$Q/kit/E-1532-stage-4.md" > "$Q/kit-shell.sh"; sed -n '228,279p' "$Q/kit/E-1532-stage-4.md" > "$Q/kit-tap.sh"
echo "kit first lines: $(head -n 1 "$Q/kit-shell.sh" | cut -c1-10) | $(head -n 1 "$Q/kit-tap.sh" | cut -c1-27)"
. "$Q/kit-shell.sh"; . "$Q/kit-tap.sh"
kitb() { awk -v n="$2" 'BEGIN{h="cat > \"$Q/" n "\" <<"} index($0,h)==1{f=1} f{print} f&&/^(JS|SH|JSON)$/{exit}' "$Q/kit/$1.md"; }
for n in seal.mjs fresh.mjs frame.mjs body.sh helpers.sh; do kitb E-1533-stage-3 "$n" > "$Q/kit3-$n.sh"; echo "kit3 $n: $(head -n 1 "$Q/kit3-$n.sh" | cut -c1-40) | lines $(wc -l < "$Q/kit3-$n.sh" | tr -d ' ')"; . "$Q/kit3-$n.sh"; done
for n in std.mjs invd.mjs rcp.mjs; do kitb E-1535-stage-2 "$n" > "$Q/kit2-$n.sh"; echo "kit2 $n: $(head -n 1 "$Q/kit2-$n.sh" | cut -c1-40) | lines $(wc -l < "$Q/kit2-$n.sh" | tr -d ' ')"; . "$Q/kit2-$n.sh"; done
kit2() { sed -n "$2" "$Q/kit/E-1535-stage-2.md" > "$Q/kit2-$1.sh"; echo "kit2 $1: sha1 $(shasum < "$Q/kit2-$1.sh" | cut -c1-40) want $3"; }
kit2 fns '308,332p' 7d3265fb3617e213677b78ee5a78cb95aa12eae6        # snapt, snaps, nt, slot, unslot, ns
kit2 mrow '336,337p' 9f2fc5c7c2f7ba41f5fbec54a9db636cfe014e57       # mrow
kit2 s0 '345,347p' 6ec8beed74eb77e5f2620b034a1373099ab3e63e         # the S0 environment probes
kit2 checks '857,861p;870p;901,915p' eff5097fdb01c670d784454447777dd771be3dbd   # ownlines, s01, s99
kit2 scratch '922p;965,973p' 65943c4003fe5a3470de235d677def6f9a0116dc   # sentinels, r89 (sourced by this brief's scratch.sh)
. "$Q/kit2-fns.sh"; . "$Q/kit2-mrow.sh"
node --check "$Q/tap.mjs" && node --check "$Q/seal.mjs" && node --check "$Q/fresh.mjs" && node --check "$Q/frame.mjs" && node --check "$Q/std.mjs" && node --check "$Q/invd.mjs" && node --check "$Q/rcp.mjs" && bash -n "$Q/body.sh" && bash -n "$Q/helpers.sh" && bash -n "$Q/kit2-fns.sh" && bash -n "$Q/kit2-checks.sh" && bash -n "$Q/kit2-scratch.sh" && echo "kits checked"
```

Expected: `M2 commit`, `M3 commit`, both `blob`, both `carried lines` and `kit commit` each equal to `want`; `kit first lines: holder() { | cat > "$Q/tap.mjs" <<'JS'`; each `kit3` and `kit2` heredoc line starts with `cat > "$Q/<name>" <<'` and has more than one line (`kit2 std.mjs` 58, `kit2 invd.mjs` 25, `kit2 rcp.mjs` 20, VERIFIED at `M3`); each `kit2 <range>: sha1` equal to its `want`; `kits checked`. The kit's `fresh.mjs` and the stage-2 `std.mjs` are unchanged from stage 2.

The S0 environment prints, from the stage-2 brief at `M3` (lines 345 to 347): the two seals and the standard environment once, into `$EV/S0-env.txt`:

```sh
. "$Q/kit2-s0.sh"
```

Expected (recorded as `S0`): QA's shell `credential-prefix names:` any count (recorded); `std: removed by the shared credential filter (names only) <n>: <names>` recorded as the removed set (INFERRED: `SSH_AUTH_SOCK` among them); both seals `credential-prefix names 0`, `QA_SESSION set`, `TMPDIR is T true`, `HOME is Q/home true`, `CLAND_TEST_HOST_ knobs 0`, `FAKE_LOGIN_ names 0`, `0` real-HOME entries, each `# fresh: redacted or withheld lines 0`; `std: credential-prefix names 0; CLAND_ names 0; FAKE_ names 0; HOME is the user home true; TMPDIR is the system TMPDIR true; NODE_COMPILE_CACHE set false; node v24.…` and `# std: redacted or withheld lines 0`; `Q bytes 23`, `T bytes` equal to the suite root's. A `std: BLOCKED` line or a non-zero credential count in either seal or after `std.mjs`'s filter stops the run before any row (BLOCKED): report the names (never values). The removed-names line repeats in every native log; it must name the same set each time (a change is recorded).

**This brief's own helpers.** The own-family patterns with alternation (kept out of the case tables), the TAP expectations, the source checks, the id check, the check functions and the scratch functions.

```sh
# own-family patterns with alternation (VERIFIED from each file's allocation calls unless the row says INFERRED)
OWN61='^(key-spawn-|key-composed-)'          # login-key-spawn: mkdtemp key-spawn-, tempProject key-composed-
OWN67='^(cland-proj-|cland-init-machine-)'    # host-stop: tempProject default; host-unreachable: the stage-2 run-1 correction
OWN71='^(cland-proj-|fake-opencode-)'         # opencode-adapter: tempProject default and mkdtemp fake-opencode-
OWN74='^(hp-vol-|cland-fake-do-)'             # provider volume fixtures (the stage-2 run-1 correction for DigitalOcean)
```

The TAP expectations. `exact: true` lists every registration; `exact: false` with names requires those names to pass; `exact: false` with `[]` means the whole file must be `CLEAN`. Every list was read at dev `26dc219eb` and matched name by name against its source templates (VERIFIED; the counts: `login-capacity` 17, `host-scheduler` 10, `login-host-pin` 13, `login-provision-bind` 19, `login-wait` 7, `login-exclusive` 24, `login-list` 2, `login-release` 24, `login-snapshots` 27, `login-snapshot-cli` 1, `login-records` 20, `login-binding` 36, `login-keys` 6, `secrets` 7, `host-contract-coverage` 9, `login-exclusive-native` 1, `login-key-spawn` 3, `login-write-back` 1, `host-create-ready` 11, `host-destroy-native` 3, `host-restart` 1, `host-unreachable` 20, `host-stop` 4, `login-add` 1, `host-provider-volumes` 15, `host-provider-digitalocean-volumes` 17). The T-1787-dependent lists were read at its reviewed head `b0903704b` (VERIFIED: `login-capacity-list` 1, `host-status` 5, `host-provider-declarations` 5, `login-signin` 6, `login-selection` 3; at `26dc219eb` `login-selection` has 2 and the first three files' new names do not exist), and re-derived at the landing `427f522ec` with no change (VERIFIED: every one of T-1787's test files is byte-identical there, each list's literal names present and its loop expansions matched). The lists of files no stage landing edits (`login-release`, `login-snapshots`, `login-snapshot-cli`, `login-records`, `login-keys`, `secrets`, `host-contract-coverage`, `login-write-back`, `host-create-ready`, `host-destroy-native`, `host-restart`, `host-unreachable`, `host-stop`, `login-add` and the two provider-volume files) are the stage-2 lists, unchanged (VERIFIED: `git diff 18911bda4 b0903704b` is empty for each).

```sh
cat > "$Q/expect.json" <<'JSON'
{
 "hub/test/login-capacity.test.ts": {"exact": true, "names": [
  "exclusive login in use holds demand growth below max_hosts",
  "wrong region login supplies no pool capacity",
  "creating login supplies no pool capacity",
  "settled bindings serve first and pending bindings cannot serve",
  "shared login permits every pool host and further growth",
  "key login permits every pool host and further growth",
  "minimum creates hosts without any login",
  "login verdict classifies a retained signed-out binding and refuses region drift",
  "demand create rechecks login capacity at the creator admission boundary",
  "capacity selection bounds decoded rows and indexed query work over retained metadata",
  "pinned account with no free login cannot authorize host growth",
  "pinned account skips incompatible healthy binding for compatible bindable host",
  "demand retains the admitted account pin after a competing bind",
  "pending capacity counter follows every binding and reader writer and transaction rollback",
  "capacity index bounds visits across same-region rejected rows and agrees with pending fences",
  "capacity migration backfills both fences and preserves counts across reopen",
  "verdict reads only held bindings and eligible capacity across pending reader history"]},
 "hub/test/host-scheduler.test.ts": {"exact": true, "names": [
  "default weights fill eight slots with Claude Code or mixed Codex sessions",
  "dense packing chooses fullest eligible host and spread chooses emptiest",
  "weight overrides change placement and leave unspecified defaults intact",
  "non-serving hosts are skipped for each verdict and default serves every harness",
  "no room creates below the limit but promises booting room before another create",
  "reservations, unavailable hosts and verdicts preserve the boot and maximum fences",
  "fractional overrides convert once to milli-slots and reject one milli excess",
  "accumulated fractional weights fill eight slots exactly",
  "used and promised milli-slots share capacity and affect dense packing",
  "healthy binding precedes can-bind and bindable room precedes creation"]},
 "hub/test/host-provision-records.test.ts": {"exact": false, "names": []},
 "hub/test/pool-scale.test.ts": {"exact": false, "names": [
  "current role account change prevents obsolete create admission after held preparation",
  "current role harness change prevents obsolete create admission after held preparation"]},
 "hub/test/pool-failures.test.ts": {"exact": false, "names": []},
 "hub/test/pool-idle-stop.test.ts": {"exact": false, "names": []},
 "hub/test/pool-spend-cap.test.ts": {"exact": false, "names": []},
 "hub/test/session-pool-placement.test.ts": {"exact": false, "names": []},
 "hub/test/login-host-pin.test.ts": {"exact": true, "names": [
  "terminal outcome 0 holds its host through cleanup and releases the pin",
  "terminal outcome 1 holds its host through cleanup and releases the pin",
  "terminal outcome null holds its host through cleanup and releases the pin",
  "login admission refuses INVALID before host creation or pinning",
  "login admission refuses work before host creation or pinning",
  "login admission refuses empty name before host creation or pinning",
  "a pinned host renews its lease and idle-stop waits for unpinning",
  "sign-in revalidates captured host authority after create",
  "sign-in revalidates captured host authority after attach",
  "sign-in revalidates captured host authority after mount",
  "sign-in revalidates captured host authority after publish",
  "sign-in revalidates captured host authority after replacement",
  "login add creates a host while its only login is still creating"]},
 "hub/test/login-provision-bind.test.ts": {"exact": true, "names": [
  "cold launch attaches while connecting and reuses the mounted login after ready",
  "two waiting harnesses attach before cloning finishes",
  "login preparation adds no hub-clock time to simulated cloning",
  "boot failure before attachment preserves the ready disk",
  "boot failure after attachment preserves the ready disk",
  "unknown rollback retains pending binding without retrying detach",
  "host ready and native admission wait for the mount receipt",
  "missing login holds demand without creating a host",
  "cancelled captured wait cannot attach after held inventory completes",
  "failure fences attach while provisioning inventory is held",
  "abort fences attach while provisioning inventory is held",
  "forced setup failure drains a late scheduled attachment before hub and root cleanup",
  "cancelled wait at attached rolls back the same disk before host readiness",
  "cancelled wait at mounting rolls back the same disk before host readiness",
  "changed role account during mount releases the captured disk and launches with the current pin",
  "removed role while inventory is held cannot consume a login or fail the host",
  "selected account limit refuses the wait while preserving the healthy host and free disk",
  "unknown attachment keeps the pending fence and healthy host without spawning",
  "attachment delay owner rejects calls admitted after its cleanup"]},
 "hub/test/login-selection.test.ts": {"exact": true, "names": [
  "status reads decode current storage only and bound harness work across retained history",
  "launch selection has fixed indexed query and decode work across ten thousand retained logins",
  "stage-one login database migrates private binding harness and indexes without changing public rows"]},
 "hub/test/host-restart-reconcile.test.ts": {"exact": false, "names": []},
 "hub/test/host-create-entry.test.ts": {"exact": false, "names": []},
 "hub/test/host-create-admission.test.ts": {"exact": false, "names": []},
 "hub/test/host-provision-recovery.test.ts": {"exact": false, "names": []},
 "hub/test/host-lease.test.ts": {"exact": false, "names": []},
 "hub/test/host-destroy.test.ts": {"exact": false, "names": []},
 "hub/test/login-wait.test.ts": {"exact": true, "names": [
  "login waits share one create card and the final cancellation withdraws it",
  "login cards are scoped by pool and harness across repeated scheduler passes",
  "login add ready receipt wakes host growth, changes the reason and places the launch",
  "login card option 1 folds once across retries and restart",
  "login card option 2 folds once across retries and restart",
  "login card option decline folds once across retries and restart",
  "open login card survives restart and a later independent wait gets a new card"]},
 "hub/test/waiting-launch.test.ts": {"exact": false, "names": [
  "login wait card adds one ask and cancellation frees the reserved name"]},
 "hub/test/waiting-launch-restart.test.ts": {"exact": false, "names": []},
 "hub/test/waiting-launch-store.test.ts": {"exact": false, "names": []},
 "hub/test/waiting-launches-owner.test.ts": {"exact": false, "names": []},
 "hub/test/connection-snapshot.test.ts": {"exact": false, "names": []},
 "hub/test/hub-cards.test.ts": {"exact": false, "names": []},
 "hub/test/login-exclusive.test.ts": {"exact": true, "names": [
  "lost clone-create response retains ownership across restart and recovers without another allocation",
  "reader release recovers delete-response failure after restart; lost=false",
  "reader release recovers unbind failure after restart; lost=false",
  "reader release recovers delete-response failure after restart; lost=true",
  "reader release recovers unbind failure after restart; lost=true",
  "forced fixture failure joins a held reader creation before storage closes",
  "failed reader binding publication before its write cleans its captured clone",
  "failed reader binding publication after its write cleans its captured clone",
  "unknown create without inventory receipt stays fenced rather than allocating again",
  "confirmed clone-create refusal permits retry without an unknown-outcome fence",
  "host release recovers an unbound create intent retained after lost response",
  "installed owner recovers an unbound reader on destroying host after reopen",
  "installed owner recovers an unbound reader on destroyed host after reopen",
  "missing reader volume without a deletion intent retains binding ownership",
  "deleting intent with an omitted but existing clone still requires exact provider deletion",
  "final reader binder recovery clears snapshot release and resumes pending backup",
  "final reader unbound-release recovery clears snapshot release and resumes pending backup",
  "non-exclusive login binds a writer and a reader cloned from its latest snapshot",
  "reader release deletes its clone before removing the binding, retaining the writer",
  "local login set CLI changes idle disks and refuses an in-use disk; list shows every host",
  "exclusive login refuses a second host and attached-elsewhere refusal preserves metadata",
  "reader without snapshot refuses naming the login and missing snapshot",
  "reader deletion without a receipt retains the binding until confirmed",
  "lost reader host deletes its clone only after detached inventory"]},
 "hub/test/login-list.test.ts": {"exact": true, "names": [
  "login list text and JSON expose rows and hosts, retained across hub restart",
  "login list refuses session, web and remote edges like host list"]},
 "hub/test/login-release.test.ts": {"exact": true, "names": [
  "host stop unmounts and detaches the same volume before deletion",
  "two login unmounts run concurrently before detach",
  "writers remaining retain host and binding and emit one notice",
  "lost host retains settled binding until detached inventory",
  "lost host retains pending binding",
  "snapshot thaw refusal prevents unmount and machine deletion",
  "host without logins requires no release owner",
  "provider gone receipt skips unmount and frees only detached disk",
  "concurrent stop callers join one release",
  "health 15-minute loss reaches login release",
  "health gone receipt reaches login release",
  "refusal then hard deadline emits exactly one destruction notice after detached read",
  "held freeze on lost host is abandoned without host calls",
  "held freeze on gone host is abandoned without host calls",
  "automatic detached retry stops after positive inventory",
  "restart recovers detached retry without decoding retained login history",
  "close joins held retry before storage closes",
  "forced fixture body failure joins held destroy and health before SQLite close",
  "fake volume inventory ignores an in-progress atomic write but refuses corrupt canonical records",
  "reachable held freeze with refused thaw still blocks release",
  "refusal then deleted attached inventory and automatic detach emit two total notices",
  "unreachable tunnel deletes and settles session before held volume reconciliation",
  "gone startup revokes and settles spend before installed owner reconciles destroyed host disk",
  "dispatcher composition recovers a destroyed host disk from durable startup records"]},
 "hub/test/login-snapshots.test.ts": {"exact": true, "names": [
  "one login save has bounded scheduling work across ten thousand retained logins",
  "pending detection bounds binding-row work for a login with many readers",
  "third confirmed backup retains only the newest two snapshots",
  "pending binding defers scheduled and manual backups until settlement",
  "settling a binding preserves a future daily backup deadline",
  "in-use backup runs at 24 hours under freeze and thaw, including snapshot failure",
  "rate limit persists exact retry deadline and restart resumes detached backup",
  "release notification returns before detached provider work and key login names its missing disk",
  "due backup survives a stopped hub and release makes a ready detached disk eligible",
  "sign-in snapshot rate preserves its terminal outcome",
  "sign-in snapshot failed preserves its terminal outcome",
  "snapshot refuses a resolved disk with a different durable volume identity",
  "unfinished pruning resumes retained snapshot deletion without creating another backup",
  "legacy in-use row without a sign-in timestamp keeps one persisted daily deadline",
  "freeze that takes effect then rejects is still thawed and recorded",
  "release joins a held freeze and thaw before provider snapshot starts",
  "startup thaws a retained freeze and publishes its captured snapshot without another provider request",
  "ownership change after resolve await fences publication and later effects",
  "ownership change after freeze await fences publication and later effects",
  "ownership change after provider await fences publication and later effects",
  "release during held provider I/O retains confirmed thaw outcome",
  "release during held provider I/O retains unconfirmed thaw outcome",
  "fixture cleanup joins held snapshot work before database and root disposal",
  "startup keeps a freeze fenced when its host generation is replaced",
  "retained snapshot receipt from another volume is refused before publication",
  "changing volume cannot transplant an in-flight snapshot outcome onto a new disk",
  "successful provider send queued before release is refused at its final send boundary"]},
 "hub/test/login-snapshot-cli.test.ts": {"exact": true, "names": [
  "login snapshot CLI confirms a ready disk and refuses a key with no disk"]},
 "hub/test/login-records.test.ts": {"exact": true, "names": [
  "disk and key login rows round-trip every field without key disk properties",
  "change notifications identify row saves and binding-only mutations for legacy listeners",
  "refuses login transition from creating to creating naming current state",
  "refuses login transition from creating to in-use naming current state",
  "refuses login transition from ready to creating naming current state",
  "refuses login transition from ready to ready naming current state",
  "refuses login transition from ready to signed-out naming current state",
  "refuses login transition from in-use to creating naming current state",
  "refuses login transition from in-use to in-use naming current state",
  "refuses login transition from signed-out to ready naming current state",
  "refuses login transition from signed-out to in-use naming current state",
  "refuses login transition from signed-out to signed-out naming current state",
  "creating is neither free nor bound; bindings enforce exclusive writer and non-exclusive readers",
  "login syntax, uniqueness, harness and key disk constraints name their rules",
  "binding invariant: disk volume missing is a typed refusal with no partial write",
  "binding invariant: writer volume differs is a typed refusal with no partial write",
  "binding invariant: reader uses original volume is a typed refusal with no partial write",
  "binding invariant: key has volume is a typed refusal with no partial write",
  "binding invariant: exclusive second binding is a typed refusal with no partial write",
  "binding invariant: second writer is a typed refusal with no partial write"]},
 "hub/test/login-binding.test.ts": {"exact": true, "names": [
  "pool launch attaches and mounts a ready login before spawn",
  "ready key selection permits simultaneous hosts without disk bindings",
  "pool key launch carries a secret separately from persisted account environment",
  "second session reuses the binding and records login and account",
  "role account selects a project login without a local account registry",
  "mount failure unmounts and detaches before returning login to ready",
  "incomplete rollback retains durable pending fence and refuses later reuse",
  "local launch uses no login even when project disk is ready",
  "remote command overlay removes stray harness authentication variables",
  "no eligible login waits with harness before spawning",
  "concurrent launches of one harness share one mounted writer",
  "process login and mount overlay survive reopening the process table",
  "unknown mount outcome fences binding without another native mutation",
  "item pool launch preserves project account and mount through admission",
  "invalid missing-item launch never binds a login",
  "invalid invalid-name launch never binds a login",
  "invalid unknown-role launch never binds a login",
  "fresh same-host resume keeps the settled login and mount",
  "native same-host resume keeps the settled login and mount",
  "binding close joins held list to its settled receipt",
  "binding close joins held list to its unknown receipt",
  "binding close joins held attach to its settled receipt",
  "binding close joins held attach to its unknown receipt",
  "binding close joins held mount to its settled receipt",
  "binding close joins held mount to its unknown receipt",
  "a held key login never becomes a disk mount environment",
  "an item already claimed by another worker refuses before binding",
  "idle item handoff keeps the bound project account without a registry lookup",
  "settled binding with another provider is refused without native effects",
  "settled binding with another region is refused without native effects",
  "an unpinned already-limited login account refuses before native binding effects",
  "host execution maps mounted login environment while retaining logical input",
  "held binding body failure drains before borrowed storage closes",
  "explicit empty account overrides role pin and selects and reuses an unpinned login",
  "explicit account without a matching login waits before growth",
  "role account without a matching login waits before growth"]},
 "hub/test/opencode-launch-policy.test.ts": {"exact": false, "names": [
  "key spawn environment reaches native spawn but never the returned process or errors",
  "successful key launch returns only login metadata",
  "key launch preserves memory refusal identity and ownership facts",
  "key launch preserves account refusal identity and ownership facts",
  "key launch preserves authority refusal identity and ownership facts",
  "key launch preserves unknown refusal identity and ownership facts"]},
 "hub/test/login-keys.test.ts": {"exact": true, "names": [
  "key files encrypt a sentinel, reuse the store key and authenticate project and name",
  "key store refuses symlink directories and files and never overwrites a key",
  "a held key-store write fences other key creation and store-key rotation",
  "key admission registers plaintext before storing metadata and refuses invalid ciphertext without a row",
  "store key cannot rotate while a retained key login has lost its file",
  "stdin key CLI publishes metadata only and the hub retains no sentinel bytes"]},
 "hub/test/secrets.test.ts": {"exact": true, "names": [
  "hub start tightens secrets to 600 before serving",
  "hub start refuses symlinked secrets without changing their target or leaving a lock",
  "secret set accepts stdin only, list prints names and fingerprints, and unset removes one value without leaking it",
  "secret commands refuse value arguments, unknown names, empty input and malformed TOML without echoing input",
  "secret commands preserve other names through rotation and refuse symlinks on reads and writes",
  "auth store key starts the hub, lists only a fingerprint and rejects unknown auth names",
  "secret commands repair a malformed unused auth store key while startup refuses it"]},
 "hub/test/secrets-resolution.test.ts": {"exact": false, "names": []},
 "hub/test/login-capacity-list.test.ts": {"exact": true, "names": [
  "capacity counts regional exclusive disks and unlimited shared and key logins"]},
 "hub/test/host-status.test.ts": {"exact": true, "names": [
  "C1 status includes configured empty pools and zero settled spend",
  "C1/C2 status weights sessions and clips live accrual to UTC day/month, excluding reservations",
  "status ledger read drains before storage closes; setup failure=false",
  "status ledger read drains before storage closes; setup failure=true",
  "login storage accrues in its recorded pool month only without reserving spend"]},
 "hub/test/host-provider-declarations.test.ts": {"exact": true, "names": [
  "declarations reject missing fields, negative prices and misaligned minimums",
  "earliestStop respects both the created billing minimum and idle duration",
  "reusable contract rejects providers missing each declaration and invalid billing",
  "storage prices are required and identify their missing keys",
  "fake storage declarations are zero"]},
 "hub/test/host-provider-fake.test.ts": {"exact": false, "names": []},
 "hub/test/login-signin.test.ts": {"exact": true, "names": [
  "all harness sign-in plans contain only the documented home and native arguments",
  "production harness command sources contain no logout commands",
  "failed terminal sign-in 1 keeps a detached signed-out disk",
  "failed terminal sign-in null keeps a detached signed-out disk",
  "disk sign-in stays creating until unmount, snapshot and detach receipts",
  "sign-in records volume and snapshot lifetime receipts in the admitted pool"]},
 "hub/test/host-provider-digitalocean.test.ts": {"exact": false, "names": []},
 "hub/test/host-provider-digitalocean-prepare.test.ts": {"exact": false, "names": []},
 "hub/test/cli-usage-compatibility.test.ts": {"exact": false, "names": []},
 "hub/test/cli-help.test.ts": {"exact": false, "names": []},
 "hub/test/cli-command-help.test.ts": {"exact": false, "names": []},
 "hub/test/cli-usage.test.ts": {"exact": false, "names": []},
 "hub/test/web-authority.test.ts": {"exact": false, "names": []},
 "hub/test/web-authority-unit.test.ts": {"exact": false, "names": []},
 "hub/test/host-agent-closure.test.ts": {"exact": false, "names": []},
 "hub/test/host-agent-boundary.test.ts": {"exact": false, "names": []},
 "hub/test/host-contract-coverage.test.ts": {"exact": true, "names": [
  "Host contract exercises every interface member and detects an uncovered addition",
  "Host spawn contract inventory includes logFile and exited with positive omission controls",
  "Host stop option inventory detects an uncovered callback addition",
  "Host spawn option inventory detects an uncovered callback addition",
  "local Host retains no optional Claude launch or adoption implementation",
  "optional login-disk contract covers absence, refusal and exact input with planted failures",
  "optional terminal printer contract covers absence and its exact session command",
  "optional capacity contract covers absence, report delivery and unsubscribe with positive controls",
  "optional login-disk reachability preserves absent Hosts and exact boolean observations"]},
 "hub/test/test-docs.test.ts": {"exact": false, "names": []},
 "hub/test/suite-tiers.test.ts": {"exact": false, "names": []},
 "hub/test/login-exclusive-native.test.ts": {"exact": true, "names": [
  "two hosts rotate separate writer and reader files; stop deletes only the reader volume"]},
 "hub/test/login-key-spawn.test.ts": {"exact": true, "names": [
  "composed key launches on two hosts resume a persisted conversation after hub and agent restart",
  "composed fixture early failure joins native and storage before root disposal",
  "two fake hosts receive a key only at spawn and retain no plaintext through agent restart"]},
 "hub/test/host-agent.test.ts": {"exact": false, "names": [
  "admission plan excludes environment while native launch receives it"]},
 "hub/test/host-prepared.test.ts": {"exact": false, "names": []},
 "hub/test/login-write-back.test.ts": {"exact": true, "names": [
  "rotated disk reaches the next host and release closes only disk writers"]},
 "hub/test/host-create-ready.test.ts": {"exact": true, "names": [
  "C1/C2 create reaches ready with clone and tunnel and runs OpenCode; list shows declared facts",
  "C3 mismatched prelude key never registers or starts a supervisor and releases machine after gate",
  "failed readiness releases only after positive settlement: unknown",
  "failed readiness releases only after positive settlement: inventory unknown",
  "failed readiness releases only after positive settlement: timed out",
  "failed readiness releases only after positive settlement: leftovers",
  "failed readiness releases only after positive settlement: complete",
  "held final readiness cannot publish ready after revoke",
  "held final readiness cannot publish ready after shutdown",
  "forced fixture body failure joins held creation before storage and root disposal",
  "T-1746 waiting pool launch creates a leased watchdog host and is placed"]},
 "hub/test/host-destroy-native.test.ts": {"exact": true, "names": [
  "C1/C2/C3 destroy settles native session after confirming deletion; tunnel down=false",
  "C1/C2/C3 destroy settles native session after confirming deletion; tunnel down=true",
  "destroy joins an admitted held acquisition and prevents ready resurrection"]},
 "hub/test/host-restart.test.ts": {"exact": true, "names": [
  "restart keeps the live host and exits the deleted host, settles spend, and restores watchdog ownership"]},
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
  "idle stop and outage grace retain a 30s lease: spare=false recover=false",
  "idle stop and outage grace retain a 30s lease: spare=false recover=true",
  "idle stop and outage grace retain a 30s lease: spare=true recover=false",
  "idle stop and outage grace retain a 30s lease: spare=true recover=true",
  "failed lease shortening retains an owned next-tick mirror retry"]},
 "hub/test/host-stop.test.ts": {"exact": true, "names": [
  "C3 stop joins lease renewal and requires confirmed destroy: true",
  "C3 stop joins lease renewal and requires confirmed destroy: false",
  "C5 host help lists status and stop",
  "C4 manual create refuses occupied max_hosts before publishing another row"]},
 "hub/test/login-add.test.ts": {"exact": true, "names": [
  "terminal disk logins create a host, reuse it and retain only public metadata"]},
 "hub/test/host-relaunch.test.ts": {"exact": false, "names": []},
 "hub/test/host-ssh-contract.test.ts": {"exact": false, "names": []},
 "hub/test/opencode-adapter.test.ts": {"exact": false, "names": []},
 "hub/test/host-provision-gate.test.ts": {"exact": false, "names": []},
 "hub/test/cli-imports.test.ts": {"exact": false, "names": []},
 "hub/test/host-provider-volumes.test.ts": {"exact": true, "names": [
  "fake: refused snapshot authorization sends no native effect",
  "fake: snapshot history, cloning and confirmed deletion",
  "fake: volumes create, list and confirm deletion",
  "fake: volumes enforce one attachment and region binding",
  "fake: ignored volume deletion retains inventory",
  "fake: volumes rate limit snapshots until retry time",
  "mandatory volume contract rejects deletion acknowledged without removal",
  "volume inventory, attachment and snapshot pacing survive provider recreation",
  "concurrent volume attachment and snapshot calls each admit one winner",
  "fake snapshot window rejects invalid durations",
  "malformed retained volume ownership and snapshot facts fail closed without writes",
  "fake login contents survive snapshots, cloning and machine release",
  "fake snapshot deletion confirms absence and retained history fails closed",
  "surviving snapshot IDs support lookup clone and delete after volume deletion",
  "snapshot ID deletion retries history publication after provider recreation"]},
 "hub/test/host-provider-digitalocean-volumes.test.ts": {"exact": true, "names": [
  "digitalocean: refused snapshot authorization sends no native effect",
  "digitalocean: snapshot history, cloning and confirmed deletion",
  "digitalocean: volumes create, list and confirm deletion",
  "digitalocean: volumes enforce one attachment and region binding",
  "digitalocean: ignored volume deletion retains inventory",
  "digitalocean: volumes rate limit snapshots until retry time",
  "digitalocean volume create carries lon1, 1 GiB and project/pool tags",
  "digitalocean volume create requires login admission outside the fake-host fence",
  "digitalocean volume actions publish attachment only after completed",
  "digitalocean volume admission selects pool and shares the creation pause",
  "digitalocean lost volume create reply retains discoverable resource without replay",
  "digitalocean known snapshot refusal returns immediately for the exact volume identity",
  "digitalocean snapshot restore sends source region and tags; deletion needs observed absence",
  "digitalocean snapshot receipts and source project fence destructive use across restart",
  "digitalocean volume fixture closes API and retains root after rejected owner drain",
  "digitalocean snapshot restore keeps retained region when API region order changes",
  "digitalocean snapshot authorization rechecks after the actual POST pacing wait"]}
}
JSON
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("expect checked")' "$Q/expect.json"
```

The source checks (`src.mjs`), counted with `String.split` at the build. With no commit argument it reads the worktree; with one (`node "$Q/src.mjs" "$W" <commit>`) it reads that commit through `git show`, which is how T-1787's lines were re-read before its landing. At `26dc219eb` every line reads `ok` except the eleven T-1787 lines, which read `MISMATCH` (VERIFIED); at `b0903704b` and at the landing `427f522ec` all 47 read `ok` (VERIFIED in both, the landing in the drafting worktree: T-1784 11, T-1785 7, T-1786 10, T-1788 8, T-1787 11). The two accepted later commits touch no source file, so the requested dev reads the same.

```sh
cat > "$Q/src.mjs" <<'JS'
// node "$Q/src.mjs" <W> [commit]   ok, MISMATCH or MISSING per line; counts use String.split. With a commit, files are read through git show.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [W, COMMIT] = process.argv.slice(2);
const read = f => { if (COMMIT) { try { return execFileSync('git', ['-C', W, 'show', `${COMMIT}:${f}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 }); } catch { return null; } }
  return existsSync(`${W}/${f}`) ? readFileSync(`${W}/${f}`, 'utf8') : null; };
const LV = 'hub/src/host/login-verdicts.ts', SC = 'hub/src/host/scheduler.ts', PR = 'hub/src/host/pool-runtime.ts', LG = 'hub/src/host/logins.ts';
const LC = 'hub/src/host/login-cards.ts', SS = 'hub/src/adapters/sessions.ts';
const BI = 'hub/src/host/login-binding.ts', RD = 'hub/src/host/login-reader.ts', CL = 'hub/src/cli/login.ts', WA = 'hub/src/hub/web-authority.ts';
const KY = 'hub/src/host/login-keys.ts', CT = 'hub/src/adapters/contract.ts', PP = 'hub/src/host/agent/prepared.ts', AP = 'hub/src/host/agent/processes.ts', BS = 'hub/src/host/agent/bootstrap.ts', OC = 'hub/src/adapters/opencode.ts', DM = 'hub/src/hub/daemon.ts';
const DC = 'hub/src/host/provider/declarations.ts', FK = 'hub/src/host/provider/fake.ts', DO = 'hub/src/host/provider/digitalocean.ts', ST = 'hub/src/host/status.ts', CH = 'hub/src/cli/host.ts', SI = 'hub/src/host/login-signin.ts';
const C = [
  // T-1784 (login verdicts, regions and pool growth)
  ['T-1784 C1 the verdict reads metadata only', LV, 'export function loginVerdict(records:LoginRecords,input:Selection):HarnessVerdict {', '=1'],
  ['T-1784 C1 a held signed-out binding reads signed-out', LV, "if(held.some(({login})=>login.state==='signed-out'))return 'signed-out';", '=1'],
  ['T-1784 C1 a free login reads can-bind, otherwise no-login', LV, "return records.selectCapacityLogin(input)?'can-bind':'no-login';", '=1'],
  ['T-1784 C1 placement keeps serving and bindable hosts only', SC, "&& ['serves', 'can-bind'].includes(verdict(host, input.harness)))", '=1'],
  ['T-1784 C1 serving hosts sort before bindable hosts', SC, "Number(verdict(a, input.harness) !== 'serves') - Number(verdict(b, input.harness) !== 'serves')", '=1'],
  ['T-1784 C2 no free login waits for a login of the harness', SC, "if (input.canCreate && !input.canCreate(input.harness)) return { kind: 'wait', reason: `waiting for a login ${input.harness}` };", '=1'],
  ['T-1784 the retired eligibility note', SC, 'E-1535 supplies login eligibility', '=0'],
  ['T-1784 C2 creation rechecks login capacity at admission', PR, "if(cause.harness && (!pool || !this.records.logins.selectCapacityLogin({harness:cause.harness,provider:pool.provider,region:pool.region,account:cause.account})))throw new PoolCreationNotAdmitted('login capacity changed');", '=1'],
  ['T-1784 C3 a disk is free only in the pool provider and region', LG, `const row=key??this.db.prepare(sql+" and json_extract(record,'$.provider')=? and json_extract(record,'$.region')=?"+accountClause+" limit 1").get(input.harness,'disk',input.provider,input.region,...accountParameters);`, '=1'],
  ['T-1784 C4 C6 eligibility: ready, or an in-use key or shared disk; never creating', LG, `const capacityEligibleSql="pending_bindings=0 and (json_extract(record,'$.state')='ready' or (json_extract(record,'$.state')='in-use' and (json_extract(record,'$.kind')='key' or json_extract(record,'$.exclusive')=0))) and (json_extract(record,'$.kind')='key' or json_extract(record,'$.volumeId') is not null)";`, '=1'],
  ['T-1784 C5 the minimum boots without the login rule', PR, 'if (capacity < pool.minHosts && this.records.provisions.occupied(name) < pool.maxHosts) this.#scale(name);', '=1'],
  // T-1785 (waiting for a login, and the card)
  ['T-1785 C2 login changes wake placement', PR, 'this.#unsubscribeLogins=this.records.logins.onChange(()=>{if(!this.#closed)this.onCapacityChanged();});', '=1'],
  ['T-1785 C3 the card text and its two options', LC, '`Not enough ${demand.harness} logins. Create one?`, [\'Create one\', \'Not now\'], false, demand) };', '=1'],
  ['T-1785 C1 C3 cards follow the placement reason', LC, 'const match = /^waiting for a login (claude-code|codex|opencode)$/.exec(wait.reason);', '=1'],
  ['T-1785 C3 one card per pool and harness', LC, 'wanted.set(JSON.stringify([wait.pool, match[1]]), { pool: wait.pool, harness: match[1]! });', '=1'],
  ['T-1785 C4 the card withdraws when no matching wait remains', LC, "if (!wanted.has(key) && this.store.ask(card.id)?.state === 'open') this.cards.withdraw(card.id, 'No launches waiting for this login');", '=1'],
  ['T-1785 C5 Not now folds; Create one answers the login add line', LC, '? \'Not now\'\n        : `cland login add ${harness} --pool ${pool}`;', '=1'],
  ['T-1785 the waiting table reconciles the cards', SS, 'this.#loginCards.reconcile(this.#table.waitingLaunches().map(record => record.row));', '=2'],
  // T-1786 (exclusive and non-exclusive logins)
  ['T-1786 C1 an attach refused elsewhere rolls back and names the login', BI, 'throw Error(`login ${login.name}: attachment refused: ${result.reason}`);', '=1'],
  ['T-1786 C2 a second host of an in-use login is a reader', BI, "const reader=login.state==='in-use';", '=1'],
  ['T-1786 C2 the reader volume comes from the latest snapshot', BI, 'fromSnapshot:snapshot,admission:{login:login.name,project:input.project,pool:input.pool}', '=1'],
  ['T-1786 C5 no snapshot refuses naming it', BI, 'if(!snapshot)throw Error(`login ${login.name}: missing snapshot for reader`);', '=1'],
  ['T-1786 C3 reader deletion needs a confirmed delete', RD, "if((await provider.deleteVolume(volume??current.volume)).state!=='deleted')throw Error('reader deletion unconfirmed');", '=1'],
  ['T-1786 C4 an in-use login refuses set', LG, 'if(row.state===\'in-use\')throw Error(`login ${name} is ${row.state}`);', '=1'],
  ['T-1786 C4 key logins have no exclusive flag', LG, "if(row.kind!=='disk')throw Error('key login has no exclusive flag');", '=1'],
  ['T-1786 every disk login defaults to exclusive', LG, 'exclusive:input.exclusive ?? true', '=1'],
  ['T-1786 C4 the set command syntax', CL, "throw Error('usage: cland login set <name> --exclusive true|false');", '=1'],
  ['T-1786 C4 the web edge refuses login.set', WA, "'login.set': 'requires the local human CLI or Neovim',", '=1'],
  // T-1788 (key logins in the spawn environment only)
  ['T-1788 C1 the key becomes OPENCODE_API_KEY and is registered with the redactor per generation', KY, 'const value=readLoginKey(root,project,name);register([value]);return {OPENCODE_API_KEY:value};', '=1'],
  ['T-1788 C1 the spawn request carries a separate secret environment', CT, 'secretEnv?: Record<string,string>;', '=1'],
  ['T-1788 C1 C5 a key binding has an empty account environment and no attach', BI, 'return {finish:async()=>{this.#validate(input,login);return {login:login.name,account:login.account,accountEnv:{}};},rollback:async()=>{}};', '=1'],
  ['T-1788 C3 the prepared record keeps the key in memory only', PP, 'if(env.OPENCODE_API_KEY!==undefined){secretEnv.OPENCODE_API_KEY=env.OPENCODE_API_KEY;delete env.OPENCODE_API_KEY;}', '=1'],
  ['T-1788 C3 the admission plan file holds no environment', AP, "await checkpoint(join(directory, 'plan.json'), { launchId, command, args: args.args, cwd: args.cwd });", '=1'],
  ['T-1788 C3 the bootstrap uses the environment it was spawned with', BS, 'process.execve(plan.command, [plan.command, ...plan.args], env);', '=1'],
  ['T-1788 C4 a spawn error names the login with the key redacted', OC, 'err.message=`login ${p.login}: ${redact.text(err.message)}`;', '=1'],
  ['T-1788 the redactor learns every ready key at hub start', DM, 'for(const name of store.hosts.logins.keyNames())keyEnvironment(name);', '=1'],
  // T-1787 (capacity and login storage; VERIFIED at its reviewed head b0903704b)
  ['T-1787 C1 capacity is min(max_hosts, free logins)', LG, 'if(max===0||!this.selectCapacityLogin(input))return 0;', '=1'],
  ['T-1787 C1 status capacity per pool and harness', ST, 'records.logins.capacity({harness,provider:pool.provider,region:pool.region},pool.maxHosts)', '=1'],
  ['T-1787 C1 the login list capacity line', CL, 'process.stdout.write(`capacity ${pool.name}/${harness}: ${n}\\n`);', '=1'],
  ['T-1787 C2 each host lists its bound logins', ST, 'const logins=records.logins.forHost(row.id).map(binding=>({harness:records.logins.get(binding.login)!.harness,name:binding.login}));', '=1'],
  ['T-1787 C2 host status text names harness/name pairs', CH, "logins ${host.logins?.map(login=>login.harness+'/'+login.name).join(', ')||'none'}", '=1'],
  ['T-1787 C3 storage at declared prices over the month overlap', ST, "cost+=item.sizeGiB*(item.kind==='volume'?prices.volumePerGiBMonth:prices.snapshotPerGiBMonth)*overlap/(end.getTime()-month);", '=1'],
  ['T-1787 C3 storage adds to the month figure only', ST, 'if(spend.month!==null)spend.month=storageCost===null?null:spend.month+storageCost;', '=1'],
  ['T-1787 C3 sign-in records the volume lifetime in its pool', SI, "if(o.pool)o.logins.recordStorage(name,o.pool,{kind:'volume',id:volume.id,sizeGiB:volume.sizeGiB,created:volume.created,deleted:null});", '=1'],
  ['T-1787 C4 a missing storage price is refused naming the key', DC, 'if (!price(d[key])) throw new Error(`invalid host provider declaration: ${key}`);', '=1'],
  ['T-1787 C4 the fake declares zero', FK, 'export const FAKE_STORAGE_PRICES=Object.freeze({volumePerGiBMonth:0,snapshotPerGiBMonth:0});', '=1'],
  ['T-1787 DigitalOcean storage prices', DO, 'export const DIGITALOCEAN_STORAGE_PRICES=Object.freeze({volumePerGiBMonth:0.10,snapshotPerGiBMonth:0.06});', '=1'],
];
for (const [label, file, text, e] of C) {
  const t = read(file), n = t === null ? 'MISSING' : t.split(text).length - 1;
  const pass = t !== null && (e.startsWith('>=') ? n >= Number(e.slice(2)) : n === Number(e.slice(1)));
  console.log(`${pass ? 'ok' : t === null ? 'MISSING' : 'MISMATCH'} ${label} | ${file} | ${n} | ${e}`);
}
JS
node --check "$Q/src.mjs" && echo "src checked"
# ids.mjs <brief>: A-17843 — every E1535S3-NN the criteria map names exists as a row of the case or manual tables; the open landing markers
cat > "$Q/ids.mjs" <<'JS'
import { readFileSync } from 'node:fs';
const t = readFileSync(process.argv[2], 'utf8'), map = t.slice(t.indexOf('### Criteria map'), t.indexOf('## Build'));
const named = new Set(map.match(/E1535S3-\d+/g) ?? []), rows = new Set([...t.matchAll(/^\| (E1535S3-\d+) \|/gm)].map(m => m[1]));
const missing = [...named].filter(id => !rows.has(id)), marker = 'TODO(' + 'T-1787-landing)';
console.log(`criteria-map ids ${named.size}; table rows ${rows.size}; missing from the tables: ${missing.length}${missing.length ? ' ' + missing.join(' ') : ''}`);
console.log(`open landing markers: ${t.split(marker).length - 1}`);
JS
node --check "$Q/ids.mjs" && echo "ids checked"
```

The check functions for QA's own shell (`ownlines`, `s01` and `s99` come from the stage-2 brief at `M3`), and this brief's scratch functions (`body.sh` sources the kit's `helpers.sh` and `$Q/scratch.sh`, which sources `sentinels` and `r89` from `M3`):

```sh
cat > "$Q/checks.sh" <<'SH'
. "$Q/kit2-checks.sh"   # ownlines, s01, s99 from the stage-2 brief at M3
landing() { git -C "$W" log --first-parent --format=%H --grep "^Item: $1\$" "$S"; }
BASE=18911bda46c7c0dc332619e93d25041069d3704a   # the tracker commit before the stage's first landing (the parent of T-1786's landing; also M3)
MEMBERS="T-1784 T-1785 T-1787 T-1786 T-1788"
STAGE="capacity, the login wait and its card, exclusive logins and keys at spawn"
WROTE=26dc219ebfa4882a50750397ba14fe08c8ee9562    # the dev this brief was written at
LANDED=427f522ec88e9ad77d4fa39257a650980c383422   # T-1787's landing, the last member landing; exactly two Coordinator commits may follow it
# durdelta <commit>: hub/test/durations.json at <commit> against its parent: entries outside allow, removed allowances, renewals, reason-only corrections, and the changed allowance keys (up to ten)
durdelta() { git -C "$W" show "$1^:hub/test/durations.json" > "$Q/dur-a.json"; git -C "$W" show "$1:hub/test/durations.json" > "$Q/dur-b.json"
  node -e 'const fs=require("fs"),[a,b]=process.argv.slice(1).map(f=>JSON.parse(fs.readFileSync(f,"utf8"))),eq=(x,y)=>JSON.stringify(x)===JSON.stringify(y);let changed=0,added=0,removed=0,renewed=0,reasonOnly=0,allowAdded=0;const keys=[];for(const m of ["budget","files","tests"]){const x=a[m]??{},y=b[m]??{};for(const k of Object.keys(x))if(!(k in y)||!eq(x[k],y[k]))changed++;added+=Object.keys(y).filter(k=>!(k in x)).length}const x=a.allow??{},y=b.allow??{};for(const k of Object.keys(x)){if(!(k in y)){removed++;continue}if(!eq(x[k],y[k])){keys.push(k);if(x[k].seconds===y[k].seconds&&x[k].owner===y[k].owner&&Date.parse(y[k].expires)>=Date.parse(x[k].expires))renewed++;if(eq({...x[k],reason:null},{...y[k],reason:null}))reasonOnly++}}allowAdded=Object.keys(y).filter(k=>!(k in x)).length;console.log("entries outside allow changed or removed "+changed+"; added "+added+"; allowances removed "+removed+"; changed "+keys.length+" (renewals keeping seconds and owner "+renewed+"; reason-only "+reasonOnly+"); added "+allowAdded+"; version same "+(a.version===b.version));if(keys.length&&keys.length<=10)for(const k of keys)console.log("      changed allowance: "+k)' "$Q/dur-a.json" "$Q/dur-b.json"; }
# preserved: consumer test files no stage landing may edit (VERIFIED unedited from BASE to b0903704b and to 427f522ec)
preserved() { printf '%s\n' hub/test/host-restart-reconcile.test.ts hub/test/host-create-entry.test.ts hub/test/host-create-admission.test.ts hub/test/host-provision-recovery.test.ts hub/test/host-lease.test.ts hub/test/host-destroy.test.ts hub/test/waiting-launch-restart.test.ts hub/test/waiting-launch-store.test.ts hub/test/waiting-launches-owner.test.ts hub/test/connection-snapshot.test.ts hub/test/hub-cards.test.ts hub/test/login-release.test.ts hub/test/login-snapshots.test.ts hub/test/login-snapshot-cli.test.ts hub/test/login-records.test.ts hub/test/login-keys.test.ts hub/test/secrets.test.ts hub/test/secrets-resolution.test.ts hub/test/host-provider-digitalocean.test.ts hub/test/host-provider-digitalocean-prepare.test.ts hub/test/cli-usage-compatibility.test.ts hub/test/cli-help.test.ts hub/test/cli-command-help.test.ts hub/test/cli-usage.test.ts hub/test/web-authority.test.ts hub/test/web-authority-unit.test.ts hub/test/host-agent-closure.test.ts hub/test/host-agent-boundary.test.ts hub/test/host-contract-coverage.test.ts hub/test/host-prepared.test.ts hub/test/login-write-back.test.ts hub/test/host-create-ready.test.ts hub/test/host-destroy-native.test.ts hub/test/host-restart.test.ts hub/test/host-unreachable.test.ts hub/test/host-stop.test.ts hub/test/login-add.test.ts hub/test/host-relaunch.test.ts hub/test/host-ssh-contract.test.ts hub/test/opencode-adapter.test.ts hub/test/host-provision-gate.test.ts hub/test/cli-imports.test.ts hub/test/host-provider-volumes.test.ts hub/test/host-provider-digitalocean-volumes.test.ts; }
s00() {   # build, plan and landing receipts
  echo "PRE HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) request $S"
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
  git -C "$R" status --porcelain | grep -v ' \.cland/tasks/' > "$EV/root-status-before.txt"; echo "root non-tracker entries $(wc -l < "$EV/root-status-before.txt" | tr -d ' ')"
  (cd "$R" && node "$W/hub/bin/cland.ts" task plan show E-1535 --json) > "$EV/plan.json"; echo "plan read exit $?"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=(v.stages??[]).find(x=>x.name===process.argv[2]);console.log(s?JSON.stringify({name:s.name,state:s.state,qa:s.qa,items:s.items,merged:s.merged,total:s.total,statuses:s.statuses,cover:s.cover}):"stage missing")' "$EV/plan.json" "$STAGE" | tee "$EV/stage-members.json"
  for id in $(node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log((v.items??[]).join(" "))' "$EV/stage-members.json"); do echo "$id landings $(landing "$id" | wc -l | tr -d ' ') $(landing "$id" | head -n 1)"; done
}
s02() {   # landing diffs (read-only), the stage-wide invariants, the landing check and every first-parent commit of the stage
  for id in $MEMBERS; do L=$(landing "$id" | head -n 1); echo "$id landing ${L:-none}"; [ -n "$L" ] || continue
    echo "$id test paths: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- hub/test nvim/test web/test | tr '\n' ' ')"
    echo "$id product paths: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- hub/src hub/bin shared nvim/lua web/src | tr '\n' ' ')"
    echo "$id package.json and lockfiles: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- package.json package-lock.json hub/package.json web/package.json | wc -l | tr -d ' ')"
    echo "$id preserved files edited at its landing: [$(git -C "$W" diff --name-only "${L}^1" "${L}" -- $(preserved) | tr '\n' ' ')]"
  done
  echo "stage paths under nvim/ or web/: [$(git -C "$W" diff --name-only "$BASE" "$S" -- nvim web | tr '\n' ' ')]"
  echo "remote authority table changed in the stage: [$(git -C "$W" diff --name-only "$BASE" "$S" -- hub/src/remote/authority.ts | tr '\n' ' ')]"
  echo "fixture producers changed in the stage: [$(git -C "$W" diff --name-only "$BASE" "$S" -- nvim/test/stub-hub.ts nvim/test/client.ts nvim/test/fixture.ts shared/fixture-ownership.ts | tr '\n' ' ')]"
  for pair in "T-1786 e9ec2f1cfd16b9547399648b13d2cb4ba7867546" "T-1784 3be2cf5a0e219efeb67331e81569fd08c4253106" "T-1788 57ea802879e5a88028ddf698521d2cc93157c8a0" "T-1785 35aeccff372f7d29c31957c88a4f56da1dcb1d4d" "T-1787 ${T1787_TIP:-b0903704b63487d91b2e14f381881c7391d3362e}"; do set -- $pair; id=$1; head=$2; L=$(landing "$id" | head -n 1)
    [ -n "$L" ] && git -C "$W" cat-file -e "$head^{commit}" 2> /dev/null || { echo "$id landing ${L:-none} tip $head: BLOCKED (no landing or no tip)"; continue; }
    F=$(git -C "$W" diff --name-only "$L^1" "$L" | grep -v '^\.cland/' | tr '\n' ' ')
    echo "$id own lines at its landing $L equal its tip $head: $(ownlines "$L" "$head")"
    echo "$id files byte-identical to $head at its landing: $(git -C "$W" diff --quiet "$head" "$L" -- $F && echo yes || echo "no: $(git -C "$W" diff --name-only "$head" "$L" -- $F | tr '\n' ' ')")"
    echo "$id commits after its landing touching its files: [$(git -C "$W" log --format=%h "$L..$S" -- $F | tr '\n' ' ')]"; done
  echo "writing dev is an ancestor of the request: $(git -C "$W" merge-base --is-ancestor "$WROTE" "$S" && echo yes || echo no)"
  echo "first-parent commits from BASE to the request: $(git -C "$W" rev-list --first-parent --count "$BASE..$S"); after the writing dev: $(git -C "$W" rev-list --first-parent --count "$WROTE..$S")"
  for c in $(git -C "$W" rev-list --first-parent --reverse "$BASE..$S"); do
    it=$(git -C "$W" log -1 --format=%B "$c" | grep -E '^Item: ' | tr '\n' ' ')
    if [ -n "$it" ]; then echo "  commit $(git -C "$W" rev-parse --short=9 "$c") items [$it] paths $(git -C "$W" diff --name-only "$c^1" "$c" | wc -l | tr -d ' ')"
    else echo "  commit $(git -C "$W" rev-parse --short=9 "$c") items [] paths [$(git -C "$W" diff --name-only "$c^1" "$c" | tr '\n' ' ')]"
      git -C "$W" diff --name-only "$c^1" "$c" | grep -q -x hub/test/durations.json && echo "    $(durdelta "$c")"; fi; done
  echo "T-1787 landings $(landing T-1787 | wc -l | tr -d ' ')"
  echo "T-1787's landing is an ancestor of the request: $(git -C "$W" merge-base --is-ancestor "$LANDED" "$S" && echo yes || echo no); first-parent commits after it: $(git -C "$W" rev-list --first-parent --count "$LANDED..$S")"
  for c in $(git -C "$W" rev-list --first-parent --reverse "$LANDED..$S"); do P=$(git -C "$W" diff --name-only "$c^1" "$c")
    k=other; git -C "$W" log -1 --format=%B "$c" | grep -q -E '^Item: ' || { printf '%s\n' "$P" | grep -q -v -x -E 'qa/briefs/E-1535-stage-3\.md|hub/test/durations\.json' || k=brief-and-durations; printf '%s\n' "$P" | grep -q -v -x -E '\.cland/tasks/[^/]+\.md' || k=tracker; }
    echo "  after landing $(git -C "$W" rev-parse --short=9 "$c") class $k paths $(printf '%s\n' "$P" | grep -c .)"; done
}
s05() {   # tree-wide absence checks at the build (read-only git; the briefs and the tracker excluded, the stage-2 run-1 rule)
  echo "retired eligibility note outside the tracker and the briefs: $(git -C "$W" grep -n -F 'E-1535 supplies login eligibility' "$S" -- . ':!.cland' ':!qa/briefs' | wc -l | tr -d ' ')"
  echo "storage price keys outside the declarations, the two providers and status: $(git -C "$W" grep -n -E 'volumePerGiBMonth|snapshotPerGiBMonth' "$S" -- hub/src shared ':!hub/src/host/provider/declarations.ts' ':!hub/src/host/provider/fake.ts' ':!hub/src/host/provider/digitalocean.ts' ':!hub/src/host/status.ts' | wc -l | tr -d ' ')"
  echo "storage in the hosts spend reservation module: $(git -C "$W" show "${S}:hub/src/executor/droplet/spend.ts" | grep -c -i storage)"
  echo "OPENCODE_API_KEY in the host agent's durable plan and record writers: $(git -C "$W" show "${S}:hub/src/host/agent/processes.ts" | grep -c -F 'OPENCODE_API_KEY')"
  echo "logout commands in production source: $(git -C "$W" grep -n -E 'codex[[:space:]]+logout|claude[[:space:]]+auth[[:space:]]+logout|/logout' "$S" -- hub/src shared | wc -l | tr -d ' ')"
}
s06() {   # evidence to read, never to start: member verify receipts, merge-batch logs, the stage covers
  for pair in "T-1784 3be2cf5a0e219efeb67331e81569fd08c4253106" "T-1785 35aeccff372f7d29c31957c88a4f56da1dcb1d4d" "T-1786 e9ec2f1cfd16b9547399648b13d2cb4ba7867546" "T-1788 57ea802879e5a88028ddf698521d2cc93157c8a0" "T-1787 ${T1787_TIP:-b0903704b63487d91b2e14f381881c7391d3362e}"; do set -- $pair
    (cd "$R" && node "$W/hub/bin/cland.ts" task view "$1" --json) | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const v=JSON.parse(s).item.verify??{};console.log(process.argv[1]+" verify "+v.id+" executor "+v.executor+" state "+v.state+" result "+v.result+" artifact "+v.artifact+" head is the reviewed tip "+(v.head===process.argv[2]))})' "$1" "$2"; done
  for id in a1741ee3-b2fa-4092-88f2-b08dba19607e ff809349-1351-4b13-94db-9d257c860106 d38f3f52-ac9e-4349-bc6c-8df676d6b0b2 d0622810-120b-4c05-8c13-f11053de81da ${T1787_BATCH:-9b73bc7d-d095-4323-a2c5-ab0ad8f630a4} $(node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log([s.cover?.linux,s.cover?.macos].filter(Boolean).join(" "))' "$EV/stage-members.json"); do
    for f in $(ls "$R/.cland/artifacts" | grep -F -- "-suite-$id-"); do
      node -e 'const fs=require("fs"),t=fs.readFileSync(process.argv[1],"utf8"),line=t.split("\n").find(l=>l.startsWith("suite provenance "));let p={};try{p=JSON.parse(line.slice(17))}catch{}const fails=t.split("\n").filter(l=>/^ℹ fail [1-9]/.test(l)).length,zero=t.split("\n").filter(l=>/^ℹ fail 0$/.test(l)).length,workers=(t.match(/^Workers \d+[^\n]*/m)??["none"])[0];console.log(process.argv[2]+" "+process.argv[1].split("/").pop().slice(0,8)+" head "+p.head+" occasion "+p.occasion+" executor "+p.executor+" os "+(p.platform??{}).os+" failing phase lines "+fails+"; passing phase lines "+zero+"; "+workers+"; head is the request "+(p.head===process.argv[3]))' "$R/.cland/artifacts/$f" "$id" "$S"; done; done
}
SH
cat > "$Q/scratch.sh" <<'SH'
# this stage's scratch rows; cland, hp, hubstart, up, alive, run, has, there, cnt, dg and machines come from the kit's helpers.sh; sentinels and r89 from the stage-2 brief at M3
. "$QA_Q/kit2-scratch.sh"
SENT=E1535S3-sentinel-key-0001     # fixture strings, never a real key
SENT2=E1535S3-sentinel-key-0002
r80() {   # p1: a Git repository, cland init, one fake pool with no minimum written while the hub is stopped, then one CLI-started hub
  echo "PRE p1 entries $(ls -A "$QA_Q/p1" | wc -l | tr -d ' ')"
  cd "$QA_Q/p1" || return 1
  git init -q -b dev && git commit -q --allow-empty -m init; echo "git exit $?"
  cland init . > "$QA_EV/E1535S3-80-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1; echo "hub after init and stop: $(up)"
  echo "qa pool tables before: $(cnt .cland/config.toml '[hosts.qa]')"
  printf '%s\n' '' '[hosts.qa]' 'provider = "fake"' 'size = "fake"' 'region = "fake-1"' 'min_hosts = 0' 'max_hosts = 2' >> .cland/config.toml
  echo "qa pool tables written: $(cnt .cland/config.toml '[hosts.qa]')"
  hubstart; echo "hub start exit $?; hub $(up)"
  run "(host list json)" cland host list --json; node -e 'let v;try{v=JSON.parse(require("fs").readFileSync(process.env.QA_Q+"/r.out","utf8"))}catch{console.log("  host rows: not JSON");process.exit(0)}console.log("  host rows "+(Array.isArray(v)?v.length:"not an array"))'
  echo "  fake machines $(machines)"
  echo "auth directory before any key login: $(there .cland/auth)"
}
r81() {   # T-1788 C2 at rest, T-1784 C4 and T-1787 C1 on the real CLI: two key logins from stdin, then the capacity line of the qa pool
  cd "$QA_Q/p1" || return 1
  printf '%s\n' "$SENT" > "$QA_Q/sent.in"; printf '%s\n' "$SENT2" > "$QA_Q/sent2.in"
  run "(key add 1)" cland login add opencode --kind key < "$QA_Q/sent.in"; echo "  added lines $(has 'added key login opencode-1')"
  run "(key add 2)" cland login add opencode --kind key --name keytwo < "$QA_Q/sent2.in"; echo "  added lines $(has 'added key login keytwo')"
  echo "  key files $(ls -A .cland/auth | grep -c '\.key$')"
  for s in "$SENT" "$SENT2"; do sentinels "$s"; done
  run "(login list text)" cland login list; echo "  capacity lines $(has 'capacity ')"; echo "  qa opencode capacity lines $(has 'capacity qa/opencode: 2')"; echo "  sentinel lines $(has "$SENT")"
  run "(login list json)" cland login list --json; cp "$QA_Q/r.out" "$QA_Q/logins-before.json"
  node -e 'let v;try{v=JSON.parse(require("fs").readFileSync(process.env.QA_Q+"/r.out","utf8"))}catch{console.log("  json rows: not JSON");process.exit(0)}const has=(r,k)=>Object.hasOwn(r,k)?JSON.stringify(r[k]):"absent";for(const r of v)console.log("  json row "+r.name+": harness "+r.harness+"; kind "+r.kind+"; state "+r.state+"; exclusive "+has(r,"exclusive")+"; storage "+has(r,"storage")+"; bindings "+(r.bindings??[]).length)'
}
r82() {   # T-1786 C4 neighbours and T-1787 C1, C3 on the real CLI: login set refusals, then host status capacity and storage with no host
  cd "$QA_Q/p1" || return 1
  run "(set a key login)" cland login set opencode-1 --exclusive false; echo "  no-flag lines $(has 'key login has no exclusive flag')"
  run "(set a bad value)" cland login set opencode-1 --exclusive maybe; echo "  usage lines $(has 'usage: cland login set <name> --exclusive true|false')"
  run "(set an unknown login)" cland login set nosuch --exclusive true; echo "  sentinel lines $(has "$SENT")"
  run "(login list after refusals)" cland login list --json
  node -e 'const fs=require("fs");let a,b;try{a=JSON.parse(fs.readFileSync(process.env.QA_Q+"/logins-before.json","utf8"));b=JSON.parse(fs.readFileSync(process.env.QA_Q+"/r.out","utf8"))}catch{console.log("  rows: not JSON");process.exit(0)}let same=true;try{require("assert").deepStrictEqual(b,a)}catch{same=false}console.log("  rows unchanged by the refusals "+same)'
  run "(host status json)" cland host status --json
  node -e 'let v;try{v=JSON.parse(require("fs").readFileSync(process.env.QA_Q+"/r.out","utf8"))}catch{console.log("  status: not JSON");process.exit(0)}for(const p of (v.pools??[]))console.log("  pool "+p.name+": capacity "+JSON.stringify(p.capacity)+"; storage "+p.storage+"; hostCount "+p.hostCount+"; spend month "+(p.spend??{}).month)'
  run "(host status text)" cland host status; echo "  sentinel lines $(has "$SENT")"
}
r83() {   # T-1788 at hub start and T-1783 C2 across a real restart: two ready keys registered at start, secret list fingerprint only, rows retained, no sentinel byte
  cd "$QA_Q/p1" || return 1
  P1=$(hp); cland hub stop > /dev/null 2>&1; echo "hub after stop: $(up)"
  hubstart; echo "hub start exit $?; hub $(up); new hub pid $([ "$(hp)" != "$P1" ] && echo yes || echo no)"
  run "(secret list)" cland secret list; echo "  auth.key lines $(has 'auth.key')"
  node --input-type=module -e 'const fs=await import("node:fs");const {readSecretsFile}=await import(process.env.QA_W+"/hub/src/remote/secrets.ts");const k=readSecretsFile(process.cwd())["auth.key"];const t=["r.out","r.err"].map(f=>{try{return fs.readFileSync(process.env.QA_Q+"/"+f,"utf8")}catch{return ""}}).join("\n");console.log("  store key present "+(typeof k==="string"&&k.length>0)+"; store key value occurrences in the listing "+(k?t.split(k).length-1:"n/a"))'
  run "(login list json after restart)" cland login list --json
  node -e 'const fs=require("fs");let a,b;try{a=JSON.parse(fs.readFileSync(process.env.QA_Q+"/logins-before.json","utf8"));b=JSON.parse(fs.readFileSync(process.env.QA_Q+"/r.out","utf8"))}catch{console.log("  rows: not JSON");process.exit(0)}let same=true;try{require("assert").deepStrictEqual(b,a)}catch{same=false}console.log("  rows unchanged across the restart "+same)'
  for s in "$SENT" "$SENT2"; do sentinels "$s"; done
}
SH
. "$Q/checks.sh"; bash -n "$Q/scratch.sh" && echo "scratch checked"
```

Expected: `expect checked`, `src checked`, `ids checked`, `scratch checked`. Record the setup in `S0`. `T1787_TIP` defaults to T-1787's reviewed head `b0903704b63487d91b2e14f381881c7391d3362e` (VERIFIED: `rev-35-1787-source-2` and `rev-35-1787-final-1` cleared that head, and the landing's `Reviewed-by` trailer names `rev-35-1787-final-1`); `T1787_BATCH` defaults to T-1787's merge-batch suite `9b73bc7d-d095-4323-a2c5-ab0ad8f630a4` (VERIFIED: A-18585 and A-18586, identical copies, carry `CHANGES/T-1787-login-storage.md` among the deciding files). QA sets neither unless the request names them.

**Cleanup, in this order (carried).** Step 1, after E1535S3-89 passes: inventory each dead T-1676 residue entry in `$T` (hub and spoke fallback sockets, a fixture-owner receipt directory) with its type, receipt count, owner PIDs (absent), open handles (`lsof`, none) and recorded fixture roots (gone), attribute it to its row by the per-file inventories and remove it by its literal path. If any inventory shows a new own-family name, step 1 removes nothing and step 3 keeps `$Q`, `$T` and the worktree for the requester. **Nothing in `$ST` or `/private/tmp` outside `$Q` and `$T` is removed, ever** (the T-1805 receipt and the T-1806 socket directories included). Step 2: run and record E1535S3-99 with `$Q` and `$T` still present. Step 3, after the verdict: print `$Q` and check it begins with `/private/tmp/q53-`, then remove it by that literal path with a non-force recursive remove; print `$T`, check it begins with `/private/tmp/qa-e1533-s3-` and holds nothing but `node-compile-cache`, and remove it by that literal path; remove the worktree with `git -C "$R" worktree remove "$W"` (its `node_modules` symlink first, by literal path, if Git refuses). Secrets in `$Q/p1/.cland/hub.json`, `$Q/p1/.cland/secret`, `$Q/p1/.cland/secrets.toml` and `$Q/p1/.cland/auth/` are never printed or posted.

## Cases

Every case is one or more named test files run once at the build, from QA's own shell through `nt` (sealed, `TMPDIR=$T`) or `ns` (standard environment, one preservation slot per file), recorded with `qa-record.sh note` (surface `hub-api`), its evidence `$EV/<id>.log`, `$EV/<id>.check.txt`, `$EV/<id>.inv/` (the name sets), `$EV/<id>.inventory-delta.txt` and, for `ns`, `$EV/<id>.slots.txt` and `$EV/<id>.receipts.txt`. A case passes only when every check line reads `CLEAN` (exit 0; `fail`, `cancelled`, `skipped` and `todo` 0; `pass` equal to `tests`; every listed name `ok`; for an `exact` list, the plan equal to the list and no unlisted name) and its delta reads `own-family new entries in all files: 0`. A missing file is a FAIL naming the file. A `fresh: BLOCKED` or `std: BLOCKED` line makes the row BLOCKED; a `std: slot limit` line makes it INCONCLUSIVE. Run in table order; never two files at once. Tiers are read from `hub/test/tiers.json` at `26dc219eb` (VERIFIED; `login-capacity-list` at `b0903704b`). Own-family patterns are VERIFIED from each file's allocation calls (`tempProject(t,'hc-','/tmp')` in `hub/test/host-create-fixture.ts`; `tempProject`'s default prefix `cland-proj-` in `hub/test/harness.ts`; the `mkdtemp(join(tmpdir(),'<prefix>'))` calls in the files named), except where a row says INFERRED. A slow but positive file is recorded with its wall time, never failed (plain `node --test` enforces no budget; T-1801, T-1807 and T-1809 are the known slow classes).

| case | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1535S3-10 | hub-api | QA | `nt E1535S3-10 hub/test/login-capacity.test.ts hub/test/host-scheduler.test.ts hub/test/host-provision-records.test.ts` | Each `CLEAN` (T2, T1, T1; in-memory SQLite `LoginRecords` and `PoolRuntime` with injected creation; no native process). `login-capacity` exact 17: test `exclusive login in use holds demand growth below max_hosts` (T-1784 C2); the `wrong region` and `creating` expansions of `<label> login supplies no pool capacity` (C3, C6); test `settled bindings serve first and pending bindings cannot serve` (C1); the `shared` and `key` expansions of `<kind> login permits every pool host and further growth` (C4); test `minimum creates hosts without any login` (C5); test `login verdict classifies a retained signed-out binding and refuses region drift` (C1, C3); test `demand create rechecks login capacity at the creator admission boundary`; the three account-pin cases, the counter, index, migration and bounded-read cases. `host-scheduler` exact 10 with test `healthy binding precedes can-bind and bindable room precedes creation` and test `non-serving hosts are skipped for each verdict and default serves every harness` (C1). `host-provision-records` (edited by T-1784, two lines) `CLEAN`. `$T` deltas: one `login-capacity-` root allocated and removed by the reopen case, so no new entry (its note; INFERRED) |
| E1535S3-11 | hub-api | QA | `nt E1535S3-11 hub/test/pool-scale.test.ts hub/test/pool-failures.test.ts hub/test/pool-idle-stop.test.ts hub/test/pool-spend-cap.test.ts hub/test/session-pool-placement.test.ts hub/test/login-host-pin.test.ts hub/test/login-provision-bind.test.ts hub/test/login-selection.test.ts` | Each `CLEAN` (T2 each; all edited by T-1784, `pool-idle-stop` and `login-selection` also by T-1787, `login-selection` also by T-1788). `pool-scale` with the `account` and `harness` expansions of `current role <change> change prevents obsolete create admission after held preparation`; the pool fixtures seed login capacity through `hub/test/settled-login-fixture.ts`, so placement, failure, idle-stop and spend-cap assertions are unchanged. `login-host-pin` exact 13 with test `login add creates a host while its only login is still creating` (T-1784 C5, C6). `login-provision-bind` exact 19 with test `missing login holds demand without creating a host` (T-1784 C2; T-1780's cases otherwise unchanged). `login-selection` exact 3 with test `status reads decode current storage only and bound harness work across retained history` (T-1787 C2; VERIFIED at `427f522ec`) and the two launch-selection cases (T-1788's ready-key enumeration controls inside them) |
| E1535S3-12 | hub-api | QA | `nt E1535S3-12 hub/test/host-restart-reconcile.test.ts hub/test/host-create-entry.test.ts hub/test/host-create-admission.test.ts hub/test/host-provision-recovery.test.ts hub/test/host-lease.test.ts hub/test/host-destroy.test.ts` | Each `CLEAN` (T2 each; all unedited, VERIFIED `preserved`): direct consumers of `hub/src/host/pool-runtime.ts` (T-1784) and `hub/src/host/provision-host.ts` (T-1786's release obligation) through the fake provider; earlier stage briefs ran them in this seal (INFERRED from `qa/briefs/E-1533-stage-3.md` and `qa/briefs/E-1534-stage-3.md`). A failure is a regression against T-1784 or T-1786, named from the failing case |
| E1535S3-20 | hub-api | QA | `nt E1535S3-20 hub/test/login-wait.test.ts hub/test/waiting-launch.test.ts hub/test/waiting-launch-restart.test.ts hub/test/waiting-launch-store.test.ts hub/test/waiting-launches-owner.test.ts hub/test/connection-snapshot.test.ts hub/test/hub-cards.test.ts` | Each `CLEAN` (T2, T2, T2, T1, T1, T2, T2; embedded `projectHub`, FakeClock, in-process harnesses, the test messenger, injected sign-in and host creation). `login-wait` exact 7: test `login waits share one create card and the final cancellation withdraws it` (T-1785 C1, C3, C4); test `login cards are scoped by pool and harness across repeated scheduler passes` (C3); test `login add ready receipt wakes host growth, changes the reason and places the launch` (C2, C4); the `1`, `2` and `decline` expansions of `login card option <option> folds once across retries and restart` (C5 and Create one's answer); test `open login card survives restart and a later independent wait gets a new card` (C3, C4). `waiting-launch` with test `login wait card adds one ask and cancellation frees the reserved name`. The other five are unedited consumers of `sessions.ts`, the waiting table and the cards (VERIFIED `preserved`). `$T` deltas: `cland-proj-` roots back to zero (its note; INFERRED) |
| E1535S3-30 | hub-api | QA | `nt E1535S3-30 hub/test/login-exclusive.test.ts hub/test/login-list.test.ts hub/test/login-release.test.ts hub/test/login-snapshots.test.ts hub/test/login-snapshot-cli.test.ts hub/test/login-records.test.ts` | Each `CLEAN` with its exact list (T2, T2, T2, T2, T2, T1; disposable roots, directory-only provider volumes, recording Hosts, FakeClock). `login-exclusive` exact 24 (one nested subtest): test `exclusive login refuses a second host and attached-elsewhere refusal preserves metadata` (T-1786 C1); test `non-exclusive login binds a writer and a reader cloned from its latest snapshot` (C2); test `reader release deletes its clone before removing the binding, retaining the writer` and test `reader deletion without a receipt retains the binding until confirmed` (C3); test `local login set CLI changes idle disks and refuses an in-use disk; list shows every host` (C4); test `reader without snapshot refuses naming the login and missing snapshot` (C5); the restart, lost-response and installed-owner recoveries. `login-list` exact 2 (edited: `login.set` joins the refused edge frames). `login-release` exact 24, `login-snapshots` exact 27, `login-snapshot-cli` exact 1 and `login-records` exact 20: unedited consumers of T-1786's `login-release.ts`, `login-release-owner.ts` and `logins.ts` and of T-1787's `login-snapshots.ts` storage receipts (VERIFIED `preserved`). Record the wall time of the `login-snapshots` ten-thousand-login case (T-1809; never a failure here) |
| E1535S3-40 | hub-api | QA | `nt E1535S3-40 hub/test/login-binding.test.ts hub/test/opencode-launch-policy.test.ts hub/test/login-keys.test.ts hub/test/secrets.test.ts hub/test/secrets-resolution.test.ts` | Each `CLEAN` (T2, T2, T2, T2, T1). `login-binding` exact 36 (one nested subtest): test `pool key launch carries a secret separately from persisted account environment` (T-1788 C1, C2, C4, C5: public launch, secret-free replies and database, a real `projectHub` restart with a rotated key file, human `host.stop` leaving the key ready with no bindings, hub log and journal scans); test `ready key selection permits simultaneous hosts without disk bindings` (T-1788 C5, T-1784 C4); test `no eligible login waits with harness before spawning` (T-1784 C2); the `explicit` and `role` expansions of `<pin> account without a matching login waits before growth`; T-1778's and T-1780's cases otherwise unchanged. `opencode-launch-policy` with test `key spawn environment reaches native spawn but never the returned process or errors`, test `successful key launch returns only login metadata` and the four expansions of `key launch preserves <kind> refusal identity and ownership facts` (T-1788 C4). `login-keys` exact 6 and `secrets` exact 7 (unedited consumers of T-1788's `login-keys.ts`) |
| E1535S3-50 | hub-api | QA | `nt E1535S3-50 hub/test/login-capacity-list.test.ts hub/test/host-status.test.ts hub/test/host-provider-declarations.test.ts hub/test/host-provider-fake.test.ts hub/test/login-signin.test.ts hub/test/host-provider-digitalocean.test.ts hub/test/host-provider-digitalocean-prepare.test.ts` | Each `CLEAN` (T2, T2, T1, T2, T1, T2, T2; the T-1787 files byte-identical at its landing `427f522ec`, VERIFIED). `login-capacity-list` exact 1: test `capacity counts regional exclusive disks and unlimited shared and key logins` (T-1787 C1: `capacity agents/codex: 2`, `capacity agents/claude-code: 3`, `capacity agents/opencode: 3`, then codex 0 after binds). `host-status` exact 5: test `C1/C2 status weights sessions and clips live accrual to UTC day/month, excluding reservations` (C2: `logins codex/codex-z-host`) and test `login storage accrues in its recorded pool month only without reserving spend` (C3: storage 0.08, today 0). `host-provider-declarations` exact 5 with test `storage prices are required and identify their missing keys` and test `fake storage declarations are zero` (C4). `host-provider-fake` (edited declaration fixture). `login-signin` exact 6 with test `sign-in records volume and snapshot lifetime receipts in the admitted pool` (C3). `host-provider-digitalocean` and `host-provider-digitalocean-prepare` are unedited consumers of the declarations and `digitalocean.ts` (VERIFIED `preserved`); the T-1770 signature is the only rerun |
| E1535S3-55 | hub-api | QA | `nt E1535S3-55 hub/test/cli-usage-compatibility.test.ts hub/test/cli-help.test.ts hub/test/cli-command-help.test.ts hub/test/cli-usage.test.ts hub/test/web-authority.test.ts hub/test/web-authority-unit.test.ts` | Each `CLEAN` (T1, T2, T1, T1, T2, T1; all unedited, VERIFIED `preserved`). They hold the frozen usage fixture `hub/test/fixtures/cli-usage/commands.json`, migrated by T-1786 (`login set`) and T-1787 (the `login list` and `host status` lines, landed in `427f522ec`, VERIFIED), and the web edge's refusal table (`login.set` refused, `hub/src/hub/web-authority.ts`) |
| E1535S3-56 | hub-api | QA | `nt E1535S3-56 hub/test/host-agent-closure.test.ts hub/test/host-agent-boundary.test.ts hub/test/host-contract-coverage.test.ts hub/test/test-docs.test.ts hub/test/suite-tiers.test.ts` | Each `CLEAN` (T1 each; unedited, VERIFIED `preserved`). `host-agent-closure` and `host-agent-boundary` hold `hub/src/host/agent/closure.json`, regenerated by T-1788 (`bootstrap.ts`, `prepared.ts`, `processes.ts` digests), and the agent import policy; `host-contract-coverage` exact 9. `test-docs` and `suite-tiers`: every new stage file has its per-file note under `docs/agents/tests/`, its index row and its tier (`login-capacity`, `login-wait`, `login-exclusive`, `login-capacity-list` T2; `login-exclusive-native`, `login-key-spawn` T3; VERIFIED in `hub/test/tiers.json`, the last T2 at `b0903704b`) |
| E1535S3-60 | hub-api | QA | `ns E1535S3-60 '^login-exclusive-' hub/test/login-exclusive-native.test.ts` | `CLEAN` with its exact list (T3; two fake agents and the existing fake Codex binaries in a disposable root; the directory provider). Test `two hosts rotate separate writer and reader files; stop deletes only the reader volume`: sign-in seeds the original, a snapshot seeds the reader clone, each host performs a native rotating-file turn, native completion precedes destruction, the original holds only the writer's turn, inventory confirms the clone absent and the original detached (T-1786 C2, C3). **Inventory:** own-family 0 (`login-exclusive-` in `$ST`, its `mkdtemp`). New `cland-h-*` names are T-1806 |
| E1535S3-61 | hub-api | QA | `ns E1535S3-61 "$OWN61" hub/test/login-key-spawn.test.ts` | `CLEAN` with its exact list (T3; plan 3, one nested subtest; two directory-backed fake hosts, fake agents and the fake OpenCode `key-proof` command printing only a SHA-256 digest). Test `two fake hosts receive a key only at spawn and retain no plaintext through agent restart` and test `composed key launches on two hosts resume a persisted conversation after hub and agent restart` (T-1788 C1, C2, C5: native digest equal to the sentinel's on both hosts, every regular file under the fixture root and the captured argv scanned with a planted positive control, a new native generation reading the rotated key); test `composed fixture early failure joins native and storage before root disposal`. **Inventory:** own-family 0 (`key-spawn-` and `key-composed-` roots) |
| E1535S3-62 | hub-api | QA | `ns E1535S3-62 '^agent-' hub/test/host-agent.test.ts` | `CLEAN` (T3; edited by T-1788). Test `admission plan excludes environment while native launch receives it` (T-1788 C3: the durable plan read before bootstrap holds no `env`, `fakeEnv` or sentinel, then native exit 0 from the child's environment assertions); the agent's other cases unchanged. Own family `agent-` (every `mkdtemp` prefix in the file begins with it, VERIFIED) |
| E1535S3-63 | hub-api | QA | `ns E1535S3-63 '^cland-proj-' hub/test/host-prepared.test.ts` | `CLEAN` (T3; unedited, VERIFIED `preserved`): the prepared-spawn checkpoints over T-1788's `prepared.ts` (the key kept in memory, the nonsecret environment retained, restart never replaying an uncommitted spawn). Listed in the native slot of the `login-key-spawn` per-test note under `docs/agents/tests/` (VERIFIED). Own family `cland-proj-` (`tempProject(t)`) |
| E1535S3-64 | hub-api | QA | `ns E1535S3-64 '^lwb-' hub/test/login-write-back.test.ts` | `CLEAN` with its exact list (T3; unedited). A consumer of `login-binding.ts` and `login-release.ts`, both edited by T-1786 (writer path unchanged for an exclusive login): a rotated disk reaches the next host from the same volume and release closes only disk writers. Inventory own-family 0 |
| E1535S3-65 | hub-api | QA | `ns E1535S3-65 '^hc-' hub/test/host-create-ready.test.ts` | `CLEAN` with its exact list (T3; plan 11, one nested subtest; unedited). A consumer of `provision-host.ts` (T-1786's release obligation) and of the capacity-aware `PoolRuntime` (T-1784) under test `T-1746 waiting pool launch creates a leased watchdog host and is placed`; the C3 mismatched-prelude case is T-1797's fixed case (a timeout is a regression finding). Inventory own-family 0; new `cland-h-*` entries are T-1806 |
| E1535S3-66 | hub-api | QA | `ns E1535S3-66 '^hc-' hub/test/host-destroy-native.test.ts hub/test/host-restart.test.ts` | Each `CLEAN` with its exact list (T3 each, two slots; unedited): the confirmed destroy boundary and restart reconciliation over T-1786's release owner and release policy. Inventory own-family 0 |
| E1535S3-67 | hub-api | QA | `ns E1535S3-67 "$OWN67" hub/test/host-unreachable.test.ts hub/test/host-stop.test.ts` | Each `CLEAN` with its exact list (T2 each in `tiers.json`; run in the standard environment and in their own slots as stage 2 grouped them; unedited): the lost and gone paths and the stop path over T-1786's `login-release.ts`. Own families `cland-init-machine-` (`host-unreachable`) and `cland-proj-` (`host-stop`), the stage-2 run-1 correction |
| E1535S3-68 | hub-api | QA | `ns E1535S3-68 '^hc-' hub/test/login-add.test.ts` | `CLEAN` with its exact list (T3; unedited; a CLI-started hub, pinned fake SSH, the existing fake binaries). A consumer of T-1784's login-add exemption from the login rule and of T-1787's sign-in storage receipt (`recordStorage` in `hub/src/host/login-signin.ts`, VERIFIED at `427f522ec`). **T-1805:** `$EV/E1535S3-68.receipts.txt` may list one new receipt with `roots naming the source worktree or repository 1 (T-1805 class)`; record its file name, roots count and the absence of every listed `hc-` root, leave it untouched; a finding aside, never a FAIL |
| E1535S3-69 | hub-api | QA | `ns E1535S3-69 '^$' hub/test/host-relaunch.test.ts` | `CLEAN` (T3; unedited): an importer of `hub/test/settled-login-fixture.ts`, which T-1784 edited (capacity rows for the settled fixture), and of the binding path. No own family is claimed (INFERRED: it allocates through shared fixtures); every new name is recorded |
| E1535S3-70 | hub-api | QA | `ns E1535S3-70 '^$' hub/test/host-ssh-contract.test.ts` (alone) | `CLEAN` (T3, its own slot, never beside another file: T-1731; unedited). A consumer of `hub/src/adapters/contract.ts` and `opencode.ts` (T-1788's `secretEnv`) and of the fake OpenCode binary T-1788 edited (the `key-proof` path is gated by `FAKE_OPENCODE_KEY_PROOF`, VERIFIED). The T-1731 signature is the only rerun |
| E1535S3-71 | hub-api | QA | `ns E1535S3-71 "$OWN71" hub/test/opencode-adapter.test.ts` | `CLEAN` (T3, the `opencode` contract; unedited): the OpenCode adapter over T-1788's `opencode.ts` launch path without a key (existing launch cases keep the previous request shape without `secretEnv`, per the `login-key-spawn` per-test note under `docs/agents/tests/`, VERIFIED) and the edited fake OpenCode. Own families `cland-proj-` and `fake-opencode-` (VERIFIED) |
| E1535S3-72 | hub-api | QA | `ns E1535S3-72 '^pg-' hub/test/host-provision-gate.test.ts` | `CLEAN` (T3; unedited): it imports `createHost` from `hub/src/host/provision-host.ts`, which T-1786 edited (the release-obligation predicate shared with the retry owner): boot deadlines, cancellation authority and confirmed deletion hold. Own family `pg-` in `/tmp` (VERIFIED in stage 2) |
| E1535S3-73 | hub-api | QA | `ns E1535S3-73 '^$' hub/test/cli-imports.test.ts` | `CLEAN` (T3; unedited). `hub/src/cli/login.ts` gains `set` (T-1786) and the capacity read (T-1787), `hub/src/cli/host.ts` the logins column; the command closures stay within their import budgets (INFERRED relevance) |
| E1535S3-74 | hub-api | QA | `ns E1535S3-74 "$OWN74" hub/test/host-provider-volumes.test.ts hub/test/host-provider-digitalocean-volumes.test.ts` | Each `CLEAN` with its exact list (T2 each in `tiers.json`; grouped with the native rows as in stage 2; unedited): the volume contracts over T-1787's edited `fake.ts` and `digitalocean.ts` declarations (landed in `427f522ec`, VERIFIED) and T-1786's reader clones from snapshots (`fromSnapshot` with admission). Own families `hp-vol-` and `cland-fake-do-` (the stage-2 run-1 correction) |

### Web cases (when in scope)

None. No stage path is under `web/` or `nvim/` (VERIFIED); the wire addition (`login.set` in `shared/wire/index.ts`) and the additive `host.status` fields (`capacity`, `storage`, per-host `logins`) are optional, the Coordinator decided no recorder run for T-1787's additive result fields (decision d6ffd31b, VERIFIED in T-1787's comments), and the typecheck (E1535S3-01) covers the web workspace against them.

## Manual checks

Run in table order: E1535S3-00 to E1535S3-06 before the cases, E1535S3-80 to E1535S3-89 after them, then cleanup step 1, then E1535S3-99. Scratch rows depend on the state the rows before them leave; a row whose prerequisite failed is BLOCKED, naming it. Record each with `sh .agents/skills/qa/qa-record.sh note E-1535 "$RUN" <id> hub-api "<the command you ran>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence file>` from `$W`. Every scratch row's evidence begins with the kit's `PRE gate` line and ends with `# fresh: redacted or withheld lines 0` and `row exit 0`; a gate refusal is BLOCKED.

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1535S3-00 | hub-api | QA | `s00 > "$EV/E1535S3-00.txt" 2>&1` | PRE line: HEAD, dev and request the same 40 hex; `dirty entries 0`; root non-tracker count recorded. `plan read exit 0`; the stage line: exact name, `qa` `{"scope":"affected","when":"after-stage"}`, `items` T-1784, T-1785, T-1787, T-1786, T-1788 plus any finding fixes the request names, `merged` equal to `total`, `state` not `closed`, and its `cover` recorded for E1535S3-06. Every member `landings 1`; anything else is BLOCKED. The receipts, VERIFIED at `26dc219eb`: `T-1786 landings 1 aca1a4ffb…`, `T-1784 landings 1 e14c3bf6d…`, `T-1788 landings 1 6252673e8…`, `T-1785 landings 1 bd8550b4d…`; and VERIFIED at `427f522ec`: `T-1787 landings 1 427f522ec…` with the stage read `merged 5`, `total 5`, `statuses {"done":5}` (full 40-hex SHAs in the evidence) |
| E1535S3-01 | hub-api | QA | `s01 > "$EV/E1535S3-01.txt" 2>&1` | Node 24; `typecheck exit 0` (the integrated build: every member's `logins.ts`, `sessions.ts`, `login-binding.ts`, `dispatch.ts` and `protocol.ts` edits together, the web workspace over the additive wire and status fields, its colour and contrast checks); `dirty entries 0` |
| E1535S3-02 | hub-api | QA | `s02 > "$EV/E1535S3-02.txt" 2>&1` | Every landing `package.json and lockfiles: 0` and `preserved files edited at its landing: []`; `stage paths under nvim/ or web/: []`; `remote authority table changed in the stage: []`; `fixture producers changed in the stage: []`. **Landing check** (VERIFIED at `26dc219eb`): T-1786, T-1784, T-1788 and T-1785 each `own lines … equal its tip …: yes` and `files byte-identical …: yes`; later commits touching their files (newest first): `T-1786 [bd8550b4d 6252673e8 e14c3bf6d]` (shared docs, `hub/README.md`, `tiers.json`; T-1784 also `logins.ts` and the implement skill; T-1788 also `login-binding.ts` and `logins.ts`), `T-1784 [639ccb373 bd8550b4d 6252673e8 2b5513725]` (`durations.json` in all four; T-1785 and T-1788 also `sessions.ts`, shared docs and tiers; T-1785 `waiting-launch.test.ts`; T-1788 `logins.ts`, `login-binding.test.ts`, `login-selection.test.ts`), `T-1788 [639ccb373 bd8550b4d]`, `T-1785 [639ccb373]`. VERIFIED at `427f522ec`: `T-1787 own lines at its landing 427f522ec… equal its tip b0903704b…: yes`, `T-1787 files byte-identical to b0903704b… at its landing: yes`, and T-1787's landing first in the later-commit list of all four other members (its files include files of each: `logins.ts`, shared docs, `tiers.json`; also `cli/login.ts`, `usage/login.ts`, `dispatch.ts` and the usage fixture of T-1786, and `login-capacity.test.ts`, `login-selection.test.ts`, `pool-idle-stop.test.ts` and `docs/hub/host-providers.md` of T-1784): `T-1786 [427f522ec bd8550b4d 6252673e8 e14c3bf6d]`, `T-1784 [427f522ec 639ccb373 bd8550b4d 6252673e8 2b5513725]`, `T-1788 [427f522ec 639ccb373 bd8550b4d]`, `T-1785 [427f522ec 639ccb373]`, `T-1787 []`. At the requested dev the Coordinator's brief-and-durations commit (below) is also prepended to the lists of T-1784, T-1788 and T-1785, whose landings changed `hub/test/durations.json`; any other difference is a finding. **Stage commits:** `writing dev is an ancestor of the request: yes`. The first-parent commits from `BASE` to `427f522ec` are, in order (VERIFIED): `aca1a4ffb` (`Item: T-1786`), `e14c3bf6d` (`Item: T-1784`), `2b5513725` (paths `hub/test/durations.json`; `entries outside allow changed or removed 0; added 0; allowances removed 0; changed 103 (renewals keeping seconds and owner 103; reason-only 1); added 0; version same true`), `6252673e8` (`Item: T-1788`), `9ae466067` (paths under `.cland/tasks/` only), `bd8550b4d` (`Item: T-1785`), `639ccb373` (paths `hub/test/durations.json`; `… changed or removed 0; added 0; allowances removed 0; changed 0 (… 0; reason-only 0); added 1; version same true`), `26dc219eb` (paths under `.cland/tasks/` only), `427f522ec` (`Item: T-1787`, 34 paths). **After T-1787's landing:** `T-1787's landing is an ancestor of the request: yes; first-parent commits after it: 2`, and exactly one line of each class: (1) `class brief-and-durations paths 2` (only `qa/briefs/E-1535-stage-3.md` and `hub/test/durations.json`), whose stage-commit durations line reads `entries outside allow changed or removed 0; added <n>; allowances removed 0; changed 4 (renewals keeping seconds and owner 4; reason-only 4); added 0; version same true` and whose four `changed allowance:` lines name exactly `hub/test/measure-memory.test.ts::offline analyzer reads a real V8 snapshot and finds an owned large array`, `hub/test/login-capacity.test.ts::capacity index bounds visits across same-region rejected rows and agrees with pending fences`, `hub/test/inbox-query.test.ts::existing large synthetic database migrates and serves hub.status within 15 seconds` and `hub/test/host-relaunch.test.ts::C2/C3 admitted host relaunch no-login keeps durable native and checkout ownership` (`<n>` is the add-only refresh, any count); (2) `class tracker` (paths only `.cland/tasks/*.md`, no `Item:` trailer). A `class other` line, a third commit, a missing class, an `Item:` trailer after the landing, or a durations line other than (1)'s makes the run BLOCKED: keep the evidence and report it to the requester |
| E1535S3-03 | hub-api | QA | `node "$Q/src.mjs" "$W" > "$EV/E1535S3-03.txt" 2>&1` | Every line `ok`: 47 lines (VERIFIED at `b0903704b` and at the landing `427f522ec`; at `26dc219eb` the 36 lines of T-1784, T-1785, T-1786 and T-1788 `ok` and T-1787's eleven `MISMATCH`, VERIFIED). T-1784 (the metadata-only verdict, signed-out and can-bind answers, placement of serving and bindable hosts with serving first, the login wait reason, the retired note, the creation recheck, the provider-and-region disk query, the eligibility SQL with no creating state, the minimum's unchecked scale); T-1785 (login changes wake placement, the card text and options, the reason match, one card per pool and harness, withdrawal, the two answers, reconciliation twice in `sessions.ts`); T-1786 (the attached-elsewhere refusal, the reader choice, the clone from the latest snapshot, the missing-snapshot refusal, the confirmed reader deletion, the in-use and key refusals of `set`, the exclusive default, the `set` syntax, the web refusal); T-1788 (decrypt, register and `OPENCODE_API_KEY`, `secretEnv` on the request, the empty account environment of a key binding, the in-memory prepared key, the plan file without environment, the bootstrap's inherited environment, the login-named redacted error, startup registration); T-1787 (capacity, its status and list lines, per-host logins and their text, the storage cost and month-only addition, the sign-in volume receipt, the declaration refusal and both providers' prices). A `MISMATCH` on a settled line is read at the build (a renamed string is followed); it is a FAIL unless the landing changed it with a recorded decision |
| E1535S3-04 | hub-api | QA | `node "$Q/ids.mjs" "$W/qa/briefs/E-1535-stage-3.md" > "$EV/E1535S3-04.txt" 2>&1` | `missing from the tables: 0` (A-17843) and `open landing markers: 0` (only the T-1787 landing marker is counted); a non-zero marker count is BLOCKED (the brief was not completed at T-1787's landing). Also read by hand: each map row cites tests that its row's command runs |
| E1535S3-05 | hub-api | QA | `s05 > "$EV/E1535S3-05.txt" 2>&1` | `retired eligibility note outside the tracker and the briefs: 0` (T-1784; VERIFIED 0 at `26dc219eb` and `b0903704b`); `storage price keys outside the declarations, the two providers and status: 0` and `storage in the hosts spend reservation module: 0` (T-1787 C3, no reservation includes storage; VERIFIED 0 at `b0903704b` and at `427f522ec`); `OPENCODE_API_KEY in the host agent's durable plan and record writers: 0` (T-1788 C3; VERIFIED 0 in `hub/src/host/agent/processes.ts`); `logout commands in production source: 0` (the stage-2 invariant over the edited sign-in owner; VERIFIED 0). Each scan excludes `qa/briefs/` and `.cland/`, so this brief's own literals never count (the stage-2 run-1 rule) |
| E1535S3-06 | hub-api | QA | `s06 > "$EV/E1535S3-06.txt" 2>&1` (after E1535S3-00; reads only, starts nothing) | **Member verify receipts** (mode-free `cland verify` on the Linux droplet at each reviewed head; VERIFIED at writing): `T-1784 verify 1eec0c4b-… executor droplet state finished result passed artifact A-18520 head is the reviewed tip true`; `T-1785 verify 174c67c2-… … A-18555 … true`; `T-1786 verify 5d655d64-… … A-18492 … true`; `T-1788 verify b88d380d-… … A-18544 … true`; `T-1787 verify 3e2e79a6-… executor droplet state finished result passed artifact A-18578 head is the reviewed tip true` (VERIFIED at the landing). **Merge-batch logs** (full T3; each `occasion batch`, `executor droplet`, `os linux`, `failing phase lines 0`): suite `a1741ee3-…` at head `2526d967…` (T-1786's deciding files, VERIFIED), `ff809349-…` at `7ca289d9…` (T-1784's, VERIFIED), `d38f3f52-…` at `673c3245…` (T-1788's deciding files, VERIFIED), `d0622810-…` at `832d8e93…` (T-1785's deciding files; its export tree `02c51d2b…` equals the reviewer's export of `35aeccff3`, VERIFIED in T-1785's comments), `9b73bc7d-…` at `0254b513…` (T-1787, batch 4f0adb73: its deciding files and the export tree `d41eb62df…` of its verify at `b0903704b`; two identical logs A-18585 and A-18586, each `failing phase lines 0`, VERIFIED). Confirm each mapping in the member's item topic landing report (`history` of the item topic names item, commit and batch) and record it. **Stage covers** (submitted by the Coordinator at the stage SHA; QA starts neither): the plan's `cover` reads `missing []` with a `linux` and a `macos` suite id; the Linux log `occasion stage`, `executor droplet`, `os linux`, `head is the request true`, `failing phase lines 0`; the macOS log `occasion stage`, `executor local`, `os darwin`, `Workers 1 · source explicit --workers`, `head is the request true`, `failing phase lines 0`. Record each log's skips (its provenance `skips`) and, for a remote run, the droplet lifetime and cost from its log. A cover still missing or running, or at another head, makes this row BLOCKED (report to the requester; never submit one). The periodic dev T3 red `20d0d38d` (A-18558, budget only, T-1809) is recorded as context, not a failure |
| E1535S3-80 | hub-api | Human | `mrow E1535S3-80 r80` | **Setup.** `PRE p1 entries 0`; `git exit 0`; `init exit 0`; `hub after init and stop: down`; `qa pool tables before: 0`; `qa pool tables written: 1`; `hub start exit 0; hub up` (a fake pool with `min_hosts = 0` boots nothing); `(host list json) exit 0` with `host rows 0`; `fake machines 0`; `auth directory before any key login: absent`. INFERRED: that the CLI-started hub accepts the `[hosts.qa]` table with exactly these keys (`POOL_KEYS` in `hub/src/host/pools.ts`, VERIFIED) and the fake provider under the seal's `CLAND_FAKE_HOST_ROOT`, not from a run. A failure makes E1535S3-81 to E1535S3-83 BLOCKED |
| E1535S3-81 | hub-api | Human | `mrow E1535S3-81 r81` | **T-1788 C2 at rest, T-1784 C4 and T-1787 C1 on the real CLI.** `(key add 1) exit 0` with `added lines 1`; `(key add 2) exit 0` with `added lines 1`; `key files 2`; both sentinels `sentinel occurrences 0` under `.cland`; `(login list text) exit 0` with `capacity lines 1`, `qa opencode capacity lines 1` (a key gives `max_hosts`; the only login harness is OpenCode and no role is bound to `qa`) and `sentinel lines 0`; `(login list json) exit 0` with `json row keytwo` and `json row opencode-1`, each `harness opencode; kind key; state ready; exclusive absent; storage absent; bindings 0`. INFERRED: the capacity line and its single harness from `hub/src/cli/login.ts` and `hub/src/host/status.ts` at `427f522ec` (unchanged from `b0903704b`, VERIFIED), the other strings from stage 2's passing rows, not from a run here |
| E1535S3-82 | hub-api | Human | `mrow E1535S3-82 r82` | **T-1786 C4 neighbours and T-1787 C1, C3.** `(set a key login)` exit non-zero with `no-flag lines` at least 1; `(set a bad value)` exit non-zero with `usage lines` at least 1; `(set an unknown login)` exit non-zero with `sentinel lines 0`; `rows unchanged by the refusals true`; `(host status json) exit 0` with `pool qa: capacity {"opencode":2}; storage 0; hostCount 0; spend month 0`; `(host status text) exit 0` with `sentinel lines 0`. INFERRED: the refusal text reaches the CLI's stderr, the JSON shape `{pools:[…]}` and the zero month figure with no ledger, from source and `hub/test/host-status.test.ts` at `427f522ec`, not from a run |
| E1535S3-83 | hub-api | Human | `mrow E1535S3-83 r83` | **T-1788 at hub start, across a real restart.** `hub after stop: down`; `hub start exit 0; hub up; new hub pid yes` (startup streams both ready key names, decrypts each and registers it, VERIFIED in `hub/src/hub/daemon.ts`; a decrypt failure would refuse the start); `(secret list) exit 0` with `auth.key lines` at least 1; `store key present true; store key value occurrences in the listing 0`; `rows unchanged across the restart true`; both sentinels `sentinel occurrences 0` (hub log and journal included). INFERRED: the listing format from stage 2's passing row |
| E1535S3-89 | hub-api | Human | `mrow E1535S3-89 r89` | `hub stop exit 0; hub down`; every recorded pid `alive no`; `processes naming the scratch root: 0`; `processes naming the worktree: 0` (any line is a FINDING unless its command is unrelated, recorded; another session's read-only command naming `$W` is not residue). Then cleanup step 1 |
| E1535S3-99 | hub-api | QA | `s99 > "$EV/E1535S3-99.txt" 2>&1` (after cleanup step 1, with `$Q` and `$T` present) | HEAD, dev and request still the same 40 hex; `dirty entries 0`; `root non-tracker status unchanged: yes`; `preservation lock present: no`; `slot overruns: 0`. **Inventories:** `own-family new entries across all rows: 0` (any other value is a FAIL against the member named by that row); `other new entries across all rows` recorded and attributed per row (shared-directory activity of other sessions, the carried classes T-1806 and T-1676); `new fixture-owner receipts naming the source worktree or repository`: 0 or 1, the T-1805 class from E1535S3-68, recorded aside; `T entries other than node-compile-cache 0` after cleanup step 1. **Historical residue (attributed, never failed):** the `historical …` lines give the first and final counts of `hc-`, `sf-`, `cland-ssh`, `cland-suite-`, `cland-fixture-owners-` and `cland-h-` in the system TMPDIR and `/private/tmp`; a rise is attributed through the per-file deltas. A finding: a live new entry, a new receipt with a live owner, a rise attributed to a stage-edited file outside its own families, residue from a changed producer outside the carried clauses. A moved dev keeps the evidence and makes the run BLOCKED |

Before requesting QA, run `cland qa lint` with this filled brief at the build under test: from the root, `node hub/bin/cland.ts qa lint qa/briefs/E-1535-stage-3.md --commit <dev SHA>`, with a dev SHA that includes every stage landing (the draft passes at T-1787's landing `427f522ec`, VERIFIED). The brief is complete only when qa lint passes at the build and no T-1787 landing marker remains.

## Probes that mislead

- **Generated names cannot be certified by `qa lint`.** Loop and concatenated titles (`<label> login supplies no pool capacity`, `<kind> login permits every pool host and further growth`, `reader release recovers <fault> failure after restart; lost=<lost>`, `failed reader binding publication <fault> its write cleans its captured clone`, `installed owner recovers an unbound reader on <state> host after reopen`, `final reader <route> recovery clears snapshot release and resumes pending backup`, `login card option <option> folds once across retries and restart`, `<pin> account without a matching login waits before growth`, `key launch preserves <kind> refusal identity and ownership facts`, `current role <change> change prevents obsolete create admission after held preparation`, `status ledger read drains before storage closes; setup failure=<…>`, and the carried stage-2 templates) are expanded in `expect.json` and checked by `tap.mjs` at the run.
- **Capacity is metadata, not a bind.** `login-capacity`, `login-capacity-list` and the scratch capacity line prove counts and verdicts; native binding and key injection are proven only by `login-binding`, `login-exclusive-native` and `login-key-spawn` (their notes say so, VERIFIED).
- **A key login's capacity line is `max_hosts`.** A pool with only key logins reads `capacity <pool>/opencode: <max_hosts>`, not the number of keys.
- **The card is an ask; the wait is not.** A login wait raises one `login-create` card that counts in `needsYou`, while the `waitingLaunches` status itself stays outside it (`docs/hub/waiting-launches.md`, VERIFIED). A `needsYou` rise of one per pool and harness is expected.
- **Nested subtests are not top-level names.** `login-binding`, `login-exclusive` and `login-key-spawn` each report one more TAP test than their plan; `tap.mjs` counts the plan.
- **Two environments are two kinds of evidence.** A sealed row's `$T` delta and a native row's `$ST` and `/private/tmp` deltas are different directories; a native row's new non-own name in a shared directory may be another session's: attribute it, do not fail it.
- **Pre-existing is not new; an inventory taken while a file runs proves nothing; a clean TAP is not root removal (A-18182).** `snaps` and `snapt` run only after the file's `exit` line; the deltas prove removal.
- **The T-1805 receipt is not a cleanup instruction.** Its `roots` list names the live worktree; QA never removes, rewrites or acts on it.
- **Seeded and sentinel values are fixtures.** `E1535S3-sentinel-key-0001` and `-0002` are fixture strings; the scratch store key is compared in memory and never printed. A scanner withholding a sentinel line is INCONCLUSIVE, never a reason to print it.
- **The fake OpenCode `key-proof` path prints a digest, never the key**, and runs only with `FAKE_OPENCODE_KEY_PROOF=1` set by the fixture (VERIFIED); a key-shaped string in a log is a FINDING to report by file and position, never by value.
- **Plain `node --test` is not the suite runner.** It enforces no duration allowance and no resource tripwire preload: a slow pass is not a finding (T-1801, T-1807, T-1809) and a fast one proves no budget.
- **The stage covers are evidence, not runs.** QA reads their logs in E1535S3-06; it never submits `verify all`, an occasion or a mode-free run for this stage.
- Process cleanup probes use the fixture-owned pid census (`$Q/pids`) and the scratch-root and worktree censuses; a machine-wide `pgrep` counts other sessions too.
- File-change probes use isolation and digests; mtime alone is confounded by live sessions rewriting the same file.
- Speed criteria use measured wall times, never projections; the bounded-work cases here assert decode and query counts, not wall time.
- "No skip" names platform-only cases and where they are covered: the fake helper's Linux `/proc` census runs only on the Linux cover.
- Re-check helper and function names with grep at the tested build; renames happen. The kits come from commit `K`, the stage-2 helpers and corrections from `M3`, the stage-1 corrections from `M2`; a different commit or SHA-1 is a setup BLOCKED.

## Out of scope

- The real DigitalOcean API, droplets, volumes, snapshots, keys, tokens and any network; real storage billing.
- Real harness sign-in, real SSH and terminals; answering a `login-create` card from the web or a remote, the card's "Create one" sign-in flow (T-1791), signed out, signing in again, remove, reconciliation of unsettled bindings and the amendment (stage 4).
- Real `sudo`, mounts, devices, `fsfreeze` and the privileged helper on a real host; a real host's `/proc` key search (the live run's, per T-1788's notes).
- Neovim and web consumers (no stage path under `nvim/` or `web/`, VERIFIED; no recorder refresh, decision d6ffd31b; T-1804 is that refresh's open nondeterminism).
- Linux and container runs, the stage covers, the merge batches, the members' mode-free verifies and the items' loaded repetitions: their evidence is read in E1535S3-06; this run is macOS only and says so.
- Duration allowances (`hub/test/durations.json`) as pass conditions, the T-1809 budget included.
- T-1731 and T-1770 as bugs (signatures only); T-1735, T-1732 and T-1797 (fixed; a recurrence is a regression finding); T-1801, T-1802, T-1804, T-1805, T-1806, T-1807, T-1808, T-1809 and T-1676 as fixes (recorded if seen).
- Any `cland login …`, `cland secret …`, `cland config set`, `cland role launch`, `cland session …`, `cland hub …` or `cland host …` on the live project.

Missing authorization (a real provider token, a harness account, a GUI) is out of scope, not BLOCKED, because no case needs one. A stage cover that has not finished at the requested SHA is BLOCKED (E1535S3-06), not out of scope.

## Grants

none. No grant is needed: every case runs on this Mac against fakes, the sealed rows with a disposable HOME and the native rows with fixture-sealed children, and no credential.

## Rows to verify after landing

**Every line here was settled at dev `26dc219ebfa4882a50750397ba14fe08c8ee9562` (every landing except T-1787's), T-1787's lines at its reviewed head `b0903704b63487d91b2e14f381881c7391d3362e`, and all of them re-read at T-1787's landing `427f522ec88e9ad77d4fa39257a650980c383422`, the last stage landing.** The two Coordinator commits after it touch only this brief, `hub/test/durations.json` and `.cland/tasks/`, so no source, test or tier line changes between `427f522ec` and the requested dev; E1535S3-02 checks exactly that.

**Settled at `26dc219eb` (VERIFIED):**

- E1535S3-00: the four landings `landings 1`; the plan's stage name, lanes, policy and the cover state.
- E1535S3-02: the four landing pairs (own lines equal; byte-identical); the later-commit lists; the eight first-parent stage commits and both durations deltas; the preserved list unedited; no `nvim/` or `web/` path; the remote authority table untouched.
- E1535S3-03: the 36 source lines of T-1784, T-1785, T-1786 and T-1788. E1535S3-05: the retired note, the plan-checkpoint key and the logout counts.
- Every exact list in `expect.json` not marked for T-1787, matched name by name against the source templates, and every tier named in the tables.
- E1535S3-06: the verify receipts of T-1784, T-1785, T-1786 and T-1788, and their batch logs' heads, suite ids and deciding files.
- The own-family patterns marked VERIFIED in the case rows.
- The carried sections at `M2` (127 lines, blob `dd84d5b9…`) and at `M3` (55 lines, blob `a5df2de9…`), every extracted `M3` range's SHA-1, the T-1770 signature line.

**Settled at T-1787's reviewed head `b0903704b` (VERIFIED, read with `git show`):**

- "Stage": its scope entry; the 34 files of `git diff --stat 26dc219eb...b0903704b`.
- `expect.json`: `login-capacity-list`, `host-status`, `host-provider-declarations`, `login-signin` and `login-selection`, matched against their templates; `login-capacity`, `pool-idle-stop` and `host-provider-fake` titles unchanged by its edits.
- `src.mjs`: T-1787's eleven lines, and all 47 `ok` there.
- E1535S3-05's two storage counts; the criteria-map rows; E1535S3-50; the T-1787 parts of E1535S3-11, E1535S3-55, E1535S3-68, E1535S3-74, E1535S3-81 and E1535S3-82.

**Settled at T-1787's landing `427f522ec` (VERIFIED; the filled landing markers):**

- The landing receipt (`Item: T-1787` once, `Reviewed-by: rev-35 (rev-35-1787-final-1)`), byte-identity with `b0903704b` for all 34 files and equal own lines against the merge base `26dc219eb`; no `.cland/` path in the landing.
- The plan read `merged 5`, `total 5`, `statuses {"done":5}`, cover missing; T-1787's verify `3e2e79a6` `finished` `passed` at `b0903704b` (A-18578); its batch suite `9b73bc7d` at `0254b513…` (A-18585, A-18586).
- The later-commit lists with `427f522ec` first; the first-parent stage commits through `427f522ec`.
- In the drafting worktree checked out at `427f522ec`: all 47 `src.mjs` lines `ok`; the five T-1787 lists unchanged (their files byte-identical); E1535S3-05's counts; the `login-capacity-list` tier.
- The four allowance keys of the announced durations correction exist at `427f522ec`.

**Announced, not yet made at filling (checked by E1535S3-02 at the run):** the Coordinator's brief-and-durations commit and its tracker commit after `427f522ec`.

**Component-only, with the reason:**

- T-1784's verdicts and growth rule: placement over real hosts needs created hosts; `PoolRuntime` with injected creation and the native creation files carry it (E1535S3-10, E1535S3-11, E1535S3-65); the scratch hub shows only the capacity line.
- T-1785's card: the test messenger and embedded hub are the boundary (E1535S3-20); no remote or web answer here.
- T-1786's readers: directory provider volumes and fake agents (E1535S3-30, E1535S3-60); the scratch hub has no disk login.
- T-1788's key at spawn: fake hosts and the fake OpenCode digest (E1535S3-61, E1535S3-62, E1535S3-40); the scratch hub proves only key storage, startup registration and the absence of plaintext under `.cland`.
- T-1787's storage cost: seeded receipts on a FakeClock (E1535S3-50); the scratch hub shows a zero figure with no disk login.

**INFERRED, with the reason:**

- E1535S3-80 to E1535S3-83: exact output strings, exit codes, the accepted pool table and the status JSON shape, derived from source and earlier passing rows, not from a run.
- The publication scanner passing every stage title, fixture string and sentinel unwithheld.
- That no native file writes under the user's HOME (their notes and fixtures say children are sealed).
- The item-topic landing reports for each batch (not read for this brief; the mapping itself is VERIFIED from each batch log's deciding files), recorded by QA in E1535S3-06.
- That E1535S3-12's unedited T2 consumers pass in the fresh seal as earlier briefs ran them; E1535S3-69's claim of no own family.
- The historical residue counts, and each native file finishing within its 15-minute slot.

## Source provenance

VERIFIED = read in source, Git or the tracker at dev `26dc219ebfa4882a50750397ba14fe08c8ee9562` (T-1787 at `b0903704b63487d91b2e14f381881c7391d3362e`), and re-read at T-1787's landing `427f522ec88e9ad77d4fa39257a650980c383422`.

- The kits: commit `K` = `f43f4e21049e9c62a97c8dec1ebf37f9c7035a62` (`qa/briefs/E-1532-stage-4.md` lines 133 to 136 and 228 to 279; `qa/briefs/E-1533-stage-3.md` heredocs). The stage-2 helpers and corrections: commit `M3` = `18911bda46c7c0dc332619e93d25041069d3704a`, `qa/briefs/E-1535-stage-2.md` blob `a5df2de9a6ae74874906244473cac002ea0dab22`: heredocs `std.mjs` (58 lines), `invd.mjs` (25), `rcp.mjs` (20); ranges 308–332, 336–337, 345–347, 857–861 + 870 + 901–915, 922 + 965–973 with the SHA-1 values in "Environment". The stage-1 corrections: commit `M2` = `0d0618042fae7b76919d1be152e252b09e4a43ad`, blob `dd84d5b93927798242c0bee78ddc3310145ecbf0`. The stage-2 run: `.cland/artifacts/A-18475-e-1535-stage-2-qa-clear-at-121ec8bef-disk-logins-across-hosts/` (`report.md`, `corrections.md`), cleanup receipt A-18476.
- T-1786 (`aca1a4ffb`, tip `e9ec2f1cfd16b9547399648b13d2cb4ba7867546`, 27 files; verify `5d655d64` A-18492; batch `a1741ee3` A-18497): `hub/src/host/login-binding.ts`, `login-reader.ts` (new), `login-release.ts`, `login-release-owner.ts`, `login-release-policy.ts` (new), `logins.ts`, `provision-host.ts`, `hub/src/cli/login.ts`, `usage/login.ts`, `help.ts`, `hub/src/hub/dispatch.ts`, `web-authority.ts`, `hub/src/protocol.ts`, `shared/wire/index.ts`; tests `login-exclusive`, `login-exclusive-native` (new), `login-list`; the usage fixture; docs `docs/hub/logins.md`, `docs/agents/session-permissions.md`, two per-file notes.
- T-1784 (`e14c3bf6d`, tip `3be2cf5a0e219efeb67331e81569fd08c4253106`, 35 files; verify `1eec0c4b` A-18520; batch `ff809349` A-18529): `hub/src/host/login-verdicts.ts` (new), `scheduler.ts`, `pool-runtime.ts`, `logins.ts`, `hub/src/adapters/sessions.ts`; `hub/test/settled-login-fixture.ts`; tests named in "Stage"; `hub/test/durations.json` (one allowance added); `qa/briefs/E-1535-stage-2.md` (replay migration); docs.
- T-1788 (`6252673e8`, tip `57ea802879e5a88028ddf698521d2cc93157c8a0`, 27 files; verify `b88d380d` A-18544; batch `d38f3f52` A-18550, its deciding files VERIFIED): `hub/src/adapters/contract.ts`, `index.ts`, `opencode.ts`, `sessions.ts`, `hub/src/host/agent/bootstrap.ts`, `closure.json`, `prepared.ts`, `processes.ts`, `hub/src/host/login-binding.ts`, `login-keys.ts`, `logins.ts`, `hub/src/hub/daemon.ts`; `hub/test/fakes/opencode/fake-opencode.ts`; tests `login-key-spawn` (new), `host-agent`, `login-binding`, `login-selection`, `opencode-launch-policy`; `hub/test/durations.json` (one allowance added); docs `docs/agents/host-agent.md`, `docs/hub/logins.md`, per-file notes.
- T-1785 (`bd8550b4d`, tip `35aeccff372f7d29c31957c88a4f56da1dcb1d4d`, 13 files; verify `174c67c2` A-18555; batch `d0622810` A-18559): `hub/src/host/login-cards.ts` (new), `hub/src/adapters/sessions.ts`; tests `login-wait` (new), `waiting-launch`; `hub/test/durations.json` (one renamed baseline removed); `qa/briefs/E-1534-stage-2.md`, `qa/briefs/E-1534.md` (replay notes); docs `docs/hub/logins.md`, `docs/hub/waiting-launches.md`.
- T-1787 (`427f522ec`, tip `b0903704b63487d91b2e14f381881c7391d3362e`, branch `t/T-1787-capacity-and-login-storage-in-login-list`, 34 files, two commits on `26dc219eb`; review `rev-35-1787-source-1` not clear at `2a336f7fc`, `rev-35-1787-source-2` and `rev-35-1787-final-1` clear at `b0903704b`, C1 to C4 verified; verify `3e2e79a6` A-18578 passed; batch 4f0adb73, suite `9b73bc7d` A-18585 and A-18586; final review A-18582): `hub/src/host/logins.ts`, `status.ts`, `login-signin.ts`, `login-snapshots.ts`, `provider/declarations.ts`, `fake.ts`, `digitalocean.ts`, `hub/src/cli/login.ts`, `host.ts`, `usage.ts`, `usage/login.ts`, `hub/src/hub/core.ts`, `dispatch.ts`; tests named in "Stage"; docs `docs/hub/logins.md`, `docs/hub/host-status-stop.md`, `docs/hub/host-providers.md`, per-file notes.
- Durations commits `2b5513725` (103 renewals) and `639ccb373` (T-1809's allowance); tracker commits `9ae466067`, `26dc219eb`; the Coordinator's two announced commits after `427f522ec` ("Carried corrections").
- Known non-blocking items, read with `task view` at writing: T-1801, T-1802, T-1804, T-1805, T-1806, T-1807, T-1808, T-1809 (backlog, needs-triage), T-1676 (backlog, qa-found).
- Plan: stage 3 `{"scope":"affected","when":"after-stage"}`, lanes [T-1784, T-1785, T-1787], [T-1786, T-1788]; `open`, `merged 5`, `total 5`, cover missing at the landing; no item QA criteria.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "capacity, the login wait and its card, exclusive logins and keys at spawn"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Read the request's id and any earlier verdict's id from the epic topic's `history`, never from a `send` result (rule 22). Report `qa clear E-1535 stage capacity, the login wait and its card, exclusive logins and keys at spawn` or `qa not clear E-1535 stage capacity, the login wait and its card, exclusive logins and keys at spawn` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure. Publish evidence only after a clean secret scan with a positive control (rule 15; T-1808 is the missing shared helper).

## T-1787 landing markers

Filled at T-1787's landing `427f522ec88e9ad77d4fa39257a650980c383422` (2026-11-11, drafting agent for the Coordinator, read-only in the root): all 23 inline markers in the 18 places below were replaced by the values read at the landing, and E1535S3-04 reads `open landing markers: 0`. The landing is byte-identical to `b0903704b` for every file it changes, with equal own lines against the merge base `26dc219eb` (VERIFIED), so no T-1787 line changed value; each was re-read at `427f522ec` in the drafting worktree checked out there, and `qa lint --commit 427f522ec88e9ad77d4fa39257a650980c383422` passes. The places were:

1. "Stage", T-1787's scope entry: its landing SHA, the final reviewed tip and run, and the byte-identity statement.
2. "Criteria map", the map's header sentence and the four T-1787 rows: re-read at the landing.
3. "Build", the landing receipt sentence: the landing SHA with its one `Item: T-1787` trailer, and the plan read `merged 5`, `total 5`, `statuses {"done":5}`.
4. "This brief's own helpers", the `expect.json` paragraph: re-derive `login-capacity-list`, `host-status`, `host-provider-declarations`, `login-signin` and `login-selection` at the landing.
5. "This brief's own helpers", the `src.mjs` paragraph: T-1787's eleven lines `ok` at the landing (`node "$Q/src.mjs" "$R" <landing>` from the root).
6. "This brief's own helpers", the `T1787_TIP` and `T1787_BATCH` defaults: the final reviewed tip (`b0903704b`, `rev-35-1787-final-1`) and T-1787's merge-batch suite id (`9b73bc7d-d095-4323-a2c5-ab0ad8f630a4`).
7. E1535S3-11: the `login-selection` list and its T-1787 case.
8. E1535S3-50: T-1787's case row.
9. E1535S3-55: the frozen usage lines migrated by T-1787.
10. E1535S3-68: T-1787's sign-in storage receipt in `login-add`.
11. E1535S3-74: T-1787's declaration edits in the provider files.
12. E1535S3-00: the `T-1787 landings 1 <sha>` receipt and the plan read.
13. E1535S3-02: T-1787's landing check against `T1787_TIP` (no byte difference), its landing SHA in each touched member's later-commit list, and the check of exactly the two Coordinator commits after the landing.
14. E1535S3-03: the 47 `ok` lines at the landing.
15. E1535S3-05: the two storage counts at the landing.
16. E1535S3-06: T-1787's finished verify receipt and its batch log.
17. E1535S3-81: the capacity line from T-1787's `login list`.
18. E1535S3-82: the `host status` capacity and storage fields.
