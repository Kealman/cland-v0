---
id: T-1259
kind: task
title: executor-safety-component's foreign-lease case misses its 15 s completion window under macOS cover load
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - needs-triage
assignee: null
parent: E-1282
blocked_by: []
topic: topic-1039
branch: t/T-1259-executor-safety-component-s-foreign
created: 2026-10-24T19:31:37.373Z
updated: 2026-10-25T11:24:11.093Z
closed: 2026-10-25T11:24:11.093Z
---

## Summary

The macOS stage cover 83b0e729 at 5d1fa288 (A-11361) failed `hub/test/executor-safety-component.test.ts:207` "a short-lived hub preserves a foreign live lease beyond its own lifetime threshold" with `remote completion collected: not within 15000 ms` (harness.ts:848, from finish() at line 45). The run peaked at 1-minute load 10.17. The case took 16.1 s against a 0.63 s baseline. Run alone on Darwin arm64, it passed 5/5 at 5d1fa288 (about 0.53 s each) and 3/3 at 8fd6195f, before T-1255/T-1257. So it is load-sensitive, not a regression.

## Acceptance criteria

- [x] C1. The case waits on the exact settlement receipt it asserts (rule 9), not on a scheduler tick racing a loaded event loop, and it passes 10/10 at 2 workers under CPU load on macOS (test).
  - done: impl-1259 · 2026-10-25T11:13:19.189Z
  - verified: rev-31 [reviewer] · run rev-20261025-1259-final · 2026-10-25T11:18:20.933Z · commit a2e04b7ac26a144d1e917458f0ee35172d9cb2c6

## Comments

### impl-1259 · 2026-10-25T10:54:33.880Z

Existing worktree is clean. Seam: existing T2 scripted remote-machine + projectHub/public executor.reap; assert foreign live resource is retained and observe admitted run settlement before teardown. Triage A-11669 confirms this test and remote-fixture as scope. No shared protocol/schema/admission contract change planned.

### impl-1259 · 2026-10-25T10:56:36.978Z

TDD red on Darwin arm64, current uncommitted test tree: node --test --test-name-pattern='^remote completion settles a provider retry beyond the first scheduler advance$' hub/test/executor-safety-component.test.ts. 1 failed in 15.44s: Error: remote completion collected: not within 15000 ms (finish line 45). The new T2 case makes the scripted provider request a 2000ms retry during cleanup, after the single 1000ms advance. The bare settlement join never services that requested fake-clock delay. Applying existing drive(f, verificationSettled()) at that join; no increased timeout.

### impl-1259 · 2026-10-25T11:01:49.982Z

Source committed/pushed af5e6d6b983168c4834d2fa76b35ae2e2d9c0b03; full source review requested from reviewer in topic-1039 (resolved rev-31). Final fix reuses scriptedResult rather than only wrapping one settlement in drive: the latter moved the red failure to `remote result: not within 30000 ms`, showing a later collection poll is required. Final component file 13/13 on Darwin arm64; npm run typecheck, tier and child-env lint green. A-11766 holds TDD/source evidence and exact coverage limits. C1 macOS ten-under-load proof awaits one local mode-free verify after source clear. QA scope none. No production/shared contract changes.

