---
id: T-1264
kind: task
title: Use a proper source parser for QA brief drift checks if real briefs require unsupported syntax
state: closed
status: done
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by:
  - T-1454
topic: null
branch: null
created: 2026-10-24T21:39:34.913Z
updated: 2026-10-30T16:52:28.357Z
closed: 2026-10-30T16:52:28.357Z
---

## Summary

T-1201's `cland qa lint` reads test titles with a bounded, dependency-free lexer under a written drift-detector trust model (review-loop cap, 2026-10-24): repo-real string/template titles of test/it/describe; ambiguous regex/division or brace contexts report unresolved (fail-closed). Promoting typescript to a runtime dependency for its parser was declined (about 23 MB per install).

## Trigger

Pick this up only when real project briefs need literal title validation beyond the documented lexer bounds (unresolved reports on real briefs). Adversarial test-source decoys stay out of scope.

## Acceptance criteria

- [ ] C1. A real brief that the T-1201 lexer reports unresolved is validated exactly, without a new runtime dependency unless the human approves one.

## Comments

### coord · 2026-10-30T16:52:28.357Z

Closed as not triggered (Coordinator, 2026-10-30 16:56Z). The item's own trigger reads: "Pick this up only when real project briefs need literal title validation beyond the documented lexer bounds (unresolved reports on real briefs)."

Check: `cland qa lint <brief>` on dev 873c9dc07 for all 104 committed briefs in `qa/briefs/`. None reports a title or pattern `unresolved at the build` (the finding text from `hub/src/qa-lint-references.ts:172` and `:177`). No real brief exceeds the T-1201 lexer bounds, so C1 has no subject.

Context: the human's 14:40Z instruction moved tech debt into 0.3.1, and that means debt that actually bites. Building a TypeScript-parser path would also run into T-1484: TypeScript is pruned from installed hubs, and promoting it to a runtime dependency was declined (about 23 MB). If a real brief ever reports unresolved, refile from this item with that brief as evidence.
