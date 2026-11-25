---
id: T-2096
kind: task
title: fixtureNativeGuard defaults to unfenced (options.fenced ?? false), so a rejected resource close in any receiptFixtureCase/fixtureNativeGuard caller can still reach native-guard restoration
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1775
branch: t/T-2096-fixturenativeguard-defaults-to-unfenced
created: 2026-11-25T02:35:20.019Z
updated: 2026-11-25T07:42:26.766Z
closed: 2026-11-25T07:42:26.766Z
---

## Summary

hub/test/fake-native-guard.ts defaults `fixtureNativeGuard` to unfenced, `fixtureGuard(t, false, options.fenced ?? false)`, and the process-cleanup drain is catch-and-continue. So in a caller that doesn't pass `fenced`, a rejected resource close can still let the native guard be restored while the resource lives on: the same hazard T-1979 closes for guardedLeaseCase. T-1979 (7cec18426) adds a positive canRelease() receipt to fenceFixtureCleanup, but doesn't change this default. impl-2017 found it during T-2017's review (2026-11-25) and fixes only its own new callbacks with an explicit fence. 26 test files use receiptFixtureCase or fixtureNativeGuard.

## What to build

Make the fenced, positive-release path the default for fixtureNativeGuard and receiptFixtureCase, keeping an explicit opt-out only where a caller proves it needs one. Migrate or audit every caller, and publish an inventory.

## Acceptance criteria

- [x] C1. With a fake resource whose close rejects, a default fixtureNativeGuard or receiptFixtureCase case keeps the native guard installed and reports the rejection; a repaired close then releases it (test, red before).
  - done: impl-2096 · 2026-11-25T05:54:26.607Z
  - verified: rev-40 [reviewer] · run rev-40-20261125-2096-final · 2026-11-25T07:06:20.586Z · commit d7f04209cfb0efc46cfd86a5505a8e61b6fd8cfb
- [x] C2. Every remaining unfenced caller is listed in an inventory with its reason, and the listed T1 and T2 callers pass (evidence).
  - done: impl-2096 · 2026-11-25T05:45:38.027Z
  - verified: rev-40 [reviewer] · run rev-40-20261125-2096-final · 2026-11-25T07:06:20.586Z · commit d7f04209cfb0efc46cfd86a5505a8e61b6fd8cfb

## Comments

### coord · 2026-11-25T02:41:06.565Z

Also from impl-2017 (T-2017, 2026-11-25): receiptFixtureCase's comment says its original work and guard hooks are fenced, but its default fixtureNativeGuard(scope.fixtures) is unfenced. Fix that comment together with the default. T-2017 opts its own new callbacks into fenceFixtureCleanup explicitly.

### impl-2096 · 2026-11-25T05:42:42.029Z

Consumer inventory before default change: 26 existing fixtureNativeGuard/receiptFixtureCase test files, plus host-status via already-fenced fixtureCliNativeGuard and new case-deadlines regressions. Native receiptFixtureCase callers login-add and nvim/qa intentionally bypass fake launch denial; their behaviour is unchanged. No fenced:false callers. Existing fenced:true callers already use the new path. Unspecified callers now retain restoration until resource/hub/directory receipts; no opt-out needed. Full named inventory and tier classification will be published with evidence. Search covered helper names, fenced options, imports, docs, skills, QA, production and all tier manifests.

### impl-2096 · 2026-11-25T05:45:38.541Z

Inventory and red/green focused evidence: A-23287. Full named dispositions include default, explicit fenced, raw fakeNativeGuard, and native=true receipt cases. No unfenced opt-outs. 27 default/receipt/CLI test consumers including new regression (26 pre-existing total). Static transitive import closure: 111 tests (14 T1, 68 T2, 26 T3, 2 T4, 1 Web). Local partial: case-deadlines 10, database-cleanup 12, harness-framing 12, digitalocean-pacing 33, fixture-orphans 17, suite-protocol 18, all pass; other coverage pending reviewed-head droplet verify. Typecheck and full test:lint exit 0. origin/dev 22ac59c0d merged before review.

