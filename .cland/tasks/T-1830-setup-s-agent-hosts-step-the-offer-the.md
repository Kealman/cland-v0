---
id: T-1830
kind: task
title: "Setup's agent-hosts step: the offer, the roles and the `agents` pool"
state: open
status: ready
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1828
topic: topic-1510
branch: t/T-1830-setup-s-agent-hosts-step-the-offer-the
created: 2026-11-12T10:07:21.555Z
updated: 2026-11-14T16:43:32.334Z
---

## Summary

`cland setup` gains an optional agent-hosts step after the remote steps and before the Aide. It is offered with No as the default, and `--yes` alone does not enable it. On the human's yes, it checks the provider token's presence in the hub's environment, places the chosen roles on the `agents` pool, and writes the pool with its defaults to config. Without a terminal it reports what is open.

## What to build

Setup's rules: check first, ask only about what is missing, one result line per check. The step:
- **Detects** a configured `agents` pool, the roles placed on it, and the token's presence and fingerprint from T-1828. A configured pool whose placed roles have ready logins prints `ok` and asks nothing.
- **Offers** "Set up agent hosts?", default No. A decline prints `skip`. `--yes` takes that default, with or without a terminal: the step prints `skip` and writes nothing.
- **Token.** With the token absent, the step prints `open` naming `DIGITALOCEAN_TOKEN` in the hub's environment and a hub restart, and goes no further. It never asks for, prints or stores the token.
- **Roles.** It asks which roles to place on the pool (question 1).
- **The pool.** A second yes names the pool's size, `min_hosts` and the price per hour that the hub's provider declares, since `min_hosts = 1` starts an always-on host (questions 2 and 20). On that yes it writes `[hosts.agents]` with the defaults through the config-set path, writes `[<role>.launch] pool = "agents"` for the chosen roles, and reloads the hub.
- **Without a terminal** it writes nothing and prints `open` with the exact `cland config set` commands.

T-1831 adds the image and the first logins.

## Acceptance criteria

- [x] C1. With a scripted prompter, the agent-hosts step runs after the remote steps and before the Aide, and its offer defaults to No (test).
  - done: impl-1830 · 2026-11-14T14:33:37.094Z
  - verified: rev-36 [reviewer] · run rev-36-1830-final-1 · 2026-11-14T16:43:32.086Z · commit a02ba45be50118d3fdd309977c76eaab5de1a776
- [x] C2. `--yes`, with or without a terminal, leaves the step `skip` with no pool written. Without a terminal and without `--yes`, a project with no `agents` pool prints `skip` with the exact `cland config set` commands in its detail (as the optional Discord step does), and a partly configured pool prints `open` with them; neither writes anything (test).
  - done: impl-1830 · 2026-11-14T16:16:08.598Z
  - verified: rev-36 [reviewer] · run rev-36-1830-final-1 · 2026-11-14T16:43:32.086Z · commit a02ba45be50118d3fdd309977c76eaab5de1a776
- [x] C3. On yes with the token present in the hub's environment, the step shows the fingerprint, writes `[hosts.agents]` with its defaults and `[<role>.launch] pool = "agents"` for the chosen roles, and reloads the hub (test).
  - done: impl-1830 · 2026-11-14T14:33:37.639Z
  - verified: rev-36 [reviewer] · run rev-36-1830-final-1 · 2026-11-14T16:43:32.086Z · commit a02ba45be50118d3fdd309977c76eaab5de1a776
- [x] C4. The pool is written only after a yes that names its size, `min_hosts` and declared price per hour, and a no there writes nothing (test).
  - done: impl-1830 · 2026-11-14T14:33:37.849Z
  - verified: rev-36 [reviewer] · run rev-36-1830-final-1 · 2026-11-14T16:43:32.087Z · commit a02ba45be50118d3fdd309977c76eaab5de1a776
- [x] C5. With the token absent, the step prints `open` naming `DIGITALOCEAN_TOKEN` and the hub restart, writes nothing, and no line, narration or `--json` report contains a token (test).
  - done: impl-1830 · 2026-11-14T15:57:04.254Z
  - verified: rev-36 [reviewer] · run rev-36-1830-final-1 · 2026-11-14T16:43:32.087Z · commit a02ba45be50118d3fdd309977c76eaab5de1a776
- [x] C6. A project whose `agents` pool is configured and whose placed roles have ready logins prints `ok` and asks nothing (test).
  - done: impl-1830 · 2026-11-14T15:57:04.459Z
  - verified: rev-36 [reviewer] · run rev-36-1830-final-1 · 2026-11-14T16:43:32.087Z · commit a02ba45be50118d3fdd309977c76eaab5de1a776

## Blocked by

- T-1828

## Notes

