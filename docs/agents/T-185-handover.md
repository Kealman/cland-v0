# T-185 stage QA handover

Added one QA role-clause line at `.cland/roles.toml:148`, mirrored by `hub/src/roles/default-roles.ts:182`:

> Stage QA: accept `qa request T-<epic> stage <name>` with a committed stage brief; run it on a clean dev build after all stage items merge, then record a QA verdict on the epic naming `stage`, the tested full dev SHA and run. A clear verdict closes only that stage; not-clear keeps it open. Stage verdicts carry no epic criterion marks. Follow the `qa` skill for stage briefs and build checks.

No permission or launch-setting changes. The existing Coordinator and Lead clauses already hold the next stage until after-stage QA completes. Refresh the QA clause when this lands. `cland init/update` ships the matching built-in clause and the qa skill's new `STAGE-BRIEF.md` and stage workflow.

The hub now accepts QA stage verdicts via frame protocol, MCP and CLI (`--stage`). It checks dev and all stage merge evidence before publication. `task.view` and `task.plan show` expose stage progress. Stage closure remains recorded on the epic, distinct from the separate epic Definition of done verdict; not-clear keeps the stage open. See `docs/review-and-qa.md` for the evidence and request procedure.
