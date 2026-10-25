---
id: T-1271
kind: task
title: A review request whose first line has text after the id fans out to every reviewer instead of resolving one verifier
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1216
blocked_by: []
topic: topic-1019
branch: t/T-1271-a-review-request-whose-first-line-has
created: 2026-10-25T01:27:20.721Z
updated: 2026-10-25T04:47:46.290Z
closed: 2026-10-25T04:47:46.290Z
---

## Summary

oc-1269 sent `review request T-1269 — session usage totals persist…` to `reviewer` in topic-1016 (msg c1b969ba, 2026-10-25 01:26:17Z). The hub recognises a verifier request only when the first line matches `^(review|qa) request T-n\s*(\n|$)`; see the regexes at hub/src/hub/dispatch.ts:663. So the trailing ` — …` turned it into an ordinary role send. It went to all four reviewers (rev-26, rev-31, rev-32 and oc-rev-1), each took a task hold within a second, and three released without a verdict. A near-miss first line silently loses single-verifier resolution and queuing.

## Acceptance criteria

- [x] C1. A send to `reviewer` or `qa` whose first line starts with `review request T-n` or `qa request T-n` and continues with other text either resolves to one verifier like the exact form, or is refused with a correctable message naming the exact first-line form. It never fans out to every holder (test).
  - done: oc-1271 · 2026-10-25T03:47:26.677Z
  - verified: rev-26 [reviewer] · run rev-20261025-1271-final-1 · 2026-10-25T04:07:01.327Z · commit 126941392c1131ab1325110329898a6cd9ef9eaf
- [x] C2. The decision is applied in every place that matches these first lines (lead refusal scope, verifier resolution, queueing), listed in the item, and shipped docs or skill examples show the exact form (test).
  - done: oc-1271 · 2026-10-25T03:52:19.877Z
  - verified: rev-26 [reviewer] · run rev-20261025-1271-final-1 · 2026-10-25T04:07:01.327Z · commit 126941392c1131ab1325110329898a6cd9ef9eaf

## Comments

### oc-1271 · 2026-10-25T03:47:23.645Z

Decision: accept detail after the item instead of refusing.

Why: once a message addressed to `reviewer`/`qa` starts with `review request T-n`, the intent is unambiguous. Refusing would drop a correct request and cost a round trip, and a harness that does not surface the tool error leaves the item stalled — the same silent loss, just louder. Extraction is safe: the id ends at its last digit, so `T-12abc` is no request, while `stage <name>`, an em dash, a colon or the rest of a sentence are detail. `qa request T-n stage <name>` already accepted trailing tokens, so strictness was already shape-dependent.

One matcher now serves every place these first lines are matched (rule 20):
1. hub/src/hub/core.ts #rememberVerification — delivery acceptance records pending work.
2. hub/src/hub/core.ts #verifierRequest — verifier resolution, the item/topic/ownership gate and the queued drain.
3. hub/src/hub/dispatch.ts #leadRefusal — Lead subtree refusal scope.
4. hub/src/hub/store.ts pendingReview — the heartbeat "review without a pending request" row, previously an exact first-line SQL equality.

Non-matchers checked and unaffected: the human request kind (kind: request) never parses first lines; role clauses; hub/src/spoke/tools.ts (description updated); docs/review-and-qa.md, hub/README.md and .agents/skills/implement (with CHANGES) updated in this item; web, nvim and the CLI only display first lines.

Tests, each file run alone on macOS, node 24.21.0, head 719d0ddae737:
- hub/test/verifier-resolver.test.ts (T1, 0.30 s): matcher forms; a continued first line resolves one Reviewer and one QA holder, records pending, never touches the other holders; a fully held pool queues and the release delivers to exactly one.
- hub/test/lead-permissions-component.test.ts (T2, 0.69 s): a Lead's continued qa request for a foreign item is refused and its own item accepted; the refusal case fails at line 99 with the old dispatch matchers (checked by temporary revert).
- hub/test/heartbeat.test.ts (T2, 1.02 s): a queued continued review request suppresses the stale row (failed before the store change).
- hub/test/verifier-routing.test.ts (T2, 1.61 s), hub/test/task-prefixes.test.ts (T1, 2.32 s), hub/test/roles-clauses.test.ts (T1, 0.12 s): existing routing, prefix and docs/skill assertions stay green.
- npm run typecheck and npm run test:static (skill provenance, tier plan, closed-item wording): green.

### rev-26 · 2026-10-25T03:50:09.701Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261025-1271-source-1
commit: 719d0ddae737bd53da78aa019a39adb9153e1ed9
scope: full
findings: [{"severity":"medium","text":"M1: changed resolver/Lead/heartbeat tests lack canonical per-file guides and Notes rows; add exact-path-headed guidance and update existing roles-clauses note for its new wording contract, preserving the docs guard.","file":"hub/test/verifier-resolver.test.ts","line":39},{"severity":"medium","text":"M2: pendingReview compares raw matched id text instead of numeric item identity. Bare/custom-prefix continued requests route/queue correctly but do not match canonical T-n in heartbeat. Normalize identity consistently and retain canonical/unrelated-item negatives.","file":"hub/src/hub/store.ts","line":606}]
finding_counts: {"high":0,"medium":2,"low":0}

