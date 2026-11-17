---
id: T-1645
kind: task
title: The host agent's run operation buffers unbounded command output before its reply cap
state: open
status: ready
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1884
blocked_by: []
topic: topic-1596
branch: t/T-1645-the-host-agent-s-run-operation-buffers
created: 2026-11-02T23:52:24.965Z
updated: 2026-11-17T11:05:06.497Z
---

## Summary

T-1593's host-agent `run` RPC reuses the legacy doctor/run helper, which accumulates a command's stdout and stderr without a bound. Only afterwards does the 1 MiB reply cap refuse an oversized result. A noisy command on a small agent host can therefore grow the agent's memory before the refusal. The reviewer flagged this as low in A-16003; the behaviour otherwise matches the spec.

## What to build

Bound output while it is collected. Stop reading, or truncate, at the reply cap plus a margin, and report truncation explicitly. Keep the doctor's existing behaviour unchanged for its callers.

## Acceptance criteria

- [x] C1. An agent `run` of a command that writes 10× the reply cap holds at most the cap plus a fixed margin in memory, and answers with an explicit truncated or refused result (test).
  - done: impl-1645 · 2026-11-17T10:33:41.726Z
  - verified: rev-35 [reviewer] · run rev-35-1645-final-2 · 2026-11-17T11:05:06.283Z · commit 9203f29f6534f9eea8259013820554a2f64a7800
- [x] C2. The doctor checks that use the same helper produce unchanged results (test).
  - done: impl-1645 · 2026-11-17T10:33:42.134Z
  - verified: rev-35 [reviewer] · run rev-35-1645-final-2 · 2026-11-17T11:05:06.283Z · commit 9203f29f6534f9eea8259013820554a2f64a7800

## Comments

### impl-1645 · 2026-11-17T07:56:04.919Z

Rule 20 consumer census: agent raw run is dispatched by agentOperations; durable run-host is dispatched by server and persisted/trimmed by PreparedOperations.runCommand, consumed by SSHHost.run/settlement. command.ts is re-exported by doctor/report.ts. Direct consumers: agent process-usage, claude, login-disk, fake-login-disk, ref-push-worker, watch, prepared-checkout, worktrees; host/local, doctor/report and report importers (doctor probes, setup machine/account-identity/handover, system/process identity/path helpers, orphan/suite/git-maintenance/release-preflight helpers). These retain the unlimited default and unchanged result shape. Searches covered run-host, boundedCommandResult, frame-cap text, agent/command and doctor/report across hub, nvim, shared, docs, .agents and qa, including T3/T4: host-prepared, host-command-environment (old-shape regression), claude-agent-launch, claude-code-remote, login-binding, login-exclusive-native, login-write-back, ssh-host-fixture, doctor-run and doctor-* fixtures/tests; QA E-1532/1533/1535/1537/1538 and shipped skill change notes refer to commands or environment and need no wire migration. No fields or wire version change. Raw run keeps its existing frame-cap refusal; run-host keeps its explicit bounded RunResult error and durable native exit. New collection bound is opt-in only on those two RPC paths.

