---
id: T-1502
kind: task
title: Setup's Discord re-run reports a paired remote as open while the gateway reconnects
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
regression_of: T-1371
topic: topic-1265
branch: t/T-1502-setup-s-discord-re-run-reports-a-paired
created: 2026-10-31T06:16:04.978Z
updated: 2026-10-31T06:59:40.708Z
closed: 2026-10-31T06:59:40.708Z
---

## Summary

A non-interactive re-run of `cland setup` reports the paired Discord remote as `open` rather than `ok` if it samples the gateway while it reconnects. This reddened the 0.3.1 release cover 70e41a22 (A-14832, shard-2) at e5b310a78. The failing test was `setup-remote-component.test.ts` "Discord setup checks application before enabling and pairs through native /cland pair (repair=false)", at line 183 (`'open' !== 'ok'`).

## Evidence

- Linux droplet shard-2 at e5b310a7882d7354118984e7137e586b071b45e0. Disk fsync was 25.86 ms on shard-2 against 7.59 ms on shard-1. In the same shard, Discord and Telegram tests ran 2–10× slower than baseline: discord-messenger 1.5 → 14.2 s, telegram-inbound 1.5 → 13.3 s, discord-cards 9.3 → 21.1 s.
- The failing test passed 5/5 alone on macOS at the same head (15 passes in total).
- In `hub/src/setup/steps/discord.ts`, the up-front `ok` check needs `connection === 'connected'` at a single instant. The interactive path already waits up to 10 s while the connection is `disconnected`. The non-interactive path does not wait, so a transient non-connected state while the gateway is paired yields `open`.

## Acceptance criteria

- [x] C1. A test that holds the paired Discord gateway in a non-connected state and connects it within the bound gets `ok` from the non-interactive setup re-run. A gateway that stays down past the bound still gets `open`. Both outcomes are on fake clocks or fake gateways, not wall-clock sleeps.
  - done: impl-1502 · 2026-10-31T06:19:54.684Z
  - verified: rev-26 [reviewer] · run rev-20261031-1502-evidence-1 · 2026-10-31T06:52:58.580Z · commit 5265a69123df8d707d1279aabe8f45dc54cb9762
- [x] C2. The existing `setup-remote-component.test.ts` Discord cases pass 10/10 alone, and the Telegram counterpart is checked for the same single-sample pattern and fixed or ruled out in the item's notes.
  - done: impl-1502 · 2026-10-31T06:19:54.779Z
  - verified: rev-26 [reviewer] · run rev-20261031-1502-evidence-1 · 2026-10-31T06:52:58.580Z · commit 5265a69123df8d707d1279aabe8f45dc54cb9762

## Comments

### impl-1502 · 2026-10-31T06:17:29.216Z

Red-first receipt on macOS arm64, Node 24.21.0: setup-remotes.test.ts 23 pass / 4 fail. Both Discord and Telegram recovery=true fail with 'open' !== 'ok'; held-down controls fail 'readiness must be re-read after the initial disconnected receipt'. This confirms Telegram has the same sample pattern; fix both paired reruns. Consumer search: setup runner imports discord/remotes steps; setupHub consumes remote.status with optional remotes callback. Consumers searched via SetupHub, remote.status, connection, pairing and step imports across hub/web/nvim/shared tests, QA and skills. No wire/schema change: helper only re-reads unchanged remote.status; prior-wire inactive-token regression stays. Existing Discord interactive readiness loop will share the same helper. Public setup report verdicts and optional remotes compatibility remain unchanged.

### impl-1502 · 2026-10-31T06:19:41.059Z

