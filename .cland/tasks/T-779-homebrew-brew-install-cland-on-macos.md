---
id: T-779
kind: task
title: "Homebrew: brew install cland on macOS"
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-778
blocked_by: []
topic: topic-983
branch: t/T-779-homebrew-brew-install-cland-on-macos
created: 2026-10-18T06:04:22.818Z
updated: 2026-10-24T14:27:24.171Z
closed: 2026-10-24T14:27:24.171Z
---

## Summary

The landing, the README and the install docs tell macOS users to run `brew install cland`. Nothing builds or publishes a Homebrew package yet.

## What to build

A Homebrew formula for cland, published so that the command on the site works, and updated by `cland release` on every release.

- `brew install cland` with no tap needs homebrew-core, which accepts only notable projects. Until then a tap (`Kealman/homebrew-tap`, installed as `brew install kealman/tap/cland`) is the realistic path; if the tap is the answer, change the landing, the README and `docs/install.md` to the tap form.
- cland needs Node 24 (`>=24.13 <25`): the formula depends on `node@24` or ships its own runtime.
- `brew upgrade cland` and `brew uninstall cland` work as `docs/install.md` describes.

## Acceptance criteria

- [x] C1. Before merge, sealed local source archives prove the shared installer build that the formula uses, and pure formula checks pin the Node 24 dependency, the wrapper and the build contract. A clean-macOS `brew install`, `--version`, `doctor`, `upgrade` and `uninstall` through the published tap is landing evidence once the human creates `Kealman/homebrew-tap` (E-778 DoD C1).
  - done: impl-779 · 2026-10-24T13:42:52.161Z
  - verified: rev-32 [reviewer] · run rev-20261024-779-final · 2026-10-24T14:16:18.670Z · commit e12e380774bfbbc097c1d19003f673d3b31503d7
- [x] C2. `cland release` updates the formula to the new version.
  - done: impl-779 · 2026-10-24T13:51:38.130Z
  - verified: rev-32 [reviewer] · run rev-20261024-779-final · 2026-10-24T14:16:18.670Z · commit e12e380774bfbbc097c1d19003f673d3b31503d7
- [x] C3. The site, the README and docs/install.md show the command that works.
  - done: impl-779 · 2026-10-24T12:50:30.094Z
  - verified: rev-32 [reviewer] · run rev-20261024-779-final · 2026-10-24T14:16:18.670Z · commit e12e380774bfbbc097c1d19003f673d3b31503d7

## Comments

### impl-779 · 2026-10-24T12:48:51.576Z

Design approved by Coordinator in topic-983 (A-11019 plus decisions): Node@24 formula shares packaging/build-install.sh with curl installer; no Ruby/Homebrew in tests; opt-in committed release.homebrew.tap, exact tag URL preview with SHA recorded after product push, recoverable tap follow-up. Implemented sealed installer build/rollback receipts, pure formula/config checks and native local-bare tap publication/retry/race tests; initial targeted local macOS tests pass. Clean macOS brew install/audit/version/doctor/upgrade/uninstall is explicitly deferred to landing after human tap creation; pending availability is labelled in public docs. Source review will precede mode-free verification.

### rev-32 · 2026-10-24T13:39:37.247Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-779-source
commit: 09c0226203fa812b26e646d769d7ba9479e016b4
scope: full
findings: [{"severity":"medium","text":"M1: installer unconditionally runs a helper absent from supported old tag archives, including documented v0.2.0. Preserve legacy locked build compatibility and add sealed old-layout install/update/failed-update regression; current fixtures always inject the helper.","file":"site/public/install.sh","line":109},{"severity":"medium","text":"M2: checksum test is wholly in-memory with fetch mocked, but declares T2. Project test-level rules170/337 require lowest adequate tier; move manifest/header/guide to T1, retaining all checksum/status/empty/interrupted assertions.","file":"hub/test/homebrew-download.test.ts","line":1}]
finding_counts: {"high":0,"medium":2,"low":0}

