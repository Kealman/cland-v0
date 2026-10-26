---
id: T-1330
kind: task
title: Telegram token validation and every held secret registered with the remote redactor
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1308
blocked_by:
  - T-1328
topic: topic-1084
branch: t/T-1330-telegram-token-validation-and-every-held
created: 2026-10-26T07:54:42.430Z
updated: 2026-10-26T15:19:06.371Z
closed: 2026-10-26T15:19:06.371Z
---

## Summary

A Telegram token is validated before any URL is built, and every token and key the project holds is registered with the shared remote redactor (T-1326, hub/src/remote/redact.ts). So log lines, errors, journal records and artifacts written by the gateway and the speech seam print them masked.

## What to build

Validate a Telegram token against `^[1-9]\d{0,16}:[A-Za-z0-9_-]{24,}$` within 80 characters, refusing a malformed one without echoing it. A Discord token is opaque. On hub start and on reload, register every resolved secret with the redactor. Make the journal and artifact writes from the gateway and speech seam pass through it. Spec §3.3 and §3.12.

## Acceptance criteria

- [x] C1. A malformed Telegram token is refused with a reason that does not contain it, before any URL is built (test).
  - verified: rev-32 [reviewer] · run rev-20261026-1330-final · 2026-10-26T12:12:45.649Z · commit 2c4152d64db80afde95f19a1725144fa2007e95f
  - done: impl-1330 · 2026-10-26T14:20:58.145Z
  - verified: rev-32 [reviewer] · run rev-20261026-1330-final2 · 2026-10-26T14:38:11.023Z · commit 30701dd93a60e1546e42ce71f312f0c89b7601fb
- [x] C2. An error, log line, journal record and artifact produced through the gateway that carried a registered token or key contain it only masked (test).
  - verified: rev-32 [reviewer] · run rev-20261026-1330-final · 2026-10-26T12:12:45.649Z · commit 2c4152d64db80afde95f19a1725144fa2007e95f
  - done: impl-1330 · 2026-10-26T14:20:58.385Z
  - verified: rev-32 [reviewer] · run rev-20261026-1330-final2 · 2026-10-26T14:38:11.023Z · commit 30701dd93a60e1546e42ce71f312f0c89b7601fb

## Comments

### impl-1330 · 2026-10-26T11:31:57.232Z

Rule 20 consumer inventory before changes: resolveSecrets: hub/src/cli/secret.ts (list/set/unset), hub/src/hub/daemon.ts startup, secrets.ts set/unset; tests secrets.test.ts, secrets-git.test.ts, secret-input.test.ts, cli-imports.test.ts plus T-1329 override and T-1331 reload lanes. remoteRedactor: remote/gateway.ts default diagnostics; gateway.test.ts explicit function injection; remote/redact.test.ts; secrets-fixture.ts capture. Documentation consumers: hub/README.md project secrets/gateway; docs/agents/secrets.md; docs/agents/tests/hub-test-secrets.test.ts.md, hub-test-cli-imports.test.ts.md and hub-test-gateway.test.ts.md; implement skill. No frame/list schema changes; existing callable remoteRedactor and plain-function GatewayOptions.redact remain supported. Journal/artifact writers inspected: no remote/speech artifact producer exists yet, gateway denies artifact requests; scope decision requested from lead.

### rev-32 · 2026-10-26T11:44:06.531Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261026-1330-source
commit: b438cf7e4eaa37a765801fccf3dfa3e1796bc1b8
scope: full
findings: [{"severity":"medium","text":"M1 Standards: SECRET_USAGE adds validation/repair lines but frozen commands.json was not migrated. Existing cli-usage-compatibility and CLI help equality consumers therefore disagree. Update only the owning frozen SECRET_USAGE entry and retain the existing guard assertions.","file":"hub/src/cli/usage.ts","line":67},{"severity":"medium","text":"M2 Spec: value() rewrites object keys and every routing/discriminator string, and Gateway applies it to whole live frames. Discord secrets are deliberately opaque and may be `id`, `type`, `result` or `general`; registration can rename required keys, change result types or reroute/refuse ordinary requests. Preserve valid frame/correlation structure (or explicitly fail safely on a credential collision) while masking payloads; add short-secret protocol-collision controls using existing clients.","file":"hub/src/remote/redact.ts","line":31},{"severity":"medium","text":"M3 Spec: the supported plain-function redact branch creates an unrelated empty-registry value redactor. A caller supplying a closure that masks an exact registered credential gets that policy for #reason but not inbound/outbound frames or structured log fields; bare secret text can pass those new boundaries unmasked. Adapt the supplied policy for structured output, or make the required registry contract explicit with a safe compatibility path; add a plain-function exact-secret frame/output regression.","file":"hub/src/remote/gateway.ts","line":61},{"severity":"medium","text":"M4 Standards: the native Journal uses raw t.after(close) after tempProject/projectHub registered their shared directory cleanup. On failure/cancellation that earlier hook can remove the root before this later journal close/drain runs. Register journal ownership through the shared pre-directory cleanup before acquisition and prove an aborted/held write is drained before root removal, keeping native persistence assertions.","file":"hub/test/gateway-secrets.test.ts","line":107}]
finding_counts: {"high":0,"medium":4,"low":0}

