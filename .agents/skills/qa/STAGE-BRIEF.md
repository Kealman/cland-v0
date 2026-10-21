# Stage QA brief: T-<epic> stage <index> — <exact stage name>

Copy to `qa/briefs/T-<epic>-stage-<index>.md`; fill every section and commit on dev before requesting QA.

## Stage

- Epic: T-<epic>.
- Exact stage name: <name from task.plan show>.
- Items: <ordered ids in every lane, including QA finding fixes>.
- Policy: <affected or full>/after-stage.
- Scope: <combined changed behavior for affected, complete product checks for full>.

## Build

Use a clean detached worktree at the full dev SHA named in the request. HEAD must equal that SHA and refs/heads/dev before and after running. All listed items must have merged onto dev. A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester.

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

- Process probes exclude their own shell: use `pgrep`'s bracket trick or exclude the probe's process tree.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- A "ran" marker grep excludes the configuration echo line.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log.
- Speed criteria use measured wall times, never projections.
- Slots due or queued before the build count even when their results arrive later.
- "No skip" names platform-only cases and where they are covered.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

<explicit exclusions, or none>

## Grants

none. Otherwise list the grant, why a case needs it, and who set it.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`stage` / `--stage`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Report the stage result to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
