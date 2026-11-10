---
id: T-1780
kind: task
title: Logins attached while a new host provisions
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1779
topic: topic-1467
branch: t/T-1780-logins-attached-while-a-new-host
created: 2026-11-09T12:44:09.916Z
updated: 2026-11-10T19:17:06.503Z
closed: 2026-11-10T19:17:06.503Z
---

## Summary

When a host is created for a waiting launch, the hub picks a free login for the launch's harness and attaches its volume as soon as the provider reports the machine ready, while the hub is still connecting and cloning. It mounts the disk once the agent answers, before the host reads `ready`. A cold host's logins add no wait to its boot, and the launch placed on it finds its binding in place.

## What to build

A hook at the `connecting` checkpoint of the create path, which the pool runtime arms with the harnesses of the launches the host was created for. The choice of login is T-1778's (region and account). An attached login reads `in-use <host>`. A host that fails to boot releases its logins through T-1779's path.

## Acceptance criteria

- [x] C1. A launch that starts a fake host gets its login attached before the host reads `ready`, and is then placed with no further attach (test).
  - done: impl-1780 · 2026-11-10T18:05:59.581Z
  - verified: rev-35 [reviewer] · run rev-35-1780-final-1 · 2026-11-10T18:36:24.820Z · commit 678733ec59f841f49f5b10d5b7b7be9b24894887
- [x] C2. On the hub clock, the host's time from create to `ready` is the same with and without the login bind (test).
  - done: impl-1780 · 2026-11-10T18:05:59.796Z
  - verified: rev-35 [reviewer] · run rev-35-1780-final-1 · 2026-11-10T18:36:24.820Z · commit 678733ec59f841f49f5b10d5b7b7be9b24894887
- [x] C3. A host that fails to boot after its login was attached leaves the login `ready` and detached, with the same volume (test).
  - done: impl-1780 · 2026-11-10T18:06:00.145Z
  - verified: rev-35 [reviewer] · run rev-35-1780-final-1 · 2026-11-10T18:36:24.820Z · commit 678733ec59f841f49f5b10d5b7b7be9b24894887
- [x] C4. Two launches of different harnesses that start one host get one login each attached during provisioning (test).
  - done: impl-1780 · 2026-11-10T18:06:00.380Z
  - verified: rev-35 [reviewer] · run rev-35-1780-final-1 · 2026-11-10T18:36:24.820Z · commit 678733ec59f841f49f5b10d5b7b7be9b24894887

## Blocked by

- T-1779

## Notes

- Hot files: `hub/src/host/provision-host.ts` (the checkpoint hook), `hub/src/host/pool-runtime.ts` (passes the harnesses), `hub/src/host/login-binding.ts`.
- Tests: new `hub/test/login-provision-bind.test.ts` (T2, the injected create seam and fake clock).
- Serves epic C2. Its lane orders it after T-1779, because both edit `provision-host.ts`.

## Comments

### impl-1780 · 2026-11-10T17:35:12.276Z

Rule-20 sweep before edits: suite shared transitive graph over all hub/Neovim/Web test files reaches 633 tests with 16 unknowns conservatively reached (artifacts in topic-1467 contain full lists). Explicit name sweep covers LoginBinder/selectForLaunch/login_bindings, startPoolScaling (Sessions and dispatch), #createPoolHost (scaling, human create, login.add), createHost (dispatch, host-create-ready/admission, host-provision-gate); also inspected host-destroy-native, host-restart, host-unreachable and host-stop consumers. Additive optional connecting hook and callback parameter preserve no-demand/manual/login-add behavior; prior callers ignore extra callback parameters. Existing bind interface and persisted binding phases/wire records retained. Shipped docs/skills and fixtures keep existing binding and stop semantics; new docs describe split. No wire frame change or Neovim fixture regeneration needed.

### impl-1780 · 2026-11-10T17:42:34.443Z

Implemented and pushed e2c1263be; review requested from Reviewer in topic-1467. Local macOS Node 24.21.0 supporting evidence: 86/86 across login-provision-bind/login-binding/login-release/pool-scale before the final clock declaration-only correction, and new file 9/9 after correction. Hub typecheck, tier lint, closed-item wording passed; test lint 0 refusals (122 existing report-only findings). Native host-create-ready 12/12 and host-destroy-native 3/3 ran on prior working tree before shared account-selection extraction and formatting; supporting evidence, not exact-head receipt. Preservation slot released; exact TMPDIR names unchanged (3372→3372, no added/removed, new residue 0→0). Source verdict and exact-reviewed-head Linux mode-free verification remain required. No browser. Full T3 merge-batch and T4/stage QA deferred to their occasions.

