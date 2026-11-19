---
id: T-1976
kind: task
title: Hot hub SQLite paths prepare statements per call (prepare at 6–8% of main-thread self time)
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1637
branch: t/T-1976-hot-hub-sqlite-paths-prepare-statements
created: 2026-11-18T12:37:50.486Z
updated: 2026-11-19T02:52:58.200Z
closed: 2026-11-19T02:52:58.200Z
---

## Summary

From the profile behind T-1973 (2026-11-18, hub pid 52877, 12:31–12:32Z). SQLite `prepare` took 6–8% of main-thread self time, next to `all` at 11–13% and `get` at 8–9%. That suggests hot paths prepare their statements on every call instead of reusing them.

## What to build

Cache the prepared statements on the hot read paths the profile names (suite summaries, inbox, tracker reads), keyed per database connection and closed with it.

## Acceptance criteria

- [x] C1. Repeated calls of each named hot path prepare each statement once per connection, counted through a seam (test).
  - done: impl-1976 · 2026-11-19T01:08:16.295Z
  - verified: rev-39 [reviewer] · run rev-20261119-1976-final-3 · 2026-11-19T01:38:12.346Z · commit 567eacdbeb33eb03ab65cfafbb9a3724e973d7f7
- [x] C2. Statements are finalized when their connection closes, including during hub stop, and no closed statement is reused (test).
  - done: impl-1976 · 2026-11-19T01:08:16.515Z
  - verified: rev-39 [reviewer] · run rev-20261119-1976-final-3 · 2026-11-19T01:38:12.346Z · commit 567eacdbeb33eb03ab65cfafbb9a3724e973d7f7

## Comments

### impl-1976 · 2026-11-19T00:45:16.086Z

Consumer inventory: cached SQL is private to TrackerIndex.list, get, children, resolve; hydration calls resolve for parent, blocker, follows and regression references. criteriaCounts uses WeakMap summaries and prepares no SQL. TrackerIndex production owner/caller: hub/src/tracker/tracker.ts; direct test callers: task-size, task-card-component, dev-t3-search-component, tracker-summary, task-prefixes, task-attribution and sqlite-hot-reads. Store cache is unchanged: suiteJobSummaries callers are Suites retainedSuiteJobs and constructor; inboxMessages, inboxWaits and inboxReplyAt are consumed by hub/inbox.ts. Searches cover named fields/functions across hub/src, all hub/test tiers, docs, skills and raw SQL. Connection close paths: TrackerIndex.close via Tracker.stop after queue drainage; daemon normal stop, startup recovery/failure, fatal storage stop and outer startup catch call Tracker.stop. Store.close via server Hub.close; daemon normal/startup-failure paths call Hub.close. Store ownership-only reader has separate finally db.close and no cache. Existing direct callers/tests explicitly close owners. No wire/record shape changes. Details and exact matches will be published in the evidence artifact.

### impl-1976 · 2026-11-19T00:48:12.317Z

Implementation scope: TrackerIndex caches resolve/list/get/children SQL per connection; the 6 optional list predicates yield at most 64 shapes, because label count is now one bound JSON array. This keeps hot statements resident without an unbounded caller-driven SQL cache. criteriaCounts remains allocation-free with respect to SQLite, and Store suite/inbox SQL and existing cache remain unchanged. Full npm run test:lint exited 0 (0 refusals, advisory census retained); full npm run typecheck exited 0. No timing improvement is claimed.

### impl-1976 · 2026-11-19T00:51:00.090Z

Inventory clarification: the suiteJobSummaries call at suites.ts:207 is releaseT3Cover (the other is Suites constructor), rather than retainedSuiteJobs. Exact consumer/close-path search is retained in the evidence artifact.

### impl-1976 · 2026-11-19T00:52:43.196Z

Implementation committed and pushed: 2f02700e2e3d528362423ed1a1fb47fbafe3e0ef. Evidence A-21462 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21462-t-1976-prepare-count-and-close-evidence.md (published through scan-and-publish helper). Reachable T1 selection: 61 files/700 passed; direct T2 selection: 7 files/51 passed; full typecheck passed. Full lint final refresh pending before source review. No T3/T4/Web or configured verification receipt yet.

### impl-1976 · 2026-11-19T01:00:59.144Z

Provenance supplement to A-21462, from existing tool returns only, per Reviewer's question 3aa69683-7d32-4a47-94c5-0ab4d4166a70 and Coordinator disposition eb22fb62-93fe-463d-b307-2cdc0dbf0d13. No rerun, scan or probe.

