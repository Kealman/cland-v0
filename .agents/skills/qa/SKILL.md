---
name: qa
description: Write an item or stage QA brief, request QA as the lead, or run the brief as QA and record its verdict.
---

A QA run has one file at its centre: the brief, `qa/briefs/T-<n>.md`, committed with the work and self-contained, because a rescue run cannot ask. The cases it names are Lua files, `qa/cases/<ID>.lua`, run with `cland --headless --qa`. Every case ends as one line of `.cland/qa/runs.jsonl`; the run ends as one verdict on the item.

`BRIEF.md` in this folder is the template. `qa-record.sh` in this folder runs a case or records a manual check and writes the `runs.jsonl` line; run it from the item's worktree, always as `sh .agents/skills/qa/qa-record.sh …` (`cland init` copies the file without its executable bit).

## If you are the Coordinator

1. **Write the brief.** Copy `BRIEF.md` to `qa/briefs/T-<n>.md` in the item's worktree (or on the branch the item will land from), fill in every section and commit it with the work. A brief has: the item; the build (branch and commit); the cases, each a catalogue id with its surface (`headless-grid` by default, or `tmux`, `web-terminal`, `hub-api`); manual checks, each a command with its expected outcome; what is out of scope; the grants it needs (none by default). Do not leave a section out: write "none". A case that does not exist yet is written first, in `qa/cases/<ID>.lua` with its catalogue header (see "Cases" below).
2. **Give the brief to the item lead.** The live claimant from `task.view` requests QA itself and handles not-clear findings and re-runs. Launch a QA holder when none is available. For an unclaimed item, act as its lead and request QA yourself.
3. **Handle an unclaimed item or unavailable QA.**
   - *For an unclaimed item, through the hub (preferred).* `send` to the `qa` role (launch one with `session.launch` if none is live) with first line `qa request T-<n>` and the brief's path (the brief carries its own build rule: the branch tip when the run starts). The QA session runs the brief, records the runs and writes a QA verdict through the hub; the merge gate counts it (decision D5).
   - *Rescue (fallback, or a second opinion).* `/codex:rescue --background --fresh --model gpt-6-astra "Run the QA brief in qa/briefs/T-<n>.md exactly"`, then `/codex:status` and `/codex:result`. A rescue run reaches no hub socket: it returns the `runs.jsonl` lines and the verdict in its output. Recover the run's evidence and lines as "Recovering a rescue run" below says, and record the verdict with `task.comment` (`verdict` qa, `result`, `run` the rescue job id, `commit`), saying in the text that it came through `/codex:rescue`. That verdict shows as yours and **the merge gate does not count it** (decision D5): it informs, it does not clear.
4. **Read findings escalated by the lead.** The verdict is `clear` only when every case in scope passed. A finding outside the item under test is a bug found aside: the Coordinator files it into the category Bugs (find its id with `cland task list --kind category`): `cland task create "<finding>" --parent C-<n> --label qa-found --label needs-triage --body-file -`, with the case id, the commit, the command and what it showed. Findings in the tested scope stay in its review/QA loop.

## After-stage QA

The Coordinator or epic's Lead writes `qa/briefs/T-<epic>-stage-<index>.md` from `STAGE-BRIEF.md` after reading `task.plan show` and the stage's merged items. Fill every section: exact stage name, ordered item ids, effective stage scope (`affected` or `full`, including after-stage item overrides), commands/cases and expected results, evidence, out of scope and grants. `affected` covers the stage's combined changes; `full` covers the product's complete QA scope. Commit the brief on dev before requesting the run. A stage uses no stage QA verdict when neither its default nor any item override requires after-stage QA.

Once all stage items are merged onto dev, its Lead or the Coordinator sends to QA in the epic's topic: first line `qa request T-<epic> stage <exact stage name>`, then the committed stage brief and full dev SHA. Keep the next stage's launches held until `task.plan show` reports this stage `closed`. A not-clear verdict keeps it open: file the findings, add their items to this stage through `task.plan set`, merge their fixes, then request a new run on dev.

