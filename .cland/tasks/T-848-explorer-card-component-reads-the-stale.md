---
id: T-848
kind: task
title: explorer-card-component reads the stale-evidence card before its row is under the cursor
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
  - flake
assignee: null
parent: E-482
blocked_by: []
topic: topic-572
branch: t/T-848-explorer-card-component-reads-the-stale
created: 2026-10-19T06:58:09.511Z
updated: 2026-10-19T10:59:57.413Z
closed: 2026-10-19T10:59:57.413Z
---

## Summary

`nvim/test/explorer-card-component.test.ts` › "empty and stale card evidence stays explicit, and live suite states come from task summaries" failed once on a droplet, in T-843's run 8a94e492 at d2e38ce7 (A-5849, lines 44305–44307). Card T-10 expected "Old proof" but found no row under the cursor, and the test took 5.684 s against its 5 s bound. T-843 doesn't touch the explorer card. The case passed 5/5 alone on the Mac both on dev and at T-843's head. The test likely reads the card before its row is rendered.

## Acceptance criteria

- [x] C1. The test waits on an observed frame where the card row is under the cursor before asserting, keeping every assertion, with a red-to-green proof that delays the card render.
  - done: impl-848 · 2026-10-19T08:22:18.296Z
  - verified: rev-31 [reviewer] · run rev-20261019-848-source · 2026-10-19T08:25:05.820Z · commit 4f6c67757fa10290acaca13f1cc852fbb2357540
  - verified: rev-31 [reviewer] · run rev-20261019-848-final · 2026-10-19T08:36:56.952Z · commit 4f6c67757fa10290acaca13f1cc852fbb2357540
- [x] C2. The file passes 20 serial runs on the Mac and the mode-free task verify; its droplet repeat comes from the merge batch.
  - done: impl-848 · 2026-10-19T08:36:18.397Z
  - verified: rev-31 [reviewer] · run rev-20261019-848-final · 2026-10-19T08:36:56.952Z · commit 4f6c67757fa10290acaca13f1cc852fbb2357540

## Comments

### coord · 2026-10-19T08:18:50.914Z

Second case in the same file, 2026-10-19 08:18Z: `rapid j movement fetches only the rested row, reuses cached details and refreshes on updated` failed load-gate repetition 2 of 5 (4/5 passed) in T-665's task verify aab19490 at a4c3f1ea, with the same symptom: the card expects the written human picture, but no row is under the cursor. Evidence A-5881 (Linux droplet c-8). T-665 does not touch nvim/. Treat both cases as one defect in the file's cursor-to-row wait.

### impl-848 · 2026-10-19T08:21:25.055Z

Diagnosis: shown() used a single blocking nvim_exec_lua/vim.wait while nvim_input navigation was still pending. Controlled mutation deferred row selection input by 100 ms: original shared wait failed both named cases (~5.2 s each), fixed Node-side eventually/RPC observations passed both (~0.7 s each). Final change only touches shown(): observe target row under tree cursor, then matching card.key/drawn_key/text. Existing test bodies and fixtures verified byte-for-byte unchanged. Typecheck passed; 20 serial Mac file runs in progress. No QA brief required by scope:none policy.

### impl-848 · 2026-10-19T08:24:02.023Z

Implementation published at 4f6c67757fa10290acaca13f1cc852fbb2357540. Final local validation: 20/20 serial Mac file runs, 14 tests each, zero failures or skips (file 5.958–6.851 s; total 122.986 s), typecheck and lint passed. Evidence A-5886, durable path /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5886-t-848-controlled-delay-red-green-and-20-serial-mac-passes. Source review request delivered to Reviewer. C2 waits for same-head mode-free verification after clear source review; no head changes after first review unless required.

### rev-31 · 2026-10-19T08:25:05.820Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-848-source
commit: 4f6c67757fa10290acaca13f1cc852fbb2357540
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-848 source review: clear

Head: 4f6c67757fa10290acaca13f1cc852fbb2357540
Fixed base: 051afd53a0a4abf5884d90d74faf55a6cbf8dca2
Scope: full. One commit; only nvim/test/explorer-card-component.test.ts changes.

## Standards

Clear; no findings. The shared shown() helper replaces one blocking in-Neovim vim.wait with two bounded, yielding Node-side RPC observations. First it requires a valid tree window and the target row under its cursor. Then it requires matching card.key, card.drawn_key and expected card text. Each observation retains the existing 5000 ms failure bound; no elapsed-time assertion, product sleep or process is added. The retained eventually helper yields between reads instead of blocking queued navigation inside an RPC. The T2 recorded stub-client seam remains appropriate.

I independently compared the source around shown(): fixture content, all test bodies and their assertions are byte-identical to the fixed base. The old expected key/text predicate remains in the rendered-card observation, strengthened by drawn_key; bounded eventual failure still enforces it. No production module, fixture catalog, tier, allowance or duration baseline changes.

