---
id: T-1206
kind: task
title: Docs lint flags 'until T-n', 'stand-in' and 'pending' wording that names a closed item
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-999
branch: t/T-1206-docs-lint-flags-until-t-n-stand-in-and
created: 2026-10-24T06:46:05.445Z
updated: 2026-10-24T21:44:24.988Z
closed: 2026-10-24T21:44:24.988Z
---

## Summary

README sentences claiming landed work was pending or a stand-in recurred as QA findings across v0.2 stages (T-1160, T-1164, T-1180). Retro A-10321, triage A-10327.

## Acceptance criteria

- [x] C1. The lint reports each README or docs line that names a closed item with 'until', 'stand-in', 'pending' or 'later ticket' wording, over a fixture tracker (test).
  - done: impl-1206 · 2026-10-24T20:56:36.086Z
  - verified: rev-32 [reviewer] · run rev-20261024-1206-final · 2026-10-24T21:13:11.238Z · commit ca706553086cf84d55850bb91edc31558133850b
- [x] C2. The current READMEs pass, or each finding is fixed in this item (docs).
  - done: impl-1206 · 2026-10-24T20:56:36.186Z
  - verified: rev-32 [reviewer] · run rev-20261024-1206-source · 2026-10-24T20:59:40.049Z · commit ca706553086cf84d55850bb91edc31558133850b
  - verified: rev-32 [reviewer] · run rev-20261024-1206-final · 2026-10-24T21:13:11.238Z · commit ca706553086cf84d55850bb91edc31558133850b

## Comments

### impl-1206 · 2026-10-24T20:51:45.180Z

Implementation seam: T0 in-memory fixture tracker/documents through the lint's diagnostic function, then the same guard against repository Markdown. It catches same-line closed-item references with until/stand-in/pending/later ticket wording; it is a lexical drift warning, not semantic proof about unrelated clauses. Cheapest adequate tier is T0 (no worker, sockets, process or waits). No existing shared protocol/schema/policy contract changes; new lint admission is scoped to npm test:static/check. Consumer audit before wiring: package.json test:static -> test:lint -> check; .cland/config.toml verification.check; hub/test/run-suite.ts checks; hub/README.md verification docs; docs/agents/tests.md; implement skill (no CLI/native/client wire changes).

### impl-1206 · 2026-10-24T20:55:53.716Z

TDD evidence (local macOS arm64, Node v24.21.0; working tree before source review): initial exact-diagnostic fixture failed with actual [] vs five README/docs findings, then passed. Exemption slice failed on two unwanted findings, then passed; inline-exemption scope failed with actual [] vs README.md:2, then passed. Prefix/alias slice failed with actual [] vs E-90004/T-90004 findings, then passed. Current guard scans 224 documents / 1259 candidate tracker items with zero findings after replacing the obsolete main-until-T-59 override and adding specific historical/runtime exemptions. npm run typecheck passed all configured projects plus web source/colour/hooks checks. No runtime tiers or browser phase run locally; source guard only. Consumers: test:static/test:lint/check pick up the new gate by package script; verification.check already invokes check; no protocol/wire/schema/persisted shape migration. Docs/help/implement skill updated; role permissions/clauses unchanged.

### rev-32 · 2026-10-24T20:59:40.049Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1206-source
commit: ca706553086cf84d55850bb91edc31558133850b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-11428 full Standards/Spec source review clear, no findings. T0 pure diagnostics reuse parseItem/normalizeId; exact fixtures cover all4phrases, open/unknown, duplicate refs/CRLF, default-prefix aliases and reason-required same/preceding-line exemption scope. Nonempty scan guards avoid vacuous success; candidate tracker only, no live hub. Appended test:static gate preserves existing test:lint/check order; help/shared guide/README/implementSKILL+CHANGES match. Audited all59 exemption reasons and adjacent lines: specific historical decisions/evidence or runtime conditions, no generic file-wide bypass. Removed stale main-until-T59 override, retained general taskBase/doctor description. C2 source-verified; C1 awaits actual same-head configured T0 fixture/scan receipt. A11420/local224docs1259items/zero diagnostics and typecheck are claimant implementation summaries with Darwinarm64/Node24.21 attribution, not original raw configured pass; preserve available original outputs/exits/timings without transcription reruns. Reviewer ran no tests/probes/browser or edits. One unchanged-head ordinary mode-free verify may follow; changed head needs new source review. No fullT3/T4/QA/landing claim.

Criteria: C2 verified.

### rev-32 · 2026-10-24T21:13:11.238Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1206-final
commit: ca706553086cf84d55850bb91edc31558133850b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-11461 carries source/A11428 and independently audits original same-head a64c6f20/A11456. Required T0 facts present: new test:static command, fixture diagnostics passed,224documents/1259trackeritems/0findings,0lintrefusals,T0exit0. Host macOS check26.173s at executor-excluded gatef8307d70, fullHEADtree0f6bd933; not repeated on Linux. Parsed3063 ordinarytest/432filepasses, nofail/skip/cancel or separate load finishes. Linux c8lon1 allT1/allfallback hub+NeovimT2/Webpass; noT3/T4. Prepared actual HeadlessShell156.0.8078.4/v1248, headless shipped harness. Reportlint133/60,9missing,Web/timingwarnings retained; ratchet2195.304vs2195.304 has incompletebase, notenforcedperformanceproof. T1/T2/Websuitewalls55.33/327.18/138.08 distinct fromenvelopes59/331/142; lifetime621s/$0.0431not suitewall. A11430 originalvisiblelocal excerpts preserve dirtyprecommit/no-treehash/toolwaitlimits and actualreds, no reconstructionreruns; independent configuredhostscan supplies finalproof. All59 exemptions andT59removal previouslysourceaudited. C1/C2allverified,no findings. NofullT3/T4,peritemQA,landed/integrationclaim.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T21:44:24.988Z

Merged b90f40d4379a66de4f1e5de2f6ed4589e996ad8c onto dev.
dependencies out of date: package.json changed; run npm install in root /Users/evgeniyivanov/Projects/cland/v0 (required; stop shared readers before updating node_modules)
