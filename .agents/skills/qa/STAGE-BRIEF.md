# Stage QA brief: T-<epic> stage <index> — <exact stage name>

Copy to `qa/briefs/T-<epic>-stage-<index>.md`; fill every section and commit on dev before requesting QA.

## Stage

- Epic: T-<epic>.
- Exact stage name: <name from task.plan show>.
- Items: <ordered ids in every lane, including QA finding fixes>.
- Policy: <affected or full>/after-stage.
- Scope: <combined changed behavior for affected, complete product checks for full>.

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

## Build

Use a clean detached worktree at the full dev SHA named in the request. HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt or evidence-only completion: closed `done`, no branch, no landing receipt and no `Item:` trailer on dev. A task with a branch still needs its landing receipt, even when the branch has no commits. A dirty build, missing required merge or moved dev blocks this run; retain any collected evidence and report to the requester.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any Web steps; retain the build prerequisites of each standalone test (E-413 stage 2 setup; A-8634 R12).

## Cases

| case | surface | command and expected outcome |
| --- | --- | --- |
| <catalogue id> | headless-grid | <command and exact expectation> |

Write "none" if checks are entirely manual.

### Web cases (when in scope)

Add a `real-browser` row above with computer-use steps and the exact expected result; these cases use `qa-record.sh note`, not `run`. Name the local project/link (`cland web`, or a local static page until available), dedicated cland browser profile and screenshot paths under `.cland/qa/<item>/<run>/`. QA uses Codex `gpt-6-astra`; the Coordinator tells the human before launching the GUI run.

Open the link in the human’s default browser through computer use, using the human’s normal HOME and login keychain plus the dedicated cland profile. Touch only the cland page and its browser permission prompts, take screenshot evidence and close the opened tab afterwards. Keep keychain, profile and system settings unchanged; never press Reset or Reset To Defaults. Cancel unexpected system dialogs; report any dialog that cannot be cancelled, harness refusal, missing Screen Recording/Accessibility permission or unavailable profile as an exact blocker to the item lead in the request topic. See the qa skill’s “Web briefs” section for isolation and recording. Implementers and Reviewers never launch the real browser or GUI on the human’s Mac. Write “none” here when web cases are out of scope.

## Manual checks

| id | surface | command | expected |
| --- | --- | --- | --- |
| M1 | hub-api | <command> | <exact outcome> |

Write "none" when absent. Record every case and check with `qa-record.sh` under the epic id and one unique run id; retain the captures in the project's .cland/qa tree.

Before requesting QA, run `cland qa lint <brief>` with this filled brief at the build under test. The brief is complete only when qa lint passes at the build. Use a `role` column (or `Role: Implementer` above the checks) to assign commands to a role; cleanup operands are literal paths.

## Probes that mislead

- Process cleanup probes use a fixture-owned pid/process-group census, registered at launch and checked through exit; a machine-wide `pgrep` counts other sessions too (A-9063 R2; E-413 stage 1/T-1093).
- Edit existing keys in initialized configs, list standalone-test build prerequisites, enumerate regular files only for file probes, and identify events by seq/id. A second-client check allows only defaults the new client writes itself (A-8634 R12; E-412 stage 2, E-415 stage 3/DoD, E-1006).
- Transcript assertions identify stable item/topic/frame ids, with intervals starting at the result frame of the state-changing request. Preserve unaltered captures when correcting a probe and label the correction separately from product failures (A-8634 R13; E-412/E-415/E-1006; A-9063 R2; E-413 stage 1/T-1093).
- Exact tracker copies replace the initialized tracker directory after its writers stop; copy the committed directory whole, dotfiles included, and compare that same file set. Apply the full `fixtureEnvironment` result after overlays, including synthesized values; under rule 15, check zero credential-prefix names before launching scratch processes and report names/counts only (A-9063 R2; E-413 stage 1/T-1093).
- An accessibility-tree count does not prove visible reachability: a real-browser check scrolls the final row into view and checks its viewport containment (A-9063 R6; T-1095, T-1097).
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- A "ran" marker grep excludes the configuration echo line.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log.
- Speed criteria use measured wall times, never projections.
- Slots due or queued before the build count even when their results arrive later.
- "No skip" names platform-only cases and where they are covered.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

<explicit exclusions, or none>

Match conditional-check scope to the request; say whether missing authorization excludes the check or makes it BLOCKED (A-9063 R3; E-416 stage 1).

## Grants

none. Otherwise list the grant, why a case needs it, and who set it.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`stage` / `--stage`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Report the stage result to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
