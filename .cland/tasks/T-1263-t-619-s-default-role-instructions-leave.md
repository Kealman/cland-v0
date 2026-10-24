---
id: T-1263
kind: task
title: T-619's default role instructions leave a clause-only OpenCode launch without a first turn, failing accounts.test.ts's pool handoff
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1216
blocked_by: []
regression_of: T-619
found_by: cover
topic: topic-1007
branch: t/T-1263-t-619-s-default-role-instructions-leave
created: 2026-10-24T21:29:14.687Z
updated: 2026-10-24T22:01:40.839Z
closed: 2026-10-24T22:01:40.839Z
---

## Summary

Since T-619 (5205aeb6) the OpenCode adapter delivers role clauses as an instruction entry by default and returns without a prompt for a clause-only message. `hub/test/accounts.test.ts` "opencode retained Implementer handoff restarts in the next worktree on the saved account environment" (T3) waits for a first turn with usage, which never comes. It fails 3/3 alone on dev at 5205aeb6 and passes at c6bc05cd. The T-619 batch was T1-only (D77), so T3 never saw it; the macOS stage cover 242e7c14 (A-11475) caught it.

## Evidence

- Error: `implementer first turn completed and claim released after merge: not within 15000 ms` (accounts.test.ts:225).
- Coord reran it alone 3× on dev: all fail at ~18.6 s. Scratch clone at c6bc05cd: passes in 4.3 s.

## What to build

Decide which side is wrong and fix it, with the decision stated in the item: either the test's first-turn proof follows T-619's contract (clause-only launches run no turn, so the fixture supplies a brief or another turn trigger), or the product must still run a first turn for a launch with no brief. List every consumer of the "first turn after launch" behaviour for OpenCode (rule 20): other T2/T3 tests whose fixtures rely on a clause-only first turn, and the Pool handoff/idle logic.

## Acceptance criteria

- [x] C1. The accounts.test.ts opencode retained-handoff test passes 5/5 alone at the item head on macOS, and the codex variant still passes.
  - done: impl-1263 · 2026-10-24T21:34:38.015Z
  - verified: rev-31 [reviewer] · run rev-20261024-1263-final · 2026-10-24T21:55:16.871Z · commit 4f1bad89d6b46d18881b3a3ac7a4e8af16b5314d
- [x] C2. The item records which contract holds (clause-only OpenCode launch runs a turn or not) and lists every other test or code path relying on it; each listed test passes alone at the item head.
  - done: impl-1263 · 2026-10-24T21:37:39.875Z
  - verified: rev-31 [reviewer] · run rev-20261024-1263-final · 2026-10-24T21:55:16.871Z · commit 4f1bad89d6b46d18881b3a3ac7a4e8af16b5314d

## Comments

### impl-1263 · 2026-10-24T21:31:28.026Z

Red receipt on original tree c6? HEAD will be recorded with green evidence: node --test --test-name-pattern='^opencode retained Implementer handoff' hub/test/accounts.test.ts exited 1 on local macOS; 1 test, 0 pass, 1 fail; duration_ms 19372.339708. Exact failure: "implementer first turn completed and claim released after merge: not within 15000 ms" at accounts.test.ts:225.

Ranked predictions: (1) the fixture relies on the removed clause-only prompt: an explicit brief will produce usage and preserve every handoff assertion; (2) role installation is incomplete: the durable cland-role entry would be missing even after a brief; (3) the pool requires usage in production: #reuseEligible would reject a connected idle, unheld member without usage. Static audit rules out (3): sessions.ts:239-246 checks connection, idle, holds, pending work/injection, lifecycle and reservation, never tokens.

Contract decision: preserve T-619. With the default instruction route available and successfully written, a clause-only OpenCode launch installs cland-role and runs no turn. A brief or ordinary non-progress send triggers work. Opt-out and confirmed-safe fallback still use prompts. The accounts retained-handoff fixture is wrong because it requires usage without providing work. Supply a brief, retain the usage+idle+released-hold wait and all identity/cwd/account assertions. No production, wire or persisted schema changes.

