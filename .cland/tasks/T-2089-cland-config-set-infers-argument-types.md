---
id: T-2089
kind: task
title: cland config set infers argument types from renderConfig(defaultConfig) rather than configKeys' explicit exemplar, so a commented-out default (test_timeout after T-2057) changes how its value argv is decoded
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by:
  - T-2057
topic: topic-1755
branch: t/T-2089-cland-config-set-infers-argument-types
created: 2026-11-24T14:03:57.276Z
updated: 2026-11-25T01:58:14.469Z
closed: 2026-11-25T01:58:14.469Z
---

## Summary

Found by T-2057's reviewer and reported by impl-2057 (head 7497df996). runConfig at hub/src/cli/config.ts:13 infers each key's argument type from the rendered default config, not from configKeys' explicit type exemplar. T-2057 comments out the default test_timeout, so that key now starts TOML-decoding its value argv: a literal value with embedded quotes is decoded as TOML. Normal values such as 120s and 17s still work through the string fallback. The reviewer rated this low impact and non-blocking.

## What to build

Make config set take every key's type from one shared vocabulary (configKeys' exemplar), independent of whether the rendered config writes the key.

## Acceptance criteria

- [x] C1. Setting test_timeout with a literal duration argv that contains embedded quotes decodes the same way as before T-2057, and the key's type comes from the shared exemplar (test, red before).
  - done: impl-2089 · 2026-11-24T19:50:55.154Z
  - verified: rev-40 [reviewer] · run rev-40-20261124-2089-final · 2026-11-24T21:06:30.798Z · commit e694062948184ecc8fee5a3a27f3bc03456fc5b5
  - verified: rev-40 [reviewer] · run rev-40-20261125-2089-linux-final · 2026-11-25T01:24:24.348Z · commit e694062948184ecc8fee5a3a27f3bc03456fc5b5

## Comments

### impl-2089 · 2026-11-24T19:03:25.550Z

Consumer search before change: rg configKeys|renderConfig across all tracked source, docs, .agents and QA (including web/nvim and all test tiers). configKeys consumers: init/config-set.ts validation; remote-docs.test.ts, skills-onboarding.test.ts, init-config.test.ts and their per-file docs. renderConfig production consumers: init/config.ts, init/config-set.ts, cli/config.ts, setup/steps/accounts.ts and harnesses.ts. All remaining matches are fixtures/tests and QA briefs constructing config text; renderConfig signature/output stays unchanged, so unaffected. Full filename inventory will accompany review evidence. Chosen authorized regression seam: existing T2 config-set CLI against projectHub, asserting quoted literal duration refusal and unchanged managed bytes; normal duration still accepted.

### impl-2089 · 2026-11-24T19:03:59.514Z

Red before fix on Node v24.21.0/macOS local, focused T2 test: `config set keeps quoted duration argv literal even when the default is commented out` failed with actual exit 0 !== expected 1; stdout `verification.test_timeout = "17s"; applies at the next hub start; restart the hub to apply`. After shared configKeyTemplate/configKeyExemplar extraction the exact test passes (1/1). The unquoted 17s control persists 17000ms with restart application, and quoted input leaves original bytes unchanged. No other tiers or broad checks claimed yet.

### impl-2089 · 2026-11-24T19:04:37.630Z

Merged origin/dev eb238252f before review. Full existing T2 config-set.test.ts passes 25/25 on Node v24.21.0, macOS local; no browser. configKeyTemplate now owns the explicit optional exemplar, configKeys and configKeyExemplar both consume it, runConfig consumes configKeyExemplar. renderConfig output and config.set wire shape remain unchanged. Frozen CONFIG_USAGE fixture searched: no usage change. Existing table/pool settings retain their TOML decoding; explicit optional string exemplars now remain literal like other strings. Awaiting Coordinator lint slot before typecheck and test:lint.

### impl-2089 · 2026-11-24T19:04:50.648Z

