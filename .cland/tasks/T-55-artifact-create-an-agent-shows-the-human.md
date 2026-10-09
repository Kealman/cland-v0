---
id: T-55
kind: task
title: "artifact.create: an agent shows the human a file in one call, and the topic lists what was shared"
state: open
labels:
  - ready-for-agent
  - slice-2
assignee: impl-55
parent: T-20
blocked_by: []
topic: topic-12
branch: t/T-55-artifact-create
created: 2026-10-09T08:33:53.670Z
updated: 2026-10-09T10:01:27.705Z
---

## Parent

Part of T-20 (slice 2, ticket 6 of 12). Spec sections 4.8 and 7(b), 7(d).

## What to build

The artifact store: files `.cland/artifacts/A-<n>-<slug>.<ext>` and an index in the hub's database (id, title, kind, creator, time, topic, status). `artifact.create(kind, title, path | content, topic)` is a spoke tool for every role (the grant exists already), a frame for the UI, and `cland artifact create`, with `cland artifact list [--topic]` beside it. A `path` is copied, never moved, so an artifact outlives its worktree; `content` is written. The hub posts a message into the topic that carries the artifact (id, kind, title, absolute path) as a structured field, and marks it `shared`; an agent's delivery names each artifact's id and path in the envelope. The thread shows the artifact as a chip, `▣ A-3 diagram · Merge flow`, and `↵` on it opens it by extension: Markdown and Mermaid in a read-only Neovim buffer (Mermaid as its source with the `mermaid` filetype, plus a key that opens a rendered view in the browser through a generated page loading a pinned mermaid.js; no image rendering in the terminal, decision D12); HTML, SVG, PNG and PDF in the browser through the system opener, which an environment variable replaces in tests. The topic's artifact list, a view per topic with a count in the thread header, shows id, kind, title, creator, status and time, and opens each. The picker's artifacts kind (`␣a`) replaces its "slice 2" placeholder. There is no versioning (spec 8): a new create is a new id. The size cap and the rate limit apply to the message it posts as to `send`. The four role clauses and `AGENTS.md`'s block say to show work through `artifact.create`, never through tmp files.

## Acceptance criteria

- [ ] A spoke's `artifact.create {kind:"diagram", title:"Merge flow", content:"graph TD…", topic:"topic-3"}` writes `.cland/artifacts/A-1-merge-flow.mmd`, returns the id and the absolute path, and posts a message in topic-3 whose artifact field names A-1.
- [ ] With `path`, the file is copied: deleting the source leaves the artifact readable.
- [ ] An unknown kind, a missing file, an unknown topic, a topic the caller may not write to, or both `path` and `content` is refused with a typed error.
- [ ] The thread shows the chip; `↵` opens the Mermaid source in a read-only buffer, and on a page it calls the opener with the file, as the test's opener variable records.
- [ ] The topic's artifact list and the picker's artifacts kind list A-1 and open it.
- [ ] The message a Codex or OpenCode session gets injected names A-1 and its path.
- [ ] `cland artifact create` and `cland artifact list --topic topic-3` follow the same rules.
- [ ] `npm run typecheck && npm test` pass; `hub/README.md` and `nvim/README.md` document artifacts, the chip and the list.

## Notes

Test seam: spokes and the CLI against a real hub; the files in the temp project's `.cland/artifacts`; a headless Neovim against the hub for the chip, the opener, the list and the picker; the fake harnesses for the injected envelope. Size L. Implementer: Codex gpt-6.1-sol. Can start immediately.

## Comments

### impl-55 · 2026-10-09T08:38:01.390Z

Claimed. Implementing through the item’s agreed seams: real hub/spoke and CLI, headless Neovim artifact views/opener, and fake harness envelope delivery. Starting with persistent artifact creation and publication.

### coord · 2026-10-09T08:39:13.053Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/50 (a sub-issue of #20; the item is the source of truth).

### impl-55 · 2026-10-09T08:42:35.704Z

Store/spoke/CLI tracer bullets pass: Mermaid content produces A-1 with structured topic message; copied HTML survives deleting its source, restart preserves listing, and next create gets A-2. Implemented Coordinator’s topic authorization decision (own item or delivered request; General/Agents Coordinator-only). Next: refusal/rollback coverage, delivery envelopes, Neovim chip/list/opener.

### impl-55 · 2026-10-09T08:50:31.432Z

Neovim and delivery tracer bullets pass: chip → read-only Mermaid source → pinned/strict browser preview; ga opens per-topic list, ␣a opens artifacts picker, HTML goes through CLAND_OPENER. Both fake Codex and fake OpenCode receive artifact_id and artifact_path. Rate/size refusal rollback is covered. Corrected Vim preview newline handling (writefile otherwise emits NUL bytes). Docs, all four default clauses and managed AGENTS block now describe artifact.create. Running final typecheck and full suite.

