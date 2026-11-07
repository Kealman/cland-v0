# hub/test/setup-accounts.test.ts

## Config writer preservation (T-1733)

`Enter declines a new account and the next run reports the remembered name (C2)` checks host/pool preservation after saving the decline, using a scratch HOME and injected account identity.

Run `node --test hub/test/setup-accounts.test.ts` on supported Node with inherited
`CLAND_*` variables stripped. These T1/T2 cases need no native host or browser.
