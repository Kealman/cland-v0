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
updated: 2026-10-16T16:12:52.193Z
---

## Summary

`rule.add` (and `cland rule add`) truncates a rule's title to 80 characters without saying so, and `rule.edit` has no title field, so a truncated title cannot be repaired. Seen in the onboarding live try (2026-10-16, sandbox-empty): the rule "The crew decides the stack, the architecture, the test strategy and every other technical question…" became "…and every other".

## Expected

Either the title limit is announced in the tool's description and the add result (and the full text stays in the body), or the limit is lifted; `rule.edit` can change a title.

## Acceptance criteria

- [x] C1. rule.add and cland rule add keep the whole title, or refuse a title over the documented limit with the limit named, never truncating silently, proved by a test.
  - done: impl-608 · 2026-10-16T16:10:47.296Z
  - verified: rev-30 [reviewer] · run rev-20261016-608-source · 2026-10-16T16:12:52.193Z · commit 1b2effa5a473e57081ad2eacdddce8f44380223c
- [x] C2. rule.edit and cland rule edit can change a rule's title, and the change reaches running sessions as a rule event, proved by a test.
  - done: impl-608 · 2026-10-16T16:10:48.549Z

## Comments

### impl-608 · 2026-10-16T16:08:05.372Z

Implementation plan: preserve the full first-line default title (explicit titles already preserve length); add optional title to rule.edit and cland rule edit, retaining validation and existing rule-event delivery. Regression coverage for long titles and title-only edits through MCP and CLI.

### impl-608 · 2026-10-16T16:10:49.923Z

Implemented and pushed 1b2effa5a473e57081ad2eacdddce8f44380223c after fetching/merging origin/dev. C1: full derived/explicit titles through MCP and CLI. C2: validated title-only edits persist and emit changed titles; fake Implementer input proves next-turn delivery. Typecheck exit 0 at committed head; rule-sessions 8/8, rule-cli 7/7. Evidence A-3972 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3972-t-608-implementation-and-targeted-validation.md. New test 0.99 s; no new >5 s test or renamed allowance.

### rev-30 · 2026-10-16T16:12:52.193Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-608-source
commit: 1b2effa5a473e57081ad2eacdddce8f44380223c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-608 source review

Commit 1b2effa5a473e57081ad2eacdddce8f44380223c; fixed point 33a932551129804a9545c882955d426b7505564b. Local and origin task tips agree. Eight-file implementation reviewed against T-608 and v0.1.4 §3.5. Both axes performed in-session because delegation is disabled for this role.

## Standards
No findings. Validation stays at the existing rulebook seam: titles remain nonempty single-line strings, invalid writes never reach rename, and read/write authorization rechecks are unchanged. Optional title is threaded through the existing typed protocol, wire validation, MCP schema, CLI allowlist/help and shell dispatch rather than creating another mutation path. Diff whitespace check passes.

## Spec
C1 established by source: add now derives the whole first line without the 80-character slice; explicit long titles and full rule bodies remain preserved. Rulebook serialization and parser contain no replacement length limit. The new integrated test covers both derived and explicit long titles through real MCP and CLI calls.

Title-only editing is accepted independently of text/scope/reason and validated with singleLine before persistence. CLI forwards its allowed title option; MCP forwards its validated frame; the shared writer returns the parsed committed rule. The regression checks unchanged text/reason and correct origin, persisted heading and listing, and refuses empty/whitespace/newline/carriage-return titles without modifying the rulebook.

The existing rule-change comparison already detects title changes. Active rule notices append the new title only when it changed, retain scope-aware recipients and next-turn digest delivery, and do not add a new wake/needs-you path. The new test checks one background rule event to the running Implementer for each tool/CLI title edit. The extended existing native fake Codex test proves the new Title line reaches its next input while retaining no-steer, scope, retirement and event-row assertions.

## Evidence and criteria
A-3972 is the claimant's summarized exact-head validation: typecheck exit 0, rule-sessions 8/8 and rule-cli 7/7 in separate files; the new test measured 0.99 seconds. It documents the original derived-title truncation reproduced before the change. No raw log bundle or Reviewer-run test is claimed.

Source clear, zero findings; C1 source verified. C2's final running-session execution evidence remains pending normal same-head cland verify, including the new test's repetitions. No per-item QA is required and no new allowance is introduced.

Standards 0 findings; Spec 0 findings.
Artifact: A-3982 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3982-t-608-source-clear-complete-titles-and-title-only-rule-edits.md

Criteria: C1 verified.
