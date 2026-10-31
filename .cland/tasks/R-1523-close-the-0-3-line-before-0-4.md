---
id: R-1523
kind: release
version: 0.3.2
title: Close the 0.3 line before 0.4
state: open
labels: []
assignee: null
parent: null
blocked_by: []
topic: topic-1267
branch: null
created: 2026-10-31T14:43:28.342Z
updated: 2026-10-31T21:05:10.048Z
---

## Goal

Close the 0.3 line before 0.4 ("cland beyond one machine", map M-1511): ship the Telegram stall fix to users, and fix the bugs, debt and follow-ups that would get in the way of remote agent hosts. Those touch session processes, event delivery, sockets, setup and doctor rows, harness adapter versions and merge-queue selection.

## Notes

- Scope: the human's answer on 2026-10-31 at 14:42:58Z (ask f9666976): «0.3.2 со списком «обязательно» + «по желанию»».
  - Must: T-1508 (already landed at 294477b6c), T-1503, T-1506, T-1501, T-1500, T-1510 then T-1488, T-1498, T-1504, T-1505, T-1507.
  - Optional: T-1486, T-1493, T-1494, T-1495, T-953.
  - Left to 0.4: T-489 and T-1229. T-540 is closed as superseded by agent hosts.
- Version 0.3.2: the human named it in that ask. The project version bump is its own item.
- Release approval: the human, 2026-10-31 21:05Z via Telegram (remote-b78cdec6), on the conditions recorded on R-1523: every item landed or closed, green release covers on a Linux droplet and macOS, and the dry-run notes shown before the release.

0.3.2 closes the 0.3 line before 0.4, "cland beyond one machine". It ships a fix for the Telegram stall found after 0.3.1, and it fixes the bugs and debt that would get in the way of remote agent hosts: session event delivery, sockets, setup and doctor readiness, harness adapter versions, merge-queue landings and verifier routing. The human chose the scope on 2026-10-31 at 14:42Z (ask f9666976), taking both the must and the optional lists, and approved the release at 21:05Z via Telegram, on the conditions recorded on R-1523. Version 0.3.2 is the human's choice. The Coordinator `coord`, on Claude Code claude-opus-5-5, led. Implementers and Reviewers ran on Codex gpt-6.1-sol. Every landing went through the hub merge queue with an `Item:` trailer.

What changes for the human:

- **Telegram no longer stalls after an interrupted send (T-1508).** On 2026-10-30 at 21:25Z, an interrupted "N General messages missed" line left outbound Telegram stuck for 13 hours, while Discord kept working. The uncertain line is now never resent, its captured messages settle as reported, and Telegram recovers. A remote that stays offline because catch-up keeps failing is announced in General, and the log names the failing step. This project's hub has run the fix since restart #65 (2026-10-31 10:41Z).
- **A landing tells whoever queued it (T-1503).** When the merge queue lands an item, the session that enqueued it and the item's claimant both get a report in the item topic. Before, the Coordinator once learned of a landing 38 minutes late, from a heartbeat.
- **Setup and doctor wait for a connection to settle (T-1506).** A re-run of `cland setup` and `cland doctor`'s remote rows read Discord and Telegram connection states through a bounded readiness wait, not a single sample, so a reconnecting gateway no longer shows as "open".
- **Verifier requests carry their head, and verifiers can decline.**
  - A review or QA request records the commit it was admitted for (`Head:`), so a later verdict is matched to the right build (T-1493).
  - A Reviewer or QA session can decline an accepted request with a one-line reason, which hands it back to the requester without a verdict (`verification.decline`, T-1494). Projects with explicit Reviewer or QA tool lists in `roles.toml` need to add the grant; this project adds it once its hub runs 0.3.2.
- **OpenCode 2.2.** The adapter reads OpenCode 2.2.5's session form and message schemas, checked against recorded contracts for 2.0.24 and 2.2.5 (T-1501). The supported range is unchanged: this is schema-reader compatibility, not a new runtime range.
- **Tests and the merge queue:**
  - Unix-socket test fixtures allocate short owned paths, so suites stay safe under a deep TMPDIR on macOS (T-1500).
  - Test fixture children no longer inherit a crew session's identity or reach the live hub (T-1525).
  - The `journal-subagents` test measures the scan rather than first-touch I/O, and its duration allowance is removed: 0.16 s instead of up to 13.8 s on fresh droplets (T-1498).
  - `test:tiers` refuses a duration allowance owned by an epic inside a release, so an epic's close is never blocked by its own allowance (T-1504).
  - A guard that runs only in a build step must also belong to a verify tier, and a report-only lint lists the orphans (T-1505).
  - The memory budget report shows the interval maximum and says whether the limit applies to endpoints or to the whole interval (T-1495).
