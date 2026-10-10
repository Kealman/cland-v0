# Patches to the vendored skills

cland vendors Matt Pocock's skills (`mattpocock/skills`) into `.agents/skills/`, recorded in `skills-lock.json`. Where a skill's wording assumes GitHub, the vendored copy is patched minimally so it works with cland's own tracker through `docs/agents/issue-tracker.md` (template: `templates/docs/agents/issue-tracker.md`). A patch makes the skill defer to the tracker doc rather than naming `cland task` commands.

Every patch is listed here. `skills-lock.json` keeps the upstream hash, so a re-vendor (`npx skills update`, or #39's provisioning from upstream) overwrites the patches: re-apply each one below after it, or drop it when upstream has an equivalent.

## to-tickets

- **File**: `.agents/skills/to-tickets/SKILL.md`, step 5 "Publish the tickets to the configured tracker".
- **Upstream**: `skills/engineering/to-tickets/SKILL.md`, hash `5f871bdc46a9212222214ba399be4965374208af1bd7f48f1271bef72841dd31`.
- **Change**: the "Local files" bullet now reads "**Local files** (the local-markdown tracker under `.scratch/`)", and the "A real issue tracker" bullet lists "GitHub, Linear, cland's `cland task`, …".
- **Why**: cland's tracker is also one Markdown file per item, so "Local files" was ambiguous. An agent could take that branch and write `.scratch/` files instead of items with native `parent` and `blocked_by` edges.

## triage

- **File**: `.agents/skills/triage/AGENT-BRIEF.md`, first paragraph.
- **Upstream**: `skills/engineering/triage/SKILL.md` (the lock records the skill's `SKILL.md`; `AGENT-BRIEF.md` ships beside it), hash `a683e69163e23630f39c05a50fb9d83a3795a6a6fbd317357669e082cd43a158`.
- **Change**: "a structured comment posted on a GitHub issue or PR" now reads "a structured comment posted on an issue (or PR) on the project issue tracker".
- **Why**: the brief is posted through whatever tracker `docs/agents/issue-tracker.md` names. With cland, that is `cland task comment`.

## code-review

- **File**: `.agents/skills/code-review/SKILL.md`, "Hub review requests" and steps 1–2.
- **Change**: accept requests from the item lead or Coordinator; return hub verdicts to `lead T-<n>` with intentional send kinds; describe default subscriptions and the ready handover. Resolve the spec from the request’s tracker item and ask its sender for missing inputs.
- **Why**: the claimant runs its review loop without a Coordinator relay (T-143).

## Checked and left unpatched

- `to-spec`, `implement`: they only "publish to the issue tracker" and "fetch the ticket", which the tracker doc defines.
- `wayfinder`: it defers every map, child, blocking, frontier and claim operation to the tracker doc's "Wayfinding operations". Its `#<n>` warning holds for any tracker; the template says items are `T-<n>`. "Push the branch but open no PR" is about git, not the tracker.
- `triage/SKILL.md`: PR handling depends on the tracker doc's "PRs as a request surface" flag, which the cland template sets to `no`.
- `triage/AGENT-BRIEF.md`: the example criterion "Running `gh issue list --label needs-triage` …" describes the CLI that the example brief is about. It is an illustration and is never run.
- The skills' "If not, tell the user to run `/setup-matt-pocock-skills`": in a cland project, `cland init` (#39) provisions `docs/agents/*`, so this line never fires. `setup-matt-pocock-skills` has no cland option and would write a GitHub or local template; rerunning it in a cland project is a mistake.
