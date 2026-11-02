---
id: T-1631
kind: task
title: Split hub/README.md into per-subsystem docs to end the merge hotspot
state: open
status: ready
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: topic-1335
branch: t/T-1631-split-hub-readme-md-into-per-subsystem
created: 2026-11-02T07:58:56.878Z
updated: 2026-11-02T18:46:39.976Z
---

## Summary

`hub/README.md` (8,517 lines, 47 sections) and `.agents/skills/implement/SKILL.md` (1,651 lines) are the merge hotspot of the 0.4 build: on 2026-11-01/02 about 15 item merges had to merge dev again and repeat a delta review (often a fresh verify) only because two parallel items each added a paragraph to these two files. Split the hub README into one file per subsystem under `docs/hub/`, keep `hub/README.md` as a short index of pointers, and move the implement skill's subsystem paragraphs into those docs, leaving the skill with pointers.

## What to build

- `docs/hub/<subsystem>.md` per current `hub/README.md` section (merging trivially small sections into their parent subsystem), content moved verbatim; `hub/README.md` becomes an index with one line per file.
- Every link, test fixture, lint and doc check that reads `hub/README.md` by section or anchor follows the move (search `hub/src`, `hub/test`, `web/`, `nvim/`, `docs/`, `.agents/`, `qa/`).
- The implement skill keeps its procedure; subsystem-specific paragraphs move to the matching `docs/hub/` file and the skill points to it.
- A short rule in `docs/agents/` says where an item adds doc text: its subsystem's `docs/hub/` file, never the index.

## Acceptance criteria

- [x] C1. `hub/README.md` is an index of pointers under 150 lines, and every former section's text exists unchanged in exactly one `docs/hub/` file (test: a script compares the old section bodies with the new files).
  - done: impl-1631 · 2026-11-02T09:53:09.483Z
  - verified: rev-35 [reviewer] · run rev-35-1631-source-2 · 2026-11-02T09:57:22.246Z · commit 77b858c97343c6185fc6e21cd7702a136cb8f256
  - verified: rev-35 [reviewer] · run rev-35-1631-final-1 · 2026-11-02T10:15:42.397Z · commit 77b858c97343c6185fc6e21cd7702a136cb8f256
  - verified: rev-35 [reviewer] · run rev-35-1631-delta-source-1 · 2026-11-02T17:08:31.990Z · commit 9fd9aa594f0a2079e47dbddd1dca1c2748ae94be
  - verified: rev-35 [reviewer] · run rev-35-1631-final-2 · 2026-11-02T17:33:09.509Z · commit 9fd9aa594f0a2079e47dbddd1dca1c2748ae94be
  - verified: rev-35 [reviewer] · run rev-35-1631-delta-source-2 · 2026-11-02T18:24:49.683Z · commit 3cd8ea0b5bbe3e55fe41d19448bc2a82fb135369
  - verified: rev-35 [reviewer] · run rev-35-1631-final-3 · 2026-11-02T18:46:39.834Z · commit 3cd8ea0b5bbe3e55fe41d19448bc2a82fb135369
- [x] C2. Every consumer that read `hub/README.md` sections or anchors (docs links, doc-lint, qa lint references, help text, tests) reads the new files, and all of them pass with no assertion weakened.
  - done: impl-1631 · 2026-11-02T09:56:45.020Z
  - verified: rev-35 [reviewer] · run rev-35-1631-final-1 · 2026-11-02T10:15:42.397Z · commit 77b858c97343c6185fc6e21cd7702a136cb8f256
  - verified: rev-35 [reviewer] · run rev-35-1631-final-2 · 2026-11-02T17:33:09.509Z · commit 9fd9aa594f0a2079e47dbddd1dca1c2748ae94be
  - verified: rev-35 [reviewer] · run rev-35-1631-final-3 · 2026-11-02T18:46:39.834Z · commit 3cd8ea0b5bbe3e55fe41d19448bc2a82fb135369
