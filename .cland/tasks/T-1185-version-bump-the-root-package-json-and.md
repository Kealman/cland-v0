---
id: T-1185
kind: task
title: "Version bump: the root package.json and lockfile at 0.2.0"
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-420
blocked_by: []
topic: topic-921
branch: t/T-1185-version-bump-the-root-package-json-and
created: 2026-10-23T21:24:13.344Z
updated: 2026-10-23T21:55:20.287Z
closed: 2026-10-23T21:55:20.287Z
---

## Summary

R-377 ships version 0.2.0. Bump the root package.json and package-lock.json from 0.1.5 to 0.2.0 before the release dry run, the same way T-940 did for 0.1.4. `cland release --item R-377` reads the release version from the item, and the package version has to agree with it.

## What to build

Set `version` to 0.2.0 in the root package.json and in the root entries of package-lock.json, and change nothing else in the lockfile. Leave web/package.json's own version alone unless the release checks read it; T-940's commit shows the shape.

## Acceptance criteria

- [x] C1. The root package.json and both root version entries in package-lock.json read 0.2.0, and `npm install --package-lock-only --ignore-scripts` leaves the lockfile unchanged (test).
  - done: impl-1185 · 2026-10-23T21:26:06.940Z
  - verified: rev-23 [reviewer] · run rev-20261023-1185-final · 2026-10-23T21:50:28.601Z · commit 9a587b591758cb0f17ea2231e93a86fdc604f196
- [x] C2. `cland --version` prints 0.2.0 (test).
  - done: impl-1185 · 2026-10-23T21:26:08.068Z
  - verified: rev-23 [reviewer] · run rev-20261023-1185-evidence-1 · 2026-10-23T21:39:40.898Z · commit 9a587b591758cb0f17ea2231e93a86fdc604f196
  - verified: rev-23 [reviewer] · run rev-20261023-1185-final · 2026-10-23T21:50:28.601Z · commit 9a587b591758cb0f17ea2231e93a86fdc604f196

## Comments

### impl-1185 · 2026-10-23T21:26:06.861Z

Prepared exactly the three version value changes, matching T-940/19533afa. Release checks read pinned dev:package.json only; CLI reads the root package via VERSION. web/package.json has no version field. Existing hub/test/cli.test.ts covers --version/-v. Local targeted evidence blocked before setup by cover-quiet run 10dd7ef2; Coordinator directed source review now on code alone, local checks when queue local none. No tests claimed passing.

### rev-23 · 2026-10-23T21:27:08.004Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1185-source
commit: 9a587b591758cb0f17ea2231e93a86fdc604f196
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1185 full source review

Head 9a587b591758cb0f17ea2231e93a86fdc604f196; tree dde4455c638a2ebb265655631b09ddb3f06c89ad. Branch t/T-1185-version-bump-the-root-package-json-and. Fixed base/parent 9ef54e9f98f466e5fac49b7dbcadd278fbf92dc5. Diff command: git diff 9ef54e9f98f466e5fac49b7dbcadd278fbf92dc5...9a587b591758cb0f17ea2231e93a86fdc604f196. One commit, two files, exactly three value replacements. Run rev-20261023-1185-source. Clear, findings []; C1/C2 runtime pending.

## Standards

No findings. Root package.json version and package-lock.json top-level and packages[""] versions change from 0.1.5 to 0.2.0. No dependency, integrity, resolved URL, workspace or other lockfile content changes. web/package.json is untouched and has no version field. Diff check clean. The three-value shape matches T-940 commit 19533afa349d957eea9d05ef3d816bf21af9f409.

Reviewed against AGENTS.md, project rules 9/11/15–18, docs/agents/tests.md, docs/review-and-qa.md and existing CLI/release readers. No new tests/processes, command semantics, settings, permissions, documentation workflow or skills changed; no matching help/role/skill migration needed. Fowler baseline yields no independent smell finding. Crew disables Reviewer subagents; both axes performed in this session.

## Spec

No findings. R-377's release version is 0.2.0. T-1185 explicitly requires these three root version entries and no other lockfile changes. Existing hub/src/version.ts reads the root package.json; hub/bin/cland.ts prints VERSION for --version/-v/version. Existing hub/test/cli.test.ts compares the actual executable output with the root version. Release owner hub/src/territory-release.ts reads package.json from the pinned dev commit and rejects a version different from the requested release name without v; it does not consult web/package.json. Source satisfies the intended reader paths.

C1's version values are established by source, but its scratch npm install --package-lock-only --ignore-scripts byte-stability assertion is not yet observed, so the criterion remains unverified. C2's output path is established by source, but actual CLI output is not yet observed, so it also remains unverified. No runtime pass is inferred from the minimal diff or done marks.

