-- Topic message blocks (T-132), ported from the accepted T-97 prototype.
-- Body parsing, visibility/folds and new ask/chip presentation are later slices.
local api = vim.api
local hl = require('cland.hl')
local fit = require('cland.bars').fit

local M = { by_buf = {} }
local ns = api.nvim_create_namespace('cland.thread')
-- breakat is global in Neovim; linebreak below is local to thread windows.
vim.o.breakat = ' '

--- Keep exactly the latest LIMIT messages, evicting only expired blocks.
M.LIMIT = 200
M.GUTTER = '▎'
M.GUTTER_CURSOR = '▌'
--- More addressees than this show as `+n`.
local TO_MAX = 3

local Thread = {}
Thread.__index = Thread

-- Time ------------------------------------------------------------------------------------------------------

--- Seconds since the epoch of an ISO-8601 UTC timestamp, or nil.
function M.epoch(ts)
  local y, mo, d, h, mi, s = tostring(ts or ''):match('^(%d+)-(%d+)-(%d+)T(%d+):(%d+):(%d+)')
  if not y then
    return nil
  end
  local utc = { year = tonumber(y), month = tonumber(mo), day = tonumber(d), hour = tonumber(h), min = tonumber(mi), sec = tonumber(s), isdst = false }
  -- os.time reads the table as local time; shift by this machine's offset from UTC at that moment
  local as_local = os.time(utc)
  return as_local + os.difftime(as_local, os.time(os.date('!*t', as_local)))
end

--- The local wall-clock time (HH:MM) of an ISO-8601 UTC timestamp.
function M.clock(ts)
  local e = M.epoch(ts)
  return e and os.date('%H:%M', e) or '--:--'
end

--- The local day of a timestamp: a key and a label (`Thu 9 Oct`, with the year when it is not this one).
function M.day(ts)
  local e = M.epoch(ts)
  if not e then
    return '?', 'unknown day'
  end
  local label = os.date('%a ', e) .. tonumber(os.date('%d', e)) .. os.date(' %b', e)
  if os.date('%Y', e) ~= os.date('%Y') then
    label = label .. os.date(' %Y', e)
  end
  return os.date('%Y-%m-%d', e), label
end

local function addressees(m)
  return type(m.to) == 'table' and m.to or {}
end
local function shown_name(n)
  return n == 'human' and 'you' or tostring(n)
end

local function role_group(m)
  return hl.role_group(m.fromKind, m.fromRole ~= vim.NIL and m.fromRole or nil)
end

-- The buffer ------------------------------------------------------------------------------------------------

function M.new(topic)
  local buf = api.nvim_create_buf(false, true)
  vim.bo[buf].buftype = 'nofile'
  vim.bo[buf].bufhidden = 'hide'
  vim.bo[buf].swapfile = false
  vim.bo[buf].modifiable = false
  vim.bo[buf].filetype = 'cland-thread'
  -- wrapped rows of a list item line up under its text ('breakindentopt' list:-1)
  vim.bo[buf].formatlistpat = [[^\s*\%(\d\+[.)]\|[-*+]\)\s\+]]
  pcall(api.nvim_buf_set_name, buf, 'cland://topic/' .. topic.id)
  vim.b[buf].cland_role = 'thread'
  vim.b[buf].cland_topic = topic.id
  local self = setmetatable({
    topic = topic,
    buf = buf,
    messages = {},
    by_id = {},
    notice = nil,
    blocks = {},
    block_of = {},
    info = {},
    mark_ids = {},
    cursor_block = {},
    at_tail = {},
  }, Thread)
  M.by_buf[buf] = self
  api.nvim_create_autocmd('CursorMoved', {
    buffer = buf,
    callback = function()
      self:_cursor_moved(api.nvim_get_current_win())
    end,
  })
  api.nvim_create_autocmd('BufWipeout', {
    buffer = buf,
    callback = function()
      M.by_buf[buf] = nil
    end,
  })
  self:render()
  return self
end

local function advance(existing, stage)
  if stage and (hl.STAGE_RANK[stage] or 0) >= (hl.STAGE_RANK[existing.stage] or 0) then
    existing.stage = stage
  end
end

--- The answers shown under their ask's card: ask id → the answer message.
function Thread:_answers()
  local answers = {}
  for _, m in ipairs(self.messages) do
    if m.answerTo and self.by_id[m.answerTo] and type(self.by_id[m.answerTo].ask) == 'table' then
      answers[m.answerTo] = m
    end
  end
  return answers
