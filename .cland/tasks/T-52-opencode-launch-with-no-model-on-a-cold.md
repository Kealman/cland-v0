---
id: T-52
kind: task
title: OpenCode launch with no model on a cold catalog picks the first listed free model before the Zen models arrive
state: closed
status: done
labels:
  - slice-1
  - ready-for-agent
assignee: impl-52
parent: T-19
blocked_by: []
topic: topic-17
branch: t/T-52-opencode-cold-catalog
created: 2026-10-09T08:04:42.494Z
updated: 2026-10-10T00:58:17.568Z
---

## Parent

Part of T-19. Observed by qa-4 during T-46's QA (2026-10-09, branch 9a73ec4, a scratch hub under a sandboxed QA session with isolated XDG directories, OpenCode 2.0.24): the first no-model launch after the OpenCode server started (`o1`) selected `openrouter/inclusionai/ling-3.1-flash`; a later `GET /api/model` on the same server returned 438 models including the active, free, tools-enabled `opencode/big-pickle`, and the branch's `pickFreeModel` on that catalog returns big-pickle; a second no-model launch (`o3`) on the warm server selected big-pickle. Not reproduced with catalog snapshots; qa-4's suspicion: the launch takes the first non-empty model list (hub/src/adapters/opencode.ts around line 156) while the server is still assembling its catalog, so the known-good list (T-46) is not yet offered and the fallback to the first listed free model fires.

## What to do

- Reproduce with the fake OpenCode server answering a partial catalog first (without the Zen models) and the full one on a later request, then once with the real server cold.
- If real: wait for the catalog to settle before picking (poll until the list stops growing, with a bounded wait, or until a model of the known-good list appears), or re-pick on the first turn's failure; say which in hub/README.md.

## Acceptance criteria

- [ ] A test against the fake server: a staged catalog yields `opencode/big-pickle` for a no-model launch, not the first model of the partial list
- [ ] `hub/README.md` says how the launch waits for the catalog
- [ ] `npm run typecheck && npm test` pass

## Comments

### impl-52 · 2026-10-09T11:39:40.915Z

Claimed T-52. Reproduction seam: a no-model launch through the real OpenCode adapter against the fake server, with a partial free catalog followed by the full Zen catalog. Will record red/green results, try an isolated real cold server, document the wait, and run the full suite once under the machine lock.

### impl-52 · 2026-10-09T11:41:52.734Z

RED reproduced at the launch seam: `node --test --test-name-pattern='partial cold catalog' hub/test/opencode-adapter.test.ts` fails in ~1.3 s, selecting `openrouter/inclusionai/ling-3.1-flash` instead of `opencode/big-pickle`. Minimal fixture: one external free model on the first nonempty response, plus big-pickle on the next.

### impl-52 · 2026-10-09T11:42:24.947Z

Real cold attempt: OpenCode v2.0.24, isolated HOME and XDG config/data/cache/state, scratch cwd, empty MCP config. GET /api/model returned 0 models ~39 ms after listening, then 438 including big-pickle ~256 ms. First-nonempty and later session creation both retained requested opencode/big-pickle; this attempt did not reproduce QA's race. Server stopped in finally and scratch directory removed. The fake reproduces early-return behavior deterministically; implementing polling until a known-good choice appears or a nonempty catalog stays unchanged for 1 s, bounded by the existing 10 s catalog budget.

### impl-52 · 2026-10-09T11:43:23.588Z

GREEN: staged-catalog launch test now passes (~1.7 s), including three identical partial responses before big-pickle arrives. Root cause confirmed at the fake boundary: returning on the first nonempty model response. Adapter now polls every 200 ms, returns immediately for a known-good eligible model, otherwise waits for 1 s of catalog stability; requests and sleeps share a 10 s budget. Typechecking passes.

### impl-52 · 2026-10-09T11:45:15.613Z

Targeted verification: all 11 tests in hub/test/opencode-adapter.test.ts pass (0 skipped, ~38.6 s), and npm run typecheck passes. README documents 200 ms polling, known-good early exit, 1 s stability, 10 s total catalog budget, deadline fallback and explicit/restored-session bypass. Implementation committed as a0aec7d on the assigned task branch; no push or merge. Internal standards/spec review underway before the single locked full-suite run.

### rev-65 · 2026-10-09T11:47:42.091Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-52-1
commit: a0aec7db14d06dc75b6769948dd9dafb566b886d

Reviewed T-52 branch t/T-52-opencode-cold-catalog at a0aec7db14d06dc75b6769948dd9dafb566b886d, run rev-65-52-1. Pinned diff: git diff 42f0d316253c2acfe677fae8356ad1d908452d18...a0aec7db14d06dc75b6769948dd9dafb566b886d; one commit, five files. Read the item, impl-52's comments and A-10 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10-t-52-cold-catalog-reproduction-and-fix.md). Used the code-review skill's parallel Standards and Spec reviews against the already-read AGENTS.md, GLOSSARY.md, relevant ADRs and adapter documentation. Sub-agents did not call hub tools. Read-only; no edits, commits, pushes, merges or suite.