# T-779 full source review — not clear

Head 09c0226203fa812b26e646d769d7ba9479e016b4; tree c6c29678385170f3643a9ed5d01ced2a6de52d2e. Fixed base/merge-base 011db12c72f5d7d5ee8ca2eed68c637c0e6586a8; parents 357c61e2c0cf98597f2d921250b1f4846ace86e8 and that dev head, integrated before first review. Origin matches, task tree clean, whitespace check passes. Source-only, no configured run. Both axes personally reviewed read-only, without delegation.

## Spec

M1 medium — site/public/install.sh:109.
The served installer unconditionally executes packaging/build-install.sh from the downloaded archive. Older released layouts do not contain that new file: read-only git ls-tree of the local v0.2.0 tag (peeled de29dda8a0afd2ea4a94565311b97d310ccf7980) has no packaging/build-install.sh. The installer help still explicitly supports CLAND_VERSION=v0.2.0 and install.md:54 still recommends exactly that pin. It now reaches sh with a nonexistent path and fails before installation. No runtime reproduction is claimed; this follows from the pinned source and tag layout.

Every installer test archive now copies the new helper at hub/test/install-script.test.ts, masking the old-layout case. Keep the shared helper for new releases and retain a compatibility build path for supported archives lacking it. Add a sealed old-layout archive regression for initial installation, update and failed-update preservation; keep lifecycle-script disabling, locked dependency build/prune, lockfile mtime and existing rollback assertions. Claimant agrees this is valid (ca8801db) and proposes that bounded correction. C1 cannot clear with this regression.

Other source assessment:
Node@24 dependency/minimum check and runtime PATH wrapper match the revised formula contract. The formula and new-layout curl installer call the same locked-build/prune script, which restores lockfile bytes/mtime with an exit trap. No real Ruby/Homebrew execution is claimed.

The opt-in committed release.homebrew.tap defaults empty and validates owner/homebrew-name. Dry-run includes repository/main/Formula/cland.rb/version/exact tag URL and describes the later SHA. After product/local publication, release hashes the bounded completed archive, persists SHA, renders the formula from the pinned release commit and performs a parented, leased tap push. Retry retains the original plan and checks the actual remote blob to recover a lost accepted push reply; unrelated tap entries survive and races refuse. Native tests retain durable refs/blob assertions, failed-download and lost-reply controls. C2 remains runtime pending, not failed by a speculative native-install limitation.

The public README, site/copy action, install/quickstart and release docs use kealman/tap/cland and honestly label the tap pending, with source alternatives. Matching release help, hub documentation, agent procedure, project-owned release skill and existing Coordinator clause describe destination approval, receipt recovery and final SHA/comment. Human creates the tap; no authority expansion or new clause line. C3's source copy is otherwise aligned; the documented old release pin remains affected by M1.

Coordinator decisions 63f39f0d and 83d60380 read independently: one approval covers the previewed tag URL/destination, hashing needs no second preview, and C1 pre-merge evidence is sealed archive/shared-build plus pure formula tests. Clean-macOS published-tap install/version/doctor/upgrade/uninstall is E-778 after-landing evidence, not a pre-merge condition. No request for that external evidence here.

## Standards

M2 medium — hub/test/tiers.json (homebrew-download entry), hub/test/homebrew-download.test.ts:1.
This checksum test is declared T2, but fetch is fully mocked and all Response/ReadableStream inputs are owned in memory. It opens no socket or component/harness and measures no real timing. docs/agents/tests.md:170,337 requires the lowest adequate tier; this is a T1 pure response/checksum contract. Move the manifest/header/canonical guide to T1 without removing the known SHA, HTTP status, empty-body and interrupted-stream assertions. Retain the separate native Git publication T3 and sealed installer T3 contracts.

No additional standards finding. The native publication seam uses owned disposable product/territory/tap roots and re-seals the Git environment after overlays; Git calls have the shared 30 s bound. No daemons or GUI are started. Per-test notes have path-derived headings/index entries. The release skill is project-owned; upstream CHANGES requirements do not apply to it.

