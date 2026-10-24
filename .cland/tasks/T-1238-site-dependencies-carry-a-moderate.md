---
id: T-1238
kind: task
title: Site dependencies carry a moderate postcss-selector-parser advisory through expressive-code 0.44.2
state: closed
status: done
size: XS
criterion_seq: 3
labels:
  - ready-for-agent
  - site
assignee: null
parent: E-1192
blocked_by: []
topic: topic-977
branch: t/T-1238-site-dependencies-carry-a-moderate
created: 2026-10-24T12:16:57.887Z
updated: 2026-10-24T12:46:56.755Z
closed: 2026-10-24T12:46:56.755Z
---

## Summary

QA's E-1192 DoD run (2026-10-24 11:56Z, qa-676) found 3 moderate advisories in site/ with `npm audit --omit=dev`. All three are GHSA-rj75-hqrm-r3gf: quadratic flat-selector parsing in postcss-selector-parser below 7.1.6, a CPU-exhaustion risk. It reaches site/ through @astrojs/starlight → astro-expressive-code 0.44.2 → @expressive-code/core 0.44.2 → postcss-nested 6.2.0 → postcss-selector-parser 6.1.4. The root package is clean.

## Decision (the human, ask 949e02ea, 12:16Z 2026-10-24)

Update the expressive-code packages to 0.44.3 (released 2026-10-21), with a one-time waiver of the two-week dependency age rule for this update only. @expressive-code/core 0.44.3 depends on postcss-nested ^7.0.2, which takes postcss-selector-parser ^7. Resolve that to 7.1.6 or later; 7.1.6 dates from 2026-09-03.

## Acceptance criteria

