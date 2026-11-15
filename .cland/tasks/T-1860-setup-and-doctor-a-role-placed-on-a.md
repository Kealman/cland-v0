---
id: T-1860
kind: task
title: "Setup and doctor: a role placed on a missing pool reads skip"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1519
branch: t/T-1860-setup-and-doctor-a-role-placed-on-a
created: 2026-11-14T20:16:16.052Z
updated: 2026-11-15T07:52:17.086Z
closed: 2026-11-15T07:52:17.086Z
---

## Summary

When a role is placed on `--pool agents` but no `agents` pool is configured, setup's agent-hosts step prints `skip`, and doctor says nothing. A role like that cannot launch, so the step is really incomplete. Found while writing the E-1537 stage-3 QA brief, at `d5809f556`. The behaviour predates T-1830 and T-1831.

## What to build

When at least one role is placed on a pool that does not exist, setup's agent-hosts step prints `open`. Its detail names each such role and pool, and its fix gives the exact `cland config set hosts.agents.…` commands, or the command that moves the role back to the local pool. Doctor's hosts block prints a `warn` with the same fix. Neither one writes anything. If no role points at a missing pool, both behave exactly as they do today.

## Acceptance criteria

- [x] C1. Without a terminal and with a role placed on a missing `agents` pool, setup's agent-hosts step prints `open`, naming the role, with the exact fix commands and no writes. With no such role, the output is unchanged (test).
  - done: impl-1860 · 2026-11-15T06:42:25.279Z
  - verified: rev-35 [reviewer] · run rev-35-1860-final-1 · 2026-11-15T07:13:37.660Z · commit 2eb80d321bbccd21d1ef6f09aa4a87afe658e454
- [x] C2. Doctor's hosts block warns for a role on a missing pool and gives the same fix. It makes no provider call (test).
  - done: impl-1860 · 2026-11-15T06:42:25.437Z
  - verified: rev-35 [reviewer] · run rev-35-1860-final-1 · 2026-11-15T07:13:37.660Z · commit 2eb80d321bbccd21d1ef6f09aa4a87afe658e454

## Comments

### impl-1860 · 2026-11-15T06:39:38.581Z

Consumer sweep before output changes: setup runner summary/exit and CLI render/JSON retain SetupLine shape; doctor CLI render/summary retains Check shape. setup-flow, setup-hosts, setup-cli, setup-hub, setup-remotes, setup-remote-component, scenarios/setup and doctor-hosts inspected; untouched/default local placements unchanged, no existing exit-zero expectation changes. setup-hosts adds missing-placement exit-one regression. E-1537 stage 3 configures agents before placement (unchanged); stage 4 source audit must include explicit missing-pool sentence, scratch untouched/configured cases unchanged; stage 5 brief absent. Other matches: hub README, usage/setup, cland-setup/doctor docs, hosts site page, CLI docs, onboarding TOUR/skill tests, hosts-docs and remote-docs wrappers, host-pools fixtures, QA E-616/E-1313/E-1532/E-1533/E-1534 briefs: no missing-pool output assumptions; no protocol field or persisted record changes. Shared helper will provide same detail/fix for both reports; existing legacy wire regressions remain. Red setup regression: lines.length actual 1 expected 2 on baseline.

### rev-35 · 2026-11-15T06:48:03.427Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1860-source-1
commit: 9108ee3b87c3c42cd91185bdf9d5a5c8eb1ec34e
scope: full
findings: [{"severity":"medium","text":"Active source audit still requires absent old no-pool page sentence and unconditional doctor return; migrate both needles and nearby current known-defect/page-silence guidance, preserving historical receipts.","file":"qa/briefs/E-1537-stage-4.md","line":402},{"severity":"medium","text":"Older no-pool paragraph still unconditionally promises one ok hosts:no host pool row. Qualify it for no missing role placement; a new introduction does not supersede the stale sentence.","file":"docs/hub/cland-doctor.md","line":46},{"severity":"low","text":"Touched untouched-nonterminal guidance needs without --yes before promising exact commands; the yes branch returns before command guidance.","file":".agents/skills/implement/SKILL.md","line":18}]
finding_counts: {"high":0,"medium":2,"low":1}

Complete source pass not clear; A-19558 records Standards2medium+1low/Spec0 source implementation findings, all confirmed by lead. Shared missingRolePools correctly drives setup open/doctor warn with identical metadata-only fixes and no added effects; no-missing path preserved. Frozen SETUP_USAGE owning bytes match, controls unchanged. C1/C2 remain unverified, no implementation criterion failed. A-19557 candidate/raw-capture/inventory/publication limits retained; no Reviewer runtime/provenance rerun. Hold released for consolidated doc/replay corrections and fresh exact-head review before mode-free verify; no extra native run requested.

### rev-35 · 2026-11-15T06:50:46.040Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1860-source-2
commit: 2eb80d321bbccd21d1ef6f09aa4a87afe658e454
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at clean2eb80d321bbccd21d1ef6f09aa4a87afe658e454/treefe20ca877056925882339d6a480f49b5402d1f10. A-19560 records Standards0/Spec0remaining: all A-19558 findings resolved across four docs/skill paths; no runtime/test bytes changed. Corrected page/source needles match once each, old doctor and skill conditions qualified, historical receipts separated. Coordinator88b806a1 explicitly dispositions unrelated signin-order mismatch as closed-stage881114bfd history;128/129 is not QA green. C1/C2 await positive same-head configured receipts; normal mode-free verify may proceed. Candidate/raw-stream/inventory/scan limits retained; no Reviewer runtime/provenance rerun. Per-item QA none; broaderT3/T4/parentstage occasions separate.

### rev-35 · 2026-11-15T07:13:37.660Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1860-final-1
commit: 2eb80d321bbccd21d1ef6f09aa4a87afe658e454
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; C1/C2 verified. A-19570 independently streams A-19569/c82eff73 at clean2eb80d321/tree42c92407: doctor14788 and setup25277 ordinary passes plus5 load test/file pairs each; no missing target pairs. Default decline/yes controls25411/25416 positive; doctor/setup files14867/25477 pass, help compatibility/full-help/public-doc/setup-flow consumers positive.6341ordinary tests/699files+170separate load tests/files, zero negatives;220T1+424T2+55Web accounted, no missing. Provenance36032 Linux droplet Node24.21/nvim.12.5 actual HeadlessShell1248/CfT156.0.8078.4 no cache/skips,1110s/$0.0771. Source findings resolved; report-only notices/candidate limits and Coordinator historical closed-QA disposition retained;265T3/17T4 separate occasions. No Reviewer runtime/provenance rerun.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-15T07:52:17.086Z

Merged 72f26bc5c7418ab933650f2c401e0ce32d0e7147 onto dev.
