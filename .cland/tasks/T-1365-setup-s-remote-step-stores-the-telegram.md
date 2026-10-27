---
id: T-1365
kind: task
title: Setup's remote step stores the Telegram token through a hidden prompt and enables the remote
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by: []
topic: topic-1104
branch: t/T-1365-setup-s-remote-step-stores-the-telegram
created: 2026-10-27T05:46:50.331Z
updated: 2026-10-27T06:37:59.531Z
closed: 2026-10-27T06:37:59.531Z
---

## Summary

`cland setup` gains an optional remote step after the hub and before the Aide. It offers Telegram, shows how to create the bot with BotFather, reads the token through a hidden prompt as `cland secret set` reads it, stores it, enables the remote and reloads the hub.

## What to build

Spec §3.11 (setup) and §3.3; v0.1.4 §3.3 (check first, ask only about what is missing, one line `ok`, `done`, `skip`, `open` or `fail`, one readline interface per question, no prompt without a terminal).

The prompter seam gains a fourth question: a hidden secret question. It reuses `cland secret`'s raw, no-echo reader and is closed before anything else reads the terminal. The scripted test prompter gains a matching step kind.

A new remote step runs in the runner between the hub and the Aide. For Telegram it detects whether the token is present, whether the remote is enabled and whether it is paired. When something is missing it offers Telegram (default No). On yes it prints the BotFather guidance in a few lines, then asks for the token. A token that fails the Telegram format check is refused at the prompt and asked for again. The token is stored with the secrets module, `remote.telegram.enabled` is set through the config-set path, and the hub is reloaded so the gateway starts the remote.

- A decline prints `skip`. A fully configured, paired remote prints `ok` and asks nothing.
- Without a terminal the step prints `open` with the exact commands: `cland secret set telegram.token`, `cland config set remote.telegram.enabled true`, `cland hub reload`.
- Pairing inside setup comes in 06. Until then an enabled, unpaired remote ends `open` with the approve command.
- With `--no-aide`, where no hub runs, the step stores and enables, and leaves the reload and the pairing `open`.

The step is written so that Discord (11) and the speech key (09) can join it as further offers.

**External wait and shared files:** E-1309 (the parts it drives, the Bot API client and fake, T-1340 to T-1342, are on dev) · **Shared files:** hub/src/setup/runner.ts, hub/src/setup/prompter.ts, hub/src/setup/types.ts, hub/src/cli/setup.ts, hub/test/setup-prompter.ts

## Acceptance criteria

- [x] C1. With a scripted prompter, a terminal run shows the remote step after the hub and before the Aide, gives the BotFather guidance, reads a made-up token through the hidden question, stores it, enables `remote.telegram` and reloads the hub, ending in `open` with the pairing step named when nothing is paired and in `done` when an existing pairing is kept (test).
  - done: impl-1365 · 2026-10-27T06:03:22.982Z
  - verified: rev-26 [reviewer] · run b8870c6e-2a98-4e0d-9d24-39f135ce90b7 · 2026-10-27T06:32:03.664Z · commit de08ca550c4c06713b955787fb821a8a34d33f7e
- [x] C2. A declined Telegram offer prints `skip` and writes nothing, and a run against a token-present, enabled, paired project asks nothing about Telegram and prints `ok` (test).
  - done: impl-1365 · 2026-10-27T06:03:23.977Z
  - verified: rev-26 [reviewer] · run b8870c6e-2a98-4e0d-9d24-39f135ce90b7 · 2026-10-27T06:32:03.664Z · commit de08ca550c4c06713b955787fb821a8a34d33f7e
- [x] C3. Without a terminal the step asks nothing: an untouched Telegram remote prints `skip` with `cland secret set telegram.token`, `cland config set remote.telegram.enabled true` and `cland hub reload`, and a half-configured one (a token without enabling, or enabled without a token) prints `open` with the missing commands (test).
  - done: impl-1365 · 2026-10-27T06:03:24.195Z
  - verified: rev-26 [reviewer] · run b8870c6e-2a98-4e0d-9d24-39f135ce90b7 · 2026-10-27T06:32:03.664Z · commit de08ca550c4c06713b955787fb821a8a34d33f7e
