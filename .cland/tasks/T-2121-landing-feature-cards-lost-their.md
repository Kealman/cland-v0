---
id: T-2121
kind: task
title: Landing feature cards lost their screenshots when the carousel became a grid (T-1482); restore an image on each card that has one
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: C-326
blocked_by: []
topic: topic-1809
branch: t/T-2121-landing-feature-cards-lost-their
created: 2026-11-27T16:07:10.643Z
updated: 2026-11-27T17:13:07.979Z
---

## Summary

The human noticed on 2026-11-27 (General, photo A-23825) that the "Built for shipping, not demos" cards on cland.app show no screenshots. The old carousel gave each feature a screenshot or diagram (`shot: n` per slide). T-1482 (effffe1e7, 2026-10-30) turned it into a grid of compact cards, so nothing is hidden behind arrows, and dropped the images. All the screenshot files still exist in `site/src/assets/screens/` (SCREENSHOTS.md). The human chose (ask d1911dec) to do this now as a separate item, land it after the 0.4.1 release, and publish the site through `cland publish`.

## What to build

Each feature card in the grid shows its screenshot (or the diagram the carousel used), taking the feature-to-image mapping from the carousel before effffe1e7. Every feature stays visible at once (T-1482's goal); cards without an image keep their compact form. The layout works at phone width with no horizontal scroll, in light and dark. Update SCREENSHOTS.md's "Pages" column for each image now shown on the landing.

## Acceptance criteria

- [x] C1. Every feature card whose carousel slide had a screenshot or diagram shows it again, using the existing Screenshot or Diagram component with responsive sizes, and every feature is still visible without arrows or scrolling inside the section (test or evidence from the built site).
  - done: impl-2121 · 2026-11-27T16:14:29.916Z
  - verified: rev-35 [reviewer] · run rev-35-2121-evidence-1 · 2026-11-27T17:13:07.794Z · commit 0a3af053baff01f7bac8422d0474770bcb24f570
- [x] C2. The site builds, the site tests pass, and the landing renders without horizontal scroll at 375 px and 1440 px in light and dark themes, shown by isolated headless-browser captures in the item's evidence (evidence).
  - done: impl-2121 · 2026-11-27T16:14:30.110Z
  - verified: rev-35 [reviewer] · run rev-35-2121-evidence-1 · 2026-11-27T17:13:07.794Z · commit 0a3af053baff01f7bac8422d0474770bcb24f570
- [x] C3. SCREENSHOTS.md lists the landing feature grid under "Pages" for each image now used there (test or evidence).
  - done: impl-2121 · 2026-11-27T16:14:30.307Z
  - verified: rev-35 [reviewer] · run rev-35-2121-source-1 · 2026-11-27T16:26:24.787Z · commit 3211c129f8ffb57a06c5a23bcd3de5942e038987
  - verified: rev-35 [reviewer] · run rev-35-2121-source-2 · 2026-11-27T16:37:16.400Z · commit a590e0df2e281d41a8a26d5ac8ea22555c7c6b26
  - verified: rev-35 [reviewer] · run rev-35-2121-source-3 · 2026-11-27T16:41:35.127Z · commit 0a3af053baff01f7bac8422d0474770bcb24f570
  - verified: rev-35 [reviewer] · run rev-35-2121-evidence-1 · 2026-11-27T17:13:07.794Z · commit 0a3af053baff01f7bac8422d0474770bcb24f570

## Comments

### impl-2121 · 2026-11-27T16:11:49.177Z

Restored historical feature mapping (8 Screenshot images, 3 Diagram visuals), kept grid/anchors/click events, updated screenshot Pages and landing README. Source test red on missing harness shot then green; site build and 42 site cases pass on Node 24.21.0/macOS arm64. Built isolated Headless Shell r1248 evidence: A-23830. Both color preferences retain existing dark landing theme. Full source typecheck passed; lint in progress. No shared contract changes.

### coord · 2026-11-27T16:12:01.128Z

Scope addition from the human, 2026-11-27 16:10Z in General («Добавишь эти?»): card 03, "Your crew, in Telegram and Discord", gets two phone screenshots, A-23828 (Discord) and A-23829 (Telegram). Both show the same example ask with its options. They become `site/src/assets/screens/discord.png` and `telegram.png`, cropped to the bot message with the status and input bars removed, shown side by side and stacked at phone width, listed in SCREENSHOTS.md, and secret-scanned before commit. C1 covers card 03 as well.

### impl-2121 · 2026-11-27T16:15:39.765Z

Source review requested at a11e635b8066c27a106f1a3ff1519cdeb5bad4df. Expanded scope includes two deterministically cropped phone screenshots; secret scans clean with positive control. Final built captures A-23831. Full typecheck and test:lint pass (0 refusals; advisory findings report only); site build/42 cases, hub wrapper/43 cases, install claims/3 cases and suite selection/12 cases pass locally on Node 24.21.0/macOS arm64. Await source verdict before verify window.

### coord · 2026-11-27T16:17:12.797Z

Second scope addition from the human, 2026-11-27 16:17Z in General («Давай еще добавим одну фичу с удаленным выполнением тестов и самих харнесов, чтобы как раз ровная сетка была»): a 12th feature card covering remote harness sessions (hosts, pools and logins) and verification on cloud machines under the daily cap, so the grid is an even 2×6. Its image reuses existing art (the landing's remote diagram), and its "Learn more" link goes to the hosts docs page.

### impl-2121 · 2026-11-27T16:19:06.988Z

Human expanded scope to 12 feature cards. Added Work beyond one machine after Verification with shipped DigitalOcean pool/login and terminal attach conditions, docs/hosts link and compact five-node Diagram. Existing card anchors/click events stay stable. Source contract red before new card (11 !== 12), green after; site build/42 tests and full typecheck pass on Node 24.21.0/macOS arm64. New built capture evidence A-23833 explicitly proves 2 columns x 6 row tops at 1440, one column at 375, no horizontal overflow, and the two remote phone screenshots. First review stopped with no verdict; fresh review will follow this head.

### impl-2121 · 2026-11-27T16:20:24.609Z

Fresh full review requested at 5580f346bfcf2f7a19b8e6bb3f2157b014aca5ea, pushed and clean. Twelve-card scope final evidence A-23833; full typecheck and test:lint exit 0 (0 refusals, report-only advisories), site build/42 tests, hub wrapper43/install3/selection12 pass on Node24.21.0 macOS arm64. Await source verdict, then Coordinator verify window. No dev merge after first source review.

### impl-2121 · 2026-11-27T16:23:37.262Z

Human alignment follow-up: reordered09 Verification,10 Artifacts,11 Hosts,12 Releases; stable feature anchors/events. Release flow collapsed to4 rows and all diagrams use16:10 responsive frames. Final built evidence A-23836 supersedes A-23833: isolated Headless Shell r1248,375/1440,light/dark preferences; desktop visual bottoms differ0px for each of6 row pairs (asserted <=15% card height). All12 cards/image loads/no horizontal overflow and phone pair geometry pass. Source order test red before fix; build/42 site tests and full typecheck green. Full lint running before new source review.

### impl-2121 · 2026-11-27T16:24:50.761Z

Fresh full source review requested at3211c129f8ffb57a06c5a23bcd3de5942e038987 after final alignment change; pushed/clean. Final evidenceA-23836. Build/site42,typecheck,full lint(0 refusals; advisory reports),wrapper43,install3,selection12 pass on Node24.21.0 macOS arm64. No dev merge since first source review. Await clear source verdict then verify window.

### rev-35 · 2026-11-27T16:26:24.787Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2121-source-1
commit: 3211c129f8ffb57a06c5a23bcd3de5942e038987
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23838 full source review against fixed dev/merge base1c947950c8a8872e8fab53a377501d15021e257d, Git treead23be509f24d55778c391b69dad86cf658b86dc. Standards/spec findings[]. Eight historical mappings match effffe1e7^; approved phone crops/registry/Pages, twelve-card host addition and final09 Verification/10 Artifacts/11 Hosts/12 Releases order are preserved with stable anchors/events. Existing Screenshot/Diagram components, responsive sizes/phone stacking, compact release flow and16:10 SVG frames meet the final source scope. Host copy matches configured DigitalOcean pool/login and terminal-attach conditions in shipped docs. Changed tests remain synchronous source-only T1 through the existing single hub wrapper; no dependency, native fixture or tier change. C3 verified from Pages entries; C1/C2 source-positive but runtime-unverified. A-23836 published local macOS arm64 Node24.21/isolated Headless Shell r1248 captures/measurements reviewed: four375/1440 preference combinations,12cards, no page/HTML-card overflow, phone geometry and desktop visual-bottom alignment. Both preferences retain the existing fixed dark landing palette. Local build42/wrapper43/install3/selection12/typecheck/full-lint0 are requester-reported candidate-tree checks, with0refusals/advisory mode, not configured producer proof. No configured run yet. Earlier withdrawn requests have no verdict; their captures are superseded. Hold released for Coordinator verify-window request and one same-head configured submission; changed head needs source review. Human post-0.4.1 publication hold remains. No Reviewer execution or edits.

Criteria: C3 verified.

### impl-2121 · 2026-11-27T16:30:30.479Z

Human copy follow-up: added factual sentences only to cards01,04,06,08 from their linked docs; longer mates unchanged. Coordinator clarified actual empty-band metric: own text-to-Learn-more gap<=1.5 line heights(40.8px), not paired paragraph-end alignment. Browser check red first at01 gap75.65625. Final evidenceA-23842:375/1440 light/dark preferences, all12 gaps<=40.8px, image-bottom<=15% every row, no horizontal overflow. Before→after01 75.7→21.3,04 156.0→20.0,06 69.3→15.0,08 129.4→20.6px; others unchanged. Site build/42 tests and full typecheck pass; full lint running. Head will receive new source review; no verify at earlier clear head3211c129f.

### impl-2121 · 2026-11-27T16:33:46.835Z

Final concise copy follows Coordinator591abcb3: exact suggested01/04/08 additions,06retained. Preauthorized47c63177 frame adjustment: desktop screenshots/phone pair use measured16:10 top-contained frames, links directly follow text; single-column natural proportions preserved. Final evidenceA-23844 replaces earlier copy captures; all12 desktop gaps14px under light/dark preferences, every row visual bottoms<=15% card height,375 nooverflow. Source docs checked: sessions Attach; topics Asks/The inbox; items Explorer and card; concepts Plans and approval. Full typecheck passes; full lint running before fresh review.

### impl-2121 · 2026-11-27T16:35:12.446Z

Fresh full source review requested at a590e0df2e281d41a8a26d5ac8ea22555c7c6b26 (pushed/clean), with every added sentence/docs source and all12 before/after gaps listed. Final evidenceA-23844 includes measured16:10 desktop frames, own gaps14px, row image-bottom<=15%,375/1440 light/dark-preference captures. All local required checks pass (typecheck/full lint0 refusals/site42/wrapper43/install3/selection12) on Node24.21.0/macOS arm64. Await source verdict then Coordinatorverifywindow; no dev merge since first review.

### rev-35 · 2026-11-27T16:37:16.401Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2121-source-2
commit: a590e0df2e281d41a8a26d5ac8ea22555c7c6b26
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23846 full source clear at Git tree8abeece8d0a512842dd67403e4c6fff6ff413689, fixed dev/merge base1c947950c8a8872e8fab53a377501d15021e257d. Standards/spec findings[]. Entire retained mapping/phone/hosts/order/component scope rechecked; added01/04/06/08 sentences match linked sessions/topics/items/concepts docs. Coordinator90ab8029/591abcb3/47c63177 authorizes concise copy, own-gap target and desktop16:10 top containment; longer mates unchanged, single-column proportions retained. A-23844 published local captures/geometry inspected:12visible/nooverflow in all375/1440 preference combinations, all own gaps14px, desktop ratios1.6, paired element-bottom deltas max11.9007%<15%. Existing fixed dark palette under either preference is explicit. C3 verified at this head from Pages entries; C1/C2 source-positive but runtime-unverified. Local candidate-tree site42/wrapper43/install3/selection12/build/typecheck/full-lint0 reports and capture metadata are not independent final-head configured producer receipts; no Linux/T2/T3/T4/Web suite completion credited. Earlier source1/A-23838 remains clear only for3211c129f; final head needs its own configured verification. Hold released for Coordinator window and one mode-free exact-head submission; changed head needs source review. Human post-0.4.1 publication hold remains. No Reviewer execution or edits.

Criteria: C3 verified.

### impl-2121 · 2026-11-27T16:38:39.094Z

Final media alignment per Coordinatorac747ce6: desktop media margin-top:auto; Learn more remains14px after text. Tightened4px row-image-bottom check red before at81.5625px, green after: all6 desktop pairs0px under both preferences. Final evidenceA-23847 supersedesA-23844. Both375 feature PNGs byte-identical toA-23844 by direct comparison. Build/site42 and full typecheck pass; full lint running before fresh review. Earlier clear verdict at a590e0df2 superseded; no verify submitted at changed head.

### impl-2121 · 2026-11-27T16:40:03.307Z

Fresh full source review requested at0a3af053baff01f7bac8422d0474770bcb24f570,pushed/clean. Final A-23847: desktop media bottoms0px difference under4px guard; text-to-link14px all12;375captures byte-identical toA-23844. Full typecheck/full lint0refusals,build/site42,wrapper43,install3,selection12 pass Node24.21.0/macOS arm64. Source fixed awaiting verdict; no dev merge or configured verify since first review.

### rev-35 · 2026-11-27T16:41:35.128Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2121-source-3
commit: 0a3af053baff01f7bac8422d0474770bcb24f570
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23849 full source clear, Git tree53d013f588aa1a2e1e7e4ac30453f691199a2d1a, fixed dev/merge base1c947950c8a8872e8fab53a377501d15021e257d. Standards/spec findings[]. Entire retained historical mapping/phone/hosts/order/concise-copy/component scope remains source-positive. Sole new source delta implements Coordinatorac747ce6: desktop direct screenshot/Diagram/phone media margin-top:auto in existing flex cards, while Learn more follows text; <=900px rules unchanged, README updated. A-23847 recorded geometry recomputes all12 gaps14px and all6 desktop frame-bottom deltas0px under both preferences.375 feature PNGs independently byte-identical to A-23844. Final artifact omits frameRatio field;16:10 remains unchanged source/earlier-measurement evidence, not invented new readings. Local macOS arm64 Node24.21/isolated Headless Shell r1248 captures inspected; existing fixed dark palette under either preference explicit. C3 reverified from Pages entries at current head. C1/C2 runtime portions remain unverified pending configured same-head evidence; local reported build42/wrapper43/install3/selection12/typecheck/lint0 checks are candidate-tree reports, not configured producer receipts. No Linux/T2/T3/T4/Web suite completion credited yet. Earlier clear heads/captures remain historical. Hold released for Coordinator window and one mode-free exact-head submission; changed head needs source review. Human post-0.4.1 publication hold remains. No Reviewer execution or edits.

Criteria: C3 verified.

### impl-2121 · 2026-11-27T16:42:44.489Z

Source clear rev-35-2121-source-3 at0a3af053baff01f7bac8422d0474770bcb24f570. Coordinator granted one mode-free verify window; submitted exactly once, admitted run b0469b86-b4b0-4c67-acea-b92c7d8049dc, queue position1, default size/executor, reporttopic-1809 torev-35/impl-2121. Window released on queued receipt per Coordinator instruction. No source changes; waiting hub result. Postready hold for after0.4.1 remains.

### impl-2121 · 2026-11-27T17:10:10.520Z

Configured run b0469b86-b4b0-4c67-acea-b92c7d8049dc finished passed at unchanged reviewed0a3af053baff01f7bac8422d0474770bcb24f570; producer artifactA-23854. T0,T1,all fallbackT2,7selectedT3 importers and Web exit0; T4 unexecuted, otherT3 deferred to merge batch. Executor droplet c-8 nyc1 Linuxx64 Node24.21.0,2workers; isolated Headless Shell156.0.8078.4 revision1248 for Web. Lifetime1535s,cost0.1066USD. Duration/lint budget findings report-only. Reviewer has same-head final evidence hold; source fixed, no additional submissions. Final local landing captures A-23847; postready hold unchanged.

### rev-35 · 2026-11-27T17:13:07.794Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2121-evidence-1
commit: 0a3af053baff01f7bac8422d0474770bcb24f570
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23855 final same-head audit of b0469b86/A-23854: producer code0, empty cause, finished17:09:03Z, unfinished[]. Complete T0 host check/T1/fallback allT2/7selectedT3/Web exit0; no T4 receipt/remainingT3 unexecuted. Both changed landing cases have paired1base+5unique load passes; all43remote-docs wrapper cases, install3 and selection12pass, with file finishes. C1/C2/C3 verified from source3, exact-head generated execution and A-23847's scoped local built captures. C2 site build is specifically Implementer transcript-backed npm run build exit0 (session80949,30pages/prebuild42), procedural final-candidate binding per a367c5d8, without published native build/source-hash receipt; inspected published layout and exact-head site guards support it. Configured T0 builds web, not site; no Linux site-build claim. Local macOS arm64 Headless Shell r1248 captures have12visible/nooverflow, all gaps14px, desktop frame-bottom deltas0px; fixed dark palette under both preferences explicit. Git tree53d013f588aa1a2e1e7e4ac30453f691199a2d1a/recorded run treef89b0e7fc432e12e46af6945b7675ca519a65e6c named independently. Linuxx64 dropletc8nyc1/2workers Node24.21, configured Web isolated HeadlessShell1248/Chrome156.0.8078.4. Paired base7840pass/1macOS-prerequisite skip+10loadpass;3known finish-only protected-output passes stay unpaired (raw base7843), producer7854completed includes them/repetitions. No missing finishes/duplicates/identity mismatches. Budget/ratchet/skip diagnostics report-only, cache unknown, lint refusals0. Earlier head/capture history retained. No source changes, Reviewer execution or new submission. Post-0.4.1 landing/publication hold remains separate.

Criteria: C1 verified, C2 verified, C3 verified.
