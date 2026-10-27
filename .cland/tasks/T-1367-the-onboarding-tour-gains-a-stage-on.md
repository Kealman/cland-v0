---
id: T-1367
kind: task
title: The onboarding tour gains a stage on remote control
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by:
  - T-1362
  - T-1366
topic: topic-1121
branch: t/T-1367-the-onboarding-tour-gains-a-stage-on
created: 2026-10-27T05:46:50.673Z
updated: 2026-10-27T20:33:15.198Z
closed: 2026-10-27T20:33:15.198Z
---

## Summary

The tour's ninth stage teaches remote control in the tour's form: one round, tied to what is on the human's screen, ending with its "Look now". Its commands match `cland remote` and `cland secret` as built.

## What to build

Spec §3.11 (the onboarding) and v0.1.4 §3.4 (the tour's form). The stage covers:
- what a remote is: the human's private Telegram chat with the project's bot, mirroring General and the needs-you rows;
- what the human can do from it (write to the Coordinator, answer asks, approve commands, `/status`, `/inbox`, `/mute`);
- what stays in the workbench: pairing approval, plans and every topic but General;
- that setting a remote up is one `cland setup` run in the human's own terminal, because a token is typed only at a hidden prompt (see the open question).

It ends with "Look now: the Remotes row in the sessions panel". It names Telegram only. Discord's line comes with 11 and the speech key's with 09. The SKILL.md tour offer and the skill test's stage count move from eight to nine. The command check also verifies that every secret name the stage mentions is one of `cland secret`'s names.

**External wait and shared files:** none · **Shared files:** .agents/skills/onboarding/TOUR.md, .agents/skills/onboarding/SKILL.md, hub/test/skills-onboarding.test.ts

## Acceptance criteria

- [x] C1. TOUR.md has nine numbered stages, the ninth on remote control, each with exactly one "Look now" line (test).
  - done: impl-1367 · 2026-10-27T20:08:03.747Z
  - verified: rev-26 [reviewer] · run rev-20261027-1367-evidence-1 · 2026-10-27T20:25:20.086Z · commit f4caee5606c5f184b79e97f418800f8eb522a649
- [x] C2. Every `cland` command and config key in the stage passes the onboarding command check against the CLI help, and every secret name it mentions is one of `cland secret`'s names (test).
  - done: impl-1367 · 2026-10-27T20:08:03.898Z
  - verified: rev-26 [reviewer] · run rev-20261027-1367-evidence-1 · 2026-10-27T20:25:20.086Z · commit f4caee5606c5f184b79e97f418800f8eb522a649

## Comments

### impl-1367 · 2026-10-27T20:06:39.694Z

Implementation seam: extend existing source-only onboarding tour/command checks in hub/test/skills-onboarding.test.ts (T1 assertions within the existing T2 file), against exported CLI help, configKeys and canonical secret names. Add stage nine and the narrowly approved hidden-token setup exception; preserve earlier stages. No runtime reply/schema/credential/admission contract changes. qaPolicy none; no per-item brief required.

### impl-1367 · 2026-10-27T20:09:26.913Z

Review M1/M2 fixed in f4caee5606c5f184b79e97f418800f8eb522a649, pushed to origin. Migrated exact generated duration identities preserving 0.000746/0.001365; file totals, tier and existing allowances unchanged. Repo-wide identity audit found no other active references; eight-stage references in historical v0.1.4 spec and E-616 QA evidence retained. Stage now matches Web RemotesLine and Neovim panels: enabled/unpaired row, all-disabled absent row; exact Look now retained. Local macOS skills-onboarding.test.ts re-run 13/13, 2.275 s file wall; prior npm run typecheck passed, changes since are prose and duration JSON keys only. Holding replacement review/verification pending consolidated source findings as requested by Reviewer.

### rev-26 · 2026-10-27T20:09:52.102Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1367-source-1
commit: c169f0c3bc2b2b3858dc3610eebf9f938aca81e6
scope: full
findings: [{"severity":"medium","text":"M1 Standards: both renamed onboarding test identities retain their old duration keys (command/config negative-control title and eight-stage tour title). Migrate exact keys preserving .000746/.001365 measurements and audit owned identity/manifest inputs.","file":"hub/test/durations.json","line":4586},{"severity":"medium","text":"M2 Spec/docs: disabled remote is described as a visible Remotes row, but both Web RemotesLine and Neovim panels filter enabled rows and omit the section when all are disabled. Explain enabled/unpaired versus disabled/absent while retaining exact Look now line.","file":".agents/skills/onboarding/TOUR.md","line":64}]
finding_counts: {"high":0,"medium":2,"low":0}

Full consolidated review A-12880: Standards M1 medium, Spec M2 medium (exact TOUR finding line64). Stage/secret validator and other claims otherwise sound; no runtime/shared-contract change. A-12879 local targeted 13/13/typecheck is not configured/Linux proof. Both corrections prepared outside reviewed commit; no additional findings. Push corrections and request fresh source review before verification. C1/C2 runtime marks pending; QA none; no Reviewer execution.

### rev-26 · 2026-10-27T20:11:41.434Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1367-source-2
commit: f4caee5606c5f184b79e97f418800f8eb522a649
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full corrected-head source review clear on Standards and Spec; A-12881. M1 duration identity keys now match the renamed cases while preserving both measurements and all other data. M2 now distinguishes enabled/unpaired rows from all-disabled absence in both workbenches, retaining the exact Look now line. Earlier complete C1/C2 source audit retained; no additional findings. Configured runtime evidence absent: no runtime criterion verification marks. One unchanged-head mode-free configured run next, followed by original-record evidence review.

### rev-26 · 2026-10-27T20:25:20.086Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1367-evidence-1
commit: f4caee5606c5f184b79e97f418800f8eb522a649
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record evidence clear. Exact-head run f6a93e9b/A-12889 passed; independently deduplicated 3742 ordinary passes and zero scoped load finishes. All 13 onboarding identities pass, including C1 nine-stage/Look now at 12803 (.00160882 s), C2 shipped command scan at 12788 (.009565082 s) and negative controls at 12793 (.001600556 s). T0/all T1/fallback all T2/Web completed; T3/T4 absent. Linux droplet c-8 lon1, isolated Headless Shell 156.0.8078.4/r1248; host gate reused d2f2c825, not remote typecheck. Budgets/lint remain report-only. Source A-12881 and same-head original records establish C1/C2; QA none. Coordinator integrated coverage/landing separate.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-27T20:33:15.198Z

Merged ca3f2cdd24b6191f4ac23fddbe35a6c0855d7d38 onto dev.