Rule-20 search (before editing): searched hub/src, hub/test including tiers.json/T3/T4, web/test, nvim/test, qa, docs/agents, docs/adr, hub/README.md and shipped .agents/skills for OpenCode, clause-only, first-turn, usage, roleInstructions and pool launch/reuse.

Direct first-turn consumers needing runtime receipts:
- hub/test/accounts.test.ts generated codex/opencode retained Implementer handoff cases: migrate with an explicit brief; other account cases assert environment/PID/restart facts, no OpenCode usage dependency.
- hub/test/session-native-lifecycle.test.ts pooled OpenCode keep_context=true/false: already migrated by T-619 to durable cland-role readiness plus idle/released holds; no edit.
- hub/test/scenarios/crew-launch.test.ts Coordinator launches three harnesses: already reads durable cland-role for OpenCode, usage for Codex/Claude; explicit send proves correlated native reply; no edit.
- hub/test/opencode-adapter.test.ts native launch/first brief and role instruction families: brief-based cases, intentional messagePath opt-out cases, default installation/replacement/revocation, safe fallback/old-endpoint and retained/lost-write controls; no edit.
- hub/test/opencode-native.test.ts T2 scripted fixture: native instruction install and explicit prompt/retry behavior, not implicit clause-turn usage; retains previous native prompt shape and failed-route compatibility controls; no edit.

Production consumers:
- adapters/index.ts configures default-on/env0; adapters/opencode.ts inject installs and returns for clause-only, strips bundled clause before prompting brief; opencode/client.ts writes durable native entry. Unchanged.
- hub/core.ts records/replays role on hello and batches initial clause/brief; adapters/sessions.ts #spawnLaunch, #reuse/#restartPool, #reuseEligible, inject retry and pool-handoff reservation use connection/idle/holds/pending work, not first-turn usage. Unchanged.
- opencode/state.ts and adapters/usage.ts consume native status/usage when present, no promise that every launch produces usage. Saved process launchBrief and native session.instructions readers preserve existing shapes.
- session resume/reconnect re-installs role without replaying brief; opted-out saved instructions and old endpoint semantics remain as T-619 documents.

Other searched consumers unaffected: T2 opencode-launch-policy/adapter-composition/session-launch/resume components use native policy or in-process fakes, not real clause-only usage. T3 session-resume-lifecycle/session-stop-races/approval-restart/launch-recovery/pid-identity/termination-ownership/orphan-servers and T4 orphan-servers-perf assert process, approval, PID or cleanup receipts; no clause-turn dependency. models/account-limit tests select environment/models or script usage explicitly. session-brief/session-holds/role-integrity native first-turn usage is Codex-specific. web/nvim snapshots, list renderers and launch clients consume optional usage and send brief fields without assuming first-turn usage.
Startup/release probes check readiness/process/catalog/non-experimental routes (doctor/opencode-contract.ts, check-opencode.ts, startup-*), never clause-only usage. QA briefs use explicit sends or historical native experiments (E-424 R3); no current brief supplies an unbriefed OpenCode token wait. Shipped skills invoke launches with task briefs or describe relay contracts, with no implicit clause-turn requirement.
Documentation: clarify default clause-only behavior in hub/README.md, add accounts-specific fixture guidance and index entry. No command/default/policy/permission changes, so help/role clauses/skills require no semantic migration.

### impl-1263 · 2026-10-24T21:32:19.440Z

Correction to red receipt transcription: original head was exactly 5205aeb68c1e9f5b8978afbbe9c18e8a6a103dde (not the placeholder 'c6?'). Fixture/docs fix is committed at 88f47510db44ba59792299356120b1ff18865ac2. First isolated OpenCode green: 1/1, exit 0, 4223.499459 ms test / 4619.955709 ms whole invocation. Coordinator authorized whole-file sequential audits for opencode-native, opencode-adapter, session-native-lifecycle and scenarios/crew-launch (decision a0600b6c).

### impl-1263 · 2026-10-24T21:34:37.926Z

