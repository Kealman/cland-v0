---
id: T-1219
kind: task
title: An OpenCode session's shell has no cland session identity, so its CLI calls run as the human
state: open
status: review
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
updated: 2026-10-24T09:37:56.799Z
---

## Summary

Found by oc-1020 during the E-1216 qualification (2026-10-24 09:25Z, topic-950). hub/src/adapters/opencode.ts puts CLAND_HUB_FILE, CLAND_SESSION_ID, CLAND_SESSION_NAME, CLAND_LAUNCH_TOKEN and CLAND_ROLE only into the cland MCP server's environment (the `mcp.servers.cland.environment` block). The OpenCode server process it starts (`startServer`) carries no CLAND_* variables, so its shell tools run `cland` with no session identity. The Claude Code and Codex adapters put the same variables in the harness process environment (claude-code.ts, codex.ts).

Seen: oc-1020's `cland verify --report topic-950 --to oc-1020` resolved as the human and was refused with "this session already has a suite queued or running", because oc-1063's verify had also been counted as the human's. oc-1020 resubmitted with its own CLAND_SESSION_ID, CLAND_SESSION_NAME and CLAND_ROLE set by hand and was admitted (run 9e969299). Any cland CLI call from an OpenCode shell (verify, task, merge) is affected, and two OpenCode sessions' verify runs collide as one "human" owner.

## Acceptance criteria

- [x] C1. A command run from an OpenCode session's shell tool sees the same session identity variables a Codex shell sees, and `cland verify` from it is owned by that session, shown with fake OpenCode and a real project hub (test).
  - done: impl-1219 · 2026-10-24T09:34:09.069Z
- [x] C2. Two OpenCode sessions submit verify runs at the same time and each is admitted under its own name (test).
  - done: impl-1219 · 2026-10-24T09:34:09.147Z
- [x] C3. The ready report states how the hub authenticates a shell's claimed session identity (launch token or secret versus plain variables), and whether a shell can claim another session's identity; a gap found there is filed separately.
  - done: impl-1219 · 2026-10-24T09:34:09.743Z
  - verified: rev-26 [reviewer] · run rev-20261024-1219-source-1 · 2026-10-24T09:37:56.799Z · commit 6b21d99e10a60055246146a067298b06afe421b6

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