Full pre-change consumer filename inventory for configKeys|renderConfig (production paths and all test tiers, QA briefs, fixtures, docs and shipped skills):
hub/test/suite.test.ts
hub/test/discord-workbench-fixture.ts
hub/test/config-reload-component.test.ts
hub/test/approval-records.test.ts
qa/briefs/E-418.md
hub/test/remote-docs.test.ts
hub/test/doctor-remotes.test.ts
hub/src/cli/config.ts
hub/src/setup/steps/harnesses.ts
hub/src/setup/steps/accounts.ts
hub/test/web-authority.test.ts
hub/test/setup-hosts.test.ts
hub/src/init/config.ts
hub/src/init/config-set.ts
hub/test/suite-timeouts.test.ts
hub/test/discord-commands.test.ts
hub/test/users-docs-invite.test.ts
hub/test/skills-onboarding.test.ts
hub/test/telegram-rendering.test.ts
hub/test/suite-recovery.test.ts
hub/test/telegram-voice-fixture.ts
hub/test/telegram-voice-command.test.ts
hub/test/prepared-project.ts
hub/test/discord-render.test.ts
hub/test/discord-messenger.test.ts
hub/test/verification-workers.test.ts
hub/test/auth-mode.test.ts
hub/test/suite-wait-metrics.test.ts
hub/test/suite-accounting.test.ts
hub/test/doctor-users.test.ts
hub/test/web-cookie-secure.test.ts
hub/test/telegram-marks-fixture.ts
hub/test/suite-remote-budget.test.ts
docs/agents/tests/hub-test-remote-docs.test.ts.md
hub/test/setup-accounts.test.ts
hub/test/executor-safety-config.test.ts
hub/test/setup-remote-component.test.ts
hub/test/telegram-notices.test.ts
qa/briefs/E-1533-stage-1.md
qa/briefs/E-418-stage-2.md
hub/test/setup-pairing-component.test.ts
hub/test/demo.test.ts
hub/test/telegram-pacing.test.ts
hub/test/host-prepare.test.ts
hub/test/telegram-artifacts.test.ts
hub/test/discord-inbound-media.test.ts
hub/test/homebrew.test.ts
hub/test/gateway-secrets.test.ts
hub/test/telegram-pairing.test.ts
web/test/withdraw.test.ts
hub/test/user-invites.test.ts
hub/test/transport-config.test.ts
hub/test/remote-docs-pairing.test.ts
hub/test/launch-user.test.ts
hub/test/telegram-voice.test.ts
nvim/test/message-users-live.test.ts
hub/test/telegram-liveness.test.ts
nvim/test/remotes.test.ts
hub/test/suite-cancel.test.ts
qa/briefs/E-418-stage-1.md
hub/test/setup-remotes.test.ts
web/test/passkeys.test.ts
web/test/signin.test.ts
web/test/setup-signin.test.ts
qa/briefs/E-1537-stage-5.md
web/test/accounts.test.ts
web/test/sessions.test.ts
web/test/hosts.test.ts
hub/test/answer-users.test.ts
web/test/remotes.test.ts
web/test/message-users.test.ts
hub/test/config-set.test.ts
hub/test/artifact-user.test.ts
hub/test/suite-support.ts
hub/test/fixture-endpoints.test.ts
hub/test/init-config.test.ts
hub/test/hosts-docs-pool.test.ts
hub/test/telegram-mute.test.ts
hub/test/discord-messages.test.ts
hub/test/web-hosts-authority.test.ts
hub/test/plan-approval-reload.test.ts
hub/test/prepare-key.test.ts
hub/test/fakes/discord/hub.ts
hub/test/discord-cards-fixture.ts
hub/test/suite-coordinator.test.ts
hub/test/setup-flow.test.ts
hub/test/web-signin.test.ts
hub/test/setup-signin.test.ts
docs/agents/tests/hub-test-skills-onboarding.test.ts.md
hub/test/telegram-users.test.ts
hub/test/telegram-commands.test.ts
hub/test/telegram-inbound.test.ts
hub/test/host-pools-config.test.ts
hub/test/remotes-fixture.ts
hub/test/discord-artifacts.test.ts
hub/test/pairing-approval.test.ts
hub/test/suite-unit-fixture.ts
hub/test/telegram-polling-restart.test.ts
hub/test/hub-cards-voice.test.ts
hub/test/remote-cli.test.ts
hub/test/telegram-liveness-fixture.ts
hub/test/suite-soak.test.ts
hub/test/merge-batches.test.ts
hub/test/executor-run.test.ts
hub/test/telegram-messenger.test.ts
hub/test/tracker-async-component.test.ts
hub/test/discord-pairing.test.ts

Only cli/config.ts and init/config-set.ts migrate; all other entries retain unchanged renderConfig/configKeys contracts.

