-- A topic's thread buffer: the messages oldest first, each a header (sender, role, local time, and on the
-- human's own messages the delivery stage, right-aligned) and its text. Built from `topic.history` and
-- kept current by `message` and `delivery` events; a stage changes in place on its message's header. An ask (#33)
-- shows as a card (`ask_card.lua`): the question, the numbered options, and once answered the chosen option and
-- the answer message beneath it; `ask` events change the card in place.
local api = vim.api
local hl = require('cland.hl')

local M = {}
local ns = api.nvim_create_namespace('cland.thread')

local Thread = {}
Thread.__index = Thread

--- The local wall-clock time (HH:MM) of an ISO-8601 UTC timestamp.
function M.clock(ts)
  local y, mo, d, h, mi, s = tostring(ts or ''):match('^(%d+)-(%d+)-(%d+)T(%d+):(%d+):(%d+)')
  if not y then
    return '--:--'
  end
  local utc = { year = tonumber(y), month = tonumber(mo), day = tonumber(d), hour = tonumber(h), min = tonumber(mi), sec = tonumber(s), isdst = false }
  -- os.time reads the table as local time; shift by this machine's offset from UTC at that moment
  local as_local = os.time(utc)
  local offset = os.difftime(as_local, os.time(os.date('!*t', as_local)))
  return os.date('%H:%M', as_local + offset)
end

function M.new(topic)
  local buf = api.nvim_create_buf(false, true)
  vim.bo[buf].buftype = 'nofile'
  vim.bo[buf].bufhidden = 'hide'
  vim.bo[buf].swapfile = false
  vim.bo[buf].modifiable = false
  vim.bo[buf].filetype = 'cland-thread'
  pcall(api.nvim_buf_set_name, buf, 'cland://topic/' .. topic.id)
  vim.b[buf].cland_role = 'thread'
  vim.b[buf].cland_topic = topic.id
  local self = setmetatable({ topic = topic, buf = buf, messages = {}, by_id = {}, notice = nil }, Thread)
  self:render()
  return self
end

local function advance(existing, stage)
  if stage and (hl.STAGE_RANK[stage] or 0) >= (hl.STAGE_RANK[existing.stage] or 0) then
    existing.stage = stage
  end
end

--- Add one message (an event); a message already shown only advances its stage.
function Thread:add(message)
  local existing = self.by_id[message.id]
  if existing then
    advance(existing, message.stage)
  else
    local copy = vim.deepcopy(message)
    self.by_id[copy.id] = copy
    table.insert(self.messages, copy)
  end
  self:render()
end

--- Merge a history snapshot: new messages join in time order, known ones advance their stage and take the
--- hub's ask card (an ask answered, withdrawn or cancelled while the client was away is no longer open).
function Thread:merge(messages)
  for _, m in ipairs(messages or {}) do
    local existing = self.by_id[m.id]
    if existing then
      advance(existing, m.stage)
      if type(m.ask) == 'table' then
        existing.ask = vim.deepcopy(m.ask)
      end
    else
      local copy = vim.deepcopy(m)
      self.by_id[copy.id] = copy
      table.insert(self.messages, copy)
    end
  end
  -- ISO timestamps sort as text; equal ones keep their arrival order
  for i, m in ipairs(self.messages) do
    m._seq = i
  end
  table.sort(self.messages, function(a, b)
    if a.ts ~= b.ts then
      return tostring(a.ts) < tostring(b.ts)
    end
    return a._seq < b._seq
  end)
  self:render()
end

--- The hub's open asks (`inbox.list`), after a reconnect: a cached card still open that is not among them closed
--- while the client was away, and its message may be older than the history the reconnect read, so the merge
--- never brought its new state. It shows `closed` and takes no answer.
function Thread:reconcile_asks(open_ids)
  local changed = false
  for _, m in ipairs(self.messages) do
    if type(m.ask) == 'table' and m.ask.state == 'open' and not open_ids[m.id] then
      m.ask = vim.tbl_extend('force', m.ask, { state = 'closed' })
      changed = true
    end
  end
  if changed then
    self:render()
  end
end

--- An ask's card changed (an `ask` event): answered, withdrawn, cancelled.
function Thread:set_card(id, card)
  local m = self.by_id[id]
  if m and type(card) == 'table' then
    m.ask = card
    self:render()
  end
end

--- The open ask on row `row` of the buffer ({id, topic, question, options, free}), or nil.
function Thread:ask_at(row)
  return (self.card_rows or {})[row]
end

function Thread:set_stage(id, stage)
  local m = self.by_id[id]
  if m then
    advance(m, stage)
    self:render()
  end
end

--- One line under the messages about the hub connection or a failed send; nil clears it.
function Thread:set_notice(text, group)
  self.notice = text and { text = text:gsub('\n', ' '), group = group or 'ClandAmber' } or nil
  self:render()
end

