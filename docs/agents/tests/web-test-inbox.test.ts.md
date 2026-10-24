# web/test/inbox.test.ts

`web/test/inbox.test.ts` also owns the reusable approval-card seam (T-1129):
complete command and file-change subjects, session/harness/since, once and always
answers, attributed frame/archive outcome, optional denial notes and Escape's
no-answer boundary, Claude Code and adapter/payload fallback without controls,
and held native delivery with failure-to-pending and manual retry. The selected
approval drawer reads the session's recent messages through `session.history`;
retain the exact rendered message id, refresh on a different approval from the
same session, and hold the prior history result across that selection to prove
it cannot replace the new message. All use sealed fake adapters and the
authenticated isolated browser; no live hub or native binary is needed.

`web/test/inbox.test.ts` owns the four Now sections through the sealed
`webFixture`, a fake Coordinator sender, fake native approvals and authenticated
Headless Shell. Literal DOM assertions cover section order, counts, the five-row
cap and oldest wait, saved folds and controlled browser age updates. Request
decline waits for the fake sender's delivery and the folded outcome in its original DOM row;
message removal retains a peer Inbox read proving the other message survives.
Enter navigation loads an exact message older than the latest history page and
focuses it in the thread; the plan case waits for the rendered stage heading.
The empty Inbox's Events footer compares real journal rows and shared last-look
marks, including warning counts beyond the first 200 rows. Held successful
read/decline replies retain newer pushed Inbox rows/counts after the action's
pending marker clears. An older-than-five ask link reveals saved folds and
focuses the secondary-pane card while the primary copy remains mounted. Exact-id
approval recovery covers a peer answer while offline across a new hub epoch and
a real refused answer; a held archive reply cannot replace newer rows/counts or
a later same-id authorization delta. Approval controls use the native record's
choices and Neovim's keys; TUI-only rows have no answer controls. Existing
`asks.test.ts` retains multi-client winner, receipt, failure and reconnect checks.
The drawer test keeps row focus while following the exact message, exercises
Split/Close and sends a one-line physical `r` reply to the fake sender with its
original `reply_to` while the split remains open; bounded focus observers are armed before each `r`. A split native approval remains visible after another area takes focus, then follows same-id revalidation and the fake native peer's durable closed outcome, compared with fresh archive state. The existing older-than-history-page case also observes the
drawer's bounded scroll before Enter navigation. The visit test waits for the
exact ask departure and checks both area re-entry and focus into a non-Inbox
pane; completed rows and selection clear even while Inbox remains mounted.
The archive test blocks fake time across eight days (without replaying every
periodic tick), retains a recent answered outcome and excludes the older one,
then checks its footer below four empty sections. Browser clocks are controlled
where needed so incidental one-second thread read receipts cannot settle action
targets before the action under test. New passing Web identities need a dated,
reasoned E-417 allowance only if any platform's sample reaches four seconds;
batch serial setup before sizing it at roughly 1.5 times the worst sample.