end

--- The body seam: raw text today; per-message Markdown belongs here in T-133.
function Thread:body(m)
  return vim.split(tostring(m.text or ''), '\n', { plain = true })
end

-- Compatibility with the current ask/chip actions; their rendering is replaced in T-135.
function Thread:_row_targets()
  self.card_rows, self.artifact_rows = {}, {}
  for row, i in ipairs(self.info) do
    self.card_rows[row], self.artifact_rows[row] = i.ask, i.artifact
  end
end

function Thread:_width()
  local cells = vim.o.columns - 2
  for _, win in ipairs(vim.fn.win_findbuf(self.buf)) do
    cells = math.min(cells, api.nvim_win_get_width(win) - 2)
  end
  return math.max(0, cells)
end

function Thread:_stage(m)
  local s = m.fromKind == 'human' and m.stage and hl.STAGE[m.stage]
  return s and fit({ { s[1] .. ' ' .. s[2] .. ' ', s[3] } }, self:_width()) or nil
end

--- A rule belongs to the first block on a day, based only on its immediate predecessor.
function Thread:_day_mark(b, prev)
  if prev and prev.day == b.day then return nil end
  return {
    row = 0,
    col = 0,
    opts = {
      virt_lines = { fit({ { '── ', 'ClandFaint' }, { b.day_label, 'ClandDim' }, { ' ' .. ('─'):rep(vim.o.columns), 'ClandFaint' } }, vim.o.columns - 2) },
      virt_lines_above = false,
    },
  }
end

--- Changing a predecessor can add or remove the successor's rule. Only its separator marks change.
function Thread:_refresh_day(idx)
  local b = self.blocks[idx]
  if not b then return end
  api.nvim_buf_clear_namespace(self.buf, ns, b.start, b.start + 1)
  local mark = self:_day_mark(b, self.blocks[idx - 1])
  if mark then self:_marks(b.start, { mark }) end
end