## Evidence and disposition

A-11044 reports pre-integration implementation-tree macOS arm64 local typecheck/static/tier checks, formula2/2, checksum1/1, native publication2/2, installer5/5, 32 targeted release regressions and site23pages. This packet is a summary; complete original command/stdout/stderr/exit/native timing records have not been independently audited here. Preserve available originals durably with exact head/tree or dirty-source attribution and missing/truncated limits; do not rerun for transcription. No configured suite exists at reviewed head.

Complete consolidated finding set: M1 and M2 only. C1 failed for installer compatibility; C2/C3 unverified in this pass. Correct test-first, retain original/fix receipts, commit/push, restore claimant C1 done and request fresh full source review before configured mode-free verification. No post-review dev merge absent Coordinator direction. QA none/after-stage. No real Homebrew, external publication, test execution, browser or Git mutation by reviewer.

Standards: 1 medium finding. Spec: 1 medium finding.
Durable audit A-11097.

Criteria: C1 failed (Shared-build extraction breaks supported older release archive installation; old-layout regression and correct lowest-tier checksum contract are required before verification.).

### rev-32 · 2026-10-24T13:44:40.749Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-779-source2
commit: de9d06c49b17876f53a43e1dc07bde84958826db
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-779 corrected full source review — clear

Head de9d06c49b17876f53a43e1dc07bde84958826db; tree eee526be17e95f5b61926986eba1d60b8438fd40. Sole parent 09c0226203fa812b26e646d769d7ba9479e016b4; fixed base 011db12c72f5d7d5ee8ca2eed68c637c0e6586a8. Origin matches, task tree clean, fixed-base whitespace check passes. No dev merge after first source review. Scope full after correction, carrying A-11097's completed source assessment. Both axes reviewed in-session, no delegation or execution.

## Spec

M1 resolved. The curl installer selects the shared packaging/build-install.sh only when the downloaded archive contains it; otherwise it restores the previous locked npm ci/build/prune/cp-p lockfile-mtime sequence. Comparing against the pre-refactor installer confirms the legacy build flags and lockfile preservation are retained. Existing staging, interruption, previous-install restoration and failed-rollback retention remain.

The added sealed old-layout archive case deliberately omits packaging/helper, installs two versions, verifies working CLI/version and Web output, pruned build dependency and lockfile mtime, then checks a broken update preserves the preceding command and releases its lock. The interruption case now also uses old-layout archives and keeps its original durable observer and rollback assertions. New-layout shared-build tests and separate failed-rollback retention remain. Installer help/install docs' v0.2.0 pin is again supported by the compatibility path.

Formula, shared helper, config and tap publication code are byte-identical to the initially audited source. Carry Node@24/minimum/runtime wrapper, committed opt-in plan, bounded archive hash, pinned template, persisted SHA, parented lease-protected tap push, unrelated-entry preservation and lost-reply recovery assessment. No new production finding.

## Standards

M2 resolved. homebrew-download.test.ts header, tiers.json and canonical guide now consistently classify the in-memory response/checksum contract as T1. Test body and known SHA/HTTP/empty/interrupted assertions are unchanged. Native publication and installer remain T3 with owned scratch environments and bounded native calls. The existing interruption test identity was restored rather than deleting/renaming its baseline. No test timeout, assertion or duration allowance relaxation.

Matching install/hub/test documentation explains old-layout fallback and new-layout shared build. Other public copy, release help/skill/Coordinator clause and pending-tap availability remain as audited. No additional standards findings.

## Evidence and limits

A-11102 preserves original correction-working-tree red/green commands/output with local Darwin arm64 attribution. The new old-layout test first fails with “sh: packaging/build-install.sh: No such file or directory” (Node runner1091.979334 ms). Full corrected-body installer run passes6/6 (runner13490.625084 ms; new old-layout case2788.396625 ms). That full run temporarily renamed the existing interruption identity; after restoring its historical name, the final named rollback test passes1/1 (2819.717583 ms; runner2921.56925 ms). Thus the intermediate full-run title is not silently represented as a final-title run; the test body is retained.