### impl-55 · 2026-10-09T09:08:29.246Z

Internal spec review found one integration gap: the Agents topic uses its own log buffer, so Coordinator artifacts there need the same Enter opener, ga list and count as ordinary threads. Fixing it with a real-hub/headless-Neovim regression before committing. Standards review found no hard violations (one optional repeated-branch cleanup).

### impl-55 · 2026-10-09T09:11:36.776Z

Implemented and committed as 109f49f on t/T-55-artifact-create. Persistent artifact store/index, spoke tool and CLI/frame, typed authorization/refusals and send-limit rollback; structured messages plus Codex/OpenCode envelopes; Neovim chips, readonly Markdown/Mermaid, pinned strict browser preview, opener override, topic lists/counts (including Agents), artifacts picker; default clauses, managed AGENTS block and READMEs. Additive migration only. No task files committed; no push/merge.

## Standards review
No hard documented-standard violations. One optional low-priority repeated-branch cleanup in views.lua, matching the existing structure, deferred.

## Spec review
Clear after fixing Agents log Enter/ga/count integration. Real-hub Coordinator-in-Agents regression failed before the fix and passes after it. No scope creep or remaining findings.

Validation: final npm run typecheck passes. Full hub run: 267 pass, 7 documented ps-denied skips, 3 failures; the two load-related timing failures and updated obsolete permission expectation pass isolated (3/3). Full Neovim run: 62 pass, 1 obsolete exact-header assertion; corrected header passes isolated (1/1). Final artifact UI tests 2/2 and affected Agents log tests 2/2 pass. git diff --cached --check passed before commit. T-60 prompt drafting and T-61 promotion/archive/cleanup remain out of scope.

Coordinator handoff: the send tool now reports "this spoke was replaced: a newer spoke of this session took the name — it will not reconnect"; recording the completion here through the identity-checked tracker CLI because this session's spoke cannot send the requested handoff message.

### impl-55 · 2026-10-09T09:23:07.583Z

Merging main 687b030 into the task branch as directed. Resolved seven overlapping conflicts by retaining artifact types/store/actions and Agents filters, with combined filtered log header and all Enter/ga/f/F mappings. Running typecheck and full tests once; awaiting Coordinator decision on inherited main tracker files versus original no-task-files instruction.

### rev-7 · 2026-10-09T09:25:06.034Z

verdict: review
result: not clear
by: rev-7 [reviewer]
run: rev-2026-10-09-T55-1

Reviewed b8368b30ac10ac892422c272831aafeedfed625d...109f49f3186a877393c4f96d7fa5c8fb5f509464 read-only, in the main thread as requested. Read T-55, T-20/D12, the Coordinator's brief and topic-12 authorization decision, AGENTS.md, GLOSSARY.md, relevant ADRs and spec sections 4.8/7.

## Standards
No documented violations or actionable baseline smell findings.

## Spec
Findings ranked by severity:
- medium: .cland/roles.toml:44 — T-55 requires the four role clauses to say to show work through artifact.create rather than tmp files. Only hub/src/roles/default-roles.ts has those additions; all four clauses in this repository's configured roles.toml remain unchanged (also lines 65, 91 and 114). RolesFile loads the configured clauses, and cland init/update explicitly preserves an existing roles.toml (hub/src/init/provision.ts:43), so restart/reassignment will not install the new clause instruction here. Add the same artifact instruction to the four repository clauses, preserving the repository's launch choices and other concurrent role changes. The new generic spoke instructions and AGENTS block are present, but the separately requested role-clause update is incomplete for this project.

Other reviewed requirements appear satisfied: permanent copied/content files with unique ids and additive index/message migration; typed source/kind/topic/title and authorization refusals; caller-owned structured publication and shared status; send size/rate limits with file/index rollback; own-item or delivered-request topic authorization, Coordinator unrestricted and General/Agents limited to Coordinator sessions; spoke/frame/CLI surfaces and listing; durable id/path in Codex/OpenCode envelopes; chip/openers, read-only Markdown/Mermaid source, pinned strict Mermaid browser page, list/count and picker, including Agents. No versioning, prompt drafting or promotion/archive/cleanup added. No .cland/tasks in the 33-file diff; git diff --check clean.

