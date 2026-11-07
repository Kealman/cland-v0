# hub/test/setup-flow.test.ts

## Config writer preservation (T-1733)

`a declined installer persists across setup runs until an explicit install` checks SSH/pool tables after both saving and clearing a decline. In-memory machine, no installer is executed.

Run `node --test hub/test/setup-flow.test.ts` on supported Node with inherited
`CLAND_*` variables stripped. These T1/T2 cases need no native host or browser.
