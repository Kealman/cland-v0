# skills

cland's process layer (spec `docs/spec/v0.md`, sections 4.9 and 6): Matt Pocock's skills, vendored with cland's patches, plus cland's own additions.

| Path | What it is |
| --- | --- |
| `../.agents/skills/` | The vendored skills, recorded in `../skills-lock.json`, with the patches below applied in place. `.claude/skills/` symlinks to them. They are the live copies: this repo's own sessions use them, and `cland init` (#39) copies them into a project's `.agents/skills/` with a `.claude/skills` symlink. They are not duplicated under `skills/`. |
| `../.agents/skills/handover/` | cland's own skill (#31), not vendored and not in `skills-lock.json`: the Coordinator drafts the handover note (goals now, work in flight, open decisions, waiting on) from `role.state`, the tracker and the topics, and hands the role over with the spoke's `role.handover`. In the Coordinator's skill list in `roles.toml`. `.claude/skills/handover` symlinks to it. |
| `PATCHES.md` | Every change to a vendored skill: file, what changed, why, and the upstream hash. |
| `templates/docs/agents/` | The `docs/agents/*` files that `cland init` provisions into a cland project. `issue-tracker.md` is the "other" tracker mode: every operation the skills name, through `cland task`. `triage-labels.md` and `domain.md` are identical to this repo's own `docs/agents/`. |

This repo's own `docs/agents/issue-tracker.md` stays in GitHub mode until the tracker bootstrap migrates cland's tasks to `.cland/tasks` (spec 6, "Tracker bootstrap"). It then becomes a copy of the template.

`hub/test/skills-tracker.test.ts` runs the template's command sequences against a real hub, so a CLI change that breaks the template fails the suite.
