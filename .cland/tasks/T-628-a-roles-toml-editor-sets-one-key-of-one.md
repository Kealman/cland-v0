---
id: T-628
kind: task
title: A roles.toml editor sets one key of one role table and keeps the rest of the file
state: open
status: review
size: S
criterion_seq: 6
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by: []
topic: topic-389
branch: t/T-628-a-roles-toml-editor-sets-one-key-of-one
created: 2026-10-16T16:04:11.537Z
updated: 2026-10-16T16:11:39.360Z
---

## Summary

Prefactoring for `cland role launch`, the one-time Aide grants migration and setup's favourite harness (E-613): one editor changes a single key of a role's `[<role>.launch]` or `[<role>.permissions]` table in `.cland/roles.toml`, keeps every other line and comment of the human's file, and never writes a result the hub's roles parser refuses.

## What to build

`roles.toml` is the human's file once written, and cland never rewrites it, so every command that changes it must edit in place rather than re-render it. The editor takes the file's text, a role, a table (`launch` or `permissions`) and a key with its new value (a string, or a list of strings for `tools`), and returns the new text:

- an existing key's line is replaced where it stands, its trailing comment kept unless the caller passes a new one (setup's prototype marks the favourite harness's line with `# the human's favourite, chosen in cland setup`, prototype/setup `hub/src/setup/roles.ts`);
- a key the table lacks is inserted inside that table; a missing table is created after the role's other tables;
- a value can be cleared to `""` (the harness's default);
- table headers are found outside TOML strings only: a role clause is a multi-line string whose lines may begin with `[`, and the prototype's line regex would take such a line for a header;
- the result is parsed with the hub's own roles parser before it is returned, and the parser's message, naming the key, is the error.

A write helper replaces the file atomically and refuses when the file changed between the read and the write, as `cland crew set` does.

## Acceptance criteria

- [ ] C1. Setting an existing `[<role>.launch]` key replaces its line in place and leaves every other byte of the file, comments included, unchanged (unit test).
  - verified: rev-31 [reviewer] · run rev-20261016-628-source · 2026-10-16T16:11:39.359Z · commit cc01903bdcee75ee5b9b16f8380693604554edf7
- [ ] C2. A key absent from the table is inserted inside that table, and a missing `[<role>.launch]` table is created after the role's other tables (unit tests for both).
  - verified: rev-31 [reviewer] · run rev-20261016-628-source · 2026-10-16T16:11:39.360Z · commit cc01903bdcee75ee5b9b16f8380693604554edf7
- [ ] C3. A line beginning with `[` inside a role's multi-line clause is never taken for a table header (unit test with such a clause).
  - verified: rev-31 [reviewer] · run rev-20261016-628-source · 2026-10-16T16:11:39.360Z · commit cc01903bdcee75ee5b9b16f8380693604554edf7
- [ ] C4. `[<role>.permissions] tools` gains grants while its other grants keep their order (unit test).
  - verified: rev-31 [reviewer] · run rev-20261016-628-source · 2026-10-16T16:11:39.360Z · commit cc01903bdcee75ee5b9b16f8380693604554edf7
- [ ] C5. A result the hub's roles parser refuses is never returned, and the error is the parser's message naming the key (unit tests with an unknown harness and an unknown grant).
  - verified: rev-31 [reviewer] · run rev-20261016-628-source · 2026-10-16T16:11:39.360Z · commit cc01903bdcee75ee5b9b16f8380693604554edf7
- [ ] C6. The write helper replaces the file atomically and refuses with "changed while setting it; retry" when the file changed after it was read (unit test).

## Comments

### impl-628 · 2026-10-16T16:06:35.430Z

Implementation started. Public seams are the text editor and atomic write helper named by C1–C6. Tracking a C5 ambiguity with lead T-628: parseRoles permits arbitrary harness ids, including a custom test adapter, while C5 requires parser-owned unknown-harness errors.

### impl-628 · 2026-10-16T16:10:27.925Z

Implemented and pushed cc01903bdcee75ee5b9b16f8380693604554edf7. Merged origin/dev at 33a93255 before review. npm run typecheck exit 0; targeted roles-editor.test.ts exit 0 (8/8, slowest 11 ms); shard lint and diff check exit 0. Public APIs: setRoleKey and writeRolesFile in hub/src/roles/editor.ts; parseRoles optional third allowedHarnesses argument follows Coordinator decision. QA policy scope none / after-stage. Requesting source review; will submit no-mode verify at reviewed head after clear verdict.

### rev-31 · 2026-10-16T16:11:39.360Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-628-source
commit: cc01903bdcee75ee5b9b16f8380693604554edf7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards 0 findings, Spec 0 findings. A-3979 records full review. Exact value-span editing preserves unrelated bytes, spacing/comments/line endings; missing keys/tables insert at real table boundaries; scanner retains both multiline clause forms as string contents. Tools preserve supplied grant order. parseRoles validates every returned/published candidate and propagates key-specific errors. Optional allowedHarnesses follows independently read Coordinator92ccf49d; omitted preserves custom adapters, editor/writer supply built-ins. Writer follows existing crew compare-before-rename pattern, exclusive same-directory temp and finally cleanup, with stale-read and old-inode tests. A-3971 reported typecheck/8focused/shards green; independent tip/diff check confirmed. C1–C5 source-verified; C6 final execution mark waits fresh same-head verification. No Reviewer edits/tests.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
