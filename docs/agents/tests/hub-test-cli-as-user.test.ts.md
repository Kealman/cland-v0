# hub/test/cli-as-user.test.ts

T2 uses disposable projectHub and sealed CLI launches from harness.ts; users
are seeded in the fixture database, with reversed display names to prove exact
name selection. The CLI ask regression checks persisted inbox outcomes and the
exact ask-answered journal receipt, including the previous stand-in fields.
The frame matrix covers topic.answer/create/send, approval.answer and artifact.create
with named/default actors in both modes. It refuses unknown, invited and
display-name selectors and a role without grants before the write, then proves
the still-open operations succeed for the admitted actor. Approval observation
is armed before fake native ingress. Shell tests retain the session with --as,
and successful artifact creation names its owning session. No new CLI verbs,
browser, real account or external transport is used. Existing answer-users,
artifact-user and message-users files remain unedited preservation controls.

Review correction A-15545 adds exact topic-created by/userId receipts at the
frame and real CLI seams for named/default users; single and session-shell
legacy receipts keep by: human and omit userId. Full help consumers continue
comparing independently maintained commands.json blocks, including aggregate
usage and native --help, without reducing assertions.
