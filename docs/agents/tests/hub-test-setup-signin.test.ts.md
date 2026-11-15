# hub/test/setup-signin.test.ts

Run `node --test hub/test/setup-signin.test.ts` (T2). Uses only disposable
projectHub roots, the shared fixture environment and scripted prompts. No real
credential, provider or browser; no preservation slot required. Record the
hc-/ct-/cland-h- name inventory in /private/tmp before and after; retain existing
entries. Run one file at a time under load 20.

- C1 sign-in offer defaults No and yes skips with either terminal policy.
- C2 C4 C5 confirmed switch prints the invite only to terminal and Enter leaves the exact command.
- C4 nonterminal single mode skips with its command and a declined confirmation leaves single unchanged.
- older injected hub metadata stays unknown without switching.
- lost registration read stays open and joins the terminal reader.

The credential check catches a planted invite first, then checks log, journal
and report absence without printing it. Ordinary user.list keeps the previous
wire shape. Step order is asserted by setup-flow.test.ts. C3's native WebAuthn
receipt is in web/test/setup-signin.test.ts; state active alone is insufficient.
