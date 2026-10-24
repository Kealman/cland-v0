---
id: T-337
kind: task
title: Read-only cland session list is refused for Implementers as session.launch
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - hub
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: topic-930
branch: t/T-337-read-only-cland-session-list-is-refused
created: 2026-10-13T14:43:31.707Z
updated: 2026-10-24T07:32:21.746Z
---

## Summary

An Implementer's read-only `cland session list --json` from its own session shell is refused as `session.launch` ("Implementer may not use session.launch"). Reading the session list launches nothing, so the permission check maps the read to the wrong tool. impl-333 hit it on 2026-10-13 when it looked up its own launched model for a commit trailer.

## What to build

- Map `session.list` and the CLI's `cland session list` to a read permission that every role holds, as `who` is. Keep `session.launch`, `stop`, `resume`, `archive` and `prune` gated as now.
- A permission test that an Implementer's shell can list sessions and still cannot launch one.

## Acceptance criteria

- [x] C1. `cland session list` and `--json` succeed from an Implementer's shell, and `cland session launch` from the same shell is still refused.
  - done: impl-337 · 2026-10-24T07:26:57.198Z
- [x] C2. The permission table names the read separately, with a test.
  - done: impl-337 · 2026-10-24T07:31:46.337Z

## Comments

### impl-337 · 2026-10-24T07:25:54.567Z

Implemented separate session.list read grant across dispatcher, built-in/default/project role tables; session lifecycle grants unchanged. TDD: targeted new CLI test first failed with actual `cland: forbidden: session.launch (Implementer may not use session.launch)` (exit 1 vs expected 0), then passed after the permission fix. First attempt was cover-quiet refusal only, not test evidence. Added T1 named-read coverage for all six roles and explicit/roleless grants, plus T2 typed mutation refusals, archive reading and explicit read revocation. Updating matching help, permission docs, handover skill and old integration expectations. Check and touched targeted files currently running on local macOS.

### rev-26 · 2026-10-24T07:28:29.458Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-337-source-1
commit: 0a9f9aca1a234850749856df23906fcc579b3976
scope: full
findings: [{"severity":"medium","text":"M1: The new all-role session.list permission is absent from the delivered role clauses (and project clauses remain unchanged). Rule16 requires matching role-clause guidance for a permission change; the tools arrays are not rendered by clauseText. Add compact read-versus-mutation wording in the matching shipped/project clauses or shared clause delivery, preserving the existing byte reserve.","file":"hub/src/roles/default-roles.ts","line":195},{"severity":"low","text":"L1: The shell-permission comment still groups session listing with Coordinator-only session management. Update it to describe the independent all-role read grant so future permission changes do not restore the removed alias.","file":"hub/src/hub/dispatch.ts","line":1934}]
finding_counts: {"high":0,"medium":1,"low":1}

Full source audit complete at0a9f9aca/tree7be9de78. Standards M1medium: new session.list permission is absent from delivered shipped/project clauses; clauseText does not render tools arrays. Rule16 requires matching clause guidance; compact replacements can preserve byte reserve. L1low: dispatch.ts:1934 still groups listing with Coordinator-only session management. No product Spec findings: independent read mapping/default all-role grants, custom revocation, CLI identity and unchanged mutation gates are sound. New T1/T2 tests use correct seams, existing T3 assertions retained and duration identity renamed without value change. C2 failed for M1; C1 runtime pending. A-10370 local32/32/check summary remains supporting; preserve original command/stdout/exit/timing/tree receipts without transcription reruns. Fresh corrected-head source review before mode-free verify; noQA requirement, noReviewer runtime. A-10372: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10372-t-337-source-review-at-0a9f9aca.md.

Criteria: C2 failed (Changed role permission lacks matching delivered role-clause guidance required by rule16; preserve byte reserve with compact wording before source clearance.).

### rev-26 · 2026-10-24T07:32:21.746Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-337-source-2
commit: 86a327c773519f09380a046741b26f121352fddc
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at86a327c7/treed61749ab. M1resolved: six shipped/six project clauses explicitly name independent session.list read/no mutation grant via compacted existing queue/status lines. New T1 clause-rendering coverage preserves unchanged512-byte reserve/15%headroom assertions. L1resolved: dispatch shell-authority comment corrected. Full runtime boundary review A-10372 carries forward; no other runtime/grant/duration delta or dev merge. A-10379 original local Darwinarm64 exec/write_stdin outputs inspected: check exit0/0lintrefusals,71/71 across5targetedfiles (T1/T2/existingT3), native16289.179958ms; per-tool waits not totalwall, artifact-level source attribution retained. Earlier32-test A-10370 remains narrative-only. C1/C2 await same-head configured verification; noQA requirement, noReviewer runtime. A-10381: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10381-t-337-corrected-source-at-86a327c7.md.