All commands used cwd /Users/evgeniyivanov/Projects/cland/v0/.cland/worktrees/T-1976. Local macOS arm64; Node v24.21.0. No browser binary. Exit codes below are exec_command/write_stdin completion return fields. Native signal, independently captured native exits/close receipts, invocation trees and source-tree hashes were not captured: unknown. No durable raw stdout/stderr capture files retained. Some intermediate displayed output was truncated. A-21462 contains a truncated search transcript and authored summaries, not raw invocation proof.

Edit/command order:
1. Added sqlite-hot-reads.test.ts before production change. `uptime; node --test hub/test/sqlite-hot-reads.test.ts` returned exit_code=1, tests 2/pass 1/fail 1: tracker fixture assertion `0 !== 1` at line 38 (missing Acceptance criteria heading). This was a fixture error, not prepare regression.
2. Added that heading. Same launcher returned exit_code=1, tests 2/pass 1/fail 1: AssertionError on unfiltered tracker list SQL, `3 !== 1`, at sqlite-hot-reads.test.ts:46:55. Store case already passed. index-db.ts had not changed. Tree hash unknown.
3. Added TrackerIndex connection-local #reads/#read cache for resolve/list/get/children, clear on close, label-array binding through json_each. Same launcher returned exit_code=0, tests 2/pass 2/fail 0/skipped 0.
4. Added hub-stop case, duplicate/missing label cases, T2 registration and guide. One same-launcher attempt exited 1 before tests because I mistakenly imported nonexistent connect from harness.ts (SyntaxError). Removed unused connect import. Same launcher then returned exit_code=0, tests 3/pass 3/fail 0/skipped 0.
5. Corrected guide heading. `node hub/test/generate-test-docs-index.ts --write; uptime; node --test hub/test/tracker-summary.test.ts` returned exit_code=0: tests 19/pass 19/fail 0/skipped 0.
6. First `uptime; npm run test:lint` completed exit_code=0, test lint refusals 0; report-only census 130 findings/63 files. This preceded final Store-test assertion edits.
7. Read-only selection: `node --input-type=module -e 'import {readFile} from "node:fs/promises"; import {importingTests} from "./hub/src/suite-import-graph.ts"; const tiers=JSON.parse(await readFile("hub/test/tiers.json","utf8")).tests; const files=Object.keys(tiers).filter(p=>tiers[p]==="T1"); console.log(JSON.stringify(await importingTests(process.cwd(),["hub/src/tracker/index-db.ts"],files,(test,error)=>console.error("UNKNOWN",test,String(error))),null,2));'` exited 0, returned 58 matches. Unknown edges were suite-remote-budget (indirect require), verification-tier-receipts (vm loader), web-notifications (vm loader). All three added conservatively to run below.
8. Final test-only edit removed suiteJobSummaries warmup so its prepare is counted; added exact summary-SQL prepare count=1 and fresh setMeta/suite summary plus waitInInbox/readback assertions. Production unchanged. Then `uptime; npm run typecheck` returned exit_code=0 across hub, Neovim, shared wire and web, including web colour/token/HTML/hooks checks. Same sqlite launcher returned exit_code=0: tests 3/pass 3/fail 0/skipped 0.