- [x] C3. `.agents/skills/implement/SKILL.md` keeps its procedure and points to `docs/hub/` for subsystem detail; its moved paragraphs exist unchanged in the target files.
  - done: impl-1631 · 2026-11-02T09:53:09.647Z
  - verified: rev-35 [reviewer] · run rev-35-1631-source-2 · 2026-11-02T09:57:22.246Z · commit 77b858c97343c6185fc6e21cd7702a136cb8f256
  - verified: rev-35 [reviewer] · run rev-35-1631-final-1 · 2026-11-02T10:15:42.397Z · commit 77b858c97343c6185fc6e21cd7702a136cb8f256
  - verified: rev-35 [reviewer] · run rev-35-1631-delta-source-1 · 2026-11-02T17:08:31.990Z · commit 9fd9aa594f0a2079e47dbddd1dca1c2748ae94be
  - verified: rev-35 [reviewer] · run rev-35-1631-final-2 · 2026-11-02T17:33:09.509Z · commit 9fd9aa594f0a2079e47dbddd1dca1c2748ae94be
  - verified: rev-35 [reviewer] · run rev-35-1631-delta-source-2 · 2026-11-02T18:24:49.683Z · commit 3cd8ea0b5bbe3e55fe41d19448bc2a82fb135369
  - verified: rev-35 [reviewer] · run rev-35-1631-final-3 · 2026-11-02T18:46:39.834Z · commit 3cd8ea0b5bbe3e55fe41d19448bc2a82fb135369
- [x] C4. `docs/agents/` states where item doc text goes, and the skill's doc step names that rule.
  - done: impl-1631 · 2026-11-02T09:53:09.726Z
  - verified: rev-35 [reviewer] · run rev-35-1631-source-2 · 2026-11-02T09:57:22.246Z · commit 77b858c97343c6185fc6e21cd7702a136cb8f256
  - verified: rev-35 [reviewer] · run rev-35-1631-final-1 · 2026-11-02T10:15:42.397Z · commit 77b858c97343c6185fc6e21cd7702a136cb8f256
  - verified: rev-35 [reviewer] · run rev-35-1631-delta-source-1 · 2026-11-02T17:08:31.990Z · commit 9fd9aa594f0a2079e47dbddd1dca1c2748ae94be
  - verified: rev-35 [reviewer] · run rev-35-1631-final-2 · 2026-11-02T17:33:09.509Z · commit 9fd9aa594f0a2079e47dbddd1dca1c2748ae94be
  - verified: rev-35 [reviewer] · run rev-35-1631-delta-source-2 · 2026-11-02T18:24:49.683Z · commit 3cd8ea0b5bbe3e55fe41d19448bc2a82fb135369
  - verified: rev-35 [reviewer] · run rev-35-1631-final-3 · 2026-11-02T18:46:39.834Z · commit 3cd8ea0b5bbe3e55fe41d19448bc2a82fb135369

## Comments

### impl-1631 · 2026-11-02T09:47:42.154Z

