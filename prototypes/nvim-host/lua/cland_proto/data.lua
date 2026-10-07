-- PROTOTYPE (ticket #11): fake topics and messages. Nothing here is real.
local M = {}

local CC = 'Claude Code'

M.topics = {
  {
    title = 'Hub transport: WebSocket or msgpack-RPC',
    status = 'waiting-for-you',
    agent = { from = 'coordinator', role = 'Coordinator', harness = CC },
    messages = {
      { from = 'coordinator', role = 'Coordinator', harness = CC, time = '14:02', text = {
        'Two options for the hub transport:',
        '  A) keep the BCAS WebSocket spoke, add a Lua WebSocket client',
        '  B) msgpack-RPC over a Unix socket; the Node side uses the npm neovim client',
      } },
      { from = 'reviewer', role = 'Reviewer', harness = 'Codex', time = '14:05', text = {
        'B drops a dependency, but the spoke protocol is WebSocket today.',
        'Re-implementing store-and-forward on RPC is a week, not a day.',
      } },
      { from = 'coordinator', role = 'Coordinator', harness = CC, time = '14:07', text = {
        'Need your call: A or B? The hub ticket waits on this.',
      } },
    },
  },
  {
    title = 'Review: Codex session-state adapter',
    status = 'open',
    agent = { from = 'reviewer', role = 'Reviewer', harness = 'Codex' },
    messages = {
      { from = 'implementer', role = 'Implementer', harness = 'OpenCode', time = '11:40', text = {
        'Adapter maps thread/status/changed to idle / busy / waiting.',
        'waitingOnApproval and waitingOnUserInput both become "waiting for you".',
      } },
      { from = 'reviewer', role = 'Reviewer', harness = 'Codex', time = '11:52', text = {
        'Two findings: the reconnect path drops pending approvals,',
        'and the state is not persisted when the hub restarts.',
      } },
    },
  },
  {
    title = 'QA round 3: composer paste with tabs',
    status = 'busy',
    agent = { from = 'qa', role = 'QA', harness = 'Codex' },
    messages = {
      { from = 'coordinator', role = 'Coordinator', harness = CC, time = '13:10', text = {
        'QA: paste a prompt with TAB characters into each harness and report.',
      } },
      { from = 'qa', role = 'QA', harness = 'Codex', time = '13:12', text = {
        'Working on it. Claude Code done, Codex in progress.',
      } },
    },
  },
  {
    title = 'Glossary: Topic versus Thread',
    status = 'closed',
    agent = { from = 'coordinator', role = 'Coordinator', harness = CC },
    messages = {
      { from = 'coordinator', role = 'Coordinator', harness = CC, time = 'Mon', text = {
        'Settled: "Topic" is the domain term; "thread" stays a UI word only.',
      } },
      { from = 'you', role = 'Human', harness = 'cland', time = 'Mon', text = { 'Agreed, closing.' } },
    },
  },
  {
    title = 'Approve: one git worktree per session',
    status = 'waiting-for-approval',
    agent = { from = 'implementer', role = 'Implementer', harness = 'OpenCode' },
    messages = {
      { from = 'implementer', role = 'Implementer', harness = 'OpenCode', time = '15:20', text = {
        'Requesting approval to run: git worktree add ../wt-impl-3 impl/topic-3',
      } },
    },
  },
}

return M
