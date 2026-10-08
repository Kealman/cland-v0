-- A topic's thread buffer: the messages oldest first, each a header (sender, role, local time, and on the
-- human's own messages the delivery stage, right-aligned) and its text. Built from `topic.history` and
-- kept current by `message` and `delivery` events; a stage changes in place on its message's header.
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

--- Merge a history snapshot: new messages join in time order, known ones only advance.
function Thread:merge(messages)
  for _, m in ipairs(messages or {}) do
    local existing = self.by_id[m.id]
    if existing then
      advance(existing, m.stage)
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
  for _, m in ipairs(self.messages) do
    local mine = m.fromKind == 'human'
    local name = mine and 'you' or tostring(m.from)
    local header = ' ' .. name
    local hmarks = { { col = 1, opts = { end_col = 1 + #name, hl_group = 'ClandBold' } } }
    if m.fromRole then
      local s = #header + 2
      header = header .. '  ' .. m.fromRole
      table.insert(hmarks, { col = s, opts = { end_col = #header, hl_group = 'ClandTeal' } })
    end
    local s = #header + 2
    header = header .. '  ' .. M.clock(m.ts)
    table.insert(hmarks, { col = s, opts = { end_col = #header, hl_group = 'ClandDim' } })
    local stage = mine and m.stage and hl.STAGE[m.stage]
    if stage then
      table.insert(hmarks, { col = 0, opts = { virt_text = { { stage[1] .. ' ' .. stage[2] .. ' ', stage[3] } }, virt_text_pos = 'right_align' } })
    end
    add(header, hmarks)
    for _, l in ipairs(vim.split(tostring(m.text or ''), '\n', { plain = true })) do
      add(' ' .. l)
    end
    add('')
  end
  if self.notice then
    add(' ▲ ' .. self.notice.text, { { col = 0, opts = { end_col = 0, line_hl_group = self.notice.group } } })
  end

  vim.bo[buf].modifiable = true
  api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].modifiable = false
  api.nvim_buf_clear_namespace(buf, ns, 0, -1)
  for _, m in ipairs(marks) do
    pcall(api.nvim_buf_set_extmark, buf, ns, m.row, m.col, m.opts)
  end
  -- every window on the thread follows its tail (via the first line: set_cursor scrolls minimally)
  for _, win in ipairs(vim.fn.win_findbuf(buf)) do
    pcall(api.nvim_win_set_cursor, win, { 1, 0 })
    pcall(api.nvim_win_set_cursor, win, { #lines, 0 })
  end
end

return M