A-10247 explicitly provides a validation plan, not passing evidence. Local checks were stopped before fixture setup by cover-quiet integrated run 10dd7ef2-6427-4e72-96a2-535c8dee95ca. Coordinator 7cc04326-e452-4503-84bd-b3fd243fa2ad explicitly requests code-only source review now, local targeted work only after local queue is none; droplet verifies remain available. This review ran no local tests/probes and does not bypass that restriction.

Proceed with mode-free verification at this exact source-clear head. Preserve actual original receipts for the sealed scratch lockfile-only install (before/after byte comparison and exit) and actual CLI version (without a version override), plus the existing CLI test, when authorized local capacity is available. Name tested head/tree, platform/executor, commands/exits and any partial or report-only result. Configured suite evidence alone must not be represented as the scratch npm stability receipt if that action was not run. Final C1/C2 settlement requires the matching evidence, not source clearance alone. No changed-head verification without fresh source review; Coordinator retains merge/enqueue scheduling authority.

Task QA policy is none/after-stage, no per-item brief or qaCriteria. Reviewer performed read-only source/Git/hub review, no edits, tests, probes, installers, network/browser/GUI, merges or delegation.

Standards: 0 findings. Spec: 0 findings.

Durable source review: A-10248.

### rev-23 · 2026-10-23T21:39:40.898Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1185-evidence-1
commit: 9a587b591758cb0f17ea2231e93a86fdc604f196
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1185 same-head configured evidence review

Head 9a587b591758cb0f17ea2231e93a86fdc604f196; complete tree dde4455c638a2ebb265655631b09ddb3f06c89ad. Branch t/T-1185-version-bump-the-root-package-json-and. Run rev-20261023-1185-evidence-1. Clear for the evidence reviewed, findings []; C2 verified, C1 remains runtime pending. This is not final readiness. Source A-10248 / rev-20261023-1185-source carries forward unchanged.

## Standards

No findings. Raw configured receipt 4e252030-1112-476d-9f9c-31f049cf8efe / A-10250 independently audited: exit 0, 2780 ordinary test finishes and 415 ordinary file finishes all pass, zero failure/skip/cancel. T1 132 files, package-configuration fallback all hub and Neovim T2 240 files, complete Web 43 files. No actual load-gate scope records; generic five-repetition headers do not establish repetitions, and no new test identity was added.

Linux x64 6.8.0-142-generic, droplet c-8 lon1 cland-v0-81ae1e9b, Node v24.21.0/Neovim v0.12.5, workers 2/Web runner 4; lifetime 645 s/$0.0448. Actual phase walls 54.22/337.51/147.53 s; projections and test-second sums are distinct. Full successful host npm run check output is preserved. Remote T0 reused successful host candidate tree eb78a5375a043d5d3ae1546093ce5bab4b835edf, independently confirmed a Git tree object, and was not repeated on the droplet. Complete task Git tree is named separately above.

Lint 132 findings/59 files, duration and ratchet diagnostics remain report-only, with two missing duration baselines and projected Web wall warning. Seventeen report-only tier-tripwire diagnostics remain in unchanged claude-code-schedule, connection-snapshot, suite-admission-cost and web-authority tests; no new identity/fixture was added here. No enforced clean-tier claim.

## Spec

C2 is established by the passing actual executable contract hub/test/cli.test.ts, “cland --version prints the version of the root package”, 0.208763374 s. Reviewed source executes both --version and -v, requires exit 0 and exact root package version plus newline; that package version is 0.2.0 at this head. The entire CLI file passes its three tests. A separate local duplicate CLI run is not needed for C2 settlement.

C1's three literal versions remain source-established, but its explicit npm install --package-lock-only --ignore-scripts unchanged-lockfile check is absent from this configured run. Lead confirms the sealed local scratch stability receipt still awaits local capacity. It remains unverified; a green suite or done mark does not substitute for the unrun npm action. Preserve original scratch command, sealed input/source identity, before/after byte equality, exit and cleanup receipts once the Coordinator's local-quiet restriction permits it. Do not rerun solely for transcription.

Independent branch-tip/tree read remains at reviewed values. No head change or dev merge is claimed. T3/T4 did not run; T3 is deferred to periodic/integrated occasions and absent from configured batch tiers. QA policy none/after-stage, no per-item brief/criteria. Coordinator retains release/merge scheduling. Reviewer read-only source/log/Git/hub, no tests, probes, installers, edits, network/browser/GUI, merges or delegation.

Standards: 0 findings. Spec: 0 findings; C1 evidence outstanding.

Durable evidence review: A-10251.

Criteria: C2 verified.

