-- PROTOTYPE (ticket #15, workbench): the fake data set, taken from the
-- approved design canvas (Main, Watch, Item, Session, Pickers, Inbox and
-- Charting artboards) and kept consistent with the decisions of #7 (topics,
-- asks), #8 (items, verdicts), #9 (artifacts), #10 (roles) and #13 (stages,
-- session state). Nothing here is real; make(now) builds a fresh copy with
-- times relative to "now" (minutes since local midnight). Memory only.
--
-- Two deliberate departures from the artboards, both because the artboards
-- disagree with each other:
--  * the spoke-identity ask lives in the T-12 topic (Watch, Inbox, #7: an
--    ask about a task goes to the task's topic), not in General (Main);
--  * the open question "Which free model for impl-1?" is Q-19, because the
--    map M-1 (Charting) already uses Q-3 for "Harness integration surfaces".
local M = {}

local CC, CX, OC = 'Claude Code', 'Codex', 'OpenCode'

function M.make(now)
  local S = { project = 'cland-v0' }
  local function at(ago)
    return now - ago
  end

  -- Sessions (ADR 0001 roles, #13 normalised state). Main artboard.
  S.sessions = {
    { name = 'coord-1', role = 'Coordinator', harness = CC, model = 'fable', effort = 'max', state = 'busy',
      since = at(9), up = at(130), item = 'T-12', status_line = 'planning T-13 with impl-2',
      attach = 'claude attach coord-1' },
    { name = 'impl-1', role = 'Implementer', harness = OC, model = 'free model', effort = '-', state = 'idle',
      since = at(26), up = at(110), item = 'T-12',
      attach = 'opencode --server http://127.0.0.1:49374 --session impl-1' },
    { name = 'impl-2', role = 'Implementer', harness = CC, model = 'opus', effort = 'high', state = 'busy',
      since = at(6), up = at(140), item = 'T-13', cost = '$1.80', attach = 'claude attach impl-2' },
    { name = 'rev-1', role = 'Reviewer', harness = CX, model = 'gpt-6.1-sol', effort = 'high',
      state = 'waiting for approval', since = at(2), up = at(70), item = 'T-15',
      approval = 'npm test -- --filter reconnect',
      attach = 'codex resume --remote unix:///…/.cland/sessions/rev-1.sock 01a1…c7' },
    { name = 'qa-1', role = 'QA', harness = CX, model = 'gpt-6-astra', effort = 'high', state = 'idle',
      since = at(46), up = at(160), item = nil,
      attach = 'codex resume --remote unix:///…/.cland/sessions/qa-1.sock 7f3e…02' },
  }

  -- Items (ADR 0002): one Markdown file each; status is derived in cland
  -- from claims and verdicts, here it is stored to keep the fake simple.
  -- status: backlog | planned | progress | review | qa | done
  local items = {}
  local order = {}
  local function item(t)
    t.labels = t.labels or {}
    t.blocked_by = t.blocked_by or {}
    t.verdicts = t.verdicts or {}
    t.comments = t.comments or {}
    t.created = t.created or '2026-10-07'
    items[t.id] = t
    order[#order + 1] = t.id
    return t
  end
  local function verdict(kind, result, by, role, run, ago, extra)
    local v = { kind = kind, result = result, by = by, role = role, run = run, at = at(ago) }
    for k, val in pairs(extra or {}) do
      v[k] = val
    end
    return v
  end
  local function comment(by, role, ago, text)
    return { by = by, role = role, at = at(ago), text = text }
  end

  item({ id = 'E-1', kind = 'epic', title = 'Hub and spoke', assignee = 'Coordinator', labels = { 'slice-1' },
    body = { 'The per-project hub daemon, the spoke inside every session, and the UI socket: the first',
      'end-to-end path of slice 1 (spec 4.2).' } })
  item({ id = 'T-10', kind = 'task', title = 'Hub store on SQLite', parent = 'E-1', status = 'done',
    assignee = 'Implementer', labels = { 'slice-1' }, branch = 't/T-10-hub-store',
    verdicts = { verdict('review', 'clear', 'rev-1', 'Reviewer', 'r-0390', 1500) },
    body = { 'node:sqlite store for topics, messages, asks, role state and the session registry.' } })
  item({ id = 'T-11', kind = 'task', title = 'Spoke protocol extracted', parent = 'E-1', status = 'done',
    assignee = 'Implementer', labels = { 'slice-1' }, topic = 't11', branch = 't/T-11-spoke-protocol',
    verdicts = { verdict('review', 'clear', 'rev-1', 'Reviewer', 'r-0395', 2880) },
    body = { 'The BCAS spoke as it is: MCP stdio server, one WebSocket, hello / welcome / deliver / result.' } })
  item({ id = 'T-12', kind = 'task', title = 'Hub daemon and spoke hello', parent = 'E-1', status = 'progress',
    claim = 'impl-1', assignee = 'Implementer', labels = { 'slice-1', 'tracer-bullet' }, topic = 't12',
    branch = 't/T-12-hub-spoke-hello', commits = 4, blocks_note = nil, cost = '$2.10 · 160k tokens',
    required = { 'review', 'qa' }, updated = at(26),
    body = { 'The hub daemon starts from the repo root, a Claude Code session connects through the spoke,',
      'and a message typed in General reaches the session and comes back as a reply with the stages',
      'queued, delivered and injected shown in the UI.' },
    acceptance = 'Acceptance: start the hub, start coord-1 with the spoke, send "hello" in General and see the reply and all three stages within 5 s.',
    comments = {
      comment('coord-1', 'Coordinator', 86, 'Claimed for impl-1 with the A-9 brief; branch from dev.'),
      comment('impl-1', 'Implementer', 26,
        'Hello works against the stub. Real spoke next; the identity question is open, see the ask in the topic.'),
    } })
  item({ id = 'T-13', kind = 'task', title = 'Codex adapter', parent = 'E-1', status = 'progress', claim = 'impl-2',
    assignee = 'Implementer', labels = { 'slice-1', 'adapter' }, topic = 't13', branch = 't/T-13-codex-adapter',
    commits = 1, cost = '$1.80 · 95k tokens', required = { 'review', 'qa' }, updated = at(4),
    body = { 'Codex as a full interactive harness: codex app-server per session on a unix socket, thread/start',
      'with the role clause in the first turn, attach with codex resume --remote, inject with turn/start,',
      'state from thread/status/changed (spec 4.3).' },
    comments = { comment('impl-2', 'Implementer', 4, 'app-server spawns per session; thread/start works. Next: resume --remote.') } })
  item({ id = 'T-14', kind = 'task', title = 'OpenCode adapter', parent = 'E-1', status = 'planned',
    assignee = 'Implementer', labels = { 'slice-1', 'adapter' }, blocked_by = { 'T-12' }, required = { 'review' },
    body = { 'A session on the OpenCode server, attach with opencode --server, inject through the prompt API,',
      'waiting state from permission.asked and form.created (heuristic).' } })
  item({ id = 'T-19', kind = 'task', title = 'Topic store', parent = 'E-1', status = 'progress', claim = nil,
    lost_claim = 'impl-3', assignee = 'Implementer', labels = { 'slice-1' }, topic = nil,
    branch = 't/T-19-topic-store', commits = 3, required = { 'review', 'qa' }, updated = at(54),
    verdicts = { verdict('review', 'not clear', 'rev-1', 'Reviewer', 'r-0409', 61,
      { note = '3 findings: the unread counter is not persisted; closing a topic does not cancel open asks; no index on topic.updated' }) },
    body = { 'Topics, messages and asks in the hub store: statuses by direction, ask and resolve, unread per',
      'topic for the human (#7).' },
    comments = { comment('hub', nil, 54, 'impl-3 died · claim released · T-19 is unclaimed') } })
  item({ id = 'T-25', kind = 'task', title = 'Spoke reconnect test matrix', parent = 'E-1', status = 'backlog',
    assignee = 'QA', labels = { 'slice-1', 'tests' },
    body = { 'Kill the spoke, the hub and the harness in every order; the session comes back under its name.' } })

  item({ id = 'E-2', kind = 'epic', title = 'Roles', assignee = 'Coordinator', labels = { 'slice-1' },
    body = { 'The four roles as hub-held state: clauses, permissions, handover (ADR 0001).' } })
  item({ id = 'T-15', kind = 'task', title = 'Role clause delivery', long = 'Role clause delivery on assignment and reconnect',
    parent = 'E-2', status = 'review', claim = 'rev-1', assignee = 'Implementer', labels = { 'slice-1', 'roles' },
    topic = 't15', branch = 't/T-15-role-clause-delivery', commits = 6, rebased = true,
    cost = '$4.20 · 310k tokens', required = { 'review', 'qa' }, updated = at(2),
    body = { 'When a role is assigned to a session, and on every reconnect of that session, the hub delivers',
      'the role clause as an event. The clause is read from .cland/roles.toml; the adapter confirms the',
      'injected stage.' },
    acceptance = 'Acceptance: assign Reviewer to a Codex session, kill the spoke, reconnect, and see the clause arrive again within one turn; the journal shows both deliveries.',
    verdicts = { verdict('review', 'in progress', 'rev-1', 'Reviewer', 'r-0412', 2,
      { round = 1, note = 'waiting for approval in the session' }) },
    comments = {
      comment('impl-2', 'Implementer', 36, 'Clause delivery implemented as a hub event; added a reconnect test. Ready for review.'),
      comment('coord-1', 'Coordinator', 34, 'Review requested from rev-1. QA after review.'),
      comment('hub', nil, 2, 'rev-1 claimed the review · state waiting for approval'),
    } })
  item({ id = 'T-16', kind = 'task', title = 'Handover note', parent = 'E-2', status = 'backlog',
    assignee = 'Implementer', labels = { 'slice-1', 'roles' }, blocked_by = { 'T-15' },
    body = { 'The four-section handover note (goals now, work in flight, open decisions, waiting on), stored',
      'with the role and delivered to the next holder.' } })
  item({ id = 'T-17', kind = 'task', title = 'Roles config and defaults', parent = 'E-2', status = 'done',
    assignee = 'Implementer', labels = { 'slice-1', 'roles' }, topic = 't17', branch = 't/T-17-roles-config',
    verdicts = { verdict('review', 'clear', 'rev-1', 'Reviewer', 'r-0399', 1420),
      verdict('qa', 'clear', 'qa-1', 'QA', 'q-0109', 1410) },
    body = { '.cland/roles.toml with the four roles and their launch defaults.' } })
  item({ id = 'T-18', kind = 'task', title = 'Permission table in hub', parent = 'E-2', status = 'backlog',
    assignee = 'Implementer', labels = { 'slice-1', 'roles' },
    body = { 'Every spoke tool call is checked against the role permissions of #10.' } })
  item({ id = 'T-20', kind = 'task', title = 'Vacant coordinator warning', parent = 'E-2', status = 'backlog',
    assignee = 'Implementer', labels = { 'slice-1', 'roles' },
    body = { 'No session holds the Coordinator: the UI warns and the hub queues messages to the role.' } })

  item({ id = 'E-3', kind = 'epic', title = 'Tracker', assignee = 'Coordinator', labels = { 'slice-1' },
    body = { 'Items as Markdown files in .cland/tasks, the hub index and cland task (ADR 0002).' } })
  item({ id = 'T-21', kind = 'task', title = 'cland task CLI', parent = 'E-3', status = 'done', assignee = 'Implementer',
    labels = { 'slice-1', 'tracker' }, topic = 't21', branch = 't/T-21-task-cli',
    verdicts = { verdict('review', 'clear', 'rev-1', 'Reviewer', 'r-0402', 1310),
      verdict('qa', 'clear', 'qa-1', 'QA', 'q-0117', 46) },
    body = { 'cland task create, view, list, comment, edit, close, link, claim, talking to the hub.' } })
  item({ id = 'T-22', kind = 'task', title = 'Index and watcher', parent = 'E-3', status = 'planned',
    assignee = 'Implementer', labels = { 'slice-1', 'tracker' }, required = { 'review' },
    body = { 'The hub watches .cland/tasks and re-indexes hand edits; last writer wins.' } })

  -- The wayfinder map (Charting artboard): M-1 and its 17 question tickets,
  -- numbered like the real GitHub issues #2-#18. A frozen charting-stage
  -- snapshot: decided / frontier / in work by sub-agents / blocked.
  item({ id = 'M-1', kind = 'map', title = 'cland v0 spec (map)', long = 'cland v0: the way to a buildable spec',
    status = 'progress', assignee = 'Coordinator', labels = { 'wayfinder' },
    body = { 'The map of decision tickets that ends in a buildable spec (docs/spec/v0.md).' } })
  local function q(id, title, mstate, extra)
    local t = { id = id, kind = 'question', title = title, parent = 'M-1', map = mstate, assignee = 'Coordinator',
      labels = { 'wayfinder' } }
    for k, v in pairs(extra or {}) do
      t[k] = v
    end
    t.status = (mstate == 'decided' and 'done') or (mstate == 'blocked' and 'backlog')
      or ((mstate == 'subagent' or t.claim) and 'progress') or 'planned'
    t.body = t.body or { 'Wayfinder ticket of M-1 (charting snapshot): ' .. title .. '.' }
    return item(t)
  end
  q('Q-2', 'BCAS hub: what is reusable', 'decided')
  q('Q-3', 'Harness integration surfaces', 'decided')
  q('Q-4', 'Neovim as the engine', 'decided')
  q('Q-6', 'codex:rescue smoke test', 'decided')
  q('Q-7', 'Topic model', 'decided')
  q('Q-10', 'Role model', 'decided')
  q('Q-16', 'QA with gpt-6-astra', 'decided')
  q('Q-13', 'Hub boundaries', 'frontier', { claim = 'coord-1', doing = 'grilling' })
  q('Q-8', 'Task tracking', 'frontier')
  q('Q-9', 'Artifact model', 'frontier')
  q('Q-5', 'Git engines research', 'subagent', { sub = 'research', mins = 41 })
  q('Q-11', 'Engine prototype', 'subagent', { sub = 'prototype', mins = 12 })
  q('Q-12', 'Adapter contract', 'blocked', { blocked_by = { 'Q-13' } })
  q('Q-14', 'Git strategy', 'blocked', { blocked_by = { 'Q-5' } })
  q('Q-15', 'Chat screen prototype', 'blocked', { blocked_by = { 'Q-7', 'Q-11' } })
  q('Q-17', 'Process layer', 'blocked', { blocked_by = { 'Q-8', 'Q-9' } })
  q('Q-18', 'First usable slice', 'blocked',
    { blocked_by = { 'Q-13', 'Q-8', 'Q-9', 'Q-5', 'Q-11', 'Q-12', 'Q-14', 'Q-15', 'Q-17' } })

  item({ id = 'Q-19', kind = 'question', title = 'Which free model for impl-1?', status = 'backlog', assignee = 'you',
    labels = { 'decision' },
    body = { 'Role model #10 left the Implementer\'s free OpenCode model to pick. impl-1 runs on a placeholder',
      'and hits quota limits about once an hour. Pick one, or keep the placeholder until T-14 lands.' } })

  S.items, S.item_order = items, order

  -- Artifacts (#9): files in .cland/artifacts with a hub index.
  S.artifacts = {
    ['A-4'] = { id = 'A-4', kind = 'page', title = 'QA lanes comparison', by = 'qa-1', status = 'archived',
      note = 'deleted in 12 days', topic = nil, path = '.cland/artifacts/A-4-qa-lanes.html', ft = 'html',
      content = { '<!doctype html>', '<title>QA lanes comparison</title>',
        '<h1>QA lanes: headless Neovim, tmux capture-pane, ttyd in Chrome</h1>', '<table>…</table>' } },
    ['A-6'] = { id = 'A-6', kind = 'note', title = 'hub boundaries sketch', by = 'you', status = 'draft',
      topic = 'general', path = '.cland/artifacts/A-6-hub-boundaries.md', ft = 'markdown',
      content = { '# Hub boundaries (sketch)', '', '- owns: registry, routing, topics, asks, role state, journal',
        '- does not own: decisions, the UI, git, artifact files', '- UI: JSON lines over a unix socket' } },
    ['A-7'] = { id = 'A-7', kind = 'diagram', title = 'spoke reconnect sequence', by = 'coord-1', status = 'shared',
      topic = 't12', path = '.cland/artifacts/A-7-spoke-reconnect.mmd', ft = 'mermaid',
      content = { 'sequenceDiagram', '  participant S as spoke (impl-1)', '  participant H as hub',
        '  participant A as adapter (OpenCode)', '  S->>H: hello(name = impl-1, harness id = ses_8f2…)',
        '  H-->>S: welcome(role = Implementer, clause)', '  Note over S,H: the harness restarts',
        '  S->>H: hello(name = impl-1, harness id = ses_91c…)', '  H->>H: which identity wins? (the ask on T-12)',
        '  H-->>S: welcome + queued deliveries' } },
    ['A-9'] = { id = 'A-9', kind = 'prompt', title = 'brief for impl-1: adapter contract', by = 'you', status = 'sent',
      topic = 't12', path = '.cland/artifacts/A-9-brief-impl-1.md', ft = 'markdown',
      content = { '# Brief: T-12 hub daemon and spoke hello', '',
        '1. Start the hub daemon from the repo root; write .cland/hub.json.',
        '2. Spoke hello against a stub hub first, then the real one.',
        '3. Show queued, delivered and injected in the UI for every message.', '',
        'Done when "hello" in General comes back from coord-1 with all three stages.' } },
  }
  S.artifact_order = { 'A-7', 'A-9', 'A-6', 'A-4' }

  -- Asks (#7): only the Coordinator asks the human; options plus a free answer.
  S.asks = {
    { id = 1, topic = 't12', item = 'T-12', from = 'coord-1', raised_by = 'impl-1', at = at(5), state = 'open',
      short = 'spoke identity on reconnect',
      question = 'Spoke identity on reconnect: which should win when the recorded name and the harness session id disagree?',
      options = { 'the name recorded by the spoke', 'the harness session id', 'ask me later' }, free = true },
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

  -- Topics (#7): one flat list; General and Agents are standing; at most one
  -- binding to a unit of work each.
  S.topics = {
    { id = 'general', title = 'General', standing = true, status = 'open', unread = 2, created_by = 'system',
      messages = {
        you(150, 'coord-1', { 'Morning. Today: the spoke hello end to end (T-12), then the Codex adapter.' }, 'injected'),
        msg(148, 'coord-1', 'Coordinator', { 'Plan noted. impl-1 takes T-12, rev-1 stays on T-15, and I brief impl-2 for T-13 once T-12 is past the stub.' }),
        msg(14, 'coord-1', 'Coordinator', { 'Round 2 on the hub boundaries is closed. I am starting T-12 with impl-1; the spoke hello works end to end against a stub.' }),
        you(8, 'coord-1', { 'Take T-13 next with impl-2, the Codex adapter. Keep rev-1 on the T-15 review.' }, 'injected'),
        msg(5, 'coord-1', 'Coordinator', { 'impl-2 has T-13. One decision is yours: the spoke identity on reconnect. The ask is in the T-12 topic.' }),
        msg(3, 'coord-1', 'Coordinator', { 'FYI: impl-3 died while fixing T-19; T-19 is unclaimed until one of us hands it on.' }),
      } },
    { id = 'agents', title = 'Agents', standing = true, readonly = true, status = 'open', unread = 0,
      created_by = 'system',
      messages = {
        event(160, 'session start', 'qa-1 · Codex · gpt-6-astra'),
        event(160, 'role assigned', 'qa-1 → QA (by you)'),
        event(140, 'session start', 'impl-2 · Claude Code · opus'),
        event(140, 'role assigned', 'impl-2 → Implementer (by you)'),
        event(130, 'session start', 'coord-1 · Claude Code · fable'),
        event(124, 'role handover', 'Coordinator: coord-0 → coord-1, with a handover note'),
        event(124, 'session stop', 'coord-0 · Claude Code (no role)'),
        event(110, 'session start', 'impl-1 · OpenCode · free model'),
        event(110, 'role assigned', 'impl-1 → Implementer (by you)'),
        event(86, 'claim', 'impl-1 claimed T-12'),
        event(70, 'session start', 'rev-1 · Codex · gpt-6.1-sol'),
        event(70, 'role assigned', 'rev-1 → Reviewer (by you)'),
        msg(68, 'coord-1', 'Coordinator', { 'Review t/T-19-topic-store against dev, please.' },
          { to = 'rev-1', to_role = 'Reviewer', via = 'T-19', stage = 'injected' }),
        msg(61, 'rev-1', 'Reviewer', { 'verdict: review not clear, 3 findings (unread counter not persisted, closing a topic keeps its asks, no index on topic.updated).' },
          { to = 'coord-1', to_role = 'Coordinator', via = 'T-19', stage = 'injected' }),
        event(54, 'session died', 'impl-3 · OpenCode (Implementer); claim on T-19 released'),
        msg(46, 'qa-1', 'QA', { 'verdict: qa clear on T-21, run q-0117: 12 cases pass.' },
          { to = 'coord-1', to_role = 'Coordinator', via = 'T-21', stage = 'injected' }),
        msg(34, 'coord-1', 'Coordinator', { 'Review t/T-15-role-clause-delivery against dev.' },
          { to = 'rev-1', to_role = 'Reviewer', via = 'T-15', stage = 'injected' }),
        event(6, 'claim', 'impl-2 claimed T-13'),
        msg(4, 'coord-1', 'Coordinator', { 'Real spoke next; hold the identity choice until the human answers the ask.' },
          { to = 'impl-1', to_role = 'Implementer', via = 'T-12', stage = 'injected' }),
        event(2, 'claim', 'rev-1 claimed the review of T-15'),
      } },
    { id = 't12', title = 'Hub daemon and spoke hello', item = 'T-12', status = 'waiting for human', unread = 3,
      created_by = 'coord-1',
      messages = {
        you(86, 'impl-1', { '@impl-1 brief attached: the hub daemon first, then the spoke hello against a stub.' },
          'injected', { attach = { 'A-9' } }),
        msg(84, 'impl-1', 'Implementer', { 'Read A-9. Daemon first; I will post here when the hello works.' }),
        msg(26, 'coord-1', 'Coordinator', { 'impl-1 reports the hello works against the stub. Moving to the real spoke.' }),
        { kind = 'ask', ask = 1, at = at(5), from = 'coord-1', role = 'Coordinator' },
        system(3, 'shared', { from = 'coord-1', role = 'Coordinator', artifact = 'A-7' }),
      } },
    { id = 't13', title = 'Codex adapter', item = 'T-13', status = 'open', unread = 0, created_by = 'coord-1',
      messages = {
        msg(7, 'coord-1', 'Coordinator', { 'impl-2 took T-13. First step: one codex app-server per session on a unix socket.' }),
        msg(4, 'impl-2', 'Implementer', { 'app-server spawns per session; thread/start works. Next: codex resume --remote for the attach.' }),
      } },
    { id = 't15', title = 'Role clause delivery', item = 'T-15', status = 'open', unread = 1, created_by = 'impl-2',
      messages = {
        msg(36, 'impl-2', 'Implementer', { 'Clause delivery implemented as a hub event; added a reconnect test. Ready for review.' }),
        msg(34, 'coord-1', 'Coordinator', { 'Review requested from rev-1. QA after review.' }),
        system(2, 'rev-1 claimed the review · state waiting for approval'),
      } },
    { id = 'flaky', title = 'Spoke reconnect: flaky test', status = 'waiting for human', unread = 2,
      created_by = 'coord-1',
      messages = {
        msg(30, 'coord-1', 'Coordinator', { 'Parking a flaky test here: spoke/reconnect.test.ts times out about 1 run in 20. Not blocking T-12 yet.' }),
        msg(18, 'coord-1', 'Coordinator', { 'Should I quarantine it now, or keep it in CI until impl-1 is through T-12?' }),
      } },
    { id = 't21', title = 'cland task CLI', item = 'T-21', status = 'closed', unread = 0, created_by = 'coord-1',
      messages = {
        msg(50, 'coord-1', 'Coordinator', { 'T-21 merged to dev as 4f2c9e1: review clear (r-0402), qa clear (q-0117).' }),
        you(48, 'coord-1', { 'Thanks, close it.' }, 'injected'),
        system(47, 'topic closed: T-21 closed'),
      } },
    { id = 't17', title = 'Roles config and defaults', item = 'T-17', status = 'closed', unread = 0,
      created_by = 'coord-1',
      messages = {
        msg(1405, 'coord-1', 'Coordinator', { 'T-17 merged to dev: review clear, qa clear.' }),
        system(1404, 'topic closed: T-17 closed'),
      } },
    { id = 't11', title = 'Spoke protocol extracted', item = 'T-11', status = 'closed', unread = 0,
      created_by = 'coord-1',
      messages = {
        msg(2875, 'coord-1', 'Coordinator', { 'T-11 merged to dev: the BCAS spoke runs unchanged against the new hub.' }),
        system(2874, 'topic closed: T-11 closed'),
      } },
  }

  -- Inbox notifications: journal events worth the human's eye (Inbox
  -- artboard). Oldest first; dismissable; never counted as "needs you".
  S.notes = {
    { id = 1, glyph = '+', hl = 'ClandBlue', text = 'T-25 added to the backlog · coord-1', at = at(231), target = { 'item', 'T-25' } },
    { id = 2, glyph = '↔', hl = 'ClandBlue', text = 'Coordinator handed over: coord-0 → coord-1', at = at(124), target = { 'topic', 'agents' } },
    { id = 3, glyph = '✗', hl = 'ClandRed', text = 'T-19 review not clear · rev-1 · 3 findings', at = at(61), target = { 'item', 'T-19' } },
    { id = 4, glyph = '!', hl = 'ClandRed', text = 'impl-3 died · T-19 unclaimed', at = at(54), target = { 'item', 'T-19' } },
    { id = 5, glyph = '✓', hl = 'ClandGreen', text = 'T-21 qa clear · qa-1 · run q-0117', at = at(46), target = { 'item', 'T-21' } },
    { id = 6, glyph = '○', hl = 'ClandDim', text = 'impl-1 idle 25 min', at = at(1), target = { 'session', 'impl-1' } },
  }
  S.next_note = 7

  -- The workbench layout (what is open), part of the state on purpose.
  S.ui = {
    items_open = true, filter = 'all', folds = { ['M-1'] = true },
    right = 'inbox', dock = false,
    view = { kind = 'thread', id = 'general' }, hist = {},
    board_scope = 'all', inbox_ask = nil, preset = nil,
  }
  return S
end

return M