- [x] C1. site/ resolves @expressive-code/* and astro-expressive-code at 0.44.3 and postcss-selector-parser at 7.1.6 or later, through site/package-lock.json only; the root and web/ lockfiles are unchanged.
  - done: impl-1238 · 2026-10-24T12:20:31.688Z
  - verified: rev-31 [reviewer] · run rev-20261024-1238-source · 2026-10-24T12:22:30.601Z · commit 8be89329112ccccb6b08cbac45e219dad0a9acbb
  - verified: rev-31 [reviewer] · run rev-20261024-1238-final · 2026-10-24T12:38:51.593Z · commit 8be89329112ccccb6b08cbac45e219dad0a9acbb
- [x] C2. `npm audit --omit=dev` in site/ reports no high or moderate advisory.
  - done: impl-1238 · 2026-10-24T12:20:31.895Z
  - verified: rev-31 [reviewer] · run rev-20261024-1238-final · 2026-10-24T12:38:51.593Z · commit 8be89329112ccccb6b08cbac45e219dad0a9acbb
- [x] C3. `npm run build` in site/ builds all pages (23 at dev 512c4960), and code blocks render as before on a spot-checked page in an isolated browser (rule 18).
  - done: impl-1238 · 2026-10-24T12:20:32.214Z
  - verified: rev-31 [reviewer] · run rev-20261024-1238-final · 2026-10-24T12:38:51.593Z · commit 8be89329112ccccb6b08cbac45e219dad0a9acbb

## Comments

### impl-1238 · 2026-10-24T12:20:32.749Z

Implemented and pushed 8be89329112ccccb6b08cbac45e219dad0a9acbb (tree 08a92534d4c7b9026fd0125d745bc8243163dc7b), only site/package.json and site/package-lock.json. Exact site overrides select astro-expressive-code 0.44.3 and postcss-selector-parser 7.1.6; all @expressive-code/*, expressive-code and rehype-expressive-code resolve 0.44.3, postcss-nested 7.0.2. Registry-only npm install used --ignore-scripts, with worktree-owned site/node_modules and scratch HOME/XDG/Git config/credential filtering. Initial absent site/node_modules required no symlink removal. Avoided 7.1.7 because registry publication Oct 20 is outside the expressive-code-only age waiver. Root package-lock.json SHA256 remains 2e36b75de1c620c3c92d2fca215c2fc437f8f74ba4fcae8c313467acfcd2a098; web/package-lock.json remains absent. Local macOS arm64 pre-review receipts on the committed tree: production audit zero vulnerabilities (raw A-10950), Astro build 23 pages (A-10951), root npm run check exit 0 (A-10953; test lint report-only 133 findings, zero refusals), Quickstart Headless Shell rendering and real clipboard spot check (A-10954, screenshot A-10952, reproducible probe A-10955). Browser used scratch profile, blocked external traffic, saw no page JavaScript errors, observed Copied!, exact runnable commands copied, browser exit 0 and PID reaped. One initial probe expectation included shell comments and was corrected to the plugin's intentional comment stripping; final check passed. Fresh origin/dev fetch at 1039defc was merged before source review (already up to date). Task verification is pending source review; no suite pass claimed.

### rev-31 · 2026-10-24T12:22:30.602Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1238-source
commit: 8be89329112ccccb6b08cbac45e219dad0a9acbb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1238 full source review — clear

Reviewed head 8be89329112ccccb6b08cbac45e219dad0a9acbb, tree 08a92534d4c7b9026fd0125d745bc8243163dc7b, fixed base/parent 1039defcfa6c68d941707d6ae0e6a72b74102ff4. Command git diff 1039defc...8be89329; commit list has only 8be89329 fix(site): update expressive-code to remove selector parser advisory. Local/origin task refs match, task worktree clean, diff whitespace clean. Review request and task.view establish C1–C3, claimed by impl-1238, QA policy none/after-stage. Both axes reviewed personally under the Reviewer no-delegation constraint; no tests/build/browser/package commands executed by Reviewer.

## Standards

No findings. Only site/package.json and site/package-lock.json changed. Read root AGENTS.md, code-review skill and current rules 3–18. No CONTRIBUTING/CODING_STANDARDS or nested AGENTS found. This dependency-only change introduces no application abstraction or applicable code smell, runtime authority, command/policy default, test, tier move, workload change or skill edit. It needs no new test-specific guide or role-clause growth.

Task records the human's one-time age waiver for Expressive Code 0.44.3; this review does not widen it. Exact astro-expressive-code 0.44.3 and parser 7.1.6 overrides constrain the intended graph; no 7.1.7 resolution. All changed tarballs use registry.npmjs.org with integrity fields. No unrelated lock records changed. postcss-nested moves 6.2.0→7.0.2, its engine >=18 is compatible with this repository's Node 24 environment. Installation is reported registry-only --ignore-scripts into owned site/node_modules; A-10956 retains final install output, not a complete command/env/exit transcript.

Browser evidence A-10955 uses the repository's pinned Headless Shell prerequisite and fixtureEnvironment; disposable root/profile asserted under scratch root, loopback server, external page requests blocked, no human browser. It reads actual highlighted code, clipboard and feedback, records page errors and observes browser exit/reaped PID before server close. A-10954 records successful cleanup. This one-off evidence probe is not a repository test and does not add a test-tier declaration. Reviewer inspected the screenshot file only.

## Spec

No findings. C1 source-established and verified: all seven Expressive Code family packages resolve 0.44.3, postcss-nested 7.0.2 takes parser ^7, and its only postcss-selector-parser entry resolves exactly 7.1.6. The old 6.1.4 top-level entry is removed, not retained alongside it. Read installed package.json artifacts also match the committed versions; no package command was run.

Root package-lock.json Git blob identical at fixed base/head: 900867564b4952593eb141de0ba950d59c42f128. Current SHA256 matches claimant 2e36b75de1c620c3c92d2fca215c2fc437f8f74ba4fcae8c313467acfcd2a098. web/package-lock.json is absent at head and in task worktree. The manifest contains only the two required overrides; no root/web dependency change.

C2 local receipt A-10950 is original audit JSON with vulnerabilities {} and zero info/low/moderate/high/critical/total. It supports the captured site production-audit result, not a permanent absence-of-vulnerabilities guarantee.

C3 local receipts: A-10951 Astro build reports 23 pages in 5.36 s, Pagefind 23 HTML files; existing i18n/404 warnings retained. A-10952 screenshot inspected: Quickstart install code legible, syntax coloured, framed with copy control and Copied feedback. A-10954 local Darwin arm64 Headless Shell 156.0.8078.4 shows six code blocks, JetBrains Mono, nonzero dimensions, no page JS errors, exact clipboard brew install cland + curl installer commands, browser exit 0/PID reaped/server closed. A-10955 validates clipboard against generated data-code payload; intentionally stripped comments are not treated as a product regression. A-10953 retains root check typechecks/Web build/static lints, 133/60 report-only test-lint findings and zero refusals; claim states exit 0.

Evidence attribution limitation: retained build timestamps precede the 14:20:00+02:00 commit. Treat these as implementation-tree receipts later committed, not an exact-commit rerun unless original native call metadata establishes otherwise. Artifact files preserve stdout but do not themselves retain original call commands/exits/source-tree/platform for every command. Before final evidence settlement, preserve the available original tool call/result metadata in a durable attribution note, including native exits and precommit source/tree limits; label unavailable raw data and wall measurements, do not rerun for transcription. This is an evidence packaging request, not a source defect.

Disposition: full source clear, findings [], C1 verified. C2/C3 final settlement remains pending ordinary configured mode-free verification at this unchanged clean head plus accurate retained local audit/build/browser attribution. Source clearance authorizes that configured submission, no explicit tier/mode/executor override. Route result here; no post-review dev merge except Coordinator-posted shared fix or conflict direction. No enqueue by Reviewer.

Standards: 0 findings. Spec: 0 findings.
Durable review A-10959.

Criteria: C1 verified.

### rev-31 · 2026-10-24T12:38:51.593Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1238-final
commit: 8be89329112ccccb6b08cbac45e219dad0a9acbb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1238 final same-head evidence review — clear

Head 8be89329112ccccb6b08cbac45e219dad0a9acbb, tree 08a92534d4c7b9026fd0125d745bc8243163dc7b. Carries full source clearance rev-20261024-1238-source/A-10959 and its C1 mark. Task/origin refs still match exact head and task worktree is clean. Active evidence ownership remains rev-31; rev-26 explicitly declined competing review. No source change or post-review merge.

Audited original A-11008 and task.view: configured mode-free run caab2841-663a-4813-b311-471abff2149e passed at this exact head, exit 0. Parsed ordinary test finish events confirm 2951 passes and no fail/cancelled/skipped; no load-gate executions because no test identities were added. Generic load-gate configuration lines are not repetition evidence. T0 host check exit 0, 28.675 s; T1 exit 0, 60 s; all hub+Neovim fallback T2 exit 0, 340 s; Web exit 0, 150 s. Package configuration site/package-lock.json selects full task fallback. Reused host typecheck receipt tree ec0bdb6cc28d57c85091da2b05eb919072f25174 is explicitly not repeated remotely; no claim of a separate remote typecheck rerun.

Executor c-8 lon1, Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5, configured workers 2; machine lifetime 658 s, cost $0.0457. Report-only duration/test lint remain: 133 findings/60 files, existing overages, Web actual shard 145.52 s versus 40 s reporting budget, ratchet 2195.304 s unchanged. No budget-pass claim. No changed T3/T4 phase selected; remaining T3 is deferred to periodic/integrated occasions. No T4 or after-stage QA claim.

Local task-specific evidence remains explicitly separate from this Linux suite:
- A-10960 records original native command chunks and observed exits for installation, production audit, site build, root check and isolated browser. Platform Darwin/macOS arm64 local. Source was working base 1039defc plus the final two package edits committed unchanged, not an exact postcommit rerun; no command-start tree hash was captured.
- Independently recomputed final file SHA256 values match its note: package.json ed4719725840415db13d5297849a370bf24e682a754222697e462f77979bd8b7; site lock 973ea0818089b69caea672e6344996c91c716a23dcf19385f0209baf91741a89.
- C2: original A-10950 audit JSON has empty vulnerabilities and zero moderate/high/critical/total; A-10960 records npm audit --omit=dev --json with explicit registry/ignore-scripts, native exit 0. This establishes the captured production audit, not perpetual safety.
- C3: A-10951 original build reports all 23 pages (Astro 5.36 s; no independently measured end-to-end duration), native exit 0 recorded in A-10960. A-10952 screenshot visually inspected and A-10954/A-10955 establish highlighted readable Quickstart code, JetBrains Mono, actual generated copy payload and real clipboard commands, visible Copied!, no JS errors, disposable Headless Shell profile/loopback page/external traffic block, browser exit 0/PID reaped/server closed. Native probe exit 0 retained. This is an ad hoc local spot check, not a Linux site-render or project Web identity.
- Original initial browser assertion mistakes (comment stripping and DEL-to-newline copy encoding) are labelled probe corrections with no product source change. Overwritten initial install/probe raw logs and missing complete orchestration export are explicitly unavailable, not reconstructed; no transcription rerun. Source review already inspected the final raw stdout/probe source/screenshot. Root check receipt A-10953 remains local precommit check, exit 0, report-only lint/zero refusals.

C1 remains verified: seven Expressive Code family packages 0.44.3, nested parser exactly 7.1.6, intended postcss-nested 7.0.2, root lock identical and web lock absent. No waiver expansion beyond the task's recorded Expressive Code family decision. C2/C3 now verified using task-specific original local receipts plus current-head configured compatibility proof; all criteria settled. QA policy none/after-stage has no outstanding separate criteria.

Claimant reports fresh no-auto-maintenance fetch origin/dev d76d69fb and read-only merge-tree exit 0, virtual tree 3bdebdf1; no actual merge. Reviewer independently checked task refs/tree/cleanliness, not a separate fetch or conflict merge. Coordinator owns enqueue.

Final evidence clear, findings []. No source edit, repeat verification or additional browser run requested. Reviewer only inspected source/Git/artifacts/tracker, no tests/build/install/browser execution or delegation.
Durable review A-11013.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-24T12:46:56.755Z

Merged 453db9811b529965e832a3d4b9a2aba9128fa133 onto dev.
dependencies out of date: site/package-lock.json, site/package.json changed; run npm install in root /Users/evgeniyivanov/Projects/cland/v0 (required; stop shared readers before updating node_modules)