- Hot files: `hub/src/setup/steps/hosts.ts` (new), `hub/src/setup/runner.ts` (the step order), `hub/src/setup/types.ts`, `hub/src/setup/hub.ts` (the hub reads), `hub/src/cli/setup.ts`, `hub/test/setup-prompter.ts`.
- Tests: new `hub/test/setup-hosts.test.ts` (T2, scripted prompter, `projectHub`, the fake DigitalOcean API or the fake host provider per question 12); `hub/test/setup-flow.test.ts` order updated.
- Serves epic C5.

## Comments

### impl-1830 · 2026-11-14T14:23:48.870Z

Rule 20 consumer sweep: setup runner/SetupReport and CLI rendering (hub/src/setup/runner.ts, types.ts, cli/setup.ts); setup flow/CLI/handover/remotes/hub fixtures and scenarios (hub/test/setup-*.ts, hub/test/scenarios/setup.test.ts); docs/hub/cland-setup.md, hub/README.md, cli/usage.ts and usage fixture; onboarding skill consumes the resulting project, no report parser; doctor, Neovim and web do not consume SetupReport or step list. Existing host pool and role launch parsers/setters retain shapes and defaults; consumer inventory for a possible provider query extension: protocol.ts, shared/wire/index.ts, dispatch.ts, web-authority.ts, host/provider-tokens.ts, host-provider-tokens.test.ts, docs/hub/host-providers.md, docs/agents/host-agent.md, hub/README.md, QA E-1532, E-1533-stage-2, E-1535-stage-1/2/3, E-1537-stage-2. Existing no-filter host.providers reply and previous-wire regression will be preserved; no Neovim/web consumer found.

### impl-1830 · 2026-11-14T14:25:10.157Z

Coordinator decisions: use additive host.providers provider=digitalocean (no provider calls; legacy unfiltered reply unchanged). Pool confirmation uses spec 2026-10-31 declared USD 0.0714/h for s-4vcpu-8gb; editable/stored price is out of scope. Unknown-size price stays open without writes. Role placement calls existing role.launch -> setRoleLaunch (cland role launch <role> --pool agents); pool writes use config.set. Running hub restart required after landing before live use of provider filter.

### rev-36 · 2026-11-14T14:41:29.252Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1830-source-1
commit: f4081df04563a991dffe2d58e71bbc40e62cf218
scope: full
findings: [{"severity":"medium","text":"C6 uses aggregate harness capacity, ignoring role.launch.account. A role pinned to missing/signed-out account A is incorrectly ok when same-harness B is usable. Use shared role-scoped launch eligibility and cover pinned-account refusal.","file":"hub/src/setup/steps/hosts.ts","line":30},{"severity":"medium","text":"Nonterminal/early-failure guidance uses defaultPool+implementer before applying existing pool/role values, recommending replacement of custom/fake/min_hosts=0 settings by paid DigitalOcean defaults. Preserve current values and derive only missing repair commands; cover configured-pool guidance.","file":"hub/src/setup/steps/hosts.ts","line":21},{"severity":"medium","text":"Configured-ready branch returns ok before querying hub token metadata. DigitalOcean pool with ready logins but missing hub DIGITALOCEAN_TOKEN bypasses C5 open/restart guidance. No approved exemption; check token before ok and add configured missing-token control.","file":"hub/src/setup/steps/hosts.ts","line":28}]
finding_counts: {"high":0,"medium":3,"low":0}

Source not clear; Standards 0 / Spec 3 medium. A-19383 records all confirmed gaps, intended scope/price decisions and unaffected consent/filter/setter paths. Fix C2/C5/C6 together, retain default-No/--yes, previous reply, shared eligibility and final assertions; request fresh committed source review before verify. A-19381 original excerpts and A-19380 single retained snapshot read with evolving-candidate/overwritten-boundary/per-file limits; no provenance-only rerun. No configured run or full native/browser/Linux/QA pass; after-stage QA remains on dev. No Reviewer execution/delegation.

