---
id: R-228
kind: release
version: 0.1.2
title: Working with items
state: open
labels: []
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-11T17:47:48.610Z
updated: 2026-10-15T08:09:43.567Z
---

## Goal

v0.1.2 "Working with items": the human works with items in cland as a full planning and tracking tool, not only watches status in the side panel. The core is the item explorer (T-243) with the human's item card (T-244), the release scope by epics (T-237, T-238), categories outside epics (T-245), id prefixes by kind (T-241) and done items distinct in the graph (T-242). Everything else is around that core.

## Notes

Scope by decision D21 (2026-10-11): everything from the v0.1.1 run that needed the human's decisions or design grilling. Grilled with the human on 2026-10-12 in three rounds (recorded above and in `docs/spec/v0.1.2.md` §3 and §4). Version 0.1.2 is the human's recorded version. The build ran in two lanes, hub and Neovim. "Test speed: quick wins" (E-386) joined the release on 2026-10-14, after D29 and the test-speed research Q-384. The crew was the same as in v0.1.1: Implementers on Codex gpt-6.1-sol, Claude Code roles on sonnet and a Reviewer pool of 2. The stand-in cland-impl answered for the human under D24. T-248 (the key-encoding matrix in the human's own terminals) moved to Tech debt and does not hold the release.

The goal: the human uses cland to plan and track items, and no longer only watches status in the side panel. The core is the item explorer and its card, the release scope by epics, categories outside epics, id prefixes by kind and done items shown distinctly.

What the human can now do, by epic:

- **E-268 Suite spend and Linux portability.** The suite runs on Linux as it does on macOS. On a c-8 DigitalOcean droplet, as an ordinary user, typecheck and the full suite are green: 1832 tests pass, and six platform skips each name a reason (A-2028). A spawn census (`node hub/test/spawn-census.mjs run`) shows where the suite's processes come from. The big sources are cut: teardown by process group, a prepared fixture repository and a process listing that works on both platforms. QA clear: qa-2026-10-13-27-6 (A-2031).
- **E-269 Prefixes and categories.** An id shows its item's kind: `R-` release, `E-` epic, `T-` task, `Q-` question, `M-` map, `S-` spec, `C-` category. All kinds share one counter, and any prefix with the right number still finds the item, so old `T-` ids keep working. The live tracker migrated on 2026-10-13. Tech debt (C-216), Bugs (C-325), Follow-ups (C-326) and Ideas (C-327) are root containers beside the releases. Agents file finds into them with `--parent C-n`, and the Coordinator takes their work when the release has nothing unblocked (`idle_from`). The items panel ends with a count line for the categories. QA clear: qa-2026-10-13-27-4.
- **E-270 Status, fields and instrumentation.** `planned` now comes from the epic plan: the items of the current stage are planned, and the hub moves the next stage when one completes. The release scope shows only the release's own items, and everything else is under the `all` filter. The card gets its fields without a request per row: the closing time, verified/total and the latest verify result. The journal now records session usage. Tasks carry a required `size`, an optional `regression_of`, the model of every launch and the verdict scope, so models can be compared within size classes. QA clear: qa-2026-10-13-27-8 (A-2074).
- **E-271 Remote executors.** `cland verify` runs a suite on a DigitalOcean droplet through cland's own executor interface. The executor is chosen per run (`--executor local|droplet`), with a per-project default under `[verification]`, and there is no silent fallback. The local machine stays one executor with a cap of one. The hub enforces the remote budget, the lifetime, the run timeout and a daily cap (defaults 4, 110 min, 75 min and $5 a day; this project ran on 2, 60 min, 50 min and $3 a day). It also runs a watchdog and sweeps droplets by the `cland` tag. Spend is kept in a host-wide ledger, `~/.cland/executor/spend.json`. The token stays in the human's shell and is never stored. A c-16 run took 1057 s on the hub phase for $0.16: about 25% faster than a c-8, at about 1.7 times the cost. QA clear: qa-2026-10-14-27-9.
- **E-272 Accounts and limits.** Accounts are named in `~/.config/cland/accounts.toml` (names and paths only, never a secret). `roles.toml` and launches pin a session to an account by name. The sessions panel opens with an accounts block: each window the harness reports (5-hour, weekly), its used share and its reset time. A limited account is highlighted and refuses new launches, and the human picks another; cland never rotates accounts or fails over. The Claude adapter polls `claude agents --json` at most once per 30 s per config directory, and a signed-out directory raises one event and one message (T-265). QA clear: qa-2026-10-14-27-11 (A-2531).
- **E-274 Inbox and the events view.** The inbox holds only what needs the human now, in four sections. Asks and approvals come first, then plan approvals. Requests to the human use the new `request` kind: a review, a QA or a handover. Messages come last. Each row leaves by its own rule, and the chip shows the inbox count. Everything else is in the events view (`␣E`): newest first, grouped by day, 200 rows at a time, with `A` to load older rows and `gM` to mute a subject. The old notification list with `d`/`D` is gone. QA clear: qa-2026-10-13-27-2 (A-1673), after a first run failed on a duplicate warning row (T-310, fixed).
- **E-275 Sessions: stopped sessions, verifiers' items, the queue line.** `r` resumes a stopped session through the harness's own resume and keeps its name, role and claim. `d` archives a session. A stopped crew session archives itself one hour after its item merges or closes, or otherwise 24 hours after it stops; Aides never archive themselves. `cland session prune --older-than` deletes old records. A verifier's row shows its latest hold and `+N`, and a pending request shows dimmed. The `verify:` line summarises the queue and opens the queue view. The human's `npm test` goes through the same queue unless `--force` is given. QA clear: qa-2026-10-13-27-3 (A-1820).
- **E-276 The explorer and the card.** `␣e` (also the startup view) opens an outline tree in the centre. The root is the current release with its epics and tasks, and folded roots hold the categories, the unscheduled items and the other releases. The card of the row under the cursor sits beside the tree, with the summary and the facts first and the agents' text folded. Rows show done/total, status bars, the stage and the lead. Done items follow the live ones in the done colour, and `D` hides them. `s` rescopes the tree, with breadcrumbs. The explorer edits nothing: `m` and `M` send the Coordinator a message about an item or a selection, and `M` sends it in the item's own topic. At release scope the side panel shows epics as folded rows. Done items stay readable in the graph, the panel and the board. The plan was approved by the stand-in under D24. QA clear: qa-2026-10-14-27-10.
- **E-386 Test speed: quick wins.** A task run now verifies what its diff selects, under wider package rules. Replayed on the last 40 merges, the selection goes from full 37 / hub-only 2 / Neovim-only 1 to 26 / 9 / 5. A Neovim-only run took 112 s, against about 15 minutes before. Fake harnesses default to fast turns, and timer-bound tests run on schedules set through the environment (T-389: −26% over the harness files, measured under load). `hub/test/durations.json` sets a budget: a new test over 5 s or a new file over 60 s fails the run, and a known one that slows down is reported as a `duration regression`. `cland` loads only the subcommand it runs: `--help` loads 2 `hub/src` modules, and its median fell from 186 to 84 ms under load. Fixture hubs skip the start-up orphan sweep, and teardown signals only the processes the test recorded. Inspection spawns in default-subscriptions fell by about 63%, and a partial full-run census counted 23,476 against 29,203. QA (qa-2026-10-15-27-12, A-2738) measured 1171 s less common hub test-time and a full run 230 s shorter (919 s against 1149 s), against the before run A-2450 and the after run A-2714. The census is a lower bound of 23,684 inspection spawns at 22.6 per daemon start; the full targets move to T-448, and the under-5 s timer target to T-443.
- **E-273 Release v0.1.2 from the item.** If a tracker storage operation stalls while the hub serves, the hub logs it, tells the sessions and the workbench, and exits non-zero. No mutation admitted after the stall commits, and `hub/README.md` describes the restart (T-253). A cancelled suite attempt no longer supersedes green cache evidence for its tree, while a failed one still does (T-254). T-253 merged as a30df82c and T-254 as 8b2a3d7a.

Decisions of the run:

- **D23 accepted (v0.1.2 §4).** The tracker-stall detection and the bounded stop from v0.1.1 stay as shipped. The serving-time fail-fast exit is T-253, ordinary tech debt, and it ships in this release.
- **D24 (2026-10-12).** The stand-in cland-impl answers every ask on the human's behalf, including the explorer plan approval.
- **D25 (2026-10-13).** Review first: `cland verify` runs only after a clear review, at the exact reviewed head. Droplets serve as a second Linux slot, with the `cland` tag, at most 30 minutes of life (45 for c-8 acceptance runs), one at a time and at most $2 a day.
- **D26** is reserved for T-282's narrowing fallback; no use of it is recorded.
- **D27 (2026-10-13).** E-271 ships the remote budget, lifetime, run timeout and daily cap as config that the hub enforces (defaults 4 / 110 min / 75 min / $5; this project 2 / 60 min / 50 min / $3). c-8 is the default size, and one c-16 run measured the speed. No phase split this release.
- **D28 (2026-10-14).** The project switched its verification to droplets (`executor = "droplet"`, `remote_budget = 2`) after T-347 merged. The release's final local run covers the macOS-only cases.
- **D29 (2026-10-14).** A task verifies only what its diff selects, plus the test files it touched, and never `verify all` by default. Full suites run on integrated `dev`: per batch of about three merges, at each stage and epic close, and before the release.
- **Lane flow (stand-in, 2026-10-13).** The edges between consecutive epics in a lane were removed. The next epic starts once the previous one's code is merged, and its merges wait for the previous epic's QA verdict.
- **Local task gates (human, ask de65131f, 2026-10-14).** Tasks verify locally on the Mac until the shared Linux fixes (T-429, T-430) merge. The Reviewer judges the same head's local run in place of a red droplet run.
- **Duration budget (human, ask 225afa4b, 2026-10-15).** The budget fails a run only for a test or file new to the manifest. A known one over budget reports a `duration regression` line and does not fail the run.
- **E-386 amendments (Coordinator and human, 2026-10-14/15).** C2 posts the measured census; its targets (under 12,000 inspection spawns, at most 13 per daemon start) move to T-448, and starts per test are compared with the nearby census A-2630. C3's bound is at most 28 full runs in the replay. C5 (human, ask b622dab9): each timer-bound test falls by at least 50%, and the under-5 s target moves to T-443.
- **Cover-quiet (Coordinator, 2026-10-15 01:20Z).** While the Coordinator holds the verify slot for an integrated run, no session runs any test, targeted files included. Before this rule, three integrated runs in a row went red on load-induced flakes.

Deferred checks:

- **T-443:** re-measure T-392's inspection diet on an idle machine. Its 15% whole-file target could not be measured during the build, because the queue never emptied.
- **T-448:** inspection diet, part 2: the full-run census target of under 12,000 inspection spawns moved here from E-386 C2.
- **T-390 C4 (done):** the first suite result the hub posted after the 07:05Z restart carried the `duration regression` and `suite budget overhead` lines (E-386 QA, A-2718).
- **Droplet verification for tasks:** the project default is `droplet` (D28). Task gates ran locally from de65131f until the Linux fixes T-411, T-429, T-430, T-432, T-433, T-434 and T-435 merged. Tasks return to droplets with the hub restart on the release cover. A green full Linux run at the release tip is not part of this release's definition of done.
- **MicroVM backend:** T-349 failed as run on environment gaps: no openssh-client and a nofile limit of 1024. The speed and limits checks passed (hub phase 785 s). A third run, about $0.25, is the human's call for v0.1.3.

Known issues filed during the build:

- Bugs (C-325):
  - T-337 Implementers are refused a read-only `cland session list` (checked as session.launch)
  - T-339 `cland task view` (text) crashes on a hub frame without criteria counts (version skew)
  - T-341 A Claude Code relaunch keeps the tool schemas cached at first launch
  - T-360 The Codex fake answers the first channel block of a digest, not the message addressed to it
  - T-370 The Claude Code mod bridge uses `$.process.spawn`, which the mods API no longer offers
  - T-372 A Claude Code session relaunched by the hub stays exited with no pid recorded, so deliveries stop
  - T-421 A stage holding an evidence-only task stays open until the epic closes
  - T-422 Tests register temporary projects in the real host executor ledger
  - T-428 Droplet verify submits time out at 15 s although the hub accepts them
  - T-442 The sessions.test.ts hard-limits display test fails when the reset falls after local midnight
  - T-444 Human-queue waiters each poll suite.slot about 2.4 times a second
  - T-445 The suite.test.ts cleanup-observer test times out under full-suite load
  - T-446 The artifact-browser attachments test connects before its Neovim socket is up
  - T-447 The claude-code-adapter "harness never confirmed" retry test failed once in a census run
  - T-449 The session-stop-races Codex forced-stop test reads probe.json before it is written
  - T-450 A hung.test.mjs fixture run leaves its runner and child alive for hours
  - T-453 The executor-run remote-verify scan reads a transient spend.json.lock.break entry
- Tech debt (C-216):
  - T-290 An unknown `permissions` launch value is swallowed, and the launch proceeds
  - T-300 nvim artifacts "prompt drafts are editable full buffers" fails under full-run load
  - T-302 Suite spend, the production remainder: territory git, verdict reads, doctor probes
  - T-323 Plan navigation sent before the initial snapshots is discarded instead of deferred
  - T-338 The opencode-adapter "two changing catalogs" readiness times out under heavy load
  - T-373 The executor interface should declare prepare and reap (all nine operations)
  - T-374 The test shard map conflicts on every parallel test addition
  - T-436 QA catalogue case EXPLORER-001 asserts the lead column at a width where it is hidden
  - T-440 account-limited.test.ts waits on real reset and backoff clocks (about 100 s per file)
  - T-452 Tracker conflict captures pile up (1,661 .conflict files with no pruning)
  - T-460 `cland --help` median is 55.7 ms against T-391's 50 ms idle target
- Follow-ups (C-326):
  - T-410 Identify fast detached inherited-pipe writers after a stalled run, so the hub can reap them
  - T-443 Idle re-measurement of T-392's inspection diet
  - T-448 Inspection diet, part 2 (full-run census under 12,000)

The retrospective artifact of the run follows the release and will be linked from R-228.

## Decisions so far

Round 1, 2026-10-12 (the human answered yes to all):

1. Goal as above; the release is named "Working with items".
2. Scope: everything under this item is in v0.1.2. T-248 is the human's own task (their terminals), not crew work, and does not hold the release. Two lanes: workbench (the core, T-247 inbox, T-239 sessions panel, T-257 stopped sessions) and hub (T-256 remote executors, T-246 queue UX, T-240 accounts and limits, T-255 per-model performance, T-253, T-254).
3. Order: the hub lane starts with T-256 so the rest of the build runs its suites on cloud VMs; the workbench lane starts with the explorer core.
4. Fog and AFK work: one wayfinder map for the explorer cluster (mockups on the canvas and a Neovim prototype, as in v0.1); in parallel, AFK: a prototype run of the suite on a DigitalOcean 8 vCPU VM (T-256), research on harness limits and account selection (T-240), research extracting per-model task data from the journal (T-255).
5. The DigitalOcean token lives in the human's shell environment (`DIGITALOCEAN_TOKEN` in `~/.zshrc`); the prototype reads it and never stores it; its VMs are tagged and swept.
6. D23 accepted: detection and the bounded stop stay as shipped in v0.1.1; the fail-fast exit is T-253, ordinary tech debt, not raised.
7. Crew as in v0.1.1 (Implementers on Codex gpt-6.1-sol, Claude Code roles on sonnet, Reviewer pool 2); plan approval `human` for the explorer epic only, `none` for the rest.

Round 2, 2026-10-12 (the human answered yes to all; recorded in docs/spec/v0.1.2.md §3.1 to §3.7 and on each ticket):

1. T-241: the number is the identity, the prefix follows the kind (R-, E-, T-, Q-, M-, S-, C-), one shared counter, any prefix resolves, migration renames files and frontmatter references only.
2. T-238: planned derives from the epic plan (the current stage), the hub moves the next stage; by hand without a plan; the release scope shows only its own items, the rest under the all filter and a count line.
3. T-242: done nodes in a done colour with a green glyph, no strikethrough; containers carry done/total and the count in work; the same for done rows elsewhere.
4. T-239: the latest hold and +N; a pending request shows dimmed until the hold.
5. T-257: resume through the harness, d archives, automatic archival of crew sessions (one hour after merge or close, else 24 hours), never Aides, more shows the latest 20, cland session prune.
6. T-246: no general queue API; the verify line becomes the queue summary and opens the queue view; the human's npm test goes through the queue unless --force.
7. T-247: the inbox is the now layer only, sections by kind, newest first, capped; events move to an events view; the form from a mockup in the explorer map.
8. The explorer map's destination: spec v0.1.2 sections for the explorer and the item card with accepted mockups and a Neovim prototype, ready for epics; the map holds T-243, T-244, T-237, T-245 and the inbox mockup; `docs/spec/v0.1.2.md` started as a draft.

Round 3, 2026-10-12 (charting the explorer map; the human answered yes to all but amended editing; recorded in docs/spec/v0.1.2.md §3.8 to §3.11, GLOSSARY, and on T-243, T-244, T-245, T-237):

1. The explorer: an outline tree in the centre, root the current release, folded roots for categories, unscheduled, other releases; the card follows the cursor; s rescopes with breadcrumbs; ␣e, gi, D.
2. Rows per level with done/total, status bars, stage, lead; live by rank, done after, in the done colour.
3. Summary: a ## Summary section by the creator, first-paragraph fallback; the card replaces the item view.
4. No hand editing from the explorer (the human: it would add chaos; steering goes through the Coordinator): the one action is a quick message to the Coordinator in the item's topic, also on a selection ("plan these").
5. Categories as a root container kind seeded at migration; agents file with --parent C-n; promotion by message; the Coordinator's idle_from; the tech-debt label retires.
6. The side panel at release scope: epics as folded rows with fractions and breakdowns.
7. Mockups and the prototype as tickets of the explorer map T-264 (T-259 explorer boards, T-260 card boards, T-261 inbox and events boards, T-262 the Neovim prototype after the mockups, T-263 the final wording), with one research ticket T-258 (summary fallback, prior art) running AFK.

T-255, 2026-10-12 (after the research research/model-performance): instrumentation only in v0.1.2 (usage journaled, a required size field, regression_of, the model of every launch, the verdict scope); no model rotation, the human measures later on another project; the crew stays. Recorded in docs/spec/v0.1.2.md §3.12.

T-240 and T-256, 2026-10-12 (after the research and the prototype): accounts registry, limits from sessions and rare harness polls, an accounts block in the panel, routing without rotation (spec §3.13); the executor behind a provider-agnostic interface with the first backend chosen after the MicroVM research, T-267 (the suite's spend) and T-266 (Linux portability) first in the hub lane (spec §3.14, §4 order amended).

## Open

The planning is done (2026-10-12): the spec is complete, the explorer map T-264 is closed, the nine epics below are published. The build is led by the cland-impl session, as for v0.1; the human approves E09's plan (`gp`, then `a`) before any of its items launch, everything else runs under `[plan] approval = "none"`. The MicroVM experiment of E04 (about $0.12) is approved by the human; the DigitalOcean token is in the human's shell environment and reaches crew sessions after the hub restarts.

## Epics

Published on 2026-10-12 from `docs/spec/v0.1.2.md` §4, children of this release, labelled `epic`, `v0.1.2` and `ready-for-agent`. Two lanes: the hub lane E01 to E06 and the Neovim lane E07 to E09, which joins the release E06.

| Key | Id | Title | Blocked by |
|---|---|---|---|
| E01 | T-268 | Suite spend and Linux portability | none |
| E02 | T-269 | Prefixes and categories | T-268 |
| E03 | T-270 | Status, fields and instrumentation | T-269 |
| E04 | T-271 | Remote executors | T-270 |
| E05 | T-272 | Accounts and limits | T-271 |
| E06 | T-273 | Release v0.1.2 from the item | T-272, T-276 |
| E07 | T-274 | Inbox and the events view | none |
| E08 | T-275 | Sessions: stopped sessions, verifiers' items, the queue line | T-274 |
| E09 | T-276 | The explorer and the card | T-275, T-269 |

## Comments

### human · 2026-10-12T08:43:15.306Z

Round 1 of the v0.1.2 grilling (2026-10-12) recorded in the body: goal, scope and lanes, order, the wayfinder for the explorer cluster and the AFK prototype and research, the token, D23 accepted, the crew.