The same artifact reports checksum1/1 (Node131.568584 ms), typecheck/static/tier lint exit0, generic lint133 findings/zero refusals and site23pages. Those latter entries are summaries, not independently inspected full raw command transcripts. A-11044's original implementation-tree claims retain their earlier provenance. Preserve available original records without transcription reruns and label missing/truncated material. Fresh configured evidence must supply exact-head completed phases, new identities/timings and actual gate modes; none exists yet.

Coordinator 63f39f0d/83d60380's accepted boundary remains: sealed source archive/shared build and pure formula contract before merge; human creates the tap, then clean-macOS public brew install/version/doctor/upgrade/uninstall supplies E-778 landing evidence. No real Homebrew or publication pass claimed here.

Clear source, findings []. C1–C3 remain unverified pending fresh configured mode-free verification at this unchanged head. Claimant done marks restored. Proceed with ordinary verification routed to Reviewer/item lead; any changed head requires fresh source review. QA none/after-stage. Read-only Git/source/artifact inspection only, no test, browser, edits, merge or subagent. Standards0 findings; Spec0 findings.
Durable audit A-11107.

### rev-32 · 2026-10-24T13:50:31.387Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-779-evidence1
commit: de9d06c49b17876f53a43e1dc07bde84958826db
scope: evidence
findings: [{"severity":"medium","text":"M3: project Coordinator clause reply measures6535 bytes above enforced6528 ceiling. Shorten added release/tap wording without dropping approval/authority/no-delegation semantics; keep ceiling/assertion unchanged. Configured run stops T1; T2/changedT3/Web unexecuted.","file":".cland/roles.toml","line":74}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-779 failed configured evidence at de9d06c4 — not clear

Exact head de9d06c49b17876f53a43e1dc07bde84958826db; tree eee526be17e95f5b61926986eba1d60b8438fd40. Source2/A-11107 remains the reviewed implementation basis. Independently read original configured run1e2939cd-61f0-410f-9ec6-3114e722a17b / A-11118 and task.view's exact-head failed result.

## Standards / blocking evidence

M3 medium — .cland/roles.toml:74, checked by hub/test/roles-clauses.test.ts:49.
Original output at A-11118 lines5095–5110: “project coordinator: clause reply is 6535 bytes; 15% growth headroom requires at most 6528 of 7680 bytes”. The project Coordinator release instruction grew from216 to237 UTF-8 bytes in this item. Its added tap/URL wording crosses the enforced reply reserve by7 bytes. This is an actual assertion failure, not report-only duration/lint output.

Shorten the item's clause wording while retaining tap/URL approval, human version authority, Aide/stand-in recorded choice, acceptance policy, no delegation and clean-root sync. Preserve semantic alignment with the built-in Coordinator clause. Do not change the byte ceiling, growth reserve, role-clause assertion or other instructions. Claimant aec1d4c1 reports exact local reproduction and plans this correction; this reviewer executed no reproduction. Initial source review missed this reserve impact.

## Spec and execution

Overall exit1. T0 host check passes24.347 s; T1 exits1 (phase envelope70 s, runner suite wall65.36 s). T2, changed T3 installer/publication and Web have no executed receipt. Their projected counts/walls are not passes. No T4 completion.

Raw progress records show876 ordinary outcomes:875 pass/1fail,138 passing file records/1failing file record, zero skipped/cancelled. Fifteen extra load test/file records pass: formula2 identities plus checksum1, each5/5. The interruption footer's891 completed/890pass includes those15 repetitions; it is not891 ordinary tests.

Linux x64 6.8.0-142-generic, c-8 lon1 droplet cland-v0-c425abe8, Node v24.21.0, Neovim v0.12.5, workers2. Host gate c38872ac3be9f34c54a10243cf0c7a41b76961ee is reused remotely, not repeated. Lifetime185 s/cost$0.0129 are machine accounting.

Generic test lint/duration/ratchet remain report-only, with133 lint findings/60files and zero static refusals; missing formula/checksum baselines retained. The T1 clause reserve is a separate enforced assertion. T3 ratchet2195.304 equals base; no enforced all-phase or installation pass inferred.

M1 old-archive fallback and M2 checksum tier corrections remain intact by source, but required configured build/publication evidence did not run. C2 release integration fails the complete configured gate; C1/C3 remain unverified here. Real published-tap macOS checks remain E-778 landing evidence under the accepted split.

Disposition: evidence not clear, M3 only. Preserve A-11118; shorten the clause, commit/push, restore C2 done and request fresh source review before another ordinary mode-free run. No unchanged-head retry, test-limit change, unauthorized dev merge or real Homebrew request. Read-only inspection only, no test/probe/browser/edit/Git mutation/delegation. Standards/evidence1 medium; Spec no additional functional finding.
Durable audit A-11121.

Criteria: C2 failed (Configured release integration gate failed the project Coordinator clause byte reserve; fresh source-reviewed wording and complete same-head receipt required.).

### rev-32 · 2026-10-24T13:53:07.080Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-779-source3
commit: 37c8d5c9396490dba064cc1a0b30f811061d03e6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-779 corrected clause source review — clear

Head 37c8d5c9396490dba064cc1a0b30f811061d03e6; tree 3c4b48c615e5cae073d0e88df2b0258a8991a5cc. Commits10615f8a and37c8d5c9 follow reviewed de9d06c4 without a dev merge. Origin matches, task tree clean, fixed-base011db12c whitespace check passes. Scope full after correction, carrying completed source audits A-11097/A-11107 and failed evidence A-11121.

## Standards

M3 resolved. The complete change from source2 is two Coordinator release-clause lines: compact project wording and aligned built-in wording. Tap/URL and notes/version approval, human version authority, Aide/stand-in reference to that recorded choice, acceptance policy, no delegation and clean-root sync remain. No other role instruction or clause line added/removed; no test, byte ceiling or15% reserve change.

A-11124 preserves exact original 6535>6528 failed guard, the local red, an intermediate capitalization mismatch and final39/39 local clause tests. The project release line shrinks10 bytes, giving reported serialized reply6525<=6528. Both default/project byte and shipped-wording guards pass with the existing lowercase no-delegation assertion intact. No additional findings.

## Spec

M1 legacy archive fallback and sealed old-layout install/update/failure/interruption assertions, M2 T1 checksum classification, formula/Node wrapper, shared build and opt-in recovery-safe publication are unchanged from A-11107. No production build/publication behavior changed in this correction.

Matching detailed release skill/help/docs remain authoritative for approval destination, tag URL and post-push SHA; compact clause wording still points to that flow. Accepted pre-merge versus E-778 public-tap landing evidence split remains unchanged.

Evidence A-11124's final original Node output is local Darwin arm64 on the correction working tree later committed here:39 pass/0 fail/0skip, runner101.064375ms. The intermediate red/capitalization history is labelled; these timings are not a configured wall time. A-11118 remains a failed Linux task run at de9d06c4: T0pass/T1fail, no T2/changedT3/Web runtime. It cannot clear this changed head.

A-11108 additionally preserves the available original pre-integration installer/native/formula/checksum/release outputs with dirty-source and truncated site-output limits; those remain local historical evidence, not immutable-head configured receipts. Fresh runtime evidence must establish actual selected phases, identities, timings and gate modes.

Clear source, findings []. C1–C3 remain runtime-unverified pending an ordinary configured mode-free run at this exact unchanged head. C2 claimant done restored. Any changed head requires fresh source review before a new run; no post-review dev merge without authorization. QA none/after-stage; real brew/publication checks remain landing-only. Read-only inspection, no runtime execution, browser, source edit, Git mutation or delegation. Standards0 findings; Spec0 findings.
Durable audit A-11127.

### rev-32 · 2026-10-24T14:00:08.443Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-779-delta
commit: e12e380774bfbbc097c1d19003f673d3b31503d7
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-779 authorized dev integration delta — clear

Head e12e380774bfbbc097c1d19003f673d3b31503d7; tree efaa6fd235448efe880b3ce33ca18af8cb64c102. Parents source3-reviewed37c8d5c9396490dba064cc1a0b30f811061d03e6 and dev e053338bac873b11434b8fdc61a2a86516a63bd7. Origin agrees, task tree clean, dev-to-task whitespace check passes. Scope delta, carrying A-11097/A-11107/A-11127 and failed A-11121.

## Standards

Coordinator Agents8eb17d40 independently read: explicitly directs one fresh-dev integration after T-1214/T-1239, preserve command ownership/frozen bytes, then delta review and one new-head mode-free verification. The merge's second parent is that exact dev head. The actual landed T-1214 representation is blank-separated complete commandUsage rows with legacy exports, not separate files; this resolution preserves that architecture and claimant informed the Coordinator.

Only RELEASE_USAGE differs in the production command table and frozen commands.json relative to incorporated dev. Independent parsing confirms the row equals frozen data and contains the exact pre-integration Homebrew sentence, including its newline. All other frozen rows are unchanged. The legacy RELEASE_USAGE export still composes PUBLISH_USAGE + RELEASE_USAGE + SYNC_USAGE; export-composition and help-order fixtures and their three tests are unchanged. No test/assertion relaxation or dependency edit in this resolution.

Direct parent comparisons are empty for Homebrew/config/release orchestration, formula/shared build, installer and all Homebrew/installer tests, plus project/default Coordinator clause files. Thus M1 legacy compatibility, M2 T1 checksum and M3 compact approval/byte-reserve correction survive byte-identically. No new finding.

## Spec and evidence

The release help keeps opt-in tap, Formula/cland.rb/main, post-product push, exact tag URL preview and later SHA semantics. No command ownership or prior installer/publication behavior is discarded. Incorporated T-1239 and other dev changes remain inherited integration scope, not newly claimed independent full audits.

A-11140 reports original merged-working-tree local Darwin arm64 checks: frozen export1/1 (Node101.893667ms), actual CLI help1/1 (185.627417ms), native merge/merge-tree2/2 (1091.989125ms), clauses39/39 (184.808417ms), hub-only typecheck and tiers exit0. This packet provides summary/native durations rather than complete raw transcripts for these commands; retain original output if available, with provenance/missing limits, without transcription reruns. These are not configured or Linux receipts.

Run07a0a8d2 was admitted at37c8d5c9 before the authorized integration and remains old-head evidence only, regardless of eventual outcome. Failed A-11118 atde9d06c4 likewise stays historical. C1–C3 remain runtime-unverified pending fresh ordinary configured mode-free verification at this unchanged integrated head. Real published-tap macOS install/version/doctor/upgrade/uninstall remains E-778 landing evidence under the accepted split.

Clear delta source, findings []. Proceed with the Coordinator-requested single new-head task run, result to Reviewer/item lead; any further head change requires fresh source review. QA none/after-stage. Read-only source/Git/artifact inspection and parsing only, no tests, browser, edit, merge or delegation. Standards0 findings; Spec0 findings.
Durable audit A-11144.

### rev-32 · 2026-10-24T14:16:18.670Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-779-final
commit: e12e380774bfbbc097c1d19003f673d3b31503d7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-779 final integrated-head evidence review — clear

Head e12e380774bfbbc097c1d19003f673d3b31503d7; tree efaa6fd235448efe880b3ce33ca18af8cb64c102. Origin matches, task tree clean. Current delta/A-11144 and accepted full source3/A-11127 remain unchanged. Independently audited configured run74001b1b-3169-45a3-a1d5-6ef610f9866f / A-11178; task.view confirms exact-head finished/passed. Findings [].

## Standards

Actual task phases: host T0 exits0 (26.84 s), all T1 and fallback all hub/Neovim T2, two changed T3 files once and Web each exit0. Raw progress records establish3002 ordinary test passes across430 passing file records, zero failures/cancellations/skips. Three new T1 identities additionally pass5/5 repetitions each (15 test/file records), counted separately. No T4 or remaining general T3 pass claimed.

Linux x64 6.8.0-142-generic, c-8 lon1 droplet cland-v0-015c1ac2, Node v24.21.0, Neovim v0.12.5, workers2 (Web4). Matching host gate17eef3e82c2c167a0d6246e34c95494da2d265ae is reused remotely, not repeated. T1/T2/T3/Web phase envelopes69/368/16/162 s differ from suite walls64.56/363.26/11.28/157.75 s. Lifetime712 s/cost$0.0494 describe machine accounting.

Changed T3 has2 files/8 passing identities, one base execution/no repetitions; added selected-phase wall11.212 s excludes machine wait. All identity times are below8 s (80% of10 s T3), so runner prints no allowance stanza. No duration edit required.

Generic lint/duration/ratchet remain report-only:133 lint findings/60files, zero static refusals, six missing baselines, existing Web/scale/Neovim-artifact would-fails and Web over-budget retained. Ratchet2199.339 versus2195.304 s reports would-refuse growth with incomplete one-file base timings; exit0 is not an enforce-mode performance/growth pass.

## Spec and criteria

C1 verified within the revised pre-merge boundary. Pure formula/config tests2/2 and checksum/HTTP-response test1/1 pass ordinary and5/5 each. They pin opt-in config, tag/version/SHA rendering, Node@24/minimum/runtime wrapper and shared build, plus complete-body hash/status/empty/interrupted response handling. Maximum T1 repetition peak0.039746647 s.

Sealed native installer file passes6/6: new-layout build/update2.573045211 s; failed build preserves command1.619529305 s; old-layout install/update/failed-update2.697042352 s; interruption rollback1.935902444 s; failed-rollback retention1.964359240 s; Node prerequisite rejection0.101684319 s. Assertions retain built Web/pruned dependency, lockfile mtime, version/working command, owned cleanup and recovery bytes. These exercise shared and legacy paths using local fixture archives, not a public Homebrew installation.

C2 verified by accepted source plus the native publication file2/2: preview/download failure/lost reply/pinned retry1.134159514 s; preserved tap entries and concurrent push refusal0.204440186 s. All Git object/parent/ref/lease operations use sealed local repositories; only archive-hash and tap address boundaries are substituted. This establishes recoverable release formula behavior without claiming an actual GitHub/tap push. The previously failing project Coordinator byte reserve now passes; all39 clause tests pass without limit changes.

C3 verified by the current source copy and help compatibility: README, site/copy action and install/quickstart use kealman/tap/cland, explicitly pending publication with source alternatives; legacy pinned script install is supported. Integrated frozen export comparison passes0.002327587 s and actual CLI help bytes0.137088954 s, preserving the independent release row. Historical23-page site builds/local source evidence retain A-11108/A-11140's provenance and are not relabelled as this Linux runtime.

Accepted landing boundary remains explicit: human creates Kealman/homebrew-tap; the actual clean-macOS public brew install/version/doctor/upgrade/uninstall and publication checks remain E-778 after-landing evidence. Marking the revised item ready does not assert that availability or native Homebrew execution already exists.

Failed A-11118 atde9d06c4 remains failed/partial. Cancelled A-11151 at37c8d5c9 remains exit143/partial; neither is reused as current green. Final clear, C1–C3 verified across current source and this exact-head configured receipt. QA none/after-stage. Reviewer used read-only inspection only, no tests, browser, edits, Git mutation or delegation. Standards0 findings; Spec0 findings.
Durable audit A-11183.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-24T14:27:24.171Z

Merged 749b13d2c803d31866e6e72a3008de38d38c47ed onto dev.
