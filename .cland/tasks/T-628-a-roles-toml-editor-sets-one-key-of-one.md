---
id: T-628
kind: task
title: A roles.toml editor sets one key of one role table and keeps the rest of the file
state: open
status: in progress
size: S
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by: []
topic: topic-389
branch: t/T-628-a-roles-toml-editor-sets-one-key-of-one
created: 2026-10-16T16:04:11.537Z
updated: 2026-10-16T16:05:18.151Z
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
- [ ] C2. A key absent from the table is inserted inside that table, and a missing `[<role>.launch]` table is created after the role's other tables (unit tests for both).
- [ ] C3. A line beginning with `[` inside a role's multi-line clause is never taken for a table header (unit test with such a clause).
- [ ] C4. `[<role>.permissions] tools` gains grants while its other grants keep their order (unit test).
- [ ] C5. A result the hub's roles parser refuses is never returned, and the error is the parser's message naming the key (unit tests with an unknown harness and an unknown grant).
- [ ] C6. The write helper replaces the file atomically and refuses with "changed while setting it; retry" when the file changed after it was read (unit test).
