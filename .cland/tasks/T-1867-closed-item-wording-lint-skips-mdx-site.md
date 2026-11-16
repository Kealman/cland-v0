---
id: T-1867
kind: task
title: Closed-item wording lint skips .mdx site pages
state: open
status: backlog
size: XS
labels: []
assignee: null
parent: E-1887
blocked_by: []
topic: null
branch: null
created: 2026-11-15T08:06:05.841Z
updated: 2026-11-16T07:29:25.171Z
---

## Summary

The closed-item wording lint (`hub/test/lint-closed-item-wording.ts`) reads only `.md` files. It never checks `.mdx` site pages such as `site/src/content/docs/docs/web-and-phone.mdx` (T-1838) and `sessions.mdx` (T-1837), even though T-1838's C5 says the lint passes on the changed pages. Found by the E-1537 stage-5 QA brief draft. That brief substitutes a count of tracker ids in the `.mdx` lines the stage added.

## What to build

Extend the lint's document scope to `.mdx` under the site docs. Strip MDX import and export lines and JSX components only where the lint already strips code, so prose is checked the same way as in `.md`.

## Acceptance criteria

- [ ] C1. The lint reads site `.mdx` pages and reports a planted closed-item phrase in one, and dev passes it with 0 findings, or every finding is fixed in the same change (test).
