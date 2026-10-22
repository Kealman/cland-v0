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

### Web cases (when in scope)

Add a `real-browser` row above with computer-use steps and the exact expected result; these cases use `qa-record.sh note`, not `run`. Name the local project/link (`cland web`, or a local static page until available), dedicated cland browser profile and screenshot paths under `.cland/qa/<item>/<run>/`. QA uses Codex `gpt-6-astra`; the Coordinator tells the human before launching the GUI run.

Open the link in the human’s default browser through computer use, using the human’s normal HOME and login keychain plus the dedicated cland profile. Touch only the cland page and its browser permission prompts, take screenshot evidence and close the opened tab afterwards. Keep keychain, profile and system settings unchanged; never press Reset or Reset To Defaults. Cancel unexpected system dialogs; report any dialog that cannot be cancelled, harness refusal, missing Screen Recording/Accessibility permission or unavailable profile as an exact blocker to the item lead in the request topic. See the qa skill’s “Web briefs” section for isolation and recording. Implementers and Reviewers never launch the real browser or GUI on the human’s Mac. Write “none” here when web cases are out of scope.

## Manual checks

Each is a command and its expected outcome; record each with `sh .agents/skills/qa/qa-record.sh note T-<n> <run> M1 <surface> "<command>" <result>`.

| id | command | expected |
| --- | --- | --- |
| M1 | `<command>` | `<exact outcome>` |

Before requesting QA, run `cland qa lint <brief>` with this filled brief at the build under test. The brief is complete only when qa lint passes at the build. Use a `role` column (or `Role: Implementer` above the checks) to assign commands to a role; cleanup operands are literal paths.

## Probes that mislead

- Process cleanup probes use a fixture-owned pid/process-group census, registered at launch and checked through exit; a machine-wide `pgrep` counts other sessions too (A-9063 R2; E-413 stage 1/T-1093).
- Edit existing keys in initialized configs, list standalone-test build prerequisites, enumerate regular files only for file probes, and identify events by seq/id. A second-client check allows only defaults the new client writes itself (A-8634 R12; E-412 stage 2, E-415 stage 3/DoD, E-1006).
- Transcript assertions identify stable item/topic/frame ids, with intervals starting at the result frame of the state-changing request. Preserve unaltered captures when correcting a probe and label the correction separately from product failures (A-8634 R13; E-412/E-415/E-1006; A-9063 R2; E-413 stage 1/T-1093).
- Exact tracker copies replace the initialized tracker directory after its writers stop; copy the committed directory whole, dotfiles included, and compare that same file set. Apply the full `fixtureEnvironment` result after overlays, including synthesized values; under rule 15, check zero credential-prefix names before launching scratch processes and report names/counts only (A-9063 R2; E-413 stage 1/T-1093).
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- A "ran" marker grep excludes the configuration echo line.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log.
- Speed criteria use measured wall times, never projections.
- Slots due or queued before the build count even when their results arrive later.
- "No skip" names platform-only cases and where they are covered.
- Re-check helper and function names with grep at the tested build; renames happen.

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