QA takes a hold on the epic and reads its plan, stage progress and brief. Use a clean detached worktree at the requested dev SHA (the tracker in the root can have live edits). Before running, check that HEAD equals the request and `refs/heads/dev`, and that all listed stage items landed; otherwise report BLOCKED to the requester. Run and record the cases/manual checks with the existing script using the epic id and one unique run id. Record evidence before the verdict. Recheck dev after the cases: if it moved, keep the evidence and report BLOCKED; request a new run at the new build.

Write one `task.comment` on the epic with `verdict: qa`, `stage: "<exact stage name>"`, `commit: "<full tested dev SHA>"`, `run` and `result`. The CLI form adds `--stage "<exact stage name>"` to the normal verdict command. Clear only when every check in the stage brief passed. Stage verdicts carry no `verified` or `failed` epic criterion marks; the epic's Definition of done remains a separate run. Report `qa clear T-<epic> stage <name>` or `qa not clear T-<epic> stage <name>` in the request topic to its Lead. The hub refuses a stale dev build or unfinished stage; retry only the verdict when the evidence/build still qualify, otherwise request a fresh run.

## If you are the item lead

After committing and pushing the work to `origin`, send kind `report` to `qa` in the item topic, with first line `qa request T-<n>`, the Coordinator’s committed `qa/briefs/T-<n>.md` and the branch/head. Request QA when a brief was supplied; without one request review only, unless `task.view`’s `qaPolicy` has a non-none scope and `when: per-item`, or `qaCriteria` names criteria still needing QA marks; in either case report the missing brief to the Coordinator. Items with after-stage QA merge on review and receive their stage QA pass on `dev`. Fix not-clear findings and request a new source review before any new `cland verify` run at the new head. Keep the claim until merge. The hub’s `ready` event supplies the supervising Lead’s or Coordinator’s handover; a clear QA verdict needs no relay.

The Implementer requests source review first and runs `cland verify` only after a clear source verdict at the exact reviewed head. An unchanged head may reuse an earlier green run through the tree-hash cache; use its same-head result for full-suite evidence. QA case execution remains governed by the brief.

Default item subscriptions deliver status/verdict and verifier death or long idle to the lead at its next turn. Use `subscribe` for additional subjects and `subscriptions` to inspect them; routine updates use kind `progress`, requests and verdicts use `report`, blockers use `question` or `report`. `lead T-<n>` falls back to the nearest container Lead, then the Coordinator, for an unclaimed item; for a closed or unknown item address `coordinator` directly.

Inspect the request's send outcomes. `resolvedTo` names the selected QA session. A `queued` outcome waiting for the next free verifier means the hub will assign the request automatically and notify you; wait instead of resending it. If none is live, report the staffing blocker so a QA session can be launched. A later refusal notice names the retry rule.

## If you are the QA role

Accept `qa request T-<n>` from the item’s lead (the live claimant in `task.view`), a supervising Lead within its subtree, or the Coordinator; the Coordinator-authored brief it names is the whole job. Questions about the build or findings go to `lead T-<n>`; a missing brief blocks the run. Do not fix what you find.

Submit `cland verify --report <request-topic> --to <requester-name> --to <your-name>` with no mode for task runs (D29) and wait for its head-bound result before settling the verdict. A run on `dev` is full anyway: the Coordinator runs integrated suites per batch of about three merges, at stage and epic close, and before release. Use `cland verify all` only when the brief requires a full suite on a non-`dev` head. `cland suite` is the transition alias; see `docs/agents/tests.md` for admission and compatibility.

For an epic demo on clean integrated `dev`, QA may submit `cland verify all --occasion epic --report <request-topic> --to <requester-name> --to <your-name>`. The Coordinator owns `stage` and `release` occasions. Task heads and ordinary batches use one slot. Remote occasions use the free remote slots up to `[verification] shards` (default 2), reserving the whole group against the daily cap ($3 here); fewer than two slots or insufficient cap yields one whole run on one slot with a warn notice naming the cause. Record the merged result and each shard's machine, duration and cost, total cost, and wall time. Two ten-minute c-8 lifetimes estimate $0.0833 total at $0.25/hour; include provisioning/cleanup lifetime in measured costs. See `docs/agents/tests.md` for details.

