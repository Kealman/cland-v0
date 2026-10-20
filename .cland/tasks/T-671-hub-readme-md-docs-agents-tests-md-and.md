---
id: T-671
kind: task
title: hub/README.md, docs/agents/tests.md and the verify usage describe prepare, check and test
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - v0.1.4
  - verification
assignee: null
parent: E-614
blocked_by:
  - T-664
  - T-667
  - T-670
topic: topic-674
branch: t/T-671-hub-readme-md-docs-agents-tests-md-and
created: 2026-10-16T16:35:27.076Z
updated: 2026-10-20T01:27:37.213Z
closed: 2026-10-20T01:27:37.213Z
---

## Summary

The docs say what the three commands are, where each runs, and how to set them with `cland config set`. They also say how this repository's own modes, shards and covers map onto its values (E-614 C5). The epic's QA demo follows `hub/README.md` alone to set the three commands in a scratch project in another stack.

## What to build

- **`hub/README.md`.** A new section "Verification commands" before "Remote executors: droplets", written for a newcomer setting up their own project:
  - the three keys and what each is for;
  - where each runs: a local run runs `check` then `test` and never `prepare`, the host gate runs `check`, and a droplet runs `prepare` in its image and before every run, then `check` and `test`;
  - the rules: `test` is required and verify refuses without it, `check` and `prepare` are optional, lines run under `/bin/sh -c`, and `prepare` is idempotent and writes only ignored files;
  - setting them: `cland config set verification.test '<command>'` with a worked example for a Python project, and the reminder that a droplet run needs the change committed, since only a clean tree is bundled;
  - which config is read: the candidate's committed or working `config.toml`, else the root's;
  - what another stack does not get: coverage selection, the `hub` and `nvim` modes, the load gate and shards, which stay cland's own; its `test` runs in full.

  Update the existing sections that name npm scripts as the verify commands: Tests, the `cland verify` paragraphs, "Remote executors: droplets" (the host gate, `npm ci` and the Neovim pin in delivery), and "Running the suite on Linux".
- **`docs/agents/tests.md`.** One section for cland's own values: `prepare = "node hub/bin/verify-prepare.ts"`, `check = "npm run typecheck"` and `test = "npm test"`. It says how `hub`, `nvim`, `all` and coverage-selected runs and shards all run `npm test`, with the selection in `CLAND_SUITE_SELECTION`, and that changing these values changes the release path, so they go through review like code.
- **The usage text** (`hub/src/cli/usage.ts`). The `verify`/`suite` line reads "run the project's check and test detached; post one artifact-backed result" instead of "run typecheck and the package suite".
- **The template comments** from ticket T-664 match the README's wording.
- **The onboarding hand-off.** This epic does not touch the onboarding skill, which ships with E-616, and the prototype's stack step still says verify runs `npm run typecheck` and `npm test`. Add one line to the README's section that E-616's stack step can cite: record the stack's commands with `cland config set verification.prepare|check|test`.

**Keeping cland's own suite intact.** Docs and usage text only.

## Acceptance criteria

- [x] C1. `hub/README.md` has the "Verification commands" section with the keys, where each runs, the rules, the `cland config set` example and what stays cland's own, and no section still names `npm run typecheck` or `npm ci` as what verify runs for every project (grep).
  - verified: rev-31 [reviewer] · run rev-20261020-671-source · 2026-10-20T01:05:13.195Z · commit 24ebdd0e26113cb6264bcc8478d594a2ce3ef404
  - verified: rev-31 [reviewer] · run rev-20261020-671-source-corrected · 2026-10-20T01:09:52.015Z · commit 37daaa818ee061dc64cba5263ee3ae5847706e09
  - done: impl-671 · 2026-10-20T01:22:50.665Z
  - verified: rev-31 [reviewer] · run rev-20261020-671-final · 2026-10-20T01:23:12.524Z · commit 37daaa818ee061dc64cba5263ee3ae5847706e09
- [x] C2. `docs/agents/tests.md` names this repository's three values and the mapping of its modes and shards onto `npm test`.
  - verified: rev-31 [reviewer] · run rev-20261020-671-source · 2026-10-20T01:05:13.195Z · commit 24ebdd0e26113cb6264bcc8478d594a2ce3ef404
  - verified: rev-31 [reviewer] · run rev-20261020-671-source-corrected · 2026-10-20T01:09:52.015Z · commit 37daaa818ee061dc64cba5263ee3ae5847706e09
  - done: impl-671 · 2026-10-20T01:22:51.370Z
  - verified: rev-31 [reviewer] · run rev-20261020-671-final · 2026-10-20T01:23:12.524Z · commit 37daaa818ee061dc64cba5263ee3ae5847706e09
- [x] C3. The `verify` and `suite` usage lines describe running the project's check and test, and any test matching the old usage text is updated.
  - verified: rev-31 [reviewer] · run rev-20261020-671-source · 2026-10-20T01:05:13.195Z · commit 24ebdd0e26113cb6264bcc8478d594a2ce3ef404
  - verified: rev-31 [reviewer] · run rev-20261020-671-source-corrected · 2026-10-20T01:09:52.015Z · commit 37daaa818ee061dc64cba5263ee3ae5847706e09
  - done: impl-671 · 2026-10-20T01:22:52.003Z
  - verified: rev-31 [reviewer] · run rev-20261020-671-final · 2026-10-20T01:23:12.524Z · commit 37daaa818ee061dc64cba5263ee3ae5847706e09
- [x] C4. The README's worked example (`check = "python3 -m compileall -q ."`, `test = "python3 -m unittest"`), set with `cland config set` in a temporary project, is read back verbatim by the parser (ticket T-664's CLI test, extended with the README's lines).
  - done: impl-671 · 2026-10-20T01:22:52.509Z
  - verified: rev-31 [reviewer] · run rev-20261020-671-final · 2026-10-20T01:23:12.524Z · commit 37daaa818ee061dc64cba5263ee3ae5847706e09