Consumer inventory (rule 20; no shared wire change):
docs/agents/session-permissions.md
shared/wire/index.ts
docs/agents/pairing.md
hub/src/remote/gateway.ts
.agents/skills/implement/SKILL.md
qa/briefs/E-1313.md
web/test/pairing.test.ts
web/test/remotes.test.ts
docs/agents/tests/web-test-pairing.test.ts.md
docs/agents/tests/hub-test-telegram-messenger.test.ts.md
docs/agents/tests/hub-test-remote-workbench.test.ts.md
hub/src/hub/dispatch.ts
docs/agents/tests/hub-test-discord-messenger.test.ts.md
hub/README.md
docs/agents/tests/hub-test-remote-docs-pairing.test.ts.md
docs/agents/tests/hub-test-setup-remotes.test.ts.md
hub/src/hub/web-authority.ts
docs/agents/tests/hub-test-setup-pairing-component.test.ts.md
hub/test/remote-state.test.ts
hub/test/web-area-state.test.ts
hub/test/discord-workbench-fixture.ts
hub/test/web-authority.test.ts
hub/src/cli/remote.ts
hub/src/cli/setup.ts
hub/test/doctor-remotes.test.ts
hub/test/discord-commands.test.ts
hub/src/hub/daemon.ts
hub/test/discord-messenger.test.ts
hub/test/setup-pairing-component.test.ts
hub/test/telegram-cards.test.ts
hub/test/setup-remote-component.test.ts
hub/test/remote-workbench.test.ts
hub/test/remote-docs-pairing.test.ts
hub/test/telegram-graceful-restart.test.ts
hub/test/setup-hub.test.ts
hub/test/telegram-rendering.test.ts
docs/agents/tests/index.md
hub/test/telegram-pacing.test.ts
hub/test/discord-cards.test.ts
hub/test/setup-remotes.test.ts
hub/test/telegram-mute.test.ts
hub/src/setup/handover.ts
hub/src/setup/steps/remotes.ts
hub/src/setup/steps/discord.ts
hub/src/setup/types.ts
hub/src/setup/hub.ts
hub/src/setup/pairing.ts
hub/src/protocol.ts
hub/src/doctor/remotes.ts
hub/test/remote-state-migration.test.ts
docs/agents/tests/hub-test-telegram-inbound.test.ts.md
hub/test/fakes/legacy-remote-hub.ts
hub/src/doctor/project.ts
hub/test/fakes/discord/hub.ts
hub/test/remote-cli.test.ts
docs/agents/secrets.md
hub/test/telegram-liveness-fixture.ts
docs/agents/tests/hub-test-setup-remote-component.test.ts.md
hub/test/telegram-polling-fixture.ts
hub/test/telegram-messenger.test.ts
hub/test/scenarios/remotes.test.ts
hub/test/tiers.json
hub/test/fixture-endpoints.test.ts
docs/agents/tests/web-test-remotes.test.ts.md
hub/test/setup-handover.test.ts
hub/test/discord-cards-fixture.ts
hub/test/telegram-inbound.test.ts

All remote.status protocol, persisted readers, raw clients and prior-wire fixtures are unaffected: fields and row membership stay unchanged. Only setup/steps/{discord,remotes}.ts sample readiness differently via shared setup/readiness.ts; runner and setupHub public interfaces remain intact. Relevant help, README, pairing/test docs and implement skill updated. A-14835 records deterministic red/green receipts and native T2 repetitions. Final focused results: setup-remotes.test.ts 27/27; setup-remote-component.test.ts 7/7 in each of 10 sequential runs (Discord three generated repair cases each 10/10). npm run test:lint exit 0: report-mode 122 findings / 59 files, 0 refusals; existing CLI install import diagnostic explicitly names T-1484. No full local suite, browser, load, T3 or T4 run.

### rev-26 · 2026-10-31T06:22:58.524Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1502-source-1
commit: 1ed599f59bcbd5f612613408e157131ce737c67f
scope: full
findings: [{"severity":"medium","text":"M1: new SETUP_USAGE wording lacks owning frozen commands.json migration; unchanged compatibility/native help guards fail. Retain red/green and update only owning metadata.","file":"hub/src/cli/usage/setup.ts","line":2},{"severity":"medium","text":"M2: new runner work/result is not pre-owned/cancelled/joined before root removal on early failure; sampled setup receipt unbounded separately and fixed microtask turns are not producer receipts. Compose shared setup/observation/abort/join ownership and omitted/aborted/early-failure controls, retain final assertions.","file":"hub/test/setup-remotes.test.ts","line":354},{"severity":"medium","text":"M3: deadline only checked before sleep/read; late connected read can settle ok after10s and existing3s request can exceed advertised wait. Bound reads by remaining budget, fence late success, cancel/join admitted reads and prove held deadline/abort controls.","file":"hub/src/setup/readiness.ts","line":9}]
finding_counts: {"high":0,"medium":3,"low":0}

A-14836: consolidated full source not clear M1–M3. Shared messenger policy/optional old-wire compatibility and inventory reviewed; proposed working-tree fixes not in frozen head. C1/C2 remain runtime-unverified. Complete all fixes and fresh pushed-head source review before configured verify. Preserve original10component-run generated-case/native-exit output for final C2 audit, no evidence-recreation rerun needed.

### impl-1502 · 2026-10-31T06:25:10.599Z

Source review M1-M3 fixed; evidence A-14838 and original native ten-run output A-14837. Additional help consumers: cli-usage-fixture.ts, fixtures/cli-usage/{commands,exports}.json, cli-usage-compatibility.test.ts, cli-help.test.ts, cli-command-help.test.ts. Only the owning setup fixture row migrated. SetupHub.remotes gains an optional timeoutMs argument; no-arg legacy fakes/clients remain compatible, native setupHub forwards budget to existing socket exchange. Shared wire/persisted formats stay unchanged. Revised local macOS arm64 Node 24.21.0 checks: 33/33 focused setup tests; 7/7 native component once after changes; unchanged help guards 1/1+5/5+18/18; typecheck exit0; lint exit0 (report-only122 findings,0 refusals). No dev merge since first source review under rule11.