TDD reused the existing exact regression at the assigned T3 native account/handoff seam: red on 5205aeb6, then only an explicit brief was added before green at 88f47510. A lower tier cannot prove the native account environment and real retained-conversation process/worktree restart. Every original final assertion and the usage/idle/released-holds wait remain. No new test identity, timing budget or dependency.

Local macOS Darwin arm64 at exact head 88f47510db44ba59792299356120b1ff18865ac2: isolated generated OpenCode retained-handoff case 5/5 (test ms 4223.499459, 4227.945959, 4241.960875, 4234.822958, 4412.909917); isolated Codex variant 1/1 (2713.864708 ms). Whole accounts.test.ts 14/14, 27852.326667 ms invocation. npm run typecheck exit 0 (hub, Neovim, shared/wire, web including colour/HTML/hooks guards). Audited whole files so far: opencode-native.test.ts 30/30, 3721.793583 ms; opencode-adapter.test.ts 20/20, 36514.28575 ms. No skipped/cancelled/failed cases. All targeted files serial, no suite/cache/browser; full task verify not yet run. Lifecycle and crew consumer receipts pending. Full raw receipts will be published as an artifact.

### impl-1263 · 2026-10-24T21:35:10.243Z

C2 remaining serial whole-file macOS receipts at unchanged 88f47510: session-native-lifecycle.test.ts 9/9, invocation 27369.204833 ms (OpenCode keep_context=true 3721.86975 ms / false 3484.87425 ms); scenarios/crew-launch.test.ts 1/1, invocation 6119.625417 ms. No failures, skips or cancellations. These complete all four authorized audited consumer files. Fresh origin/dev fetch and merge was already up to date; head pushed to local origin. Full local receipts published in the item topic. C1/C2 done; requesting source review, then exactly one mode-free task verification. No per-item QA policy/QA criteria/brief.

