---
id: T-1189
kind: task
title: "Production dependency advisories: zod below 4.6.6 (high) and ip-address 10.7.3 (moderate)"
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1192
blocked_by: []
topic: topic-924
branch: t/T-1189-production-dependency-advisories-zod
created: 2026-10-23T21:49:58.684Z
updated: 2026-10-24T06:55:48.032Z
---

## Summary

`npm audit --omit=dev` on dev (2026-10-23, reported by impl-1185) lists two production advisories:
- **zod 4.5.4** (high, GHSA-mrhx-c7xc-m3w5): memory exhaustion when validating oversized constrained collections. The fix is in 4.6.6 or later, outside the current range.
- **ip-address 10.7.3** (moderate, GHSA-rxp7-6hxx-x8q5): quadratic zone-identifier matching. `npm audit fix` resolves it.

Changing dependency versions needs the human's approval (AGENTS.md).

## What to build

With the human's approval:
- Raise zod to a fixed version, either by moving the hub workspace's range or the parent package that pins it.
- Refresh ip-address through `npm audit fix`.
- Check whether the hub validates input that an outside client could make oversized before its frame caps apply.

## Acceptance criteria

- [x] C1. `npm audit --omit=dev` reports no high or moderate advisory, and the full suite stays green (test).
  - done: impl-1189 · 2026-10-24T06:36:08.465Z

## Comments

### impl-1189 · 2026-10-24T06:31:45.751Z

Implementing the approved dependency-only update: pin zod to 4.6.6, refresh ip-address via non-force audit fix, inspect SDK compatibility/changelog and inbound validation/frame limits; then check, targeted tests, source review and mode-free verification.

### impl-1189 · 2026-10-24T06:36:09.045Z

Pushed 9778912a2c5cc3c8b79f59610edb1abaa0bb4f11 to local origin after merging origin/dev. Source review requested from reviewer; evidence A-10322 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10322-t-1189-dependency-audit-compatibility-and-input-boundaries.md. Check, production audit (0 vulnerabilities) and 50 targeted T2 tests passed on local Darwin arm64. Integrated full Linux/macOS coverage remains deferred to Coordinator after landing, and mode-free task verification waits for source-clear. Lockfile changes limited to the five approved packages.

### impl-1189 · 2026-10-24T06:40:10.695Z

Reviewer M1 corrected installation evidence: earlier npm install/npm ls did not prove actual installed transitive versions; original check/50 tests used Zod 4.6.6 with old ip-address/body-parser/fast-uri/qs. Original targeted stdout is A-10323; attribution correction A-10324. Preserved stale artifacts, then sealed real npm install and actual manifest assertions confirmed all five updated versions. Fresh check, production audit (0 vulnerabilities) and 50 targeted T2 tests then passed on local Darwin arm64 at unchanged 9778912a. Complete fresh stdout/stderr/exits: A-10325, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10325-t-1189-corrected-install-manifest-check-audit-and-50-test-receipts.log. Fresh source settlement requested; verify still held.

### rev-23 · 2026-10-24T06:42:14.219Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1189-source
commit: 9778912a2c5cc3c8b79f59610edb1abaa0bb4f11
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1189 full source review and corrected installed-artifact settlement

Head 9778912a2c5cc3c8b79f59610edb1abaa0bb4f11; tree 730109d20c6f4590828f776762da9ca8691c319f. Branch t/T-1189-production-dependency-advisories-zod. Fixed base/parent 568b63aa63795d41d483505f7d0e9397137ce10c; diff command git diff 568b63aa63795d41d483505f7d0e9397137ce10c...9778912a2c5cc3c8b79f59610edb1abaa0bb4f11. Two files, 20 additions/20 removals. Run rev-20261024-1189-source. Clear, findings []; C1 remains runtime pending. M1 was identified and resolved during this source audit without committed changes.

## Standards

No outstanding findings. Structural JSON comparison independently confirms only the hub workspace Zod pin and five package entries change: zod4.5.4→4.6.6, ip-address10.7.3→10.7.4, body-parser2.3.0→2.4.0, fast-uri3.1.8→3.1.9, qs6.16.0→6.16.1. No other root lock metadata or package entry changes. Resolved URLs and integrity fields track those versions; body-parser's dependency ranges advance with its published entry, with already-locked content-type2.1.0/iconv-lite0.7.3 satisfying the new minima. SDK1.32.1 and zod-to-json-schema3.25.2 are unchanged and their dependency/peer ranges accept Zod4.6.6. The commit lists all packages and advisories.

Coordinator 26590662-9b4f-44bc-92cc-99d43b3d0cef explicitly approves the three additional transitive fixes, conveying the human-approved advisory update: non-force audit fixes plus the Zod pin, no other upgrades. No permission is inferred from registry output. No product protocol, cap, command, dependency API usage, test or role behavior changes; no corresponding help/skill/clause migration required. No new test/resource/tier to classify. Diff check clean; actual task worktree is tracked-clean and still at the exact reviewed head/tree.

Reviewed against AGENTS.md, task/Coordinator scope, project rules 9/11/12/15–18 and docs/agents/tests.md. Crew disables Reviewer subagents; both axes performed in this session. Fowler baseline considered without independent smell finding.

