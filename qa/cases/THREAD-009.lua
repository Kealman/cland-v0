-- id: THREAD-009
-- title: Top bar and inbox show only the hub needsYou count at 120 columns
-- preconditions: Stub hub, long Unicode title and Coordinator label, bound item topic
-- expected: Both displays follow hub needsYou, including zero with 427 mixed notifications; messages, rows and reading never add to it
-- since: T-169 (T-165 follow-up)
-- regression: yes
local dir = debug.getinfo(1, 'S').source:sub(2):match('^(.*)/')
return dofile(dir .. '/../support/top-bar-now.lua')(120)
