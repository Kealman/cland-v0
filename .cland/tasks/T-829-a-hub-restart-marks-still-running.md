---
id: T-829
kind: task
title: A hub restart marks still-running harness sessions exited, and hub stop then leaves them alive
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
  - qa-found
assignee: null
parent: C-325
blocked_by: []
topic: topic-701
branch: t/T-829-a-hub-restart-marks-still-running
created: 2026-10-19T06:07:06.059Z
updated: 2026-10-20T07:07:14.931Z
closed: 2026-10-20T07:07:14.931Z
---

## Summary

Found by QA in the E-611 demo (qa-2026-10-19-1 at e7de5ca7, check X). After F2's clean hub restart in a scratch project, the hub marked three live sessions exited: aide-1, worker-1 and impl-1, all fake Claude Code `__session` processes. Those processes kept running, reparented to pid 1. The later `hub stop` cleaned up only sessions it still considered running, so three harness processes outlived the hub. Evidence: X.txt, X-diagnostic.txt and X-classification.txt in the run's evidence.

## Acceptance criteria

- [x] C1. A hub start that finds a recorded session whose process is still alive either re-adopts it (it reconnects) or stops it through its owned-process identity. It never marks a live process exited and leaves it running; a component test with a fake harness that survives a hub restart proves which.
  - done: impl-829 · 2026-10-20T06:41:36.232Z
  - verified: rev-31 [reviewer] · run rev-20261020-829-final · 2026-10-20T06:49:47.769Z · commit c9afac130353fc489fa12994f290eb1ad45220fd
- [x] C2. After a hub restart in a scratch project, every harness, spoke and child process the project started is either reattached or tracked as running with its pid, so none is left untracked; `cland hub stop` keeps its documented restart semantics (sessions outlive it), and `cland session stop` on each tracked session leaves no process of the project behind; a T3 scenario asserts both by pid.
  - done: impl-829 · 2026-10-20T06:17:37.601Z
  - verified: rev-31 [reviewer] · run rev-20261020-829-final · 2026-10-20T06:49:47.769Z · commit c9afac130353fc489fa12994f290eb1ad45220fd

## Comments

### impl-829 · 2026-10-20T06:09:41.261Z

Recovery diagnosis: failed native discovery is treated as process exit in shared Sessions.#resume; Codex missing socket and OpenCode missing password have the same path as Claude agents miss. Separately, hub.stop currently preserves harnesses by design (existing restart contract test). Asked supervising lead to resolve C2 shutdown semantics before changing that behavior.

### rev-31 · 2026-10-20T06:26:22.588Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261020-829-source
commit: bbbb1aa4db41a339c866eafd5814b44145f01cbf
scope: full
findings: [{"severity":"medium","text":"OpenCode missing-password recovery calls watch(), but that watcher returns before installing PID supervision; later exit/password restoration remains unobserved. Install a discovery-independent liveness observer and cover continued exit/retry.","file":"hub/src/adapters/sessions.ts","line":1220}]
finding_counts: {"high":0,"medium":1,"low":0}

A-7153: source not clear. M1 confirmed by implementer 94f060c0: no existing observer covers OpenCode missing-password retention. Preserve strict signal ownership and hub.stop semantics; add independent PID supervision plus exit/restored-password regression. Other source paths/fixture lifecycle reviewed without additional findings. C2 remains unverified; retained T3 source attribution includes a subsequent Claude identity-probe adjustment and will need qualified current-source evidence after correction. Fresh source review required before verification.

Criteria: C1 failed (OpenCode's retained missing-password process has no continuing liveness observer; adapter.watch returns before PID supervision is installed.).

### impl-829 · 2026-10-20T06:29:22.134Z

Fixed Reviewer M1 in 0a403fd7: OpenCode now installs a PID observer independently of password/native-stream setup and retries missing credentials at its poll interval without concurrent attempts or repeated warnings. Added FakeClock coverage for password restoration reconnect, subsequent missing-password PID exit, and one-shot exit publication. OpenCode native component file: 16/16 green; npm run check green. Original retained T3 stdout and provenance are A-7142/A-7155; exact-head native lifecycle validation is running before fresh source review.

### rev-31 · 2026-10-20T06:31:44.185Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-829-source-corrected
commit: 0a403fd7d2ab6167a60c116ca097db689db8528e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7165: full corrected source clear. OpenCode's process-bearing watch ticket/PID timer survives missing credentials; polling retries native discovery, serialized/stale-safe. New T2 regression covers restored password and subsequent PID exit exactly once. Existing strict stop ownership/hub.stop semantics unchanged. A-7160 exact-head macOS native lifecycle 2/2 and adapter boundary 65/65 read with exit metadata. C1/C2 final verification awaits mode-free exact-head gate; Linux T3 remains deferred. No merge authorization.

### rev-31 · 2026-10-20T06:38:51.905Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261020-829-runtime
commit: 0a403fd7d2ab6167a60c116ca097db689db8528e
scope: evidence
findings: [{"severity":"medium","text":"Synthetic PIDs trigger real execFileSync ps through frameClient -> rememberResultProcesses; owned T2 resource mismatch at A-7169:48878. Inject fixture ownership/process facts without dropping PID assertions or suppressing tripwires.","file":"hub/test/session-resume-component.test.ts","line":19}]
finding_counts: {"high":0,"medium":1,"low":0}

A-7170: overall exit 0 but owned report-only resource escape prevents final clear. 1929 ordinary +15 repeat passes, all three new identities 5/5, no owned duration failure. C2 remains unverified. Native proof boundaries retained; fresh source review required before replacement verification.

Criteria: C1 failed (New restart component crosses T2 resource boundary via real synchronous PID capture; fixture correction and fresh source/gate required.).

### impl-829 · 2026-10-20T06:41:36.220Z

Corrected runtime review M1 in c9afac13 (tests only): frameClient/connectUi accept a process observer with the existing OS ownership collector as default. The synthetic restart fixture injects an in-memory observer that validates every non-null PID against its three fake adapter identities and asserts all were observed. No PID/session/recovery/stop assertions were removed, no tripwire changes or process-method mocks. At exact c9afac13, the component file is 4/4 with unmodified T2 tripwire enforce mode and zero mismatch output; native lifecycle file 2/2; npm run check green. Fresh source review precedes mode-free gate retry.

### rev-31 · 2026-10-20T06:42:22.623Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-829-source-fixture
commit: c9afac130353fc489fa12994f290eb1ad45220fd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7172: revised source clear. Synthetic process-observation seam validates all three expected PIDs and preserves every recovery/stop assertion; native callers retain original cleanup observer. Unmodified T2 tripwire enforce file 4/4 and exact-head native lifecycle 2/2 read from A-7171. Product source A-7165 unchanged. C1/C2 await wholly clean exact-head mode-free gate; no merge authorization.

### rev-31 · 2026-10-20T06:49:47.769Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-829-final
commit: c9afac130353fc489fa12994f290eb1ad45220fd
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7174: exact-head A-7173/a6faec8f audited: 1929 ordinary passes, all three new identities 5/5 (15 distinct repeats), zero tier mismatch or duration failures. Owned prior execFileSync escape absent. C1/C2 verified with source A-7165/A-7172 and current-head macOS native lifecycle 2/2 A-7171; Linux T3 remains explicitly deferred. Claimant done marks present; previous findings resolved. No merge authorization.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T07:07:14.931Z

Merged eaa11b62b3c7d8d2306a3e90ed04e69519afe587 onto dev.