## Standards
High: none. Medium: none. Low: none. No documented-standard breaches or actionable baseline smells. Sharing KNOWN_GOOD_FREE_MODELS keeps early exit and picker preference aligned. Existing adapter ownership, capability declarations and restored-session behavior are preserved.

## Spec
High: none. Medium: none.
Low:
- hub/test/opencode-adapter.test.ts:201 tests the staged known-good path but does not directly exercise the new deadline-expiry fallback or a stalled catalog response; those bounds are supported by code inspection rather than regression evidence. A follow-up boundary test would strengthen the 10 s guarantee.

The requested behavior is implemented:
- fake-opencode.ts:249-253 returns three identical eligible partial OpenRouter catalogs before adding opencode/big-pickle. The test launches through the real adapter/hub and asserts the resulting model. The old first-nonempty return necessarily selects the partial model; A-10 records that red result and the green result after this fix.
- opencode.ts:153-172 sets one 10 s catalog deadline. Every request receives max(1, remaining budget); every polling sleep is asynchronous and capped by min(200, remaining budget). No busy loop, synchronous child process or synchronous wait was added. HTTP fetching yields, and OpenCodeClient.request's AbortSignal applies through response-body consumption (client.ts:31-40/63-64).
- An eligible known-good choice returns immediately. Otherwise, the entire nonempty catalog must stay unchanged for 1 s. Changing/empty catalogs and failed requests are retried within the same deadline. Failed requests preserve the latest successful choice; a successful later catalog updates it. At expiry that choice is returned, or null so createSession omits model and uses the server default.
- The existing eligibility checks still require active/enabled/tools-capable/zero input-output cost, preserving preference: known-good, then Zen, then other free models. Explicit models and an existing restored session skip this selection (opencode.ts:134-138).
- hub/README.md:606 documents the 200 ms poll, known-good early return, 1 s stability, 10 s request/sleep budget, deadline fallback and bypasses.

Evidence limits: A-10's real cold attempt used OpenCode 2.0.24 with isolated HOME/XDG/cwd and stopped/removed its scratch state. It saw empty then 438 models including big-pickle, and did not reproduce QA's intermittent real-server race; this review makes no stronger reproduction claim. Its initial targeted-pending note is superseded by impl-52's 11:45 comment: all 11 opencode-adapter tests passed, 0 skips, plus typecheck. The final locked full suite remains pending in the evidence read here, so that acceptance check must still be completed by Implementer/QA. No tests were executed by this Reviewer. git diff --check is clean.

Totals: Standards 0 findings; Spec 1 low, worst the missing deadline boundary regression. Nothing high or medium remains. Result clear.

Durable review evidence: A-13, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13-t-52-review-rev-65-52-1-at-a0aec7d.md.

### impl-52 · 2026-10-09T11:52:02.544Z

Addressed Reviewer low with a test-only deadline regression at OpenCodeAdapter.spawn against the fake server. The catalog continually changes and never offers Zen; after two successful lists, a test-local Date clock advance spends the 10 s budget without wall-clock waiting. Launch must retain openrouter/latest-free, rather than the first list or server default. Both catalog tests and typecheck pass. Sensitivity check: temporarily discarding the deadline choice made the test fail (actual opencode/fake-default); restored production code and watched it pass. Queued suite was paused before acquiring the lock; no full suite has run yet.

### impl-52 · 2026-10-09T11:59:52.483Z

The machine lock freed; the single final `npm run typecheck && npm test` run is now executing on 61a5e06. Typecheck completed and hub tests are in progress. Internal follow-up checks of the test-only commit found no new standards or spec issues.

### impl-52 · 2026-10-09T12:02:35.990Z

Final locked run on 61a5e06: npm run typecheck passed; hub suite ran 330 tests, 328 passed, 2 failed, 0 skipped (~138 s). All 12 OpenCode adapter tests, including staged catalog and deadline fallback, passed. Unchanged failures: freshness.test.ts:152 (new branch stale true vs undefined) and worktree-cli.test.ts:16 (verdictBase null vs main). Coordinator confirmed both are T-67 cache warm-up timing defects tracked in T-72. Targeted retry `node --test hub/test/freshness.test.ts hub/test/worktree-cli.test.ts`: 9/9 pass, 0 skipped (~39 s). Full suite ran only once. Its && chain skipped Neovim after hub failure; Neovim is now queued under the machine lock.

### impl-52 · 2026-10-09T12:06:52.054Z

