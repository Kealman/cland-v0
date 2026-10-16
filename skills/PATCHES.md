# Patches to the vendored skills

cland vendors Matt Pocock's skills (`mattpocock/skills`) into `.agents/skills/`, recorded in `skills-lock.json`. Where a skill's wording assumes GitHub, the vendored copy is patched minimally so it works with cland's own tracker through `docs/agents/issue-tracker.md` (template: `templates/docs/agents/issue-tracker.md`). A patch makes the skill defer to the tracker doc rather than naming `cland task` commands.

Every patch is listed here. `skills-lock.json` keeps the upstream hash, so a re-vendor (`npx skills update`, or #39's provisioning from upstream) overwrites the patches: re-apply each one below after it, or drop it when upstream has an equivalent.

## to-tickets

- **File**: `.agents/skills/to-tickets/SKILL.md`, step 5 "Publish the tickets to the configured tracker".
- **Upstream**: `skills/engineering/to-tickets/SKILL.md`, hash `5f871bdc46a9212222214ba399be4965374208af1bd7f48f1271bef72841dd31`.
- **Change**: the "Local files" bullet now reads "**Local files** (the local-markdown tracker under `.scratch/`)", and the "A real issue tracker" bullet lists "GitHub, Linear, cland's `cland task`, …".
- **Size and Summary (T-331)**: each ticket assigns `--size` (XS, S, M, L or XL), writes a `## Summary` of one to three sentences, and sets `--regression-of` for rework of landed tasks; both templates include Summary. The upstream hash is unchanged.
- **Category filing (T-317)**: `.agents/skills/to-tickets/SKILL.md`, step 5, now defers tickets from a source with no release or epic to the tracker doc's "Categories" section. The upstream hash above is unchanged.
- **Why**: cland's tracker is also one Markdown file per item, so "Local files" was ambiguous. An agent could take that branch and write `.scratch/` files instead of items with native `parent` and `blocked_by` edges.

## triage

- **File**: `.agents/skills/triage/AGENT-BRIEF.md`, first paragraph.
- **Upstream**: `skills/engineering/triage/SKILL.md` (the lock records the skill's `SKILL.md`; `AGENT-BRIEF.md` ships beside it), hash `a683e69163e23630f39c05a50fb9d83a3795a6a6fbd317357669e082cd43a158`.
- **Change**: "a structured comment posted on a GitHub issue or PR" now reads "a structured comment posted on an issue (or PR) on the project issue tracker".
- **Category filing (T-317)**: `.agents/skills/triage/SKILL.md`, "Roles", now defers items with no release or epic to the tracker doc's "Categories" section; `bug` and `enhancement` stay labels. The upstream hash above is unchanged.
- **Why**: the brief is posted through whatever tracker `docs/agents/issue-tracker.md` names. With cland, that is `cland task comment`.

## code-review

- **File**: `.agents/skills/code-review/SKILL.md`, "Hub review requests" and steps 1–2.
- **Change**: accept requests from the item lead or Coordinator; return hub verdicts to `lead T-<n>` with intentional send kinds; describe default subscriptions and the ready handover. Resolve the spec from the request’s tracker item and ask its sender for missing inputs.
- **Why**: the claimant runs its review loop without a Coordinator relay (T-143).
- **D25 (T-322)**: review source before full verification, record a clear source verdict at the exact reviewed head with only source-established criteria verified, then settle the final verdict when the same-head post-verdict result arrives. Fixes require new source review before another run; an unchanged head may use the tree-hash cache.

- **Review scope (T-332)**: "Hub review requests" requires `--scope full|delta|evidence` (MCP `scope`), defines each pass and preserves older unscoped records as unknown; step 5 includes scope with the verdict fields. QA carries none.

## implement

- **File**: `.agents/skills/implement/SKILL.md`, implementation checks and the hub handover.
- **Change**: retain targeted checks during implementation; in hub sessions, merge dev before requesting the external Reviewer, then run `cland verify` only after a clear source verdict at the exact reviewed head. Fixes and later merges need a new source review before another run; unchanged heads retain cache reuse.
- **Why**: D25 (T-322) avoids full runs on source that review will change and follows the hub's Reviewer workflow instead of a local self-review.

## merge and qa

- **Files**: `.agents/skills/merge/SKILL.md` and `.agents/skills/qa/SKILL.md` (project skills).
- **Change**: align the item lead's verification loop with D25; require source review before a new run after a fix or changed head, preserve tree-hash cache reuse, and require the same-head successful result and final Reviewer verdict for merge. QA case execution still follows its brief.
- **Why**: T-322 keeps merge and QA guidance consistent with the clauses without changing the gate.
- **Executors (T-348)**: both skills accept a green same-head Linux droplet result as gate suite evidence, with macOS-only skips covered by the release's final local run. QA may run a brief's full suite on a droplet, records executor/platform/lifetime/cost in verdict evidence, and requests `--executor local` for macOS checks. Droplet lifecycle controls stay with the hub, human and Coordinator; D25's review-first loop is unchanged.

## release

- **OpenCode release preflight (T-533)**: before cland's release dry run, run the opt-in `npm run check:opencode`; review and merge the successful range update, or resolve the filed Bug and rerun. The installed skill retains this step for cland source checkouts; other projects keep their own checks. `.claude/skills/release` points to the canonical `.agents/skills/release` folder.

## Checked and left unpatched

- `to-spec`: it only says "publish to the issue tracker", which the tracker doc defines.
- `wayfinder`: it defers every map, child, blocking, frontier and claim operation to the tracker doc's "Wayfinding operations". Its `#<n>` warning holds for any tracker; the template says items are `T-<n>`. "Push the branch but open no PR" is about git, not the tracker.
- `triage/SKILL.md` PR handling (apart from the category patch above): it depends on the tracker doc's "PRs as a request surface" flag, which the cland template sets to `no`.
- `triage/AGENT-BRIEF.md`: the example criterion "Running `gh issue list --label needs-triage` …" describes the CLI that the example brief is about. It is an illustration and is never run.
- The skills' "If not, tell the user to run `/setup-matt-pocock-skills`": in a cland project, `cland init` (#39) provisions `docs/agents/*`, so this line never fires. `setup-matt-pocock-skills` has no cland option and would write a GitHub or local template; rerunning it in a cland project is a mistake.

## implement and code-review: test levels (D53)

- **Files**: `.agents/skills/implement/SKILL.md` (one paragraph before "Run typechecking…") and `.agents/skills/code-review/SKILL.md` (one paragraph in "Hub review requests").
- **Change**: both point to "Test levels" in `docs/agents/tests.md`. Implementers put each test at the lowest tier that proves it, with no new real process without a lifecycle reason and no wall-clock waits. Reviewers record a breach as a finding and never ask for a full run on a task head. The upstream hashes are unchanged.
- **Why**: D53 (2026-10-16). Most test time is real processes proving in-process rules (A-4143), so new tests must stop arriving at the wrong level before the hub enforces tiers.
