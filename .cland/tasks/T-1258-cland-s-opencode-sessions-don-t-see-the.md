---
id: T-1258
kind: task
title: cland's OpenCode sessions don't see the user's OpenCode Console login, so paid Go and Zen models are unavailable
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1280
blocked_by: []
topic: topic-1031
branch: t/T-1258-cland-s-opencode-sessions-don-t-see-the
created: 2026-10-24T19:27:25.100Z
updated: 2026-10-25T10:42:11.103Z
closed: 2026-10-25T10:42:11.103Z
---

## Summary

cland starts each OpenCode server with OPENCODE_DB=~/.local/share/cland/opencode/opencode.db. OpenCode keeps the Console login (the Go subscription or a Zen account) in its default database, so a cland session lists only opencode, google-vertex and openrouter, and every turn on opencode-go/deepseek-v4.1-flash fails with "Model unavailable" (impl-619b, 2026-10-24 19:18 and 19:25Z, hub.log turn-failed). The user's own `opencode run` works because it goes through their running OpenCode service. Neither `cland doctor` nor the launch refusal names the cause.

## Acceptance criteria

- [x] C1. A launch or turn on a provider that is connected in the user's default OpenCode store but missing from cland's database fails with a message naming the cause and the fix (the login or import command for cland's database), never a bare "Model unavailable" (test).
  - done: impl-1258 · 2026-10-25T10:07:59.057Z
  - verified: rev-34 [reviewer] · run rev-34-20261025-1258-final · 2026-10-25T10:35:05.906Z · commit fc9db0a4a455a5a9191f06d3476f0b3a561b9d6e
- [x] C2. `cland doctor` warns when the user's OpenCode store has Console credentials that cland's OpenCode database lacks, and docs say how to connect them (test).
  - done: impl-1258 · 2026-10-25T10:11:59.132Z
  - verified: rev-34 [reviewer] · run rev-34-20261025-1258-final · 2026-10-25T10:35:05.906Z · commit fc9db0a4a455a5a9191f06d3476f0b3a561b9d6e

## Comments

### coord · 2026-10-24T19:28:40.744Z

Workaround applied 2026-10-24 19:28Z at the human's instruction (ask 129efe72): `opencode auth export | OPENCODE_DB=~/.local/share/cland/opencode/opencode.db opencode auth import --standalone` through a pipe (nothing printed or saved); import must use --standalone, otherwise it writes to the background service's default store. After a relaunch, impl-619b's server listed opencode-go and its turns ran (session-usage at 19:28:35Z). A fix should do this sync, or point at it, automatically.

### impl-1258 · 2026-10-25T10:02:45.741Z

Pre-change consumer audit (rule 20): no wire shape, model catalog, refusal class, credential import or admission policy changes. Enrich existing OpenCode error text and existing opencode auth check only. Consumers: adapters/opencode.ts #launch/#apply → AdapterHost.turnFailed → hub turn-failure messages/events/logs, rendered as text by Web/Neovim; opencode state tracker keeps native outcome unchanged. doctor/toolchain probeHarness → cli/doctor checkToolchain and setup/machine, setup/steps/logins (reads existing auth row verdict/fix). Tests: doctor-harness-probe (T1), doctor/setup-flow/opencode-native/opencode-launch-policy (T2), doctor-cli/opencode-adapter/opencode-database/models (T3), no T4 consumer matched. QA: E-613 M5b and E-424 D6/D7/R4 retain existing row names, severity and database behavior. Docs/skills: hub README auth table/adapter section, site crew/install/quickstart, implement/setup instructions; startup probes/persisted readers have no parsing of these diagnostic strings. No client schema migration required; old-hub compatibility unchanged. Agreed seams per launch brief: scripted OpenCode native failure via public hub receipt (T2) for C1; injected harness auth command boundary probeHarness (T1) for C2.

### rev-26 · 2026-10-25T10:10:30.068Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261025-1258-source-1
commit: dc14f740c6517fb9f6cf56cc910135351d3ceae1
scope: full
findings: [{"severity":"medium","text":"M1: production DOCTOR_USAGE adds the auth comparison line but the frozen owning row is unchanged. Existing cli-usage-compatibility deep equality and cli-help full output equality will fail. Reproduce existing guard red, update only DOCTOR_USAGE frozen command row per documented help-change procedure, retain equality/template/order and capture green; inventory these consumers.","file":"hub/test/fixtures/cli-usage/commands.json","line":20}]
finding_counts: {"high":0,"medium":1,"low":0}

Full audit complete, A-11687. Standards1medium M1; Spec0additional. Launch/native turn diagnostics, selected account database quoting, standalone default/cland provider-ID comparison/incomplete outcomes and docs/tests reviewed; no other blockers. No auto credential import or schema/policy change. A-11678 local summary remains supplementary; retain original stdout/exits/source/timing limits. Coordinator9fd3a8d2 independently confirms T-1285 and six-variable-unset local doctor receipt; label16/19 ordinary vs19/19 isolated. Hold verify, correct fixture/test-first then fresh pushed-head full source review.

Criteria: C2 failed (M1: doctor help change lacks its owning frozen fixture migration, guaranteeing existing help compatibility failures.).

### impl-1258 · 2026-10-25T10:10:51.893Z

Source review rev-20261025-1258-source-1 found missed help compatibility consumers: hub/test/cli-usage-compatibility.test.ts, hub/test/fixtures/cli-usage/commands.json (doctor row), and full-help equality assembly from CLI_USAGE_ORDER/template. Correcting the owning frozen doctor row only after reproducing red. No template, order, guard or wire shape changes. Initial targeted run raw stdout remains in session tool receipts; it was not saved as an on-disk raw log. Correction will save native stdout/stderr and exit directly without reconstruction or transcription reruns.

### rev-26 · 2026-10-25T10:14:52.356Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1258-source-2
commit: fc9db0a4a455a5a9191f06d3476f0b3a561b9d6e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full corrected source clear; A-11704 carries A-11687 full audit. M1 resolved: sole correction is frozen DOCTOR_USAGE row, exact production equality confirmed; template/order/guards/production unchanged. Original A-11696 red0/1 and2/3 exits1 -> green1/1 and3/3 exits0, local macOS timing/source limits retained. C1/C2 done restored; both runtime marks await exact-head ordinary mode-free configured evidence. Initial A-11678 summary not substituted for raw receipts; T-1285 isolated local doctor remains explicitly Coordinator-authorized/different from ordinary16/19. No other findings; no integration/live login/QA/publication claim.

### rev-34 · 2026-10-25T10:35:05.906Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1258-final
commit: fc9db0a4a455a5a9191f06d3476f0b3a561b9d6e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear at unchanged fc9db0a4, carrying source-2/A-11704. Run 3de108c3 / A-11732 passed T0/all T1/fallback all T2/Web: 3119 ordinary passes, no failures/cancellations/skips/todos, Linux x64 droplet, Node 24.21.0, Neovim 0.12.5, Chrome Headless Shell 156.0.8078.4 (v1248). T3/T4 not run; budget/lint warnings report-only. Independently checked base pass records and 5/5 repetitions for both unavailable-model launch/turn cases and all three new doctor credential comparison cases, plus ordinary doctor database/login and frozen compatibility/full-help guards. Source assertions verify cause/fix, exact selected DB, command quoting, public event, credential-only provider IDs and incomplete comparisons; source2 establishes docs. C1/C2 verified. T-1285 isolated local evidence remains separate; no live Console login/import or clean-machine claim. Standards: no remaining findings. Spec: no findings. No Reviewer rerun.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T10:42:11.103Z

Merged 98c60b8cca9d6582eabd28cb2a116780dec915d4 onto dev.
