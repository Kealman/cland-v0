---
id: T-1505
kind: task
title: Guard tests that run only in a build step also belong to a verify tier
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1278
branch: t/T-1505-guard-tests-that-run-only-in-a-build
created: 2026-10-31T08:18:54.391Z
updated: 2026-10-31T16:34:50.389Z
---

## Summary

A guard test that runs only inside a build step, such as the site prebuild, is invisible to `cland verify`. That let the site guard stay red from T-1275 (2026-10-25) until T-1480. Every such guard must also belong to a verify-selected tier, and a lint lists the orphans. Rule batch 5 (A-14855) C2, accepted by the human on 2026-10-31.

## Acceptance criteria

- [x] C1. A static lint, run in `test:static` in report mode (rule 27), lists every test or guard script that a package build or prebuild step invokes but no verify tier selects.
  - done: impl-1505 · 2026-10-31T16:34:50.389Z
- [x] C2. The site onboarding guard and any other orphan found are mapped to a tier, or recorded with a reason in the item.
  - done: impl-1505 · 2026-10-31T16:24:43.765Z
  - verified: rev-26 [reviewer] · run rev-20261031-1505-source-4 · 2026-10-31T16:34:38.035Z · commit 2ff6571ee30971df83e6126c955b21255c5a340a

## Comments

### impl-1505 · 2026-10-31T16:23:36.327Z

Consumer inventory (rule 20): root/package workspace scripts in package.json, hub/package.json, web/package.json and site/package.json; test:static entrypoint; hub/test/tiers.json and suite-shards tier consumers; eager imports in hub/test/remote-docs.test.ts; site/test/onboarding-claims.test.ts and site/test/remote-docs.test.ts; prerequisite lint/import analysis remains unaffected (different prerequisite policy); docs/agents/tests.md, hub/README.md and implement skill updated. No runtime wire, persisted record, startup probe or QA fixture contract changes. C2 inventory: both site guards already execute in T1 through remote-docs.test.ts; no orphan found. web/build.ts is the Vite build implementation, not a guard. Opaque/computed shell and script-hidden subprocesses require manual review, explicitly documented. No role clause lines added.

### impl-1505 · 2026-10-31T16:25:18.186Z

C2 final inventory clarification: conservative direct-script inventory reports web/build.ts twice (root build workspace chain and web package build). It only imports and calls Vite build; it contains no guard/test and needs no verify tier. Both site guard modules already execute under existing T1 remote-docs wrapper. Local validation: five new in-memory T1 cases pass; root typecheck passes (macOS arm64, local Node 24.21.0, no browser execution). test:lint first passed, then caught my tier entry accidentally placed in loadGuards during formatting cleanup; moved entry to tests and rerunning. No full local suite run.

### rev-26 · 2026-10-31T16:30:42.714Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1505-source-1
commit: b75000e3744c7a3ca1504cb55740124278d1a4fb
scope: full
findings: [{"severity":"medium","text":"M1: recognized launchers with no understood file operand (implicit node --test, eval/command modes, extensionless scripts) silently produce no finding; support them or report inventory incomplete, retaining positive and diagnostic controls.","file":"hub/test/build-guard-tiers.ts","line":38},{"severity":"medium","text":"M2: repeated npm workspace selectors overwrite earlier targets and flags after -- are misclassified as routing options, hiding real orphan guards behind a covered alternate route; preserve all targets and forwarded arguments or report unsupported routing.","file":"hub/test/build-guard-tiers.ts","line":64}]
finding_counts: {"high":0,"medium":2,"low":0}

Consolidated source1 audit: A-14983. Two medium findings; no additional standards findings. C2 site wrapper execution paths and recorded web/build.ts non-guard reason checked by source; no runtime criterion verified. No reviewer tests/build/lint/browser/native workloads. Replacement exact pushed-head source review before verification; no full run requested.

Criteria: C1 failed (Build-guard inventory silently misses unsupported launcher targets and misroutes repeated/forwarded npm workspace options.).

### rev-26 · 2026-10-31T16:32:01.312Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1505-source-2
commit: 3cdc1722435e3af5e0b560c530d5171ef211f606
scope: full
findings: [{"severity":"medium","text":"M1 remains: incidental covered operands hide the actual launch mode/entrypoint. --eval= plus covered argv, an extensionless script plus covered argv, and node --test with a covered preload can all produce false complete coverage. Parse actual launcher operands or explicitly report these forms incomplete, with covered-decoy controls.","file":"hub/test/build-guard-tiers.ts","line":39}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14984 consolidates source2: M2 corrected; M1 is the sole remaining medium finding. C2 source inventory unchanged; no runtime criterion verified. No tests/lint/build/browser/native work executed by reviewer. Replacement head needs source review before configured verification.

Criteria: C1 failed (Launcher scan still mistakes covered argv or preload operands for execution coverage and silently misses actual guards.).

### rev-26 · 2026-10-31T16:33:28.496Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1505-source-3
commit: 8c5000369b91d8e16e3643de4584871c901382b8
scope: full
findings: [{"severity":"medium","text":"M3: single | and & remain inside a shell segment and are discarded as script argv (or skipped after a known bundler), so a covered first command can hide an unselected second guard. Parse these boundaries or report unsupported shell operators incomplete before command classification; add covered-first pipeline/background controls.","file":"hub/test/build-guard-tiers.ts","line":46}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14986: M1 covered-decoy cases and M2 routing corrected; M3 is the sole remaining source finding. Source-only audit, no reviewer workloads or runtime marks. Fresh exact pushed-head source review required before verification.

Criteria: C1 failed (Unsupported pipeline/background shell operators can hide directly invoked build guards behind false complete coverage.).

### rev-26 · 2026-10-31T16:34:38.035Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1505-source-4
commit: 2ff6571ee30971df83e6126c955b21255c5a340a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14987: M1–M3 closed by restricted actual-operand parsing, all-workspace/-- routing, and whole-script unsupported-shell diagnostics before command classification. Report-only semantics and source C2 inventory confirmed. C1 runtime remains unverified; task.view still carries prior failed C1 mark, so lead restores done after correction/check receipts. No reviewer tests/lint/build/browser/native workload. Complete local checks, then one configured mode-free verify at exact unchanged head only after Coordinator quiet-slot release; no full run requested.

Criteria: C2 verified.
