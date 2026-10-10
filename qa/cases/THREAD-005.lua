-- id: THREAD-005
-- title: Manual agent-run folds and keys at 120 columns
-- preconditions: Stub hub with four-message exchange, never-fold boundaries and long Unicode participant names
-- expected: Keys toggle runs, the header counts closed messages, summaries fit and composer Insert survives appends
-- since: T-134
-- regression: no
local dir=debug.getinfo(1,'S').source:sub(2):match('^(.*)/')
return dofile(dir..'/../support/thread-folds.lua')(120)