Criteria: C2 failed (Nonterminal/exception repair commands can overwrite existing pool/role settings with defaults rather than preserve the configured project.), C5 failed (Configured pool plus ready-capacity branch bypasses missing hub token detection and incorrectly reports ok.), C6 failed (Aggregate harness capacity can report ready despite the placed role's pinned account being missing or signed out.).

### impl-1830 · 2026-11-14T14:42:39.343Z

Review-fix contract sweep (before change): host.status opt-in roleLogins true adds roleLogins map; T-1829 adds freeLogins per pool. Shared eligibility is LoginRecords.freeCount in host/logins.ts, optional account extended here after T-1829 landing. Consumers: hub CLI host/login; setupHub; host/status.ts and dispatch/protocol/web-authority; shared/wire; host-secret-admission, host-spend/status/stop, login-capacity-list/login-remove, web-authority-unit/authority/web-hosts-authority tests; web hosts/hosts-view tests. QA briefs E-1532-stage-6, E-1533/stage-3, E-1534/stage-1/2/3, E-1535/stage-1/2/3/4, E-1537-stage-1/2; docs host-provider/status-stop/logins/host-agent and per-test guides. No Neovim production caller of host.status found. Plain request/reply stays unchanged by roleLogins; older opt-in reply without map stays unknown/open. All unaffected callers retain default request; new setup consumer opts in. Previous-shape regression retained. Broader consumers deferred unless executed in named receipt.

### rev-36 · 2026-11-14T16:03:30.989Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1830-source-2
commit: a2506e8b84657d3da75f639bde030aef84aecc9e
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear after the Coordinator-authorized dev merge and consolidated C2/C5/C6 corrections. Standards: 0 findings. Spec: 0 findings. Existing-pool guidance preserves settings, hub token presence precedes configured-ready success, and role-account readiness reuses shared account-aware freeCount through an opt-in host.status map while preserving plain replies. A-19397 records the complete review and A-19396 candidate execution/inventory limits, including the Coordinator-accepted T-1806 residue. All criteria remain unverified pending exact-head mode-free verification and named completion receipts. No Reviewer execution; affected QA remains after-stage on dev.

### rev-36 · 2026-11-14T16:10:44.601Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1830-evidence-1
commit: a2506e8b84657d3da75f639bde030aef84aecc9e
scope: evidence
findings: [{"severity":"medium","text":"Configured run ed27164e fails two aggregate exit assertions (lines 164/184: actual 1, expected 0) and setup-remotes.test.ts:99's old ordered suffix. Migrate existing setup consumers to intentional nonterminal agent-hosts=open/exit 1 and the added step while preserving favourite/install/trust/secret assertions. Include the identified unexecuted component/scenario consumers; obtain fresh source review and same-head verification.","file":"hub/test/setup-favourite.test.ts","line":164}]
finding_counts: {"high":0,"medium":1,"low":0}

Final evidence not clear. A-19398 has three named T1 failures; T0 passed, T1 failed, later T2/T3/Web unexecuted. A-19399 records exact failures, claimant-confirmed migration, additional unexecuted consumer scope, platform/report-only distinctions and retained source/candidate limits. C2 failed; no criteria verified. Source clearance A-19397 remains historical source evidence, not configured success. Release pin for consolidated test-only correction, fresh committed source review and same-head verification. No Reviewer execution; affected QA remains after-stage on dev.

Criteria: C2 failed (Configured integration evidence is red: existing setup consumers retain old no-open exit and step-order assumptions. T2/T3/Web were not completed.).

### coord · 2026-11-14T16:10:56.518Z

C2 amended by the Coordinator 2026-11-14 16:11Z (recommended-behaviour choice under the human's standing yes): an unconfigured optional step without a terminal prints skip, not open, matching the Discord step (hub/src/setup/steps/discord.ts:32). Otherwise every unattended cland setup would exit 1 (runner.ts:44 counts open as incomplete). Found by verify ed27164e (favourite tests expected exit 0).

### rev-36 · 2026-11-14T16:18:07.863Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1830-source-3
commit: a02ba45be50118d3fdd309977c76eaab5de1a776
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear under amended C2 / Coordinator 573f205e: untouched nonterminal hosts skip with exact commands in detail; partial pools remain open; no writes. Original favourite exit-zero assertions remain unchanged. Ordered T1/T2/PTY consumers include the added default-No hosts step while retaining all existing secret/product/lifecycle assertions. Standards 0 / Spec 0. A-19402 records the consolidated source review, A-19401 candidate completion/source limits and seven exact zero-delta inventory pairs. Previous configured run A-19398 remains red; A-19400 supersedes A-19399's old repair advice. No criteria verified until fresh same-head mode-free verification with named criterion and changed-T3 receipts. Full remaining T3/T4 and affected after-stage QA remain separate. No Reviewer execution.

### rev-36 · 2026-11-14T16:43:32.087Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1830-final-1
commit: a02ba45be50118d3fdd309977c76eaab5de1a776
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1–C6 verified. A-19403 / cbe2ae48 passed 6290/6290 with zero fail/cancel/skip/todo; independently checked named base/load outcomes, repaired favourite/remotes/component consumers and changed native setup scenario (one base pass, 14.375862916 s). Existing E-880 27.4 s allowance covers that scenario per Coordinator b7bd002c; report-only notices retained. A-19406 records full criterion/source/native/provenance limits; A-19405 conservatively reconciles all 976 manifest paths: 695 positive base file receipts, 264 T3 and 17 T4 deferred, no missing lower/Web. Linux x64 Node24.21, Headless Shell1248/CfT156.0.8078.4; no cache/skips; billing unavailable/T-1857. Previous red A-19398 and qualified local A-19401/T-1806 evidence retained. Full remaining T3/T4 and affected after-stage QA on dev are separate. No Reviewer execution; hub/Coordinator owns ready and landing.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.