Selected T1 exact launcher (58 graph matches plus the three unknown-edge files):
`uptime; node --test --test-concurrency=1 hub/src/hub/store.test.ts hub/test/account-limits-unit.test.ts hub/test/account-poller-clock.test.ts hub/test/agents-checkpoint.test.ts hub/test/claude-agent-launch.test.ts hub/test/dev-t3-search.test.ts hub/test/executor-run-rules.test.ts hub/test/harness-import.test.ts hub/test/host-contract-coverage.test.ts hub/test/host-flush.test.ts hub/test/host-limit-poller.test.ts hub/test/import-github-unit.test.ts hub/test/init-categories.test.ts hub/test/init-roots.test.ts hub/test/journal-flush.test.ts hub/test/journal-subagents.test.ts hub/test/lifecycle-serialization.test.ts hub/test/merge-batches.test.ts hub/test/merge-queue-unit.test.ts hub/test/outbox.test.ts hub/test/pairing-service.test.ts hub/test/poller-lease.test.ts hub/test/remote-neutral.test.ts hub/test/remote-state.test.ts hub/test/roles-template.test.ts hub/test/send-input.test.ts hub/test/session-cwd.test.ts hub/test/setup-favourite.test.ts hub/test/setup-flow.test.ts hub/test/setup-handover.test.ts hub/test/setup-hub.test.ts hub/test/setup-remotes.test.ts hub/test/shared-defects.test.ts hub/test/suite-cache.test.ts hub/test/suite-coordinator.test.ts hub/test/suite-cover.test.ts hub/test/suite-duration-budget.test.ts hub/test/suite-landed-load.test.ts hub/test/suite-persistence.test.ts hub/test/suite-phase.test.ts hub/test/suite-progress.test.ts hub/test/suite-queue.test.ts hub/test/suite-remote-log.test.ts hub/test/suite-scheduling.test.ts hub/test/suite-soak.test.ts hub/test/suite-stage-rules.test.ts hub/test/suite-summary.test.ts hub/test/suite-task-selection.test.ts hub/test/suite-tier-report.test.ts hub/test/telegram-gap.test.ts hub/test/test-admission-outcome.test.ts hub/test/thread-runs-store.test.ts hub/test/tool-arguments.test.ts hub/test/tracker-conflict-captures.test.ts hub/test/tracker-summary.test.ts hub/test/verification-commands.test.ts hub/test/verifier-resolver.test.ts hub/test/web-phase.test.ts hub/test/suite-remote-budget.test.ts hub/test/verification-tier-receipts.test.ts hub/test/web-notifications.test.ts`
Completion returned exit_code=0; tests 700/pass 700/fail 0/cancelled 0/skipped 0/todo 0. Membership retained in launcher and graph output, not invocation artifact. Selected T1 only.

Selected T2 exact launcher:
`uptime; node --test --test-concurrency=1 hub/test/task-size.test.ts hub/test/task-card-component.test.ts hub/test/dev-t3-search-component.test.ts hub/test/task-prefixes.test.ts hub/test/task-attribution.test.ts hub/test/tracker-component.test.ts hub/test/sqlite-hot-reads.test.ts`
Completion returned exit_code=0; tests 51/pass 51/fail 0/cancelled 0/skipped 0/todo 0. Ran after final test edits and selected T1. No source/test edits followed. Selected T2 only; no T3/T4/Web.

Final checks/commit ordering:
After T2, started final `uptime; npm run test:lint`. While it ran, `git fetch origin dev; git merge origin/dev; git diff --check; git status --short` returned exit_code=0, Already up to date. Published evidence, removed only staged evidence, then `git add hub/src/tracker/index-db.ts hub/test/sqlite-hot-reads.test.ts hub/test/tiers.json docs/agents/tests/hub-test-sqlite-hot-reads.test.ts.md docs/agents/tests/index.md; git commit -m 'Reuse tracker hot read statements per SQLite connection'; git push origin HEAD; git rev-parse HEAD` returned exit_code=0, head 2f02700e2e3d528362423ed1a1fb47fbafe3e0ef. Final lint later returned exit_code=0, test lint refusals 0, report-only census 130 findings/63 files. Source/test bytes remained fixed from final test edit through review request; no invocation-tree hash retained. Git status --porcelain returned empty before review. Typecheck was the earlier post-final-edit run, not rerun after commit. Report-only lint included known T-1484 CLI TypeScript dependency, site capture-safety import and existing build-tier advisories, not enforce failures.

Publication exact command:
`node --input-type=module -e 'import {publishSessionEvidence} from "./.agents/skills/qa/publish-evidence.ts"; console.log(JSON.stringify(await publishSessionEvidence({path:"./.t1976-evidence.md",title:"T-1976 prepare-count and close evidence",kind:"file",topic:"topic-1637"})));'`
Returned exit_code=0 and A-21462 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21462-t-1976-prepare-count-and-close-evidence.md; time 2026-11-19T00:52:20.098Z. This establishes helper success and artifact identity. Its documented contract scans the exact private snapshot with both policies and positive controls before publication. Returned JSON did NOT contain a raw scan/control receipt, control-match count, snapshot hash or scan log: those raw facts are absent/unknown, not independently proven by the artifact response. No new scan performed.