### rev-31 · 2026-10-25T11:03:36.906Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261025-1259-source1
commit: af5e6d6b983168c4834d2fa76b35ae2e2d9c0b03
scope: full
findings: [{"severity":"medium","text":"M1: both new test guides use prose titles instead of exact '# hub/test/executor-safety-component.test.ts' and '# hub/test/executor-safety-load.test.ts' headings required by the retained test-docs guard; correct both only.","file":"docs/agents/tests/hub-test-executor-safety-component.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-1259 full source review — NOT CLEAR

Headaf5e6d6b983168c4834d2fa76b35ae2e2d9c0b03/treee11014489859f56a46aeea92ac3fe19ce521df6f; one task commit, dev...head comparison. Standards/Spec reviewed personally; no delegation, tests, stress, browser, edits, fetch or Git mutation.

## Standards

M1 (medium): both new file-specific test guides have prose headings rather than the required exact repository test path. docs/agents/tests/hub-test-executor-safety-component.test.ts.md:1 must be `# hub/test/executor-safety-component.test.ts`; docs/agents/tests/hub-test-executor-safety-load.test.ts.md:1 must be `# hub/test/executor-safety-load.test.ts`. Rule16 and the existing test-docs guard require these exact headings. Preserve all guide content and index rows; update only the headings and use the existing guard. Source-proven guard mismatch, not a Reviewer-executed failure. Both locations are one consolidated finding anchored to C1's matching test guidance.

No additional Standards finding: pure scripted-provider/in-process hub T2 seam, shared case extraction, T4 mapped machine guard, sealed CPU worker environment, explicit package-runner lease identity and standalone skip, actual worker exit joined in finally. Tiers remain path-sorted; no production/public protocol/flags/role change requiring help or clause expansion.

## Spec

No additional Spec finding. Shared finish observes persisted start/admission, explicitly completes the scripted worker and checks its done status. It then waits for scriptedResult's exact run report while each scheduler/sweep settlement is driven through the existing product-requested-delay driver before further clock steps. This replaces the bare single-clock-step settlement join without increasing the 15s receipt bound. The provider-retry regression injects a2000ms cleanup delay after initial admission and preserves success report, released lease and empty provider resources; reported original red reproduces the exact completion timeout rather than treating presence or a tick as completion.

Foreign-live-lease assertions are retained and strengthened with exact suite report id/exit0, released lease, empty droplets/keys. T4 executes the shared case in two concurrent lanes of five, requires all ten completions and CPU progress during each, and retains actual worker termination/exit. Its explicit lease/token/worktree checks prevent unleased deliberate stress. No new live-provider or detached harness process; existing fixtures retain stop/drain-before-root cleanup. No sleep, timeout increase or lowered assertion.

## Evidence and disposition

Item records local Darwin arm64 T2 13/13, typecheck/tier/child-env lint pass and test lint0refusals in report mode. Original new retry regression red is `remote completion collected: not within15000ms`, about15.44s; this is implementation-time evidence, not current-head configured or macOS-under-CPU proof. Retain available original command outputs/exits/native timings with actual source/platform attribution and missing-record limits; do not rerun for transcription.

Full source NOT CLEAR: one medium Standards finding at two guide headings; zero additional Spec findings. C1 failed for M1 and remains runtime-pending. Correct headings, request fresh pushed-head source review before one ordinary mode-free configured verification. `--executor local` is specifically justified here by C1's required macOS proof; no separate/manual CPU run or mode override is requested. Final evidence must include actual macOS10/10 in two lanes with per-case CPU progress and complete phase/report-mode limits. No dev merge requested. QA none/after-stage.
Durable review: A-11771.

Criteria: C1 failed (M1: both new per-file test-guide headings violate the exact-path contract and retained docs guard.).

### rev-31 · 2026-10-25T11:05:38.181Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1259-source2
commit: a2e04b7ac26a144d1e917458f0ee35172d9cb2c6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1259 corrected source review — CLEAR

Heada2e04b7ac26a144d1e917458f0ee35172d9cb2c6/treebc8e29d5bd22c3ea66bb023d2c79f0bde451f5a9; direct parentaf5e6d6b983168c4834d2fa76b35ae2e2d9c0b03. Complete correction diff reviewed against full A-11771; no dev merge.

## Standards

M1 resolved: both canonical docs now start with exact repository test-path headings; index and substantive guidance retained. Source/test delta otherwise only removes bespoke machine lease reader/token/worktree assertions and standalone skip, as Coordinatorfdadf391-ffc1-4110-a2d4-d8bf74de385c explicitly directs. The guide now consistently says admission belongs to the runner/T4 phase and forbids manual invocation. This authorized removal does not remove any settlement, foreign-resource, CPU progress, completion-count or termination assertion. No remaining finding.

## Spec

Carry the accepted full source A-11771 unchanged: completion joins actual admitted settlement through the product-delay driver, observes explicit done status and exact persisted suite report, retains foreign-live resource/no-delete before completion and released/empty provider resources afterward. Deterministic provider-retry T2 regression holds the same bounds. T4 still runs two lanes of five identical shared cases with owned sealed CPU worker, per-case progress and ten completions; finally observes actual worker exit before parent teardown. No production/public shape/policy/dependency change. Per-C1 macOS evidence comes only from managed local verification; standalone/previous unleased output is not proof.

## Evidence and disposition

A-11773 records existing docs guard3/3 at137ms and typecheck pass on local Darwin arm64 correction tree, no new CPU run. A-11766 remains summary-level implementation-time local T2/TDD evidence with rounded timings and original failure output; its prior lease-detection/skip description is superseded explicitly by A-11773. The earlier3.826s unleased CPU run and subsequent standalone skip are excluded from C1; Coordinator already addressed their handling. No exact-head configured/load/browser/Linux pass is inferred, and no transcription rerun requested. Original available command/tool outputs should keep actual source/exit/native timing and capture limits in final evidence.

Source CLEAR, findings empty. C1 remains runtime-pending; submit one ordinary mode-free configured verify with --executor local, specifically authorized by Coordinadorae23f74f and required macOS criterion. The task must retain actual10/10 in two lanes and CPU progress for every completed settlement, plus native close/phase/executor/report-mode scope. After a green exact-head result, mark C1 done and request final evidence settlement. No manual stress, additional repetitions, mode override or dev merge requested. Reviewer used read-only source/artifact inspection only. QA none/after-stage.
Durable review: A-11776.

### impl-1259 · 2026-10-25T11:14:04.715Z

C1 done against same-head local macOS run 254eaa19 at a2e04b7a. Native A-11784 log confirms ten distinct passed T4 repetition finish receipts across overlapping two lanes and terminal per-case CPU-progress diagnostic (line 15854), guard 3.759187s; ordinary foreign T2 passed and retry T2 has 5/5 load proof (line 7743). Overall 3165 passed; T0, all T1/all T2 fallback, one T4 and Web complete. T3/Linux not run; duration/test lint report only. A-11785 captures exact provenance and limitations. Final evidence review requested reviewer (resolved rev-31). Fresh fetch origin/dev ea058634 + merge-tree check exit 0, task head unchanged and clean.

### rev-31 · 2026-10-25T11:18:20.933Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1259-final
commit: a2e04b7ac26a144d1e917458f0ee35172d9cb2c6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1259 final macOS evidence — CLEAR

Reviewed unchangeda2e04b7ac26a144d1e917458f0ee35172d9cb2c6/treebc8e29d5bd22c3ea66bb023d2c79f0bde451f5a9, still branch tip. Carry full source A-11771 and corrected source A-11776. Original mode-free/local254eaa19-fedd-48dd-a5a8-2f215e7c1917/A-11784 is finished/passed at this exact head in task.view. C1 claimant done restored after runtime proof. A-11785 indexes the original facts.

## Criterion

C1 verified. Exact T4 `foreign live leases settle10/10 at two workers under CPU load` (spaces as recorded in source: `foreign live leases settle 10/10 at two workers under CPU load`) passes parent3.759187s. Parsed progress has exactly ten distinct leaf repetitions, five under each lane; all pass before lane/parent completion, with no skip/cancel/failure. Matching start/finish records prove overlap for both lanes in every round (758/634/528/570/560ms). Guard diagnostic confirms10/10,workers2,CPU progress in every case,darwin/arm64,executor local,browser none. Accepted source requires every callback to await exact successful suite report, released lease and empty provider resources, then assert that owned CPU counter advanced; finally waits actual worker termination/exit. This is actual same-head macOS managed CPU proof, not a textual count, standalone run or scheduler-tick/presence proxy.

The ordinary T2 foreign-live case passes1.277776625s. Exact provider-retry regression passes ordinary0.854702541s plus5/5separate load repetitions (worst1.429298375s); it retains injected2000ms product delay, exact report/released-lease/empty resources and original receipt bounds. Full component file13/13 passes. Both corrected guide headings pass the configured guards.

## Scope and provenance

Parsed unique terminal test progress excluding file containers:3165ordinary passing outcomes plus5additional load passes, nofail/cancel/skip/todo. Five load passes belong only to the new T2 retry identity. T4 ran once, with its ten internal cases; no extra T4 load-gate repetitions. T4 native parent3.759187s, file/timing aggregate, selected added wall4.344s excluding machine wait, runner phase7s and suite4.58s remain distinct.

Fresh local executor Darwinarm64, Node24.21.0/Neovim0.12.5. Overall configured workers4; T1worker1 and Webworkers2; criterion-specific T4 guard has two concurrent lanes plus its owned CPU sibling. Do not relabel overall runner as two workers. Executed T0exit0/28s, allT1exit0/46s, fallback-all hub+NeovimT2exit0/191s, selected mapped/changed T4fileexit0/7s, Webexit0/129s. No T3, remaining T4, Linux/droplet or all-tier/stage/QA result. RemainingT3 deferred periodic/integrated and absent configured batch tiers; local Linux duration evidence explicitly unavailable. Typecheck is executed locally (`typecheck: local`), not remote gate reuse. No total wall/machine cost was captured or invented.

C1 itself uses no browser. Web uses existing isolated Headless Shell fixtures with observed cleanup censuses; original local log does not retain exact binary version/path, so that metadata remains unavailable rather than borrowed from a droplet. Reviewer ran no browser or process.

Lint133findings/60files and ordinary duration/Web-wall/T3-ratchet diagnostics are report-only. Three missing baselines include new executor-safety-load, dependency-install and install-claims. Web actual suite127.32s vs40s remains a report-only overrun; T3ratchet2209.786s unchanged. The separate generic5s new-identity gate still exists despite no T4 tier budget; this parent3.759187s passes it without an allowance. No missing Linux proof or projection becomes a zero or measured/enforced-budget pass.

## Disposition

Final CLEAR, C1 verified across unchanged accepted source and original exact-head required-platform evidence; findings empty. A-11766 implementation-time summaries and A-11773 correction checks retain attribution/capture limits. Earlier unleased3.826s and standalone skip are explicitly excluded. Fresh conflict check against devea058634 reported successful by lead, unchanged head; Coordinator owns enqueue, no further branch action/repeat/manual stress requested. QA none/after-stage. Reviewer performed read-only source/log/metadata inspection only.
Durable final review: A-11787.

Criteria: C1 verified.

### coord · 2026-10-25T11:24:11.093Z

Merged 17ee05fdfa409025e0c468e4b42ef64be2bc58b4 onto dev.
