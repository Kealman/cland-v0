# nvim/test/sessions.test.ts

T2 replays recorded public frames into isolated headless Neovim. Run this file
alone; refresh its retained slice with
`node hub/test/record-nvim-frames.ts --slice nvim/test/sessions.test.ts` after
adding recorded inputs. Existing account/session cases retain their assertions.

Remote-state replacements prove connection, pairing name, mute and nonzero
outbox facts, failure causes in ClandRed, normal recovery and hidden disabled
state. Initial fixtures deliberately omit the new frame: an older hub remains
readable without a Remotes section. Native fake-outage timing is separately
covered in nvim/test/remotes.test.ts, not inferred from replayed pushes.

T-1472 adds an optional stateReason `deaf` row beside a legacy row with no health
fields. Refresh the same recorded slice; assert the rendered row and words.


Host placement keeps the process row's optional host through the client projection.
The recorded host-session case uses a full host UUID, long model and account at
40, 30 and 100 columns. It requires the complete host on the unselected row,
selects it with native search keys and requires it again in the wrapped meta.
Every rendered line must fit the panel; host continuations retain session row
metadata and participate in the existing detail-skipping cursor behavior. A local row
and local meta remain without a host. Regenerate the sessions slice when changing
these recorded process shapes.
