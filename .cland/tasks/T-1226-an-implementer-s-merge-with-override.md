---
id: T-1226
kind: task
title: An Implementer's merge with override answers 'unknown field override' instead of the human-only refusal
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
regression_of: T-998
topic: topic-962
branch: t/T-1226-an-implementer-s-merge-with-override
created: 2026-10-24T10:40:12.804Z
updated: 2026-10-24T11:17:32.770Z
closed: 2026-10-24T11:17:32.770Z
---

## Summary

The Linux stage cover 4d0ec3dd at dev 44f220a5 (A-10755) fails hub/test/merge-policy.test.ts "the permission table refuses Implementer, Reviewer and QA on spoke and CLI; only the human shell overrides verdicts" (line 139): expected /only the human may override/, actual 'unknown field override; accepted fields: item, cancel'. Since T-998 (3830f7fc) validates arguments before argument-dependent permission checks, and the merge schema a non-human caller sees has no `override` field, the human-only refusal never fires. T3 test, so T-998's own verify and its T1 batch did not run it.

## Acceptance criteria

- [x] C1. `override` is a known `merge` field for every caller; a non-human caller sending it gets the human-only refusal (`forbidden`, "only the human may override"), and merge-policy.test.ts passes (test).
  - done: impl-1226 · 2026-10-24T10:44:19.067Z
  - verified: rev-32 [reviewer] · run rev-20261024-1226-final · 2026-10-24T11:07:57.169Z · commit 80fd78b9b4a7bfec913a0d66d0351b31f757305c
- [x] C2. A truly unknown merge field still answers `invalid_argument` naming it (test).
  - done: impl-1226 · 2026-10-24T10:44:19.164Z
  - verified: rev-32 [reviewer] · run rev-20261024-1226-final · 2026-10-24T11:07:57.169Z · commit 80fd78b9b4a7bfec913a0d66d0351b31f757305c

## Comments

### impl-1226 · 2026-10-24T10:41:45.352Z

Red reproduced on initial task head, local macOS targeted native Git test: node --test --test-name-pattern='the permission table refuses' hub/test/merge-policy.test.ts. Failure: expected /only the human may override/, actual 'unknown field override; accepted fields: item, cancel'. Using the supplied merge-policy seam plus existing T1 dispatcher/T2 spoke argument seams for regression controls. Diagnosis follows supplied T-998 cause; no speculative instrumentation needed.

### rev-31 · 2026-10-24T10:46:30.611Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1226-source
commit: 80fd78b9b4a7bfec913a0d66d0351b31f757305c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear at 80fd78b9/tree f60d5c50; no findings. A-10767 audits shared-schema override string + MCP forwarding to unchanged human-only merge refusal. Availability-first and scoped/human override authority remain; truly unknown overide stays invalid_argument. T1 transport-free FakeClock refusal/notice controls and T2 exact outgoing frame/typed refusal/no extra request controls use bounded receipts and retained cleanup. Matching docs/local skill updated; wire MergeRequest already declares override. A-10763 is local development-tree 39/39/check summary, not complete native receipts. Preserve original command/output/exit/timing/source attribution, especially unchanged T3 merge-policy execution. C1/C2 final settlement pending configured mode-free same-head run plus native contract evidence; no Reviewer execution/enqueue.

### rev-32 · 2026-10-24T11:07:57.169Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1226-final
commit: 80fd78b9b4a7bfec913a0d66d0351b31f757305c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1226 final evidence review — clear

Exact unchanged head80fd78b9b4a7bfec913a0d66d0351b31f757305c; treef60d5c50333799b84bfdfdc7f92d613d8c1aad4d. Carry rev-31's current full source verdict rev-20261024-1226-source/A-10767. Lead directly requested this evidence pass from rev-32; no prior hold existed, and rev-31 was notified of evidence ownership.

## Standards

No findings. Fresh mode-free rune82d5802-8165-4fd7-a720-ccf8898cba8a/A-10790 exits0 at the reviewed head, confirmed by tracker and branch. Independent structured-log audit:2924 ordinary test passes/422 passing files, plus5 passing load repetitions/files of the new T1 identity; nofail/cancel/skip. New dispatcher control passes at0.036433784s and5/5 repeats0.034158807–0.039289487s. Modified MCP envelope/forwarding control passes0.067806956s alongside free-only ask control; the existing identity is retained.

T0 host check39.717s, all T1, fallback all hub+Neovim T2, and Web complete. Linuxx64 6.8.0-142-generic,c-8lon1 cland-v0-9d616d80, Nodev24.21.0/Nvimv0.12.5, workers2(Web4). Remote typecheck reuses host gate6d5550481a54273cd8356bf434dc01a6225d7527, not repeated remotely. Actual log/hub result T1/T2/Web commands60/332/149s, measured suite walls55.51/328.15/144.44s; these take precedence over the request's approximate T2 duration. Lifetime658s/$0.0457.

Generic lint/duration/ratchet are report-only:133findings60files,5missingbaselines/incompletebase. Existing shell10.333s,connection6.174s,items41.691s,item-summary2.483s overages remain; Web actual144.44s exceeds40s report wall. Projected two-worker Web150.266s is separate from actual four-worker execution. No enforced timing-budget pass claimed.

## Spec

C1 verified: source schema now recognizes string override and MCP preserves its exact value. Same-head T1 dispatcher proves a schema-valid override reaches forbidden/merge with “only the human may override” and a refusal notice; T2 outgoing frame preserves rescue and the typed refusal. Existing earlier availability refusals remain for roles that have no merge tool. Human-only override implementation, actor binding and permitted scope are unchanged.

The unchanged native merge-policy file did NOT execute on the Linux task run: T3/T4 were not selected. Required native contract proof is separately retained in A-10769: original local macOS Node24.21 development-tree command, exec session19163/final chunkde4632/exit0,39total targeted passes, including all13 native merge-policy cases. It explicitly attributes production/test source to the code later committed80fd78b9 while docs followed; no exact-commit configured/native Linux claim. The relevant original native test passes1.725082750s, with ordinary Implementer/Reviewer/QA spoke+CLI refusals, Coordinator override refusal, empty reason refusal, actual human documented override and durable journal/criteria output. Reviewed Git comparison confirms native test unchanged. A-10769 is original tool-output transcription with provenance/limitations, not a rerun.

C2 verified: same-head dispatcher misspelled overide returns invalid_argument naming the field with no refusal notice; MCP typo remains local with no additional hub request, while valid override is forwarded. Shared validation/permission distinction remains as accepted in A-10767.

All C1/C2 verified at this head across source, same-head configured evidence and separately attributed retained native contract. No new findings. QA none/after-stage; no full-suite, LinuxT3/T4 or QA pass claimed. Lead reports clean read-only conflict projection against fetcheddev9f385c8c; no post-review task merge/source change. Projection is not runtime evidence.

Reviewer read-only source/Git/log/artifact/tracker audit, no tests, native Git probe, edits, installer, browser, merge, delegation or enqueue.
Standards:zero findings. Spec:zero findings; C1/C2 verified.

Audit A-10798: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10798-t-1226-final-same-head-evidence-at-80fd78b9.md

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T11:17:32.770Z

Merged 65c47f8c0bb186ddc5f7b32013280a5b4a12de6d onto dev.
