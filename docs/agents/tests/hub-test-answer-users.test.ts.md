# hub/test/answer-users.test.ts

T2: disposable projectHub, sealed fake adapters, real authenticated WebSocket and
Unix frames. Seed the second cookie identity in the fixture database, as in
`auth-mode.test.ts`; never use real credentials or browsers. The tests check ask
and approval saved outcomes, exact journal entries, forged input isolation and
the posted answer and saved history matching the outcome user, and the losing local user's refusal naming the cookie-authenticated winner. Single
mode covers the previous outcome shape. Arm approval observers before raising
the fake native request. The CLI uses the shared scratch environment.

Rendering coverage: phone-approvals and Neovim inbox-actions feed both legacy
human outcomes without userId and named user outcomes into actual workbenches.

The saved answer history also resolves `userDisplayName` from that admitted id
(T-1564); single-mode history continues to omit it.
