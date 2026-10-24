---
id: T-1219
kind: task
title: An OpenCode session's shell has no cland session identity, so its CLI calls run as the human
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1216
blocked_by: []
topic: topic-951
branch: t/T-1219-an-opencode-session-s-shell-has-no-cland
created: 2026-10-24T09:26:22.640Z
updated: 2026-10-24T10:00:20.157Z
closed: 2026-10-24T10:00:20.157Z
---

## Summary

Found by oc-1020 during the E-1216 qualification (2026-10-24 09:25Z, topic-950). hub/src/adapters/opencode.ts puts CLAND_HUB_FILE, CLAND_SESSION_ID, CLAND_SESSION_NAME, CLAND_LAUNCH_TOKEN and CLAND_ROLE only into the cland MCP server's environment (the `mcp.servers.cland.environment` block). The OpenCode server process it starts (`startServer`) carries no CLAND_* variables, so its shell tools run `cland` with no session identity. The Claude Code and Codex adapters put the same variables in the harness process environment (claude-code.ts, codex.ts).

Seen: oc-1020's `cland verify --report topic-950 --to oc-1020` resolved as the human and was refused with "this session already has a suite queued or running", because oc-1063's verify had also been counted as the human's. oc-1020 resubmitted with its own CLAND_SESSION_ID, CLAND_SESSION_NAME and CLAND_ROLE set by hand and was admitted (run 9e969299). Any cland CLI call from an OpenCode shell (verify, task, merge) is affected, and two OpenCode sessions' verify runs collide as one "human" owner.

## Acceptance criteria

- [x] C1. A command run from an OpenCode session's shell tool sees the same session identity variables a Codex shell sees, and `cland verify` from it is owned by that session, shown with fake OpenCode and a real project hub (test).
  - done: impl-1219 · 2026-10-24T09:34:09.069Z
  - verified: rev-26 [reviewer] · run rev-20261024-1219-final-1 · 2026-10-24T09:53:43.597Z · commit 6b21d99e10a60055246146a067298b06afe421b6
- [x] C2. Two OpenCode sessions submit verify runs at the same time and each is admitted under its own name (test).
  - done: impl-1219 · 2026-10-24T09:34:09.147Z
  - verified: rev-26 [reviewer] · run rev-20261024-1219-final-1 · 2026-10-24T09:53:43.597Z · commit 6b21d99e10a60055246146a067298b06afe421b6
- [x] C3. The ready report states how the hub authenticates a shell's claimed session identity (launch token or secret versus plain variables), and whether a shell can claim another session's identity; a gap found there is filed separately.
  - done: impl-1219 · 2026-10-24T09:34:09.743Z
  - verified: rev-26 [reviewer] · run rev-20261024-1219-source-1 · 2026-10-24T09:37:56.799Z · commit 6b21d99e10a60055246146a067298b06afe421b6
  - verified: rev-26 [reviewer] · run rev-20261024-1219-final-1 · 2026-10-24T09:53:43.597Z · commit 6b21d99e10a60055246146a067298b06afe421b6

## Comments

### impl-1219 · 2026-10-24T09:30:55.242Z

TDD red: targeted native shell inheritance test failed with all five CLAND identity values null, while its MCP config held the launched identity. Minimal fix overlays the five session variables onto the OpenCode server environment after account resolution; MCP config unchanged. Green targeted receipt on macOS arm64/local, working tree: 1/1 new test; two real CLI children from two fake OpenCode shell tools yield distinct hub queue IDs/owners. Suites intentionally remain queued behind injected occupied capacity (no verification execution claimed).

### rev-26 · 2026-10-24T09:37:56.799Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1219-source-1
commit: 6b21d99e10a60055246146a067298b06afe421b6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1219 full source review
Reviewed head 6b21d99e10a60055246146a067298b06afe421b6; tree 9dbefeaef551c1485482228932f631bbad980f71. Fixed point 0a57d8bf5b0dcb98b540375e354e51c501ffed70; git diff fixed-point...head covers five files, 117 additions / 4 deletions. Scope full; run rev-20261024-1219-source-1.

## Standards
No findings. The production change overlays the launched identity after account environment resolution, then filters executor credentials before passing the environment to the existing native server owner. Constructor filtering prevents inherited cland identities from leaking into another launch. The existing MCP environment remains unchanged. Account selection and native launch/rollback ownership remain intact.

The new test is in the existing T3 OpenCode native contract: a fake authenticated HTTP shell endpoint starts a real shell/CLI from the actual server environment, rather than substituting MCP configuration. The shell boundary seals HOME, XDG, Git, profiles and provider/executor credentials after overlays, deliberately retaining only the fixture server's cland variables. Native callbacks and CLI deadlines are bounded; projectHub cleanup stops writers before disposable directories. The two admissions run concurrently and are checked against persisted hub status plus named queue owners. Occupied compatibility capacity deliberately prevents package/suite execution. README and exact-path per-test guidance match the behavior. Static diff check is clean.

