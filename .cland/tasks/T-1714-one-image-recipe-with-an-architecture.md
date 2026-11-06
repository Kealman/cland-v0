---
id: T-1714
kind: task
title: One image recipe with an architecture parameter
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1709
topic: topic-1412
branch: t/T-1714-one-image-recipe-with-an-architecture
created: 2026-11-06T10:48:27.331Z
updated: 2026-11-06T22:28:37.797Z
closed: 2026-11-06T22:28:37.797Z
---

## Summary

`provision.sh` becomes one recipe rendered by a function of the CPU architecture (`x86_64` or `arm64`), the Node version and, for agent hosts, the pinned harness versions. Its base holds only what cland needs on any project: Ubuntu with the apt timers off, git, curl, ca-certificates, jq, lsof, procps, xz-utils, locales, the hub's exact Node, the `runner` user, build-essential and python3. The agent-host part adds the harness installers on pinned channels: OpenCode 2 only from `https://opencode.ai/v2/install`, never npm's `opencode-ai`. The executor's builder renders the base.

Hot files: `hub/src/executor/droplet/provision.sh` (becomes the recipe), `hub/src/image/recipe.ts` (new), `hub/src/executor/droplet/prepare.ts`, `hub/test/image-recipe.test.ts` (new)

## What to build

`renderRecipe({ arch, node, harnesses? })` returning the script. The executor builder calls it with its machine's architecture and no harnesses. An unknown architecture is refused. Decision (coord, open question 2): the harness pins live in `[hosts] harnesses = { opencode = "…", codex = "…", "claude-code" = "…" }`, defaulting to the doctor's tested minimums.

## Acceptance criteria

- [x] C1. The recipe rendered for `x86_64` downloads `node-<v>-linux-x64.tar.xz` and checks it against `SHASUMS256.txt`, and the one for `arm64` does the same with `node-<v>-linux-arm64.tar.xz` (test).
  - done: impl-1714 · 2026-11-06T20:40:02.814Z
  - verified: rev-35 [reviewer] · run rev-35-1714-final-1 · 2026-11-06T21:53:18.566Z · commit 573aa4324a1ace9d0209661d385433ff8eb79f57
- [x] C2. Neither rendering names `nvim` or any Chromium runtime package, and the base names each listed package (test).
  - done: impl-1714 · 2026-11-06T20:40:03.532Z
  - verified: rev-35 [reviewer] · run rev-35-1714-final-1 · 2026-11-06T21:53:18.566Z · commit 573aa4324a1ace9d0209661d385433ff8eb79f57
- [x] C3. The agent-host rendering installs OpenCode from `https://opencode.ai/v2/install` at its pinned version, Codex and Claude Code at their pinned versions, and never the npm `opencode-ai` package (test).
  - done: impl-1714 · 2026-11-06T20:40:04.219Z
  - verified: rev-35 [reviewer] · run rev-35-1714-final-1 · 2026-11-06T21:53:18.566Z · commit 573aa4324a1ace9d0209661d385433ff8eb79f57
- [x] C4. An architecture other than `x86_64` or `arm64` is refused before rendering (test).
  - done: impl-1714 · 2026-11-06T20:40:04.932Z
  - verified: rev-35 [reviewer] · run rev-35-1714-final-1 · 2026-11-06T21:53:18.566Z · commit 573aa4324a1ace9d0209661d385433ff8eb79f57
- [x] C5. The executor's rendered base for its x86_64 builder is byte-identical to the provision-hook ticket's `provision.sh` apart from the template mechanics, so its snapshot key does not change (test).
  - done: impl-1714 · 2026-11-06T20:40:05.718Z
  - verified: rev-35 [reviewer] · run rev-35-1714-final-1 · 2026-11-06T21:53:18.566Z · commit 573aa4324a1ace9d0209661d385433ff8eb79f57

## Comments

### impl-1714 · 2026-11-06T20:36:56.398Z

Consumer sweep: provision.sh bytes are read by prepareKey (digest), prepareSnapshot (cloud-init), prepare-key.test.ts, executor-prepare.test.ts (exact digest), state-paths-inventory.ts and stage-1 QA brief source checks. prepareKey/sameKey/staleParts and persisted snapshot records stay unchanged; provision.sh stays unchanged. New renderRecipe consumes that template; only prepareSnapshot switches rendering. No reply, record or config schema changes. Harness defaults will derive from doctor TESTED_RANGES; hosts config is outside the listed hot-file scope.

### impl-1714 · 2026-11-06T20:41:24.571Z

At aa056f1cb, local macOS arm64 Node v24.21.0: image-recipe 6/6 and unchanged prepare-key 10/10 passed (text-only T1); root typecheck, npm run test:lint (0 refusals; existing report-only diagnostics), tiers and diff check passed. Heavy unedited preservation files unexecuted while awaiting coord lock slot #3. Source review requested from reviewer. A-17205 contains red/green sequence and frozen recipe digest. No full verification or live installation evidence yet.

### rev-35 · 2026-11-06T20:47:01.279Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1714-source-1
commit: 43a9f7e605f9d3724da9dfb08b4441c368da0b1f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17210: corrected cumulative source clear, no remaining findings. Baked OpenCode/Claude test-x+stable links and Codex explicit/usr/local npm prefix+executable check resolve lookup across login-disk HOME. Inert scratch lookup control covers all3 without shell/installer execution. Architecture/Node checksum/pin validation, shared doctor defaults and builder renderer inspected. provision.sh bytes independently retain SHA256 3cf36474d3b4e6a42c2a9edcbfb68b44b7c08b405f82f99f755651f502f7ef3d; prepareKey digest unchanged. Coordinator5bfb50c6 assigns config toT1716/callerT1719, both documented. C1–C5 remain unverified; heavy preservation/static final completion and same-head configured evidence pending. No Reviewer execution/live image proof; affected after-stageQA separate.