- [x] C4. The hidden question echoes nothing, and the token appears in no setup line, narration, `--json` report or hub log (test).
  - done: impl-1365 · 2026-10-27T06:03:24.558Z
  - verified: rev-26 [reviewer] · run b8870c6e-2a98-4e0d-9d24-39f135ce90b7 · 2026-10-27T06:32:03.664Z · commit de08ca550c4c06713b955787fb821a8a34d33f7e
- [x] C5. A malformed token is refused at the prompt with the expected format named, and the next well-formed one is stored (test).
  - done: impl-1365 · 2026-10-27T06:03:24.790Z
  - verified: rev-26 [reviewer] · run b8870c6e-2a98-4e0d-9d24-39f135ce90b7 · 2026-10-27T06:32:03.664Z · commit de08ca550c4c06713b955787fb821a8a34d33f7e

## Comments

### impl-1365 · 2026-10-27T05:48:44.635Z

Rule 20 consumer inventory before edits: new setup report row (remote telegram) and Prompter.secret affect hub/src/cli/setup.ts, setup/{runner,types,prompter,handover,hub}.ts and setup steps. Production clients consume SetupReport only in cli/setup; wire remote.status/config.set/hub.reload shapes remain unchanged. Test consumers searched across hub/test, web/test, nvim/test, qa and docs: setup-flow.test.ts (ordered rows/counts and scripts), setup-cli.test.ts (JSON count/rows/relative indexing), setup-hub.test.ts (runner scripts and suffix expectations), setup-prompter{,.test}.ts (fourth question), scenarios/setup.test.ts (T3 terminal transcript/order), setup-handover, setup-accounts, setup-favourite, setup-trust and setup-trust-lock (scripted interface; individual steps do not offer remotes), setup-hub-component (frame client), executor-safety-component (typed SetupMachine unaffected). Existing SetupHub mocks remain source-compatible with optional added operations; previous remote.status reply shape is retained and covered via the real frame client. No Web/Neovim consumer, startup probe or persisted-record reader uses setup report rows. Shipped examples: hub/README.md setup and scratch scenario sections, cli/usage.ts, docs/agents/secrets.md, implement skill/CHANGES; onboarding skill only receives unchanged Aide brief and is unaffected. Brand launch audit is historical and unaffected. New tests use the agreed scripted prompter + sealed frame/projectHub + fake messenger seams; hidden input uses existing raw keypress stream seam.

### impl-1365 · 2026-10-27T06:03:53.962Z

Implemented and pushed 934a2266ca440c3246431bb8a390074e2208ef04 (tree 877c9857520b5aef00a94bc4d4bfbde10c6a66ca) after fetching/merging origin/dev. All C1–C5 marked done. A-12607 contains durable evidence and consumer-migration notes. Local macOS Node 24.21.0: 63/63 targeted tests across setup-prompter, setup-remotes, setup-remote-component, setup-flow, setup-cli, setup-hub, setup-handover and existing T3 scenarios/setup, each file separately; npm run typecheck passed. Lint-tiers/closed-item wording/diff-check passed; test lint 0 enforce refusals (135 report-only findings repository-wide). No Linux/droplet, browser/Web or full tier evidence claimed. Source review requested from Reviewer. Per Coordinator's stage instruction no mode-free verify; Coordinator owns rule-6 stage cover and enqueue after ready. QA policy none/after-stage.

### rev-26 · 2026-10-27T06:06:00.159Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1365-source-1
commit: 934a2266ca440c3246431bb8a390074e2208ef04
scope: full
findings: [{"severity":"medium","text":"M1 Standards: added Telegram SETUP_USAGE guidance is absent from owning frozen commands.json row. Reproduce unchanged compatibility/full-help red, update only SETUP_USAGE row, preserve guards and original red/green output/native exits.","file":"hub/src/cli/usage.ts","line":20}]
finding_counts: {"high":0,"medium":1,"low":0}

Consolidated full source audit complete, A-12610 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12610-t-1365-full-source-1-finding-at-934a2266.md. M1 only; no additional Standards/Spec/fixture findings. Reviewed hidden input/preflight, no-value frame/report boundary, default-No/nonterminal and paired/unpaired semantics, config-set/reload/status readback, optional old SetupHub/wire clients and all changed report/PTY consumers. A-12607 is local macOS63-case targeted summary, no configured/Linux/browser proof; C1–C5 unverified. Finish Coordinator's additional serial setup/onboarding matrix and M1, then fresh pushed-head source review. No item verify; Coordinator stage all/landing.

