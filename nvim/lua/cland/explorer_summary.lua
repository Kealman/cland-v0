-- The card's summary rule of spec v0.1.2 §3.9, ported from the accepted explorer prototype:
-- a written `## Summary` wins; otherwise "rule B" of the T-258 research (docs/research/explorer-prior-art.md
-- and its summary-fallback.py on research/explorer-prior-art), ported line by line from the Python: the first
-- section that is not Parent, Notes, Sources, References, Acceptance criteria or Definition of done; in it the
-- first prose paragraph with its leading provenance sentences dropped (or the first list item when there is no
-- prose); trimmed to two whole sentences and 50 words, without a trailing lead-in that ends in a colon. It runs
-- on the parsed body that `task.view` returns (frontmatter and comments already gone), never on the raw file.
local M = {}

M.META = { parent = true, comments = true, notes = true, sources = true, references = true,
  ['acceptance criteria'] = true, ['definition of done'] = true }

-- The script's PROVENANCE_RE, spelled out: lower-case openings of a sentence that only says where the item
-- came from. Each must be followed by a non-word character or the end.
M.PROVENANCE = {
  'found by', 'found in', 'found while', 'seen by', 'seen in', 'seen on', 'seen once by', 'seen once in', 'seen once on',
  'observation from', 'observation of', 'observed by', 'observed in', 'observed during', 'proposed by', 'asked by',
  'raised by', 'reported by', 'relayed by', 'filed by', 'recorded by', 'split from', 'from the human',
  'from the stand-in', 'the human reported', 'the human observed', 'the human asked', 'follow-up of', 'follow-up from',
  'follow-up to',
}

local function lstrip3(line)
  -- CommonMark's "up to three spaces of indentation"
  local spaces = line:match('^( *)')
  if #spaces <= 3 then return line:sub(#spaces + 1), #spaces end
  return nil, #spaces
end

local function fence_of(line)
  local s = lstrip3(line)
  if not s then return nil end
  return s:match('^(```+)') or s:match('^(~~~+)')
end

local function line_kind(line)
  if not line:find('%S') then return 'blank' end
  if fence_of(line) then return 'code' end
  local s = lstrip3(line)
  if s then
    local hashes = s:match('^(#+)')
    if hashes and #hashes <= 6 and (s:sub(#hashes + 1, #hashes + 1) == '' or s:sub(#hashes + 1, #hashes + 1):match('[ \t]')) then return 'heading' end
    if s:match('^>') then return 'quote' end
    local c = s:sub(1, 1)
    if (c == '-' or c == '*' or c == '_') then
      local rest = s:gsub('[ \t]', '')
      if #rest >= 3 and rest == c:rep(#rest) then return 'rule' end
    end
    if s:match('^[-*+][ \t]+') or s:match('^%d+[.)][ \t]+') then return 'list' end
    if s:match('^|') then return 'table' end
    if s:match('^<!%-%-') or s:match('^</?%a') then return 'html' end
  end
  if line:sub(1, 4) == '    ' or line:sub(1, 1) == '\t' then return 'indented' end
  return 'prose'
end
M.line_kind = line_kind

