---
id: T-1832
kind: task
title: The onboarding tour's stage on agent hosts
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1821
  - T-1827
topic: topic-1512
branch: t/T-1832-the-onboarding-tour-s-stage-on-agent
created: 2026-11-12T10:07:21.965Z
updated: 2026-11-14T23:43:58.079Z
closed: 2026-11-14T23:43:58.079Z
---

## Summary

The onboarding tour gains a tenth stage on agent hosts, in the tour's form: one round, tied to what is on the human's screen, ending with its "Look now". It says where the Hosts row is, what a waiting launch and its reasons mean, and how to add a login. Its commands match `cland host` and `cland login` as built.

## What to build

Spec §3.9 (the onboarding) and v0.1.4 §3.4 (the tour's form). The stage covers:
- the Hosts row in both workbenches, and the hosts view it opens in the web;
- a waiting launch: a status line in the inbox, not an ask, with its current reason ("waiting for a host", "waiting for a login <harness>", "waiting for host <id> to boot"), and the "create one?" card;
- adding a login with `cland login add <harness> --pool <pool>` in the human's terminal, or from the web's hosts view;
- that setting hosts up is one `cland setup` run, or `cland config set` by hand.

It ends with "Look now: the Hosts row in the sessions panel". The SKILL.md tour offer and the skill test's stage count move from nine to ten.

## Acceptance criteria

- [x] C1. TOUR.md has ten numbered stages, the tenth on agent hosts, each stage with exactly one "Look now" line, the tenth naming the Hosts row (test).
  - done: impl-1832 · 2026-11-14T22:21:01.229Z
  - verified: rev-35 [reviewer] · run rev-35-1832-final-1 · 2026-11-14T22:59:32.597Z · commit 71eba552a327a148aa95e3c8ff05e2c5bffaccdc
- [x] C2. The tenth stage names the Hosts row, the three waiting-launch reasons as the hub emits them, `cland login add` and the web's hosts view (test).
  - done: impl-1832 · 2026-11-14T22:21:02.577Z
  - verified: rev-35 [reviewer] · run rev-35-1832-final-1 · 2026-11-14T22:59:32.597Z · commit 71eba552a327a148aa95e3c8ff05e2c5bffaccdc
- [x] C3. Every `cland` command and config key in the stage passes the onboarding command check against the CLI help and the config keys, and SKILL.md's stage count reads ten (test).
  - done: impl-1832 · 2026-11-14T22:21:02.814Z
  - verified: rev-35 [reviewer] · run rev-35-1832-final-1 · 2026-11-14T22:59:32.597Z · commit 71eba552a327a148aa95e3c8ff05e2c5bffaccdc

## Blocked by

- T-1821
- T-1827

## Notes

- Hot files: `.agents/skills/onboarding/TOUR.md`, `.agents/skills/onboarding/SKILL.md`, `hub/test/skills-onboarding.test.ts`.
- Tests: `hub/test/skills-onboarding.test.ts` (T1 assertions inside the existing T2 file).
- Serves epic C6.

## Comments

### impl-1832 · 2026-11-14T22:18:58.655Z

Rule 20 consumer sweep before stage count change: rg of TOUR.md, nine/eight stages, stage headers/count and onboarding references across .agents, hub, site, docs, qa, shared, nvim and web finds active consumers .agents/skills/onboarding/SKILL.md, hub/test/skills-onboarding.test.ts (structure, remote-stage extraction, commandProblems), docs/agents/tests/hub-test-skills-onboarding.test.ts.md; these will migrate. hub/test/durations.json historical timing identity is measurement data, no count parser; unchanged. qa/briefs/E-1313.md M12 explicitly expects nine; qa/briefs/E-616.md C6/D2/R2 and docs/spec/v0.1.4.md describe historical eight-stage release; retained historical evidence, current QA uses updated per-test guide. WELCOME.md links tour without count, init/provisioning copies skill tree without parsing count; unaffected. No wire shape, persisted record or startup contract changes. Existing acceptance seams authorized by item C1-C3: source tour form/content plus exported CLI usage/configKeys command validator in existing T2 file.

### impl-1832 · 2026-11-14T22:19:50.235Z

Red receipt (macOS local Node v24.21.0, uncommitted test-only tree): node --test --test-name-pattern='the onboarding tour has ten stages' hub/test/skills-onboarding.test.ts ran 1 case, 0 pass/1 fail, actual failure '9 !== 10' at line 86. No native lifecycle cases or browser ran; load 3.04 <20. Existing file remains T2 with source-only assertions; no new native imports.

### rev-35 · 2026-11-14T22:27:07.225Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1832-source-1
commit: 960dc2c953370d15e0eb8b658811b86bb9313741
scope: full
findings: [{"severity":"medium","text":"Setup does not display the optional host offer under --yes, and custom paid login-host sizes need not include a quoted price. Qualify both claims to the actual skip/readiness and declared-price conditions.","file":".agents/skills/onboarding/TOUR.md","line":78},{"severity":"medium","text":"Current replay still requires the old nine-stage test/count and extracts stage9 through EOF, now including host commands in remote-only checks. Migrate selector/count and bounded extraction; inspect E-616 D3 old identity too, preserving historical receipts.","file":"qa/briefs/E-1313.md","line":45},{"severity":"low","text":"Link/code UI elements appear only when supplied by the harness prompt/free-form card. Qualify the unconditional link-and-code presentation claim.","file":".agents/skills/onboarding/TOUR.md","line":76}]
finding_counts: {"high":0,"medium":2,"low":1}

Complete first source pass not clear; A-19442 records Standards1 medium/1 low and Spec1 medium. Ten-stage structure, one final Look now each, exact waiting templates/interpolation, both workbench labels and shipped command vocabulary are present. No run-dependent criterion verified before corrected-head configured evidence. A-19441 original visible excerpts retain precommit/raw-output/tree/inventory/scan limits; no provenance-only rerun. QA replay consumers are not made historical solely by a new per-test note. Clean stable pin; full pass releases hold for consolidated corrections and fresh exact-head source review before verify. Reviewer read-only.

### impl-1832 · 2026-11-14T22:28:04.711Z

Source-review fixes: setup --yes explicitly skips optional offer, pricing claims conditional on default pool and c-8/c-16 builders, supplied sign-in prompts conditional; E-1313 M12 current case/count moved to ten and stage9 sed read bounded; E-616 executable C6/R2 current count moved to ten with original criterion history explicit. Rule20 sweep disposition updated: both QA briefs are migrated executable consumers, not merely historical. Targeted revised prose tests (macOS local Node24.21.0, precommit candidate): 5/5 source/command cases, no skips/fails, duration_ms512.243042; no component/native/browser rerun. Closed wording lint 755 docs/1859 items/0 findings. Typecheck remains earlier precommit evidence; no TS changes since. A-19441 preserves original visible producer excerpts and limits.

### rev-35 · 2026-11-14T22:32:52.842Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1832-source-2
commit: 540e8fdef4752e96fe426fa32298eb9df186c809
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at exact clean 540e8fdef, Git tree d4be6c2e8c09bbd4847f2ee85b0e064a49aa0d43. A-19448 records both axes: Standards 0 / Spec 0. A-19442's setup/price qualifications, conditional harness prompts and E-1313/E-616 current replay migration are resolved, including the last D3a selector. Ten stages/final Look now structure and command-check coverage rechecked. C1–C3 remain unverified until same-head configured positive receipts; candidate excerpts remain qualified. No Reviewer runtime/provenance reruns. Normal mode-free verification may proceed at this head; remaining T3/T4/stage occasions separate.

### impl-1832 · 2026-11-14T22:33:19.040Z

Correction to Rule20 inventory: hub/test/durations.json is an active admission consumer, not historical-only data. Mode-free verify at540e8fdef refused before any test phases: verify-tiers: duration key has no matching test identity: hub/test/skills-onboarding.test.ts::the onboarding tour has nine stages ending with Look now (line5823). Removed obsolete measured key; did not assign a guessed old duration to the new ten-stage identity. Old timing remains Git history/A-19441 disposition, not current registry. Fresh source review required before new verify.

### rev-35 · 2026-11-14T22:34:09.153Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1832-source-3
commit: 71eba552a327a148aa95e3c8ff05e2c5bffaccdc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-19449: source clear at clean 71eba552a327a148aa95e3c8ff05e2c5bffaccdc/tree550c26410f3cd805fb70014f86adfccd07067618. Only obsolete nine-stage duration entry removed; no new timing/allowance transferred. Read-only inspection confirms lintDurationIdentities actively consumes this key, correcting the earlier historical-data-only disposition. Prior admission refusal retained; no phases executed. A-19448 full source findings remain resolved. C1-C3 await positive same-head configured receipts. No Reviewer runtime/provenance rerun; normal mode-free submission may proceed at this head.

### rev-35 · 2026-11-14T22:59:32.597Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1832-final-1
commit: 71eba552a327a148aa95e3c8ff05e2c5bffaccdc
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, C1-C3 verified. A-19455 independently reconciles original A-19454/run cdbbfbb5: exact head71eba552a, normalized tree69a7b606, clean unchanged Git root550c2641. 6310 ordinary test/694 file passes, separately130 load test/file passes; no negatives. All15 onboarding base cases and ordinary file pass; ten-stage case line25095 plus five distinct load passes, shipped-vocabulary/negative controls25083/25087 and remote controls25232/25237. All220T1+420T2+54Web files positive, zero missing;265T3/17T4 deferred separate occasions. Linux droplet Node24.21/nvim.12.5 actual HeadlessShell1248/CfT156.0.8078.4, no cache/skips; T0/T1/fallbackallT2/Web exit0,1342s/$0.0932. Source fixes and prior admission refusal retained, report-only warnings/candidate capture limits preserved. No Reviewer runtime/provenance rerun.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-14T23:43:58.079Z

Merged 0d1390dde3e21a62356cdcdb146a6df7efe274f9 onto dev.
