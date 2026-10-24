# web/test/items-actions.test.ts

`web/test/items-actions.test.ts` owns the three Items interaction seams: selecting
three rows, switching to Board and sending one General message received by an in-process fake
Coordinator, creating and reusing a missing item topic, and scope/breadcrumb/back
navigation plus closed-item links. It uses the shared isolated Headless Shell
fixture, observes the actual message/DOM receipts before asserting, and checks
`gi`, `gt`, `gs` through the shared physical-code dispatcher. The marked selection
keeps its composer when the cursor moves to an unmarked row. A browser-edge held
summary reply proves that later area/row navigation survives after the loaded
lookup target appears in the palette; the Board cases retain later epic and All
tab choices too. A non-first epic selected in Tree remains the Board x/s target.
By-id summary pages
carry a complete compact tree row so closed links need no body fetch. Board
and Graph share the scope breadcrumbs and physical selection keys; item links
from either view open Tree to reveal their ancestor chain. The Graph interaction
case checks x/Shift-j, a selection quick message, Escape, s and back.
