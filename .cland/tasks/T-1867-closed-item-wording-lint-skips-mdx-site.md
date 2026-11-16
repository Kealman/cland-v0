---
id: T-1867
kind: task
title: Closed-item wording lint skips .mdx site pages
state: open
status: ready
size: XS
criterion_seq: 1
labels: []
assignee: null
parent: E-1887
blocked_by: []
topic: topic-1559
branch: t/T-1867-closed-item-wording-lint-skips-mdx-site
created: 2026-11-15T08:06:05.841Z
updated: 2026-11-16T15:36:12.023Z
---

## Summary

The closed-item wording lint (`hub/test/lint-closed-item-wording.ts`) reads only `.md` files. It never checks `.mdx` site pages such as `site/src/content/docs/docs/web-and-phone.mdx` (T-1838) and `sessions.mdx` (T-1837), even though T-1838's C5 says the lint passes on the changed pages. Found by the E-1537 stage-5 QA brief draft. That brief substitutes a count of tracker ids in the `.mdx` lines the stage added.

## What to build

Extend the lint's document scope to `.mdx` under the site docs. Strip MDX import and export lines and JSX components only where the lint already strips code, so prose is checked the same way as in `.md`.

## Acceptance criteria

- [x] C1. The lint reads site `.mdx` pages and reports a planted closed-item phrase in one, and dev passes it with 0 findings, or every finding is fixed in the same change (test).
  - done: impl-1867 · 2026-11-16T14:55:10.965Z
  - verified: rev-35 [reviewer] · run rev-35-1867-final-1 · 2026-11-16T15:36:11.865Z · commit 2ffcb5c23b5478ec935478ea554852569150c045

## Comments

### impl-1867 · 2026-11-16T14:44:44.173Z

C1: Existing T0 fixture/CLI seam extended to MDX. Positive scope fixture red first (actual [] vs fixture.mdx:1 diagnostic), then syntax masking fixture red first. Only changed site page: site/src/content/docs/docs/items.mdx:206, illustrative T-40 replaced with nonnumeric T-n as directed; wording only. This page lands on dev and reaches the live site only through a later human-approved cland publish. No publication requested here.

### impl-1867 · 2026-11-16T14:47:26.164Z

Consumer inventory: package.json test:static CLI invocation unchanged; docs/agents/tests.md, docs/hub/running.md, hub/README.md, implement skill and remote-docs per-test note migrated. Searched lint filename, document glob and wording names across hub/site tests, docs, skills and QA. Completed E-1537 stage-1..5 and epic briefs retain historical three-glob counts and MDX substitute receipts pinned to old builds; these records remain unchanged. Replaying them at a new head requires an MDX-inclusive independent count, rather than reinterpreting their recorded historical counts.

### rev-36 · 2026-11-16T14:51:45.919Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1867-source-1
commit: 2d9f2ec8824cefc7706a29afdd1e5729a5929d44
scope: full
findings: [{"severity":"medium","text":"MDX mask removes only first physical import/export line. Valid multiline ESM continuation strings such as export const example={ newline label:\"Pending T-90001\" newline } leak into prose and falsely reject documents. No single-line restriction/alternate owner; claimant59bf9b1e confirms. Mask full ESM statement/block, preserve original lines/resume following prose, add multiline code-negative and following prose-positive controls while retaining existing Markdown/child/tag assertions.","file":"hub/test/lint-closed-item-wording.ts","line":27}]
finding_counts: {"high":0,"medium":1,"low":0}

Full eight-file source pass: one Spec medium, no additional Standards finding. Shared scope fixture reaches production md/mdx glob; child prose/lines/current Markdown checks and Coordinator-authorized illustrative site id change otherwise retained. Current direct gate/help/docs/skill consumers migrated; historical pinned QA counts remain history. Candidate red/green/timing/typecheck/lint summary/raw/source-hash limits explicit; no configured pass or Reviewer runtime. Source pin/hold released for consolidated ESM fix and fresh source request before verify.

Criteria: C1 failed (Valid multiline MDX import/export content is still scanned as prose, causing false closed-item wording failures.).

### rev-35 · 2026-11-16T15:01:21.867Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1867-source-2
commit: 2ffcb5c23b5478ec935478ea554852569150c045
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full eight-file repaired source clear A-20195 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20195-t-1867-multiline-esm-repair-source-clear-at-2ffcb5c23.md. Prior A-20183 multiline ESM finding addressed by existing TypeScript statement parser, ASI/trailing-comment masking and exact-line controls preserving following prose10 while excluding code2/5/8. Original Markdown, child/tag/inline/exemption assertions retained; production scope fixture reaches shared md/mdx patterns. Direct/default CLI/static gate and help/docs/skill consumers migrated; pinned historical QA counts unchanged. A-20173/A-20187 transcript/precommit/raw/hash limits and single timing samples retained. Reported final check/typecheck positive, no configured receipt yet. C1done/unverified; hold released for exact-head mode-free verify in assigned window, no full/all request or dev merge. No Reviewer runtime.

### impl-1867 · 2026-11-16T15:30:47.332Z

Same-head verification receipt A-20217: run 24a2be3b-80ef-4f42-96d4-e6a13fc0bb49 passed at 2ffcb5c23b5478ec935478ea554852569150c045, tree b866bff883bb53b70d9c9482039b4c0de68dbead. T0 local host gate passed; Linux x64 droplet c-8 sfo2 ran T1, all fallback T2, and Web, all exit 0; aggregate 6431 pass, 0 fail/cancel/skip/todo. Browser Chrome Headless Shell / Google Chrome for Testing 156.0.8078.4. T3/T4 not executed in this task run; T3 deferred to merge batch/integrated occasions. Duration/test-lint budgets report-only, with advisory overages retained in log. Droplet lifetime 1510 s, cost $0.1048. Source head unchanged; Reviewer receives same-head receipt automatically for final settlement.

### rev-35 · 2026-11-16T15:36:11.865Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1867-final-1
commit: 2ffcb5c23b5478ec935478ea554852569150c045
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear A-20221 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20221-t-1867-final-same-head-mdx-lint-evidence-verdict.md with A-20220 conservative991manifest-row ledger. C1verified: exact-head A-20217 actual host T0 fixture diagnostics pass87, expanded792docs/1911items/0findings88, T0exit0 at104. Source-reviewed production-pattern MDX positive/multiline/ASI/comment/following-prose controls thereby executed, not inferred only from aggregate.6431ordinary test passes/705files, separate210load passes/files,0fail/cancel/skip; allT1/T2/Web pass;269T3/17T4deferred. Exact provenance and actual browser checked; report-only budget/lint/known prerequisite warnings retained, no performance-gate claim. A-20173/A-20187 candidate/raw/hash limits and pinned historical QA counts retained. Hold released; Coordinator owns ready/enqueue/landing. No Reviewer runtime/live publication.

Criteria: C1 verified.
