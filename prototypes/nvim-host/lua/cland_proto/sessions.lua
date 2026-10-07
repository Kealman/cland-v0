-- PROTOTYPE (ticket #15): the four fake sessions, built on the engine
-- prototype's terminal sessions (#11). A session's terminal is created the
-- first time a variant shows it: a jobstart(term=true) child that prints a
-- canned harness screen (bin/fake-harness) and then runs your $SHELL.
-- No real harness is ever started.
local api = vim.api
local state = require('cland_proto.state')
local M = { ns = api.nvim_create_namespace('cland_proto_sessions') }

M.ROLE = {
  Coordinator = { badge = 'C', hl = 'ClandBadgeC', fg = 'ClandRoleCoord' },
  Implementer = { badge = 'I', hl = 'ClandBadgeI', fg = 'ClandRoleImpl' },
  Reviewer = { badge = 'R', hl = 'ClandBadgeR', fg = 'ClandRoleReview' },
  QA = { badge = 'Q', hl = 'ClandBadgeQ', fg = 'ClandRoleQA' },
  Human = { badge = 'you', hl = 'ClandBadgeH', fg = 'ClandRoleHuman' },
  System = { badge = '·', hl = 'ClandBadgeS', fg = 'Comment' },
}

M.STATE = {
  idle = { icon = '○', hl = 'ClandIdle', short = 'idle' },
  busy = { icon = '◐', hl = 'ClandBusy', short = 'busy' },
  ['waiting for human'] = { icon = '●', hl = 'ClandWaitYou', short = 'needs you' },
  ['waiting for approval'] = { icon = '◆', hl = 'ClandWaitApproval', short = 'approval' },
  unknown = { icon = '?', hl = 'Comment', short = 'unknown' },
  stopped = { icon = '×', hl = 'ClandClosed', short = 'stopped' },
}

function M.list()
  return state.S.sessions
end

function M.get(name)
  return state.session(name)
end

function M.active()
  return state.session(state.S.active_session) or state.S.sessions[1]
end

function M.st(s)
  return M.STATE[s.state] or M.STATE.unknown
end

function M.label(s)
  return ('%s [%s]'):format(s.name, s.role)
end

-- Show session `name` in window `win`, starting its stand-in terminal once.
function M.show_in(win, name)
  local s = state.session(name)
  if not s then
    return
  end
  state.S.active_session = s.name
  if s.buf and api.nvim_buf_is_valid(s.buf) then
    api.nvim_win_set_buf(win, s.buf)
    return s.buf
  end
  local buf = api.nvim_create_buf(true, false)
  vim.b[buf].cland_role = 'session'
  vim.b[buf].cland_session = s.name
  api.nvim_win_set_buf(win, buf)
  local here = vim.env.CLAND_PROTO_DIR
  api.nvim_win_call(win, function()
    s.job = vim.fn.jobstart({ here .. '/bin/fake-harness', s.name, s.role, s.harness, s.model }, {
      term = true,
      env = { CLAND_PROTO_SESSION = s.name },
    })
  end)
  s.buf = buf
  s.pid = s.job > 0 and vim.fn.jobpid(s.job) or nil
  vim.wo[win].number = false
  vim.wo[win].signcolumn = 'no'
  return buf
end

function M.by_buf(buf)
  for _, s in ipairs(state.S.sessions) do
    if s.buf == buf then
      return s
    end
  end
end

-- "Pretend I approved it in the harness TUI" (approvals stay in the TUI in v0).
function M.approve(name)
  local s = state.session(name)
  if not s or s.state ~= 'waiting for approval' then
    vim.notify('cland-proto: ' .. tostring(name) .. ' is not waiting for approval', vim.log.levels.WARN)
    return
  end
  s.state, s.since = 'busy', state.now_min()
  state.changed(name .. ': approval given in the harness TUI (simulated)')
  vim.defer_fn(function()
    s.approval = nil
    if s.state == 'busy' then
      s.state, s.since = 'idle', state.now_min()
    end
    state.changed(name .. ' finished the approved command')
  end, 1500)
end

-- Sessions board (variant A): three or four lines per session.
function M.render_board(buf)
  local L, marks, info = {}, {}, {}
  local function add(text, inf)
    L[#L + 1] = text
    info[#L] = inf
    return #L - 1
  end
  for _, s in ipairs(state.S.sessions) do
    local role = M.ROLE[s.role]
    local st = M.st(s)
    local head = ' ' .. role.badge .. '  ' .. s.name .. ' · ' .. s.role
    local r = add(head, { session = s.name })
    marks[#marks + 1] = { r, 0, { end_col = #role.badge + 2, hl_group = role.hl } }
    marks[#marks + 1] = { r, #role.badge + 4, { end_col = #role.badge + 4 + #s.name, hl_group = role.fg } }
    if s.name == state.S.active_session then
      marks[#marks + 1] = { r, 0, { virt_text = { { '◂', 'ClandDim' } }, virt_text_pos = 'right_align' } }
    end
    local line2 = ('    %s %s %s · %s'):format(st.icon, s.state, state.ago(s.since), s.item or 'no item')
    r = add(line2, { session = s.name })
    marks[#marks + 1] = { r, 4, { end_col = 4 + #st.icon + 1 + #s.state, hl_group = st.hl } }
    local item_col = #line2 - #(s.item or 'no item')
    marks[#marks + 1] = { r, item_col, { end_col = #line2, hl_group = s.item and 'ClandItem' or 'ClandDim' } }
    r = add(('    %s · %s'):format(s.harness, s.model), { session = s.name })
    marks[#marks + 1] = { r, 4, { end_col = #L[r + 1], hl_group = 'ClandDim' } }
    if s.state == 'waiting for approval' and s.approval then
      r = add('    ▸ ' .. s.approval, { session = s.name })
      marks[#marks + 1] = { r, 4, { end_col = #L[r + 1], hl_group = 'ClandWaitApproval' } }
      add('      ⏎ open its terminal · y approved', { session = s.name })
      marks[#marks + 1] = { #L - 1, 0, { end_col = #L[#L], hl_group = 'ClandDim' } }
    end
    add('', nil)
  end
  add(' ⏎ open terminal · y approved', nil)
  marks[#marks + 1] = { #L - 1, 0, { end_col = #L[#L], hl_group = 'ClandDim' } }
  vim.bo[buf].modifiable = true
  api.nvim_buf_set_lines(buf, 0, -1, false, L)
  vim.bo[buf].modifiable = false
  api.nvim_buf_clear_namespace(buf, M.ns, 0, -1)
  for _, m in ipairs(marks) do
    pcall(api.nvim_buf_set_extmark, buf, M.ns, m[1], m[2], m[3])
  end
  return info
end

-- Statusline chunks: one compact cell per session.
function M.summary_chunks(opts)
  opts = opts or {}
  local out = {}
  for i, s in ipairs(state.S.sessions) do
    local role, st = M.ROLE[s.role], M.st(s)
    if i > 1 then
      out[#out + 1] = { opts.sep or ' ', 'ClandDimBar' }
    end
    out[#out + 1] = { ' ' .. role.badge .. ' ', role.hl }
    if opts.names ~= false then
      out[#out + 1] = { ' ' .. s.name, 'StatusLine' }
    end
    out[#out + 1] = { ' ' .. st.icon .. (opts.short and '' or (' ' .. st.short)), st.hl .. 'Bar' }
  end
  return out
end

function M.cycle(step)
  local list = state.S.sessions
  local idx = 1
  for i, s in ipairs(list) do
    if s.name == state.S.active_session then
      idx = i
    end
  end
  return list[(idx - 1 + step) % #list + 1].name
end

return M