Evidence: inspected the Implementer's logs, without running tests or editing files. Full hub run: 267 pass, 3 failures, 7 skips; all six artifact-store/spoke/CLI cases and both Codex/OpenCode envelope cases passed. The two timing/connection cases and corrected obsolete permission expectation passed in the isolated 3-test rerun. Full Neovim run: 62 pass, 1 obsolete header expectation; corrected header passed alone. Final artifact UI tests 2/2 and affected Agents-log tests 2/2 passed. Final typecheck log contains no errors (exit 0 reported on the item). The combined full suite was not wholly green; rerun evidence is recorded separately.

Totals: Standards 0 findings; Spec 1 medium finding.

### rev-7 · 2026-10-09T09:30:01.261Z

verdict: review
result: clear
by: rev-7 [reviewer]
run: rev-2026-10-09-T55-2

Second review, read-only in the main thread: whole change 687b0301f6f56a28b01f900fdc90bb4aaff2c5c3...b520435b895d0069ccd51cb971c407d69d404ce8; fix b520435 and merge 02e956d inspected separately. Read the item, earlier verdict and T-56 requirements/comments.

## Standards
No documented violations or actionable baseline smell findings.

## Spec
No findings: high none; medium none; low none. The medium from rev-2026-10-09-T55-1 is closed: b520435 adds exactly one artifact.create instruction to each of this repository's four role clauses, with no other roles.toml changes. T-48 approval/sandbox/writable-root/network configuration and the repository's harness/model choices remain intact.

Merge review: the Agents log retains f/F filters, L entry points, request generation checks and live predicates, alongside Enter opening artifacts and ga listing them. Filtered rows still map to the original structured message, so Enter uses the artifact on that row. The header keeps the filter label and controls together with the artifact count. Protocol types/validators, topic.history and spoke history retain item/session filter forwarding; store filtering is preserved alongside artifact indexing and serialization. Both READMEs retain both features. Previously reviewed artifact storage, CLI, envelope and artifact UI modules/tests are unchanged from 109f49f. No T-55-authored tracker edits: .cland/tasks is identical to main 687b030, and absent from the whole-change diff. git diff --check clean.

Evidence limits: this review ran no tests and edited no files. Earlier full-run failures and isolated passes remain recorded in the first verdict. The postmerge log /tmp/t55-merge-tests.log was still in progress when inspected; it is not a completed suite result. No claim of a wholly green postmerge suite is made.

Totals: Standards 0 findings; Spec 0 findings. Nothing high or medium remains.

### impl-55 · 2026-10-09T09:34:30.096Z

Coordinator-directed follow-up complete. Merge main 687b030 into the task branch: 02e956d47e8b123469b3b3d108dd5120b6e4e326. Both features retained: additive artifact DB/protocol and Agents filter queries; log has filtered header plus artifact count and Enter/ga/f/F/r actions. Main's inherited tracker tree is unchanged, per Coordinator decision. Separate review fix: b520435b895d0069ccd51cb971c407d69d404ce8 adds only four artifact instruction lines to repository .cland/roles.toml; T-48 launch configuration untouched. Branch clean.
Validation: npm run typecheck passed. One npm test run: hub 272 pass, 0 fail, 7 documented skips; Neovim 65 pass, one 10000ms RPC timeout in burst-events test. That exact case passes isolated (1/1). Combined real-hub Agents filter and artifact UI cases all passed. No second full run started per Coordinator; qa-11 owns final-head QA. No sub-agent threads used for this follow-up. Review rev-2026-10-09-T55-2 clear on b520435, as reported by Coordinator. Awaiting QA findings.

### qa-11 · 2026-10-09T09:41:49.879Z

verdict: qa
result: clear
by: qa-11 [qa]
run: qa-2026-10-09-T55-1

Exercised branch t/T-55-artifact-create at b520435, read-only for product files. Read task.view T-55 and the Coordinator's implementation brief/topic authorization decision. HEAD remains b520435; working tree clean.

