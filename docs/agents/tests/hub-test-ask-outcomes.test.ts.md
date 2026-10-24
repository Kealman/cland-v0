# hub/test/ask-outcomes.test.ts


`hub/test/ask-outcomes.test.ts` covers E-413's answered asks at the T2 public
frame seam with `FakeClock`: C1 retains the chosen option, answerer and time in
live cards and later history; C2 compares the same outcome in the inbox departure
and archive. Both use a disposable `projectHub`. C3 uses the existing `startHub`
frame fixture without a journal, so an incidental journal projection cannot read
the inbox before its rapid free-text/stand-in answer. It observes exactly one
matching departure/archive outcome, then checks that the next inbox publication
does not repeat the departure. Observers are armed before answering. A T1 test
in `hub/src/hub/store.test.ts` proves option/free-text outcomes survive Store
reopen, without restarting a hub. These cases add no native process.


T-1059's decline cases in `hub/test/ask-outcomes.test.ts` use the same T2
public-frame seam: a fake Implementer's question is forwarded by the Coordinator,
declined by the human, and returned through `ask.answer`; the topic admits the
next question. Missing/blank reasons leave the ask open, and the thread,
departure and archive retain the declined reason, answerer and FakeClock time.
`nvim/test/declined-ask-component.test.ts` is T2: headless Neovim consumes only
recorded frames and asserts a single folded row with the reason on history and
live updates. Refresh only its recording with
`npm run test:nvim-fixtures -- --slice nvim/test/declined-ask-component.test.ts`.
The shipped-role wording regression and unchanged byte reserve run at T1 in
`hub/test/roles-clauses.test.ts`. A declined ask is a decision and never consent.