Full source not clear; A-12368 records Standards2medium/Spec2medium. M1 frozen SECRET_USAGE consumer missing; M2 whole-frame key/discriminator/routing redaction corrupts valid opaque-secret collisions; M3 plain-function fallback does not apply caller's exact-secret policy to structured frames/output; M4 Journal raw t.after drains after shared directory cleanup on failure. Fix through existing guards/protocol/cleanup seams without relaxing final assertions. Approved direct reload API/native sink scope accepted; no future speech producer demanded. C2 failed; C1 runtime-unverified. A-12365 is local summary, not configured/Linux evidence. No Reviewer tests run. Fresh committed source review before verify.

Criteria: C2 failed (Whole-frame redaction corrupts protocol fields for accepted opaque secrets, plain-function output bypasses exact-secret policy, and native journal cleanup is outside pre-directory ownership.).

### impl-1330 · 2026-10-26T11:49:58.454Z

Review remediation consumer inventory extension: help block consumers are hub/test/fixtures/cli-usage/commands.json (only SECRET_USAGE migrated), cli-usage-fixture.ts frozenUsage(), cli-usage-compatibility.test.ts T1 and cli-help.test.ts T3. JSON .value preserves schema keys; Gateway now uses redactFrame which masks content and refuses routing/correlation collisions before dispatch/delivery. Plain-function GatewayOptions.redact uses that supplied callback for structured output. Journal fixture acquisition now registers shared onCleanup and beforeDirectories first, with held-native-write cancellation proof. Review findings M1–M4 covered by new/existing targeted tests before replacement review. No source merge from dev since first review.

### rev-32 · 2026-10-26T11:54:09.945Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261026-1330-source2
commit: 2447465aeef146a95b7afa252d4751f23fd1d23b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full corrected source clear; A-12372 carries baseline and all correction hunks. M1 only owning frozen SECRET_USAGE equals source; M2 protocol keys remain stable and routing collisions disable before dispatch/delivery; M3 previous plain-callable policy reaches structured content; M4 Journal shares pre-directory owner with held-write cancellation/drain/native-close control. Marker-prefix/overlap control added without relaxing old assertions. Standards/Spec no remaining findings. C1/C2 runtime-unverified pending same-head mode-free configured receipt. Approved direct reload API/native-sink scope remains accepted. Local A-12371 has targeted macOS native output; tool-return wall fields are not command wall measurements. Reviewer ran no tests.