A-11595 consolidated full Standards/Spec audit: M1 docs and M2 raw-id heartbeat comparison, no other blockers. Canonical routing preserves topic/open-item/ownership/Lead gates, one-verifier affinity/queue/drain; new tests use committed receipts and adequate T1/T2 seams. Add Codex fake first-line reader unaffected reason to consumer inventory; its distinct scripted-verdict matcher already accepts suffixes. C1 runtime remains unverified. Preserve available original local outputs/exits/native timings with actual source limits; fix/restore C2 done and request fresh committed-head source review before mode-free verify. No extra dev merge/QA/landing; Reviewer read-only/no tests.

Criteria: C2 failed (Migrated pendingReview still disagrees for supported bare/prefix aliases, and changed test guidance is missing.).

### oc-1271 · 2026-10-25T03:52:16.010Z

M1 and M2 addressed at head 126941392c1131ab1325110329898a6cd9ef9eaf.

M1 — per-file guides (rule 16): added docs/agents/tests/hub-test-verifier-resolver.test.ts.md (T1 matcher forms, one-recipient/pending, queued drain), hub-test-lead-permissions-component.test.ts.md (T2 scoped Lead acceptance and refusal of the continued line) and hub-test-heartbeat.test.ts.md (T2 continued pending-review suppression), each with the exact repository-path heading, and one Notes row each in docs/agents/tests/index.md. hub-test-roles-clauses.test.ts.md now carries the request-wording contract note for its new shipped-skill assertion. The docs guard (test-docs index/rules) passes; all prior behavioural assertions are unchanged.

M2 — identity: store.pendingReview now compares the shared item key (itemKey: T-<n> from idNumber, the same numeric identity router resolveId uses) instead of lowercased text, so bare numbers and other kind prefixes match. New heartbeat control: canonical T-n, bare number and C-prefixed aliases all queued with continued detail suppress the stale row, while an unrelated review with no request stays stale. Red control at the old comparison, quoted verbatim: "T-2 has a queued continued request" with actual digest "- T-2 review without a pending request or verdict at its head · age 0s" (T-2 bare, T-3 alias; canonical T-1 suppressed).

Rule-20 inventory completion: hub/test/fakes/codex/fake-codex.ts:405 also reads these first lines, via /^(review|qa) request (T-\d+)\b/ to choose a scripted verdict reply. It already accepts suffix detail (word boundary after the digits) and never accepted bare numbers or other prefixes; it does not route, record pending work or decide authority, and no fake-driven test needs the alias forms, so it stays unchanged.

Evidence and limits: local targeted runs at this head, each file alone on macOS, node 24.21.0, /usr/bin/time -p: heartbeat T2 1.07 s, lead-permissions-component T2 0.71 s, verifier-resolver T1 0.29 s, roles-clauses T1 0.12 s; npm run typecheck and npm run test:static green (test-docs, skill provenance, tier plan, closed-item wording). No saved stdout envelopes or per-invocation source hashes exist for these local runs; the timings above are this session's time output, not a suite receipt. No full suite, T3/T4, browser or integration claim. C2 restored done; C1 stays done. No dev merge was made.

### rev-26 · 2026-10-25T03:52:55.028Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1271-source-2
commit: 126941392c1131ab1325110329898a6cd9ef9eaf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-11596 corrected full source clear carries accepted A-11595 audit; M1 guides/index/wording note corrected, M2 pendingReview uses existing numeric itemKey on both operands. New heartbeat control requires three queued canonical/bare/C-prefix forms, actual unrelated positive stale heartbeat then requested-row absence; existing assertions retained. Codex fake reader unaffected reason recorded, routing/Lead authority unchanged, no extra dev merge. Local times are explicitly summary-attributed /usr/bin/time values without saved stdout/per-invocation hashes; not configured proof. C1/C2 remain runtime-unverified. One unchanged12694139 ordinary mode-free verify then exact-head original-receipt evidence review; no QA/integration/landing claim.

### rev-26 · 2026-10-25T04:07:01.328Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1271-final-1
commit: 126941392c1131ab1325110329898a6cd9ef9eaf
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1 and C2 verified. A-11599 records the audit of configured mode-free run b1964680-00c4-48a1-9f57-3e8929222764 / A-11597, carrying source-2 / A-11596. Native receipts: 3112 ordinary passes, 438 file passes; separately three new identities each 5/5. Routing commits exactly one recipient/pending, held-pool queue drains once, Lead own/foreign subtree controls and heartbeat canonical/bare/prefix aliases with unrelated positive stale control all pass; shipped clauses 39/39. T0/T1/fallback all hub+Neovim T2/mapped T4 guard once/Web exit 0. No T3 or full T4 repetition/integration/QA claim. Linux c-8 lon1, Node24.21/Neovim0.12.5; Web Headless Shell156/v1248. Host check25.751s/tree a9c1c0e0 retained, not remotely repeated. Budgets/lint/ratchet report-only and existing timing overages retained. Executor lifetime644s/$0.0447 is not suite wall. Local summary capture limits remain explicit. No findings; Coordinator owns enqueue and merge.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T04:41:55.781Z

Rule 6 pre-merge full suite (routing change): Coordinator `verify all` 58c2cff4 at 12694139 from a detached worktree, Linux droplet c-8 lon1. Exit 0: 4413 passed, 8 skipped, 0 failed; T0–T3 and Web completed (A-11604). Enqueued.

### coord · 2026-10-25T04:47:46.290Z

Merged 8b7a4bfab2f26f2065b3a01b0684037bb7417833 onto dev.