Neovim completion on 61a5e06 passed under the machine lock: 90 tests, 90 pass, 0 fail, 0 skipped (~22.7 s). Final evidence is A-21: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21-t-52-final-implementation-and-validation.md. Final implementation is a0aec7d plus test-only 61a5e06; branch clean, no push/merge. Typecheck and all 12 OpenCode adapter tests pass; the one full hub run remains 328/330 with the two unchanged T-72 timing failures, both passing in the 9/9 targeted retry. QA independently reports cold-cache big-pickle selection and cleanup in A-19. Implementation complete; reporting to Coordinator and QA.

### qa-12 · 2026-10-09T12:07:29.791Z

verdict: qa
result: clear
by: qa-12 [qa]
run: qa-12-52-1
commit: 61a5e0659188d29f29c37d5273a2ced895820e23

Checked an isolated git archive of 61a5e0659188d29f29c37d5273a2ced895820e23, with node_modules linked from T-52. Read T-52 and artifacts A-10/A-13. No source changes or fixes by QA.

Ran independently:
- Supported Node v24.21.0: npm run typecheck passed.
- node --test hub/test/opencode-adapter.test.ts: 12/12 passed, zero skips (~50.15 s), including partial cold catalog selecting big-pickle and changing-catalog deadline retaining the latest successful fallback. No separate catalog test file exists at this head; catalog tests are in this adapter file.
- Real OpenCode v2.0.24 through a scratch project's own hub. Isolated HOME and XDG cache/config/data/state; cache was empty immediately before launch. Every cland invocation used env -u CLAND_HUB_FILE -u CLAND_SESSION_ID -u CLAND_SESSION_NAME node <export>/hub/bin/cland.ts … .
- cland init, hub start, task create/list/view succeeded. cland session launch cold-qa --harness opencode --json supplied neither model nor role, selected opencode/big-pickle, and returned in 1,139 ms. Server listening was observed at 440 ms; the remaining 699 ms includes catalog/session creation and CLI return, not a direct catalog-only timing. Observer interval: 25 ms.
- cland session list confirmed big-pickle and idle state. cland session stop exited 0, and its opencode serve PID 43404 disappeared. cland hub stop exited 0, hub PID 42541 disappeared and socket was removed. No processes from the QA export remained. A pre-existing opencode serve --service PID 37972, started Oct 7 with cwd in the user's home and no QA files open, was left untouched.
- Read hub/README.md's documented 200 ms polling, known-good early exit, 1 s stability and 10 s budget; these agree with the exercised catalog regressions. Real cold launch succeeded but does not establish reproduction of the original intermittent partial-catalog race. No model turn was sent.

Full-suite evidence, executed by impl-52 rather than QA as explicitly directed by the Coordinator: read the final item comments and A-21. Typecheck passed; the one locked full hub run was 328/330, zero skips, with all 12 adapter tests passing. Its failure stopped the npm && chain before Neovim. Targeted freshness/worktree retry passed 9/9, zero skips; separately locked npm run test:nvim passed 90/90, zero skips. No duplicate full suite run by QA.

Findings by severity:
- High: none.
- Medium / known outside T-52: original full-suite failures remain recorded at hub/test/freshness.test.ts:152 (current true versus undefined) and hub/test/worktree-cli.test.ts:16 (verdictBase null versus main). Coordinator identified both as existing T-67 timing defects tracked in T-72; both passed in impl-52's targeted retry. The full command is not represented as a clean pass.
- Low: none in the requested T-52 scope. The missing deadline regression noted by A-13 is present and passed independently at 61a5e06.

Evidence: A-19, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-19-t-52-qa-61a5e06-independent-tests-and-real-cold-cache-launch.zip contains QA logs, real CLI driver/transcript, timings and cleanup checks. Full-suite provenance: A-21, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21-t-52-final-implementation-and-validation.md. QA artifact copy hash verified; scratch project, isolated state and export removed; working tree clean.

### coord · 2026-10-09T12:19:09.822Z

Merged into main as f737f70 (`git merge --no-ff`, by the Coordinator) at 12:09Z. Suite on main f737f70: typecheck clean; hub 342/343, where the one failure is T-72's known timing test, which passes alone 5/5; Neovim 91/91.
Verdicts: review rev-65-52-1 clear on a0aec7d; QA qa-12-52-1 clear on 61a5e06, which adds only the deadline test after a0aec7d. qa-12's real check used OpenCode 2.0.24 with an isolated, cold cache: a no-model launch picked `opencode/big-pickle` in 1,139 ms, and the stop left no server behind.
What it does: a no-model OpenCode launch polls the catalog within a 10 s budget. It stops when a known-good model appears, when the list stops growing, or at the deadline, where it falls back to the latest successful list. Live on the next hub restart.
Implementer: impl-52 (Codex), launched 11:39Z.
