---
id: T-1143
kind: task
title: Notes rendered, This topic and `s` to the composer
state: closed
status: done
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1140
  - T-1119
  - T-1124
  - T-1116
topic: topic-899
branch: t/T-1143-notes-rendered-this-topic-and-s-to-the
created: 2026-10-22T15:16:16.723Z
updated: 2026-10-23T09:05:20.939Z
closed: 2026-10-23T09:05:20.939Z
---

## Summary

On E-417's Markdown and composer, notes open as rendered Markdown in the drawer, the tree gains This topic, and `s` attaches an artifact to that topic's composer.

## Parent

E-418 (§3.2; v0.1 §3.6; tracer step 6). Ordered after E-417's thread (its Markdown renderer) and composer, which it reuses; the web takes no new dependency for Markdown.

## What to build

- **Notes.** Enter on a note or a prompt (a Markdown file) opens it in the drawer rendered with E-417's Markdown renderer, as thread messages render, with the raw source one toggle away, as E-795 does in Neovim.
- **This topic** is the topic whose thread the human last opened in this browser; the section lists that topic's artifacts and is absent before one is opened.
- **`s`** attaches the selected artifact to that topic's composer draft, and refuses with the reason in place an archived artifact, an artifact of another topic, or while the composer answers an ask, as Neovim does.

## Acceptance criteria

- [x] C1. Enter on a note artifact opens it in the drawer rendered as Markdown (headings, lists, code), and the toggle shows its raw source (Web test).
  - done: impl-1143 · 2026-10-23T08:20:22.618Z
  - verified: rev-26 [reviewer] · run rev-20261023-1143-final-1 · 2026-10-23T08:47:01.929Z · commit b16b7ba6216211a547f353e8969419f0125b10f4
  - verified: rev-26 [reviewer] · run rev-20261023-1143-final-2 · 2026-10-23T09:00:37.415Z · commit df06d52e194ce529a24a348f9265c2e31e7416a2
- [x] C2. After a topic's thread is opened, This topic lists that topic's artifacts (Web test).
  - done: impl-1143 · 2026-10-23T08:20:22.702Z
  - verified: rev-26 [reviewer] · run rev-20261023-1143-final-1 · 2026-10-23T08:47:01.929Z · commit b16b7ba6216211a547f353e8969419f0125b10f4
  - verified: rev-26 [reviewer] · run rev-20261023-1143-final-2 · 2026-10-23T09:00:37.415Z · commit df06d52e194ce529a24a348f9265c2e31e7416a2
- [x] C3. `s` on an artifact of that topic adds it to the topic's composer draft, and the sent message carries it as the hub's topic history reads (Web test).
  - done: impl-1143 · 2026-10-23T08:20:22.781Z
  - verified: rev-26 [reviewer] · run rev-20261023-1143-final-1 · 2026-10-23T08:47:01.929Z · commit b16b7ba6216211a547f353e8969419f0125b10f4
  - verified: rev-26 [reviewer] · run rev-20261023-1143-final-2 · 2026-10-23T09:00:37.415Z · commit df06d52e194ce529a24a348f9265c2e31e7416a2
- [x] C4. `s` on an archived artifact or one of another topic says why and attaches nothing (Web test).
  - done: impl-1143 · 2026-10-23T08:20:22.969Z
  - verified: rev-26 [reviewer] · run rev-20261023-1143-final-1 · 2026-10-23T08:47:01.929Z · commit b16b7ba6216211a547f353e8969419f0125b10f4
  - verified: rev-26 [reviewer] · run rev-20261023-1143-final-2 · 2026-10-23T09:00:37.415Z · commit df06d52e194ce529a24a348f9265c2e31e7416a2
- [x] C5. `web/README.md` describes notes, This topic and `s` (docs).
  - done: impl-1143 · 2026-10-23T08:20:23.046Z
  - verified: rev-26 [reviewer] · run rev-20261023-1143-source-1 · 2026-10-23T08:22:17.485Z · commit b58ad21f1b6c39d96c361ad209379cb84f3b6e9c
  - verified: rev-26 [reviewer] · run rev-20261023-1143-source-2 · 2026-10-23T08:35:32.112Z · commit b16b7ba6216211a547f353e8969419f0125b10f4
  - verified: rev-26 [reviewer] · run rev-20261023-1143-final-1 · 2026-10-23T08:47:01.929Z · commit b16b7ba6216211a547f353e8969419f0125b10f4
  - verified: rev-26 [reviewer] · run rev-20261023-1143-source-3 · 2026-10-23T08:49:10.415Z · commit df06d52e194ce529a24a348f9265c2e31e7416a2
  - verified: rev-26 [reviewer] · run rev-20261023-1143-final-2 · 2026-10-23T09:00:37.415Z · commit df06d52e194ce529a24a348f9265c2e31e7416a2

## Comments

### impl-1143 · 2026-10-23T08:17:23.509Z

TDD progress: notes/prompts Markdown + source toggle passed locally at the sealed Web seam; This topic + physical s + retained draft + public topic.history artifact receipt passed. Coordinator decision 95aee0d4: web s targets the independent topic composer even with an unfinished AskCard answer; test and one-line parity note to follow. Initial build and web typecheck passed on macOS. Full verification awaits source review.

