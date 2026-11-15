# Stage QA brief: E-1537 stage 5 — the users stage

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (start `bash` first; zsh reads `$S:q`, `$B:h` or `${B}:hub` as modifiers, does not split unquoted path lists and does not split `set -- $pair`; always brace a variable before `:`). The run is local, on macOS (BSD `stat`, Node 24, `uuidgen`, `shasum`, `getconf DARWIN_USER_TEMP_DIR`). A platform skip is a FAIL, not a pass. **No real SSH, host, droplet, volume, snapshot, DigitalOcean API, key, credential, harness login, browser sign-in, sudo, mount, Telegram, Discord, speech API, npm registry or network (R-1530's QA rule).** The named test files use only their own fakes (injected hub clients, the legacy socket fixture, fixture users, scripted prompters, fake harnesses, FakeClock, temporary projects). **Browsers and Neovim are headless and isolated (rule 18):** the two Web files drive the pinned Chrome Headless Shell from `node_modules/playwright-core/.local-browsers` inside themselves, each with its own profile under the file's scratch root (`web/test/setup-signin.test.ts` adds CDP's virtual authenticator for its passkey); the Neovim file runs the pinned headless Neovim that `nvim/bin/nvim-path.ts` resolves. Never the human's browser, profile or Neovim, no GUI, no computer use. Never read, print or log `DIGITALOCEAN_TOKEN` or any key value; no secret is ever an argv element.

**One-use invite links are credentials in this stage.** Users mode prints one-time invite links (`cland auth mode users`, `cland user add`, `cland user invite`). No line of this brief, no expected title, no fixed helper line and no capture holds a real or fixture invite link: every spelling a helper needs is built from parts in memory. Invite-bearing command output is kept in a shell variable and printed only through `$Q/inv.mjs`, which first proves on a planted positive control (built in memory, never printed) that the unchanged publication policy refuses a raw link and accepts the redacted line, then replaces every link with `<one-time invite link withheld>` and counts it. Every capture passes the redactor before it is written (R-1). The only rows that switch a project to users mode (E1537S5-83 and E1537S5-84) use the isolated scratch project `$Q/p1` on a CLI-started scratch hub with fakes only.

**Landing state.** T-1836 landed as `d3a713025` (batch `4ee95ce6`), T-1837 as `01c97ad5b` and T-1835 as `5885fe1bf` (one batch, `d4203f6d`); all three read `closed`, `done`, with no claim (VERIFIED with `task view --json` and `git log --first-parent --grep` at `dfda10574`). **T-1838 landed last** as `17ef83b96` (`17ef83b96bf58fecb6392bcc79d79da27bb659ae`, on `490043158`, trailers `Item: T-1838` and `Reviewed-by: rev-36 (rev-36-1838-final-1)`, byte-identical to its reviewed and verified head `a15551d77` over its 13 files; batch `2812dfb4`, suite `56c8c307`, logs A-19584 and A-19585; VERIFIED); every member now reads `closed`, `done`, with no claim. **T-1860 is not a member** (setup's agent-hosts step reads `open` and doctor `warn` for a role placed on a missing pool): it landed during drafting as `72f26bc5c` (`72f26bc5c7418ab933650f2c401e0ce32d0e7147`, on `dfda10574`, trailers `Item: T-1860` and `Reviewed-by: rev-35 (rev-35-1860-final-1)`, byte-identical to its reviewed tip `2eb80d321` over its 16 files; batch `04752624`, suite `3f4b0bf1`, logs A-19579 and A-19580, T0, T1 and T3 `exit 0`; VERIFIED) and is accepted in E1537S5-02 by its full SHA in `ACCEPT`. T-1806 (fixture code and tests) may also land during the stage; it is not pre-accepted (see "How this brief applies them"). Every landing marker is filled; E1537S5-04 expects `open T-1838 markers: 0; open T-1860 markers: 0`, and a non-zero count makes the run BLOCKED.

**Drafted at dev `dfda10574cc9bc3d2dc764db1f161b0be209b88b`** ("Tracker: T-1806 C2 split to T-1865 (cleanup needs positive closure proof)"); **T-1860's lines filled at dev `ef9f52fc9`; T-1838's filled and every check re-run at dev `84dcc428e52e993a390b95b16ca228cf77a00695`** ("Durations: E-1537 stage-5 add-only refresh …"; after `dfda10574` only T-1860's and T-1838's landings, three tracker commits and the add-only durations refresh; no test file of this brief and no `preserved` file changed, VERIFIED). Markers: VERIFIED = read in source, Git, the tracker or the artifacts at `dfda10574`, and re-run at `84dcc428e` (`src.mjs`, `voc.mjs`, the exact lists against source and logs, the landing checks, the commit classes, the lints and the precheck) (the landed members' lines read with `git show <landing>`; the landing checks, the commit classes, the batch candidates and every block SHA-1 computed with plain Git in bash on the root checkout, whose only uncommitted entries were three `.cland/tasks/` files and the ignored `.cland/artifact-staging/`; `src.mjs`, `voc.mjs`, the expectation lists and the publication precheck run read-only over `git archive` trees of `dfda10574`, of `ef9f52fc9`, of `84dcc428e`, of T-1838's head `a15551d77`, of T-1860's head `2eb80d321` and of T-1838's head with T-1860's files laid over it (the two branches touch disjoint files, VERIFIED); the plan and items with `task plan show` and `task view`; the verify and batch logs in `.cland/artifacts`); INFERRED = a reasoned expectation no read or run has proven (rule 22: an INFERRED line is never a pass condition on its own). Any dev SHA later than `84dcc428e` is re-read there before the run; E1537S5-02 names which later commits are acceptable.

The stage adds users mode to doctor, setup, session rows and the docs. **T-1836** adds doctor's `sign-in mode` row: the mode always comes from `.cland/config.toml`; in users mode the running hub's `user.list` supplies only the counts (`users; <a> active, <i> invited; <n> admins (<m> active)`); no active admin is `warn` with `cland user invite <name>`; no live hub is `warn` `users; counts: hub not running` with `cland hub start`; a refused `user.list` while config says users is `warn` `users; running hub doesn't report users mode` with `cland hub reload` (no error-string parsing; the Coordinator's decision); no name, link, passkey or password reaches the text or `--json`. **T-1837** records the launching user in users mode: a human launch carries the acting user (the authenticated web user, or the CLI's first user) on the process row (`user_id`) and the `session-launched` record; the Agents start line reads `<session> started (<harness>) by <display name>`; the web's session row (`data-launch-user`, `by <display name>`) and Neovim's selected meta line name the user; agent launches and older rows have none; single mode is unchanged; the site's sessions page gains one sentence. **T-1835** adds setup's `sign-in mode` step between the hub and the remotes (order now hub, sign-in mode, remote telegram, remote discord, speech, agent hosts, aide): it detects through the hub (`user.list` with setup metadata), offers "Let several people sign in to the web (users mode)?" with No as the default, `--yes` keeps single and reads `skip`, a confirmed switch names the browser sign-out and `cland auth reset`, prints the first user's name and invite only to the terminal and waits for the passkey (Enter skips: `open` with `cland user invite <name>`; a registered passkey: `done`), users mode reads `ok` with its user count, and (C4 as amended by the Coordinator) without a terminal and without `--yes` a single-mode project reads `skip` with `cland auth mode users` as its fix so that unattended setup's exit status is unchanged. **T-1838** adds the docs page "Users and sign-in modes" (`site/src/content/docs/docs/users.md`, under Features after Web and phone, linked from the overview under "Where you work"), its two marked `sh users-invite` blocks (`cland auth mode users`; `cland user add teammate`, `cland user list`, `cland user invite teammate`), the web-and-phone page's `## Multi-user sign-in` section, the CLI reference's `## Users and sign-in` table of the five `cland user` and `cland auth` subcommands, the site guard `site/test/users-docs.test.ts` (imported by the T1 wrapper `hub/test/remote-docs.test.ts`) and the T2 file `hub/test/users-docs-invite.test.ts`. The run takes about 110 minutes: setup and E1537S5-00 to -08 about 35 minutes (the typecheck and the web build included), the sealed cases about 40 minutes (two Web files, one Neovim file), the scratch rows about 20 minutes, the end checks about 15 minutes. Waits for cover-quiet admission or load are not product results.

## Carried corrections

A reused block must be reconciled against the source brief's recorded run corrections. This brief reuses blocks from fixed commits, never by blob (A-17643): the kits exactly as stage 4 takes them from `K`, `M3` and `M4`; the Git wrapper text of stages 2 to 4; and four helper blocks of the stage-4 brief at `P4` (`881114bfdc1e75e1ec4fc5df8109e99b96357a81`, "QA brief: E-1537 stage 4 (the tour and the hosts docs)", its only commit, also the stage-4 QA SHA; VERIFIED: `qa/briefs/E-1537-stage-4.md` is unchanged from `P4` to `dfda10574`, and the A-19486 copy `brief-tested.md` equals it byte for byte). The chain is read into the evidence at setup and followed as written:

- the E-1537 stage-4 chain at `P4` (`qa/briefs/E-1537-stage-4.md` from `## Carried corrections` up to `## Stage`; 63 lines; SHA-1 `002540c035b76c01d9dedf0cb7a497a0a3779fca`), `$EV/carried-from-P4.md`;
- the E-1537 stage-3 chain at `P3` (62; `10f1860a8972e7a79209f5b9e8b33870fa130d41`), stage-2 at `P2` (55; `6bcd1b899225aaad4379ecbd772ee66cf6fa7cdf`) and stage-1 at `P1` (63; `a9c55f181e9d43d438d23b087950630dec632359`), `$EV/carried-from-P3.md` to `$EV/carried-from-P1.md`;
- the E-1535 chains `M2` (127; `98f38398667ed6b1192f2d9d20e131a30eb88bdc`), `M3` (55; `51da4c95a6b8c380b7b11e4536c7d23f93986701`), `M4` (80; `e4ad4448829797e25c364afad87b0f3f2cf3b06e`), `M5` (76; `7555a12ef6902bbfe8dd2094d14e08d2ea93c61a`) and `M6` (59; `82535892ef7a00b2e4762a0d4515eebe1ca64a90`), `$EV/carried-from-M2.md` to `$EV/carried-from-M6.md`.

Every line count and SHA-1 above was computed in bash at `dfda10574` from fixed commits (VERIFIED; the `P3`, `P2`, `P1` and `M2` to `M6` figures equal stage 4's). T-1835's landing edits `qa/briefs/E-1537-stage-3.md` (a selector line of its criteria map, now naming the sign-in step in the order); the chain is read at `P3`, so the edit does not reach it.

### From the E-1537 stage-4 run (qa-e1537s4-2026-11-15-qa678-1, A-19486, clear at `881114bfd`)

The run's report (`report.md`, SHA-1 `471a362f1aae9ee95494ca912383c79c5ddf4269`) and its read-only observation (`R1-observation.mjs`, SHA-1 `36bf87726e0f921f281c91bcc08a0061dd41f05d`) record one run-copy correction (VERIFIED). This brief bakes it in from the start; it is not applied as a run correction again.

- **R-1 (decision `3ac87db0`; docs-table probes bind to a heading).** Stage 4's row 83 counted every `| \`host…\` |` row of the hosts page, so fourteen configuration-key rows were counted with the six doctor rows. Here every docs-table or row-count probe binds to an explicit section heading (or a table header) before counting, and prints the same count over a neighbouring section of the same shape as its negative control: the CLI reference's `## Users and sign-in` table against the neighbouring `## Hosts and logins` table and the whole page (E1537S5-05); the users page's own `## ` headings against the hosts page's (E1537S5-05); the web-and-phone `## Multi-user sign-in` labels against the neighbouring `## The layout` section (E1537S5-05); the overview link under `## Where you work` against `## The crew` (E1537S5-05); the sessions sentence under `## The sessions panel` against `## What a session is` (E1537S5-05; E1537S5-03 binds it with its heading in the needle). Doctor and setup rows are matched by their exact name, never a prefix (E1537S5-81 to -84).

### Carried from stages 1 to 3 and how it moves here

The stage-3 run corrections R-1 to R-7 (decisions `1d683b85`, `cf8fe88e`, `543aa5a3`, `105f9995`, `43923560`, `2f7bec37`, `6e4e793b`, `6289f7d3`, `7aa4e2c0`; stage-4 brief at `P4`, its "From the E-1537 stage-3 run") stand and are applied as follows:

- **R-1 (fresh seals and capture-boundary redaction).** Every child process of a brief helper gets its environment from `fixtureEnvironment(Q, base, overlays)` then `scratchGitEnvironment`, with every `CLAND_*` and `PATH` input inside the builder and nothing overlaid after: the kit's `fresh.mjs` and `seal.mjs` for every sealed command; inside a sealed helper, children either inherit the sealed environment unchanged (`scratch.sh` passes no overlay and no `env` prefix to any child) or call `seal()` again (`voc.mjs`, `census4.mjs`). Every capture passes the redactor and the unchanged publication policy (`.agents/skills/qa/qa-demo-policy.ts`, `assertPublishable`) before it is written: command output streams through `fresh.mjs` into the row file; every other capture goes through `pubw.mjs`; the scratch functions keep command output in shell variables, write no capture file and print invite-bearing output only through `inv.mjs`. A withheld or redacted line (`# fresh: redacted or withheld lines <n>`, `# pubw <name>: withheld lines <n>` or `# inv <label>: … other lines withheld <n>` with `n` above 0) makes its row INCONCLUSIVE; E1537S5-99 counts them across the run. `inv.mjs`'s `links withheld <n>` is the expected redaction of invite-bearing output and is a pass condition only where a row names its value.
- **R-2 (exact lists from loops and shared registrars).** Every exact list in `expect.json` was expanded from the loops and the imports that register titles in the same process and checked against the source at `dfda10574` (T-1838's at its head) with a registration scan: `hub/test/launch-user.test.ts` registers two of its titles from one loop over `single`/`users`; `hub/test/setup-prompter.test.ts` two from one loop over `cancel`/`eof`; `hub/test/setup-remote-component.test.ts` five from two loops; `site/test/remote-docs.test.ts` three from one loop; `hub/test/remote-docs.test.ts` imports four site guard files (three bare imports and `site/test/remote-docs.test.ts` through a named import), so its one TAP plan holds the 3 + 7 + 5 + 22 + 1 titles listed. Each list was also found passing, name by name and with no unlisted title, in the members' verify logs: A-19535 (T-1836: `doctor-users`), A-19537 (T-1837: `launch-user`, both `sessions` files, the two Neovim catalog consumers, `skills-onboarding`), A-19540 (T-1835: both `setup-signin` files, the setup consumers, `cli-usage`, `cli-usage-compatibility`) and A-19574 (T-1838's verified head: the four site guards and `users-docs-invite`), and again for the site guards and the wrapper's own title in T-1838's batch log A-19584, VERIFIED; every landed file is unchanged from its verify head to `dfda10574` except the fixture `hub/test/fixtures/cli-usage/commands.json` (T-1836's `DOCTOR_USAGE` line landed after T-1835's verify head; the title lists are unaffected).
- **R-3 and R-6 (publishable titles and fixed lines).** Every expected title and every line of this brief, fixed helper output included, passed the unchanged publication policy before commit with two positive controls, an authorization-header credential and a one-use invite link (see "Publication precheck" under Build); no title needs a presentation mapping. Fixed labels avoid the forms the policy refuses or that a runtime value could complete into a refusal (no `token`, `access_token` or `api_key` directly followed by `=`, no word ending in token or api_key followed by `:` or `=`, no word the policy reads as an authorization header); the invite query key is spelled in parts in every helper. E1537S5-04 reruns the precheck on the committed brief at the build.
- **R-4 (the web bundle precondition).** `web/dist` is git-ignored. E1537S5-08 runs a fresh-sealed `npm run build` in the QA worktree before any Web case and any scratch row and confirms the stamp, `bundle state current` and a clean `git status`: the Web files and the scratch hub's web edge (which mints the invite links) read a current bundle.
- **R-5 (receipts and residue for every row).** This stage has no native row (no `ns`, no preservation slot). E1537S5-86 compares the whole run against the setup snapshot `$EV/S0-inv`: every new fixture-owner receipt with its owner and roots, every new `ct-`, `cland-h-` and `hc-` name in `/private/tmp`, attributed or recorded; T-1805 receipts and T-1806 directories are recorded as known and never removed.
- **R-7 (detached host watchdogs).** The census (E1537S5-85, `census4.mjs` from `P4`) identity-checks every host watchdog against its lease (argv lease input under `$Q/p1/.cland/run/host-leases/`, the recorded watchdog pid, the process birth equal to the lease's `startedUtc` to the second in UTC) before any TERM; an unidentified watchdog is never signalled and makes the row BLOCKED. No row here configures a pool or creates a host, so the expected count is 0 (INFERRED from the rows).
- **E-1535 stage-4 R-1 (every Git call from an embedded script is sealed).** Applied through `$Q/git.mjs`, whose text equals stages 2 to 4's (setup checks it against `P2` lines 173 to 180, `P3` lines 174 to 181 and `P4` lines 170 to 177, body SHA-1 `fb90a63cd2675accf22dce86c05ced2987dd44ab` at all three, VERIFIED), and `git() { node "$Q/git.mjs" "$@"; }` in QA's own shell; the bootstrap call goes through `$Q/git0.mjs`.
- **The fake-host root is the scratch project root** (stages 2 to 4): `$Q/fh` is a symlink to `$Q/p1`.
- **Stage-2 R-1 (landing classification).** `s02` classes every first-parent commit after `BASE` (`881114bfd`); a non-member `Item:` trailer is `landing <id>`, accepted only when its full SHA is in `ACCEPT` (T-1860's landing `72f26bc5c7418ab933650f2c401e0ce32d0e7147`) or named by SHA in the request; any other `landing` or `other` commit makes E1537S5-02 BLOCKED until the Coordinator answers through the epic topic. Keep the original output and record a correction file beside it; never reclass in place.

### Known flakes for this stage

Carried by exact signature only: T-1731 (`hub/test/host-ssh-contract.test.ts`), T-1770 (`hub/test/host-provider-digitalocean.test.ts`, the `422` expansion), T-1862 (the DigitalOcean provider `422`-pause test cancelled at its 2 s timeout in a macOS cover) and T-1863 (`suite-cancel`: run worker found dead after a refused cross-session cancel, Linux cover); none of these files runs here; they matter only if a cover attempt named in the plan carries one (E1537S5-06 reads the plan's cover ids, which are the Coordinator's successful runs). **Regressions, never reruns:** T-1735, T-1732, T-1797, T-1810, T-1818, T-1845. Any other failure is judged as it stands. `web/test/setup-signin.test.ts` has a failing whole-file repetition observation (recorded as "7/10") under two-worker CPU load on a predecessor head and passed 10 of 10 repetitions at T-1835's verified head (A-19541, VERIFIED); it runs here alone under the load gate, once, and a failure is judged as it stands.

### Known non-blocking items (record if seen; never a stage failure on their own)

Each read with `task view <id> --json` at `dfda10574` (VERIFIED: each `open`, `backlog`, label `needs-triage`; T-1676 and T-1861 also `qa-found`; T-1862 and T-1863 also `flaky`):

- **T-1805:** fixture-owner receipts naming a removed root or the source worktree; recorded by E1537S5-86, never removed.
- **T-1806** (`open`, `review`, branch head `6c6506a38`, claimed): `cland-h-*` directories in `/private/tmp`; recorded by E1537S5-86, never removed. If its landing reaches the requested build, E1537S5-02 lists it as `landing T-1806` (see "How this brief applies them").
- **T-1865** (split from T-1806 C2): the historical `/private/tmp` residue; QA removes none of it.
- **T-1676:** dead fixture endpoints in `$T` from unchanged producers; inventoried and removed by literal path in `$T` only at cleanup.
- **T-1808:** no shared evidence-publish helper with a positive-control scan yet; QA publishes only after E1537S5-90's clean scan with its positive control (rule 15).
- **T-1816:** `startServer`'s port retry spins without bound; a sealed case row (E1537S5-10 to -22) that ends in `RangeError: Map maximum size exceeded` after about 30 s is this item: the row is INCONCLUSIVE, never a pass.
- **T-1856:** hub stop cannot cancel a hung `git worktree prune`; a scratch `hub stop` that leaves a prune child is this item, recorded in E1537S5-85's census.
- **T-1857:** a long verify result truncates its executor, lifetime and cost line; E1537S5-06 reads receipts from `task view` and the suite logs only.
- **T-1861:** `cland qa lint` reads a per-test docs path ending in `.test.ts.md` as a missing test file; this brief spells every such path in parts or as an escaped pattern, and E1537S5-07 records the E-1313 brief's carried finding as known.
- **T-1864:** `artifact.create` with a large inline body can time out; QA publishes evidence by `path`, never inline.
- **T-1866** (`open`, `backlog`, R-1530, labels `qa-found`, `ready-for-agent`; "Setup's sign-in step reads open when the hub is down, even in single mode"): decision D-1; E1537S5-81's hub-down `open` without `--no-aide` is this item, recorded as known, never a FAIL or a new finding.
- **T-1867** (`open`, `backlog`, C-216, label `needs-triage`; "Closed-item wording lint skips .mdx site pages"): decision D-2; E1537S5-07's `.mdx` count stands in for the lint.

### How this brief applies them

- **Coordinator decisions, 2026-11-15** (answers to the drafting questions, sent to the drafter in the epic's work; recorded here as written):
  - **D-1 (was Q-1; T-1835 C4 and T-1838's setup paragraph): accepted as built.** For this stage, when no hub is reachable and neither `--yes` nor `--no-aide` is given, the sign-in step reads `open` "choose the web sign-in mode" (fix `cland auth mode users`), even with config set to single. Setup's exit status is unchanged, because the hub row is already `open`. The fix (read the config's mode when the hub is down) is filed as T-1866 in R-1530. E1537S5-81 expects the built behaviour and records it as known (T-1866), never as a FAIL or a new finding. Where T-1838's page says `skip` for the no-terminal case, it is judged against the reachable-hub case only (E1537S5-81 with the hub up, E1537S5-84), and the hub-down difference is named as T-1866.
  - **D-2 (was Q-2; T-1838 C5's wording-lint clause): accepted.** The closed-item wording lint does not read `.mdx` pages. E1537S5-07's count of tracker-id references in the `.mdx` lines this stage added stands in for C5's lint on `web-and-phone.mdx` (T-1838) and `sessions.mdx` (T-1837); 0 is the pass condition. T-1867 in C-216 tracks extending the lint.
  - **D-3: the Neovim choice confirmed.** `nvim/test/sessions.test.ts` runs sealed through `nt`, as stage 1's clear run did, and the T3 files come from the merge-batch logs (next bullet).
  - **D-4: T-1806 is not pre-accepted.** If it lands before the QA run, the Coordinator names its SHA in the request; otherwise E1537S5-02 is BLOCKED by its landing.
  - **Tracker-only commits.** The commits that file T-1866 and T-1867, and any later tracker commit, read class `tracker` in E1537S5-02 on dev: `490043158` ("Tracker: T-1866 (sign-in step hub-down) and T-1867 (wording lint .mdx) filed", 2 paths) reads `tracker` (VERIFIED at `84dcc428e`).
- **One environment for tests.** Every test file of this stage runs sealed through the kit's `nt` (`fresh.mjs`, `TMPDIR=$T`, `HOME=$Q/home`), one file at a time, in table order. The per-test notes of the new files ask for no preservation slot (VERIFIED at `dfda10574`: the `doctor-users`, `launch-user`, `setup-signin` and Web `setup-signin` notes; T-1838's `users-docs-invite` note at its head: "No preservation slot is required for this T2 file"). T-1837's `launch-user` note also says "Use the native preservation slot for Neovim and CLI files" for its stage-QA list; this brief runs `nvim/test/sessions.test.ts` (T2, recorded frames replayed into isolated headless Neovim) sealed through `nt`, as stage 1's clear run did for the same file (E1537S1-45; confirmed by the Coordinator, decision D-3), and runs no CLI-native file: `hub/test/host-relaunch.test.ts` and the two T3 scenarios are T3 evidence from the merge batch (E1537S5-06). No row takes `/tmp/cland-preserve.lock`.
- **Kit pins.** Exactly the blocks and SHA-1s stage 4 takes from `K`, `M3` and `M4` (`kit-shell`, `kit-tap`, `seal.mjs`, `fresh.mjs`, `body.sh`, `helpers.sh`, `std.mjs`, `invd.mjs`, `kit2-fns`, `kit2-mrow`, `kit2-s0`, `kit2-checks`, `kit3-checks`), and four helper blocks from `P4`: `pubw.mjs` (19 lines), `pubscan.mjs` (14), `census4.mjs` (43) and `res.mjs` (31), each SHA-1 recomputed at `dfda10574` (VERIFIED). Not taken from `P4`: `src.mjs`, `ids.mjs`, `pub.mjs`, `voc.mjs`, `expect.json`, `checks.sh`, `scratch.sh`; this brief writes its own.
- **Reconciliation.** Every landed member's own changed lines at its landing equal its reviewed tip's against their merge base (`ownlines`, VERIFIED at `dfda10574`: T-1836 `5d2f6fd81` against `d3a713025`, T-1837 `f3e1899ec` against `01c97ad5b`, T-1835 `c435f67e1` against `5885fe1bf`). Whole files are byte-identical for T-1836 (14 files); T-1837's `docs/agents/tests/index.md` and `hub/test/tiers.json`, and T-1835's `.agents/skills/implement/SKILL.md`, `docs/agents/tests/index.md`, `hub/README.md`, `hub/src/hub/dispatch.ts`, `hub/src/protocol.ts`, `hub/test/fixtures/cli-usage/commands.json`, `hub/test/tiers.json` and `shared/wire/index.ts`, differ from the tips only by the lines an earlier member's landing put there (the squash order T-1836, T-1837, T-1835). T-1838's landing `17ef83b96` is byte-identical to its tip `a15551d77` over its 13 files and its own lines equal the tip's (VERIFIED with `git diff --quiet` and `ownlines` at `84dcc428e`).
- **The non-member landings.** T-1860's landing `72f26bc5c` touches `hub/src/setup/steps/hosts.ts`, `hub/src/doctor/hosts.ts`, the new `hub/src/host/missing-pools.ts`, `hub/src/cli/usage/setup.ts`, `hub/test/fixtures/cli-usage/commands.json`, `docs/hub/cland-doctor.md`, `docs/hub/cland-setup.md`, `hub/README.md`, `site/src/content/docs/docs/hosts.md`, its `doctor-hosts` and `setup-hosts` test files and their notes, `.agents/skills/implement/SKILL.md` and `qa/briefs/E-1537-stage-4.md`. It breaks no expectation here (VERIFIED at `ef9f52fc9` and over T-1838's head with its files laid on: `src.mjs` 60 and 94 `ok`, `voc.mjs` unchanged, the stage-4 brief still lint-clean, the wording lint at 0 findings; its verify A-19569 at `2eb80d321` passed `doctor-users`, `setup-signin`, `site/test/hosts-docs.test.ts` and `cli-usage-compatibility` with their full lists): it changes setup's agent-hosts row and doctor's hosts block only for a role placed on a pool that does not exist, and every scratch row here keeps every role on `local` (E1537S5-80 records it). Its doctor `host <role> placement` rows would sit inside the hosts block, before `sign-in mode`. T-1835 C4's "unattended setup's exit status is unchanged" concerns the sign-in step; T-1860 makes unattended setup exit 1 for a misplaced role by design, a separate cause that `ssi` keeps apart (it compares the exit with the other rows' verdicts). T-1806 (fixture code: `hub/src/host/records.ts`, `shared/fixture-sockets.ts`, `hub/test/harness.ts`, `test-support/temporary-inventory.ts`, its tests and notes) touches no file this brief reads as built (`preserved`), but it is not pre-accepted (decision D-4): if it lands before the run, the Coordinator names its SHA in the request, or E1537S5-02 is BLOCKED.
- **Setup's sign-in step as built (T-1835).** Detection goes through the hub; the step never reads the config's mode. With the hub answering: users mode `ok` `users mode; <n> users`; single mode under `--yes` `skip` `single mode`; without a terminal `skip` `single mode` with fix `cland auth mode users`. With no hub answering: `skip` `single mode default; detect when the hub is available` under `--yes` or `--no-aide`, otherwise `open` `choose the web sign-in mode` with fix `cland auth mode users` (accepted as built: decision D-1 below, known as T-1866). The scratch rows reach without a terminal: single with the hub up and with `--no-aide` (E1537S5-81), single with the hub down with and without `--no-aide` (E1537S5-81), users with the hub up (E1537S5-83), single again after `cland auth reset` (E1537S5-84). Source-only (E1537S5-03, and the tests in E1537S5-16 to -18): every `--yes` case (`--yes` starts the hub and accepts harmless defaults; see "Out of scope"), every terminal case (the offer, the confirmation, the invite narration, Enter's `open`, the passkey's `done`).
- **Doctor's sign-in row as built (T-1836).** The scratch rows reach: single with the hub up and down (E1537S5-81), config users with a single-mode hub, refused `user.list` (E1537S5-82), users with one active admin, then one active and one invited (E1537S5-83), users with the hub stopped (E1537S5-83), single after reset (E1537S5-84). Source and test only: no active admin (a real hub refuses to start in users mode without its authorized first admin, so `hub/test/doctor-users.test.ts` uses the legacy socket fixture), the 3 s timeout, stale discovery with a live PID.
- **The invite links on the scratch hub.** E1537S5-83 runs T-1838's marked steps on the scratch hub and prints their output only through `inv.mjs`; it then looks, with `nolink.mjs`, for every invite value it holds in memory in every regular file under the scratch project's `.cland/` (the database files skipped and never opened) and the scratch HOME, state, config and cache roots, and in the doctor, setup and list output it captured: T-1835 C5's and T-1838's "the link appears in no hub log line or journal record" at runtime, with a planted positive control.
- **Expected registrations.** Exact lists only where every registration is known (R-2); the rest `exact: false` with the whole file `CLEAN`.
- **Evidence split (this release's standing rule).** T1, T2 and Web come from each member's mode-free `cland verify` on the Linux droplet at its reviewed tip (T-1836 `e1282e0d`, A-19535; T-1837 `d09b914c`, A-19537, which also ran T3 and T4; T-1835 `b2e70b6b`, A-19540, which also ran its changed T3 scenario; T-1838 `059150dd`, A-19574, at the head it landed byte-identical to); full T3 from the merge batch that landed it (T-1836: batch `4ee95ce6`, suite `d2c22f2c`, logs A-19543 and A-19544; T-1837 and T-1835: batch `d4203f6d`, suite `efb3febe`, logs A-19545, A-19546 and A-19547, which also ran the Web phase; T-1838: batch `2812dfb4`, suite `56c8c307`, logs A-19584 and A-19585, at the candidate `e4ad65fb9` on `72f26bc5c`; each `occasion batch`, `executor droplet`, Linux, every tier `exit 0`, VERIFIED). The stage's complete scope, T4 included, comes from the Coordinator's stage cover pair at the requested dev SHA (a Linux `verify all --occasion stage` and a macOS `--executor local --workers 1` run). **QA starts none of them**: E1537S5-06 reads them.
- **Cleanup order, removals and sockets (carried).** QA removes only dead `$T` residue, the recorded alias (if any) and its own scratch roots, by literal path, and nothing else in the shared system TMPDIR or `/private/tmp`.

### Kit conventions carried

- **Rule 22.** Every selector, test name and string is marked VERIFIED or INFERRED.
- **TAP.** Plans count top-level registrations; counters include nested subtests; `tap.mjs` parses exactly that. A file that imports other test files registers their titles in its own TAP plan.
- **Exact strings** are counted by `src.mjs` with `String.split` on the worktree's files; tree-wide checks use Git at `$S` through the wrapper.

## Stage

- Epic: E-1537 (Workbenches, doctor, setup and docs for hosts).
- Exact stage name: the users stage.
- Items, in plan order, by lane (VERIFIED in `task plan show E-1537 --json` at `dfda10574`): [T-1835 (setup's sign-in mode step), T-1836 (doctor's sign-in mode line), T-1838 (the users and sign-in modes page, the multi-user section and the CLI reference for `cland user` and `cland auth`)], [T-1837 (the launching user on session rows and Agents start lines)]. The run reads membership, counts and state from `task plan show E-1537 --json` (E1537S5-00), never from this list. QA finding fixes added after writing are listed in the request.
- Policy: affected/after-stage (no item override; every member's `qaPolicy` is `{"scope":"affected","when":"after-stage"}` with `qaCriteria` `[]`, VERIFIED at `dfda10574` for all four).
- Scope: **affected.** The combined changed behaviour through the stage's named test files and their unedited consumers (the setup order consumers, the CLI usage fixtures' checks, the Neovim recorded-catalog consumers, the site guards that read the sidebar, the overview and the CLI reference, the shared T1 wrapper, the task-selection guard of site prebuild tests, the tier and test-docs indexes), read-only source checks of every member's lines and of the pages against the code they describe, an independent read of every `cland` command and `auth.*` key on the users page and the multi-user section against the built CLI's help and the config parser and of the CLI reference's Users and sign-in inventory against the built usage, the wording and qa lints, the evidence read of E1537S5-06, and the stage demo on a scratch project: doctor's and setup's sign-in rows in single mode with the hub up and down, doctor's reload guidance when the config says users and the hub is single, the users page's marked blocks run in order on a CLI-started hub (users mode, a second user invited, the invite renewed) with every invite withheld and looked for afterwards in the hub's files, doctor's counts and setup's `ok` in users mode, doctor's `hub not running`, a users-mode hub restart and `cland auth reset` back to single.
  - T-1836 (landed `d3a713025`, `d3a71302558a61b8c353cb7ef9777f49b75e5dcf`, on `63b5318bd`, trailers `Item: T-1836` and `Reviewed-by: rev-35 (rev-35-1836-final-1)`, exactly one `Item: T-1836` commit on dev's first-parent history; VERIFIED; own lines equal to its reviewed tip `5d2f6fd81` (`5d2f6fd812795235d696fe0d0c1babf1c606a699`, merge base `63b5318bd`; rev-35 `rev-35-1836-source-1` not clear at `93460ad35`, `rev-35-1836-source-2` and `rev-35-1836-final-1` clear at `5d2f6fd81`, C1 to C4 verified there) and byte-identical over its 14 files). New `hub/src/doctor/users.ts` (`checkUsers`, 44 lines); `hub/src/cli/doctor.ts` adds `...await checkUsers(root, env)` right after `checkHosts`; `hub/src/cli/usage/doctor.ts` and the `DOCTOR_USAGE` fixture in `hub/test/fixtures/cli-usage/commands.json` add the `sign-in mode:` help line; new `hub/test/doctor-users.test.ts` (T2, seven titles; tier row, index row and per-test note); `hub/test/fakes/legacy-remote-hub.ts` gains `users` and `holdUsers`; `docs/hub/cland-doctor.md`, `docs/agents/secrets.md`, `hub/README.md`, the implement skill and its change note describe it. Coordinator decision 4324006e (topic-1517): mode always from config; `user.list` only for counts; a refused `user.list` while config says users warns with `cland hub reload`; no error-string parsing.
  - T-1837 (landed `01c97ad5b`, `01c97ad5bfbf4801a88cd185081fa89ad7cf77f9`, on `188107b62`, trailers `Item: T-1837` and `Reviewed-by: rev-36 (rev-36-1837-final-1)`, exactly one `Item: T-1837` commit; VERIFIED; own lines equal to its reviewed tip `f3e1899ec` (`f3e1899ec9b884661267fc067dfccb7a6beb2aa2`, merge base `63b5318bd`; rev-36 `rev-36-1837-source-1` not clear at `e4de7c8a1`, `rev-36-1837-source-2` and `rev-36-1837-final-1` clear at `f3e1899ec`, C1 to C5 verified there); 26 files). `hub/src/adapters/processes.ts` adds the `user_id` column and writes it; `hub/src/adapters/sessions.ts` adds `#launchUser` (nothing in single mode or without a user) to the view and both `session-launched` records; `hub/src/adapters/requests.ts`, `contract.ts` and `hub/src/hub/dispatch.ts` carry the authenticated human's id (`original ? undefined : humanUser(frame)?.id`); `hub/src/hub/agents-topic.ts` appends ` by <display name>` to the start line; `hub/src/protocol.ts` and `shared/wire/index.ts` add optional `userId` and `userDisplayName`; `web/src/sessions/SessionRow.tsx` adds the `data-launch-user` fact; `nvim/lua/cland/panels.lua` and `state.lua` add `by <display name>` to the selected meta line; `site/src/content/docs/docs/sessions.mdx` gains one sentence under "The sessions panel"; tests: new `hub/test/launch-user.test.ts` (T2, four titles), `hub/test/host-relaunch.test.ts` (T3, users-mode relaunch keeps the user), `hub/test/skills-onboarding.test.ts` (new title `sessions page describes launching users and uses shipped commands`), `web/test/sessions.test.ts` and `nvim/test/sessions.test.ts` (one new title each), the regenerated `nvim/test/fixtures/protocol-frames.json` and its `sessions.json` slice; notes and `docs/hub/adapters-and-sessions.md`.
  - T-1835 (landed `5885fe1bf`, `5885fe1bfb1b3395eb25c1c2aa4898f1c798538f`, on `01c97ad5b`, trailers `Item: T-1835` and `Reviewed-by: rev-37 (rev-37-1835-evidence-2)`, exactly one `Item: T-1835` commit; VERIFIED; own lines equal to its reviewed tip `c435f67e1` (`c435f67e19cb9f56dac9cf19ed3deb6107af2b7f`, merge base `63b5318bd`; rev-37 `rev-37-1835-source-1` clear at `b81e6ba6b`, `rev-37-1835-evidence-1` not clear at `b81e6ba6b`, `rev-37-1835-source-2` and `rev-37-1835-evidence-2` clear at `c435f67e1`, C1 to C5 verified there; the same-head reconciliation A-19541 and the evidence review A-19542); 30 files). New `hub/src/setup/steps/signin.ts` (60 lines); `hub/src/setup/runner.ts` puts `signin` after `hub`; `hub/src/setup/hub.ts` adds `signinStatus` (`user.list` with `setup: true`) and `signinUsers` (`auth.mode`); `hub/src/hub/daemon.ts` answers `user.list` with setup metadata in either mode; `hub/src/protocol.ts`, `shared/wire/index.ts` and `hub/src/hub/dispatch.ts` carry the optional `setup` field; `hub/src/setup/prompter.ts` lets a pause be aborted; `hub/src/cli/usage/setup.ts` and its fixture gain three help lines; tests: new `hub/test/setup-signin.test.ts` (T2, five titles) and `web/test/setup-signin.test.ts` (Web, one title), the order consumers `setup-flow`, `setup-hub`, `setup-cli`, `setup-remotes`, `setup-remote-component`, `setup-prompter` (one new title) and the T3 scenario `hub/test/scenarios/setup.test.ts`; `docs/hub/cland-setup.md`, `hub/README.md`, notes, the implement skill and its change note; `qa/briefs/E-1313.md` and `qa/briefs/E-1537-stage-3.md` name the sign-in step in their order selectors. C4 as amended by the Coordinator (2026-11-15, tracker commit `188107b62`): without a terminal and without `--yes`, a single-mode project's step changes nothing and prints `skip` with `cland auth mode users`, so unattended setup's exit status is unchanged; skipping the passkey wait in a terminal is `open` with `cland user invite <name>`.
  - T-1838 (landed `17ef83b96`, `17ef83b96bf58fecb6392bcc79d79da27bb659ae`, on `490043158`, trailers `Item: T-1838` and `Reviewed-by: rev-36 (rev-36-1838-final-1)`, exactly one `Item: T-1838` commit on dev's first-parent history; VERIFIED; byte-identical to its reviewed tip `a15551d77` (`a15551d77475e7332f28e2edc57a92e9c76b1dff`, merge base `bd7d81667`, two commits `e0c5440c3` and `a15551d77`; rev-36 `rev-36-1838-source-1` not clear at `e0c5440c3`, `rev-36-1838-source-2` and `rev-36-1838-final-1` clear at `a15551d77`, C1 to C5 verified there; verify `059150dd`, A-19574, at that head) over its 13 files, own lines equal; its batch candidate `e4ad65fb9` ("Batch candidate T-1838", on `72f26bc5c`) differs from the landing tree only in `.cland/tasks/` files, and the batch logs record the normalised tree `39a4f31d1d53702c4ab48a032a6e269ab8692b97`). New `site/src/content/docs/docs/users.md` (96 lines, eight sections, two marked `sh users-invite` blocks, no working link: the printed link is shown as the placeholder `<one-time invite link>`); `site/astro.config.mjs` adds `['Users and sign-in modes', 'docs/users']` to the Features group after Web and phone; `site/src/content/docs/docs/features.md` links it under "Where you work"; `site/src/content/docs/docs/web-and-phone.mdx` gains `## Multi-user sign-in`; `site/src/content/docs/docs/cli.md` gains `## Users and sign-in` (five rows) before `## Hosts and logins`; new `site/test/users-docs-source.ts` (`usersPath`, `usersSection`, `inviteSteps`) and `site/test/users-docs.test.ts` (five titles, imported by the T1 wrapper `hub/test/remote-docs.test.ts`); new `hub/test/users-docs-invite.test.ts` (T2, one title; tier row, index row and per-test note); the remote-docs per-test note.
- **Merge watch** (VERIFIED with `git log` per file from each landing to `dfda10574`): T-1837's landing touches two of T-1836's files (`docs/agents/tests/index.md`, `hub/test/tiers.json`); T-1835's landing touches five of T-1836's (`.agents/skills/implement/SKILL.md`, `docs/agents/tests/index.md`, `hub/README.md`, `hub/test/fixtures/cli-usage/commands.json`, `hub/test/tiers.json`) and five of T-1837's (`docs/agents/tests/index.md`, `hub/src/hub/dispatch.ts`, `hub/src/protocol.ts`, `hub/test/tiers.json`, `shared/wire/index.ts`); every T-1836 and T-1837 `src.mjs` line was read at `dfda10574` after them and reads `ok`. T-1838's landing `17ef83b96` touches `docs/agents/tests/index.md` and `hub/test/tiers.json` (T-1836's, T-1837's and T-1835's files) and `site/src/content/docs/docs/features.md`, `site/astro.config.mjs`, `site/src/content/docs/docs/cli.md` (stage 4's), and every `src.mjs` line reads `ok` at `84dcc428e` (VERIFIED); no commit after it touches its files; T-1860's landing `72f26bc5c` touches `.agents/skills/implement/SKILL.md`, `hub/README.md`, `hub/test/fixtures/cli-usage/commands.json`, `docs/hub/cland-doctor.md` (T-1836's), `docs/hub/cland-setup.md` and `hub/src/cli/usage/setup.ts` (T-1835's), and every T-1836 and T-1835 `src.mjs` line reads `ok` at `ef9f52fc9` (VERIFIED); `src.mjs` reads all 94 lines `ok` over T-1838's head with T-1860's files laid over it (VERIFIED), and `s02` lists each such commit under "commits after its landing touching its files".

### Coordinator decisions on the drafting questions

The two questions raised while drafting were answered by the Coordinator on 2026-11-15 and are recorded as decisions D-1 (setup's sign-in step with no hub reachable; T-1866) and D-2 (the wording lint and `.mdx` pages; T-1867) under "How this brief applies them". Nothing is open.

### Criteria map

The stage verdict carries no item or epic marks; this tells the run which check proves what. E1537S5-04 checks that every row id named here exists in the tables below. VERIFIED at `dfda10574` for T-1835, T-1836 and T-1837 (every criterion read with `task view <id> --json`, each `checked` with its final verified mark at its reviewed tip; every title read from the test files there and found passing in the verify logs A-19535, A-19537 and A-19540); T-1838's at its head `a15551d77` (A-19574), to which its landing is byte-identical, and in its batch log A-19584; re-run at `84dcc428e`.

| criterion | proven by |
| --- | --- |
| T-1836 C1 (single mode: doctor prints one `ok` line naming the sign-in mode) | E1537S5-10: test `C1 doctor reports single mode from the running hub`; E1537S5-81 (scratch, hub up and hub down: exactly one row named `sign-in mode`, `ok`, `single`, no fix, right after the hosts block; the text line `ok sign-in mode single`); E1537S5-84 (after `cland auth reset`); E1537S5-03 (the `checkUsers` call after `checkHosts`, the single-mode line); E1537S5-05 (the built doctor help line) |
| T-1836 C2 (users mode: the mode with users by state and admins from a running hub; without one `hub not running` with `cland hub start`) | E1537S5-10: tests `C2 doctor reads users counts from the hub and labels offline counts unknown`, `doctor reports hub not running for stale discovery with a live PID` and `doctor keeps held live user counts unknown after timeout`; E1537S5-83 (scratch: `users; 1 active, 0 invited; 1 admins (1 active)` after the switch, `users; 1 active, 1 invited; 2 admins (1 active)` after the second user, `warn` `users; counts: hub not running` with `cland hub start` once the hub stopped); E1537S5-84 (the same counts after a users-mode restart); E1537S5-03 |
| T-1836 C3 (users mode with no active admin: `warn` with `cland user invite <name>`) | E1537S5-10: test `C3 doctor warns with invite fix when no active admin exists` (the legacy socket fixture: a real hub refuses to start in users mode without its authorized first admin); E1537S5-03 (the `activeAdmins ? ok : warn` line); source and test only (see "Out of scope") |
| T-1836 C4 (no invite link, passkey or password material in the text or `--json`) | E1537S5-10: test `C4 doctor omits planted identity and credential material in text and JSON` (planted markers caught first); E1537S5-03 (only the known state labels are output; no `.name` or `.message` read); E1537S5-83 (`nolink.mjs`: every invite value the row holds occurs 0 times in the doctor text and JSON it captured, positive control `true`; every doctor capture passes `fresh.mjs` with 0 withheld lines) |
| T-1836 Coordinator decision (mode from config always; `user.list` only for counts; refused `user.list` while config says users → `warn` with `cland hub reload`; no error-string parsing) | E1537S5-03 (four lines); E1537S5-10: test `doctor warns when config users disagrees with a running single-mode hub`; E1537S5-82 (scratch: the existing `[auth] mode` key edited to `users` while the hub runs single: `warn` `users; running hub doesn't report users mode` with `cland hub reload`; the key restored: `ok` `single`) |
| T-1837 C1 (users mode: a second user's web launch and a CLI launch record that user on the process row and the `session-launched` record) | E1537S5-12: the loop expansion `launch attribution follows authenticated humans in users mode` (the authenticated second web user, the CLI subprocess's first user, a forged frame field ignored, the attribution persisted across restart and a fresh resume) and its single-mode expansion; E1537S5-06 (T3 `hub/test/host-relaunch.test.ts`, edited by T-1837: the running relaunch keeps the original user's id on the destination row, view and `session-launched` entry, batch `d4203f6d`); E1537S5-03 (the `user_id` column and write, dispatch's human id, both records) |
| T-1837 C2 (the Agents start line names the launching user in users mode; unchanged in single mode) | E1537S5-12: test `Agents start lines name the recorded launching user and accept legacy records`; E1537S5-03 (the ` by <display name>` suffix; nothing projected in single mode) |
| T-1837 C3 (the web's session row and Neovim's selected meta line name the user in users mode, nothing in single mode) | E1537S5-13: `Sessions row names its launching user only in users mode` (pinned Headless Shell); E1537S5-14: `selected session metadata names the launching user and accepts legacy rows` (34, 50 and 80 columns) and the recorded-catalog consumers; E1537S5-06 (the T3 scenario `nvim/test/scenarios/workbench.test.ts`, the title `recorded protocol fixtures match the live hub attach frames`, batch `d4203f6d`); E1537S5-03 (`SessionRow.tsx`, `panels.lua`, `state.lua`) |
| T-1837 C4 (an agent's launch records no user; rows recorded before the change read without one after a restart) | E1537S5-12: tests `hub restart reads pre-attribution process and journal fixtures without a user` and `launch attribution follows authenticated humans in users mode` (the real Coordinator spoke's launch records none); E1537S5-03 (a row without `user_id` reads without a user) |
| T-1837 C5 (the sessions page names the launching user in users mode; its commands pass the docs command check) | E1537S5-15: test `sessions page describes launching users and uses shipped commands`; E1537S5-03 (the sentence with its heading `## The sessions panel` in the needle; once on the page); E1537S5-05 (under The sessions panel, not under the neighbouring What a session is); E1537S5-07 (the added `.mdx` lines carry no tracker id; decision D-2) |
| T-1835 C1 (scripted prompter: the step runs after the hub and before the remotes, its offer defaults to No, `--yes` with or without a terminal leaves single mode with `skip`) | E1537S5-16: `C1 sign-in offer defaults No and yes skips with either terminal policy`; E1537S5-18 (`setup-flow`'s `C1 agent hosts runs after remote steps and before the Aide` asserts `sign-in mode` right after `hub` and `remote telegram` right after it; the ordered reports of `setup-flow`, `setup-hub`, `setup-cli`, `setup-remotes` and `setup-remote-component`); E1537S5-06 (the T3 PTY scenario `hub/test/scenarios/setup.test.ts` answers `Let several people sign in to the web (users mode)? [y/N]` with Enter, batch `d4203f6d`); E1537S5-81 (scratch order `hub, sign-in mode, remote telegram, remote discord, speech, agent hosts, aide`); E1537S5-03 (`STEPS`, the offer with default `false`, the `--yes` line); E1537S5-05 (the built setup help lines) |
| T-1835 C2 (choosing users switches the hub after a confirmation naming the browser sign-out and `cland auth reset`; the step prints the first user's name and one-time invite) | E1537S5-16: test `C2 C4 C5 confirmed switch prints the invite only to terminal and Enter leaves the exact command`; E1537S5-03 (the confirmation text, the terminal-only narration, the switch through the hub's `auth.mode`, the first user from Git's `user.name`); E1537S5-83 (the same hub frame through `cland auth mode users` on the scratch hub: `fixture-admin  admin` and one withheld link) |
| T-1835 C3 (a passkey registered on the invite page in an isolated headless browser with a virtual authenticator ends the step `done`, the first user active in `cland user list`) | E1537S5-17: test `C3 setup completes after the first user registers a passkey on the invite page`; E1537S5-06 (the Web phase of batch `d4203f6d`); E1537S5-03 (the `done` line) |
| T-1835 C4 as amended (skipping the wait: `open` with `cland user invite <name>`; without a terminal and without `--yes` a single-mode project's step changes nothing and prints `skip` with `cland auth mode users`, so unattended setup's exit status is unchanged) | E1537S5-16: tests `C2 C4 C5 confirmed switch prints the invite only to terminal and Enter leaves the exact command` (`open`, fix `cland user invite jane-doe`) and `C4 nonterminal single mode skips with its command and a declined confirmation leaves single unchanged`; E1537S5-18 (`setup-hub`'s `the ordered setup flow reruns without starting another hub or Aide`: `skip`, `single mode`, `cland auth mode users`); E1537S5-81 (scratch, hub up: `skip` `single mode` `cland auth mode users`, the exit equal to what the other rows give, config and roles unchanged; hub down: the `--no-aide` `skip`, and without it the `open` accepted as built under decision D-1, known as T-1866); E1537S5-84 (after reset); E1537S5-03 |
| T-1835 C5 (users mode: `ok` with its number of users, asking nothing; the invite in no hub log line or journal record) | E1537S5-16: tests `C2 C4 C5 …` (`users mode; 1 users`; the planted link caught first; no link in the logs, the journal or the report); E1537S5-83 (scratch: `ok` `users mode; 2 users`; `nolink.mjs`: each invite value 0 times in every regular file under the scratch `.cland/` (database files skipped) and the scratch HOME, state, config and cache roots, after the hub flushed and stopped, positive control `true`) |
| T-1838 C1 (the page under Features, linked from the overview, sections on the modes, switching and reset, users and invites, passkeys and passwords, `--as`, remotes, setup's step and doctor's line) | E1537S5-19: `site/test/users-docs.test.ts` and its unedited neighbours `site/test/remote-docs.test.ts` (sidebar and overview checks) and `site/test/hosts-docs.test.ts`; E1537S5-20 (the T1 wrapper); E1537S5-03 (the Features group, the overview link bound to `## Where you work`, the title, the eight headings, the setup and doctor sentences against T-1835's and T-1836's lines; the page's no-terminal `skip` sentence is judged against the reachable-hub case only, and the hub-down `open` is the known difference T-1866, decision D-1); E1537S5-05 (the eight headings exactly, against the hosts page; the overview link under Where you work and not under The crew) |
| T-1838 C2 (every `cland` command and config key on the page and in the multi-user section exists in the CLI help and the config keys) | E1537S5-19 (`site/test/users-docs.test.ts`: its vocabulary guard and invented controls); E1537S5-05 (independently: the page's distinct commands and the section's against the built `cland <command> --help`, with an invented-subcommand and invented-flag control; `auth.mode` the only `auth.*` key, rendered by the template and read by the parser) |
| T-1838 C3 (the page's marked blocks, run in order in a scratch single-mode project, switch it to users mode and print a one-time invite for a second user) | E1537S5-21: `hub/test/users-docs-invite.test.ts`; E1537S5-83 (the manual reader check: QA's own extraction of the marked blocks equals the T2 parser's; each step exits 0 on a CLI-started scratch hub in single mode; `[auth]` mode then `users`; step 2 prints `teammate  admin  invited` and one withheld link; step 3 lists `fixture-admin` active and `teammate` invited; step 4 one withheld link; no value found in the hub's files) |
| T-1838 C4 (the multi-user section: passkey and password sign-in, the users list and invites in the web, author names, the one inbox, linked from and to the users page) | E1537S5-19 (`site/test/users-docs.test.ts`: the section's built controls); E1537S5-05 (the fourteen labels bold in the section and present in `web/src/accounts/Users.tsx` and `web/src/SignIn.tsx`, none in the neighbouring The layout section; the link to `/docs/users/`); E1537S5-03 |
| T-1838 C5 (the CLI reference lists each `cland user` and `cland auth` subcommand their usage names and no other; the wording lint passes on the changed pages) | E1537S5-19 and E1537S5-20 (`site/test/users-docs.test.ts`'s CLI inventory check, with extra and duplicate controls); E1537S5-05 (independently, bound to `## Users and sign-in`: five listed, five in the built usage, the neighbouring Hosts and logins table with its own rows and no user or auth command, extra and duplicate controls); E1537S5-07 (the wording lint: 0 findings, its document count equal to QA's count of the three globs, the users page included; the `.mdx` substitute accepted under decision D-2, T-1867) |
| T-1860 (non-member, landed `72f26bc5c`) | E1537S5-02 (classed `accepted T-1860` by its full SHA in `ACCEPT`); E1537S5-03 and E1537S5-05 (no line changes with it; VERIFIED at `ef9f52fc9` and over T-1838's head with its files); E1537S5-80 (every scratch role on `local`, so no scratch row reaches its new rows); E1537S5-07 (the stage-4 brief it edits still lint-clean) |
| Stage demo (the epic: "setup switches a scratch project to users, and the pages describe what QA then sees") | E1537S5-80 to -85 on the CLI (the switch through `cland auth mode users`, the hub frame setup's step uses; setup then reads `ok`); setup's own switch through a scripted prompter and a headless passkey: E1537S5-16 and E1537S5-17; the switch through a scripted terminal is the epic's Definition of done (see "Out of scope") |
| Rule 15, the stage-3 corrections and stage-4 R-1 | E1537S5-04 (R-3/R-6 precheck with both controls, `inv.mjs`'s control), E1537S5-05 (bound counts with neighbouring controls), E1537S5-08 (R-4), E1537S5-83 (`inv.mjs` and `nolink.mjs`), E1537S5-85 (R-7), E1537S5-86 (R-5), E1537S5-90 and E1537S5-99 (R-1) |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1537 --json` lists in stage `the users stage`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit. A task closed `done` with no branch and no landing receipt must have no `Item:` trailer on dev (evidence-only completion; none in this stage). A dirty build, a missing required merge (**every member needs a landing here, T-1838 included**) or moved dev blocks this run: retain any collected evidence and report to the requester. The brief names no run id on purpose.

At dev `dfda10574cc9bc3d2dc764db1f161b0be209b88b` (VERIFIED): T-1836 landed as `d3a713025`, T-1837 as `01c97ad5b` and T-1835 as `5885fe1bf` (full SHAs under "Stage"), each with exactly one `Item:` and one `Reviewed-by:` trailer naming its final clear review; T-1838 had no landing yet. The plan read there showed the stage `open`, `items` `["T-1835","T-1836","T-1838","T-1837"]`, lanes `[["T-1835","T-1836","T-1838"],["T-1837"]]`, `merged 3`, `total 4`, `statuses {"done":3,"ready":1}`, cover `tree 5c3c237ee1b93d67f043b910a2e7c7281ab9238e`, `missing ["Linux droplet","macOS"]`; stages 1 to 4 read `closed`. At dev `84dcc428e52e993a390b95b16ca228cf77a00695` (VERIFIED): T-1860's non-member landing `72f26bc5c` and T-1838's landing `17ef83b96` (full SHA under "Stage"), with one `Item:` and one `Reviewed-by:` trailer, are on dev; the plan shows the stage `open`, the same items and lanes, `merged 4`, `total 4`, `statuses {"done":4}`, cover `tree 1f55f6f69ecc9ed5e98f10f87d0a062ef466c3dc`, `missing ["Linux droplet","macOS"]`; stages 1 to 4 `closed`. The request must name a dev SHA whose stage covers have finished (E1537S5-06).

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step. E1537S5-08 builds `web/dist` (R-4) for the Web cases and the scratch hub's web edge; the Web cases use the pinned Chrome Headless Shell under `node_modules/playwright-core/.local-browsers`, the Neovim case the pinned Neovim that `nvim/bin/nvim-path.ts` resolves (a linked worktree uses the main worktree's cache); no row needs the site's own `site/node_modules`.

**Where things live.** All scratch state is under `$Q` (`/private/tmp/q53-…`, realpath, 23 bytes; the stage-3 kit's seal accepts exactly this prefix) and `$T` (`/private/tmp/qa-e1533-s3-<uuid>`, the prefix the seal accepts). The scratch project is `$Q/p1`; `$Q/fh` (the seal's `CLAND_FAKE_HOST_ROOT`) is a symlink to it. The only paths under the repository are `$W` in `.cland/worktrees/` and the evidence `$EV` in `.cland/qa/E-1537/<run>/`, both ignored by Git; nothing is written to `.cland/tasks/` except through the verdict.

**Isolation (rule 15).** Every scratch command runs in the disposable project p1 with its own HOME, XDG directories and Git config, through the fresh seal; every Git call goes through `$Q/git0.mjs` (the one bootstrap call) or `$Q/git.mjs`. Never the live project's hub, config, roles, territory, `hub.db`, secrets or discovery, and never the human's HOME (`~/.cland`, `~/.ssh`, `~/.claude`, `~/.codex`, `~/.opencode`, `~/.local/state`, `~/.config/cland`). Never read or print a credential or an invite link. Never run `cland auth …`, `cland user …`, `cland login …`, `cland secret …`, `cland config set`, `cland role launch`, `cland setup`, `cland doctor`, `cland host …` or `cland hub …` against the live project. Two shells, never mixed: **QA's own shell** keeps QA's session identity (worktree, roots, `quiet`, the plan and item reads, the Git checks, every record); **every other command** runs through `$Q/fresh.mjs`.

**Removals.** Every `rm` names one literal path, written out in full after it was printed and checked; never a glob, a variable, a command substitution or `xargs` (the project's literal-rm hook refuses them).

### Environment

Put Node from `/Users/evgeniyivanov/.nvm/versions/node/v24.21.0/bin` first on `PATH` and check `node --version` against the qa skill's `node-engines.json` (`>=24.13.0 <25`). If TMPDIR is unset in QA's shell, export it to the value `getconf DARWIN_USER_TEMP_DIR` prints. In QA's own shell (bash):

```sh
R=/Users/evgeniyivanov/Projects/cland/v0
S=<dev SHA>                                    # the full dev SHA from the request
WROTE=84dcc428e52e993a390b95b16ca228cf77a00695 # the dev this brief was completed at (drafted at dfda10574; T-1860 filled at ef9f52fc9, T-1838 at 84dcc428e)
K=f43f4e21049e9c62a97c8dec1ebf37f9c7035a62     # the fixed kit commit (A-17643: pin a commit, never a blob)
M2=0d0618042fae7b76919d1be152e252b09e4a43ad    # the E-1535 stage-1 brief's carried corrections
M3=18911bda46c7c0dc332619e93d25041069d3704a    # the E-1535 stage-2 brief: its helpers and carried corrections
M4=85e60f6cb34ec320cc7a1f5456de3a4693acbe17    # the E-1535 stage-3 brief: landing, durdelta and carried corrections
M5=a72e34d9a83781f1ef7d87c273aaf5f281723046    # the E-1535 stage-4 brief's carried corrections
M6=d5c59e2c73b61f7e72e7a25b533f3945d2f1fcb0    # the E-1535 Definition-of-done brief's carried corrections
P1=628574fe8c2ed439e11461b6152175fcf4e9a2d3    # the E-1537 stage-1 brief as folded after its clear run: its carried corrections
P2=07035ec39329c513ce97d7114b385db29f3f99ce    # the E-1537 stage-2 brief (its only commit): its carried corrections and its git.mjs
P3=932f3018c335d620fc6afd268c5f9abb846c9d13    # the E-1537 stage-3 brief (its only commit, the stage-3 QA SHA): its carried corrections and its git.mjs
P4=881114bfdc1e75e1ec4fc5df8109e99b96357a81    # the E-1537 stage-4 brief (its only commit, the stage-4 QA SHA): its carried corrections, git.mjs and four helpers
RUN=qa-e1537s5-$(date +%F)-1                   # unique run id for E-1537; bump the suffix on a rerun
export QA_SESSION=${QA_SESSION:-${CLAND_SESSION_NAME:-}}
[ -n "$QA_SESSION" ] || echo "BLOCKED: no QA session name"
echo "QA shell credential-prefix names: $(env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|CODEX_API|CODEX_ACCESS|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)')"
W=$R/.cland/worktrees/qa-e1537s5-$RUN
EV=$R/.cland/qa/E-1537/$RUN
ST=$(cd "$(getconf DARWIN_USER_TEMP_DIR)" && pwd -P)
T=/private/tmp/qa-e1533-s3-$(uuidgen | tr 'A-Z' 'a-z'); mkdir -m 700 "$T"
Q=$(cd "$(mktemp -d /tmp/q53-XXXXXX)" && pwd -P); chmod 700 "$Q"
mkdir -p "$Q/home" "$Q/config" "$Q/opencode" "$Q/state" "$Q/cache" "$Q/claude" "$Q/codex" "$Q/fake-claude" "$Q/fake-codex" "$Q/fake-opencode" "$Q/executor-state" "$Q/p1" "$Q/bin" "$Q/kit"
ln -s "$Q/p1" "$Q/fh"                          # the fake-host root is the scratch project root
chmod 700 "$Q/claude" "$Q/fake-claude"
: > "$Q/pids"; : > "$Q/home/.gitconfig"; : > "$Q/home/.gitignore-global"
cat > "$Q/git0.mjs" <<'JS'
// bootstrap only: the one Git call before $W exists, under the same seal imported from the root checkout at dev (the stage-1 run's practice)
import { spawnSync } from 'node:child_process';
const [R, Q] = [process.env.QA_R0, process.env.QA_Q0];
const { fixtureEnvironment, scratchGitEnvironment } = await import(`${R}/test-support/fixture-environment.ts`);
const env = scratchGitEnvironment(Q, fixtureEnvironment(Q, process.env), { excludesFile: `${Q}/home/.gitignore-global` });
const p = spawnSync('git', process.argv.slice(2), { env, stdio: 'inherit' });
process.exit(p.status ?? 1);
JS
QA_R0=$R QA_Q0=$Q node "$Q/git0.mjs" -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
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
echo "git wrapper: $(type -t git); $(git -C "$W" rev-parse HEAD); fh is a link to p1: $([ -L "$Q/fh" ] && [ "$(cd "$Q/fh" && pwd -P)" = "$Q/p1" ] && echo yes || echo no)"
NV=$(cd "$W" && node nvim/bin/nvim-path.ts 2> /dev/null)
echo "pinned Neovim: $([ -x "${NV:-/nonexistent}" ] && echo executable || echo missing); pinned Headless Shell folders: $(ls -d "$W"/node_modules/playwright-core/.local-browsers/chromium_headless_shell-* 2> /dev/null | wc -l | tr -d ' ')"
carried() { git -C "$R" show "$1:qa/briefs/$2.md" | awk -v e="$5" '/^## Carried corrections/{f=1} $0==e{exit} f' > "$EV/carried-from-$3.md"; echo "$3 commit $(git -C "$R" rev-parse "$1^{commit}"); carried lines $(wc -l < "$EV/carried-from-$3.md" | tr -d ' ') want $4; sha1 $(shasum < "$EV/carried-from-$3.md" | cut -c1-40)"; }
carried "$P4" E-1537-stage-4 P4 63 '## Stage'; carried "$P3" E-1537-stage-3 P3 62 '## Stage'; carried "$P2" E-1537-stage-2 P2 55 '## Stage'; carried "$P1" E-1537-stage-1 P1 63 '## Stage'; carried "$M2" E-1535-stage-1 M2 127 '## Stage'; carried "$M3" E-1535-stage-2 M3 55 '## Stage'; carried "$M4" E-1535-stage-3 M4 80 '## Stage'; carried "$M5" E-1535-stage-4 M5 76 '## Stage'; carried "$M6" E-1535 M6 59 '## Build'
```

Expected: the worktree is added (`HEAD is now at …`); `git wrapper: function; <S>; fh is a link to p1: yes`; `pinned Neovim: executable; pinned Headless Shell folders: <n>` with `n` at least 1 (a missing Neovim or Headless Shell is a setup BLOCKED for E1537S5-13, -14 and -17; INFERRED from stage 1's clear run on the same files); the nine commits equal `P4`, `P3`, `P2`, `P1` and `M2` to `M6`; carried lines 63, 62, 55, 63, 127, 55, 80, 76 and 59; SHA-1s `002540c035b76c01d9dedf0cb7a497a0a3779fca`, `10f1860a8972e7a79209f5b9e8b33870fa130d41`, `6bcd1b899225aaad4379ecbd772ee66cf6fa7cdf`, `a9c55f181e9d43d438d23b087950630dec632359`, `98f38398667ed6b1192f2d9d20e131a30eb88bdc`, `51da4c95a6b8c380b7b11e4536c7d23f93986701`, `e4ad4448829797e25c364afad87b0f3f2cf3b06e`, `7555a12ef6902bbfe8dd2094d14e08d2ea93c61a` and `82535892ef7a00b2e4762a0d4515eebe1ca64a90` (all VERIFIED in bash at `dfda10574`). The bootstrap and Git wrappers are stage 4's text (`P4` lines 153 to 159 and 170 to 177); that the bootstrap reaches `git worktree add` with unchanged arguments is INFERRED from stages 1 to 4.

**The kits, from fixed commits.** A missing block or a SHA-1 other than `want` is a setup BLOCKED.

```sh
for b in E-1532-stage-4 E-1533-stage-3; do git -C "$R" show "$K:qa/briefs/$b.md" > "$Q/kit/$b.md"; done
git -C "$R" show "$M3:qa/briefs/E-1535-stage-2.md" > "$Q/kit/E-1535-stage-2.md"
git -C "$R" show "$M4:qa/briefs/E-1535-stage-3.md" > "$Q/kit/E-1535-stage-3.md"
git -C "$R" show "$P2:qa/briefs/E-1537-stage-2.md" > "$Q/kit/E-1537-stage-2.md"
git -C "$R" show "$P3:qa/briefs/E-1537-stage-3.md" > "$Q/kit/E-1537-stage-3.md"
git -C "$R" show "$P4:qa/briefs/E-1537-stage-4.md" > "$Q/kit/E-1537-stage-4.md"
kitr() { sed -n "$3" "$Q/kit/$1.md" > "$Q/$2.sh"; echo "$2: sha1 $(shasum < "$Q/$2.sh" | cut -c1-40) want $4"; }
kitb() { awk -v n="$2" 'BEGIN{h="cat > \"$Q/" n "\" <<"} index($0,h)==1{f=1} f{print} f&&/^(JS|SH|JSON)$/{exit}' "$Q/kit/$1.md"; }
kitr E-1532-stage-4 kit-shell '133,136p' 7f1efd434e4b03d68de661f7ca1afdd3c726c88d                  # holder, quiet, ld
kitr E-1532-stage-4 kit-tap '228,279p' bcd8eb8a9a2928f775e88807a5cb77aa0ed1fbc4                    # the tap.mjs heredoc
for n in seal.mjs fresh.mjs body.sh helpers.sh; do kitb E-1533-stage-3 "$n" > "$Q/kit3-$n.sh"; echo "kit3 $n: lines $(wc -l < "$Q/kit3-$n.sh" | tr -d ' ') sha1 $(shasum < "$Q/kit3-$n.sh" | cut -c1-40)"; done
for n in std.mjs invd.mjs; do kitb E-1535-stage-2 "$n" > "$Q/kit2-$n.sh"; echo "kit2 $n: lines $(wc -l < "$Q/kit2-$n.sh" | tr -d ' ') sha1 $(shasum < "$Q/kit2-$n.sh" | cut -c1-40)"; done
for n in pubw.mjs pubscan.mjs census4.mjs res.mjs; do kitb E-1537-stage-4 "$n" > "$Q/p4-$n.sh"; echo "p4 $n: lines $(wc -l < "$Q/p4-$n.sh" | tr -d ' ') sha1 $(shasum < "$Q/p4-$n.sh" | cut -c1-40)"; done
kitr E-1535-stage-2 kit2-fns '308,332p' 7d3265fb3617e213677b78ee5a78cb95aa12eae6                   # snapt, snaps, nt, slot, unslot, ns
kitr E-1535-stage-2 kit2-mrow '336,337p' 9f2fc5c7c2f7ba41f5fbec54a9db636cfe014e57                  # mrow
kitr E-1535-stage-2 kit2-s0 '345,347p' 6ec8beed74eb77e5f2620b034a1373099ab3e63e                    # the S0 environment probes
kitr E-1535-stage-2 kit2-checks '857,861p;870p;901,915p' eff5097fdb01c670d784454447777dd771be3dbd  # ownlines, s01 (its s99 is replaced below)
kitr E-1535-stage-3 kit3-checks '737p;743,745p;748,755p' 3a747a75f89dd49791888683cae6949c55dd9647  # landing, durdelta (its s00 is replaced below)
echo "git.mjs equals the stage-2 wrapper: $(sed -n '173,180p' "$Q/kit/E-1537-stage-2.md" | cmp -s - "$Q/git.mjs" && echo yes || echo no); the stage-3 wrapper: $(sed -n '174,181p' "$Q/kit/E-1537-stage-3.md" | cmp -s - "$Q/git.mjs" && echo yes || echo no); the stage-4 wrapper: $(sed -n '170,177p' "$Q/kit/E-1537-stage-4.md" | cmp -s - "$Q/git.mjs" && echo yes || echo no)"
. "$Q/kit-shell.sh"; . "$Q/kit-tap.sh"
for n in seal.mjs fresh.mjs body.sh helpers.sh; do . "$Q/kit3-$n.sh"; done; for n in std.mjs invd.mjs; do . "$Q/kit2-$n.sh"; done
for n in pubw.mjs pubscan.mjs census4.mjs res.mjs; do . "$Q/p4-$n.sh"; done
. "$Q/kit2-fns.sh"; . "$Q/kit2-mrow.sh"
node --check "$Q/tap.mjs" && node --check "$Q/seal.mjs" && node --check "$Q/fresh.mjs" && node --check "$Q/std.mjs" && node --check "$Q/invd.mjs" && node --check "$Q/git.mjs" && node --check "$Q/pubw.mjs" && node --check "$Q/pubscan.mjs" && node --check "$Q/census4.mjs" && node --check "$Q/res.mjs" && bash -n "$Q/body.sh" && bash -n "$Q/helpers.sh" && bash -n "$Q/kit2-checks.sh" && bash -n "$Q/kit3-checks.sh" && echo "kits checked"
. "$Q/kit2-s0.sh"
snaps "$EV/S0-inv"                              # the run-wide residue snapshot E1537S5-86 compares against (R-5)
```

Expected (every figure VERIFIED in bash at `dfda10574`; the commits are fixed): `kit-shell` and `kit-tap` each with `sha1` equal to `want`; `kit3 seal.mjs: lines 20 sha1 af271e579f596814e8aac1cd45aa499601716339`, `fresh.mjs: lines 42 sha1 9b30902c50cb2d8c0e3f1cf55794afb3f4fe3fb3`, `body.sh: lines 9 sha1 a116493f3e16eeae0ea45be73eae074a135f12c0`, `helpers.sh: lines 23 sha1 1605a54198b78a6587303c906f5ffca998d3cabc`; `kit2 std.mjs: lines 58 sha1 46256dc5346a0bf6202b40b7019cfd2e4d92fb10`, `invd.mjs: lines 25 sha1 c56924ca7fbc8d50f6408c24fa0a119b5b2ebeb2`; `p4 pubw.mjs: lines 19 sha1 69249021ad14549997f0e81b37e408c2c52f851b`, `pubscan.mjs: lines 14 sha1 e32fa0baa03a6a65bfe26035b8b1ca2183acda34`, `census4.mjs: lines 43 sha1 5f79812be68b30ddaaaeb10b25ec17664400fc2f`, `res.mjs: lines 31 sha1 e0b05b24dd6554b676deb3928630e96e5c65ab41`; every other `sha1` equal to its `want`; `git.mjs equals the stage-2 wrapper: yes; the stage-3 wrapper: yes; the stage-4 wrapper: yes`; `kits checked`; the S0 lines with both seals at `credential-prefix names 0`, `TMPDIR is T true`, `HOME is Q/home true`, `std` with the user HOME and system TMPDIR and `NODE_COMPILE_CACHE set false`, `Q bytes 23`, each redaction count 0. A `std: BLOCKED` line or a non-zero credential count stops the run (BLOCKED). `std.mjs` serves only the S0 probe here.

**This brief's own helpers.** The TAP expectations (R-2: `exact: true` lists every registration, expanded; `exact: false` with names requires them; with `[]` the whole file must be `CLEAN`), read at `dfda10574` and re-read at `84dcc428e`; T-1838's four site guard lists, the wrapper's and `users-docs-invite`'s read at its head and at its landing (byte-identical), found passing in A-19574 and, for the site guards, in its batch log A-19584.

```sh
cat > "$Q/expect.json" <<'JSON'
{
 "hub/test/doctor-users.test.ts": {"exact": true, "names": [
  "C1 doctor reports single mode from the running hub",
  "C2 doctor reads users counts from the hub and labels offline counts unknown",
  "doctor warns when config users disagrees with a running single-mode hub",
  "C3 doctor warns with invite fix when no active admin exists",
  "doctor reports hub not running for stale discovery with a live PID",
  "doctor keeps held live user counts unknown after timeout",
  "C4 doctor omits planted identity and credential material in text and JSON"]},
 "hub/test/cli-usage.test.ts": {"exact": true, "names": [
  "push help names the Coordinator, Aide and human as allowed callers"]},
 "hub/test/cli-usage-compatibility.test.ts": {"exact": true, "names": [
  "all command usage exports retain their pre-refactor bytes"]},
 "hub/test/launch-user.test.ts": {"exact": true, "names": [
  "Agents start lines name the recorded launching user and accept legacy records",
  "hub restart reads pre-attribution process and journal fixtures without a user",
  "launch attribution follows authenticated humans in single mode",
  "launch attribution follows authenticated humans in users mode"]},
 "web/test/sessions.test.ts": {"exact": true, "names": [
  "Sessions caps stopped rows at the latest twenty and reads merged archives with A",
  "Sessions groups count fake sessions and remember folds without hub requests",
  "Sessions remote host fact names its host with a tooltip on ground and selection",
  "Sessions renders deaf health and clears it after the next injection",
  "Sessions row names its launching user only in users mode",
  "Sessions rows render merged facts, holds, waiting detail and physical selection keys",
  "Sessions selected human wait names its topic and usage falls back to tokens",
  "gs from an item reveals its claimed session inside a folded group"]},
 "nvim/test/sessions.test.ts": {"exact": true, "names": [
  "recorded account pushes update weekly windows and preserve saved folds",
  "recorded deaf health renders while older session rows still render idle",
  "recorded hard-limit pushes show and clear account marks",
  "recorded host session names its host on row and selected meta; local omits it",
  "recorded session rows show verifier holds and retain claims after release",
  "recorded source windows preserve severity, local resets, stale age and wrapping",
  "remote state pushes render facts and failure highlights while old hubs keep the row hidden",
  "selected session metadata names the launching user and accepts legacy rows"]},
 "hub/test/nvim-fixture-boundary.test.ts": {"exact": true, "names": [
  "T2 Neovim import closures contain no hub runtime or harness",
  "a per-file catalog retains complete requested frames and refuses a missing recording",
  "a planted hub frame change fails recorder drift until the fixtures are rewritten",
  "a slice loads the committed catalog once for a recorded interleaving and still refuses unknown frames",
  "an unmatched recording names its operation and protocol request",
  "recordings bind transient paths and times while retaining their original wire values",
  "recordings match both macOS temp aliases for root and parent paths",
  "timestamp occurrences keep the same key across coincident and adjacent clock ticks"]},
 "hub/test/nvim-frame-refresh.test.ts": {"exact": true, "names": [
  "a recording consumer with no prior slice still refuses zero frames",
  "a skipped file or incomplete consumer test refuses publication even after another file completed",
  "complete concurrent targets publish despite scheduling-dependent slice and catalog frame counts",
  "empty consumer discovery refuses publication",
  "recording requires a successful complete test receipt",
  "unavailable binary skips abort the whole refresh before any fixture is replaced"]},
 "hub/test/skills-onboarding.test.ts": {"exact": true, "names": [
  "onboarding names only shipped commands or explicitly pending release work",
  "sessions page describes launching users and uses shipped commands",
  "the onboarding command check rejects unknown commands, config keys and secret names",
  "onboarding verification instructions are independent of npm",
  "the onboarding tour has ten stages ending with Look now",
  "onboarding records crew settings through commands",
  "onboarding stages explicit files and performs start and import without human keystrokes",
  "the onboarding Aide sets human epic plan approval through the config CLI",
  "the onboarding Aide records the stack verification commands verbatim through the config CLI",
  "the onboarding Aide records staffing through the crew CLI",
  "the onboarding Aide records launch fields through the role CLI",
  "the onboarding Aide own launch change returns the next-launch note",
  "the onboarding Aide launches the Coordinator with the first release brief through its own shell",
  "the onboarding Aide plans imported open GitHub issues in its first release",
  "remote tour explains voice notes and the hidden speech key command",
  "remote tour includes Discord setup and local approval with shipped commands"]},
 "hub/test/setup-signin.test.ts": {"exact": true, "names": [
  "C1 sign-in offer defaults No and yes skips with either terminal policy",
  "C2 C4 C5 confirmed switch prints the invite only to terminal and Enter leaves the exact command",
  "C4 nonterminal single mode skips with its command and a declined confirmation leaves single unchanged",
  "older injected hub metadata stays unknown without switching",
  "lost registration read stays open and joins the terminal reader"]},
 "web/test/setup-signin.test.ts": {"exact": true, "names": [
  "C3 setup completes after the first user registers a passkey on the invite page"]},
 "hub/test/setup-flow.test.ts": {"exact": true, "names": [
  "C1 agent hosts runs after remote steps and before the Aide",
  "Claude Code and Codex login inherit the launch profile unchanged",
  "Claude Code login uses a fresh check to decide done after the terminal command",
  "OpenCode login defaults to No and uses cland database after creating its folder",
  "a declined installer persists across setup runs until an explicit install",
  "a missing project stops setup before probing harnesses",
  "a signed-out login offers exactly one retry and the fresh result decides failure",
  "all steps ok exits zero and points to cland; installer folders explain PATH",
  "install rebuilds only the exact roles template for the installed set",
  "installing Codex uses the terminal runner and its re-check decides done or fail",
  "login commands preserve the probed executable for explicit harness overrides",
  "login probe errors retain their detail with the exact login command",
  "no installed harness makes every installer open; one installed makes missing ones skip",
  "nonterminal detection and --yes never install or record a decline",
  "setup keeps an installer open when a role requires the missing harness",
  "setup login requirements follow the project roles",
  "setup reports project, harnesses and installed logins in order without asking",
  "signed-out Codex unused by any role has only a skip line without a login offer",
  "the first installed harness makes missing alternatives optional in the final report",
  "without a terminal login reports exact commands without running even with yes",
  "yes in a terminal still asks the login question and a decline skips with the command"]},
 "hub/test/setup-hub.test.ts": {"exact": true, "names": [
  "a running Aide is reused; a stopped Aide resumes its conversation",
  "failures retain the startup log tail or equivalent session recovery command",
  "no-aide skips both steps; nonterminal policy permits only a yes hub start",
  "nonterminal setup detects a running hub and Aide without writes or launches",
  "project-kind classification excludes cland paths and macOS metadata",
  "starts the hub then launches the favourite with the exact empty-project onboarding brief",
  "the ordered setup flow reruns without starting another hub or Aide"]},
 "hub/test/setup-prompter.test.ts": {"exact": true, "names": [
  "a hidden question releases the terminal after cancel",
  "a hidden question releases the terminal after eof",
  "aborting a setup wait releases its reader before the next question",
  "choose accepts a number or value, defaults on Enter and repeats invalid answers",
  "confirm accepts yes or no, defaults on Enter and repeats invalid answers",
  "end of input cancels the active question and every later question",
  "pause waits for Enter without consuming the next reader's input",
  "secret questions hide input and release raw mode before the next question",
  "the fake prompter follows a question script through the common interface",
  "the fake prompter reports the text of an unexpected question"]},
 "hub/test/setup-cli.test.ts": {"exact": true, "names": [
  "setup --install codex runs without a terminal or question",
  "setup JSON explicit installer reserves stdout for its report",
  "setup JSON is one report on stdout with nonterminal narration on stderr",
  "setup executable JSON reports open installers without running any harness",
  "setup keeps the explicit root and rejects discovered parents or extra flags",
  "setup refuses HOME through the CLI and its usage appears in help",
  "setup retains the CLI root spelling for Codex trust"]},
 "hub/test/setup-remote-component.test.ts": {"exact": true, "names": [
  "Discord setup cancellation joins a held native application read before root cleanup",
  "Discord setup checks application before enabling and pairs through native /cland pair (repair=decline)",
  "Discord setup checks application before enabling and pairs through native /cland pair (repair=false)",
  "Discord setup checks application before enabling and pairs through native /cland pair (repair=true)",
  "Discord setup fixture joins hub and native close after aborted setup receipt",
  "Discord setup fixture joins hub and native close after omitted setup receipt",
  "terminal setup stores a hidden Telegram token, reloads through frames and reports pairing before the Aide"]},
 "hub/test/setup-remotes.test.ts": {"exact": false, "names": [
  "a terminal Telegram offer stores a hidden token and enables it without starting a hub under no-aide",
  "untouched nonterminal Telegram is skip with exact setup commands and no writes",
  "untouched nonterminal Discord is skip with Discord setup commands"]},
 "site/test/users-docs.test.ts": {"exact": true, "names": [
  "users guide is discoverable and covers the built sign-in workflow",
  "users vocabulary rejects invented commands flags and settings",
  "web multi-user section names built controls and shared attribution",
  "CLI Users and sign-in lists exactly the built usage subcommands",
  "users guide describes setup and doctor from their source declarations"]},
 "site/test/hosts-docs.test.ts": {"exact": true, "names": [
  "hosts vocabulary guard rejects invented command, flag and setting",
  "hosts guide is linked under Features and covers the built host and login workflow",
  "hosts guide quotes emitted waiting reasons and doctor/setup rows",
  "hosts guide defaults match the shared pool parser and slot policy",
  "hosts price table dates public pool rates and computes default host-hours",
  "hosts storage table matches provider declared GiB-month rates without native imports",
  "CLI Hosts and logins lists exactly the built usage subcommands"]},
 "site/test/onboarding-claims.test.ts": {"exact": true, "names": [
  "an unconditional Aide commit claim is detected",
  "current root Git write access qualifies only the Aide committing clause",
  "the site and docs agree on who commits the onboarding at the root"]},
 "site/test/remote-docs.test.ts": {"exact": true, "names": [
  "remote documentation guard rejects unknown commands, config keys and secret names",
  "remote guide and web Remotes section use shipped commands, config keys and secret names",
  "Remote control is under Features and linked from the overview and web Remotes section",
  "remote guide distinguishes missed cards from outage replacements after 150 seconds",
  "CLI reference lists exactly the remote and secret subcommands in usage",
  "remote media guide documents shipped speech and upload settings and exact data-use lines",
  "web guide names composer file attachments and inline image formats",
  "remote guide explains the setup speech offer and nonterminal command",
  "doctor guide names Discord fatal codes and local-only recovery instructions",
  "Discord setup guide names application checks, invite permissions and local pairing commands",
  "both public remote pages describe Discord media, voice and local diagnostics",
  "README remote commands describe the built-in Discord client and both setup offers",
  "documentation vocabulary guard rejects an invented command flag",
  "README public remote commands, settings, secrets and flags use shipped vocabulary",
  "chat guide distinguishes Telegram typed ask answers from Discord topic replies",
  "landing feature names both shipped remotes and links their guide",
  "README feature names both shipped remotes and links their guide",
  "Features entry names both shipped remotes and links their guide",
  "landing shows all eleven features in the chosen order without carousel controls",
  "feature cards keep anchors and only number, title, text and docs link in a responsive grid",
  "feature link clicks use GoatCounter feature ids and privacy wording includes clicks",
  "every landing feature points to an existing documentation page"]},
 "hub/test/remote-docs.test.ts": {"exact": true, "names": [
  "an unconditional Aide commit claim is detected",
  "current root Git write access qualifies only the Aide committing clause",
  "the site and docs agree on who commits the onboarding at the root",
  "hosts vocabulary guard rejects invented command, flag and setting",
  "hosts guide is linked under Features and covers the built host and login workflow",
  "hosts guide quotes emitted waiting reasons and doctor/setup rows",
  "hosts guide defaults match the shared pool parser and slot policy",
  "hosts price table dates public pool rates and computes default host-hours",
  "hosts storage table matches provider declared GiB-month rates without native imports",
  "CLI Hosts and logins lists exactly the built usage subcommands",
  "users guide is discoverable and covers the built sign-in workflow",
  "users vocabulary rejects invented commands flags and settings",
  "web multi-user section names built controls and shared attribution",
  "CLI Users and sign-in lists exactly the built usage subcommands",
  "users guide describes setup and doctor from their source declarations",
  "remote documentation guard rejects unknown commands, config keys and secret names",
  "remote guide and web Remotes section use shipped commands, config keys and secret names",
  "Remote control is under Features and linked from the overview and web Remotes section",
  "remote guide distinguishes missed cards from outage replacements after 150 seconds",
  "CLI reference lists exactly the remote and secret subcommands in usage",
  "remote media guide documents shipped speech and upload settings and exact data-use lines",
  "web guide names composer file attachments and inline image formats",
  "remote guide explains the setup speech offer and nonterminal command",
  "doctor guide names Discord fatal codes and local-only recovery instructions",
  "Discord setup guide names application checks, invite permissions and local pairing commands",
  "both public remote pages describe Discord media, voice and local diagnostics",
  "README remote commands describe the built-in Discord client and both setup offers",
  "documentation vocabulary guard rejects an invented command flag",
  "README public remote commands, settings, secrets and flags use shipped vocabulary",
  "chat guide distinguishes Telegram typed ask answers from Discord topic replies",
  "landing feature names both shipped remotes and links their guide",
  "README feature names both shipped remotes and links their guide",
  "Features entry names both shipped remotes and links their guide",
  "landing shows all eleven features in the chosen order without carousel controls",
  "feature cards keep anchors and only number, title, text and docs link in a responsive grid",
  "feature link clicks use GoatCounter feature ids and privacy wording includes clicks",
  "every landing feature points to an existing documentation page",
  "site vocabulary extraction matches the runtime config and secret names"]},
 "hub/test/users-docs-invite.test.ts": {"exact": true, "names": [
  "published users commands switch a single project and renew the second user invite privately"]},
 "hub/test/suite-task-selection.test.ts": {"exact": false, "names": [
  "mode-free docs and site selections include every site prebuild guard"]},
 "hub/test/test-docs.test.ts": {"exact": false, "names": []},
 "hub/test/suite-tiers.test.ts": {"exact": false, "names": []}
}
JSON
node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("expect checked: files "+Object.keys(v).length+"; exact lists "+Object.values(v).filter(x=>x.exact).map(x=>x.names.length).join(" "))' "$Q/expect.json"
```

The source checks (`src.mjs`), counted with `String.split` on the files of the worktree it is given (it calls no Git). At `84dcc428e` all 94 read `ok`: T-1836's 15, T-1837's 17, T-1835's 21, the 7 scratch facts and T-1838's 34 (VERIFIED over a `git archive` of `84dcc428e`; before T-1838 landed, the first 60 read `ok` at `dfda10574` and `ef9f52fc9` and T-1838's 34 over its head; over T-1806's head the same 60 read `ok`). At the build every line must read `ok`.

```sh
cat > "$Q/src.mjs" <<'JS'
// node "$Q/src.mjs" <W>   ok, MISMATCH or MISSING per line; counts use String.split on the worktree's files; no Git, no hub
// R-1 (stage 4): a docs probe that counts binds to its section heading first; each bound line names its heading in the needle
import { readFileSync, existsSync } from 'node:fs';
const [W] = process.argv.slice(2);
const read = f => existsSync(`${W}/${f}`) ? readFileSync(`${W}/${f}`, 'utf8') : null;
const part = (...p) => p.join('');   // spellings that qa lint or the publication policy would read as a test path or a one-use link
const DU = 'hub/src/doctor/users.ts', CD = 'hub/src/cli/doctor.ts', UD = 'hub/src/cli/usage/doctor.ts', DOCD = 'docs/hub/cland-doctor.md';
const SI = 'hub/src/setup/steps/signin.ts', RU = 'hub/src/setup/runner.ts', SH = 'hub/src/setup/hub.ts', US = 'hub/src/cli/usage/setup.ts', SETD = 'docs/hub/cland-setup.md';
const DAE = 'hub/src/hub/daemon.ts', USR = 'hub/src/hub/users.ts', WE = 'hub/src/hub/web-edge.ts', AUTH = 'hub/src/cli/auth.ts', AU = 'hub/src/cli/usage/auth.ts';
const SS = 'hub/src/adapters/sessions.ts', PR = 'hub/src/adapters/processes.ts', AT = 'hub/src/hub/agents-topic.ts', DI = 'hub/src/hub/dispatch.ts', PROTO = 'hub/src/protocol.ts', WIRE = 'shared/wire/index.ts';
const SR = 'web/src/sessions/SessionRow.tsx', PL = 'nvim/lua/cland/panels.lua', NS = 'nvim/lua/cland/state.lua', SM = 'site/src/content/docs/docs/sessions.mdx';
const SOT = part('hub/test/skills-onboarding', '.test', '.ts'), ADS = 'docs/hub/adapters-and-sessions.md';
const UP = 'site/src/content/docs/docs/users.md', WP = 'site/src/content/docs/docs/web-and-phone.mdx', CLI = 'site/src/content/docs/docs/cli.md', AC = 'site/astro.config.mjs', FE = 'site/src/content/docs/docs/features.md';
const UDS = 'site/test/users-docs-source.ts', RDW = part('hub/test/remote-docs', '.test', '.ts'), TI = 'hub/test/tiers.json', IX = 'docs/agents/tests/index.md';
const C = [
  // T-1836 (doctor's sign-in mode line), landed d3a713025
  ['T-1836 C1 doctor adds the users check right after the hosts block', CD, '...await checkHosts(root, env), ...await checkUsers(root, env), ...keys,', '=1'],
  ['T-1836 the check is named sign-in mode', DU, "const name = 'sign-in mode';", '=1'],
  ['T-1836 decision: the mode is read from config, always', DU, 'mode = (text === null ? defaultConfig(basename(root)) : parseConfig(text, basename(root), env)).auth.mode;', '=1'],
  ['T-1836 C1 single mode is ok single and asks the hub nothing', DU, "if (mode === 'single') return [ok(name, 'single')];", '=1'],
  ['T-1836 C2 without a live hub: hub not running with cland hub start', DU, "if (!discovery || (!discovery.remote && !pidAlive(discovery.pid))) return [warn(name, 'users; counts: hub not running', 'cland hub start')];", '=1'],
  ['T-1836 decision: user.list is asked only for the counts', DU, "await askHubFrame(discovery, { type: 'user.list' }, 3000, env, clock)", '=1'],
  ['T-1836 C2 the counts detail', DU, "const detail = `users; ${counts.join(', ')}; ${admins} admins (${activeAdmins} active)`;", '=1'],
  ['T-1836 C3 no active admin warns with cland user invite <name>', DU, "return [activeAdmins ? ok(name, detail) : warn(name, detail, 'cland user invite <name>')];", '=1'],
  ['T-1836 decision: a refused user.list warns with cland hub reload', DU, "return [warn(name, \"users; running hub doesn't report users mode\", 'cland hub reload')];", '=1'],
  ['T-1836 a timeout warns with cland hub reload', DU, "if (error instanceof HubTimeout) return [warn(name, 'users; counts unavailable (hub did not answer)', 'cland hub reload')];", '=1'],
  ['T-1836 decision: no error-string parsing (no .message read)', DU, '.message', '=0'],
  ['T-1836 C4 only the known state labels reach the output', DU, "const known = ['active', 'invited'];", '=1'],
  ['T-1836 C4 no user name is read into the output (no .name read)', DU, '.name', '=0'],
  ['T-1836 the doctor help line', UD, 'sign-in mode: config single/users; hub user counts and admins; no active admin: cland user invite <name>', '=1'],
  ['T-1836 the doctor guide example', DOCD, '`users; 1 active, 1 invited; 2 admins (1 active)`', '=1'],
  // T-1837 (the launching user on session rows and Agents start lines), landed 01c97ad5b
  ['T-1837 C1 the process row gains user_id', PR, "if (!columns.has('user_id')) this.#db.exec('alter table harness_processes add column user_id text');", '=1'],
  ['T-1837 C1 the process row stores the user id', PR, "this.#db.prepare('update harness_processes set user_id=? where name=?').run(p.userId ?? null, p.name);", '=1'],
  ['T-1837 C4 a row without user_id reads without a user', PR, '...(r.user_id ? { userId: String(r.user_id) } : {}),', '=1'],
  ['T-1837 C1 a human launch carries the acting user; a relaunch takes none from the frame', DI, 'original ? undefined : humanUser(frame)?.id,', '=1'],
  ['T-1837 single mode projects no launching user', SS, "if (this.#core.store.users.mode() !== 'users' || !p.userId) return {};", '=1'],
  ['T-1837 C1 the session-launched record carries the user', SS, "this.#log({ event: 'session-launched', ...this.#launchUser(p),", '=1'],
  ['T-1837 C1 a resumed launch record keeps the user', SS, "this.#log({ event: 'session-launched', ...this.#launchUser(process),", '=1'],
  ['T-1837 C2 the Agents start line names the user', AT, "${str(entry.userDisplayName) ? ` by ${String(entry.userDisplayName)}` : ''}", '=1'],
  ['T-1837 C3 the web session row names the user', SR, '{row.userDisplayName && <span data-launch-user title="User who launched the session">by {row.userDisplayName}</span>}', '=1'],
  ['T-1837 C3 Neovim selected meta names the user', PL, "if type(s.userDisplayName) == 'string' and s.userDisplayName ~= '' then head[#head + 1] = 'by ' .. s.userDisplayName end", '=1'],
  ['T-1837 C3 Neovim state carries the field', NS, 'userDisplayName = p.userDisplayName,', '=1'],
  ['T-1837 the hub wire view gains the optional fields', PROTO, 'export type HarnessProcessView = {\n  userId?: string;\n  userDisplayName?: string;', '=1'],
  ['T-1837 the shared wire view gains the optional fields', WIRE, 'export type HarnessProcessView = {\n  userId?: string;\n  userDisplayName?: string;', '=1'],
  ['T-1837 C5 the sessions page sentence, bound to its heading', SM, '## The sessions panel\n\nIn users mode, session rows and the Agents start line name the user who launched the session; launches by agents and older records have no launching user.\n', '=1'],
  ['T-1837 C5 the sentence appears once on the page', SM, 'name the user who launched the session', '=1'],
  ['T-1837 C5 the onboarding test asserts the sentence', SOT, 'assert.match(markdown, /In users mode, session rows and the Agents start line name the user who launched the session/);', '=1'],
  ['T-1837 the sessions guide paragraph', ADS, 'Web launches use the authenticated user and local CLI launches use the first\nuser. Agent launches and pre-attribution rows have no launching user.', '=1'],
  // T-1835 (setup's sign-in mode step), landed 5885fe1bf; the order includes the sign-in step (stage 4's order needle is historical)
  ['T-1835 C1 setup order: hub, sign-in mode, remotes, discord, speech, agent hosts, aide', RU, 'const STEPS: readonly SetupStep[] = [project, harnesses, logins, accounts, favourite, trust, hub, signin, remotes, discord, speech, hosts, aide];', '=1'],
  ['T-1835 setup exit: any open or fail row makes it 1', RU, 'const incomplete = cancelled || summary.open > 0 || summary.fail > 0;', '=1'],
  ['T-1835 the step is named sign-in mode', SI, "const name = 'sign-in mode';", '=1'],
  ['T-1835 C4 the fix is cland auth mode users', SI, "fix: 'cland auth mode users' };", '=1'],
  ['T-1835 no hub answer: skip under --yes or --no-aide, otherwise open', SI, "catch { return o.yes || o.noAide ? [{ name, verdict: 'skip', detail: 'single mode default; detect when the hub is available' }] : [open]; }", '=1'],
  ['T-1835 C5 users mode reads ok with its user count and asks nothing', SI, "if (status.mode === 'users') return [{ name, verdict: 'ok', detail: `users mode; ${status.users.length} users` }];", '=1'],
  ['T-1835 C1 --yes keeps single mode: skip', SI, "if (o.yes) return [{ name, verdict: 'skip', detail: 'single mode' }];", '=1'],
  ['T-1835 C4 (amended) no terminal, single mode: skip with the fix, nothing changed', SI, "if (!o.interactive) return [{ name, verdict: 'skip', detail: 'single mode', fix: open.fix }];", '=1'],
  ['T-1835 C1 the offer defaults to No', SI, "if (!await o.prompter.confirm('Let several people sign in to the web (users mode)?', false)) return [{ name, verdict: 'skip', detail: 'single mode' }];", '=1'],
  ['T-1835 C2 the confirmation names browser sign-out and cland auth reset', SI, "'Switching signs out the current browser sessions; cland auth reset is the only way back. Continue?'", '=1'],
  ['T-1835 C2 the invite goes only to the terminal narration', SI, 'o.narrate(`${invited.user.name}\\n${invited.url}\\n`);', '=1'],
  ['T-1835 C4 skipping the wait: open with cland user invite <name>', SI, "fix: `cland user invite ${invited.user.name}` };", '=1'],
  ['T-1835 C3 a registered passkey ends done', SI, "[{ name, verdict: 'done', detail: `users mode; ${invited.user.name} passkey registered` }]", '=1'],
  ['T-1835 C2 the switch goes through the hub as cland auth mode users does', SH, "signinUsers: async () => await request({ type: 'auth.mode', mode: 'users' }, 60_000)", '=1'],
  ['T-1835 the step reads users with setup metadata', SH, "signinStatus: async () => await request({ type: 'user.list', setup: true })", '=1'],
  ['T-1835 setup metadata answers in either mode', DAE, 'if (setup === true) return { mode: store.users.mode(), users: store.users.list().map(user => ({ ...user, passkeyRegistered: store.users.passkeys(user.id).length > 0 })) };', '=1'],
  ['T-1835 C2 the first user comes from Git user.name', DAE, "(await (options.git ?? gitIn(root, env))(['config', 'user.name'])", '=1'],
  ['T-1835 setup help: the sign-in line', US, 'sign-in mode follows the hub: default No; --yes skips; nonterminal skip: cland auth mode users', '=1'],
  ['T-1835 setup help: the confirmation line', US, 'users confirmation names browser sign-out and cland auth reset; Enter skips the first passkey wait', '=1'],
  ['T-1835 setup help: the invite line', US, 'invite appears only in the terminal; existing users mode reports its user count', '=1'],
  ['T-1835 setup guide: the no-terminal sentence', SETD, 'Without a terminal and without `--yes`, it reports `skip` with\n`cland auth mode users`.', '=1'],
  // the users mode the scratch rows reach (unedited in the stage; read as built)
  ['scratch: the first admin is created active', USR, "const user: User = { id: randomUUID(), name, displayName, role: 'admin', state: 'active', created: now };", '=1'],
  ['scratch: user add creates an invited admin', USR, "const user: User = { id: randomUUID(), name, displayName, role: 'admin', state: 'invited', created: now };", '=1'],
  ['scratch: a user without a display name shows its name', DAE, 'const user = store.users.add(name, displayName ?? name,', '=1'],
  ['scratch: the invite is a one-use link on the web edge', WE, part('return { url: `${base}/invite?', 'tok', 'en=${options.store.users.mintInvite(userId, clock.now().getTime())}` };'), '=1'],
  ['scratch: cland auth mode users prints name and role, then the link', AUTH, 'process.stdout.write(`${user.name}  ${user.role}\\n`);', '=1'],
  ['scratch: cland auth reset prints the mode', AUTH, "process.stdout.write('Sign-in mode: single\\n');", '=1'],
  ['scratch: auth and user help', AU, '  auth mode users  switch sign-in mode and print the first user', '=1'],
  // T-1838 (the users and sign-in modes page, the multi-user section, the CLI reference), landed 17ef83b96 (byte-identical to its reviewed head a15551d77)
  ['T-1838 C1 the page is in the Features group after Web and phone', AC, "group('Features', [\n    ['Overview', 'docs/features'],\n    ['Items and the tracker', 'docs/items'],\n    ['Topics and the inbox', 'docs/topics'],\n    ['Sessions and harness access', 'docs/sessions'],\n    ['Accounts and limits', 'docs/accounts'],\n    ['Hosts, pools and logins', 'docs/hosts'],\n    ['Verification and release', 'docs/verification-and-release'],\n    ['Web and phone', 'docs/web-and-phone'],\n    ['Users and sign-in modes', 'docs/users'],\n", '=1'],
  ['T-1838 C1 the overview links it, bound to its section', FE, '## Where you work\n\n- **[Users and sign-in modes](/docs/users/).**', '=1'],
  ['T-1838 C1 the overview links it once', FE, '](/docs/users/)', '=1'],
  ['T-1838 C1 the page title', UP, '\ntitle: Users and sign-in modes\n', '=1'],
  ['T-1838 C1 the page has eight sections', UP, '\n## ', '=8'],
  ['T-1838 C1 section The two modes', UP, '\n## The two modes\n', '=1'],
  ['T-1838 C1 section Switching and reset', UP, '\n## Switching and reset\n', '=1'],
  ['T-1838 C1 section Users and invites', UP, '\n## Users and invites\n', '=1'],
  ['T-1838 C1 section Passkeys and passwords', UP, '\n## Passkeys and passwords\n', '=1'],
  ['T-1838 C1 section Attribution with --as', UP, '\n## Attribution with --as\n', '=1'],
  ['T-1838 C1 section Remotes in users mode', UP, '\n## Remotes in users mode\n', '=1'],
  ['T-1838 C1 section Setup and doctor', UP, '\n## Setup and doctor\n', '=1'],
  ['T-1838 C1 section Deferred', UP, '\n## Deferred\n', '=1'],
  ['T-1838 C1 setup order on the page includes the sign-in step', UP, '`cland setup` puts **sign-in mode** after the hub and before remotes.', '=1'],
  ['T-1838 C1 setup without a terminal on the page (T-1835 C4 as amended)', UP, "Without a terminal and without `--yes`, single mode also reads `skip`, with\n`cland auth mode users` as the fix, preserving unattended setup's exit status.", '=1'],
  ['T-1838 C1 setup in users mode on the page', UP, 'Already in users mode, the row reads `ok` with its user count.', '=1'],
  ['T-1838 C1 doctor reads the mode from config on the page (the decision)', UP, '`cland doctor` reads **sign-in mode** from project config.', '=1'],
  ['T-1838 C1 doctor refusal guidance on the page (the decision)', UP, 'If the running hub refuses the users query, counts\nstay unavailable and it suggests `cland hub reload`.', '=1'],
  ['T-1838 C1 doctor without a hub on the page', UP, 'Without a hub it says\n`hub not running` and suggests `cland hub start`.', '=1'],
  ['T-1838 C1 the launching user on the page (T-1837)', UP, 'In users mode, session rows and the Agents start line also show the\nlaunching user.', '=1'],
  ['T-1838 C3 two marked blocks', UP, '```sh users-invite\n', '=2'],
  ['T-1838 C3 the first block switches the mode', UP, '```sh users-invite\ncland auth mode users\n```', '=1'],
  ['T-1838 C3 the second block adds, lists and invites', UP, '```sh users-invite\ncland user add teammate\ncland user list\ncland user invite teammate\n```', '=1'],
  ['T-1838 C3 the page prints no working link, only a placeholder', UP, '`<one-time invite link>`; this placeholder is not a\nworking credential.', '=1'],
  ['T-1838 C3 the shared marked-block parser', UDS, 'return [...text.matchAll(/```sh users-invite\\n([\\s\\S]*?)\\n```/g)]', '=1'],
  ['T-1838 C4 the multi-user section heading', WP, '\n## Multi-user sign-in\n', '=1'],
  ['T-1838 C4 the section links the users page', WP, 'See [Users and sign-in modes](/docs/users/) to switch modes and invite people.', '=1'],
  ['T-1838 C4 one inbox for everyone', WP, 'There is one inbox for everyone: the first answer from any workbench or paired\nremote wins.', '=1'],
  ['T-1838 C4 the users page links back to the section', UP, '(/docs/web-and-phone/#multi-user-sign-in)', '=1'],
  ['T-1838 C5 the CLI reference section', CLI, '\n## Users and sign-in\n\nSee [Users and sign-in modes](/docs/users/) for the walkthrough.', '=1'],
  ['T-1838 C5 the section comes right before Hosts and logins', CLI, '12 characters in the browser.\n\n## Hosts and logins\n', '=1'],
  ['T-1838 the T1 wrapper imports the users guard', RDW, part("import '../../site/test/users-docs", '.test', ".ts';"), '=1'],
  ['T-1838 the T2 file has its tier', TI, part('"hub/test/users-docs-invite', '.test', '.ts": "T2",'), '=1'],
  ['T-1838 the T2 file has its index row', IX, part('| [`hub/test/users-docs-invite', '.test', '.ts`](../../../hub/test/users-docs-invite', '.test', '.ts) |'), '=1'],
];
for (const [label, file, text, e] of C) {
  const t = read(file), n = t === null ? 'MISSING' : t.split(text).length - 1;
  const pass = t !== null && (e.startsWith('>=') ? n >= Number(e.slice(2)) : n === Number(e.slice(1)));
  console.log(`${pass ? 'ok' : t === null ? 'MISSING' : 'MISMATCH'} ${label} | ${file} | ${n} | ${e}`);
}
JS
cat > "$Q/ids.mjs" <<'JS'
// node "$Q/ids.mjs" <brief>   every E1537S5-NN the criteria map names exists as a row; the landing markers left open (spelled in parts, so this script holds none)
import { readFileSync } from 'node:fs';
const t = readFileSync(process.argv[2], 'utf8'), map = t.slice(t.indexOf('### Criteria map'), t.indexOf('\n## Build'));
const named = new Set(map.match(/E1537S5-\d+/g) ?? []), rows = new Set([...t.matchAll(/^\| (E1537S5-\d+) \|/gm)].map(m => m[1]));
const missing = [...named].filter(id => !rows.has(id)), mark = id => ['TO', 'DO(', id, ')'].join('');
console.log(`criteria-map ids ${named.size}; table rows ${rows.size}; missing from the tables: ${missing.length}${missing.length ? ' ' + missing.join(' ') : ''}`);
console.log(`open T-1838 markers: ${t.split(mark('T-1838')).length - 1}; open T-1860 markers: ${t.split(mark('T-1860')).length - 1}`);
JS
cat > "$Q/pub.mjs" <<'JS'
// node "$Q/pub.mjs" <W> <expect.json> <brief>   R-3/R-6 precheck: every expected title and every line of the brief (its fixed helper lines included)
// through the unchanged publication policy, plus the lines holding a fragment that a runtime value could turn into a refusal.
// Two positive controls are built in memory and never printed or written: an authorization-header credential and a one-use invite link.
import { readFileSync } from 'node:fs';
const [W, ex, brief] = process.argv.slice(2);
const { assertPublishable } = await import(`${W}/.agents/skills/qa/qa-demo-policy.ts`);
const refused = s => { try { assertPublishable(s); return false; } catch { return true; } };
const titles = Object.values(JSON.parse(readFileSync(ex, 'utf8'))).flatMap(v => v.names);
const lines = readFileSync(brief, 'utf8').split('\n');
const joinable = /(?:\b(?:token|access_token|api_key)=|\bbearer\s|[a-z0-9_](?:token|api_key|secret_access_key)["']?\s*[:=])/i;
const header = ['Bear', 'er ', 'q'.repeat(24)].join(''), invite = ['http://127.0.0.1:9/invite?', 'tok', 'en=', 'q'.repeat(64)].join('');
console.log(`expected titles ${titles.length}; refused ${titles.filter(refused).length}`);
console.log(`brief lines ${lines.length}; refused ${lines.filter(refused).length}; with a joinable fragment ${lines.filter(l => joinable.test(l)).length}`);
console.log(`positive control (authorization header) refused: ${refused(header)}; positive control (one-use invite link) refused: ${refused(invite)}`);
for (const [i, l] of lines.entries()) if (refused(l) || joinable.test(l)) console.log(`  brief line ${i + 1}: ${refused(l) ? 'refused' : 'joinable fragment'}`);
for (const t of titles.filter(refused)) console.log(`  refused title (length ${t.length})`);
JS
cat > "$Q/inv.mjs" <<'JS'
// <invite-bearing output> | node "$QA_Q/inv.mjs" <label>   one-use links withheld before any line is printed (rule 15, this stage's credential rule)
// First a planted positive control, built in memory and never printed: refused raw by the unchanged publication policy, publishable once redacted,
// its value gone. A failed control prints BLOCKED and reads nothing (exit 2). Then every line: each link replaced by a fixed placeholder, the line
// passed through the policy again (a still-refused line is withheld), printed indented. Counts only; never a link, a value or its length.
import { readFileSync } from 'node:fs';
const s = JSON.parse(readFileSync(`${process.env.QA_Q}/state.json`, 'utf8'));
const { assertPublishable } = await import(`${s.W}/.agents/skills/qa/qa-demo-policy.ts`);
const refused = t => { try { assertPublishable(t); return false; } catch { return true; } };
const key = ['tok', 'en'].join(''), label = process.argv[2] ?? 'output';
const link = new RegExp(`(?:https?://[^\\s"'<>/]+)?/invite\\?${key}=[^\\s&"'<>]+`, 'g');
const redact = t => t.replace(link, '<one-time invite link withheld>');
const value = 'q'.repeat(64), planted = `http://127.0.0.1:9/invite?${key}=${value}`;
const raw = refused(planted), clean = !refused(redact(planted)), gone = !redact(planted).includes(value);
console.log(`# inv ${label}: positive control refused raw ${raw}; publishable after redaction ${clean}; value removed ${gone}`);
if (!(raw && clean && gone)) { console.log(`# inv ${label}: BLOCKED: the redactor failed its positive control; nothing read`); process.exit(2); }
let input = ''; process.stdin.setEncoding('utf8'); for await (const c of process.stdin) input += c;
let links = 0, withheld = 0;
const lines = input.replace(/\n$/, '').split('\n').map(line => {
  links += (line.match(link) ?? []).length;
  let out = redact(line);
  if (refused(out)) { withheld++; out = '# inv: line withheld by the publication scan'; }
  return out;
});
for (const l of lines) console.log(`    ${l}`);
console.log(`# inv ${label}: links withheld ${links}; other lines withheld ${withheld}`);
JS
cat > "$Q/nolink.mjs" <<'JS'
// { <invite-bearing output>; echo '#--captured--'; <other captured output>; } | node "$QA_Q/nolink.mjs" <dir>…   inside fresh.mjs (hub mode), cwd p1
// T-1835 C5 and T-1836 C4 on the scratch hub: every invite value read from memory is looked for in every regular file under each <dir>
// (the database files hub.db, hub.db-wal and hub.db-shm are skipped and never opened) and in the captured doctor, setup and list output.
// A positive control first plants the first value in an in-memory copy and must find it. Counts only; never a value, a link or a length.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
let input = ''; process.stdin.setEncoding('utf8'); for await (const c of process.stdin) input += c;
const [invites, captured = ''] = input.split('\n#--captured--\n');
const key = ['tok', 'en'].join('');
const values = [...invites.matchAll(new RegExp(`/invite\\?${key}=([^\\s&"'<>]+)`, 'g'))].map(m => m[1]);
const distinct = [...new Set(values)];
const files = [];
const walk = d => { let es = []; try { es = readdirSync(d, { withFileTypes: true }); } catch { return; } for (const e of es) { const f = join(d, e.name); if (e.isSymbolicLink()) continue; if (e.isDirectory()) walk(f); else if (e.isFile() && !/^hub\.db(?:-wal|-shm)?$/.test(e.name)) files.push(f); } };
for (const d of process.argv.slice(2)) walk(d);
const count = (text, v) => text.split(v).length - 1;
let inFiles = 0, inCaptured = 0;
for (const f of files) { let t = ''; try { t = readFileSync(f, 'latin1'); } catch { continue; } for (const v of distinct) inFiles += count(t, v); }
for (const v of distinct) inCaptured += count(captured, v);
const control = distinct.length ? count(`${captured}\n${distinct[0]}\n`, distinct[0]) === inCaptured + 1 : false;
console.log(`invite values in memory ${values.length}; distinct ${distinct.length}; files scanned ${files.length} (database files skipped); occurrences in files ${inFiles}; occurrences in the captured doctor, setup and list output ${inCaptured}; positive control found ${control}`);
JS
cat > "$Q/voc.mjs" <<'JS'
// node "$QA_Q/voc.mjs" <W>   inside fresh.mjs (plain): the stage's docs against the built CLI's help and the source they describe; nothing is written
// Every help is the built CLI answering `cland <command> --help` in a child sealed by seal() (R-1). Every docs count binds to its section heading
// first, with a neighbouring section of the same shape as a negative control (stage-4 R-1). T-1838's lines read the pages it landed (17ef83b96).
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const W = process.argv[2], q = process.env.QA_Q;
const { seal } = await import(`${q}/seal.mjs`);
const read = f => existsSync(`${W}/${f}`) ? readFileSync(`${W}/${f}`, 'utf8') : '';
const section = (text, heading) => new RegExp(`^## ${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm').exec(text)?.[1] ?? '';
const helps = new Map();
const help = a => {
  if (!helps.has(a)) { const r = spawnSync(process.execPath, [`${W}/hub/bin/cland.ts`, a, '--help'], { cwd: q, env: seal(), encoding: 'utf8', timeout: 60000 }); helps.set(a, { code: r.status, text: `${r.stdout ?? ''}${r.stderr ?? ''}` }); }
  return helps.get(a);
};
const cmds = t => [...new Set([...t.matchAll(/`(cland [^`\n]+)`/g)].map(m => m[1]).concat([...t.matchAll(/^cland [^\n]+/gm)].map(m => m[0])))];
const check = (label, text) => {
  const list = cmds(text); let bad = 0;
  for (const c of list) {
    const w = c.slice(6).split(/\s+/), a = w[0], b = w[1], h = help(a), lines = h.text.split('\n').map(l => l.trim());
    const sub = b && !b.startsWith('-') && !b.startsWith('<') ? b : null;
    const known = h.code === 0 && (sub ? lines.some(l => l === `${a} ${sub}` || l.startsWith(`${a} ${sub} `)) : lines.some(l => l === a || l.startsWith(`${a} `)));
    const badFlags = w.filter(x => x.startsWith('--')).filter(f => !new RegExp(`${f}(?![a-z-])`).test(h.text));
    if (!known || badFlags.length) { bad++; console.log(`  ${label}: not in the built help: ${c}${badFlags.length ? `; flags ${badFlags.join(' ')}` : ''}`); }
  }
  console.log(`${label}: distinct cland commands ${list.length}; not in the built help ${bad}`);
};
const UP = read('site/src/content/docs/docs/users.md'), WPF = read('site/src/content/docs/docs/web-and-phone.mdx');
// T-1838 C2: the users page and the web-and-phone multi-user section (bound to its heading) against the built help
check('users page', UP);
const multi = section(WPF, 'Multi-user sign-in');
check('web-and-phone Multi-user sign-in', multi);
{ const invented = ['inv', 'ented'].join(''), h = help('user'), lines = h.text.split('\n').map(l => l.trim());
  console.log(`negative control: an invented user subcommand rejected ${!lines.some(l => l.startsWith(`user ${invented}`))}; an invented flag rejected ${!new RegExp(`--${invented}(?![a-z-])`).test(h.text)}`); }
// T-1838 C2: config keys on the page; auth.mode is the only one and the parser reads it from the rendered template
const keys = [...new Set([...UP.matchAll(/\bauth\.[a-z_]+/g), ...multi.matchAll(/\bauth\.[a-z_]+/g)].map(m => m[0]))];
const { defaultConfig, renderConfig, parseConfig } = await import(`${W}/hub/src/init/config.ts`);
const rendered = renderConfig(defaultConfig('voc'));
console.log(`auth keys on the page and section: [${keys.join(', ')}]; the template renders [auth] mode ${/\n\[auth\]\n(?:#[^\n]*\n)*mode = "single"\n/.test(rendered)}; the parser reads users ${parseConfig(rendered.replace('mode = "single"', 'mode = "users"'), 'voc').auth.mode === 'users'}`);
// T-1836 and T-1835: the help lines as built, each once
const once = (a, needle) => help(a).text.split(needle).length - 1;
console.log(`doctor help sign-in line ${once('doctor', 'sign-in mode: config single/users; hub user counts and admins; no active admin: cland user invite <name>')}; setup help sign-in lines ${['sign-in mode follows the hub: default No; --yes skips; nonterminal skip: cland auth mode users', 'users confirmation names browser sign-out and cland auth reset; Enter skips the first passkey wait', 'invite appears only in the terminal; existing users mode reports its user count'].map(n => once('setup', n)).join(' ')}`);
// T-1838 C5: the CLI reference's Users and sign-in inventory, bound to its heading, against the built usage; the neighbouring Hosts and logins table is the control
const cli = read('site/src/content/docs/docs/cli.md');
const usersSec = section(cli, 'Users and sign-in'), hostsSec = section(cli, 'Hosts and logins');
const built = ['user', 'auth'].flatMap(a => help(a).text.split('\n').map(l => /^  ((?:user|auth) [a-z][a-z-]*)(?=\s|$)/.exec(l)?.[1]).filter(Boolean)).sort();
const inventory = s => [...s.matchAll(/`cland ((?:user|auth) [a-z][a-z-]*)(?=[\s`])/g)].map(m => m[1]).sort();
const rows = s => s.split('\n').filter(l => l.startsWith('| `cland ')).length;
const listed = inventory(usersSec), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
console.log(`CLI Users and sign-in: section found ${usersSec.length > 0}; listed ${listed.length}; built usage subcommands ${built.length}; missing [${built.filter(c => !listed.includes(c)).join(', ')}]; extra [${listed.filter(c => !built.includes(c)).join(', ')}]; duplicates [${listed.filter((c, i) => listed.indexOf(c) !== i).join(', ')}]; equal ${same(listed, built)}`);
console.log(`CLI binding control: table rows in Users and sign-in ${rows(usersSec)}; in the neighbouring Hosts and logins ${rows(hostsSec)}; on the whole page ${rows(cli)}; user/auth commands in Hosts and logins ${inventory(hostsSec).length}`);
console.log(`CLI negative controls: an extra command changes the list ${!same(inventory(usersSec + ['`cland user inv', 'ented`'].join('')), built)}; a duplicate changes the list ${!same(inventory(usersSec + '`cland user list`'), built)}`);
// T-1838 C1: the page's sections, read as its own `## ` headings; the hosts page is the neighbouring control
const heads = t => [...t.matchAll(/^## (.+)$/gm)].map(m => m[1]);
const want = ['The two modes', 'Switching and reset', 'Users and invites', 'Passkeys and passwords', 'Attribution with --as', 'Remotes in users mode', 'Setup and doctor', 'Deferred'];
console.log(`users page sections: [${heads(UP).join(' | ')}]; equal to the eight ${same(heads(UP), want)}; the hosts page's sections differ ${!same(heads(read('site/src/content/docs/docs/hosts.md')), want)}`);
// T-1838 C4: the section's labels as bold, each present in the built component; the neighbouring The layout section is the control
const labels = { 'web/src/accounts/Users.tsx': ['Users', 'Name', 'Display name', 'Role', 'State', 'Create user', 'Invite link', 'Copy invite', 'Dismiss invite'], 'web/src/SignIn.tsx': ['Create passkey', 'Set password', 'Use passkey', 'Password', 'Sign in'] };
const layout = section(WPF, 'The layout');
let inSection = 0, inSource = 0, inLayout = 0, n = 0;
for (const [file, ls] of Object.entries(labels)) for (const l of ls) { n++; if (multi.includes(`**${l}**`)) inSection++; if (read(file).includes(l)) inSource++; if (layout.includes(`**${l}**`)) inLayout++; }
console.log(`web-and-phone Multi-user sign-in labels ${n}: bold in the section ${inSection}; in the built components ${inSource}; bold in the neighbouring The layout section ${inLayout}; links the users page ${multi.includes('](/docs/users/)')}`);
// T-1838 C1 and T-1837 C5: the overview link and the sessions sentence, each bound to its section with its neighbour as control
const FE = read('site/src/content/docs/docs/features.md'), SM = read('site/src/content/docs/docs/sessions.mdx');
console.log(`features overview: users link under Where you work ${section(FE, 'Where you work').includes('](/docs/users/)')}; under the neighbouring The crew ${section(FE, 'The crew').includes('](/docs/users/)')}`);
const sentence = 'In users mode, session rows and the Agents start line name the user who launched the session';
console.log(`sessions page: the launching-user sentence under The sessions panel ${section(SM, 'The sessions panel').includes(sentence)}; under the neighbouring What a session is ${section(SM, 'What a session is').includes(sentence)}`);
console.log(`helps read: ${[...helps].map(([a, h]) => `${a} exit ${h.code}`).join(', ')}`);
JS
cat > "$Q/lt.mjs" <<'JS'
// node "$Q/lt.mjs" <log> <file>…   per named file: the top-level titles a suite log finished (load-gate repetitions excluded) and their outcomes; counts only
import { readFileSync } from 'node:fs';
const [log, ...files] = process.argv.slice(2);
const by = new Map(files.map(f => [f, new Map()]));
for (const l of readFileSync(log, 'utf8').split('\n')) {
  if (!l.startsWith('suite progress ')) continue;
  let v; try { v = JSON.parse(l.slice(15)); } catch { continue; }
  if (v.event !== 'finish' || v.type !== 'test' || v.nesting !== 0 || v.scope || !by.has(v.file)) continue;
  const m = by.get(v.file); m.set(v.name, (m.get(v.name) ?? new Set()).add(v.outcome));
}
for (const [f, m] of by) {
  const pass = [...m.values()].filter(o => o.size === 1 && o.has('pass')).length;
  console.log(`${log.split('/').pop().slice(0, 7)} ${f}: titles ${m.size}; pass ${pass}; other outcomes ${m.size - pass}`);
}
JS
for f in src ids pub inv nolink voc lt; do node --check "$Q/$f.mjs" || echo "BLOCKED: $f.mjs"; done; echo "helpers checked"
```

The check functions for QA's own shell (`landing` and `durdelta` from `M4`; `ownlines` and `s01` from `M3`; everything else this brief's own). The landed members' reviewed tips are written in; the merge-batch suites and candidates are named in `s06` (VERIFIED: each batch log's `suite provenance` head is a `Batch candidate T-<id>` commit: T-1836's `5aaca59df` on `63b5318bd` has a tree equal to T-1836's landing tree; the T-1837 and T-1835 batch ran at T-1835's candidate `6c84fb75d`, whose parent is T-1837's candidate `a367ddd43` on `d3a713025`; T-1838's `e4ad65fb9` sits on `72f26bc5c`; each candidate differs from its member's landing tree only in `.cland/tasks/` files, because tracker commits sit between).

```sh
cat > "$Q/checks.sh" <<'SH'
. "$Q/kit2-checks.sh"; . "$Q/kit3-checks.sh"     # ownlines and s01 from M3, landing and durdelta from M4; their s00 and s99 are replaced below
BASE=881114bfdc1e75e1ec4fc5df8109e99b96357a81    # "QA brief: E-1537 stage 4 …": the stage-4 QA SHA (A-19486), the parent of the stage's first commit
MEMBERS="T-1835 T-1836 T-1838 T-1837"
STAGE="the users stage"
WROTE=84dcc428e52e993a390b95b16ca228cf77a00695   # the dev this brief was completed at (T-1860 and T-1838 landings filled)
ACCEPT="72f26bc5c7418ab933650f2c401e0ce32d0e7147"  # T-1860's landing (non-member, VERIFIED); the request may name more non-member landings by SHA
# reviewed tips: the commit of each final clear verdict, read with task view (rev-37-1835-evidence-2, rev-35-1836-final-1, rev-36-1837-final-1, rev-36-1838-final-1)
TIPS="T-1835 c435f67e19cb9f56dac9cf19ed3deb6107af2b7f T-1836 5d2f6fd812795235d696fe0d0c1babf1c606a699 T-1837 f3e1899ec9b884661267fc067dfccb7a6beb2aa2 T-1838 a15551d77475e7332f28e2edc57a92e9c76b1dff"
# the unedited files this brief runs or reads as built: unchanged from BASE to WROTE and untouched by T-1838's, T-1860's and T-1806's heads (VERIFIED)
preserved() { printf '%s\n' hub/src/hub/users.ts hub/src/hub/web-edge.ts hub/src/hub/web-signin.ts hub/src/cli/auth.ts hub/src/cli/usage/auth.ts hub/src/init/config.ts hub/src/cli/socket-client.ts hub/src/doctor/report.ts hub/src/project.ts hub/src/setup/steps/hub.ts hub/src/setup/steps/aide.ts web/src/accounts/Users.tsx web/src/SignIn.tsx test-support/fixture-environment.ts .agents/skills/qa/qa-demo-policy.ts hub/test/fakes/fake-ssh.ts hub/test/fakes/fake-scp.ts hub/test/fakes/opencode/opencode shared/fake-host-directory.ts hub/src/web-bundle.ts hub/test/nvim-fixture-boundary.test.ts hub/test/nvim-frame-refresh.test.ts hub/test/cli-usage.test.ts hub/test/cli-usage-compatibility.test.ts hub/test/suite-task-selection.test.ts hub/test/test-docs.test.ts hub/test/suite-tiers.test.ts site/test/remote-docs.test.ts site/test/remote-docs-source.ts site/test/onboarding-claims.test.ts site/test/hosts-docs.test.ts site/scripts/capture-safety.ts hub/test/fake-clock.ts; }
s00() {   # build, plan and landing receipts (captures through pubw, R-1)
  echo "PRE HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) request $S"
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
  git -C "$R" status --porcelain | grep -v ' \.cland/tasks/' | node "$Q/pubw.mjs" "$EV/root-status-before.txt"; echo "root non-tracker entries $(grep -c . "$EV/root-status-before.txt")"
  (cd "$R" && node "$W/hub/bin/cland.ts" task plan show E-1537 --json) | node "$Q/pubw.mjs" "$EV/plan.json"; echo "plan read exit ${PIPESTATUS[0]}"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=(v.stages??[]).find(x=>x.name===process.argv[2]);const p=(v.plan?.stages??[]).find(x=>x.name===process.argv[2]);console.log(s?JSON.stringify({name:s.name,state:s.state,qa:s.qa,items:s.items,lanes:p?.lanes,merged:s.merged,total:s.total,statuses:s.statuses,cover:s.cover}):"stage missing");console.log("earlier stages: "+(v.stages??[]).slice(0,4).map(x=>x.name+" "+x.state).join("; "))' "$EV/plan.json" "$STAGE" | node "$Q/pubw.mjs" "$EV/stage-members.json"; cat "$EV/stage-members.json"
  for id in $(node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8").split("\n")[0]);console.log((v.items??[]).join(" "))' "$EV/stage-members.json"); do
    echo "$id landings $(landing "$id" | wc -l | tr -d ' ') $(landing "$id" | head -n 1)"
    (cd "$R" && node "$W/hub/bin/cland.ts" task view "$id" --json) | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const v=JSON.parse(s).item;console.log("  "+v.id+" state "+v.state+"; status "+v.status+"; claim "+(v.claim?"held":"none")+"; qaPolicy "+JSON.stringify(v.qaPolicy)+"; qaCriteria "+JSON.stringify(v.qaCriteria??null)+"; criteria checked "+(v.criteria??[]).filter(c=>c.checked).length+" of "+(v.criteria??[]).length)})'; done
}
s02() {   # landing diffs (read-only), the landing check and every first-parent commit after the stage-4 QA SHA
  for id in $MEMBERS; do L=$(landing "$id" | head -n 1); echo "$id landing ${L:-none}"; [ -n "$L" ] || continue
    echo "$id package.json and lockfiles: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- package.json package-lock.json hub/package.json web/package.json nvim/package.json site/package.json site/package-lock.json | wc -l | tr -d ' ')"
    echo "$id preserved files edited at its landing: [$(git -C "$W" diff --name-only "${L}^1" "${L}" -- $(preserved) | tr '\n' ' ')]"
  done
  echo "preserved files changed in the stage: [$(git -C "$W" diff --name-only "$BASE" "$S" -- $(preserved) | tr '\n' ' ')]"
  set -- $TIPS
  while [ $# -ge 2 ]; do id=$1; head=$2; shift 2; L=$(landing "$id" | head -n 1)
    [ -n "$L" ] && git -C "$W" cat-file -e "$head^{commit}" 2> /dev/null || { echo "$id landing ${L:-none} tip $head: BLOCKED (no landing or no tip)"; continue; }
    F=$(git -C "$W" diff --name-only "$L^1" "$L" | grep -v '^\.cland/' | tr '\n' ' ')
    echo "$id own lines at its landing $L equal its tip $head: $(ownlines "$L" "$head")"
    echo "$id files byte-identical to $head at its landing: $(git -C "$W" diff --quiet "$head" "$L" -- $F && echo yes || echo "no: $(git -C "$W" diff --name-only "$head" "$L" -- $F | tr '\n' ' ')")"
    echo "$id commits after its landing touching its files: [$(git -C "$W" log --format=%h "$L..$S" -- $F | tr '\n' ' ')]"
    echo "$id trailers: [$(git -C "$W" log -1 --format=%B "$L" | grep -E '^(Item|Reviewed-by): ' | tr '\n' ';')]"; done
  echo "writing dev is an ancestor of the request: $(git -C "$W" merge-base --is-ancestor "$WROTE" "$S" && echo yes || echo no)"
  echo "first-parent commits from BASE to the request: $(git -C "$W" rev-list --first-parent --count "$BASE..$S"); after the writing dev: $(git -C "$W" rev-list --first-parent --count "$WROTE..$S")"
  others=0
  for c in $(git -C "$W" rev-list --first-parent --reverse "$BASE..$S"); do P=$(git -C "$W" diff --name-only "$c^1" "$c" | LC_ALL=C sort | tr '\n' ' ')
    it=$(git -C "$W" log -1 --format=%B "$c" | grep -E '^Item: ' | tr '\n' ' '); k=other
    if [ -n "$it" ]; then case "$it" in "Item: T-1835 "|"Item: T-1836 "|"Item: T-1837 "|"Item: T-1838 ") k=member;; *) k="landing ${it#Item: }"; case " $ACCEPT " in *" $c "*) k="accepted ${it#Item: }";; esac;; esac
    else
      [ -n "$P" ] && ! printf '%s' "$P" | tr ' ' '\n' | grep -v -x '' | grep -q -v -x -E '\.cland/tasks/[^/]+\.md' && k=tracker
      [ "$P" = "hub/test/durations.json " ] && k=durations
      [ "$P" = "qa/briefs/E-1537-stage-5.md " ] && k=brief-only
      [ "$P" = "hub/test/durations.json qa/briefs/E-1537-stage-5.md " ] && k=brief-and-durations
    fi
    case "$k" in other|landing*) others=$((others+1));; esac
    echo "  commit $(git -C "$W" rev-parse --short=9 "$c") class $k trailers [$it] paths $(printf '%s' "$P" | wc -w | tr -d ' ')"
    case "$k" in durations|brief-and-durations) echo "    $(durdelta "$c")";; esac; done
  echo "commits of class other or unaccepted landing: $others"
}
s05() {   # T-1838 C1, C2, C4, C5, T-1837 C5, T-1836 and T-1835 help lines, independently of the tests: the built CLI's help, the parser and bound docs sections (sealed; voc.mjs seals each child)
  node "$Q/fresh.mjs" "$Q" plain node "$Q/voc.mjs" "$W"
}
s06() {   # evidence to read, never to start: member verify receipts, merge-batch logs, T3 files in the batch, candidates, the Coordinator's cover pair at the requested dev SHA
  for pair in "T-1835 c435f67e19cb9f56dac9cf19ed3deb6107af2b7f" "T-1836 5d2f6fd812795235d696fe0d0c1babf1c606a699" "T-1837 f3e1899ec9b884661267fc067dfccb7a6beb2aa2" "T-1838 a15551d77475e7332f28e2edc57a92e9c76b1dff"; do set -- $pair
    (cd "$R" && node "$W/hub/bin/cland.ts" task view "$1" --json) | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const v=JSON.parse(s).item.verify??{};console.log(process.argv[1]+" verify "+v.id+" executor "+v.executor+" state "+v.state+" result "+v.result+" artifact "+v.artifact+" head is the reviewed tip "+(v.head===process.argv[2]))})' "$1" "$2"; done
  # suites: the members' verifies (T-1836 e1282e0d, T-1837 d09b914c, T-1835 b2e70b6b, T-1838 059150dd), the merge-batch runs (4ee95ce6's d2c22f2c, d4203f6d's efb3febe, 2812dfb4's 56c8c307), then the stage covers from the plan
  for id in e1282e0d-286d-4f48-a924-49f3b9efed8c d09b914c-5166-44ca-ada0-7a8a8da49621 b2e70b6b-3228-4f39-8d2d-41b7a5b024b9 059150dd-4833-4e08-92f0-c9de8529b4d9 d2c22f2c-990f-4858-85ea-15128878d8fe efb3febe-c84b-48d8-8704-f72d538140cc 56c8c307-33ba-4b0a-ba5f-0c49b2ac93ee $(node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8").split("\n")[0]);console.log([s.cover?.linux,s.cover?.macos].filter(Boolean).join(" "))' "$EV/stage-members.json"); do
    for f in $(ls "$R/.cland/artifacts" | grep -F -- "-suite-$id-"); do
      node -e 'const fs=require("fs"),t=fs.readFileSync(process.argv[1],"utf8"),line=t.split("\n").find(l=>l.startsWith("suite provenance "));let p={};try{p=JSON.parse(line.slice(17))}catch{}const L=t.split("\n"),fails=L.filter(l=>/^ℹ fail [1-9]/.test(l)).length,zero=L.filter(l=>/^ℹ fail 0$/.test(l)).length,tiers=L.filter(l=>/^tier (T[0-4]|Web): exit /.test(l)).map(l=>l.slice(5,l.indexOf(";"))).join(", "),batch=(t.match(/merge-batches\/([0-9a-f]{8})/)??[,"none"])[1];console.log(process.argv[2].slice(0,8)+" "+process.argv[1].split("/").pop().slice(0,7)+" head "+p.head+" occasion "+p.occasion+" executor "+p.executor+" os "+(p.platform??{}).os+" batch "+batch+" ["+tiers+"] failing phase lines "+fails+"; passing phase lines "+zero+"; head is the request "+(p.head===process.argv[3]))' "$R/.cland/artifacts/$f" "$id" "$S"; done; done
  # the T3 and Web files of the landed members, in the batch that landed T-1837 and T-1835 (A-19545); every title must pass
  node "$Q/lt.mjs" "$R/.cland/artifacts/$(ls "$R/.cland/artifacts" | grep '^A-19545-')" hub/test/host-relaunch.test.ts nvim/test/scenarios/workbench.test.ts hub/test/scenarios/setup.test.ts web/test/sessions.test.ts web/test/setup-signin.test.ts
  # T-1838's site guards in the batch that landed it (A-19584); its T2 file is the verify's (A-19574)
  node "$Q/lt.mjs" "$R/.cland/artifacts/$(ls "$R/.cland/artifacts" | grep '^A-19584-')" site/test/users-docs.test.ts hub/test/remote-docs.test.ts site/test/hosts-docs.test.ts site/test/remote-docs.test.ts site/test/onboarding-claims.test.ts
  # each batch candidate: its subject, and the paths in which its tree differs from its member's landing tree (only .cland/tasks/ is acceptable: tracker commits sit between)
  for pair in "T-1836 5aaca59df9f12590f496e4970782288856f8aaa7" "T-1837 a367ddd436ade1306279c01103fda336f082cab9" "T-1835 6c84fb75dd7cc6ce25b41443769abea40116dafa" "T-1838 e4ad65fb9bdd104ed8f7ac5b784cbe3fc9485e5e"; do set -- $pair
    L=$(landing "$1" | head -n 1); echo "$1 candidate ${2:0:9} [$(git -C "$W" log -1 --format=%s "$2")] differs from the landing outside .cland/tasks/: [$(git -C "$W" diff --name-only "$2" "$L" | grep -v '^\.cland/tasks/' | tr '\n' ' ')]"; done
}
s07() {   # notes, index rows and tiers of the stage's new test files; the closed-item wording lint (sealed) and the .mdx substitute (decision D-2, T-1867); the qa lint deltas of the briefs the stage edits
  echo "per-test notes for the new files: $(git -C "$W" ls-tree --name-only "$S" docs/agents/tests/ | grep -c -E '^docs/agents/tests/(hub-test-(doctor-users|launch-user|setup-signin|users-docs-invite)|web-test-setup-signin)\.test\.ts\.md$')"
  echo "index rows naming them: $(git -C "$W" show "$S:docs/agents/tests/index.md" | grep -c -E '(hub/test/(doctor-users|launch-user|setup-signin|users-docs-invite)|web/test/setup-signin)\.test\.ts`\]')"
  echo "tiers: $(git -C "$W" show "$S:hub/test/tiers.json" | grep -E '"(hub/test/(doctor-users|launch-user|setup-signin|users-docs-invite|remote-docs)|web/test/setup-signin)\.test\.ts"' | tr -d ' ' | tr '\n' ' ')"
  node "$Q/fresh.mjs" "$W" plain node hub/test/lint-closed-item-wording.ts 2>&1 | node "$Q/pubw.mjs" "$EV/wording-lint.txt"; echo "closed-item wording lint exit ${PIPESTATUS[0]}"; grep -E '^closed-item wording lint: ' "$EV/wording-lint.txt"
  node "$Q/fresh.mjs" "$W" plain node -e 'const fs=require("fs");(async()=>{const s=new Set();for await (const p of fs.promises.glob(["**/README*.md","docs/**/*.md","site/src/content/docs/**/*.md"],{cwd:process.cwd(),exclude:["**/node_modules/**","**/.git/**","**/.cland/**"]}))s.add(p);console.log("QA count of the three globs "+s.size+"; site docs "+[...s].filter(p=>p.startsWith("site/src/content/docs/")).length+"; users page included "+s.has("site/src/content/docs/docs/users.md"))})()'
  echo "changed .mdx pages: [$(git -C "$W" diff --name-only "$BASE" "$S" -- '*.mdx' | tr '\n' ' ')]; added lines $(git -C "$W" diff "$BASE" "$S" -- '*.mdx' | grep -E '^\+' | grep -v -c -E '^\+\+\+ '); tracker-id references in added lines $(git -C "$W" diff "$BASE" "$S" -- '*.mdx' | grep -E '^\+' | grep -v -E '^\+\+\+ ' | grep -o -E '\b[A-Z]-[0-9]+\b' | wc -l | tr -d ' ')"
  for b in E-1313 E-1537-stage-3 E-1537-stage-4 E-616; do for c in "$BASE" "$S"; do
    git -C "$W" show "$c:qa/briefs/$b.md" > "$Q/lint-$b-${c:0:9}.md"
    node "$Q/fresh.mjs" "$W" plain node hub/bin/cland.ts qa lint "$Q/lint-$b-${c:0:9}.md" --commit "$c" 2>&1 | sed -E 's#^[^ ]*\.md:[0-9]+: ##' | grep -v -e '^# fresh: ' -e 'qa lint passes at the build' | LC_ALL=C sort | node "$Q/pubw.mjs" "$Q/lint-$b-${c:0:9}.txt"; done
    echo "$b qa lint findings: at BASE $(grep -c . "$Q/lint-$b-${BASE:0:9}.txt"); at the build $(grep -c . "$Q/lint-$b-${S:0:9}.txt"); new at the build:"
    comm -13 "$Q/lint-$b-${BASE:0:9}.txt" "$Q/lint-$b-${S:0:9}.txt" | while IFS= read -r l; do echo "    $l (sha1 $(printf '%s' "$l" | shasum | cut -c1-12))"; done; done
}
s08() {   # R-4: web/dist is git-ignored; build it once in the QA worktree before any Web case and any scratch row and confirm the stamp, the bundle state and a clean tree
  node "$Q/fresh.mjs" "$W" plain npm run build 2>&1 | node "$Q/pubw.mjs" "$EV/S0-build.txt"; echo "build exit ${PIPESTATUS[0]}"
  echo "HEAD $(git -C "$W" rev-parse HEAD); dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
  node "$Q/fresh.mjs" "$W" plain node --input-type=module -e 'const fs=await import("node:fs");const s=JSON.parse(fs.readFileSync("web/dist/build-stamp.json","utf8"));console.log("stamp version "+s.version+"; sources "+String(s.sources).length+" hex; built "+new Date(s.builtAt).toISOString());const {webBundleState}=await import(process.env.QA_W+"/hub/src/web-bundle.ts");console.log("bundle state "+(await webBundleState(process.env.QA_W)).state)'
}
s86() {   # R-5: residue and fixture-owner receipts since the setup snapshot, for every row; nothing is removed here
  node "$Q/fresh.mjs" "$Q" plain node "$Q/res.mjs" "$EV/S0-inv"
}
s90() {   # rule 15 and R-1: every evidence file through the unchanged publication policy before publication, with a positive control
  node "$Q/fresh.mjs" "$Q" plain node "$Q/pubscan.mjs" "$EV"
}
s99() {   # end check with $Q and $T still present (cleanup order); replaces M3's s99 (this stage has no native row and takes no preservation slot)
  echo "POST HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) request $S"
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
  git -C "$R" status --porcelain | grep -v ' \.cland/tasks/' | node "$Q/pubw.mjs" "$EV/root-status-after.txt"; echo "root non-tracker status unchanged: $(cmp -s "$EV/root-status-before.txt" "$EV/root-status-after.txt" && echo yes || echo no)"
  echo "preservation lock owned by this run: $(grep -c -F "qa $RUN " /tmp/cland-preserve.lock/owner 2> /dev/null || echo 0)"
  echo "own-family new entries across all rows: $(cat "$EV"/*.inventory-delta.txt | awk -F': ' '/^own-family new entries in all files: /{s+=$2} END{print s+0}')"
  echo "other new entries across all rows: $(cat "$EV"/*.inventory-delta.txt | awk -F': ' '/^other new entries in all files: /{s+=$2} END{print s+0}')"
  echo "withheld or redacted lines across all captures: $(cat "$EV"/*.txt "$EV"/*.log 2> /dev/null | grep -E '^# (fresh|std): redacted or withheld lines [1-9]|^# pubw .*: withheld lines [1-9]|^# inv .*other lines withheld [1-9]' | wc -l | tr -d ' ')"
  echo "inv positive-control failures across all captures: $(cat "$EV"/*.txt 2> /dev/null | grep -c -E '^# inv .*: BLOCKED')"
  echo "T entries other than node-compile-cache: $(ls -A "$T" | grep -v -c -x node-compile-cache)"
  for e in $(ls -A "$T" | grep -v -x node-compile-cache); do echo "  T: $e type $(stat -f %HT "$T/$e")"; done
  echo "recorded fake-host alias: $(cat "$Q/alias.txt" 2> /dev/null || echo none)"
}
SH
cat > "$Q/scratch.sh" <<'SH'
# this stage's scratch rows (E1537S5-80 to -85), sourced by the kit's body.sh inside fresh.mjs (hub mode), cwd p1; helpers.sh gives cland, up, alive, cnt, dg, there and machines
# R-1: every child inherits the fresh seal unchanged (no overlay, no env prefix); no output is written to a file: c5 and c5j keep it in shell variables and print through fresh.mjs
# Invite-bearing output is printed only through inv.mjs, whose planted positive control runs first; the raw text stays in shell variables and pipes
c5() { C5OUT=$(cland "$@" < /dev/null 2>&1); C5X=$?; }                 # one CLI call, stdout and stderr together, in memory only
c5j() { C5OUT=$(cland "$@" < /dev/null 2> /dev/null); C5X=$?; }        # one CLI call whose stdout is JSON; its stderr (narration) is dropped, not kept
show() { printf '%s\n' "$C5OUT" | head -n "${1:-12}" | sed 's/^/    /'; }   # never used on invite-bearing output
gate5() { echo "  gate: CLAND_ names outside the seal and the hub overlay $(node -e 'const ok=new Set(["CLAND_EXECUTOR_STATE","CLAND_DISCORD_API_ROOT","CLAND_TELEGRAM_API_ROOT","CLAND_ELEVENLABS_API_ROOT","CLAND_TEST_OWNED_ROOT","CLAND_TEST_SKIP_ORPHAN_SWEEP","CLAND_FAKE_HOST_ROOT","CLAND_SSH_BIN","CLAND_SCP_BIN","CLAND_OPENCODE_BIN"]);const x=Object.keys(process.env).filter(k=>k.startsWith("CLAND_")&&!ok.has(k));console.log(x.length+(x.length?" ("+x.join(" ")+")":""))'); cwd is p1 $([ "$(pwd -P)" = "$QA_Q/p1" ] && echo yes || echo no)"; }
pid5() { printf '%s\n' "$C5OUT" | sed -n 's/^hub started for .* (pid \([0-9][0-9]*\))$/\1/p' | tail -n 1; }
# dsi: doctor's sign-in row from the JSON report in C5OUT, matched by its exact name; its place right after the hosts block (hosts, hosts config, host …)
dsi() { printf '%s' "$C5OUT" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{let v;try{v=JSON.parse(s)}catch{console.log("  doctor: not JSON");return}const n=v.checks.map(c=>c.name),r=v.checks.filter(c=>c.name==="sign-in mode"),i=n.indexOf("sign-in mode"),h=n.reduce((a,x,k)=>x==="hosts"||x==="hosts config"||x.startsWith("host ")?k:a,-1);for(const c of r)console.log("  sign-in mode | "+c.verdict+" | "+c.detail+" | "+(c.fix??"-"));console.log("  rows named sign-in mode "+r.length+"; right after the hosts block "+(h>=0&&i===h+1))})'; }
# dst: doctor's sign-in line from the text report in C5OUT, whitespace collapsed
dst() { printf '%s\n' "$C5OUT" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const l=s.split("\n").filter(x=>/^(ok|warn|fail)\s+sign-in mode\s/.test(x));console.log("  doctor text sign-in lines "+l.length);for(const x of l)console.log("    "+x.replace(/\s+/g," ").trim())})'; }
# ssi <exit>: setup's sign-in and hub rows from the JSON report in C5OUT, the order from the hub on, and whether the exit equals what the other rows alone give
ssi() { printf '%s' "$C5OUT" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{let v;try{v=JSON.parse(s)}catch{console.log("  setup: not JSON");return}const x=Number(process.argv[1]),n=v.steps.map(r=>r.name),at=k=>n.indexOf(k),r=v.steps.filter(r=>r.name==="sign-in mode");for(const c of v.steps.filter(r=>r.name==="hub"||r.name==="sign-in mode"))console.log("  "+c.name+" | "+c.verdict+" | "+c.detail+" | "+(c.fix??"-"));console.log("  order from the hub: "+n.slice(at("hub")).join(", "));console.log("  sign-in rows "+r.length+"; right after hub "+(at("sign-in mode")===at("hub")+1)+"; remote telegram right after it "+(at("remote telegram")===at("sign-in mode")+1)+"; agent hosts after speech "+(at("agent hosts")>at("speech"))+"; aide last "+(n.at(-1)==="aide"));const other=v.steps.filter(r=>r.name!=="sign-in mode"&&(r.verdict==="open"||r.verdict==="fail")).length;console.log("  open or fail rows other than sign-in mode "+other+"; exit "+x+"; the exit the other rows alone give "+(other?1:0)+"; equal "+(x===(other?1:0)))})' "$1"; }
r100() {   # p1: a Git repository with a fixture user.name, cland init, one CLI-started hub with its web edge on loopback; every role stays on local
  echo "PRE p1 entries $(ls -A "$QA_Q/p1" | wc -l | tr -d ' ')"
  cd "$QA_Q/p1" || return 1
  gate5
  git init -q -b dev && git config user.name 'Fixture Admin' && git commit -q --allow-empty -m init; echo "git exit $?; repository user.name $(git config user.name)"
  c5 init .; echo "init exit $C5X; output lines $(printf '%s\n' "$C5OUT" | wc -l | tr -d ' ')"; p=$(pid5); [ -n "$p" ] && echo "$p" >> "$QA_Q/pids"
  c5 hub stop; echo "hub after init and stop: $(up)"
  echo "managed config present: $(there .cland/config.toml); [auth] tables $(cnt .cland/config.toml '[auth]'); mode single lines $(cnt .cland/config.toml 'mode = "single"'); mode users lines $(cnt .cland/config.toml 'mode = "users"'); pool tables $(cnt .cland/config.toml '[hosts.')"
  c5 hub start; echo "hub start exit $C5X; hub $(up)"; p=$(pid5); [ -n "$p" ] && echo "$p" >> "$QA_Q/pids"; echo "  hub pid recorded: $([ -n "$p" ] && echo yes || echo no)"
  c5 hub status; echo "(hub status) exit $C5X; web edge on loopback $(printf '%s\n' "$C5OUT" | grep -c -E '^  web      http://127\.0\.0\.1:[0-9]+/$')"
  c5j role list --json; echo "(role list json) exit $C5X; roles $(printf '%s' "$C5OUT" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{try{const r=JSON.parse(s).roles;console.log(r.length+"; on a pool other than local "+r.filter(x=>x.launch.pool!=="local").length)}catch{console.log("unknown")}})')"
}
r101() {   # T-1836 C1 and T-1835 C4 in single mode, without a terminal: doctor's row and setup's rows with the hub up, then with the hub down (with and without --no-aide); nothing written
  cd "$QA_Q/p1" || return 1
  gate5
  b1=$(dg .cland/config.toml); b2=$(dg .cland/roles.toml)
  c5j doctor --json; echo "(doctor json, single mode, hub up) exit $C5X (not a pass condition)"; dsi
  c5 doctor; echo "(doctor text) exit $C5X (not a pass condition)"; dst
  c5j setup --json --no-aide --no-accounts; x=$C5X; echo "(setup json, no terminal, --no-aide, hub up) exit $x"; ssi "$x"
  c5 hub stop; echo "hub stop exit $C5X; hub $(up)"
  c5j doctor --json; echo "(doctor json, single mode, hub down) exit $C5X (not a pass condition)"; dsi
  c5j setup --json --no-aide --no-accounts; x=$C5X; echo "(setup json, no terminal, --no-aide, hub down) exit $x"; ssi "$x"
  c5j setup --json --no-accounts; x=$C5X; echo "(setup json, no terminal, without --no-aide, hub down) exit $x"; ssi "$x"
  echo "config.toml unchanged $([ "$(dg .cland/config.toml)" = "$b1" ] && echo yes || echo no); roles.toml unchanged $([ "$(dg .cland/roles.toml)" = "$b2" ] && echo yes || echo no); hub $(up)"
  c5 hub start; echo "hub start exit $C5X; hub $(up)"; p=$(pid5); [ -n "$p" ] && echo "$p" >> "$QA_Q/pids"
}
r102() {   # the T-1836 decision: the config says users while the running hub is single; doctor asks user.list, is refused and says reload; the key is restored
  cd "$QA_Q/p1" || return 1
  gate5
  b1=$(dg .cland/config.toml)
  echo "hub $(up); mode single lines $(cnt .cland/config.toml 'mode = "single"')"
  node -e 'const fs=require("fs"),f=".cland/config.toml",a="mode = \"single\"",b="mode = \"users\"";const t=fs.readFileSync(f,"utf8");if(t.split(a).length!==2){console.log("edit refused: the existing key is not there once");process.exit(1)}fs.writeFileSync(f,t.replace(a,b));console.log("edited the existing [auth] mode key: users")'
  c5j doctor --json; echo "(doctor json, config users, hub single) exit $C5X (not a pass condition)"; dsi
  c5 hub status; echo "(hub status) exit $C5X; hub $(up)"
  node -e 'const fs=require("fs"),f=".cland/config.toml",a="mode = \"users\"",b="mode = \"single\"";const t=fs.readFileSync(f,"utf8");if(t.split(a).length!==2){console.log("restore refused");process.exit(1)}fs.writeFileSync(f,t.replace(a,b));console.log("restored the existing [auth] mode key: single")'
  echo "config.toml equals its digest before the edit: $([ "$(dg .cland/config.toml)" = "$b1" ] && echo yes || echo no)"
  c5j doctor --json; echo "(doctor json, restored) exit $C5X (not a pass condition)"; dsi
}
r103() {   # T-1838 C3 and the stage demo: the users page's marked blocks, read from the page at the build, run in order on the single-mode scratch hub; doctor after each step; invites only through inv.mjs; then setup, hub stop, doctor and the invite search
  cd "$QA_Q/p1" || return 1
  gate5
  P="$QA_W/site/src/content/docs/docs/users.md"
  STEPS=$(awk '/^```sh users-invite$/{f=1;next} f&&/^```$/{f=0} f&&NF&&!/^#/' "$P")
  T2=$(node --input-type=module -e 'const m=await import(process.env.QA_W+"/site/test/users-docs-source.ts");console.log(m.inviteSteps(m.source(m.usersPath)).join("\n"))')
  echo "marked steps read by QA: $(printf '%s\n' "$STEPS" | grep -c .); equal to the T2 parser's steps: $([ "$STEPS" = "$T2" ] && echo yes || echo no)"
  printf '%s\n' "$STEPS" | sed 's/^/    page step: /'
  echo "hub $(up); mode single lines $(cnt .cland/config.toml 'mode = "single"')"
  RAW=''; CAP=''; k=0; fails=0
  while IFS= read -r line; do
    k=$((k+1))
    case "$line" in "cland "*) ;; *) echo "  step $k is not a cland command"; fails=$((fails+1)); continue;; esac
    set -f; set -- ${line#cland }; set +f
    c5 "$@"; x=$C5X; echo "  step $k: cland $* | exit $x"; [ "$x" = 0 ] || fails=$((fails+1))
    RAW="$RAW$C5OUT"$'\n'
    printf '%s\n' "$C5OUT" | node "$QA_Q/inv.mjs" "step $k"
    c5j doctor --json; CAP="$CAP$C5OUT"$'\n'; echo "  doctor after step $k:"; dsi
  done <<< "$STEPS"
  echo "steps run $k; steps not exiting 0: $fails"
  echo "config mode users lines $(cnt .cland/config.toml 'mode = "users"'); mode single lines $(cnt .cland/config.toml 'mode = "single"')"
  c5 doctor; CAP="$CAP$C5OUT"$'\n'; echo "(doctor text, users mode) exit $C5X (not a pass condition)"; dst
  c5j setup --json --no-aide --no-accounts; x=$C5X; CAP="$CAP$C5OUT"$'\n'; echo "(setup json, users mode, no terminal) exit $x"; ssi "$x"
  c5 hub stop; echo "hub stop exit $C5X; hub $(up)"
  c5j doctor --json; CAP="$CAP$C5OUT"$'\n'; echo "(doctor json, users mode, hub down) exit $C5X (not a pass condition)"; dsi
  { printf '%s' "$RAW"; printf '\n#--captured--\n'; printf '%s' "$CAP"; } | node "$QA_Q/nolink.mjs" .cland "$QA_Q/state" "$QA_Q/home" "$QA_Q/config" "$QA_Q/cache"
}
r104() {   # a users-mode hub restart, then cland auth reset back to single (the page's only way back); doctor and setup read single again; user commands refused
  cd "$QA_Q/p1" || return 1
  gate5
  c5 hub start; echo "hub start in users mode exit $C5X; hub $(up)"; p=$(pid5); [ -n "$p" ] && echo "$p" >> "$QA_Q/pids"
  c5j doctor --json; echo "(doctor json, users mode after restart) exit $C5X (not a pass condition)"; dsi
  c5 auth reset; echo "(auth reset) exit $C5X"; show 2
  echo "config mode single lines $(cnt .cland/config.toml 'mode = "single"'); mode users lines $(cnt .cland/config.toml 'mode = "users"')"
  c5j doctor --json; echo "(doctor json, after reset) exit $C5X (not a pass condition)"; dsi
  c5 user list; echo "(user list after reset) exit $C5X"; show 2
  c5j setup --json --no-aide --no-accounts; x=$C5X; echo "(setup json, after reset, no terminal) exit $x"; ssi "$x"
}
r105() {   # stop the scratch hub; record the fake-host alias if one exists; the census with R-7's watchdog identity before any TERM (no host was created, so none is expected)
  cd "$QA_Q/p1" || return 1
  c5 hub stop; echo "hub stop exit $C5X; hub $(up)"
  for p in $(sort -u "$QA_Q/pids"); do echo "recorded hub pid $p alive $(alive "$p")"; done
  al=$(node -e 'const fs=require("fs");let t;try{t=fs.realpathSync(process.env.QA_Q+"/fh/.fixture-sockets")}catch{process.exit(0)}for(const n of fs.readdirSync("/private/tmp")){if(!/^ct-[0-9a-f]{32}$/.test(n))continue;const f="/private/tmp/"+n;try{if(fs.lstatSync(f).isSymbolicLink()&&fs.realpathSync(f)===t)console.log(f)}catch{}}')
  [ -n "$al" ] && printf '%s\n' "$al" > "$QA_Q/alias.txt"; echo "fake-host aliases resolving to this run's sockets: $(printf '%s' "$al" | grep -c .)"
  node "$QA_Q/census4.mjs" "$al"
}
SH
. "$Q/checks.sh"; bash -n "$Q/checks.sh" && bash -n "$Q/scratch.sh" && echo "checks and scratch checked"
```

Expected: `expect checked: files 26; exact lists 7 1 1 4 8 8 8 6 16 5 1 21 7 10 7 7 5 7 3 22 38 1`, `helpers checked` with no `BLOCKED` line, `checks and scratch checked`.

**Publication precheck (R-3/R-6), run before the brief is committed and again in E1537S5-04.** `pub.mjs` runs every expected title in `expect.json` and every line of this brief (every helper above is part of it, so every fixed output line is covered) through the unchanged `assertPublishable`, lists the lines holding a fragment that a runtime value could complete into a refusal, and proves both positive controls (an authorization-header credential and a one-use invite link, each built in memory from parts, never printed). At completion (VERIFIED: `node pub.mjs <archive of 84dcc428e> expect.json <this file>`, the policy imported from the archive; the same result over the archive of `dfda10574`): `expected titles 197; refused 0`, `brief lines 1097; refused 0; with a joinable fragment 0`, `positive control (authorization header) refused: true; positive control (one-use invite link) refused: true`, and no `brief line` or `refused title` line; `inv.mjs` run alone printed `# inv precheck: positive control refused raw true; publishable after redaction true; value removed true` and `# inv precheck: links withheld 0; other lines withheld 0`, and on a synthetic invite-bearing input (built from parts in the shell, never written) withheld its one link with `other lines withheld 0`; `nolink.mjs` found a planted value in a scratch journal file and skipped a scratch database file (VERIFIED in a throwaway directory). The brief's line count changes when the markers are filled; E1537S5-04 reads it at the build. The runtime values the helpers print are counts, verdicts, check names and details, user names, roles and states, command lines, paths and SHAs; no fixed label is followed by a value that could complete a refused form, and every invite-bearing output passes `inv.mjs` first.

**Cleanup, in this order.** Step 1, after E1537S5-90 passes: if `$Q/alias.txt` exists, print it, check that it is a symlink named `/private/tmp/ct-` plus 32 hex resolving to the realpath of `$Q/fh/.fixture-sockets`, and remove that symlink by its literal path (none is expected); inventory `$T` (`ls -A "$T"`) and remove by literal path the dead T-1676 residue there only (`rm -r` for a directory). Step 2: E1537S5-99 with `$Q` and `$T` present. Step 3, after the verdict: `git -C "$R" worktree remove "$W"` (through the wrapper; its `node_modules` symlink first if Git refuses; `web/dist` is ignored and goes with the worktree), then `unset -f git`, then remove `$Q` and `$T` by their printed literal paths (prefix checks `/private/tmp/q53-` and `/private/tmp/qa-e1533-s3-`; `$T` holding nothing but `node-compile-cache`). The scratch project's users, invites and database go with `$Q`; no invite was ever written outside it. Nothing in `$ST` or `/private/tmp` outside `$Q`, `$T` and the recorded alias is removed, ever (the T-1805 receipts and T-1806 directories included). If any inventory shows a new own-family name, nothing is removed.

## Cases

Every case is one or more named test files run once at the build, from QA's own shell through the kit's `nt` (sealed, `TMPDIR=$T`, one file at a time), recorded with `qa-record.sh note` (surface `hub-api`; the Web files drive the pinned Headless Shell inside themselves, the Neovim file the pinned headless Neovim), with the evidence files `$EV/<id>.log`, `$EV/<id>.check.txt` and `$EV/<id>.inventory-delta.txt`. A case passes only when every check line reads `CLEAN`, its delta reads `own-family new entries in all files: 0`, and the log's `# fresh: redacted or withheld lines` lines all read 0 (R-1: an invite link or any other refused line in a test's output is withheld there and makes the case INCONCLUSIVE, which is itself a finding about that test). A missing file is a FAIL naming it. A skipped test (a missing Headless Shell or Neovim included) is a FAIL, never a pass. Run in table order after E1537S5-08; never two files at once. Tiers are read from `hub/test/tiers.json` at `dfda10574` (VERIFIED); the site guard files are outside `tiers.json` and run in the site prebuild and through the T1 wrapper. A slow but positive file is recorded with its wall time. The exact lists are in `expect.json`; the rows name what each file proves.

| case | surface | role | command | expected | evidence |
| --- | --- | --- | --- | --- | --- |
| E1537S5-10 | hub-api | QA | `nt E1537S5-10 hub/test/doctor-users.test.ts` | `CLEAN hub/test/doctor-users.test.ts run 1 plan 7` with its exact list (T2; new by T-1836; `projectHub` in both modes and the owned legacy socket fixture; synthetic Git user name only): test `C1 doctor reports single mode from the running hub` (one exact JSON row and text row), test `C2 doctor reads users counts from the hub and labels offline counts unknown` (offline config users warns with `cland hub start`; after `auth.mode` and an invited admin: one active, one invited, two admins, one active admin), test `doctor warns when config users disagrees with a running single-mode hub` (a real `user.list` refusal gives reload guidance without parsing error text: the Coordinator's decision), test `C3 doctor warns with invite fix when no active admin exists`, test `doctor reports hub not running for stale discovery with a live PID`, test `doctor keeps held live user counts unknown after timeout` (injected transport clock, 3000 ms, no native wait), test `C4 doctor omits planted identity and credential material in text and JSON` (the planted markers caught first, then absent; counts still asserted). `own-family new entries in all files: 0`. (T-1836 C1 to C4, the decision) | `$EV/E1537S5-10.log`, `.check.txt`, `.inventory-delta.txt` |
| E1537S5-11 | hub-api | QA | `nt E1537S5-11 hub/test/cli-usage.test.ts hub/test/cli-usage-compatibility.test.ts` | Each `CLEAN` with its exact list (T1 each; unedited, VERIFIED `preserved`; they read the usage fixtures T-1836 and T-1835 edit): test `push help names the Coordinator, Aide and human as allowed callers` and test `all command usage exports retain their pre-refactor bytes` (the `DOCTOR_USAGE` and `SETUP_USAGE` exports equal `hub/test/fixtures/cli-usage/commands.json`, with T-1836's `sign-in mode:` line and T-1835's three sign-in lines). (T-1836 and T-1835 help text) | `$EV/E1537S5-11.log`, `.check.txt`, `.inventory-delta.txt` |
| E1537S5-12 | hub-api | QA | `nt E1537S5-12 hub/test/launch-user.test.ts` | `CLEAN hub/test/launch-user.test.ts run 1 plan 4` with its exact list (T2; new by T-1837; disposable `projectHub`, fake adapters and fixture users): test `Agents start lines name the recorded launching user and accept legacy records` (exact start text with and without attribution: C2), test `hub restart reads pre-attribution process and journal fixtures without a user` (the old SQL schema and a journal notice, then a restart: C4), and the loop's two expansions `launch attribution follows authenticated humans in single mode` and `launch attribution follows authenticated humans in users mode` (the authenticated second web user, the local first user, a forged frame field, the real Coordinator spoke recording none, a CLI subprocess, the attribution persisted after restart and kept across a stop and fresh resume: C1, C4). `own-family new entries in all files: 0`. (T-1837 C1, C2, C4) | `$EV/E1537S5-12.log`, `.check.txt`, `.inventory-delta.txt` |
| E1537S5-13 | hub-api | QA | `nt E1537S5-13 web/test/sessions.test.ts` (after E1537S5-08) | `CLEAN web/test/sessions.test.ts run 1 plan 8` with its exact list (Web; edited by T-1837; pinned Headless Shell with its own profile under the file's root; a managed scratch config): test `Sessions row names its launching user only in users mode` (a legacy single-mode row and a users-mode row launched through the fixture hub: the rendered `by <display name>` fact on the users-mode row only: C3) and the seven unedited titles (the edited row's preservation). A missing Headless Shell is BLOCKED. (T-1837 C3) | `$EV/E1537S5-13.log`, `.check.txt`, `.inventory-delta.txt` |
| E1537S5-14 | hub-api | QA | `nt E1537S5-14 nvim/test/sessions.test.ts hub/test/nvim-fixture-boundary.test.ts hub/test/nvim-frame-refresh.test.ts` | Each `CLEAN` with its exact list, no skip (`nvim/test/sessions.test.ts` T2, edited by T-1837, pinned headless Neovim; the two catalog consumers T1, unedited, VERIFIED `preserved`, over T-1837's regenerated `nvim/test/fixtures/protocol-frames.json` and its `sessions.json` slice): test `selected session metadata names the launching user and accepts legacy rows` (the optional `userDisplayName` from a process frame in the selected meta line, then the previous wire shape; 34, 50 and 80 columns, every line within the panel width: C3), the seven unedited `sessions` titles, test `a per-file catalog retains complete requested frames and refuses a missing recording` and test `a slice loads the committed catalog once for a recorded interleaving and still refuses unknown frames`. A missing Neovim is BLOCKED. (T-1837 C3) | `$EV/E1537S5-14.log`, `.check.txt`, `.inventory-delta.txt` |
| E1537S5-15 | hub-api | QA | `nt E1537S5-15 hub/test/skills-onboarding.test.ts` | `CLEAN hub/test/skills-onboarding.test.ts run 1 plan 16` with its exact list (T2; edited by T-1837): test `sessions page describes launching users and uses shipped commands` (the sentence on `site/src/content/docs/docs/sessions.mdx` and `commandProblems` empty: C5) and the fifteen unedited titles, stage 4's `the onboarding tour has ten stages ending with Look now` among them. (T-1837 C5) | `$EV/E1537S5-15.log`, `.check.txt`, `.inventory-delta.txt` |
| E1537S5-16 | hub-api | QA | `nt E1537S5-16 hub/test/setup-signin.test.ts` | `CLEAN hub/test/setup-signin.test.ts run 1 plan 5` with its exact list (T2; new by T-1835; disposable `projectHub` roots, the shared fixture environment, scripted prompts; no browser): test `C1 sign-in offer defaults No and yes skips with either terminal policy` (the offer `Let several people …` with default `false`; `--yes` `skip` with and without a terminal, single kept: C1), test `C2 C4 C5 confirmed switch prints the invite only to terminal and Enter leaves the exact command` (both confirmations, the invite only in the narration, `open` with `cland user invite jane-doe`, the planted link caught before the absence check over logs, journal and report, then `ok` `users mode; 1 users` and the legacy `user.list` shape: C2, C4, C5), test `C4 nonterminal single mode skips with its command and a declined confirmation leaves single unchanged` (C4 as amended), test `older injected hub metadata stays unknown without switching`, test `lost registration read stays open and joins the terminal reader`. `# fresh: redacted or withheld lines 0` in the log (no link reached the output). (T-1835 C1, C2, C4, C5) | `$EV/E1537S5-16.log`, `.check.txt`, `.inventory-delta.txt` |
| E1537S5-17 | hub-api | QA | `nt E1537S5-17 web/test/setup-signin.test.ts` (after E1537S5-08) | `CLEAN web/test/setup-signin.test.ts run 1 plan 1` with test `C3 setup completes after the first user registers a passkey on the invite page` (Web; new by T-1835; the web fixture's isolated Headless Shell with a fresh context and CDP's virtual authenticator; the real `auth.mode` switch and invite page; setup `done` after the persisted passkey; ordinary `user.list` shows the first user active; a planted-error control proves the reporter receives a redacted error). `# fresh: redacted or withheld lines 0` in the log. No screenshot or trace of the invite page is taken or kept. A missing Headless Shell is BLOCKED. (T-1835 C3) | `$EV/E1537S5-17.log`, `.check.txt`, `.inventory-delta.txt` |
| E1537S5-18 | hub-api | QA | `nt E1537S5-18 hub/test/setup-flow.test.ts hub/test/setup-hub.test.ts hub/test/setup-prompter.test.ts hub/test/setup-cli.test.ts hub/test/setup-remote-component.test.ts hub/test/setup-remotes.test.ts` | Each `CLEAN`, the first five with their exact lists, `setup-remotes` with its listed names (T1: `setup-flow`, `setup-hub`, `setup-prompter`, `setup-remotes`; T2: `setup-cli`, `setup-remote-component`; each edited by T-1835 for the order): test `C1 agent hosts runs after remote steps and before the Aide` (`sign-in mode` right after `hub`, `remote telegram` right after it), test `the ordered setup flow reruns without starting another hub or Aide` (the last seven rows `hub, sign-in mode, remote telegram, remote discord, speech, agent hosts, aide`; a third run's row `skip`, `single mode`, `cland auth mode users`), test `setup JSON is one report on stdout with nonterminal narration on stderr`, test `setup executable JSON reports open installers without running any harness`, test `aborting a setup wait releases its reader before the next question` (new: the pause the passkey wait uses), test `terminal setup stores a hidden Telegram token, reloads through frames and reports pairing before the Aide` (`skip sign-in mode` between `hub` and `remote telegram` in the text report) and test `a terminal Telegram offer stores a hidden token and enables it without starting a hub under no-aide` (the last seven names). (T-1835 C1, C4) | `$EV/E1537S5-18.log`, `.check.txt`, `.inventory-delta.txt` |
| E1537S5-19 | hub-api | QA | `nt E1537S5-19 site/test/users-docs.test.ts site/test/hosts-docs.test.ts site/test/onboarding-claims.test.ts site/test/remote-docs.test.ts` | Each `CLEAN` with its exact list: `site/test/users-docs.test.ts` plan 5 (new by T-1838: the guide discoverable under Features and covering the built workflow, the vocabulary guard with invented controls, the multi-user section's built controls, the CLI Users and sign-in inventory with extra and duplicate controls, the setup and doctor description from their declarations); `site/test/hosts-docs.test.ts` plan 7, `site/test/onboarding-claims.test.ts` plan 3 and `site/test/remote-docs.test.ts` plan 22 (unedited consumers of the sidebar, the overview and the CLI reference T-1838 edits; the last also of the hosts page T-1860's landing `72f26bc5c` edits; T-1860's verify A-19569 passed `site/test/hosts-docs.test.ts` with its seven titles, VERIFIED). These are the site's prebuild guards run directly, as the site's own test script runs them. (T-1838 C1, C2, C4, C5) | `$EV/E1537S5-19.log`, `.check.txt`, `.inventory-delta.txt` |
| E1537S5-20 | hub-api | QA | `nt E1537S5-20 hub/test/remote-docs.test.ts` | `CLEAN hub/test/remote-docs.test.ts run 1 plan 38` with its exact list (T1; edited by T-1838 to import `site/test/users-docs.test.ts`; it also imports the onboarding-claims, hosts-docs and remote-docs guards, so its plan holds 3 + 7 + 5 + 22 + 1 titles, the last `site vocabulary extraction matches the runtime config and secret names`). This is how mode-free task selection runs the site guards. (T-1838 C1, C2, C4, C5) | `$EV/E1537S5-20.log`, `.check.txt`, `.inventory-delta.txt` |
| E1537S5-21 | hub-api | QA | `nt E1537S5-21 hub/test/users-docs-invite.test.ts` | `CLEAN hub/test/users-docs-invite.test.ts run 1 plan 1` with its one listed title (T2; new by T-1838; `tempProject` and `projectHub` with the real loopback web edge and a FakeClock; a fake Git user; every `sh users-invite` line through the harness CLI; users mode persisted; the list with both admins; three fresh loopback invites kept in memory; the replaced invite refused and the newest accepted by `/invite/details`; capture and hub logs free of every invite after a planted control). `# fresh: redacted or withheld lines 0` in the log (the file prints no link by design). `own-family new entries in all files: 0`. (T-1838 C3) | `$EV/E1537S5-21.log`, `.check.txt`, `.inventory-delta.txt` |
| E1537S5-22 | hub-api | QA | `nt E1537S5-22 hub/test/suite-task-selection.test.ts hub/test/test-docs.test.ts hub/test/suite-tiers.test.ts` | Each `CLEAN` (T1 each; unedited, VERIFIED `preserved`): `suite-task-selection` includes test `mode-free docs and site selections include every site prebuild guard` (the prebuild guard inventory against the wrapper imports, `site/test/users-docs.test.ts` included, T-1838's wrapper import); `test-docs` checks every test file's index row and per-test note (the new `doctor-users`, `launch-user`, `setup-signin`, Web `setup-signin` and `users-docs-invite` rows and notes) and its consumers, `qa/briefs` included; `suite-tiers` checks every test file's tier. (the stage's selection, index and tier contract) | `$EV/E1537S5-22.log`, `.check.txt`, `.inventory-delta.txt` |

### Web cases (when in scope)

In scope, headless only: E1537S5-13 (`web/test/sessions.test.ts`, T-1837's session-row fact) and E1537S5-17 (`web/test/setup-signin.test.ts`, T-1835's passkey on the invite page) run the pinned Chrome Headless Shell inside their named files, each with its own profile under the file's scratch root (rule 18); E1537S5-17 also uses CDP's virtual authenticator, never a real authenticator or keychain. No `real-browser` row, no computer use, no GUI, no human notice: the epic's Definition of done names headless Chromium. Screenshots are not pass conditions, and no screenshot or trace of an invite page is ever kept.

## Manual checks

Every check is recorded with `qa-record.sh note` under E-1537 and `$RUN`, surface `hub-api`, with its evidence file. Run them in this order: E1537S5-00 to -08, then the cases above, then E1537S5-80 to -86, -90, cleanup step 1, -99. `mrow` runs one scratch function in a fresh hub seal (cwd p1) after cover-quiet admission and the load gate, and writes `$EV/<id>.txt` from `fresh.mjs`'s redacted output; its last line is `row exit <n>`. Every scratch row passes only when its `# fresh: redacted or withheld lines` line reads 0, every `# inv` line reads `positive control refused raw true; publishable after redaction true; value removed true` and `other lines withheld 0`, and its gate line reads `CLAND_ names outside the seal and the hub overlay 0` and `cwd is p1 yes` (body.sh's own `PRE gate` line must read credential-prefix names 0, `QA_SESSION set yes`, `HOME is Q/home yes`, `TMPDIR is T yes`, `fake host root yes`, and the fake `ssh`, `scp` and stub `npm`). The scratch rows run in table order only: each starts from the state the one before left (see "Probes that mislead").

| id | surface | role | command | expected | evidence |
| --- | --- | --- | --- | --- | --- |
| E1537S5-00 | hub-api | QA | `s00 > "$EV/E1537S5-00.txt" 2>&1` | PRE line: HEAD, dev and request the same 40 hex; `dirty entries 0`; `root non-tracker entries <n>` (recorded; E1537S5-99 compares); `plan read exit 0`; the stage line with name `the users stage`, `qa` `{"scope":"affected","when":"after-stage"}`, `items` `["T-1835","T-1836","T-1838","T-1837"]`, `lanes` `[["T-1835","T-1836","T-1838"],["T-1837"]]`, `merged` equal to `total`, `statuses` `{"done":4}` (VERIFIED at `84dcc428e`), and a `cover` with `linux` and `macos` ids and `missing` `[]`; `earlier stages:` all four `closed`; each member `landings 1 <sha>` and `state closed; status done; claim none; qaPolicy {"scope":"affected","when":"after-stage"}; qaCriteria []; criteria checked 5 of 5` (T-1835, T-1837 and T-1838) or `4 of 4` (T-1836) (VERIFIED at `84dcc428e`); each `# pubw … withheld lines 0`. A missing landing, a non-closed member or a cover missing a platform is BLOCKED. | `$EV/E1537S5-00.txt`, `plan.json`, `stage-members.json`, `root-status-before.txt` |
| E1537S5-01 | hub-api | QA | `s01 > "$EV/E1537S5-01.txt" 2>&1` | Node `v24.…`; `typecheck exit 0` (the root `typecheck`: `hub`, `nvim`, `shared/wire` (the hub and shared wire views' new optional fields conform) and the web workspace); `dirty entries 0`. | `$EV/E1537S5-01.txt`, `typecheck.log` |
| E1537S5-02 | hub-api | QA | `s02 > "$EV/E1537S5-02.txt" 2>&1` | Every landing `package.json and lockfiles: 0` and `preserved files edited at its landing: []`; `preserved files changed in the stage: []`; T-1835, T-1836, T-1838 and T-1837 each `own lines … equal its tip …: yes`; `files byte-identical … at its landing`: T-1836 `yes`, T-1837 `no: docs/agents/tests/index.md hub/test/tiers.json`, T-1835 `no: .agents/skills/implement/SKILL.md docs/agents/tests/index.md hub/README.md hub/src/hub/dispatch.ts hub/src/protocol.ts hub/test/fixtures/cli-usage/commands.json hub/test/tiers.json shared/wire/index.ts` (each named file also carries an earlier member's landed lines; VERIFIED), T-1838 `yes`; `commits after its landing touching its files` at `84dcc428e`: T-1836 `[17ef83b96 72f26bc5c 5885fe1bf 01c97ad5b ]`, T-1837 `[17ef83b96 5885fe1bf ]`, T-1835 `[17ef83b96 72f26bc5c ]`, T-1838 `[]` (VERIFIED; see "Merge watch"); trailers `[Item: T-1836;Reviewed-by: rev-35 (rev-35-1836-final-1);]`, `[Item: T-1837;Reviewed-by: rev-36 (rev-36-1837-final-1);]`, `[Item: T-1835;Reviewed-by: rev-37 (rev-37-1835-evidence-2);]` and `[Item: T-1838;Reviewed-by: rev-36 (rev-36-1838-final-1);]`; `writing dev is an ancestor of the request: yes`. Commit classes (VERIFIED at `84dcc428e`, fifteen first-parent commits after `BASE`): `e6ee06a4b tracker` (9 paths), `63b5318bd tracker` (3), `d3a713025 member [Item: T-1836 ]` (14), `188107b62 tracker` (4), `01c97ad5b member [Item: T-1837 ]` (26), `5885fe1bf member [Item: T-1835 ]` (30), `b94976133 tracker` (2), `bd7d81667 tracker` (3), `dfda10574 tracker` (4), `72f26bc5c accepted T-1860 [Item: T-1860 ]` (16), `ef9f52fc9 tracker` (3), `490043158 tracker` (2; T-1866 and T-1867 filed), `17ef83b96 member [Item: T-1838 ]` (13), `958b19133 tracker` (2), `84dcc428e durations` (1) with `entries outside allow changed or removed 0; added 29; allowances removed 0; changed 0 (renewals keeping seconds and owner 0; reason-only 0); added 0; version same true` (the stage-5 add-only refresh); every later commit `member`, `accepted`, `tracker` (the commits filing T-1866 and T-1867 among them), `durations` (add-only or renewal lines, no allowance removed), `brief-only` or `brief-and-durations` (this brief's commit); `commits of class other or unaccepted landing: 0`. Any `other` or unaccepted `landing` (T-1806's included, unless the request names its SHA) is BLOCKED (stage-2 R-1). | `$EV/E1537S5-02.txt` |
| E1537S5-03 | hub-api | QA | `node "$Q/src.mjs" "$W" > "$EV/E1537S5-03.txt" 2>&1` | Every line `ok`, 94 in all: T-1836's 15 from `ok T-1836 C1 doctor adds the users check right after the hosts block` to `ok T-1836 the doctor guide example`; T-1837's 17 from `ok T-1837 C1 the process row gains user_id` to `ok T-1837 the sessions guide paragraph`; T-1835's 21 from `ok T-1835 C1 setup order: hub, sign-in mode, remotes, discord, speech, agent hosts, aide` to `ok T-1835 setup guide: the no-terminal sentence`; the 7 scratch facts from `ok scratch: the first admin is created active` to `ok scratch: auth and user help`; T-1838's 34 from `ok T-1838 C1 the page is in the Features group after Web and phone` to `ok T-1838 the T2 file has its index row` (VERIFIED: the first 60 at `dfda10574`, all 94 over T-1838's head with and without T-1860's files laid on, and all 94 at `84dcc428e`). Each line names its file, count and wanted count; a `MISMATCH` or `MISSING` line is a FAIL of the criterion it names. | `$EV/E1537S5-03.txt` |
| E1537S5-04 | hub-api | QA | `{ node "$Q/ids.mjs" "$W/qa/briefs/E-1537-stage-5.md"; node "$Q/fresh.mjs" "$W" plain node "$Q/pub.mjs" "$W" "$Q/expect.json" "$W/qa/briefs/E-1537-stage-5.md"; node "$Q/fresh.mjs" "$Q" plain node "$Q/inv.mjs" precheck; } > "$EV/E1537S5-04.txt" 2>&1` | `missing from the tables: 0`; `open T-1838 markers: 0; open T-1860 markers: 0` (a non-zero marker count is BLOCKED); the precheck at the build: `expected titles <n>; refused 0`, `brief lines <n>; refused 0; with a joinable fragment 0`, `positive control (authorization header) refused: true; positive control (one-use invite link) refused: true`, no `brief line` or `refused title` line (R-3/R-6); then `# inv precheck: positive control refused raw true; publishable after redaction true; value removed true` and `# inv precheck: links withheld 0; other lines withheld 0`; each `# fresh: redacted or withheld lines 0`. | `$EV/E1537S5-04.txt` |
| E1537S5-05 | hub-api | QA | `s05 > "$EV/E1537S5-05.txt" 2>&1` | VERIFIED with the same script at `84dcc428e` (identical output over T-1838's head, with and without T-1860's files laid on): `users page: distinct cland commands 13; not in the built help 0`; `web-and-phone Multi-user sign-in: distinct cland commands 1; not in the built help 0`; `negative control: an invented user subcommand rejected true; an invented flag rejected true`; `auth keys on the page and section: [auth.mode]; the template renders [auth] mode true; the parser reads users true`; `doctor help sign-in line 1; setup help sign-in lines 1 1 1` (T-1836 and T-1835, VERIFIED at `dfda10574` too); **T-1838 C5:** `CLI Users and sign-in: section found true; listed 5; built usage subcommands 5; missing []; extra []; duplicates []; equal true` (the built `cland user --help` names `user add`, `user invite`, `user list`; `cland auth --help` names `auth mode`, `auth reset`), `CLI binding control: table rows in Users and sign-in 5; in the neighbouring Hosts and logins 16; on the whole page 104; user/auth commands in Hosts and logins 0` (stage-4 R-1: the bound count differs from the page count, and the neighbouring table of the same shape holds none of the inventory) and `CLI negative controls: an extra command changes the list true; a duplicate changes the list true`; **T-1838 C1:** `users page sections: [The two modes \| Switching and reset \| Users and invites \| Passkeys and passwords \| Attribution with --as \| Remotes in users mode \| Setup and doctor \| Deferred]; equal to the eight true; the hosts page's sections differ true`; **T-1838 C4:** `web-and-phone Multi-user sign-in labels 14: bold in the section 14; in the built components 14; bold in the neighbouring The layout section 0; links the users page true`; `features overview: users link under Where you work true; under the neighbouring The crew false`; **T-1837 C5:** `sessions page: the launching-user sentence under The sessions panel true; under the neighbouring What a session is false` (VERIFIED at `dfda10574` too); `helps read:` each `exit 0` (`user`, `auth`, `topic`, `setup`, `doctor`, `hub`); `# fresh: redacted or withheld lines 0`. (T-1838 C1, C2, C4, C5, T-1837 C5, T-1836 and T-1835 help, independently of the tests) | `$EV/E1537S5-05.txt` |
| E1537S5-06 | hub-api | QA | `s06 > "$EV/E1537S5-06.txt" 2>&1` (after E1537S5-00; reads only) | **Member verify receipts** (VERIFIED at `dfda10574`): `T-1835 verify b2e70b6b-3228-4f39-8d2d-41b7a5b024b9 executor droplet state finished result passed artifact A-19540 head is the reviewed tip true`; `T-1836 verify e1282e0d-286d-4f48-a924-49f3b9efed8c … artifact A-19535 head is the reviewed tip true`; `T-1837 verify d09b914c-5166-44ca-ada0-7a8a8da49621 … artifact A-19537 head is the reviewed tip true`; `T-1838 verify 059150dd-4833-4e08-92f0-c9de8529b4d9 … artifact A-19574 head is the reviewed tip true` (the head its landing is byte-identical to). **Suite logs:** `e1282e0d A-19535` (SHA-1 `02071e2a76a231549f5ed19b8a2dd69d44a823c6`) and `059150dd A-19574` (`99cf270d625018a185c270777aaf8b80db74f109`): `occasion null executor droplet os linux batch none [T0: exit 0, T1: exit 0, T2: exit 0, Web: exit 0] failing phase lines 0; passing phase lines 4`; `d09b914c A-19537` (`420e9e3e41fae98dec778b933ff86f1678d6c33e`): the same with `[T0: exit 0, T1: exit 0, T2: exit 0, T3: exit 0, T4: exit 0, Web: exit 0]` and `passing phase lines 6`; `b2e70b6b A-19540` (`5eaf689923b1921061b33258d898bd5d33ed86c2`): `[T0: exit 0, T1: exit 0, T2: exit 0, T3: exit 0, Web: exit 0]` and `passing phase lines 5`; `d2c22f2c A-19543` and `A-19544` (equal SHA-1 `d45f435daf3eb149ceee594d77a29acbee59c154`): `occasion batch executor droplet os linux batch 4ee95ce6 [T0: exit 0, T1: exit 0, T3: exit 0] failing phase lines 0; passing phase lines 3`; `efb3febe A-19545`, `A-19546` and `A-19547` (equal SHA-1 `2e63f6d14c59b796a7822230ce4a5baef9a1fa59`): `occasion batch executor droplet os linux batch d4203f6d [T0: exit 0, T1: exit 0, Web: exit 0, T3: exit 0] failing phase lines 0; passing phase lines 4`; `56c8c307 A-19584` and `A-19585` (equal SHA-1 `880cf6fb972b4bb071778b81e1188915139a479c`): `occasion batch executor droplet os linux batch 2812dfb4 [T0: exit 0, T1: exit 0, T3: exit 0] failing phase lines 0; passing phase lines 3`. These member and batch logs read `head is the request false` (their heads are the reviewed tips and the batch candidates; VERIFIED by a read-only dry run of `s06` at `dfda10574`). **The batch's T3 and Web files** (A-19545, VERIFIED): `hub/test/host-relaunch.test.ts: titles 4; pass 4; other outcomes 0`, `nvim/test/scenarios/workbench.test.ts: titles 6; pass 6; other outcomes 0` (test `recorded protocol fixtures match the live hub attach frames` among them), `hub/test/scenarios/setup.test.ts: titles 1; pass 1; other outcomes 0`, `web/test/sessions.test.ts: titles 8; pass 8; other outcomes 0`, `web/test/setup-signin.test.ts: titles 1; pass 1; other outcomes 0`; **T-1838's site guards in its batch** (A-19584, VERIFIED): `site/test/users-docs.test.ts: titles 5; pass 5; other outcomes 0`, `hub/test/remote-docs.test.ts: titles 1; pass 1; other outcomes 0` (the wrapper's own title; the imported titles are attributed to their site files), `site/test/hosts-docs.test.ts: titles 7; pass 7; other outcomes 0`, `site/test/remote-docs.test.ts: titles 22; pass 22; other outcomes 0`, `site/test/onboarding-claims.test.ts: titles 3; pass 3; other outcomes 0` (`hub/test/users-docs-invite.test.ts` is T2: its evidence is A-19574). **Candidates:** `T-1836 candidate 5aaca59df [Batch candidate T-1836] differs from the landing outside .cland/tasks/: []`, `T-1837 candidate a367ddd43 [Batch candidate T-1837] … []`, `T-1835 candidate 6c84fb75d [Batch candidate T-1835] … []`, `T-1838 candidate e4ad65fb9 [Batch candidate T-1838] … []`. **Stage covers** (the plan's `cover.linux` and `cover.macos`, read from the plan at the request): each log `head` equal to the request (`head is the request true`), the Linux log `occasion stage executor droplet os linux`, the macOS log `executor local os darwin`, each `failing phase lines 0`, T0 to T3, T4 and Web each `exit 0` where the log has them; their skips are only the named platform skips each log's provenance lists. A missing or red cover is BLOCKED (QA never starts one). | `$EV/E1537S5-06.txt` |
| E1537S5-07 | hub-api | QA | `s07 > "$EV/E1537S5-07.txt" 2>&1` | `per-test notes for the new files: 5`; `index rows naming them: 5` (VERIFIED at `84dcc428e`); `tiers: "hub/test/doctor-users.test.ts":"T2", "hub/test/launch-user.test.ts":"T2", "hub/test/remote-docs.test.ts":"T1", "hub/test/setup-signin.test.ts":"T2", "hub/test/users-docs-invite.test.ts":"T2", "web/test/setup-signin.test.ts":"Web",` (VERIFIED at `84dcc428e`); `closed-item wording lint exit 0` with `closed-item wording lint: fixture diagnostics passed` and `closed-item wording lint: <n> documents, <m> tracker items, 0 findings`, where `<n>` equals the next line's `QA count of the three globs <n>` and that line reads `users page included true` (VERIFIED: 774 documents, 1866 tracker items, 13 site docs at `84dcc428e`; the count moves with every docs commit, so compare the two lines, never a number written here); **Decision D-2's substitute (T-1867):** `changed .mdx pages: [site/src/content/docs/docs/sessions.mdx site/src/content/docs/docs/web-and-phone.mdx ]; added lines 22; tracker-id references in added lines 0` (VERIFIED at `84dcc428e`); the qa lint deltas, the passing line left out: `E-1313 qa lint findings: at BASE 7; at the build 7; new at the build:` followed by nothing (the BASE set holds T-1861's known finding; T-1835 edits the brief's M1 and M14 selectors), `E-1537-stage-3 qa lint findings: at BASE 0; at the build 0; new at the build:` followed by nothing (T-1835 edits one criteria-map line), `E-1537-stage-4 qa lint findings: at BASE 0; at the build 0; new at the build:` followed by nothing (T-1860's landing edits it; VERIFIED at `84dcc428e`) and `E-616 qa lint findings: at BASE 6; at the build 6; new at the build:` followed by nothing (VERIFIED at `BASE` and `84dcc428e`); each `# pubw … withheld lines 0`. (T-1838 C5; the stage's index and tier contract; the briefs the stage edits) | `$EV/E1537S5-07.txt`, `wording-lint.txt` |
| E1537S5-08 | hub-api | QA | `s08 > "$EV/E1537S5-08.txt" 2>&1` (before any Web case and any scratch row) | **R-4.** `build exit 0` (`$EV/S0-build.txt` holds the build output, `# pubw S0-build.txt: withheld lines 0`); `HEAD <S>; dirty entries 0`; `stamp version 1; sources 64 hex; built <now>`; `bundle state current` (INFERRED from stage 4's R-4 run). A failed build is BLOCKED, never a product failure. | `$EV/E1537S5-08.txt`, `S0-build.txt` |
| E1537S5-80 | hub-api | Human | `mrow E1537S5-80 r100` | **The scratch project.** `PRE p1 entries 0`; the gate line; `git exit 0; repository user.name Fixture Admin` (the first admin's name then comes from this fixture identity, never the machine's account); `init exit 0`; `hub after init and stop: down`; `managed config present: present; [auth] tables 1; mode single lines 1; mode users lines 0; pool tables 0`; `hub start exit 0; hub up` and `hub pid recorded: yes`; `(hub status) exit 0; web edge on loopback 1` (a `0` here makes E1537S5-83 BLOCKED: the invite needs the web edge); `(role list json) exit 0; roles <n>; on a pool other than local 0` (T-1860's new rows cannot appear; INFERRED from `cland init`'s template, every role `local`); `row exit 0`. | `$EV/E1537S5-80.txt` |
| E1537S5-81 | hub-api | Human | `mrow E1537S5-81 r101` | **T-1836 C1 and T-1835 C1/C4 in single mode, no terminal.** `(doctor json, single mode, hub up) exit <n>` (not a pass condition: rows outside the sign-in row may warn), then exactly `  sign-in mode \| ok \| single \| -` and `  rows named sign-in mode 1; right after the hosts block true`; `(doctor text) exit <n>`, `  doctor text sign-in lines 1` and `    ok sign-in mode single`; `(setup json, no terminal, --no-aide, hub up) exit <x>` then `  hub \| skip \| cland starts the hub with the workbench \| -`, `  sign-in mode \| skip \| single mode \| cland auth mode users`, `  order from the hub: hub, sign-in mode, remote telegram, remote discord, speech, agent hosts, aide`, `  sign-in rows 1; right after hub true; remote telegram right after it true; agent hosts after speech true; aide last true` and `  open or fail rows other than sign-in mode <m>; exit <x>; the exit the other rows alone give <y>; equal true` (the sign-in row leaves setup's exit as the other rows make it: C4); `hub stop exit 0; hub down`; `(doctor json, single mode, hub down)` then `  sign-in mode \| ok \| single \| -` (single needs no hub); `(setup json, no terminal, --no-aide, hub down)` then `  sign-in mode \| skip \| single mode default; detect when the hub is available \| -` and `equal true`; `(setup json, no terminal, without --no-aide, hub down)` then `  hub \| open \| start the project hub \| cland hub start`, `  sign-in mode \| open \| choose the web sign-in mode \| cland auth mode users` (**accepted as built, decision D-1: recorded as known T-1866, never a FAIL or a new finding**) and `equal true` (the hub row is already `open`, so setup's exit is unchanged); `config.toml unchanged yes; roles.toml unchanged yes; hub down` (no step writes without a terminal and without `--yes`: VERIFIED for the `--no-aide` runs by stage 4's E1537S4-82, INFERRED for the run without it); `hub start exit 0; hub up`; `row exit 0`. Every expected line VERIFIED from `hub/src/setup/steps/signin.ts`, `hub/src/setup/steps/hub.ts`, `hub/src/setup/runner.ts` and `hub/src/doctor/users.ts` at `dfda10574`. | `$EV/E1537S5-81.txt` |
| E1537S5-82 | hub-api | Human | `mrow E1537S5-82 r102` | **The T-1836 decision: config users, hub single.** `hub up; mode single lines 1`; `edited the existing [auth] mode key: users`; `(doctor json, config users, hub single) exit <n>` then exactly `  sign-in mode \| warn \| users; running hub doesn't report users mode \| cland hub reload` (doctor read the mode from config and asked `user.list`, which the single-mode hub refused: VERIFIED in `hub/src/hub/daemon.ts`'s `userList`, `use cland auth mode users before cland user commands`; no error text is parsed) and `right after the hosts block true`; `(hub status) exit 0; hub up` (the hub was not reloaded: it watches no config file, VERIFIED); `restored the existing [auth] mode key: single`; `config.toml equals its digest before the edit: yes`; `(doctor json, restored)` then `  sign-in mode \| ok \| single \| -`; `row exit 0`. | `$EV/E1537S5-82.txt` |
| E1537S5-83 | hub-api | Human | `mrow E1537S5-83 r103` | **T-1838 C3 and the stage demo: the users page's marked blocks on the scratch hub, every invite withheld.** `marked steps read by QA: 4; equal to the T2 parser's steps: yes`, then exactly the four `page step:` lines `cland auth mode users`, `cland user add teammate`, `cland user list`, `cland user invite teammate`; `hub up; mode single lines 1`; for each step `  step <k>: cland … \| exit 0`, its `# inv step <k>: positive control refused raw true; publishable after redaction true; value removed true`, its indented output and `# inv step <k>: links withheld <l>; other lines withheld 0`, then `  doctor after step <k>:` and its sign-in row: **step 1** output `    fixture-admin  admin` and `    <one-time invite link withheld>`, `links withheld 1`, doctor `  sign-in mode \| ok \| users; 1 active, 0 invited; 1 admins (1 active) \| -` (the first admin from Git's `user.name`, created active: VERIFIED in `hub/src/hub/users.ts` and `daemon.ts`; T-1835 C2's hub frame, T-1836 C2); **step 2** `    teammate  admin  invited` and one withheld link, `links withheld 1`, doctor `  sign-in mode \| ok \| users; 1 active, 1 invited; 2 admins (1 active) \| -` (the example in `docs/hub/cland-doctor.md`); **step 3** `    NAME  DISPLAY NAME  ROLE  STATE`, `    fixture-admin  Fixture Admin  admin  active`, `    teammate  teammate  admin  invited`, `links withheld 0`, the same doctor row; **step 4** `    teammate  admin  invited` and one withheld link, `links withheld 1`, the same doctor row; `steps run 4; steps not exiting 0: 0`; `config mode users lines 1; mode single lines 0`; `(doctor text, users mode)`, `  doctor text sign-in lines 1` and `    ok sign-in mode users; 1 active, 1 invited; 2 admins (1 active)`; `(setup json, users mode, no terminal) exit <x>` then `  sign-in mode \| ok \| users mode; 2 users \| -` and `equal true` (T-1835 C5: `ok`, its user count, nothing asked); `hub stop exit 0; hub down`; `(doctor json, users mode, hub down)` then `  sign-in mode \| warn \| users; counts: hub not running \| cland hub start` (T-1836 C2); finally `invite values in memory 3; distinct 3; files scanned <f> (database files skipped); occurrences in files 0; occurrences in the captured doctor, setup and list output 0; positive control found true` (T-1835 C5 and T-1836 C4 at runtime: no invite in any hub log line, journal record, run file or captured report). The user-list and step lines are INFERRED in their exact spacing from `hub/src/cli/auth.ts` (two spaces between fields, VERIFIED in source); `row exit 0`. | `$EV/E1537S5-83.txt` |
| E1537S5-84 | hub-api | Human | `mrow E1537S5-84 r104` | **A users-mode restart, then the only way back.** `hub start in users mode exit 0; hub up` (startup accepts users mode with its authorized first admin: VERIFIED in `hub/src/hub/users.ts` `validateMode`); `(doctor json, users mode after restart)` then `  sign-in mode \| ok \| users; 1 active, 1 invited; 2 admins (1 active) \| -`; `(auth reset) exit 0` and `    Sign-in mode: single`; `config mode single lines 1; mode users lines 0`; `(doctor json, after reset)` then `  sign-in mode \| ok \| single \| -`; `(user list after reset) exit 1` and `    cland: use cland auth mode users before cland user commands` (the CLI's `cland: <message>` form VERIFIED in `hub/bin/cland.ts`; the message passing through unchanged INFERRED); `(setup json, after reset, no terminal) exit <x>` then `  sign-in mode \| skip \| single mode \| cland auth mode users` and `equal true`; `row exit 0`. (T-1838's "Switching and reset"; T-1836 C1 and T-1835 C4 again after a reset) | `$EV/E1537S5-84.txt` |
| E1537S5-85 | hub-api | Human | `mrow E1537S5-85 r105` | `hub stop exit 0; hub down`; each `recorded hub pid <p> alive no`; `fake-host aliases resolving to this run's sockets: <n>` (0 or 1, recorded, not a pass condition: INFERRED 0 because no pool or host exists); `processes naming the scratch root, the alias or this build: 0`; `host watchdogs naming this run's leases: 0; TERM sent to 0`; `after TERM: processes naming the scratch root, the alias or this build: 0`; `row exit 0`. **R-7:** a survivor that is a host watchdog prints its `host watchdog:` identity line; it is signalled only with `identified true`; `identified false` prints `not signalled: identity not established` and makes the row BLOCKED (report the pid and lease input to the requester; never signal it by hand). Any watchdog or fake-machine survivor at all is a FINDING (no row configures a pool); a `git worktree prune` survivor is T-1856. | `$EV/E1537S5-85.txt` |
| E1537S5-86 | hub-api | QA | `s86 > "$EV/E1537S5-86.txt" 2>&1` (after E1537S5-85) | **R-5, for every row of the run.** `new receipts <n>; naming this run or the source <m>; with a live owner 0`: every receipt line printed with its owner and roots; a receipt naming this run or the source is `(T-1805 class, left)` and stays; `/private/tmp new: ct- <a>; cland-h- <b>; hc- <c>; other names <d>` with every `ct-` line `resolves to this run's fake-host sockets false` except a recorded alias, every `cland-h-` line `T-1806 class, left`; `system TMPDIR new names <e>; own-family (q53-, qa-e1533-s3-) 0`. Names that other sessions create during the run are counted, never attributed to this run and never removed. Pass: no live-owner receipt naming this run, no unrecorded `ct-` alias of this run, no own-family name in the TMPDIR, `# fresh: redacted or withheld lines 0`. | `$EV/E1537S5-86.txt` |
| E1537S5-90 | hub-api | QA | `s90 > "$EV/E1537S5-90.txt" 2>&1` (after E1537S5-86) | **Rule 15 and R-1 before publication.** `files scanned <n>; lines <m>; lines refused 0`; `positive control refused: true`; no `refusing lines` line (a refusing file is named, never its lines; that file stays private and its row is INCONCLUSIVE); `# fresh: redacted or withheld lines 0`. An invite link anywhere in the evidence would be refused here (the policy refuses the invite query form, proven by E1537S5-04's control). | `$EV/E1537S5-90.txt` |
| E1537S5-99 | hub-api | QA | `s99 > "$EV/E1537S5-99.txt" 2>&1` (after cleanup step 1) | `POST` HEAD, dev and request still the same 40 hex; `dirty entries 0`; `root non-tracker status unchanged: yes`; `preservation lock owned by this run: 0`; `own-family new entries across all rows: 0`; `other new entries across all rows: <n>` (recorded); `withheld or redacted lines across all captures: 0` (R-1, `inv.mjs`'s other withheld lines included); `inv positive-control failures across all captures: 0`; `T entries other than node-compile-cache: 0` after step 1; `recorded fake-host alias: none`. | `$EV/E1537S5-99.txt` |

Before requesting QA, run `cland qa lint qa/briefs/E-1537-stage-5.md --commit <sha>` with this filled brief at the build under test; the brief is complete only when it passes there.

## Probes that mislead

- An invite link is a credential, and the publication policy refuses its query form: a link that reaches a capture is withheld by `fresh.mjs` and counted, so the row turns INCONCLUSIVE instead of leaking. `inv.mjs` redacts before that boundary and counts the links it withheld; its count is the expected redaction, never a leak. Never `show` invite-bearing output, never `echo` the shell variables that hold it, never write it to a file, never take a screenshot or trace of an invite page.
- `nolink.mjs` looks for the actual invite values, read from memory, not for a pattern: a pattern search could miss an encoded or truncated copy that the value search finds. It skips the database files (the hub keeps only a digest of each invite there) and never opens them. It runs after `cland hub stop`, so the journal and logs have been flushed.
- The sign-in step asks the hub; doctor's row reads the config. With the hub down they disagree by design: doctor still knows the mode (`single`, or `users; counts: hub not running`), while setup can only `skip` (under `--yes` or `--no-aide`) or report `open` (decision D-1, known as T-1866).
- `cland setup --json` keeps its report on stdout and its narration on stderr; `c5j` keeps stdout only. A `setup: not JSON` or `doctor: not JSON` line means the report did not parse, not that the row is missing. `cland doctor` and `cland setup` exit 1 for rows elsewhere in the scratch machine; only the named rows and `ssi`'s comparison are judged.
- Doctor and setup rows are matched by their exact name `sign-in mode`. The hosts block (`hosts`, `hosts config`, `host …`) is located by name to check the row's place; T-1860's `host <role> placement` rows would sit inside that block (none appear here: every role is `local`).
- The users page's sections are counted as its own `## ` headings, the CLI reference's tables only inside their bound section, the multi-user labels only inside `## Multi-user sign-in`; each count prints its neighbouring section as a control (stage-4 R-1). A count that equals the neighbour's or the whole page's means the binding failed.
- Edit existing keys in initialized configs: E1537S5-82 changes the one `mode = "single"` line `cland init` writes under `[auth]` and restores it, checking the digest; it never appends an `[auth]` table. The hub does not watch `config.toml`, so the edit reaches doctor and not the hub.
- E1537S5-83 and -84 depend on the state the earlier rows left: E1537S5-81 restarts the hub, E1537S5-83 stops it, E1537S5-84 starts it again in users mode. Run the scratch rows in table order only. A users-mode hub restarts because its first admin exists; a project switched to users by editing config alone would not start (VERIFIED in `validateMode`), which is why E1537S5-82 restores the key before anything else.
- `hub/test/remote-docs.test.ts` imports four site guard files, so its one TAP plan holds all their titles; the suite logs attribute the imported titles to their own site files. A per-file plan of 1 there would mean the imports failed.
- T-1837's verify A-19537 ran T3 and T4 as well, and T-1835's A-19540 its changed T3 scenario; full T3 for the stage still comes from the batches (A-19543 to A-19547) and the cover pair.
- The batch that landed T-1837 and T-1835 ran at T-1835's candidate `6c84fb75d`, whose parent is T-1837's candidate: one suite, three identical logs (A-19545 to A-19547). Compare candidates outside `.cland/tasks/`, as `s06` does.
- The wording lint's document count moves with every docs commit; compare it with QA's own count of the same three globs at the build, never with a number written here. The lint never reads `.mdx` pages (decision D-2, T-1867).
- `web/test/setup-signin.test.ts` is sensitive to CPU load (A-19541): admission and the load gate come first; a failure is judged as it stands, never rerun.
- Slots due or queued before the build count even when their results arrive later.
- "No skip" names platform-only cases and where they are covered: the cover pair lists its platform skips by name.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

- **Setup through a terminal and with `--yes` on the CLI.** A terminal run needs a scripted PTY, and `--yes` starts the hub and accepts harmless defaults that can run harness trust steps. The step's terminal behaviour (the offer, the confirmation, the invite narration, Enter's `open`, the passkey's `done`) and its `--yes` `skip` are proven by `hub/test/setup-signin.test.ts` (E1537S5-16), `web/test/setup-signin.test.ts` (E1537S5-17), the T3 PTY scenario `hub/test/scenarios/setup.test.ts` (batch evidence, E1537S5-06) and the source lines (E1537S5-03). Setup switching a scratch project to users through a scripted terminal, with the first user's passkey, is the epic's Definition of done. Missing authorization is not the reason; these checks are excluded, not BLOCKED.
- **Doctor with no active admin, a held reply, or stale discovery with a live PID, on a real hub.** A real hub refuses to start in users mode without its authorized first admin, and the other two need injected transports; `hub/test/doctor-users.test.ts` covers all three (E1537S5-10) and the source lines (E1537S5-03).
- **A session launched on the scratch hub.** T-1837's attribution needs a harness launch; `hub/test/launch-user.test.ts` runs it with fake adapters, a real Coordinator spoke and a CLI subprocess (E1537S5-12), and the rendered rows run in E1537S5-13 and -14. The scratch rows launch no session.
- **The rendered site.** No `astro build`: the site's dependencies live only in the root's `site/node_modules` and its build may fetch. The users page's sidebar placement, overview link, sections and the multi-user section are read from source and by the site guards (E1537S5-03, -05, -19, -20); the rendering is not checked.
- **A real browser, a real passkey or password, a phone, an HTTPS tunnel.** Only the headless files' virtual authenticator registers a passkey; no invite link is opened by QA.
- **Remotes in users mode.** The users page's "Remotes in users mode" paragraph describes E-1536's built pairings (no Telegram or Discord here); it is read only through the page's vocabulary check (E1537S5-05) and the site guard (E1537S5-19).
- **Suites.** QA starts no `cland verify`, no npm test script and no T3 or T4 file (`hub/test/host-relaunch.test.ts`, `hub/test/scenarios/setup.test.ts`, `nvim/test/scenarios/workbench.test.ts` included); E1537S5-06 reads the members' verifies, the batches and the Coordinator's cover pair.

## Grants

none. Every row uses fakes and scratch roots only; the Web rows use their own isolated Headless Shell profiles; no grant is needed.

## Rows to verify after landing

Both landings that were pending while drafting have been filled from the landing (`git show <landing>`, `task view <id> --json`, its verify and batch logs) and re-verified at the new dev; no marker remains. E1537S5-04 counts the markers and a non-zero count makes the run BLOCKED.

- **T-1838 (filled at `84dcc428e` from its landing `17ef83b96`, its verify A-19574 and batch logs A-19584 and A-19585):** the landing-state paragraph, "Stage", "Merge watch", the criteria map's T-1838 rows, "Build", "How this brief applies them", `expect.json` (re-read at the landing), `src.mjs` (all 94 `ok`), `checks.sh` (`WROTE`, `TIPS`, `s06`'s batch suite and candidate), E1537S5-00, -02, -03, -05, -06, -07, -19, -20, -21, -22, -83 and -84.
- **T-1860 (filled at `ef9f52fc9` from its landing `72f26bc5c`, its verify A-19569 and batch logs A-19579 and A-19580):** `ACCEPT` and `WROTE` in `checks.sh`, the landing-state paragraph, "Merge watch", the criteria map's T-1860 row, "The non-member landings", "Build", E1537S5-02, -07 and -19; `src.mjs`, `voc.mjs`, the commit classes, the wording lint and the qa lint deltas re-run at `ef9f52fc9`.
- Any other non-member landing before the run (T-1806 most likely) is named by SHA in the request, or E1537S5-02 is BLOCKED.
- The publication precheck and `qa lint`, rerun at the final dev before the brief is committed.

## Source provenance

Read at dev `dfda10574cc9bc3d2dc764db1f161b0be209b88b`: the three landings with `git show d3a713025`, `git show 01c97ad5b` and `git show 5885fe1bf`; `hub/src/doctor/users.ts`, `hub/src/doctor/report.ts`, `hub/src/cli/doctor.ts`, `hub/src/cli/usage/doctor.ts`, `docs/hub/cland-doctor.md`; `hub/src/setup/steps/signin.ts`, `hub.ts`, `aide.ts`, `hub/src/setup/runner.ts`, `hub/src/setup/hub.ts`, `hub/src/cli/usage/setup.ts`, `docs/hub/cland-setup.md`; `hub/src/hub/daemon.ts` (`userAdd`, `userInvite`, `userList`, `authMode`), `hub/src/hub/users.ts` (`firstAdmin`, `add`, `mintInvite`, `validateMode`), `hub/src/hub/web-edge.ts` (`invite`), `hub/src/hub/dispatch.ts` (`requireLocalHuman`, `requireUserManagement`, the session launch), `hub/src/cli/auth.ts`, `hub/src/cli/usage/auth.ts`, `hub/bin/cland.ts`; `hub/src/adapters/sessions.ts`, `processes.ts`, `requests.ts`, `contract.ts`, `hub/src/hub/agents-topic.ts`, `hub/src/protocol.ts`, `shared/wire/index.ts`, `web/src/sessions/SessionRow.tsx`, `nvim/lua/cland/panels.lua`, `state.lua`, `site/src/content/docs/docs/sessions.mdx`, `docs/hub/adapters-and-sessions.md`; `hub/src/init/config.ts` (the `[auth]` template); `hub/test/lint-closed-item-wording.ts`; `test-support/fixture-environment.ts`; `.agents/skills/qa/qa-demo-policy.ts`; every test file of the cases and its per-test note; `hub/test/tiers.json`, `docs/agents/tests/index.md`; the kits at `K`, `M3`, `M4` and the briefs at `P1` to `P4`; the stage-4 report and observation in A-19486; the verify and batch logs A-19535, A-19537, A-19540, A-19543 to A-19547, A-19569 and A-19574, and the reconciliation A-19541; the items with `task view --json` (T-1835 to T-1838, T-1860, T-1806, T-1864, T-1865 and the known items) and the plan with `task plan show E-1537 --json`. T-1838 read at its head `a15551d77` (`git diff bd7d81667 a15551d77`: `site/src/content/docs/docs/users.md`, `web-and-phone.mdx`, `cli.md`, `features.md`, `site/astro.config.mjs`, `site/test/users-docs-source.ts`, `site/test/users-docs.test.ts`, `hub/test/users-docs-invite.test.ts`, `hub/test/remote-docs.test.ts`, `hub/test/tiers.json`, `docs/agents/tests/index.md` and two notes); T-1860 at `2eb80d321` and T-1806 at `6c6506a38` (their file lists, to check this brief's expectations against them).

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`stage` / `--stage`: `the users stage`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Report the stage result to the requester in the epic topic. Publish evidence only after E1537S5-90's clean scan, by path, never inline (T-1864); keep recorded evidence if publication fails and follow the qa skill's recovery procedure.

## Landing markers

This brief was drafted at `dfda10574` before T-1838 and T-1860 landed, with a marker on every line that needs either landing (see "Rows to verify after landing"). T-1860's markers were filled at `ef9f52fc9` and T-1838's at `84dcc428e`; none remains. E1537S5-04 counts the markers at the run; a non-zero count makes the run BLOCKED.