### impl-1714 · 2026-11-06T20:49:37.425Z

At reviewed 43a9f7e60: directed preservation completed under own preservation lock, all existing tests unedited. executor-prepare 5/5, executor-prepare-component 17/17, verify-prepare 1/1, all native exits 0 and signal null, no skips/cancels/todo. macOS arm64 local Node v24.21.0; no Docker/browser/live provider or installer. Raw log A-17213; earlier red-green/static transcriptions and source limits A-17211. Lock released to next item. Mode-free exact-head verify now submitted, preflight in progress.

### impl-1714 · 2026-11-06T20:56:29.294Z

Failure consumer sweep before exact source-policy exemption: allowedTargets and forbidden are local to accounts-policy.test.ts; source scan reads hub/src/**/*.ts. New image/recipe.ts is a new authorized OpenCode v2 installer-text consumer alongside existing doctor/harnesses.ts and setup/steps/harnesses.ts entries. Runtime requests, credential access, account policy and all other forbidden targets remain unchanged. Add only exact recipe literal exemption, not a whole-file exclusion.

### rev-35 · 2026-11-06T20:57:02.677Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1714-evidence-1
commit: 43a9f7e605f9d3724da9dfb08b4441c368da0b1f
scope: evidence
findings: [{"severity":"medium","text":"The new OpenCode installer literal is not integrated with the existing exact-literal accounts source policy. Configured run 7cff017c fails accounts-policy.test.ts:6 with recipe.ts contains opencode.ai. Migrate this authorized render-only installer consumer narrowly, preserving rejection of provider/credential access elsewhere, before another source review and verification.","file":"hub/src/image/recipe.ts","line":26}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17220: same-head configured run7cff017c/A-17219 exit1. T0 passed; T1 failed exact accounts-policy assertion recipe.ts contains opencode.ai. Existing narrow authorized-literal consumer was not migrated for the new render-only installer. Seven image base cases and35 load passes are positive partial evidence; C1–C5 remain unverified. T2/nativeT3/T4/Web unexecuted. Prior macOS preservation A-17213 remains qualified separately. Fresh corrected-head source review required before another verify; no broad policy exemption.

### impl-1714 · 2026-11-06T20:58:03.248Z

Coordinator carry decision 3b3cf000: A-17213 preservation evidence from earlier tree 43a9f7e60 carries to 573aa4324 with scope production and directed test bytes unchanged. git diff --stat 43a9f7e60 573aa4324: docs/agents/tests/hub-test-accounts-policy.test.ts.md | 5 +; docs/agents/tests/index.md | 1 +; hub/test/accounts-policy.test.ts | 46 (29 additions,17 deletions); 3 files changed,35 insertions,17 deletions. Entire diff is policy test and docs; no production file, directed executor-prepare/executor-prepare-component/verify-prepare file or their imports changed. No lock rerun. Exact source-policy repro went red for recipe.ts contains opencode.ai; added exact file/literal exception and shared-checker negative controls, then node --test hub/test/accounts-policy.test.ts exited 0 (3 pass, no skip/cancel). New source review and exact-head configured verification pending quiet release.

### rev-35 · 2026-11-06T20:58:44.272Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1714-source-2
commit: 573aa4324a1ace9d0209661d385433ff8eb79f57
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17222: corrected cumulative source clear. Exact installer URL authorization in recipe only, unchanged eight prior entries, shared checker/full scan and unrelated-file/duplicate/unrelated-endpoint controls resolve A-17220. Owning guide/index aligned. Independently confirmed only policy test/docs changed; production, directed tests and their imports unchanged. Coordinator3b3cf000 carries A-17213 at its original43a tree with those limits. C1–C5 stay unverified; fresh configured run at573aa4324 after quiet release remains required. Failed predecessor A-17219 remains failed; no live agent-image proof.

### impl-1714 · 2026-11-06T21:52:41.864Z

Configured verify a8ae1f1e at 573aa4324 green (A-17256): T0/T1/T2/Web exit0; 5275 passed, no fail/cancel/skip/todo. Parsed required generated case receipts apart from exit: all 7 image-recipe base cases pass + 35/35 load repeats, exact installer-policy control base1 + load5 pass. Provenance tree09008ee2d757aca715da5e9a3712b6d5666bc93c; Linux x64 droplet c-8 lon1 Node24.21.0, Headless Shell1248 Chrome for Testing156.0.8078.4, skips empty; budget and skip-reason checks report mode. Lifetime957s costUSD0.0664 (not test wall time). T3/T4 not run in configured task; directed macOS 23/23 preservation carries from A-17213 under Coordinator3b3cf000 (production and directed test bytes unchanged). After-stage QA belongs to stage. Reviewer has same-head result for settlement.

### rev-35 · 2026-11-06T21:53:18.566Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1714-final-1
commit: 573aa4324a1ace9d0209661d385433ff8eb79f57
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17257: final same-head clear,C1–C5verified. A-17256 exit0 hub5275/base5139, four empty failure arrays; all7recipe base+5distinct load passes and policy control base+5 pass. T0/T1/allT2/Web complete; T3/T4 unexecuted, remainingT3merge-batch. Independently reconstructed matching executionprojection09008ee2d757aca715da5e9a3712b6d5666bc93c and frozen provision SHA; prepare-key10pass. Directed native23passes A-17213 remain43a provenance carried viaCoordinator3b3cf000, production/direct tests/imports unchanged. Inert rendering/lookup tests do not prove live agent-image installation; affected after-stageQA separate. A-17219 remainsfailed.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-06T22:28:37.797Z

Merged e6e7fb44d6b78431d54d9a2e66e20ee038355b73 onto dev.
