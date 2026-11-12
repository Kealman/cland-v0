# Stage QA brief: E-1537 stage 1 — the Hosts row and session rows

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (start `bash` first; zsh reads `$S:q`, `$B:h` or `${B}:hub` as modifiers, does not split unquoted path lists and does not split `set -- $pair`; always brace a variable before `:`). The run is local, on macOS (BSD `stat`, Node 24 with `node:sqlite`, `uuidgen`, `lsof`, `shasum`, `getconf DARWIN_USER_TEMP_DIR`). A platform skip is a FAIL, not a pass. **No real SSH, host, droplet, volume, snapshot, DigitalOcean API, key, credential, harness login, browser sign-in, sudo, mount, Telegram, Discord, speech API, npm registry or network (R-1530's QA rule).** The named files use only their own fakes (the fake host provider and its directory-backed machines, fake SSH and scp, the fake harness binaries, the test messenger, injected sign-in handles, FakeClock, in-memory or temporary SQLite, the scripted fake DigitalOcean API). Key values are fixture sentinels only. **Browsers and Neovim are headless and isolated (rule 18):** Web rows drive the pinned Chrome Headless Shell from `node_modules/playwright-core/.local-browsers` inside their named files, each with its own `--user-data-dir` under the file's scratch root (VERIFIED in `web/test/harness.ts`: `chromium.launchServer({ executablePath: prerequisite.executablePath, headless: true, … })` and the `--user-data-dir=${root}/` assertion); Neovim rows run the pinned headless Neovim that `nvim/bin/nvim-path.ts` resolves. Never the human's browser, profile or Neovim, no GUI, no computer use. Never read, print or log `DIGITALOCEAN_TOKEN` or any key value; no secret is ever an argv element.

**Every member has landed; no landing marker is open.** First drafted at dev `8a9e0b474` (T-1819, T-1822, T-1823 and T-1824 landed). Since then T-1821 (`cb31e4342`) and T-1820 (`36f700d73`, the last landing) landed; every marker is filled and removed (see "Landing markers" at the end). E1537S1-04 expects `open landing markers: 0`: a request sent while any marker is open is BLOCKED.

**Written at dev `8913e8ab473730733e6e38deb531934a57e3a7b2`** (the add-only durations commit after the tracker commit `4fc3b57a9` that recorded T-1821's and T-1820's landings; first drafted at `8a9e0b4746d08d126c23b738653a1c15e34d1322`). Markers: VERIFIED = read in source, Git or the tracker at that dev (every member's lines read at its landing with `git show`; the lines of the members that landed by `8a9e0b474` read there and unchanged at `8913e8ab4` except where a later landing's own lines are named; the landing checks, the batch-candidate trees, the kit SHA-1s and the carried-section SHA-1s computed in bash at `8913e8ab4`; the brief's helpers rehearsed read-only there); INFERRED = a reasoned expectation no read or run has proven (rule 22: an INFERRED line is never a pass condition on its own). Any dev SHA later than `8913e8ab4` is re-read under "Rows to verify after landing" before the run; E1537S1-02 names which later commits are acceptable.

The stage gives the workbenches the hub's host state and names hosts on session rows: the hub pushes a client-safe `hosts.state` frame on connect, in the featured sessions snapshot and on every change (T-1819); the web's session rows and the phone session page name the host (T-1822); Neovim's attach of a host session runs the hub's `ssh -t` command through fake SSH and its note names the host (T-1823); the web edge admits `login.list`, `login.snapshot`, `login.remove` and `host.stop`, and web-started disk sign-ins through the card runner (T-1824); the web's Hosts row (T-1820) and Neovim's Hosts row (T-1821) draw the frame, and Neovim's session rows name their host (T-1821), with a native fake-SSH tunnel-loss case that reaches Neovim's red row. The run is meant to take about three and a half hours: setup and E1537S1-00 to E1537S1-08 about 30 minutes; the sealed rows about 60 minutes; the native rows about 75 minutes, one file per preservation slot; the scratch demo rows about 20 minutes. Waits for cover-quiet admission, the preservation lock or load are not product results.

## Carried corrections

A reused kit block must be reconciled against the source brief's recorded run corrections. This brief reuses blocks from fixed commits, never by blob (A-17643): the kits from `K` (`f43f4e21049e9c62a97c8dec1ebf37f9c7035a62`) exactly as the E-1535 stage-4 and Definition-of-done briefs take them; the E-1535 stage-2 helpers from `M3` (`18911bda46c7c0dc332619e93d25041069d3704a`); the E-1535 stage-3 functions from `M4` (`85e60f6cb34ec320cc7a1f5456de3a4693acbe17`); the E-1535 stage-4 own-family prefixes from `M5` (`a72e34d9a83781f1ef7d87c273aaf5f281723046`, the tracker commit recording stage 4's clear verdict, where that brief holds its run-1 corrections R-1 and the documentary fix); and the E-1534 stage-2 `waitfor` and fake-host census from `N2` (`becee171b9cf1fa76e1732c674e13f2656551397`, the commit that folded E-1534's A-18029 corrections). It therefore carries the whole chain, read into the evidence at setup and followed as written:

- the E-1535 stage-1 chain at `M2` (`0d0618042fae7b76919d1be152e252b09e4a43ad`; 127 lines; SHA-1 `98f38398667ed6b1192f2d9d20e131a30eb88bdc`), `$EV/carried-from-M2.md`;
- the stage-2 chain at `M3` (55 lines; SHA-1 `51da4c95a6b8c380b7b11e4536c7d23f93986701`), `$EV/carried-from-M3.md`;
- the stage-3 chain at `M4` (80 lines; SHA-1 `e4ad4448829797e25c364afad87b0f3f2cf3b06e`; its run-1 corrections C-1, R-1, R-2), `$EV/carried-from-M4.md`;
- the stage-4 chain at `M5` (76 lines; SHA-1 `7555a12ef6902bbfe8dd2094d14e08d2ea93c61a`; its run-1 corrections R-1 and the documentary fix), `$EV/carried-from-M5.md`;
- the E-1535 Definition-of-done chain at `M6` (`d5c59e2c73b61f7e72e7a25b533f3945d2f1fcb0`, the tracker commit closing E-1535; `qa/briefs/E-1535.md` from `## Carried corrections` up to `## Build`, 59 lines, SHA-1 `82535892ef7a00b2e4762a0d4515eebe1ca64a90`), `$EV/carried-from-M6.md`.

Each stage chain is the text from `## Carried corrections` up to `## Stage` of that brief at that commit (VERIFIED: the line counts and SHA-1s above, computed in bash at `8a9e0b474`). T-1824's landing `686ec94f4` later prepended a two-line "Historical-build disposition" to `qa/briefs/E-1535-stage-4.md` (VERIFIED with `git show 686ec94f4 -- qa/briefs/`); this brief reads that brief only at `M5`, before that edit, so no extracted line or SHA-1 moves. Its content is current and applied here: the stage-4 checks that the web edge refuses `login.remove` and `login.signin` hold only at their historical build; on this stage's builds the web edge admits them (E1537S1-20, E1537S1-03).

### From the E-1535 stage-4 and Definition-of-done runs (qa-678; A-18954 clear at `e2eb555d4`; A-18965 and A-18967 clear at `aa14a4b23`)

- **R-1 (every Git call from an embedded script is sealed).** The stage-4 census called `execFileSync("git", …)` from an embedded Node script with the inherited environment (rule 15). Applied here to the whole run: **every Git call goes through one wrapper**, `$Q/git.mjs`, whose environment is `scratchGitEnvironment($Q, fixtureEnvironment($Q, process.env), {excludesFile: $Q/home/.gitignore-global})` from `$W/test-support/fixture-environment.ts`, every argument unchanged (VERIFIED: both functions exported there at `8a9e0b474`, lines 13 and 82). Embedded Node scripts call it as `execFileSync(process.execPath, [<Q>/git.mjs, …])`; QA's own shell defines `git() { node "$Q/git.mjs" "$@"; }` right after the worktree exists, so the extracted kit functions (`landing`, `ownlines`, `durdelta`, `s01`, `s99`), which call `git -C …`, reach Git only through the wrapper too, with no extracted line edited. The only plain Git calls are the first `git worktree add` (before the wrapper exists) and none other. A run copy that needs another Git call routes it the same way and reports it as a correction.
- **The Definition-of-done run** recorded no expected-result correction, test retry or withheld capture (VERIFIED in `.cland/qa/E-1535/qa-e1535d-2026-11-12-qa678-1/report.md`; that run directory holds no `corrections.md`).
- **Found aside, Low:** T-1806 (dead `cland-h-*` socket directories from native host fixtures), T-1805 and T-1676 (fixture-owner receipts from unchanged producers). Here T-1806 is recorded per native row, never a stage failure; T-1805's `login-add` and T-1676's `opencode-adapter` producers are not run here.

### From the E-1534 stage-2 and stage-3 runs (web, Neovim and created fake hosts)

- **Web and Neovim surfaces.** E-1534 stage 3 ran Web files through the sealed `nt` with the pinned Headless Shell and a built `web/dist`, and Neovim T2 files through `nt` with the pinned Neovim (`qa/briefs/E-1534-stage-3.md`, E1534S3-05, E1534S3-40, E1534S3-41, VERIFIED at `8a9e0b474`). This brief does the same (E1537S1-08, E1537S1-30, E1537S1-35) and runs the Neovim T3 files through `ns`, one per slot.
- **Created fake hosts on a CLI-started hub (E-1534 stage 2, A-17643, A-18029).** A created fake host lives under `$Q/fh/.fixture-sockets/<machine>` behind one `/private/tmp/ct-<32 hex>` alias, recorded in `$Q/alias.txt` and removed by its literal path at cleanup step 1; the fake provider's deletion never kills fake-machine processes, so the scratch census (`q57` from `N2`) lists each survivor, sends TERM and lists again; the second listing must read 0. A successful `host stop` destroys the host and exits its sessions (`exited`), a successful session stop is `stopped` (A-18029; no session runs in this brief's scratch rows).
- **The outage is not QA-triggerable on a CLI-started hub** (E1534S3-67): the tunnel state comes only from the SSH carrier's status (`sshHosts.subscribeStatus` → `HostHealth.transition`, VERIFIED in `hub/src/hub/daemon.ts` at `8913e8ab4`), and no documented QA control drops a fake host's tunnel on a scratch hub. No scratch row forces it. The red state is judged natively in E1537S1-66 (T-1821's `nvim/test/hosts-native.test.ts`, a real fake-SSH tunnel loss on a fixture-owned projectHub reaching headless Neovim), at the carrier's status boundary in E1537S1-40 (T-1820) and in the component rows (E1537S1-10, E1537S1-45, E1537S1-64). T-1839 (stage 2, VERIFIED `open`, `backlog`, `ready-for-agent`, filed in `5b056beb4`) adds the QA-usable control for the epic's Definition of done.

### Known flakes for this stage

Carried by exact signature only: T-1731 (`hub/test/host-ssh-contract.test.ts`; not run here) and T-1770 (`hub/test/host-provider-digitalocean.test.ts`, the `422` expansion failing at line 368 with `['created','failed','created']`; not run here). **Regressions, never reruns:** T-1735, T-1732, T-1797, T-1810 and T-1818, and the three T3 positional readers of batch `abfc5334` (E1537S1-62). Any other failure is judged as it stands.

### Known non-blocking items (record if seen; never a stage failure on their own)

Each read with `task view <id> --json` at `8a9e0b474` and again at `8913e8ab4` (VERIFIED: each `open`, `backlog`, label `needs-triage`):

- **T-1806:** native host fixtures leave `cland-h-*` socket directories in `/private/tmp` (`hostPaths`, `hub/src/host/records.ts` lines 66 to 74). Its census of 2026-11-12 09:44Z counts about 17,640 `cland-h-*`, 1,015 pre-existing `ct-*` and 11 `hc-*`, the latter two neither added nor removed by current runs. Each native row records its new `cland-h-*` count as found aside; QA leaves them. `nvim/test/host-attach.test.ts` roots its project at `tempProject(t, 'cland-h-')` (VERIFIED), a six-character mkdtemp name in the system TMPDIR, distinct from the twenty-hex `hostPaths` names: the first is its own family, the second is T-1806.
- **T-1808:** no shared evidence-publish helper with a positive-control secret scan yet; QA publishes only after a clean scan with a positive control (rule 15).
- **T-1812:** a spoke that starts while the hub is down never connects. A spoke that never connects after a hub restart in this run is this item, recorded with its timing.
- **T-1816:** `startServer`'s port retry spins without bound (`hub/src/adapters/opencode/server.ts`); a native row that ends in `RangeError: Map maximum size exceeded` after about 30 s is this item, the row INCONCLUSIVE, never a pass.
- **T-1817:** `hub/test/login-metadata-owners.ts` closes the borrowed Store even when `hub.stop` rejected; a fault-path diagnostic in `login-list` that lost its storage after a rejected stop is this item.
- **T-1839** (stage 2, `open`, `backlog`): the native fake-host tunnel drop through `hosts.state` and a QA-usable control on a CLI-started scratch hub. Not a member of this stage; its absence here is why the scratch demo's red row is not run (E1537S1-83).
- **T-1813** is no longer open: it landed out of stage as `c7978ae30` (`c7978ae308fce04d502da66fbb8e3709b7c97217`, closed `done`, VERIFIED) and is accepted as an out-of-stage commit (E1537S1-02).

### How this brief applies them, and the reconciliation

- **Two environments (carried).** Sealed T1/T2/Web/Neovim-T2 rows, the typecheck, the web build, the wording lint and every scratch command run through the stage-3 kit's `fresh.mjs`. Native rows (the T3 files, plus `hub/test/host-stop.test.ts` and `hub/test/host-unreachable.test.ts`, grouped native since E-1535 stage 2) run through the stage-2 kit's `std.mjs`, one file per preservation slot (`ns`).
- **Kit pins.** From `K`, `M3` and `M4`: exactly the blocks and SHA-1s the E-1535 stage-4 brief takes, except that from `M4` only `r80` is taken (lines 815 to 828). From `M5`: lines 239 to 241 (`OWN61`, `OWN65`, `OWN71`). From `N2` (`qa/briefs/E-1534-stage-2.md`): line 576 (`waitfor`) and lines 654 to 663 (`q57`). Not taken: any brief's `expect.json`, `src.mjs`, `ids.mjs`, `s00`, `s02`, `s05`, `s06`, `s07`; this brief writes its own.
- **Reconciliation of the reused blocks.** Stage-3 C-1 (a landing that is not byte-identical to its tip) applies here to T-1819 and T-1824, each with an explicit equality line in E1537S1-02; stage-3 R-1 (expected dead receipts) becomes E1537S1-99's receipt count, expected 0 here because no producer of an attributed receipt runs (INFERRED); R-2 (`slots = 1`) is in the extracted `r80`; stage-4 R-1 is the Git wrapper above. No extracted block is edited.
- **Per-file name-set inventories (carried), with the E-1537 native rule (A-19022).** `nt` and `ns` take exact before and after name sets around each file; a new own-family name is a FAIL of that row; every other new name is recorded and attributed; a live new name is a FINDING. After each native row `pfam` reads the `/private/tmp` name sets of every file in it: `new hc- 0; new ct- 0` is a pass condition, `new cland-h- <n>` is recorded as T-1806.
- **Expected registrations.** Every list in `expect.json` was read from the test files at `8a9e0b474` and expanded through their loops, and T-1820's and T-1821's new and edited files (`web/test/hosts.test.ts`, `nvim/test/hosts.test.ts`, `nvim/test/hosts-native.test.ts`, `nvim/test/sessions.test.ts`) at `8913e8ab4` (VERIFIED: `git diff --name-only 8a9e0b474 8913e8ab4` over every `expect.json` file names exactly those four); the lists of files no stage landing edited are byte-unchanged since `9c98a5747` (VERIFIED with `git diff --name-only 9c98a5747 8913e8ab4` over them). Exact lists are used only where every registration is known; the rest are `exact: false` (the whole file must still pass).
- **Evidence split (this release's standing rule).** T1, T2, Web and each member's changed T3 come from the member's mode-free `cland verify` on the Linux droplet at its reviewed tip; full T3 from the merge batch that landed it; T4 and the stage's complete scope from the Coordinator's stage cover pair at the requested dev SHA (a Linux `verify all --occasion stage` and a macOS `--executor local --workers 1` run). **QA starts none of them**: E1537S1-06 reads them.
- **Cleanup order, presentation substitution, mapping ids, dead receipts and sockets (carried).** A line withheld by the publication scanner makes its row INCONCLUSIVE; E1537S1-04 checks map ids and markers; QA removes only dead `$T` residue and the recorded scratch alias by literal path, and nothing else in the shared system TMPDIR or `/private/tmp`; if any inventory shows a new own-family name, nothing is removed.

### Kit conventions carried

- **Rule 22.** Every selector, test name and string is marked VERIFIED or INFERRED.
- **TAP.** Plans count top-level registrations; counters include nested subtests; `tap.mjs` parses exactly that.
- **Exact strings** are counted by `src.mjs` with `String.split`; tree-wide checks use `git grep` at `$S` through the wrapper, excluding `qa/briefs/` and `.cland/`.
- **The preservation lock** `/tmp/cland-preserve.lock`: `mkdir` must exit 0, owner file, owner-checked literal-path release; one native file per slot, at most 15 minutes (`std.mjs` exits 124: INCONCLUSIVE); a held lock is BLOCKED for now (retry later; never remove another owner's lock).

## Stage

- Epic: E-1537 (Workbenches, doctor, setup and docs for hosts).
- Exact stage name: the Hosts row and session rows.
- Items, in plan order, by lane (VERIFIED in `task plan show E-1537 --json` at `8a9e0b474` and again at `8913e8ab4`): [T-1819 (the hub pushes host state to the workbenches), T-1820 (the web's Hosts row in the Sessions area), T-1821 (Neovim's Hosts row, and session rows that name their host)], [T-1822 (the web's session rows name their host)], [T-1823 (Neovim attaches a host session through the `ssh -t` attach)], [T-1824 (the web's hosts and logins frames, with web-started card sign-ins)]. The run reads membership, counts and state from `task plan show E-1537 --json` (E1537S1-00), never from this list. QA finding fixes added after writing are listed in the request.
- Policy: affected/after-stage (no item override; every member's `qaPolicy` is `{"scope":"affected","when":"after-stage"}` with no QA criteria, VERIFIED at `8a9e0b474` for the first four and at `8913e8ab4` for T-1820 and T-1821).
- Scope: **affected.** The combined changed behaviour through the stage's named test files, the unedited consumers of the frames, modules and fixtures the stage edits, the native files the stage reaches, read-only source and tree checks, the evidence read of E1537S1-06, and the stage demo on a scratch project with two fake hosts.
  - T-1819 (landed `8d1307654`, `8d130765452c941fc780dac905da249bbbed9a29`, the last landing; VERIFIED; own lines equal to its reviewed tip `ac0f036fd` (`ac0f036fde7d580dc55a57c3955fc591bc88ff06`, rev-36 `rev-36-1819-source-4` and `rev-36-1819-final-2` clear there, C1 to C6 verified), byte-identical except five files the intervening landings also changed (C-1); 37 files): `HostsState` (`hub/src/host/hosts-state.ts`, new) projects per pool the provider, region, live hosts against `max_hosts`, weighted slots used against total, per-harness logins `{inUse, usable, signedOut}` (`LoginRecords.poolSummary`, `hub/src/host/logins.ts`), an alert (`{kind:'outage',host,since}` from `HostHealth.outageSince`, `hub/src/host/host-health.ts`, or `{kind:'provider',reason}` from `PoolRuntime.failure`, `hub/src/host/pool-runtime.ts`) and the hosts (id, size, region, state, created, running sessions, `priceHourly`, `spendToday` through `hub/src/host/live-accrual.ts` and `host-leases.ts`); coalesced to one publish per second of hub clock and re-pushed each minute while a host is live; pushed as a standalone `hosts.state` frame on a non-snapshot client hello (`hub/src/hub/dispatch.ts`), as the optional `sessions.hosts` snapshot field (`hub/src/hub/snapshot.ts`) and on change (`hub/src/hub/core.ts`, `hub/src/hub/daemon.ts`); the frame type and `HostsStatePool` in `hub/src/protocol.ts` and `shared/wire/index.ts`. Tests: `hub/test/hosts-state.test.ts` (T2, new); consumer migrations in `hub/test/connection-snapshot.test.ts`, `hub/test/connection-resync.test.ts`, `hub/test/edges-component.test.ts`, `hub/test/request-guard-component.test.ts`, `hub/test/tracker-component.test.ts` (T2) and `hub/test/daemon.test.ts`, `hub/test/tracker.test.ts` (T3; the three positional readers that reddened batch `abfc5334`); `hub/test/harness.ts` (`assignRole` drains additive frames) and `hub/test/wire-conformance.ts` (a `HostsStatePool` equality).
  - T-1822 (landed `089d045f5`, `089d045f525fef5ae15cade2ba83bb14e20de514`; VERIFIED; byte-identical to its reviewed tip `b63182b8e` (`b63182b8eeb016bd31fd76b06cbdb30bc3225fa0`, rev-35 `rev-35-1822-source-2` and `rev-35-1822-final-1` clear there, C1 and C2 verified); 7 files): the host fact on the desktop row (`web/src/sessions/SessionRow.tsx`) and on the phone session page (`web/src/sessions/SessionPage.tsx`), shown for a non-`local` host with the tooltip `Host the session runs on`. Tests: `web/test/sessions.test.ts`, `web/test/phone-sessions.test.ts` (Web, edited) and the fixture `web/test/session-host-fixture.ts` (new: a registered `testHost` with synthetic directory facts, and `ensureWebBuild` in a `before` hook).
  - T-1823 (landed `a335caecf`, `a335caecfdf9cfd02093093027d6a2d7e080d299`, the first stage landing; VERIFIED; byte-identical to its reviewed tip `14f459698` (`14f45969887614afcda6405ce46a712bae412a42`, rev-36 `rev-36-1823-source-1` and `rev-36-1823-final-1` clear there, C1 to C3 verified); 6 files): the attach note names the host (`attaching to <name> on <host>…`, `nvim/lua/cland/sessions.lua`), a refused attach keeps the existing `cannot attach <name>: <reason>` note, and the README's shell section says so. Tests: `nvim/test/host-attach.test.ts` (T3, new).
  - T-1824 (landed `686ec94f4`, `686ec94f494ed03986c06fdc1489384b048c10fb`; VERIFIED; own lines equal to its reviewed tip `d2e31fa50` (`d2e31fa508bde9f1bfbc18dea2f741cd173aa598`, rev-37 `rev-37-1824-delta-1` and `rev-37-1824-evidence-1` clear there, C1 to C5 verified), byte-identical except three files the intervening landings also changed (C-1); 26 files): the web authority table admits `host.stop`, `login.list`, `login.snapshot`, `login.remove`, `login.signin` and a non-key `login.add` (`hub/src/hub/web-authority.ts`); the dispatcher's local check admits an authorized authenticated web user and routes web `login.add` and `login.signin` to `LoginCardSignIn.start` (`hub/src/hub/dispatch.ts`, `hub/src/host/login-card-signin.ts`), which answers with `{name, card}` once the `login-signin-code` card is durable; usage text and the frozen usage fixture (`hub/src/cli/usage.ts`, `hub/src/cli/usage/login.ts`, `hub/test/fixtures/cli-usage/commands.json`); docs and the implement skill. Tests: `hub/test/web-hosts-authority.test.ts` (T2, new) with `hub/test/web-frame-client.ts` (new: the real one-use link and cookie edge, no browser); `hub/test/host-stop.test.ts`, `hub/test/login-list.test.ts`, `hub/test/web-authority.test.ts` (T2) and `hub/test/web-authority-unit.test.ts` (T1) (edited).
  - T-1820 (landed `36f700d73`, `36f700d73665b0f37593925c564444c34de9b840`, the last landing; VERIFIED; own lines equal to its reviewed tip `72932d333` (`72932d3333cf8a8930634e91dc32f2771c628ab6`, rev-35 `rev-35-1820-source-1` not clear at `390e79438`, `rev-35-1820-source-2` and `rev-35-1820-final-1` clear at `72932d333`, C1 to C5 verified), byte-identical except two files T-1821's landing also changed (C-1); 12 files): `HostsLine` (`web/src/sessions/HostsLine.tsx` and `web/src/sessions/HostsLine.module.css`, new; tokens only, the alerted line in `var(--failed)`) placed after the Remotes line in `web/src/sessions/SessionsArea.tsx`; the client keeps the pushed `hosts.state` pools and the snapshot's optional `sessions.hosts` (`web/src/connection.ts`, `web/src/sessions/state.ts`); one line per pool, `<pool> <hosts>/<max> hosts · <used>/<total> slots · logins claude …, codex …` with `(<n> signed out)`, plus `<host> unreachable` or the provider reason while alerted, each fact with a tooltip; the existing `Fold` (`area="sessions" id="hosts"`) lists each host's id, size, region, locally advancing uptime, sessions, `$…/h` and `$… today` (`unknown` for null); hidden for an empty pool list or a hub that sends none; the web README. It also adds an optional `createHostRegistry` dependency to `serveProject` (`hub/src/hub/daemon.ts`, defaulting to `projectSshHosts`) and its `projectHub` option (`hub/test/harness.ts`), so a test can inject tunnel observations at the registry's `subscribeStatus` boundary. Tests: `web/test/hosts.test.ts` (Web, new).
  - T-1821 (landed `cb31e4342`, `cb31e4342a20c40e90f72791663385696589c234`; VERIFIED; byte-identical to its reviewed tip `27b1c58d1` (`27b1c58d154aad19d946391ebaf48f7b6e9be3f3`, rev-36 `rev-36-1821-source-1` not clear at `c8c5f931b`, `rev-36-1821-source-2` and `rev-36-1821-final-1` clear at `27b1c58d1`, C1 to C5 verified); 18 files): `nvim/lua/cland/hosts.lua` (new) draws the Hosts row after Remotes in the sessions panel (`nvim/lua/cland/panels.lua`) from `state.S.hosts`, which each `hosts.state` replaces (`nvim/lua/cland/init.lua`, `hub.lua`, `state.lua`): a dim `Hosts` header that `za` folds through the existing fold handler (folded by default, `hosts_folded = true`), one wrapped line per pool `<pool> <n>/<max> hosts · <used>/<total> slots · logins claude …` in `ClandDim`, or in `ClandRed` with `<host> unreachable` or the provider reason while alerted, and per host `<id> · <size> · <region> · up <h>h <m>m · sessions … · $…/h · $… today`; session rows and the selected meta line name a non-empty host, wrapping long ids onto continuation lines; the README. Recorded fixtures regenerated: `nvim/test/fixtures/protocol-frames.json`, `nvim/test/fixtures/protocol-frames/hosts.json` (new) and `nvim/test/fixtures/protocol-frames/sessions.json`. Tests: `nvim/test/hosts.test.ts` (T2, new), `nvim/test/hosts-native.test.ts` (T3, new; its allowance added to `hub/test/durations.json` in the landing), `nvim/test/sessions.test.ts` (T2, edited).
- **Merge watch** (VERIFIED with `git log` per file from `BASE` to `8913e8ab4`). `docs/agents/tests/index.md` and `hub/test/tiers.json` are edited by T-1823, T-1824, T-1819, T-1821 and T-1820; `hub/src/hub/daemon.ts` and `hub/test/harness.ts` by T-1819 and T-1820; `nvim/README.md` by T-1823 and T-1821; `hub/test/durations.json` also by T-1821 and `8913e8ab4`; `hub/src/hub/dispatch.ts`, `docs/hub/host-status-stop.md` and `hub/README.md` by T-1824 and T-1819; `hub/test/durations.json` by T-1813 and T-1824. The registration points `hub/src/protocol.ts`, `shared/wire/index.ts`, `hub/src/hub/dispatch.ts` and `hub/src/hub/web-authority.ts` take one-entry edits from parallel lanes (A-19022). E1537S1-02 names every later commit that touched a member's files.

### Criteria map

The stage verdict carries no item or epic marks; this tells the run which check proves what. E1537S1-04 checks that every row id named here exists in the tables below. VERIFIED at `8913e8ab4` (every member's criteria read with `task view <id> --json`, each `checked` with its final verified mark at its reviewed tip; every test title read from the test files there). Generated titles are named as expansions of their templates; `expect.json` holds every full title.

| criterion | proven by |
| --- | --- |
| T-1819 C1 (`hosts.state` on connect and in the featured sessions snapshot, per pool live hosts against `max_hosts`, slots used against total, per harness logins in use against usable) | E1537S1-10 (test `hosts state connects with empty pools on previous and featured wire shapes`; test `host projection allows only public facts and coalesces changes within one second`; test `placement, exit, login state and hot pool settings push socket replacements`); E1537S1-82 (the scratch hub with two fake hosts, read on a legacy connect and in a featured snapshot); E1537S1-03 |
| T-1819 C2 (each host's id, size, region, state, creation time, sessions, price per hour and today's spend; no address, SSH identity, volume id or token) | E1537S1-10 (the projection case above; test `workbench prices come from the admitted DigitalOcean declaration checkpoint`; test `pre-acquisition and confirmed machine deletion never accrue live spend`); E1537S1-82 (no machine id, machine address, hub secret or fake-host root in the frame); E1537S1-03; E1537S1-05 |
| T-1819 C3 (placement, exit, a login bound or signed out and `config set hosts.<pool>.max_hosts` each push within one second of hub clock, at most one push a second) | E1537S1-10 (the placement case and the projection case's 999 ms and 1000 ms reads); E1537S1-84 (scratch: `max_hosts` 3 read back in the next connect frame); E1537S1-03 |
| T-1819 C4 (a dropped tunnel alerts the pool with the host and the outage start before the 3-minute `unreachable` state; clears on recovery) | E1537S1-10 (test `tunnel loss alerts before unreachable and clears on recovery`); E1537S1-64 (the `host-unreachable` file, the unedited health owner over T-1819's `since` and `changed` edits); E1537S1-03; E1537S1-66 (native: the `hosts-native` file's test `fake host tunnel loss renders red within one second and recovery clears the native pool row`, a real fake-SSH master loss on a fixture-owned projectHub reaching Neovim's row as `<id> unreachable` in `ClandRed` within one second, recovery clearing it). Not QA-triggerable on a CLI-started hub (see "Carried corrections"; T-1839) |
| T-1819 C5 (a refused create or a rate-limit pause alerts the pool with the reason until a create succeeds) | E1537S1-10 (both expansions of `pool create stays alerted through backoff and clears after success: rate limit=<rateLimited>`; test `manual create refusal alerts and unrelated outage recovery cannot settle it`); E1537S1-11 (`pool-failures`, `pool-scale`, the unedited consumers of `pool-runtime.ts`); E1537S1-03 |
| T-1819 C6 (a previous-wire-shape client works unchanged; no `[hosts.<pool>]` table pushes an empty pool list) | E1537S1-10 (the connect case; test `hello negotiates model features and legacy clients keep their existing welcome`; test `explicit resume invalidates an existing subscriber captured by in-flight and queued publications`; the edges, request-guard and tracker-component migrations; `remote-workbench`); E1537S1-62 (the three T3 positional readers of batch `abfc5334`); E1537S1-45 (Neovim with no `hosts.state` frame shows no Hosts row, and the existing remote-state case); E1537S1-35 (the recorded catalog's consumers); E1537S1-82 (`frames before it: welcome,remote.state`) |
| T-1822 C1 (a fake-host session names its host id on its Sessions row and phone session page; a local session names none) | E1537S1-30 (test `Sessions remote host fact names its host with a tooltip on ground and selection`; test `phone session page names a remote host and omits the local host`); E1537S1-03 |
| T-1822 C2 (the host fact has a tooltip; colour and contrast checks pass in the selected state) | E1537S1-30 (the Sessions case: the computed colour before and after selection); E1537S1-01 (`npm run typecheck`, which runs `web/check-colours.ts` and `web/check-tokens.ts`); E1537S1-03 |
| T-1823 C1 (Enter on a fake-host session in headless Neovim opens a terminal whose job runs the hub's SSH attach with `-t` and reaches the fake host's attach) | E1537S1-60 (`nvim/test/host-attach.test.ts` test `Enter attaches through pinned SSH, names the host, reattaches after restart and shows revocation`); E1537S1-61 (`hub/test/host-attach.test.ts` test `printed terminal SSH pins host keys, disables sharing and forwards, and contains no secret`); E1537S1-03 |
| T-1823 C2 (the note names session and host; a refusal for a revoked host shows the hub's reason) | E1537S1-60 (the note lines `attaching to worker on f1…` and `cannot attach worker: host is revoked`); E1537S1-03 |
| T-1823 C3 (after `:restart` an attached host session attaches again through the same SSH command) | E1537S1-60 (the restart half of the case above); E1537S1-61 (`nvim/test/shell.test.ts` test `:restart re-attaches the session terminals instead of ending the sessions`) |
| T-1824 C1 (web `login.list`, `login.snapshot`, `login.remove` answer as from the local CLI; `host.stop` stops a fake host and ends its sessions as exited) | E1537S1-20 (test `web login reads reach local handlers and forbidden host and key frames name their rule`; test `web snapshot and removal retain the local success shapes and durable storage receipts`); E1537S1-64 (both `web stop` expansions of `C3 <stop|web stop> joins lease renewal and requires confirmed destroy: <confirmed>`); E1537S1-03 |
| T-1824 C2 (web `login.add` and `login.signin` run the sign-in on a pool host through the card runner and answer at once with the login name and the card id) | E1537S1-20 (the four expansions of `web <add|signin> <harness> returns its persisted card before completion`; both expansions of `web add projects declared fields with hidden renewal mode: existing <existing>`); E1537S1-21 (the card runner's unedited owner, remote and recovery files); E1537S1-65 (the native card runner); E1537S1-03 |
| T-1824 C3 (a web-started sign-in leaves the fake Codex login `ready` with no answer and the fake Claude Code login `ready` once the card's answer reaches the prompt) | E1537S1-20 (the `codex` and `claude-code` expansions above: `received` empty for Codex, `SENTINEL-web-code` plus a newline for Claude Code); E1537S1-65 |
| T-1824 C4 (a key login, `host.create`, `host.destroy`, `host.revoke`, `host.prepare` and `login.set` from the web, and every host and login frame from a session or a remote, refused naming the rule) | E1537S1-20 (the forbidden-frames case above; test `every host and login frame refuses sessions and messenger ingress`; test `web host and disk-login actions are admitted while provisioning and keys stay local`; test `login frames retain session and remote refusals with selective web authority`); E1537S1-03 |
| T-1824 C5 (in users mode each web action's audit and journal record carries the acting user's id) | E1537S1-20 (test `users-mode web host actions audit the transport-resolved user in log and journal`) |
| T-1820 C1 (two fake hosts in one pool: the pool line with hosts, slots and logins per harness as the hub reports them, desktop and phone, no horizontal scroll) | E1537S1-40 (test `Sessions Hosts consumes the fake provider inventory snapshot and configuration push`: two fake-provider machines through the production projection, `agents 2/4 hosts · 0/16 slots`; both expansions of `Sessions Hosts renders pushed facts and alert recovery (<desktop|phone>)`: `agents 2/4 hosts · 7/16 slots · logins claude 2/3 … codex 1/1`, `1 signed out`, and at 320 px a `scrollWidth` of 320 with no row overflow); E1537S1-03 |
| T-1820 C2 (the fold lists each host with id, size, region, uptime, sessions, price per hour and spend today) | E1537S1-40 (the two pushed-facts expansions: fold and unfold through `Fold Hosts`, each host's id, size, region, uptime, sessions, `$0.25/h` and `$1.50 today` or `unknown`, uptime advancing with no push); E1537S1-03 |
| T-1820 C3 (an unreachable fake host turns the pool line red within one second naming it; plain again on recovery) | E1537S1-40 (the inventory case: a tunnel loss injected at the registry's `subscribeStatus` boundary passes through production HostHealth, HostsState coalescing and the socket to `fake-1 unreachable` in `rgb(255, 123, 114)` within 1000 ms, then back to plain; the pushed-facts expansions: outage and provider red, plain recovery); E1537S1-03 |
| T-1820 C4 (no Hosts row without a host pool) | E1537S1-40 (test `Sessions hides Hosts for an empty pool list and a previous hub snapshot`; the empty push in the pushed-facts expansions detaches the section); E1537S1-03 |
| T-1820 C5 (colour and contrast checks pass; no key listener outside the key map) | E1537S1-01 (the typecheck's `web/check-colours.ts`, `web/check-tokens.ts` and `web/check-hooks.ts`); E1537S1-05 (`key listeners in web/src: [web/src/keyboard.ts ]`); E1537S1-03 (no colour value in the CSS Module) |
| T-1821 C1 (the Hosts row after Remotes, one line per pool from the hub frame, with hosts, slots and logins per harness) | E1537S1-45 (test `Hosts follows Remotes, wraps pool facts, folds with za and clears pushed alerts`: Remotes before Hosts, `agents 1/4 hosts`, `spare 0/2 hosts`, `2/8 slots … logins claude 2/3 … codex 1/1 … opencode 0/2`); E1537S1-66 (natively `agents 1/2 hosts` from a fake-provider host); E1537S1-03 |
| T-1821 C2 (`za` on the Hosts header expands and folds the host list with its facts) | E1537S1-45 (the same case: `za` shows `fake-size`, `$0.070/h`, `$0.120 today`, `up 1h 0m`, `sessions worker`; `za` again folds to `▸ Hosts`); E1537S1-03 |
| T-1821 C3 (an unreachable fake host turns the pool line red within one second naming it; plain on recovery) | E1537S1-45 (pushed outage and provider alerts in `ClandRed` within 1000 ms; recovery in `ClandDim`); E1537S1-66 (the native tunnel loss); E1537S1-03 |
| T-1821 C4 (a fake-host session names its host on its panel row and selected meta line; a local session none) | E1537S1-45 (`nvim/test/sessions.test.ts` test `recorded host session names its host on row and selected meta; local omits it`, at 40, 30 and 100 columns); E1537S1-03 |
| T-1821 C5 (no Hosts row without a pool; the recorded protocol-frame fixtures include `hosts.state`) | E1537S1-45 (no Hosts before any frame and after an empty push); E1537S1-02 (the three regenerated fixture paths at the landing); E1537S1-35 (the catalog consumers); E1537S1-67 (`nvim/test/scenarios/workbench.test.ts` test `recorded protocol fixtures match the live hub attach frames`); E1537S1-03 |
| Stage demo (with two fake hosts both workbenches show the line and the list; a host made unreachable turns the row red) | E1537S1-80, E1537S1-81, E1537S1-82, E1537S1-84, E1537S1-85 (hub side, scratch, two fake hosts); E1537S1-40 and E1537S1-45 (both workbenches' line and list, from fake-provider inventory and pushed frames); E1537S1-66 (the red row natively in Neovim on a fixture-owned hub), E1537S1-40 (red in the web at the carrier's status boundary); E1537S1-83 (the summary of that substitution) |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1537 --json` lists in stage `the Hosts row and session rows`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit. A task closed `done` with no branch and no landing receipt must have no `Item:` trailer on dev (evidence-only completion; none at writing). A dirty build, a missing required merge (**every member needs a landing here**) or moved dev blocks this run: retain any collected evidence and report to the requester. The brief names no run id on purpose.

At writing (dev `8913e8ab473730733e6e38deb531934a57e3a7b2`): T-1823 landed as `a335caecf`, T-1822 as `089d045f5`, T-1824 as `686ec94f4`, T-1819 as `8d1307654`, T-1821 as `cb31e4342` and T-1820 as `36f700d73` (full SHAs under "Stage"), each with exactly one `Item:` trailer and one `Reviewed-by:` trailer naming its final clear review on the first-parent history (VERIFIED); T-1813 landed out of stage as `c7978ae30`. The plan read at `8913e8ab4` (VERIFIED with `task plan show E-1537 --json`): the stage `open`, `items` in the plan order "Stage" lists, `merged 6`, `total 6`, `statuses {"done":6}`, cover `tree df654f495164d668ac92de841b67c929b71f5f9c`, `missing ["Linux droplet","macOS"]` (the Coordinator's cover pair is still to run).

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step. E1537S1-08 builds `web/dist` in the worktree (ignored by Git) for the Web rows, whose pinned Headless Shell comes from `node_modules/playwright-core/.local-browsers`; the Neovim rows need the pinned Neovim that `nvim/bin/nvim-path.ts` resolves (`NV` and `NVD` in the environment block; a linked worktree uses the main worktree's cache).

**Where things live.** All scratch state is under `$Q` (`/private/tmp/q53-…`, realpath, 23 bytes; the stage-3 kit's seal accepts exactly this prefix) and `$T` (`/private/tmp/qa-e1533-s3-<uuid>`). Native rows read the system per-user TMPDIR `$ST` and `/private/tmp` and write nothing there themselves. The scratch project is `$Q/p1`; its fake-host root is `$Q/fh` (the hub seal's `CLAND_FAKE_HOST_ROOT`); created fake hosts sit behind one `/private/tmp/ct-<32 hex>` alias recorded in `$Q/alias.txt`; its spend ledger is `$Q/executor-state/spend.json`. The only paths under the repository are `$W` in `.cland/worktrees/` and the evidence `$EV` in `.cland/qa/E-1537/<run>/`, both ignored by Git; nothing is written to `.cland/tasks/` except through the verdict.

**Isolation (rule 15).** Every scratch command runs in the disposable project p1 with its own HOME, XDG directories and Git config, through the fresh seal; every Git call goes through `$Q/git.mjs`. Never the live project's hub, config, roles, territory, `hub.db`, secrets or discovery, and never the human's HOME (`~/.cland`, `~/.ssh`, `~/.claude`, `~/.codex`, `~/.opencode`, `~/.local/state`, `~/.config/cland`). Never read or print a credential. Never run `cland login …`, `cland secret …`, `cland config set`, `cland role launch`, `cland session …`, `cland host …` or `cland hub …` against the live project. Two shells, never mixed: **QA's own shell** keeps QA's session identity (worktree, roots, `quiet`, the plan and item reads, the source checks, every record); **every other command** runs through `$Q/fresh.mjs` or `$Q/std.mjs`.

**Removals.** Every `rm` names one literal path, written out in full after it was printed and checked; never a glob, a variable, a command substitution or `xargs` (the project's literal-rm hook refuses them).

### Environment

Put Node from `/Users/evgeniyivanov/.nvm/versions/node/v24.21.0/bin` first on `PATH` and check `node --version` against the qa skill's `node-engines.json` (`>=24.13.0 <25`). If TMPDIR is unset in QA's shell, export it to the value `getconf DARWIN_USER_TEMP_DIR` prints. In QA's own shell (bash):

```sh
R=/Users/evgeniyivanov/Projects/cland/v0
S=<dev SHA>                                    # the full dev SHA from the request
WROTE=8913e8ab473730733e6e38deb531934a57e3a7b2 # the dev this brief was written at (first drafted at 8a9e0b474)
K=f43f4e21049e9c62a97c8dec1ebf37f9c7035a62     # the fixed kit commit (A-17643: pin a commit, never a blob)
M2=0d0618042fae7b76919d1be152e252b09e4a43ad    # the E-1535 stage-1 brief's carried corrections
M3=18911bda46c7c0dc332619e93d25041069d3704a    # the E-1535 stage-2 brief: its helpers and carried corrections
M4=85e60f6cb34ec320cc7a1f5456de3a4693acbe17    # the E-1535 stage-3 brief with C-1, R-1, R-2: r80 and carried corrections
M5=a72e34d9a83781f1ef7d87c273aaf5f281723046    # the E-1535 stage-4 brief with R-1: its own-family prefixes and carried corrections
M6=d5c59e2c73b61f7e72e7a25b533f3945d2f1fcb0    # the E-1535 Definition-of-done brief's carried corrections
N2=becee171b9cf1fa76e1732c674e13f2656551397    # the E-1534 stage-2 brief: waitfor and the fake-host census q57
RUN=qa-e1537s1-$(date +%F)-1                   # unique run id for E-1537; bump the suffix on a rerun
export QA_SESSION=${QA_SESSION:-${CLAND_SESSION_NAME:-}}
[ -n "$QA_SESSION" ] || echo "BLOCKED: no QA session name"
echo "QA shell credential-prefix names: $(env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|CODEX_API|CODEX_ACCESS|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)')"
W=$R/.cland/worktrees/qa-e1537s1-$RUN
EV=$R/.cland/qa/E-1537/$RUN
git -C "$R" worktree add --detach "$W" "$S"     # the one plain Git call: the wrapper below imports from $W
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
ST=$(cd "$(getconf DARWIN_USER_TEMP_DIR)" && pwd -P)
T=/private/tmp/qa-e1533-s3-$(uuidgen | tr 'A-Z' 'a-z'); mkdir -m 700 "$T"
Q=$(cd "$(mktemp -d /tmp/q53-XXXXXX)" && pwd -P); chmod 700 "$Q"
mkdir -p "$Q/home" "$Q/config" "$Q/opencode" "$Q/state" "$Q/cache" "$Q/claude" "$Q/codex" "$Q/fake-claude" "$Q/fake-codex" "$Q/fake-opencode" "$Q/executor-state" "$Q/p1" "$Q/fh" "$Q/bin" "$Q/kit"
chmod 700 "$Q/claude" "$Q/fake-claude"
: > "$Q/pids"; : > "$Q/home/.gitconfig"; : > "$Q/home/.gitignore-global"
ln -s "$W/hub/test/fakes/fake-ssh.ts" "$Q/bin/ssh"; ln -s "$W/hub/test/fakes/fake-scp.ts" "$Q/bin/scp"
printf '#!/bin/sh\nexec "$@"\n' > "$Q/bin/setsid"
printf "#!/bin/sh\nln -s '%s/node_modules' node_modules\n" "$W" > "$Q/bin/npm"
chmod 700 "$Q/bin/setsid" "$Q/bin/npm"
printf '{"W":"%s","Q":"%s","EV":"%s","T":"%s","R":"%s","ST":"%s","SESSION":"%s"}\n' "$W" "$Q" "$EV" "$T" "$R" "$ST" "$QA_SESSION" > "$Q/state.json"
cat > "$Q/git.mjs" <<'JS'
// node "$Q/git.mjs" <git args…>: Git under the shared seal (fixtureEnvironment + scratchGitEnvironment), every argument unchanged (E-1535 stage-4 run correction R-1)
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const s = JSON.parse(readFileSync(new URL('./state.json', import.meta.url), 'utf8'));
const { fixtureEnvironment, scratchGitEnvironment } = await import(`${s.W}/test-support/fixture-environment.ts`);
const env = scratchGitEnvironment(s.Q, fixtureEnvironment(s.Q, process.env), { excludesFile: `${s.Q}/home/.gitignore-global` });
const p = spawnSync('git', process.argv.slice(2), { env, stdio: 'inherit' });
process.exit(p.status ?? 1);
JS
git() { node "$Q/git.mjs" "$@"; }                # from here on every Git call in this shell, kit functions included, is sealed
echo "git wrapper: $(type -t git); $(git -C "$W" rev-parse HEAD)"
NV=$(cd "$W" && node nvim/bin/nvim-path.ts 2> /dev/null); NVD=$(dirname "${NV:-/nonexistent/x}")
echo "pinned Neovim: ${NV:-none} $([ -x "${NV:-/nonexistent}" ] && echo executable || echo missing)"
carried() { git -C "$R" show "$1:qa/briefs/$2.md" | awk -v e="$5" '/^## Carried corrections/{f=1} $0==e{exit} f' > "$EV/carried-from-$3.md"; echo "$3 commit $(git -C "$R" rev-parse "$1^{commit}"); carried lines $(wc -l < "$EV/carried-from-$3.md" | tr -d ' ') want $4; sha1 $(shasum < "$EV/carried-from-$3.md" | cut -c1-40)"; }
carried "$M2" E-1535-stage-1 M2 127 '## Stage'; carried "$M3" E-1535-stage-2 M3 55 '## Stage'; carried "$M4" E-1535-stage-3 M4 80 '## Stage'; carried "$M5" E-1535-stage-4 M5 76 '## Stage'; carried "$M6" E-1535 M6 59 '## Build'
```

Expected: `git wrapper: function; <S>`; `pinned Neovim: <path> executable` (missing is a setup BLOCKED for the Neovim rows); the five commits equal `M2` to `M6`; carried lines 127, 55, 80, 76 and 59; SHA-1s `98f38398667ed6b1192f2d9d20e131a30eb88bdc`, `51da4c95a6b8c380b7b11e4536c7d23f93986701`, `e4ad4448829797e25c364afad87b0f3f2cf3b06e`, `7555a12ef6902bbfe8dd2094d14e08d2ea93c61a` and `82535892ef7a00b2e4762a0d4515eebe1ca64a90` (VERIFIED in bash at `8a9e0b474`).

**The kits and helpers, from fixed commits.** A missing block or a SHA-1 other than `want` is a setup BLOCKED.

```sh
for b in E-1532-stage-4 E-1533-stage-3; do git -C "$R" show "$K:qa/briefs/$b.md" > "$Q/kit/$b.md"; done
git -C "$R" show "$M3:qa/briefs/E-1535-stage-2.md" > "$Q/kit/E-1535-stage-2.md"
git -C "$R" show "$M4:qa/briefs/E-1535-stage-3.md" > "$Q/kit/E-1535-stage-3.md"
git -C "$R" show "$M5:qa/briefs/E-1535-stage-4.md" > "$Q/kit/E-1535-stage-4.md"
git -C "$R" show "$N2:qa/briefs/E-1534-stage-2.md" > "$Q/kit/E-1534-stage-2.md"
sed -n '133,136p' "$Q/kit/E-1532-stage-4.md" > "$Q/kit-shell.sh"; sed -n '228,279p' "$Q/kit/E-1532-stage-4.md" > "$Q/kit-tap.sh"
echo "kit first lines: $(head -n 1 "$Q/kit-shell.sh" | cut -c1-10) | $(head -n 1 "$Q/kit-tap.sh" | cut -c1-27)"
. "$Q/kit-shell.sh"; . "$Q/kit-tap.sh"
kitb() { awk -v n="$2" 'BEGIN{h="cat > \"$Q/" n "\" <<"} index($0,h)==1{f=1} f{print} f&&/^(JS|SH|JSON)$/{exit}' "$Q/kit/$1.md"; }
for n in seal.mjs fresh.mjs frame.mjs body.sh helpers.sh; do kitb E-1533-stage-3 "$n" > "$Q/kit3-$n.sh"; echo "kit3 $n: $(head -n 1 "$Q/kit3-$n.sh" | cut -c1-40) | lines $(wc -l < "$Q/kit3-$n.sh" | tr -d ' ')"; . "$Q/kit3-$n.sh"; done
for n in std.mjs invd.mjs rcp.mjs; do kitb E-1535-stage-2 "$n" > "$Q/kit2-$n.sh"; echo "kit2 $n: $(head -n 1 "$Q/kit2-$n.sh" | cut -c1-40) | lines $(wc -l < "$Q/kit2-$n.sh" | tr -d ' ')"; . "$Q/kit2-$n.sh"; done
kitr() { sed -n "$3" "$Q/kit/$1.md" > "$Q/$2.sh"; echo "$2: sha1 $(shasum < "$Q/$2.sh" | cut -c1-40) want $4"; }
kitr E-1535-stage-2 kit2-fns '308,332p' 7d3265fb3617e213677b78ee5a78cb95aa12eae6          # snapt, snaps, nt, slot, unslot, ns
kitr E-1535-stage-2 kit2-mrow '336,337p' 9f2fc5c7c2f7ba41f5fbec54a9db636cfe014e57         # mrow
kitr E-1535-stage-2 kit2-s0 '345,347p' 6ec8beed74eb77e5f2620b034a1373099ab3e63e           # the S0 environment probes
kitr E-1535-stage-2 kit2-checks '857,861p;870p;901,915p' eff5097fdb01c670d784454447777dd771be3dbd   # ownlines, s01, s99
kitr E-1535-stage-3 kit3-checks '737p;743,745p;748,755p' 3a747a75f89dd49791888683cae6949c55dd9647   # landing, durdelta, s00 (s00 is replaced below)
kitr E-1535-stage-3 kit3-r80 '815,828p' 91ad557b1dd348175a1c2ea14539e385679a9334               # r80 (with stage-3 R-2's slots = 1)
kitr E-1535-stage-4 kit4-own '239,241p' a2f5c157ea5e44f8f2a02a6e8d05ede730a60e3d               # OWN61, OWN65, OWN71
kitr E-1534-stage-2 n2-waitfor '576p' e76bac0684af3c5dcf9ed0a0b5594cfffa32010a                 # waitfor
kitr E-1534-stage-2 n2-q57 '654,663p' b6868c876f69f5240b498c9f84ce7bd9b6451dc7                 # q57, the fake-host census with TERM
. "$Q/kit2-fns.sh"; . "$Q/kit2-mrow.sh"; . "$Q/kit4-own.sh"
node --check "$Q/tap.mjs" && node --check "$Q/seal.mjs" && node --check "$Q/fresh.mjs" && node --check "$Q/frame.mjs" && node --check "$Q/std.mjs" && node --check "$Q/invd.mjs" && node --check "$Q/rcp.mjs" && node --check "$Q/git.mjs" && bash -n "$Q/body.sh" && bash -n "$Q/helpers.sh" && bash -n "$Q/kit2-checks.sh" && bash -n "$Q/kit3-checks.sh" && bash -n "$Q/kit3-r80.sh" && bash -n "$Q/n2-waitfor.sh" && bash -n "$Q/n2-q57.sh" && echo "kits checked"
. "$Q/kit2-s0.sh"
```

Expected: `kit first lines: holder() { | cat > "$Q/tap.mjs" <<'JS'`; each `kit3` and `kit2` heredoc line starts with `cat > "$Q/<name>" <<'` (`kit2 std.mjs` 58 lines, `invd.mjs` 25, `rcp.mjs` 20); every `sha1` equal to its `want` (VERIFIED in bash at `8a9e0b474`); `kits checked`; then the S0 lines as the E-1535 stage-4 run recorded them (both seals with no credential-prefix name, `TMPDIR is T true`, `HOME is Q/home true`; `std` with the user HOME and system TMPDIR, `NODE_COMPILE_CACHE set false`; `Q bytes 23`; each redaction count 0). A `std: BLOCKED` line or a non-zero credential count stops the run (BLOCKED).

**This brief's own helpers.**

```sh
OWN60='^cland-h-[A-Za-z0-9]{6}$'                             # nvim/test/host-attach: tempProject(t, 'cland-h-') in the system TMPDIR; hostPaths' twenty-hex names are T-1806
OWN61N='^(cland-sh-|cland-proj-|fake-codex-|fake-opencode-|ha-)'  # shell (cland-sh-), sessions-lifecycle (cland-proj-, fake-codex-, fake-opencode-), hub host-attach (ha- in /tmp, cland-proj-)
# pfam <id>: per file of a native row, the new /private/tmp names of the hc-, ct- and cland-h- families (A-19022: hc-/ct- 0 -> 0; cland-h- is T-1806, found aside)
pfam() { local d="$EV/$1.inv" k; for k in $(ls "$d" | sed -n 's/\.label$//p' | sort -n); do node -e 'const fs=require("fs"),[d,k]=process.argv.slice(1),r=f=>fs.readFileSync(f,"utf8").split("\n").filter(Boolean),b=new Set(r(d+"/"+k+".before.tmp")),n=r(d+"/"+k+".after.tmp").filter(x=>!b.has(x)),c=p=>n.filter(x=>x.startsWith(p)).length;console.log(fs.readFileSync(d+"/"+k+".label","utf8").trim()+": /private/tmp new hc- "+c("hc-")+"; new ct- "+c("ct-")+"; new cland-h- "+c("cland-h-")+" (T-1806)")' "$d" "$k"; done | tee "$EV/$1.families.txt"; }
```

The TAP expectations (`exact: true` lists every registration; `exact: false` with names requires them; with `[]` the whole file must be `CLEAN`). Every list was read from the test files at `8a9e0b474` and expanded through its loops (VERIFIED; the count of `test(` call sites in each exact file equals its registration lines): T-1819's (`hosts-state` exact), T-1824's (`web-hosts-authority` exact, `host-stop` exact, `login-list` exact), T-1822's (`web/test/sessions.test.ts` and `web/test/phone-sessions.test.ts` exact: every registration is a static title), T-1823's (`nvim/test/host-attach.test.ts` exact), T-1820's (`web/test/hosts.test.ts` exact, read at `8913e8ab4`) and T-1821's (`nvim/test/hosts.test.ts`, `nvim/test/hosts-native.test.ts` and `nvim/test/sessions.test.ts` exact, read at `8913e8ab4`; the native file's one registration holds one nested subtest). The card-runner lists are the E-1535 stage-4 brief's at `M5`, unchanged (VERIFIED: `git diff 9c98a5747 8913e8ab4` empty for those files).

```sh
cat > "$Q/expect.json" <<'JSON'
{
 "hub/test/hosts-state.test.ts": {"exact": true, "names": [
  "hosts state connects with empty pools on previous and featured wire shapes",
  "host projection allows only public facts and coalesces changes within one second",
  "tunnel loss alerts before unreachable and clears on recovery",
  "pool create stays alerted through backoff and clears after success: rate limit=false",
  "pool create stays alerted through backoff and clears after success: rate limit=true",
  "placement, exit, login state and hot pool settings push socket replacements",
  "pre-acquisition and confirmed machine deletion never accrue live spend",
  "manual create refusal alerts and unrelated outage recovery cannot settle it",
  "workbench prices come from the admitted DigitalOcean declaration checkpoint"]},
 "hub/test/connection-snapshot.test.ts": {"exact": false, "names": [
  "hello negotiates model features and legacy clients keep their existing welcome"]},
 "hub/test/connection-resync.test.ts": {"exact": false, "names": [
  "explicit resume invalidates an existing subscriber captured by in-flight and queued publications"]},
 "hub/test/edges-component.test.ts": {"exact": true, "names": [
  "the Unix socket reads a near-limit frame and the next one from a single write; a line or a remainder over the limit closes"]},
 "hub/test/request-guard-component.test.ts": {"exact": false, "names": [
  "a cold task.list burst in one socket write shares its pending answer"]},
 "hub/test/tracker-component.test.ts": {"exact": false, "names": [
  "the task frames work over the Unix socket as the CLI sends them",
  "a subscribed UI hears a `task` event on every index change; task.list carries the verdicts"]},
 "hub/test/remote-workbench.test.ts": {"exact": false, "names": [
  "workbenches receive an allowlisted remote state on a previous-shape hello"]},
 "hub/test/host-status.test.ts": {"exact": false, "names": []},
 "hub/test/pool-failures.test.ts": {"exact": false, "names": []},
 "hub/test/pool-scale.test.ts": {"exact": false, "names": []},
 "hub/test/login-records.test.ts": {"exact": false, "names": []},
 "hub/test/web-hosts-authority.test.ts": {"exact": true, "names": [
  "web add codex returns its persisted card before completion",
  "web signin codex returns its persisted card before completion",
  "web add claude-code returns its persisted card before completion",
  "web signin claude-code returns its persisted card before completion",
  "web login reads reach local handlers and forbidden host and key frames name their rule",
  "users-mode web host actions audit the transport-resolved user in log and journal",
  "every host and login frame refuses sessions and messenger ingress",
  "web snapshot and removal retain the local success shapes and durable storage receipts",
  "web add projects declared fields with hidden renewal mode: existing true",
  "web add projects declared fields with hidden renewal mode: existing false"]},
 "hub/test/web-authority-unit.test.ts": {"exact": false, "names": [
  "web host and disk-login actions are admitted while provisioning and keys stay local"]},
 "hub/test/web-authority.test.ts": {"exact": false, "names": [
  "web refuses host.status even from authenticated human",
  "signed-in web refuses pool preparation"]},
 "hub/test/login-list.test.ts": {"exact": true, "names": [
  "recovered one-sign-in hint appears in the card, Agents notice and login list",
  "login fixture retains borrowed-store ownership after before-hub failure",
  "login fixture retains borrowed-store ownership after hub-drain failure",
  "login list text and JSON expose rows and hosts, retained across hub restart",
  "login frames retain session and remote refusals with selective web authority"]},
 "hub/test/login-card-signin-owner.test.ts": {"exact": true, "names": [
  "a prompt emitted during held native start becomes actionable only with its captured input handle",
  "Create one offers the Claude link and its secret answer completes one snapshot",
  "unknown Create one outcome retains its mounted disk and reports the captured login and host once: native loss",
  "unknown Create one outcome retains its mounted disk and reports the captured login and host once: setup failure",
  "card shutdown joins a held second native writer after the first writer fails",
  "a close without a native exit fact interrupts rather than authorizing disk cleanup",
  "accepted card intent interrupted before follow-up reports once on owner recovery",
  "runner refusal with not-admitted proof completes failed",
  "runner refusal without proof interrupts",
  "Codex device label output raises its code card and closes ready without an answer",
  "Codex one-time prompt output raises its code card and closes ready without an answer",
  "the fifteen-minute limit waits for the matching cancellation close before signing out"]},
 "hub/test/login-card-signin-remote.test.ts": {"exact": false, "names": []},
 "hub/test/login-card-recovery.test.ts": {"exact": false, "names": []},
 "hub/test/cli-usage-compatibility.test.ts": {"exact": false, "names": []},
 "hub/test/cli-help.test.ts": {"exact": false, "names": []},
 "hub/test/cli-command-help.test.ts": {"exact": false, "names": []},
 "hub/test/cli-usage.test.ts": {"exact": false, "names": []},
 "hub/test/login-snapshot-cli.test.ts": {"exact": false, "names": []},
 "web/test/sessions.test.ts": {"exact": true, "names": [
  "Sessions remote host fact names its host with a tooltip on ground and selection",
  "Sessions groups count fake sessions and remember folds without hub requests",
  "Sessions rows render merged facts, holds, waiting detail and physical selection keys",
  "Sessions selected human wait names its topic and usage falls back to tokens",
  "Sessions caps stopped rows at the latest twenty and reads merged archives with A",
  "gs from an item reveals its claimed session inside a folded group",
  "Sessions renders deaf health and clears it after the next injection"]},
 "web/test/phone-sessions.test.ts": {"exact": true, "names": [
  "phone Sessions shows counts, one account row and two-line sessions without row actions",
  "phone waiting session page shows its command and both Back paths focus the same row",
  "phone Back restores focus when Stop moves the session into a folded group",
  "phone session page confirms 44 px Stop/Archive actions with scratch CLI receipts",
  "phone verify line opens the shared queue in a full-height sheet and Close restores the list",
  "phone session page names a remote host and omits the local host"]},
 "web/test/session-actions.test.ts": {"exact": false, "names": []},
 "nvim/test/sessions.test.ts": {"exact": true, "names": [
  "recorded session rows show verifier holds and retain claims after release",
  "recorded account pushes update weekly windows and preserve saved folds",
  "recorded source windows preserve severity, local resets, stale age and wrapping",
  "recorded hard-limit pushes show and clear account marks",
  "remote state pushes render facts and failure highlights while old hubs keep the row hidden",
  "recorded deaf health renders while older session rows still render idle",
  "recorded host session names its host on row and selected meta; local omits it"]},
 "nvim/test/hosts.test.ts": {"exact": true, "names": [
  "Hosts follows Remotes, wraps pool facts, folds with za and clears pushed alerts"]},
 "nvim/test/panel-placement-component.test.ts": {"exact": false, "names": []},
 "hub/test/nvim-fixture-boundary.test.ts": {"exact": false, "names": [
  "a per-file catalog retains complete requested frames and refuses a missing recording",
  "a slice loads the committed catalog once for a recorded interleaving and still refuses unknown frames"]},
 "hub/test/nvim-frame-refresh.test.ts": {"exact": false, "names": []},
 "web/test/hosts.test.ts": {"exact": true, "names": [
  "Sessions Hosts consumes the fake provider inventory snapshot and configuration push",
  "Sessions Hosts renders pushed facts and alert recovery (desktop)",
  "Sessions Hosts renders pushed facts and alert recovery (phone)",
  "Sessions hides Hosts for an empty pool list and a previous hub snapshot"]},
 "nvim/test/hosts-native.test.ts": {"exact": true, "names": [
  "fake host tunnel loss renders red within one second and recovery clears the native pool row"]},
 "nvim/test/scenarios/workbench.test.ts": {"exact": false, "names": [
  "recorded protocol fixtures match the live hub attach frames"]},
 "hub/test/test-docs.test.ts": {"exact": false, "names": []},
 "hub/test/suite-tiers.test.ts": {"exact": false, "names": []},
 "nvim/test/host-attach.test.ts": {"exact": true, "names": [
  "Enter attaches through pinned SSH, names the host, reattaches after restart and shows revocation"]},
 "nvim/test/shell.test.ts": {"exact": false, "names": [
  "Enter on a session attaches it in the centre in Terminal mode; ␣␣ returns to the thread",
  ":restart re-attaches the session terminals instead of ending the sessions",
  "an attach client that ended is not reused: Enter and C-v run the attach command again"]},
 "nvim/test/sessions-lifecycle.test.ts": {"exact": false, "names": []},
 "hub/test/host-attach.test.ts": {"exact": false, "names": [
  "printed terminal SSH pins host keys, disables sharing and forwards, and contains no secret"]},
 "hub/test/daemon.test.ts": {"exact": false, "names": [
  "a wrong secret is refused on the WebSocket and on the Unix socket; the right one is welcomed",
  "both edges speak one protocol: a spoke hello over the Unix socket; a client hello over the WebSocket is refused (the human side is the socket)"]},
 "hub/test/tracker.test.ts": {"exact": false, "names": [
  "a hub write and a hand edit at the same time: the last writer wins and the hub logs it"]},
 "hub/test/host-create-ready.test.ts": {"exact": false, "names": []},
 "hub/test/host-stop.test.ts": {"exact": true, "names": [
  "C3 stop joins lease renewal and requires confirmed destroy: true",
  "C3 stop joins lease renewal and requires confirmed destroy: false",
  "C3 web stop joins lease renewal and requires confirmed destroy: true",
  "C3 web stop joins lease renewal and requires confirmed destroy: false",
  "C5 host help lists status and stop",
  "C4 manual create refuses occupied max_hosts before publishing another row"]},
 "hub/test/host-unreachable.test.ts": {"exact": false, "names": []},
 "hub/test/login-card-signin.test.ts": {"exact": true, "names": [
  "native Claude card creates and renews one disk across both remotes with deletion",
  "native Claude card creates and renews one disk across both remotes with one fallback",
  "native Codex card completes device sign-in without an answer",
  "native cancelled Claude card closes its admitted writer before failed disk completion"]}
}
JSON
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("expect checked")' "$Q/expect.json"
```

The source checks (`src.mjs`), counted with `String.split` on the files of the worktree it is given (it calls no Git). At `8913e8ab4` every line reads `ok` (VERIFIED with `node "$Q/src.mjs" "$R"` on the clean root checkout at `8913e8ab4`; the T-1819, T-1822, T-1823 and T-1824 lines first at `8a9e0b474`).

```sh
cat > "$Q/src.mjs" <<'JS'
// node "$Q/src.mjs" <W>   ok, MISMATCH or MISSING per line; counts use String.split on the worktree's files; no Git, no hub
import { readFileSync, existsSync } from 'node:fs';
const [W] = process.argv.slice(2);
const read = f => existsSync(`${W}/${f}`) ? readFileSync(`${W}/${f}`, 'utf8') : null;
const HS = 'hub/src/host/hosts-state.ts', PR = 'hub/src/protocol.ts', WI = 'shared/wire/index.ts', DP = 'hub/src/hub/dispatch.ts', SN = 'hub/src/hub/snapshot.ts', CO = 'hub/src/hub/core.ts';
const HH = 'hub/src/host/host-health.ts', RT = 'hub/src/host/pool-runtime.ts', DM = 'hub/src/hub/daemon.ts', LG = 'hub/src/host/logins.ts';
const SR = 'web/src/sessions/SessionRow.tsx', SP = 'web/src/sessions/SessionPage.tsx', SL = 'nvim/lua/cland/sessions.lua', NR = 'nvim/README.md';
const WA = 'hub/src/hub/web-authority.ts', CS = 'hub/src/host/login-card-signin.ts';
const HL = 'web/src/sessions/HostsLine.tsx', HC = 'web/src/sessions/HostsLine.module.css', SA = 'web/src/sessions/SessionsArea.tsx', CN = 'web/src/connection.ts', WS = 'web/src/sessions/state.ts';
const HO = 'nvim/lua/cland/hosts.lua', IN = 'nvim/lua/cland/init.lua', PA = 'nvim/lua/cland/panels.lua', NS = 'nvim/lua/cland/state.lua', NH = 'nvim/lua/cland/hub.lua';
const C = [
  // T-1819 (the hosts.state frame)
  ['T-1819 C1 the frame type in the hub protocol', PR, "| { type: 'hosts.state'; pools: HostsStatePool[] }", '=1'],
  ['T-1819 C1 the frame type in the shared wire', WI, "| { type: 'hosts.state'; pools: HostsStatePool[] }", '=1'],
  ['T-1819 C1 the pool facts', PR, 'hostCount: number; maxHosts: number; slotsUsed: number; slotsTotal: number;', '=1'],
  ['T-1819 C1 per-harness logins in use, usable and signed out', PR, 'logins: Record<string, { inUse: number; usable: number; signedOut: number }>;', '=1'],
  ['T-1819 C1 C6 the standalone frame on a non-snapshot client hello', DP, "if (!hostId && !features.includes('snapshot') && !frame.resume) peer.send({ type: 'hosts.state', pools: core.hostsState() });", '=1'],
  ['T-1819 C1 the featured sessions snapshot field', SN, 'remotes: core.remoteState(), hosts: core.hostsState() }', '=1'],
  ['T-1819 C1 C3 every change is published', CO, "publishHostsState(pools: import('../protocol.ts').HostsStatePool[]): void { this.#emit({ type: 'hosts.state', pools }); }", '=1'],
  ['T-1819 C1 logins summarised per pool provider and region', LG, 'poolSummary(provider:string,region:string,hosts:readonly string[]):Record<string,{inUse:number;usable:number;signedOut:number}> {', '=1'],
  ['T-1819 C2 the public host entry', HS, 'return { id: row.id, size: row.size, region: row.region, state: row.state, created,', '=1'],
  ['T-1819 C2 sessions are the running process rows on the host', HS, "sessions: processes.filter(p => p.host === row.id && p.status === 'running').map(p => p.name).sort(), priceHourly,", '=1'],
  ['T-1819 C2 the projection names no address', HS, 'address', '=0'],
  ['T-1819 C2 the projection names no SSH identity', HS, 'clientKeyPath', '=0'],
  ['T-1819 C2 the projection names no known hosts', HS, 'knownHosts', '=0'],
  ['T-1819 C2 the projection names no volume id', HS, 'volumeId', '=0'],
  ['T-1819 C2 the projection names no secret', HS, 'secret', '=0'],
  ['T-1819 C3 one publish per second of hub clock', HS, 'this.#timer = this.#o.clock.setTimeout(() => { this.#timer = undefined; this.#flush(); }, Math.max(1, 1000 - (this.#o.clock.now().getTime() - this.#at)));', '=1'],
  ['T-1819 C3 provision and login changes trigger a push', HS, 'this.#unsubscribers = [this.#o.records.provisions.onChange(this.changed), this.#o.records.logins.onChange(this.changed)];', '=1'],
  ['T-1819 C3 pool settings are read at every flush', HS, 'const o = this.#o, settings = o.settings(), now = o.clock.now().getTime();', '=1'],
  ['T-1819 C3 session process and state events trigger a push', DM, "if(event.type==='session.process'||event.type==='session.state'||event.type==='crew')hostsState?.changed();", '=1'],
  ['T-1819 C4 C5 the alert: outage first, then provider failure', HS, "const alert: HostsStatePool['alert'] = outage ? {kind:'outage',host:outage.id,since:o.outage(outage.id)!} : failure ? {kind:'provider',reason:failure} : null;", '=1'],
  ['T-1819 C4 the outage keeps its start', HH, 'const current:Outage={since:at.toISOString(),warning:o.clock.setTimeout(()=>{', '=1'],
  ['T-1819 C4 the outage start is readable', HH, 'outageSince(id:string):string|null{return this.#outages.get(id)?.since??null;}', '=1'],
  ['T-1819 C4 the tunnel status drives the health owner', DM, 'unsubscribeHostStatus=sshHosts.subscribeStatus((id,up,at)=>{hostHealth!.transition(id,up,at);adapters!.sessions.capacityChanged();});', '=1'],
  ['T-1819 C5 a refused or paused create records the reason', RT, "this.#failures.set(pool,result instanceof HostProviderRetry?result.message:row?.reason??'host create refused');", '=1'],
  ['T-1819 C5 a ready create clears it', RT, "if(row?.state==='ready')this.#failures.delete(pool);", '=1'],
  // T-1822 (web session rows name their host)
  ['T-1822 C1 C2 the desktop row host fact and its tooltip', SR, '{row.host && row.host !== \'local\' && <span className={s.pageFact} title="Host the session runs on">{row.host}</span>}', '=1'],
  ['T-1822 C1 C2 the phone session page host fact and its tooltip', SP, '{row.host && row.host !== \'local\' && <><dt>Host</dt><dd title="Host the session runs on">{row.host}</dd></>}', '=1'],
  // T-1823 (Neovim's host attach note)
  ['T-1823 C2 the note names the host of a non-local session', SL, "target = name .. ' on ' .. process.host", '=1'],
  ['T-1823 C2 the pending note text', SL, "local note = note_buf(name, 'attaching to ' .. target .. '…')", '=1'],
  ['T-1823 C2 a refusal shows the hub reason', SL, "note_buf(name, 'cannot attach ' .. name .. ': ' .. tostring(err):gsub('\\n', ' '))", '=1'],
  ['T-1823 the shell notes describe the host attach', NR, "For a session on a host, Enter opens the hub's pinned `ssh -t` attach command.", '=1'],
  // T-1824 (the web's host and login frames)
  ['T-1824 C1 web host.stop admitted', WA, "'host.stop': true,", '=1'],
  ['T-1824 C1 web login.remove admitted', WA, "'login.remove': true,", '=1'],
  ['T-1824 C1 web login.snapshot admitted', WA, "'login.snapshot': true,", '=1'],
  ['T-1824 C1 web login.list admitted', WA, "'login.list': true,", '=1'],
  ['T-1824 C2 C4 web login.add admitted except a key login', WA, "'login.add': (frame: Record<string, unknown>) => frame.kind === 'key' ? 'key logins require stdin on the local CLI' : null,", '=1'],
  ['T-1824 C2 web login.signin admitted', WA, "'login.signin': true,", '=1'],
  ['T-1824 C4 host.create stays local', WA, "'host.create': 'requires the local human CLI or Neovim',", '=1'],
  ['T-1824 C4 host.destroy stays local', WA, "'host.destroy': 'requires the local human CLI or Neovim',", '=1'],
  ['T-1824 C4 host.revoke stays local', WA, "'host.revoke': 'requires the local human CLI or Neovim',", '=1'],
  ['T-1824 C4 host.prepare stays local', WA, "'host.prepare': 'requires the local human CLI or Neovim',", '=1'],
  ['T-1824 C4 login.set stays local', WA, "'login.set': 'requires the local human CLI or Neovim',", '=1'],
  ['T-1824 C1 C4 the dispatcher admits only an authorized web user', DP, "const web = transport.edge === 'web' && !webAuthorityRefusal(frame);", '=1'],
  ['T-1824 C2 web add and signin enter the card runner', DP, "return later(frame.type,this.#cardSignIn.start(input).then(value=>({type:'result',id:frame.id,ok:true,value} as HubFrame),error=>Dispatcher.#failure(frame.id,error)));", '=1'],
  ['T-1824 C2 the start answers on the durable link card', CS, 'start(input:Input):Promise<{name:string;card:string}>{', '=1'],
  ['T-1824 C2 with the login name and the card id', CS, 'receipt?.resolve({name,card:card!});', '=1'],
  ['T-1824 C4 the card runner refuses a key login', CS, "if(input.kind==='key')throw Error('key logins require stdin on the local CLI');", '=1'],
  // T-1820 (the web's Hosts row; VERIFIED at its landing 36f700d73)
  ['T-1820 C1 the Hosts line follows Remotes', SA, '<RemotesLine {...props} /><HostsLine {...props} />', '=1'],
  ['T-1820 C1 the client keeps the pushed pools', CN, "} else if (frame.type === 'hosts.state') {", '=1'],
  ['T-1820 C1 C4 the snapshot field reaches the client', WS, 'verification: { queue: value.verification, receivedAt }, hosts: value.hosts };', '=1'],
  ['T-1820 C1 the pool hosts against the maximum', HL, '{pool.name} {pool.hostCount}/{pool.maxHosts} hosts</span>', '=1'],
  ['T-1820 C1 the pool slots', HL, ' · {pool.slotsUsed}/{pool.slotsTotal} slots</span>', '=1'],
  ['T-1820 C1 the claude harness label', HL, "harness === 'claude-code' ? 'claude' : harness", '=1'],
  ['T-1820 C3 the alert names the host or the provider failure', HL, "{pool.alert.kind === 'outage' ? `${pool.alert.host} unreachable` : pool.alert.reason}", '=1'],
  ['T-1820 C3 the alerted line uses the failed token', HC, '.row[data-error="true"] { color: var(--failed); }', '=1'],
  ['T-1820 C5 no colour value in the CSS Module', HC, '#', '=0'],
  ['T-1820 C2 the fold is the existing Fold control', HL, '<Fold area="sessions" id="hosts" label="Hosts"', '=1'],
  ['T-1820 C2 price per hour', HL, '{money(host.priceHourly)}/h</span>', '=1'],
  ['T-1820 C2 spend today', HL, '{money(host.spendToday)} today</span>', '=1'],
  ['T-1820 C4 no row without a pool', HL, 'if (!pools.length) return null;', '=1'],
  ['T-1820 the injectable registry defaults to the production one', DM, 'sshHosts = await (options.createHostRegistry ?? projectSshHosts)({', '=1'],
  // T-1821 (Neovim's Hosts row and host-naming session rows; VERIFIED at its landing cb31e4342)
  ['T-1821 C1 the client reads the pushed pools', IN, "client:on('hosts.state', function(event)", '=1'],
  ['T-1821 C1 into the state', IN, 'state.S.hosts = event.pools', '=1'],
  ['T-1821 C1 the frame is a known event', NH, "elseif t == 'hosts.state' or t == 'remote.state'", '=1'],
  ['T-1821 C1 the Hosts row is drawn in the sessions panel', PA, "require('cland.hosts').render(c, wrapped)", '=1'],
  ['T-1821 C1 C2 the dim header that folds', HO, "c:add({ { ' ' .. (open and '▾ ' or '▸ ') .. 'Hosts', 'ClandDim' } }, nil, { fold = 'hosts' })", '=1'],
  ['T-1821 C1 the claude harness label', HO, "local label = harness == 'claude-code' and 'claude' or harness", '=1'],
  ['T-1821 C3 the alert names the host or the provider failure', HO, "text = text .. ' · ' .. (alert.kind == 'outage' and (alert.host .. ' unreachable') or alert.reason)", '=1'],
  ['T-1821 C3 the alerted line is red', HO, "wrapped(c, text, type(alert) == 'table' and 'ClandRed' or 'ClandDim')", '=1'],
  ['T-1821 C5 no row without a pool', HO, "if type(pools) ~= 'table' or #pools == 0 then return end", '=1'],
  ['T-1821 C2 za goes through the existing fold handler', PA, "if info and (info.fold == 'accounts' or info.fold == 'hosts') and how ~= 'all open' and how ~= 'all closed' then", '=1'],
  ['T-1821 C2 the host list starts folded', NS, 'hosts_folded = true,', '=1'],
  ['T-1821 C4 the session row names a non-empty host', PA, "local host = type(s.host) == 'string' and s.host ~= '' and s.host or nil", '=1'],
  ['T-1821 C4 the selected meta line names it', PA, "if type(s.host) == 'string' and s.host ~= '' then head[#head + 1] = s.host end", '=1'],
];
for (const [label, file, text, e] of C) {
  const t = read(file), n = t === null ? 'MISSING' : t.split(text).length - 1;
  const pass = t !== null && (e.startsWith('>=') ? n >= Number(e.slice(2)) : n === Number(e.slice(1)));
  console.log(`${pass ? 'ok' : t === null ? 'MISSING' : 'MISMATCH'} ${label} | ${file} | ${n} | ${e}`);
}
JS
node --check "$Q/src.mjs" && echo "src checked"
# ids.mjs <brief>: every E1537S1-NN the criteria map names exists as a row; the open landing markers of the members drafted unlanded
cat > "$Q/ids.mjs" <<'JS'
import { readFileSync } from 'node:fs';
const t = readFileSync(process.argv[2], 'utf8'), map = t.slice(t.indexOf('### Criteria map'), t.indexOf('\n## Build'));
const named = new Set(map.match(/E1537S1-\d+/g) ?? []), rows = new Set([...t.matchAll(/^\| (E1537S1-\d+) \|/gm)].map(m => m[1]));
const missing = [...named].filter(id => !rows.has(id));
const open = ['T-1820', 'T-1821'].map(id => `${id} ${t.split('TODO(' + id + '-landing)').length - 1}`);
console.log(`criteria-map ids ${named.size}; table rows ${rows.size}; missing from the tables: ${missing.length}${missing.length ? ' ' + missing.join(' ') : ''}`);
console.log(`open landing markers: ${open.reduce((n, s) => n + Number(s.split(' ')[1]), 0)} (${open.join(', ')})`);
JS
node --check "$Q/ids.mjs" && echo "ids checked"
```

The check functions for QA's own shell (`landing` and `durdelta` from the stage-3 brief at `M4`; `ownlines`, `s01` and `s99` from the stage-2 brief at `M3`; `s00` and everything after it this brief's own):

```sh
cat > "$Q/checks.sh" <<'SH'
. "$Q/kit2-checks.sh"; . "$Q/kit3-checks.sh"
BASE=94b73e73c2af3879601b840368eaf27fbc8721be    # "Tracker: E-1537 decisions from ask 81a9293a": the parent of the stage's first commit and the merge base of every landed member's tip
MEMBERS="T-1819 T-1820 T-1821 T-1822 T-1823 T-1824"
STAGE="the Hosts row and session rows"
WROTE=8913e8ab473730733e6e38deb531934a57e3a7b2   # the dev this brief was written at (first drafted at 8a9e0b474)
T1813=c7978ae308fce04d502da66fbb8e3709b7c97217   # T-1813, landed out of stage
# reviewed tips (the commit of each member's final clear verdict, read with task view)
TIPS="T-1823 14f45969887614afcda6405ce46a712bae412a42 T-1822 b63182b8eeb016bd31fd76b06cbdb30bc3225fa0 T-1824 d2e31fa508bde9f1bfbc18dea2f741cd173aa598 T-1819 ac0f036fde7d580dc55a57c3955fc591bc88ff06 T-1821 27b1c58d154aad19d946391ebaf48f7b6e9be3f3 T-1820 72932d3333cf8a8930634e91dc32f2771c628ab6"
preserved() { printf '%s\n' web/test/session-actions.test.ts nvim/test/shell.test.ts nvim/test/sessions-lifecycle.test.ts hub/test/host-attach.test.ts hub/test/remote-workbench.test.ts hub/test/host-status.test.ts hub/test/pool-failures.test.ts hub/test/pool-scale.test.ts hub/test/login-records.test.ts hub/test/host-create-ready.test.ts hub/test/host-unreachable.test.ts hub/test/login-card-signin.test.ts hub/test/login-card-signin-owner.test.ts hub/test/login-card-signin-remote.test.ts hub/test/login-card-recovery.test.ts hub/test/cli-usage-compatibility.test.ts hub/test/cli-help.test.ts hub/test/cli-command-help.test.ts hub/test/cli-usage.test.ts hub/test/login-snapshot-cli.test.ts hub/test/test-docs.test.ts hub/test/suite-tiers.test.ts nvim/test/panel-placement-component.test.ts hub/test/nvim-fixture-boundary.test.ts hub/test/nvim-frame-refresh.test.ts nvim/test/scenarios/workbench.test.ts; }
s00() {   # build, plan and landing receipts
  echo "PRE HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) request $S"
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
  git -C "$R" status --porcelain | grep -v ' \.cland/tasks/' > "$EV/root-status-before.txt"; echo "root non-tracker entries $(wc -l < "$EV/root-status-before.txt" | tr -d ' ')"
  (cd "$R" && node "$W/hub/bin/cland.ts" task plan show E-1537 --json) > "$EV/plan.json"; echo "plan read exit $?"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=(v.stages??[]).find(x=>x.name===process.argv[2]);console.log(s?JSON.stringify({name:s.name,state:s.state,qa:s.qa,items:s.items,merged:s.merged,total:s.total,statuses:s.statuses,cover:s.cover}):"stage missing")' "$EV/plan.json" "$STAGE" | tee "$EV/stage-members.json"
  for id in $(node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log((v.items??[]).join(" "))' "$EV/stage-members.json"); do echo "$id landings $(landing "$id" | wc -l | tr -d ' ') $(landing "$id" | head -n 1)"; done
}
# samebase <tip> <landing> <files…>: the tip-to-landing difference in each file equals the change the landing's parent made there since the merge base (stage-3 run correction C-1)
samebase() { local h=$1 l=$2 mb f a b ok=yes; shift 2; mb=$(git -C "$W" merge-base "$h" "$l^1"); for f in "$@"; do a=$(git -C "$W" diff "$mb" "$l^1" -- "$f" | grep -E '^[+-]' | grep -v -E '^(\+\+\+|---) ' | sort | shasum); b=$(git -C "$W" diff "$h" "$l" -- "$f" | grep -E '^[+-]' | grep -v -E '^(\+\+\+|---) ' | sort | shasum); [ "$a" = "$b" ] || ok="no: $f"; done; echo "$ok (merge base $(git -C "$W" rev-parse --short=9 "$mb"); commits between: $(git -C "$W" log --format=%h "$mb..$l^1" -- "$@" | tr '\n' ' '))"; }
s02() {   # landing diffs (read-only), the stage-wide invariants, the landing check and every first-parent commit of the stage
  for id in $MEMBERS; do L=$(landing "$id" | head -n 1); echo "$id landing ${L:-none}"; [ -n "$L" ] || continue
    echo "$id package.json and lockfiles: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- package.json package-lock.json hub/package.json web/package.json nvim/package.json | wc -l | tr -d ' ')"
    echo "$id preserved files edited at its landing: [$(git -C "$W" diff --name-only "${L}^1" "${L}" -- $(preserved) | tr '\n' ' ')]"
  done
  echo "stage paths under nvim/ or web/: [$(git -C "$W" diff --name-only "$BASE" "$S" -- nvim web | tr '\n' ' ')]"
  echo "remote authority table changed in the stage: [$(git -C "$W" diff --name-only "$BASE" "$S" -- hub/src/remote/authority.ts | tr '\n' ' ')]"
  echo "web key map and tokens changed in the stage: [$(git -C "$W" diff --name-only "$BASE" "$S" -- web/src/keymap.ts web/src/keyboard.ts web/src/tokens.css | tr '\n' ' ')]"
  set -- $TIPS
  while [ $# -ge 2 ]; do id=$1; head=$2; shift 2; L=$(landing "$id" | head -n 1)
    [ -n "$L" ] && [ "$head" != none ] && git -C "$W" cat-file -e "$head^{commit}" 2> /dev/null || { echo "$id landing ${L:-none} tip $head: BLOCKED (no landing or no tip)"; continue; }
    F=$(git -C "$W" diff --name-only "$L^1" "$L" | grep -v '^\.cland/' | tr '\n' ' ')
    echo "$id own lines at its landing $L equal its tip $head: $(ownlines "$L" "$head")"
    echo "$id files byte-identical to $head at its landing: $(git -C "$W" diff --quiet "$head" "$L" -- $F && echo yes || echo "no: $(git -C "$W" diff --name-only "$head" "$L" -- $F | tr '\n' ' ')")"
    echo "$id commits after its landing touching its files: [$(git -C "$W" log --format=%h "$L..$S" -- $F | tr '\n' ' ')]"
    echo "$id trailers: [$(git -C "$W" log -1 --format=%B "$L" | grep -E '^(Item|Reviewed-by): ' | tr '\n' ';')]"; done
  echo "T-1819 tip-to-landing difference equals the intervening change in its five files: $(samebase ac0f036fde7d580dc55a57c3955fc591bc88ff06 "$(landing T-1819 | head -n 1)" docs/agents/tests/index.md docs/hub/host-status-stop.md hub/README.md hub/src/hub/dispatch.ts hub/test/tiers.json)"
  echo "T-1824 tip-to-landing difference equals the intervening change in its three files: $(samebase d2e31fa508bde9f1bfbc18dea2f741cd173aa598 "$(landing T-1824 | head -n 1)" docs/agents/tests/index.md hub/test/durations.json hub/test/tiers.json)"
  echo "T-1820 tip-to-landing difference equals the intervening change in its two files: $(samebase 72932d3333cf8a8930634e91dc32f2771c628ab6 "$(landing T-1820 | head -n 1)" docs/agents/tests/index.md hub/test/tiers.json)"
  echo "writing dev is an ancestor of the request: $(git -C "$W" merge-base --is-ancestor "$WROTE" "$S" && echo yes || echo no)"
  echo "first-parent commits from BASE to the request: $(git -C "$W" rev-list --first-parent --count "$BASE..$S"); after the writing dev: $(git -C "$W" rev-list --first-parent --count "$WROTE..$S")"
  others=0
  for c in $(git -C "$W" rev-list --first-parent --reverse "$BASE..$S"); do P=$(git -C "$W" diff --name-only "$c^1" "$c" | LC_ALL=C sort | tr '\n' ' ')
    it=$(git -C "$W" log -1 --format=%B "$c" | grep -E '^Item: ' | tr '\n' ' '); k=other
    if [ -n "$it" ]; then case "$it" in "Item: T-1819 "|"Item: T-1820 "|"Item: T-1821 "|"Item: T-1822 "|"Item: T-1823 "|"Item: T-1824 ") k=member;; "Item: T-1813 ") [ "$(git -C "$W" rev-parse "$c")" = "$T1813" ] && k=out-of-stage-T-1813;; esac
    else
      [ -n "$P" ] && ! printf '%s' "$P" | tr ' ' '\n' | grep -v -x '' | grep -q -v -x -E '\.cland/tasks/[^/]+\.md' && k=tracker
      [ "$P" = "hub/test/durations.json " ] && k=durations
      [ "$P" = "qa/briefs/E-1537-stage-1.md " ] && k=brief-only
      [ "$P" = "hub/test/durations.json qa/briefs/E-1537-stage-1.md " ] && k=brief-and-durations
    fi
    [ "$k" = other ] && others=$((others+1))
    echo "  commit $(git -C "$W" rev-parse --short=9 "$c") class $k trailers [$it] paths $(printf '%s' "$P" | wc -w | tr -d ' ')"
    case "$k" in durations|brief-and-durations) echo "    $(durdelta "$c")";; esac; done
  echo "commits of class other: $others"
}
s05() {   # tree-wide checks at the build (read-only, through the wrapper; the briefs and the tracker excluded)
  echo "hosts.state producers in production source: [$(git -C "$W" grep -l -F "type: 'hosts.state'" "$S" -- hub/src shared | sed "s#^$S:##" | tr '\n' ' ')]"
  echo "hosts.state readers in web/src and nvim/lua: [$(git -C "$W" grep -l -F 'hosts.state' "$S" -- web/src nvim/lua | sed "s#^$S:##" | tr '\n' ' ')]"
  echo "host.status requests in web/src and nvim/lua: [$(git -C "$W" grep -l -F "'host.status'" "$S" -- web/src nvim/lua | sed "s#^$S:##" | tr '\n' ' ')]"
  echo "key listeners in web/src: [$(git -C "$W" grep -l -E "addEventListener\(\s*['\"]key" "$S" -- web/src | sed "s#^$S:##" | tr '\n' ' ')]"
  echo "private host fields in the hosts projection: $(git -C "$W" grep -c -E 'address|clientKeyPath|knownHosts|volumeId|secret' "$S" -- hub/src/host/hosts-state.ts | wc -l | tr -d ' ')"
  echo "web authority entries still local for host and login frames: $(git -C "$W" show "$S:hub/src/hub/web-authority.ts" | grep -c -E "^  '(host|login)\.[a-z.-]+': 'requires the local human CLI or Neovim',$")"
}
s06() {   # evidence to read, never to start: member verify receipts, merge-batch logs, the Coordinator's cover pair at the requested dev SHA
  for pair in "T-1823 14f45969887614afcda6405ce46a712bae412a42" "T-1822 b63182b8eeb016bd31fd76b06cbdb30bc3225fa0" "T-1824 d2e31fa508bde9f1bfbc18dea2f741cd173aa598" "T-1819 ac0f036fde7d580dc55a57c3955fc591bc88ff06" "T-1821 27b1c58d154aad19d946391ebaf48f7b6e9be3f3" "T-1820 72932d3333cf8a8930634e91dc32f2771c628ab6"; do set -- $pair
    (cd "$R" && node "$W/hub/bin/cland.ts" task view "$1" --json) | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const v=JSON.parse(s).item.verify??{};console.log(process.argv[1]+" verify "+v.id+" executor "+v.executor+" state "+v.state+" result "+v.result+" artifact "+v.artifact+" head is the reviewed tip "+(v.head===process.argv[2]))})' "$1" "$2"; done
  # suites: the members' verifies, the merge-batch runs (c8a09c9b; abfc5334's three; 3921566e; 00150b07; 0f68597c; 707074c1), then the stage covers from the plan
  for id in 9021f6c8-fce4-44af-bf9c-2fe344f526b6 e9a6944e-c372-43ea-b9d9-075c61afa79e b9c74923-3b45-47ff-962b-acc010506075 9c76e87a-1c05-41b1-a7c7-65a1c7f78e4d c7560b81-9b8c-42fe-bf07-ce2fce1520e9 62528fbd-5bb4-4d59-8520-8917897d1bb0 7864cae7-9422-4b5c-9a6f-c5485d6782d1 ec150310-2c2c-4597-ba6d-30c6346a4bc5 8ef20c55-3f56-4f25-a019-73049cdfaac3 ee6237fb-4b9b-4bf6-9f95-53f1505aef6c 966b1f3f-e2af-43e8-9807-5ed8fe21c0b8 71b2522d-a709-4807-ad2a-c198981e31fe 19ee91aa-2fd1-4c20-88fe-6e0625008373 d0923c66-bf2b-404d-b3c1-5a0f4d5b5e2e $(node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log([s.cover?.linux,s.cover?.macos].filter(Boolean).join(" "))' "$EV/stage-members.json"); do
    for f in $(ls "$R/.cland/artifacts" | grep -F -- "-suite-$id-"); do
      node -e 'const fs=require("fs"),t=fs.readFileSync(process.argv[1],"utf8"),line=t.split("\n").find(l=>l.startsWith("suite provenance "));let p={};try{p=JSON.parse(line.slice(17))}catch{}const fails=t.split("\n").filter(l=>/^ℹ fail [1-9]/.test(l)).length,zero=t.split("\n").filter(l=>/^ℹ fail 0$/.test(l)).length,workers=(t.match(/^Workers \d+[^\n]*/m)??["none"])[0],batch=(t.match(/merge-batches\/([0-9a-f]{8})/)??[,"none"])[1];console.log(process.argv[2]+" "+process.argv[1].split("/").pop().slice(0,8)+" head "+p.head+" occasion "+p.occasion+" executor "+p.executor+" os "+(p.platform??{}).os+" batch "+batch+" failing phase lines "+fails+"; passing phase lines "+zero+"; "+workers+"; head is the request "+(p.head===process.argv[3]))' "$R/.cland/artifacts/$f" "$id" "$S"; done; done
  # each batch candidate head named in a batch-occasion log: its subject and whether its tree equals a member landing's tree (Git through the wrapper, R-1)
  node -e 'const fs=require("fs"),cp=require("child_process"),[d,w,q,...ids]=process.argv.slice(1),G=a=>{try{return cp.execFileSync(process.execPath,[q+"/git.mjs","-C",w,...a],{encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim()}catch{return ""}},heads=new Set();for(const f of fs.readdirSync(d)){if(!f.includes("-suite-")||!f.endsWith(".log"))continue;const l=fs.readFileSync(d+"/"+f,"utf8").split("\n").find(x=>x.startsWith("suite provenance "));if(!l)continue;let p;try{p=JSON.parse(l.slice(17))}catch{continue}if(p.occasion==="batch"&&p.head)heads.add(p.head)}const trees=Object.fromEntries(ids.map(i=>[i,G(["log","--first-parent","--format=%T","-1","--grep","^Item: "+i+"$","HEAD"])]));for(const h of [...heads].sort()){const s=G(["log","-1","--format=%s",h]);if(!s.startsWith("Batch candidate "))continue;const named=ids.filter(i=>s.trim().split(/\s+/).includes(i));if(!named.length)continue;const t=G(["rev-parse",h+"^{tree}"]);console.log("candidate "+h.slice(0,9)+" ["+s+"] tree equals the landing tree of "+(ids.filter(i=>trees[i]&&trees[i]===t).join(" ")||"none"))}' "$R/.cland/artifacts" "$W" "$Q" T-1823 T-1822 T-1824 T-1819 T-1821 T-1820
}
s07() {   # the per-test notes and index rows of the stage's new files, and the closed-item wording lint (sealed)
  echo "per-test notes for the new stage files: $(git -C "$W" ls-tree --name-only "$S" docs/agents/tests/ | grep -c -E '^docs/agents/tests/(hub-test-hosts-state|hub-test-web-hosts-authority|nvim-test-host-attach|nvim-test-hosts|nvim-test-hosts-native|web-test-hosts)\.')"
  echo "index rows naming the new stage files: $(git -C "$W" show "$S:docs/agents/tests/index.md" | grep -c -E 'hub/test/hosts-state\.|hub/test/web-hosts-authority\.|nvim/test/host-attach\.|nvim/test/hosts\.|nvim/test/hosts-native\.|web/test/hosts\.')"
  node "$Q/fresh.mjs" "$W" plain node hub/test/lint-closed-item-wording.ts > "$EV/wording-lint.txt" 2>&1; echo "closed-item wording lint exit $?"
}
SH
cat > "$Q/hs.mjs" <<'JS'
// node "$QA_Q/hs.mjs" <connect|snapshot>   sealed, cwd = p1: one human UI connection to p1's own hub socket (the secret is read from .cland/hub.json and never printed);
// prints the hosts.state facts, the frames before it and leak counts; writes the host ids to $QA_Q/hs-ids.txt and the pools to $QA_Q/hs-<mode>.json
import net from 'node:net';
import { readFileSync, writeFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('.cland/hub.json', 'utf8')), mode = process.argv[2], q = process.env.QA_Q, fh = process.env.CLAND_FAKE_HOST_ROOT ?? '';
const hello = { type: 'hello', protocol: 2, client: 'ui', secret: d.secret, ...(mode === 'snapshot' ? { features: ['snapshot'] } : {}) };
const sock = net.createConnection(d.socket), types = [];
let buf = '', pools, done = false;
const timer = setTimeout(() => { console.log(`hosts frame (${mode}): timeout after 10 s; frames ${types.join(',')}`); sock.destroy(); process.exit(1); }, 10000);
const finish = () => {
  if (done) return; done = true; clearTimeout(timer); sock.destroy();
  if (!Array.isArray(pools)) { console.log(`hosts frame (${mode}): no pools array; frames ${types.join(',')}`); process.exit(1); }
  const json = JSON.stringify(pools), list = (() => { try { return JSON.parse(readFileSync(q + '/hl.out', 'utf8')); } catch { return []; } })();
  const native = list.flatMap(r => [r.machine?.id, r.machine?.address]).filter(v => typeof v === 'string' && v.length > 3 && !list.some(x => x.id === v));
  console.log(`hosts frame (${mode}): frames before it ${types.slice(0, mode === 'connect' ? -1 : undefined).join(',')}`);
  for (const p of pools) {
    const logins = Object.entries(p.logins ?? {}).map(([h, v]) => `${h} ${v.inUse}/${v.usable} signed out ${v.signedOut}`).join(', ');
    console.log(`  pool ${p.name}: provider ${p.provider}; region ${p.region}; hosts ${p.hostCount}/${p.maxHosts}; slots ${p.slotsUsed}/${p.slotsTotal}; logins ${logins || 'none'}; alert ${JSON.stringify(p.alert)}`);
    for (const h of p.hosts) console.log(`  host ${h.id}: size ${h.size}; region ${h.region}; state ${h.state}; created is a time ${!Number.isNaN(Date.parse(h.created))}; sessions [${h.sessions.join(' ')}]; priceHourly ${h.priceHourly}; spendToday ${h.spendToday}`);
    console.log(`  line: ${p.name} ${p.hostCount}/${p.maxHosts} hosts · ${p.slotsUsed}/${p.slotsTotal} slots · logins ${Object.entries(p.logins ?? {}).map(([h, v]) => `${h} ${v.inUse}/${v.usable}`).join(', ')}`);
  }
  const keys = ['address', 'clientKeyPath', 'knownHosts', 'volumeId', 'secret', 'machine'];
  console.log(`  private keys in the frame: ${keys.filter(k => json.includes(`"${k}"`)).length}; hub secret occurrences ${json.split(d.secret).length - 1}; fake-host root occurrences ${fh ? json.split(fh).length - 1 : 'n/a'}; machine ids or addresses from the host list in the frame ${native.filter(v => json.includes(v)).length} of ${native.length}`);
  writeFileSync(`${q}/hs-${mode}.json`, json);
  writeFileSync(`${q}/hs-ids.txt`, pools.flatMap(p => p.hosts.map(h => h.id)).sort().join('\n') + '\n');
  process.exit(0);
};
sock.on('connect', () => sock.write(JSON.stringify(hello) + '\n'));
sock.on('error', e => { console.log(`hosts frame (${mode}): socket error ${e.code ?? 'unknown'}`); process.exit(1); });
sock.on('data', c => { buf += c; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); let f; try { f = JSON.parse(line); } catch { continue; }
  types.push(f.type);
  if (mode === 'connect' && f.type === 'hosts.state') { pools = f.pools; finish(); }
  if (mode === 'snapshot' && f.type === 'snapshot' && f.domain === 'sessions') pools = f.value?.hosts;
  if (mode === 'snapshot' && f.type === 'snapshot.end') finish(); } });
JS
node --check "$Q/hs.mjs" && echo "hs checked"
cat > "$Q/scratch.sh" <<'SH'
# this stage's scratch rows; r80 from the E-1535 stage-3 brief at M4; waitfor and q57 from the E-1534 stage-2 brief at N2; helpers from the kit
. "$QA_Q/kit3-r80.sh"; . "$QA_Q/n2-waitfor.sh"; . "$QA_Q/n2-q57.sh"
# qhosts: the qa pool's rows of `cland host list` (it prints JSON) as "id state" lines, destroyed rows left out; tworeadyq: both demo hosts ready
qhosts() { cland host list > "$QA_Q/hl.out" 2>&1; node -e 'let v=[];try{v=JSON.parse(require("fs").readFileSync(process.env.QA_Q+"/hl.out","utf8"))}catch{}for(const r of v.filter(r=>r.pool==="qa"&&r.state!=="destroyed"))console.log(r.id+" "+r.state)'; }
tworeadyq() { [ "$(qhosts | grep -c ' ready$')" -ge 2 ] && echo "two ready"; }
r91() {   # the stage demo's two fake hosts: the qa image prepared, two manual creates to ready, the fixture alias recorded
  cd "$QA_Q/p1" || return 1
  run "(prepare qa)" cland host prepare qa; echo "  prepared lines $(has 'qa: prepared')"
  run "(create 1)" cland host create qa
  run "(create 2)" cland host create qa
  r=$(waitfor 300 tworeadyq); echo "  demo hosts: ${r:-not two ready within 300 s}; qa hosts: $(qhosts | tr '\n' ';')"
  readlink "$QA_Q/fh/.fixture-sockets/alias" > "$QA_Q/alias.txt" 2> /dev/null; echo "  alias recorded: $(cat "$QA_Q/alias.txt" 2> /dev/null)"
  echo "  fake machines $(machines)"
}
r92() {   # T-1819 C1, C2, C6 on a CLI-started hub: the frame on a legacy connect and in a featured snapshot, against host list and host status
  cd "$QA_Q/p1" || return 1
  qhosts | awk '{print $1}' | LC_ALL=C sort > "$QA_Q/hl-ids.txt"; echo "  host list qa ids $(wc -l < "$QA_Q/hl-ids.txt" | tr -d ' ')"
  node "$QA_Q/hs.mjs" connect; echo "  frame host ids equal the host list ids: $(cmp -s "$QA_Q/hs-ids.txt" "$QA_Q/hl-ids.txt" && echo yes || echo no)"
  node "$QA_Q/hs.mjs" snapshot; echo "  snapshot hosts equal the connect frame: $(cmp -s "$QA_Q/hs-connect.json" "$QA_Q/hs-snapshot.json" && echo yes || echo no)"
  run "(host status)" cland host status; echo "  status pool lines $(has 'qa: 2 hosts')"
}
r94() {   # T-1819 C3 on the real CLI: a hot max_hosts change reads back in the next frame
  cd "$QA_Q/p1" || return 1
  run "(max_hosts 3)" cland config set hosts.qa.max_hosts 3; echo "  applies-now lines $(has 'applies now')"
  sleep 2; node "$QA_Q/hs.mjs" connect
}
r95() {   # the demo hosts stopped through the human CLI; the frame empties
  cd "$QA_Q/p1" || return 1
  for h in $(qhosts | awk '{print $1}'); do run "(host stop $h)" cland host stop "$h"; echo "  destroyed state lines $(has '"state": "destroyed"')"; done
  sleep 2; node "$QA_Q/hs.mjs" connect; echo "  qa hosts after the stops: $(qhosts | wc -l | tr -d ' ')"
}
SH
. "$Q/checks.sh"; bash -n "$Q/scratch.sh" && echo "scratch checked"
```

Expected: `expect checked`, `src checked`, `ids checked`, `hs checked`, `scratch checked`. The landed members' reviewed tips (the commit of each final clear verdict, read with `task view`) and the merge-batch suites are written in (VERIFIED: each batch log's `suite provenance` head is a `Batch candidate T-<id>` commit; its tree equals the landing tree where it landed): T-1823 `14f459698` and T-1822 `b63182b8e`, batch `c8a09c9b` (suite `7864cae7`, A-19023 to A-19025; candidate `69eba8a6a` "Batch candidate T-1822", tree equal to T-1822's landing, on candidate `4870e2b6e` "Batch candidate T-1823", tree equal to T-1823's landing); T-1824 `d2e31fa50` and T-1819 `ac0f036fd`, first together in batch `abfc5334` (suite `ec150310`, A-19028 to A-19030, candidate `8b5a83839` "Batch candidate T-1819" on `373cd4572` "Batch candidate T-1824": **red** on three T3 cases, `hub/test/daemon.test.ts` test `a wrong secret is refused on the WebSocket and on the Unix socket; the right one is welcomed` and test `both edges speak one protocol: a spoke hello over the Unix socket; a client hello over the WebSocket is refused (the human side is the socket)`, and `hub/test/tracker.test.ts` test `a hub write and a hand edit at the same time: the last writer wins and the hub logs it`, each `AssertionError actual undefined versus expected true` at a positional `remote.state` reader; then suite `8ef20c55`, A-19031 to A-19033, candidate `5e375bdfd` T-1819 alone, red on the same three; and suite `ee6237fb`, A-19037 to A-19039, candidate `504621463` T-1824 alone, green); T-1824 landed alone through batch `3921566e` (suite `966b1f3f`, A-19043 and A-19044, candidate `f74673957`, tree equal to T-1824's landing, green); T-1819, after rev-36's `rev-36-1819-source-4` cleared the three added handshake assertions at `ac0f036fd`, landed through batch `00150b07` (suite `71b2522d`, A-19045 and A-19046, candidate `b30cd7731` on T-1824's landing, tree equal to T-1819's landing, green). T-1821 `27b1c58d1`, batch `0f68597c` (suite `19ee91aa`, A-19071 and A-19072, candidate `d835ceba1` "Batch candidate T-1821" on `5b056beb4`, tree equal to T-1821's landing, green); T-1820 `72932d333`, batch `707074c1` (suite `d0923c66`, A-19075 and A-19076, candidate `462db8d71` "Batch candidate T-1820" on T-1821's landing, tree equal to T-1820's landing, green). T-1821's same-head macOS native rerun of `nvim/test/hosts-native.test.ts` (A-19067) is implementer evidence, read, not a pass condition here. The helpers were rehearsed read-only at `8a9e0b474` and again at `8913e8ab4` with the root checkout as `W` (VERIFIED: `src.mjs` all `ok`; `ids.mjs` `missing from the tables: 0`; `s00`, `s02`, `s05`, `s06` and the `s07` counts as their rows say; the wrapper reached Git as `type -t git` `function`).

**Cleanup, in this order (carried).** Step 1, after E1537S1-89 passes: print the alias in `$Q/alias.txt`, check it is a symlink named `/private/tmp/ct-` plus 32 hex resolving into `$Q/fh/.fixture-sockets`, and remove that symlink by its literal path; inventory and remove by literal path the dead T-1676 residue in `$T` only. Step 2: E1537S1-99 with `$Q` and `$T` present. Step 3, after the verdict: `git -C "$R" worktree remove "$W"` (through the wrapper; its `node_modules` symlink first if Git refuses), then `unset -f git`, then remove `$Q` and `$T` by their printed literal paths (prefix checks `/private/tmp/q53-` and `/private/tmp/qa-e1533-s3-`; `$T` holding nothing but `node-compile-cache`). Nothing in `$ST` or `/private/tmp` outside `$Q`, `$T` and the recorded alias is removed, ever (the T-1806 directories included). If any inventory shows a new own-family name, nothing is removed.

## Cases

Every case is one or more named test files run once at the build, from QA's own shell through `nt` (sealed, `TMPDIR=$T`) or `ns` (standard environment, one preservation slot per file), recorded with `qa-record.sh note` (surface `hub-api`; the Web files drive the pinned Headless Shell inside themselves, the Neovim files the pinned headless Neovim), with the evidence files `$EV/<id>.log`, `$EV/<id>.check.txt`, `$EV/<id>.inventory-delta.txt` and, for native rows, `$EV/<id>.receipts.txt`, `$EV/<id>.slots.txt` and `$EV/<id>.families.txt`. A case passes only when every check line reads `CLEAN`, its delta reads `own-family new entries in all files: 0` and, for a native row, every `pfam` line reads `new hc- 0; new ct- 0`. A missing file is a FAIL naming it. A skipped test (a missing Headless Shell or Neovim) is a FAIL, never a pass. Run in table order; never two files at once. Tiers are read from `hub/test/tiers.json` at `8a9e0b474` (VERIFIED) and named per row. A slow but positive file is recorded with its wall time.

| case | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1537S1-10 | hub-api | QA | `nt E1537S1-10 hub/test/hosts-state.test.ts hub/test/connection-snapshot.test.ts hub/test/connection-resync.test.ts hub/test/edges-component.test.ts hub/test/request-guard-component.test.ts hub/test/tracker-component.test.ts hub/test/remote-workbench.test.ts` | Each `CLEAN` (T2 each). `hosts-state` exact: test `hosts state connects with empty pools on previous and featured wire shapes` (literal protocol-2 hello: `welcome`, `remote.state`, then `{type:'hosts.state',pools:[]}`, then a correlated `topic.list` result; the featured snapshot's `sessions.hosts` is `[]`: T-1819 C1, C6); test `host projection allows only public facts and coalesces changes within one second` (`hostCount 1`, `maxHosts 2`, weighted `slotsUsed 2` of `slotsTotal 8`, the literal public host entry, no native identity; no second publish at 999 ms, one at 1000 ms; `spendToday` after a minute: C1, C2, C3); test `tunnel loss alerts before unreachable and clears on recovery` (alert `{kind:'outage',host:'up',since}` at the exact outage start while the provision still reads `ready` and General has no line; `null` after recovery: C4); both expansions of `pool create stays alerted through backoff and clears after success: rate limit=<rateLimited>` and test `manual create refusal alerts and unrelated outage recovery cannot settle it` (C5); test `placement, exit, login state and hot pool settings push socket replacements` (session placed and stopped, a key login bound, a disk login signed out, `config.set hosts.agents.max_hosts 3`, each observed as a pushed replacement within 1000 ms of hub clock; the featured snapshot equals the last push: C1, C3); test `pre-acquisition and confirmed machine deletion never accrue live spend` and test `workbench prices come from the admitted DigitalOcean declaration checkpoint` (`priceHourly 0.25` from the scripted fake API, no native id, address or provider secret: C2). The five migrated consumers (T-1819's positional readers now drain `hosts.state` after `remote.state`) and the unedited `remote-workbench` keep their previous-shape assertions (C6) |
| E1537S1-11 | hub-api | QA | `nt E1537S1-11 hub/test/host-status.test.ts hub/test/pool-failures.test.ts hub/test/pool-scale.test.ts hub/test/login-records.test.ts` | Each `CLEAN` (T2, T2, T2, T1; unedited, VERIFIED `preserved`): consumers of T-1819's edits to `status.ts` and `host-leases.ts` (host status and spend), `pool-runtime.ts` (the create-result failure owner, C5) and `logins.ts` (`poolSummary`) |
| E1537S1-20 | hub-api | QA | `nt E1537S1-20 hub/test/web-hosts-authority.test.ts hub/test/web-authority-unit.test.ts hub/test/web-authority.test.ts hub/test/login-list.test.ts` | Each `CLEAN` (T2, T1, T2, T2). `web-hosts-authority` exact, through the real one-use link and cookie edge with no browser: the four expansions of `web <add|signin> <harness> returns its persisted card before completion` (the reply's `name`, a durable `login-signin-code` card naming the fake link, the login `creating` until completion, then `ready`; Codex with no answer, Claude Code after the web `topic.answer` delivers `SENTINEL-web-code` plus a newline to the captured write handle; `login.list` from the web equal to the local one: T-1824 C2, C3); test `web login reads reach local handlers and forbidden host and key frames name their rule` (C1, C4); test `users-mode web host actions audit the transport-resolved user in log and journal` (C5); test `every host and login frame refuses sessions and messenger ingress` (C4); test `web snapshot and removal retain the local success shapes and durable storage receipts` (C1); both expansions of `web add projects declared fields with hidden renewal mode: existing <existing>` (the hidden `signin`, `type`, `id` and extra fields never reach the internal input: C2). `web-authority-unit` with test `web host and disk-login actions are admitted while provisioning and keys stay local`; `web-authority` with the remaining `host.status` expansion of `web refuses <type> even from authenticated human` and test `signed-in web refuses pool preparation`; `login-list` exact with test `login frames retain session and remote refusals with selective web authority` (C4; a lost-storage diagnostic in its fixture cases is T-1817) |
| E1537S1-21 | hub-api | QA | `nt E1537S1-21 hub/test/login-card-signin-owner.test.ts hub/test/login-card-signin-remote.test.ts hub/test/login-card-recovery.test.ts hub/test/cli-usage-compatibility.test.ts hub/test/cli-help.test.ts hub/test/cli-command-help.test.ts hub/test/cli-usage.test.ts hub/test/login-snapshot-cli.test.ts` | Each `CLEAN` (T2, T2, T2, T1, T2, T1, T1, T2; unedited, VERIFIED `preserved`): the card runner's owner, remote and recovery files over T-1824's `start` path and its `receipt` resolution in `#execute` (`login-card-signin-owner` exact, as E-1535 stage 4 ran it); the frozen usage fixture `hub/test/fixtures/cli-usage/commands.json` and the usage text T-1824 migrated (`login add`, `login remove`, `login list`, `login snapshot`, `host stop`) |
| E1537S1-30 | hub-api | QA | `nt E1537S1-30 web/test/sessions.test.ts web/test/phone-sessions.test.ts web/test/session-actions.test.ts` (after E1537S1-08) | Each `CLEAN` (Web each; pinned Headless Shell with its own `--user-data-dir` under the file's root; no other browser). `web/test/sessions.test.ts` exact: test `Sessions remote host fact names its host with a tooltip on ground and selection` (fake Codex sessions launched on a registered `fake-host` and on `local`; the remote row's fact titled `Host the session runs on` reads `fake-host` and is visible; its computed colour `rgb(138, 148, 163)`, the contrast-checked muted token, is unchanged after selection (`aria-pressed` `true`); the local row has no host fact: T-1822 C1, C2). `web/test/phone-sessions.test.ts` exact: test `phone session page names a remote host and omits the local host` (the remote page's fact reads `fake-host`; the local page has none: C1). The other registrations and `session-actions` are preservation of the edited row and page. A missing Headless Shell is BLOCKED |
| E1537S1-35 | hub-api | QA | `nt E1537S1-35 hub/test/nvim-fixture-boundary.test.ts hub/test/nvim-frame-refresh.test.ts` | Each `CLEAN` (T1 each; unedited, VERIFIED `preserved`): the recorded catalog's consumers over T-1821's regenerated `nvim/test/fixtures/protocol-frames.json` and its `hosts.json` and `sessions.json` slices; `nvim-fixture-boundary` with test `a per-file catalog retains complete requested frames and refuses a missing recording` and test `a slice loads the committed catalog once for a recorded interleaving and still refuses unknown frames` (T-1821 C5) |
| E1537S1-40 | hub-api | QA | `nt E1537S1-40 web/test/hosts.test.ts` (after E1537S1-08) | `CLEAN` with its exact list (Web, new by T-1820; pinned Headless Shell with its own `--user-data-dir`; no other browser). Test `Sessions Hosts consumes the fake provider inventory snapshot and configuration push`: two directory-only fake-provider machines registered as ready provisions; the line `[data-host-pool="agents"]` reads `agents 2/4 hosts · 0/16 slots` from the hub's projection (T-1820 C1); `config.set hosts.agents.max_hosts 5` answers `applies` `now` and renders `2/5 hosts` within 1000 ms (T-1819 C3 through the browser); a tunnel loss injected at the registry's `subscribeStatus` boundary (production HostHealth, HostsState coalescing and socket publication unchanged; no native SSH) renders `fake-1 unreachable` in `rgb(255, 123, 114)` within 1000 ms, and recovery renders the plain colour again (T-1820 C3, T-1819 C4 at the carrier boundary). Both expansions of `Sessions Hosts renders pushed facts and alert recovery (<desktop|phone>)` (pushed frames replaced at the browser socket edge): `agents 2/4 hosts · 7/16 slots · logins claude 2/3 … codex 1/1` with `1 signed out` (C1); `Fold Hosts` folds and unfolds, each `[data-host-id]` shows id, size, region, uptime, sessions and `$0.25/h` `$1.50 today` or `unknown/h` `unknown today`, uptime advancing with no push (C2); outage and provider alerts red within 1000 ms, plain recovery (C3); at 320 px `scrollWidth` 320 and no row overflow (C1); an empty push detaches the section (C4); the client never requests `host.status`. Test `Sessions hides Hosts for an empty pool list and a previous hub snapshot` (C4). A missing Headless Shell is BLOCKED |
| E1537S1-45 | hub-api | QA | `nt E1537S1-45 nvim/test/hosts.test.ts nvim/test/sessions.test.ts nvim/test/panel-placement-component.test.ts` | Each `CLEAN`, no skip (T2 each; pinned headless Neovim; `hosts` new and `sessions` edited by T-1821, `panel-placement-component` unedited, VERIFIED `preserved`). `hosts` exact: test `Hosts follows Remotes, wraps pool facts, folds with za and clears pushed alerts` (no Hosts row before any `hosts.state` frame, T-1819 C6 and T-1821 C5; after a `remote.state` and a two-pool `hosts.state`, `agents 1/4 hosts` and `spare 0/2 hosts` within 1000 ms with Remotes above Hosts and `2/8 slots … logins claude 2/3 … codex 1/1 … opencode 0/2`, C1; `za` on Hosts shows `fake-size`, `$0.070/h`, `$0.120 today`, `up 1h 0m` and `sessions worker`, `za` again folds to `▸ Hosts`, C2; an outage alert `fake-1 unreachable` and a provider alert `fake capacity refused` each in `ClandRed` within 1000 ms, recovery in `ClandDim`, C3; an empty push hides the row, C5). `sessions` exact: test `recorded host session names its host on row and selected meta; local omits it` (a full host UUID on the unselected row and twice when selected, at 40, 30 and 100 columns, every line within the panel width, the local row and meta without a host: C4) and test `remote state pushes render facts and failure highlights while old hubs keep the row hidden` (the Remotes pattern, unchanged). `panel-placement-component` covers the edited panel layout |
| E1537S1-56 | hub-api | QA | `nt E1537S1-56 hub/test/test-docs.test.ts hub/test/suite-tiers.test.ts` | Each `CLEAN` (T1 each). Every new stage file has its tier in `hub/test/tiers.json` and its per-test note with its index row (VERIFIED at `8913e8ab4`): `hub/test/hosts-state.test.ts` T2, `hub/test/web-hosts-authority.test.ts` T2, `nvim/test/host-attach.test.ts` T3, `web/test/hosts.test.ts` Web, `nvim/test/hosts.test.ts` T2, `nvim/test/hosts-native.test.ts` T3 (VERIFIED at `8913e8ab4`); the edited notes of `connection-resync`, `daemon`, `edges-component`, `request-guard-component`, `tracker-component`, `tracker`, `login-list`, `login-snapshot-cli`, `web/test/sessions`, `web/test/phone-sessions` and `nvim/test/sessions` (read by short name) |
| E1537S1-60 | hub-api | QA | `ns E1537S1-60 "$OWN60" nvim/test/host-attach.test.ts` (then `pfam E1537S1-60`) | `CLEAN` with its exact list, no skip (T3; added by T-1823; a disposable projectHub with a directory-backed fake host `f1`, the existing fake SSH on PATH and a remote fake CLI that asserts the argv `host attach worker` and its run directory; pinned headless Neovim). Test `Enter attaches through pinned SSH, names the host, reattaches after restart and shows revocation`: Enter on `worker` opens a terminal that prints `fake host f1 attached worker`, the terminal's command equals the hub's `terminalAttachCommand` and contains `'-t'` (T-1823 C1); the note buffer reads `['', ' attaching to worker on f1…']` (C2); after `:restart` the same receipt with the same command (C3); after the attachment closes and the host's attach command throws `host is revoked`, `:Cland view session worker` shows `cannot attach worker: host is revoked` (C2). The revocation is injected at the Host (`terminalAttachCommand` throws), not through `cland host revoke` (INFERRED equivalent: the note shows whatever reason the hub's attach refusal carries). `pfam`: `new hc- 0; new ct- 0`; `new cland-h-` recorded (T-1806) |
| E1537S1-61 | hub-api | QA | `ns E1537S1-61 "$OWN61N" nvim/test/shell.test.ts nvim/test/sessions-lifecycle.test.ts hub/test/host-attach.test.ts` (then `pfam E1537S1-61`) | Each `CLEAN`, no skip (T3 each, three slots; unedited, VERIFIED `preserved`): consumers of T-1823's `show_in` note change. `shell` with test `Enter on a session attaches it in the centre in Terminal mode; ␣␣ returns to the thread`, test `:restart re-attaches the session terminals instead of ending the sessions` (T-1823 C3 for local sessions) and test `an attach client that ended is not reused: Enter and C-v run the attach command again`; `sessions-lifecycle` (UI-launched native harness attach); `hub/test/host-attach.test.ts` with test `printed terminal SSH pins host keys, disables sharing and forwards, and contains no secret` (the `-t` command the Neovim row runs: C1). Own families VERIFIED from the files' allocation calls. `pfam`: `new hc- 0; new ct- 0` per file |
| E1537S1-62 | hub-api | QA | `ns E1537S1-62 '^cland-proj-' hub/test/daemon.test.ts hub/test/tracker.test.ts` (then `pfam E1537S1-62`) | Each `CLEAN` (T3 each, two slots; edited by T-1819): the three positional readers that reddened batch `abfc5334` now read `{type:'hosts.state',pools:[]}` after `remote.state`: `daemon` with test `a wrong secret is refused on the WebSocket and on the Unix socket; the right one is welcomed` and test `both edges speak one protocol: a spoke hello over the Unix socket; a client hello over the WebSocket is refused (the human side is the socket)`, `tracker` with test `a hub write and a hand edit at the same time: the last writer wins and the hub logs it` (T-1819 C6). A failure of any of the three is a regression, never a rerun. `daemon`'s long-path case puts a `cland-<16 hex>.sock` in the temp directory (a known class, recorded) |
| E1537S1-63 | hub-api | QA | `ns E1537S1-63 '^hc-' hub/test/host-create-ready.test.ts` (then `pfam E1537S1-63`) | `CLEAN` (T3; unedited): native create-to-ready over T-1819's edits to `provision-host.ts` and `host-leases.ts` (the billing checkpoint the spend projection reads) and over T-1820's `createHostRegistry` default (no override: the production `projectSshHosts`). Own family `hc-` (the host-create fixture's `tempProject(t,'hc-','/tmp')`, VERIFIED): `pfam` `new hc- 0; new ct- 0`; `new cland-h-` recorded (T-1806, the item's own named producer) |
| E1537S1-64 | hub-api | QA | `ns E1537S1-64 "$OWN65" hub/test/host-stop.test.ts hub/test/host-unreachable.test.ts` (then `pfam E1537S1-64`) | Each `CLEAN` (T2 each, standard environment, own slots, grouped native since E-1535 stage 2). `host-stop` exact (edited by T-1824): the `web stop` expansions of `C3 <stop|web stop> joins lease renewal and requires confirmed destroy: <confirmed>` stop the fake host through an authenticated web connection with the same lease, disk-release and confirmation assertions as the local ones; with `true` the session on it reads `exited` (T-1824 C1). `host-unreachable` (unedited; synthetic tunnel transitions on the hub clock) over T-1819's `since` and `changed` edits to `host-health.ts`: the 3-minute `unreachable` state and General's line unchanged (T-1819 C4) |
| E1537S1-65 | hub-api | QA | `ns E1537S1-65 '^hc-' hub/test/login-card-signin.test.ts` (then `pfam E1537S1-65`) | `CLEAN` with its exact list (T3; unedited; the host-create fixture with `cardSignIn`, the real fake-host agent, the existing fake Claude and Codex binaries and a pair of test messengers): the native card runner T-1824's web start enters (`#execute` with its new receipt). Its four cases as E-1535 stage 4 ran them (T-1824 C2, C3 natively, through the card, not the web transport, as the `web-hosts-authority` per-test note says) |
| E1537S1-66 | hub-api | QA | `ns E1537S1-66 '^hc-' nvim/test/hosts-native.test.ts` (then `pfam E1537S1-66`) | `CLEAN` with its exact list, no skip (T3; new by T-1821; the host-create fixture on a fixture-owned projectHub with native fake SSH, host agent and watchdog; pinned headless Neovim; its plan counts the one registration, its counters the nested subtest `rendered host transport receipts`). Test `fake host tunnel loss renders red within one second and recovery clears the native pool row`: `cland host create agents` (the real CLI against the fixture's hub) prints a `ready` record; Neovim's panel shows `agents 1/2 hosts` (T-1821 C1); with a one-second rendered-outage observer armed, the fixture writes the fake machine's `gone` fence (fake SSH then refuses to authenticate it, VERIFIED in `hub/test/fakes/fake-host.ts`) and asks its authenticated SSH master to `kill-master` with the current owner and token; the panel shows `<id> unreachable` with the `ClandRed` extmark within 1000 ms (T-1821 C3, T-1819 C4 natively: the carrier's status → HostHealth → `hosts.state` → Neovim); removing the fence lets the carrier reconnect, and the row returns to `ClandDim` without the alert within the fixture's bounded setup-style wait (recovery is not a latency proof). **It does not prove** the outage on a CLI-started hub, a QA-triggerable outage (T-1839), the web rendering of a native loss (E1537S1-40 injects at the carrier's status boundary), two hosts, or the 3-minute `unreachable` state (E1537S1-64). Own family `hc-` (the host-create fixture's `tempProject(t,'hc-','/tmp')`, VERIFIED; any other new root INFERRED absent); `pfam` `new hc- 0; new ct- 0`; `new cland-h-` recorded (T-1806). Its 13 s duration allowance is not a pass condition |
| E1537S1-67 | hub-api | QA | `ns E1537S1-67 '^cland-proj-' nvim/test/scenarios/workbench.test.ts` (then `pfam E1537S1-67`) | `CLEAN`, no skip (T3 scenario `workbench`; unedited, VERIFIED `preserved`): test `recorded protocol fixtures match the live hub attach frames` compares T-1821's regenerated recordings with a live hub whose attach now carries `hosts.state` (T-1821 C5; T-1819 C6), and the other workbench cases cover the attach path T-1819's connect frame changed. Own family `cland-proj-` (`tempProject` from `hub/test/harness.ts`, VERIFIED; others INFERRED absent). A changed `nvim/test/fixtures/` after the run is T-1804 and a FINDING (it makes `dirty entries` non-zero) |

### Web cases (when in scope)

In scope, headless only: E1537S1-30 (T-1822) and E1537S1-40 (T-1820) run the pinned Chrome Headless Shell inside their named files, each with its own `--user-data-dir` under the file's scratch root (rule 18), at the files' desktop and phone sizes. No `real-browser` row, no computer use, no GUI, no human notice: the epic's Definition of done names headless Chromium. Screenshots are not pass conditions.

## Manual checks

Run in table order: E1537S1-00 to E1537S1-08 before the cases, E1537S1-80 to E1537S1-89 after them, then cleanup step 1, then E1537S1-99. Record each with `sh .agents/skills/qa/qa-record.sh note E-1537 "$RUN" <id> hub-api "<the command you ran>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence file>` from `$W`. Scratch rows begin with the kit's `PRE gate` line and end with `# fresh: redacted or withheld lines 0` and `row exit 0`; a row whose prerequisite failed is BLOCKED, naming it.

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1537S1-00 | hub-api | QA | `s00 > "$EV/E1537S1-00.txt" 2>&1` | PRE line: HEAD, dev and request the same 40 hex; `dirty entries 0`. `plan read exit 0`; the stage line with the exact name, `qa` `{"scope":"affected","when":"after-stage"}`, `items` T-1819, T-1820, T-1821, T-1822, T-1823, T-1824 plus any finding fixes the request names, `merged` equal to `total`, `state` not `closed`. Every member `landings 1` (VERIFIED at `8913e8ab4`: `T-1819 landings 1 8d130765452c941fc780dac905da249bbbed9a29`, `T-1820 landings 1 36f700d73665b0f37593925c564444c34de9b840`, `T-1821 landings 1 cb31e4342a20c40e90f72791663385696589c234`, `T-1822 landings 1 089d045f525fef5ae15cade2ba83bb14e20de514`, `T-1823 landings 1 a335caecfdf9cfd02093093027d6a2d7e080d299`, `T-1824 landings 1 686ec94f494ed03986c06fdc1489384b048c10fb`). At `8913e8ab4` the plan read `merged 6`, `total 6`, `statuses {"done":6}`, state `open`; `cover` read `tree df654f495164d668ac92de841b67c929b71f5f9c`, `missing ["Linux droplet","macOS"]`, which E1537S1-06 requires to read `missing []` at the run |
| E1537S1-01 | hub-api | QA | `s01 > "$EV/E1537S1-01.txt" 2>&1` | Node 24; `typecheck exit 0` (the root `typecheck` script ends with the web workspace's, which runs `node check-colours.ts`, `node check-tokens.ts`, `node check-html.ts`, `oxlint` and `node check-hooks.ts`, VERIFIED in `web/package.json` at `8a9e0b474`: T-1822 C2, T-1820 C5); `dirty entries 0` |
| E1537S1-02 | hub-api | QA | `s02 > "$EV/E1537S1-02.txt" 2>&1` | Every landing `package.json and lockfiles: 0` and `preserved files edited at its landing: []`; `stage paths under nvim/ or web/: [nvim/README.md nvim/lua/cland/hosts.lua nvim/lua/cland/hub.lua nvim/lua/cland/init.lua nvim/lua/cland/panels.lua nvim/lua/cland/sessions.lua nvim/lua/cland/state.lua nvim/test/fixtures/protocol-frames.json nvim/test/fixtures/protocol-frames/hosts.json nvim/test/fixtures/protocol-frames/sessions.json nvim/test/host-attach.test.ts nvim/test/hosts-native.test.ts nvim/test/hosts.test.ts nvim/test/sessions.test.ts web/README.md web/src/connection.ts web/src/sessions/HostsLine.module.css web/src/sessions/HostsLine.tsx web/src/sessions/SessionPage.tsx web/src/sessions/SessionRow.tsx web/src/sessions/SessionsArea.tsx web/src/sessions/state.ts web/test/hosts.test.ts web/test/phone-sessions.test.ts web/test/session-host-fixture.ts web/test/sessions.test.ts ]` (VERIFIED at `8913e8ab4`); `remote authority table changed in the stage: []`; `web key map and tokens changed in the stage: []` (T-1820 uses the existing `--failed` and `--muted` tokens). **Landing check** (VERIFIED in bash at `8913e8ab4`): T-1823, T-1822 and T-1821 `own lines … : yes` and `files byte-identical … : yes`; T-1819 `own lines … : yes` and `files byte-identical to ac0f036fde7d580dc55a57c3955fc591bc88ff06 at its landing: no: docs/agents/tests/index.md docs/hub/host-status-stop.md hub/README.md hub/src/hub/dispatch.ts hub/test/tiers.json`, accepted only with `T-1819 tip-to-landing difference equals the intervening change in its five files: yes (merge base 94b73e73c; commits between: 686ec94f4 a335caecf )`; T-1824 `own lines … : yes` and `files byte-identical to d2e31fa508bde9f1bfbc18dea2f741cd173aa598 at its landing: no: docs/agents/tests/index.md hub/test/durations.json hub/test/tiers.json`, accepted only with `T-1824 tip-to-landing difference equals the intervening change in its three files: yes (merge base 94b73e73c; commits between: a335caecf c7978ae30 )`; T-1820 `own lines … : yes` and `files byte-identical to 72932d3333cf8a8930634e91dc32f2771c628ab6 at its landing: no: docs/agents/tests/index.md hub/test/tiers.json`, accepted only with `T-1820 tip-to-landing difference equals the intervening change in its two files: yes (merge base 8a9e0b474; commits between: cb31e4342 )` (C-1: each tip was built on an older dev; the differences are the intervening landings' own changes to those files). Each trailer line names `Item: <id>` and its final review (`rev-36 (rev-36-1823-final-1)`, `rev-35 (rev-35-1822-final-1)`, `rev-37 (rev-37-1824-evidence-1)`, `rev-36 (rev-36-1819-final-2)`, `rev-36 (rev-36-1821-final-1)`, `rev-35 (rev-35-1820-final-1)`). Later commits touching their files at `8913e8ab4` (newest first; VERIFIED): `T-1823 [36f700d73 cb31e4342 8d1307654 686ec94f4 ]`, `T-1822 []`, `T-1824 [8913e8ab4 36f700d73 cb31e4342 8d1307654 ]`, `T-1819 [36f700d73 cb31e4342 ]`, `T-1821 [8913e8ab4 36f700d73 ]`, `T-1820 []`. `writing dev is an ancestor of the request: yes`; at `8913e8ab4` eleven first-parent commits from `BASE`, classed `out-of-stage-T-1813` (`c7978ae30`), `member` (`a335caecf`, `089d045f5`, `686ec94f4`, `8d1307654`, `cb31e4342`, `36f700d73`), `tracker` (`8a9e0b474`, `5b056beb4`, `4fc3b57a9`) and `durations` (`8913e8ab4`, with `entries outside allow changed or removed 0; added 40; allowances removed 0; changed 0 (renewals keeping seconds and owner 0; reason-only 0); added 0; version same true`, VERIFIED); after `WROTE` only `tracker`, `durations` (the same add-only shape: `… allowances removed 0; changed 0 …; version same true`), `brief-only` or `brief-and-durations`; `commits of class other: 0` |
| E1537S1-03 | hub-api | QA | `node "$Q/src.mjs" "$W" > "$EV/E1537S1-03.txt" 2>&1` | Every line `ok` (VERIFIED at `8913e8ab4`: T-1819's 25 lines from `ok T-1819 C1 the frame type in the hub protocol` to `ok T-1819 C5 a ready create clears it`, T-1822's two, T-1823's four, T-1824's sixteen, T-1820's fourteen and T-1821's thirteen, the last `ok T-1821 C4 the selected meta line names it`). A `MISMATCH` on a settled line is read at the build; it is a FAIL unless a later landing changed it with a recorded decision (the registration-point files take one-entry edits from parallel lanes: a moved count there is re-read, not assumed) |
| E1537S1-04 | hub-api | QA | `node "$Q/ids.mjs" "$W/qa/briefs/E-1537-stage-1.md" > "$EV/E1537S1-04.txt" 2>&1` | `missing from the tables: 0` and `open landing markers: 0 (T-1820 0, T-1821 0)`; a non-zero marker count is BLOCKED (the brief was not completed at a landing) |
| E1537S1-05 | hub-api | QA | `s05 > "$EV/E1537S1-05.txt" 2>&1` | `hosts.state producers in production source: [hub/src/hub/core.ts hub/src/hub/dispatch.ts hub/src/protocol.ts shared/wire/index.ts ]` (VERIFIED at `8a9e0b474` and `8913e8ab4`; only `core.ts` and `dispatch.ts` send it, the other two declare it); `hosts.state readers in web/src and nvim/lua: [nvim/lua/cland/hub.lua nvim/lua/cland/init.lua nvim/lua/cland/state.lua web/src/connection.ts ]` (VERIFIED at `8913e8ab4`; `state.lua` names it only in a comment); `host.status requests in web/src and nvim/lua: []` (neither workbench polls `host.status`, A-19022 q7); `key listeners in web/src: [web/src/keyboard.ts ]` (VERIFIED: the single listener; T-1820 C5 adds none); `private host fields in the hosts projection: 0` (T-1819 C2); `web authority entries still local for host and login frames: 8` (`host.create`, `host.status`, `login.set`, `login.signed-in`, `host.list`, `host.prepare`, `host.destroy`, `host.revoke`; VERIFIED by the probe itself at `8a9e0b474`; T-1824 C4). Each scan excludes `qa/briefs/` and `.cland/` |
| E1537S1-06 | hub-api | QA | `s06 > "$EV/E1537S1-06.txt" 2>&1` (after E1537S1-00; reads only) | **Member verify receipts** (VERIFIED with `task view` at writing): `T-1823 verify 9021f6c8-fce4-44af-bf9c-2fe344f526b6 executor droplet state finished result passed artifact A-19003 head is the reviewed tip true`; `T-1822 verify e9a6944e-c372-43ea-b9d9-075c61afa79e … A-19005 … true`; `T-1824 verify b9c74923-3b45-47ff-962b-acc010506075 … A-19013 … true`; `T-1819 verify 9c76e87a-1c05-41b1-a7c7-65a1c7f78e4d … A-19040 … true`; `T-1821 verify c7560b81-9b8c-42fe-bf07-ce2fce1520e9 … A-19063 … true`; `T-1820 verify 62528fbd-5bb4-4d59-8520-8917897d1bb0 … A-19068 … true`. The member verify logs read `occasion null`, `executor droplet`, `os linux`, `failing phase lines 0` with `passing phase lines` 5 (T-1823), 4 (T-1822), 4 (T-1824), 6 (T-1819), 6 (T-1821) and 4 (T-1820). **Merge-batch logs** (full T3; `executor droplet`, `os linux`; each line names its batch from the log's worktree path; VERIFIED by rehearsing `s06` read-only at `8a9e0b474` and `8913e8ab4`): batch `c8a09c9b` suite `7864cae7` `occasion batch`, `failing phase lines 0; passing phase lines 4`; batch `abfc5334` suite `ec150310` `occasion batch`, `failing phase lines 1; passing phase lines 1` (red), its re-formed runs `8ef20c55` (`occasion null`, `failing phase lines 1; passing phase lines 0`, red) and `ee6237fb` (`occasion null`, `failing phase lines 0; passing phase lines 1`); batch `3921566e` suite `966b1f3f`, batch `00150b07` suite `71b2522d` and batch `0f68597c` suite `19ee91aa` each `occasion batch`, `failing phase lines 0; passing phase lines 3`; batch `707074c1` suite `d0923c66` `occasion batch`, `failing phase lines 0; passing phase lines 4`; every batch line `head is the request false` (a batch candidate is never the request). The candidate census (heads of `occasion batch` logs only) reads exactly `candidate 462db8d71 [Batch candidate T-1820] tree equals the landing tree of T-1820`, `candidate 69eba8a6a [Batch candidate T-1822] tree equals the landing tree of T-1822`, `candidate 8b5a83839 [Batch candidate T-1819] tree equals the landing tree of none` (the red candidate, before the T3 repair), `candidate b30cd7731 [Batch candidate T-1819] tree equals the landing tree of T-1819` `candidate d835ceba1 [Batch candidate T-1821] tree equals the landing tree of T-1821` and `candidate f74673957 [Batch candidate T-1824] tree equals the landing tree of T-1824` (VERIFIED by the same rehearsal at `8913e8ab4`); T-1823's candidate `4870e2b6e` is the parent of `69eba8a6a`, tree equal to T-1823's landing (VERIFIED with `git rev-parse`), and is not a suite head. **Stage covers: the Coordinator's cover pair at the requested dev SHA** (QA starts neither): the plan's `cover` reads `missing []`; the Linux log `occasion stage`, `executor droplet`, `os linux`, `head is the request true`, `failing phase lines 0`; the macOS log `occasion stage`, `executor local`, `os darwin`, `Workers 1 · source explicit --workers`, `head is the request true`, `failing phase lines 0`. Record skips and remote lifetime and cost. A cover missing, running or at another head is BLOCKED (never submit one) |
| E1537S1-07 | hub-api | QA | `s07 > "$EV/E1537S1-07.txt" 2>&1` | `per-test notes for the new stage files: 6` and `index rows naming the new stage files: 6` (VERIFIED at `8913e8ab4`: `hosts-state`, `web-hosts-authority`, `host-attach`, `nvim/test/hosts`, `nvim/test/hosts-native` and `web/test/hosts`); `closed-item wording lint exit 0` (INFERRED at this build: not run while writing) |
| E1537S1-08 | hub-api | QA | `node "$Q/fresh.mjs" "$W" plain npm run build > "$EV/E1537S1-08.txt" 2>&1; echo "build exit $?"` | `build exit 0`; `web/dist/index.html` present in `$W` (ignored by Git, so `dirty entries` stays 0). The Web rows are BLOCKED without it (their fixture's `ensureWebBuild` also keeps it current, VERIFIED in `web/test/session-host-fixture.ts`) |
| E1537S1-80 | hub-api | Human | `mrow E1537S1-80 r80` | **Setup** (the E-1535 stage-3 `r80` with R-2): `PRE p1 entries 0`; `git exit 0`; `init exit 0`; `hub after init and stop: down`; `qa pool tables before: 0`; `qa pool tables written: 1` (`[hosts.qa]`: `provider = "fake"`, `size = "fake"`, `region = "fake-1"`, `min_hosts = 0`, `max_hosts = 2`, `slots = 1`); `hub start exit 0; hub up`; `host rows 0`; `fake machines 0`; `auth directory before any key login: absent` (VERIFIED as the E-1535 stage-3 and stage-4 runs recorded them; INFERRED unchanged at this build). A failure makes E1537S1-81 to E1537S1-85 BLOCKED |
| E1537S1-81 | hub-api | Human | `mrow E1537S1-81 r91` | **The stage demo's two fake hosts.** `(prepare qa) exit 0` with `prepared lines` 1 (the CLI prints `<pool>: <state>; changed: …`, VERIFIED in `hub/src/cli/host.ts`; the state word `prepared` is INFERRED from E-1534's `agents: prepared`); `(create 1) exit 0` and `(create 2) exit 0`, each printing a JSON row of pool `qa`; `demo hosts: two ready`; `qa hosts:` two `<id> ready` entries; an `alias recorded` `/private/tmp/ct-` path; `fake machines 2`. INFERRED: no relay watcher is needed because no session is launched (E-1534's relays only served OpenCode session ports) |
| E1537S1-82 | hub-api | Human | `mrow E1537S1-82 r92` | **T-1819 C1, C2, C6 on a CLI-started hub.** `host list qa ids 2`. The connect read: `frames before it welcome,remote.state` (VERIFIED order in test `hosts state connects with empty pools on previous and featured wire shapes`); `pool qa: provider fake; region fake-1; hosts 2/2; slots 0/2; logins claude-code 0/0 signed out 0, codex 0/0 signed out 0, opencode 0/0 signed out 0; alert null` (the three harness keys always present, VERIFIED in `poolSummary`; the counts INFERRED for a project with no login); two `host <id>:` lines `size fake; region fake-1; state ready; created is a time true; sessions []`, with `priceHourly` and `spendToday` recorded (INFERRED: 0 or `null` for the fake provider); `line: qa 2/2 hosts · 0/2 slots · logins …` (this row's rendering of the epic's line; the workbenches' exact wording is T-1820's and T-1821's); `private keys in the frame: 0; hub secret occurrences 0; fake-host root occurrences 0; machine ids or addresses from the host list in the frame 0 of <n>` (C2); `frame host ids equal the host list ids: yes`. The featured snapshot read: the same pool and hosts, `snapshot hosts equal the connect frame: yes` (C1). `(host status) exit 0` with `status pool lines 1` (`qa: 2 hosts · slots 0/2 …`, INFERRED from `hub/src/cli/host.ts`) |
| E1537S1-83 | hub-api | QA | `cat "$EV/E1537S1-40.check.txt" "$EV/E1537S1-45.check.txt" "$EV/E1537S1-66.check.txt" > "$EV/E1537S1-83.txt"` (after E1537S1-40, -45 and -66) | **The stage demo's workbench half, by substitution.** Neither landing ships a driver that renders a workbench against a CLI-started hub (VERIFIED: no such helper in either landing's files), and no QA control makes a scratch host unreachable (T-1839, stage 2). So the demo's "both workbenches show the line and the list" is proven by E1537S1-40 (web, two fake-provider machines through the production projection) and E1537S1-45 (Neovim, pushed recorded frames), and "a host made unreachable turns the row red" by E1537S1-66 (native fake-SSH loss to Neovim on a fixture-owned hub) and E1537S1-40 (web, at the carrier's status boundary). Every line of the file reads `CLEAN`; the row passes only when those three passed, and the verdict names the substitution. Never the human's browser or Neovim |
| E1537S1-84 | hub-api | Human | `mrow E1537S1-84 r94` | **T-1819 C3 on the real CLI.** `(max_hosts 3) exit 0` with `applies-now lines` 1 or more; the next connect read `pool qa: … hosts 2/3; slots 0/2 …` (the hot pool settings read at the next flush, within one second of hub clock, VERIFIED in source; the 2 s wait INFERRED sufficient) |
| E1537S1-85 | hub-api | Human | `mrow E1537S1-85 r95` | `(host stop <id>) exit 0` with `destroyed state lines 1` for each demo host (the CLI exits 0 only on `destroyed`, VERIFIED in `hub/src/cli/host.ts`); the connect read `pool qa: … hosts 0/3; slots 0/0 …` with no `host` line, and `qa hosts after the stops: 0` (INFERRED: destroyed provisions leave the current inventory) |
| E1537S1-89 | hub-api | Human | `mrow E1537S1-89 q57` | The E-1534 census (`q57` from `N2`): `hub stop exit 0; hub down`; every recorded pid `alive no`; the first census lists survivors with parent and cwd (expected: each demo host's fake-machine `supervisor.sh` and host agent under the alias or `$Q/fh`, A-17643; INFERRED: no fake harness or spoke, since no session ran), and `after TERM:` reads `processes naming the scratch root, the alias or this build: 0`. Any other survivor is a FINDING unless its command is unrelated (pid reuse, recorded). Then cleanup step 1 |
| E1537S1-99 | hub-api | QA | `s99 > "$EV/E1537S1-99.txt" 2>&1` (after cleanup step 1) | HEAD, dev and request still the same 40 hex; `dirty entries 0`; `root non-tracker status unchanged: yes`; `preservation lock present: no`; `slot overruns: 0`; `own-family new entries across all rows: 0`; `new fixture-owner receipts naming the source worktree or repository: 0` (INFERRED: no attributed producer runs here; a receipt is recorded, attributed to its row, and judged dead or live before the verdict); `T entries other than node-compile-cache 0`. **Found aside, recorded:** the `historical cland-h-` counts, the per-row `pfam` `new cland-h-` counts (T-1806) and other new entries attributed per row |

Before requesting QA, run `node hub/bin/cland.ts qa lint qa/briefs/E-1537-stage-1.md --commit <dev SHA>` from the root, with a dev SHA that includes every stage landing. The brief is complete only when qa lint passes at the build and no landing marker remains.

## Probes that mislead

- **Generated names cannot be certified by `qa lint`.** The loop titles (`pool create stays alerted through backoff and clears after success: rate limit=<rateLimited>`, `web <add|signin> <harness> returns its persisted card before completion`, `web add projects declared fields with hidden renewal mode: existing <existing>`, `C3 <stop|web stop> joins lease renewal and requires confirmed destroy: <confirmed>`, `login fixture retains borrowed-store ownership after <fault> failure`, `web refuses <type> even from authenticated human`, the card owner's `: <failure>` pair) are expanded in `expect.json`. In `host-stop` the outer loop is `web` (`false` first), the inner `confirmed` (`true` first); in `web-hosts-authority` the outer loop is the harness (`codex` first), the inner `signin` (`false` first).
- **Per-test notes can lag their titles; the test file is the source, never the note.** The `web-hosts-authority` note's "Generated cases" list omits the two `existing <existing>` expansions, which its last paragraph names (VERIFIED at `8a9e0b474`); that is not a missing case.
- **The legacy connect now carries three frames** (`welcome`, `remote.state`, `hosts.state`). A positional reader expecting the next frame to be a result is the defect T-1819's batch hit; `hub/test/harness.ts`'s `assignRole` now skips additive frames until the correlated reply. A raw client in a scratch probe must do the same (`hs.mjs` reads by type).
- **The standalone `hosts.state` frame is sent only on a non-snapshot client hello without `resume`**; a featured client gets the pools in `sessions.hosts` instead, and only subscribed or numbered-delta peers get replacements (T-1819's dispatcher note). A connect read is a snapshot of the cached projection, never a provider call.
- **Three different red proofs.** E1537S1-66 (`nvim/test/hosts-native.test.ts`) drops a real fake-SSH master after fencing the machine and reads Neovim's row; E1537S1-40's inventory case injects the tunnel status at the registry's `subscribeStatus` boundary (no SSH) and reads the web's DOM; E1537S1-10 and E1537S1-45 drive `HostHealth.transition` or push a frame. Report each as what it is; none is a CLI-started scratch hub.
- **Neovim's host list starts folded** (`hosts_folded = true`): the Hosts lines show without the host rows until `za` on the header; a missing host row before `za` is correct. The web's fold state follows the existing `Fold` control; the test opens it when `aria-expanded` reads `false`.
- **The native recovery wait is setup-style.** Only the outage is bound to one second in E1537S1-66; the recovery waits up to the fixture's bounded setup time.
- **The outage alert is not the `unreachable` state.** The pool alert appears at tunnel loss while the provision still reads `ready`; the 3-minute `unreachable` state and General's line are unchanged (A-19022 q8). A test or probe that waits for `unreachable` to see red tests the wrong thing.
- **`spendToday` and `priceHourly` may be `null`.** A fake or unpriced host has no admitted rate; the DigitalOcean price comes only from the admitted declaration checkpoint.
- **Web-started sign-ins answer before completion.** `{name, card}` arrives once the `login-signin-code` card is durable; the login still reads `creating` until the native close (Codex) or the card's answer (Claude Code).
- **The T-1823 revocation is injected at the Host.** The note shows whatever reason the attach command's refusal carries; it does not run `cland host revoke`.
- **The host fact is the process row's `host`, absent or `local` for local sessions.** A Sessions row without a host fact for a local session is correct.
- **Two T-1806 classes.** `cland-h-<20 hex>` socket directories in `/private/tmp` (found aside) and `cland-h-<6 chars>` project roots of `nvim/test/host-attach.test.ts` in the system TMPDIR (own family, must be gone after the file).
- **The T-1819 and T-1824 byte differences are expected** (C-1): accept each only with its explicit equality line.
- **Two environments, pre-existing names, inventories taken during a file, a clean TAP versus root removal, seeded sentinels, plain Node file runs versus the suite runner, process censuses, mtime probes, wall times, platform-only cases and renamed helpers:** exactly as the E-1535 stage-3 "Probes that mislead" (carried at `M4`).

## Out of scope

- The real DigitalOcean API, droplets, volumes, snapshots, keys, tokens and any network; real harness sign-in, browser sign-in links and real terminals; real remotes (T-1824's remote refusals use the test messenger).
- The human's browser and any GUI or computer-use run (rule 18): every Web row is headless and isolated.
- Forcing a tunnel outage on the CLI-started scratch hub (no documented QA control exists until T-1839, stage 2; the red state is proven natively in E1537S1-66 and at the carrier's status boundary in E1537S1-40, see E1537S1-83), and rendering either workbench against the scratch hub.
- The hosts view, login actions from the web's UI and waiting launches in the inboxes (stage 2), doctor and setup (stage 3), the tour and docs (stage 4), users (stage 5); the epic's Definition of done is a separate run.
- Linux and container runs, the stage covers, the merge batches, the members' mode-free verifies and loaded repetitions: their evidence is read in E1537S1-06.
- Duration allowances as pass conditions; T-1731 and T-1770 as bugs; T-1806, T-1808, T-1812, T-1816 and T-1817 as fixes (recorded if seen).
- Any `cland login …`, `cland secret …`, `cland config set`, `cland role launch`, `cland session …`, `cland hub …` or `cland host …` on the live project.

Missing authorization (a real provider token, a harness account, a GUI) is out of scope, not BLOCKED, because no case needs one. A stage cover that has not finished at the requested SHA is BLOCKED (E1537S1-06); an open landing marker is BLOCKED (E1537S1-04).

## Grants

none. Every case runs on this Mac against fakes, the sealed rows with a disposable HOME, the native rows with fixture-sealed children, the Web rows in the pinned Headless Shell with their own profiles, the Neovim rows in the pinned headless Neovim, and no credential.

## Rows to verify after landing

**Every line was settled at dev `8913e8ab473730733e6e38deb531934a57e3a7b2`** (the T-1819, T-1822, T-1823 and T-1824 lines first at `8a9e0b474`, unchanged since except where T-1820's and T-1821's landings are named). Before requesting QA, the Coordinator re-reads each line below at the requested dev SHA and records each difference. Acceptable commits after `8913e8ab4` are tracker commits (`.cland/tasks/` only), this brief's `qa/briefs/E-1537-stage-1.md` commit with or without `hub/test/durations.json`, and a durations-only commit with E1537S1-02's add-only `durdelta` shape. The commits after `8a9e0b474` already accepted are T-1821's `cb31e4342` and T-1820's `36f700d73` landings, the tracker commits `5b056beb4` and `4fc3b57a9`, and the durations commit `8913e8ab4` (`8913e8ab473730733e6e38deb531934a57e3a7b2`, `hub/test/durations.json` only, 67 insertions and 3 deletions, add-only with no allowance change, VERIFIED with `durdelta`). Any other first-parent commit is read before the request and either accepted here by SHA or makes the run BLOCKED.

**Settled at `8913e8ab4` (VERIFIED):** the six landing receipts and trailers; their landing checks in bash (byte-identical for T-1822, T-1823 and T-1821; C-1 with equality for T-1819, T-1824 and T-1820) and later-commit lists; the eleven first-parent stage commits and their classes; the plan read (`merged 6`, `total 6`, covers missing); the reviewed tips from each member's final clear verdict; the verify receipts; the batch logs and candidate trees of `c8a09c9b`, `abfc5334`, `3921566e`, `00150b07`, `0f68597c` and `707074c1`; the carried sections at `M2` to `M6` and every extracted range's SHA-1; every `expect.json` list, read from the test files and expanded through their loops; the tiers; the `src.mjs` lines; E1537S1-05's scans; the preserved list unedited by every stage landing; the own-family prefixes (`cland-h-` six-character roots for `nvim/test/host-attach.test.ts`; `cland-sh-` for `shell`; `cland-proj-`, `fake-codex-`, `fake-opencode-` for `sessions-lifecycle`; `ha-` and `cland-proj-` for `hub/test/host-attach.test.ts`; `cland-proj-` for `daemon`, `tracker` and the `workbench` scenario; `hc-` for the host-create fixture, `hosts-native` included).

**Needs a landing commit (the landing markers):** none; every marker is filled (see "Landing markers").

**INFERRED, with the reason:** the scratch rows' exact strings and counts (from source and earlier passing runs, not a run at this build: the `prepared` state word, the fake price and spend, the empty inventory after stops, no relay needed without sessions, the fake-machine survivors); E1537S1-07's `closed-item wording lint exit 0` (not run while writing); the stage covers' outcome (not yet run at writing); that `hosts-native` and the `workbench` scenario create no root outside their named families; that the publication scanner passes every stage title and sentinel; that no native file writes under the user's HOME; that no native row here leaves a fixture-owner receipt naming the source worktree; that T-1823's injected revocation is equivalent to the hub's real refusal for a revoked host.

## Source provenance

VERIFIED = read in source, Git or the tracker at dev `8913e8ab473730733e6e38deb531934a57e3a7b2` (first drafted at `8a9e0b4746d08d126c23b738653a1c15e34d1322`).

- Kits and helpers: `K` = `f43f4e21049e9c62a97c8dec1ebf37f9c7035a62`; `M2` = `0d0618042fae7b76919d1be152e252b09e4a43ad`; `M3` = `18911bda46c7c0dc332619e93d25041069d3704a`; `M4` = `85e60f6cb34ec320cc7a1f5456de3a4693acbe17` (range 815–828); `M5` = `a72e34d9a83781f1ef7d87c273aaf5f281723046` (range 239–241); `M6` = `d5c59e2c73b61f7e72e7a25b533f3945d2f1fcb0` (carried only); `N2` = `becee171b9cf1fa76e1732c674e13f2656551397` (ranges 576 and 654–663). The E-1535 runs: stage 4 A-18954 (clear at `e2eb555d4`, its R-1 folded in `9394aa974`), Definition of done A-18965 and A-18967 (clear at `aa14a4b23`, no correction).
- Decisions and context: A-19022 (the E-1537 implementer addendum: q6 registration points, q7 pushed frame, q8 red at tunnel loss, q9 harness labels, q10 logins in use against usable, q11 web authority; the native `hc-`, `ct-`, `cland-h-` inventory rule), A-18972 (the epic's breakdown), the epic's Constraints (ask 81a9293a).
- T-1823 (`a335caecf`, tip `14f459698`, 6 files; `rev-36-1823-source-1` and `rev-36-1823-final-1` clear at `14f459698`, A-18987, A-19004; verify `9021f6c8` A-19003; batch `c8a09c9b` suite `7864cae7` A-19023 to A-19025).
- T-1822 (`089d045f5`, tip `b63182b8e`, 7 files; `rev-35-1822-source-1` not clear at `67e40cccf`, `rev-35-1822-source-2` and `rev-35-1822-final-1` clear at `b63182b8e`, A-18988, A-18993, A-19006; verify `e9a6944e` A-19005; batch `c8a09c9b`).
- T-1824 (`686ec94f4`, tip `d2e31fa50`, 26 files; `rev-37-1824-source-1` not clear at `8ec716cfa`, `rev-37-1824-source-2` clear at `f6495d25d`, `rev-37-1824-delta-1` and `rev-37-1824-evidence-1` clear at `d2e31fa50`, A-18995, A-18996; verify `b9c74923` A-19013, A-19014; batches `abfc5334` (with T-1819, red) and `3921566e` suite `966b1f3f` A-19043, A-19044 (landed)).
- T-1819 (`8d1307654`, tip `ac0f036fd`, 37 files; `rev-36-1819-source-1` not clear at `406346d01`, `rev-36-1819-source-2` clear at `c01dab3d7`, `rev-36-1819-evidence-1` not clear at `c01dab3d7`, `rev-36-1819-source-3` and `rev-36-1819-final-1` clear at `1d606582e`, `rev-36-1819-source-4` and `rev-36-1819-final-2` clear at `ac0f036fd`, A-18994, A-19000, A-19008, A-19012, A-19021, A-19036, A-19042; verifies `44bf2e78` A-19007 (red), `ce71f6ef` A-19018, `9c76e87a` A-19040; batches `abfc5334` suites `ec150310` A-19028 to A-19030 and `8ef20c55` A-19031 to A-19033 (red), `00150b07` suite `71b2522d` A-19045, A-19046 (landed)).
- T-1813 (`c7978ae30`, out of stage, `done`; 7 files, among them `hub/test/durations.json`).
- T-1821 (`cb31e4342`, tip `27b1c58d1`, 18 files; `rev-36-1821-source-1` not clear at `c8c5f931b` (A-19053), `rev-36-1821-source-2` and `rev-36-1821-final-1` clear at `27b1c58d1` (A-19058, A-19066); verify `c7560b81` A-19063; batch `0f68597c` suite `19ee91aa` A-19071, A-19072; same-head macOS native rerun A-19067).
- T-1820 (`36f700d73`, tip `72932d333`, 12 files; `rev-35-1820-source-1` not clear at `390e79438` (A-19055), `rev-35-1820-source-2` and `rev-35-1820-final-1` clear at `72932d333` (A-19062, A-19070); verify `62528fbd` A-19068; batch `707074c1` suite `d0923c66` A-19075, A-19076).
- Coordinator and tracker commits in the stage: `94b73e73c` (`BASE`), `8a9e0b474`, `5b056beb4` (T-1839 filed into stage 2), `4fc3b57a9`; durations `8913e8ab4`.
- Known non-blocking items, read with `task view`: T-1806, T-1808, T-1812, T-1816, T-1817 (open, backlog, needs-triage); T-1813 `done`; T-1839 (open, backlog, stage 2).

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "the Hosts row and session rows"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Read the request's id from the epic topic's `history`, never from a `send` result (rule 22). Report `qa clear E-1537 stage the Hosts row and session rows` or `qa not clear E-1537 stage the Hosts row and session rows` to the requester in the epic topic. State in the verdict text that the demo's workbench half was proven by substitution (E1537S1-83): the red row natively in Neovim on a fixture-owned hub (E1537S1-66) and in the web at the carrier's status boundary (E1537S1-40), not on the CLI-started scratch hub (T-1839). Publish evidence only after a clean secret scan with a positive control (rule 15; T-1808).

## Landing markers

Open at writing: none (`open landing markers: 0`, VERIFIED with `ids.mjs` on this file at `8913e8ab4`). The markers of T-1820 and T-1821, written at the first draft (`8a9e0b474`), were filled at `8913e8ab4` from their landings and removed; find any with a fixed-string grep for `TODO(` followed by the member id. If a landing is not byte-identical to the head its rows were written from, every line it touches is re-read.

**T-1820** (filled at `8913e8ab4` from its landing `36f700d73`, own lines equal to its reviewed tip `72932d333`, two files differing by T-1821's own change): "Stage" (its scope entry); "Criteria map" (one row per criterion C1 to C5); "Build"; the `expect.json` list of `web/test/hosts.test.ts`; fourteen `src.mjs` lines; `TIPS` and `s06` (its verify `62528fbd`, its batch suite `d0923c66`); its `samebase` line in `s02` and the `s07` patterns; E1537S1-00, -02, -03, -05 (`web/src/connection.ts` among the readers), -06, -07, -40, -56 and -83 (the documented substitution: no driver against a CLI-started hub).

**T-1821** (filled at `8913e8ab4` from its landing `cb31e4342`, byte-identical to its reviewed tip `27b1c58d1`): "Stage" (its scope entry, with the three regenerated `nvim/test/fixtures/` recordings); "Criteria map" (C1 to C5); "Build"; the `expect.json` lists of `nvim/test/hosts.test.ts`, `nvim/test/hosts-native.test.ts` and `nvim/test/sessions.test.ts` (moved from E1537S1-35 to E1537S1-45, which now also runs `panel-placement-component`), and of the catalog consumers now in E1537S1-35 and E1537S1-67; thirteen `src.mjs` lines; `TIPS` and `s06` (its verify `c7560b81`, its batch suite `19ee91aa`); `s02` and `s07`; E1537S1-00, -02, -03, -05, -06, -07, -35, -45, -56, -66 (the native tunnel-loss case, with what it proves and does not), -67 (the recordings check) and -83.
