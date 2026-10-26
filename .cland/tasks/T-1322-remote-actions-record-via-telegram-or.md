---
id: T-1322
kind: task
title: Remote actions record via telegram or discord on messages, answers, approvals and ask outcomes, shown in both workbenches
state: open
status: ready
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1307
blocked_by:
  - T-1321
topic: topic-1079
branch: t/T-1322-remote-actions-record-via-telegram-or
created: 2026-10-26T02:28:46.572Z
updated: 2026-10-26T04:12:29.875Z
---

## Summary

Messages, answers, approvals and ask outcomes made through a remote record `via` with the values `"telegram"` and `"discord"`, and both workbenches show it. Today an ask's outcome lacks `via`, while an approval's already has it (Q-1292).

## What to build

Add `"telegram"` and `"discord"` to the `via` values on messages, answers and approvals. Record `via` on an ask's outcome the way an approval's outcome already does. Neovim's and the web's inbox and message rows render "via Telegram" or "via Discord". Older clients must keep working when they meet the new values (rule 20: list every consumer of the changed shapes in this item). Spec §3.1.

## Acceptance criteria

- [x] C1. An ask and a fake Codex approval answered through the test messenger record `via` on the outcome, and a message sent through it records `via` (test).
  - done: impl-1322 · 2026-10-26T03:54:06.422Z
  - verified: rev-26 [reviewer] · run rev-20261026-1322-evidence-1 · 2026-10-26T04:12:29.731Z · commit b83556ee9f145950f843f1a3b84b0e7583e38c23
- [x] C2. Headless Neovim and headless Chromium show "via Telegram" on those rows, and a client at the previous wire shape still reads them (test).
  - done: impl-1322 · 2026-10-26T03:58:18.815Z
  - verified: rev-26 [reviewer] · run rev-20261026-1322-evidence-1 · 2026-10-26T04:12:29.731Z · commit b83556ee9f145950f843f1a3b84b0e7583e38c23

## Comments

### impl-1322 · 2026-10-26T03:43:18.346Z

Rule 20 consumer inventory before changing provenance: owners hub/src/protocol.ts and shared/wire/index.ts (Via, AskOutcome, ApprovalOutcome; additive remote enum values and optional ask outcome via, retaining all old fields/values); hub/src/remote/gateway.ts and hub/test/fakes/messenger.ts (trusted per-request messenger source); hub/src/hub/dispatch.ts, core.ts, asks.ts, inbox.ts (capture and propagate source, including declines and lead relays); hub/src/hub/store.ts (messages.via TEXT and JSON ask/inbox outcomes already accept additive fields, no migration); hub/src/spoke/spoke.ts and envelope/message projections (forward source without validation); hub/src/cli/inbox.ts and task.ts (generic outcome/answer readers); adapters contract.ts/codex.ts/opencode.ts and fake harness (approval outcome type widened, native outcomes unchanged). Workbench consumers: web connection/model/recovery and inbox visit retain whole rows; MessageBlock, AskCard, ApprovalCard, InboxArchive need source labels; Neovim client/state preserve fields, thread, ask_card and inbox need source labels. Startup snapshot/model serializers and wire-conformance mirror types; no row membership or protocol version change. Previous-wire client regression will use the existing hello with no new feature and read new values; clients must also render old ask outcomes without via. Searches included production, shared wire, all hub/nvim/web test tiers, startup probes, persisted readers, shipped skill examples and QA briefs. Existing approval/ask-chain/restart/CLI/native, browser inbox/phone and Neovim inbox/thread/ask fixtures retain local neovim/web/harness behavior; recorded old protocol fixtures remain valid because ask via is optional. QA E-414-stage-1 local-neovim/web expectations remain correct and its historical scope is unaffected. Gateway-specific guidance, hub README and implement skill will describe the new trusted source; no commands/permissions/role clauses change.

### rev-26 · 2026-10-26T03:57:56.194Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261026-1322-source-1
commit: 52d63e354fd6f4d15d51d5624535a72e38192826
scope: full
findings: [{"severity":"medium","text":"M1: Missing index entries for docs/agents/tests/nvim-test-remote-via.test.ts.md and docs/agents/tests/web-test-remote-via.test.ts.md make the existing test-docs membership guard fail. Add exactly the two owning index rows and retain original unchanged-guard red/green receipts; review the corrected pushed head before verification.","file":"docs/agents/tests/index.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

Full Standards/Spec source audit completed at 52d63e354; A-12265 contains the consolidated verdict and scope. M1 is the sole finding: both new workbench test guides are missing from the index, violating the unchanged test-docs membership guard. Trusted per-request provenance, persistence/relay/denial propagation, additive wire compatibility, both rendering paths and targeted regression seams have no additional source findings. The reported two-row working-tree correction is outside this commit. Commit/push it with original guard red/green receipts, restore claimant done as needed and request corrected-head source review before configured verification. No reviewer tests or configured evidence claim.

Criteria: C2 failed (Supporting new workbench test guides are unindexed at this commit; source settlement awaits the two-row correction and original guard receipts.).

### rev-26 · 2026-10-26T03:58:39.177Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1322-source-2
commit: b83556ee9f145950f843f1a3b84b0e7583e38c23
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear: A-12266. A-12265 supplies the completed full audit; the sole-parent correction is exactly two correct guide index rows, with no other source changes or dev merge. M1 resolved; unchanged guard red 2/3 then green 3/3 original local receipts inspected in A-12263. No remaining Standards/Spec findings. C1/C2 remain claimant done pending final same-head configured evidence; no reviewer execution or final runtime verification claim.

### rev-26 · 2026-10-26T04:12:29.731Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1322-evidence-1
commit: b83556ee9f145950f843f1a3b84b0e7583e38c23
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head configured evidence clear; A-12271 records the independent runtime audit of A-12269/run 3685d5eb. C1/C2 verified. Exact-head exit 0, 3335 deduplicated ordinary test passes and 450 file passes, separately 15 actual T2 load-gate test passes (three identities × five). Both remote source cases, rendered Neovim and Chromium rows, archive/reload/previous-shape compatibility and the corrected docs guard have named pass/timing receipts. Web additionally records report-only 10/10 whole-file repetitions; no per-case five-repeat inference. T0/all T1/fallback all T2/mapped T4 base once/Web completed; no T3 or full integration claim. Linux droplet c-8 lon1, Node24.21.0/Neovim0.12.5/pinned Headless Shell156.0.8078.4-v1248. Host prepared-tree typecheck not repeated remotely. Report-only warnings retained; all new individual base cases below3s, no allowance required. Source A-12266 unchanged; no findings, no reviewer execution. Coordinator owns readiness and landing.

Criteria: C1 verified, C2 verified.