--- [{heading or nil, lines}] in order; fenced lines never start a section.
function M.sections(body)
  local out, cur, fence = {}, { nil, {} }, nil
  local function push()
    local any = cur[1] ~= nil
    if not any then for _, l in ipairs(cur[2]) do if l:find('%S') then any = true; break end end end
    if any then out[#out + 1] = cur end
  end
  for _, line in ipairs(vim.split(body or '', '\n', { plain = true })) do
    local f = fence_of(line)
    if fence then
      table.insert(cur[2], line)
      if f and f:sub(1, 1) == fence:sub(1, 1) and #f >= #fence then fence = nil end
    elseif f then
      fence = f
      table.insert(cur[2], line)
    else
      local h = line:match('^##[ \t]+(.-)[ \t#]*$')
      if h and not line:match('^###') then
        push()
        cur = { vim.trim(h), {} }
      else
        table.insert(cur[2], line)
      end
    end
  end
  push()
  return out
end

--- A section's lines as blocks {kind, text, items}.
function M.blocks(lines)
  local out, i, n = {}, 1, #lines
  while i <= n do
    local line = lines[i]
    local k = line_kind(line)
    if k == 'blank' then
      i = i + 1
    elseif k == 'code' then
      local fence = fence_of(line)
      local j = i + 1
      while j <= n do
        local f = fence_of(lines[j])
        j = j + 1
        if f and f:sub(1, 1) == fence:sub(1, 1) and #f >= #fence then break end
      end
      out[#out + 1] = { 'code', table.concat(lines, '\n', i, j - 1), 0 }
      i = j
    elseif k == 'heading' or k == 'rule' then
      out[#out + 1] = { k, vim.trim(line), 0 }
      i = i + 1
    elseif k == 'quote' then
      local j = i
      while j <= n and lines[j]:find('%S') and (line_kind(lines[j]) == 'quote' or line_kind(lines[j]) == 'prose') do j = j + 1 end
      out[#out + 1] = { 'quote', table.concat(lines, '\n', i, j - 1), 0 }
      i = j
    elseif k == 'table' then
      local j = i
      while j <= n and line_kind(lines[j]) == 'table' do j = j + 1 end
      out[#out + 1] = { 'table', table.concat(lines, '\n', i, j - 1), 0 }
      i = j
    elseif k == 'list' then
      local j, count = i, 0
      while j <= n do
        local kj = line_kind(lines[j])
        if kj == 'list' and lines[j]:sub(1, 2) ~= '  ' then
          count = count + 1
          j = j + 1
        elseif kj == 'blank' then
          local nxt
          for x = j, n do if lines[x]:find('%S') then nxt = lines[x]; break end end
          if nxt and (line_kind(nxt) == 'list' or nxt:sub(1, 2) == '  ') then j = j + 1 else break end
        elseif lines[j]:sub(1, 1) == ' ' or lines[j]:sub(1, 1) == '\t' or kj == 'prose' or kj == 'list' then
          j = j + 1
        else
          break
        end
      end
      out[#out + 1] = { 'list', table.concat(lines, '\n', i, j - 1), count }
      i = j
    else
      local j = i + 1
      while j <= n do
        local kj = line_kind(lines[j])
        if kj == 'blank' or kj == 'code' or kj == 'heading' or kj == 'quote' or kj == 'rule' then break end
        if kj == 'list' then
          local s = lstrip3(lines[j]) or ''
          local o = s:match('^(%d+)[.)][ \t]+')
          if not o or o == '1' then break end
        end
        j = j + 1
      end
      out[#out + 1] = { (k == 'prose' or k == 'indented') and 'prose' or k, table.concat(lines, '\n', i, j - 1), 0 }
      i = j
    end
  end
  return out
end

local CLOSERS = { ['"'] = true, ["'"] = true, [')'] = true, [']'] = true, ['*'] = true }
local CLOSERS_MB = { '\226\128\157', '\226\128\153' } -- ” ’
local OPENERS = { ['`'] = true, ['"'] = true, ["'"] = true, ['('] = true, ['['] = true, ['*'] = true }
local OPENERS_MB = { '\226\128\156', '\226\128\152' } -- “ ‘

local function abbrev(piece)
  local p = piece:lower()
  for _, a in ipairs({ 'e.g.', 'i.e.', 'etc.', 'vs.', 'cf.', 'approx.', 'incl.' }) do
    if p:sub(-#a) == a then
      local before = p:sub(-#a - 1, -#a - 1)
      if before == '' or not before:match('[%w_]') then return true end
    end
  end
  -- a single letter and a period ("J."), or a section number (§3.1.)
  if p:match('%f[%w]%a%.$') then return true end
  if p:match('§%d+[%d%.]*$') then return true end
  return false
end

--- Prose split into sentences: a period, ! or ? (with closing quotes or brackets) followed by a space and the
--- next word; never inside a code span, never after e.g., i.e., etc. or vs.
function M.sentences(text)
  local parts = {}
  for _, l in ipairs(vim.split(text or '', '\n', { plain = true })) do parts[#parts + 1] = vim.trim(l) end
  local flat = table.concat(parts, ' ')
  local out, start, in_code, i, n = {}, 1, false, 1, #flat
  while i <= n do
    local ch = flat:sub(i, i)
    if ch == '`' then
      in_code = not in_code
    elseif (ch == '.' or ch == '!' or ch == '?') and not in_code then
      local j = i + 1
      while j <= n do
        local c = flat:sub(j, j)
        if CLOSERS[c] then j = j + 1
        elseif flat:sub(j, j + 2) == CLOSERS_MB[1] or flat:sub(j, j + 2) == CLOSERS_MB[2] then j = j + 3
        else break end
      end
      local ends = j > n
      if not ends and flat:sub(j, j) == ' ' and j + 1 <= n then
        local nx, mb = flat:sub(j + 1, j + 1), flat:sub(j + 1, j + 3)
        if nx:match('%w') or OPENERS[nx] or mb == OPENERS_MB[1] or mb == OPENERS_MB[2] then
          ends = true
        else
          -- Python's isalnum() on a non-ASCII character: letters yes (Latin, Greek, Cyrillic, CJK), the
          -- U+0080–U+00BF and U+2000–U+2FFF punctuation blocks no (an approximation without Unicode tables)
          local b = nx:byte()
          ends = b >= 0xC3 and b ~= 0xE2
        end
      end
      if ends then
        if ch == '.' and abbrev(flat:sub(start, i)) then
          i = i + 1
          goto continue
        end
        local piece = vim.trim(flat:sub(start, j - 1))
        if piece ~= '' then out[#out + 1] = piece end
        start = j
        i = j
        goto continue
      end
    end
    i = i + 1
    ::continue::
  end
  local tail = vim.trim(flat:sub(start))
  if tail ~= '' then out[#out + 1] = tail end
  return out
end

function M.words(text)
  local n = 0
  for _ in (text or ''):gmatch('%S+') do n = n + 1 end
  return n
end

local function provenance(sentence)
  local s = sentence:lower():gsub('^%*%*', '')
  for _, p in ipairs(M.PROVENANCE) do
    if s:sub(1, #p) == p then
      local after = s:sub(#p + 1, #p + 1)
      if after == '' or not after:match('[%w_]') then return true end
    end
  end
  return false
end

local function strip_list_marker(text)
  local first = vim.split(text, '\n', { plain = true })[1]
  local s = lstrip3(first) or first
  s = s:gsub('^[-*+][ \t]+', '', 1):gsub('^%d+[.)][ \t]+', '', 1)
  return (s:gsub('^%[[ xX]%][ \t]+', '', 1))
end

local function first_list_item(text)
  local lines = vim.split(text, '\n', { plain = true })
  local item = { strip_list_marker(lines[1]) }
  for x = 2, #lines do
    local line = lines[x]
    if not line:find('%S') or (line_kind(line) == 'list' and line:sub(1, 2) ~= '  ') then break end
    item[#item + 1] = vim.trim(line)
  end
  return table.concat(item, ' ')
end

local function cap(text, max_words)
  local ws = {}
  for w in text:gmatch('%S+') do ws[#ws + 1] = w end
  if #ws <= max_words then return text end
  local cut = vim.list_slice(ws, 1, max_words)
  for x = #cut, math.floor(2 * max_words / 3) + 2, -1 do
    local last = cut[x]:sub(-1)
    if last == ';' or last == ',' or last == ':' then
      cut = vim.list_slice(cut, 1, x)
      break
    end
  end
  local out = table.concat(cut, ' '):gsub('[;,:]+$', '')
  local _, ticks = out:gsub('`', '')
  if ticks % 2 == 1 then
    local at = out:match('^.*()`')
    out = vim.trim(out:sub(1, at - 1))
  end
  return out .. ' …'
end

local function trim(ss, max_sentences, max_words)
  if not ss[1] or vim.trim(ss[1]):sub(-1) == ':' then return '' end
  local out = { ss[1] }
  for x = 2, math.min(#ss, max_sentences) do
    local s = ss[x]
    if vim.trim(s):sub(-1) == ':' then break end
    if M.words(table.concat(out, ' ') .. ' ' .. s) > max_words then break end
    out[#out + 1] = s
  end
  return cap(table.concat(out, ' '), max_words)
end

--- The summary of a parsed body: text, where it came from ('written' | the section's heading | nil).
function M.summary(body, max_sentences, max_words)
  max_sentences, max_words = max_sentences or 2, max_words or 50
  local secs = M.sections(body)
  for _, sec in ipairs(secs) do
    if sec[1] and sec[1]:lower() == 'summary' then
      return vim.trim(table.concat(sec[2], '\n')), 'written'
    end
  end
  for _, sec in ipairs(secs) do
    if not M.META[(sec[1] or ''):lower()] then
      local bs = M.blocks(sec[2])
      for _, b in ipairs(bs) do
        if b[1] == 'prose' then
          local ss = M.sentences(b[2])
          while ss[1] and provenance(ss[1]) do table.remove(ss, 1) end
          if #ss > 0 then return trim(ss, max_sentences, max_words), sec[1] end
        end
      end
      for _, b in ipairs(bs) do
        if b[1] == 'list' then
          return trim(M.sentences(first_list_item(b[2])), max_sentences, max_words), sec[1]
        end
      end
    end
  end
  return '', nil
end

--- The body's `##` headings in order (the agents'-text fold line names them), and its size in words.
function M.outline(body)
  local names = {}
  for _, sec in ipairs(M.sections(body)) do
    if sec[1] then names[#names + 1] = sec[1] end
  end
  return names, M.words(body or '')
end

return M