### rev-35 · 2026-11-17T08:06:35.821Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1645-source-1
commit: 0e6f47a4e7e0f0b8dddf1fe56db7f2491d415ba8
scope: full
findings: [{"severity":"medium","text":"All three new callbacks use fakeProbe without a whole-sequence owner before mocks/timers and pending run/agentOperations work. Its t.after only restores globals, leaving early-failure/cancellation setup/body/command continuations unjoined. Lead confirms no owner/disposition. Fence, release and join body/command before mock/timer/stream disposal; retain nominal assertions (rule12).","file":"hub/test/doctor-run.test.ts","line":14},{"severity":"low","text":"Per-file guidance omits the new trailing collector and bounded-output/raw-refusal/drain-close/unlimited-doctor regressions. Update matching test guidance with the correction (rule16).","file":"docs/agents/tests/hub-test-doctor-run.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":1}

Full source pass at treee74643d73a0f1906f0b500365491baef963a10f7; A-20762. Standards1M/1L, no separate nominal production defect. Shared collector bounds combined retained UTF-8 bytes only on raw run/generic run-host, keeps drain/native-close and durable result path, default doctor behavior unchanged. Closure hashes independently match. A-20755/A-20761 candidate11/11T2+13/13T1+5/5T1 and full lint/typecheck0 remain successful-path/precommit evidence, not ownership proof/exact-head runtime. Raw/hash/native-signal/original-scan unknowns retained; compatibility/lint overlap disclosed, no timing/load claim. C1/C2 failed/unverified; no verified marks. Lead confirms lifetime gap. Consolidate correction plus per-file guidance, then fresh pushed-head source review before configured verify. No Reviewer test/probe/edit.

Criteria: C1 failed (New output-bound/refusal regressions lack failure/cancellation lifetime ownership before restoring globals.), C2 failed (New complete-output doctor compatibility regression has the same unjoined callback/command cleanup gap.).

### rev-35 · 2026-11-17T08:17:00.018Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1645-source-2
commit: 18e3f2d0a435728ff6a8a921c406730f9be48aca
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh full source clear, tree22fcc93df68575b3f12446a60a65cd816e3cea3f; A-20772. M1/L1 corrected together. Shared fixtureWork enrolls bodies/command/assertion closures before fake acquisition; close fences/aborts, releases held setup and fake child, joins admitted work, observes stream close then restores global mocks. Positive abandoned-command and late-body→agent-operation controls retain restoration/no-process assertions; nominal byte/refusal/doctor assertions unchanged, spawn receipt replaces microtask polling. Per-file guide updated. Production/closure bytes unchanged from prior full pass; no new findings. A-20768 final candidate doctor-run13/13T2 and full typing0 follow edits; lint0/refusals0/122report findings59files overlapped final edits and is not an immutable final-source receipt. Earlier13/13compatibility+5/5closure remain prior-candidate T1 evidence. Raw/hash/signal/platform/native/provenance limits retained. C1/C2 remain unverified pending same-head configured evidence; no verified marks. No Reviewer runtime/probe/edit/new run/merge. Follow Coordinator window.

### rev-35 · 2026-11-17T08:45:21.336Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1645-final-1
commit: 18e3f2d0a435728ff6a8a921c406730f9be48aca
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Same-head final clear; A-20790 reconciles A-20787/run56cbc44f with A-20772 source. All5new output/refusal/doctor/cleanup identities have ordinary PASS+5/5load; full doctor-run13/13, closure and previous-shape compatibility guards pass. Counted retained UTF-8 strings≤1MiB through>10frame caps, zero overflow signals, native-close/exit and explicit refusal retained; no RSS/native-noisy-command claim. T0/T1/allT2/Web exit0,6612ordinary passes/708files plus235separate load passes,0fail/cancel/skip.264? No T3 executed:269T3/17T4 files unexecuted. Current clean head; normalized treeb9b345386d121fc4849dc4b976260ca0b8c3f620, uncached Linuxx64/Node24.21.0, actual HeadlessShell1248/ChromeTesting156.0.8078.4.64existing warning identities unchanged, none own-case; positive controls are primary evidence. Exact T-1935 fixture pair retained separately from terminal exit0/hub passed, no retry. Lint122/59 and budgets/ratchet/skip report-only; source-local/provenance limits preserved. Source clear predates rules38–43; cleared-head basis respected. C1/C2 verified. No Reviewer runtime/probe/edit/new run/merge.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-17T08:46:39.115Z

Record correction (coord, on rev-35's behalf; a reviewer can only post verdict comments). rev-35-1645-final-1 contains a stray "264?" just before "No T3 executed: 269 T3/17 T4 unexecuted". The correct statement, as in A-20790, is that 0 of 269 T3 files and 0 of 17 T4 files ran in the task verify; T3 is covered by the merge batch. The verdict and criteria marks are unchanged and valid.

### impl-1645 · 2026-11-17T10:05:13.924Z

Missed consumer correction (rules 20/41): batch 19dbf20f at 877ca419 failed host-ssh-contract.test.ts:242, both Host.run oversized escaped-output cases, on assert.ok(completed.stdout.endsWith("stdout-end")). Existing contract already requires explicit frame-cap error, native code17, final stdout/stderr tails and unfenced follow-up, not whole output. Coordinator approved bounded rolling byte-safe tails. Keep those assertions and add per-stream4096-byte bounds. Expanded search fields Host.run/HostRunResult, .run({command...), .run(command...), boundedCommandResult, oversized/output exceeds cap/stdout-end/stderr-end and helper importers across hub/nvim/shared/qa/docs/.agents. Consumers: host/{host,local,ssh-host,flush,clone,task-worktrees}, agent/{command,operations,server,prepared,watch,claude,login-disk}, adapters/{codex,claude-code,claude-code-local}, setup/steps/{harnesses,logins}; local/default/Claude-specific command collectors remain unchanged. Tests: host-ssh-contract(T3 missed; direct and lost-reply tails), host-contract helper and its importers host-{local,ssh-contract,contract-coverage}, doctor-run(T2 changed), host-command-environment(T1 old reply), claude-agent-launch(T1 bounded result), host-{attach,restart,registry,clone-integration,revoke,agent-files,provision-gate,relaunch-native}, adapter-native-boundary, project-hub, claude-code-remote-files, speech-command and scenarios/integrated-v04. No other large-output Host.run assertion found. Speech output cap is an independent collector. Relevant QA: E-1531, E-1531-stage-2, E-1532, E-1532-stage-3, E-1533-stage-2/stage-3, E-1534-stage-1/stage-2, E-1535-stage-1; shipped implement CHANGES T-1599-consumers/T-1546-codex-host/T-1604-host-clone/T-1607-remote-claude and observer-consumer-sweep. These retain the reply shape and need no migration. Frozen commands.json has no changed help text; manifests inspected for tier identities, no prior T1 evidence substitutes for the T3 contract. Original task receipt remains T0/T1/T2/Web only; batch T3 failures remain recorded, not superseded by that earlier green.

### impl-1645 · 2026-11-17T10:06:01.675Z

Consumer census normalization: the shared host-contract.ts helper importers are host-local-contract.test.ts (T3 local-host), host-ssh-contract.test.ts (T3 ssh-host), host-contract-coverage.test.ts (T1), host-flush.test.ts (T1), and host-agent.test.ts (T3). Other expanded matches normalize as host-attach/restart/clone-integration/agent-files/provision-gate/relaunch-native, adapter-native-boundary, speech-command and scenarios/integrated-v04 = T3; host-registry/revoke, project-hub and claude-code-remote-files = T2. These tiers are current tiers.json facts; none is claimed executed on the new candidate yet. Setup machine.run matches are a separate SetupMachine streaming command abstraction, not Host.run, and are unaffected. Larger-output search found the missed Host.run contract cases plus doctor-run and the independent speech collector; frozen CLI help is unchanged.

### rev-35 · 2026-11-17T10:15:50.773Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1645-source-3
commit: b4030b460147831e594b705fc2107b72ca957c41
scope: delta
findings: [{"severity":"medium","text":"New throwing public guard lacks non-control attempt counter/final zero assertion and low-level ChildProcess.prototype.spawn trap. Swallowed forbidden calls or pre-captured/custom launchers need not fail the case. Positive direct throws alone are insufficient; lead1d7c5c87 confirms no other owner/disposition. Add counted effective guarding through cleanup (rule38), no observed final-candidate escape claimed.","file":"hub/test/doctor-run.test.ts","line":153},{"severity":"medium","text":"New guard methods use t.mock automatic context restoration; if bounded fixtureWork join rejects, ownedProbe skips captured hooks but does not prevent context restoration while original body/command work remains pending. Keep new guards until positive original setup/body/command/drain join, including failed bounds; lead8ab1d138 confirms no alternate tracker/condition (rules12/38).","file":"hub/test/doctor-run.test.ts","line":154}]
finding_counts: {"high":0,"medium":2,"low":0}

A-20840 delta at tree9dd46790cbbbce7ab3a49207256acb0068b6d7f8,2M Standards/0new Spec findings. Coordinatorfdbbe591 byte-safe rolling tails match retainedHostrun code17/markers/nativeclose/continueddrain/unfencedfollowup; perstream min4096,floor(cap/2) boundsretention and UTF8cutoffs complete. Doctor unlimited/raw refusal unchanged. Original T3 assertions preserved+bytebounds; independently47closurehashesmatch, expandedmissedconsumer/tiercensusrecorded. A-20836 T2red12/1→13green,T1closure5,finalcandidatefulltype/lint0/refusals0/123report60files; exactcommitT3SSH40/40native0, candidate/raw/signal limits explicit. Earlier batch19dbf20f failures remainfailed; no new configured/load/browser/T4/RSS claim. C1failed,C2pending. Consolidate two guard fixes then fresh pushed-head delta review/newCoordinatorwindow. No Reviewer runtime/probe/edit.

Criteria: C1 failed (Strengthened bounded-output regression's new native guard lacks complete attempt detection and retained lifetime through failed joins.).

### rev-35 · 2026-11-17T10:29:17.629Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1645-source-4
commit: 04afde605afff400d4a6e12844f5ed1b8af3638a
scope: delta
findings: [{"severity":"medium","text":"New fixture-owned guards are also installed by direct legacy fakeProbe(t) callers; their ordinary after-hook disposal does not use ownedProbe's original callback/run join. Assertion failure/cancellation can therefore restore guards before pending probe work joins. Lead84b0471b confirms no owner/disposition. Cover direct callers or scope guards to owned lifetimes while preserving old assertions (rules12/38). No observed candidate escape claimed.","file":"hub/test/doctor-run.test.ts","line":212}]
finding_counts: {"high":0,"medium":1,"low":0}

A-20844 delta treee7efe335abe613a5496a2eeae16d6778aeb58352,Standards1M/Spec0newfinding. Prior two findings resolved on ownedProbe path: counted/prototype/public-custom denial controls, finalzero, context-independent guards, rawbody/command join drivesdeferred disposal even failedbound; newcontrols exercise swallowed denials+failedbound/contextreset. Remaining directlegacy lifetime is outside thatjoin. Production/tail/closure/T3 source unchanged. A-20842 preservesred13/1→16ordinary and16manualT2enforce, finalcandidatefulltype/lint0/refusals0/124report60files; priorT3SSH40/40 remains b403-only. No configured/workerbootstrap/newT3/T4/Web/load/RSSclaim; raw/invocationtree/signallimits retained. C2failed,C1pendingfinalevidence. Consolidate callerownership then fresh pushed-head deltareview/newwindow. No Reviewer runtime/probe/edit.

Criteria: C2 failed (Changed shared guard's direct doctor/probe compatibility callers still dispose it without positive original callback/run join on failure/cancellation.).

### rev-35 · 2026-11-17T10:35:46.900Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1645-source-5
commit: 9203f29f6534f9eea8259013820554a2f64a7800
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-20846 delta source clear at independently readtree3a1f62935f621d98fc45bdcf0395532322a855bf. Standards0/Spec0 findings. Source4 resolved with offered scope: counted fixture-owned fakeProbe guard only acquired by ownedProbe, captured disposal follows independent originalbody/command join/streamclosure/finalzero even failedbound; contextreset cannot releaseguards. Direct old fake-clock callers uselegacyProbe contextspawn/kill/timers withoutnewguard; originalassertions retained,guideexplicit. Production/tail/T3SSH/closure unchanged fromb403 correction;47closurehash sourcebasis retained. A-20845 candidate16ordinary/16manualT2enforce,fulltype/lint0/refusals0/124report60files; noeditsduringchecks/commit, immutableperinvocation/raw/signalunknown. Manualenforce notworkerbootstrapreceipt; priorb403SSH40/40 stayspriorhead. No newconfigured/load/Web/T3/T4/RSSclaim. C1/C2 pending sameheadconfigured evidence; source clear permits Coordinatorwindow request,Coordinator ownsreenqueue. Oldgreen/failedbatch remainseparate. No Reviewer runtime/probe/edit.

### rev-35 · 2026-11-17T11:05:06.283Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1645-final-2
commit: 9203f29f6534f9eea8259013820554a2f64a7800
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-20851 exact-head final clearance: sourceA-20846 + passed89144383/A-20850 at9203f29f, normtree65de00b2d61c6e8aed693acdbdd894771519aa06/prov38379. Independent6655ordinarytest/709file passes,250loadpasses separate; all224T1/429T2/55Web/1T3ssh-host complete,no missing/nonpass/fail/cancel/skip,alltiers/Finished0. Eighttask ordinary+5loads/proofs:swallowedpublic/native,failedboundretention,abandoned/latejoin,boundedten-cap,rawrefusal,doctorunchanged. File16/16,closure5/5. SameheadnativeSSH direct35734/lostreply35739 pass retainedcode17/tails/bytebounds/unfencedfollowup;file35767 has24top+16nested=40typedtests once/noreps. C1 retainedUTF8state+boundedtemps,notindependentRSS/nativetenMiBmeasurement; C2doctorcompleteoutputdeep-equality+legacycontrols.64warningidentitiesunchangedvsA-20823,124lint60files/budgetsreport-only. ExactT1935pair28727–28fixturetextnotoutcome. LinuxNode24.21Nvim.12.5uncached;actualHeadlessShell1248/CfT156browser35798.33.652s selectednativephasesexclwaitnotwall;268T3/all17T4unexecuted. Oldgreen/failedbatch/priornativehead remainseparate. C1/C2verified;Coordinator ownsreenqueue/integratedchecks. No Reviewer runtime/probe/edit.

Criteria: C1 verified, C2 verified.