### impl-1780 · 2026-11-10T17:53:48.714Z

Publication incident (Coordinator disposition 6a815605): A-18454 was published after original scan exit1; Coordinator archived it. File t1780-consumer-dispositions.json; original rule class unanchored sk-prefix; count 1; line 6733 column 27, byte offset 314862. Matched value omitted. Scanner existed only in inline local export script, not a repository file; no repo scanner policy changed. Ad-hoc lookbehind change withdrawn. Source metadata confirms the hit was inside an ordinary manifest test path; replacement export substitutes consumer-redaction-1 plus path SHA256, retaining actual manifest tier/disposition. Replacement A-18455 published only after original unmodified scanner exit0: matches 0, positive control matched, 426173 bytes, SHA256 33aefafe6b89067005baa913e002113c0a8f754a33420278303da563be1acd7a. Orchestration now awaits the scan tool result, inspects scan.exit_code, and exits before artifact.create unless exit_code === 0; missing/nonzero completion cannot publish. No source/test rerun performed for accounting.

### rev-35 · 2026-11-10T17:55:19.878Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1780-source-1
commit: e2c1263be610991a6c6333e091ab0115657969a7
scope: full
findings: [{"severity":"high","text":"Captured provision demand retains harness/account only; validation has no exact durable wait/cancellation/role/account-default authority after list/attach/mount awaits. Cancelled or changed demand can consume/settle an obsolete login. Carry canonical wait admission identity through prepare/finish and revalidate before effects/settlement; lead804dade0 confirms no existing fence/policy.","file":"hub/src/adapters/sessions.ts","line":205},{"severity":"high","text":"failed() joins preparations without first invalidating them, while createHost catch only mutates its local failed record. DB stays connecting/cloning and provisioning validator ignores creation AbortSignal, so held inventory can admit attach after failure/abort. Invalidate synchronously and validate creation lifetime before joining admitted work/rollback; leade4715c8e confirms.","file":"hub/src/adapters/sessions.ts","line":233},{"severity":"high","text":"ready() rethrows ordinary no-login/account/admission prepare refusals as whole host boot failure. createHost releases the healthy machine and PoolRuntime retries while wait remains, changing existing launch refusal into repeated billable creation. Preserve launch-scoped ordinary refusal and healthy host, keeping unknown native fences; lead15c8c3e4 confirms unapproved regression.","file":"hub/src/adapters/sessions.ts","line":224},{"severity":"medium","text":"FakeClock attachment timer has no prearmed cancellation/release owner. Early setup failure can release clone gates and advance1000 before attach schedules its500ms wait; then shutdown joins a creation with no future clock progress. Add explicit late-scheduling-safe release/join and adverse setup-failure control; leadbf396026 confirms.","file":"hub/test/login-provision-bind.test.ts","line":91}]
finding_counts: {"high":3,"medium":1,"low":0}

A-18456 complete pinnedsourcepass:Standards2high1medium/Spec1high,fourconfirmedfindings,C4runtimeunverified. A18453originalexcerpts/candidate/nativepre-extractionlimitsretained;A18455scanned652-consumerreplacementacceptedCoordinator,archivedA18454notused. No reviewer experiments. Releasepinforfourfixes;freshcommittedsource beforeverify. Coordinator6feca561finalreviewednative4fileplan(create-ready,destroy-native,restart,write-back)thenmodefreeverify+actualconsumerreconciliation;fullmergeT3/T4/after-stageQAseparate.

Criteria: C1 failed (Early binding can consume cancelled/changed waiting demand and converts ordinary launch refusal into host boot failure/retry.), C2 failed (Timing regression fixture has an unowned late-scheduled fake-clock attachment on early failure; its cleanup can hang.), C3 failed (Failure/abort joins preparations without fencing new attachment admission; held reads can start effects after boot has failed.).

### impl-1780 · 2026-11-10T18:06:03.022Z

