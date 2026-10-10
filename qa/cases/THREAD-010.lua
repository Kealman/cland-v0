-- id: THREAD-010
-- title: Top bar counts now-layer messages and asks at 80 columns
-- preconditions: Stub hub, long Unicode title and Coordinator label, bound item topic
-- expected: Background/watch stay quiet; addressed message and ask raise the fitted count; ask deduplicates
-- since: T-136
-- regression: no
local dir = debug.getinfo(1, 'S').source:sub(2):match('^(.*)/')
return dofile(dir .. '/../support/top-bar-now.lua')(80)
