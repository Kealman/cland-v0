---
id: T-749
kind: task
title: Droplet runs fail about 70 s after the lease turns active with 'machine command failed or exceeded its time bound' and no remote output
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - v0.1.4
  - hub
  - executor
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: topic-680
branch: t/T-749-droplet-runs-fail-about-70-s-after-the
created: 2026-10-17T17:58:46.346Z
updated: 2026-10-20T02:17:09.440Z
closed: 2026-10-20T02:17:09.440Z
---

## Summary

Two droplet runs today ended about 70 s after `executor-lease-active`, before any remote test output: integrated cover d55be09a (A-4419, 08:51Z) and T-744's run 8758bf4f (A-4686, 17:58Z). Both show outcome "machine command failed or exceeded its time bound", "platform unavailable", "counts unavailable". In both, the host gate finished and the next step (delivery or the first remote command) failed. Resubmits of the same heads were green. Each costs a rerun and its queue wait.

## What to build

From the journal and the executor's own logs, name which machine command fails (snapshot boot, SSH readiness, tree delivery, install) and why: a timeout too short for a cold droplet, SSH not ready, or a provider error. Then fix the bound or the readiness wait, and make the result name the failing step instead of the generic cause.

## Acceptance criteria

- [x] C1. The failing step is named with evidence from both runs, the fix is covered by a regression on the scripted provider, and a failed machine command's result names its step.
  - done: impl-749 · 2026-10-20T01:55:47.639Z
  - verified: rev-31 [reviewer] · run rev-20261020-749-final · 2026-10-20T01:56:00.591Z · commit 04789acf6367305b3a1fa9f431ba6d8edf20e557

## Comments

### impl-749 · 2026-10-20T01:42:00.334Z

Read-only triage identifies both failures as initial delivery SSH mkdir, before local env/run.sh creation. Neither snapshot fetch race (T-924) nor DigitalOcean API deadline (T-820). A-4419 bundle 08:51:33.044Z → failure 08:51:36.595Z; A-4686 bundle 17:57:38.696Z → failure 17:57:45.158Z. Both retained suite dirs lack env, run.sh and delivery.log. The historical Machine.exec discarded transport code/stderr; exact SSH failure reason cannot be recovered. Proceeding with fake transport regression and bounded idempotent delivery setup retry plus named steps.

### impl-749 · 2026-10-20T01:46:05.179Z

Implementation committed/pushed 04789acf6367305b3a1fa9f431ba6d8edf20e557 after fetch/merge origin/dev (2d2eb91f, already current). Forensics/limits and regression plan: A-6936, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6936-t-749-two-historical-failures-stop-at-initial-delivery-ssh-mkdir.md. npm run check passed (A-6937). Admission dry-run passed at exact head: configured droplet, T1/T2, all-T2 fallback. Coordinator cover-quiet forbids local tests, targeted included: no local runtime red/green is claimed. Source review next; configured mode-free droplet verification after clear source verdict. qaPolicy scope none.

### rev-31 · 2026-10-20T01:48:15.927Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-749-source
commit: 04789acf6367305b3a1fa9f431ba6d8edf20e557
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6941: source clear, no Standards/Spec findings. Both historical retained dirs/results/bundle mtimes and exact source ordering identify initial delivery SSH mkdir; precise original SSH reason was discarded, and A-6936 correctly limits that conclusion. Retry is idempotent mkdir only,30s total capped by lease,10s attempts/2s waits; T-924fallback and prepare/worktree checks retained. Machine preserves bounded token-redacted stderr/validated exit and signal without command-bearing execFile message; delivery names each transport step. Two new scripted T2 regressions cover bounds/recovery/error names/no prepare replay and Machine failure formatting. C1 remains runtime-pending: no local tests under cover-quiet; obtain unchanged-head configured mode-free green with both fresh identities5/5 and no owned violations. Static/dryrun prechecks reported green. QA none; no Reviewer tests/edits.

### impl-749 · 2026-10-20T01:55:48.611Z

C1 complete at unchanged reviewed/pushed head 04789acf6367305b3a1fa9f431ba6d8edf20e557. Configured mode-free droplet verification ed6af8ce is green: A-6946, 1919/1919 pass, zero nonpasses; Linux x64 Node v24.21.0, c-8 lon1, lifetime 394 s, $0.0273. Both new identities passed ordinarily (delivery readiness 0.105312 s; machine diagnostic preservation 0.001823 s) and each has 5 distinct passing load repetitions plus explicit 5/5 receipts (A-6946 lines 44292, 44335). No head changes or local runtime tests. Forensics A-6936, static check A-6937, admission A-6938, source clear A-6941. Reviewer receives same-head result directly and settles final verdict; no separate QA required.

### rev-31 · 2026-10-20T01:56:00.591Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-749-final
commit: 04789acf6367305b3a1fa9f431ba6d8edf20e557
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6947: final clear at unchanged 04789acf. Independently audited A-6946: 1919 ordinary plus10load passes, zero nonpasses/no duration/resource/missing diagnostics. Both new regressions have five distinct passing repetitions; explicit5/5 at44292/44335. Delivery ordinary.105311536s/maxrepeat.228142332s; errorfacts ordinary.001823349s/maxrepeat.004419294s; component12/12,sum3.717205362s. Host/allT1/fallbackallT2bothpackagesgreen. Historical failed mkdir step corroborated in A-6941; exact lost SSH reason remains unrecoverable and is not claimed recovered. C1verified,no findings. QA none;T3deferred;no Reviewer tests/edits.

Criteria: C1 verified.

### coord · 2026-10-20T02:17:09.440Z

Merged b7868c50aba3b07f287aafcbad45c09461371337 onto dev.