## Spec
No findings. C1 and C2 are implemented with independent assertions for the five launched identity fields, successful real CLI submissions, distinct IDs, queued state and each session's own owner. The test retains the production adapter and real project hub/CLI boundaries needed to prove environment inheritance and attribution.

C3 is established by the source analysis and ready-report material in A-10663, with the separate issue filing confirmed by Coordinator 9cde804b. Project transport authentication and shell actor attribution are distinct: this patch does not introduce a per-session authentication guarantee. The existing trust gap is separately filed as directed, outside this item's shell-environment fix. Detailed private evidence remains in its original topic artifact; no reproduction sequence is copied here.

## Evidence and next step
Source clear, C3 verified; C1/C2 await actual post-verdict receipt at this exact head. A-10663 attributes local macOS arm64 targeted red/green, 15/15 contract-file passes and check success to implementation 9ae649aa before the dev merge. It is not an exact merged-head configured receipt. Preserve original command stdout, exits, native durations and source attribution durably without rerunning merely for transcription.

Proceed with normal mode-free configured verification at this head. Audit actual executed phases, including the changed T3 contract if selected; a deferred T3 notice is not a native contract pass. No full-run request, executor/configuration override, merge or QA execution is authorized by this verdict. QA policy is none/after-stage.

Reviewer performed read-only source/Git/artifact inspection only, no tests, probes, edits, process launches, merge or delegation. Standards findings 0; Spec findings 0.
Durable review A-10671.

Criteria: C3 verified.

### rev-26 · 2026-10-24T09:53:43.597Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1219-final-1
commit: 6b21d99e10a60055246146a067298b06afe421b6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1219 final evidence settlement
Head 6b21d99e10a60055246146a067298b06afe421b6, tree 9dbefeaef551c1485482228932f631bbad980f71. Scope evidence; run rev-20261024-1219-final-1; findings []. Source A-10671 remains clear.

## Standards
Configured mode-free run 2a0b22d2-4cf0-4662-bf07-5711b86e109f / A-10693 exits 0 at this exact head. Native deduplicated finish records show 2867 ordinary tests / 419 files pass, no failed, skipped or cancelled records. No actual load repetitions or T3/T4 tests executed despite generic load-gate/deferred status lines. T1, fallback all hub and Neovim T2, and actual Web all completed. This is not a full integrated T3 receipt.

Linux x64 6.8.0-142-generic droplet c-8 lon1, cland-v0-21b2082a; Node24.21.0/Neovim0.12.5; two machine workers, T1 serial and Web four; lifetime732s/$0.0508. Host check gate9e63480533ae22673839c1d942b39fe54c289558 independently resolves as tree; reused, not repeated remotely. Captured check reports zero refusals. Lint133 findings/60files, duration/tier warnings, two missing baselines and incomplete ratchet base are report-only. Native phase suite walls59.87/369.22/171.88s differ from phase envelopes/projections; Web shard171.73s exceeds40s report budget. No enforcing-budget pass claimed.

The missing merged-head native seam is supplied separately by A-10695: original combined stdout/stderr and metadata at the exact head/tree, local Darwin27.0.0 arm64 Node24.21.0. The one named T3 shell identity contract passes1/1, exit0, no skip/cancellation: native test1405.994458ms, runner1895.412958ms. Registered fixture teardown completes before clean Node exit; no independent process-scan claim. This was a changed-head correctness check, not output reconstruction; no source change or configured-run resubmission followed. It is not Linux T3 evidence. The original pre-merge full-file15/15 and check records remain A-10674, scoped to9ae649aa; they are not relabelled as merged-head runs.

## Spec
C1 verified: accepted source plus exact-head native contract exercises the authenticated fake OpenCode shell endpoint inheriting the actual launched server environment. Assertions compare all five identity fields to unchanged MCP configuration and independently check path/id/name/role/token; real CLI verify succeeds and persisted hub/queue records identify that session.
C2 verified: the same native contract concurrently submits from two separately launched Implementers with separate claimed items/topics; distinct admitted jobs remain queued under their respective names. Injected occupied capacity intentionally prevents nested package/suite execution. These are admission/ownership assertions, not completed nested verification results.
C3 carried forward from source-1: the report material describes project transport authentication separately from shell actor attribution. Coordinator9cde804b confirmed the existing identity-trust gap filed separately. No authentication fix or stronger trust guarantee is claimed here; detailed private evidence remains in its original topic.

All C1–C3 verified against accepted source, the same-head configured result and explicitly separate local native contract. Both axes have no findings. Implementer reports final read-only merge-tree against origin/devfd834380 exited0 without changing the clean reviewed head. QA none/after-stage; no QA or T4 claim. Coordinator owns landing.

Reviewer performed read-only source/Git/artifact inspection and native-log parsing; no test/probe execution, edits, merge or delegation.
Durable final review A-10699.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-24T10:00:20.157Z

Merged a49401d53087482af8cc874d5918bbbacf36e832 onto dev.
