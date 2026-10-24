# hub/test/topics-component.test.ts

`topics-component.test.ts` exercises `topic.send` kinds through public frames, history and a second client's message deltas; only a Question starts a wait, and a later Message cannot change its addressee. `topic-withdraw.test.ts` uses sealed `projectHub` fixtures with fake time and a raw fake spoke. Observe accepted delivery before withdrawing across a busy transition, then send a late acknowledgement and require the next retained message's injected receipt. Keep assertions that the withdrawn input was never injected and its held progress was delivered once. Adapter submission is a durable exclusion fence, even without confirmation; test refusal at that boundary and after injection. `hub/src/hub/store.test.ts` reopens the Store in-process to prove withdrawal and its cleared Question wait persist without replay. `web-authority.test.ts` keeps the authenticated human edge proof. Neovim's recorded `thread.test.ts` checks the terminal glyph/colour and rejects older delivery stages; refresh only its recording when adding frame inputs. No browser or live hub is needed for this hub-side slice.

Exact delivery observers in `store.test.ts`, `topics-component.test.ts` and the
stdio `topics.test.ts` retain their full objects including optional eligibility:
the direct core admits an accepted delivery, while a bare spoke refuses recall.
Native Codex/OpenCode/Claude contract receipts retain acceptance, submission and
confirmation events, including the repeated delivered stage and eligibility
true/false/false. Non-human brief deliveries retain their original stage sequence.
`human-routing.test.ts` waits for the aggregate-queued eligibility receipt before
advancing TTL, rejects any premature stage advancement, and retains expired-input
non-delivery and delivered/dropped final receipts.