### rev-35 · 2026-11-25T05:49:08.446Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2096-source-1
commit: aff332af5d1de2b91a2bd671aea3db1fca849e9c
scope: full
findings: [{"severity":"medium","text":"Two new default-owner proofs have no encompassing pre-acquisition whole-callback owner/named setup-proof bounds. receiptFixtureCase owns only acquire; later rejection/assertion/repair continuation can race the real after fallback that repairs/drains/restores without joining it.","file":"hub/test/case-deadlines.test.ts","line":21},{"severity":"medium","text":"A first real outer drain caches caseDeadlines.close's rejected cleanup promise after nested closure failure. A repaired outer retry returns that rejection without revisiting the repaired nested closer. New test drains nested fixtures directly and misses this normal public-owner failure/repair path.","file":"hub/test/receipt-fixture-case.ts","line":16}]
finding_counts: {"high":0,"medium":2,"low":0}

Not clear, two medium findings in A-23288, both confirmed by retained-source answer e390a56e. Default flip/direct fixture fence is correct in substance; raw/CLI/native exceptions unchanged. Direct caller census exactly matches all46 inventory rows, no explicit fixture fenced:false opt-out. Consolidated bar: complete new callback owner before acquisition, independent named setup/proof observations and joined fallback; actual OUTER cleanup failure then repaired retry must revisit failed closure, preserve completed-step receipts and closed admission, release guard only on positive closure. Update reachability dispositions if shared retry semantics change. C1 failed; C2 unverified pending full caller receipts. Five local logs scoped92 passes, reportedcase10/typecheck/lint not configured proof. Source/experiment hold positively released for correction and Coordinator-scheduled checks; fresh committed-head review before verify.

Criteria: C1 failed (Default-owner regressions lack complete proof ownership and receiptFixtureCase cannot repair/release through its cached failed outer cleanup; add owned real outer-drain red/green proof.).

### rev-40 · 2026-11-25T05:54:18.098Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-2096-source2
commit: d7f04209cfb0efc46cfd86a5505a8e61b6fd8cfb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-23291. PriorM1/M2 resolved: complete stageCase-owned proof callbacks precede guard acquisition with named setup/proof bounds and joined fallback. Actual registered OUTER cleanup drives rejection/repair; exact cause preserved, native guard retained, two close attempts/positive restoration and no completed-hook/resource replay asserted. caseDeadlines retains in-flight attempt across timeout and resets only settled rejection, preserving closed admission/completed hooks; fake receipt outer owner now fenced. Pinned search matches65case-deadlines importers; earlier46guard/raw inventory retained, no fixturefenced:false opt-out.774module closure is reachability only. Six local files102pass/0fail are partial macOSNode24.21 proof, not configured suite. C1/C2 final verification pending exact-head configured/caller receipts; C1 done checkbox currently still unset after old failure. No Reviewer execution/edits.

### impl-2096 · 2026-11-25T07:05:22.438Z

Configured run ce4f00c2-df22-441c-a4ad-4b2fcbb999fc passed at exact reviewed d7f04209c; artifact A-23306. Structured result complete exit0 T0/T1/T2/T3/Web, no T4 receipt. Linux x64 6.8.0-149-generic droplet, Node24.21.0, Neovim0.12.5, Chrome Headless Shell156.0.8078.4 (Playwright1248). Both generated default-owner regression names pass in T2 plus five load-gate repetitions each; all10 base case-deadlines pass. Completed row outcomes9639pass/12skip include repetitions and are not unique-test counts. Droplet lifetime4102s/cost$0.2849. Reviewer has receipt for final criterion settlement.

### rev-40 · 2026-11-25T07:06:20.586Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-2096-final
commit: d7f04209cfb0efc46cfd86a5505a8e61b6fd8cfb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-23307. Exact-headce4f00c2/A-23306 passed; canonical1d7ca6e2 matches reviewed executable source. C1 both exact default-owner base cases pass15538/15542 plus separate5/5load16101/16074; all10case-deadlines bases pass, preserving exact rejection/guard retention/outer retry/positive repair/nonreplayed hooks. Published red-beforeA-23287/A-23290 retained as author receipts. C2 inventory64distinctT1/T2 test files all have positive structured base outcomes; no failing/cancelled outcomes. Separate unrelated macOS selector skip in suite-close-component retained, not counted as proof.46guard/raw rows+65close importers remain source-audited;774module reachability not coverage. Actual T0/all248T1/fallback449T2/selected244T3/55Web exit0; T4unexecuted/remainingcoveragebatch. NoncachedLinuxx64 c8fra1 workers2 Node24.21/Nvim.12.5 HeadlessShell1248/CfT156.0.8078.4.12prerequisite skips/advisory budget notices retained. No Reviewer execution/edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-25T07:42:26.766Z

Merged 33cefd2a3dc0b3624fe0debea7f1d3b9cb59be8f onto dev.
