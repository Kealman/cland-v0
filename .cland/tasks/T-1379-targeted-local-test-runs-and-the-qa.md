---
id: T-1379
kind: task
title: Targeted local test runs and the QA recorder run on a Node outside the package engines without saying so
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1214
branch: t/T-1379-targeted-local-test-runs-and-the-qa
created: 2026-10-27T22:51:49.617Z
updated: 2026-10-29T19:10:51.807Z
---

## Summary

qa-677's E-1309 DoD verdict (A-12653) recorded 154 local tests on Node v25.6.1 although the packages require `>=24.13.0 <25`: a Codex session's PATH resolved a different Node than the Coordinator's shell (v24.21.0, nvm). `cland verify` pins its runtime, but `node --test` runs and `qa-record.sh` do not check it, so supplemental evidence can silently come from an unsupported runtime.

## What to build

`qa-record.sh` (run and note) refuses, or records the case INCONCLUSIVE with the reason, when `node --version` is outside the root package's engines range; the test admission helper used by targeted `node --test` runs prints one warning line naming the running Node and the required range. Document in the QA skill and the implement skill how a session selects the supported Node.

## Acceptance criteria

- [x] C1. `qa-record.sh` with a Node outside the engines range does not record PASS and names the running and required versions (test with a stub node on PATH).
  - done: impl-1379 · 2026-10-29T19:10:51.565Z
- [x] C2. A targeted test admission under an unsupported Node prints one warning naming both versions (test).
  - done: impl-1379 · 2026-10-29T19:10:51.683Z
- [x] C3. The QA and implement skills say how to run on the supported Node.
  - done: impl-1379 · 2026-10-29T19:10:51.807Z

## Comments

### impl-1379 · 2026-10-29T19:08:12.549Z

Scope/consumer inventory before policy change: qa-record.sh run and note callers in QA skill/briefs and hub/test/skills-qa.test.ts; recover preserves historical receipts and is unaffected. Targeted admission consumers are hub/src/test-admission.ts, hub/test/cover-quiet.ts, nvim/test/cover-quiet.ts, web/test/cover-quiet.ts and package runner admission imports (searched test-support/admission and assertTestAdmission). Warning is additive stderr only, no wire/list/schema change. Tests at existing recorder CLI and admission seam; no remote platform changes.

### impl-1379 · 2026-10-29T19:10:39.926Z

C1/C2 red→green proved with stub PATH Node and injected admission process facts. Full consumer inventory and disposition published in item-topic artifact T-1379 implementation and evidence. Correction to initial inventory: Neovim enters via nvim/test/fixture.ts (not a separate cover-quiet file); web has no direct admission import. No command arguments/receipt shapes migrate; unsupported recorder invocation now refuses at exit 2, supported callers unchanged.
