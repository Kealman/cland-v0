-- Markdown inside one thread message (T-133, from the accepted T-97 prototype). Each body is parsed on its own with a string parser of
-- the bundled `markdown` grammar (its injections: `markdown_inline`, and a fenced block's language where Neovim
-- bundles one), so an unclosed fence in one message never turns later messages into code. The result is a list of
-- spans (rows relative to the body) that the thread applies as extmarks, cached by text: a message is parsed once.
--
-- What renders how: headings bold with their `#` markers concealed; inline code on a chip background with its
-- backticks concealed; a fenced block as a band with its fences concealed and the language dim; `-`/`*`/`+`
-- bullets shown as `•`; links blue and underlined with brackets concealed and destinations retained in metadata;
-- emphasis, strong and strikethrough; a block quote dim with its `>` shown as a bar. Where the parser
-- fails the body stays plain text.
local M = {}
local fit = require('cland.bars').fit

local cache, order, cached, oldest = {}, {}, 0, 1
local CACHE_MAX = 4000

-- The block-level decorations, on the markdown tree; the inline ones come from the bundled markdown_inline query.
local BLOCK_QUERY = [[
(atx_heading) @heading
(setext_heading) @heading
(atx_h1_marker) @hmarker
(atx_h2_marker) @hmarker
(atx_h3_marker) @hmarker
(atx_h4_marker) @hmarker
(atx_h5_marker) @hmarker
(atx_h6_marker) @hmarker
(setext_h1_underline) @hrule
(setext_h2_underline) @hrule
(fenced_code_block) @code
(fenced_code_block_delimiter) @fence
(info_string) @info
(indented_code_block) @code
(list_marker_minus) @bullet
(list_marker_plus) @bullet
(list_marker_star) @bullet
(list_marker_dot) @number
(list_marker_parenthesis) @number
(task_list_marker_unchecked) @task
(task_list_marker_checked) @taskdone
(block_quote) @quote
(block_quote_marker) @quotemark
(thematic_break) @rule
(pipe_table_header (pipe_table_cell) @th)
(pipe_table) @table
(link_reference_definition) @reference
]]

--- markdown_inline captures (bundled query) → cland's groups; a capture not listed keeps only its conceal.
local INLINE = {
  ['markup.raw'] = 'ClandCode',
  ['markup.italic'] = 'ClandItalic',
  ['markup.strong'] = 'ClandBold',
  ['markup.strikethrough'] = 'ClandStrike',
  ['markup.link.label'] = 'ClandLink',
  ['markup.link.url'] = 'ClandLink',
  ['markup.link'] = 'ClandFaint',
  ['string.escape'] = 'ClandDim',
  ['character.special'] = 'ClandDim',
}

local queries = {}
local function query(lang, name, text)
  local key = lang .. ':' .. name
  if queries[key] == nil then
    local ok, q
    if text then
      ok, q = pcall(vim.treesitter.query.parse, lang, text)
    else
      ok, q = pcall(vim.treesitter.query.get, lang, name)
    end
    queries[key] = ok and q or false
  end
  return queries[key] or nil
end

--- The body's lines as the thread shows them (no carriage returns): the spans' rows and columns refer to these.
function M.lines(text)
  text = tostring(text or ''):gsub('\r\n', '\n'):gsub('\r', '')
  return vim.split(text, '\n', { plain = true }), text
end