Coordinator-approved verbatim exception (decision cda655a1-81c8-460c-9ad6-d7a7523ac7a0): docs/hub/cland-init-and-cland-update.md old sentence: An Aide whose current harness policy permits root Git writes commits and runs `cland push` itself. New sentence: An Aide with current root Git write access commits and runs `cland push` itself. Onboarding-claims now scans the moved docs/** text; the guard remains unchanged. The comparison script prints both sentences explicitly. All other prose stays unchanged; link destinations are mechanically relocated.

### impl-1631 · 2026-11-02T09:52:56.187Z

Consumer inventory A-15778 lists executable readers, docs/link/QA consumers and unaffected historical/path fixtures. Mechanical proof: docs/hub/check-move.py against baseline 2 exported source files; manifest records baseline SHA, byte hashes and offsets. 45 full README source segments (headings inside fences excluded) cover the complete original file exactly once, and 221 moved skill blocks remain. Index 50 lines; skill 134 lines. Five approved same-meaning onboarding sentence clarifications are quoted old/new in manifest and script output. Link-only relocation is separately checked so arbitrary prose edits cannot hide in receipts. Local macOS arm64 / Node 24.21.0: typecheck and test:lint passed (lint advisory findings remain report-only); targeted web-readme 3, roles-clauses 39, install-claims 3, test-docs 4, remote-docs 26 and session-usage 7 cases passed. No Web/browser phase or full verifier run yet; source review precedes verify. Existing prerequisite advisory T-1484 persists; Site import boundary is clear after sharing the repository text reader under shared/.

### rev-35 · 2026-11-02T09:55:55.321Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1631-source-1
commit: 41b2511e323e92d2e9ba3b061c8579534df0e737
scope: full
findings: [{"severity":"medium","text":"Unrelated normalization changes valid HTTPS://example.test/path into HTTPS:/example.test/path but retains the expected link token. Unchanged safeAddress requires two slashes and returns malformed destination as literal text, so this assertion cannot pass. Restore the original fixture and restrict mechanical relocation to actual repository references; C2 fails.","file":"hub/test/web-markdown.test.ts","line":63},{"severity":"low","text":"Unrelated ./ link normalization also edits the kept upstream domain-modeling skill and its GLOSSARY-FORMAT resource, without a record under metadata.changes:CHANGES (rule16). Revert unrelated normalization, or record the retained edit in that skill's CHANGES.","file":".agents/skills/domain-modeling/SKILL.md","line":65}]
finding_counts: {"high":0,"medium":1,"low":1}

Full source not clear, one medium/one low. web-markdown.test.ts:63 external uppercase URL corrupted by relocation, expected token unchanged; safeAddress's double-slash rule proves mismatch. Restore original fixture; listed targeted checks omitted this modified test. Low domain-modeling skill/resources unrelated link normalization lacks upstream CHANGES record; prefer revert. Independently compared pinned blobs:266 blocks hash/destination receipts match;45 README segments cover full baseline exactly once,221 skill blocks retained, no unmoved nonblank procedure lines missing; index50/skill134lines. Read actual Coordinatorcda655a1/1a950260: five quoted same-meaning onboarding exceptions authorized. Placement rule and skill step present; readers/role/help/QA pointers otherwise migrate with assertions retained. A-15780 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15780-t-1631-source-review-unintended-markdown-fixture-normalization.md) records both axes/proof/limits. C2 failed; C1/C3/C4 not marked in this pass. Reviewer executed no tests/hub/browser, made no edits; comparison was read-only blob analysis. Fresh source review before queued verification.

Criteria: C2 failed (Modified web-markdown fixture uses HTTPS:/ but still expects HTTPS:// link; unchanged parser rejects the malformed destination.).

### impl-1631 · 2026-11-02T09:56:34.893Z

Addressed review rev-35-1631-source-1. Restored hub/test/web-markdown.test.ts byte-for-byte from the pre-item baseline, plus both domain-modeling files and skills/README.md (unrelated ./ and trailing-slash normalization). Audited all non-move diff hunks: those four were the unrelated path normalizations; remaining changes are moved README links/readers, help and role reference paths, or required QA consumer migrations. Local macOS Node 24.21.0 exact web-markdown file reproduced `HTML, images and unsafe or unsupported link destinations remain literal text` failing (6/7 pass), then passed 7/7 after restore; no assertion edits. Comparison script still passes. No dev merge after first review.

### rev-35 · 2026-11-02T09:57:22.246Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1631-source-2
commit: 77b858c97343c6185fc6e21cd7702a136cb8f256
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear, no findings. Four restored files now byte-identical to baseline d92844ff: web-markdown valid uppercase HTTPS fixture, domain-modeling skill/resource, skillsREADME. Prior medium/low resolved without changing assertions; no dev merge. C1/C3 verified by prior independent pinned-blob analysis of unchanged movement:45 README segments exact-once/full coverage,221 moved skill blocks retained, no unmoved procedure lines absent; index50/skill134lines. Actual Coordinatorcda655a1/1a950260 authorize the five quoted minimal onboarding prose exceptions; link-only moves separately represented. C4 verified: documentation placement rule+skill doc step. Consumers/role/help/frozen fixture/shared reader/QA commands otherwise unchanged since full inspection. C2 execution remains unverified pending named exact-head queued results; reported local Markdown6/7 red→7/7green/comparison are targeted. A-15781 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15781-t-1631-corrected-source-review-at-77b858c97.md). Reviewer ran no tests/browser and made no edits.

Criteria: C1 verified, C3 verified, C4 verified.

### rev-35 · 2026-11-02T10:15:42.397Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1631-final-1
commit: 77b858c97343c6185fc6e21cd7702a136cb8f256
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear,C1–C4 verified,no findings. C1/C3/C4 carry sourceclear A-15781's independent266block movement/procedure/placement proof with five explicit Coordinator-approved onboarding exceptions. C2: independently read A-15784 named pass facts: web-readme3,roles-clauses39,install-claims3,test-docs4,session-usage7,restored Markdown7,CLI-help5,frozen usage1; site remote-docs22/onboarding3,hub remote-docs wrapper1/pairing1,changed native roles4. Assertions retained; source-inspected QA inputs migrate; pinned consumer search has no hub/README.md# links. QA demo/browser not run or required. Queued50beddd2 exacthead exit0/4716pass/zero fail,cancel,skip,todo;T0/T1/all fallbackT2/changedT3roles4/Web complete,remainingT3 batch,T4 unexecuted. Changed native once/no repetitions; selected duration13.877s excludes machinewait,not suite walltime. Linuxx64 6.8.0-142-generic Node24.21/Nvim.12.5;treec4ee8b1fde0768190e04c84581732fa14710910b;isolatedHeadlessShell1248/ChromeForTesting156.0.8078.4;cache/occasionnull,skips[],skipreasonreport/missing0. Budget/lint/ratchet report-only;no full premerge claim. A-15786 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15786-t-1631-final-evidence-review-at-77b858c97.md). Reviewer ran no tests/browser and made no edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-1631 · 2026-11-02T17:06:35.853Z

Coordinator go a94a781d: merged origin/dev ad295a54c672ed08937a7c62c5655e89f9da5e38. Resolved README/implement skill conflicts by carrying every upstream source section/paragraph into docs/hub and refreshing manifest.base (previousBase recorded). Proof now covers 45 complete README segments and 237 moved skill blocks, plus checks every retained skill paragraph. Existing five approved same-meaning onboarding exceptions remain; no new prose exception. New consumer inventory: hub/test/host-agent.test.ts's README assertion (escaped descendant authority sentence) now reads its exact owning subsystem file; assertion unchanged. CLI usage fixture conflict retains upstream users-mode flags/password help plus our relocated authority pointer. Read-only Markdown destinations checked for existence. No local test files/typecheck run during Coordinator's cover-quiet; fresh source delta review precedes queued verification.

### rev-35 · 2026-11-02T17:08:31.990Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1631-delta-source-1
commit: 9fd9aa594f0a2079e47dbddd1dca1c2748ae94be
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1631 authorized merge delta source review at 9fd9aa594f0a2079e47dbddd1dca1c2748ae94be. Scope delta. Prior source/final head 77b858c97343c6185fc6e21cd7702a136cb8f256; incoming dev parent ad295a54c672ed08937a7c62c5655e89f9da5e38. Read actual Coordinator go a94a781d and its preservation/fresh-verification requirements.

Standards: no findings. Conflict resolutions retain merged dev help/users/password/Host text. New host-agent consumer changes only README location to its exact moved subsystem file, retaining the escaped-descendant sentence and assertion. Help WEB_USAGE pointer and independent frozen block move together. Other previously reviewed consumer/role/QA/link migrations remain applicable; no hub/README.md# references remain outside historical tracker/receipt data. Remaining README links intentionally target the index.

Spec: no findings. Independently inspected pinned Git blobs rather than relying solely on A-15915 or executing the shipped comparison script:
- Manifest baseline equals authorized incoming dev.
- All source offsets, byte lengths and SHA256 receipts match: 45 README segments and 237 moved skill blocks.
- Reversing all 125 position-bound relocations reproduces each original source block. README segments cover the entire old README in order, each occurs exactly once in its sole owning destination.
- All 37 retained nonempty skill paragraphs remain after reference normalization. Index is 50 lines; skill procedure 134 lines.
- Destination transformations are reference relocations plus the same five previously approved onboarding wording exceptions (cda655a1/1a950260); no new prose exception. All 113 relative Markdown destinations in the 45 moved destination files exist at this head.
- Documentation placement rule and skill doc step remain present and consistent.

C1/C3/C4 verified by this static source comparison. C2 remains unverified pending a fresh exact-head queued run, including the new host-agent reader case and prior docs/role/help/QA-reader preservation. Old run 50beddd2 applies only to 77b858c97 and is not evidence for this merge. No local tests/typecheck/browser or hub/Git harness experiment ran; only read-only pinned-blob inspection/comparison. Active cover-quiet respected. QA policy unchanged.

Criteria: C1 verified, C3 verified, C4 verified.

### rev-35 · 2026-11-02T17:33:09.509Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1631-final-2
commit: 9fd9aa594f0a2079e47dbddd1dca1c2748ae94be
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1631 merged-head final evidence at 9fd9aa594f0a2079e47dbddd1dca1c2748ae94be. Scope evidence. Source clear rev-35-1631-delta-source-1 / A-15917 remains applicable; branch tip still equals reviewed head.

Standards: no findings. Spec: no findings. C1–C4 verified.

C1/C3/C4 carry this head's independent pinned-blob comparison: 45 complete README segments, 237 moved skill blocks, 37 retained procedure paragraphs, index50/skill134 lines, 125 position-bound relocations and same five explicitly approved onboarding exceptions; all113 moved relative link destinations exist. Documentation placement rule and skill doc step present. No old-head runtime result is reused.

C2 actual timing outcomes independently streamed from A-15925:
- web-readme3, roles-clauses39, install-claims3, test-docs4, session-usage7, web-markdown7 pass.
- Native CLI help7 and independent frozen usage compatibility1 pass.
- site remote-docs22/onboarding-claims3, hub remote-docs wrapper1 and pairing1 pass.
- Changed native roles4 and host-agent18 pass. Specifically, the escaped-descendant authority case passes with its exact moved subsystem-file assertion intact (A-15925 line25493). Reader migration changed only the file location.
Source review retained all assertions and checked QA/docs/role/help readers and absence of stale README-anchor destinations. No QA demo was executed or required (item QA scope none).

Queued run caba420c-c20c-4ae8-a1ec-6df61e3efe35 / A-15925: exit0,4858 pass,zero fail/cancel/skip/todo. T0/T1/fallback allT2/Web completed plus selected changed/merged T3 six files39 identities once for duration check. Remaining T3 deferred to merge batch; T4 unexecuted. This is task verification, not full merge-batch coverage.

Recorded provenance: head above, runner tree c57d55c6c7106838ab2a2ec2dd082c72441515be, uncached Linux x64 6.8.0-142-generic droplet, Node v24.21.0, Neovim v0.12.5. Browser /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. Host typecheck used runner tree and was not repeated remotely. Budget/lint/ratchet/skip-reason checks report-only; skips[]/missing0, occasion null. Duration projections not counted as executions. Cover-quiet respected; Reviewer ran no tests/browser and made no edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-35 · 2026-11-02T18:24:49.683Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1631-delta-source-2
commit: 3cd8ea0b5bbe3e55fe41d19448bc2a82fb135369
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1631 final-wave merge source review at 3cd8ea0b5bbe3e55fe41d19448bc2a82fb135369. Scope delta. Parents are reviewed 9fd9aa594f0a2079e47dbddd1dca1c2748ae94be and authorized dev ef7b25068a75c9166e3134a59465a4bdfdd449a0. Read Coordinator go90dbbbb7 permitting this merge and requiring refreshed proof/source/verify.

Standards: no findings. Own delta is docs/hub/running.md's snapshot-retirement amendment and moved implementation paragraph, plus manifest baseline/offset/hash/link receipts. Incoming T-1620/T-1636 production/tests retain dev bytes; prior host-agent reader/help/role migrations and shared procedure are unchanged. New snapshot/state test readers do not introduce README section consumers.

Spec: no findings. Independently inspected pinned Git blobs against ef7b2506:
- All offsets, byte lengths and SHA256 receipts match 45 complete README segments and 238 moved skill blocks.
- Reversed position-bound relocations recover source bytes. README covers the whole baseline in order and each segment exists exactly once in its sole target file.
- All37 retained nonempty procedure paragraphs remain after reference normalization; index50 lines and skill134 lines unchanged.
- Destination prose changes remain reference relocations plus the same five previously approved onboarding exceptions; none added.
- Snapshot GET404/retained-ID wording and skill paragraph match T-1620's incoming text. C4 placement document and skill documentation step unchanged.

C1/C3/C4 verified at this head by static comparison. C2 awaits fresh exact-head queued reader/help/role evidence and relevant incoming preservation tests. Prior caba420c applies only to9fd9aa594 and is not a pass for this merge. A-15943's comparison receipt is consistent with independent inspection. No local tests/typecheck/browser or mutation ran. QA scope none remains.

Criteria: C1 verified, C3 verified, C4 verified.

### rev-35 · 2026-11-02T18:46:39.834Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1631-final-3
commit: 3cd8ea0b5bbe3e55fe41d19448bc2a82fb135369
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1631 final-wave evidence at 3cd8ea0b5bbe3e55fe41d19448bc2a82fb135369. Scope evidence. Branch tip and source-clear rev-35-1631-delta-source-2 / A-15944 agree. Standards: no findings. Spec: no findings. C1–C4 verified.

C1/C3/C4 carry independent static proof at this head: 45 full README segments, 238 moved skill blocks, 37 retained procedure paragraphs, index50/skill134 lines, exact source hashes/coverage/single ownership after reversing relocations, same five authorized onboarding exceptions, matching placement rule/doc step. Incoming T-1620/T-1636 code/tests unchanged.

C2 actual named timing outcomes independently streamed from A-15947:
web-readme3, roles-clauses39, install-claims3, test-docs4, session-usage7, web-markdown7, native CLI-help7, independent frozen usage1; site remote-docs22/onboarding3 and hub remote-docs1/pairing1 all pass. Selected native roles4 and host-agent18 pass, including moved escaped-descendant sentence assertion at line25513. Incoming snapshot-confirmation3/state-inventory2/state-paths-lint5 also pass. Prior source review established unchanged assertions and migrated docs/QA/help/role consumers.

Run30160926-49d9-40bc-b355-16628b7aa702/A-15947: exit0,4862 pass,zero fail/cancel/skip/todo. T0/T1/fallback allT2/Web plus selected T3 six files39 identities once for task duration check completed. Remaining T3 merge-batch deferred,T4 unexecuted. Task verification, not full merge-batch coverage. No older run counted for this head.

Provenance: runner tree8ffdfeef38ca4b06b916e55a4831dd380239892e, uncached Linux x64 6.8.0-142-generic droplet, Node v24.21.0/Neovim v0.12.5. Isolated browser /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. Host typecheck at runner tree not repeated remotely; budget/lint/ratchet/skip-reason checks report-only, skips[]/missing0/occasion null. Projections not execution evidence. QA scope none, no demo/browser QA required. Reviewer ran no tests/browser and made no edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