The brief's full suite may run on the project's droplet executor. A green same-head Linux result satisfies the gate's suite evidence; its macOS-only cases are listed as skips and run in the release's final local run ("Release v0.1.2 from the item"). Name the executor, platform and droplet lifetime/cost in the verdict's evidence (cost is not applicable for local runs). For a check that needs macOS, request `--executor local` on a macOS host and retain any brief cases still needing that platform. The hub owns droplets; sessions never create, list or delete them themselves. `cland executor` controls belong to the human and Coordinator.

1. **Read.** `task.view` the item, then the brief. Work from the item's worktree (`.cland/worktrees/T-<n>`, or the path the request names) and apply the brief's build rule: `git status --short` must be empty and `git rev-parse HEAD` is the build, which you run and then name in the verdict. A request that names a commit is honoured when it equals HEAD; when it differs the run is `BLOCKED` and the verdict names both commits. A brief that names no cases, or a worktree that is dirty or off the branch, is `BLOCKED`: say so in the verdict instead of guessing.
2. **Choose a run id** of your own, unique for the item: `qa-<date>-<n>`, for example `qa-2026-10-09-1`.
3. **Run each case in scope**, headless-grid ones with the script, from the worktree:

   ```sh
   CLAND="$PWD/hub/bin/cland.ts" sh .agents/skills/qa/qa-record.sh run T-<n> <run> <CASE-ID>
   ```

   `CLAND` is the path of the cland executable (in this repository `hub/bin/cland.ts`, which is executable); in a project that has `cland` on its PATH leave it out. Ids are checked: the item is exactly `T-<digits>`, run and case ids are one path component of letters, digits, `.`, `_`, `-` starting with a letter or digit. The script runs `qa/cases/<CASE-ID>.lua`, keeps the grid and state dumps in `.cland/qa/T-<n>/<run>/`, prints the `runs.jsonl` line and appends it to `.cland/qa/runs.jsonl` of the project (not the worktree's copy). Exit 0 is PASS, 1 FAIL, 2 INCONCLUSIVE or BLOCKED.
4. **Run each manual check and each case on another surface** the way the brief says, and record it with what you ran and saw:

   ```sh
   sh .agents/skills/qa/qa-record.sh note T-<n> <run> <check-id> <surface> "<the command you ran>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> [evidence-file…]
   ```

   Use `hub-api` for checks of the hub through the `cland` CLI. Put captures under `.cland/qa/T-<n>/<run>/` first. A grant the brief does not list is a grant you do not have: record the case `BLOCKED`.
5. **Verify criteria and write the verdict.** Match the cases and checks to the stable ids in `task.view` criteria. A clear verdict includes `verified: "C1,C3"` for the criteria established by this run, or `verified: "all"` when every criterion was checked. A not-clear verdict includes `failed: [{ criterion: "C2", note: "what failed" }]` for each failed criterion; notes are nonempty and single-line. For separate marks use `task.criterion` verify with `criterion` and `run`, or fail with `criterion` and `note`. Leave unchecked criteria unverified. The hub lists the marks in the verdict report. Write one `task.comment`, `verdict` qa, `run` your run id, `commit` the commit you ran (full SHA), `result`:
   - `clear` only when **every** case and check in scope is PASS;
   - `not clear` when any is FAIL, BLOCKED or INCONCLUSIVE, and the text names each such case by id.

   The text opens with the case table, then findings ranked high, medium, low, each with the case id, the command and what it showed:

   ```
   | case | surface | result | evidence |
   | --- | --- | --- | --- |
   | SHELL-001 | headless-grid | PASS | .cland/qa/T-12/qa-2026-10-09-1/SHELL-001.screen.txt |
   | ITEMS-001 | headless-grid | FAIL | …/ITEMS-001.screen.txt |

   not clear: ITEMS-001 FAILED (T-2 missing from the items panel).
   ```
6. **Report** to the item lead with `send` kind `report` (`to: ["lead T-<n>"]`, in the request's topic): first line `qa clear T-<n>` or `qa not clear T-<n>`, then the failed cases. Report any find outside the item under test to that lead with its category (Bugs for a bug found aside) and evidence, so the Coordinator files it.

## If you are a rescue run

You have no hub and cannot ask. Do steps 1 to 3 and 4 with the same script, with `QA_SESSION=rescue-<job id>` set (it prints the line when it cannot append it, and keeps evidence in the temp dir when `.cland/qa` is not writable), then answer with, in this order: every `runs.jsonl` line as printed; the captures' directory (`$TMPDIR/cland-qa-evidence/T-<n>/<run>/`) when any line names it; **every block the script printed on stderr after `no evidence directory could be made`, verbatim, when both destinations failed** (the Coordinator cannot get those captures any other way); the case table; and the verdict as `verdict: qa`, `result: clear | not clear`, `commit: <sha>`, `run: <the job id>`. Do not claim a verdict was recorded on the item.

## Recovering a rescue run

A rescue run usually cannot write `.cland/qa/`, so its lines name disposable captures. The Coordinator makes them durable with the script, never by hand: paste the returned lines into a file (`lines.jsonl`, one line each), find the captures' directory (the lines name it: `$TMPDIR/cland-qa-evidence/T-<n>/<run>/` of the rescue run), and run, from the project:

```sh
sh .agents/skills/qa/qa-record.sh recover T-<n> <run> <captures-dir> lines.jsonl
```

For each line it copies the captures into `.cland/qa/T-<n>/<run>/`, verifies each copy, rewrites the evidence paths to the durable tree and appends the line to `.cland/qa/runs.jsonl`, in that order, and only for a line whose captures were all copied. It never deletes a source. Exit 0: every line appended. Exit 71: `.cland/qa/T-<n>/<run>/` cannot be made, nothing was appended or copied. Exit 73: some lines were not appended (a missing, unreadable or conflicting capture, a line of another item or run, a failed append); stderr names each loss and the sources stay in `<captures-dir>`. Fix the cause and run it again on the lines that were lost only (a line already appended would be appended twice). If a capture is gone for good, append that line by hand without the lost path and say so in the verdict's text.

Two things can go wrong with the evidence directory in the rescue run itself, and the run says which:

- `.cland/qa/T-<n>/<run>/` cannot be written: the script keeps the captures in `$TMPDIR/cland-qa-evidence/T-<n>/<run>/` and the line names those paths (absolute). Recover with the command above.
- Neither directory can be written: the case still runs, the line has `"evidence":[]`, and the case's inline captures (grid and state) are printed on stderr, after `no evidence directory could be made`. The rescue answer forwards them (see "If you are a rescue run"); the Coordinator saves them as `.cland/qa/T-<n>/<run>/<CASE>.inline.json` and adds that path to the line's `evidence` by hand.

## When a step fails

The run is three writes, in this order: the evidence files, the `runs.jsonl` line, the verdict. Nothing is rolled back; each leaves a state you can finish from.

- The evidence cannot be written: the case still runs; the captures go to the temp dir, or inline on stderr when even that fails ("Recovering a rescue run").
- The line cannot be serialized (exit 70): nothing is appended; the outcome and the captures' directory are on stderr. Rerun nothing: write the line by hand from that outcome, or record the case with `qa-record.sh note … <result>`.
- The line cannot be appended (`NOT recorded`): the case ran and the line is on stdout. Append that line to `.cland/qa/runs.jsonl` by hand, or report it to the Coordinator; do not rerun the case under the same run id.
- The verdict is refused or fails after the lines are in: the lines stay, they are the record. Fix the cause (for example a wrong `commit`), write only the verdict again with the same `run`, and report. A later verdict of the same kind replaces the earlier one. Never rerun the cases to "retry" a verdict.
- The run is interrupted: lines already appended stay. A new run id covers the rest; the verdict names the cases that have no line `BLOCKED`.

## Cases

Each `qa/cases/<ID>.lua` opens with its catalogue header, a comment block of exactly these fields, so the catalogue is the files:

```lua
-- id: SHELL-001
-- title: General shows and a message goes queued
-- preconditions: a fixture project with no items; the stdio hub
-- expected: the empty General thread, then the typed message shown as queued
-- since: T-57
-- regression: no
```

`regression` is `yes` when the case was added to guard a bug that was fixed. The case then returns the table `cland --headless --qa` runs (`nvim/README.md`, "QA cases"). A case needs no grant and runs in a sandbox; the tmux and web-terminal surfaces need the grants spec 4.10 names, and a brief that uses them says which.
