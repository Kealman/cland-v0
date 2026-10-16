---
id: T-608
kind: task
title: Rule titles are cut at 80 characters silently and rule.edit cannot change a title
state: open
status: backlog
size: XS
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-611
blocked_by: []
topic: null
branch: null
created: 2026-10-16T12:50:58.048Z
updated: 2026-10-16T15:53:11.451Z
---

## Summary

`rule.add` (and `cland rule add`) truncates a rule's title to 80 characters without saying so, and `rule.edit` has no title field, so a truncated title cannot be repaired. Seen in the onboarding live try (2026-10-16, sandbox-empty): the rule "The crew decides the stack, the architecture, the test strategy and every other technical question…" became "…and every other".

## Expected

Either the title limit is announced in the tool's description and the add result (and the full text stays in the body), or the limit is lifted; `rule.edit` can change a title.

## Acceptance criteria

- [ ] C1. rule.add and cland rule add keep the whole title, or refuse a title over the documented limit with the limit named, never truncating silently, proved by a test.
- [ ] C2. rule.edit and cland rule edit can change a rule's title, and the change reaches running sessions as a rule event, proved by a test.