### rev-31 · 2026-10-24T21:37:01.825Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261024-1263-source1
commit: 88f47510db44ba59792299356120b1ff18865ac2
scope: full
findings: [{"severity":"medium","text":"M1: new accounts guide lacks the exact '# hub/test/accounts.test.ts' path heading required by existing test-docs.test.ts, so the test-file-heading assertion fails. Correct the heading and retain the guard; functional fixture repair and final assertions are accepted.","file":"docs/agents/tests/hub-test-accounts.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-1263 full source review — NOT CLEAR

Reviewed 88f47510db44ba59792299356120b1ff18865ac2, tree 0e78407006df3239c2d5a393e6584d4a27be44f0, fixed parent/base 5205aeb68c1e9f5b8978afbbe9c18e8a6a103dde. Four changed files: native account fixture, hub README, new accounts guide and index row. Source/artifact/tracker reads only; Reviewer ran no tests, probes, browser, builds or Git mutations.

## Standards

M1 — medium — docs/agents/tests/hub-test-accounts.test.ts.md:1. The new file starts '# Account launch and retained handoff fixtures'. Existing hub/test/test-docs.test.ts derives the test path using /^# (.+\\.test\\.ts)$/m and requires it before checking filename/index/existence. There is no matching heading in this guide, so the current source fails the existing '<document>: test file heading' assertion. Correct to '# hub/test/accounts.test.ts' and preserve/validate the guard. This is static source inspection, not Reviewer execution.

No other Standards finding. The guide's body/index otherwise match the native account contract. No production logic, wire schema, permission/default or command/help API changes. The single fixture edit remains in the justified T3 account/environment/process/worktree seam. Existing fixture root/account/native process ownership and cleanup are retained; no new process, sleep, deadline or timing allowance is added.

Rule-20 inventory is recorded before the edit: direct account handoff; OpenCode adapter/native instruction/prompt families; session-native pool lifecycle; crew launch; production clause/brief batching, pool eligibility/restart/reservation, optional usage/state and persistence; other tier/client/QA/startup/skill consumers with reasons unaffected. Targeted source searches and the production inject/reuse checks support that separation. Coordinator 3cc2ce51 expressly accepts preserving T-619's human-chosen instruction behavior; a0600b6c authorizes four whole consumer files sequentially.

## Spec

No functional finding. The changed launch supplies an explicit brief to both generated Codex/OpenCode variants before the original usage + idle + empty-holds receipt is required. The merge and every final account/name/cwd/PID/session/native-conversation/environment assertion are unchanged. No usage predicate or deadline was weakened, and initial idle alone does not substitute for work completion.

The recorded contract matches source: successful default instruction-only clause installation returns without prompting; bundled brief/non-clause work prompts after clause installation. Explicit opt-out and confirmed-safe fallback keep the prompt path. Pool reuse eligibility checks connection, idle, holds/pending work, lifecycle/reservations, not token usage. README clarifies these conditions without changing behavior. Existing native lifecycle and crew tests already observe the durable instruction entry rather than invented initial usage.

## Evidence

A-11482 retains source-attributed local Darwin arm64 receipts, no browser/provider QA:
- Original exact generated OpenCode case at parent5205aeb6: exit1, 0/1, 'implementer first turn completed and claim released after merge: not within 15000 ms', file19372.339708 ms.
- At exact88f47510, isolated OpenCode case5/5: test4223.499459/4227.945959/4241.960875/4234.822958/4412.909917 ms, each exit0; Codex1/1 test2713.864708 ms, exit0.
- Whole accounts14/14 file27852.326667 ms; opencode-native30/30 file3721.793583 ms; opencode-adapter20/20 file36514.28575 ms; session-native-lifecycle9/9 file27369.204833 ms; crew-launch1/1 file6119.625417 ms. Original generated case names and no fail/cancel/skip totals are retained. The two OpenCode pool variants pass3721.86975/3484.87425 ms.
- Typecheck exit0 with output excerpts; no overall measured typecheck wall inferred.

These are serial local direct-Node fixture receipts, not a configured suite, Linux, full T3/T4, load-gate or enforced timing-budget result. They support the intended fixture repair; they do not cover the new docs guard failure. The original red attribution's initial placeholder was explicitly corrected on the item to the pinned parent.

## Disposition

Consolidated NOT CLEAR, M1 only. C2 carries the supporting-source documentation blocker; the recorded first-turn decision/inventory and passing targeted receipts are not reclassified as false. C1/C2 remain unverified pending source clearance and configured same-head evidence.

Correct the single heading, preserve all fixture predicates/final assertions and existing docs guard, retain original red/green receipt without transcription reruns, commit/push and request fresh source review before one ordinary configured mode-free verify. Restore claimant marks if cleared by this disposition. No other fix, dev merge, runtime or QA/landing claim is requested.

Standards: one medium finding. Spec: no functional findings.
Durable review A-11483.

Criteria: C2 failed (Supporting source guide for the consumer inventory violates the existing docs heading contract; targeted first-turn pass receipts remain valid local evidence.).

### impl-1263 · 2026-10-24T21:37:40.416Z

M1 fixed in 4f1bad89 (pushed). Existing test-docs guard reproduced red at 88f47510: exact 'hub-test-accounts.test.ts.md: test file heading', 2/3 pass, exit1. Heading-only correction; unchanged guard passes 3/3 at new head, exit0, duration_ms84.855042. No test or production source changed after 88f47510; native macOS/typecheck evidence A-11482 remains explicitly at that parent, not represented as rerun at this docs-only child. Fresh source review requested before verify; C2 done restored. No dev merge.

### rev-31 · 2026-10-24T21:38:23.147Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1263-source2
commit: 4f1bad89d6b46d18881b3a3ac7a4e8af16b5314d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1263 corrected full source review — CLEAR

Reviewed 4f1bad89d6b46d18881b3a3ac7a4e8af16b5314d, tree ee7fcfa6bc31ec3e9ef83914d693cef9af284be7. Sole parent 88f47510db44ba59792299356120b1ff18865ac2; origin task branch resolves to the reviewed commit. Original full-review base 5205aeb68c1e9f5b8978afbbe9c18e8a6a103dde. Carries full functional/consumer/standards audit A-11483.

## Standards

M1 resolved. The entire correction is the single required guide heading '# hub/test/accounts.test.ts'. Guard, index, guide body, native fixture, README and all production/test source bytes are unchanged. The canonical heading now matches existing test-docs path/filename/existence rules. No new findings.

A-11484 preserves local Darwin arm64 docs-guard red at parent: exit1, 2/3 pass, exact 'hub-test-accounts.test.ts.md: test file heading', duration_ms148.3645. Correction green is exit0, 3/3 pass, no fail/cancel/skip, duration_ms84.855042; the three generated case names and native case durations 8.005959/16.356958/0.806834 ms are recorded. Reviewer did not run the guard or invent full stdout/native wall measurements beyond that receipt.

## Spec

No findings. The accepted fixture-only explicit brief remains unchanged and preserves all usage/idle/holds and final account/process/cwd/session/native-conversation assertions. Default successful instruction-only clause delivery starts no turn; explicit brief or ordinary work starts one. The recorded decision/consumer inventory and production pool/readiness reasons remain valid. No product/default/permission/wire change or extra dev merge occurred.

A-11482's macOS5/5 generated OpenCode case, Codex1/1 and whole-file consumer passes are carried at parent88f47510 as unchanged-runtime-source evidence. They are not relabelled as reruns at the docs-only child. Targeted native receipts do not establish a full configured suite, Linux result or provider QA.

## Disposition

Source CLEAR at this exact head, no remaining findings. Both test-marked C1/C2 remain unverified until final evidence settlement; their recorded local proof and source-invariant carry will be assessed with the required same-head configured result. Submit one ordinary configured mode-free verify at unchanged4f1bad89 and request final original-receipt evidence review with actual phases/absences, executor/platform/browser and enforce/report limits. Preserve stable head and existing assertions. No repeats solely for transcription and no new dev merge authorized.

Reviewer performed read-only source/Git/tracker/artifact reads only. Standards:0 remaining findings; Spec:0 findings. No runtime/QA/landing clearance.
Durable review A-11485.

### impl-1263 · 2026-10-24T21:52:27.769Z

Configured result 11060237-eed3-47b9-afbd-039eb0cb538f at unchanged reviewed 4f1bad89: passed exit0; original A-11514 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11514-suite-11060237-eed3-47b9-afbd-039eb0cb538f-auto-at-4f1bad8.log. Independently parsed durable suite progress finish records: 3077 test passes +433 file passes, no other finish outcomes. Includes exact generated opencode retained Implementer handoff... saved account environment pass3.820458656s, codex variant2.931286294s; all accounts14/14 and test-docs3/3 pass.

Actual scope: host T0 npm run check exit0 24.969s (remote typecheck reused that host gate, not repeated), remote all T1 893 cases/142 files; fallback all hub+Neovim T2 1835/246; changed T3 accounts only14/1 once; Web225/44. Unsupported coverage guide path forced all-T2 fallback. Remaining T3/T4 were not run; absent from configured batch tiers and deferred to periodic/integrated occasions. Prior macOS5/5 and four consumer whole-file receipts remain A-11482 at runtime-source-identical parent88f47510.

Executor droplet c-8 lon1, image cland-v0-b54afd32, Linux x64 6.8.0-142-generic; Node24.21.0/Neovim0.12.5. Original prepare downloaded Chrome Headless Shell156.0.8078.4 Playwrightv1248; Web harness uses prerequisite.executablePath headlessly. Duration/lint/Web wall/T3 ratchet diagnostics are report-only; 133 lint findings,0 refusals, reported wall/legacy overruns retained. No new Web files:0 repetitions required; changed T3 duration check one base run, no repetitions. 41.200s added wall excludes machine wait; projections are not actual suite wall. Droplet lifetime729s/$0.0506 is resource accounting, not suite runtime. No cache/fullT3T4/providerQA/landing claim. Fresh fetch origin/dev and merge-tree --write-tree HEAD origin/dev returned clean (exit0), without merging or changing the head. Requesting final evidence review.

### rev-31 · 2026-10-24T21:55:16.871Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1263-final
commit: 4f1bad89d6b46d18881b3a3ac7a4e8af16b5314d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1263 final evidence — CLEAR

Reviewed unchanged4f1bad89d6b46d18881b3a3ac7a4e8af16b5314d/treeee7fcfa6bc31ec3e9ef83914d693cef9af284be7. Full source2 A-11485 stands. Original configured mode-free11060237-eed3-47b9-afbd-039eb0cb538f/A-11514 exits0; task.view confirms finished/passed at this head.

Unique terminal test progress (file containers excluded) contains3077ordinary passes, zero load-gate repetitions/fail/cancel/skip/todo. accounts.test.ts14/14 all pass, including exact generated retained-handoff OpenCode3.820458656s and Codex2.931286294s. All3existing docs-guard cases pass, closing M1 with the source fix. No case count is inferred from a textual test declaration total.

## Criteria and source-invariant carry

C1: original macOS exact-parent88f47510 OpenCode isolated5/5 plus Codex1/1 in A-11482 remains source-attributed there, not relabelled as child-head reruns. Source2 independently established that the sole child change is one Markdown heading; every production/test/runtime fixture blob is unchanged. That local platform proof carries by this verified source invariance, supplemented by executed current-head Linux14/14 and the same final account/cwd/PID/session/native-conversation assertions. No additional fivefold Linux or macOS-child run is claimed.

C2: item records the contract and inventory; successful default instruction-only role installation starts no turn, explicit brief supplies work, pool eligibility does not require token usage. A-11482's exact-parent whole consumers pass serially: accounts14, opencode-native30, opencode-adapter20, session-native-lifecycle9 and crew-launch1. These carry across the same docs-only child with their actual macOS attribution. Current configured changed-T3 accounts and allT2 add selected runtime proof; this is not a new full all-consumer T3 cover or provider QA. All source/spec conclusions from A-11483/A-11485 remain.

## Actual executed scope and limits

Host T0 check exit0/24.969s; allT1 exit0/66s; fallback-all hub+NeovimT2 exit0/362s; one changedT3 accounts.test.ts exit0/45s,14identities once; Web exit0/156s. Canonical-doc coverage fallback explains allT2. Selected changed-T3 added wall41.200s excludes machine wait; no repetitions. RemainingT3 deferred to periodic/integrated occasions and absent configured batch tiers, allT4 absent. No fullT3/T4/stage/QA cover.

Droplet c-8lon1/cland-v0-b54afd32, Linuxx64 6.8.0-142-generic, Node24.21.0/Neovim0.12.5,2workers. Machine lifetime729s/cost$0.0506 is not suite wall time. Prepare pins Chrome Headless Shell156.0.8078.4/revision1248/linux64 under /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248 for isolated Web fixtures. Native account harnesses remain fixture processes, no live-provider enforcement claim.

The host gate tree ddddced0bb8106bbd4c28b3fb4b0b2210d51fcc8 is reused remotely, not an alternate task head or repeated remote check. Phase envelopes, native case time, selected wall and machine lifetime remain distinct. Existing timing/lint/ratchet modes are report-only:133lint findings/60files, unchanged T3ratchet2197.138s, six listed budget overages and Web actual suite151.46s vs40s. An unchanged account/environment case's5.613s >5notice is not a new-identity failure. No missing proof becomes zero or enforced-budget pass.

## Disposition

Final CLEAR, C1/C2 verified across accepted source-invariant local platform/consumer proof and original current-head configured evidence. No findings or per-item QA requirement. Preserve exact attribution and exclusions; no extra transcription reruns are needed. Send planned fresh no-auto-maintenance conflict-check/unchanged-head ready report to Coordinator for enqueue. This is no new dev merge, actual provider QA or landing authorization. Reviewer used read-only inspection only.
Durable final review: A-11517.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T22:01:40.839Z

Merged d1f65df6e102740b204cf7e551c0018e4aae5604 onto dev.
