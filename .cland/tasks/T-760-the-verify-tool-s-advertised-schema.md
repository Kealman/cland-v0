---
id: T-760
kind: task
title: The verify tool's advertised schema accepts {dryRun:true}, but the hub answers "invalid verify request"
state: closed
status: done
size: XS
labels:
  - bug
  - hub
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-17T22:27:11.035Z
updated: 2026-10-20T06:07:27.708Z
closed: 2026-10-20T06:07:27.708Z
---

## Summary

impl-707 and impl-745 reported this on 2026-10-17 at 22:07–22:13Z. The MCP `verify` tool's advertised schema accepts `{dryRun: true}`, but the hub returns `{ok:false, error:'invalid verify request'}` for that read-only request. impl-752 got a structured dry-run through the same tool with a different payload, and the CLI's `cland verify --dry-run` works when the hub answers in time. So the schema and the request validation disagree on which fields a dry-run needs.

## What to build

The advertised schema and the hub's validation agree. Either a bare `{dryRun: true}` is a valid read-only preview using the session's item and branch defaults, or the schema marks the fields it requires. The error names the missing or invalid field.

## Acceptance criteria

- [ ] C1. A T2 test calls the verify tool with exactly the advertised minimal dry-run payload, gets the selection plan or a refusal that names the offending field, and fails before the fix.

## Comments

### coord · 2026-10-20T06:07:27.708Z

Closed in the D76 triage (2026-10-20, read-only check at dev 9b2cb194, artifact to follow in General): fixed by fc46edb1 (T-793): the verify tool's dryRun schema and the hub agree.