### rev-26 · 2026-10-23T08:22:17.485Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1143-source-1
commit: b58ad21f1b6c39d96c361ad209379cb84f3b6e9c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review clear at b58ad21f/tree 9744e321. Standards and Spec: no findings. Existing MarkdownBody renders note/prompt Markdown with literal HTML/source toggle; remembered opened/focused thread drives This topic; s uses owner identity and shared draft merge, preserving text/deduplicating and opening the topic composer. Refusal branches and public history/draft assertions retained. Coordinator 95aee0d4 authorizes separate AskCard draft behavior; split test and parity README match. C5 verified; C1–C4 await mode-free same-head configured receipt and actual new Web durations. A-9911 remains narrative local precommit supporting evidence, not exact-head configured/Linux proof; preserve original stdout/exits/timings without reruns and with those limits. No Reviewer tests/GUI or per-item QA claim. A-9912: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9912-t-1143-source-review-at-b58ad21f.md.

Criteria: C5 verified.

### rev-26 · 2026-10-23T08:35:32.112Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1143-source-2
commit: b16b7ba6216211a547f353e8969419f0125b10f4
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear at b16b7ba6/tree a7d22d05. Standards and Spec: no findings. Only thread-artifacts.test.ts changed: await both exact Mine/This topic copies, arm both departure observers before artifact.move, preserve both global zero top-level-copy assertions, and scope folder/child interaction to Mine. Runtime/docs unchanged; full source A-9912 carries forward. Historical A-9917/d06d80d2 remains failed (2682 pass/1 fail): strict-mode duplicate selection occurs before the move, not a demonstrated resurrection bug. A-9918 local 5/5 is supporting development evidence, not configured new-head proof. C5 verified; C1–C4 await fresh mode-free configured verification at this head. No Reviewer runtime or per-item QA. A-9919: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9919-t-1143-delta-source-review-at-b16b7ba6.md.

Criteria: C5 verified.

### rev-26 · 2026-10-23T08:47:01.929Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1143-final-1
commit: b16b7ba6216211a547f353e8969419f0125b10f4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged b16b7ba6/tree a7d22d05. A-9926/run 566ce892 exits 0: independently counted 2683 ordinary test passes and 399 file passes, zero fail/cancel/skip. T1, fallback all T2 across hub/Neovim, and actually executed Web pass on Linux x64 c-8 lon1 (Node 24.21.0, Neovim 0.12.5; machine workers 2, Web 4). Host check passed at c868f556 and was not repeated remotely. New Web cases pass at 2.822/2.084/2.878/1.895 seconds; migrated move case passes at 1.466 seconds with global no-resurrection assertions retained. All C1–C5 verified using source A-9912/A-9919 plus this receipt; no findings. Generic lint/duration/tier/ratchet diagnostics remain report-only; actual Web wall 101.33 seconds exceeds its report-only 40-second budget, one baseline missing. No T3/T4, repetition, enforcing phase-budget or after-stage QA pass claimed. A-9917 stays historical failed evidence. Details A-9927: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9927-t-1143-final-evidence-review-at-b16b7ba6.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-26 · 2026-10-23T08:49:10.416Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1143-source-3
commit: df06d52e194ce529a24a348f9265c2e31e7416a2
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merged-head delta source clear at df06d52e/tree 535afbc1, authorized by Coordinator e75324f0. Standards and Spec: no findings. Compared both parents and combined resolutions: Shell keeps TopicArtifactsProvider plus Events Subjects picker context; artifact non-row native Enter guard uses the same effective target as incoming Events dispatch; help retains Events 24 and Artifacts 21/s assertions. Artifact runtime and regression files are unchanged from reviewed b16b7ba6; both docs/test-guidance sections survive. C5 verified, C1–C4 await fresh mode-free configured verification at this unchanged head. A-9928 supporting 53/53 targeted stdout inspected; build/typecheck/head attribution is lead-reported rather than embedded in that test-only artifact. A-9926 remains pre-merge green evidence only; A-9917 remains failed. No Reviewer runtime or after-stage QA claim. A-9929: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9929-t-1143-merged-events-delta-source-review-at-df06d52e.md.

Criteria: C5 verified.

### impl-1143 · 2026-10-23T09:00:14.427Z

Current head df06d52e (tree 535afbc1acf1da01816f66859c6b745b831ac669) mode-free verify 9608dfd7 passed 2694/2694 ordinary tests: T1, all fallback T2 in both packages and Web on Linux droplet c-8 lon1. A-9930 is primary log. Budget/test-lint report-only warnings remain; T3/T4 and after-stage QA are not included. New Web samples 2.651488/2.095805/2.556006/1.972765 s, all <4 s. Final fetch and read-only merge-tree against origin/dev 5d7c9082 returned same tree with no conflicts; task head and worktree unchanged. Awaiting final Reviewer evidence verdict; claim retained for merge.

### rev-26 · 2026-10-23T09:00:37.415Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1143-final-2
commit: df06d52e194ce529a24a348f9265c2e31e7416a2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged merged df06d52e/tree 535afbc1. A-9930/run 9608dfd7 exits 0: independently counted 2694 ordinary test passes and 400 file passes, zero fail/cancel/skip. Host check plus T1, fallback all T2 across hub/Neovim and actually executed Web pass; Linux x64 c-8 lon1, Node 24.21.0/Neovim 0.12.5, machine workers 2/Web 4. Host gate 37fe5c73 not repeated remotely. C1–C5 verified with source A-9912/A-9919/A-9929 and exact-head receipt. Four new artifact cases 2.651/2.096/2.556/1.973 seconds; migrated move 1.496 seconds passes, along with Events/key-context/help/launch neighbors. No findings. Generic lint/duration/tier/ratchet remain report-only; actual Web wall 106.81 seconds exceeds 40-second report budget, two baselines missing. No T3/T4, repetition, enforcing phase-budget or after-stage QA claim. Prior receipts retain their historical provenance. A-9931: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9931-t-1143-final-merged-head-evidence-at-df06d52e.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-23T09:05:20.939Z

Merged f47545a2176f5ea29b9f36d79b10af1bedf37893 onto dev.
