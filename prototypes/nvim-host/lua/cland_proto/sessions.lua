-- PROTOTYPE (ticket #15, workbench): the fake sessions, built on the engine
-- prototype's terminal sessions (#11). Attaching is simulated: the centre
-- shows a terminal running bin/fake-harness, which prints the attach command
-- and a canned harness screen, then hands over to $SHELL. A session that
-- waits for approval asks [y]/[a]/[n] there, as the real TUI would; the
-- answer comes back to the workbench as an OSC 777 sequence (TermRequest),
-- the way an adapter would report the state change. No harness ever runs.
local api = vim.api
local state = require('cland_proto.state')
local hl = require('cland_proto.hl')
local M = {}

function M.st(s)
  return hl.SESSION[s.state] or hl.SESSION.unknown
end

function M.label(s)
  return ('%s [%s]'):format(s.name, s.role)
end

-- "Claude Code · fable · busy · 2h 10m" (Session artboard).
function M.meta(s)
  local parts = { s.harness, s.model }
  if s.state == 'idle' then
    parts[#parts + 1] = 'idle ' .. state.ago(s.since)
  elseif s.state == 'died' or s.state == 'stopped' then
    parts[#parts + 1] = s.state .. ' ' .. state.fmt(s.since)
  else
    parts[#parts + 1] = s.state
  end
  if s.state == 'busy' then
    parts[#parts + 1] = s.cost or (s.up and state.ago(s.up)) or nil
  end
  return table.concat(parts, ' · ')
end

function M.by_buf(buf)
  for _, s in ipairs(state.S.sessions) do
    if s.buf == buf then
      return s
    end
  end
end

-- Show session `name` in window `win`; the stand-in terminal starts once
-- (again after the session died, stopped or got a new approval prompt).
function M.show_in(win, name)
  local s = state.session(name)
  if not s then
    return
  end
  if not state.live(s) then
    -- nothing to attach: the old terminal (process exited) or a note
    if not (s.buf and api.nvim_buf_is_valid(s.buf)) then
      s.buf = api.nvim_create_buf(false, true)
      vim.b[s.buf].cland_role = 'session'
      vim.b[s.buf].cland_session = s.name
      api.nvim_buf_set_lines(s.buf, 0, -1, false, {
        '', ('  %s %s at %s: there is no live session to attach.'):format(s.name, s.state, state.fmt(s.since)),
        '  x on it in the sessions panel (␣s) starts it again.' })
      vim.bo[s.buf].modifiable = false
    end
    api.nvim_win_set_buf(win, s.buf)
    return s.buf
  end
  if s.buf and api.nvim_buf_is_valid(s.buf) and not s.restart then
    api.nvim_win_set_buf(win, s.buf)
    return s.buf
  end
  local old = s.buf
  local buf = api.nvim_create_buf(true, false)
  vim.b[buf].cland_role = 'session'
  vim.b[buf].cland_session = s.name
  api.nvim_win_set_buf(win, buf)
  local here = vim.env.CLAND_PROTO_DIR
  api.nvim_win_call(win, function()
    s.job = vim.fn.jobstart({ here .. '/bin/fake-harness', s.name, s.role, s.harness, s.model, s.attach or '' }, {
      term = true,
      env = {
        CLAND_PROTO_SESSION = s.name,
        CLAND_PROTO_STATE = s.state,
        CLAND_PROTO_ITEM = s.item or '',
        CLAND_PROTO_APPROVAL = s.state == 'waiting for approval' and (s.approval or '') or '',
      },
    })
  end)
  s.buf, s.restart = buf, nil
  vim.wo[win].number = false
  vim.wo[win].signcolumn = 'no'
  if old and old ~= buf and api.nvim_buf_is_valid(old) then
    pcall(api.nvim_buf_delete, old, { force = true })
  end
  return buf
end

local function release_claims(name)
  local released = {}
  for _, id in ipairs(state.S.item_order) do
    local it = state.S.items[id]
    if it.claim == name then
      it.claim, it.lost_claim = nil, name
      released[#released + 1] = id
    end
  end
  return released
end

local function agents_event(name, text)
  local t = state.topic('agents')
  t.messages[#t.messages + 1] = { kind = 'event', at = state.now_min(), event = name, text = text }
end

function M.note(glyph, group, text, target)
  local S = state.S
  S.notes[#S.notes + 1] = { id = S.next_note, glyph = glyph, hl = group, text = text, at = state.now_min(), target = target }
  S.next_note = S.next_note + 1
end

-- The session dies or stops: its claims are released, a Coordinator leaves
-- the role vacant (#10: no auto-reassignment).
function M.kill(name, how)
  local s = state.session(name)
  if not s or not state.live(s) then
    return nil
  end
  how = how or 'died'
  s.state, s.since, s.approval = how, state.now_min(), nil
  if s.job and s.job > 0 then
    pcall(vim.fn.jobstop, s.job)
  end
  s.restart = true
  local released = release_claims(name)
  local what = #released > 0 and (table.concat(released, ', ') .. ' unclaimed') or 'no claim'
  agents_event(how == 'died' and 'session died' or 'session stop',
    ('%s · %s (%s)%s'):format(s.name, s.harness, s.role, #released > 0 and ('; claim on ' .. table.concat(released, ', ') .. ' released') or ''))
  if s.role == 'Coordinator' then
    M.note('!', 'ClandRed', ('%s %s · no coordinator: messages to the role stay queued'):format(s.name, how), { 'session', s.name })
  else
    M.note(how == 'died' and '!' or '×', 'ClandRed', ('%s %s · %s'):format(s.name, how, what),
      #released > 0 and { 'item', released[1] } or { 'session', s.name })
  end
  return s, released
end

-- The session comes back under its name: role and clause return (#10).
function M.revive(name)
  local s = state.session(name)
  if not s or state.live(s) then
    return nil
  end
  s.state, s.since, s.up, s.restart = 'idle', state.now_min(), state.now_min(), true
  agents_event('session start', ('%s · %s · %s (role %s restored, clause delivered)'):format(s.name, s.harness, s.model, s.role))
  if s.role == 'Coordinator' then
    M.note('↔', 'ClandBlue', s.name .. ' is back: the Coordinator role is held again', { 'session', s.name })
    -- store-and-forward: what the hub held for the Coordinator goes out now
    local chat = require('cland_proto.chat')
    for _, t in ipairs(state.S.topics) do
      for _, m in ipairs(t.messages) do
        if m.from == 'you' and m.stage == 'queued' then
          m.to = s.name
          chat.deliver(t, m)
        end
      end
    end
  end
  return s
end

-- An approval answered in the harness TUI (the fake-harness reports it).
function M.decide(name, decision)
  local s = state.session(name)
  if not s or s.state ~= 'waiting for approval' then
    return
  end
  local cmd = s.approval or 'the command'
  s.state, s.since, s.approval = 'busy', state.now_min(), nil
  state.changed(('%s: approval %s in its TUI (%s)'):format(name, decision == 'deny' and 'denied' or 'given', cmd))
  vim.defer_fn(function()
    if s.state == 'busy' then
      s.state, s.since = 'idle', state.now_min()
      state.changed(name .. ' finished and is idle')
    end
  end, decision == 'deny' and 1500 or 4000)
end

function M.on_term_request(ev)
  local seq = type(ev.data) == 'table' and ev.data.sequence or ev.data
  if type(seq) ~= 'string' then
    return
  end
  local what = seq:match('^\27%]777;cland;(.*)$')
  if not what then
    return
  end
  local s = M.by_buf(ev.buf)
  local decision = what:match('approval=(%a+)')
  if s and decision then
    vim.schedule(function()
      M.decide(s.name, decision)
    end)
  end
end

return M