--- Build one block: its lines, its marks (rows relative to the block) and one info entry per line (the gutter
--- colour, an open ask on a card row, an artifact on a chip row, the message whose header it is). `prev` is the
--- block above.
function Thread:_build(m, prev, answer)
  local b = { m = m, msgs = { m }, lines = {}, marks = {}, info = {}, heads = {} }
  b.day, b.day_label = M.day(m.ts)
  local function add(text, info, marks)
    b.lines[#b.lines + 1] = text
    info.b = b
    b.info[#b.info + 1] = info
    for _, mk in ipairs(marks or {}) do
      mk.row = #b.lines - 1
      b.marks[#b.marks + 1] = mk
    end
  end

  -- The separator row stays outside the message's gutter and band.
  local day_mark = self:_day_mark(b, prev)
  local blank = day_mark and { day_mark } or {}
  add('', {}, blank)

  local function message(mm)
    local mine = mm.fromKind == 'human'
    local group = role_group(mm)
    local band = mine and { col = 0, opts = { line_hl_group = 'ClandMine', priority = 50 } } or nil
    local function banded(marks)
      marks = marks or {}
      if band then
        marks[#marks + 1] = { col = 0, opts = vim.deepcopy(band.opts) }
      end
      return marks
    end
    -- the header: name [Role] → addressees  HH:MM
    local text, hmarks = '', {}
    local function put(s, g, extra)
      local c = #text
      text = text .. s
      if g then
        local opts = { end_col = #text, hl_group = g, priority = 120 }
        hmarks[#hmarks + 1] = { col = c, opts = vim.tbl_extend('force', opts, extra or {}) }
      end
    end
    local name = mine and 'you' or tostring(mm.from)
    put(name, 'ClandBold')
    if not mine and mm.fromRole and mm.fromRole ~= vim.NIL then
      -- name [Role], as everywhere (spec 4.4): the role's label, never its key
      put(require('cland.state').label(name, mm.fromRole):sub(#name + 1), group)
    end
    local to = addressees(mm)
    if #to > 0 then
      local shown = {}
      for k, n in ipairs(to) do
        if k > TO_MAX then
          shown[#shown + 1] = '+' .. (#to - TO_MAX)
          break
        end
        shown[#shown + 1] = shown_name(n)
      end
      put(' → ' .. table.concat(shown, ', '), 'ClandDim')
    elseif mm.fromKind == 'agent' and not (type(mm.artifact) == 'table' and type(mm.artifacts) ~= 'table') then
      put(' → you', 'ClandDim')
    end
    put('  ' .. M.clock(mm.ts), 'ClandDim')
    local stage = self:_stage(mm)
    if stage then
      hmarks[#hmarks + 1] = {
        col = 0,
        key = 'stage:' .. mm.id,
        opts = { virt_text = stage, virt_text_pos = 'eol_right_align', hl_mode = 'combine', priority = 130 },
      }
    end
    local card = type(mm.ask) == 'table' and mm.ask or nil
    if card then
      local st = require('cland.ask_card').STATE[card.state] or { tostring(card.state), 'ClandDim' }
      hmarks[#hmarks + 1] = { col = 0, opts = { virt_text = { { 'ask · ' .. st[1] .. ' ', st[2] } }, virt_text_pos = 'eol_right_align', hl_mode = 'combine', priority = 130 } }
    end
    b.heads[mm.id] = #b.lines
    add(text, { group = group, head = mm }, banded(hmarks))

    if card then
      -- the ask's card, as today (#33): the question, the numbered options, the state; the answer beneath
      local open = card.state == 'open'
      local ask = { id = mm.id, topic = mm.topic or self.topic.id, question = mm.text, options = card.options or {}, free = card.free }
      for _, l in ipairs(require('cland.ask_card').lines(card, mm.text)) do
        local marks = { { col = 1, opts = { end_col = 4, hl_group = l[4], priority = 120 } } }
        if l[2] then
          marks[#marks + 1] = { col = 5, opts = { end_col = #l[1], hl_group = l[2], priority = 120 } }
        end
        add(l[1], { group = group, ask = open and ask or nil }, marks)
      end
      if answer then
        b.msgs[#b.msgs + 1] = answer
        add('', {})
        message(answer)
      end
      return
    end

    local attachments = mm.artifacts or (type(mm.artifact) == 'table' and { mm.artifact } or {})
    -- a bare artifact post's text is its chip: the chip alone, as today
    local show_text = not (type(mm.artifact) == 'table' and type(mm.artifacts) ~= 'table')
    if show_text then
      local lines = self:body(mm)
      if #lines == 1 and lines[1] == '' then
        lines = {}
      end
      for _, l in ipairs(lines) do
        add(l, { group = group }, banded())
      end
    end
    for _, a in ipairs(attachments) do
      local chip = '▣ ' .. tostring(a.id) .. ' ' .. tostring(a.kind) .. ' · ' .. tostring(a.title)
      add(chip, { group = group, artifact = a }, banded({ { col = 0, opts = { end_col = #chip, hl_group = 'ClandBlue', priority = 120 } } }))
    end
  end
  message(m)
  b.n = #b.lines
  return b
end

--- The notice under the messages: one line about the hub connection or a failed send.
function Thread:_notice_line()
  local text = ' ▲ ' .. self.notice.text
  return text, { { row = 0, col = 0, opts = { end_col = 0, line_hl_group = self.notice.group } } }
end

--- Place `marks` (rows, and the `end_row` of a span, relative to `base`), keeping the ids of keyed marks (a stage)
--- to change them in place.
function Thread:_marks(base, marks)
  for _, mk in ipairs(marks) do
    local opts = mk.opts
    if opts.end_row then
      opts = vim.tbl_extend('force', opts, { end_row = base + opts.end_row })
    end
    local ok, id = pcall(api.nvim_buf_set_extmark, self.buf, ns, base + mk.row, mk.col, opts)
    if ok and mk.key then
      self.mark_ids[mk.key] = id
    end
  end
end

local function write(buf, from, to, lines)
  vim.bo[buf].modifiable = true
  api.nvim_buf_set_lines(buf, from, to, false, lines)
  vim.bo[buf].modifiable = false
end

-- Windows: the tail and the reading position ------------------------------------------------------------------------------

local function to_tail(win, buf)
  local last = api.nvim_buf_line_count(buf)
  local mode = api.nvim_get_mode().mode
  pcall(api.nvim_win_set_cursor, win, { last, 0 })
  -- win_call restores the current window and its mode. `zb` also counts the
  -- last line's wrapped rows, unlike a cursor jump, which can clip the tail.
  pcall(api.nvim_win_call, win, function() vim.cmd('normal! zb') end)
  -- ModeChanged can redraw the status bar during :normal's temporary Normal
  -- mode. Redraw after the saved mode resumes; never force the user into Insert.
  if mode ~= 'n' then vim.schedule(require('cland.bars').redraw) end
end

--- The windows on the thread and how each should move: a window whose cursor is away from the tail (reading, or
--- on a reference for gi/gt/gs) keeps it; the other windows follow the tail.
function Thread:_windows()
  local out = {}
  local count = api.nvim_buf_line_count(self.buf)
  for _, win in ipairs(vim.fn.win_findbuf(self.buf)) do
    local cur = api.nvim_win_get_cursor(win)
    local stay = win == api.nvim_get_current_win() and cur[1] < count
    local w = { win = win, tail = not stay }
    local i = self.info[cur[1]]
    if stay and i and i.b then
      w.anchor = { id = i.b.m.id, off = cur[1] - 1 - i.b.start, col = cur[2], row = cur[1] }
    end
    out[#out + 1] = w
  end
  return out
end

function Thread:_settle(wins)
  for _, w in ipairs(wins) do
    if api.nvim_win_is_valid(w.win) and api.nvim_win_get_buf(w.win) == self.buf then
      if w.tail then
        to_tail(w.win, self.buf)
        self.at_tail[w.win] = true
      elseif w.anchor then
        local b = self.block_of[w.anchor.id]
        local row = b and (b.start + 1 + math.min(w.anchor.off, b.n - 1)) or math.min(w.anchor.row, api.nvim_buf_line_count(self.buf))
        pcall(api.nvim_win_set_cursor, w.win, { row, w.anchor.col })
      end
      self:_cursor_moved(w.win)
    end
  end
end

--- The message under the cursor changed: its gutter bar gets heavier (the cursor line itself is not highlighted:
--- the human's band would hide a 'cursorline' background).
function Thread:_cursor_moved(win)
  if not api.nvim_win_is_valid(win) or api.nvim_win_get_buf(win) ~= self.buf then
    return
  end
  local row = api.nvim_win_get_cursor(win)[1]
  local i = self.info[row]
  local b = i and i.b or nil
  self.at_tail[win] = row == api.nvim_buf_line_count(self.buf)
  if self.cursor_block[win] ~= b then
    self.cursor_block[win] = b
    pcall(api.nvim__redraw, { win = win, statuscolumn = true })
  end
end

-- Rendering -------------------------------------------------------------------------------------------------

--- Rewrite the whole buffer: the first load, and a merge that brings a message older than the latest. Each window
--- keeps its place by message, rather than buffer row.
function Thread:render()
  local buf = self.buf
  if not api.nvim_buf_is_valid(buf) then
    return
  end
  local wins = self:_windows()
  local lines, marks, info = {}, {}, {}
  self.blocks, self.block_of, self.mark_ids = {}, {}, {}
  local answers = self:_answers()
  local prev
  for _, m in ipairs(self.messages) do
    if not (m.answerTo and answers[m.answerTo] == m) then
      local b = self:_build(m, prev, answers[m.id])
      b.start = #lines
      for k, l in ipairs(b.lines) do
        lines[#lines + 1] = l
        info[#info + 1] = b.info[k]
      end
      self.blocks[#self.blocks + 1] = b
      for _, mm in ipairs(b.msgs) do
        self.block_of[mm.id] = b
      end
      prev = b
    end
  end
  if #self.blocks == 0 then
    lines = { ' No messages in ' .. self.topic.title .. ' yet.', '' }
    info = { {}, {} }
    marks = { { row = 0, col = 0, opts = { end_col = 0, line_hl_group = 'ClandDim' } } }
  end
  if self.notice then
    local text, nmarks = self:_notice_line()
    lines[#lines + 1] = text
    info[#info + 1] = { notice = true }
    for _, mk in ipairs(nmarks) do
      marks[#marks + 1] = { row = #lines - 1, col = mk.col, opts = mk.opts }
    end
  end
  self.info = info
  write(buf, 0, -1, lines)
  api.nvim_buf_clear_namespace(buf, ns, 0, -1)
  for _, b in ipairs(self.blocks) do
    self:_marks(b.start, b.marks)
  end
  self:_marks(0, marks)
  self:_row_targets()
  self:_settle(wins)
  self:_trim()
end

--- The row where the next block goes: after the last block, before the notice.
function Thread:_end_row()
  local last = self.blocks[#self.blocks]
  return last and (last.start + last.n) or 0
end

--- Append one message at the end: its lines and marks only.
function Thread:_append(m)
  if #self.blocks == 0 then
    return self:render()
  end
  local wins = self:_windows()
  local prev = self.blocks[#self.blocks]
  local b = self:_build(m, prev, nil)
  b.start = self:_end_row()
  for k, i in ipairs(b.info) do
    table.insert(self.info, b.start + k, i)
  end
  write(self.buf, b.start, b.start, b.lines)
  self:_marks(b.start, b.marks)
  self.blocks[#self.blocks + 1] = b
  self.block_of[m.id] = b
  self:_row_targets()
  self:_settle(wins)
end

--- Replace one block in place (an ask's card changed, its answer arrived): its lines and marks only.
function Thread:_replace(old)
  local idx
  for k, b in ipairs(self.blocks) do
    if b == old then
      idx = k
      break
    end
  end
  if not idx then
    return self:render()
  end
  local wins = self:_windows()
  local prev = self.blocks[idx - 1]
  local answers = self:_answers()
  local b = self:_build(old.m, prev, answers[old.m.id])
  b.start = old.start
  local info = {}
  for k = 1, old.start do
    info[k] = self.info[k]
  end
  for _, i in ipairs(b.info) do
    info[#info + 1] = i
  end
  for k = old.start + old.n + 1, #self.info do
    info[#info + 1] = self.info[k]
  end
  self.info = info
  api.nvim_buf_clear_namespace(self.buf, ns, old.start, old.start + old.n)
  write(self.buf, old.start, old.start + old.n, b.lines)
  self:_marks(b.start, b.marks)
  self.blocks[idx] = b
  for _, mm in ipairs(old.msgs) do
    if self.block_of[mm.id] == old then
      self.block_of[mm.id] = nil
    end
  end
  for _, mm in ipairs(b.msgs) do
    self.block_of[mm.id] = b
  end
  local delta = b.n - old.n
  for k = idx + 1, #self.blocks do
    self.blocks[k].start = self.blocks[k].start + delta
  end
  for win, cb in pairs(self.cursor_block) do
    if cb == old then
      self.cursor_block[win] = b
    end
  end
  self:_row_targets()
  self:_settle(wins)
end

--- Discard expired messages without rewriting retained text. The uncommon ask/answer boundary
--- uses the same block replacement seam as a card update, then places a surviving answer in time order.
function Thread:_trim()
  local drop = #self.messages - M.LIMIT
  if drop <= 0 then return end
  local wins = self:_windows()
  local gone, messages = {}, {}
  for k, m in ipairs(self.messages) do
    if k <= drop then
      gone[m.id] = true
      self.by_id[m.id], self.mark_ids['stage:' .. m.id] = nil, nil
    else
      messages[#messages + 1] = m
    end
  end
  self.messages = messages
  for k = #self.blocks, 1, -1 do
    local b = self.blocks[k]
    if gone[b.m.id] then
      -- A retained answer becomes a standalone block when its ask expires.
      local survivors = {}
      for _, m in ipairs(b.msgs) do
        if not gone[m.id] then survivors[#survivors + 1] = m end
        self.block_of[m.id] = nil
      end
      api.nvim_buf_clear_namespace(self.buf, ns, b.start, b.start + b.n)
      write(self.buf, b.start, b.start + b.n, {})
      for _ = 1, b.n do table.remove(self.info, b.start + 1) end
      table.remove(self.blocks, k)
      for j = k, #self.blocks do self.blocks[j].start = self.blocks[j].start - b.n end
      self:_refresh_day(k)
      for _, m in ipairs(survivors) do self:_insert(m) end
    else
      for _, m in ipairs(b.msgs) do
        if gone[m.id] then self:_replace(b); break end
      end
    end
  end
  self:_row_targets()
  self:_settle(wins)
end

--- Insert a standalone retained answer among existing blocks without rewriting its neighbours.
function Thread:_insert(m)
  -- Retention keeps the hub's arrival order on equal timestamps, including
  -- answers promoted from asks that are removed in reverse block order.
  local order = {}
  for k, message in ipairs(self.messages) do order[message.id] = k end
  local idx = #self.blocks + 1
  for k, b in ipairs(self.blocks) do
    if order[b.m.id] and order[m.id] < order[b.m.id] then idx = k; break end
  end
  local prev = self.blocks[idx - 1]
  local b = self:_build(m, prev, nil)
  b.start = prev and prev.start + prev.n or 0
  write(self.buf, b.start, b.start, b.lines)
  for k, i in ipairs(b.info) do table.insert(self.info, b.start + k, i) end
  for k = idx, #self.blocks do self.blocks[k].start = self.blocks[k].start + b.n end
  table.insert(self.blocks, idx, b)
  self.block_of[m.id] = b
  self:_marks(b.start, b.marks)
  self:_refresh_day(idx + 1)
end

-- The thread's operations -------------------------------------------------------------------------------------

--- A message's header changed its stage: that one mark.
function Thread:_update_stage(m)
  local b = self.block_of[m.id]
  local off = b and b.heads[m.id]
  if not off then
    return
  end
  local key = 'stage:' .. m.id
  local s = self:_stage(m)
  if s then
    local opts = { virt_text = s, virt_text_pos = 'eol_right_align', hl_mode = 'combine', priority = 130, id = self.mark_ids[key] }
    local ok, id = pcall(api.nvim_buf_set_extmark, self.buf, ns, b.start + off, 0, opts)
    if ok then
      self.mark_ids[key] = id
    end
  end
end

--- Add one message (an event); a message already shown only advances its stage.
function Thread:add(message)
  local existing = self.by_id[message.id]
  if existing then
    local before = existing.stage
    advance(existing, message.stage)
    if existing.stage ~= before then
      self:_update_stage(existing)
    end
    return
  end
  local copy = vim.deepcopy(message)
  self.by_id[copy.id] = copy
  table.insert(self.messages, copy)
  self:_place(copy)
  self:_trim()
end

--- A new message into the buffer: under its ask's card when it answers one, else at the end.
function Thread:_place(m)
  local ask = m.answerTo and self.by_id[m.answerTo]
  if ask and type(ask.ask) == 'table' and self.block_of[ask.id] then
    return self:_replace(self.block_of[ask.id])
  end
  self:_append(m)
end

--- Merge a history snapshot: new messages join in time order, known ones advance their stage and take the hub's
--- ask card (an ask answered, withdrawn or cancelled while the client was away is no longer open). Only a message
--- older than the latest shown rewrites the buffer; otherwise each change touches its own lines.
function Thread:merge(messages)
  local latest = self.messages[#self.messages]
  local fresh, cards, stages = {}, {}, {}
  local older = false
  for _, m in ipairs(messages or {}) do
    local existing = self.by_id[m.id]
    if existing then
      local before = existing.stage
      advance(existing, m.stage)
      if existing.stage ~= before then
        stages[#stages + 1] = existing
      end
      if type(m.ask) == 'table' and not vim.deep_equal(existing.ask, m.ask) then
        existing.ask = vim.deepcopy(m.ask)
        cards[existing.id] = true
      end
    else
      local copy = vim.deepcopy(m)
      fresh[#fresh + 1] = copy
      if latest and tostring(copy.ts) < tostring(latest.ts) then
        older = true
      end
    end
  end
  -- in time order (the hub's order on equal times)
  for i, m in ipairs(fresh) do
    m._seq = i
  end
  table.sort(fresh, function(a, b)
    if a.ts ~= b.ts then
      return tostring(a.ts) < tostring(b.ts)
    end
    return a._seq < b._seq
  end)
  for _, m in ipairs(fresh) do
    self.by_id[m.id] = m
    table.insert(self.messages, m)
  end
  if older or #self.blocks == 0 then
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
    return self:render()
  end
  for _, m in ipairs(stages) do
    self:_update_stage(m)
  end
  for id in pairs(cards) do
    local b = self.block_of[id]
    if b then
      self:_replace(b)
    end
  end
  for _, m in ipairs(fresh) do
    self:_place(m)
  end
  self:_trim()
end

--- The hub's open asks (`inbox.list`), after a reconnect: a cached card still open that is not among them closed
--- while the client was away, and its message may be older than the history the reconnect read, so the merge
--- never brought its new state. It shows `closed` and takes no answer.
function Thread:reconcile_asks(open_ids)
  for _, m in ipairs(self.messages) do
    if type(m.ask) == 'table' and m.ask.state == 'open' and not open_ids[m.id] then
      m.ask = vim.tbl_extend('force', m.ask, { state = 'closed' })
      local b = self.block_of[m.id]
      if b then
        self:_replace(b)
      end
    end
  end
end

--- An ask's card changed (an `ask` event): answered, withdrawn, cancelled.
function Thread:set_card(id, card)
  local m = self.by_id[id]
  if m and type(card) == 'table' then
    m.ask = card
    local b = self.block_of[id]
    if b then
      self:_replace(b)
    end
  end
end

function Thread:set_stage(id, stage)
  local m = self.by_id[id]
  if m then
    local before = m.stage
    advance(m, stage)
    if m.stage ~= before then
      self:_update_stage(m)
    end
  end
end

--- One line under the messages about the hub connection or a failed send; nil clears it. Only that line changes.
function Thread:set_notice(text, group)
  local new = text and { text = (text:gsub('\n', ' ')), group = group or 'ClandAmber' } or nil
  local had = self.notice
  if (had and new and had.text == new.text and had.group == new.group) or (not had and not new) then
    return
  end
  self.notice = new
  local buf = self.buf
  if not api.nvim_buf_is_valid(buf) then
    return
  end
  local wins = self:_windows()
  local n = api.nvim_buf_line_count(buf)
  if had then
    api.nvim_buf_clear_namespace(buf, ns, n - 1, n)
    table.remove(self.info)
    write(buf, n - 1, n, {})
    n = n - 1
  end
  if new then
    local line, marks = self:_notice_line()
    self.info[#self.info + 1] = { notice = true }
    write(buf, n, n, { line })
    self:_marks(n, marks)
  end
  self:_row_targets()
  self:_settle(wins)
end

--- The open ask on row `row` of the buffer ({id, topic, question, options, free}), or nil.
function Thread:ask_at(row)
  local i = self.info[row]
  return i and i.ask or nil
end

--- The artifact whose chip is on row `row`, or nil.
function Thread:artifact_at(row)
  local i = self.info[row]
  return i and i.artifact or nil
end

--- 'statuscolumn': one cell in the role colour on every screen row of a message (wrapped rows too), a blank on
--- virtual lines and between messages; a heavier bar on the message under the cursor.
function M.gutter()
  local win = vim.g.statusline_winid
  local ok, buf = pcall(api.nvim_win_get_buf, win)
  local t = ok and M.by_buf[buf]
  if not t or vim.v.virtnum < 0 then
    return '  '
  end
  local i = t.info[vim.v.lnum]
  if not i or not i.group then
    return '  '
  end
  local glyph = t.cursor_block[win] == i.b and M.GUTTER_CURSOR or M.GUTTER
  return '%#' .. i.group .. '#' .. glyph .. '%* '
end

-- A window that follows a thread's tail keeps it at its bottom when it is resized: text reflows at another width,
-- and Neovim keeps the old top line, which leaves empty rows under the tail after a widening.
local group = api.nvim_create_augroup('cland.thread', { clear = true })
local window_options = {
  statuscolumn = '%!v:lua.ClandThreadGutter()',
  wrap = true,
  linebreak = true,
  breakindent = true,
  breakindentopt = 'list:-1',
}
-- Splits inherit local options, and plain vim.wo assignments also change global
-- defaults. Apply only local values, for every window/buffer transition.
api.nvim_create_autocmd({ 'BufWinEnter', 'WinNew' }, {
  group = group,
  callback = function(ev)
    local wins = ev.event == 'BufWinEnter' and vim.fn.win_findbuf(ev.buf) or { api.nvim_get_current_win() }
    for _, win in ipairs(wins) do
      local thread = M.by_buf[api.nvim_win_get_buf(win)]
      for name, value in pairs(window_options) do
        if not thread then value = api.nvim_get_option_value(name, { scope = 'global' }) end
        api.nvim_set_option_value(name, value, { scope = 'local', win = win })
      end
    end
  end,
})
api.nvim_create_autocmd({ 'WinResized', 'VimResized' }, {
  group = group,
  callback = function()
    for buf, t in pairs(M.by_buf) do
      if api.nvim_buf_is_valid(buf) then
        for _, win in ipairs(vim.fn.win_findbuf(buf)) do
          if t.at_tail[win] ~= false then
            to_tail(win, buf)
          end
        end
      end
    end
  end,
})

_G.ClandThreadGutter = function()
  local ok, res = pcall(M.gutter)
  return ok and res or '  '
end
return M
