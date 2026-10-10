-- id: THREAD-008
-- title: Ask cards, chips, kinds and watch verdicts at 80 columns
-- preconditions: Stub hub with an ask and a following Coordinator chip, a clear verdict and a failed note
-- expected: Numbered cards answer in place, chips share headers, kinds are visible and clear verdicts are dimmed single rows
-- since: T-135
-- regression: no
local dir=debug.getinfo(1,'S').source:sub(2):match('^(.*)/')
return dofile(dir..'/../support/thread-cards.lua')(80)
