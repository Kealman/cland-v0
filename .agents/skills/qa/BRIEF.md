# QA brief: T-<n> <the item's title>

Copy to `qa/briefs/T-<n>.md`. Everything the run needs is in this file or in the files it names: whoever runs it cannot ask.

## Item

T-<n>: what it builds, in two sentences, and where its acceptance criteria are (`task.view T-<n>`, or the paragraph below).

## Build

- Branch: `t/T-<n>-<slug>`, in the item's worktree `.cland/worktrees/T-<n>` of the project.
- The build is the tip of that branch when the run starts. Before the first case run `git status --short` and `git rev-parse HEAD` there: if the status is not empty, or HEAD is not the branch tip, record `BLOCKED` (the build is not a commit). Otherwise that HEAD is the build: `qa-record.sh` puts its short form in every line, and the verdict's `commit` is its full SHA. A request that names a commit is honoured when it equals HEAD; when it differs, record `BLOCKED` naming both commits (never run another commit silently).

## Cases

Run each with `sh .agents/skills/qa/qa-record.sh run T-<n> <run> <CASE-ID>` (headless-grid; `CLAND` is the path of the cland executable, unset when `cland` is on the PATH) or as stated (a rescue run also sets `QA_SESSION=rescue-<job id>`). A case's expected result is in the header of `qa/cases/<ID>.lua`.

| case | surface | note |
| --- | --- | --- |
| `<AREA>-<NNN>` | headless-grid | |

## Manual checks

Each is a command and its expected outcome; record each with `sh .agents/skills/qa/qa-record.sh note T-<n> <run> M1 <surface> "<command>" <result>`.

| id | command | expected |
| --- | --- | --- |
| M1 | `<command>` | `<exact outcome>` |

## Out of scope

What not to test or report: <list, or "nothing">.

## Grants

none. (Otherwise the grant, why the case needs it, and who set it.)

## Procedure

1. Choose a run id, `qa-<date>-<n>`.
2. Run every case and manual check above, in order, and record each with `qa-record.sh`.
3. Fix nothing. A failure is a finding: write down the case id, the command and what it showed.
4. Verdict `clear` only when every case and check in scope is PASS; otherwise `not clear`, naming each case that was FAIL, BLOCKED or INCONCLUSIVE.
5. If a step fails, keep what is already written, finish from there and never rerun a case under the same run id (the skill, "When a step fails").
6. Through the hub: write it with `task.comment` (`verdict` qa, `result`, `run`, `commit`) and `send` kind `report` to `lead T-<n>` in the request’s topic as `qa clear T-<n>` or `qa not clear T-<n>`. Without a hub: print every `runs.jsonl` line, the case table and `verdict: qa`, `result:`, `commit:`, `run:`.