### impl-1185 · 2026-10-23T21:49:30.747Z

Local targeted C1 PASS at unchanged head 9a587b591758cb0f17ea2231e93a86fdc604f196, macOS arm64 Node v24.21.0, no suite gate: after QA local done and queue local none, scratch-only npm install --package-lock-only --ignore-scripts exited 0 and package-lock remained byte-identical (99636 bytes; SHA256 a164b6bdff6f59da7bf0fa986215a5ddecc81fa79c2fe2848935b6968f8d9117 before/after). Three versions 0.2.0; supplemental actual --version exited 0 and printed 0.2.0. Shared fixtureEnvironment sealed scratch HOME/XDG/Git config and credential filter; no root install. Fetched origin/dev 9ef54e9f98f466e5fac49b7dbcadd278fbf92dc5 and merge-tree conflict check exited 0; head/tree unchanged and clean. release --help unsupported (exit 1), while top-level --help exit 0 documents release --item. No merge/enqueue.

### rev-23 · 2026-10-23T21:50:28.601Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1185-final
commit: 9a587b591758cb0f17ea2231e93a86fdc604f196
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1185 final evidence review

Head 9a587b591758cb0f17ea2231e93a86fdc604f196; complete Git tree dde4455c638a2ebb265655631b09ddb3f06c89ad. Branch t/T-1185-version-bump-the-root-package-json-and. Run rev-20261023-1185-final. Clear, findings []; C1–C2 verified. No head change since source A-10248 and configured evidence A-10251.

## Standards

No findings. Independently read A-10258 original scratch npm command/output/exit and byte-stability receipt, attributed to this exact task head, local Darwin arm64 Node v24.21.0, targeted executor local with no suite gate. Lead records QA local work complete and verify queue local none before execution, consistent with Coordinator's local-capacity condition.

Disposable scratch root and shared fixtureEnvironment are explicitly identified, with owned HOME/XDG/Git configuration and inherited provider/account/GIT_* filtering; no project-root install. npm install --package-lock-only --ignore-scripts exits 0, signal null. Original stdout and stderr are retained, including npm notices and two audit findings; no whole-chain “all commands pass” claim. Supplemental CLI --version exits 0 with 0.2.0. release --help separately exits 1 for unsupported option, while top-level --help exits 0; this unchanged-command aside was reported upstream and is not a version-bump failure. No dependency changes or audit fixes are included.

## Spec

C1 now established. Source still contains exactly the three requested 0.2.0 root versions. A-10258 asserts all three and byte equality after the scratch lockfile-only install: 99636 bytes, SHA256 a164b6bdff6f59da7bf0fa986215a5ddecc81fa79c2fe2848935b6968f8d9117 before and after. Independent read-only hashing of the reviewed commit's package-lock.json produces that exact digest, tying the scratch input receipt to reviewed content. This is the previously missing npm stability action, not an inference from a configured suite.

C2 carries forward from A-10251: actual --version/-v executable test passed on Linux at this same head. A-10258 additionally preserves direct local CLI output 0.2.0/exit 0; no stronger coverage claim is needed.

Configured receipt 4e252030-1112-476d-9f9c-31f049cf8efe / A-10250 remains current: independently audited 2780 ordinary tests/415 files all pass, zero fail/skip/cancel; all T1 and package-config fallback hub/Neovim T2 plus complete Web. Linux x64 c-8 lon1 cland-v0-81ae1e9b, Node24.21.0/Neovim0.12.5, workers2/Web4, lifetime645s/$0.0448. Host full check passed, candidate tree eb78a5375a043d5d3ae1546093ce5bab4b835edf reused remotely, not repeated on droplet. Report-only lint/duration/ratchet and unchanged tier-tripwire diagnostics retain the exact qualifications in A-10251. No new test identity/allowance, no actual load scopes; generic repetition headers are not evidence. T3/T4 were not run; T3 deferred to periodic/integrated occasions and absent from configured batch tiers.

Branch tip/tree independently remain the reviewed values. Lead's fresh fetch/read-only merge-tree against origin/dev 9ef54e9f98f466e5fac49b7dbcadd278fbf92dc5 exits 0 with clean tree and no head change. No new suite needed for this evidence-only settlement.

QA policy none/after-stage, no per-item brief or qaCriteria. Coordinator's enqueue/merge hold and release scheduling remain in force; final review clearance is not permission to bypass them. Reviewer performed read-only source/log/Git/hub review, no tests, probes, installers, edits, network/browser/GUI, merge or delegation.

Standards: 0 findings. Spec: 0 findings.

Durable final review: A-10260.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-23T21:55:20.287Z

Merged 4db0183ad18670bf2168d0dd1c91607ce398027a onto dev.
