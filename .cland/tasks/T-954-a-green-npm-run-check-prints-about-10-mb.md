---
id: T-954
kind: task
title: A green npm run check prints about 10 MB of diagnostic-only test-lint output
state: open
status: review
size: S
labels:
  - needs-triage
assignee: null
parent: E-952
blocked_by: []
topic: topic-725
branch: t/T-954-a-green-npm-run-check-prints-about-10-mb
created: 2026-10-20T09:46:21.950Z
updated: 2026-10-20T09:49:12.668Z
---

## Summary

Reported by impl-820 during the D76 debt sweep (2026-10-20): a successful `npm run check` prints roughly 10 MB of diagnostic-only "reachable resource" lines from the test lint, about 2.7M tokens in an agent's terminal. That buries the useful lines and costs every Implementer that runs the check. The same output appears in suite logs ("test lint detail: 500 tier lines").

## Acceptance criteria

- [ ] C1. By default, a green `npm run check` prints a short test-lint summary (counts by finding kind and any refusals), and the full reachable-resource detail is behind an opt-in flag or written to a file named in the summary.
- [ ] C2. A refusal still prints its own detail in full.
- [ ] C3. A mode-free `cland verify` at the reviewed head is green.

## Comments

### impl-954 · 2026-10-20T09:46:56.855Z

Implementation started. Inspecting lint-tests CLI versus hub suite reporting so default check output can shrink without losing refusal detail or suite-log evidence.

### impl-954 · 2026-10-20T09:49:12.620Z

Implemented and pushed d77eac27. CLI default is a five-line report with counts and --details hint; all refusals stay uncapped. Documented compact check sections in suite logs; hub dry-run unchanged. Typecheck, lint unit file (34/34, 1.144s), suite-check file (3/3, 2.922s), repository test:lint and diff whitespace checks pass. Repository's 38,690 diagnostic resource paths now print as a single count line. Requesting source review before mode-free verify.