## Spec / controlled proof

C1 is established. A-5886 documents the same temporary select() mutation for both variants: defer actual queued target-row navigation by 100 ms. That delays cursor-driven card rendering without directly forcing card state. The old blocking helper fails both “empty and stale” and “rapid j movement” cases (0/2; 5.253/5.224 s). The fixed helper with the same mutation passes both (0.714/0.741 s). Raw red.log/green-delay.log retain those outcomes. The red root-card unrecorded-detail message is incidental; the target key/text never arrives while the queued input is blocked. The submitted source contains no deferred-navigation injection.

C2's Mac portion is independently audited from all 20 full-XX.log files: each positively reports 14/14, zero failure/cancellation/skip/TODO, totaling 280 ordinary test passes. File wall times range 5.957641584–6.851227834 s, sum 122.986498043 s. Maximum observed individual case is 0.808657417 s. serial-summary.log's outer process elapsed values are distinct from the raw runner duration_ms values above. These are Mac source receipts, not Linux execution.

The diagnosis matches the bounded observation gap implicated by A-5849 and subsequent T-665 evidence: nvim_input queues navigation, and a blocking Lua wait can prevent that input from completing. This review does not claim a product card-rendering fix, an increased timeout or proof that unrelated flakes are eliminated.

A-5886 also retains host typecheck output and reports changed-file lint T2/no direct findings plus clean diff. Reviewer performed read-only inspection, not test execution.

Result: source clear; C1 verified. C2 remains unverified pending one mode-free configured task verify at this unchanged head. Subsequent merge-batch integration is separately attributed as specified by C2. No full task run or per-item QA; any head change needs fresh source review.

Findings: Standards 0; Spec 0.

Evidence: A-5891.

Criteria: C1 verified.

### rev-31 · 2026-10-19T08:36:56.952Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-848-final
commit: 4f6c67757fa10290acaca13f1cc852fbb2357540
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-848 final evidence review: clear

Head: 4f6c67757fa10290acaca13f1cc852fbb2357540, unchanged from source review rev-20261019-848-source / A-5891.
Run: 77f31223-9346-43ce-8d65-7795237b9c82 / A-5901, raw exit 0.
Scope: evidence. Branch tip and task receipt match; C1/C2 are claimant-done and C1 is already source-verified.

## Standards

Clear; no findings. All 14 ordinary explorer-card-component cases positively finish pass and all 14 owned identities pass 5/5 fresh load repetitions. The stale-card case passes in 0.942090360 s, rapid-j in 1.087666638 s; the maximum owned case is 1.344061563 s, below T2's 2 s budget. Owned file sum is approximately 12.843 test-seconds, below 30 s. No owned hard duration failure, report-only overage, runtime tier mismatch, skip, cancellation or quarantine appears. The missing file baseline is a disclosed diagnostic, not a budget exemption.

Both phase failure arrays are empty. All 299 reported load-gate identities pass 5/5 and no runtime tier mismatch occurs anywhere in the receipt. Other external report-only budget debt and 36 missing baselines remain disclosed in A-5901; no global budget-clean claim is made.

## Spec

C1 remains verified by A-5891: yielding RPC observations establish the target cursor row before matching card key, drawn key and text. Controlled delayed navigation fails both implicated cases under the old helper and passes both under the submitted helper, with the injection removed. Every fixture, test body and behavioral assertion remains unchanged.

Verify C2: I independently audited all 20 retained Mac full-file logs in A-5886 (14/14 each, 280 passes, zero failure/cancellation/skip/TODO), and A-5901 now provides the required positive unchanged-head mode-free task gate. The card file itself runs on Linux in this T2 receipt and its complete 14-case gate passes 70/70 repetitions. This does not claim every possible editor race is eliminated or a production card-rendering change was made.

The criterion's later integration/merge-batch repetition remains separate landing evidence; this task receipt is not a completed merge batch. The report labels T3 as deferred. Existing T-665 failures on older source remain their own failed receipts until the Coordinator directs integration/disposition.

Ordinary overall result: 609 tests, 609 pass, zero failure/cancellation/skip/TODO (377 whole-T1 phase plus 232 Neovim cases). Host check passes. Suite 523.66 s, load-gate extra wall 391.70 s, peak load 5.34. Linux x64 c-8 lon1, workers 2, Node 24.21.0, Neovim 0.12.5; lifetime 610 s, cost $0.0423. Reported T3 ratchet equals base 2651.501 s with incomplete timings separately disclosed.

Result: final clear; C1/C2 verified. No further task run or per-item QA. Landing integration evidence remains Coordinator-owned.

Findings: Standards 0; Spec 0.

Evidence: A-5903.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T10:59:57.413Z

Merged 8f212a1c525b118fb49dd8c9c2a77e4de7556497 onto dev.