### rev-40 · 2026-11-24T19:49:52.040Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261124-2089-source
commit: 092cc0179d54ae8f42142ce18adc95037ad2faea
scope: full
findings: [{"severity":"medium","text":"New quoted-duration regression begins fixture acquisition without a separately bounded owner for the complete setup sequence; shared local cleanup/subprocess bounds do not supply a named setup-incomplete boundary.","file":"hub/test/config-set.test.ts","line":237}]
finding_counts: {"high":0,"medium":1,"low":0}

Source review not clear. M1 (medium) hub/test/config-set.test.ts:237: new regression has no separately bounded complete setup owner before fixture acquisition; tempProject/projectHub cleanup and CLI process timeout do not supply that boundary. Implementer confirmed no encompassing owner. Enroll the complete sequence before acquisition using shared setup/work ownership, preserving late joins, guarded cleanup and all existing assertions. Production shared-exemplar repair matches the spec; no other finding. C1 failed pending this test correction, fresh source review and configured exact-head evidence. Standards/Spec and evidence limitations: A-23089, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23089-t-2089-source-not-clear-at-092cc0179.md. No Reviewer runs.

Criteria: C1 failed (New regression lacks complete separately bounded setup ownership before acquisition (M1); correct and re-review before configured verification.).

### rev-40 · 2026-11-24T19:52:28.232Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-2089-source2
commit: e694062948184ecc8fee5a3a27f3bc03456fc5b5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; M1 resolved. Shared caseDeadlines ownership is installed before acquisition, scope.run owns the full body, named quoted duration fixture setup bounds the complete setup, immediate root adoption and step fencing preserve late-work joins before cleanup. All argv/refusal/unchanged-byte/accepted-value/parser-readback assertions retained. Production shared-exemplar fix unchanged and source-consistent with C1. No findings. C1 remains unverified until configured exact-head evidence arrives. Standards/Spec: A-23090 (artifact created immediately before this verdict). Local macOS Node24.21 T2 25/25 and static exits0 are implementer-reported targeted evidence, not a configured suite pass. No Reviewer runs.

### rev-40 · 2026-11-24T21:06:30.799Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-2089-final
commit: e694062948184ecc8fee5a3a27f3bc03456fc5b5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1 verified. Same-head configured run f3409dcd-b5f0-49a4-9aea-bcdd0bd924dc / A-23091 finished passed. Independently checked all 25 config-set base structured outcomes, exact quoted-duration case pass at line17000 and five distinct load finishes plus 5/5 receipt17049. Source-clear A-23090 establishes the shared exemplar and corrected complete setup ownership; all literal/refusal/unchanged-byte/accepted17s/parsed17000ms assertions retained. T0/T1/fallback all T2/selected241 T3 files/Web exit0 on noncached local Darwin arm64 Node24.21/Nvim0.12.5; Web Headless Shell1248 / Chrome for Testing156.0.8078.4. T4 unexecuted; one Linux-only prerequisite explicitly skipped, remaining process scope subject to merge-batch policy. Advisory budgets/lint remain report-only; no Linux or performance clearance claimed. No findings or Reviewer runs. Evidence: A-23092, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23092-t-2089-final-clear-at-e69406294.md.

Criteria: C1 verified.

### rev-40 · 2026-11-25T01:24:24.348Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-2089-linux-final
commit: e694062948184ecc8fee5a3a27f3bc03456fc5b5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final Linux evidence clear; C1 verified. Same-head run0f63e530-b5e1-4881-8a9b-fce5e62af6a9/A-23093 finished passed; exact canonical tree matches. All25 config-set bases pass; exact quoted-duration case structured pass17067 at0.844497692s, five distinct load pass finishes and5/5 receipt17164 (peak1.040344177s). T0/T1/fallback allT2/selected241T3 files1936passing identities/Web exit0; T4 unexecuted, remaining process scope merge-batch policy, explicit platform/binary prerequisites skipped. Noncached Linuxx64 droplet c8sfo2 workers2 Node24.21/Nvim0.12.5; isolated HeadlessShell1248/CfT156.0.8078.4. Advisory budgets remain report-only; no performance clearance. Earlier macOS A-23092 retained with its platform limits, initial not-clear source round retained historically. No findings or Reviewer runs. Audit A-23094: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23094-t-2089-linux-evidence-clear-at-e69406294.md.

Criteria: C1 verified.

### coord · 2026-11-25T01:58:14.469Z

Merged 073a7a2f4ef3a038f3c23087c13da746467b6483 onto dev.
