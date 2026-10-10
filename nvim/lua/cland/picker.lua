-- Object entries for the palette: retain the panel's status/glyph/context vocabulary.
-- open/close/act are compatibility entry points into the palette; no second floating UI.
local state = require('cland.state')

local M = {}

M.KINDS = { 'items', 'topics', 'sessions', 'artifacts' }

--- The items by id; typing filters on the id, the title and the claiming session (#36).
local function item_entries()
  local items = require('cland.items')
  local out = {}
  for _, it in ipairs(items.all()) do
    local glyph, ghl = items.glyph(it)
    local c = items.claim(it)
    local right = { items.WORDS[items.status(it)] }
    if c then
      right[#right + 1] = 'claim ' .. c.session
    end
    out[#out + 1] = { glyph = glyph, ghl = ghl, key = it.id .. ' ' .. (it.title or '') .. (c and ('  ' .. c.session) or ''), right = table.concat(right, ' · '), value = it.id }
  end
  return out
end

--- The topics as the panel groups them: needs you first, then open, then closed (Pickers.dc.html); the title
--- is what typing filters. The right side: the binding, the warning, the status, the unread count.
local function topic_entries()
  local panels = require('cland.panels')
  local out = {}
  for _, g in ipairs(state.topic_groups()) do
    for _, t in ipairs(g.topics) do
      local glyph, ghl = panels.topic_glyph(t)
      local right = {}
      if t.item and t.item ~= vim.NIL then
        right[#right + 1] = t.item
      end
      if state.warning(t) then
        right[#right + 1] = '▲ ' .. state.warning(t)
      end
      right[#right + 1] = t.id == 'agents' and 'log' or (t.status == 'waiting for human' and 'needs you' or (t.status or 'open'))
      local n = tonumber(t.unread) or 0
      if n > 0 then
        right[#right + 1] = n .. ' unread'
      end
      out[#out + 1] = { glyph = glyph, ghl = ghl, key = t.title, right = table.concat(right, ' · '), value = t.id }
    end
  end
  return out
end

--- The order of the sessions kind: those waiting for the human first, then busy, idle, unknown, down.
local function session_rank(s)
  if not s.live then
    return 5
  end
  if s.state:match('^waiting') then
    return 1
  end
  return ({ busy = 2, idle = 3 })[s.state] or 4
end

--- Sessions: the key (what the filter matches) is the label, the harness and its id, so typing a name, a
--- role or a harness narrows the list.
local function session_entries()
  local panels = require('cland.panels')
  local out = {}
  for i, s in ipairs(state.sessions()) do
    local g, ghl = panels.session_glyph(s)
    local harness = s.harness and ((panels.HARNESS[s.harness] or s.harness) .. ' (' .. s.harness .. ')') or 'not launched by cland'
    local right = (s.model and (s.model .. ' · ') or '') .. panels.session_words(s) .. (s.item and (' · ' .. s.item) or '')
    out[#out + 1] = { glyph = g, ghl = ghl, key = (s.label or s.name) .. '  ' .. harness, right = right, value = s.name, rank = session_rank(s), i = i }
  end
  table.sort(out, function(a, b)
    if a.rank ~= b.rank then
      return a.rank < b.rank
    end
    return a.i < b.i
  end)
  return out
end

local function artifact_entries()
  local out = {}
  local current = require('cland.views').current_topic()
  for _, a in ipairs(require('cland.artifacts').all()) do
    out[#out + 1] = { glyph = '▣', ghl = 'ClandBlue', key = a.id .. ' ' .. a.kind .. ' · ' .. a.title,
      right = a.creator .. ' · ' .. require('cland.artifacts').mark(a), value = a.id, rank = a.topic == current and 0 or 1 }
  end
  table.sort(out, function(a, b)
    if a.rank ~= b.rank then return a.rank < b.rank end
    return tonumber(a.value:sub(3)) < tonumber(b.value:sub(3))
  end)
  return out
end
M.BUILD = { items = item_entries, topics = topic_entries, sessions = session_entries, artifacts = artifact_entries }

-- Compatibility for callers opening the old picker: every entry point now opens the palette.
function M.open(opts)
  local palette = require('cland.palette')
  return palette.open({query=palette.prefix((opts or {}).kind)})
end
function M.close() return require('cland.palette').close() end
function M.act(kind, value) return require('cland.palette').run({group=kind,value=value}) end
return M
