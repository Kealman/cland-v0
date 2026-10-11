# skills

cland's process layer (spec `docs/spec/v0.md`, sections 4.9 and 6): Matt Pocock's skills, vendored with cland's patches, plus cland's own additions.

| Path | What it is |
| --- | --- |
| `../.agents/skills/` | The vendored skills, recorded in `../skills-lock.json`, with the patches below applied in place. `.claude/skills/` symlinks to them. They are the live copies and the source of truth: this repo's own sessions use them, and `cland init` reads them relative to the cland package and copies every skill folder (one holding a `SKILL.md`) into a project's `.agents/skills/`, listed in `.agents/skills/.cland-manifest.json`, with a `.claude/skills` symlink. A skill added here ships with the next `cland update`. They are not duplicated under `skills/`. |
| `../.agents/skills/handover/` | cland's own skill (#31), not vendored and not in `skills-lock.json`: the Coordinator drafts the handover note (goals now, work in flight, open decisions, waiting on) from `role.state`, the tracker and the topics, and hands the role over with the spoke's `role.handover`. In the Coordinator's skill list in `roles.toml`. `.claude/skills/handover` symlinks to it. |
| `../.agents/skills/release/` | cland's own skill (T-63), shipped to the Coordinator: commit the tracker, preview the release item, show its notes and human-chosen version in an approval ask, then publish from the Coordinator's own shell. Recovery retries the same prepared release. |
| `../.agents/skills/qa/` | cland's own skill (T-62), in the Coordinator's and QA's skill lists in `roles.toml`: the Coordinator writes the brief `qa/briefs/T-<n>.md` and sends or rescues it, the QA role runs it and writes the verdict. Beside `SKILL.md` it holds `BRIEF.md` (the template) and `qa-record.sh`, which runs a case or records a check and appends the `.cland/qa/runs.jsonl` line. `docs/review-and-qa.md` describes the brief and the runs line, and, in "Turning on the QA workflow in an existing project", the `roles.toml` edits a project makes by hand (`cland update` brings the skill and never rewrites `roles.toml`). |
| `../.agents/skills/plan-epic/` | cland's own epic planning skill (T-186), shipped to Coordinator and Lead; `draft.mjs` reads tasks and crew to emit a first draft, then the skill selects QA and sets it through the hub. |
| `PATCHES.md` | Every change to a vendored skill: file, what changed, why, and the upstream hash. |
| `templates/AGENTS.block.md` | The generic cland instructions `cland init` writes into a project's `AGENTS.md`, between the managed block's markers. |
| `templates/docs/agents/` | The `docs/agents/*` files that `cland init` provisions into a cland project. `issue-tracker.md` is the "other" tracker mode: every operation the skills name, through `cland task`. `triage-labels.md` and `domain.md` are identical to this repo's own `docs/agents/`. `cland init` writes each with a `managed by cland <version>` first line; the templates themselves carry no mark. |

This repo's own `docs/agents/issue-tracker.md` stays in GitHub mode until the tracker bootstrap migrates cland's tasks to `.cland/tasks` (spec 6, "Tracker bootstrap"). It then becomes a copy of the template.

`hub/test/skills-tracker.test.ts` runs the template's command sequences against a real hub, so a CLI change that breaks the template fails the suite.