M1 (resolved) — A-10322 initially claimed installation synchronized all five versions. Independent reads found only Zod updated; four actual installed manifests were still old even though npm ls showed the lockfile versions. Lead confirmed that mismatch. A-10324 now explicitly corrects the claim: original local check/50 tests used Zod4.6.6 plus old transitives, audit described the updated lockfile tree, and earlier install/check/audit/npm-ls raw stdout exists in session records rather than separate archived files. A-10323 preserves original targeted stdout with corrected attribution. No original receipt is relabelled as validating all new artifacts.

Repair kept stale directories/hidden lock in disposable backup and used the approved sealed installation flow; no source commit changed. Independent fresh reads now confirm actual node_modules manifests zod4.6.6/ip-address10.7.4/body-parser2.4.0/fast-uri3.1.9/qs6.16.1. A-10325 original output/exit sections record install, manifest assertions before checks, full npm run check, production audit0, and 50 targeted passes, all exit0, local Darwin arm64 Node24.21.0. Targeted files: in-process-spoke4, hygiene8, edges-component1, web-edge8, web-auth29; zero fail/skip/cancel. Full check includes typechecks, build and static/test lint; 132 existing findings/59 files remain report-only, zero refusals. Install's optional fsevents script-approval warning is retained; no passing script execution is invented. This is corrected local targeted evidence, not a full configured/Linux receipt.

## Spec

No outstanding findings. The pinned versions match the reviewed patched ranges: [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [ip-address advisory](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5), [body-parser advisory](https://github.com/advisories/GHSA-27r3-jxmh-p828), and [fast-uri advisory](https://github.com/advisories/GHSA-w74x-v6f9-j3xg). Publisher [Zod4.6.6 notes](https://github.com/colinhacks/zod/releases/tag/v4.6.6) identify constrained array/set/map bounds before element parsing; installed source includes that capSize wrapper. [fast-uri3.1.9 notes](https://github.com/fastify/fast-uri/releases/tag/v3.1.9) enumerate the four URI fixes; [body-parser2.4.0 notes](https://github.com/expressjs/body-parser/releases/tag/v2.4.0) confirm its security release. qs is the required dependency refresh, not an independently claimed advisory fix.

Compatibility assessment in A-10322 remains useful separately from its superseded installation claim. Relevant [Zod4.6.0 changes](https://github.com/colinhacks/zod/releases/tag/v4.6.0) and the fixed release were checked against installed SDK/schema consumers. No direct production Zod import exists in hub/src, shared or web; the direct repository import is ChannelEvent in the test harness. SDK production schemas import zod/v4. Ordinary object/string/record usage and actual MCP/list/call/channel paths pass corrected targeted checks; this is not a blanket guarantee for every upstream API.

Input-boundary answer independently confirmed: hub and web WebSocket servers cap payloads at1MiB; Unix/hub-stdio lineReader checks UTF-8 bytes for complete and unfinished lines before dispatcher parseFrame/hand validation. These direct hub routes do not invoke Zod before their caps. A separate local MCP route uses default SDK StdioServerTransport, whose ReadBuffer caps at10MiB before JSONRPCMessageSchema.parse; CallToolRequestSchema runs before forwarding through HubClient to the1MiB hub boundary. Local MCP clients can therefore validate above the hub cap, bounded by SDK10MiB. This is not a network bypass of the hub cap. Inspected tools/call arguments are a string→unknown record, not the constrained-collection schema addressed by the patch; no universal resource-exhaustion immunity is claimed. Aligning local MCP caps was already reported as separate S Tech debt; no transport-policy change added here.

C1's corrected production audit reports0 vulnerabilities as of this local run, but full configured runtime evidence is not yet present. Source clearance and 50 targeted passes alone do not verify C1. Proceed with mode-free verification at this exact head; final evidence must state actual phases/platform, updated dependency artifact provenance, report/enforce modes and any deferred tiers. Coordinator's planned integrated Linux/macOS full coverage after landing remains separately attributed, not already satisfied.

QA policy none/after-stage, no per-item brief or qaCriteria. Reviewer performed read-only source/Git/artifact and official upstream documentation review; no tests, probes, install/audit commands, edits, live browser/GUI, merge or delegation.

Standards: 0 outstanding findings (M1 corrected). Spec: 0 findings.

Durable source review: A-10326.

### impl-1189 · 2026-10-24T06:48:13.952Z

Boundary follow-up filed by Coordinator as T-1208 (Tech debt, S): align the local spoke SDK's 10 MiB pre-validation MCP buffer with the hub's 1 MiB cap. Direct hub network/Unix input is capped before validation; local MCP validation can occur above 1 MiB, bounded by the SDK cap. T-1189 remains dependency-only. Source-clear head 9778912a and admitted mode-free verify f4ace04e-a195-4062-a3fc-f741614dbc2d remain unchanged; awaiting its hub result.

### impl-1189 · 2026-10-24T06:54:23.015Z

Mode-free Linux droplet verify f4ace04e at 9778912a failed: 2780 pass / 1 fail; T1/T2 exit 0, Web exit 1, budgets report-only. A-10329 records `locator.waitFor: Timeout 3000ms exceeded` for R-1100 at web/test/items.test.ts:44. Exact local isolated test reproduces (A-10330). Minimized fixture mismatch: liveRelease is computed before seedTree adds versioned open R-900000 (99.0.0), displacing expected unversioned R-1100 after previous versioned releases closed. Pure currentRelease probe confirms before R-1100 / after R-900000. Reported to Coordinator and Reviewer; awaiting Coordinator-posted shared fix, no source edits or retry.
