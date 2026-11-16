---
id: T-1899
kind: task
title: Release preflight independent of covers
state: open
status: review
size: S
criterion_seq: 2
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by:
  - T-1876
topic: topic-1548
branch: t/T-1899-release-preflight-independent-of-covers
created: 2026-11-16T07:29:46.730Z
updated: 2026-11-16T11:32:18.447Z
---

## Summary

Run tools, PATH, auth, clean-root and version checks before any release cover, and list every refusal instead of the first. §7 #8 (with T-1876, T-1877 and T-1878).

Kind: product. Triage ticket H-11 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Acceptance criteria

- [x] C1. A release preflight mode reports every non-cover refusal (`gh` on the hub PATH, clean root, version files) without needing green covers (test).
  - done: impl-1899 · 2026-11-16T11:31:57.774Z
- [x] C2. The release skill runs it right after the release epic's brief (docs check).
  - done: impl-1899 · 2026-11-16T11:31:57.910Z

## Dependencies

T-1876

## Comments

### impl-1899 · 2026-11-16T11:26:18.265Z

Rule 20 consumer sweep: searched release frame/type/function names, ReleaseRequest, ReleaseResult, releaseDescription, dryRun and release-version across hub/src, shared/wire, nvim, web, shipped skills, QA briefs and every test tier. Production consumers: CLI release.ts, protocol.ts, shared wire and hub dispatch/Releases; migrated additively via release.preflight. Existing release wire shape/results/refusal codes remain unchanged (homebrew.test.ts retains previous-wire regression). Neovim/web do not initiate release; web denies unclassified frames by default. Existing QA briefs E-412, E-612, E-617, E-420, E-1314, E-1539 and T-117 exercise unchanged final dry-run/publication paths. Release tests release, release-item, release-t3-component, tracker-native-boundary remain unchanged consumers; wire-conformance checks request parity. No persisted preflight record, positional reader, startup probe or T4 release-frame consumer found. New preflight is report-only and uses no green-cover dependency.