### rev-26 · 2026-10-31T06:27:14.543Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1502-source-2
commit: 070e094d87cb1b2418703278063a855f346e3478
scope: full
findings: [{"severity":"medium","text":"M2 remains: copied receipt/runnerOwner introduces unbounded allSettled drainage instead of shared setup/observation/drain owners. Aborted control never injects a distinct setup abort; early-failure catches synthetic throw then ordinary dispose. Compose shared owners with real-t emergency release/join before owner joins, hold actual admitted work, retain positive root-retention/final completion/removal assertions.","file":"hub/test/setup-remotes.test.ts","line":333}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14839: source2 not clear for remaining M2 only. M1 frozen help metadata and M3 production remaining-budget/late-read/signal fence closed. Preserve public step seam, native/semantic assertions and optional remotes compatibility. C1/C2 runtime-unverified; A-14837 original ten initial-runtime component runs remain separate from one revised7/7. Final C2 needs10/10at final source/tree or explicit carry disposition; do not relabel old receipts. Complete M2 and fresh pushed-head review before configured verify.

### impl-1502 · 2026-10-31T06:30:08.376Z

Final source/tree d192cef8d62e3c8b1997cc94bc3b5ce1287406ec / 2f5afa543061e9d111f16fb24e41c67ed81d6181: remaining M2 replaced local polling/owner policies with shared caseDeadlines/until/within composition. Pre-registered real-t emergency release/join precedes shared drainage and directory hooks; actual held-read omitted/external-abort/assertion-failure controls preserve root retention, joined setup and final removal assertions. macOS arm64 local Node24.21.0 focused33/33; fresh ten sequential native component runs 7/7 each, raw generated names/native exits preserved in A-14840. These fresh runs replace earlier pre-deadline-fix C2 evidence; final tree unchanged since execution. Typecheck and lint exit0; lint122 report-only findings/0 refusals. No full local suite/browser/T3/T4.

### rev-26 · 2026-10-31T06:32:09.696Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1502-source-3
commit: d192cef8d62e3c8b1997cc94bc3b5ce1287406ec
scope: full
findings: [{"severity":"medium","text":"M2 remaining portability: until scales1000ms by default load factor2 on droplet, but omitted observer493–496 ticks/expects1000ms. It stays pending/cancels under configured load2. Make controlled observation clock budget explicit or derive scaling, preserve held abort/early-failure/root assertions and prove full focused file load2.","file":"hub/test/setup-remotes.test.ts","line":363}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14841: source3 not clear only for fake-clock observation scaling. Substantive shared ownership/release-before-join correction closed; M1/M3 remain closed, production unchanged. A-14840 independently10runs×7native cases pass at final-production source/tree2f5afa, original labels retained; no need repeat those unrelated captures for a test-only scaling correction. C1/C2 runtime-unverified pending final-head configured run. Fresh pushed-head source review before verification.

### rev-26 · 2026-10-31T06:33:10.374Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1502-source-4
commit: 5265a69123df8d707d1279aabe8f45dc54cb9762
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14843: full source clear; M1–M3 closed. Sole successor change explicit loadFactor1 aligns deliberately controlled1000ms observer with omitted-control tick/receipt under droplet/load2. Shared pre-owned abort/release/join, actual held failure/root assertions and production remaining-budget/late-response fence retained. A-14842 local33/33withload2; typecheck/lint0reported, no full/Linux claim. Original A-14840ten×7nativepasses retains tree2f5afa unchanged runtime closure, not relabelled. C1/C2 done/runtime-unverified. Submit one mode-free configured verify at frozen5265a6912, then original-record final review.

### rev-26 · 2026-10-31T06:52:58.580Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1502-evidence-1
commit: 5265a69123df8d707d1279aabe8f45dc54cb9762
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record evidence clear; C1/C2 verified. Independent audit in A-14847 of original configured run 70f8825a-c5a0-4b7e-9920-026abb3bfe7a / A-14846: all 5,301 progress IDs pair without duplicates or missing/mismatched boundaries; 4,433 ordinary tests pass, plus 175 separately scoped load-gate passes, zero adverse outcomes. T0/T1/all fallback T2 including Neovim/Web completed; T3/T4 unexecuted. Linux x64 droplet c-8 lon1, Node24.21.0; actual isolated Headless Shell1248/Google Chrome for Testing156.0.8078.4. Host typecheck reused, not repeated remotely; report-only budget/lint and incomplete installed-import advisory retained. Required timely/still-down, held-read/abort and cleanup controls have named passing receipts, including omission under droplet defaults. Original A-14840 independently supplies ten sequential native component runs, each 7/7, at its recorded d192cef8d/tree2f5afa543 identity; production and component-test code unchanged at final head under source3/source4 carry. This is isolated fake-provider/native component evidence, not real-account coverage. No source changes, reruns or full-tier coverage inferred.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-31T06:59:40.708Z

Merged df65ecc721c4085941a7780f0d9d208966ab5db1 onto dev.