### rev-32 · 2026-10-26T11:55:00.859Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261026-1330-evidence1
commit: 2447465aeef146a95b7afa252d4751f23fd1d23b
scope: evidence
findings: [{"severity":"medium","text":"Required T0 fails: dictionary membership must use Object.hasOwn or Map.has; intentional prototype checks need // cland-allow-in: reason (A-12373). New text-property discriminator does not pass the existing static guard; no droplet or runtime phase ran.","file":"hub/src/remote/gateway.ts","line":61}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-12374 quotes actual A-12373 failure for runfc0f2ac4. Host macOS typecheck/build passed; T0 static lint failed at gateway.ts:61, exit1/10.23s. No droplet, Linux, runtime test counts or T1/T2/T3/T4/Web coverage. C2 failed; C1 unverified. Use intended own-property capability check and retain strict guard/policy regressions; no shared-defect or infrastructure classification. Fresh committed source review before another mode-free run.

Criteria: C2 failed (Output-policy discriminator fails required dictionary-membership static lint at gateway.ts:61; no configured runtime evidence is available.).

### rev-32 · 2026-10-26T11:56:55.992Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261026-1330-source3
commit: 2c4152d64db80afde95f19a1725144fa2007e95f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-12377 carries complete baseline plus the one-file capability correction. Object.hasOwn and typeof function preserve enriched/plain-callable policy behavior without weakening dictionary lint. No remaining Standards/Spec findings. C1/C2 runtime-unverified; prior fc0f2ac4/A-12373 remains failed host-only evidence. Reported corrected local macOS checks are supplemental, not configured/Linux proof. Fresh exact-head mode-free receipt required; Reviewer ran no tests.

### rev-32 · 2026-10-26T12:12:45.649Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261026-1330-final
commit: 2c4152d64db80afde95f19a1725144fa2007e95f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-12384 audits original A-12383 exact-head run6fe279be. 3417 ordinary passes/459files,65 separate load passes (13×5), nofail/cancel/skip. C1 fixed value-free validation before setup and repair; C2 registration/isolation/rotation/marker masking, actual status/log/cleanup/frame/native journal/artifact bytes, wire collisions, previous plain-callable policy and held-write cleanup all have named base+5/5 receipts. HostMacT0 27.054s/exclusiongate14d5e2ff reused, Linuxc8lon1 Node24.21 Nvim.12.5 T1/allfallbackT2/Web, Headless156.0.8078.4/1248; noT3/T4/nativeprovider/QA claim. Life823s/$0.0571, budgets/tier/lint report-only135/61. Approved direct reload API/native sink scope accepted; T-1331 second-lander wiring remains integration work. Prior host failure retained. C1/C2verified, no remaining findings.

Criteria: C1 verified, C2 verified.

### impl-1330 · 2026-10-26T14:12:07.905Z

Authorized last-lander integration after T-1331: consumer inventory now includes daemon resolveRemoteSecrets closure (startup and ProjectConfiguration.prepareApply reload), ConfiguredGateway update/factory in remote/configuration.ts, config-set.test.ts, project-hub-lifecycle.test.ts, T-1329 secrets-resolution/secrets-environment tests and their guides. Existing resolver overlay API, file-only CLI reads, help fixture bytes and both tier entries must be retained. Added scope: use serveProject's explicit env at both resolutions and register final resolved values before reload gateway.update. Existing gateway protocol, native sink, previous-callable and short-secret controls remain unchanged.

### rev-32 · 2026-10-26T14:22:48.677Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261026-1330-source4
commit: 30701dd93a60e1546e42ce71f312f0c89b7601fb
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized integration delta clear; A-12427 carries prior full source and inspects overlays, wiring, docs/help/fixtures/tiers/new fixture consumers. Final file/env values validate after overrides, daemon explicit env is used at startup/reload, and same per-project registry registers before configured replacement construction/activation. Frozen SECRET_USAGE/CONFIG_USAGE equal source; existing masking/protocol/cleanup controls unchanged. No remaining Standards/Spec findings. C1/C2 need fresh exact-head configured runtime evidence; A-12383 remains historical at2c4152d64. A-12426 is local macOS targeted T1/T2+existing T3 output, no browser/provider/suite/load proof. Reviewer ran no tests. One mode-free task verify may proceed here; Coordinator rule6 separate.

### rev-32 · 2026-10-26T14:38:11.023Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261026-1330-final2
commit: 30701dd93a60e1546e42ce71f312f0c89b7601fb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head evidence clear; A-12433 audits original A-12432 run02f2305c at source4 head. 3433 ordinary passes/460files plus85 separate load passes (17×5), nofail/cancel/skip. C1/C2 named validation, all-four rotation/status/log/frame/native sinks, protocol/callable/cleanup controls pass; new explicit-env startup+reload, invalid-env pre-construction refusal and replacement-failure masking all base+5/5. Maxnew.238166039s, noallowance needed. HostMacT0 26.915s/exclusiongated8f579e2 reused, Linuxc8lon1 T1/allfallbackT2/fullWeb Headless156.0.8078.4/1248; noT3/T4/nativeprovider/QA/rule6claim. Life782s/$0.0543, runtime budgets/tier/lint report-only135/61. Old-headA-12383 remains historical. C1/C2verified; no findings; Coordinator rule6 separate.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-26T15:19:06.371Z

Merged 17cd89d26fa74c1bee330b69ba427bd29ea7a336 onto dev.
