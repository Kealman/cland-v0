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

## Manual checks

| id | surface | command | expected |
| --- | --- | --- | --- |
| M1 | hub-api | <command> | <exact outcome> |

Write "none" when absent. Record every case and check with `qa-record.sh` under the epic id and one unique run id; retain the captures in the project's .cland/qa tree.

## Out of scope

<explicit exclusions, or none>

## Grants

none. Otherwise list the grant, why a case needs it, and who set it.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`stage` / `--stage`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Report the stage result to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
