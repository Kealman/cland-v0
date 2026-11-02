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
updated: 2026-11-02T10:15:42.882Z
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
- [x] C2. Every consumer that read `hub/README.md` sections or anchors (docs links, doc-lint, qa lint references, help text, tests) reads the new files, and all of them pass with no assertion weakened.
  - done: impl-1631 · 2026-11-02T09:56:45.020Z
  - verified: rev-35 [reviewer] · run rev-35-1631-final-1 · 2026-11-02T10:15:42.397Z · commit 77b858c97343c6185fc6e21cd7702a136cb8f256
- [x] C3. `.agents/skills/implement/SKILL.md` keeps its procedure and points to `docs/hub/` for subsystem detail; its moved paragraphs exist unchanged in the target files.
  - done: impl-1631 · 2026-11-02T09:53:09.647Z
  - verified: rev-35 [reviewer] · run rev-35-1631-source-2 · 2026-11-02T09:57:22.246Z · commit 77b858c97343c6185fc6e21cd7702a136cb8f256
  - verified: rev-35 [reviewer] · run rev-35-1631-final-1 · 2026-11-02T10:15:42.397Z · commit 77b858c97343c6185fc6e21cd7702a136cb8f256
- [x] C4. `docs/agents/` states where item doc text goes, and the skill's doc step names that rule.
  - done: impl-1631 · 2026-11-02T09:53:09.726Z
  - verified: rev-35 [reviewer] · run rev-35-1631-source-2 · 2026-11-02T09:57:22.246Z · commit 77b858c97343c6185fc6e21cd7702a136cb8f256
  - verified: rev-35 [reviewer] · run rev-35-1631-final-1 · 2026-11-02T10:15:42.397Z · commit 77b858c97343c6185fc6e21cd7702a136cb8f256

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
