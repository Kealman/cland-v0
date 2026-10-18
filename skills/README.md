# skills

The curated skill set lives in [`.agents/skills/`](../.agents/skills/), edited in place. These are the live copies this repository's sessions use and the source `cland init` copies into projects. `.claude/skills` links to that directory. A skill added here ships with the next `cland update`.

The set keeps 15 upstream skills from `mattpocock/skills`: code-review, codebase-design, diagnosing-bugs, domain-modeling, grilling, implement, prototype, research, retro, tdd, to-spec, to-tickets, triage, wayfinder and writing-for-agents. cland's own skills are handover, merge, plan-epic, qa and release; onboarding joins them in v0.1.4.

Each upstream `SKILL.md` records its upstream folder and origin commit, the MIT attribution and one line of cland's changes in frontmatter `metadata.origin` and `metadata.changes`. Its folder carries the full upstream `LICENSE`, so the notice travels with every copy. The details of cland's edits stay in `git log -- .agents/skills/<name>`.

To take an upstream improvement, clone `mattpocock/skills` and diff the folder named in the skill's origin header from that commit:

```sh
git diff <origin-commit> HEAD -- <upstream-folder>
```

Apply the relevant changes to the live copy, preserving cland's adaptations, and record the change and its item in `metadata.changes`. Keep `metadata.origin` as the baseline for that copy. `npm run test:static` checks the upstream headers and license files.

`cland init` copies every folder holding a `SKILL.md` into a project's `.agents/skills/`, records the installed files in `.agents/skills/.cland-manifest.json`, and creates the `.claude/skills` link. The manifest tracks provisioning; each upstream skill's header records provenance.

`templates/AGENTS.block.md` is the managed block init writes into `AGENTS.md`. `templates/docs/agents/` holds the tracker, triage and domain docs it provisions, with a managed first line. The tracker template routes skill operations through `cland task`; `hub/test/skills-tracker.test.ts` checks those commands against an in-process hub.
