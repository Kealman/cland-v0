-- id: THREAD-010
-- title: Top bar and inbox count only actionable inbox rows at 80 columns
-- preconditions: Stub hub, long Unicode title and Coordinator label, bound item topic
-- expected: Messages and ordinary notifications stay quiet; asks count once; approvals, waiting topics, failed verdicts and deaths count; resolutions clear both displays
-- since: T-165
-- regression: yes
local dir = debug.getinfo(1, 'S').source:sub(2):match('^(.*)/')
return dofile(dir .. '/../support/top-bar-now.lua')(80)
