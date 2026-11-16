---
id: T-1867
kind: task
title: Closed-item wording lint skips .mdx site pages
state: open
status: in progress
size: XS
criterion_seq: 1
labels: []
assignee: null
parent: E-1887
blocked_by: []
topic: topic-1559
branch: t/T-1867-closed-item-wording-lint-skips-mdx-site
created: 2026-11-15T08:06:05.841Z
updated: 2026-11-16T14:55:10.965Z
---

## Summary

The closed-item wording lint (`hub/test/lint-closed-item-wording.ts`) reads only `.md` files. It never checks `.mdx` site pages such as `site/src/content/docs/docs/web-and-phone.mdx` (T-1838) and `sessions.mdx` (T-1837), even though T-1838's C5 says the lint passes on the changed pages. Found by the E-1537 stage-5 QA brief draft. That brief substitutes a count of tracker ids in the `.mdx` lines the stage added.

## What to build

Extend the lint's document scope to `.mdx` under the site docs. Strip MDX import and export lines and JSX components only where the lint already strips code, so prose is checked the same way as in `.md`.

## Acceptance criteria

- [x] C1. The lint reads site `.mdx` pages and reports a planted closed-item phrase in one, and dev passes it with 0 findings, or every finding is fixed in the same change (test).
  - done: impl-1867 · 2026-11-16T14:55:10.965Z

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
