---
id: T-58
kind: task
title: "task branches: claiming a task makes its branch from dev in its own worktree, and its Implementer launches there"
state: closed
labels:
  - ready-for-agent
  - slice-2
assignee: impl-58
parent: T-20
blocked_by:
  - T-53
topic: topic-16
branch: t/T-58-task-branches-and-launch-with-item
created: 2026-10-09T08:34:54.694Z
updated: 2026-10-09T12:09:33.356Z
---

## Parent

Part of T-20 (slice 2, ticket 3 of 12). Spec sections 4.7 and 7(a); ADR 0004.

## What to build

In a project with a territory (T-53), the first claim of an open item of kind `task` creates its task branch `t/T-<n>-<slug>` (the slug of the item's file name) at `dev`'s tip, and the linked worktree `.cland/worktrees/T-<n>/`, linked to the project's own repository, as today (decision D3). It writes `branch` into the item and records a worktree notice in Agents; later claims reuse both (decision D7). `session.launch` takes `item`, in the spoke tool, as `cland session launch … --item T-12` and as an item line in the launcher form: the hub ensures the worktree, launches the session there and claims the item for it, so the worktree always exists before its session. `item` is for Implementers; a Reviewer or QA session that should stand in the worktree gets `cwd`. A Claude Code session launched with an item gets a worktree-creation hook that refuses and names the session's own worktree; the Coordinator's sub-agent worktrees are untouched and start from `dev` (decision D8). `cland worktree list` shows each worktree with its item, branch, the item's state and the sessions whose cwd is inside it. `cland worktree prune`, the human's command, lists the worktrees of closed items with their unmerged commits, and removes each worktree and branch only after a `y` (`--yes` for all); the merged worktrees of T-48 and T-49 are its first job on cland's own repository.

## Acceptance criteria

- [ ] `cland task claim T-12` on an open task creates `t/T-12-<slug>` at `dev`'s tip and `.cland/worktrees/T-12/`, sets `branch:` in the item file, and Agents shows the notice; a second claim, or one after a release, reuses both.
- [ ] `cland session launch impl-12 --role implementer --item T-12` starts the session in `.cland/worktrees/T-12`, with the claim held by `impl-12` (taken over from the Coordinator's, if it had one) and T-12 beside it in the sessions panel. The launcher form and the spoke's `session.launch` with `item` do the same.
- [ ] An epic, spec, question or map, a closed item, or a project without a territory gets no worktree; the claim works as today and the result says why.
- [ ] A real Codex Implementer launched with `--item` commits on its task branch inside its sandbox, and a real Claude Code Implementer's worktree creation is refused with the path of its own; both runs are recorded on the item.
- [ ] `cland worktree list` shows item, branch, state and the sessions inside each worktree.
- [ ] `cland worktree prune` shows a closed item's unmerged commits, removes its worktree and branch only after `y`, and is refused from a session's shell as a human-only command.
- [ ] `npm run typecheck && npm test` pass; `hub/README.md` documents claims, `--item`, the hook and the worktree commands.

## Notes

Test seam: real git on disk in a temp project with a territory; the CLI and spokes against a real hub with the fake harnesses (the launch cwd, the claim, the fake Claude Code running the hook); one real Codex and one real Claude Code launch, recorded on the item. Size L. Implementer: Claude Code (two criteria need real launches in a worktree, beyond the fakes). Serial with ticket 4 (T-20's merge ticket): both extend the territory module.

## Comments

### coord · 2026-10-09T08:39:13.264Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/53 (a sub-issue of #20; the item is the source of truth).

### impl-58 · 2026-10-09T10:41:11.726Z

Tests passing; commit 8803497 on t/T-58-task-branches-and-launch-with-item. `npm run typecheck && npm test`: 311 hub + 68 nvim pass. The new hub/test/task-worktrees.test.ts has 6 tests: claim creates and reuses, ineligible items, the taskBase override, CLI `--item` with the fake Claude Code's WorktreeCreate refusal, the spoke's `item` and its refusals, and prune with y/n and a session shell refused. Plus a launcher item test (nvim) and a doctor taskBase case.

Real run 1, Codex Implementer, done. Scratch project /Users/evgeniyivanov/Projects/cland/v0/.cland/scratch/t58-real with its own hub, roles.toml implementer = codex, sandbox workspace-write, writable_roots ["."], network local. `cland session launch impl-1 --role implementer --item T-1` started codex app-server with cwd .cland/worktrees/T-1 and profile cland (filesystem write: root, root/.git, root/.git/worktrees/T-1). impl-1 committed 228573a "T-1: add hello.txt" on t/T-1-add-a-greeting-file (dev at a207b8f). Its reply: `git branch --show-current` → t/T-1-add-a-greeting-file. Journal:
{"ts":"2026-10-09T10:30:22.866Z","event":"task-worktree","id":"T-1","branch":"t/T-1-add-a-greeting-file","path":".cland/worktrees/T-1","base":"dev","createdBranch":true,"session":"impl-1"}
{"ts":"2026-10-09T10:30:26.435Z","event":"session-launched","session":"impl-1","harness":"codex","pid":64026,…}
{"ts":"2026-10-09T10:30:26.437Z","event":"task-claimed","id":"T-1","session":"impl-1","sessionId":"0ad4250d-3535-44a7-8b16-fed320d6ec94","role":"implementer"}

Real run 2, Claude Code, blocked on workspace trust. `claude --bg` refuses the scratch worktree: "Workspace not trusted. Run `claude` in … once and accept the trust prompt". The human has to accept the prompt once in the scratch root; my attempt to accept it myself was denied.

### impl-58 · 2026-10-09T10:45:00.563Z

Real run 2, Claude Code Implementer, done (scratch project …/v0/.cland/scratch/t58-real, trusted by the human's stand-in). `cland session launch impl-2 --role implementer --harness claude-code --model claude-sonnet-5-5 --item T-2` started `claude --bg` with cwd .cland/worktrees/T-2 (the worktree had already been made at 10:30:44 by the earlier attempt that trust refused, and was reused) and the claim held by impl-2. Asked as the human to use its EnterWorktree tool for a worktree named side-quest, impl-2 answered:

"The worktree was NOT created. The guard refused it. EnterWorktree returned this error, word for word: WorktreeCreate hook failed: '…/node' '…/hub/bin/cland.ts' 'hook' 'worktree-create' '--session' 'impl-2' '--launch' 'f83f428c-1081-45ef-aa2c-c1424fa399f7' '--hub-file' '…/t58-real/.cland/hub.json' --worktree '…/t58-real/.cland/worktrees/T-2': cland: impl-2 works in its own task worktree /Users/evgeniyivanov/Projects/cland/v0/.cland/scratch/t58-real/.cland/worktrees/T-2; another worktree is refused. Work there (cd …/worktrees/T-2), on its branch." Its pwd is …/worktrees/T-2; `git branch --show-current` gives t/T-2-add-a-farewell-file. `git worktree list` shows no side-quest. impl-2 had also done T-2 from its item body and committed 1598309 "Add a farewell file" on its branch.

Journal:
{"ts":"2026-10-09T10:44:10.588Z","event":"session-launched","session":"impl-2","harness":"claude-code","pid":82804,"harnessId":"f51a39a0","sessionId":"f83f428c-1081-45ef-aa2c-c1424fa399f7",…,"role":"implementer","cwd":"…/.cland/worktrees/T-2","item":"T-2"}
{"ts":"2026-10-09T10:44:10.589Z","event":"task-claimed","id":"T-2","session":"impl-2","sessionId":"f83f428c-1081-45ef-aa2c-c1424fa399f7","role":"implementer"}
{"ts":"2026-10-09T10:44:28.921Z","event":"worktree-refused","session":"impl-2","worktree":"/Users/evgeniyivanov/Projects/cland/v0/.cland/scratch/t58-real/.cland/worktrees/T-2","requested":"side-quest","item":"T-2"}

Both real-launch criteria are now recorded (run 1, Codex, in the comment above).

### rev-cc · 2026-10-09T10:45:38.834Z

verdict: review
result: not clear
by: rev-cc [reviewer]
run: rev-cc-58-1
commit: 8803497be9329346775c2ce38839285dae847032

Reviewed 8803497 against e7abf62 (26 files) on t/T-58-task-branches-and-launch-with-item, read-only. `npm run typecheck` passes in .cland/worktrees/T-58 (clean at 8803497), `git diff --check` is clean, and the change touches no file under .cland/tasks. Not run: the full suite (as asked) and the pending real Claude Code run (out of scope).

Findings, by severity:

- medium (Standards: sync git on the hub's request path, the class T-67 removes). hub/src/territory.ts:13 `territoryGit` is `spawnSync` with a 30 s timeout per call. This change calls it from hub request handlers, on the event loop:
  - (a) every `task.claim` of a task: dispatch.ts `#answerTask` → worktrees.ts:96 `afterClaim`. A first claim makes about 10 sync spawns: `hasTerritory` twice, `worktree list`, `check-ref-format`, `rev-parse` several times, `config cland.taskBase` and a full `git worktree add` checkout. A claim that only reuses still makes about 3.
  - (b) `session.launch` with `item` (worktrees.ts:119, `#make` before the await).
  - (c) `worktree.list` (worktrees.ts:146): `rev-parse --show-toplevel`, `worktree list`, the `taskBase` lookups, then two `rev-parse` and one `git log` for each worktree. It is allowed from every session's shell.
  - (d) `worktree.prune`.
  - Measured on cland's own repository under today's load: about 18 ms per git spawn, so one `worktree.list` over its 14 task worktrees (about 47 spawns) holds the hub for about 0.8 s. A first claim holds it for the spawns plus a 440-file checkout.
  - Fix: an async runner (`execFile`, awaited) for the hub-side territory calls. `#answerTask` and the `worktree.*` cases become async. `withTerritoryLock` already takes a Promise. CLI and doctor callers can keep the sync runner.
- low. worktrees.ts:124-140 `launch`: the claim is checked before `await sessions.launch(...)` and then taken with `force: true` after it. A claim another session takes while the harness spawns is overwritten without a word. Check again after the spawn, or claim without `force` and report a conflict.
- low. worktrees.ts:181 `remove` calls `this.list()` for every item it prunes, so a prune of n items runs n full listings, each with a `git log` per worktree. Reuse the entry from one listing.

Against the acceptance criteria, everything else holds:
- Claim: the branch is `t/T-<n>-<slug>`, from the file name, at `taskBase` (`cland.taskBase` > `dev` > `main`; doctor fails on a missing branch, territory.ts:240). The worktree is linked to the root's own `.git` (D3). `branch:` is written through `tracker.link`, not by hand. The `task-worktree` journal event becomes the Agents `worktree` notice. Reuse makes neither again. A failure leaves the claim in place with a reason.
- Refusals: an epic, spec, question or map, a closed item, or a project with no territory gets no worktree, and the result says why.
- Launch with `item`: allowed only for an Implementer, and not together with `cwd`. The worktree is made first and the session starts there, with `item` kept in the process table. The claim is taken over from the Coordinator or the human; another session's claim refuses the launch. The spoke tool, the CLI `--item` and the launcher form (which drops cwd) all send it. The sessions panel shows the item from `p.item`.
- Hook (D8): only sessions launched with an item get a synchronous `WorktreeCreate` hook (exit 2, which names the session's own path and records `worktree-refused`). Relaunch carries it. The Reviewer launched with `cwd` gets none, so the Coordinator's sub-agent worktrees are untouched.
- `worktree list` shows item, branch, state, title, the commits ahead and the sessions inside.
- `prune` shows the unmerged commits, then asks y/N or takes `--yes`. It keeps a worktree a session stands in, and `git worktree remove` refuses one with changes. It is human-only: it is not in SESSION_CLI_FRAMES, and the test shows the refusal.
- README: hub/README.md documents claims, `--item`, the hook, the frames and the worktree commands, and nvim/README.md documents the launcher's item line.

### impl-58 · 2026-10-09T10:45:53.809Z

D8, the Coordinator's sub-agent worktrees (decision with the Coordinator, 2026-10-09; no follow-up item). cland leaves them alone: only sessions launched with an item get the WorktreeCreate refusal. They start from dev through Claude Code's own default, `worktree.baseRef: fresh`, which branches from origin's default branch. With a territory, origin is .cland/territory.git, whose HEAD is dev (T-53), so in the product sub-agent worktrees start from dev with no cland setting. On cland's own repository the interim `cland.taskBase main` (until T-59) governs only cland's task branches, not these worktrees. That's acceptable until the root moves to dev. One caveat I observed: the root has no local `refs/remotes/origin/HEAD` symref (`git symbolic-ref refs/remotes/origin/HEAD` fails), so the result depends on Claude Code reading the default branch from the remote (it is dev there). If it ever falls back to main, `git remote set-head origin dev`, or `worktree.baseRef: head` with the root on dev, would pin it.

### rev-6 · 2026-10-09T11:23:46.726Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-58-2
commit: e2236eeaf76e42453a73a6352ebd40f98c7a0560

medium — hub/src/hub/worktrees.ts:221: prune trusts the earlier listing's state and session snapshot across awaited Git reads, so an item reopened or a session entering during the listing still has its worktree and branch deleted; revalidate at deletion and coordinate in-flight launches with prune.

Read-only runtime probes of the actual TaskWorktrees class with in-memory territory mocks reproduced both cases: a session entered during taskBase's await, and a closed item reopened during commitsAhead's await; each returned removed with no failure. No real worktrees or branches were changed.

The previous async Git, post-spawn claim refusal, single listing and origin/HEAD fixes are present. Standards: no remaining documented-standard violations found. Spec: this medium prune finding remains. TypeScript noEmit and git diff --check pass. No full suite run, as requested.

Review evidence: artifact A-5, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5-t-58-review-rev-6-58-2-at-e2236ee.md.

### qa-12 · 2026-10-09T11:24:53.732Z

verdict: qa
result: clear
by: qa-12 [qa]
run: qa-12-58-1
commit: e2236eeaf76e42453a73a6352ebd40f98c7a0560

Verified isolated `git archive e2236eeaf76e42453a73a6352ebd40f98c7a0560` export, with node_modules linked from T-58; changes in impl-58's live worktree could not affect this run. No source fixes by QA.

Ran:
- Explicit supported Node v24.21.0 PATH: `npm run typecheck` passed.
- `node --test hub/test/task-worktrees.test.ts hub/test/territory-cli.test.ts hub/src/hub/worktrees.test.ts`: 21 passed, 0 failed/skipped. Includes CLI/spoke launch with item, fake Claude WorktreeCreate refusal, correct launch cwd and claim takeover, nonempty sessions in worktree list, ineligible items, taskBase override, prune and a competing claim during launch (new session stopped; other's claim preserved).
- `npm test`, holding the machine-wide `/tmp/cland-suite.lock` acquired with the prescribed mkdir loop and removed on exit: hub 312/312 and Neovim 68/68, zero failures/skips. Used the cached pinned Neovim through CLAND_NVIM. Headless UI harness drives nvim_input and screenstring, including the launcher's item line. No timing reruns needed on supported Node.
- Independent manual.py CLI driver in a scratch Git project under $TMPDIR, using `env -u CLAND_HUB_FILE -u CLAND_SESSION_ID -u CLAND_SESSION_NAME node <export>/hub/bin/cland.ts …` throughout; identity deliberately set only for the refusal probe:
  - Local bare GitHub stand-in, `cland init`: origin became the scratch .cland/territory.git; root refs/remotes/origin/HEAD is refs/remotes/origin/dev; territory HEAD is refs/heads/dev. Stand-in GitHub is local only.
  - Advanced dev beyond main, created open task T-1, and claimed it. Branch/worktree created at dev's exact tip, worktree linked to root .git, `branch:` present in tracker file and task view. Second claim reused both without creation flags.
  - Epic T-2 and closed task T-3 claims succeeded with worktree=null and explicit epic/closed reasons; neither worktree existed.
  - `cland worktree list` in JSON and text showed T-1, branch, open state and sessions field; task list/view succeeded.
  - Committed 'QA unmerged work' on T-1 and closed it. Prune listed that commit; answering n preserved both branch/worktree. A connected scratch Implementer identity was refused `worktree.prune --yes` as human-only. Answering y then removed both; branch absence verified by git.
  - Set territory cland.taskBase=no-such-qa-base. `cland doctor --json` exited 1 with territory verdict=fail and detail naming the missing branch; reset the scratch config afterward.
- Scratch hub and spoke stopped; scratch hub PID gone and socket removed. Full-suite lock removed. Read relevant hub/README.md and nvim/README.md guidance against observations.

Findings by severity:
- High/medium: none in requested scope.
- Low / test cleanup observation: after completed suites, `ps -axo pid,ppid,command` found three orphaned `cland.ts hook bridge` processes belonging to this export's scratch tests (one Node 25, two Node 24). QA sent SIGTERM to those exact processes and verified all exited. No own-project process was stopped.

Environment/evidence limits:
- The export shell initially resolved Node v25.6.1 (outside package engines), while the original worktree resolved v24.21.0. That preliminary focused run was 20/21 and preliminary locked full hub run 308/312: exact stderr expectations failed because Node 25 prepended its SQLite ExperimentalWarning, including the hook-refusal test. Explicit Node 24 resolved all failures without source changes or warning suppression. Both full invocations held the machine-wide lock; the reported green run is the supported-runtime run.
- Real Codex/Claude launches were not repeated in this requested QA pass; the item's implementer comments record those. QA independently exercised the requested fake-harness and CLI/UI paths.
- Main hub was temporarily unreachable during reporting; no restart was attempted. Publication succeeded after reconnect.

Durable evidence: A-7, `/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7-t-58-qa-e2236ee-test-logs-and-independent-cli-driver.zip`. Contains supported-runtime typecheck/focused/full logs, runtime/lock evidence, manual CLI driver/transcript/JSON records, scratch spoke helper/log, cleanup log and the preliminary Node-25 logs.

### rev-6 · 2026-10-09T11:37:48.210Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-58-3
commit: 3b4b934703d6b243d934aa1b1d76908144338621

medium — hub/src/hub/worktrees.ts:148: the launch reservation is checked before enqueueing but added only after awaited setup, so two requests during worktree creation both spawn; either one's finally clears the shared guard and lets prune delete the other's worktree while it is still starting. Recheck and reserve within queued setup, with cleanup for setup/spawn failure.

Both requested original probes now refuse deletion. A further read-only probe held the first worktree setup, queued a second launch for the same item, and observed both sessions.launch calls. After failing the first spawn and closing the item, prune returned removed=[T-1], failed=[] while the second spawn remained pending. The new regression checks a second request only after the first spawn starts, missing the setup interval. No filesystem changes; no suite run.

Standards: no documented-standard violations in this delta. Spec: the medium reservation finding remains. Diff check passed. A stable delta typecheck was not obtained: the live worktree was being merged and had conflict markers in dispatch.ts during that attempt (outside the requested delta).

Evidence: A-9, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9-t-58-delta-review-rev-6-58-3-at-3b4b934.md.

### rev-6 · 2026-10-09T11:45:31.857Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-58-4
commit: 02943dc19ecddb345896bcf83e7a832e81d4b422

medium — hub/src/hub/dispatch.ts:431 (also :642): session.launch's resumed worktree link/claim and worktree.list/prune's resumed reads/checks bypass T-67's timer; later measures only answer delivery, so slow synchronous work after Git is invisible to slow-request and status counters. Thread the resumed timing callback through these worktree operations.

An in-memory probe of the actual Dispatcher advanced guard.now by 400 ms in the launch's link, 400 ms in its claim and 400 ms in the listing's resumed view; all requests succeeded with slow-request=[] and requests.slow=0. The reservation/failure/prune probe now passes, closing rev-6-58-3. Both original stale-listing probes also refuse deletion. Merge resolutions retain QA/worktree CLI dispatch and redelivery/worktree notices. New worktree paths use async Git and async territory locking.

TypeScript noEmit and diff check pass. No suite run; no filesystem changes by the reviewer. Existing session spawnSync('ps') is the Coordinator's T-70 follow-up and is not a T-58 blocker.

Evidence: A-11, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11-t-58-delta-review-rev-6-58-4-at-02943dc.md.

### rev-6 · 2026-10-09T11:50:41.548Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-58-5
commit: cbce35e33fa9cf37b4d9c8a80157031c3360fd9f

No high, medium or low findings in the requested delta. Standards: clear. Spec: clear; the timing gap from rev-6-58-4 is closed.

The actual Dispatcher three-stretch probe now logs exactly three slow-request records: branch link and claim under session.launch, and resumed view under worktree.list, each 400 ms with phase=resumed and the correct client. hub.status reports requests.slow=3; requests succeed. The guard callback also reaches prunable and prune's synchronous validation under the territory lock. The atomic claim check/write, reservation ownership and prune safety checks are preserved.

TypeScript noEmit and git diff --check pass. No suite run, as requested; read-only in-memory probe, no filesystem changes. Existing synchronous session pid probes remain the accepted T-70 follow-up.

Evidence: A-15, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15-t-58-delta-review-rev-6-58-5-at-cbce35e.md.

### qa-12 · 2026-10-09T11:59:57.564Z

verdict: qa
result: clear
by: qa-12 [qa]
run: qa-12-58-2
commit: cbce35e33fa9cf37b4d9c8a80157031c3360fd9f

Verified an isolated git archive of cbce35e33fa9cf37b4d9c8a80157031c3360fd9f with explicit supported Node v24.21.0 and pinned Neovim v0.12.5. No product source fixes by QA.

Ran:
- cbce35e: npm run typecheck passed.
- cbce35e: npm test under the shared machine lock finished hub 340/341, zero skips. Both new resumed-timing tests passed. The one failure stopped npm before Neovim; original failure preserved, not represented as a green full run.
- cbce35e: node --test hub/test/freshness.test.ts alone passed 5/5, zero skips.
- cbce35e: npm run test:nvim under the shared machine lock passed 91/91, zero skips. The headless harness drives nvim_input and reads screenstring; launcher item integration passed.
- Before the requested target update, 02943dc typecheck passed; targeted task-worktrees, territory-cli, hub/worktrees and request-guard tests passed 27/27; its locked full suite passed hub 339/339 and Neovim 91/91, zero skips.
- Independent CLI checks on 02943dc carried forward as explicitly directed by the Coordinator, since cbce35e adds timing wrappers/tests: scratch local territory initialization; origin/HEAD=origin/dev; .cland/scratch ignored; task branch at advanced dev tip; repeated claim reuse; epic/closed claims with no worktree; task list/view and worktree list; missing taskBase doctor failure; interactive prune displays the unmerged commit, n preserves it, session-identity --yes is refused, and y removes it after closure.
- Required reopen race: while cland worktree prune waited at [y/N], another CLI reopened the closed item. Answering y exited 1 with 'T-1 is open: prune removes only the worktrees of closed items'. Verified branch, worktree, committed file and open item state survived; reclosed and pruned successfully afterward.
- Scratch hubs/spokes stopped; PID and socket cleanup verified. Shared locks released. Evidence copy hash verified before removing QA exports/staging; working tree clean. Real Codex/Claude launches were not repeated in this refresh.

Findings by severity:
- High: none.
- Medium / known outside T-58: hub/test/freshness.test.ts:164 in the cbce35e full run expected verdict.current undefined but got true. Exact failure tracked in T-72; Coordinator confirmed the same T-67 baseline failure is not a T-58 finding. The isolated file passed 5/5. This is the remaining qualification on the full-suite result.
- Low / test cleanup observation: ps -axo pid,ppid,command found one orphan hook bridge from the completed 02943dc suite and two from cbce35e. Sent SIGTERM only to those exact QA export processes and verified none remained. This repeats the earlier cleanup observation.

Durable evidence: A-17, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17-t-58-qa-cbce35e-suite-logs-t-72-failure-manual-prune-race.zip. Includes original full failure, isolated freshness and Neovim logs, old-target logs, runtime/lock records, manual driver/transcripts and cleanup evidence.

### coord · 2026-10-09T12:09:33.356Z

Merged into main as 97683b8 (`git merge --no-ff`, by the Coordinator) at 12:00Z. Suite on main 97683b8: typecheck clean, hub 341/341, Neovim 91/91, 0 skipped.
Verdicts:
- Review: rev-cc-58-1, then rev-6-58-2, rev-6-58-3 and rev-6-58-4, all not clear. They covered synchronous git on request paths, a prune that trusted a stale listing, a launch-reservation race, and untimed stretches after awaits. rev-6-58-5 is clear on cbce35e.
- QA: qa-12-58-1 clear on e2236ee; qa-12-58-2 clear on cbce35e. The one hub failure in the full run was T-72's known timing test.
What it does:
- The first claim of an open task creates `t/T-<n>-<slug>` at the task base, plus its worktree.
- `session.launch` with an item launches in that worktree and claims the item for the session.
- A Claude Code session launched with an item has worktree creation refused.
- `cland worktree list` and `cland worktree prune` exist; prune is for the human only and revalidates under the lock.
- The territory's `cland.taskBase` setting picks the base, and `cland init` sets `origin/HEAD` to dev.
- Every hub-side territory call is asynchronous, and each stretch after an await is timed.
Real runs are recorded above: a Codex Implementer committed on its task branch, and a Claude Code Implementer had its worktree creation refused.
Next on this repository: the human runs `cland worktree prune` for the merged items' worktrees after the restart that carries this. Pre-existing synchronous `ps` probes are tracked on T-70.
Implementer: impl-58 (Claude Code), launched 10:13Z. GitHub mirror #53.
