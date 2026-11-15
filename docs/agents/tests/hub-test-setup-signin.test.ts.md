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
- offline single mode skips with its command without prompts or writes.
- offline users mode needs the hub even with unattended options.
- offline invalid config preserves the existing fallback without exposing the error.
- missing hub capability uses the default config without creating files.
- offline unreadable config stays open instead of assuming single mode.

T-1866's offline cases inject a failing metadata reader (no network), preserve
config bytes and the directory inventory, and use scripted prompts with no
answers. Doctor and setup share `projectAuthMode`; setup-signin.test.ts covers
missing/default and invalid config. doctor-users.test.ts guards the existing
mode/count, timeout and privacy behavior.

The credential check catches a planted invite first, then checks log, journal
and report absence without printing it. Ordinary user.list keeps the previous
wire shape. Step order is asserted by setup-flow.test.ts. C3's native WebAuthn
receipt is in web/test/setup-signin.test.ts; state active alone is insufficient.