## Comments

### impl-671 · 2026-10-20T01:03:25.263Z

Implemented docs/usage/template-comment updates and C4's existing T2 CLI/parser table extension. Coordinator confirmed current command values override stale ticket examples: npm run check plus explicit T1–T4 commands, npm test as whole-suite entry. Pre-test verify --dry-run admitted; config-set.test.ts 10/10 green, 3.059s (changed top-level test 0.399s); npm run check passes. No runner/config behavior changes. Preparing first review.

### rev-31 · 2026-10-20T01:05:13.195Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-671-source
commit: 24ebdd0e26113cb6264bcc8478d594a2ce3ef404
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6893 full Standards/Spec source clear, no findings. README three-command execution/host receipt/config fallback/clean-tree/ignored prepare rules match current resolver/runner/delivery; cland-only features and Python/onboarding examples covered. Agent guide matches actual npm run check/prepare/npm test and explicit tier overrides per primary4ee472f9, without runner/config changes. Both verify/suite usage and template comments aligned. C1–C3verified. C4 exact README Python rows retain literal CLI stdout/parser equality assertions in existing T2table; A-6892local10/10,file3.0586725s,changedcase.398748708s,commands14/14. C4final awaits fresh configured mode-free green at exact head. No new test identity/manifest edit; QA none/after-stage. This unchanged head is source-clear for mode-free verify.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-671 · 2026-10-20T01:08:30.393Z

Configured Linux run 6ac4f2ca failed only init-config.test.ts's literal template-comment regex (A-6894); my comment edit left that expectation stale. Targeted repro confirmed it. Corrected that existing T1 assertion to include the new builder wording and POSIX/idempotence comment, retaining parser literal and round-trip assertions. init-config.test.ts now 9/9 green, file 0.106s. No runtime behavior changed; fresh source review follows before another verification. No dev merge taken after first review.

### rev-31 · 2026-10-20T01:08:38.485Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261020-671-runtime
commit: 24ebdd0e26113cb6264bcc8478d594a2ce3ef404
scope: evidence
findings: [{"severity":"medium","text":"M1: Template test still requires old prepare comment immediately followed by prepare=, while task inserts accurate builder wording and shell/idempotence comment. A-6894 fails deterministic regex; update expectation while retaining literal/parser assertions.","file":"hub/test/init-config.test.ts","line":52}]
finding_counts: {"high":0,"medium":1,"low":0}

A-6895 runtime audit: A-6894 exact reviewedhead,561ordinary,560pass/1fail,zero resource/duration/missing diagnostics;T1exit1preventsT2. Sole failure raw40607/detail42949 is old comment regex in init-config.test.ts:52, a consumer missed during source review. Source docs/usage conclusions remain, but failed run not clear. Correct the expectation without weakening command/parser assertions, then fresh source review and replacement configured mode-free verification; no shared-defect retry. C4failed until fresh green.

Criteria: C4 failed (Configured same-head gate is red on stale template-comment assertion; T2 CLI/parser case never executes.).

### rev-31 · 2026-10-20T01:09:52.015Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-671-source-corrected
commit: 37daaa818ee061dc64cba5263ee3ae5847706e09
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6897 source clear,M1resolved. Only correction from24ebdd0e is init-config.test.ts:52exact regex matching the new builder/shell/idempotence comments before prepare=. Literal command/parser/full round-trip and other comment/tier assertions retained;no behavior/test-title/allowance change or devmerge. A-6895red1/1reproduces mismatch,green9/9zero nonpasses,file.106198959s,case.000372292s. Initial docs/usage/template reviewA-6893remains applicable;C1–C3reverified at newhead. C4actual Python CLI/parser assertion unchanged; final awaits replacement configured mode-free green at exact37daaa81. FailedA-6894and runtimeauditA-6896remain historical;no findings.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-31 · 2026-10-20T01:12:25.087Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261020-671-delivery
commit: 37daaa818ee061dc64cba5263ee3ae5847706e09
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6899 audits A-6898 exact reviewed37daaa81: exit1beforetests,zero progress finish receipts; raw39809–39810names missing Git prerequisite0f8cb85b75c17adb30cbc8d62c595ed8a22be5db. Counts unavailable,not assertion pass/fail evidence. No new owned source finding;A-6897sourceclear and C1–C3marks remain current,original M1corrected. C4final remains not clear until a completed green same-head task gate. Implementer already escalated recovery/retry to lead/Coordinator;hold head and await disposition. No unrelated edits/retry authorization implied;changed head needs source review.

Criteria: C4 failed (Replacement run fails Git bundle delivery before tests; no passing task evidence is available.).

### rev-31 · 2026-10-20T01:23:12.524Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-671-final
commit: 37daaa818ee061dc64cba5263ee3ae5847706e09
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6910: final clear. Independently audited A-6909 at unchanged reviewed/pushed 37daaa81: 1915/1915 ordinary passes, zero nonpasses, no duration/resource/missing diagnostics. Host check and all T1/fallback all T2 across both packages pass. C4 exact Python CLI/parser case passes .881552168s (raw43870), file10/10 and6.146433581s summed timing. Corrected M1 template case passes .001493028s (raw40600), file9/9 and.037873739s. No new identities, so no repetition groups expected. Source A-6897 remains applicable; C1–C4 claimant done confirmed. Prior failed A-6894/A-6898 retained; authorized retry resolves runtime evidence. No findings. T3 periodic/integrated; QA none/after-stage.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-20T01:27:37.213Z

Merged d3aac7af1753c937e318222a560e1180f7e68898 onto dev.