Source-2 fixes committed/pushed as 678733ec59f841f49f5b10d5b7b7be9b24894887, tree ce302005535f03900b4b1ee646d53c88ebb63966; fresh review requested. Four finding regressions shown red then green. Supporting final WIP targeted T2 aggregate 135/135 across six files (macOS Node24.21.0 local); new late-timer failure control passes with cancellation/join owner. Typecheck, lint (0 refusals, report-only existing findings), wording, diff checks pass. Exact TMPDIR name sets unchanged 3372→3372, new residue 0→0. A-18457 preserves actual captured outputs, intermediate failures, status propagation and candidate/commit limits; original unmodified scan exit0 with matching positive control, zero hits before publication. Consumer reconciliation updates all manifest-classified paths including unknowns. Rule-20 existing callers remain compatible with optional signal/validator additions; no wire shape/agent closure change. No dev merge since source-1. Await source-2 verdict before mode-free Linux verification and final reviewed-head native four-file slot. Broader T3/T4 and after-stage QA remain deferred occasions.

### rev-35 · 2026-11-10T18:11:20.881Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1780-source-2
commit: 678733ec59f841f49f5b10d5b7b7be9b24894887
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18458 source-2 complete: Standards and Spec clear; four source-1 findings addressed through exact wait admission/current selection validation, creation signal and synchronous failed fence, launch-scoped refusal with pending outcomes retained, and prearmed late-timer cancellation/join owner. A-18457 135 local passes are supporting uncommitted-candidate evidence with disclosed provenance limits, not reviewed-head runtime proof; manifest hashes checked. C1–C4 remain runtime-unverified. Proceed exact-head mode-free verify plus Coordinator-required reviewed-head native create-ready/destroy-native/host-restart/login-write-back and actual consumer/case reconciliation. Full remaining T3/T4/after-stage QA separate. No Reviewer experiments.

### impl-1780 · 2026-11-10T18:15:54.968Z

At exact reviewed 678733ec5, configured mode-free verify e496c592-af8f-4e0e-9111-fbb8114905a0 admitted; Linux result still pending. Approved native preservation completed sequentially, local darwin Node24.21/no browser: host-create-ready12/12, host-destroy-native3/3, host-restart1/1, login-write-back1/1. A-18459 preserves child close status0/signalnull/errornull, independently expected generated-case membership, zero missing/unexpected/skips/cancel/todo, complete before/after names and original-scanner exit0 summary. Lock owner checked then released. OS TMPDIR names unchanged9841→9841; hc-/lwb- roots0→0. Full /tmp gained14 retained cland-h-* directories, reported aside S/Bugs to lead T-1780; preserved, no source changes/deletion, no global zero residue claim. Full remaining T3/T4 and after-stage QA remain separate occasion evidence; task is not ready yet.

### impl-1780 · 2026-11-10T18:17:09.392Z

Native residue ownership/disposition supplement to A-18459: Coordinator decision93073308 assigns the fourteen newly retained cland-h-* directories and historical residue to T-1806 under C-325 (open/backlog), and directs leaving entries untouched. No ownership/cleanup completeness inferred from names/counts. No test rerun/deletion for accounting;14 retained entries remain an explicit limitation. Supplement artifact cites the tracker/disposition and passed original scanner exit0 with positive control before publication.

### rev-35 · 2026-11-10T18:36:24.820Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1780-final-1
commit: 678733ec59f841f49f5b10d5b7b7be9b24894887
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18462 final same-head evidence clear; C1–C4 verified. Independently scanned A-18461: 5924 base test/667 file passes, zero negatives; all666 manifest lower/Web paths have case+file passes; all22 provision-binding identities pass base+5 load each (110 separate load finishes). Export tree2341edff independently reconstructed from reviewed full treece302005. Same-head Mac native4files/17cases A-18459 reconciled; /tmp14 retained socket directories explicitly assigned T-1806 via A-18460/Coordinator93073308, no global-cleanup claim. All652 inventory consumers accounted:411 lower/Web+mappedT4 configured,4T3 native,223T3+13T4 deferred. Actual Linux x64 Node24.21/Nvim0.12.5/HeadlessShell1248 Chrome156 provenance retained; report-only advisories not enforcement proof. Source2 unchanged/clean; no Reviewer experiments. Full remaining LinuxT3 merge-batch/T4/stage and affected after-stage QA remain separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-10T19:17:06.503Z

Merged ee21cb1468ea1fe80f464ba8c5a45fbbf5a3fa11 onto dev.