function Thread:render()
  local buf = self.buf
  if not api.nvim_buf_is_valid(buf) then
    return
  end
  local lines, marks = {}, {}
  local function add(text, mark)
    table.insert(lines, text)
    if mark then
      for _, m in ipairs(mark) do
        m.row = #lines - 1
        table.insert(marks, m)
      end
    end
  end
  if #self.messages == 0 then
    add(' No messages in ' .. self.topic.title .. ' yet.', { { col = 0, opts = { end_col = 0, line_hl_group = 'ClandDim' } } })
    add('')
  end
  local card_rows, artifact_rows = {}, {}
  -- an answer shows under its ask's card, not in its place in time
  local answers = {}
  for _, m in ipairs(self.messages) do
    if m.answerTo and self.by_id[m.answerTo] and self.by_id[m.answerTo].ask then
      answers[m.answerTo] = m
    end
  end
  local function message(m)
    local mine = m.fromKind == 'human'
    local name = mine and 'you' or tostring(m.from)
    local header = ' ' .. name
    local hmarks = { { col = 1, opts = { end_col = 1 + #name, hl_group = 'ClandBold' } } }
    if m.fromRole and m.fromRole ~= vim.NIL and not mine then
      -- name [Role], as everywhere (spec 4.4): the role's label, never its key
      local role = require('cland.state').label(name, m.fromRole):sub(#name + 1)
      local s = #header
      header = header .. role
      table.insert(hmarks, { col = s, opts = { end_col = #header, hl_group = 'ClandTeal' } })
    end
    local s = #header + 2
    header = header .. '  ' .. M.clock(m.ts)
    table.insert(hmarks, { col = s, opts = { end_col = #header, hl_group = 'ClandDim' } })
    local stage = mine and m.stage and hl.STAGE[m.stage]
    if stage then
      table.insert(hmarks, { col = 0, opts = { virt_text = { { stage[1] .. ' ' .. stage[2] .. ' ', stage[3] } }, virt_text_pos = 'right_align' } })
    end
    local card = type(m.ask) == 'table' and m.ask or nil
    if card then
      local st = require('cland.ask_card').STATE[card.state] or { tostring(card.state), 'ClandDim' }
      table.insert(hmarks, { col = 0, opts = { virt_text = { { 'ask · ' .. st[1] .. ' ', st[2] } }, virt_text_pos = 'right_align' } })
    end
    add(header, hmarks)
    if card then
      local open = card.state == 'open'
      local ask = { id = m.id, topic = m.topic or self.topic.id, question = m.text, options = card.options or {}, free = card.free }
      for _, l in ipairs(require('cland.ask_card').lines(card, m.text)) do
        local marks = { { col = 1, opts = { end_col = 4, hl_group = l[4] } } }
        if l[2] then
          table.insert(marks, { col = 5, opts = { end_col = #l[1], hl_group = l[2] } })
        end
        add(l[1], marks)
        if open then
          card_rows[#lines] = ask
        end
      end
      add('')
      local answer = answers[m.id]
      if answer then
        message(answer)
      end
      return
    end
    if m.artifacts then
      for _, l in ipairs(vim.split(tostring(m.text or ''), '\n', { plain = true })) do add(' ' .. l) end
    end
    local attachments = m.artifacts or (m.artifact and { m.artifact } or {})
    for _, a in ipairs(attachments) do
      local chip = ' ▣ ' .. a.id .. ' ' .. a.kind .. ' · ' .. a.title
      add(chip, { { col = 1, opts = { end_col = #chip, hl_group = 'ClandBlue' } } })
      artifact_rows[#lines] = a
    end
    if #attachments > 0 then add(''); return end
    for _, l in ipairs(vim.split(tostring(m.text or ''), '\n', { plain = true })) do
      add(' ' .. l)
    end
    add('')
  end
  for _, m in ipairs(self.messages) do
    if not (m.answerTo and answers[m.answerTo] == m) then
      message(m)
    end
  end
  self.card_rows = card_rows
  self.artifact_rows = artifact_rows
  if self.notice then
    add(' ▲ ' .. self.notice.text, { { col = 0, opts = { end_col = 0, line_hl_group = self.notice.group } } })
  end

  -- a window whose cursor is away from the tail (reading, or on a reference for gi/gt/gs) keeps it
  local stay = {}
  local old_count = api.nvim_buf_line_count(buf)
  for _, win in ipairs(vim.fn.win_findbuf(buf)) do
    local row = api.nvim_win_get_cursor(win)[1]
    if win == api.nvim_get_current_win() and row < old_count then
      stay[win] = api.nvim_win_get_cursor(win)
    end
  end
  vim.bo[buf].modifiable = true
  api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].modifiable = false
  api.nvim_buf_clear_namespace(buf, ns, 0, -1)
  for _, m in ipairs(marks) do
    pcall(api.nvim_buf_set_extmark, buf, ns, m.row, m.col, m.opts)
  end
  -- the other windows on the thread follow its tail (via the first line: set_cursor scrolls minimally)
  for _, win in ipairs(vim.fn.win_findbuf(buf)) do
    if stay[win] then
      pcall(api.nvim_win_set_cursor, win, { math.min(stay[win][1], #lines), stay[win][2] })
    else
      pcall(api.nvim_win_set_cursor, win, { 1, 0 })
      pcall(api.nvim_win_set_cursor, win, { #lines, 0 })
    end
  end
end

return M
