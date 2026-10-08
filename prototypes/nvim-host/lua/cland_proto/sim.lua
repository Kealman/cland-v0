-- PROTOTYPE (ticket #15, workbench): simulated hub events, to watch where
-- the workbench tells you about each one (inbox, items badge, sessions
-- state, top bar count). :ClandSim reply|ask|approval|vacant|verdict|died,
-- or <Space>x for the next one in that order. Each kind cycles through a
-- few canned variants.
local api = vim.api
local state = require('cland_proto.state')
local sessions = require('cland_proto.sessions')
local M = { ORDER = { 'reply', 'ask', 'approval', 'vacant', 'verdict', 'died' }, n = {} }

local function chat()
  return require('cland_proto.chat')
end

local function post(tid, from, text)
  local t = state.topic(tid)
  local s = state.session(from)
  t.messages[#t.messages + 1] = { kind = 'text', from = from, role = s and s.role, at = state.now_min(), text = text }
  local v = state.S.ui.view
  if not (v.kind == 'thread' and v.id == tid) then
    t.unread = (t.unread or 0) + 1
  end
  return t
end

local function agents(name, text, extra)
  local t = state.topic('agents')
  local m = extra or { kind = 'event', event = name, text = text }
  m.at = state.now_min()
  t.messages[#t.messages + 1] = m
end

M.EVENTS = {}

-- An agent replies in a background topic: the weak signal (unread), and once
-- a reply in prose that waits for you (strong signal: inbox, top bar).
M.EVENTS.reply = function(i)
  if i % 2 == 1 then
    local t = post('t13', 'impl-2', { 'resume --remote attaches; the TUI keeps working while app-server streams the turn. Next: turn/steer for the inject.' })
    t.status = 'open'
    return 'impl-2 replied in T-13 (unread +1 in topics)'
  end
  local h = state.holder('Coordinator')
  if not h then
    return 'no coordinator to reply (:ClandSim vacant brings coord-1 back)'
  end
  local t = post('general', h.name, { 'Should I start T-22 next with impl-1, or keep impl-1 on T-12 until the spoke identity is decided?' })
  t.status = 'waiting for human'
  return h.name .. ' asked in prose in General: it waits for you (inbox "waiting for you", top bar +1)'
end

local ASKS = {
  { topic = 't13', item = 'T-13', raised_by = 'impl-2', short = 'Codex attach path',
    question = 'Codex attach for impl-2: resume --remote needs a first turn. Which way?',
    options = { 'send an empty first turn at spawn', 'attach only after the role clause turn', 'ask me later' } },
  { topic = 'qa-lane', item = nil, raised_by = 'qa-1', short = 'QA lane for the workbench', new_title = 'QA lane for the workbench',
    question = 'Which lane should qa-1 use for the workbench prototype?',
    options = { 'headless Neovim with nvim_input', 'tmux capture-pane', 'ttyd in Chrome' } },
}

-- The Coordinator asks: inbox asks, the item's ? badge, the topic waits for you.
M.EVENTS.ask = function(i)
  local h = state.holder('Coordinator')
  if not h then
    return 'only the Coordinator asks the human, and the role is vacant (:ClandSim vacant)'
  end
  local spec = ASKS[(i - 1) % #ASKS + 1]
  local tid = spec.topic .. (i > #ASKS and tostring(i) or '')
  local t = state.topic(tid)
  if not t then
    t = { id = tid, title = (spec.new_title or spec.short) .. (i > #ASKS and (' ' .. i) or ''), status = 'open', unread = 0,
      created_by = h.name, messages = {} }
    table.insert(state.S.topics, t)
  end
  local id = #state.S.asks + 1
  local a = { id = id, topic = t.id, item = spec.item, from = h.name, raised_by = spec.raised_by, at = state.now_min(),
    state = 'open', short = spec.short, question = spec.question, options = vim.deepcopy(spec.options), free = true }
  table.insert(state.S.asks, a)
  t.messages[#t.messages + 1] = { kind = 'ask', ask = id, at = a.at, from = h.name, role = 'Coordinator' }
  t.status = 'waiting for human'
  local v = state.S.ui.view
  if not (v.kind == 'thread' and v.id == t.id) then
    t.unread = (t.unread or 0) + 1
  end
  return ('%s asked in %s: "%s" (inbox asks, %s, top bar +1)'):format(h.name, t.item or ('new topic "' .. t.title .. '"'), a.short,
    spec.item and (spec.item .. ' gets the ? badge') or 'topics: needs you')
end

-- A session waits for approval in its own TUI: inbox approvals, sessions ▲,
-- the claim in the items panel gets ▲, the top bar counts it.
M.EVENTS.approval = function(i)
  local cands = { { 'impl-2', 'npm run build -- --filter codex' }, { 'impl-1', 'rm -rf .cland/worktrees/T-12/node_modules' },
    { 'qa-1', 'npx playwright test --project=ttyd' } }
  for k = 0, #cands - 1 do
    local c = cands[(i - 1 + k) % #cands + 1]
    local s = state.session(c[1])
    if s and state.live(s) and s.state ~= 'waiting for approval' then
      s.state, s.since, s.approval, s.restart = 'waiting for approval', state.now_min(), c[2], true
      if not s.item and c[1] == 'qa-1' then
        s.item = 'T-15'
      end
      return ('%s waits for approval to run `%s` (inbox approvals, sessions ▲, %s, top bar +1)'):format(s.name, c[2],
        s.item and (s.item .. ' shows ' .. s.name .. ' ▲') or 'no item')
    end
  end
  return 'every candidate session is already waiting or down'
end

-- The Coordinator session stops (role vacant), or comes back.
M.EVENTS.vacant = function()
  local s = state.session('coord-1')
  if state.live(s) then
    sessions.kill('coord-1', 'stopped')
    return 'coord-1 stopped: no coordinator (top bar warning, inbox notification, messages to the role stay queued)'
  end
  sessions.revive('coord-1')
  return 'coord-1 is back: the queued messages go out now'
end

-- A verdict lands: review on the item in review, then QA on the item in qa.
M.EVENTS.verdict = function()
  local function first(status)
    for _, id in ipairs(state.S.item_order) do
      local it = state.S.items[id]
      if it.kind == 'task' and it.status == status then
        return it
      end
    end
  end
  local it = first('review')
  if it then
    local run = 'r-04' .. (12 + #it.verdicts)
    for k = #it.verdicts, 1, -1 do
      if it.verdicts[k].result == 'in progress' then
        table.remove(it.verdicts, k)
      end
    end
    table.insert(it.verdicts, { kind = 'review', result = 'clear', by = 'rev-1', role = 'Reviewer', run = run, at = state.now_min(),
      note = 'clause arrives on assignment and on reconnect; journal shows both deliveries' })
    local s = it.claim and state.session(it.claim)
    if s and s.state == 'waiting for approval' then
      s.state, s.approval = 'idle', nil
    end
    if s then
      s.state, s.since, s.item = 'idle', state.now_min(), nil
    end
    it.status, it.claim = 'qa', nil
    table.insert(it.comments, { by = 'rev-1', role = 'Reviewer', at = state.now_min(), text = 'verdict: review clear (' .. run .. ')' })
    agents(nil, nil, { kind = 'text', from = 'rev-1', role = 'Reviewer', to = 'coord-1', to_role = 'Coordinator', via = it.id,
      stage = 'injected', text = { 'verdict: review clear on ' .. it.id .. ', run ' .. run .. '.' } })
    sessions.note('✓', 'ClandGreen', it.id .. ' review clear · rev-1 · run ' .. run, { 'item', it.id })
    return it.id .. ' review clear: it moves to qa (board, items ◉, inbox notification, item verdicts)'
  end
  it = first('qa')
  if it then
    local run = 'q-01' .. (20 + #it.verdicts)
    table.insert(it.verdicts, { kind = 'qa', result = 'not clear', by = 'qa-1', role = 'QA', run = run, at = state.now_min(),
      note = '2 findings: the clause is delivered twice after a hub restart; no journal line for the second delivery' })
    it.status = 'progress'
    table.insert(it.comments, { by = 'qa-1', role = 'QA', at = state.now_min(), text = 'verdict: qa not clear (' .. run .. '), 2 findings' })
    agents(nil, nil, { kind = 'text', from = 'qa-1', role = 'QA', to = 'coord-1', to_role = 'Coordinator', via = it.id,
      stage = 'injected', text = { 'verdict: qa not clear on ' .. it.id .. ', run ' .. run .. ', 2 findings.' } })
    sessions.note('✗', 'ClandRed', it.id .. ' qa not clear · qa-1 · 2 findings', { 'item', it.id })
    return it.id .. ' qa not clear: back to in progress, unclaimed (board, items, inbox notification in red)'
  end
  return 'no task waits for a verdict (nothing in review or qa)'
end

-- A session dies: claim released (items: unclaimed), sessions ✗, inbox
-- notification, top bar sessions count.
M.EVENTS.died = function()
  for _, name in ipairs({ 'impl-2', 'qa-1', 'impl-1', 'rev-1', 'coord-1' }) do
    local s = state.session(name)
    if state.live(s) then
      local _, released = sessions.kill(name, 'died')
      return ('%s died%s (sessions ✗, inbox notification, top bar sessions)'):format(name,
        #released > 0 and (': ' .. table.concat(released, ', ') .. ' unclaimed in the items panel') or '')
    end
  end
  local s = state.S.sessions[1]
  for _, x in ipairs(state.S.sessions) do
    sessions.revive(x.name)
  end
  return 'everyone was down: all sessions started again (' .. s.name .. ' first)'
end

function M.fire(name)
  if not name or name == '' then
    M.i = (M.i or 0) % #M.ORDER + 1
    name = M.ORDER[M.i]
  end
  local fn = M.EVENTS[name]
  if not fn then
    vim.notify('cland-proto: :ClandSim ' .. table.concat(M.ORDER, '|'), vim.log.levels.ERROR)
    return
  end
  M.n[name] = (M.n[name] or 0) + 1
  local what = fn(M.n[name])
  state.changed('sim ' .. name .. ': ' .. what)
  state.say('simulated ' .. name .. ': ' .. what, 'ClandAmber')
end

return M
