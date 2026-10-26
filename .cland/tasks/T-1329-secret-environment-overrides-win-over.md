---
id: T-1329
kind: task
title: Secret environment overrides win over the file and join the sessions' deny-list
state: open
status: ready
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1308
blocked_by:
  - T-1328
topic: topic-1085
branch: t/T-1329-secret-environment-overrides-win-over
created: 2026-10-26T07:54:41.838Z
updated: 2026-10-26T12:01:18.310Z
---

## Summary

`CLAND_TELEGRAM_TOKEN`, `CLAND_DISCORD_TOKEN`, `ELEVENLABS_API_KEY` and `XAI_API_KEY` override the secrets file and join the sessions' environment deny-list beside `DIGITALOCEAN_TOKEN`. No session and no speech command inherits them.

## What to build

Resolve each secret as environment override first, then the file. Add the four names to the shared credential deny-list (`shared/executor-credentials.ts`) used for every child launch environment, including the speech command's (rule 15). Spec §3.3.

## Acceptance criteria

- [x] C1. With all four overrides set in the hub's environment, the hub resolves each over the file's value, and a fake harness session's environment and a fake speech command's environment hold none of them (test).
  - done: impl-1329 · 2026-10-26T11:43:43.791Z
  - verified: rev-26 [reviewer] · run rev-20261026-1329-evidence-1 · 2026-10-26T12:01:17.018Z · commit d4e20387ea69e3a3475ce529550f3403fc4a7d4a

## Comments

### impl-1329 · 2026-10-26T11:32:29.545Z

Shared-contract consumer inventory before changing resolution/credential policy: resolveSecrets -> daemon startup and cli/secret.ts (list + preflight), setSecret/unsetSecret (must remain file-only); no persisted secret readers elsewhere. withoutExecutorCredentials/EXECUTOR_CREDENTIALS -> adapters codex/claude-code/opencode, accounts/registry, executor local + droplet/machine, verification-occasion, hub/suite-worker, cli/qa, shared test-support/fixture-environment; regressions executor-contract, fixture-environment, suite-check, doctor-cli, durations, orphan-servers and init-machine. Searched hub/shared/test-support/nvim/web production/tests (all tiers), qa briefs, docs and shipped skills. No wire shape changes; existing clients unaffected. Docs consumers: hub README, docs/agents/secrets, executor argv audit, implement skill. Speech runtime does not exist yet; Coordinator confirmed generic child through the shared final-overlay filter stands in here, E-1311 must use/prove that filter. Tests: T1 resolver/file-edit isolation + pure filter; T2 real fake-harness launch + generic command child. Keep old public resolveSecrets(root) call compatible.

### impl-1329 · 2026-10-26T11:38:49.789Z

C1 done at 082c7b5df. Correction to initial seam note: real fake-harness + generic child contracts are T3 (not T2), required for the actual native environment boundary; no daemon subprocess is needed (projectHub with explicit production Claude adapter). All touched local test files + existing secrets T2 and requested cli-imports T3 pass, plus npm run typecheck and static checks. See implementation artifact for exact local coverage and red receipts. Docs explicitly assign actual speech-launcher filter proof to E-1311.

### rev-26 · 2026-10-26T11:41:57.523Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261026-1329-source-1
commit: 082c7b5dfbb9414a9a9dff6e515c1fc8016d1a93
scope: full
findings: [{"severity":"medium","text":"M1 / Standards: SECRET_USAGE changed without its frozen commands.json owning row; existing compatibility/full-help byte checks fail. Update only that row and retain original red/green guard receipts.","file":"hub/src/cli/usage.ts","line":67},{"severity":"medium","text":"M2 / Standards: generic child is launched after tempProject directory ownership, then gets a later t.after kill/closed wait. Cancellation can remove the root before closure; no independently bounded pre-directory stop/output drainage. Reuse registered owner and cover cancellation/missing receipt with original final assertions.","file":"hub/test/secrets-environment.test.ts","line":32}]
finding_counts: {"high":0,"medium":2,"low":0}

Complete in-session Standards/Spec audit A-12366. Production override/file-only split and shared name-first deny-list appear consistent; Coordinator faa116f6 independently permits generic child speech stand-in, with E-1311 actual launcher proof separate. M1 stale SECRET_USAGE frozen row; M2 generic-child late cleanup hook lacks pre-directory bounded stop/close/output drainage on cancellation. Existing harness ID/durable environment-name receipt and final-overlay metadata assertions retained. No reviewer execution. A-12363 local reports/limits and later M1 working-tree red/green remain attributed, not configured proof. Correct/push then fresh source review before verification.

Criteria: C1 failed (M2: generic speech stand-in child lacks cancellation-safe bounded close/output ownership before root removal; M1 help guard mismatch also blocks.).

### impl-1329 · 2026-10-26T11:43:35.359Z

Source-1 corrections: M1 updates only SECRET_USAGE's frozen commands.json row; unchanged cli-usage-compatibility and cli-help guards reproduced red then green. Inventory addition: frozenUsage/commands.json feeds T1 cli-usage-compatibility, T2 cli-help, and usage component consumers; their guard code remains unchanged. M2 reuses secretProject/secret-fixture's registered bounded native owner for generic child, adding only a restricted synthetic-command environment input and stdin release. Existing CLI/Git callers retain sealed environments and original capture limits. Added cancellation/missing-close control through same owner; local test proves retained root while actual SIGTERM handler is held, then native close + output result before deletion. Helper consumers secrets.test, secrets-git.test remain unchanged and are rerun as owning regressions.

### rev-26 · 2026-10-26T11:45:41.620Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1329-source-2
commit: d4e20387ea69e3a3475ce529550f3403fc4a7d4a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear, A-12369, carrying A-12366 audit. M1 resolved by owning SECRET_USAGE row only. M2 generic child now uses shared pre-directory/beforeRemove bounded close/output owner; held-SIGTERM cancellation control asserts actual signal with absent close/result and retained root, then explicit stdin release/native exit0 ABORT_ERR before removal. Restricted six-name synthetic seam preserves final production filter and metadata positive controls; original 500-character redaction retained. All four correction files/owning helper consumers checked in-session, no reviewer execution. Correct local artifact A-12367 (not mistyped A-12368); reports remain local/capture-limited. C1 runtime marks await one exact-head mode-free configured result; Coordinator speech-stand-in decision/E-1311 actual launcher proof and separate integrated cover remain distinct.

### rev-26 · 2026-10-26T12:01:17.018Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1329-evidence-1
commit: d4e20387ea69e3a3475ce529550f3403fc4a7d4a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear, A-12381; original A-12379/run a26dab25 exits0 at source-2 d4e20387e. Independent audit:3409 ordinary passes including nested,459 files,10 separate actual load passes (two new resolver/file-only T1 cases each5/5). Changed T3 generic filter, actual fake-Claude launch/session and held-cancellation/root-retention cases pass once at .056359231/1.762679969/.036953781 s; no repetitions. Exact names/metadata/receipts and existing filter getter, fixture poison, CLI/secrets/help/docs assertions checked. No new case >=3 s; T3 selected added wall2.791 s excludes machine wait. T0/all T1/fallback all T2/changed T3/Web complete; broader T3/T4 deferred. Linux droplet Node24.21/Neovim0.12.5/HeadlessShell156.0.8078.4 v1248; life682 s/$0.0474. Host typecheck reused, diagnostics report-only including T3 ratchet/incomplete base. Coordinator faa116f6-approved generic speech stand-in only; E-1311 actual launcher and separate integrated cover/landing remain distinct.

Criteria: C1 verified.
