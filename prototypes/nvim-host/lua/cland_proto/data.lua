-- PROTOTYPE (ticket #15): the fake data set every chat-screen variant renders.
-- Nothing here is real. make(now) builds a fresh copy with message times
-- relative to "now" (minutes since local midnight), so replies sent while
-- the prototype runs sort after the fake history. State lives in memory only.
local M = {}

local CC, CX, OC = 'Claude Code', 'Codex', 'OpenCode'

function M.make(now)
  local S = {}
  local function at(ago)
    return now - ago
  end

  -- Items of the tracker (ADR 0002). Only what the screen shows.
  S.items = {
    ['T-12'] = {
      id = 'T-12', kind = 'task', state = 'open', assignee = 'Implementer',
      title = 'Hub: replay UI-socket frames after a hub restart',
      branch = 't/T-12-ui-socket-replay',
      verdicts = { 'review: not clear (review-1 [Reviewer], run r-0412)' },
    },
    ['T-15'] = {
      id = 'T-15', kind = 'task', state = 'open', assignee = 'Implementer', claim = 'impl-1',
      title = 'Adapter: OpenCode waiting-for-human heuristic',
      branch = 't/T-15-opencode-waiting', verdicts = {},
    },
    ['T-21'] = {
      id = 'T-21', kind = 'task', state = 'closed', assignee = 'Implementer',
      title = 'Docs: glossary entries for artifacts',
      branch = 't/T-21-glossary-artifacts',
      verdicts = { 'review: clear (review-1 [Reviewer], run r-0398)' },
    },
  }

  -- Sessions with roles (ADR 0001) and normalised state (ADR 0003).
  S.sessions = {
    { name = 'coord', role = 'Coordinator', harness = CC, model = 'fable', effort = 'max',
      state = 'busy', since = at(3), item = 'T-12', status_line = 'drafting the T-12 follow-up' },
    { name = 'impl-1', role = 'Implementer', harness = OC, model = 'free-model', effort = '-',
      state = 'idle', since = at(35), item = 'T-15', status_line = 'heuristic posted' },
    { name = 'review-1', role = 'Reviewer', harness = CX, model = 'gpt-6.1-sol', effort = 'high',
      state = 'waiting for approval', since = at(2), item = 'T-12',
      approval = 'node --test hub/test/ui-socket.test.ts', status_line = 'second review round' },
    { name = 'qa-1', role = 'QA', harness = CX, model = 'gpt-6-astra', effort = 'high',
      state = 'idle', since = at(47), item = nil, status_line = 'waiting for a QA request' },
  }

  -- Artifacts (#9): files in .cland/artifacts with a hub index.
  S.artifacts = {
    ['A-7'] = {
      id = 'A-7', kind = 'diagram', title = 'UI socket frames across a hub restart', by = 'coord',
      status = 'shared', topic = 't12', path = '.cland/artifacts/A-7-ui-socket-frames.mmd', ft = 'mermaid',
      content = {
        'sequenceDiagram',
        '  participant UI as Neovim UI',
        '  participant Hub',
        '  participant Spoke as spoke (coord)',
        '  Spoke->>Hub: send(topic t12, "review not clear")',
        '  Hub->>UI: frame 41 (message)',
        '  Note over Hub: hub restarts',
        '  Spoke->>Hub: send(topic t12, ask)   %% frame 42 lost today',
        '  Hub-->>UI: (socket closed)',
        '  UI->>Hub: reconnect, last seen = 41',
        '  Hub->>UI: replay frames > 41   %% what T-12 adds',
      },
    },
    ['A-9'] = {
      id = 'A-9', kind = 'prompt', title = 'Brief: OpenCode waiting heuristic', by = 'you',
      status = 'sent', topic = 't15', path = '.cland/artifacts/A-9-brief-opencode-waiting.md', ft = 'markdown',
      content = {
        '# Brief: OpenCode waiting-for-human heuristic (T-15)',
        '',
        'OpenCode has no "waiting" status (research #3). Derive one:',
        '',
        '1. Start with the permission prompt case: a tool call is pending and',
        '   `permission.updated` fired, so the session waits for approval.',
        '2. Then question events: the model asked the human in its own TUI.',
        '3. Report the state with its reliability ("heuristic") to the hub.',
        '',
        'Done when the adapter test covers both cases and the board shows',
        '`waiting for approval` for an OpenCode session within 2 s.',
      },
    },
  }

  -- One open ask (#7): options plus a free answer.
  S.asks = {
    {
      id = 1, topic = 't12', from = 'coord', role = 'Coordinator', at = at(72), state = 'open',
      question = 'How should I proceed with T-12?',
      options = {
        { label = 'Fix the drop in T-12 before merging (about a day)', short = 'fix first' },
        { label = 'Merge T-12 now and open a follow-up task', short = 'merge + follow-up' },
        { label = 'Drop replay; the UI asks for a full resync on reconnect', short = 'drop replay' },
      },
      free = true,
    },
  }

  local function msg(ago, from, role, text, extra)
    local m = { kind = 'text', at = at(ago), from = from, role = role, text = text }
    for k, v in pairs(extra or {}) do
      m[k] = v
    end
    return m
  end
  local function you(ago, to, text, stage, extra)
    local m = msg(ago, 'you', 'Human', text, extra)
    m.to, m.stage = to, stage
    return m
  end
  local function event(ago, name, text)
    return { kind = 'event', at = at(ago), event = name, text = text }
  end
  local function system(ago, text, extra)
    local m = { kind = 'system', at = at(ago), text = text }
    for k, v in pairs(extra or {}) do
      m[k] = v
    end
    return m
  end

  -- Topics (#7): one flat list, two standing topics, at most one binding each.
  S.topics = {
    {
      id = 'general', title = 'General', standing = true, status = 'open', unread = 2, created_by = 'system',
      messages = {
        you(180, 'coord', { 'Plan for today: land T-12, get T-15 into review, close the docs pass.' }, 'injected'),
        msg(178, 'coord', 'Coordinator', {
          'Plan noted. T-12 is with review-1, impl-1 takes T-15, and T-21 is merged;',
          'I will close its topic.',
        }),
        msg(61, 'coord', 'Coordinator', { "FYI: impl-1's free model hit a quota limit once; it retried and carried on." }),
        msg(21, 'coord', 'Coordinator', {
          'Midday summary: T-12 needs your call (see its topic); T-15 waits on my answer;',
          'nothing else is blocked.',
        }),
      },
    },
    {
      id = 'agents', title = 'Agents', standing = true, readonly = true, status = 'open', unread = 5,
      created_by = 'system',
      messages = {
        event(178, 'session start', 'coord · Claude Code · fable'),
        event(177, 'role handover', 'Coordinator: coord-0 → coord, with a handover note'),
        event(176, 'session stop', 'coord-0 · Claude Code (no role)'),
        event(172, 'session start', 'impl-1 · OpenCode · free-model'),
        event(172, 'role assigned', 'impl-1 → Implementer (by you)'),
        event(170, 'claim', 'impl-1 claimed T-15'),
        event(150, 'session start', 'qa-1 · Codex · gpt-6-astra'),
        event(150, 'role assigned', 'qa-1 → Implementer (by you)'),
        event(98, 'session start', 'review-1 · Codex · gpt-6.1-sol'),
        event(98, 'role assigned', 'review-1 → Reviewer (by you)'),
        msg(97, 'coord', 'Coordinator', { 'Review t/T-12-ui-socket-replay against dev, please.' },
          { to = 'review-1', to_role = 'Reviewer', via = 'T-12', stage = 'injected' }),
        msg(76, 'review-1', 'Reviewer', {
          'verdict: not clear. Frames sent while the hub restarts are dropped',
          '(hub/ui-socket.ts:212).',
        }, { to = 'coord', to_role = 'Coordinator', via = 'T-12', stage = 'injected' }),
        event(47, 'role change', 'qa-1: Implementer → QA (by you); clause delivered'),
        msg(33, 'coord', 'Coordinator', { 'Post your heuristic in the T-15 topic for the human.' },
          { to = 'impl-1', to_role = 'Implementer', via = 'T-15', stage = 'injected' }),
        msg(6, 'coord', 'Coordinator', { 'Run the ui-socket tests on the branch and report.' },
          { to = 'review-1', to_role = 'Reviewer', via = 'T-12', stage = 'injected' }),
      },
    },
    {
      id = 't12', title = 'UI socket replay after a hub restart', item = 'T-12',
      status = 'waiting for human', unread = 1, created_by = 'coord',
      messages = {
        you(101, 'coord', { 'When T-12 is ready, send it to review.' }, 'injected'),
        msg(99, 'coord', 'Coordinator', { 'impl-1 pushed t/T-12-ui-socket-replay; review-1 has it now.' }),
        msg(74, 'coord', 'Coordinator', {
          'Review came back not clear: frames sent while the hub restarts are dropped;',
          'the UI only resyncs on the next event. Diagram below.',
        }),
        system(73, 'coord shared A-7: diagram "UI socket frames across a hub restart"', { artifact = 'A-7' }),
        { kind = 'ask', ask = 1, at = at(72), from = 'coord', role = 'Coordinator' },
      },
    },
    {
      id = 't15', title = 'OpenCode waiting heuristic', item = 'T-15',
      status = 'waiting for agent', unread = 0, created_by = 'you',
      messages = {
        you(170, 'impl-1', { '@impl-1 brief attached: start with the permission prompt case.' }, 'injected',
          { attach = { 'A-9' } }),
        msg(169, 'impl-1', 'Implementer', { 'Read A-9. Permission prompts first, then question events.' }),
        msg(35, 'impl-1', 'Implementer', {
          'Heuristic: no SSE event for 20 s while a tool call is pending means waiting.',
          'False positives on long builds.',
        }),
        you(8, 'coord', { 'Is a timer heuristic acceptable for v0, or should impl-1 wait for an upstream event?' },
          'delivered'),
      },
    },
    {
      id = 'flake', title = 'Spoke reconnect: flaky test', status = 'open', unread = 1, created_by = 'coord',
      messages = {
        msg(40, 'coord', 'Coordinator', {
          'Opening this to park a flaky test: spoke/reconnect.test.ts times out about',
          '1 run in 20. Not blocking anything.',
        }),
      },
    },
    {
      id = 't21', title = 'Glossary entries for artifacts', item = 'T-21', status = 'closed', unread = 0,
      created_by = 'coord',
      messages = {
        msg(1290, 'coord', 'Coordinator', { 'T-21 is merged to dev as 4f2c9e1.' }),
        you(1288, 'coord', { 'Thanks, close it.' }, 'injected'),
        system(1287, 'topic closed: T-21 closed'),
      },
    },
  }

  S.current_topic = 't15'
  S.active_session = 'coord'
  -- the last message the human sent (variant C's bottom bar shows its stage)
  S.last_sent = S.topics[4].messages[4]
  S.last_sent_topic = 't15'
  return S
end

return M
