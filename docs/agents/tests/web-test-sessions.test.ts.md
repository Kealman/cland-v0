# web/test/sessions.test.ts

`web/test/sessions.test.ts` owns the Sessions list seams against fake harnesses:
group/header counts, browser-only fold persistence, merged row facts and live
hold/request changes, full waiting commands and human-ask topics, visible-row
physical navigation, stopped/archived inventories and `gs` into a folded group.
Archive reads consume the additive hub-merged `session.list.rows` field.
The merged-facts case checks P22 geometry at 1440 px and P27's 52 px two-line
rows at a test-set 600 px viewport, including the pending command, hold/request
facts, page-only metadata and absent list actions.

T-1472 adds the actual Sessions row's `deaf` rendering after held human input
ages beyond five minutes, then observes the injection receipt and rendered idle
row. Use the isolated Headless Shell; build current web/dist first.
