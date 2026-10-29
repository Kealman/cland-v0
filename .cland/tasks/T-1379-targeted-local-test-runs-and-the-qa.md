---
id: T-1379
kind: task
title: Targeted local test runs and the QA recorder run on a Node outside the package engines without saying so
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: null
branch: null
created: 2026-10-27T22:51:49.617Z
updated: 2026-10-29T15:59:43.251Z
---

## Summary

qa-677's E-1309 DoD verdict (A-12653) recorded 154 local tests on Node v25.6.1 although the packages require `>=24.13.0 <25`: a Codex session's PATH resolved a different Node than the Coordinator's shell (v24.21.0, nvm). `cland verify` pins its runtime, but `node --test` runs and `qa-record.sh` do not check it, so supplemental evidence can silently come from an unsupported runtime.

## What to build

`qa-record.sh` (run and note) refuses, or records the case INCONCLUSIVE with the reason, when `node --version` is outside the root package's engines range; the test admission helper used by targeted `node --test` runs prints one warning line naming the running Node and the required range. Document in the QA skill and the implement skill how a session selects the supported Node.

## Acceptance criteria

- [ ] C1. `qa-record.sh` with a Node outside the engines range does not record PASS and names the running and required versions (test with a stub node on PATH).
- [ ] C2. A targeted test admission under an unsupported Node prints one warning naming both versions (test).
- [ ] C3. The QA and implement skills say how to run on the supported Node.
