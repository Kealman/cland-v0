# nvim/test/inbox-sections.test.ts

T-1754's `waiting launches render facts and replace reasons without needs-you or departure rows`
case delivers inbox values through `state.set_inbox` in the isolated stub-hub
Neovim client. It observes the rendered session, role, pool, reason and exact
since timestamp, preserves the line position on a reason update, checks zero
needs-you, removes placed and cancelled launches independently, and accepts an
older inbox without `waitingLaunches`. No provider or host is launched.

The same case also opens the actual Inbox side panel at 64 columns with a
production-length UUID boot reason. It asserts the complete session and role,
the ellipsis in the remaining pool/reason text, and a right-aligned local HH:MM.
A launch from the previous day retains YYYY-MM-DD HH:MM. At 100 columns or more
the time is full ISO. There is no new row action or preview.

Maximum 24-character session and role names with the previous-day time exercise
the overflow policy: pool/reason disappear first, then the role and name may
ellipsize. The line must fit the actual panel width and end in the complete time.

`inbox retains optional sign-in login identity while rendering the existing card
facts` runs the recorded stub protocol with a flattened ask carrying signInLogin.
It observes that exact field in Neovim state, then the existing question rendered
without displaying the metadata-only login name. The optional field is ignored
by the renderer. Its protocol input was regenerated with
`npm run test:nvim-fixtures -- nvim/test/inbox-sections.test.ts`; every catalog
consumer remains in T-1827's preserved union and final-head run plan.