Commands and observations:
- `npm run typecheck && npm test`: typecheck passed. Full hub suite: 279 tests, 270 pass, 2 fail, 7 skip. All six artifact tests and both Codex/OpenCode artifact-envelope tests passed. npm test stopped at the hub failures, so Neovim was run separately below.
- Isolated reruns: `node --test --test-name-pattern='^agent-to-agent messages are recorded' hub/test/agents-journal.test.ts` passed 1/1 (592 ms); `node --test --test-name-pattern='^a Claude Code StopFailure is recorded' hub/test/claude-code-adapter.test.ts` passed 1/1 (3581 ms).
- One changed-file command: `node --test hub/test/artifacts.test.ts hub/test/codex-delivery.test.ts hub/test/init.test.ts hub/test/opencode-adapter.test.ts hub/test/permissions.test.ts nvim/test/artifacts.test.ts nvim/test/shell.test.ts`: 88 tests, 87 pass, 0 fail, 1 skip. Read the assertions: persistent content/copy/restart/new ids; spoke/frame/CLI creation and listing; typed kind/source/topic/title refusals, both path and content; delivered-request/own-item authorization and forbidden General/Agents/other topics; identity spoof refusal; publication size/rate rollback; structured topic artifact; both agent envelopes; generated AGENTS instruction; chip/count, readonly Markdown/Mermaid, pinned strict Mermaid preview and opener, topic list/picker and Agents actions.
- `npm run test:nvim`: 66 tests, 65 pass, 1 fail, no skips. The headless harness drives nvim_input and reads screenstring(). Both artifact UI cases and Agents filter cases passed. `node --test --test-name-pattern='^a session.state event updates the chip' nvim/test/shell.test.ts` then passed 1/1 (795 ms); this case also passed in the changed-file run.
- Project read-only CLI: `node hub/bin/cland.ts task list --state open --json` and `node hub/bin/cland.ts task view T-55 --json` succeeded (20 open items, T-55 open).
- Independent scratch git project under TMPDIR, using branch CLI and `env -u CLAND_HUB_FILE -u CLAND_SESSION_ID -u CLAND_SESSION_NAME node <worktree>/hub/bin/cland.ts` for every CLI operation: init and hub start succeeded; diagram content creation returned A-1 at .cland/artifacts/A-1-qa-merge-flow.mmd with exact content and shared status; artifact list and artifact list --topic general both returned it. A UI client over the scratch Unix socket read topic.history: General's chip message carried artifact.id A-1 and its exact absolute path. A page created with --path retained its source initially and remained readable as A-2 after deleting the source. Unknown kind exited 1 with the expected kind error; list still contained only A-1/A-2. Scratch hub stop succeeded normally; no fallback kill needed.
- Both READMEs document artifacts and their UI behavior. `git diff main -- .cland/roles.toml` is exactly four added artifact.create instructions, with no other change to that file. Default clauses and managed AGENTS template carry the instruction. `git diff --check` clean; no .cland/tasks difference from main.

Findings by severity:
- High: none.
- Medium: none.
- Low / non-reproducing suite failures: hub/test/agents-journal.test.ts:82 returned false for beta's reply during the loaded full run; hub/test/claude-code-adapter.test.ts:17 timed out waiting 5000 ms for a frame; nvim/test/shell.test.ts:342 timed out after 10000 ms with the old busy chip still visible. Each passed alone as recorded above; no product fix was made. The full runs were not wholly green.

Evidence limits: the hub's seven skips comprise six ps-dependent cases and one needing macOS sandbox-exec; the changed-file run's sole skip is the ps-dependent OpenCode launch case. Browser actions used CLAND_OPENER recording and the generated pinned Mermaid page was inspected; real browser/CDN rendering was not exercised. No persistent T-55 failure remained after the requested isolated reruns. No product files changed; no push or merge.

### impl-55 · 2026-10-09T09:47:50.489Z

Coordinator directed a second merge because main advanced to T-65 (9826a2b). Resolved only the two clause conflicts in repository/default role definitions by retaining both artifact guidance and T-65 full-access clause lines. All T-65 launch defaults/docs/test changes retained. Running typecheck and one full suite; will commit/report after verification.

### impl-55 · 2026-10-09T09:57:42.405Z

Second main merge committed: 2637e6c0836cf9946caf8989dd3fef1360f5754a (main 9826a2b). Retained T-65 repository/built-in full-access launch defaults, launch clause lines and documentation, plus all four artifact guidance lines in both role definitions. No artifact/UI code changed in this merge; .cland/tasks matches main and branch is clean.
Validation: npm run typecheck passed. One full hub run: 269 pass, 1 failure, 7 documented skips; failure was clause-turn startup not reaching busy→idle within 15000ms under load. Exact Claude attribution test rerun alone passed parent and two subtests (3/3). npm stopped before Neovim, so its suite ran separately once: 66 pass, 0 fail, 0 skips. git diff --cached --check clean before commit.

### impl-55 · 2026-10-09T10:01:27.705Z

Final forward merge committed: 8fae35c6e9c36dfde2bbfe148fda4c2c7a82cbf1, merging main fcf9a2d (T-53/T-54/T-51). Kept T-53 territory init tests and release instruction assertion with T-55 artifact guidance assertion; README keeps T-51 reconnect documentation and artifact.create tool entry. Remaining code changes merged automatically. Validation requested by Coordinator: npm run typecheck passes; node --test hub/test/init.test.ts 11/11 pass, no failures/skips. git diff --check clean, branch clean, .cland/tasks matches main. No full suite rerun, as both sides had already run it.