local function spans_of(text, lines)
  local out, links, tables, references = {}, {}, {}, {}
  local nrows = #lines
  -- one span, its end clamped to the body: nothing spills into the next message
  local function span(sr, sc, er, ec, opts)
    if sr >= nrows then
      return
    end
    if er >= nrows then
      er, ec = nrows - 1, #lines[nrows]
    end
    opts.end_row, opts.end_col = er, ec
    out[#out + 1] = { row = sr, col = sc, opts = opts }
  end
  local function line(row, opts)
    if row < nrows then
      out[#out + 1] = { row = row, col = 0, opts = opts }
    end
  end
  local parser = vim.treesitter.get_string_parser(text .. '\n', 'markdown')
  parser:parse(true)
  local source = text .. '\n'
  parser:for_each_tree(function(tree, ltree)
    local lang = ltree:lang()
    local root = tree:root()
    if lang == 'markdown' or lang == 'markdown_inline' then
      assert(not root:has_error(), 'Markdown parse rejected')
    end
    if lang == 'markdown' then
      local q = query('markdown', 'cland-block', BLOCK_QUERY)
      assert(q, 'Missing Markdown query')
      for id, node in q:iter_captures(root, source) do
        local name = q.captures[id]
        local sr, sc, er, ec = node:range()
        if name == 'heading' then
          local last = ec == 0 and er - 1 or er
          for r = sr, last do
            span(r, 0, r, #(lines[r + 1] or ''), { hl_group = 'ClandHeading', priority = 105 })
          end
        elseif name == 'hmarker' then
          -- `## ` goes: the marker and the space after it
          local after = (lines[sr + 1] or ''):sub(ec + 1, ec + 1) == ' ' and 1 or 0
          span(sr, sc, sr, ec + after, { conceal = '', priority = 110 })
        elseif name == 'hrule' then
          span(sr, sc, sr, #(lines[sr + 1] or ''), { hl_group = 'ClandFaint', priority = 110 })
        elseif name == 'code' then
          local last = ec == 0 and er - 1 or er
          for r = sr, last do
            line(r, { line_hl_group = 'ClandCodeBlock', priority = 60 })
          end
        elseif name == 'fence' then
          span(sr, sc, er, ec, { conceal = '', priority = 110 })
        elseif name == 'info' then
          span(sr, sc, er, ec, { hl_group = 'ClandFaint', priority = 110 })
        elseif name == 'bullet' then
          local ch = (lines[sr + 1] or ''):sub(sc + 1, sc + 1)
          if ch == '-' or ch == '*' or ch == '+' then
            span(sr, sc, sr, sc + 1, { conceal = '•', hl_group = 'ClandDim', priority = 110 })
          end
        elseif name == 'number' then
          span(sr, sc, er, ec, { hl_group = 'ClandDim', priority = 110 })
        elseif name == 'task' then
          span(sr, sc, er, ec, { hl_group = 'ClandDim', priority = 110 })
        elseif name == 'taskdone' then
          span(sr, sc, er, ec, { hl_group = 'ClandGreen', priority = 110 })
        elseif name == 'quote' then
          local last = ec == 0 and er - 1 or er
          for r = sr, last do
            span(r, 0, r, #(lines[r + 1] or ''), { hl_group = 'ClandQuote', priority = 101 })
          end
        elseif name == 'quotemark' then
          -- `>` shows as a bar; the bar keeps the marker's one cell
          local ch = (lines[sr + 1] or ''):sub(sc + 1, sc + 1)
          if ch == '>' then
            span(sr, sc, sr, sc + 1, { conceal = '│', hl_group = 'ClandFaint', priority = 110 })
          end
        elseif name == 'rule' then
          span(sr, sc, er, ec, { hl_group = 'ClandFaint', priority = 110 })
        elseif name == 'table' then
          local rows = {}
          for child in node:iter_children() do
            if child:type() ~= 'pipe_table_delimiter_row' then
              local cells = {}
              for cell in child:iter_children() do
                if cell:type() == 'pipe_table_cell' then
                  local r, a, _, z = cell:range()
                  cells[#cells + 1] = { row = r, from = a, to = z }
                end
              end
              rows[#rows + 1] = cells
            end
          end
          tables[#tables + 1] = { first = sr, last = ec == 0 and er - 1 or er, rows = rows }
        elseif name == 'reference' then
          local label, destination
          for child in node:iter_children() do
            if child:type() == 'link_label' then label = vim.treesitter.get_node_text(child, source) end
            if child:type() == 'link_destination' then destination = vim.treesitter.get_node_text(child, source) end
          end
          if label and destination then
            local key = vim.trim(label:sub(2, -2)):gsub('%s+', ' '):lower()
            references[key] = references[key] or destination
          end
        elseif name == 'th' then
          span(sr, sc, er, ec, { hl_group = 'ClandBold', priority = 105 })
        end
      end
    elseif lang == 'markdown_inline' then
      local lq = query('markdown_inline', 'cland-links', '[(inline_link) (full_reference_link) (collapsed_reference_link) (shortcut_link) (uri_autolink) (email_autolink)] @link')
      assert(lq, 'Missing inline link query')
      for id, node in lq:iter_captures(root, source) do
        if lq.captures[id] == 'link' then
          local label, destination, reference
          for child in node:iter_children() do
            if child:type() == 'link_text' then label = child end
            if child:type() == 'link_destination' then destination = child end
            if child:type() == 'link_label' then reference = vim.treesitter.get_node_text(child, source):sub(2, -2) end
          end
          local autolink = node:type() == 'uri_autolink' or node:type() == 'email_autolink'
          if label or autolink then
            local sr, sc, er, ec = node:range()
            local lr, lc, le, lz
            if autolink then lr, lc, le, lz = sr, sc + 1, er, ec - 1
            else lr, lc, le, lz = label:range() end
            links[#links + 1] = { row = sr, col = sc, end_row = er, end_col = ec,
              label_row = lr, label_col = lc, label_end_row = le, label_end_col = lz,
              destination = autolink and (node:type() == 'email_autolink' and 'mailto:' or '') .. vim.treesitter.get_node_text(node, source):sub(2, -2)
                or destination and vim.treesitter.get_node_text(destination, source),
              reference = not autolink and not destination and vim.trim(reference or vim.treesitter.get_node_text(label, source)):gsub('%s+', ' '):lower() or nil }
          end
        end
      end
      local q = query('markdown_inline', 'highlights')
      assert(q, 'Missing Markdown query')
      for id, node, meta in q:iter_captures(root, source) do
        local name = q.captures[id]
        local conceal = (meta[id] or {}).conceal or meta.conceal
        local group = INLINE[name]
        if group or conceal then
          local sr, sc, er, ec = node:range()
          local opts = { priority = conceal and 115 or 112 }
          if group then
            opts.hl_group = group
          end
          if conceal then
            opts.conceal = conceal
          end
          span(sr, sc, er, ec, opts)
        end
      end
    else
      -- a fenced block in a language Neovim bundles a parser for (lua, vim, c, query): its own highlights
      local q = query(lang, 'highlights')
      if not q then
        return
      end
      for id, node in q:iter_captures(root, source) do
        local name = q.captures[id]
        if name:sub(1, 1) ~= '_' and name ~= 'spell' and name ~= 'nospell' then
          local sr, sc, er, ec = node:range()
          span(sr, sc, er, ec, { hl_group = '@' .. name .. '.' .. lang, priority = 106 })
        end
      end
    end
  end)
  local resolved = {}
  for _, link in ipairs(links) do
    link.destination = link.destination or references[link.reference]
    if link.destination then resolved[#resolved + 1] = link end
  end
  return { lines = lines, spans = out, links = resolved, tables = tables }
end

-- Cache by original body text, including failures. FIFO eviction never discards the whole cache
-- during an append, and no parser survives the extraction of its spans.
local function parsed(text)
  text = tostring(text or '')
  if cache[text] then return cache[text] end
  local lines, clean = M.lines(text)
  local ok, result = pcall(spans_of, clean, lines)
  local body = ok and result or { lines = lines, spans = {}, links = {}, tables = {} }
  body.layouts = {}
  -- Projection visits each source row. Index spans and links once rather than
  -- scanning the entire artifact for every line (quadratic on long documents).
  body.row_spans, body.row_links = {}, {}
  for _, s in ipairs(body.spans) do
    for r = s.row, s.opts.end_row or s.row do
      body.row_spans[r] = body.row_spans[r] or {}
      table.insert(body.row_spans[r], s)
    end
  end
  for _, link in ipairs(body.links) do
    for r = link.row, link.end_row do
      body.row_links[r] = body.row_links[r] or {}
      table.insert(body.row_links[r], link)
    end
  end
  if cached == CACHE_MAX then
    cache[order[oldest]], order[oldest] = nil, nil
    oldest = oldest + 1
    cached = cached - 1
  end
  order[oldest + cached] = text
  cache[text], cached = body, cached + 1
  return body
end

-- A projection carries displayed text, spans and link targets together. Table cells also materialize
-- concealed syntax, so their measured widths and every styled label match what the screen shows.
local function project(body, source_row, from, to, prefix, cell)
  local source = body.lines[source_row + 1]
  if cell then
    local text = source:sub(from + 1, to)
    from = from + #(text:match('^%s*') or '')
    to = math.max(from, to - #(text:match('%s*$') or ''))
  end
  local edits = {}
  local function edit(a, z, replacement)
    a, z = math.max(a, from), math.min(z, to)
    if a < z then edits[#edits + 1] = { a, z, replacement or '' } end
  end
  for _, link in ipairs(body.row_links[source_row] or {}) do
    if link.label_end_row <= source_row and source_row <= link.end_row then
      edit(source_row == link.label_end_row and link.label_end_col + 1 or 0,
        source_row == link.end_row and link.end_col or #source)
    end
  end
  if cell then
    for _, s in ipairs(body.row_spans[source_row] or {}) do
      local er = s.opts.end_row or s.row
      if s.opts.conceal and s.row <= source_row and source_row <= er then
        edit(s.row == source_row and s.col or from, er == source_row and s.opts.end_col or to, s.opts.conceal)
      end
    end
  end
  table.sort(edits, function(a,b) return a[1] == b[1] and a[2] > b[2] or a[1] < b[1] end)
  local merged = {}
  for _, e in ipairs(edits) do
    local last = merged[#merged]
    if last and e[1] < last[2] then
      last[2] = math.max(last[2], e[2])
    else merged[#merged + 1] = e end
  end
  edits = merged
  local function col(c)
    c = math.max(from, math.min(to, c))
    local removed = 0
    for _, e in ipairs(edits) do
      if c >= e[1] then removed = removed + math.min(c,e[2]) - e[1] - (c >= e[2] and #e[3] or 0) end
    end
    return #prefix + c - from - removed
  end
  local pieces, start = { prefix }, from
  for _, e in ipairs(edits) do
    pieces[#pieces + 1] = source:sub(start + 1, e[1]) .. e[3]
    start = e[2]
  end
  pieces[#pieces + 1] = source:sub(start + 1, to)
  local result = { text = table.concat(pieces), spans = {}, links = {} }
  for _, s in ipairs(body.row_spans[source_row] or {}) do
    local er = s.opts.end_row or s.row
    if s.row <= source_row and source_row <= er then
      local opts = vim.tbl_extend('force', {}, s.opts)
      if opts.end_row then
        local a = col(s.row == source_row and s.col or from)
        local z = col(er == source_row and opts.end_col or to)
        if cell then opts.conceal = nil end
        if a < z then
          opts.end_row, opts.end_col = 0, z
          result.spans[#result.spans + 1] = { row = 0, col = a, opts = opts }
        end
      else result.spans[#result.spans + 1] = { row = 0, col = 0, opts = opts } end
    end
  end
  for _, link in ipairs(body.row_links[source_row] or {}) do
    if link.label_row <= source_row and source_row <= link.label_end_row then
      local a = source_row == link.label_row and link.label_col or from
      local z = source_row == link.label_end_row and link.label_end_col or to
      if a < to and z > from then
        result.links[#result.links + 1] = { col = col(a), end_col = col(z), destination = link.destination }
      end
    end
  end
  return result
end

local function literal(text)
  return { text = text, spans = {}, links = {} }
end

-- Join projected labels, cells and padding without losing their style or link byte ranges.
local function concat(parts)
  local result = literal('')
  for _, part in ipairs(parts) do
    local offset = #result.text
    for _, span in ipairs(part.spans) do
      local opts = vim.tbl_extend('force', {}, span.opts)
      if opts.end_col then opts.end_col = opts.end_col + offset end
      result.spans[#result.spans + 1] = { row = 0, col = span.col + offset, opts = opts }
    end
    for _, link in ipairs(part.links) do
      result.links[#result.links + 1] = { col = link.col + offset, end_col = link.end_col + offset, destination = link.destination }
    end
    result.text = result.text .. part.text
  end
  return result
end

local function table_projection(body, t)
  if t.projection then return t.projection end
  local rows, widths = {}, {}
  for _, row in ipairs(t.rows) do
    local cells = {}
    for k, cell in ipairs(row) do
      cells[k] = project(body, cell.row, cell.from, cell.to, '', true)
      widths[k] = math.max(widths[k] or 0, vim.api.nvim_strwidth(cells[k].text))
    end
    rows[#rows + 1] = cells
  end
  local rule = '|'
  for _, width in ipairs(widths) do rule = rule .. ('-'):rep(width + 2) .. '|' end
  t.projection = { rows = rows, widths = widths, rule = rule }
  return t.projection
end

--- Cached per-body projections: normal markers are drawn with conceal; only hidden link tails are
--- compacted to avoid Neovim's raw-width wrapping bug. Tables use fully rendered cell widths and content.
function M.render(text, cells)
  local body = parsed(text)
  local code, tables, skipped, layout = {}, {}, {}, ''
  for _, s in ipairs(body.spans) do
    if s.opts.line_hl_group == 'ClandCodeBlock' then code[s.row] = true end
  end
  for _, t in ipairs(body.tables) do
    local p = table_projection(body, t)
    local fitted = fit({ { p.rule, 'ClandFaint' } }, cells)
    local full = #fitted == 1 and fitted[1][1] == p.rule
    tables[t.first] = { projection = p, full = full }
    for r = t.first, t.last do skipped[r] = true end
    layout = layout .. (full and 'f' or 's')
  end
  local hit = body.layouts[layout]
  if hit then return hit.lines, hit.spans, hit.metadata end
  local lines, spans, metadata = {}, {}, {}
  local function add(p)
    local row = #lines
    lines[#lines + 1], metadata[#metadata + 1] = p.text, { links = p.links }
    for _, s in ipairs(p.spans) do
      local opts = vim.tbl_extend('force', {}, s.opts)
      if opts.end_row then opts.end_row = row end
      spans[#spans + 1] = { row = row, col = s.col, opts = opts }
    end
  end
  for r, line in ipairs(body.lines) do
    r = r - 1
    local table_row = tables[r]
    if table_row then
      local p = table_row.projection
      if table_row.full then
        for i, row in ipairs(p.rows) do
          local parts = { literal('| ') }
          for k, width in ipairs(p.widths) do
            local cell = row[k] or literal('')
            parts[#parts + 1] = cell
            parts[#parts + 1] = literal((' '):rep(width - vim.api.nvim_strwidth(cell.text)) .. ' |' .. (k < #p.widths and ' ' or ''))
          end
          add(concat(parts))
          if i == 1 then add(literal(p.rule)) end
        end
      elseif #p.rows == 1 then
        -- A table with no data still has meaningful header cells.
        for _, header in ipairs(p.rows[1]) do add(concat({ literal('  '), header })) end
      else
        for i = 2, #p.rows do
          if i > 2 then add(literal('')) end
          -- Ragged rows keep every header and cell; surplus cells use positional labels.
          for k = 1, math.max(#p.rows[1], #p.rows[i]) do
            add(concat({ literal('  '), p.rows[1][k] or literal(tostring(k)), literal(': '), p.rows[i][k] or literal('') }))
          end
        end
      end
    elseif not skipped[r] then
      add(project(body, r, 0, #line, code[r] and '  ' or '', false))
    end
  end
  body.layouts[layout] = { lines = lines, spans = spans, metadata = metadata }
  return lines, spans, metadata
end

return M