- **Docs.** Rule batch 5's doc edits: standing allowance owners, synthetic-PID fixtures, epic QA topics and the memory probe guide (T-1507).
- **Version.** T-1524 moved the root `package.json` and both lockfile version fields to 0.3.2.

Closed with evidence, no code change:
- T-1488 keeps merge-batch interaction selection in report mode. 25 batches over 25 h (A-15009, audit A-15015) showed no T2 or Web interaction a run would have caught. The one real interaction miss, T-1490, sits in T3; a follow-up, T-1528, evaluates T3 importer selection.
- T-1510 confirmed that the web-test fallbacks had already been fixed by T-1492: the report that prompted it ran on a hub started before that fix. It records a baseline of the 6 remaining conservative fallbacks.

Taken out of the release:
- T-953, burst CPU. The measured candidate cost +23.6 % CPU per request (22.89 → 28.30 ms) and 38 % more SQL work, so it was not landed. The profile points at `Store.#bindProgress`, filed as T-1526. T-953 went back to Ideas.
- T-1486, the enforce mode for merge-delta assessment. T-1462's assessment only covers conflict-free merges, and under rule 11 implementers merge dev only on a conflict, so it never fired (A-15012: 0 of 16). The redesign is T-1529; T-1486 waits on it in Follow-ups.

Found during the run and fixed before the release:
- T-1525: a test fixture leaked the crew session's identity to the live hub (found by impl-1500).
- T-1508's first test waited on a 1 s wall deadline across a 5-minute fake-clock drive and failed under load; it was fixed to wait for the recorded notice.
- T-1500's first version skipped directory disposal after a resource failure, and coord's verify all caught three T3 teardown failures. It also imported test-support from production code. Both were fixed.
- T-1494 missed two consumers of the verifier tool list. A full consumer audit then ran 56 files.

Release covers at 6ab47eef2:
- Linux droplet 342615fa (A-15091): 6,262 pass, 0 fail, 9 skipped; T0–T4 and Web on 2 shards.
- macOS local 7bb74c39 (A-15096): 6,270 pass, 0 fail, 1 skipped; T0–T4 and Web.
- Two earlier covers were red. Linux ba2f405a at 3b731b929: the suite-tiers allowance-owner test took 5.6 s against the 5 s T1 ceiling on a fresh droplet, a regression of T-1504 fixed by T-1540. macOS 69067e3d (A-15095): the Mac ran out of disk, because failed coverage-recording runs had leaked 130 GB of raw coverage; that test-runner leak is T-1541, outside this release.

Checked on the release cover:
- The `journal-subagents` timing on a fresh droplet: 0.94 s at most per case (T-1498).

Not verified:
- OpenCode 2.2.x at runtime (schema readers only, T-1501).
- `verification.decline` in live use on this project: the Reviewer and QA sessions need a relaunch after the hub restart.
- Several items landed under rule 6: a green verify all at the parent head plus a docs-only merge, typecheck, touched files and a delta review (T-1503, T-1504, T-1505, T-1506, T-1493, T-1500). None counts as a full verify at its final head.


## Comments

### coord · 2026-10-31T21:05:10.048Z

The human, 2026-10-31 21:05Z via Telegram (General msg remote-b78cdec6): «Ок, дальше публикуй релиз, сообщи маркетингу и бери 0.4 дальше». Recorded as the human's release approval for 0.3.2. Version 0.3.2 is the human's choice (ask f9666976, 14:42Z).

Conditions follow the 0.3.1 precedent:
- every item landed or closed;
- the release covers green on Linux droplet and on macOS local;
- the dry-run notes shown in topic-1267 before `cland release`.

The same message starts 0.4 (R-1530). Its implementers launch only after the release, so dev stays frozen for the release run.
