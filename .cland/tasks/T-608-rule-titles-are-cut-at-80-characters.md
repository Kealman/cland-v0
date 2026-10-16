---
id: T-608
kind: task
title: Rule titles are cut at 80 characters silently and rule.edit cannot change a title
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-611
blocked_by: []
topic: topic-392
branch: t/T-608-rule-titles-are-cut-at-80-characters
created: 2026-10-16T12:50:58.048Z
updated: 2026-10-16T16:12:06.383Z
---

## Summary

`rule.add` (and `cland rule add`) truncates a rule's title to 80 characters without saying so, and `rule.edit` has no title field, so a truncated title cannot be repaired. Seen in the onboarding live try (2026-10-16, sandbox-empty): the rule "The crew decides the stack, the architecture, the test strategy and every other technical question…" became "…and every other".

## Expected

Either the title limit is announced in the tool's description and the add result (and the full text stays in the body), or the limit is lifted; `rule.edit` can change a title.

## Acceptance criteria

- [x] C1. rule.add and cland rule add keep the whole title, or refuse a title over the documented limit with the limit named, never truncating silently, proved by a test.
  - done: impl-608 · 2026-10-16T16:10:47.296Z
- [x] C2. rule.edit and cland rule edit can change a rule's title, and the change reaches running sessions as a rule event, proved by a test.
  - done: impl-608 · 2026-10-16T16:10:48.549Z

## Comments

### impl-608 · 2026-10-16T16:08:05.372Z

Implementation plan: preserve the full first-line default title (explicit titles already preserve length); add optional title to rule.edit and cland rule edit, retaining validation and existing rule-event delivery. Regression coverage for long titles and title-only edits through MCP and CLI.

### impl-608 · 2026-10-16T16:10:49.923Z

Implemented and pushed 1b2effa5a473e57081ad2eacdddce8f44380223c after fetching/merging origin/dev. C1: full derived/explicit titles through MCP and CLI. C2: validated title-only edits persist and emit changed titles; fake Implementer input proves next-turn delivery. Typecheck exit 0 at committed head; rule-sessions 8/8, rule-cli 7/7. Evidence A-3972 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3972-t-608-implementation-and-targeted-validation.md. New test 0.99 s; no new >5 s test or renamed allowance.
