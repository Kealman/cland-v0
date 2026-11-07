---
id: T-1733
kind: task
title: "`cland config set` rewrites `.cland/config.toml` without its `[hosts]` tables, deleting every configured host and pool"
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by: []
regression_of: T-1716
found_by: qa
topic: null
branch: t/T-1733-cland-config-set-rewrites-cland-config
created: 2026-11-07T03:22:01.675Z
updated: 2026-11-07T03:27:58.162Z
---

## Summary

qa-678 found this in the E-1533 stage-2 QA run at dev 08bf3e54, scratch row E1533S2-50. In a project with two `[hosts.*]` pool tables, `cland config set verification.provision setup.sh` exited 0 and printed `applies now`, and both host tables were gone from `.cland/config.toml` afterwards. `hub/src/init/config-set.ts:66–68` parses the document through `ProjectConfig` and writes it back with `renderConfig`. `hub/src/init/config.ts` validates `doc.hosts` (line 259) but `renderConfig` never renders hosts. Any `config set` therefore silently deletes every configured SSH host and every pool, which `cland host prepare` and `cland host create` depend on. The code predates stage 2 (unchanged since stage 1), but T-1716 made pools live in these tables, which turns it into data loss for the v0.4 host flow.

## What to build

- `config set` preserves every table and key it does not change. That covers `[hosts.*]` and anything else `renderConfig` does not model: either a minimal edit of the one key, or full rendering of `hosts` with a round-trip test over every section.
- A test with SSH host tables and pool tables (harness pins, provider, size, region) shows them byte-preserved, or equal after reparsing, across a `config set` of an unrelated key. Red before the fix.
- Rule 20 sweep: every writer of `.cland/config.toml` (`config set`, `cland init` re-runs, setup and onboarding paths) gets the same check.

## Acceptance criteria

- [ ] C1. After `cland config set verification.provision setup.sh` in a project with two pool tables and one SSH host table, all three tables and their keys remain, and `cland host prepare` still lists both pools (test, red before the fix).
- [ ] C2. Every other writer of `.cland/config.toml` found by the sweep preserves the `[hosts.*]` tables (test per writer).
