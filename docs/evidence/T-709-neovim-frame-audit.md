# T-709 Neovim frame assertion audit

Baseline: task starting HEAD `29ba661eb843f8ee416c85a16912d3d1574b8d14`. All original 11 manifest T2 files are included, even files with no runtime hub import of their own. Counts below are source assertion call sites; loops retain their complete inputs and assertions. The runtime correction adds a twelfth T2 file for the control socket exchange; see T-709-replay-runtime-correction.md.

| T2 file | Assertion call sites before / after | Test bodies | Assertion SHA-256 |
| --- | --- | --- | --- |
| nvim/test/account-poll.test.ts | 3 / 3 | identical except imports | 00214500ae2fe4b898cf7fdf52be195a78ad9c9f63149c60c878bc037da45362 |
| nvim/test/events.test.ts | 9 / 9 | identical except imports | a2cdd51eeea9eee4519a38208738a0e3e7b158fa12879cdb3d2a37184b86443e |
| nvim/test/explorer-summary.test.ts | 11 / 11 | identical except imports | 6eaa615955d85298b64b1bc0e1cc84fbc95cd80039bc6ebfc9d866dd913e78a7 |
| nvim/test/graph.test.ts | 55 / 55 | identical except imports | a2d52d77c9c08cfacc16167a431db4e4c78ef03685cd4c85627bdce988f86db6 |
| nvim/test/inbox-actions.test.ts | 23 / 23 | identical except imports | 024c4f4a35c1f8e03a727c83203319e4c4a5b09e0f9873512a92973dd4911e85 |
| nvim/test/inbox-sections.test.ts | 13 / 15 | original assertions unchanged; control close/refusal handling and appended recovery case | b131f433a178f8f5c7f67e882739da814585e3de0fd2216634c1c27004bd9ebe |
| nvim/test/session-archive.test.ts | 15 / 15 | identical except imports | bf3f5022695a518a88a4453b287e5f7bc2e865e770370e91cbc233a2de604b95 |
| nvim/test/session-resume.test.ts | 7 / 7 | identical except imports | 573d9a0f8dd4860ba194c5c74d37904eeb29209d56c0fa5b439509556ab8ecd0 |
| nvim/test/vboard.test.ts | 115 / 115 | identical except imports | 0e95351c9a38221c1976bf36e9c442cde9d8b6de2a0b656858e1810091c2cabe |
| nvim/test/verification-queue.test.ts | 1 / 1 | identical except imports | 87ff0f1e1f12899783039f23d338e86d8f542afca0f0c5375b434e3116a2e538 |
| nvim/test/verification-view.test.ts | 4 / 4 | identical except imports | dc9147f07c5cdd9fc94bd5ed94f580ae1aa1a6f1e8fa3be91c9a2a1fd0b87619 |

All original 11 T2 files retain all 256 assertion call sites byte-identically in their original order. Non-import statements remain identical except for the inbox control helper/query correction and appended recovery case. No original test titles, input tables, waits, snapshots, expected values or assertion operators changed. The runtime correction's AST audit rechecks every original assertion against the same starting HEAD.

The workbench scenario retains its original 31 assertions unchanged and adds the recorder contract check after the existing steps.

## Fixture and ownership seams

- `stub-hub.ts` retains scripted protocol actions, snapshot barriers and one-write bursts. Hub-owned enrichment is replayed from committed JSON; it never imports hub runtime modules. Unknown recordings fail with the refresh command.
- The human QA CLI uses an explicit producer-backed `qa-stub-hub.ts` adapter so arbitrary and read-only user scenarios remain supported. It is a T3 path and no T2 test imports it. Replay context takes its effective ladder from the recorded config frame.
- `frame-fixtures.ts` binds transient request ids, UUIDs, current timestamps and machine paths while preserving their original wire values. Timestamp binding retains the policy's seven-day age class. Interned JSON nodes are data references only.
- The hub-side producer calls the existing hub criteria/config/visibility modules. The T3 workbench recorder compares real `projectHub` attach status, item summaries, full item view and inbox frames with a committed live baseline, checks criteria/config compatibility, and checks every retained producer output for drift.
- `client.ts` contains the existing RPC client implementation. `stub-client.ts` supplies Neovim-owned scratch directories and condition waits. Native `harness.ts` supplies the original hub cleanup/verification isolation callbacks. Both retain writer-before-directory ownership order.
- T-754's exact synchronous headless-client launch marker moves to Neovim ownership; the old hub path re-exports the same marker. Stub clients retain bounded child/group-exit observation with no ps probe.
- `needs-you.test.ts` is already T3 and remains unchanged; T-774 owns subsequent T3 screen migrations.

## Evidence

Consolidated final evidence is A-4995: Mac whole-file repetitions, the repeated production mutation, QA API preservation, this assertion audit and the 40-landing replay. Initial snapshots A-4968, A-4969 and A-4973 are retained. Exact-reviewed-head droplet evidence follows source review and will be attached to the item without changing the reviewed head. No existing test tier retagging, duration allowance or quarantine changes belong to this task.

The QA CLI regression file retains its original 137 assertion call sites unchanged. One appended T3 CLI case supplies a fresh UUID in a user-authored message on every run, proving that human QA scenarios are not restricted to the committed T2 catalog. Existing read-only and network-denied cases retain their assertions.

## Source-review admission correction

Review A-4996 identified the lost cover-quiet guard at the Neovim-owned fixture entries. The Coordinator authorized one dev merge after T-747 landed; integration commit 2ebc5bbe retains T-747's lazy account setup and first-statement native client admission. The correction moves the existing read-only admission policy and its dependencies into neutral modules, with compatibility exports preserving production identities. Both Neovim-owned fixture entries now await cached admission through a fresh caller-owned async promise before allocation or spawn.

The original T-747 direct default/stub refusal controls remain. Added direct controls call Neovim tempProject and stub-client startClient without a preliminary generic fixture, asserting cover-quiet refusal, no target marker and an empty scratch parent. No existing assertion is removed or weakened. The importer now follows neutral helpers transitively; planted helper-to-hub imports are detected, while neutral helper changes preserve full package selection. See T-709-admission-audit.md for unchanged implementation comparisons.