### rev-35 · 2026-11-19T01:03:22.249Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1976-source-1
commit: 2f02700e2e3d528362423ed1a1fb47fbafe3e0ef
scope: full
findings: [{"severity":"medium","text":"Standards/M1: raw-t hub-stop callback has no encompassing pre-acquisition original-work owner; standalone constructors at32/76 also precede try/finally, and databaseProbe owns no fallback for a connection opened before constructor rejection. Pre-enroll/join original async setup/body and capture probe connection ownership before constructors, retaining roots/seams until positive closure. Author confirms no omitted owner/disposition.","file":"hub/test/sqlite-hot-reads.test.ts","line":61},{"severity":"medium","text":"Standards/M2 rule38: none of the3 new T2 cases installs a positively controlled native-launch guard. In-memory DB/default projectHub fakes do not prove the native boundary across setup/body/cleanup. Reuse the existing counted guard before acquisition through joined hub/DB/root cleanup, then zero-attempt verification/restoration; retain all count/close assertions and update guide.","file":"hub/test/sqlite-hot-reads.test.ts","line":29}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source not clear at clean/pushed2f02700e, tre e5610c83b, basea6f2006b; Standards2medium/Spec0 separate product findings, nohigh/low. Author e4cbe588 confirms both gaps. Production per-connection map, <=64label/filter shapes plus3fixed reads, fresh bindings/every-label semantics and native close contract reviewed positively; Store/inbox cache unchanged. C1/C2 failed for test proof gaps, verify none. A-21462 and Coordinator-authorized retained-return item supplement read: distinct fixture0!==1 red, true prepare3!==1 red, pre-test import error, corrected3/3, selected61T1/700 and7T2/51 passes, full lint/typecheck0 with source ordering. No configured/T3/T4/Web proof, no timing claim; absent launcher hashes/raw/native signal/scan receipts remain unknown. Primary eb22fb62 authorizes supplement's item-comment remedy after size refusal; no provenance rerun. Fix ownership/guard together in the3 new callbacks/probe, preserve current count/fresh-read/close assertions; no unrelated production migration requested. Hold released; changed committed head needs fresh source review before verification, existing load/quiet constraints remain. Full findings/scope/primary Node source link: A-21465, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21465-t-1976-first-source-review-ownership-and-launch-guard-findings.md.

Criteria: C1 failed (New repeated-prepare proof lacks positively controlled native isolation and pre-owned constructor-failure cleanup.), C2 failed (New connection/hub-stop controls lack encompassing acquisition/callback ownership and through-cleanup native guard; constructor rejection can strand captured DB handles.).

### rev-39 · 2026-11-19T01:10:46.907Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1976-source-2
commit: 567eacdbeb33eb03ab65cfafbb9a3724e973d7f7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected-head full source review clear at 567eacdbeb33eb03ab65cfafbb9a3724e973d7f7, tree03f62a2ef8b1b0b79fea72051d7cb4347e3d8ae6, basea6f2006b1. Standards0 findings; Spec0 findings. Prior M1/M2 resolved together: pre-enrolled whole-case original-work join, constructor-failure connection fallback ownership, all-handle close attempts, positive launch guard before acquisition through joined hub/DB/root cleanup, and guard retention on incomplete cleanup. Existing prepare-count/fresh-binding/finalization/reopen assertions retained. Independently reviewed unchanged production connection-local finite SQL cache, all-label JSON binding semantics and owner close paths positively. C1/C2 remain unverified until same-head configured evidence. A-21468 selected corrected T2 3/3 macOS arm64 Node24.21.0 and full lint/typecheck0 inspected; old61T1/700 and7T2/51 retain their earlier epoch, no configured/Web/T3/T4/browser coverage claimed. No Reviewer runtime execution. Detailed review artifact published in this topic.

### rev-39 · 2026-11-19T01:38:12.346Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1976-final-3
commit: 567eacdbeb33eb03ab65cfafbb9a3724e973d7f7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear. Runfb4496a9/A-21482 passed at exact source-reviewed567eacdbeb33eb03ab65cfafbb9a3724e973d7f7; branch unchanged, runner treeea2b5ebef5a1c145e4dc4533fd38c147470aefb0/cache null. All three sqlite-hot-reads generated cases pass normalT2 and each5/5 load repetitions; checked prepare-count/fresh-binding/updated reads, closed handles/owners, reopening and hub-stop assertions from A-21471. C1/C2 verified. T0/T1/T2/Web completed exit0; hub aggregate6892/6892 zero fail/cancel/skip. T3 merge-batch deferred,T4 unexecuted. Linuxx64 c-8ams3 droplet Node24.21.0 Neovim0.12.5; actual ChromeHeadlessShell1248 binary receipt, GoogleChromeTesting156.0.8078.4. Existing duration/test-lint/ratchet advisories report-only; no all-tier pass or whole-hub speedup claim. A-21483: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21483-t-1976-final-same-head-evidence-clear.md. No Reviewer runtime execution.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-19T02:52:58.200Z

Merged 157bf6b2f145e7edb88eb69ed3b29b6f67c4adcc onto dev.
