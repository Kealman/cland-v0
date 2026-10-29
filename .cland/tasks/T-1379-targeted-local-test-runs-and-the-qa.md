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
updated: 2026-10-29T19:25:18.107Z
---

## Summary

qa-677's E-1309 DoD verdict (A-12653) recorded 154 local tests on Node v25.6.1 although the packages require `>=24.13.0 <25`: a Codex session's PATH resolved a different Node than the Coordinator's shell (v24.21.0, nvm). `cland verify` pins its runtime, but `node --test` runs and `qa-record.sh` do not check it, so supplemental evidence can silently come from an unsupported runtime.

## What to build

`qa-record.sh` (run and note) refuses, or records the case INCONCLUSIVE with the reason, when `node --version` is outside the root package's engines range; the test admission helper used by targeted `node --test` runs prints one warning line naming the running Node and the required range. Document in the QA skill and the implement skill how a session selects the supported Node.

## Acceptance criteria

- [x] C1. `qa-record.sh` with a Node outside the engines range does not record PASS and names the running and required versions (test with a stub node on PATH).
  - done: impl-1379 · 2026-10-29T19:24:18.500Z
- [x] C2. A targeted test admission under an unsupported Node prints one warning naming both versions (test).
  - done: impl-1379 · 2026-10-29T19:10:51.683Z
- [x] C3. The QA and implement skills say how to run on the supported Node.
  - done: impl-1379 · 2026-10-29T19:24:18.771Z
  - verified: rev-31 [reviewer] · run rev-20261029-1379-source2 · 2026-10-29T19:25:18.107Z · commit f88a373afbe9ce2ef49eceabd0412e25a838a8ff

## Comments

### impl-1379 · 2026-10-29T19:08:12.549Z

Scope/consumer inventory before policy change: qa-record.sh run and note callers in QA skill/briefs and hub/test/skills-qa.test.ts; recover preserves historical receipts and is unaffected. Targeted admission consumers are hub/src/test-admission.ts, hub/test/cover-quiet.ts, nvim/test/cover-quiet.ts, web/test/cover-quiet.ts and package runner admission imports (searched test-support/admission and assertTestAdmission). Warning is additive stderr only, no wire/list/schema change. Tests at existing recorder CLI and admission seam; no remote platform changes.

### impl-1379 · 2026-10-29T19:10:39.926Z

C1/C2 red→green proved with stub PATH Node and injected admission process facts. Full consumer inventory and disposition published in item-topic artifact T-1379 implementation and evidence. Correction to initial inventory: Neovim enters via nvim/test/fixture.ts (not a separate cover-quiet file); web has no direct admission import. No command arguments/receipt shapes migrate; unsupported recorder invocation now refuses at exit 2, supported callers unchanged.

### impl-1379 · 2026-10-29T19:23:40.592Z

Review M1 additional consumers: hub/src/init/skills.ts provisionSkills copies every regular skill file to arbitrary projects; packaging release carries .agents/skills as source. Host package.json may be absent/engine-less/conflicting and is not cland's runtime contract. Added actual provisionSkills output regressions (all red before fix), with supported run/note positives and unsupported refusals. qa/node-engines.json now travels beside recorder, guarded for exact parity with shipped root engine range. No provisioning API/manifest shape changes; normal managed-file hashes include the companion.

### rev-31 · 2026-10-29T19:23:50.045Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-1379-source1
commit: f960846fab74259eea78d14ebad3795c0160047f
scope: full
findings: [{"severity":"medium","text":"M1: ../../../package.json resolves the receiving project's manifest after cland provisions the QA skill, not cland's shipped engine contract. Missing/engine-less manifests block supported QA; conflicting engines check the wrong policy. Preserve shipped authority through provisioning/packaging and add copied-recorder positives/refusals; align skills guidance.","file":".agents/skills/qa/qa-record.sh","line":49}]
finding_counts: {"high":0,"medium":1,"low":0}

Source1 not clear; consolidated M1 only, A-14033. C2 warning source is appropriate but remains runtime-unverified. Existing source-only recorder tests miss the provisioned skill consumer. Local A-14014 targeted results do not cover that boundary; no Reviewer execution. Fix and request replacement source review before verification.

Criteria: C1 failed (Provisioned run/note read a missing or unrelated project engine range instead of cland's shipped contract.), C3 failed (Copied skill guidance directs users to the receiving project's root engine range rather than the recorder's shipped runtime contract.).

### rev-31 · 2026-10-29T19:25:18.107Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1379-source2
commit: f88a373afbe9ce2ef49eceabd0412e25a838a8ff
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source2 clear; M1 resolved by managed sibling node-engines.json and three actual provisionSkills copied-recorder regressions for absent/no-engines/conflicting host manifests, with root parity and supported/unsupported run/note assertions. A-14037 records Standards/Spec audit. C3 source verified; C1/C2 configured runtime evidence pending. Original assertions and cover behavior retained, no receipt/wire changes. Local reported23/23+5/5/typecheck remain separate, no Reviewer executions.

Criteria: C3 verified.