### impl-1365 · 2026-10-27T06:07:14.764Z

Consumer inventory correction from Coordinator's requested extra checks: setup-favourite.test.ts also contains full runSetup JSON cases, not only individual favourite-step calls. Two suffix-index assertions went red (['trust','hub'] vs ['favourite','trust']) after the remote row addition. Migrating these to named favourite/trust row selection while retaining ordered names and their verdict assertions. This belongs to T-1365's consumer migration; production source remains unchanged. The missing frozen SETUP_USAGE row was also reproduced red and fixed independently; original native exits/output are in A-12609.

### rev-26 · 2026-10-27T06:09:49.255Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1365-source-2
commit: de08ca550c4c06713b955787fb821a8a34d33f7e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-12611 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12611-t-1365-source-2-clearance-at-de08ca550.md. M1 resolved by SETUP_USAGE-only golden update; additional favourite report consumers migrate to named rows retaining order/verdict/config assertions. Production unchanged from initial full audit. A-12609 original help/favourite red→green and55 additional serial local macOS cases inspected; exact-final-head help1+5/favourite13 pass, typecheck reported/archived. A-12607 original63 cases remain old-head targeted attribution. No configured/Linux/browser proof, C1–C5 unverified. Keep head stable; ready for Coordinator stage all/landing, no item verify.

### impl-1365 · 2026-10-27T06:10:36.204Z

Ready reported to Coordinator at stable pushed head de08ca550c4c06713b955787fb821a8a34d33f7e after source clearance rev-20261027-1365-source-2 / A-12611. Fresh origin/dev fetch at 411787e5e; merge-tree conflict check exit 0, tree a82c07c47f0b6adb5984da5e6503d67ece3f169e; task worktree clean. A-12609 retains original help/favourite red-green outputs, all 55 requested additional setup/onboarding passes, exact-final-head help/favourite 19-case rerun and typecheck result/limits. A-12607 retains original 63-case prior-head targeted evidence, production unchanged. Runtime criteria stay for Coordinator's stage all; no item verify. Claim retained until merge.

### impl-1365 · 2026-10-27T06:30:54.772Z

Configured task verification b8870c6e-2a98-4e0d-9d24-39f135ce90b7 passed on unchanged source-cleared head de08ca550: aggregate 3601 pass, 0 fail/cancel/skip/todo, Linux droplet c-8 lon1, Node24.21.0, Neovim0.12.5, isolated Chrome Headless Shell156.0.8078.4/v1248. T0 check, full T1, fallback all T2, Web, and changed setup PTY T3 passed; remaining T3/T4 absent. C1–C5 individual recorded outcomes and 5/5 new T1/T2 load repetitions inspected; Web/duration budgets report-only. T3 body13.182006 s excludes machine/runner overhead. Existing E-880 allowance applies; no duplicate added per Coordinator eb689237. Raw A-12615; criterion mapping/provenance A-12616. Final evidence review requested with b8870c6e and verified all; Coordinator clarified this standard task gate suffices and owns enqueue on ready.

### rev-26 · 2026-10-27T06:32:03.664Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: b8870c6e-2a98-4e0d-9d24-39f135ce90b7
commit: de08ca550c4c06713b955787fb821a8a34d33f7e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1–C5 verified at unchanged source-clear head. A-12617 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12617-t-1365-final-configured-evidence-clearance-at-de08ca550.md. Original A-12615 records 3601 ordinary passes and 475 distinct scoped load passes; 13 new setup identities ordinary pass + exactly5/5 each, maximum new base0.297680666s/load0.316378142s. T0/full T1/fallback full T2/full Web + changed T3 PTY scenario complete; broader T3/T4 absent. Existing T3 scenario passes13.182005864s once within existing27.4s E-880 allowance; no stanza added. Coordinator eb689237/D77 accepts this task gate, superseding earlier all requirement. Linux droplet/pinned Headless Shell1248, host typecheck reused; report-only budgets/lint and incomplete timing limits retained. No findings; Coordinator owns enqueue/landing.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-27T06:37:59.531Z

Merged fc5d5792a89d609a04c0a65a06f1dd53b7f11943 onto dev.
