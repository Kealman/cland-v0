---
id: E-1280
kind: epic
title: Session lifecycle and delivery
state: closed
criterion_seq: 2
labels: []
assignee: null
parent: R-1277
blocked_by: []
topic: topic-1058
branch: null
created: 2026-10-25T09:52:42.374Z
updated: 2026-10-26T01:32:58.144Z
closed: 2026-10-26T01:32:52.964Z
---

## Summary

Sessions survive restarts, re-execs and provider hiccups without a Coordinator message: a deaf session after a Claude Code re-exec is detected, long Codex threads reattach, provider-capacity failures retry, and OpenCode sees the user's Console login. Triage: A-11669 (approved by the human, ask f93ccf6a).

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1280 · 2026-10-26T01:32:46.236Z · commit 9d60746bcbbb57098ff2da2cab2940329b0acd58
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1280 · 2026-10-26T01:32:46.236Z · commit 9d60746bcbbb57098ff2da2cab2940329b0acd58

## Plan

```yaml
stages:
  - name: deaf sessions, long threads and logins
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1256
        - T-1224
      - - T-1265
      - - T-1230
        - T-1302
      - - T-1258
  - name: retry, reservations and launch values
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1249
        - T-1235
        - T-290
```

## Comments

### qa-677 · 2026-10-25T17:15:37.061Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-stage-2026-10-25-677-2
commit: 2b9d3c2b422f72f82a3011984f8cd48544d96341
stage: deaf sessions, long threads and logins
stage_hash: 07629d36231b4061506215b066b7867e5cefe04a74c0eb36110de475a0bb3d20
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

CLEAR — stage deaf sessions, long threads and logins. Build 2b9d3c2b422f72f82a3011984f8cd48544d96341, clean detached HEAD matched dev before and after. Six stage items are landed; affected/after-stage cover pair is green at verification tree 2bc8ecaf43f7326a238bdd164dfcbd7e4422bba9 (Linux 7cf7c622, macOS 7867cc49).

| Case | Result | Execution |
|---|---|---|
| M1 | PASS | claude-code-schedule: 20 |
| M2 | PASS | inject-stalled: 8 |
| M3 | PASS | mod-bridge: 1 |
| M4 | PASS | codex-delivery: 5 |
| M5 | PASS | codex-native: 33 |
| M6 | PASS | codex-adapter: 13 |
| M7 | PASS | roles-component + config-reload-component + roles-timing: 18 |
| M8 | PASS | doctor-harness-probe + opencode-launch-policy + opencode-native: 47 |
| M9 | EXCLUDED | Live doctor probes against human HOME violate rule 15; withdrawn by Coordinator in topic-1058, msg 61eb6b19. Not executed or counted as pass. |

145/145 tests passed across 12 serial single-file node --test commands, zero skipped/cancelled/todo. Execution: local darwin arm64, Node v24.21.0, isolated disposable HOME/XDG/Git via shared fixture builder. T1–T3 selected files only; fake harness binaries and scripted transports, no real provider, browser, full suite or performance budget gate. Generated case names and actual native summaries independently checked in case-summary.json. No findings. No epic criterion marks.

Evidence: A-12040, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12040-e-1280-stage-qa-clear-145-tests-at-2b9d3c2b/report.md (commands, outputs, receipts, recorder rows and build checks). Earlier stale admission run qa-stage-2026-10-25-677 executed no tests; this verdict covers fresh run qa-stage-2026-10-25-677-2 only.

### qa-677 · 2026-10-26T01:32:46.236Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-dod-2026-10-26-677-1280
commit: 9d60746bcbbb57098ff2da2cab2940329b0acd58
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Check | Result | Evidence |
|---|---|---|
| C1 | PASS | Nine children closed/done/merged. Clear hub Reviewer verdicts match green native run heads and landing Reviewed-by trailers; source/squash zero-context stable patch IDs agree; all landings precede cover head. |
| C2a | PASS | Both stages closed; last-stage covers A-12220/A-12224 green at e090007b811ef4609d490207b55955e0adcfc1e8, tree 1cf21684ee60610c56277c9688243784912bef67. Stage-1 QA A-12040 current/clear. |
| C2b | PASS | 19 listed files, 242 named passing cases in each cover, zero scoped skips/failures; all 19 child criteria mapped to exact passing names and recorded historical/document evidence. |

CLEAR. Run qa-dod-2026-10-26-677-1280 at 9d60746bcbbb57098ff2da2cab2940329b0acd58; verified C1,C2. No findings. No tests/suites/stress/browser/harness/demo lease were started; this is a record-reading audit.

C1 qualification: T-1265's latest verify e5108363/A-12000 is FAILED and remains so. The landed fea3ca1f head had green 96d5a3ee/A-11922 at 12:40:14Z and clear rev-34-20261025-1265-final3. Later red diagnostics were “publish needs a clean project root on dev”, missing install/shared/protocol-frame.ts and roles-timing “0 !== 300”. Exact corresponding test names pass in both current covers. C1 establishes a green same-head run at landing; it does not claim the latest row is green.

C2 maps re-exec delivery/Coordinator alert, Codex startup grace and long-thread failures, async skill/hello filesystem guard, timing completion receipt, isolated OpenCode diagnostics/docs, bounded capacity retries/cancellation/exhaustion, renamed resume reservation cleanup, and invalid launch-policy refusal/recovery. T-1302's historical local 5/5 and skip-wait negative control use A-11918 original transcript excerpts with its explicit raw-capture/omitted-stack limits. T-290 source/item records retain approval/sandbox diagnostic findings and typecheck/configured evidence. No historical repetition was rerun. A-12040's withdrawn live doctor M9 remains excluded, not a pass.

Covers: Linux x64 6.8.0-142-generic/droplet 59c74afd: 4808 pass,9 skip,0 fail; macOS darwin arm64 27.0.0/local e130305d: 4816 pass,1 skip,0 fail (4817 native total each, no cancellations/todos). All scoped names pass. Both completed host check/T1–T4 base/Web; 14 T4 files base-only, repetition gates skipped, budgets/ratchets report-only. No performance enforcement pass or projection-as-wall claim. Both Node v24.21.0/Neovim v0.12.5. Linux browser Chrome Headless Shell156.0.8078.4/Playwright1248; exact macOS binary/version absent from retained log and not inferred. Linux cover shard lifetimes1513.573s/1292.277s, costs$0.10510924/$0.08974146 (~$0.1949); historical child accounting/actual phases in artifact.

Clean detached HEAD matched requested SHA/dev. demo status reports freshness.current:true,state:none. A-12226 contains full hashes, native records, exact criterion names, source declarations, log hashes, historical accounting, three recorder rows and freshness: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12226-e-1280-dod-qa-clear-record-audit-at-9d60746b/report.md. Secret scan passed.

Criteria: C1 verified, C2 verified.
