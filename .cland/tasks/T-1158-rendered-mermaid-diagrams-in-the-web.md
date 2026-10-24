---
id: T-1158
kind: task
title: Rendered Mermaid diagrams in the web workbench
state: open
status: ready
size: M
criterion_seq: 3
labels:
  - needs-triage
assignee: null
parent: E-1212
blocked_by: []
topic: topic-947
branch: t/T-1158-rendered-mermaid-diagrams-in-the-web
created: 2026-10-22T23:41:27.072Z
updated: 2026-10-24T09:23:51.146Z
---

## Summary

In v0.2 the web Artifacts area opens a raw Mermaid `.mmd` diagram as text (its source) with a download link; only HTML or SVG diagrams open in the sandboxed page viewer (decision on T-1140's question, 2026-10-22 23:41Z). The human approved option (a), a new client-side dependency `mermaid` (General 2026-10-24 08:51Z, answer to ask 7efa7a2e).

## What to build

A Mermaid diagram artifact opens rendered in the sandboxed viewer, with its source one key away. Add `mermaid` to the web workspace at an exact pinned version, loaded only when a `.mmd` artifact opens, so the shell's first load does not grow. Render inside the sandboxed iframe with Mermaid's strict security level, so diagram text cannot run script. Theme it from `web/src/tokens.css`. A diagram that fails to parse shows Mermaid's error and the source, never a blank pane. No other new dependency.

## Acceptance criteria

- [x] C1. A `.mmd` diagram artifact opens rendered in a sandboxed iframe from a capability URL, and its source stays available one key away (Web test).
  - done: impl-1158 · 2026-10-24T09:04:35.726Z
  - verified: rev-23 [reviewer] · run rev-20261024-1158-final · 2026-10-24T09:23:51.037Z · commit 0921bd5014e7d89bfa622e35c8806057ce76e5a2
- [x] C2. `mermaid` is a pinned dependency of the web workspace only, loaded lazily on first `.mmd` open; the shell's initial bundle size is unchanged within 1 KB, shown in a test or build check.
  - done: impl-1158 · 2026-10-24T09:04:35.957Z
  - verified: rev-23 [reviewer] · run rev-20261024-1158-final · 2026-10-24T09:23:51.037Z · commit 0921bd5014e7d89bfa622e35c8806057ce76e5a2
- [x] C3. Diagram text cannot execute script (strict security level) and a parse error shows the error with the source, both shown in Web tests.
  - done: impl-1158 · 2026-10-24T09:04:36.313Z
  - verified: rev-23 [reviewer] · run rev-20261024-1158-final · 2026-10-24T09:23:51.037Z · commit 0921bd5014e7d89bfa622e35c8806057ce76e5a2

## Comments

### impl-1158 · 2026-10-24T09:03:33.994Z

Implemented .mmd capability rendering via ?render=mermaid in the existing allow-scripts-only iframe. Separate classic renderer entry is built for build/watch and requested only on first .mmd opening; initial shell JS grew 231 bytes (455,323 → 455,554; limit 1,024), checked by web/check-shell-size.ts. Strict Mermaid 12.1.0, token theme, restricted rendered-page CSP, immediate physical-code s source toggle, raw download, and parse errors/source. TDD reds: missing rendered SVG; source wrapper stripped leading newline. Targeted local Darwin arm64 working-tree checks: artifacts/key-contexts/palette 26/26, capability T2 7/7, web-keymap/web-readme 4/4, and npm run check (lint/budget report mode, 0 refusals). No configured verification or QA claim yet. Audit remains 2 low on Mermaid→KaTeX: GHSA-238p-pmpm-9mq7; eligible patched KaTeX versions fall outside required ^0.16.47. Coordinator informed; no out-of-range override or new dependency added.

### rev-23 · 2026-10-24T09:10:21.913Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1158-source
commit: 0921bd5014e7d89bfa622e35c8806057ce76e5a2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1158 full source review — clear

Head0921bd5014e7d89bfa622e35c8806057ce76e5a2; treee9f97352db3c14eb3dc7efa2ced6d7396bd7e0e2. Fixed requested baseline89e5c304bef194c07caff3e41a82d0e62a2e2902; git diff89e5c304...0921bd50. Incorporated dev30b7b71fa5116ac17cb3cdae398b0e4b849e6e49 precedes first review; inherited tracker and test-doc-index changes distinguished from implementation diff30b7b71f...0921bd50. Origin task ref matches named head. Run rev-20261024-1158-source; scope full; findings []. Standards and Spec reviewed in-session because .cland/crew.toml disables Reviewer subagents.

## Standards

Clear against AGENTS.md web rules, project rules9/12/15–19 and documented test levels. CSS Modules use existing tokens; diagram theme values are read from tokens.css rather than new colour literals. Source toggle uses shared physical-code keyMap/listenForShortcuts, with a dedicated context rather than a new component key listener. No UI library or additional direct package is introduced. Lock comparison against incorporated dev changes only the web workspace's existing metadata and adds Mermaid/transitives; no unrelated installed package pins are moved.

Changed Web tests use the existing sealed webFixture/isolated Headless Shell and public artifact/capability seam, arm rendered/error observers before opening, retain final SVG, iframe sandbox, URL, source, callback and parse-error assertions. Non-Latin KeyS checks physical code; named download and HTML/SVG cases remain. New security case observes actual rendered nodes, then clicks with a callable hostile stub installed and checks both frame and parent sentinels. T2 extension exercises cookie-free raw/rendered HTTP and HEAD content length using the existing owned in-process fixture; no new process/lifecycle helper. Indexed exact-path guides and shared README/docs match behavior. No budget, waits, workload or isolation weakened. Diff whitespace check passes.

## Spec

C1 source is implemented: .mmd files/folder children use the existing random artifact capability with render=mermaid; raw capability bytes/download remain available. Both iframe attribute and rendered HTTP policy retain sandbox allow-scripts without allow-same-origin. Escaped source is embedded as text, including script/pre breakout characters; a deliberate initial pre newline preserves an original leading newline. The separate renderer imports the sanitized SVG only inside that iframe and focuses the source-toggle control; s toggles source/rendered.

C2 source is implemented: exact mermaid12.1.0 is a web-only direct dependency. ArtifactViewer adds no Mermaid import; Vite builds a separate classic IIFE/CSS, including watch inputs, before publishing its source stamp. No renderer preload/import enters the shell. The new build-size tool measures the sole initial shell script, rejects unaccounted modulepreloads, and enforces measured growth<=1024 bytes. A-10607 size stdout reports455323→455554 (+231). Public Web test confirms no renderer request before .mmd open and a request at opening.

C3 source is implemented: initialize uses strict security, startOnLoad:false and suppressErrorRendering:true; rendering failure appends Mermaid's error as text and reveals exact source. Installed12.1.0 source independently shows securityLevel among secure settings that diagram directives cannot override and DOMPurify serialization outside loose mode. The code does not bind callback functions or configure KaTeX trust. Rendered response CSP has default-src none, origin-scoped external script/style/font permission, inline SVG styles and data images; no same-origin sandbox privilege. Security tests combine attempted loose directive, escaped script breakout, HTML event and click callback, and retain actual parse error/source checks.

Dependency advisory disposition is explicit: Coordinator8db44908/9a1b9a1d in topic-947 authorizes retaining12.1.0 without an incompatible override, with GHSA-238p-pmpm-9mq7 and containment reported before landing. A-10603 retains two low audit findings for KaTeX's existing-prototype-pollution trust bypass and Mermaid path; this is not an audit-zero claim. Strict rendering, opaque isolation and CSP limit the rendering surface; no claim that the dependency itself is patched. Coordinator retains human/release disposition ownership.

## Evidence and limits

A-10607 contains original stdout: implementation/source-equivalent local Darwin arm64 Web26/26, T2 capability7/7, T1 keymap/readme5/5; strengthened callback security1/1 separately (overlapping case, not added to26 as unique coverage). Final security case2.046107s; earlier render1.081853750s/security1.128867125s, below4s. Size stdout gives the baseline/current byte comparison. Check log contains typecheck/build/static checks and report-only lint133 findings/60files, zero refusals. README accurately states check began before the final fixture-only void-return adjustment; the final commit changes only that setup callback wrapper, not production/security behavior. These are source-tree/local receipts, not a configured exact-head suite.

Original command/native exit/chunk records and baseline source attribution have been requested for durable preservation from retained records, without transcription reruns. No configured verification has run at this head, no Linux/T3/T4 or stage QA pass inferred. C1–C3 final runtime settlement stays pending the fresh configured mode-free result and receipt audit. Source clearance allows that submission at this exact unchanged head. QA policy affected/after-stage, no per-item QA brief or claim; stage QA remains separate.

Reviewer performed static source/Git/retained-artifact inspection only: no tests, probes, installer/audit execution, edits, GUI, merge or delegation. Standards zero findings; Spec zero findings.
Durable review A-10617.

### impl-1158 · 2026-10-24T09:21:46.841Z

Mode-free configured run 0177fe8f-866c-49b0-a8b0-55b811c6c61b passed at unchanged reviewed head 0921bd5014e7d89bfa622e35c8806057ce76e5a2 (original log A-10641). Hub report: 2830 tests, 2830 pass, 0 fail/cancelled/skipped. Host T0 check passed; all T1 + fallback all T2 across hub/Neovim + Web completed on droplet Linux x64 6.8.0-142-generic, c-8 lon1, Node24.21.0, Neovim0.12.5; lifetime574s, cost$0.0399. Host typecheck gate f78c621b was not repeated remotely. Lint/duration gates remain report-only; Web actual shard129.45s exceeds40s report-only budget. New/changed Mermaid Web tests passed in3.036/3.288s, below4s allowance threshold. T3 deferred to periodic dev/integrated occasions and absent from configured batch tiers; no T3/T4 or after-stage QA claim. Final Reviewer settlement pending. Fetched current origin/dev a9a76af4; merge-tree exit0, no conflicting paths, synthetic tree7fc1269a. Branch/head unchanged; no post-review dev merge.

### rev-23 · 2026-10-24T09:23:51.037Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1158-final
commit: 0921bd5014e7d89bfa622e35c8806057ce76e5a2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1158 final same-head evidence review — clear

Head0921bd5014e7d89bfa622e35c8806057ce76e5a2; treee9f97352db3c14eb3dc7efa2ced6d7396bd7e0e2; origin task ref still matches. Full source A-10617 remains accepted. Run rev-20261024-1158-final; scope evidence; findings [].

Configured0177fe8f-866c-49b0-a8b0-55b811c6c61b/A-10641 names this head and ends Finished:exit0. Native ordinary finish records:2830 tests/418files, all pass, no failure/cancellation/skip. Five separate actual load-gate test/file passes concern the inherited test-docs identity, not Mermaid repetition coverage. T1, fallback all T2 in hub and Neovim, and complete Web44files/224tests finished exit0. Linux x64 6.8.0-142-generic droplet c-8lon1 cland-v0-26f1357a, Node24.21.0/Neovim0.12.5, workers2/Web4, lifetime574s/$0.0399. Host npm run check stdout/build is retained; reused gatef78c621b586783acfab26f6a3e94be721dd8f57b independently resolves to a Git tree, not another head and not a repeated remote check. No T3/T4 executed or stage QA claimed.

Native suite walls46.56/291.84/129.55s differ from phase envelopes50/296/133s and projections; actual Web shard129.45s. Duration/lint/ratchet diagnostics remain report-only, including Web wall warning,133 lint findings/60files, one missing duration baseline and incomplete base timings. No affected artifact-file tier-mismatch record found.

C1 verified: same-head capability test passes0.156777197s, retaining raw/rendered source escaping, headers and HEAD length; Web opening/source case passes3.036018103s with actual SVG, capability URL, allow-scripts sandbox and physical source toggle, alongside HTML/SVG cases.

C2 verified: reviewed exact web-only Mermaid pin and independent entry remain. Retained A-10607/A-10619 establish baseline89e5c304 initial455323bytes and current455554bytes (+231<=1024). The source checker prints that line only after its assertions; no independently retained standalone native exit exists for the size invocation because its shell wrapper continued. This deterministic measurement is accepted as size evidence, not mislabelled a standalone process pass. The same-head Web case confirms no renderer request before opening and renderer fetch at opening; raw host build confirms separate renderer output. Original local command/check native exits and source-tree attribution are explicitly retained in A-10619 without reruns.

C3 verified: hostile/parse Web case passes3.288010876s. It retains real SVG, attempted loose directive/script/event/callback, absence of executable SVG attributes/scripts/links, click with callable stub, unchanged frame/parent sentinels and actual parse message plus exact leading-newline source. Both changed/new Mermaid Web identities stay below4s across retained local/Linux passing samples; no allowance triggered. No Mermaid load-repetition claim is inferred from generic headers.

Dependency audit remains two low KaTeX/Mermaid findings in A-10603, GHSA-238p-pmpm-9mq7; Coordinator9a1b9a1d explicitly retains the eligible pin/no incompatible override and owns human disposition before landing. Strict rendering/opaque sandbox/CSP containment from source audit remains; no patched-dependency or audit-zero claim.

Lead209b7fed reports post-fetch origin/deva9a76af4 read-only merge-tree exit0/no conflicts/tree7fc1269a with unchanged clean head; no merge by Reviewer. All C1–C3 verified at this exact head. Affected after-stage QA and Coordinator advisory disposition remain separate. Reviewer ran static artifact/Git inspection only, no tests/probes/edits/GUI/merge/delegation. Standards/evidence clear; Spec/evidence clear.
Durable review A-10647.

Criteria: C1 verified, C2 verified, C3 verified.
