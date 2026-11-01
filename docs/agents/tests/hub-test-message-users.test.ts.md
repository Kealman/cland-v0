# hub/test/message-users.test.ts

T2 project frame, persisted Store and unchanged spoke seams. Run with
`node --test hub/test/message-users.test.ts` after checking disk space and load.
The disposable project seeds two users at the persisted identity boundary;
invites and browser sign-in are separate items. The web transport supplies its
trusted user and a forged frame userId must not change authorship. Each send
arms the coordinator notification observer first and awaits that exact content.
Checks persisted id/name, both topic.history authors, the existing spoke metadata,
legacy null-user attribution after a switch, and content-free journal ids.
The pre-switch send is the previous-wire-shape control (no userId).

Preservation controls: run `hub/test/human-routing.test.ts` and
`hub/src/hub/store.test.ts` unedited, one file at a time. No GUI browser or real
account, remote provider or native harness is used.
