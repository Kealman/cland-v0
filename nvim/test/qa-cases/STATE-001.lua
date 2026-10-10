-- A stub-hub case: two sessions with states, a topic waiting for the human with an open ask, two items.
local function session(name, role, state, model)
  return {
    name = name, harness = 'claude-code', role = role, model = model, cwd = '/tmp', pid = 1,
    harnessId = name .. '-bg', sessionId = name .. '-id', startedAt = '2026-10-08T10:00:00.000Z',
    status = 'running', state = state, attach = 'claude attach ' .. name .. '-bg',
  }
end
local at = '2026-10-08T10:00:00.000Z'

return {
  hub = 'stub',
  fixture = {
    project = 'qa-state',
    config = '[tracker]\nlevels = ["epic"]\n',
    items = {
      { id = 'T-1', kind = 'epic', title = 'Workbench shell' },
      { id = 'T-2', title = 'Items panel', status = 'in progress', parent = 'T-1', claim = { session = 'impl-1', sessionId = 'impl-1-id', role = 'implementer', claimedAt = at } },
    },
  },
  scenario = {
    tracker = {levels={'epic'}},
    processes = { session('coord-1', 'coordinator', 'busy', 'opus'), session('impl-1', 'implementer', 'waiting for human', 'sonnet') },
    coordinator = 'coord-1',
    topics = {
      { id = 'general', title = 'General', status = 'open', standing = true, createdAt = at, updatedAt = at },
      { id = 'agents', title = 'Agents', status = 'open', standing = true, createdAt = at, updatedAt = at },
      { id = 'topic-1', title = 'Spoke identity', status = 'waiting for human', standing = false, item = 'T-2', unread = 1, createdAt = at, updatedAt = at },
    },
    inbox = {
      asks = { { id = 'a1', topic = { id = 'topic-1', title = 'Spoke identity', item = 'T-2' }, question = 'Which should win?', options = { 'the pid', 'the name' }, free = true, from = 'coord-1', label = 'coord-1 [Coordinator]', ts = at } },
      approvals = {}, waiting = {}, notifications = {},
    },
  },
  run = function(qa)
    -- the sessions panel is open at the start; the items panel and the inbox join it
    qa.wait_for(function()
      return qa.screen():find('impl-1 [Implementer]', 1, true)
    end, 10000, 'the sessions panel')
    qa.dump('sessions')
    qa.keys('<Esc><Space>i')
    vim.api.nvim_win_set_width(require('cland.layout').win.left,60)
    qa.keys('<Space>n')
    qa.wait_for(function()
      local s = qa.screen()
      return s:find('T-2 T-1 › Items panel', 1, true) and s:find('Which should win?', 1, true)
    end, 5000, 'the items panel and the inbox')
    qa.expect(#qa.state().sessions == 2, 'the state holds the two sessions')
  end,
}
